import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const inputBase =
  'w-full mt-1.5 px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-sm placeholder:text-slate-400 transition-colors duration-150 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 hover:border-slate-400';

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <label className="block text-sm text-slate-500 font-medium">
      {label}
      <input className={`${inputBase} ${error ? 'border-red-500' : ''} ${className}`} {...props} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </label>
  );
}

export function Textarea({ label, error, className = '', ...props }: TextareaProps) {
  return (
    <label className="block text-sm text-slate-500 font-medium">
      {label}
      <textarea
        className={`${inputBase} resize-y min-h-[80px] ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </label>
  );
}
