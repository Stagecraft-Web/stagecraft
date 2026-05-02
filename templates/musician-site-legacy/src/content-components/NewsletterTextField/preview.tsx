import type { ReactNode } from "react";
import { NewsletterFieldTile } from "../_shared/newsletterFieldTile";

type NewsletterTextFieldValue = {
  name: string;
  label: string;
  autocomplete: string;
  isRequired: boolean;
  placeholder: string;
};

export function NewsletterTextFieldPreview({
  value,
}: {
  value: NewsletterTextFieldValue;
}): ReactNode {
  const { label, name, isRequired, placeholder } = value;
  return (
    <NewsletterFieldTile
      label={label || name || "Text field"}
      typeBadge="Text"
      isRequired={isRequired}
      hint={placeholder || `name=${name || "…"}`}
    />
  );
}
