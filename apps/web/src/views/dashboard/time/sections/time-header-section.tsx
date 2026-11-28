import { PageHeader } from "@/components/page-header";
import { Button } from "@packages/ui/components/button";
import {
  DateRangePicker,
  type DateRangeValue,
} from "@packages/ui/components/date-range-picker";
import { Plus } from "lucide-react";

type Props = {
  range: DateRangeValue;
  onRangeChange: (range: DateRangeValue) => void;
  onNew: () => void;
};

export function TimeHeaderSection({ range, onRangeChange, onNew }: Props) {
  return (
    <PageHeader
      title="Time"
      description="Every tracked session across all projects."
      actions={
        <>
          <DateRangePicker value={range} onChange={onRangeChange} />
          <Button onClick={onNew}>
            <Plus size={14} />
            Log time
          </Button>
        </>
      }
    />
  );
}
