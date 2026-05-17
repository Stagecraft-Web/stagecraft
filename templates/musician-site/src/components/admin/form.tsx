"use client";

import type {
  CSSProperties,
  ChangeEvent,
  ReactNode,
} from "react";

/**
 * Form primitives for the admin singleton panels.
 *
 * One self-contained component per field type — no third-party form library.
 * Each renders a labelled control that mirrors the styling used by the rest
 * of the editor (system fonts, neutral borders, generous spacing) so the
 * Settings / Header / Appearance panels feel like they belong to the same
 * tool as Puck itself.
 *
 * Every control reports changes through an `onChange(next)` callback rather
 * than a synthetic event. The parent owns state and decides when to persist;
 * these primitives are presentational.
 */

const fieldLabelStyle: CSSProperties = {
  display: "block",
  fontSize: "var(--font-size-sm)",
  fontWeight: "var(--font-weight-semibold)" as unknown as number,
  color: "var(--color-text-emphasis)",
  marginBottom: "var(--space-1)",
};

const fieldDescriptionStyle: CSSProperties = {
  fontSize: "var(--font-size-xs)",
  color: "var(--color-text-muted)",
  marginTop: "var(--space-1)",
  lineHeight: "var(--line-height-base)",
};

const inputStyle: CSSProperties = {
  display: "block",
  width: "100%",
  padding: "var(--space-2) var(--space-3)",
  fontSize: "var(--font-size-sm)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  fontFamily: "var(--font-body)",
};

const fieldStyle: CSSProperties = {
  display: "block",
  marginBottom: "var(--space-4)",
};

/** Wrapper that adds the label + description chrome around any field. */
export function Field({
  label,
  description,
  htmlFor,
  children,
}: {
  label: string;
  description?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div style={fieldStyle}>
      <label htmlFor={htmlFor} style={fieldLabelStyle}>
        {label}
      </label>
      {children}
      {description ? <div style={fieldDescriptionStyle}>{description}</div> : null}
    </div>
  );
}

export type TextFieldProps = {
  id?: string;
  label: string;
  description?: ReactNode;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "url";
  isMultiline?: boolean;
  rows?: number;
  isRequired?: boolean;
};

export function TextField({
  id,
  label,
  description,
  value,
  onChange,
  placeholder,
  type = "text",
  isMultiline = false,
  rows = 3,
  isRequired = false,
}: TextFieldProps) {
  return (
    <Field label={label} description={description} htmlFor={id}>
      {isMultiline ? (
        <textarea
          id={id}
          value={value}
          rows={rows}
          required={isRequired}
          placeholder={placeholder}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
          style={{ ...inputStyle, fontFamily: "var(--font-body)", resize: "vertical" }}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          required={isRequired}
          placeholder={placeholder}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          style={inputStyle}
        />
      )}
    </Field>
  );
}

export type SelectFieldOption<T extends string> = {
  label: string;
  value: T;
};

export type SelectFieldProps<T extends string> = {
  id?: string;
  label: string;
  description?: ReactNode;
  value: T;
  options: readonly SelectFieldOption<T>[];
  onChange: (next: T) => void;
};

export function SelectField<T extends string>({
  id,
  label,
  description,
  value,
  options,
  onChange,
}: SelectFieldProps<T>) {
  return (
    <Field label={label} description={description} htmlFor={id}>
      <select
        id={id}
        value={value}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value as T)}
        style={inputStyle}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export type CheckboxFieldProps = {
  id?: string;
  label: string;
  description?: ReactNode;
  value: boolean;
  onChange: (next: boolean) => void;
};

export function CheckboxField({
  id,
  label,
  description,
  value,
  onChange,
}: CheckboxFieldProps) {
  return (
    <div style={{ marginBottom: "var(--space-4)" }}>
      <label
        htmlFor={id}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "var(--space-2)",
          cursor: "pointer",
        }}
      >
        <input
          id={id}
          type="checkbox"
          checked={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
          style={{ marginTop: "0.2rem" }}
        />
        <span>
          <span style={fieldLabelStyle}>{label}</span>
          {description ? (
            <span style={{ ...fieldDescriptionStyle, marginTop: 0, display: "block" }}>
              {description}
            </span>
          ) : null}
        </span>
      </label>
    </div>
  );
}

export type NumberFieldProps = {
  id?: string;
  label: string;
  description?: ReactNode;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
};

export function NumberField({
  id,
  label,
  description,
  value,
  onChange,
  min,
  max,
  step = 1,
}: NumberFieldProps) {
  return (
    <Field label={label} description={description} htmlFor={id}>
      <input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        style={inputStyle}
      />
    </Field>
  );
}

export type ColorFieldProps = {
  id?: string;
  label: string;
  description?: ReactNode;
  value: string;
  onChange: (next: string) => void;
  /** When true, the field can be left blank (used for the optional Link color). */
  isOptional?: boolean;
};

export function ColorField({
  id,
  label,
  description,
  value,
  onChange,
  isOptional = false,
}: ColorFieldProps) {
  // A color input requires a `#rrggbb` value to render; when the field is
  // optional and currently blank, fall back to white so the picker still
  // opens, but keep the stored value empty until the user edits.
  const pickerValue = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffffff";

  return (
    <Field label={label} description={description} htmlFor={id}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <input
          type="color"
          aria-label={`${label} color swatch`}
          value={pickerValue}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          style={{
            width: "2.5rem",
            height: "2rem",
            padding: 0,
            border: "1px solid var(--color-border-strong)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            background: "var(--color-surface)",
          }}
        />
        <input
          id={id}
          type="text"
          value={value}
          placeholder={isOptional ? "(blank — inherits)" : "#000000"}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
        />
      </div>
    </Field>
  );
}

/**
 * A titled group of related fields — used to split the Settings and
 * Appearance panels into scannable sub-sections (Colors, Body, Headings, …).
 */
export function FieldGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        marginBottom: "var(--space-8)",
        paddingBottom: "var(--space-6)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <header style={{ marginBottom: "var(--space-4)" }}>
        <h2
          style={{
            fontSize: "var(--font-size-lg)",
            fontWeight: "var(--font-weight-semibold)" as unknown as number,
            color: "var(--color-text)",
            margin: 0,
          }}
        >
          {title}
        </h2>
        {description ? (
          <p
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-muted)",
              margin: "var(--space-1) 0 0 0",
              lineHeight: "var(--line-height-base)",
            }}
          >
            {description}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}
