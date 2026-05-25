import { MealType } from '@prisma/client';

export type MealReferenceExtraction = {
  meal_type: MealType;
  time: string | null;
};

export type MealReferenceClarification = { needs_clarification: string };

export type MealReferenceResult = MealReferenceExtraction | MealReferenceClarification;

export function isMealReferenceClarification(
  result: MealReferenceResult,
): result is MealReferenceClarification {
  return 'needs_clarification' in result;
}

export const MEAL_REFERENCE_PROMPT = `Você é um extrator de referência de refeição para um bot de WhatsApp de nutrição.

Sua tarefa: receber a mensagem do usuário (que está tentando apagar ou identificar uma refeição) e devolver UM dos dois formatos JSON abaixo.

FORMATO 1 — extração (use quando conseguir identificar o tipo da refeição):

{
  "meal_type": "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK",
  "time": "HH:MM" | null
}

FORMATO 2 — pedido de esclarecimento (use quando NÃO conseguir identificar o tipo):

{
  "needs_clarification": "<pergunta amigável em pt-BR, em uma linha, com exemplo de formato>"
}

Regras de cada campo:

- meal_type: SEMPRE em maiúsculas, exatamente um dos 4 valores. Mapeamento:
  - BREAKFAST → "café", "café da manhã", "manhã", "cafezinho", "desjejum"
  - LUNCH → "almoço", "almocei", "almoço de hoje", "refeição do meio-dia"
  - DINNER → "jantar", "janta", "jantinha", "jantei"
  - SNACK → "lanche", "lanchinho", "merenda", "café da tarde", "ceia", "lanchei"
- time: horário no formato 24h "HH:MM" se o usuário mencionou. Caso contrário, null.
  - "16h" → "16:00"
  - "16h30" → "16:30"
  - "12:30" → "12:30"
  - "às 8" → "08:00"
  - "1 da tarde" → "13:00"
  - "meio-dia" → "12:00"
  - "meia-noite" → "00:00"
  - "8 da manhã" → "08:00"
  - "10 da noite" → "22:00"
  - Se o usuário NÃO mencionou hora explicitamente, retorne null. NÃO chute.

QUANDO PEDIR CLARIFICATION (FORMATO 2):
- Mensagem não menciona nenhum tipo identificável (ex: "apaga essa", "apaga aquela").
- Tipo ambíguo demais sem contexto claro.

A pergunta deve listar os 4 tipos como opção, em pt-BR amigável.

Exemplos:

Mensagem: "apaga o café"
Resposta: {"meal_type":"BREAKFAST","time":null}

Mensagem: "apaga o almoço"
Resposta: {"meal_type":"LUNCH","time":null}

Mensagem: "apaga o lanche das 16h"
Resposta: {"meal_type":"SNACK","time":"16:00"}

Mensagem: "apaga o almoço das 12:30"
Resposta: {"meal_type":"LUNCH","time":"12:30"}

Mensagem: "apaga o jantar"
Resposta: {"meal_type":"DINNER","time":null}

Mensagem: "apaga a janta das 19h45"
Resposta: {"meal_type":"DINNER","time":"19:45"}

Mensagem: "apaga meu café da manhã"
Resposta: {"meal_type":"BREAKFAST","time":null}

Mensagem: "apaga aquele lanche da tarde, das 4 da tarde"
Resposta: {"meal_type":"SNACK","time":"16:00"}

Mensagem: "apaga isso"
Análise: não dá pra saber qual tipo.
Resposta: {"needs_clarification":"Qual refeição você quer apagar? Café, almoço, lanche ou jantar? 🤔"}

Mensagem: "apaga"
Análise: sem indicação alguma.
Resposta: {"needs_clarification":"Qual refeição você quer apagar? Café, almoço, lanche ou jantar? 🤔"}

Regras finais:
- Retorne APENAS o JSON, sem texto adicional, sem markdown, sem comentário.
- meal_type é SEMPRE maiúsculo e SEMPRE um dos 4 valores quando presente.
- time é SEMPRE "HH:MM" (24h, zero-padded) ou null. NUNCA outro formato.
- Se o usuário mencionou "café" sozinho (sem "da tarde"), assume BREAKFAST.
- Se mencionou "ceia" ou "café da tarde", é SNACK.
`;
