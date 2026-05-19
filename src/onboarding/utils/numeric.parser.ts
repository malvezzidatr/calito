export function parseDecimal(text: string): number | null {
  const cleaned = text.trim().replace(/[^\d.,]/g, '').replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseInteger(text: string): number | null {
  const n = parseDecimal(text);
  if (n === null) return null;
  return Number.isInteger(n) ? n : null;
}

export function parseHeightCm(text: string): number | null {
  const n = parseDecimal(text);
  if (n === null) return null;
  return n > 0 && n < 3 ? Math.round(n * 100) : n;
}
