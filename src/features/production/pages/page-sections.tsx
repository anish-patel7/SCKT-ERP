import type { ReactNode } from "react";
import {
  DateField,
  FieldGrid,
  FormSection,
  ReadOnlyField,
  TextField,
} from "@/components/erp/form-controls";

/** Standard "Document Info" block: date, number (assigned on post) and optional extras. */
export function DocumentInfoSection({
  idPrefix,
  dateLabel,
  numberLabel,
  date,
  onDate,
  dateError,
  children,
}: {
  idPrefix: string;
  dateLabel: string;
  numberLabel: string;
  date: string;
  onDate: (value: string) => void;
  dateError?: string | undefined;
  children?: ReactNode;
}) {
  return (
    <FormSection title="Document Info">
      <FieldGrid cols={4}>
        <DateField
          id={`${idPrefix}-date`}
          label={dateLabel}
          value={date}
          onChange={onDate}
          error={dateError}
          required
        />
        <ReadOnlyField label={numberLabel} value="Assigned on post" />
        {children}
      </FieldGrid>
    </FormSection>
  );
}

export function RemarkField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <TextField
      id={id}
      label="Remark"
      value={value}
      onChange={onChange}
      multiline
      className="sm:col-span-2"
    />
  );
}
