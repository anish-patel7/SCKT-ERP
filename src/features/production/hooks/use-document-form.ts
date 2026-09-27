import { useCallback, useMemo, useState } from "react";
import {
  useCreateProductionDocument,
  useDeleteProductionDraft,
  useSaveProductionDraft,
} from "@/features/production/hooks/use-production";
import { ProductionValidationError } from "@/features/production/services/production-service";
import type {
  InputOf,
  ProductionDraft,
  ProductionKind,
} from "@/features/production/types/production";

export type DocumentFormConfig<K extends ProductionKind, V> = {
  /** Values for a new document. */
  empty: () => V;
  /** Form values → service input (numbers parsed; invalid text becomes NaN and is rejected). */
  toInput: (values: V) => InputOf<K>;
  /** Draft input → form values. */
  fromInput: (input: InputOf<K>) => V;
};

export type DocumentForm<V> = {
  isOpen: boolean;
  draftId: string | null;
  values: V;
  errors: Record<string, string>;
  dirty: boolean;
  saving: boolean;
  set: <F extends keyof V>(field: F, value: V[F]) => void;
  update: (fn: (values: V) => V) => void;
  clearError: (field: string) => void;
  /** Close without asking (after a successful save) or after the user confirms. */
  close: (force?: boolean) => void;
  post: () => Promise<void>;
  saveDraft: () => Promise<void>;
};

const DISCARD = "Discard unsaved changes to this document?";

/**
 * Shared state for every production entry form: open/close, dirty tracking, draft save,
 * post, and mapping service validation errors onto fields. Frontend checks are for the
 * user; FINAL BACKEND MUST VALIDATE AGAIN.
 */
export function useDocumentForm<K extends ProductionKind, V>(
  kind: K,
  config: DocumentFormConfig<K, V>,
): DocumentForm<V> & { open: (draft?: ProductionDraft<K>) => void } {
  const [session, setSession] = useState<{ draftId: string | null; initial: V } | null>(null);
  const [values, setValues] = useState<V>(config.empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useCreateProductionDocument(kind);
  const saveDraftMutation = useSaveProductionDraft(kind);
  const deleteDraft = useDeleteProductionDraft(kind);

  const dirty = useMemo(
    () => !!session && JSON.stringify(values) !== JSON.stringify(session.initial),
    [session, values],
  );

  const open = useCallback(
    (draft?: ProductionDraft<K>) => {
      const initial = draft ? config.fromInput(draft.input) : config.empty();
      setValues(initial);
      setErrors({});
      setSession({ draftId: draft?.id ?? null, initial });
    },
    [config],
  );

  const close = useCallback(
    (force = false) => {
      if (!force && dirty && !confirm(DISCARD)) return;
      setSession(null);
      setErrors({});
    },
    [dirty],
  );

  const handleError = (error: unknown) => {
    if (error instanceof ProductionValidationError) {
      setErrors({ [error.field]: error.message });
    } else {
      setErrors({ form: error instanceof Error ? error.message : "Could not save" });
    }
  };

  const post = async () => {
    setErrors({});
    try {
      await create.mutateAsync(config.toInput(values));
      if (session?.draftId) await deleteDraft.mutateAsync(session.draftId);
      setSession(null);
    } catch (error) {
      handleError(error);
    }
  };

  const saveDraft = async () => {
    setErrors({});
    try {
      await saveDraftMutation.mutateAsync({
        input: config.toInput(values),
        ...(session?.draftId ? { draftId: session.draftId } : {}),
      });
      setSession(null);
    } catch (error) {
      handleError(error);
    }
  };

  return {
    isOpen: session !== null,
    draftId: session?.draftId ?? null,
    values,
    errors,
    dirty,
    saving: create.isPending || saveDraftMutation.isPending,
    set: (field, value) => {
      setValues((v) => ({ ...v, [field]: value }));
      setErrors((e) => {
        if (!(field as string) || !e[field as string]) return e;
        const { [field as string]: _removed, ...rest } = e;
        return rest;
      });
    },
    update: (fn) => setValues(fn),
    clearError: (field) =>
      setErrors((e) => {
        const { [field]: _removed, ...rest } = e;
        return rest;
      }),
    close,
    open,
    post,
    saveDraft,
  };
}
