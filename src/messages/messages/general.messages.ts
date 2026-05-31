/**
 * MANUTENÇÃO: este arquivo lista APENAS o que já está implementado.
 * Toda HU nova de feature precisa atualizar HELP_MESSAGE e UNKNOWN_VARIANTS.
 * Não listar features futuras (assinatura, update_goal, delete_account) — quebra confiança do usuário.
 */

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
