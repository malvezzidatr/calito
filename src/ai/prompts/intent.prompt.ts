export const INTENT_CLASSIFIER_PROMPT = `Classify a Portuguese WhatsApp message into ONE intent. Reply: {"intent":"<name>"}

Intents (with pt-BR examples):
- register_meal: user logs food/drink. ALWAYS this when message has a consumption verb ("comi","comer","jantei","jantar","almocei","almoçar","lanchei","lanchar","tomei","tomar","consumi","bebi","beber") followed by ANY food — even exotic/regional/unknown names. Ex: "comi 2 ovos", "jantei lanche gourmet de frango", "comi pizza de costela", "tomei açaí na tigela", "lanchei queijo coalho".
- query_daily: today's totals. Ex: "quanto comi hoje?"
- query_period: multi-day totals. Ex: "como foi minha semana?"
- query_macro: a single macro for today. Ex: "quanta proteína comi hoje?"
- query_food: ask calories/macros of a food WITHOUT registering it. Ex: "quantas calorias tem uma banana?", "calorias de 100g de frango", "quanto tem de proteína no ovo?", "qual o valor nutricional da aveia?"
- list_meals: detailed list of today's meals (each with time). Ex: "lista minhas refeições", "detalha o que comi"
- view_profile: show the user's own profile/targets (weight, height, goal, daily targets) — NOT consumed food. Ex: "meu perfil", "meus dados", "quais são minhas metas?"
- update_goal: change goal. Ex: "agora quero ganhar massa"
- update_weight: user reports a NEW body weight (to update their profile, NOT a food amount). Ex: "atualiza meu peso pra 75", "agora tô com 80kg", "me pesei, 78 quilos"
- edit_meal: correct a specific meal of the day. Ex: "corrige meu almoço pra arroz e carne"
- delete_meal: delete a specific meal. Ex: "apaga meu café da manhã"
- edit_last: correct the last logged meal. Ex: "era 1 ovo, não 2"
- delete_last: delete the last logged meal. Ex: "apaga o último"
- delete_account: account deletion. Ex: "apagar minha conta"
- subscribe: subscribe/pay. Ex: "quero assinar"
- help: help or "what do you do". Ex: "o que você faz?"
- greeting: greetings/thanks. Ex: "oi", "bom dia", "obrigado"
- unknown: anything else.

Rules:
- Reply ONLY with the JSON, no markdown.
- Ambiguous or out-of-scope → unknown.
- Multiple intents → pick the main one.
- Consumption verb + ANY food name = ALWAYS register_meal. NEVER unknown for that pattern.
`;
