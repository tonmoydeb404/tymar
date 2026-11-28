import { useId } from "react";

import { Input } from "@packages/ui/components/input";
import { FieldControl } from "@packages/ui/fields/core/field-control";
import type { CoreFieldProps } from "@packages/ui/fields/core/types";

type TextFieldProps = CoreFieldProps &
  Omit<React.ComponentProps<typeof Input>, "required">;

// Label + Input + description/error, for state-driven forms. For react-hook-form
// use RhfInput instead.
function TextField({
  label,
  description,
  error,
  required,
  orientation,
  fieldClassName,
  id,
  ...inputProps
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldControl
      label={label}
      description={description}
      orientation={orientation}
      className={fieldClassName}
      htmlFor={inputId}
      required={required}
      invalid={!!error}
      errors={[{ message: error }]}
    >
      <Input {...inputProps} id={inputId} aria-invalid={!!error} />
    </FieldControl>
  );
}

export { TextField };
export type { TextFieldProps };
