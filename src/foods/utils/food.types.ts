export const FoodCategory = {
  Cereais:          'cereais',
  Leguminosas:      'leguminosas',
  Carnes:           'carnes',
  OvosLaticinios:   'ovos_laticinios',
  Frutas:           'frutas',
  Verduras:         'verduras',
  PaesCereais:      'paes_cereais',
  Processados:      'processados',
  Bebidas:          'bebidas',
  ComposicaoLanche: 'composicao_lanche',
} as const;

export type FoodCategory = typeof FoodCategory[keyof typeof FoodCategory];

export const Unit = {
  Unidade: 'unidade',
  Gramas:  'g',
  Mililitros: 'ml',
  Colher:  'colher',
  Concha:  'concha',
  Fatia:   'fatia',
  Copo:    'copo',
  Scoop:   'scoop',
  Prato:   'prato',
  Porcao:  'porcao',
} as const;

export type Unit = typeof Unit[keyof typeof Unit];

export type Nutrition = {
  calories: number;
  protein:  number;
  carbs:    number;
  fat:      number;
};

export type UnitConversion = {
  grams: number;
};

export type FoodEntry = {
  id:           string;
  name:         string;
  aliases:      string[];
  category:     FoodCategory;
  default_unit: Unit;
  per_100g:     Nutrition;
  units:        Partial<Record<Unit, UnitConversion>>;
};
