// Records the last failed timer action so the UI can surface it when the
// window becomes visible again — toasts fire while the window is hidden
// (e.g. a tray Stop click) are never seen.

let lastFailure: string | null = null;

export function setActionFailure(message: string): void {
  lastFailure = message;
}

/** Returns and clears the stored failure (null when there is none). */
export function consumeActionFailure(): string | null {
  const message = lastFailure;
  lastFailure = null;
  return message;
}
