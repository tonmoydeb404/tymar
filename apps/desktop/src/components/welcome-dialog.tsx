import { brand } from "@/lib/brand";
import { displayName } from "@/lib/display-name";
import { Button } from "@packages/ui/components/button";
import { ResponsiveSheet } from "@packages/ui/components/responsive-sheet";

type WelcomeDialogProps = {
  open: boolean;
  onGetStarted: () => void;
};

export function WelcomeDialog({ open, onGetStarted }: WelcomeDialogProps) {
  return (
    <ResponsiveSheet
      variant="dialog"
      open={open}
      onOpenChange={() => {}}
      title={
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt={displayName} className="size-12" />

          <div className="flex flex-col items-start text-left">
            <span>Welcome to {displayName}</span>
            <span className="text-muted-foreground text-sm font-normal">
              {brand.description.short}
            </span>
          </div>
        </div>
      }
      footer={
        <Button size="lg" onClick={() => onGetStarted()}>
          Get started
        </Button>
      }
    >
      <p className="text-[0.82rem] leading-relaxed text-muted-foreground">
        {brand.description.long}
      </p>
    </ResponsiveSheet>
  );
}
