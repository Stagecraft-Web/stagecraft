import styles from "./FormGroup.module.css";

interface FormGroupProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "password";
  placeholder?: string;
  isTextarea?: boolean;
}

export default function FormGroup({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  isTextarea = false,
}: FormGroupProps) {
  return (
    <div className={styles.group}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {isTextarea ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={styles.input}
          rows={4}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={styles.input}
        />
      )}
    </div>
  );
}
