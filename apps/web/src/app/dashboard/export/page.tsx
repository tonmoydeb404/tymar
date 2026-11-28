import { ExportView } from "@/views/dashboard/export";
import { Suspense } from "react";

export const metadata = {
  title: "Export",
};

export default function ExportPage() {
  return (
    <Suspense>
      <ExportView />
    </Suspense>
  );
}
