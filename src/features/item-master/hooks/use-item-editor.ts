import { useCallback, useMemo, useState } from "react";
import type {
  ItemInput,
  ItemMasterLookups,
  ItemMode,
  ItemRecord,
  ItemValidationErrors,
} from "@/features/item-master/types/item-master";
import { validateItem } from "@/features/item-master/utils/item-model";

/** What the workspace is showing: the record (if saved at least once) and the edited copy. */
export type ItemSession = {
  mode: ItemMode;
  record: ItemRecord | null;
  input: ItemInput;
  /** Snapshot of `input` when the session started or was last saved (dirty tracking). */
  baseline: string;
};

/** Props shared by the five configuration tabs. */
export type ItemTabProps = {
  value: ItemInput;
  /** Mutate a copy of the input; the editor stores the result. */
  update: (mutate: (draft: ItemInput) => void) => void;
  readOnly: boolean;
  errors: ItemValidationErrors;
  lookups: ItemMasterLookups;
};

const snapshot = (input: ItemInput) => JSON.stringify(input);

export function useItemEditor() {
  const [session, setSession] = useState<ItemSession | null>(null);
  // Errors are hidden until the first Save / Save Draft attempt, then follow the input live
  // so a corrected field clears its message immediately.
  const [level, setLevel] = useState<"draft" | "save" | null>(null);

  const start = useCallback((mode: ItemMode, input: ItemInput, record: ItemRecord | null) => {
    setSession({ mode, record, input, baseline: snapshot(input) });
    setLevel(null);
  }, []);

  const close = useCallback(() => {
    setSession(null);
    setLevel(null);
  }, []);

  const update = useCallback((mutate: (draft: ItemInput) => void) => {
    setSession((s) => {
      if (!s || s.mode === "VIEW") return s;
      const next = structuredClone(s.input);
      mutate(next);
      return { ...s, input: next };
    });
  }, []);

  const setMode = useCallback((mode: ItemMode) => {
    setSession((s) => (s ? { ...s, mode } : s));
  }, []);

  const dirty = useMemo(
    () => !!session && session.mode !== "VIEW" && snapshot(session.input) !== session.baseline,
    [session],
  );

  const errors = useMemo<ItemValidationErrors>(
    () => (session && level ? validateItem(session.input, level) : {}),
    [session, level],
  );

  return { session, errors, showErrors: setLevel, start, close, update, setMode, dirty };
}
