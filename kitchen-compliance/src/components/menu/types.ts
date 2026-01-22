export type UnitOfMeasure = 'kg' | 'g' | 'l' | 'ml' | 'pcs';

export type Allergen = 
  | 'gluten' | 'crustaceans' | 'eggs' | 'fish' | 'peanuts' 
  | 'soybeans' | 'milk' | 'nuts' | 'celery' | 'mustard' 
  | 'sesame' | 'sulphites' | 'lupin' | 'molluscs';

export interface Ingredient {
  id: string;
  name: string;
  cost: number; // Cost per unit
  unit: UnitOfMeasure;
  allergens: Allergen[];
  supplier?: string;
  lastUpdated: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  quantity: number;
  unit: UnitOfMeasure; // Should match or be convertible to ingredient unit
  yield?: number; // % yield after prep (e.g. peeling potatoes = 85%)
}

export interface MenuItem {
  id: string;
  name: string;
  category: 'starter' | 'main' | 'dessert' | 'side' | 'drink';
  sellingPrice: number; // Gross Price (including VAT)
  vatRate: number; // e.g., 13.5 (Ireland hospitality rate) or 23
  ingredients: RecipeIngredient[];
  preparationTime?: number; // minutes
  description?: string;
  
  // Calculated fields (frontend helper)
  totalCost?: number;
  grossMargin?: number; // %
  netProfit?: number;
}
