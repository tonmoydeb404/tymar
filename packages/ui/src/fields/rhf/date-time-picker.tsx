"use client";

import { Controller, type FieldPath, type FieldValues } from "react-hook-form";

import { DateTimePicker } from "@packages/ui/components/date-time-picker";
import { FieldControl } from "@packages/ui/fields/core";
import type { RhfFieldProps } from "@packages/ui/fields/rhf/types";

type RhfDateTimePickerProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> = RhfFieldProps<TFieldValues, TName> & {
  placeholder?: string;
  buttonClassName?: string;
  fromDate?: Date;
  toDate?: Date;
};

// Stores/reads the field as an ISO 8601 string, matching how the rest of the app persists dates.
// The picker itself is responsive: popover on desktop, drawer on mobile.
function RhfDateTimePicker<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  description,
  orientation,
  fieldClassName,
  disabled,
  placeholder = "Pick a date & time",
  buttonClassName,
  fromDate,
  toDate,
}: RhfDateTimePickerProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      disabled={disabled}
      render={({ field, fieldState }) => (
        <FieldControl
          label={label}
          description={description}
          orientation={orientation}
          className={fieldClassName}
          invalid={fieldState.invalid}
          errors={[fieldState.error]}
        >
          <DateTimePicker
            value={field.value}
            onChange={(iso) => field.onChange(iso ?? "")}
            placeholder={placeholder}
            title={typeof label === "string" ? label : undefined}
            invalid={fieldState.invalid}
            className={buttonClassName}
            fromDate={fromDate}
            toDate={toDate}
          />
        </FieldControl>
      )}
    />
  );
}

export { RhfDateTimePicker };
export type { RhfDateTimePickerProps };
