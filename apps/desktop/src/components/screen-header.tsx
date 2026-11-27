// Heading used at the top of tab screens (Times, Settings): a real title
// with an optional one-line subtitle and an actions slot.
export function ScreenHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-10 shrink-0 items-center justify-between gap-3">
      <div className="grid min-w-0 gap-0.5">
        <h1 className="truncate text-xl leading-tight font-semibold tracking-tight text-ink">
          {title}
        </h1>
        {subtitle && (
          <p className="truncate font-mono text-[11px] text-muted-foreground tabular-nums">
            {subtitle}
          </p>
        )}
      </div>
      {actions}
    </div>
  );
}
