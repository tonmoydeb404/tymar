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
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@packages/ui/components/sidebar";
import {
  Clock3,
  Download,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Settings,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserMenu } from "./user-menu";

const navItems = [
  { label: "Overview", href: appPaths.dashboard, icon: LayoutDashboard },
  { label: "Time", href: appPaths.time, icon: Clock3 },
  { label: "Projects", href: appPaths.projects, icon: FolderKanban },
  { label: "Tasks", href: appPaths.tasks, icon: ListChecks },
  { label: "Export", href: appPaths.export, icon: Download },
] as const;

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
          <SidebarHeader className="px-3 pt-4">
            <Link
              href={appPaths.dashboard}
              className="flex items-center gap-2.5 px-1"
            >
              <Image
                src="/logo.svg"
                alt={`${APP_NAME} logo`}
                width={28}
                height={28}
                className="shrink-0"
              />
              <span className="truncate text-base font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
                {APP_NAME}
              </span>
            </Link>
          </SidebarHeader>

          <SidebarContent className="px-2 pt-2">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        size="lg"
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
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
                  isActive={isActive(pathname, appPaths.settings)}
                  tooltip="Settings"
                  render={<Link href={appPaths.settings} />}
                >
                  <Settings />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
