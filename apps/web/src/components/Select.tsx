import FormGroup from "./FormGroup";
import styles from "./FormGroup.module.css";

interface SelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export default function Select({ id, label, value, onChange, options }: SelectProps) {
  return (
    <FormGroup id={id} label={label}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={styles.input}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </FormGroup>
  );
}
