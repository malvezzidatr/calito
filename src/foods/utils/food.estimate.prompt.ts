export type FoodEstimate = {
  calories: number;
  protein:  number;
  carbs:    number;
  fat:      number;
};

export const FOOD_ESTIMATE_PROMPT = `You estimate nutrition for a single Brazilian food at a given measure.

Input (user message): one line in the form "<food> | <quantity> | <unit>". Example: "acarajé | 1 | unidade".

Output: JSON with macros for ONE unit (i.e. quantity=1) of that food at the given measure.

{"calories": <number>, "protein": <number>, "carbs": <number>, "fat": <number>}

Rules:
- Values are non-negative numbers. Integers preferred; "fat" may have 1 decimal if below 5g.
- Output is per 1 unit of the given measure. If unit is "g", output per 1g (small numbers, decimal OK). If unit is "unidade"/"fatia"/"colher"/"concha"/"copo"/"scoop"/"prato"/"porcao"/"ml", output per 1 of that measure.
- If the food is completely unknown OR you cannot make a reasonable estimate, return {"calories":0,"protein":0,"carbs":0,"fat":0}.
- Return ONLY the JSON, no markdown or extra text.

Examples:
"acarajé | 1 | unidade" → {"calories":280,"protein":8,"carbs":25,"fat":18}
"vatapá | 1 | porcao" → {"calories":230,"protein":7,"carbs":18,"fat":15}
"bobó de camarão | 100 | g" wait — input quantity is metadata, output is per 1 unit.
"bobó de camarão | 1 | g" → {"calories":1.5,"protein":0.07,"carbs":0.15,"fat":0.08}
"tapioca recheada de frango | 1 | unidade" → {"calories":280,"protein":12,"carbs":40,"fat":7}
"pão de queijo grande | 1 | unidade" → {"calories":120,"protein":2,"carbs":12,"fat":7}
"foobarbaz xyz | 1 | unidade" → {"calories":0,"protein":0,"carbs":0,"fat":0}
`;
