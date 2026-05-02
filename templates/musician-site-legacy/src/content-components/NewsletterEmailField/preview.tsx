import type { ReactNode } from "react";
import { NewsletterFieldTile } from "../_shared/newsletterFieldTile";

type NewsletterEmailFieldValue = {
  name: string;
  label: string;
  autocomplete: string;
  isRequired: boolean;
  placeholder: string;
};

export function NewsletterEmailFieldPreview({
  value,
}: {
  value: NewsletterEmailFieldValue;
}): ReactNode {
  const { label, name, isRequired, placeholder } = value;
  return (
    <NewsletterFieldTile
      label={label || "Email"}
      typeBadge="Email"
      isRequired={isRequired}
      hint={placeholder || `name=${name || "email"}`}
    />
  );
}
