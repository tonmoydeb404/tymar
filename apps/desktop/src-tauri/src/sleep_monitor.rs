//! System sleep/wake + power-off monitoring for the timer.
//!
//! Three ways a timer can span dead time, each with its own mechanism:
//!
//! 1. **System sleep** — macOS: NSWorkspace willSleep/didWake
//!    notifications. Windows: WM_POWERBROADCAST on a hidden message window.
//!    Linux: the systemd-logind `PrepareForSleep` D-Bus signal.
//!    On suspend, Rust itself closes the user's open time entries in
//!    SQLite (webview-independent and offline-safe; the sync engine pushes
//!    the correction later), resets the tray to idle, and emits
//!    `tymar://slept`. On wake it emits `tymar://woke`; the frontend then
//!    auto-resumes with a fresh entry starting at wake time. Platforms
//!    without a native event (or when delivery fails) are covered by the
//!    frontend watchdog.
//!
//! 2. **Power-off / crash** — nothing can run at the moment of death, so
//!    while a timer runs a heartbeat thread rewrites `sleep-guard.json`
//!    every [`HEARTBEAT_INTERVAL_MS`]. At the next boot,
//!    [`reconcile_boot`] compares the stored heartbeat with now: a silence
//!    longer than [`POWER_GAP_THRESHOLD_MS`] means the app wasn't running —
//!    open entries are closed at the *last heartbeat* (the off period is
//!    never billed) and the payload is parked for the frontend via
//!    `take_power_gap`, which resumes the timer and explains the gap.
//!    Short silences (app restarts, updater relaunches) keep the timer
//!    running untouched — session continuity is preserved.
//!
//! 3. **Sleep missed its event** (rare) — also handled by the frontend
//!    watchdog; this module's job is to be the precise, webview-independent
//!    path on macOS.

use chrono::{DateTime, SecondsFormat, Utc};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::db;
use crate::domain::TimeEntryRow;
use crate::state::{save_guard, AppState, SleepGuard};

/// How often the heartbeat rewrites the guard file while a timer runs.
pub const HEARTBEAT_INTERVAL_MS: i64 = 20_000;
/// A boot-time silence longer than this means the app wasn't running in
/// between — close at the last heartbeat. Updater restarts and quick
/// relaunches land far below it.
pub const POWER_GAP_THRESHOLD_MS: i64 = 5 * 60 * 1000;

const SLEEP_STOP_ENABLED_KEY: &str = "sleep_stop_enabled";

// ---- Events ----

#[derive(Debug, Clone, Serialize)]
pub struct SleptPayload {
    /// Epoch ms when the open entries were closed (≈ the moment of sleep).
    pub closed_at_ms: i64,
    pub entries: Vec<TimeEntryRow>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WokePayload {
    pub woke_at_ms: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct PowerGapPayload {
    /// Epoch ms the entries were closed at (the last heartbeat — not the
    /// boot time; dead time must never be billed).
    pub closed_at_ms: i64,
    /// How long the app/machine was gone.
    pub gap_ms: i64,
    pub entries: Vec<TimeEntryRow>,
}

// ---- Time helpers ----

fn now_ms() -> i64 {
    Utc::now().timestamp_millis()
}

/// ISO timestamp in the same format the frontend produces (`toISOString()`:
/// millisecond precision, `Z` suffix).
fn iso_from_ms(ms: i64) -> String {
    DateTime::<Utc>::from_timestamp_millis(ms)
        .unwrap_or_else(Utc::now)
        .to_rfc3339_opts(SecondsFormat::Millis, true)
}

// ---- Guard management ----

/// Called from the frontend whenever its active timer changes: arms the
/// heartbeat while a timer runs, disarms it when idle.
pub fn set_guard(app: &AppHandle, user_id: Option<String>) {
    let state = app.state::<AppState>();
    let mut guard = state.sleep_guard.lock();
    guard.user_id = user_id;
    guard.last_alive_ms = now_ms();
    let _ = save_guard(&state.app_data_dir, &guard);
}

/// One heartbeat tick: refresh the timestamp while a timer is running.
fn beat(state: &AppState) {
    let mut guard = state.sleep_guard.lock();
    if guard.user_id.is_none() {
        return;
    }
    guard.last_alive_ms = now_ms();
    let _ = save_guard(&state.app_data_dir, &guard);
}

/// True unless the user explicitly turned sleep-stopping off in settings.
/// Rust reads the setting itself (not the frontend) because the webview may
/// already be frozen when the suspend notification arrives.
fn sleep_stop_enabled(state: &AppState) -> bool {
    let conn = state.db.lock();
    db::get_setting(&conn, SLEEP_STOP_ENABLED_KEY).as_deref() != Some("false")
}

/// Closes the guard user's open entries at `ended_at_ms` and resets the
/// tray to idle (the menubar would otherwise keep drawing a running timer
/// the frontend can no longer see). Returns what was closed.
fn close_guard_entries(app: &AppHandle, ended_at_ms: i64) -> Vec<TimeEntryRow> {
    let state = app.state::<AppState>();
    let user_id = state.sleep_guard.lock().user_id.clone();
    let Some(user_id) = user_id else {
        return Vec::new();
    };

    let closed = {
        let conn = state.db.lock();
        db::close_all_open_entries(&conn, &user_id, &iso_from_ms(ended_at_ms))
            .unwrap_or_default()
    };

    if !closed.is_empty() {
        {
            let mut tray = state.tray.lock();
            *tray = Default::default();
        }
        crate::tray::rebuild_menu(app);
    }
    closed
}

/// Disarms the guard after its entries were closed — nothing is running
/// anymore, so neither the heartbeat nor boot reconciliation must fire.
fn disarm(state: &AppState) {
    let mut guard = state.sleep_guard.lock();
    *guard = SleepGuard::default();
    let _ = save_guard(&state.app_data_dir, &guard);
}

// ---- Lifecycle ----

/// Spawns the heartbeat thread and registers platform observers. Call once
/// from setup, after `AppState` is managed.
pub fn start(app: AppHandle) {
    let heartbeat_handle = app.clone();
    std::thread::Builder::new()
        .name("sleep-heartbeat".into())
        .spawn(move || loop {
            std::thread::sleep(std::time::Duration::from_millis(
                HEARTBEAT_INTERVAL_MS as u64,
            ));
            beat(&heartbeat_handle.state::<AppState>());
        })
        .expect("failed to spawn sleep heartbeat thread");

    #[cfg(any(
        target_os = "macos",
        target_os = "windows",
        target_os = "linux"
    ))]
    register_observers(&app);
}

/// Boot reconciliation: if the previous run left a guard armed and it has
/// been silent for a long time, the machine was off — close its open
/// entries at the last heartbeat (never at boot time, which would bill the
/// whole absence) and park a payload for the frontend to resume from.
/// Must run before the webview loads (it's faster than the frontend either
/// way, and the payload is fetched, not listened for).
pub fn reconcile_boot(app: &AppHandle) {
    let state = app.state::<AppState>();
    let (guard_armed, last_alive_ms) = {
        let guard = state.sleep_guard.lock();
        (guard.user_id.is_some(), guard.last_alive_ms)
    };
    if !guard_armed {
        return;
    }

    let now = now_ms();
    let gap_ms = now - last_alive_ms;
    if gap_ms < POWER_GAP_THRESHOLD_MS {
        // Quick restart (update relaunch, manual restart) — the timer was
        // continuous; leave everything untouched.
        return;
    }

    let closed = close_guard_entries(app, last_alive_ms);
    disarm(&state);

    if closed.is_empty() {
        return;
    }

    let payload = PowerGapPayload {
        closed_at_ms: last_alive_ms,
        gap_ms,
        entries: closed,
    };
    *state.pending_power_gap.lock() = Some(payload.clone());
    // Emitted for completeness — at this point the webview usually has no
    // listener yet, which is why the payload is also parked in state.
    let _ = app.emit("tymar://power-gap", payload);
}

// ---- Platform observers ----
// Each platform delivers the same two events into shared on_suspend /
// on_wake; unsupported platforms fall back to the frontend watchdog.

/// System is about to sleep: close the running timer right now so the
/// sleep window is never billed, then tell the frontend.
fn on_suspend(app: &AppHandle) {
    let state = app.state::<AppState>();
    if state.sleep_guard.lock().user_id.is_none() {
        return; // nothing running on this device
    }
    if !sleep_stop_enabled(&state) {
        return; // user asked to keep counting across sleep
    }

    let closed_at_ms = now_ms();
    let closed = close_guard_entries(app, closed_at_ms);
    disarm(&state);

    if !closed.is_empty() {
        let _ = app.emit(
            "tymar://slept",
            SleptPayload {
                closed_at_ms,
                entries: closed,
            },
        );
    }
}

/// System woke up: the frontend reconciles (local DB vs what it holds) and
/// auto-resumes when enabled.
fn on_wake(app: &AppHandle) {
    let _ = app.emit(
        "tymar://woke",
        WokePayload {
            woke_at_ms: now_ms(),
        },
    );
}

// ---- macOS: NSWorkspace sleep/wake notifications ----

#[cfg(target_os = "macos")]
fn register_observers(app: &AppHandle) {
    use objc2::rc::Retained;
    use objc2::runtime::AnyObject;
    use objc2_app_kit::{NSWorkspace, NSWorkspaceDidWakeNotification, NSWorkspaceWillSleepNotification};
    use objc2_foundation::{NSNotificationCenter, NSNotification};
    use block2::RcBlock;
    use std::ptr::NonNull;

    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        // NSWorkspace notification-center registration belongs on the main
        // thread; we're inside run_on_main_thread so that holds.
        let workspace: Retained<NSWorkspace> = NSWorkspace::sharedWorkspace();
        let center: Retained<NSNotificationCenter> = workspace.notificationCenter();

        // App-lifetime observers: tokens are intentionally leaked — dropping
        // one would unregister it.
        let sleep_handle = handle.clone();
        let sleep_block = RcBlock::new(move |_notif: NonNull<NSNotification>| {
            let h = sleep_handle.clone();
            // Keep the posting thread unblocked (the system is about to
            // sleep and grants only a grace window); the DB work runs on
            // the async runtime, which always gets scheduled in time.
            tauri::async_runtime::spawn(async move {
                on_suspend(&h);
            });
        });
        unsafe {
            let token = center.addObserverForName_object_queue_usingBlock(
                Some(NSWorkspaceWillSleepNotification),
                None::<&AnyObject>,
                None,
                &sleep_block,
            );
            std::mem::forget(token);
        }

        let wake_handle = handle.clone();
        let wake_block = RcBlock::new(move |_notif: NonNull<NSNotification>| {
            let h = wake_handle.clone();
            tauri::async_runtime::spawn(async move {
                on_wake(&h);
            });
        });
        unsafe {
            let token = center.addObserverForName_object_queue_usingBlock(
                Some(NSWorkspaceDidWakeNotification),
                None::<&AnyObject>,
                None,
                &wake_block,
            );
            std::mem::forget(token);
        }
    });
}

// ---- Windows: WM_POWERBROADCAST on a hidden message window ----

#[cfg(target_os = "windows")]
fn register_observers(app: &AppHandle) {
    use std::sync::OnceLock;
    static APP: OnceLock<AppHandle> = OnceLock::new();
    let _ = APP.set(app.clone());

    std::thread::Builder::new()
        .name("power-window".into())
        .spawn(|| unsafe { run_power_message_loop() })
        .expect("failed to spawn power message thread");

    // A hidden 0×0 popup window pumps WM_POWERBROADCAST. Message-only
    // windows (HWND_MESSAGE) don't receive broadcasts, so this must be a
    // real top-level window that is never shown — same approach Chromium
    // uses for power notifications.
    unsafe fn run_power_message_loop() {
        use windows::core::PCWSTR;
        use windows::Win32::Foundation::{HINSTANCE, HWND, LPARAM, LRESULT, WPARAM};
        use windows::Win32::System::LibraryLoader::GetModuleHandleW;
        use windows::Win32::UI::WindowsAndMessaging::{
            CreateWindowExW, DefWindowProcW, DispatchMessageW, GetMessageW,
            RegisterClassW, TranslateMessage, MSG, WINDOW_EX_STYLE, WINDOW_STYLE,
            WNDCLASSW, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_POPUP,
            PBT_APMRESUMEAUTOMATIC, PBT_APMRESUMESUSPEND, PBT_APMSUSPEND,
            WM_POWERBROADCAST,
        };

        unsafe extern "system" fn wndproc(
            hwnd: HWND,
            msg: u32,
            wparam: WPARAM,
            lparam: LPARAM,
        ) -> LRESULT {
            if msg == WM_POWERBROADCAST {
                if let Some(app) = APP.get() {
                    match wparam.0 as u32 {
                        PBT_APMSUSPEND => {
                            let h = app.clone();
                            tauri::async_runtime::spawn(async move {
                                on_suspend(&h);
                            });
                        }
                        // RESUMEAUTOMATIC fires after every resume; a user
                        // interaction additionally sends RESUMESUSPEND.
                        PBT_APMRESUMEAUTOMATIC | PBT_APMRESUMESUSPEND => {
                            let h = app.clone();
                            tauri::async_runtime::spawn(async move {
                                on_wake(&h);
                            });
                        }
                        _ => {}
                    }
                }
            }
            DefWindowProcW(hwnd, msg, wparam, lparam)
        }

        let hmodule = GetModuleHandleW(PCWSTR::null())
            .expect("GetModuleHandleW failed");
        let hinstance = HINSTANCE(hmodule.0);
        let class_name: Vec<u16> = "TymarPowerWindow\0"
            .encode_utf16()
            .collect();

        let wndclass = WNDCLASSW {
            lpfnWndProc: Some(wndproc),
            hInstance: hinstance,
            lpszClassName: PCWSTR(class_name.as_ptr()),
            ..Default::default()
        };
        RegisterClassW(&wndclass);

        let hwnd = CreateWindowExW(
            WINDOW_EX_STYLE(WS_EX_TOOLWINDOW.0 | WS_EX_NOACTIVATE.0),
            PCWSTR(class_name.as_ptr()),
            PCWSTR(class_name.as_ptr()),
            WINDOW_STYLE(WS_POPUP.0),
            0,
            0,
            0,
            0,
            None,
            None,
            Some(hinstance),
            None,
        )
        .expect("CreateWindowExW failed");
        std::mem::forget(hwnd); // the window lives until process exit

        let mut msg = MSG::default();
        // -1 on error, 0 on WM_QUIT — either way there's nothing to pump.
        while GetMessageW(&mut msg, None, 0, 0).as_bool() {
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }
}

// ---- Linux: systemd-logind PrepareForSleep signal over D-Bus ----

#[cfg(target_os = "linux")]
fn register_observers(app: &AppHandle) {
    tauri::async_runtime::spawn(logind_listener(app.clone()));
}

#[cfg(target_os = "linux")]
async fn logind_listener(app: AppHandle) {
    use futures_util::StreamExt;
    use zbus::proxy;

    #[proxy(
        default_service = "org.freedesktop.login1",
        default_path = "/org/freedesktop/login1",
        interface = "org.freedesktop.login1.Manager"
    )]
    trait Login1Manager {
        #[zbus(signal)]
        fn prepare_for_sleep(&self, start: bool) -> zbus::Result<()>;
    }

    let conn = match zbus::Connection::system().await {
        Ok(conn) => conn,
        Err(err) => {
            eprintln!(
                "sleep monitor: no system D-Bus bus ({err}) — watchdog fallback only"
            );
            return;
        }
    };
    let proxy = match Login1ManagerProxy::new(&conn).await {
        Ok(proxy) => proxy,
        Err(err) => {
            eprintln!(
                "sleep monitor: logind unavailable ({err}) — watchdog fallback only"
            );
            return;
        }
    };
    let Ok(mut stream) = proxy.receive_prepare_for_sleep().await else {
        eprintln!(
            "sleep monitor: could not subscribe to PrepareForSleep — watchdog fallback only"
        );
        return;
    };

    // start=true → suspending; start=false → resuming.
    while let Some(signal) = stream.next().await {
        let Ok(args) = signal.args() else {
            continue;
        };
        let h = app.clone();
        if *args.start() {
            tauri::async_runtime::spawn(async move {
                on_suspend(&h);
            });
        } else {
            tauri::async_runtime::spawn(async move {
                on_wake(&h);
            });
        }
    }
}
