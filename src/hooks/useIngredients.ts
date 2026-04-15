import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useShop } from '../contexts/ShopContext';

export interface Ingredient {
  id: string;
  name: string;
  color: string;
  category?: string;
}

export const defaultIngredients: Ingredient[] = [
  { id: 'espresso', name: 'Espresso Shot', color: '#451a03', category: 'Drinks' },
  { id: 'leite', name: 'Milk', color: '#fef3c7', category: 'Drinks' },
  { id: 'hot_water', name: 'Hot Water', color: '#cffafe', category: 'Drinks' },
  { id: 'foam', name: 'Foam', color: '#ffffff', category: 'Drinks' },
  { id: 'chocolate', name: 'Chocolate', color: '#422006', category: 'Drinks' },
  { id: 'chai', name: 'Chai', color: '#b45309', category: 'Drinks' },
  { id: 'whipped_cream', name: 'Whipped Cream', color: '#f1f5f9', category: 'Drinks' },
  { id: 'sprinkles', name: 'Sprinkles', color: 'transparent', category: 'Drinks' },
  { id: 'ice', name: 'Ice', color: 'transparent', category: 'Drinks' },
  { id: 'black_tea', name: 'Black Tea', color: '#431407', category: 'Drinks' },
  { id: 'green_tea', name: 'Green Tea', color: '#3f6212', category: 'Drinks' },
  { id: 'condensed_milk', name: 'Condensed Milk', color: '#fef08a', category: 'Drinks' },
  { id: 'biscuit', name: 'Biscuit', color: '#d97706', category: 'Drinks' },
];

export function useIngredients() {
  const { selectedShop } = useShop();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);

  useEffect(() => {
    if (!selectedShop) return;

    const unsubscribe = onSnapshot(collection(db, 'shops', selectedShop.id, 'ingredients'), (snapshot) => {
      if (snapshot.empty) {
        defaultIngredients.forEach(ing => {
          setDoc(doc(db, 'shops', selectedShop.id, 'ingredients', ing.id), ing);
        });
      } else {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ingredient));
        setIngredients(data);
      }
    });
    return () => unsubscribe();
  }, [selectedShop]);

  return ingredients;
}
