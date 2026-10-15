// Supabase table identifiers shared across desktop and web apps.

export const TABLES = {
  profiles: "profiles",
  projects: "projects",
  tasks: "tasks",
  timeEntries: "time_entries",
  publicStatusSettings: "public_status_settings",
} as const;

export type TableId = (typeof TABLES)[keyof typeof TABLES];

export const VIEWS = {
  timeEntriesWithDetails: "time_entries_with_details",
} as const;

export const OAUTH_CALLBACK_PATH = "/auth/callback";
