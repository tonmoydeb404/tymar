//! Dynamic system-tray menu + macOS menubar title: the primary timer
//! controls live here.
//!
//! Rust owns no timer state anymore — the frontend (which talks to
//! Appwrite, including realtime) pushes a `TrayState` via `set_tray_state`
//! whenever the running timer changes. A native 1s ticker then derives the
//! live readout from the pushed `started_at_ms` anchor, so the menubar
//! title keeps ticking even while the (hidden) webview throttles its JS
//! timers. While a timer runs, the app logo is hidden and a state prefix
//! with the elapsed time is the only menubar indicator; menu clicks for
//! timer controls are emitted back to the frontend as `tymar://tray-action`
//! events.

use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIcon,
    AppHandle, Emitter, Manager,
};

use crate::{env, state::AppState};

/// Mirrored timer state pushed from the frontend.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct TrayState {
    pub running: bool,
    pub on_break: bool,
    pub title: Option<String>,
    pub elapsed_ms: i64,
    /// Epoch ms when the open entry started — the anchor the ticker derives
    /// the live readout from (`None` while idle).
    #[serde(default)]
    pub started_at_ms: Option<i64>,
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

/// Live elapsed for the current state, recomputed from the anchor so the
/// readout stays fresh even if the last frontend push is old.
fn live_elapsed(tray_state: &mut TrayState) {
    if let (true, Some(start)) = (tray_state.running, tray_state.started_at_ms) {
        tray_state.elapsed_ms = (now_ms() - start).max(0);
    }
}

fn format_elapsed(total_ms: i64) -> String {
    let total = (total_ms.max(0) / 1000) as u64;
    format!(
        "{:02}:{:02}:{:02}",
        total / 3600,
        (total % 3600) / 60,
        total % 60
    )
}

/// Compact HH:MM for the menubar title.
fn format_minutes(total_ms: i64) -> String {
    let total = (total_ms.max(0) / 1000) as u64;
    format!("{:02}:{:02}", total / 3600, (total % 3600) / 60)
}

// ---- Menubar icon ----
// While a timer runs (work or break) the app logo is hidden and the
// elapsed time is the only menubar indicator; the logo returns when idle.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrayGlyph {
    Logo,
    Hidden,
}

static LOGO: OnceLock<Image<'static>> = OnceLock::new();

/// Swaps the menubar icon only when the state actually changed.
fn set_tray_glyph(state: &tauri::State<'_, AppState>, tray: &TrayIcon, desired: TrayGlyph) {
    let current = state
        .tray_glyph
        .lock()
        .map(|g| *g)
        .unwrap_or(TrayGlyph::Logo);
    if current == desired {
        return;
    }
    let ok = match desired {
        TrayGlyph::Logo => {
            let logo = LOGO.get_or_init(|| {
                Image::from_bytes(include_bytes!("../icons/32x32.png"))
                    .expect("bundled tray logo is a valid PNG")
            });
            tray.set_icon(Some(logo.clone())).is_ok()
        }
        TrayGlyph::Hidden => tray.set_icon(None).is_ok(),
    };
    if ok {
        if let Ok(mut slot) = state.tray_glyph.lock() {
            *slot = desired;
        }
    }
}

/// Status row shown at the top of the tray menu.
fn status_text(tray_state: &TrayState) -> String {
    if !tray_state.running {
        format!("{} — Idle", env::display_name())
    } else {
        let title = tray_state
            .title
            .clone()
            .unwrap_or_else(|| "Untitled session".into());
        format!("● {title} — {}", format_elapsed(tray_state.elapsed_ms))
    }
}

macro_rules! item {
    ($menu:expr, $app:expr, $id:expr, $title:expr, $enabled:expr) => {
        if let Ok(i) = MenuItem::with_id($app, $id, $title, $enabled, None::<&str>) {
            let _ = $menu.append(&i);
        }
    };
}

macro_rules! separator {
    ($menu:expr, $app:expr) => {
        if let Ok(s) = PredefinedMenuItem::separator($app) {
            let _ = $menu.append(&s);
        }
    };
}

/// Rebuilds the tray menu (and tooltip) from the state the frontend pushed.
pub fn rebuild_menu(app: &AppHandle) {
    let state = app.state::<AppState>();
    let mut tray_state = state.tray.lock().ok().map(|g| g.clone()).unwrap_or_default();
    live_elapsed(&mut tray_state);

    let menu = match Menu::new(app) {
        Ok(m) => m,
        Err(_) => return,
    };

    // Status row (disabled). Its handle is retained so the ticker can
    // refresh the text without a full menu rebuild.
    if let Ok(status) =
        MenuItem::with_id(app, "status", status_text(&tray_state), false, None::<&str>)
    {
        let _ = menu.append(&status);
        if let Ok(mut slot) = state.status_item.lock() {
            *slot = Some(status);
        }
    }
    separator!(menu, app);

    if !tray_state.running {
        item!(menu, app, "start", "Start Timer", true);
        separator!(menu, app);
    } else {
        if tray_state.on_break {
            item!(menu, app, "resume", "Resume", true);
        } else {
            item!(menu, app, "break", "Break", true);
        }
        item!(menu, app, "stop", "Stop", true);
        item!(menu, app, "switch", "Switch Task", true);
        separator!(menu, app);
    }

    item!(
        menu,
        app,
        "open",
        &format!("Open {}", env::display_name()),
        true
    );
    item!(
        menu,
        app,
        "quit",
        &format!("Quit {}", env::display_name()),
        true
    );

    if let Some(tray) = app.tray_by_id("main_tray") {
        let _ = tray.set_menu(Some(menu));
        if !tray_state.running {
            let _ = tray.set_tooltip(Some(env::display_name()));
        }
    }

    // Sync the menubar icon + title with the new state right away; the 1s
    // ticker keeps them fresh afterwards.
    update_title(app);
}

/// Recomputes the menubar icon + title, tooltip and menu status row from
/// the pushed anchor. Called by the ticker and after every state push.
pub fn update_title(app: &AppHandle) {
    let state = app.state::<AppState>();
    let mut tray_state = state.tray.lock().ok().map(|g| g.clone()).unwrap_or_default();

    let Some(tray) = app.tray_by_id("main_tray") else {
        return;
    };

    if !tray_state.running || tray_state.started_at_ms.is_none() {
        set_tray_glyph(&state, &tray, TrayGlyph::Logo);
        clear_title(app, &state);
        return;
    }
    live_elapsed(&mut tray_state);
    set_tray_glyph(&state, &tray, TrayGlyph::Hidden);

    // Menubar title: state prefix + compact HH:MM — the only menubar
    // indicator while a timer runs (the logo stays hidden). Pushed to the
    // OS only when the rendered string actually changes.
    let title = format!(
        "{} {}",
        if tray_state.on_break { "⏸" } else { "●" },
        format_minutes(tray_state.elapsed_ms)
    );
    let needs_set = state
        .tray_title
        .lock()
        .map(|g| g.as_deref() != Some(title.as_str()))
        .unwrap_or(true);
    if needs_set && tray.set_title(Some(title.as_str())).is_ok() {
        if let Ok(mut slot) = state.tray_title.lock() {
            *slot = Some(title);
        }
    }

    // Tooltip and menu status row keep the precise HH:MM:SS readout.
    let title = tray_state
        .title
        .clone()
        .unwrap_or_else(|| "Untitled session".into());
    let state_label = if tray_state.on_break {
        "On break"
    } else {
        "Tracking"
    };
    let _ = tray.set_tooltip(Some(format!(
        "{state_label}: {title} ({})",
        format_elapsed(tray_state.elapsed_ms)
    )));
    if let Ok(slot) = state.status_item.lock() {
        if let Some(item) = slot.as_ref() {
            let _ = item.set_text(status_text(&tray_state));
        }
    };
}

/// Clears the menubar title (icon only) unless it is already cleared.
fn clear_title(app: &AppHandle, state: &tauri::State<'_, AppState>) {
    let already_clear = state
        .tray_title
        .lock()
        .map(|g| g.is_none())
        .unwrap_or(true);
    if already_clear {
        return;
    }
    if let Some(tray) = app.tray_by_id("main_tray") {
        if tray.set_title(Option::<&str>::None).is_ok() {
            if let Ok(mut slot) = state.tray_title.lock() {
                *slot = None;
            }
        }
    }
}

/// Native 1s ticker: keeps the menubar icon + title / tooltip / menu status
/// row live even while the webview is hidden (where JS timers are
/// throttled). Runs on the main thread, as the macOS tray APIs require.
pub fn spawn_title_ticker(app: &AppHandle) {
    let handle = app.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(1));
        let h = handle.clone();
        let cb = h.clone();
        if h.run_on_main_thread(move || update_title(&cb)).is_err() {
            return; // app is shutting down
        }
    });
}

pub fn handle_menu_event(app: &AppHandle, id: &str) {
    match id {
        "open" => {
            crate::show_window(app);
        }
        "quit" => {
            app.exit(0);
        }
        // Timer controls are performed by the frontend (the only place with
        // an Appwrite session); emit the intent and let it act.
        "break" | "resume" | "stop" => {
            let _ = app.emit("tymar://tray-action", id.to_string());
        }
        "switch" => {
            // The task picker lives in the Home screen: open the window and
            // ask the frontend to show it.
            crate::show_window(app);
            let _ = app.emit("tymar://open-switcher", ());
        }
        "start" => {
            crate::show_window(app);
            let _ = app.emit("tymar://open-switcher", ());
        }
        _ => {}
    }
}
