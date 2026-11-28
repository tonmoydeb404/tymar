"use client";

import { Button } from "@packages/ui/components/button";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";
import type { ExportState } from "../use-export";
import { ColumnsBlock } from "./export-blocks";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: ExportState;
};

/** Rename, reorder and add custom columns — the advanced half of column
 * setup. Plain on/off lives on the page itself. */
export function ColumnsSheet({ open, onOpenChange, state }: Props) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Edit columns"
      description="Changes apply to the preview straight away."
      footer={
        <Button size="lg" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      }
    >
      <div className="pb-4">
        <ColumnsBlock state={state} />
      </div>
    </ResponsiveSheet>
  );
}
