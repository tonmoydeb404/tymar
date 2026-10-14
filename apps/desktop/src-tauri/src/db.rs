use std::fs;
use std::path::Path;

use rusqlite::{params, Connection};

pub type DbResult<T> = Result<T, rusqlite::Error>;

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

use crate::domain::{AckIds, PendingSyncPayload, ProjectRow, SyncPullPayload, TaskRow, TimeEntryRow};

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

// ---- Projects ----

pub fn list_projects(conn: &Connection, user_id: &str) -> DbResult<Vec<ProjectRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, user_id, name, description, status, deleted_at,
                created_at, updated_at, sync_status
         FROM projects
         WHERE user_id = ?1 AND deleted_at IS NULL AND sync_status != 'pending_delete'
         ORDER BY updated_at DESC
         LIMIT 200",
    )?;
    let rows = stmt.query_map(params![user_id], |r| {
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
        })
    })?;
    rows.collect()
}

pub fn upsert_project(conn: &Connection, row: &ProjectRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO projects
            (id, user_id, name, description, status, deleted_at, created_at, updated_at, sync_status)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
         ON CONFLICT(id) DO UPDATE SET
            name=excluded.name, description=excluded.description,
            status=excluded.status, deleted_at=excluded.deleted_at,
            updated_at=excluded.updated_at, sync_status=excluded.sync_status",
        params![
            row.id, row.user_id, row.name, row.description, row.status,
            row.deleted_at, row.created_at, row.updated_at, row.sync_status
        ],
    )?;
    Ok(())
}

// ---- Tasks ----

pub fn list_tasks(conn: &Connection, user_id: &str) -> DbResult<Vec<TaskRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, user_id, project_id, title, description, status, priority,
                due_date, completed_at, deleted_at, created_at, updated_at, sync_status
         FROM tasks
         WHERE user_id = ?1 AND deleted_at IS NULL AND sync_status != 'pending_delete'
         ORDER BY updated_at DESC
         LIMIT 500",
    )?;
    let rows = stmt.query_map(params![user_id], |r| {
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
        })
    })?;
    rows.collect()
}

pub fn upsert_task(conn: &Connection, row: &TaskRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO tasks
            (id, user_id, project_id, title, description, status, priority,
             due_date, completed_at, deleted_at, created_at, updated_at, sync_status)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)
         ON CONFLICT(id) DO UPDATE SET
            title=excluded.title, description=excluded.description,
            status=excluded.status, priority=excluded.priority,
            due_date=excluded.due_date, completed_at=excluded.completed_at,
            deleted_at=excluded.deleted_at, updated_at=excluded.updated_at,
            sync_status=excluded.sync_status",
        params![
            row.id, row.user_id, row.project_id, row.title, row.description,
            row.status, row.priority, row.due_date, row.completed_at,
            row.deleted_at, row.created_at, row.updated_at, row.sync_status
        ],
    )?;
    Ok(())
}

// ---- Time entries ----

pub fn list_time_entries(conn: &Connection, user_id: &str, limit: usize) -> DbResult<Vec<TimeEntryRow>> {
    let limit = limit.min(500).max(1) as i64;
    let mut stmt = conn.prepare(
        "SELECT id, user_id, task_id, project_id, type, started_at, ended_at,
                created_at, updated_at, sync_status
         FROM time_entries
         WHERE user_id = ?1 AND sync_status != 'pending_delete'
         ORDER BY started_at DESC
         LIMIT ?2",
    )?;
    let rows = stmt.query_map(params![user_id, limit], |r| {
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
        })
    })?;
    rows.collect()
}

pub fn get_active_time_entries(conn: &Connection, user_id: &str) -> DbResult<Vec<TimeEntryRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, user_id, task_id, project_id, type, started_at, ended_at,
                created_at, updated_at, sync_status
         FROM time_entries
         WHERE user_id = ?1 AND ended_at IS NULL AND sync_status != 'pending_delete'
         ORDER BY started_at DESC",
    )?;
    let rows = stmt.query_map(params![user_id], |r| {
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
        })
    })?;
    rows.collect()
}

pub fn insert_time_entry(conn: &Connection, row: &TimeEntryRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO time_entries
            (id, user_id, task_id, project_id, type, started_at, ended_at,
             created_at, updated_at, sync_status)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        params![
            row.id, row.user_id, row.task_id, row.project_id, row.entry_type,
            row.started_at, row.ended_at, row.created_at, row.updated_at,
            row.sync_status
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
    conn.query_row(
        "SELECT id, user_id, task_id, project_id, type, started_at, ended_at,
                created_at, updated_at, sync_status
         FROM time_entries WHERE id = ?1",
        params![id],
        |r| Ok(TimeEntryRow {
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
        }),
    ).map(Some).or(Ok(None))
}

pub fn upsert_time_entry(conn: &Connection, row: &TimeEntryRow) -> DbResult<()> {
    conn.execute(
        "INSERT INTO time_entries
            (id, user_id, task_id, project_id, type, started_at, ended_at,
             created_at, updated_at, sync_status)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
         ON CONFLICT(id) DO UPDATE SET
            task_id=excluded.task_id, project_id=excluded.project_id,
            type=excluded.type, started_at=excluded.started_at,
            ended_at=excluded.ended_at, updated_at=excluded.updated_at,
            sync_status=excluded.sync_status",
        params![
            row.id, row.user_id, row.task_id, row.project_id, row.entry_type,
            row.started_at, row.ended_at, row.created_at, row.updated_at,
            row.sync_status
        ],
    )?;
    Ok(())
}

/// Freshness heartbeat for the public status API: bumps updated_at on the
/// user's open entries (only synced ones — pending rows are pushed anyway)
/// so the next sync publishes a fresh updated_at upstream. The web layer
/// treats open entries untouched for 15 minutes as offline.
pub fn touch_active_time_entries(conn: &Connection, user_id: &str) -> DbResult<()> {
    conn.execute(
        "UPDATE time_entries
         SET updated_at = ?1, sync_status = 'pending_update'
         WHERE user_id = ?2 AND ended_at IS NULL AND sync_status = 'synced'",
        params![now_iso(), user_id],
    )?;
    Ok(())
}

// ---- Sync helpers ----

/// Returns all rows with a pending_* sync_status (what needs to be pushed).
pub fn get_pending_sync(conn: &Connection, user_id: &str) -> DbResult<PendingSyncPayload> {
    let projects = {
        let mut stmt = conn.prepare(
            "SELECT id, user_id, name, description, status, deleted_at,
                    created_at, updated_at, sync_status
             FROM projects WHERE user_id=?1 AND sync_status != 'synced'"
        )?;
        let result = stmt.query_map(params![user_id], |r| Ok(ProjectRow {
            id: r.get(0)?, user_id: r.get(1)?, name: r.get(2)?,
            description: r.get(3)?, status: r.get(4)?, deleted_at: r.get(5)?,
            created_at: r.get(6)?, updated_at: r.get(7)?, sync_status: r.get(8)?,
        }))?.collect::<rusqlite::Result<Vec<_>>>()?;
        result
    };
    let tasks = {
        let mut stmt = conn.prepare(
            "SELECT id, user_id, project_id, title, description, status, priority,
                    due_date, completed_at, deleted_at, created_at, updated_at, sync_status
             FROM tasks WHERE user_id=?1 AND sync_status != 'synced'"
        )?;
        let result = stmt.query_map(params![user_id], |r| Ok(TaskRow {
            id: r.get(0)?, user_id: r.get(1)?, project_id: r.get(2)?,
            title: r.get(3)?, description: r.get(4)?, status: r.get(5)?,
            priority: r.get(6)?, due_date: r.get(7)?, completed_at: r.get(8)?,
            deleted_at: r.get(9)?, created_at: r.get(10)?, updated_at: r.get(11)?,
            sync_status: r.get(12)?,
        }))?.collect::<rusqlite::Result<Vec<_>>>()?;
        result
    };
    let time_entries = {
        let mut stmt = conn.prepare(
            "SELECT id, user_id, task_id, project_id, type, started_at, ended_at,
                    created_at, updated_at, sync_status
             FROM time_entries WHERE user_id=?1 AND sync_status != 'synced'"
        )?;
        let result = stmt.query_map(params![user_id], |r| Ok(TimeEntryRow {
            id: r.get(0)?, user_id: r.get(1)?, task_id: r.get(2)?,
            project_id: r.get(3)?, entry_type: r.get(4)?, started_at: r.get(5)?,
            ended_at: r.get(6)?, created_at: r.get(7)?, updated_at: r.get(8)?,
            sync_status: r.get(9)?,
        }))?.collect::<rusqlite::Result<Vec<_>>>()?;
        result
    };
    Ok(PendingSyncPayload { projects, tasks, time_entries })
}

/// Marks pushed rows as 'synced'. Called after successful Supabase push.
pub fn ack_sync_push(conn: &Connection, user_id: &str, ids: &AckIds) -> DbResult<()> {
    for id in &ids.project_ids {
        conn.execute(
            "UPDATE projects SET sync_status='synced' WHERE id=?1 AND user_id=?2",
            params![id, user_id],
        )?;
    }
    for id in &ids.task_ids {
        conn.execute(
            "UPDATE tasks SET sync_status='synced' WHERE id=?1 AND user_id=?2",
            params![id, user_id],
        )?;
    }
    for id in &ids.entry_ids {
        conn.execute(
            "UPDATE time_entries SET sync_status='synced' WHERE id=?1 AND user_id=?2",
            params![id, user_id],
        )?;
    }
    Ok(())
}

/// Applies a pull payload from Supabase (last-write-wins on updated_at).
/// Dirty local rows (sync_status != 'synced') are never overwritten.
pub fn apply_sync_pull(conn: &Connection, payload: &SyncPullPayload) -> DbResult<()> {
    for row in &payload.projects {
        let dirty: bool = conn.query_row(
            "SELECT sync_status != 'synced' FROM projects WHERE id=?1",
            params![row.id],
            |r| r.get(0),
        ).unwrap_or(false);
        if !dirty {
            upsert_project(conn, row)?;
            // mark as synced since this came from the server
            conn.execute(
                "UPDATE projects SET sync_status='synced' WHERE id=?1",
                params![row.id],
            )?;
        }
    }
    for row in &payload.tasks {
        let dirty: bool = conn.query_row(
            "SELECT sync_status != 'synced' FROM tasks WHERE id=?1",
            params![row.id],
            |r| r.get(0),
        ).unwrap_or(false);
        if !dirty {
            upsert_task(conn, row)?;
            conn.execute(
                "UPDATE tasks SET sync_status='synced' WHERE id=?1",
                params![row.id],
            )?;
        }
    }
    for row in &payload.time_entries {
        let dirty: bool = conn.query_row(
            "SELECT sync_status != 'synced' FROM time_entries WHERE id=?1",
            params![row.id],
            |r| r.get(0),
        ).unwrap_or(false);
        if !dirty {
            upsert_time_entry(conn, row)?;
            conn.execute(
                "UPDATE time_entries SET sync_status='synced' WHERE id=?1",
                params![row.id],
            )?;
        }
    }
    Ok(())
}
