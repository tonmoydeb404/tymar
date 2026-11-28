import { useApp } from "@/context/app-context";
import { useSync } from "@/context/sync-context";
import { useTimer } from "@/context/timer-context";
import { api, onQuitRequested } from "@/lib/api";
import { Button } from "@packages/ui/components/button";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";
import { CloudCheck, CloudOff, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type Phase =
  | { name: "closed" }
  | { name: "confirm" }
  | { name: "saving" }
  | { name: "failed"; detail: string };

/** Quit handshake. Tray Quit / Cmd+Q ask Rust to exit; Rust hands control
 * here instead. A running timer is stopped — at the moment Quit was
 * requested, not whenever this dialog gets answered — then everything local
 * is flushed to the cloud behind a visible "Saving…" state. If the cloud
 * can't be reached the user is told their work is safe on this device and
 * will sync next launch. */
export function QuitDialog() {
  const { auth } = useApp();
  const { flush, pendingCount, syncing } = useSync();
  const { view, stop } = useTimer();
  const [phase, setPhase] = useState<Phase>({ name: "closed" });

  // Read the freshest values inside the one-time event listener.
  const live = useRef({ signedIn: false, running: false, pendingCount, syncing });
  useEffect(() => {
    live.current = {
      signedIn: Boolean(auth?.user?.id),
      running: view.status !== "IDLE",
      pendingCount,
      syncing,
    };
  }, [auth?.user?.id, view.status, pendingCount, syncing]);

  /** When Quit was requested — the timer ends here even if the dialog sits
   * open for hours. */
  const requestedAt = useRef(Date.now());

  const quitNow = useCallback(() => void api.quitApp(), []);

  const save = useCallback(async () => {
    setPhase({ name: "saving" });
    if (live.current.running) await stop(requestedAt.current);
    const result = await flush();
    if (result.ok) {
      quitNow();
      return;
    }
    setPhase({
      name: "failed",
      detail: result.offline
        ? "You appear to be offline."
        : (result.error ?? "The server couldn't be reached."),
    });
  }, [flush, quitNow, stop]);

  useEffect(() => {
    const unlisten = onQuitRequested(() => {
      const { signedIn, running, pendingCount, syncing } = live.current;
      requestedAt.current = Date.now();
      if (!signedIn || (!running && pendingCount === 0 && !syncing)) {
        quitNow(); // nothing to protect
        return;
      }
      if (running) setPhase({ name: "confirm" });
      else void save();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [quitNow, save]);

  const saving = phase.name === "saving";
  const close = () => setPhase({ name: "closed" });

  const copy =
    phase.name === "failed"
      ? {
          title: "Couldn't save to the cloud",
          description: `${phase.detail} Your changes are stored safely on this device and will sync the next time the app opens.`,
        }
      : phase.name === "saving"
        ? {
            title: "Saving your changes…",
            description:
              "Sending everything to the cloud. The app closes when it's done.",
          }
        : {
            title: "A timer is running",
            description:
              "It will be stopped now, saved to the cloud, and then the app closes.",
          };

  return (
    <ResponsiveSheet
      open={phase.name !== "closed"}
      onOpenChange={(next) => {
        if (!next && !saving) close();
      }}
      variant="dialog"
      title={copy.title}
      description={copy.description}
      footer={
        phase.name === "confirm" ? (
          <>
            <Button variant="outline" size="lg" onClick={close}>
              Cancel
            </Button>
            <Button size="lg" onClick={() => void save()}>
              Stop timer &amp; quit
            </Button>
          </>
        ) : phase.name === "failed" ? (
          <>
            <Button variant="ghost" size="lg" onClick={close}>
              Cancel
            </Button>
            <Button variant="outline" size="lg" onClick={quitNow}>
              Quit anyway
            </Button>
            <Button size="lg" onClick={() => void save()}>
              <CloudCheck />
              Try again
            </Button>
          </>
        ) : undefined
      }
    >
      {saving && (
        <div className="flex justify-center py-4">
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
        </div>
      )}
      {phase.name === "failed" && (
        <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <CloudOff className="size-5" aria-hidden />
        </div>
      )}
    </ResponsiveSheet>
  );
}
