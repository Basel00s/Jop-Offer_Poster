import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const base =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-50 disabled:pointer-events-none select-none';

const variants: Record<Variant, string> = {
  primary:
    'bg-violet-600 text-white hover:bg-violet-700 active:scale-[0.97]',
  secondary:
    'bg-white text-slate-900 border border-slate-200 hover:border-violet-400 hover:text-violet-700 hover:bg-violet-50 active:scale-[0.97]',
  danger:
    'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 active:scale-[0.97]',
  ghost:
    'text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-[0.97]',
};

export default function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
