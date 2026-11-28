"use client";

import { PageHeader } from "@/components/page-header";
import { TimezoneSelect } from "@/components/timezone-select";
import { Button } from "@packages/ui/components/button";
import { Card, CardContent } from "@packages/ui/components/card";
import { DataState } from "@packages/ui/components/data-state";
import { Skeleton } from "@packages/ui/components/skeleton";
import { FieldControl, SwitchField, TextField } from "@packages/ui/fields/core";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Check, Copy, Radio, RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { useSettings } from "./use-settings";

function allTimeZones(): string[] {
  try {
    const values = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    if (values && values.length > 0) return values;
  } catch {
    // Fall through to the curated list.
  }
  return [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Toronto",
    "America/Sao_Paulo",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Kyiv",
    "Africa/Cairo",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Asia/Seoul",
    "Australia/Sydney",
    "Pacific/Auckland",
  ];
}

const list: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

function SettingsSkeleton({ section }: { section: SettingsSection }) {
  return (
    <Card>
      <CardContent className="grid gap-4">
        {section === "account" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-[3.75rem]" />
              <Skeleton className="h-[3.75rem]" />
            </div>
            <Skeleton className="h-[3.75rem]" />
            <Skeleton className="ml-auto h-9 w-32" />
          </>
        ) : (
          <>
            <Skeleton className="h-10" />
            <Skeleton className="h-11" />
            <Skeleton className="h-4 w-64" />
          </>
        )}
      </CardContent>
    </Card>
  );
}

export type SettingsSection = "account" | "public-status";

const SECTION_HEADERS: Record<
  SettingsSection,
  { title: string; description: string }
> = {
  account: {
    title: "Account",
    description: "Your profile and reporting timezone.",
  },
  "public-status": {
    title: "Public status",
    description: "Share a private link showing only whether you're working.",
  },
};

export function SettingsClient({ section }: { section: SettingsSection }) {
  const s = useSettings();
  const zones = useMemo(allTimeZones, []);

  if (!s.email && !s.profile) return null;

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-10 h-64 overflow-hidden"
      >
        <div className="absolute left-[12%] top-0 size-56 rounded-full bg-primary/10 blur-[90px]" />
        <div className="absolute right-[8%] top-8 size-40 rounded-full bg-primary/5 blur-[80px]" />
      </div>

      <motion.div
        variants={list}
        initial="hidden"
        animate="show"
        className="relative grid gap-6 pb-10"
      >
        <motion.div variants={item}>
          <PageHeader
            {...SECTION_HEADERS[section]}
            actions={
              section === "public-status" && s.statusSettings?.isPublic ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                  </span>
                  Live
                </span>
              ) : undefined
            }
          />
        </motion.div>

        <DataState
          loading={s.loading}
          error={s.loadError}
          data={s.profile ? [s.profile] : []}
          emptyTitle="No profile yet"
          onRetry={() => void s.reload().catch(() => {})}
          loadingComponent={<SettingsSkeleton section={section} />}
        >
          {() => (
            <>
              {section === "account" && (
                <motion.section
                  variants={item}
                  className="flex min-w-0 flex-col"
                >
                  <Card>
                    <CardContent className="grid gap-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <TextField
                          id="settings-name"
                          label="Display name"
                          value={s.name}
                          onChange={(e) => s.setName(e.target.value)}
                          placeholder="Your name"
                        />
                        <TextField
                          id="settings-email"
                          label="Email"
                          value={s.email ?? ""}
                          disabled
                          readOnly
                        />
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <FieldControl
                          label="Reporting timezone"
                          htmlFor="settings-tz"
                          className="flex-1"
                        >
                          <TimezoneSelect
                            id="settings-tz"
                            value={s.timezone}
                            onValueChange={s.setTimezone}
                            zones={zones}
                          />
                        </FieldControl>
                        <Button
                          variant="outline"
                          size="sm"
                          className="sm:mb-0.5"
                          onClick={s.applyDeviceZone}
                        >
                          Use device timezone
                        </Button>
                      </div>
                      <div className="flex items-center justify-end gap-3 border-t border-border pt-3">
                        <AnimatePresence>
                          {s.savedNote && (
                            <motion.p
                              key="saved-note"
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              className="text-sm text-emerald-700 dark:text-emerald-400"
                            >
                              {s.savedNote}
                            </motion.p>
                          )}
                        </AnimatePresence>
                        {s.saveError && (
                          <p className="text-sm text-destructive">
                            {s.saveError}
                          </p>
                        )}
                        <Button
                          onClick={() => void s.save().catch(() => {})}
                          disabled={s.saving || !s.dirty}
                        >
                          {s.saving ? "Saving…" : "Save changes"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.section>
              )}

              {section === "public-status" && (
                <motion.section
                  variants={item}
                  className="flex min-w-0 flex-col"
                >
                  <Card>
                    <CardContent className="grid gap-4">
                      {!s.statusSettings ? (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="max-w-sm text-sm text-muted-foreground">
                            Share a private link that shows only whether
                            you&apos;re working, on a break, or offline.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void s.regenerate().catch(() => {})}
                            disabled={s.statusBusy}
                          >
                            {s.statusBusy ? "Generating…" : "Generate link"}
                          </Button>
                        </div>
                      ) : (
                        <>
                          <SwitchField
                            id="public-status-enabled"
                            label="Show my status publicly"
                            description="Never shares tasks, projects, or history."
                            size="sm"
                            checked={s.statusSettings.isPublic}
                            onCheckedChange={(checked) =>
                              void s.togglePublic(checked).catch(() => {})
                            }
                            disabled={s.statusBusy}
                          />
                          <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-muted/50 px-2.5 py-2">
                            <Radio className="size-3.5 shrink-0 text-muted-foreground" />
                            <code className="min-w-0 flex-1 break-all text-xs">
                              {s.statusUrl}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => void s.copyLink()}
                              aria-label="Copy link"
                            >
                              {s.copied ? (
                                <Check className="size-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="size-3.5" />
                              )}
                            </Button>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground">
                              Updates every few minutes. A new link disables the
                              old one immediately.
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    "Generate a new link? The current link stops working immediately.",
                                  )
                                ) {
                                  return;
                                }
                                void s.regenerate().catch(() => {});
                              }}
                              disabled={s.statusBusy}
                            >
                              <RefreshCw className="size-3.5" />
                              New link
                            </Button>
                          </div>
                        </>
                      )}
                      {s.statusError && (
                        <p className="text-sm text-destructive">
                          {s.statusError}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </motion.section>
              )}
            </>
          )}
        </DataState>
      </motion.div>
    </div>
  );
}
