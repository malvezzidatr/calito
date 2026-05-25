import { ParsedFood } from './meal.parser.prompt';

const VERB_PREFIX_PATTERN = /^(eu\s+)?(comi|comer|comendo|almocei|almoçar|almocar|jantei|jantar|lanchei|lanchar|tomei|tomar|bebi|beber|consumi|consumir)\b\s*/i;

export function stripMealVerbs(text: string): string {
  return text.replace(VERB_PREFIX_PATTERN, '').trim();
}

export function describeFromFoods(foods: ParsedFood[]): string {
  return foods.map((f) => `${formatQty(f.quantity)} ${f.food}`).join(', ');
}

function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(n < 1 ? 1 : 2).replace(/\.?0+$/, '');
}
