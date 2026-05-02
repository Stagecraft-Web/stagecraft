import type { ReactNode } from "react";
import { NewsletterFieldTile } from "../_shared/newsletterFieldTile";

type NewsletterPhoneFieldValue = {
  name: string;
  label: string;
  autocomplete: string;
  isRequired: boolean;
  placeholder: string;
};

export function NewsletterPhoneFieldPreview({
  value,
}: {
  value: NewsletterPhoneFieldValue;
}): ReactNode {
  const { label, name, isRequired, placeholder } = value;
  return (
    <NewsletterFieldTile
      label={label || "Phone"}
      typeBadge="Phone"
      isRequired={isRequired}
      hint={placeholder || `name=${name || "phone"}`}
    />
  );
}
