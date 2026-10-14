"use client";

import { appPaths } from "@/config/paths-config";
import { APP_NAME } from "@/content/homepage";
import { cn } from "@/lib/utils";
import { TimerFab } from "@/views/dashboard/timer/timer-fab";
import { TimerProvider } from "@/views/dashboard/timer/timer-context";
import { Separator } from "@packages/ui/components/separator";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserMenu } from "./user-menu";

const navItems = [
  { label: "Overview", href: appPaths.dashboard },
  { label: "Projects", href: appPaths.projects },
  { label: "Tasks", href: appPaths.tasks },
  { label: "Time", href: appPaths.time },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <TimerProvider>
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-border bg-background">
          <div className="container flex h-14 items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <Link href={appPaths.dashboard} className="flex items-center gap-2">
                <Image
                  src="/logo.svg"
                  alt={`${APP_NAME} logo`}
                  width={26}
                  height={26}
                />
                <span className="font-medium">{APP_NAME}</span>
              </Link>
              <nav
                className="hidden items-center gap-1 md:flex"
                aria-label="Product"
              >
                {navItems.map((item) => {
                  const active =
                    item.href === appPaths.dashboard
                      ? pathname === appPaths.dashboard
                      : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <UserMenu />
          </div>
          <div className="container flex gap-1 overflow-x-auto pb-2 md:hidden">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm whitespace-nowrap",
                  pathname.startsWith(item.href)
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </header>
        <Separator className="hidden" />
        <motion.main
          key={pathname}
          className="container flex flex-1 flex-col py-8"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeInOut" }}
        >
          {children}
        </motion.main>

        <TimerFab />
      </div>
    </TimerProvider>
  );
}
