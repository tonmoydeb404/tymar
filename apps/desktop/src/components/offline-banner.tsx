import { useOnline } from "@/lib/use-online";
import { WifiOff } from "lucide-react";

/** Slim notice shown while the device has no network. The app keeps
 * working — timers and edits are saved on this device and sync on their
 * own once the connection is back. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-800 dark:text-amber-300"
    >
      <WifiOff className="size-3.5 shrink-0" aria-hidden />
      <span>
        You&apos;re offline. Everything is saved on this device and syncs when
        you&apos;re back.
      </span>
    </div>
  );
}
