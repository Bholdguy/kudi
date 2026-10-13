"use client";

import { useState } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { config } from "@/lib/config";
import { loadState, saveState } from "@/lib/store";

function validate(raw: string): string | null {
  const length = raw.trim().length;
  if (length < 1) return "Enter the name your clients should see.";
  if (length > config.displayNameMaxLength) {
    return `Keep it to ${config.displayNameMaxLength} characters or fewer.`;
  }
  return null;
}

/** The name shown on every invoice. Used for first-time setup and for changing it later. */
export default function NameForm({
  initial,
  submitLabel,
  onDone,
  onCancel,
}: {
  initial: string;
  submitLabel: string;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const problem = validate(value);
    setError(problem);
    if (problem !== null) return;
    const current = loadState();
    if (!current) return;
    saveState({ ...current, displayName: value.trim() });
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field
        id="display-name"
        label="Your name on invoices"
        hint="Clients see this on every invoice you send."
        error={error}
      >
        {(fieldProps) => (
          <input
            {...fieldProps}
            type="text"
            value={value}
            maxLength={config.displayNameMaxLength}
            autoComplete="name"
            onChange={(e) => {
              setValue(e.target.value);
              setTouched(true);
              if (error) setError(null);
            }}
            onBlur={() => {
              if (touched) setError(validate(value));
            }}
            className={`${inputClass} ${error ? "border-clay" : "border-line"}`}
          />
        )}
      </Field>
      <div className="flex flex-wrap gap-3">
        <Button type="submit">{submitLabel}</Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
