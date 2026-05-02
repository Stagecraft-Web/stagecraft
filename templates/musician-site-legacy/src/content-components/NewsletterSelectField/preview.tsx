import type { ReactNode } from "react";
import { NewsletterFieldTile } from "../_shared/newsletterFieldTile";
import { parseFieldOptions } from "./parseFieldOptions";

type NewsletterSelectFieldValue = {
  name: string;
  label: string;
  options: string;
  autocomplete: string;
  isRequired: boolean;
  placeholder: string;
};

export function NewsletterSelectFieldPreview({
  value,
}: {
  value: NewsletterSelectFieldValue;
}): ReactNode {
  const { label, name, isRequired, options } = value;
  const choices = parseFieldOptions(options);
  return (
    <NewsletterFieldTile
      label={label || name || "Select field"}
      typeBadge="Select"
      isRequired={isRequired}
      hint={choices.length > 0 ? choices.join(" / ") : "(no options yet)"}
    />
  );
}
