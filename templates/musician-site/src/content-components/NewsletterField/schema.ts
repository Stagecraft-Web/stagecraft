import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import type {
  MarkdocTagDefinition,
  KeystaticContentComponent,
} from "../_shared/types";
import {
  AUTOCOMPLETE_TOKENS,
  AUTOCOMPLETE_TOKEN_LABELS,
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  type AutocompleteToken,
  type FieldType,
} from "../_shared/types";
import {
  DEFAULT_LABEL_FOR_TYPE,
  DEFAULT_NAME_FOR_TYPE,
} from "./typeDefaults";
import { NewsletterFieldPreview } from "./preview";

/**
 * Markdoc tag `newsletter-field`.
 *
 * Child of `{% newsletter-signup %}` — each instance emits one input into the
 * subscribe form. The `name` attribute is the form-field name the newsletter
 * provider expects (e.g. `EMAIL` for Mailchimp, `email_address` for
 * ConvertKit, `metadata__name` for Buttondown). We don't remap per service —
 * authors paste whatever their provider's embed code uses verbatim.
 *
 * Self-closing, no body. When used outside a `newsletter-signup` wrapper the
 * tag still validates (markdoc doesn't enforce parent-child relationships by
 * tag name — only by AST node type) but renders nothing meaningful on its own.
 * Authoring-surface convention keeps the tag inside `newsletter-signup`.
 *
 * `name`, `label`, and `autocomplete` are markdoc-optional. For `type="email"`
 * and `type="tel"` the renderer fills in sensible defaults from
 * `typeDefaults.ts`, so the most common cases author as `{% newsletter-field
 * type="email" /%}`. For `type="text"` and `type="select"` there's no obvious
 * default name, so `validate` requires `name` and `label` explicitly. Why not
 * push the defaulting into markdoc's `default:` field — keystatic shows a
 * blank field when markdoc has a default, which makes "Email" creep into a
 * 'Phone' field by accident. Defaults applied at render time stay invisible
 * in the admin and only surface when the markdoc attribute is truly absent.
 */
export const markdoc: MarkdocTagDefinition = {
  render: "./src/content-components/NewsletterField/NewsletterField.astro",
  selfClosing: true,
  attributes: {
    type: {
      type: String,
      default: "text",
      matches: FIELD_TYPES as unknown as string[],
    },
    label: {
      type: String,
    },
    name: {
      type: String,
    },
    autocomplete: {
      type: String,
      matches: [...AUTOCOMPLETE_TOKENS],
    },
    isRequired: {
      type: Boolean,
      default: false,
    },
    options: {
      type: String,
    },
    placeholder: {
      type: String,
    },
  },
  validate(node) {
    const errors: Array<{
      id: string;
      level: "error";
      message: string;
    }> = [];
    const type = (node.attributes?.type ?? "text") as FieldType;
    const name = node.attributes?.name as string | undefined;
    const label = node.attributes?.label as string | undefined;

    if (!name && DEFAULT_NAME_FOR_TYPE[type] === undefined) {
      errors.push({
        id: "newsletter-field-missing-name",
        level: "error",
        message: `newsletter-field with type="${type}" must set a "name" attribute (only "email" and "tel" types fall back to a default name).`,
      });
    }
    if (!label && DEFAULT_LABEL_FOR_TYPE[type] === undefined) {
      errors.push({
        id: "newsletter-field-missing-label",
        level: "error",
        message: `newsletter-field with type="${type}" must set a "label" attribute (only "email" and "tel" types fall back to a default label).`,
      });
    }
    if (type === "select" && !node.attributes?.options) {
      errors.push({
        id: "newsletter-field-missing-options",
        level: "error",
        message:
          'newsletter-field with type="select" must set an "options" attribute (pipe-separated, e.g. options="Friend|Social|Other").',
      });
    }
    return errors;
  },
};

/**
 * Keystatic schema. Field order is intentional — Type goes first because
 * it's the most consequential decision (everything else flows from it),
 * then Label and Name (the values authors most often customise), then
 * Autocomplete + Required + Options + Placeholder. Descriptions on Label /
 * Name / Autocomplete call out the per-type render-time defaults so authors
 * know they can leave those fields blank for Email and Phone.
 */
export const keystatic: KeystaticContentComponent = block({
  label: "Newsletter Field",
  description:
    "One input in the Newsletter Signup form. Pick the type first — for Email and Phone you can leave Label, Name, and Autocomplete blank and the renderer fills in sensible defaults.",
  schema: {
    type: fields.select({
      label: "Type",
      description:
        "Picking Email or Phone lets you leave Label, Name, and Autocomplete blank — the renderer falls back to common defaults.",
      options: FIELD_TYPES.map((v) => ({
        label: FIELD_TYPE_LABELS[v],
        value: v,
      })) as [
        { label: string; value: FieldType },
        ...{ label: string; value: FieldType }[],
      ],
      defaultValue: "text",
    }),
    label: fields.text({
      label: "Label",
      description:
        "Shown next to the input. For type=Email defaults to 'Email'; for type=Phone defaults to 'Phone'.",
      defaultValue: "",
    }),
    name: fields.text({
      label: "Name",
      description:
        "Form-field name sent to the newsletter provider. Match your provider's embed exactly — e.g. `EMAIL` (Mailchimp uppercase), `email_address` (ConvertKit), `email` (Buttondown / generic), `FNAME` / `LNAME` (Mailchimp custom). For type=Email defaults to 'email'; for type=Phone defaults to 'phone'.",
      defaultValue: "",
    }),
    autocomplete: fields.select({
      label: "Autocomplete",
      description:
        "HTML `autocomplete` token — helps browsers prefill from saved profile data. For type=Email defaults to 'Email'; for type=Phone defaults to 'Phone'; otherwise 'Off'.",
      options: AUTOCOMPLETE_TOKENS.map((v) => ({
        label: AUTOCOMPLETE_TOKEN_LABELS[v],
        value: v,
      })) as [
        { label: string; value: AutocompleteToken },
        ...{ label: string; value: AutocompleteToken }[],
      ],
      defaultValue: "off",
    }),
    isRequired: fields.checkbox({
      label: "Required",
      description: "Browser blocks submit until this field has a value.",
      defaultValue: false,
    }),
    options: fields.text({
      label: "Options",
      description:
        "Pipe-separated choices for type=Select (e.g. `Friend|Social|Other`). Required when type=Select; ignored otherwise.",
      defaultValue: "",
    }),
    placeholder: fields.text({
      label: "Placeholder",
      description:
        "Optional grey hint text inside an empty input. For type=Select, this becomes the empty-state prompt option.",
      defaultValue: "",
    }),
  },
  ContentView: NewsletterFieldPreview,
});

export const tagName = "newsletter-field";
