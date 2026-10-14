"use client";

import { useTimeEntries } from "@/contexts/app/app-context";
import type { TimeEntry } from "@packages/domain/index";
import { Button } from "@packages/ui/components/button";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";

type Props = {
  entry: TimeEntry | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
};

export function DeleteTimeEntryModal({
  entry,
  onOpenChange,
  onDeleted,
}: Props) {
  const { remove } = useTimeEntries();

  async function handleConfirm() {
    if (!entry) return;
    try {
      await remove.run(entry.id);
      onOpenChange(false);
      onDeleted();
    } catch {
      // Surfaced via remove.error from the hook.
    }
  }

  return (
    <ResponsiveSheet
      open={entry !== null}
      onOpenChange={onOpenChange}
      title="Delete this entry?"
      description="This removes the session from totals and history. This can't be undone."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={remove.isLoading}
          >
            {remove.isLoading ? "Deleting…" : "Delete"}
          </Button>
        </>
      }
    >
      {remove.error && (
        <p className="text-sm text-destructive">{remove.error}</p>
      )}
    </ResponsiveSheet>
  );
}
