import { ScreenHeader } from "@/components/screen-header";
import { UpdateChangelogDialog } from "@/components/update-changelog-dialog";
import { useApp } from "@/context/app-context";
import { useSync } from "@/context/sync-context";
import { api } from "@/lib/api";
import { brand } from "@/lib/brand";
import { displayName } from "@/lib/display-name";
import type { UpdateInfo } from "@/types";
import { Button } from "@packages/ui/components/button";
import { Switch } from "@packages/ui/components/switch";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Cloud,
  ExternalLink,
  Loader2,
  LogIn,
  LogOut,
  LucideInfo,
  LucideMoon,
  LucideMoonStar,
  LucideRocket,
  LucideUserCircle2,
  RefreshCw,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <h2 className="px-1 font-mono text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  icon,
  title,
  description,
  control,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  control?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            {icon}
          </span>
        )}
        <span className="grid min-w-0 gap-0">
          <strong className="truncate text-sm font-medium text-ink">
            {title}
          </strong>
          {description && (
            <small className="truncate text-[13px] text-muted-foreground">
              {description}
            </small>
          )}
        </span>
      </div>
      {control}
    </div>
  );
}

// Settings tab: appearance, system, account, about. Mirrors the desktop
// settings dialog content inline for the popup layout.
export function SettingsScreen() {
  const {
    auth,
    signIn,
    signOut,
    signingIn,
    installUpdate,
    isInstallingUpdate,
    settings,
    updateSetting,
  } = useApp();
  const sync = useSync();
  const { theme, setTheme } = useTheme();
  const [autostart, setAutostart] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<UpdateInfo | null>(null);
  const [changelogOpen, setChangelogOpen] = useState(false);

  useEffect(() => {
    api
      .isAutostartEnabled()
      .then(setAutostart)
      .catch(() => {});
  }, []);

  // Manual updater check (the boot check is automatic); an update opens
  // the responsive changelog dialog, otherwise we toast "up to date".
  async function handleCheckForUpdate() {
    setCheckingUpdate(true);
    try {
      const info = await api.checkForUpdate();
      if (info) {
        setPendingUpdate(info);
        setChangelogOpen(true);
      } else {
        toast.success(`${displayName} is up to date.`);
      }
    } catch (err) {
      toast.error("Couldn't check for updates.", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setCheckingUpdate(false);
    }
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
    } catch {
      toast.error("Failed to change autostart setting.");
      setAutostart(!checked);
    }
  }

  return (
    <section className="mx-auto grid h-full w-full max-w-[420px] content-start gap-7 overflow-y-auto scrollbar-thin px-5 pt-5 pb-28">
      <ScreenHeader title="Settings" subtitle={`${displayName} v${brand.version}`} />

      <Section title="Account">
        {auth?.status === "active" && auth.user ? (
          <Row
            title={auth.user.name || auth.user.email}
            description={auth.user.email}
            control={
              <Button
                variant="destructive"
                onClick={() => void signOut()}
                size={"icon-lg"}
              >
                <LogOut size={14} />
              </Button>
            }
            icon={
              auth.user.avatarUrl ? (
                <img
                  src={auth.user.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="size-full rounded-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <LucideUserCircle2 size={20} />
              )
            }
          />
        ) : (
          <Row
            title="Not signed in"
            description={
              auth?.status === "unknown"
                ? "Couldn't reach the server."
                : "You're signed out."
            }
            control={
              <Button
                size="icon-lg"
                onClick={() =>
                  void signIn().then((r) => {
                    if (!r.ok && r.message) toast.error(r.message);
                  })
                }
                disabled={signingIn}
              >
                {signingIn ? <Loader2 size={14} /> : <LogIn size={14} />}
              </Button>
            }
            icon={<LucideUserCircle2 size={20} />}
          />
        )}
      </Section>

      <Section title="System">
        <Row
          icon={<LucideMoon size={20} />}
          title="Dark theme"
          description="Toggle between dark and light."
          control={
            <Switch
              checked={theme === "dark"}
              onCheckedChange={(c) => setTheme(c ? "dark" : "light")}
              aria-label="Dark theme"
            />
          }
        />
        <Row
          icon={<LucideRocket size={20} />}
          title="Start at login"
          description="Launch automatically on boot."
          control={
            <Switch
              checked={autostart}
              onCheckedChange={handleAutostartToggle}
              aria-label="Start at login"
            />
          }
        />
      </Section>

      <Section title="Timer">
        <Row
          icon={<LucideMoonStar size={20} />}
          title="Stop on sleep"
          description="Pause the timer when the system sleeps."
          control={
            <Switch
              checked={settings.sleep_stop_enabled !== "false"}
              onCheckedChange={(c) =>
                void updateSetting("sleep_stop_enabled", c ? "true" : "false")
              }
              aria-label="Stop on sleep"
            />
          }
        />
      </Section>

      <Section title="Sync">
        <Row
          icon={<Cloud size={20} />}
          title={
            sync.syncing
              ? "Syncing…"
              : sync.pendingCount > 0
                ? `${sync.pendingCount} change${sync.pendingCount === 1 ? "" : "s"} waiting`
                : sync.status === "offline"
                  ? "Offline"
                  : "Everything is saved"
          }
          description={
            sync.lastError ??
            (sync.connection === "connected"
              ? "Live — changes sync as they happen."
              : "Changes are saved on this device first.")
          }
          control={
            <Button
              variant="outline"
              size="icon-lg"
              onClick={sync.retry}
              disabled={sync.syncing}
              aria-label="Sync now"
            >
              <RefreshCw
                size={14}
                className={sync.syncing ? "animate-spin" : undefined}
              />
            </Button>
          }
        />
      </Section>

      <Section title="About">
        <Row
          icon={<LucideInfo size={20} />}
          title={
            <>
              {displayName}{" "}
              <span className="text-primary">v{brand.version}</span>
            </>
          }
          description={brand.description.short}
          control={<></>}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckForUpdate}
            disabled={checkingUpdate || isInstallingUpdate}
          >
            <RefreshCw
              size={12}
              className={checkingUpdate ? "animate-spin" : undefined}
            />
            {checkingUpdate ? "Checking…" : "Check for updates"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openUrl(brand.repository).catch(() => {})}
          >
            <ExternalLink size={12} />
            View source
          </Button>
        </div>
      </Section>

      {pendingUpdate && (
        <UpdateChangelogDialog
          open={changelogOpen}
          onOpenChange={setChangelogOpen}
          updateInfo={pendingUpdate}
          installing={isInstallingUpdate}
          onInstall={() => void installUpdate()}
        />
      )}
    </section>
  );
}
