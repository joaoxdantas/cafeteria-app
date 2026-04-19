export type Unit = 'kg' | 'g' | 'L' | 'ml' | 'unidade' | 'caixa';

export type Language = 'pt-BR' | 'en-AU' | 'fil';

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  categories: string[];
}

export interface Item {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  quantity: number;
  unit: Unit;
  minStock: number;
  supplierId?: string;
  bestBefore?: string;
  batch?: string;
}

export type TransactionType = 'IN' | 'OUT' | 'WASTE';

export interface Transaction {
  id: string;
  itemId: string;
  itemName: string;
  type: TransactionType;
  quantity: number;
  date: string;
  notes?: string;
  cost?: number; // Optional: cost per unit on IN, or total lost on WASTE
  bestBefore?: string;
  batch?: string;
}

export interface TestMeasurement {
  dose: number;
  time: number;
  yieldAmount: number;
}

export interface ItemHandling {
  id: string;
  itemId: string;
  shelfLife: string;
  temperature: string;
  prepInstructions: string;
  notes: string;
}

export interface GroupHeadTest {
  double: TestMeasurement;
  lungo: TestMeasurement;
}

export interface EspressoTest {
  id: string;
  date: string;
  operator: string;
  group1: GroupHeadTest;
  group2: GroupHeadTest;
}

export interface MaintenanceRecord {
  id: string;
  date: string;
  task: string;
  operator: string;
  notes: string;
}

export interface Ingredient {
  name: string;
  quantity: string;
}

export interface RecipeLayer {
  label: string;
  color: string;
  height: string; // e.g., "15%" or "bg-[#...] h-[15%]"
}

export interface DrinkRecipe {
  id: string;
  name: string;
  ingredients: Ingredient[];
  method: string;
  image?: string;
  layers?: RecipeLayer[];
}
