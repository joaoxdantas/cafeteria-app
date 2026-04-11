import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Order, OperationType, MilkType } from '../types';
import { handleFirestoreError } from '../lib/firestore-error';
import { Coffee, Droplet } from 'lucide-react';

const milkColors: Record<MilkType, string> = {
  'almond': 'bg-red-500 text-white hover:bg-red-600',
  'soy': 'bg-[#D2B48C] text-amber-950 hover:bg-[#C1A37B]', // beige
  'full cream': 'bg-blue-500 text-white hover:bg-blue-600',
  'skinny': 'bg-sky-300 text-sky-900 hover:bg-sky-400',
  'lactose free': 'bg-white text-slate-800 border-2 border-slate-300 hover:bg-slate-50',
  'oat': 'bg-amber-200 text-amber-900 hover:bg-amber-300',
};

type OrderWithIndex = Order & { queueIndex: number };

export function Barista() {
  const [orders, setOrders] = useState<OrderWithIndex[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'orders'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const ordersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Order[];
        
        // Sort by timestamp ASC (oldest first, so top is oldest)
        ordersData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        // Add global queue index based on oldest first sorting
        const ordersWithIndex = ordersData.map((o, i) => ({ ...o, queueIndex: i + 1 }));
        setOrders(ordersWithIndex);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'orders')
    );
    return () => unsubscribe();
  }, []);

  const handleGlobalEspressoClick = async () => {
    let shotsToSubtract = 2;
    const promises = [];

    for (const order of orders) {
      if (shotsToSubtract <= 0) break;
      if (order.barista_espresso_shots_needed > 0) {
        const subtractFromThisOrder = Math.min(order.barista_espresso_shots_needed, shotsToSubtract);
        promises.push(updateDoc(doc(db, 'orders', order.id), {
          barista_espresso_shots_needed: order.barista_espresso_shots_needed - subtractFromThisOrder
        }));
        shotsToSubtract -= subtractFromThisOrder;
      }
    }
    
    if (promises.length > 0) {
      try {
        await Promise.all(promises);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'orders');
      }
    }
  };

  const handleMilkClick = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        barista_milk_needed: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const totalPendingShots = orders
    .filter(o => o.barista_espresso_shots_needed > 0)
    .reduce((sum, o) => sum + (o.barista_espresso_shots_needed || 0), 0);

  const pendingMilkOrders = orders.filter(o => o.barista_milk_needed);

  const milkCounts = pendingMilkOrders.reduce((acc, order) => {
    const type = order.milk_type as MilkType;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<MilkType, number>);

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="grid grid-cols-2 gap-2 sm:gap-6 h-full flex-1">
        {/* Espresso Column */}
        <div className="bg-slate-100 rounded-xl p-2 sm:p-4 flex flex-col border border-slate-200 overflow-hidden">
          <h2 className="text-lg sm:text-2xl font-black text-slate-800 mb-2 sm:mb-4 text-center bg-white py-2 rounded-lg shadow-sm flex flex-col">
            <span>ESPRESSO</span>
            {totalPendingShots > 0 && (
              <div className="flex flex-col items-center mt-2">
                <span className="text-5xl sm:text-7xl font-black text-amber-700 leading-none">{totalPendingShots}</span>
                <span className="text-sm sm:text-base text-amber-600 font-bold uppercase tracking-widest mt-1">Total Shots</span>
              </div>
            )}
          </h2>
          <div className="flex-1 overflow-y-auto space-y-2 sm:space-y-3 pr-1">
            {totalPendingShots > 0 ? (
              Array.from({ length: Math.ceil(totalPendingShots / 2) }).map((_, idx) => (
                <button
                  key={`espresso-${idx}`}
                  onClick={handleGlobalEspressoClick}
                  className="w-full bg-amber-900 hover:bg-amber-950 text-white p-4 sm:p-6 rounded-xl shadow-md flex items-center justify-center transition-transform active:scale-95 relative overflow-hidden"
                >
                  <Coffee className="w-10 h-10 sm:w-14 sm:h-14 shrink-0" />
                  <span className="text-3xl sm:text-4xl font-black ml-3">= 2</span>
                </button>
              ))
            ) : (
              <div className="text-center text-slate-400 py-8 text-sm sm:text-base">No espresso pending</div>
            )}
          </div>
        </div>

        {/* Milk Column */}
        <div className="bg-slate-100 rounded-xl p-2 sm:p-4 flex flex-col border border-slate-200 overflow-hidden">
          <div className="bg-white rounded-lg shadow-sm mb-2 sm:mb-4 p-2 flex flex-col">
            <h2 className="text-lg sm:text-2xl font-black text-slate-800 text-center">MILK</h2>
            {Object.keys(milkCounts).length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mt-2">
                {Object.entries(milkCounts).map(([type, count]) => (
                  <div key={type} className={`px-2 py-1 rounded-md font-bold text-xs sm:text-sm flex items-center gap-1.5 ${milkColors[type as MilkType].split(' hover:')[0]}`}>
                    <span className="text-base sm:text-lg">{count}</span>
                    <span className="uppercase tracking-wider opacity-90">{type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 sm:space-y-3 pr-1">
            {pendingMilkOrders.map(order => (
              <button
                key={order.id}
                onClick={() => handleMilkClick(order.id)}
                className={`w-full p-4 sm:p-8 rounded-xl shadow-md flex items-center justify-center transition-transform active:scale-95 relative overflow-hidden ${milkColors[order.milk_type as MilkType]}`}
              >
                <div className="absolute top-0 right-0 bg-amber-500 text-white px-3 py-1.5 rounded-bl-lg font-black z-10 text-sm sm:text-base">
                  #{order.queueIndex}
                </div>
                <div className="flex flex-col items-center z-10 relative">
                  <span className="font-bold text-xl sm:text-2xl uppercase tracking-wider opacity-90">{order.drink_name}</span>
                  <span className="font-normal text-xl sm:text-2xl uppercase tracking-wider mt-1">{order.milk_type}</span>
                </div>
              </button>
            ))}
            {pendingMilkOrders.length === 0 && (
              <div className="text-center text-slate-400 py-8 text-sm sm:text-base">No milk pending</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


