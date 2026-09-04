export type SearchableOption = {
  value: string;
  label: string;
  hint?: string;
};

export function filterSearchableOptions(options: SearchableOption[], q: string): SearchableOption[] {
  const term = q.trim().toLowerCase();
  if (!term) return options;
  return options.filter((o) => {
    const hay = `${o.label} ${o.hint || ''}`.toLowerCase();
    return hay.includes(term);
  });
}
