import type { HTMLInputTypeAttribute, ReactNode } from "react";
import { useId } from "react";
import styles from "./FormGroup.module.css";

// Generic labelled form control. The `type` prop covers the three control
// shapes the form library renders: any standard `<input>` type
// (`text`, `email`, `tel`, `url`, `password`, …), `"textarea"`, and
// `"select"`. Internally the component switches on those three buckets so
// callers don't have to thread `isTextarea` / `isSelect` flags.
export type FormGroupType = HTMLInputTypeAttribute | "textarea" | "select";

export interface FormGroupProps {
  /** Label text shown above the control. */
  label: string;
  /** Name + id for the rendered input. Required when `children` is omitted
   *  (the built-in input needs a `name`); optional when wrapping a custom
   *  control as `children` (the caller manages id/name). */
  name?: string;
  /** Override the label's `htmlFor`. Defaults to `name`, or a generated id
   *  when neither is supplied. */
  htmlFor?: string;
  /** Control shape. Ignored when `children` is supplied. */
  type?: FormGroupType;
  /** Number of rows for `type="textarea"`. */
  rows?: number;
  /** Choices for `type="select"`. Each string is used for both the option's
   *  value and its display label. */
  selectOptions?: string[];
  /** Whether the field is required. Adds the visible asterisk and the
   *  HTML `required` attribute on the built-in input. */
  isRequired?: boolean;
  /** Autocomplete attribute. `string` is permitted so content-component
   *  authors can pass arbitrary tokens (e.g. `given-name`); the strict union
   *  is enforced at the source via `HTMLAutoCompleteAttribute`-friendly
   *  callers. */
  autocomplete?: string;
  /** Placeholder text. For `<select>` it appears as the empty-value prompt
   *  option (only when the field isn't required). */
  placeholder?: string;
  /** Custom control to render inside the form group. When provided, the
   *  built-in `type` rendering is skipped — the caller owns the input. */
  children?: ReactNode;
}

/**
 * SSR-friendly React `FormGroup`. Astro's `FormGroup.astro` is a thin wrapper
 * around this component — both Astro pages (rendered to static HTML at build)
 * and React islands (the in-page Appearance sidebar) consume the same
 * primitive so labels and spacing stay in lock-step.
 */
export default function FormGroup({
  label,
  name,
  htmlFor,
  type = "text",
  rows = 5,
  selectOptions,
  isRequired = false,
  autocomplete,
  placeholder,
  children,
}: FormGroupProps): ReactNode {
  const reactId = useId();
  // Priority: explicit htmlFor → name (matches Astro's id=name convention) →
  // generated id (so `<label htmlFor>` always points somewhere stable).
  const id = htmlFor ?? name ?? reactId;
  return (
    <div className={styles.formGroup}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {isRequired && <span className={styles.required}>*</span>}
      </label>
      {children ?? (
        <BuiltInControl
          id={id}
          name={name ?? id}
          type={type}
          rows={rows}
          selectOptions={selectOptions ?? []}
          isRequired={isRequired}
          autocomplete={autocomplete}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

interface BuiltInControlProps {
  id: string;
  name: string;
  type: FormGroupType;
  rows: number;
  selectOptions: string[];
  isRequired: boolean;
  autocomplete?: string;
  placeholder?: string;
}

function BuiltInControl({
  id,
  name,
  type,
  rows,
  selectOptions,
  isRequired,
  autocomplete,
  placeholder,
}: BuiltInControlProps): ReactNode {
  if (type === "select") {
    return (
      <select
        id={id}
        name={name}
        required={isRequired}
        autoComplete={autocomplete}
        className={styles.control}
      >
        {!isRequired && <option value="">{placeholder ?? "Select an option"}</option>}
        {selectOptions.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }
  if (type === "textarea") {
    return (
      <textarea
        id={id}
        name={name}
        rows={rows}
        required={isRequired}
        autoComplete={autocomplete}
        placeholder={placeholder}
        className={styles.control}
      />
    );
  }
  return (
    <input
      type={type}
      id={id}
      name={name}
      required={isRequired}
      autoComplete={autocomplete}
      placeholder={placeholder}
      className={styles.control}
    />
  );
}
