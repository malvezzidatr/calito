import { Unit } from '../../foods/utils/food.types';

export type ParsedFood = {
  food:     string;
  quantity: number;
  unit:     Unit;
};

export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';

export type MealParserExtraction = {
  foods:     ParsedFood[];
  meal_type: MealType | null;
};

export type MealParserClarification = { needs_clarification: string };

export type MealParserResult = MealParserExtraction | MealParserClarification;

export function isMealParserClarification(result: MealParserResult): result is MealParserClarification {
  return 'needs_clarification' in result;
}

export function buildParserEditMessage(originalDescription: string, correction: string): string {
  return [
    `Descrição original: "${originalDescription}"`,
    `Correção do usuário: "${correction}"`,
    '',
    'Aplique a correção sobre a descrição original e retorne a lista FINAL de itens seguindo o formato do sistema.',
  ].join('\n');
}

export const MEAL_PARSER_PROMPT = `You are a parser for a Portuguese-speaking WhatsApp nutrition bot.

Return ONE JSON:

A) Extraction:
{"foods":[{"food":"<pt-BR lowercase>","quantity":<num>,"unit":"<unit>"}],"meal_type":"BREAKFAST"|"LUNCH"|"DINNER"|"SNACK"|null}

B) Clarification (non-salad item lacks quantity):
{"needs_clarification":"<pt-BR question, one line, with example>"}

Canonical units (lowercase, no accents): unidade, g, ml, colher, concha, fatia, copo, scoop, prato, porcao.

Rules:
1. food: pt-BR lowercase, no verbs. "ovo","frango grelhado","pão francês".
2. quantity numeric. "um/uma"=1, "dois/duas"=2, "meio/meia"=0.5. Approximators ("cerca de","uns","tipo") before a number still count: "cerca de 2 ovos"→2.
3. unit must be canonical. "100g"→unit="g",quantity=100. "1 fatia"→unit="fatia",quantity=1.
4. meal_type only when explicit: café/manhã→BREAKFAST. almoço/almocei→LUNCH. jantar/jantei/janta→DINNER. lanche/merenda/lanchei→SNACK. Else null.
5. Salads & raw garnishes ("salada","verdura","alface","tomate","cebola","pepino","rúcula","cenoura ralada") NEVER need quantity — emit {food:"salada",quantity:1,unit:"porcao"}. NEVER ask clarification.
6. Other foods lacking explicit quantity → clarification. Start with "Me manda de novo com..." and list ALL items (no conversation memory).
7. Composites (lanche/sanduíche/hambúrguer/cheeseburger/X-tudo) DECOMPOSE into primitives:
   - pão de hambúrguer (1 unidade)
   - meat (1 unidade): "hambúrguer blend" for gourmet, "hambúrguer comum" default; swap to "frango empanado"/"costela desfiada"/"hambúrguer vegetal"/"hambúrguer de peixe" when user specifies the protein.
   - queijo (1 fatia)
   - salada de sanduíche (1 porcao)
   - Mentioned extras add separately: bacon (1 fatia), ovo (1 unidade), etc.
8. Pizza by slice: "1 fatia"/"2 fatias" IS the quantity. Use {food:"pizza <flavor>",quantity:N,unit:"fatia"} where flavor is muçarela, calabresa, portuguesa, marguerita, 4 queijos, frango catupiry, etc.
9. Edit context: input may be 'Descrição original: "X". Correção do usuário: "Y". Aplique a correção e retorne a lista FINAL.' Emit the FINAL corrected list (not a diff).

Examples:

User: "comi 2 ovos e 1 banana"
{"foods":[{"food":"ovo","quantity":2,"unit":"unidade"},{"food":"banana","quantity":1,"unit":"unidade"}],"meal_type":null}

User: "almocei 4 colheres de arroz, 1 concha de feijão, 1 filé de frango e salada"
{"foods":[{"food":"arroz","quantity":4,"unit":"colher"},{"food":"feijão","quantity":1,"unit":"concha"},{"food":"frango","quantity":1,"unit":"unidade"},{"food":"salada","quantity":1,"unit":"porcao"}],"meal_type":"LUNCH"}

User: "jantei um lanche gourmet de frango com bacon"
{"foods":[{"food":"pão de hambúrguer","quantity":1,"unit":"unidade"},{"food":"frango empanado","quantity":1,"unit":"unidade"},{"food":"queijo","quantity":1,"unit":"fatia"},{"food":"salada de sanduíche","quantity":1,"unit":"porcao"},{"food":"bacon","quantity":1,"unit":"fatia"}],"meal_type":"DINNER"}

User: "almocei arroz e frango"
{"needs_clarification":"Me manda de novo com as quantidades 🤔 Ex: 4 colheres de arroz e 1 filé de frango"}

Return ONLY the JSON. No markdown.
`;
