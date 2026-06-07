/**
 * MANUTENÇÃO: este arquivo lista APENAS o que já está implementado.
 * Toda HU nova de feature precisa atualizar HELP_MESSAGE e UNKNOWN_VARIANTS.
 * Não listar features futuras (assinatura, update_goal, delete_account) — quebra confiança do usuário.
 */

import { Goal } from '@prisma/client';

type GoalTargets = {
  calorie_goal: number;
  protein_goal: number;
  carbs_goal: number;
  fat_goal: number;
};

export type GreetingBucket = 'dawn' | 'morning' | 'afternoon' | 'evening';

export const GREETING_VARIANTS_BY_BUCKET: Record<GreetingBucket, readonly string[]> = {
  dawn: [
    'Ainda acordado? Manda o que comeu que eu anoto 🌙',
    'Olá! Madrugada hein? Bora registrar 💪',
    'E aí! Tarde da noite, manda aí o que vai comer 🌃',
  ],
  morning: [
    'Bom dia! Manda o que comeu hoje 💪',
    'E aí, bom dia! Bora começar registrando o café? ☕',
    'Bom dia! Como tá indo? Me conta o que já comeu hoje 🌅',
    'Bom diaaa! Pronto pra fechar o dia dentro da meta? 🔥',
  ],
  afternoon: [
    'Boa tarde! Como tá o dia? Manda as refeições 💪',
    'E aí, boa tarde! Já registrou o almoço? 🍽️',
    'Boa tarde! Bora atualizar o registro do dia? 📋',
    'Boa tarde! Tô aqui pra anotar o que comeu 🙌',
  ],
  evening: [
    'Boa noite! Como foi o dia? Manda o que comeu 🌙',
    'E aí, boa noite! Já registrou o jantar? 🍝',
    'Boa noite! Bora fechar o dia com os registros? 💪',
    'Boa noite! Conta aí pra mim, como tá indo? ✨',
  ],
} as const;

export const DELETE_ACCOUNT_CONFIRMATION_QUESTION = [
  '⚠️ Quer mesmo apagar sua conta?',
  '',
  'Isso vai remover TODOS os seus dados (refeições, metas, perfil) e não tem como voltar atrás 😔',
  '',
  'Pra confirmar, responda exatamente com: *apagar tudo*',
  'Qualquer outra resposta cancela.',
].join('\n');

export const DELETE_ACCOUNT_SUCCESS = [
  'Pronto, sua conta e todos os dados foram apagados 👋',
  '',
  'Sentirei sua falta! Se mudar de ideia, é só me mandar "oi" que a gente recomeça do zero 🙂',
].join('\n');

export const DELETE_ACCOUNT_CANCELLED = 'Beleza, cancelei a exclusão. Seus dados continuam aqui 🙂';

export const DELETE_ACCOUNT_TECH_ERROR = 'Tive um problema técnico ao apagar 😬 Pode tentar de novo daqui a pouquinho?';

const GOAL_LABELS: Record<Goal, string> = {
  LOSE: 'emagrecer',
  MAINTAIN: 'manter o peso',
  GAIN: 'ganhar massa',
};

export const UPDATE_GOAL_QUESTION = [
  '🎯 Qual seu novo objetivo?',
  '',
  'Me diz um deles:',
  '• *emagrecer*',
  '• *manter* o peso',
  '• *ganhar massa*',
].join('\n');

export const UPDATE_GOAL_NEEDS_PROFILE =
  'Pra recalcular suas metas eu preciso do seu perfil completo (peso, altura, idade, sexo e nível de atividade), mas tá faltando algum dado 😕 Manda "oi" pra gente refazer seu cadastro.';

export const UPDATE_GOAL_TECH_ERROR = 'Tive um problema técnico ao atualizar seu objetivo 😬 Pode tentar de novo daqui a pouquinho?';

export function formatUpdateGoalSuccess(goal: Goal, goals: GoalTargets): string {
  return [
    `Pronto! Atualizei seu objetivo pra *${GOAL_LABELS[goal]}* 🎯`,
    '',
    'Suas novas metas diárias:',
    `🔥 ${goals.calorie_goal.toLocaleString('pt-BR')} kcal`,
    `🥩 ${goals.protein_goal}g de proteína`,
    `🍚 ${goals.carbs_goal}g de carboidrato`,
    `🧈 ${goals.fat_goal}g de gordura`,
  ].join('\n');
}

type ProfileView = {
  weight: number | null;
  height: number | null;
  age: number | null;
  goal: Goal | null;
  calorie_goal: number | null;
  protein_goal: number | null;
  carbs_goal: number | null;
  fat_goal: number | null;
};

export function formatProfile(profile: ProfileView): string {
  const lines: string[] = [
    '👤 Seu perfil',
    '',
    `⚖️ Peso: ${profile.weight !== null ? `${profile.weight} kg` : 'não informado'}`,
    `📏 Altura: ${profile.height !== null ? `${profile.height} cm` : 'não informada'}`,
    `🎂 Idade: ${profile.age !== null ? `${profile.age} anos` : 'não informada'}`,
    `🎯 Objetivo: ${profile.goal !== null ? GOAL_LABELS[profile.goal] : 'não definido'}`,
  ];

  if (profile.calorie_goal !== null) {
    lines.push(
      '',
      'Metas diárias:',
      `🔥 ${profile.calorie_goal.toLocaleString('pt-BR')} kcal`,
      `🥩 ${profile.protein_goal ?? 0}g de proteína`,
      `🍚 ${profile.carbs_goal ?? 0}g de carboidrato`,
      `🧈 ${profile.fat_goal ?? 0}g de gordura`,
    );
  } else {
    lines.push('', 'Suas metas ainda não foram definidas. Manda "oi" pra gente fechar seu cadastro 💪');
  }

  return lines.join('\n');
}

export const UPDATE_WEIGHT_QUESTION = '⚖️ Qual seu peso atual? Me manda em kg (ex.: 75)';

export const UPDATE_WEIGHT_TECH_ERROR = 'Tive um problema técnico ao atualizar seu peso 😬 Pode tentar de novo daqui a pouquinho?';

export function formatWeightUpdateSuccess(weight: number, goals: GoalTargets): string {
  return [
    `Pronto! Atualizei seu peso pra *${weight} kg* ⚖️`,
    '',
    'Recalculei suas metas diárias:',
    `🔥 ${goals.calorie_goal.toLocaleString('pt-BR')} kcal`,
    `🥩 ${goals.protein_goal}g de proteína`,
    `🍚 ${goals.carbs_goal}g de carboidrato`,
    `🧈 ${goals.fat_goal}g de gordura`,
  ].join('\n');
}

export function formatWeightSavedNoRecalc(weight: number): string {
  return `Salvei seu novo peso (*${weight} kg*) ⚖️ Mas pra recalcular as metas eu preciso do seu perfil completo (altura, idade, sexo, atividade e objetivo). Manda "oi" pra gente fechar o cadastro 💪`;
}

export const THANKS_VARIANTS = [
  'De nada! Tô aqui pra ajudar 💪',
  'Imagina! Bora continuar firme 🔥',
  'É nóis! 💪',
  'Disponha! 😊',
] as const;

export const UNKNOWN_VARIANTS = [
  [
    '🤔 Não entendi muito bem. Posso te ajudar com:',
    '',
    '🍽️ Registrar: "comi 2 ovos e 1 banana"',
    '📊 Consultar: "como foi meu dia?"',
    '📋 Listar: "lista as refeições"',
    '✏️ Editar: "era 1 ovo, não 2"',
    '',
    'Tenta de novo do seu jeito 💪',
  ].join('\n'),
  [
    '🤔 Não rolou — posso te ajudar com refeições.',
    '',
    'Manda assim:',
    '• Pra registrar: "comi pão com manteiga"',
    '• Pra consultar: "quanto comi hoje?"',
    '• Pra corrigir: "apaga o último"',
    '',
    'Se quiser ver tudo, é só mandar "ajuda" 🙂',
  ].join('\n'),
  [
    '🤔 Hmm, não entendi. As coisas que sei fazer:',
    '',
    '🍽️ Registrar refeições',
    '📊 Consultar dia/semana/macro',
    '📋 Listar o que comeu hoje',
    '✏️ Editar ou apagar registros',
    '',
    'Ex: "almocei arroz e frango" ou "quanto comi hoje"',
  ].join('\n'),
] as const;

export const HELP_MESSAGE = [
  '👋 Eu sou o Calito, seu parceiro de nutrição. Veja o que eu já sei fazer:',
  '',
  '🍽️ *Registrar refeições*',
  'Manda o que comeu, eu calculo calorias e macros:',
  '• "comi 2 ovos e 1 banana"',
  '• "almocei arroz, feijão e frango"',
  '',
  '📊 *Consultar o dia ou a semana*',
  '• "como foi meu dia?"',
  '• "quanto comi hoje?"',
  '• "como foi minha semana?"',
  '• "quanta proteína comi hoje?"',
  '',
  '📋 *Listar refeições do dia*',
  '• "lista o que comi hoje"',
  '• "mostra as refeições"',
  '',
  '✏️ *Editar ou apagar refeição*',
  '• "era 1 ovo, não 2" (corrige a última)',
  '• "apaga o último"',
  '• "corrige meu almoço pra carne com salada"',
  '• "apaga o lanche das 16h"',
  '',
  'É só mandar do seu jeito que eu te entendo 💪',
].join('\n');
