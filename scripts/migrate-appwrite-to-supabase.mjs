// Migrates Appwrite data (users, profiles, projects, tasks, time_entries) to Supabase.
// Idempotent — safe to re-run. Appwrite $id values are remapped to new UUIDs stored in
// scripts/migration-map.json for audit and cross-reference.
//
// Required env (from .env.local or .env):
//   APPWRITE_ENDPOINT     e.g. https://cloud.appwrite.io  (no /v1 — the script adds it)
//   APPWRITE_PROJECT_ID   your Appwrite project ID
//   APPWRITE_API_KEY      server key with database + users scopes
//   SUPABASE_URL          e.g. https://xyz.supabase.co
//   SUPABASE_SECRET_KEY
//
// Run with:
//   pnpm migrate:appwrite

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import dotenv from "dotenv";

dotenv.config({ path: [".env.local", ".env"] });

// ─── Config ──────────────────────────────────────────────────────────────────
const AW_ENDPOINT = process.env.APPWRITE_ENDPOINT?.replace(/\/$/, "").replace(/\/v1$/, "");
const AW_PROJECT = process.env.APPWRITE_PROJECT_ID;
const AW_KEY = process.env.APPWRITE_API_KEY;
const SB_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SB_KEY = process.env.SUPABASE_SECRET_KEY;

if (!AW_ENDPOINT || !AW_PROJECT || !AW_KEY || !SB_URL || !SB_KEY) {
  console.error(
    "Missing env: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, " +
      "SUPABASE_URL, SUPABASE_SECRET_KEY",
  );
  process.exit(1);
}

const AW_DB = "timer";
const MAP_PATH = new URL("./migration-map.json", import.meta.url).pathname;

// ─── Appwrite helpers ─────────────────────────────────────────────────────────
async function awFetch(path, params = {}) {
  const url = new URL(`${AW_ENDPOINT}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    headers: {
      "X-Appwrite-Project": AW_PROJECT,
      "X-Appwrite-Key": AW_KEY,
    },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON (e.g. HTML 404 page) */ }
  if (!res.ok) {
    throw new Error(`AW ${path} → ${res.status}: ${json?.message ?? text.slice(0, 300)}`);
  }
  return json;
}

// Cursor-based pagination; works for /v1/users and /v1/databases/*/collections/*/documents.
async function awListAll(path, pageSize = 100) {
  const items = [];
  let offset = 0;
  while (true) {
    const data = await awFetch(path, { limit: pageSize, offset });
    const page = data.documents ?? data.users ?? [];
    items.push(...page);
    if (items.length >= (data.total ?? 0) || page.length < pageSize) break;
    offset += pageSize;
  }
  return items;
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────
async function sbAdminFetch(path, method, body, extraHeaders = {}) {
  const res = await fetch(`${SB_URL}${path}`, {
    method,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SB ${method} ${path} → ${res.status}: ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Insert rows in batches; ignores duplicate PKs.
async function sbInsert(table, rows) {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += 500) {
    await sbAdminFetch(`/rest/v1/${table}`, "POST", rows.slice(i, i + 500), {
      Prefer: "resolution=ignore-duplicates,return=minimal",
    });
  }
}

// Upsert rows in batches; merges on the given conflict column.
async function sbUpsert(table, onConflict, rows) {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += 500) {
    await sbAdminFetch(
      `/rest/v1/${table}?on_conflict=${onConflict}`,
      "POST",
      rows.slice(i, i + 500),
      { Prefer: "resolution=merge-duplicates,return=minimal" },
    );
  }
}

// Creates a Supabase auth user. Returns the new UUID, or null if the email already exists.
async function sbCreateUser(email, name) {
  const res = await fetch(`${SB_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      email_confirm: true,
      user_metadata: { full_name: name ?? "" },
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    if (res.status === 422) return null; // already exists
    throw new Error(`SB create user ${email} → ${res.status}: ${json.message ?? JSON.stringify(json)}`);
  }
  return json.id;
}

// Looks up an existing Supabase user by email. Returns UUID or null.
async function sbFindUserByEmail(email) {
  const res = await fetch(
    `${SB_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } },
  );
  if (!res.ok) return null;
  const json = await res.json();
  const users = json.users ?? [];
  return users.find((u) => u.email === email)?.id ?? null;
}

// ─── Migration state ──────────────────────────────────────────────────────────
function loadMap() {
  if (existsSync(MAP_PATH)) {
    try {
      return JSON.parse(readFileSync(MAP_PATH, "utf8"));
    } catch {
      return {};
    }
  }
  return {};
}

function saveMap(map) {
  writeFileSync(MAP_PATH, JSON.stringify(map, null, 2), "utf8");
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const map = loadMap();
map.users ??= {};
map.projects ??= {};
map.tasks ??= {};
map.timeEntries ??= {};

const stats = { users: 0, profiles: 0, projects: 0, tasks: 0, timeEntries: 0, orphans: 0 };

// ─── Step 1: Auth users ───────────────────────────────────────────────────────
console.log("── Step 1: Migrating users ──");
const awUsers = await awListAll("/v1/users");
console.log(`  Found ${awUsers.length} Appwrite users`);

for (const u of awUsers) {
  if (map.users[u.$id]) {
    process.stdout.write(".");
    continue;
  }
  let sbId = await sbCreateUser(u.email, u.name);
  if (sbId === null) {
    sbId = await sbFindUserByEmail(u.email);
    if (!sbId) {
      console.warn(`\n  ✗ Cannot resolve user ${u.email} — skipping`);
      stats.orphans++;
      continue;
    }
  } else {
    stats.users++;
  }
  map.users[u.$id] = sbId;
}

saveMap(map);
console.log(`\n  Done: ${stats.users} new, ${awUsers.length - stats.users} already existed\n`);

// ─── Step 2: Projects ─────────────────────────────────────────────────────────
console.log("── Step 2: Migrating projects ──");
const awProjects = await awListAll(`/v1/databases/${AW_DB}/collections/projects/documents`);
console.log(`  Found ${awProjects.length} Appwrite projects`);

const sbProjects = [];
for (const p of awProjects) {
  if (!map.projects[p.$id]) map.projects[p.$id] = randomUUID();
  const userId = map.users[p.userId];
  if (!userId) {
    console.warn(`  ✗ Project ${p.$id} (${p.name}): userId ${p.userId} not migrated — skipping`);
    stats.orphans++;
    continue;
  }
  sbProjects.push({
    id: map.projects[p.$id],
    user_id: userId,
    name: p.name,
    description: p.description ?? null,
    status: p.status ?? "ACTIVE",
    deleted_at: p.deletedAt ?? null,
    created_at: p.$createdAt,
    updated_at: p.$updatedAt,
  });
  stats.projects++;
}

await sbInsert("projects", sbProjects);
saveMap(map);
console.log(`  Done: ${stats.projects} rows\n`);

// ─── Step 3: Tasks ────────────────────────────────────────────────────────────
console.log("── Step 3: Migrating tasks ──");
const awTasks = await awListAll(`/v1/databases/${AW_DB}/collections/tasks/documents`);
console.log(`  Found ${awTasks.length} Appwrite tasks`);

const sbTasks = [];
for (const t of awTasks) {
  if (!map.tasks[t.$id]) map.tasks[t.$id] = randomUUID();
  const userId = map.users[t.userId];
  if (!userId) {
    console.warn(`  ✗ Task ${t.$id} (${t.title}): userId ${t.userId} not migrated — skipping`);
    stats.orphans++;
    continue;
  }
  const projectId = t.projectId ? (map.projects[t.projectId] ?? null) : null;
  if (t.projectId && !projectId) {
    console.warn(`  ⚠ Task ${t.$id}: projectId ${t.projectId} not in map — project_id set to null`);
  }
  sbTasks.push({
    id: map.tasks[t.$id],
    user_id: userId,
    project_id: projectId,
    title: t.title,
    description: t.description ?? null,
    status: t.status ?? "TODO",
    priority: t.priority ?? "NORMAL",
    due_date: t.dueDate ?? null,
    completed_at: t.completedAt ?? null,
    deleted_at: t.deletedAt ?? null,
    created_at: t.$createdAt,
    updated_at: t.$updatedAt,
  });
  stats.tasks++;
}

await sbInsert("tasks", sbTasks);
saveMap(map);
console.log(`  Done: ${stats.tasks} rows\n`);

// ─── Step 4: Time entries ─────────────────────────────────────────────────────
console.log("── Step 4: Migrating time entries ──");
const awEntries = await awListAll(
  `/v1/databases/${AW_DB}/collections/time_entries/documents`,
);
console.log(`  Found ${awEntries.length} Appwrite time entries`);

const sbEntries = [];
for (const e of awEntries) {
  if (!map.timeEntries[e.$id]) map.timeEntries[e.$id] = randomUUID();
  const userId = map.users[e.userId];
  if (!userId) {
    console.warn(`  ✗ Entry ${e.$id}: userId ${e.userId} not migrated — skipping`);
    stats.orphans++;
    continue;
  }
  const taskId = e.taskId ? (map.tasks[e.taskId] ?? null) : null;
  const projectId = e.projectId ? (map.projects[e.projectId] ?? null) : null;
  if (e.taskId && !taskId) {
    console.warn(`  ⚠ Entry ${e.$id}: taskId ${e.taskId} not in map — task_id set to null`);
    stats.orphans++;
  }
  sbEntries.push({
    id: map.timeEntries[e.$id],
    user_id: userId,
    task_id: taskId,
    project_id: projectId,
    type: e.type ?? "WORK",
    started_at: e.startedAt,
    ended_at: e.endedAt ?? null,
    created_at: e.$createdAt,
    updated_at: e.$updatedAt,
  });
  stats.timeEntries++;
}

await sbInsert("time_entries", sbEntries);
saveMap(map);
console.log(`  Done: ${stats.timeEntries} rows\n`);

// ─── Step 5: Profiles (upsert — trigger auto-creates them on user insert) ─────
console.log("── Step 5: Migrating profiles ──");
const awProfiles = await awListAll(`/v1/databases/${AW_DB}/collections/profiles/documents`);
console.log(`  Found ${awProfiles.length} Appwrite profiles`);

const sbProfileRows = [];
for (const pr of awProfiles) {
  const userId = map.users[pr.userId];
  if (!userId) {
    console.warn(`  ✗ Profile ${pr.$id}: userId ${pr.userId} not migrated — skipping`);
    stats.orphans++;
    continue;
  }
  sbProfileRows.push({
    user_id: userId,
    name: pr.name ?? "",
    email: pr.email ?? "",
    avatar_url: pr.avatarUrl ?? null,
    timezone: pr.timezone ?? null,
    updated_at: pr.$updatedAt,
  });
  stats.profiles++;
}

// Upsert on user_id — profiles may already exist from the trigger on user creation.
await sbUpsert("profiles", "user_id", sbProfileRows);
saveMap(map);
console.log(`  Done: ${stats.profiles} rows\n`);

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log("═══════════════════════════════");
console.log("  Migration complete");
console.log("═══════════════════════════════");
console.log(`  Users created:  ${stats.users}`);
console.log(`  Profiles:       ${stats.profiles}`);
console.log(`  Projects:       ${stats.projects}`);
console.log(`  Tasks:          ${stats.tasks}`);
console.log(`  Time entries:   ${stats.timeEntries}`);
console.log(`  Warnings:       ${stats.orphans}`);
console.log(`  Map saved →     ${MAP_PATH}`);
