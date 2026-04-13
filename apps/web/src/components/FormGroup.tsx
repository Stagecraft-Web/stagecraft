import styles from "./FormGroup.module.css";

interface FormGroupProps {
  id: string;
  label: string;
  children: React.ReactNode;
}

export default function FormGroup({ id, label, children }: FormGroupProps) {
  return (
    <div className={styles.group}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children}
    </div>
  );
}
