import { useApp } from "@/context/app-context";
import { useModal } from "@/context/modal-context";
import { api } from "@/lib/api";
import { brand } from "@/lib/brand";
import { displayName } from "@/lib/display-name";
import { Button } from "@packages/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@packages/ui/components/dialog";
import { Switch } from "@packages/ui/components/switch";
import { ExternalLink, Moon, MoonStar } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-2">
      <h3 className="text-[0.68rem] font-[760] text-faint">{title}</h3>
      {children}
    </section>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  icon,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-2.5">
        {icon && (
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-control text-muted-foreground">
            {icon}
          </span>
        )}
        <span className="grid min-w-0 gap-0.5">
          <strong className="text-[0.82rem] text-ink">{title}</strong>
          <small className="truncate text-[0.7rem] text-muted-foreground">
            {description}
          </small>
        </span>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
    </div>
  );
}

export function SettingsDialog() {
  const { settings: settingsModal } = useModal();
  const { theme, setTheme } = useTheme();
  const { settings, updateSetting } = useApp();

  const [autostart, setAutostart] = useState(false);

  useEffect(() => {
    api
      .isAutostartEnabled()
      .then(setAutostart)
      .catch(() => {});
  }, []);

  function handleThemeToggle(checked: boolean) {
    setTheme(checked ? "dark" : "light");
  }

  async function handleAutostartToggle(checked: boolean) {
    setAutostart(checked);
    try {
      if (checked) {
        await api.enableAutostart();
        toast.success(`${displayName} will launch on system boot.`);
      } else {
        await api.disableAutostart();
        toast.success("Autostart disabled.");
      }
    } catch (err) {
      console.error("Autostart toggle failed:", err);
      toast.error("Failed to change autostart setting.");
      setAutostart(!checked);
    }
  }

  function handleClose(open: boolean) {
    if (!open) settingsModal.close();
  }

  return (
    <Dialog open={settingsModal.isOpen} onOpenChange={handleClose}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure {displayName} to fit your workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-6 overflow-auto scrollbar-thin p-4">
          <SettingsSection title="APPEARANCE">
            <ToggleRow
              title="Dark theme"
              description="Toggle between dark and light appearance."
              checked={theme === "dark"}
              onChange={handleThemeToggle}
              icon={<Moon size={15} />}
            />
          </SettingsSection>

          <SettingsSection title="SYSTEM">
            <ToggleRow
              title="Start at login"
              description={`Launch ${displayName} automatically on system boot.`}
              checked={autostart}
              onChange={handleAutostartToggle}
            />
          </SettingsSection>

          <SettingsSection title="TIMER">
            <ToggleRow
              title="Stop on sleep"
              description="Pause the timer when the system sleeps."
              checked={settings.sleep_stop_enabled !== "false"}
              onChange={(c) => void updateSetting("sleep_stop_enabled", c ? "true" : "false")}
              icon={<MoonStar size={15} />}
            />
          </SettingsSection>

          <SettingsSection title="ABOUT">
            <div className="grid gap-1 rounded-lg border border-border bg-surface p-3 text-[0.78rem] text-muted-foreground">
              <span className="text-ink">
                {displayName} <span className="text-faint">v{brand.version}</span>
              </span>
              <span>{brand.description.short}</span>
              <span className="mt-1">
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-auto p-0 text-[0.74rem] text-primary underline-offset-2 hover:underline"
                  onClick={() =>
                    openUrl(brand.repository).catch(() => {})
                  }
                >
                  <ExternalLink size={12} />
                  View source on GitHub
                </Button>
              </span>
            </div>
          </SettingsSection>
        </div>

        <div className="flex justify-end border-t border-border p-4">
          <DialogClose render={<Button variant="secondary">Done</Button>} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
