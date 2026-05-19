import { ActivityLevel, Gender, Goal } from '@prisma/client';

function normalize(text: string): string {
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

function findAlias<T>(text: string, aliases: Record<string, T>): T | null {
  const normalized = normalize(text);
  if (!normalized) return null;

  const keys = Object.keys(aliases).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const pattern = new RegExp(`\\b${escapeRegex(key)}\\b`);
    if (pattern.test(normalized)) return aliases[key];
  }
  return null;
}

const GENDER_ALIASES: Record<string, Gender> = {
  m: 'MALE',
  masculino: 'MALE',
  homem: 'MALE',
  macho: 'MALE',
  cara: 'MALE',
  f: 'FEMALE',
  feminino: 'FEMALE',
  mulher: 'FEMALE',
  femea: 'FEMALE',
  moca: 'FEMALE',
  garota: 'FEMALE',
  menina: 'FEMALE',
};

const GOAL_ALIASES: Record<string, Goal> = {
  '1': 'LOSE',
  emagrecer: 'LOSE',
  emagrecimento: 'LOSE',
  emagrecendo: 'LOSE',
  perder: 'LOSE',
  perda: 'LOSE',
  magro: 'LOSE',
  magra: 'LOSE',
  magrelo: 'LOSE',
  magreza: 'LOSE',
  secar: 'LOSE',
  definir: 'LOSE',
  definicao: 'LOSE',
  queimar: 'LOSE',
  diminuir: 'LOSE',
  cutting: 'LOSE',
  cut: 'LOSE',
  '2': 'MAINTAIN',
  manter: 'MAINTAIN',
  manutencao: 'MAINTAIN',
  conservar: 'MAINTAIN',
  estavel: 'MAINTAIN',
  'mesmo peso': 'MAINTAIN',
  '3': 'GAIN',
  ganhar: 'GAIN',
  ganho: 'GAIN',
  engordar: 'GAIN',
  massa: 'GAIN',
  hipertrofia: 'GAIN',
  hipertrofiar: 'GAIN',
  musculo: 'GAIN',
  musculos: 'GAIN',
  encorpar: 'GAIN',
  aumentar: 'GAIN',
  bulking: 'GAIN',
  bulk: 'GAIN',
};

const ACTIVITY_ALIASES: Record<string, ActivityLevel> = {
  '1': 'SEDENTARY',
  sedentario: 'SEDENTARY',
  parado: 'SEDENTARY',
  '2': 'LIGHT',
  leve: 'LIGHT',
  pouco: 'LIGHT',
  fraco: 'LIGHT',
  '3': 'MODERATE',
  moderado: 'MODERATE',
  medio: 'MODERATE',
  normal: 'MODERATE',
  '4': 'INTENSE',
  intenso: 'INTENSE',
  bastante: 'INTENSE',
  forte: 'INTENSE',
  '5': 'VERY_INTENSE',
  'muito intenso': 'VERY_INTENSE',
};

export function matchGender(text: string): Gender | null {
  return findAlias(text, GENDER_ALIASES);
}

export function matchGoal(text: string): Goal | null {
  return findAlias(text, GOAL_ALIASES);
}

export function matchActivity(text: string): ActivityLevel | null {
  return findAlias(text, ACTIVITY_ALIASES);
}
