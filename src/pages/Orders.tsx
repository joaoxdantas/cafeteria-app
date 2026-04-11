import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Drink, MilkType, OperationType } from '../types';
import { handleFirestoreError } from '../lib/firestore-error';
import { DrinkVisualizer } from '../components/DrinkVisualizer';
import { Minus, Plus, CheckCircle2 } from 'lucide-react';

export function Orders() {
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [cart, setCart] = useState<Record<string, { quantity: number, milk: MilkType, sugar: number, notes: string }>>({});
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'drinks'),
      (snapshot) => {
        const drinksData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Drink[];
        
        drinksData.sort((a, b) => {
          const orderA = a.sortOrder !== undefined ? a.sortOrder : 999;
          const orderB = b.sortOrder !== undefined ? b.sortOrder : 999;
          return orderA - orderB;
        });
        
        // Filter out unavailable drinks
        const availableDrinks = drinksData.filter(d => d.available !== false);
        setDrinks(availableDrinks);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'drinks')
    );
    return () => unsubscribe();
  }, []);

  const updateCartQuantity = (id: string, delta: number, defaultMilk: boolean) => {
    setCart(prev => {
      const current = prev[id];
      const currentQty = current ? current.quantity : 0;
      const nextQty = Math.max(0, currentQty + delta);
      
      if (nextQty === 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      
      return { 
        ...prev, 
        [id]: { 
          quantity: nextQty, 
          milk: current?.milk || (defaultMilk ? 'full cream' : 'almond'), 
          sugar: current?.sugar || 0,
          notes: current?.notes || ''
        } 
      };
    });
  };

  const updateCartCustomization = (id: string, field: 'milk' | 'sugar' | 'notes', value: any) => {
    setCart(prev => {
      if (!prev[id]) return prev;
      return {
        ...prev,
        [id]: {
          ...prev[id],
          [field]: value
        }
      };
    });
  };

  const totalItems = Object.values(cart).reduce((a, b) => a + (b as any).quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || totalItems === 0) return;

    try {
      const promises = [];
      for (const [drinkId, itemValue] of Object.entries(cart)) {
        const item = itemValue as { quantity: number, milk: MilkType, sugar: number, notes: string };
        const drink = drinks.find(d => d.id === drinkId);
        if (!drink) continue;

        for (let i = 0; i < item.quantity; i++) {
          promises.push(addDoc(collection(db, 'orders'), {
            customer_name: customerName,
            drink_id: drink.id,
            drink_name: drink.name,
            drink_snapshot: drink,
            milk_type: drink.leite ? item.milk : 'full cream',
            notes: item.notes || '',
            sugar: item.sugar,
            barista_espresso_shots_needed: drink.espresso_shots || 0,
            barista_milk_needed: drink.leite || false,
            status: 'pending',
            timestamp: new Date().toISOString(),
          }));
        }
      }
      await Promise.all(promises);
      
      setCart({});
      setCustomerName('');
      
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full max-w-none relative">
      {showSuccess && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center space-x-2 z-50 animate-bounce">
          <CheckCircle2 className="w-6 h-6" />
          <span className="font-bold text-lg">Orders sent successfully!</span>
        </div>
      )}

      <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4 sm:mb-6 lg:mb-8 text-center shrink-0">New Order</h2>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-4 sm:space-y-6 lg:space-y-8 overflow-y-auto pr-2">
          <div className="shrink-0">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-base sm:text-lg lg:text-xl font-medium text-slate-700">Customer Name</label>
              <button 
                type="button" 
                onClick={() => { setCart({}); setCustomerName(''); }} 
                className="text-sm text-red-600 hover:text-red-800 font-bold px-3 py-1 rounded-md hover:bg-red-50 transition-colors"
              >
                Clear Order
              </button>
            </div>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-base sm:text-lg lg:text-xl p-3 lg:p-4 border"
              placeholder="Ex: John"
            />
          </div>

          <div className="flex-1 min-h-[200px] flex flex-col">
            <label className="block text-base sm:text-lg lg:text-xl font-medium text-slate-700 mb-2 shrink-0">Drinks</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 overflow-y-auto p-1 flex-1 pb-24">
              {drinks.map((drink) => {
                const cartItem = cart[drink.id];
                const isSelected = !!cartItem;
                
                return (
                <div
                  key={drink.id}
                  className={`rounded-xl border-2 p-3 sm:p-4 lg:p-6 flex flex-col justify-between transition-colors ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-slate-200 hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-center space-x-3 sm:space-x-4 lg:space-x-6 cursor-pointer" onClick={() => updateCartQuantity(drink.id, 1, !!drink.leite)}>
                    <div className="w-16 h-20 sm:w-20 sm:h-28 lg:w-24 lg:h-32 bg-black rounded-md flex items-center justify-center overflow-hidden shrink-0">
                      <DrinkVisualizer drink={drink} className="scale-[0.4] sm:scale-[0.55] lg:scale-[0.7] origin-center" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base lg:text-xl">{drink.name}</h3>
                      <p className="text-xs sm:text-sm lg:text-base text-slate-500">{drink.espresso_shots} shots</p>
                    </div>
                  </div>
                  
                  {isSelected && (
                    <div className="mt-4 space-y-3">
                      {drink.leite && (
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Milk</label>
                          <select
                            value={cartItem.milk}
                            onChange={(e) => updateCartCustomization(drink.id, 'milk', e.target.value as MilkType)}
                            className="block w-full rounded-md border-slate-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-xs sm:text-sm p-2 border bg-white"
                          >
                            <option value="full cream">Full Cream</option>
                            <option value="lactose free">Lactose Free</option>
                            <option value="skinny">Skinny</option>
                            <option value="almond">Almond</option>
                            <option value="oat">Oat</option>
                            <option value="soy">Soy</option>
                          </select>
                        </div>
                      )}
                      
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Sugar</label>
                        <div className="flex items-center space-x-2 bg-white rounded-md border border-slate-200 p-1">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); updateCartCustomization(drink.id, 'sugar', Math.max(0, cartItem.sugar - 1)); }}
                            className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-transform active:scale-95 flex-1 flex justify-center"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="font-bold text-sm w-6 text-center">{cartItem.sugar}</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); updateCartCustomization(drink.id, 'sugar', cartItem.sugar + 1); }}
                            className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-transform active:scale-95 flex-1 flex justify-center"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">Notes</label>
                        <input
                          type="text"
                          value={cartItem.notes}
                          onChange={(e) => updateCartCustomization(drink.id, 'notes', e.target.value)}
                          className="block w-full rounded-md border-slate-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-xs sm:text-sm p-2 border bg-white"
                          placeholder="Ex: Extra hot..."
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-4 bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                    <button 
                      type="button" 
                      onClick={(e) => { e.stopPropagation(); updateCartQuantity(drink.id, -1, !!drink.leite); }} 
                      className="p-2 hover:bg-slate-100 rounded-md active:scale-95 transition-transform"
                    >
                      <Minus className="w-5 h-5 text-slate-600"/>
                    </button>
                    <span className="font-bold text-lg w-8 text-center">{cartItem ? cartItem.quantity : 0}</span>
                    <button 
                      type="button" 
                      onClick={(e) => { e.stopPropagation(); updateCartQuantity(drink.id, 1, !!drink.leite); }} 
                      className="p-2 hover:bg-slate-100 rounded-md active:scale-95 transition-transform"
                    >
                      <Plus className="w-5 h-5 text-slate-600"/>
                    </button>
                  </div>
                </div>
              )})}
            </div>
          </div>
        </form>
      </div>

      {/* Floating Send Order Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={totalItems === 0 || !customerName}
          className="flex items-center justify-center py-4 px-8 border border-transparent rounded-full shadow-2xl text-xl font-bold text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all duration-150 ease-in-out transform hover:-translate-y-1"
        >
          SEND ({totalItems})
        </button>
      </div>
    </div>
  );
}

