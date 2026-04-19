import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Item, Supplier, Transaction, EspressoTest, Language, ItemHandling, MaintenanceRecord, DrinkRecipe } from '../types';

export const useStore = () => {
  const [items, setItemsState] = useState<Item[]>([]);
  const [suppliers, setSuppliersState] = useState<Supplier[]>([]);
  const [transactions, setTransactionsState] = useState<Transaction[]>([]);
  const [espressoTests, setEspressoTestsState] = useState<EspressoTest[]>([]);
  const [maintenanceRecords, setMaintenanceRecordsState] = useState<MaintenanceRecord[]>([]);
  const [drinkRecipes, setDrinkRecipesState] = useState<DrinkRecipe[]>([]);
  const [handlings, setHandlingsState] = useState<ItemHandling[]>([]);
  const [language, setLanguageState] = useState<Language>('en-AU');
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const [syncError, setSyncError] = useState<string>('');

  useEffect(() => {
    const handleSyncError = (e: any) => setSyncError(e.detail || 'Failed to sync to cloud.');
    window.addEventListener('firebase-sync-error', handleSyncError);
    return () => window.removeEventListener('firebase-sync-error', handleSyncError);
  }, []);

  useEffect(() => {
    const savedLang = localStorage.getItem('cafe_language') as Language;
    if (savedLang) setLanguageState(savedLang);

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setIsLoaded(true);
        // Clear local state on logout
        setItemsState([]);
        setSuppliersState([]);
        setTransactionsState([]);
        setEspressoTestsState([]);
        setMaintenanceRecordsState([]);
        setDrinkRecipesState([]);
        setHandlingsState([]);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Listeners
  useEffect(() => {
    if (!user) return;

    setSyncError(''); // Clear errors on new user payload
    const userDocRef = doc(db, 'users', user.uid);
    const unsubItems = onSnapshot(collection(userDocRef, 'items'), snap => setItemsState(snap.docs.map(d => d.data() as Item)));
    const unsubSuppliers = onSnapshot(collection(userDocRef, 'suppliers'), snap => setSuppliersState(snap.docs.map(d => d.data() as Supplier)));
    const unsubTransactions = onSnapshot(collection(userDocRef, 'transactions'), snap => setTransactionsState(snap.docs.map(d => d.data() as Transaction)));
    const unsubEspresso = onSnapshot(collection(userDocRef, 'espresso'), snap => setEspressoTestsState(snap.docs.map(d => d.data() as EspressoTest)));
    const unsubMaintenance = onSnapshot(collection(userDocRef, 'maintenance'), snap => setMaintenanceRecordsState(snap.docs.map(d => d.data() as MaintenanceRecord)));
    const unsubRecipes = onSnapshot(collection(userDocRef, 'recipes'), snap => setDrinkRecipesState(snap.docs.map(d => d.data() as DrinkRecipe)));
    const unsubHandlings = onSnapshot(collection(userDocRef, 'handlings'), snap => setHandlingsState(snap.docs.map(d => d.data() as ItemHandling)));

    // Set loaded after a short delay to allow first fetches to arrive
    setTimeout(() => setIsLoaded(true), 500);

    return () => {
      unsubItems(); unsubSuppliers(); unsubTransactions(); unsubEspresso(); unsubMaintenance(); unsubRecipes(); unsubHandlings();
    };
  }, [user]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('cafe_language', lang);
  }, []);

  const createFirebaseSetter = useCallback(<T extends { id: string }>(subCollection: string, setState: React.Dispatch<React.SetStateAction<T[]>>) => {
    return (updater: T[] | ((prev: T[]) => T[])) => {
      setState((prev) => {
        const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
        
        if (user) {
          const syncToFirebase = async () => {
            try {
              const ref = collection(doc(db, 'users', user.uid), subCollection);
              const currentIds = new Set(prev.map(i => i.id));
              const nextIds = new Set(next.map((i: T) => i.id));
              
              // Determine what to delete and what to add/update
              const toDelete = Array.from(currentIds).filter(id => !nextIds.has(id));
              const toSet = next;
              
              const MAX_BATCH_SIZE = 400; // Safe margin below 500
              
              // Process deletions in chunks
              for (let i = 0; i < toDelete.length; i += MAX_BATCH_SIZE) {
                const chunk = toDelete.slice(i, i + MAX_BATCH_SIZE);
                const batch = writeBatch(db);
                chunk.forEach(id => batch.delete(doc(ref, id)));
                await batch.commit();
              }
              
              // Process sets in chunks
              for (let i = 0; i < toSet.length; i += MAX_BATCH_SIZE) {
                const chunk = toSet.slice(i, i + MAX_BATCH_SIZE);
                const batch = writeBatch(db);
                chunk.forEach(item => batch.set(doc(ref, item.id), item));
                await batch.commit();
              }
            } catch (err: any) {
              console.error(`Firebase sync failed for ${subCollection}:`, err);
              // Dispatch to the UI
              let errorMessage = err.message;
              if (errorMessage.includes('Missing or insufficient permissions')) {
                 errorMessage = "Permission Denied: Please update your Firestore Security Rules to allow access, or ensure you clicked 'Create Database' in Firebase.";
              }
              window.dispatchEvent(new CustomEvent('firebase-sync-error', { detail: errorMessage }));
            }
          };
          
          syncToFirebase();
        }
        
        return next;
      });
    };
  }, [user]);

  const setItems = useCallback((updater: any) => createFirebaseSetter('items', setItemsState)(updater), [createFirebaseSetter]);
  const setSuppliers = useCallback((updater: any) => createFirebaseSetter('suppliers', setSuppliersState)(updater), [createFirebaseSetter]);
  const setTransactions = useCallback((updater: any) => createFirebaseSetter('transactions', setTransactionsState)(updater), [createFirebaseSetter]);
  const setEspressoTests = useCallback((updater: any) => createFirebaseSetter('espresso', setEspressoTestsState)(updater), [createFirebaseSetter]);
  const setMaintenanceRecords = useCallback((updater: any) => createFirebaseSetter('maintenance', setMaintenanceRecordsState)(updater), [createFirebaseSetter]);
  const setDrinkRecipes = useCallback((updater: any) => createFirebaseSetter('recipes', setDrinkRecipesState)(updater), [createFirebaseSetter]);
  const setHandlings = useCallback((updater: any) => createFirebaseSetter('handlings', setHandlingsState)(updater), [createFirebaseSetter]);

  return {
    isLoaded,
    user,
    syncError,
    items, setItems,
    suppliers, setSuppliers,
    transactions, setTransactions,
    espressoTests, setEspressoTests,
    maintenanceRecords, setMaintenanceRecords,
    drinkRecipes, setDrinkRecipes,
    handlings, setHandlings,
    language, setLanguage,
  };
};
