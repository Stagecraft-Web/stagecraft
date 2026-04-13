import FormGroup from "./FormGroup";
import styles from "./FormGroup.module.css";

interface InputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "password";
  placeholder?: string;
}

export default function Input({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: InputProps) {
  return (
    <FormGroup id={id} label={label}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={styles.input}
      />
    </FormGroup>
  );
}
