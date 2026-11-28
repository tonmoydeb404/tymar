import { useId } from "react";

import { Textarea } from "@packages/ui/components/textarea";
import { FieldControl } from "@packages/ui/fields/core/field-control";
import type { CoreFieldProps } from "@packages/ui/fields/core/types";

type TextareaFieldProps = CoreFieldProps &
  Omit<React.ComponentProps<typeof Textarea>, "required">;

function TextareaField({
  label,
  description,
  error,
  required,
  orientation,
  fieldClassName,
  id,
  ...textareaProps
}: TextareaFieldProps) {
  const autoId = useId();
  const textareaId = id ?? autoId;
  return (
    <FieldControl
      label={label}
      description={description}
      orientation={orientation}
      className={fieldClassName}
      htmlFor={textareaId}
      required={required}
      invalid={!!error}
      errors={[{ message: error }]}
    >
      <Textarea {...textareaProps} id={textareaId} aria-invalid={!!error} />
    </FieldControl>
  );
}

export { TextareaField };
export type { TextareaFieldProps };
