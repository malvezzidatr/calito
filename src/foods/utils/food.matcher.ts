import { FoodEntry } from './food.types';

export type MatchConfidence = 'exact' | 'partial';

export type MatchResult = {
  food: FoodEntry;
  confidence: MatchConfidence;
  matched_alias: string;
};

export function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsWordPhrase(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const pattern = new RegExp(`(?:^|\\s)${escapeRegex(needle)}(?:\\s|$)`);
  return pattern.test(haystack);
}

export function matchFood(input: string, catalog: FoodEntry[]): MatchResult | null {
  const normalizedInput = normalize(input);
  if (!normalizedInput) return null;

  for (const food of catalog) {
    for (const alias of food.aliases) {
      if (normalize(alias) === normalizedInput) {
        return { food, confidence: 'exact', matched_alias: alias };
      }
    }
  }

  type Candidate = { food: FoodEntry; alias: string; length: number };
  const candidates: Candidate[] = [];

  for (const food of catalog) {
    for (const alias of food.aliases) {
      const normalizedAlias = normalize(alias);
      if (!normalizedAlias) continue;
      if (containsWordPhrase(normalizedInput, normalizedAlias)) {
        candidates.push({ food, alias, length: normalizedAlias.length });
      }
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.length - a.length);
  const best = candidates[0];
  return { food: best.food, confidence: 'partial', matched_alias: best.alias };
}
