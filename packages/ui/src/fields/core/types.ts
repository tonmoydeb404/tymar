import type { ReactNode } from "react";

// Props shared by every non-react-hook-form field (TextField, SelectField, ...).
type CoreFieldProps = {
  label?: ReactNode;
  description?: ReactNode;
  /** Error message; its presence marks the field invalid. */
  error?: string;
  required?: boolean;
  orientation?: "vertical" | "horizontal" | "responsive";
  fieldClassName?: string;
};

export type { CoreFieldProps };
