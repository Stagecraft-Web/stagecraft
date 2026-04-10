import FormGroup from "./FormGroup";
import styles from "./FormGroup.module.css";

interface TextareaProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function Textarea({ id, label, value, onChange, placeholder }: TextareaProps) {
  return (
    <FormGroup id={id} label={label}>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={styles.input}
      />
    </FormGroup>
  );
}
