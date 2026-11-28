import { PageHeader } from "@/components/page-header";
import { Button } from "@packages/ui/components/button";
import { todayIn } from "@/lib/range";
import {
  DateRangePicker,
  type DateRangeValue,
} from "@packages/ui/components/date-range-picker";
import { Plus } from "lucide-react";

type Props = {
  range: DateRangeValue;
  onRangeChange: (range: DateRangeValue) => void;
  timeZone: string;
  onNew: () => void;
};

export function TimeHeaderSection({ range, onRangeChange, onNew, timeZone }: Props) {
  return (
    <PageHeader
      title="Time"
      description="Every tracked session across all projects."
      actions={
        <>
          <DateRangePicker
            value={range}
            onChange={onRangeChange}
            now={todayIn(timeZone)}
          />
          <Button onClick={onNew}>
            <Plus size={14} />
            Log time
          </Button>
        </>
      }
    />
  );
}
