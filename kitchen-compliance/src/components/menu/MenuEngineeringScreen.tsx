import { useMemo, useState } from 'react';
import { MOCK_INGREDIENTS, MOCK_MENU_ITEMS, calculateItemMetrics } from './data';
import { ArrowLeft, Plus, TrendingUp, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuEngineeringScreenProps {
  onBack: () => void;
}

export function MenuEngineeringScreen({ onBack }: MenuEngineeringScreenProps) {
  const [items] = useState(MOCK_MENU_ITEMS);
  const [ingredients] = useState(MOCK_INGREDIENTS);

  // Process data with calculations
  const processedItems = useMemo(() => {
    return items.map(item => {
      const metrics = calculateItemMetrics(item, ingredients);
      return { ...item, ...metrics };
    });
  }, [items, ingredients]);

  return (
    <div className="min-h-full bg-theme-primary text-theme-primary transition-colors pb-24 lg:pb-6 animate-fade-in">
       {/* Header */}
       <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={onBack}
                className="lg:hidden p-3 rounded-full hover:bg-theme-ghost transition-colors text-theme-secondary hover:text-theme-primary"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-3xl font-light tracking-tight">Menu Engineering</h1>
                <p className="text-muted-foreground mt-1">Cost Control & Margin Analysis</p>
              </div>
            </div>

            <button className="px-6 py-3 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-lg font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-2">
              <Plus size={18} />
              New Dish
            </button>
         </div>

         {/* KPI Cards */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] p-6 rounded-xl flex flex-col justify-between h-32">
               <span className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider">Target GP%</span>
               <div className="flex items-end justify-between">
                  <span className="text-4xl font-light">70%</span>
                  <span className="text-xs px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full">Industry Std</span>
               </div>
            </div>
             <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] p-6 rounded-xl flex flex-col justify-between h-32">
               <span className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider">Avg Menu GP%</span>
               <div className="flex items-end justify-between">
                  <span className="text-4xl font-light text-emerald-600">72.4%</span>
                  <TrendingUp className="text-emerald-500 w-5 h-5 mb-1" />
               </div>
            </div>
             <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] p-6 rounded-xl flex flex-col justify-between h-32">
               <span className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider">Food Cost Warning</span>
               <div className="flex items-end justify-between">
                  <span className="text-4xl font-light text-amber-500">1</span>
                  <AlertCircle className="text-amber-500 w-5 h-5 mb-1" />
               </div>
            </div>
         </div>

         {/* Menu Table */}
         <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border-primary)] text-xs uppercase tracking-wider text-[var(--text-secondary)]">
                    <th className="p-4 font-medium">Dish Name</th>
                    <th className="p-4 font-medium text-right">Sell Price (Inc VAT)</th>
                    <th className="p-4 font-medium text-right">Cost Price</th>
                    <th className="p-4 font-medium text-right">Net Profit</th>
                    <th className="p-4 font-medium text-right">GP %</th>
                    <th className="p-4 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-primary)]">
                   {processedItems.map(item => (
                     <tr key={item.id} className="group hover:bg-[var(--bg-secondary)] transition-colors">
                       <td className="p-4">
                         <div className="font-medium">{item.name}</div>
                         <div className="text-xs text-[var(--text-muted)] capitalize">{item.category}</div>
                       </td>
                       <td className="p-4 text-right font-mono">€{item.sellingPrice.toFixed(2)}</td>
                       <td className="p-4 text-right font-mono text-[var(--text-muted)]">€{item.totalCost.toFixed(2)}</td>
                       <td className="p-4 text-right font-mono text-emerald-600">€{item.netProfit.toFixed(2)}</td>
                       <td className="p-4 text-right">
                         <span className={cn(
                           "font-bold font-mono",
                           item.grossMargin >= 70 ? 'text-emerald-600' : 
                           item.grossMargin >= 65 ? 'text-amber-500' : 'text-red-500'
                         )}>
                           {item.grossMargin.toFixed(1)}%
                         </span>
                       </td>
                       <td className="p-4 text-center">
                          <div className={cn(
                            "inline-flex w-2 h-2 rounded-full",
                             item.grossMargin >= 70 ? 'bg-emerald-500' : 
                             item.grossMargin >= 65 ? 'bg-amber-500' : 'bg-red-500'
                          )} />
                       </td>
                     </tr>
                   ))}
                </tbody>
              </table>
            </div>
         </div>
       </div>
    </div>
  );
}
