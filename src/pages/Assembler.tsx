import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Order, OperationType, MilkType, AppSettings } from '../types';
import { handleFirestoreError } from '../lib/firestore-error';
import { DrinkVisualizer } from '../components/DrinkVisualizer';
import { CheckCircle, X, Check, FileText, Coffee } from 'lucide-react';
import { useIngredients } from '../hooks/useIngredients';
import { useShop } from '../contexts/ShopContext';

const milkColors: Record<MilkType, string> = {
  'almond': 'bg-red-500 text-white',
  'soy': 'bg-[#D2B48C] text-amber-950', // beige
  'full cream': 'bg-blue-500 text-white',
  'skinny': 'bg-sky-300 text-sky-900',
  'lactose free': 'bg-white text-slate-800 border-2 border-slate-300',
  'oat': 'bg-amber-200 text-amber-900',
};

const sizeColors: Record<string, string> = {
  'Piccolo': 'bg-pink-500 text-white',
  'Small': 'bg-cyan-500 text-white',
  'Medium': 'bg-emerald-500 text-white',
  'Large': 'bg-orange-500 text-white',
};

export function Assembler() {
  const { selectedShop } = useShop();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showRecipe, setShowRecipe] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({ isSizeSelectionEnabled: true });
  const ingredients = useIngredients();

  useEffect(() => {
    if (!selectedShop) return;

    // Assembler sees all pending orders, same as Barista
    const q = query(collection(db, 'shops', selectedShop.id, 'orders'), where('status', '==', 'pending'));
    const unsubscribeOrders = onSnapshot(
      q,
      (snapshot) => {
        const ordersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Order[];
        // Sort by timestamp (oldest first, top to bottom)
        ordersData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        setOrders(ordersData);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `shops/${selectedShop.id}/orders`)
    );

    const unsubscribeSettings = onSnapshot(
      doc(db, 'shops', selectedShop.id, 'settings', 'app'),
      (snapshot) => {
        if (snapshot.exists()) {
          setSettings(snapshot.data() as AppSettings);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `shops/${selectedShop.id}/settings/app`)
    );

    return () => {
      unsubscribeOrders();
      unsubscribeSettings();
    };
  }, [selectedShop]);

  const handleComplete = async (orderId: string) => {
    if (!selectedShop) return;
    try {
      await updateDoc(doc(db, 'shops', selectedShop.id, 'orders', orderId), {
        status: 'completed'
      });
      setSelectedOrder(null);
      setShowRecipe(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `shops/${selectedShop.id}/orders/${orderId}`);
    }
  };

  const handleViewRecipe = (order: Order) => {
    setSelectedOrder(order);
    setShowRecipe(true);
  };

  const getGroupedLayers = (layers: string[]) => {
    const grouped: { id: string, name: string, color: string, count: number }[] = [];
    for (const layer of layers) {
      if (grouped.length > 0 && grouped[grouped.length - 1].id === layer) {
        grouped[grouped.length - 1].count++;
      } else {
        const ing = ingredients.find(i => i.id === layer);
        grouped.push({ id: layer, name: ing?.name || layer, color: ing?.color || 'transparent', count: 1 });
      }
    }
    return grouped.reverse(); // Reverse to show top to bottom
  };

  return (
    <div className="flex-1 flex flex-col h-full relative transition-colors duration-300">
      {/* Recipe Modal */}
      {showRecipe && selectedOrder && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() => { setShowRecipe(false); setSelectedOrder(null); }}
        >
          <div 
            className="bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full p-4 sm:p-8 transform transition-all border border-slate-700 max-h-[95vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4 sm:mb-6 shrink-0">
              <div>
                <div className="flex flex-col mb-1 sm:mb-2">
                  {settings.isSizeSelectionEnabled && (
                    <span className={`inline-block px-3 py-1 rounded-lg text-lg sm:text-2xl font-black uppercase tracking-widest w-fit mb-2 ${sizeColors[selectedOrder.size || 'Medium']}`}>
                      {selectedOrder.size}
                    </span>
                  )}
                  <h3 className="text-2xl sm:text-4xl font-black text-white">{selectedOrder.drink_name}</h3>
                </div>
                <p className="text-slate-400 text-base sm:text-lg">For {selectedOrder.customer_name}</p>
              </div>
              <button onClick={() => { setShowRecipe(false); setSelectedOrder(null); }} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors shrink-0 ml-4">
                <X className="w-6 h-6 sm:w-8 sm:h-8 text-slate-300" />
              </button>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 bg-slate-800/50 p-4 sm:p-6 rounded-2xl flex-1 min-h-0 overflow-hidden">
              <div className="shrink-0 bg-black/40 p-4 rounded-2xl border border-white/10 flex items-center justify-center">
                <DrinkVisualizer drink={selectedOrder.drink_snapshot} className="scale-75 sm:scale-100 lg:scale-125 origin-center" />
              </div>
              
              <div className="flex-1 flex flex-col justify-center space-y-2 sm:space-y-4 w-full min-h-0">
                <h4 className="text-slate-400 font-bold uppercase tracking-widest text-xs sm:text-sm mb-1 sm:mb-2 border-b border-slate-700 pb-2 shrink-0">Recipe Diagram</h4>
                <div className="space-y-2 overflow-y-auto pr-2 flex-1">
                  {getGroupedLayers(selectedOrder.drink_snapshot.layer_order || []).map((layer, idx) => (
                    <div key={idx} className="flex items-center space-x-3 sm:space-x-4 bg-slate-800 p-2 sm:p-3 rounded-xl border border-slate-700 shadow-sm">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full shadow-inner flex shrink-0 border border-white/20" style={{ backgroundColor: layer.color !== 'transparent' ? layer.color : '#cbd5e1' }} />
                      <div className="flex-1 flex justify-between items-center">
                        <span className="text-white font-bold text-sm sm:text-lg">{layer.name}</span>
                        <span className="text-amber-400 font-black text-base sm:text-xl bg-amber-400/10 px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg">{layer.count}x</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="mt-4 sm:mt-6 flex justify-end shrink-0">
              <button 
                onClick={() => handleComplete(selectedOrder.id)}
                className="py-3 sm:py-4 px-6 sm:px-8 bg-green-500 text-white hover:bg-green-600 rounded-xl font-black text-lg sm:text-xl flex items-center justify-center transition-colors shadow-lg w-full sm:w-auto"
              >
                <Check className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" />
                Deliver Order
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-100 dark:bg-slate-900 rounded-xl p-2 sm:p-4 flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden h-full transition-colors">
        <h2 className="text-lg sm:text-2xl font-black text-slate-800 dark:text-white mb-2 sm:mb-4 text-center bg-white dark:bg-slate-800 py-2 rounded-lg shadow-sm shrink-0 transition-colors">ASSEMBLY QUEUE</h2>
        
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 sm:gap-4 pr-1">
          {orders.map((order, index) => (
            <div 
              key={order.id} 
              className="w-full flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-md border-2 border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col sm:flex-row relative text-left transition-all group min-h-[120px] sm:min-h-[160px]"
            >
              <div className="absolute top-0 right-0 bg-amber-500 text-white px-3 py-1 rounded-bl-lg font-black z-10 text-xs sm:text-sm">
                #{index + 1}
              </div>
              
              <div className="w-full sm:w-32 lg:w-40 h-32 sm:h-auto bg-black flex justify-center items-center shrink-0 relative overflow-hidden py-2 border-b sm:border-b-0 sm:border-r border-slate-800">
                 <DrinkVisualizer drink={order.drink_snapshot} className="scale-50 sm:scale-75 lg:scale-90 origin-center" />
              </div>
              
              <div className="p-3 sm:p-4 lg:p-6 flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
                <div className="flex-1 flex flex-col justify-center">
                  <h3 className="text-sm sm:text-base lg:text-lg font-medium text-slate-500 dark:text-slate-400 mb-1 leading-tight pr-6 sm:pr-0">{order.customer_name}</h3>
                  <div className="flex flex-col">
                    {settings.isSizeSelectionEnabled && (
                      <span className={`inline-block px-3 py-1 rounded-md font-black uppercase tracking-widest text-2xl sm:text-3xl lg:text-4xl mb-1 w-fit shadow-sm ${sizeColors[order.size || 'Medium']}`}>
                        {order.size}
                      </span>
                    )}
                    <div className="flex items-center gap-3">
                      <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-800 dark:text-white">{order.drink_name}</p>
                      <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-400 px-3 py-1 rounded-lg border border-amber-200 dark:border-amber-800 shadow-sm">
                        <Coffee className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="text-lg sm:text-xl font-black">{order.drink_snapshot.espresso_shots}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col gap-2 sm:max-w-sm w-full justify-center">
                  {order.drink_snapshot.leite && (
                    <div className={`px-3 py-2 rounded-lg font-bold text-sm sm:text-base flex justify-between items-center shadow-sm border-2 border-transparent ${milkColors[order.milk_type]}`}>
                      <span>Milk</span>
                      <span className="uppercase tracking-wider">{order.milk_type}</span>
                    </div>
                  )}
                  <div className="px-3 py-2 rounded-lg font-bold text-sm sm:text-base flex justify-between items-center shadow-sm bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 transition-colors">
                    <span className="text-slate-600 dark:text-slate-400">Sugar</span>
                    <span className="text-slate-900 dark:text-white text-lg sm:text-xl">{order.sugar}</span>
                  </div>
                  {order.equal > 0 && (
                    <div className="px-3 py-2 rounded-lg font-bold text-sm sm:text-base flex justify-between items-center shadow-sm bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 transition-colors">
                      <span className="text-slate-600 dark:text-slate-400">Equal</span>
                      <span className="text-slate-900 dark:text-white text-lg sm:text-xl">{order.equal}</span>
                    </div>
                  )}
                  {order.syrup && (
                    <div className="px-3 py-2 rounded-lg font-bold text-sm sm:text-base flex justify-between items-center shadow-sm bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-900/50 transition-colors">
                      <span className="text-amber-600 dark:text-amber-400">Syrup</span>
                      <span className="text-amber-900 dark:text-amber-200 uppercase tracking-wider">{order.syrup}</span>
                    </div>
                  )}
                  {order.notes && (
                    <div className="px-3 py-2 rounded-lg font-bold text-sm sm:text-base flex flex-col sm:flex-row sm:justify-between sm:items-center shadow-sm bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-900/50 gap-1 transition-colors">
                      <span className="text-red-500 dark:text-red-400 uppercase tracking-widest text-xs shrink-0">Notes</span>
                      <span className="text-red-900 dark:text-red-200 text-left sm:text-right leading-tight">{order.notes}</span>
                    </div>
                  )}
                </div>

                <div className="flex sm:flex-col gap-2 shrink-0 mt-4 sm:mt-0">
                  <button 
                    onClick={() => handleViewRecipe(order)}
                    className="flex-1 sm:flex-none py-3 px-4 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center transition-colors"
                  >
                    <FileText className="w-5 h-5 mr-2" />
                    Recipe
                  </button>
                  <button 
                    onClick={() => handleComplete(order.id)}
                    className="flex-1 sm:flex-none py-3 px-4 bg-green-500 text-white hover:bg-green-600 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center transition-colors shadow-md"
                  >
                    <Check className="w-5 h-5 mr-2" />
                    Deliver
                  </button>
                </div>
              </div>
            </div>
          ))}

          {orders.length === 0 && (
            <div className="w-full h-full flex flex-col items-center justify-center py-10 bg-white dark:bg-slate-800 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 min-h-[200px] transition-colors">
              <CheckCircle className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-lg text-slate-500 dark:text-slate-400 font-medium text-center px-4">No orders for assembly right now.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}




