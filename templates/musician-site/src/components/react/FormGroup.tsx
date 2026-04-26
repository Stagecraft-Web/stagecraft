import type {
  ChangeEvent,
  HTMLInputTypeAttribute,
  ReactNode,
} from "react";
import { useId } from "react";
import styles from "./FormGroup.module.css";

// Generic labelled form control. The `type` prop covers the three control
// shapes the form library renders: any standard `<input>` type
// (`text`, `email`, `tel`, `url`, `password`, …), `"textarea"`, and
// `"select"`. Internally the component switches on those three buckets so
// callers don't have to thread `isTextarea` / `isSelect` flags.
export type FormGroupType = HTMLInputTypeAttribute | "textarea" | "select";

/** Each `selectOptions` entry can be a bare string (label === value, the
 *  shorthand the SSR contact form uses) or a `{label, value}` object for
 *  cases where the on-screen text differs from the persisted value
 *  (font weights, "Same as body" → "single", etc.). */
export type FormGroupSelectOption =
  | string
  | { label: string; value: string };

export interface FormGroupProps {
  /** Label text shown above the control. */
  label: string;
  /** Name + id for the rendered input. Optional only when `htmlFor` is
   *  supplied; otherwise it doubles as the id so `<label htmlFor>` resolves. */
  name?: string;
  /** Override the label's `htmlFor`. Defaults to `name`, or a generated id
   *  when neither is supplied. */
  htmlFor?: string;
  /** Control shape — defaults to `"text"`. */
  type?: FormGroupType;
  /** Number of rows for `type="textarea"`. */
  rows?: number;
  /** Choices for `type="select"`. Plain strings double as their own value
   *  + label; pass `{label, value}` when they should differ. */
  selectOptions?: ReadonlyArray<FormGroupSelectOption>;
  /** Whether the field is required. Adds the visible asterisk and the
   *  HTML `required` attribute. */
  isRequired?: boolean;
  /** Disabled controls render greyed out and won't dispatch onChange. */
  isDisabled?: boolean;
  /** Autocomplete attribute. `string` is permitted so content-component
   *  authors can pass arbitrary tokens (e.g. `given-name`). */
  autocomplete?: string;
  /** Placeholder text. For `<select>` it appears as the empty-value prompt
   *  option (only when the field isn't required). */
  placeholder?: string;
  /** Controlled value (React island use). Pair with `onChange`. */
  value?: string | number;
  /** Uncontrolled initial value (SSR / form-submit use). */
  defaultValue?: string | number;
  /** Change handler — receives the new string value. Number-typed
   *  selects (e.g. font weights) must coerce on the caller side. */
  onChange?: (next: string) => void;
  /** Optional `inputMode` for software keyboards (e.g. `"decimal"`). */
  inputMode?: "text" | "decimal" | "numeric" | "tel" | "email" | "url" | "search" | "none";
  /** Optional `spellCheck` toggle — defaults to the browser default. */
  spellCheck?: boolean;
}

/**
 * SSR-friendly React `FormGroup`. Astro's `FormGroup.astro` is a thin wrapper
 * around this component — both Astro pages (rendered to static HTML at build)
 * and React islands (the in-page Appearance sidebar) consume the same
 * primitive so labels, spacing, and field styling stay in lock-step.
 *
 * Self-contained: callers pass props and the component renders the
 * appropriate input/textarea/select. There's no `children` escape hatch —
 * use multiple FormGroups (one per control) when you need two related
 * controls under different labels.
 */
export default function FormGroup(props: FormGroupProps): ReactNode {
  const reactId = useId();
  const id = props.htmlFor ?? props.name ?? reactId;
  return (
    <div className={styles.formGroup}>
      <label htmlFor={id} className={styles.label}>
        {props.label}
        {props.isRequired && <span className={styles.required}>*</span>}
      </label>
      <Control id={id} {...props} />
    </div>
  );
}

interface ControlProps extends FormGroupProps {
  id: string;
}

function Control({
  id,
  name,
  type = "text",
  rows = 5,
  selectOptions = [],
  isRequired = false,
  isDisabled = false,
  autocomplete,
  placeholder,
  value,
  defaultValue,
  onChange,
  inputMode,
  spellCheck,
}: ControlProps): ReactNode {
  // Controlled/uncontrolled glue — React requires `value` and `onChange`
  // together; if either is missing we fall through to `defaultValue` so the
  // input behaves as a plain SSR form control.
  const isControlled = value !== undefined && onChange !== undefined;
  const handleChange = onChange
    ? (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        onChange(e.target.value)
    : undefined;

  if (type === "select") {
    return (
      <select
        id={id}
        name={name ?? id}
        required={isRequired}
        disabled={isDisabled}
        autoComplete={autocomplete}
        className={styles.control}
        {...(isControlled ? { value, onChange: handleChange } : { defaultValue })}
      >
        {!isRequired && (
          <option value="">{placeholder ?? "Select an option"}</option>
        )}
        {selectOptions.map((opt) => {
          const o = typeof opt === "string" ? { label: opt, value: opt } : opt;
          return (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          );
        })}
      </select>
    );
  }
  if (type === "textarea") {
    return (
      <textarea
        id={id}
        name={name ?? id}
        rows={rows}
        required={isRequired}
        disabled={isDisabled}
        autoComplete={autocomplete}
        placeholder={placeholder}
        spellCheck={spellCheck}
        className={styles.control}
        {...(isControlled ? { value: String(value), onChange: handleChange } : { defaultValue })}
      />
    );
  }
  return (
    <input
      type={type}
      id={id}
      name={name ?? id}
      required={isRequired}
      disabled={isDisabled}
      autoComplete={autocomplete}
      placeholder={placeholder}
      inputMode={inputMode}
      spellCheck={spellCheck}
      className={styles.control}
      {...(isControlled ? { value: String(value), onChange: handleChange } : { defaultValue })}
    />
  );
}
