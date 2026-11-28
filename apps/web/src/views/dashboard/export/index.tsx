"use client";

import { PageHeader } from "@/components/page-header";
import { EXPORT_PRESETS } from "@/lib/export/presets";
import { Button } from "@packages/ui/components/button";
import { Download } from "lucide-react";
import { useState } from "react";
import { ExportDialog } from "./sections/export-dialog";
import { BasicsStep, ColumnsStep, FormatStep } from "./sections/steps";
import { useExport } from "./use-export";

export function ExportView() {
  const state = useExport();
  const [reviewOpen, setReviewOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Export"
        description="Download your time as a CSV. The defaults are ready to go — open a step only if you want to change it."
        actions={
          <Button size="lg" onClick={() => setReviewOpen(true)}>
            <Download />
            Review &amp; download
          </Button>
        }
      />

      <div className="mx-auto grid w-full max-w-3xl gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Start from</span>
          {EXPORT_PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant="outline"
              title={p.hint}
              onClick={() => state.setConfig((c) => p.apply(c))}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <BasicsStep state={state} />
        <ColumnsStep state={state} />
        <FormatStep state={state} />
      </div>

      <ExportDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        state={state}
      />
    </>
  );
}
