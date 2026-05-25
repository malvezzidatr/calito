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

export const MEAL_PARSER_PROMPT = `Parser for a Portuguese WhatsApp nutrition bot. Return ONE JSON, no markdown.

A) {"foods":[{"food":"<pt-BR lowercase>","quantity":<num>,"unit":"<unit>"}],"meal_type":"BREAKFAST"|"LUNCH"|"DINNER"|"SNACK"|null}

B) {"needs_clarification":"<pt-BR question, start with 'Me manda de novo com...' and list ALL items the user mentioned (no conversation memory)>"}

Units: unidade, g, ml, colher, concha, fatia, copo, scoop, prato, porcao.

Rules:
1. food: pt-BR lowercase, no verbs. quantity numeric ("um/uma"=1, "duas/dois"=2, "meia"=0.5; approximators like "cerca de","uns","tipo" still keep the number). unit canonical: "100g"→unit=g,quantity=100; "1 fatia"→fatia,1.
2. meal_type only when explicit: café/manhã→BREAKFAST, almoço/almocei→LUNCH, jantar/jantei/janta→DINNER, lanche/merenda/lanchei→SNACK. Else null.
3. Salads & raw garnishes ("salada","verdura","alface","tomate","cebola","pepino","rúcula","cenoura ralada") NEVER need quantity — emit {food:"salada",quantity:1,unit:"porcao"}. Never ask clarification for them.
4. Other foods lacking explicit quantity → emit B.
5. Composites (lanche/sanduíche/hambúrguer/cheeseburger) DECOMPOSE: pão de hambúrguer (1 unidade) + meat (1 unidade) + queijo (1 fatia) + salada de sanduíche (1 porcao). meat="hambúrguer blend" for gourmet, "hambúrguer comum" default; swap to "frango empanado"/"costela desfiada"/"hambúrguer vegetal"/"hambúrguer de peixe" when user specifies the protein. Extras (bacon, ovo, etc) add separately.
6. Pizza by slice: {food:"pizza <flavor>",quantity:N,unit:"fatia"} — flavors: muçarela, calabresa, portuguesa, marguerita, 4 queijos, frango catupiry, etc.
7. Edit context: input may be 'Descrição original: "X". Correção: "Y". Aplique e retorne a lista FINAL.' → emit the FINAL list.

Examples:

"comi 2 ovos e 1 banana"
{"foods":[{"food":"ovo","quantity":2,"unit":"unidade"},{"food":"banana","quantity":1,"unit":"unidade"}],"meal_type":null}

"jantei um lanche gourmet de frango com bacon"
{"foods":[{"food":"pão de hambúrguer","quantity":1,"unit":"unidade"},{"food":"frango empanado","quantity":1,"unit":"unidade"},{"food":"queijo","quantity":1,"unit":"fatia"},{"food":"salada de sanduíche","quantity":1,"unit":"porcao"},{"food":"bacon","quantity":1,"unit":"fatia"}],"meal_type":"DINNER"}

"almocei arroz e frango"
{"needs_clarification":"Me manda de novo com as quantidades 🤔 Ex: 4 colheres de arroz e 1 filé de frango"}
`;
