use serde::{Deserialize, Serialize};

// ---- Row types (match SQLite column names, snake_case) ----

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceRow {
    pub id: String,
    pub user_id: String,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub deleted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub sync_status: String,
    #[serde(default)]
    pub sync_attempts: i64,
    #[serde(default)]
    pub last_sync_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectRow {
    pub id: String,
    pub user_id: String,
    pub workspace_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub deleted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub sync_status: String,
    #[serde(default)]
    pub sync_attempts: i64,
    #[serde(default)]
    pub last_sync_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskRow {
    pub id: String,
    pub user_id: String,
    pub project_id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    pub due_date: Option<String>,
    pub completed_at: Option<String>,
    pub deleted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub sync_status: String,
    #[serde(default)]
    pub sync_attempts: i64,
    #[serde(default)]
    pub last_sync_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeEntryRow {
    pub id: String,
    pub user_id: String,
    pub task_id: Option<String>,
    pub project_id: Option<String>,
    #[serde(rename = "type")]
    pub entry_type: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub sync_status: String,
    #[serde(default)]
    pub sync_attempts: i64,
    #[serde(default)]
    pub last_sync_error: Option<String>,
}

// ---- Sync payload types ----

/// A batch of remote rows to apply to the local SQLite (pull).
/// Workspaces come first — projects reference them.
#[derive(Debug, Deserialize)]
pub struct SyncPullPayload {
    pub workspaces: Vec<WorkspaceRow>,
    pub projects: Vec<ProjectRow>,
    pub tasks: Vec<TaskRow>,
    pub time_entries: Vec<TimeEntryRow>,
}

/// Rows that are dirty locally and need to be pushed to Supabase.
/// Workspaces come first — projects reference them.
#[derive(Debug, Serialize)]
pub struct PendingSyncPayload {
    pub workspaces: Vec<WorkspaceRow>,
    pub projects: Vec<ProjectRow>,
    pub tasks: Vec<TaskRow>,
    pub time_entries: Vec<TimeEntryRow>,
}

#[derive(Debug, Deserialize)]
pub struct AckIds {
    pub workspace_ids: Vec<String>,
    pub project_ids: Vec<String>,
    pub task_ids: Vec<String>,
    pub entry_ids: Vec<String>,
    /// `updated_at` of each row as it was pushed (id → version). A row
    /// edited while its push was in flight no longer matches and stays
    /// dirty, so the newer edit (e.g. a Stop) is pushed next cycle instead
    /// of being acked away.
    #[serde(default)]
    pub versions: std::collections::HashMap<String, String>,
}
