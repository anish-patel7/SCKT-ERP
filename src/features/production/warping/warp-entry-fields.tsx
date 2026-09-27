import type { ReactNode } from "react";
import {
  DateField,
  FieldGrid,
  FormSection,
  NumberField,
  ReferenceSelect,
  TextField,
} from "@/components/erp/form-controls";
import { Button } from "@/components/ui/button";
import { masterOptions } from "@/features/production/pages/page-helpers";
import type { MasterOption } from "@/features/production/types/production";
import type { WarpingForm } from "@/features/production/warping/use-warping-form";
import type { WarpValues } from "@/features/production/warping/warp-values";
import { DEMO_BEAM_TYPES } from "@/features/production/warping/warping-demo-data";
import { BEAM_STATUS_LABEL, type BeamRow } from "@/features/production/warping/warping-types";

/**
 * Beam + warp fields. Picking an empty / at-warping beam fills its number and type; a new
 * beam number registers a new beam.
 */
export function WarpEntryFields({
  form,
  idPrefix,
  dateLabel,
  candidates,
  yarns,
  extra,
  showRack = true,
}: {
  form: WarpingForm<WarpValues>;
  idPrefix: string;
  dateLabel: string;
  /** Beams that can take a new warp (EMPTY / AT_WARPING). */
  candidates: BeamRow[];
  yarns: MasterOption[] | undefined;
  extra?: ReactNode;
  showRack?: boolean;
}) {
  const v = form.values;
  const e = form.errors;
  const known = candidates.find((b) => b.beamNo.toLowerCase() === v.beamNo.trim().toLowerCase());
  return (
    <>
      <FormSection
        title="Beam"
        description={
          known
            ? `Existing beam — ${BEAM_STATUS_LABEL[known.status]}${known.partyId ? ` at ${known.partyName}` : ""}`
            : "Pick an empty / at-warping beam, or type a new beam no."
        }
      >
        {candidates.length > 0 && (
          <div
            className="mb-3 flex flex-wrap gap-1.5"
            role="group"
            aria-label="Beams ready for warping"
          >
            {candidates.map((b) => (
              <Button
                key={b.id}
                type="button"
                size="sm"
                variant={known?.id === b.id ? "default" : "outline"}
                className="h-7 gap-1 px-2 font-mono text-xs"
                onClick={() => {
                  form.set("beamNo", b.beamNo);
                  form.set("beamType", b.beamType);
                }}
              >
                {b.beamNo}
                <span className="font-sans text-[0.625rem] opacity-70">
                  {BEAM_STATUS_LABEL[b.status]}
                </span>
              </Button>
            ))}
          </div>
        )}
        <FieldGrid>
          <DateField
            id={`${idPrefix}-date`}
            label={dateLabel}
            required
            value={v.date}
            onChange={(x) => form.set("date", x)}
            error={e["date"]}
          />
          <TextField
            id={`${idPrefix}-beam-no`}
            label="Beam No."
            required
            value={v.beamNo}
            onChange={(x) => form.set("beamNo", x)}
            error={e["beamNo"]}
          />
          <ReferenceSelect
            id={`${idPrefix}-type`}
            label="Beam Type"
            required
            value={v.beamType}
            options={DEMO_BEAM_TYPES.map((t) => ({ id: t, label: t }))}
            onChange={(x) => form.set("beamType", x)}
            error={e["beamType"]}
            hint="Placeholder list — pending confirmation"
          />
          {extra}
        </FieldGrid>
      </FormSection>
      <FormSection title="Warp">
        <FieldGrid>
          <TextField
            id={`${idPrefix}-set-no`}
            label="Set No."
            required
            value={v.setNo}
            onChange={(x) => form.set("setNo", x)}
            error={e["setNo"]}
          />
          <ReferenceSelect
            id={`${idPrefix}-yarn`}
            label="Warp Yarn"
            required
            value={v.warpYarnId}
            options={masterOptions(yarns)}
            onChange={(x) => form.set("warpYarnId", x)}
            error={e["warpYarnId"]}
          />
          <TextField
            id={`${idPrefix}-count`}
            label="Count / Denier"
            value={v.countDenier}
            onChange={(x) => form.set("countDenier", x)}
          />
          <NumberField
            id={`${idPrefix}-ends`}
            label="Total Ends"
            required
            value={v.totalEnds}
            onChange={(x) => form.set("totalEnds", x)}
            error={e["totalEnds"]}
          />
          <NumberField
            id={`${idPrefix}-length`}
            label="Length (m)"
            required
            value={v.lengthMetre}
            onChange={(x) => form.set("lengthMetre", x)}
            error={e["lengthMetre"]}
          />
          {showRack && (
            <TextField
              id={`${idPrefix}-rack`}
              label="Rack / Location"
              value={v.rack}
              onChange={(x) => form.set("rack", x)}
            />
          )}
          <TextField
            id={`${idPrefix}-remark`}
            label="Remark"
            value={v.remark}
            onChange={(x) => form.set("remark", x)}
          />
        </FieldGrid>
      </FormSection>
    </>
  );
}
