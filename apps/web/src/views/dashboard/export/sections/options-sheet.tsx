"use client";

import { Button } from "@packages/ui/components/button";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";
import { RotateCcw } from "lucide-react";
import type { ExportState } from "../use-export";
import { FileBlock, FormatsBlock } from "./export-blocks";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: ExportState;
};

/** Everything that rarely needs changing: date/clock formats, separator,
 * encoding, header row, and the reset. */
export function OptionsSheet({ open, onOpenChange, state }: Props) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="More options"
      description="Formats and file settings."
      footer={
        <>
          <Button variant="outline" size="lg" onClick={state.resetConfig}>
            <RotateCcw />
            Reset to defaults
          </Button>
          <Button size="lg" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </>
      }
    >
      <div className="grid gap-8 pb-4">
        <FormatsBlock state={state} />
        <FileBlock state={state} />
      </div>
    </ResponsiveSheet>
  );
}
