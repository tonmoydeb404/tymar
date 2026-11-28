"use client";

import { DrawerDescriptionProps } from "@base-ui/react";
import * as React from "react";
import { useIsMobile } from "../hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { XIcon } from "lucide-react";
import { Button } from "./button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "./drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "./sheet";

type ResponsiveSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  descriptionProps?: DrawerDescriptionProps;

  /** Sheet side on desktop. Ignored on mobile (bottom drawer) or "dialog" variant. */
  side?: "right" | "left" | "top" | "bottom";
  /** Desktop chrome: a side Sheet, or a centered Dialog for short forms. Ignored on mobile. */
  variant?: "sheet" | "dialog";
  /** Dialog width when `variant="dialog"`. Ignored otherwise. */
  size?: "sm" | "default" | "lg";
  footer?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Form container that renders a side Sheet (or centered Dialog) on desktop
 * and a bottom Drawer on mobile (and other narrow viewports, e.g. a 420px
 * desktop window). Same props, adaptive chrome.
 */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  descriptionProps,
  side = "right",
  variant = "sheet",
  size,
  footer,
  children,
}: ResponsiveSheetProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    // Full-screen on mobile: the whole viewport is the form, the footer
    // stays pinned, and only a long form scrolls — never the sheet itself.
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent fullScreen>
          <DrawerHeader className="flex-row items-start justify-between gap-3 p-4 pb-2 text-left">
            <div className="grid min-w-0 gap-1">
              <DrawerTitle className="text-lg font-semibold">
                {title}
              </DrawerTitle>
              {description && (
                <DrawerDescription {...descriptionProps}>
                  {description}
                </DrawerDescription>
              )}
            </div>
            <DrawerClose
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close"
                  className="-mt-1 -mr-1 shrink-0"
                />
              }
            >
              <XIcon />
            </DrawerClose>
          </DrawerHeader>
          <div className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto overscroll-contain px-4 py-4">
            {children}
          </div>
          {footer && (
            <DrawerFooter className="flex-col-reverse border-t border-border bg-popover p-4 pb-[max(1rem,env(safe-area-inset-bottom))] [&>*]:w-full">
              {footer}
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  if (variant === "dialog") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size={size}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && (
              <DialogDescription {...descriptionProps}>
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="grid gap-3 px-4">{children}</div>
          {footer && <DialogFooter>{footer}</DialogFooter>}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && (
            <SheetDescription {...descriptionProps}>
              {description}
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="grid gap-3 px-4">{children}</div>
        {footer && <SheetFooter>{footer}</SheetFooter>}
      </SheetContent>
    </Sheet>
  );
}
