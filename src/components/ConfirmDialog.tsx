import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" pinta o botão de confirmação em rosa; "warning" em âmbar */
  variant?: 'danger' | 'warning';
}

interface ConfirmDialogProps extends ConfirmOptions {
  onConfirm: () => void;
  onCancel: () => void;
}

const CONFIRM_BUTTON_STYLES: Record<NonNullable<ConfirmOptions['variant']>, string> = {
  danger: 'bg-rose-600 hover:bg-rose-500',
  warning: 'bg-amber-600 hover:bg-amber-500',
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Foco inicial no botão seguro e fechamento com Esc
  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const iconColor = variant === 'danger' ? 'text-rose-400 bg-rose-500/15' : 'text-amber-400 bg-amber-500/15';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onClick={(e) => e.stopPropagation()}
        className="glass-card bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-5"
      >
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl shrink-0 ${iconColor}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <h3 id="confirm-dialog-title" className="text-sm font-bold text-slate-100">
              {title}
            </h3>
            <p id="confirm-dialog-message" className="text-xs text-slate-400 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-2 rounded-xl text-white text-xs font-semibold transition active:scale-95 ${CONFIRM_BUTTON_STYLES[variant]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Substitui o confirm() nativo (que trava a interface).
 * Uso: const { confirm, dialog } = useConfirm(); ... if (!(await confirm({...}))) return; ... e renderize {dialog}.
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((result: boolean) => void) | null>(null);

  const settle = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    // Se já houver um diálogo aberto, ele é considerado cancelado
    resolverRef.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOptions(opts);
    });
  }, []);

  const handleConfirm = useCallback(() => settle(true), [settle]);
  const handleCancel = useCallback(() => settle(false), [settle]);

  const dialog = options ? (
    <ConfirmDialog {...options} onConfirm={handleConfirm} onCancel={handleCancel} />
  ) : null;

  return { confirm, dialog };
}
