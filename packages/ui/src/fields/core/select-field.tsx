import { useId, type ReactNode } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@packages/ui/components/select";
import { FieldControl } from "@packages/ui/fields/core/field-control";
import type { CoreFieldProps } from "@packages/ui/fields/core/types";

type SelectFieldOption<T extends string = string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
};

type SelectFieldProps<T extends string = string> = CoreFieldProps & {
  id?: string;
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SelectFieldOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  triggerClassName?: string;
};

// Label + Select over a fixed option list. The closed trigger resolves its label
// from `options` so it never shows the raw value.
function SelectField<T extends string = string>({
  label,
  description,
  error,
  required,
  orientation,
  fieldClassName,
  id,
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  triggerClassName,
}: SelectFieldProps<T>) {
  const autoId = useId();
  const triggerId = id ?? autoId;
  return (
    <FieldControl
      label={label}
      description={description}
      orientation={orientation}
      className={fieldClassName}
      htmlFor={triggerId}
      required={required}
      invalid={!!error}
      errors={[{ message: error }]}
    >
      <Select
        value={value}
        // Base UI emits null when the selection is cleared.
        onValueChange={(v) => v != null && onValueChange(v as T)}
        disabled={disabled}
      >
        <SelectTrigger
          id={triggerId}
          className={triggerClassName ?? "w-full"}
          aria-invalid={!!error}
        >
          <SelectValue placeholder={placeholder}>
            {(v: string) => options.find((o) => o.value === v)?.label ?? v}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldControl>
  );
}

export { SelectField };
export type { SelectFieldOption, SelectFieldProps };
