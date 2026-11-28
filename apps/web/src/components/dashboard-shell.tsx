"use client";

import { appPaths } from "@/config/paths-config";
import { APP_NAME } from "@/content/homepage";
import { TimerProvider } from "@/views/dashboard/timer/timer-context";
import { TimerFab } from "@/views/dashboard/timer/timer-fab";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@packages/ui/components/sidebar";
import {
  ChevronRight,
  Clock3,
  Download,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Radio,
  Settings,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
import { UserMenu } from "./user-menu";
import { WorkspaceSwitcher } from "./workspace-switcher";

const navItems = [
  { label: "Overview", href: appPaths.dashboard, icon: LayoutDashboard },
  { label: "Time", href: appPaths.time, icon: Clock3 },
  { label: "Projects", href: appPaths.projects, icon: FolderKanban },
  { label: "Tasks", href: appPaths.tasks, icon: ListChecks },
  { label: "Export", href: appPaths.export, icon: Download },
] as const;

const settingsItems = [
  { label: "Account", href: appPaths.settingsAccount, icon: User },
  { label: "Workspaces", href: appPaths.settingsWorkspaces, icon: FolderKanban },
  { label: "Public status", href: appPaths.settingsPublicStatus, icon: Radio },
] as const;

/** Settings entry with its pages as a submenu. When the sidebar is collapsed
 * to icons there is no room for the submenu, so the button goes straight to
 * the first page instead. */
function SettingsNav({ pathname }: { pathname: string }) {
  const { state } = useSidebar();
  const inSettings = isActive(pathname, appPaths.settings);
  const [open, setOpen] = useState(inSettings);

  // Entering settings from anywhere else (e.g. the user menu) opens it.
  useEffect(() => {
    if (inSettings) setOpen(true);
  }, [inSettings]);

  if (state === "collapsed") {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          className="h-11"
          isActive={inSettings}
          tooltip="Settings"
          render={<Link href={appPaths.settingsAccount} />}
        >
          <Settings />
          <span>Settings</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} render={<SidebarMenuItem />}>
      <CollapsibleTrigger
        render={
          <SidebarMenuButton className="h-11" isActive={inSettings && !open} />
        }
      >
        <Settings />
        <span>Settings</span>
        <ChevronRight
          className={`ml-auto transition-transform ${open ? "rotate-90" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub>
          {settingsItems.map((item) => (
            <SidebarMenuSubItem key={item.href}>
              <SidebarMenuSubButton
                className="h-8"
                isActive={pathname.startsWith(item.href)}
                render={<Link href={item.href} />}
              >
                <item.icon />
                <span>{item.label}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}

function isActive(pathname: string, href: string) {
  return href === appPaths.dashboard
    ? pathname === appPaths.dashboard
    : pathname.startsWith(href);
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <TimerProvider>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader className="px-2 pt-3">
            <SidebarMenu>
              <SidebarMenuItem>
                <WorkspaceSwitcher />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          <SidebarContent className="px-2 pt-2">
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        className="h-11"
                        isActive={isActive(pathname, item.href)}
                        tooltip={item.label}
                        render={<Link href={item.href} />}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="gap-1 px-2 pb-3">
            <SidebarMenu>
              <SettingsNav pathname={pathname} />
            </SidebarMenu>
            <UserMenu />
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="min-h-svh min-w-0">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-4 backdrop-blur md:hidden">
            <SidebarTrigger />
            <span className="font-semibold tracking-tight">{APP_NAME}</span>
          </header>
          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 md:px-8 md:py-10">
            {children}
          </div>
          <TimerFab />
        </SidebarInset>
      </SidebarProvider>
    </TimerProvider>
  );
}
