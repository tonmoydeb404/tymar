"use client";

import { PageHeader } from "@/components/page-header";
import { Button } from "@packages/ui/components/button";
import { Download } from "lucide-react";
import { PreviewSection } from "./sections/preview-section";
import { SettingsPanel } from "./sections/settings-panel";
import { useExport } from "./use-export";

export function ExportView() {
  const state = useExport();
  const { built, loading, error, download } = state;
  const canDownload =
    !loading && !error && built.rowCount > 0 && built.headers.length > 0;

  return (
    <>
      <PageHeader
        title="Export"
        description="Download your time as a CSV. The defaults are ready to go — adjust only what you need."
        actions={
          <Button size="lg" onClick={download} disabled={!canDownload}>
            <Download />
            Download CSV
          </Button>
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <SettingsPanel state={state} />
        <PreviewSection state={state} />
      </div>
    </>
  );
}
