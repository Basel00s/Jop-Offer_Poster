import type { ReactNode } from 'react';

interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  emptySub?: string;
}

export default function Table<T>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No data yet.',
  emptySub = '',
}: TableProps<T>) {
  if (!data.length) {
    return (
      <div className="text-center py-16 px-8 border border-dashed border-slate-200 rounded-xl bg-white text-slate-500 animate-fade-in">
        <p className="text-sm">{emptyMessage}</p>
        {emptySub && <p className="text-xs mt-1 opacity-70">{emptySub}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-fade-in">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`text-left px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 ${
                  col.className || ''
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(item)}
              className={`border-b border-slate-200 last:border-b-0 transition-colors duration-100 ${
                onRowClick ? 'cursor-pointer' : ''
              } hover:bg-slate-50 animate-stagger-fade`}
              style={{ animationDelay: `${i * 30}ms` }}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-5 py-3.5 text-sm text-slate-900 ${col.className || ''}`}
                >
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
