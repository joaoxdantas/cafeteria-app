import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Shop } from '../types';

interface ShopContextType {
  selectedShop: Shop | null;
  selectShop: (shop: Shop) => void;
  logoutShop: () => void;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);

  useEffect(() => {
    if (!selectedShop?.id) return;

    const unsubscribe = onSnapshot(doc(db, 'shops', selectedShop.id), (snapshot) => {
      if (snapshot.exists()) {
        const updatedShop = { id: snapshot.id, ...snapshot.data() } as Shop;
        setSelectedShop(updatedShop);
      }
    });

    return () => unsubscribe();
  }, [selectedShop?.id]);

  const selectShop = (shop: Shop) => {
    setSelectedShop(shop);
  };

  const logoutShop = () => {
    setSelectedShop(null);
  };

  return (
    <ShopContext.Provider value={{ selectedShop, selectShop, logoutShop }}>
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const context = useContext(ShopContext);
  if (context === undefined) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
}
