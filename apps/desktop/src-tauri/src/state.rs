use std::path::PathBuf;

use parking_lot::Mutex;
use rusqlite::Connection;
use tauri::menu::MenuItem;

use crate::tray::{TrayGlyph, TrayState};

/// Shared state managed by Tauri: the SQLite connection for settings, the
/// tray's mirrored timer state (pushed from the frontend), and the app data
/// directory where logs and the legacy timer state file live.
///
/// The db mutex is `parking_lot`: its guards never poison, so a panic inside
/// one command can't leave every later command failing until restart.
#[allow(dead_code)]
pub struct AppState {
    pub db: Mutex<Connection>,
    /// Timer state the frontend pushes for the tray to render. Rust owns
    /// no timer state — the cloud (Appwrite) is the source of truth.
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
            app_data_dir,
        }
    }

    #[allow(dead_code)]
    pub fn logs_dir(&self) -> PathBuf {
        self.app_data_dir.join("logs")
    }
}
