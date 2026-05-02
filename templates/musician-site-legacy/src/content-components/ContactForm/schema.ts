import { block } from "@keystatic/core/content-components";
import type { MarkdocTagDefinition, KeystaticContentComponent } from "../_shared/types";
import { ContactFormPreview } from "./preview";

export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/ContactForm/ContactForm.astro",
  selfClosing: true,
  attributes: {},
};

export const keystatic: KeystaticContentComponent = block({
  label: "Contact Form",
  description: "Renders the contact form (name, email, subject, message).",
  schema: {},
  ContentView: ContactFormPreview,
});

export const tagName = "contact-form";
