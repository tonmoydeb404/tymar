import { useId } from "react";

import { Switch } from "@packages/ui/components/switch";
import { FieldControl } from "@packages/ui/fields/core/field-control";
import type { CoreFieldProps } from "@packages/ui/fields/core/types";

type SwitchFieldProps = Omit<CoreFieldProps, "orientation" | "required"> &
  Omit<React.ComponentProps<typeof Switch>, "id"> & { id?: string };

// Label/description on the left, Switch on the right.
function SwitchField({
  label,
  description,
  error,
  fieldClassName,
  id,
  ...switchProps
}: SwitchFieldProps) {
  const autoId = useId();
  const switchId = id ?? autoId;
  return (
    <FieldControl
      label={label}
      description={description}
      orientation="horizontal"
      className={fieldClassName}
      htmlFor={switchId}
      invalid={!!error}
      errors={[{ message: error }]}
    >
      <Switch {...switchProps} id={switchId} />
    </FieldControl>
  );
}

export { SwitchField };
export type { SwitchFieldProps };
