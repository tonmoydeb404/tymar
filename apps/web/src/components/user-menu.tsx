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
import { LogOut, Moon, Settings, Sun } from "lucide-react";
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
    return (
      <span
        aria-hidden
        className="size-8 animate-pulse rounded-full bg-muted"
      />
    );
  }

  if (!user) return null;

  const isDark = mounted ? theme === "dark" : false;
  const ThemeIcon = isDark ? Sun : Moon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`Account menu for ${user.user_metadata?.full_name || user.email}`}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground transition-colors outline-none select-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-muted"
          >
            {getInitials(user.user_metadata?.full_name, user.email)}
          </button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <div className="px-1.5 py-1.5">
          <p className="truncate text-sm font-medium">
            {user.user_metadata?.full_name || "Unnamed user"}
          </p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
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
