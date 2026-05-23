import { Goals } from "./nutrition.calculator"
import { NutritionistGoalsExtraction } from "./nutritionist-goals.prompt"
import { NutritionistProfileExtraction } from "./nutritionist-profile.prompt"

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

export const NUTRITIONIST_CHOICE_QUESTION = `Antes de seguir, me conta uma coisa 🙂

Você já tem acompanhamento com nutricionista? (sim/não)`

export const NUTRITIONIST_GOALS_QUESTION = `Show! Pra usar a prescrição da sua nutri, me manda os 4 valores das metas diárias numa mensagem só 🎯

Ex: 2000 kcal, 150g de proteína, 200g de carbo, 60g de gordura`

export const NUTRITIONIST_PROFILE_QUESTION = `Agora me conta seus dados corporais numa mensagem só 📋

Ex: 70kg, 1.75m, 30 anos, masculino`

export const CONFIRM_INVALID = `Não entendi. Pra continuar preciso de "sim" ou "não". 🙂`

export const formatNutritionistGoalsConfirmation = (g: NutritionistGoalsExtraction) => `Anotei aqui:

🔥 Calorias: ${g.calorie} kcal
🥩 Proteína: ${g.protein}g
🍚 Carboidrato: ${g.carbs}g
🧈 Gordura: ${g.fat}g

Tá certo? (sim/não)`

export const formatNutritionistProfileConfirmation = (p: NutritionistProfileExtraction) => {
  const genderLabel = p.gender === 'MALE' ? 'masculino' : 'feminino'
  return `Anotei aqui:

⚖️ Peso: ${p.weight}kg
📏 Altura: ${p.height}cm
🎂 Idade: ${p.age} anos
👤 Sexo: ${genderLabel}

Tá certo? (sim/não)`
}

export const NUTRITIONIST_GOALS_REDO = `Tudo bem! Me manda de novo as metas que a nutri te passou 🙂

Ex: 2000 kcal, 150g de proteína, 200g de carbo, 60g de gordura`

export const NUTRITIONIST_PROFILE_REDO = `Tudo bem! Me manda de novo seus dados 🙂

Ex: 70kg, 1.75m, 30 anos, masculino`

export const NUTRITIONIST_GOALS_PARSE_ERROR = `Não consegui entender essa mensagem 🤔 Me manda de novo com os 4 valores juntos.

Ex: 2000 kcal, 150g de proteína, 200g de carbo, 60g de gordura`

export const NUTRITIONIST_PROFILE_PARSE_ERROR = `Não consegui entender essa mensagem 🤔 Me manda de novo com os 4 dados juntos.

Ex: 70kg, 1.75m, 30 anos, masculino`

export const nutritionistWelcomeMessage = (g: NutritionistGoalsExtraction) => `✓ Perfil configurado com a prescrição da sua nutri!

Suas metas diárias:
🔥 Calorias: ${g.calorie} kcal
🥩 Proteína: ${g.protein}g
🍚 Carboidrato: ${g.carbs}g
🧈 Gordura: ${g.fat}g

Você vai receber um resumo todo dia às 20h
com tudo que comeu e quanto falta pra meta.

Pra começar, é só me mandar o que comeu!

Bora! 💪`

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