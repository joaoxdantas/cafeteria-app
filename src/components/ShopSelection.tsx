import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Shop, OperationType, Drink } from '../types';
import { handleFirestoreError } from '../lib/firestore-error';
import { useShop } from '../contexts/ShopContext';
import { useTheme } from '../contexts/ThemeContext';
import { Store, Plus, Trash2, LogIn, Coffee, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const sampleDrinks: Omit<Drink, 'id'>[] = [
  // ... (keep sampleDrinks as is)
];

export function ShopSelection() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [newShopName, setNewShopName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const { selectedShop, selectShop } = useShop();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const q = query(collection(db, 'shops'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const shopsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Shop[];

        if (shopsData.length === 0) {
          // Initialize default shops if none exist
          await initializeDefaultShops();
        } else {
          setShops(shopsData);
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'shops')
    );

    return () => unsubscribe();
  }, []);

  const initializeDefaultShops = async () => {
    const masterShop: Omit<Shop, 'id'> = {
      name: 'Master Shop',
      isMaster: true,
      createdAt: new Date().toISOString(),
    };
    const secondaryShop: Omit<Shop, 'id'> = {
      name: 'Secondary Shop',
      isMaster: false,
      createdAt: new Date().toISOString(),
    };

    try {
      const masterRef = await addDoc(collection(db, 'shops'), masterShop);
      const secondaryRef = await addDoc(collection(db, 'shops'), secondaryShop);

      // Add sample drinks to both
      await addSampleDrinksToShop(masterRef.id);
      await addSampleDrinksToShop(secondaryRef.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'shops');
    }
  };

  const addSampleDrinksToShop = async (shopId: string) => {
    const batch = writeBatch(db);
    sampleDrinks.forEach(drink => {
      const drinkRef = doc(collection(db, 'shops', shopId, 'drinks'));
      batch.set(drinkRef, drink);
    });
    await batch.commit();
  };

  const handleAddShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopName.trim()) return;

    try {
      const shopRef = await addDoc(collection(db, 'shops'), {
        name: newShopName.trim(),
        isMaster: false,
        createdAt: new Date().toISOString(),
      });
      
      // Add sample drinks to new shop too
      await addSampleDrinksToShop(shopRef.id);
      
      setNewShopName('');
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'shops');
    }
  };

  const handleDeleteShop = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this shop? All data will be lost.')) return;

    try {
      await deleteDoc(doc(db, 'shops', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `shops/${id}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors duration-300">
      <div className="absolute top-6 right-6">
        <button
          onClick={toggleTheme}
          className="p-3 rounded-full bg-white dark:bg-slate-900 shadow-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-amber-500 hover:scale-110 transition-all active:scale-95"
          title="Toggle Theme"
        >
          {theme === 'light' ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
        </button>
      </div>

      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-block p-4 bg-amber-500 rounded-3xl mb-6 shadow-2xl shadow-amber-500/20"
          >
            <Coffee className="w-12 h-12 text-white" />
          </motion.div>
          <h1 className="text-5xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">Welcome to AIS Cafe</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xl">Select your shop profile to continue</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence>
            {shops.map((shop) => (
              <motion.div
                key={shop.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => selectShop(shop)}
                className="group relative bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-8 cursor-pointer hover:border-amber-500 transition-all hover:shadow-2xl hover:shadow-amber-500/10"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl group-hover:bg-amber-500/10 transition-colors">
                      <Store className="w-8 h-8 text-slate-400 group-hover:text-amber-500" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{shop.name}</h3>
                      <span className={`text-xs font-black uppercase tracking-widest px-2 py-1 rounded ${shop.isMaster ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                        {shop.isMaster ? 'Master Profile' : 'Standard Profile'}
                      </span>
                    </div>
                  </div>
                  <LogIn className="w-6 h-6 text-slate-400 dark:text-slate-600 group-hover:text-amber-500 transition-colors" />
                </div>

                {selectedShop?.isMaster && !shop.isMaster && (
                  <button
                    onClick={(e) => handleDeleteShop(shop.id, e)}
                    className="absolute top-4 right-4 p-2 text-slate-400 dark:text-slate-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </motion.div>
            ))}

            {selectedShop?.isMaster && (
              <motion.div
                layout
                className="md:col-span-2"
              >
                {!isAdding ? (
                  <button
                    onClick={() => setIsAdding(true)}
                    className="w-full py-6 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-3xl text-slate-400 dark:text-slate-500 hover:text-amber-500 hover:border-amber-500 transition-all flex items-center justify-center gap-2 font-bold"
                  >
                    <Plus className="w-6 h-6" />
                    Add New Shop Profile
                  </button>
                ) : (
                  <form onSubmit={handleAddShop} className="bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-3xl p-8 flex gap-4 shadow-xl">
                    <input
                      autoFocus
                      type="text"
                      value={newShopName}
                      onChange={(e) => setNewShopName(e.target.value)}
                      placeholder="Enter shop name..."
                      className="flex-1 bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-6 text-slate-900 dark:text-white text-lg focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="submit"
                      className="bg-amber-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-amber-600 transition-colors"
                    >
                      Create Shop
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
