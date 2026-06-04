export const INTENTS = [
  'register_meal',
  'query_daily',
  'query_period',
  'query_macro',
  'list_meals',
  'view_profile',
  'update_goal',
  'edit_meal',
  'delete_meal',
  'edit_last',
  'delete_last',
  'delete_account',
  'subscribe',
  'help',
  'greeting',
  'unknown',
] as const;

export type Intent = typeof INTENTS[number];

export const isIntent = (value: unknown): value is Intent =>
  typeof value === 'string' && (INTENTS as readonly string[]).includes(value);
