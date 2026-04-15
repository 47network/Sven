'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

type Variant = 'danger' | 'warning' | 'info';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  /** When set, user must type this exact string to enable the confirm button. */
  confirmPhrase?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  /** When true, shows a text input and passes its value to onConfirm. */
  prompt?: boolean;
  promptLabel?: string;
  promptDefault?: string;
  onConfirm: (value?: string) => void;
  onCancel: () => void;
}

const variantStyles: Record<Variant, { icon: string; button: string }> = {
  danger: {
    icon: 'text-red-400',
    button: 'btn-danger',
  },
  warning: {
    icon: 'text-amber-400',
    button: 'btn-primary',
  },
  info: {
    icon: 'text-cyan-400',
    button: 'btn-primary',
  },
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmPhrase,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  prompt,
  promptLabel,
  promptDefault = '',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typedPhrase, setTypedPhrase] = useState('');
  const [promptValue, setPromptValue] = useState(promptDefault);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      setTimeout(() => inputRef.current?.focus(), 0);
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setTypedPhrase('');
      setPromptValue(promptDefault);
    }
  }, [open, promptDefault]);

  const phraseMatch = !confirmPhrase || typedPhrase === confirmPhrase;
  const promptValid = !prompt || promptValue.trim().length > 0;
  const canConfirm = phraseMatch && promptValid;

  const handleConfirm = useCallback(() => {
    if (!canConfirm) return;
    onConfirm(prompt ? promptValue.trim() : undefined);
  }, [canConfirm, onConfirm, prompt, promptValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && canConfirm) {
        e.preventDefault();
        handleConfirm();
      }
    },
    [canConfirm, handleConfirm],
  );

  const styles = variantStyles[variant];

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-auto max-w-md rounded-xl border border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      onCancel={onCancel}
      onKeyDown={handleKeyDown}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-desc"
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 ${styles.icon}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 id="confirm-title" className="text-lg font-semibold">{title}</h2>
            <p id="confirm-desc" className="mt-1 text-sm text-slate-400">{description}</p>
          </div>
          <button onClick={onCancel} className="btn-ghost rounded-lg p-1" aria-label="Close dialog">
            <X className="h-4 w-4" />
          </button>
        </div>

        {confirmPhrase && (
          <div className="mt-4">
            <label className="block text-sm text-slate-400">
              Type <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs font-mono text-cyan-300">{confirmPhrase}</code> to confirm
            </label>
            <input
              ref={!prompt ? inputRef : undefined}
              className="input mt-2 w-full"
              value={typedPhrase}
              onChange={(e) => setTypedPhrase(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        )}

        {prompt && (
          <div className="mt-4">
            {promptLabel && <label className="block text-sm text-slate-400">{promptLabel}</label>}
            <input
              ref={inputRef}
              className="input mt-2 w-full"
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-6 py-4">
        <button className="btn-secondary btn-sm" onClick={onCancel}>{cancelLabel}</button>
        <button className={`${styles.button} btn-sm`} disabled={!canConfirm} onClick={handleConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

/* ── Hook for ergonomic imperative usage ─────────────────────────── */

type ConfirmOptions = Omit<ConfirmDialogProps, 'open' | 'onConfirm' | 'onCancel'>;

export function useConfirm() {
  const [state, setState] = useState<{
    options: ConfirmOptions;
    resolve: (value: string | false) => void;
  } | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<string | false> => {
    return new Promise((resolve) => {
      setState({ options, resolve });
    });
  }, []);

  const handleConfirm = useCallback((value?: string) => {
    state?.resolve(value ?? 'confirmed');
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    state?.resolve(false);
    setState(null);
  }, [state]);

  const dialog = state ? (
    <ConfirmDialog
      open
      {...state.options}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { confirm, dialog };
}
