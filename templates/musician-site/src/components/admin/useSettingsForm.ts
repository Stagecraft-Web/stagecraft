"use client";

import { useCallback, useMemo, useState } from "react";

import type { SaveStatus } from "./SaveBar";

/**
 * Hook that backs every settings panel (site, header, appearance) with the
 * same dirty-tracking + save logic.
 *
 * The hook owns:
 *   - the current value (with a setter)
 *   - a derived `isDirty` flag (deep-equality vs. the initial snapshot)
 *   - the SaveBar status machine (idle → saving → saved | error)
 *   - the actual save call (post body to `endpoint` with a `kind` discriminator)
 *
 * Panels stay declarative: build the form with `value` + `setValue`, drop
 * `<SaveBar {...form.saveBarProps} />` at the bottom, done.
 */

export type UseSettingsFormArgs<T> = {
  initial: T;
  /** Path to POST changes to. Body shape: `{ kind, data: value }`. */
  endpoint: string;
  /** Discriminator embedded in the request body. */
  kind: string;
};

export type UseSettingsFormResult<T> = {
  value: T;
  setValue: (next: T | ((prev: T) => T)) => void;
  isDirty: boolean;
  status: SaveStatus;
  errorMessage: string | null;
  save: () => Promise<void>;
  saveBarProps: {
    isDirty: boolean;
    status: SaveStatus;
    errorMessage: string;
    onSave: () => Promise<void>;
  };
};

export function useSettingsForm<T>({
  initial,
  endpoint,
  kind,
}: UseSettingsFormArgs<T>): UseSettingsFormResult<T> {
  // Snapshot the initial value as a JSON string and compare on every render.
  // The form schemas are plain JSON, so JSON.stringify is sufficient and
  // avoids pulling in a deep-equality dependency.
  const [initialSnapshot, setInitialSnapshot] = useState(() => JSON.stringify(initial));
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isDirty = useMemo(
    () => JSON.stringify(value) !== initialSnapshot,
    [value, initialSnapshot],
  );

  const save = useCallback(async () => {
    setStatus("saving");
    setErrorMessage(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, data: value }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok: true; publishWarning?: string }
        | { ok: false; error?: string }
        | null;
      if (!res.ok || !body || !body.ok) {
        const message =
          (body && "error" in body && body.error) || `Save failed (HTTP ${res.status})`;
        setErrorMessage(message);
        setStatus("error");
        return;
      }
      // Reset the snapshot to the saved value so the form goes back to
      // pristine; the user can keep editing afterward.
      setInitialSnapshot(JSON.stringify(value));
      setStatus("saved");
      if ("publishWarning" in body && body.publishWarning) {
        // Persisted locally but publish failed. Show as a non-blocking note —
        // the next save attempt will retry the publish.
        setErrorMessage(`Saved locally, publish warning: ${body.publishWarning}`);
      }
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : "Save failed");
      setStatus("error");
    }
  }, [endpoint, kind, value]);

  return {
    value,
    setValue,
    isDirty,
    status,
    errorMessage,
    save,
    saveBarProps: {
      isDirty,
      status,
      errorMessage: errorMessage ?? "",
      onSave: save,
    },
  };
}
