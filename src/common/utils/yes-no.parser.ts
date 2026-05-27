const YES_VARIANTS = new Set(['sim', 's', 'yes', 'y']);
const NO_VARIANTS  = new Set(['não', 'nao', 'n', 'no']);

export type YesNoAnswer = 'yes' | 'no' | null;

export function parseYesNo(text: string): YesNoAnswer {
  const normalized = text.trim().toLowerCase();
  if (YES_VARIANTS.has(normalized)) return 'yes';
  if (NO_VARIANTS.has(normalized))  return 'no';
  return null;
}
