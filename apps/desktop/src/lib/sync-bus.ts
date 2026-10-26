// Tiny pub/sub so non-React modules (lib/db.ts) can signal "local data
// changed" and the sync provider can schedule a prompt (debounced) sync
// without threading context through every helper.

type Listener = () => void;

const listeners = new Set<Listener>();

/** Call after any local mutation that needs to reach Supabase soon. */
export function notifyLocalMutation(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // A broken listener must never break the mutation that notified it.
    }
  }
}

export function onLocalMutation(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---- Pull notifications: after a sync cycle wrote remote rows into local
// SQLite, on-screen caches (projects/tasks/time-entries hooks) reload so
// pulled data becomes visible without a remount. ----

const pullListeners = new Set<Listener>();

export function notifyDataPulled(): void {
  for (const listener of pullListeners) {
    try {
      listener();
    } catch {
      // Same isolation as above.
    }
  }
}

export function onDataPulled(listener: Listener): () => void {
  pullListeners.add(listener);
  return () => pullListeners.delete(listener);
}
