// Mock Database with REAL Irish Market Prices (Jan 2026)

import type { Ingredient, MenuItem } from './types';

export const MOCK_INGREDIENTS: Ingredient[] = [
  { id: '1', name: 'Irish Beef Fillet (Whole)', cost: 38.50, unit: 'kg', allergens: [], lastUpdated: '2026-01-10' },
  { id: '2', name: 'Butter (Salted)', cost: 8.20, unit: 'kg', allergens: ['milk'], lastUpdated: '2026-01-12' },
  { id: '3', name: 'Potatoes (Maris Piper)', cost: 0.95, unit: 'kg', allergens: [], lastUpdated: '2026-01-15' },
  { id: '4', name: 'Heavy Cream (35%)', cost: 4.50, unit: 'l', allergens: ['milk'], lastUpdated: '2026-01-12' },
  { id: '5', name: 'Shallots', cost: 3.20, unit: 'kg', allergens: [], lastUpdated: '2026-01-05' },
  { id: '6', name: 'Red Wine (Cooking)', cost: 6.50, unit: 'l', allergens: ['sulphites'], lastUpdated: '2025-12-20' },
  { id: '7', name: 'Thyme (Fresh)', cost: 22.00, unit: 'kg', allergens: [], lastUpdated: '2026-01-18' },
];

export const MOCK_MENU_ITEMS: MenuItem[] = [
  {
    id: 'm1',
    name: '8oz Fillet Steak',
    category: 'main',
    sellingPrice: 38.00,
    vatRate: 13.5,
    ingredients: [
      { ingredientId: '1', quantity: 0.240, unit: 'kg', yield: 95 }, // 227g trimmed + waste
      { ingredientId: '2', quantity: 0.030, unit: 'kg' }, // Basting
      { ingredientId: '7', quantity: 0.005, unit: 'kg' },
    ]
  },
  {
    id: 'm2',
    name: 'Creamy Mash',
    category: 'side',
    sellingPrice: 5.50,
    vatRate: 13.5,
    ingredients: [
      { ingredientId: '3', quantity: 0.250, unit: 'kg', yield: 85 }, // Peeling loss
      { ingredientId: '2', quantity: 0.030, unit: 'kg' }, 
      { ingredientId: '4', quantity: 0.050, unit: 'l' },
    ]
  }
];

export const calculateItemMetrics = (item: MenuItem, ingredients: Ingredient[]) => {
  let cost = 0;
  
  item.ingredients.forEach(ing => {
    const dbIng = ingredients.find(i => i.id === ing.ingredientId);
    if (!dbIng) return;

    const price = dbIng.cost;
    const qty = ing.quantity;
    const yieldFactor = (ing.yield || 100) / 100;

    // Real Cost = (Price * Qty) / Yield
    cost += (price * qty) / yieldFactor;
  });

  const netSellingPrice = item.sellingPrice / (1 + (item.vatRate / 100));
  const profit = netSellingPrice - cost;
  const margin = (profit / netSellingPrice) * 100;

  return {
    totalCost: cost,
    netSellingPrice,
    netProfit: profit,
    grossMargin: margin
  };
};
