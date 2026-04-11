import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface Ingredient {
  id: string;
  name: string;
  color: string;
}

export const defaultIngredients: Ingredient[] = [
  { id: 'espresso', name: 'Espresso Shot', color: '#451a03' },
  { id: 'leite', name: 'Milk', color: '#fef3c7' },
  { id: 'hot_water', name: 'Hot Water', color: '#cffafe' },
  { id: 'foam', name: 'Foam', color: '#ffffff' },
  { id: 'chocolate', name: 'Chocolate', color: '#422006' },
  { id: 'chai', name: 'Chai', color: '#b45309' },
  { id: 'whipped_cream', name: 'Whipped Cream', color: '#f1f5f9' },
  { id: 'sprinkles', name: 'Sprinkles', color: 'transparent' },
  { id: 'ice', name: 'Ice', color: 'transparent' },
  { id: 'black_tea', name: 'Black Tea', color: '#431407' },
  { id: 'green_tea', name: 'Green Tea', color: '#3f6212' },
  { id: 'condensed_milk', name: 'Condensed Milk', color: '#fef08a' },
  { id: 'biscuit', name: 'Biscuit', color: '#d97706' },
];

export function useIngredients() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'ingredients'), (snapshot) => {
      if (snapshot.empty) {
        defaultIngredients.forEach(ing => {
          setDoc(doc(db, 'ingredients', ing.id), ing);
        });
      } else {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ingredient));
        setIngredients(data);
      }
    });
    return () => unsubscribe();
  }, []);

  return ingredients;
}
