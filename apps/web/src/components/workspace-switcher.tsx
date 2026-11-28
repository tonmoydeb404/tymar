"use client";

import { appPaths } from "@/config/paths-config";
import { APP_NAME } from "@/content/homepage";
import { useCurrentWorkspace, useWorkspaces } from "@/contexts/app/app-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { SidebarMenuButton } from "@packages/ui/components/sidebar";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
  AlertTriangle,
  Check,
  ChevronsUpDown,
  FolderKanban,
  Settings,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

/** Sidebar control for the workspace the whole dashboard is scoped to. */
export function WorkspaceSwitcher() {
  const { loading, error, reload } = useWorkspaces();
  const { available, current, setCurrentId, hydrated } = useCurrentWorkspace();

  if (!hydrated || (loading && !current)) {
    return <Skeleton className="h-12 rounded-xl" />;
  }

  if (error && !current) {
    return (
      <SidebarMenuButton
        size="lg"
        tooltip="Couldn't load workspaces — click to retry"
        onClick={() => void reload().catch(() => {})}
        className="text-destructive"
      >
        <AlertTriangle />
        <span className="truncate">Workspaces unavailable · Retry</span>
      </SidebarMenuButton>
    );
  }

  if (!current) {
    return (
      <SidebarMenuButton
        size="lg"
        tooltip="No workspace"
        render={<Link href={appPaths.settings} />}
      >
        <FolderKanban />
        <span className="truncate">Create a workspace</span>
      </SidebarMenuButton>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            size="lg"
            tooltip={`Workspace: ${current.name}`}
            aria-label={`Workspace: ${current.name}`}
            className="data-open:bg-sidebar-accent"
          />
        }
      >
        <Image
          src="/logo.svg"
          alt=""
          width={32}
          height={32}
          className="size-8 shrink-0"
        />
        <span className="grid min-w-0 flex-1 text-left leading-tight">
          <span className="truncate text-sm font-semibold">{current.name}</span>
          <span className="text-xs text-muted-foreground">{APP_NAME}</span>
        </span>
        <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {available.map((w) => (
            <DropdownMenuItem key={w.id} onClick={() => setCurrentId(w.id)}>
              <span className="truncate">{w.name}</span>
              {w.id === current.id && <Check className="ml-auto size-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={appPaths.settingsWorkspaces} />}>
          <Settings size={14} />
          Manage workspaces
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
