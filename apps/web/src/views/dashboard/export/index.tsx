"use client";

import { PageHeader } from "@/components/page-header";
import { todayIn } from "@/lib/range";
import { DateRangePicker } from "@packages/ui/components/date-range-picker";
import { CustomizeSection } from "./sections/customize-section";
import { PreviewSection } from "./sections/preview-section";
import { ScopeSection } from "./sections/scope-section";
import { useExport } from "./use-export";

export function ExportView() {
  const state = useExport();

  return (
    <>
      <PageHeader
        title="Export"
        description="Download your time as CSV. The default export needs no setup — customize only if you want to."
        actions={
          <DateRangePicker
            value={state.range}
            onChange={state.setRange}
            now={todayIn(state.timeZone)}
          />
        }
      />
      <ScopeSection state={state} />
      <PreviewSection state={state} />
      <CustomizeSection state={state} />
    </>
  );
}
