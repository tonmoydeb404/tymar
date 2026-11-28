import { cn } from "@/lib/utils";
import { Clock3, Home, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/times", label: "Times", icon: Clock3, end: false },
  { to: "/settings", label: "Settings", icon: Settings, end: false },
] as const;

// Floating pill navbar, overlaid on the scrollable content below it.
export function BottomTabs() {
  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-4"
    >
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card/95 p-1.5 shadow-lg backdrop-blur-md">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-1.5 rounded-full px-4 py-2 transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "font-medium text-muted-foreground hover:text-foreground",
              )
            }
          >
            <tab.icon size={16} />
            <span className="font-mono text-[10px] font-semibold">
              {tab.label}
            </span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
