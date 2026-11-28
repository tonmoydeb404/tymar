"use client";

import * as React from "react";

import { Button } from "@packages/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@packages/ui/components/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@packages/ui/components/popover";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";

type PickerSurfaceProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Drawer title on mobile. */
  title: string;
  /** Renders the trigger; `onClick` must be applied on mobile (the drawer
   * has no built-in trigger). */
  renderTrigger: (props: { onClick?: () => void }) => React.ReactElement;
  children: React.ReactNode;
  /** Extra actions pinned under the content (e.g. Apply). On mobile a
   * "Done" button is added when omitted. */
  footer?: React.ReactNode;
  align?: "start" | "center" | "end";
};

/** Where pickers open: a popover on desktop, a bottom drawer on mobile
 * (same breakpoint as `ResponsiveSheet`). Only the body scrolls; actions
 * stay pinned. */
function PickerSurface({
  open,
  onOpenChange,
  title,
  renderTrigger,
  children,
  footer,
  align = "start",
}: PickerSurfaceProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <>
        {renderTrigger({ onClick: () => onOpenChange(true) })}
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>{title}</DrawerTitle>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1">
              {children}
            </div>
            <DrawerFooter className="border-t border-border pt-4">
              {footer ?? (
                <Button type="button" size="lg" onClick={() => onOpenChange(false)}>
                  Done
                </Button>
              )}
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={renderTrigger({})} />
      <PopoverContent className="w-auto p-0" align={align}>
        {children}
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border p-2.5">
            {footer}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export { PickerSurface };
