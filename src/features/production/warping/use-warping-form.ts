import { useCallback, useMemo, useState } from "react";
import { WarpingValidationError } from "@/features/production/warping/warping-types";

/** Small form state for the Warping entry dialogs (values, field errors, dirty flag). */
export function useWarpingForm<V extends Record<string, string>>(empty: () => V) {
  const [values, setValues] = useState<V>(empty);
  const [baseline, setBaseline] = useState<V>(empty);
  const [isOpen, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const open = useCallback(
    (initial?: Partial<V>) => {
      const start = { ...empty(), ...initial };
      setValues(start);
      setBaseline(start);
      setErrors({});
      setOpen(true);
    },
    [empty],
  );
  const close = useCallback(() => setOpen(false), []);
  const set = useCallback(<K extends keyof V>(key: K, value: V[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      if (!((key as string) in e)) return e;
      const { [key as string]: _removed, ...rest } = e;
      return rest;
    });
  }, []);
  const dirty = useMemo(
    () => isOpen && JSON.stringify(values) !== JSON.stringify(baseline),
    [isOpen, values, baseline],
  );

  /** Run a save; field errors from the service are shown next to the field. */
  const submit = useCallback(async (save: () => Promise<unknown>): Promise<boolean> => {
    try {
      await save();
      setOpen(false);
      return true;
    } catch (e) {
      if (e instanceof WarpingValidationError) setErrors({ [e.field]: e.message });
      else setErrors({ form: e instanceof Error ? e.message : "Could not save" });
      return false;
    }
  }, []);

  return { values, set, errors, setErrors, isOpen, open, close, dirty, submit };
}

export type WarpingForm<V extends Record<string, string>> = ReturnType<typeof useWarpingForm<V>>;
