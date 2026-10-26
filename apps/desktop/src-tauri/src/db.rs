use std::fs;
use std::path::Path;

use chrono::DateTime;
use rusqlite::{params, Connection};

use crate::domain::{AckIds, PendingSyncPayload, ProjectRow, SyncPullPayload, TaskRow, TimeEntryRow};

pub type DbResult<T> = Result<T, rusqlite::Error>;

/// Rows that failed to push this many consecutive times stop being retried
/// automatically (the sync UI surfaces them; a manual retry ignores the cap).
pub const MAX_SYNC_ATTEMPTS: i64 = 10;

/// Opens (and migrates) the app database. The filename derives from the brand
/// slug (brand.json → brand.rs), so each app gets its own data file.
pub fn open_connection(app_data_dir: &Path) -> DbResult<Connection> {
    fs::create_dir_all(app_data_dir).ok();
    let db_path = app_data_dir.join(format!("{}.db", crate::brand::SLUG));
    let mut conn = Connection::open(db_path)?;

    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.busy_timeout(std::time::Duration::from_secs(5))?;

    crate::migrations::migrations()
        .to_latest(&mut conn)
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

    Ok(conn)
}

// ---- Settings: a simple key-value store for app preferences ----
// Add your own tables via new migrations in src/migrations/sql/.

#[allow(dead_code)]
pub fn get_setting(conn: &Connection, key: &str) -> Option<String> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |r| r.get(0),
    )
    .ok()
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> DbResult<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = ?2",
        params![key, value],
    )?;
    Ok(())
}

pub fn get_all_settings(conn: &Connection) -> DbResult<Vec<(String, String)>> {
    let mut stmt = conn.prepare("SELECT key, value FROM settings ORDER BY key")?;
    let rows = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}

// ---- Domain: projects, tasks, time_entries ----

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

/// True when the incoming `updated_at` is strictly newer than the local one.
/// Compares parsed timestamps (local rows use `+00:00` offsets, Supabase rows
/// use `Z` — lexicographic compare would be wrong across formats). Falls back
/// to inequality when either side fails to parse.
fn is_newer(incoming: &str, local: &str) -> bool {
    match (
        DateTime::parse_from_rfc3339(incoming),
        DateTime::parse_from_rfc3339(local),
    ) {
        (Ok(a), Ok(b)) => a > b,
        _ => incoming != local,
    }
}

// ---- Projects ----

const PROJECT_COLS: &str = "id, user_id, name, description, status, deleted_at,
                created_at, updated_at, sync_status, sync_attempts, last_sync_error";

fn read_project(r: &rusqlite::Row) -> rusqlite::Result<ProjectRow> {
    Ok(ProjectRow {
        id: r.get(0)?,
        user_id: r.get(1)?,
        name: r.get(2)?,
        description: r.get(3)?,
        status: r.get(4)?,
        deleted_at: r.get(5)?,
        created_at: r.get(6)?,
        updated_at: r.get(7)?,
        sync_status: r.get(8)?,
        sync_attempts: r.get(9)?,
        last_sync_error: r.get(10)?,
    })
}

pub fn list_projects(conn: &Connection, user_id: &str) -> DbResult<Vec<ProjectRow>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {PROJECT_COLS}
         FROM projects
         WHERE user_id = ?1 AND deleted_at IS NULL AND sync_status != 'pending_delete'
         ORDER BY updated_at DESC
         LIMIT 200"
    ))?;
    let rows = stmt.query_map(params![user_id], read_project)?;
    rows.collect()
}

pub fn upsert_project(conn: &Connection, row: &ProjectRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO projects
            (id, user_id, name, description, status, deleted_at, created_at, updated_at,
             sync_status, sync_attempts, last_sync_error)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
         ON CONFLICT(id) DO UPDATE SET
            name=excluded.name, description=excluded.description,
            status=excluded.status, deleted_at=excluded.deleted_at,
            updated_at=excluded.updated_at, sync_status=excluded.sync_status,
            sync_attempts=excluded.sync_attempts, last_sync_error=excluded.last_sync_error",
        params![
            row.id, row.user_id, row.name, row.description, row.status,
            row.deleted_at, row.created_at, row.updated_at, row.sync_status,
            row.sync_attempts, row.last_sync_error
        ],
    )?;
    Ok(())
}

// ---- Tasks ----

const TASK_COLS: &str = "id, user_id, project_id, title, description, status, priority,
                due_date, completed_at, deleted_at, created_at, updated_at, sync_status,
                sync_attempts, last_sync_error";

fn read_task(r: &rusqlite::Row) -> rusqlite::Result<TaskRow> {
    Ok(TaskRow {
        id: r.get(0)?,
        user_id: r.get(1)?,
        project_id: r.get(2)?,
        title: r.get(3)?,
        description: r.get(4)?,
        status: r.get(5)?,
        priority: r.get(6)?,
        due_date: r.get(7)?,
        completed_at: r.get(8)?,
        deleted_at: r.get(9)?,
        created_at: r.get(10)?,
        updated_at: r.get(11)?,
        sync_status: r.get(12)?,
        sync_attempts: r.get(13)?,
        last_sync_error: r.get(14)?,
    })
}

pub fn list_tasks(conn: &Connection, user_id: &str) -> DbResult<Vec<TaskRow>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {TASK_COLS}
         FROM tasks
         WHERE user_id = ?1 AND deleted_at IS NULL AND sync_status != 'pending_delete'
         ORDER BY updated_at DESC
         LIMIT 500"
    ))?;
    let rows = stmt.query_map(params![user_id], read_task)?;
    rows.collect()
}

pub fn upsert_task(conn: &Connection, row: &TaskRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO tasks
            (id, user_id, project_id, title, description, status, priority,
             due_date, completed_at, deleted_at, created_at, updated_at,
             sync_status, sync_attempts, last_sync_error)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)
         ON CONFLICT(id) DO UPDATE SET
            title=excluded.title, description=excluded.description,
            status=excluded.status, priority=excluded.priority,
            due_date=excluded.due_date, completed_at=excluded.completed_at,
            deleted_at=excluded.deleted_at, updated_at=excluded.updated_at,
            sync_status=excluded.sync_status,
            sync_attempts=excluded.sync_attempts, last_sync_error=excluded.last_sync_error",
        params![
            row.id, row.user_id, row.project_id, row.title, row.description,
            row.status, row.priority, row.due_date, row.completed_at,
            row.deleted_at, row.created_at, row.updated_at, row.sync_status,
            row.sync_attempts, row.last_sync_error
        ],
    )?;
    Ok(())
}

// ---- Time entries ----

const ENTRY_COLS: &str = "id, user_id, task_id, project_id, type, started_at, ended_at,
                created_at, updated_at, sync_status, sync_attempts, last_sync_error";

fn read_entry(r: &rusqlite::Row) -> rusqlite::Result<TimeEntryRow> {
    Ok(TimeEntryRow {
        id: r.get(0)?,
        user_id: r.get(1)?,
        task_id: r.get(2)?,
        project_id: r.get(3)?,
        entry_type: r.get(4)?,
        started_at: r.get(5)?,
        ended_at: r.get(6)?,
        created_at: r.get(7)?,
        updated_at: r.get(8)?,
        sync_status: r.get(9)?,
        sync_attempts: r.get(10)?,
        last_sync_error: r.get(11)?,
    })
}

pub fn list_time_entries(conn: &Connection, user_id: &str, limit: usize) -> DbResult<Vec<TimeEntryRow>> {
    let limit = limit.clamp(1, 500) as i64;
    let mut stmt = conn.prepare(&format!(
        "SELECT {ENTRY_COLS}
         FROM time_entries
         WHERE user_id = ?1 AND sync_status != 'pending_delete'
         ORDER BY started_at DESC
         LIMIT ?2"
    ))?;
    let rows = stmt.query_map(params![user_id, limit], read_entry)?;
    rows.collect()
}

pub fn get_active_time_entries(conn: &Connection, user_id: &str) -> DbResult<Vec<TimeEntryRow>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {ENTRY_COLS}
         FROM time_entries
         WHERE user_id = ?1 AND ended_at IS NULL AND sync_status != 'pending_delete'
         ORDER BY started_at DESC"
    ))?;
    let rows = stmt.query_map(params![user_id], read_entry)?;
    rows.collect()
}

pub fn insert_time_entry(conn: &Connection, row: &TimeEntryRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO time_entries
            (id, user_id, task_id, project_id, type, started_at, ended_at,
             created_at, updated_at, sync_status, sync_attempts, last_sync_error)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
        params![
            row.id, row.user_id, row.task_id, row.project_id, row.entry_type,
            row.started_at, row.ended_at, row.created_at, row.updated_at,
            row.sync_status, row.sync_attempts, row.last_sync_error
        ],
    )?;
    Ok(())
}

pub fn close_time_entry(conn: &Connection, id: &str, ended_at: &str) -> DbResult<Option<TimeEntryRow>> {
    let ts = now_iso();
    conn.execute(
        "UPDATE time_entries SET ended_at = ?1, updated_at = ?2, sync_status = 'pending_update'
         WHERE id = ?3 AND ended_at IS NULL",
        params![ended_at, ts, id],
    )?;
    let mut stmt = conn.prepare(&format!(
        "SELECT {ENTRY_COLS} FROM time_entries WHERE id = ?1"
    ))?;
    stmt.query_row(params![id], read_entry).map(Some).or(Ok(None))
}

pub fn upsert_time_entry(conn: &Connection, row: &TimeEntryRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO time_entries
            (id, user_id, task_id, project_id, type, started_at, ended_at,
             created_at, updated_at, sync_status, sync_attempts, last_sync_error)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)
         ON CONFLICT(id) DO UPDATE SET
            task_id=excluded.task_id, project_id=excluded.project_id,
            type=excluded.type, started_at=excluded.started_at,
            ended_at=excluded.ended_at, updated_at=excluded.updated_at,
            sync_status=excluded.sync_status,
            sync_attempts=excluded.sync_attempts, last_sync_error=excluded.last_sync_error",
        params![
            row.id, row.user_id, row.task_id, row.project_id, row.entry_type,
            row.started_at, row.ended_at, row.created_at, row.updated_at,
            row.sync_status, row.sync_attempts, row.last_sync_error
        ],
    )?;
    Ok(())
}

/// Freshness heartbeat for the public status API: bumps updated_at on the
/// user's open entries (only healthy synced ones — pending rows are pushed
/// anyway, and rows past the retry cap would churn forever) so the next sync
/// publishes a fresh updated_at upstream. The web layer treats open entries
/// untouched for 15 minutes as offline.
pub fn touch_active_time_entries(conn: &Connection, user_id: &str) -> DbResult<()> {
    conn.execute(
        "UPDATE time_entries
         SET updated_at = ?1, sync_status = 'pending_update'
         WHERE user_id = ?2 AND ended_at IS NULL AND sync_status = 'synced'
           AND sync_attempts < ?3",
        params![now_iso(), user_id, MAX_SYNC_ATTEMPTS],
    )?;
    Ok(())
}

// ---- Sync helpers ----

/// Returns all rows with a pending_* sync_status (what needs to be pushed).
/// The frontend decides what to do with rows whose sync_attempts hit the cap.
pub fn get_pending_sync(conn: &Connection, user_id: &str) -> DbResult<PendingSyncPayload> {
    let projects = {
        let mut stmt = conn.prepare(&format!(
            "SELECT {PROJECT_COLS} FROM projects WHERE user_id=?1 AND sync_status != 'synced'"
        ))?;
        let rows = stmt
            .query_map(params![user_id], read_project)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        rows
    };
    let tasks = {
        let mut stmt = conn.prepare(&format!(
            "SELECT {TASK_COLS} FROM tasks WHERE user_id=?1 AND sync_status != 'synced'"
        ))?;
        let rows = stmt
            .query_map(params![user_id], read_task)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        rows
    };
    let time_entries = {
        let mut stmt = conn.prepare(&format!(
            "SELECT {ENTRY_COLS} FROM time_entries WHERE user_id=?1 AND sync_status != 'synced'"
        ))?;
        let rows = stmt
            .query_map(params![user_id], read_entry)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        rows
    };
    Ok(PendingSyncPayload { projects, tasks, time_entries })
}

/// Records a failed push attempt for one row: bumps the attempt counter and
/// stores the error so the UI can show exactly what's stuck and why.
pub fn mark_sync_failed(
    conn: &Connection,
    kind: &str,
    id: &str,
    error: &str,
) -> DbResult<()> {
    let (table, capped_error) = match kind {
        "project" => ("projects", error),
        "task" => ("tasks", error),
        _ => ("time_entries", error),
    };
    // Bound the stored message — a stack of JSON can be huge and is noise.
    let truncated: String = capped_error.chars().take(500).collect();
    conn.execute(
        &format!(
            "UPDATE {table}
             SET sync_attempts = sync_attempts + 1, last_sync_error = ?1
             WHERE id = ?2"
        ),
        params![truncated, id],
    )?;
    Ok(())
}

/// Marks pushed rows as 'synced' and clears their failure state. Called after
/// a row was verifiably accepted by Supabase.
pub fn ack_sync_push(conn: &Connection, user_id: &str, ids: &AckIds) -> DbResult<()> {
    for id in &ids.project_ids {
        conn.execute(
            "UPDATE projects SET sync_status='synced', sync_attempts=0, last_sync_error=NULL
             WHERE id=?1 AND user_id=?2",
            params![id, user_id],
        )?;
    }
    for id in &ids.task_ids {
        conn.execute(
            "UPDATE tasks SET sync_status='synced', sync_attempts=0, last_sync_error=NULL
             WHERE id=?1 AND user_id=?2",
            params![id, user_id],
        )?;
    }
    for id in &ids.entry_ids {
        conn.execute(
            "UPDATE time_entries SET sync_status='synced', sync_attempts=0, last_sync_error=NULL
             WHERE id=?1 AND user_id=?2",
            params![id, user_id],
        )?;
    }
    Ok(())
}

/// Applies a pull payload from Supabase. Rules, per row:
///   1. Dirty local rows (sync_status != 'synced') are never overwritten.
///   2. Otherwise last-write-wins on `updated_at` — a stale payload must not
///      clobber newer local data.
///   3. Applied rows come from the server, so their failure state is cleared.
#[allow(clippy::too_many_lines)]
pub fn apply_sync_pull(conn: &Connection, payload: &SyncPullPayload) -> DbResult<()> {
    for row in &payload.projects {
        let local: Option<(String, String)> = conn
            .query_row(
                "SELECT sync_status, updated_at FROM projects WHERE id=?1",
                params![row.id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .ok();
        let skip = match local {
            None => false, // new row from the server — insert it
            Some((sync_status, updated_at)) => {
                sync_status != "synced" || !is_newer(&row.updated_at, &updated_at)
            }
        };
        if skip {
            continue;
        }
        upsert_project(conn, row)?;
        conn.execute(
            "UPDATE projects SET sync_status='synced', sync_attempts=0, last_sync_error=NULL
             WHERE id=?1",
            params![row.id],
        )?;
    }
    for row in &payload.tasks {
        let local: Option<(String, String)> = conn
            .query_row(
                "SELECT sync_status, updated_at FROM tasks WHERE id=?1",
                params![row.id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .ok();
        let skip = match local {
            None => false,
            Some((sync_status, updated_at)) => {
                sync_status != "synced" || !is_newer(&row.updated_at, &updated_at)
            }
        };
        if skip {
            continue;
        }
        upsert_task(conn, row)?;
        conn.execute(
            "UPDATE tasks SET sync_status='synced', sync_attempts=0, last_sync_error=NULL
             WHERE id=?1",
            params![row.id],
        )?;
    }
    for row in &payload.time_entries {
        let local: Option<(String, String)> = conn
            .query_row(
                "SELECT sync_status, updated_at FROM time_entries WHERE id=?1",
                params![row.id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .ok();
        let skip = match local {
            None => false,
            Some((sync_status, updated_at)) => {
                sync_status != "synced" || !is_newer(&row.updated_at, &updated_at)
            }
        };
        if skip {
            continue;
        }
        upsert_time_entry(conn, row)?;
        conn.execute(
            "UPDATE time_entries SET sync_status='synced', sync_attempts=0, last_sync_error=NULL
             WHERE id=?1",
            params![row.id],
        )?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::is_newer;

    #[test]
    fn newer_handles_offset_and_z_formats() {
        // Local rows use +00:00, Supabase rows use Z.
        assert!(is_newer(
            "2026-01-02T10:00:00Z",
            "2026-01-02T09:00:00.123+00:00"
        ));
        assert!(!is_newer(
            "2026-01-02T09:00:00Z",
            "2026-01-02T10:00:00+00:00"
        ));
        // Equal instants in different formats: not newer.
        assert!(!is_newer(
            "2026-01-02T10:00:00Z",
            "2026-01-02T10:00:00+00:00"
        ));
    }

    #[test]
    fn newer_falls_back_when_unparseable() {
        assert!(is_newer("b", "a"));
        assert!(!is_newer("a", "a"));
    }
}
