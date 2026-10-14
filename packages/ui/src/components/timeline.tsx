import { cn } from "@packages/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const timelineVariants = cva("relative flex flex-col", {
  variants: {
    variant: {
      default: "gap-4",
      compact: "gap-2",
      spacious: "gap-6",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const timelineIconVariants = cva(
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-background",
  {
    variants: {
      variant: {
        default: "border-border text-muted-foreground",
        primary: "border-primary bg-primary text-primary-foreground",
        muted: "border-muted-foreground/30 text-muted-foreground",
        destructive:
          "border-destructive bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface TimelineItemProps {
  icon?: React.ReactNode;
  iconVariant?: VariantProps<typeof timelineIconVariants>["variant"];
  title: React.ReactNode;
  description?: React.ReactNode;
  timestamp?: React.ReactNode;
  content?: React.ReactNode;
  /** Suppress the connector line below this item (use on the last item). */
  last?: boolean;
  className?: string;
}

export function TimelineItem({
  icon,
  iconVariant,
  title,
  description,
  timestamp,
  content,
  last,
  className,
}: TimelineItemProps) {
  return (
    <div className={cn("relative flex gap-3 pb-2", className)}>
      {/* connector */}
      {!last && (
        <div className="absolute left-3 top-9 h-full w-px bg-border" />
      )}

      {/* icon */}
      <div className="relative z-10 shrink-0">
        <div className={cn(timelineIconVariants({ variant: iconVariant }))}>
          {icon}
        </div>
      </div>

      {/* body */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium leading-tight">{title}</span>
          {timestamp && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {timestamp}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
        {content && <div className="mt-1">{content}</div>}
      </div>
    </div>
  );
}

export interface TimelineProps extends VariantProps<typeof timelineVariants> {
  className?: string;
  children: React.ReactNode;
}

export function Timeline({ variant, className, children }: TimelineProps) {
  return (
    <div className={cn(timelineVariants({ variant }), className)}>
      {children}
    </div>
  );
}

export { timelineIconVariants, timelineVariants };
