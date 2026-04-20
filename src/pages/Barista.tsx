import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Order, OperationType, MilkType, AppSettings } from '../types';
import { handleFirestoreError } from '../lib/firestore-error';
import { Coffee, Droplet, Volume2, VolumeX } from 'lucide-react';
import { useShop } from '../contexts/ShopContext';

const milkColors: Record<MilkType, string> = {
  'almond': 'bg-red-500 text-white hover:bg-red-600',
  'soy': 'bg-[#D2B48C] text-amber-950 hover:bg-[#C1A37B]', // beige
  'full cream': 'bg-blue-500 text-white hover:bg-blue-600',
  'skinny': 'bg-sky-300 text-sky-900 hover:bg-sky-400',
  'lactose free': 'bg-white text-slate-800 border-2 border-slate-300 hover:bg-slate-50',
  'oat': 'bg-amber-200 text-amber-900 hover:bg-amber-300',
};

const sizeColors: Record<string, string> = {
  'Piccolo': 'bg-pink-500 text-white',
  'Small': 'bg-cyan-500 text-white',
  'Medium': 'bg-emerald-500 text-white',
  'Large': 'bg-orange-500 text-white',
};

type OrderWithIndex = Order & { queueIndex: number };

export function Barista() {
  const { selectedShop } = useShop();
  const [orders, setOrders] = useState<OrderWithIndex[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ isSizeSelectionEnabled: true });
  const [audioEnabled, setAudioEnabled] = useState(() => {
    const saved = localStorage.getItem('barista_audio_enabled');
    return saved === null ? true : saved === 'true';
  });
  const lastProcessedOrderId = useRef<string | null>(null);

  useEffect(() => {
    localStorage.setItem('barista_audio_enabled', audioEnabled.toString());
  }, [audioEnabled]);

  useEffect(() => {
    if (orders.length > 0) {
      // newest order is at the end of the sorted array
      const newestOrder = orders[orders.length - 1];
      
      if (lastProcessedOrderId.current === null) {
        lastProcessedOrderId.current = newestOrder.id;
        return;
      }

      if (audioEnabled && newestOrder.id !== lastProcessedOrderId.current) {
        // Only play if the new order is actually newer than our last seen
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(e => console.log('Audio notification blocked by browser. Click anywhere to enable.', e));
        lastProcessedOrderId.current = newestOrder.id;
      }
    }
  }, [orders, audioEnabled]);

  const toggleAudio = () => {
    const nextState = !audioEnabled;
    setAudioEnabled(nextState);
    if (nextState) {
      // Play a test sound to "unlock" audio in the browser
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(e => console.log('Audio test failed:', e));
    }
  };

  useEffect(() => {
    if (!selectedShop) return;

    const q = query(
      collection(db, 'shops', selectedShop.id, 'orders'), 
      where('status', 'in', ['pending', 'preparing'])
    );
    const unsubscribeOrders = onSnapshot(
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

  const handleGlobalEspressoClick = async () => {
    if (!selectedShop) return;
    let shotsToSubtract = 2;
    const promises = [];

    for (const order of orders) {
      if (shotsToSubtract <= 0) break;
      if (order.barista_espresso_shots_needed > 0) {
        const subtractFromThisOrder = Math.min(order.barista_espresso_shots_needed, shotsToSubtract);
        promises.push(updateDoc(doc(db, 'shops', selectedShop.id, 'orders', order.id), {
          barista_espresso_shots_needed: order.barista_espresso_shots_needed - subtractFromThisOrder
        }));
        shotsToSubtract -= subtractFromThisOrder;
      }
    }
    
    if (promises.length > 0) {
      try {
        await Promise.all(promises);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `shops/${selectedShop.id}/orders`);
      }
    }
  };

  const handleMilkClick = async (orderId: string) => {
    if (!selectedShop) return;
    try {
      await updateDoc(doc(db, 'shops', selectedShop.id, 'orders', orderId), {
        barista_milk_needed: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `shops/${selectedShop.id}/orders/${orderId}`);
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
    <div className="flex-1 flex flex-col h-full transition-colors duration-300">
      <div className="flex justify-end mb-4 px-2">
        <button
          onClick={toggleAudio}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${
            audioEnabled 
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shadow-sm hover:translate-y-[-1px]' 
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500 border border-slate-200 dark:border-slate-700 grayscale'
          }`}
        >
          {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          <div className="flex flex-col items-start leading-none">
            <span className="text-[10px] uppercase font-black opacity-60">Barista Alerts</span>
            <span className="text-sm uppercase tracking-wider">{audioEnabled ? 'Sound ON' : 'Sound OFF'}</span>
          </div>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-6 h-full flex-1">
        {/* Espresso Column */}
        <div className="bg-slate-100 dark:bg-slate-900 rounded-xl p-2 sm:p-4 flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
          <h2 className="text-lg sm:text-2xl font-black text-slate-800 dark:text-white mb-2 sm:mb-4 text-center bg-white dark:bg-slate-800 py-2 rounded-lg shadow-sm flex flex-col transition-colors">
            <span>ESPRESSO</span>
            {totalPendingShots > 0 && (
              <div className="flex flex-col items-center mt-2">
                <span className="text-5xl sm:text-7xl font-black text-amber-700 dark:text-amber-500 leading-none">{totalPendingShots}</span>
                <span className="text-sm sm:text-base text-amber-600 dark:text-amber-400 font-bold uppercase tracking-widest mt-1">Total Shots</span>
              </div>
            )}
          </h2>
          <div className="flex-1 overflow-y-auto space-y-2 sm:space-y-3 pr-1">
            {totalPendingShots > 0 ? (
              Array.from({ length: Math.ceil(totalPendingShots / 2) }).map((_, idx) => (
                <button
                  key={`espresso-${idx}`}
                  onClick={handleGlobalEspressoClick}
                  className="w-full bg-amber-900 dark:bg-amber-800 hover:bg-amber-950 dark:hover:bg-amber-700 text-white p-4 sm:p-6 rounded-xl shadow-md flex items-center justify-center transition-transform active:scale-95 relative overflow-hidden"
                >
                  <Coffee className="w-10 h-10 sm:w-14 sm:h-14 shrink-0" />
                  <span className="text-3xl sm:text-4xl font-black ml-3">= 2</span>
                </button>
              ))
            ) : (
              <div className="text-center text-slate-400 dark:text-slate-600 py-8 text-sm sm:text-base">No espresso pending</div>
            )}
          </div>
        </div>

        {/* Milk Column */}
        <div className="bg-slate-100 dark:bg-slate-900 rounded-xl p-2 sm:p-4 flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm mb-2 sm:mb-4 p-2 flex flex-col transition-colors">
            <h2 className="text-lg sm:text-2xl font-black text-slate-800 dark:text-white text-center">MILK</h2>
            {Object.keys(milkCounts).length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mt-2">
                {Object.entries(milkCounts).map(([type, count]) => (
                  <div key={type} className={`px-2 py-1 rounded-md font-bold text-xs sm:text-sm flex items-center gap-1.5 ${(milkColors[type as MilkType] || 'bg-slate-500 text-white').split(' hover:')[0]}`}>
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
                className={`w-full p-4 sm:p-8 rounded-xl shadow-md flex items-center justify-center transition-transform active:scale-95 relative overflow-hidden ${milkColors[order.milk_type as MilkType] || 'bg-slate-500 text-white'}`}
              >
                <div className="absolute top-0 right-0 bg-amber-500 text-white px-3 py-1.5 rounded-bl-lg font-black z-10 text-sm sm:text-base">
                  #{order.queueIndex}
                </div>
                <div className="flex flex-col items-center z-10 relative">
                  <div className="flex items-center gap-2">
                    {settings.isSizeSelectionEnabled && (
                      <span className={`px-2 py-0.5 rounded text-lg sm:text-xl font-black shadow-sm border border-white/20 ${sizeColors[order.size || 'Medium'] || 'bg-slate-500 text-white'}`}>
                        {order.size?.[0] || 'S'}
                      </span>
                    )}
                    <span className="font-bold text-xl sm:text-2xl uppercase tracking-wider opacity-90">{order.drink_name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-normal text-xl sm:text-2xl uppercase tracking-wider">{order.milk_type}</span>
                    {order.extra_shot > 0 && (
                      <span className="bg-purple-600 text-white px-2 py-0.5 rounded font-black text-xs uppercase animate-pulse">
                        Extra Shot
                      </span>
                    )}
                  </div>
                  {order.custom_options && Object.entries(order.custom_options).map(([key, value]) => {
                    if (!value) return null;
                    return (
                      <span key={key} className="font-black text-xs sm:text-sm uppercase tracking-widest mt-1 bg-white/20 px-2 py-0.5 rounded-md border border-white/10">
                        {key.replace(/_/g, ' ')}: {typeof value === 'boolean' ? 'YES' : value}
                      </span>
                    );
                  })}
                </div>
              </button>
            ))}
            {pendingMilkOrders.length === 0 && (
              <div className="text-center text-slate-400 dark:text-slate-600 py-8 text-sm sm:text-base">No milk pending</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


