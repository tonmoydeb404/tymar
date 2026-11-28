import { PageHeader } from "@/components/page-header";
import { todayIn } from "@/lib/range";
import {
  DateRangePicker,
  type DateRangeValue,
} from "@packages/ui/components/date-range-picker";

type Props = {
  name?: string | null;
  range: DateRangeValue;
  onRangeChange: (range: DateRangeValue) => void;
  timeZone: string;
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function GreetingSection({ name, range, onRangeChange, timeZone }: Props) {
  const first = name?.split(" ")[0];
  return (
    <PageHeader
      title={first ? `${greeting()}, ${first}` : "Overview"}
      description="How your time is going — this week by default."
      actions={<DateRangePicker
          value={range}
          onChange={onRangeChange}
          now={todayIn(timeZone)}
        />}
    />
  );
}
