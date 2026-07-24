import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  accent?: boolean;
  accentColor?: 'accent' | 'success' | 'warning' | 'danger';
}

const accentBorders: Record<string, string> = {
  accent: 'border-l-accent',
  success: 'border-l-success',
  warning: 'border-l-warning',
  danger: 'border-l-danger',
};

export default function Card({ children, className = '', accent = false, accentColor = 'accent' }: CardProps) {
  const borderClass = accent
    ? accentColor === 'accent'
      ? 'border-t-3 border-t-accent'
      : `border-l-3 ${accentBorders[accentColor] || 'border-l-accent'}`
    : '';

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        borderClass
      } ${className}`}
    >
      {children}
    </div>
  );
}
