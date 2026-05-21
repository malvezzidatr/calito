export type Macro = 'calorie' | 'protein' | 'carbs' | 'fat';

const MACRO_PATTERNS: Array<{ macro: Macro; regex: RegExp }> = [
  { macro: 'protein', regex: /prote[ií]na/i },
  { macro: 'carbs',   regex: /carboidrato|carbo/i },
  { macro: 'fat',     regex: /gordura/i },
  { macro: 'calorie', regex: /caloria|kcal/i },
];

export function detectMacro(text: string): Macro | null {
  for (const { macro, regex } of MACRO_PATTERNS) {
    if (regex.test(text)) return macro;
  }
  return null;
}
