import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: React.ReactNode;
  /** Right-aligned controls (filters, primary action). */
  actions?: React.ReactNode;
  className?: string;
};

/** Shared header for every dashboard page: title + one-line description on
 * the left, controls on the right, consistent spacing. */
export function PageHeader({ title, description, actions, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-4",
        className,
      )}
    >
      <div className="grid min-w-0 gap-1">
        <h1 className="truncate text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
