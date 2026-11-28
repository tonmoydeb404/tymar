use std::path::{Path, PathBuf};

use parking_lot::Mutex;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::menu::MenuItem;

use crate::tray::{TrayGlyph, TrayState};

/// Which user has a timer running on this device and when Rust last heard
/// from itself (the heartbeat thread rewrites the timestamp every ~20s
/// while a timer runs). Mirrored to `sleep-guard.json` so the next launch
/// can detect that the app/machine was off in between (hard power-off,
/// crash): a long silence means open entries must be closed at the last
/// heartbeat instead of billing the dead time.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SleepGuard {
    pub user_id: Option<String>,
    pub last_alive_ms: i64,
}

const GUARD_FILE: &str = "sleep-guard.json";

pub fn load_guard(app_data_dir: &Path) -> SleepGuard {
    let text = std::fs::read_to_string(app_data_dir.join(GUARD_FILE)).unwrap_or_default();
    serde_json::from_str(&text).unwrap_or_default()
}

pub fn save_guard(app_data_dir: &Path, guard: &SleepGuard) -> Result<(), String> {
    let path = app_data_dir.join(GUARD_FILE);
    let text = serde_json::to_string(guard).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, text).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

/// Shared state managed by Tauri: the SQLite connection for settings, the
/// tray's mirrored timer state (pushed from the frontend), and the app data
/// directory where logs live.
///
/// The db mutex is `parking_lot`: its guards never poison, so a panic inside
/// one command can't leave every later command failing until restart.
#[allow(dead_code)]
pub struct AppState {
    pub db: Mutex<Connection>,
    /// Timer state the frontend pushes for the tray to render. Rust owns
    /// no timer state — SQLite (read by the frontend) is the source of truth.
    pub tray: Mutex<TrayState>,
    /// Handle to the tray menu's status row so the 1s ticker can refresh
    /// its text without a full menu rebuild.
    pub status_item: Mutex<Option<MenuItem<tauri::Wry>>>,
    /// Last menubar title we set, so the ticker skips redundant native
    /// updates.
    pub tray_title: Mutex<Option<String>>,
    /// Which menubar icon is currently set (logo vs state glyph), so the
    /// icon swaps only on state changes.
    pub tray_glyph: Mutex<TrayGlyph>,
    /// Sleep monitor: who is timing on this device + the heartbeat used to
    /// detect power-offs at next boot (see sleep_monitor.rs).
    pub sleep_guard: Mutex<SleepGuard>,
    /// Epoch ms of the last native suspend observed this run (None until one
    /// happens). The frontend watchdog consumes it via `take_sleep_info` to
    /// tell a real suspend apart from a throttled/App-Napped webview before
    /// trusting a JS-tick wall-clock gap. Taken (cleared) on read.
    pub last_suspend_ms: Mutex<Option<i64>>,
    /// Whether platform sleep observers registered successfully. False means
    /// the frontend watchdog is the only sleep detector and must keep its
    /// old gap-based fallback behavior.
    pub native_sleep_supported: Mutex<bool>,
    /// Payload for `take_power_gap` — set once at boot when open entries
    /// were closed after a long absence; consumed by the frontend because
    /// its listeners aren't up yet this early in startup.
    pub pending_power_gap: Mutex<Option<crate::sleep_monitor::PowerGapPayload>>,
    pub app_data_dir: PathBuf,
}

impl AppState {
    pub fn new(conn: Connection, app_data_dir: PathBuf) -> Self {
        AppState {
            db: Mutex::new(conn),
            tray: Mutex::new(TrayState::default()),
            status_item: Mutex::new(None),
            tray_title: Mutex::new(None),
            tray_glyph: Mutex::new(TrayGlyph::Logo),
            sleep_guard: Mutex::new(load_guard(&app_data_dir)),
            last_suspend_ms: Mutex::new(None),
            native_sleep_supported: Mutex::new(false),
            pending_power_gap: Mutex::new(None),
            app_data_dir,
        }
    }

    #[allow(dead_code)]
    pub fn logs_dir(&self) -> PathBuf {
        self.app_data_dir.join("logs")
    }
}
