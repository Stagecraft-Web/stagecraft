import FormGroup from "./FormGroup";
import styles from "./FormGroup.module.css";

interface TextareaProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

export default function Textarea({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: TextareaProps) {
  return (
    <FormGroup id={id} label={label}>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={styles.input}
        rows={rows}
      />
    </FormGroup>
  );
}
