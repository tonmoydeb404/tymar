import { BottomTabs } from "@/components/bottom-tabs";
import { CommandPalette } from "@/components/command-palette";
import { OfflineBanner } from "@/components/offline-banner";
import { ErrorAlertDialog } from "@/components/error-alert-dialog";
import { StartupModals } from "@/components/startup-modals";
import { Outlet } from "react-router-dom";

// Popup shell for the 420px window: scrollable tab content with a floating
// bottom navbar overlaid on top. Overlays stay mounted for command-palette
// and settings flows.
export function TabLayout() {
  return (
    <div className="relative flex h-svh w-full flex-col overflow-hidden bg-background">
      <OfflineBanner />
      <div className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
      <BottomTabs />

      <ErrorAlertDialog />
      <CommandPalette />
      <StartupModals />
    </div>
  );
}
