import { Goals } from "./nutrition.calculator"

export const LGPD_MESSAGE = `Olá! 👋 Sou o Calito, seu parceiro de nutrição!

Antes de começar, preciso te informar:
• Coletamos seu telefone, dados corporais (peso, altura, idade, sexo), refeições e metas
• São usados apenas para calcular calorias, macros e acompanhar seu progresso
• Ficam armazenados de forma segura e nunca são compartilhados com terceiros
• Você pode pedir pra apagar tudo a qualquer momento
• Este bot NÃO substitui orientação de um nutricionista

Ao continuar, você concorda com isso.
Quer prosseguir? Responda com "sim" ou "não".
`

export const GOAL_QUESTION = `Show! Vamos configurar seu perfil pra calcular suas metas 🎯

Qual seu objetivo?
1 - Emagrecer
2 - Manter o peso
3 - Ganhar massa
`

export const CONSENT_FAREWELL = `Tudo bem! Sem consentimento não consigo seguir.
Se mudar de ideia, é só me chamar de novo. 👋
`

export const CONSENT_INVALID = `Não entendi. Pra continuar preciso de "sim" ou "não". 🙂`

export const GOAL_IS_LOSE = `Então vamos focar em emagrecer! 🙂
Para isso precisamos diminuir um pouco a meta calórica diária
`
export const GOAL_IS_MAINTAIN = `Então vamos focar em manter! 🙂
Para isso vamos manter a quantidade de calorias normalmente
`
export const GOAL_IS_GAIN = `Então vamos focar em ganhar massa! 🙂
Para isso precisamos aumentar um pouco a quantidade de calorias
`

export const WEIGHT_QUESTION = `Beleza! Agora preciso de alguns dados:
Qual seu peso? (em kg)`

export const HEIGHT_QUESTION = `Sua altura? (em cm)`

export const AGE_QUESTION = `Sua idade?`

export const GENDER_QUESTION = `Sexo biológico? (M/F)`;

export const ACTIVITY_QUESTION = `E qual seu nível de atividade?
1 - Sedentário (não treina)
2 - Leve (1-3x por semana)
3 - Moderado (3-5x por semana)
4 - Intenso (6-7x por semana)
5 - Muito intenso (2x por dia)
`;

export const INVALID_OPTION = `Opção inválida. Vamos de novo:`

export const welcomeMessage = (goals: Goals) => `✓ Perfil configurado!

Suas metas diárias:
🔥 Calorias: ${goals.calorie_goal} kcal
🥩 Proteína: ${goals.protein_goal}g
🍚 Carboidrato: ${goals.carbs_goal}g
🧈 Gordura: ${goals.fat_goal}g

Você vai receber um resumo todo dia às 20h
com tudo que comeu e quanto falta pra meta.

Pra começar, é só me mandar o que comeu!

Bora! 💪`;