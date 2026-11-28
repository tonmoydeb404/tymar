"use client";

import { Card } from "@packages/ui/components/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

type Props = {
  n: number;
  title: string;
  /** One line shown while collapsed — what is currently chosen. */
  summary: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

/** A numbered, collapsible section. Closed, it still tells you what's
 * selected, so you can scan the whole export without opening anything. */
export function StepCard({ n, title, summary, defaultOpen, children }: Props) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <Card className="gap-0 py-0">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="flex w-full items-center gap-4 px-5 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          }
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {n}
          </span>
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="font-semibold">{title}</span>
            {!open && (
              <span className="truncate text-sm text-muted-foreground">
                {summary}
              </span>
            )}
          </span>
          <ChevronDown
            className={`size-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid gap-5 border-t border-border px-5 py-5">
            {children}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
