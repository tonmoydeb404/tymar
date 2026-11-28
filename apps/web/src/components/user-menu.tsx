"use client";

import { appPaths } from "@/config/paths-config";
import { useAuth } from "@/lib/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@packages/ui/components/avatar";
import { SidebarMenuButton } from "@packages/ui/components/sidebar";
import { ChevronsUpDown, LogOut, Moon, Settings, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useState } from "react";

function getInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0]?.charAt(0) ?? "";
    const last = parts[parts.length - 1]?.charAt(0) ?? "";
    return `${first}${last}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function UserMenu() {
  const { user, loading, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (loading) {
    return <span aria-hidden className="h-12 animate-pulse rounded-xl bg-muted" />;
  }

  if (!user) return null;

  const isDark = mounted ? theme === "dark" : false;
  const ThemeIcon = isDark ? Sun : Moon;
  const avatarUrl = user.user_metadata?.avatar_url ?? user.user_metadata?.picture;
  const name = user.user_metadata?.full_name || "Unnamed user";
  const initials = getInitials(user.user_metadata?.full_name, user.email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton
            size="lg"
            aria-label={`Account menu for ${name}`}
            className="data-open:bg-sidebar-accent"
          />
        }
      >
        <Avatar className="size-8">
          {avatarUrl && (
            <AvatarImage
              src={avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
            />
          )}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <span className="grid min-w-0 flex-1 text-left leading-tight">
          <span className="truncate text-sm font-medium">{name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {user.email}
          </span>
        </span>
        <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-56"
      >
        <DropdownMenuItem render={<Link href={appPaths.settings} />}>
          <Settings />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme(isDark ? "light" : "dark")}
          closeOnClick={false}
        >
          <ThemeIcon />
          {isDark ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={signOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
