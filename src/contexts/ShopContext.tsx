import React, { createContext, useContext, useState, useEffect } from 'react';
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
    const savedShop = localStorage.getItem('selectedShop');
    if (savedShop) {
      try {
        setSelectedShop(JSON.parse(savedShop));
      } catch (e) {
        localStorage.removeItem('selectedShop');
      }
    }
  }, []);

  const selectShop = (shop: Shop) => {
    setSelectedShop(shop);
    localStorage.setItem('selectedShop', JSON.stringify(shop));
  };

  const logoutShop = () => {
    setSelectedShop(null);
    localStorage.removeItem('selectedShop');
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
