import { useEffect, useState } from 'react';

type ToastKind = 'success' | 'error' | 'info';

interface ToastData {
  message: string;
  kind: ToastKind;
}

let showToastFn: ((data: ToastData) => void) | null = null;

export function showToast(message: string, kind: ToastKind = 'info') {
  showToastFn?.({ message, kind });
}

const colors: Record<ToastKind, string> = {
  success: 'bg-success/15 text-success border-success/20',
  error: 'bg-danger/15 text-danger border-danger/20',
  info: 'bg-accent/15 text-accent border-accent/20',
};

export default function Toast() {
  const [toast, setToast] = useState<ToastData | null>(null);

  useEffect(() => {
    showToastFn = setToast;
    return () => { showToastFn = null; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-toast-in">
      <div className={`px-5 py-3 rounded-lg border text-sm font-medium shadow-lg ${colors[toast.kind]}`}>
        {toast.message}
      </div>
    </div>
  );
}
