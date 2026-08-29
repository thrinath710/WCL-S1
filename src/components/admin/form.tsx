'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { ActionResult } from '@/lib/actions/shared';

type ServerAction = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

/**
 * A form bound to a Server Action.
 *
 * Submitting re-renders the affected Server Components in place -- no page
 * reload, no lost scroll position, which is what makes entering a result on a
 * phone at the side of a pitch bearable.
 */
export function ActionForm({
  action,
  children,
  className = '',
  resetOnSuccess = false,
  confirm,
  onSuccess,
}: {
  action: ServerAction;
  children: React.ReactNode;
  className?: string;
  /** Clears the form after a successful save -- for "add another" forms. */
  resetOnSuccess?: boolean;
  /** Shown in a confirmation prompt before anything is sent. */
  confirm?: string;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const lastHandled = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (!state || state === lastHandled.current) return;
    lastHandled.current = state;
    if (state.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
  }, [state, resetOnSuccess, onSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {children}
      <ActionMessage state={state} />
    </form>
  );
}

export function ActionMessage({ state }: { state: ActionResult | null }) {
  if (!state) return null;

  if (!state.ok) {
    return (
      <p
        role="alert"
        className="mt-2 rounded-lg border border-red-card/50 bg-red-card/10 px-3 py-2 text-xs font-medium text-red-card"
      >
        {state.error}
      </p>
    );
  }

  return (
    <>
      {state.message ? (
        <p
          role="status"
          className="mt-2 rounded-lg border border-pitch-dim bg-pitch-glow px-3 py-2 text-xs font-medium text-pitch"
        >
          {state.message}
        </p>
      ) : null}
      {state.warning ? (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-yellow-card/50 bg-yellow-card/10 px-3 py-2 text-xs font-medium text-yellow-card"
        >
          {state.warning}
        </p>
      ) : null}
    </>
  );
}

/** Every tap target here is at least 44px tall. */
export function SubmitButton({
  children,
  tone = 'primary',
  className = '',
  size = 'md',
  disabled = false,
}: {
  children: React.ReactNode;
  tone?: 'primary' | 'ghost' | 'danger';
  className?: string;
  size?: 'md' | 'lg';
  /** For a button with nothing to do -- a reset on a day with no results. */
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const tones = {
    primary:
      'bg-pitch text-ink hover:bg-pitch-bright disabled:bg-pitch/50 shadow-[0_0_20px_var(--color-pitch-glow)]',
    ghost: 'border border-line-bright bg-surface-2 text-chalk hover:border-pitch-dim',
    danger: 'border border-red-card/50 bg-red-card/10 text-red-card hover:bg-red-card/20',
  } as const;
  const sizes = { md: 'min-h-[2.75rem] px-4 text-sm', lg: 'min-h-[3.25rem] px-5 text-base' };

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-bold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-45 ${tones[tone]} ${sizes[size]} ${className}`}
    >
      {pending ? <Spinner /> : null}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.68rem] font-bold uppercase tracking-[0.11em] text-muted">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[0.68rem] text-faint">{hint}</span> : null}
    </label>
  );
}

const CONTROL =
  'w-full min-h-[2.75rem] rounded-xl border border-line-bright bg-surface-2 px-3 text-sm text-chalk transition-colors duration-200 placeholder:text-faint hover:border-line-bright focus:border-pitch focus:outline-none';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CONTROL} ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${CONTROL} appearance-none pr-8 ${props.className ?? ''}`}>
      {props.children}
    </select>
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${CONTROL} min-h-[5rem] py-2 leading-relaxed ${props.className ?? ''}`}
    />
  );
}

/** Radio group styled as a segmented control, for status and card type. */
export function Segmented({
  name,
  options,
  defaultValue,
  onChange,
  columns,
}: {
  name: string;
  options: { value: string; label: string }[];
  defaultValue: string;
  onChange?: (value: string) => void;
  /** Defaults to two columns on a phone, one per option above that. */
  columns?: 2 | 4;
}) {
  const [value, setValue] = useState(defaultValue);
  // After a save the server may hand back a different value. Adjusting state
  // during render is React's recommended way to react to a changed prop --
  // doing it in an effect would render twice for no reason.
  const [lastDefault, setLastDefault] = useState(defaultValue);
  if (defaultValue !== lastDefault) {
    setLastDefault(defaultValue);
    setValue(defaultValue);
  }

  return (
    <div
      role="radiogroup"
      className={`grid gap-1.5 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-2 xs:grid-cols-4'}`}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <label
            key={option.value}
            className={`flex min-h-[2.75rem] cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-xs font-bold transition-all duration-200 ${
              active
                ? 'border-pitch bg-pitch text-ink shadow-[0_0_16px_var(--color-pitch-glow)]'
                : 'border-line-bright bg-surface-2 text-muted hover:border-pitch-dim hover:text-chalk'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={active}
              onChange={() => {
                setValue(option.value);
                onChange?.(option.value);
              }}
              className="sr-only"
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}

/** A one-button form, for deletes and toggles. Always confirms first. */
export function InlineAction({
  action,
  id,
  confirm,
  children,
  tone = 'danger',
}: {
  action: ServerAction;
  id: string;
  confirm: string;
  children: React.ReactNode;
  tone?: 'primary' | 'ghost' | 'danger';
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(confirm)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton tone={tone} className="px-3">
        {children}
      </SubmitButton>
      {state && !state.ok ? (
        <span role="alert" className="ml-2 text-xs text-red-card">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
