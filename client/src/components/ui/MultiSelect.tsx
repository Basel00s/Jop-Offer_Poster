interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  emptyLabel?: string;
}

export default function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select...',
  emptyLabel,
}: MultiSelectProps) {
  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  if (!options.length && emptyLabel) {
    return (
      <div className="min-h-[160px] rounded-lg border border-border bg-bg-600 p-4 flex items-center justify-center">
        <p className="text-sm text-text-muted">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((value) => {
            const opt = options.find((o) => o.value === value);
            if (!opt) return null;
            return (
              <span
                key={value}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-accent/15 text-accent"
              >
                {opt.label}
                <button
                  type="button"
                  onClick={() => handleToggle(value)}
                  className="hover:text-white transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div className="min-h-[160px] rounded-lg border border-border bg-bg-600 overflow-hidden">
        {!options.length && (
          <div className="flex items-center justify-center h-full min-h-[160px]">
            <p className="text-sm text-text-muted">{placeholder}</p>
          </div>
        )}
        <div className="max-h-[220px] overflow-y-auto">
          {options.map((opt) => {
            const isSelected = selected.includes(opt.value);
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition-colors text-sm ${
                  isSelected
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-primary hover:bg-white/[0.03]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggle(opt.value)}
                  className="w-4 h-4 rounded border-border bg-bg-500 accent-accent"
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
