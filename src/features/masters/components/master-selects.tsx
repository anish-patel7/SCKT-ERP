/**
 * Shared master selectors (Item, Yarn, Unit of measure) built on ReferenceSelect.
 * Item Master uses them today; Production and other modules can adopt them so every
 * screen searches and labels masters the same way. Options come from the caller (the
 * module's service), so these components never fetch data themselves.
 */
import type { ComponentProps } from "react";
import { ReferenceSelect } from "@/components/erp/form-controls";
import {
  itemOption,
  uomOption,
  yarnOption,
  type MasterOption,
} from "@/features/masters/components/master-options";

type SelectProps<T extends MasterOption> = Omit<
  ComponentProps<typeof ReferenceSelect>,
  "options"
> & { options: T[] };

export function ItemSelect({ options, ...props }: SelectProps<MasterOption>) {
  return <ReferenceSelect {...props} options={options.map(itemOption)} />;
}

export function YarnSelect({
  options,
  ...props
}: SelectProps<MasterOption & { denier?: number | null }>) {
  return (
    <ReferenceSelect placeholder="Select yarn…" {...props} options={options.map(yarnOption)} />
  );
}

export function UomSelect({ options, ...props }: SelectProps<MasterOption>) {
  return <ReferenceSelect placeholder="Select unit…" {...props} options={options.map(uomOption)} />;
}
