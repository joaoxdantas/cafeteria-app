import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, doc, setDoc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Drink, MilkType, OperationType, DrinkSize, AppSettings, Shop, CustomOption } from '../types';
import { handleFirestoreError } from '../lib/firestore-error';
import { DrinkVisualizer } from '../components/DrinkVisualizer';
import { motion } from 'motion/react';
import { Minus, Plus, CheckCircle2, X, Settings2, TrendingUp, Zap } from 'lucide-react';
import { useShop } from '../contexts/ShopContext';

interface CartItem {
  quantity: number;
  milk: MilkType;
  sugar: number;
  equal: number;
  extraShot: number;
  notes: string;
  size: DrinkSize;
  drinkId: string;
  custom_options: Record<string, any>;
}

export function Orders() {
  const { selectedShop } = useShop();
  const [categories, setCategories] = useState<string[]>(['Drinks']);
  const [selectedCategory, setSelectedCategory] = useState('Drinks');
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [customOptions, setCustomOptions] = useState<CustomOption[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [configModal, setConfigModal] = useState<{
    drink: Drink;
    step: number;
    selections: {
      notes: string;
      custom_options: Record<string, any>;
    };
  } | null>(null);
  const [settings, setSettings] = useState<AppSettings>({ isSizeSelectionEnabled: true });

  useEffect(() => {
    if (!selectedShop) return;

    const unsubscribeShop = onSnapshot(doc(db, 'shops', selectedShop.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Shop;
        if (data.categories && data.categories.length > 0) {
          setCategories(data.categories);
          if (!data.categories.includes(selectedCategory)) {
            setSelectedCategory(data.categories[0]);
          }
        } else {
          setCategories(['Drinks']);
        }
        setCustomOptions(data.customOptions || []);
      }
    });

    const unsubscribeDrinks = onSnapshot(
      collection(db, 'shops', selectedShop.id, 'drinks'),
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
        
        const availableDrinks = drinksData.filter(d => d.available !== false);
        setDrinks(availableDrinks);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `shops/${selectedShop.id}/drinks`)
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
      unsubscribeShop();
      unsubscribeDrinks();
      unsubscribeSettings();
    };
  }, [selectedShop, selectedCategory]);

  const toggleSizeSelection = async () => {
    if (!selectedShop) return;
    try {
      await setDoc(doc(db, 'shops', selectedShop.id, 'settings', 'app'), {
        ...settings,
        isSizeSelectionEnabled: !settings.isSizeSelectionEnabled
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `shops/${selectedShop.id}/settings/app`);
    }
  };

  const toggleFastPaceMode = async () => {
    if (!selectedShop) return;
    try {
      await setDoc(doc(db, 'shops', selectedShop.id, 'settings', 'app'), {
        ...settings,
        isFastPaceModeEnabled: !settings.isFastPaceModeEnabled
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `shops/${selectedShop.id}/settings/app`);
    }
  };

  const getNextDailyOrderNumber = async (shopId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const counterRef = doc(db, 'shops', shopId, 'counters', today);
    
    try {
      return await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let nextNumber = 1;
        
        if (counterDoc.exists()) {
          nextNumber = counterDoc.data().lastNumber + 1;
        }
        
        transaction.set(counterRef, { lastNumber: nextNumber });
        return nextNumber.toString().padStart(3, '0');
      });
    } catch (error) {
      console.error('Failed to get next order number:', error);
      return '???';
    }
  };

  const getEnabledSteps = (drink: Drink) => {
    const steps = [];

    const legacyMap: Record<string, string> = {
      'legacy_milk': 'milk',
      'legacy_sugar': 'sugar',
      'legacy_equal': 'equal',
      'legacy_size': 'size',
      'legacy_extra_shot': 'extra_shot'
    };

    // Add custom options
    let addedSweetener = false;
    customOptions.forEach(opt => {
      // Check if global size selection is disabled
      if (opt.id === 'legacy_size' && !settings.isSizeSelectionEnabled) return;

      const oldKey = legacyMap[opt.id];
      const isEnabled = drink.enabledConfigurations?.[opt.id] === true || 
                       (oldKey && drink.enabledConfigurations?.[oldKey] === true);

      if (isEnabled) {
        if (opt.id === 'legacy_sugar' || opt.id === 'legacy_equal') {
          if (!addedSweetener) {
            steps.push('sweetener');
            addedSweetener = true;
          }
        } else {
          steps.push(`custom_${opt.id}`);
        }
      }
    });

    steps.push('notes');
    return steps;
  };

  const handleDrinkClick = (drink: Drink) => {
    const enabledSteps = getEnabledSteps(drink);
    
    const customOptionsDefaults: Record<string, any> = {};
    customOptions.forEach(opt => {
      if (opt.id === 'legacy_milk') customOptionsDefaults[opt.id] = 'Full Cream';
      else if (opt.id === 'legacy_size') customOptionsDefaults[opt.id] = 'Medium';
      else if (opt.id === 'legacy_sugar') customOptionsDefaults[opt.id] = 0;
      else if (opt.id === 'legacy_equal') customOptionsDefaults[opt.id] = 0;
      else if (opt.id === 'legacy_extra_shot') customOptionsDefaults[opt.id] = 0;
      else if (opt.type === 'switch') customOptionsDefaults[opt.id] = false;
      else if (opt.type === 'quantity') customOptionsDefaults[opt.id] = 0;
    });

    if (enabledSteps.length > 1 || (enabledSteps.length === 1 && enabledSteps[0] !== 'notes')) {
      setConfigModal({
        drink,
        step: 0,
        selections: {
          notes: '',
          custom_options: customOptionsDefaults
        }
      });
    } else {
      addToCart(drink, {
        notes: '',
        custom_options: customOptionsDefaults
      });
    }
  };

  const addToCart = (drink: Drink, selections: any) => {
    const customOptionsKey = JSON.stringify(selections.custom_options || {});
    // Simplified cart key
    const cartKey = `${drink.id}-${selections.notes}-${customOptionsKey}`;
    setCart(prev => {
      const current = prev[cartKey];
      const nextQty = (current?.quantity || 0) + 1;
      
      return { 
        ...prev, 
        [cartKey]: { 
          drinkId: drink.id,
          quantity: nextQty, 
          ...selections,
          // Backward compatibility shim for CartItem type if needed
          milk: selections.custom_options['legacy_milk'] || 'full cream',
          size: selections.custom_options['legacy_size'] || 'Medium',
          sugar: selections.custom_options['legacy_sugar'] || 0,
          equal: selections.custom_options['legacy_equal'] || 0,
          extraShot: selections.custom_options['legacy_extra_shot'] || 0,
        } 
      };
    });
    setConfigModal(null);
  };

  const nextStep = () => {
    if (!configModal) return;
    const enabledSteps = getEnabledSteps(configModal.drink);
    if (configModal.step < enabledSteps.length - 1) {
      setConfigModal({ ...configModal, step: configModal.step + 1 });
    } else {
      addToCart(configModal.drink, configModal.selections);
    }
  };

  const prevStep = () => {
    if (!configModal || configModal.step === 0) return;
    setConfigModal({ ...configModal, step: configModal.step - 1 });
  };

  const updateCartQuantity = (cartKey: string, delta: number) => {
    setCart(prev => {
      const current = prev[cartKey];
      if (!current) return prev;
      
      const nextQty = Math.max(0, current.quantity + delta);
      
      if (nextQty === 0) {
        const copy = { ...prev };
        delete copy[cartKey];
        return copy;
      }
      
      return { 
        ...prev, 
        [cartKey]: { ...current, quantity: nextQty } 
      };
    });
  };

  const updateCartCustomization = (cartKey: string, field: 'notes' | 'custom_options', value: any) => {
    setCart(prev => {
      if (!prev[cartKey]) return prev;
      const updatedItem = {
        ...prev[cartKey],
        [field]: value
      };
      
      // Update shim values if custom_options changed
      if (field === 'custom_options') {
        updatedItem.milk = value['legacy_milk'] || 'full cream';
        updatedItem.size = value['legacy_size'] || 'Medium';
        updatedItem.sugar = value['legacy_sugar'] || 0;
        updatedItem.equal = value['legacy_equal'] || 0;
        updatedItem.extraShot = value['legacy_extra_shot'] || 0;
      }

      return {
        ...prev,
        [cartKey]: updatedItem
      };
    });
  };

  const totalItems = (Object.values(cart) as CartItem[]).reduce((a, b) => a + b.quantity, 0);

  const handleImmediateSend = async (drink: Drink, selections: any, useManualDetails: boolean = false) => {
    if (!selectedShop || isSending) return;
    
    let finalCustomerName = '';
    let finalTableNumber = '';

    if (useManualDetails) {
      if (!customerName.trim()) {
        alert('Please enter customer name first');
        return;
      }
      finalCustomerName = customerName;
      finalTableNumber = tableNumber;
    } else {
      setIsSending(true);
      try {
        finalCustomerName = await getNextDailyOrderNumber(selectedShop.id);
        finalTableNumber = 'Fast Pace';
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `shops/${selectedShop.id}/orders`);
        setIsSending(false);
        return;
      }
    }

    setIsSending(true);
    try {
      const size = selections.custom_options['legacy_size'] || 'Medium';
      const milk = selections.custom_options['legacy_milk'] || 'full cream';
      const sugar = selections.custom_options['legacy_sugar'] || 0;
      const equal = selections.custom_options['legacy_equal'] || 0;
      const extraShot = selections.custom_options['legacy_extra_shot'] || 0;

      const isExtraShotSize = settings.isSizeSelectionEnabled && (size === 'Medium' || size === 'Large');
      const finalShots = (drink.espresso_shots || 0) + (isExtraShotSize ? 1 : 0) + extraShot;
      
      const modifiedSnapshot = {
        ...drink,
        espresso_shots: finalShots,
        layer_order: [...(drink.layer_order || [])]
      };

      const totalExtraShots = (isExtraShotSize ? 1 : 0) + extraShot;
      for (let s = 0; s < totalExtraShots; s++) {
        const firstEspressoIndex = modifiedSnapshot.layer_order.indexOf('espresso');
        if (firstEspressoIndex !== -1) {
          modifiedSnapshot.layer_order.splice(firstEspressoIndex, 0, 'espresso');
        } else {
          modifiedSnapshot.layer_order.push('espresso');
        }
      }

      const namedCustomOptions: Record<string, any> = {};
      if (selections.custom_options) {
        Object.entries(selections.custom_options).forEach(([optId, value]) => {
          if (optId.startsWith('legacy_')) return;
          const optDef = customOptions.find(o => o.id === optId);
          if (optDef) namedCustomOptions[optDef.name] = value;
          else namedCustomOptions[optId] = value;
        });
      }

      await addDoc(collection(db, 'shops', selectedShop.id, 'orders'), {
        customer_name: finalCustomerName,
        table_number: finalTableNumber,
        drink_id: drink.id,
        drink_name: drink.name,
        drink_snapshot: modifiedSnapshot,
        milk_type: milk as MilkType,
        size: size as DrinkSize,
        sugar: sugar,
        equal: equal,
        extraShot: extraShot,
        notes: selections.notes || '',
        custom_options: namedCustomOptions,
        status: 'pending',
        timestamp: serverTimestamp(),
        barista_espresso_shots_needed: finalShots,
        barista_milk_needed: drink.leite
      });

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setConfigModal(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `shops/${selectedShop.id}/orders`);
    } finally {
      setIsSending(false);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || totalItems === 0 || !selectedShop || isSending) return;

    setIsSending(true);
    try {
      const promises = [];
      for (const [cartKey, item] of Object.entries(cart) as [string, CartItem][]) {
        const drink = drinks.find(d => d.id === item.drinkId);
        if (!drink) continue;

        for (let i = 0; i < item.quantity; i++) {
          const size = item.custom_options['legacy_size'] || 'Medium';
          const milk = item.custom_options['legacy_milk'] || 'full cream';
          const sugar = item.custom_options['legacy_sugar'] || 0;
          const equal = item.custom_options['legacy_equal'] || 0;
          const extraShot = item.custom_options['legacy_extra_shot'] || 0;

          const isExtraShotSize = settings.isSizeSelectionEnabled && (size === 'Medium' || size === 'Large');
          const finalShots = (drink.espresso_shots || 0) + (isExtraShotSize ? 1 : 0) + extraShot;
          
          // Create a modified snapshot to reflect the extra shot in the recipe and visualizer
          const modifiedSnapshot = {
            ...drink,
            espresso_shots: finalShots,
            layer_order: [...(drink.layer_order || [])]
          };

          // If extra shots added (size or manual), insert additional 'espresso' layers into the recipe
          const totalExtraShots = (isExtraShotSize ? 1 : 0) + extraShot;
          for (let s = 0; s < totalExtraShots; s++) {
            const firstEspressoIndex = modifiedSnapshot.layer_order.indexOf('espresso');
            if (firstEspressoIndex !== -1) {
              modifiedSnapshot.layer_order.splice(firstEspressoIndex, 0, 'espresso');
            } else {
              modifiedSnapshot.layer_order.push('espresso');
            }
          }

          const namedCustomOptions: Record<string, any> = {};
          if (item.custom_options) {
            Object.entries(item.custom_options).forEach(([optId, value]) => {
              // Skip legacy ones in named options as they have their own fields
              if (optId.startsWith('legacy_')) return;
              
              const optDef = customOptions.find(o => o.id === optId);
              if (optDef) {
                namedCustomOptions[optDef.name] = value;
              } else {
                namedCustomOptions[optId] = value;
              }
            });
          }

          promises.push(addDoc(collection(db, 'shops', selectedShop.id, 'orders'), {
            customer_name: customerName,
            table_number: tableNumber,
            drink_id: drink.id,
            drink_name: drink.name,
            drink_snapshot: modifiedSnapshot,
            milk_type: milk.toLowerCase(),
            size: size,
            notes: item.notes || '',
            sugar: sugar,
            equal: equal,
            extra_shot: extraShot,
            custom_options: namedCustomOptions,
            barista_espresso_shots_needed: finalShots,
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
      handleFirestoreError(error, OperationType.CREATE, `shops/${selectedShop.id}/orders`);
    } finally {
      setIsSending(false);
    }
  };

  const displayedDrinks = drinks.filter(d => (d.category || 'Drinks') === selectedCategory);

  return (
    <div className="flex-1 flex flex-col h-full w-full max-w-none relative transition-colors duration-300">
      {showSuccess && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center space-x-2 z-50 animate-bounce">
          <CheckCircle2 className="w-6 h-6" />
          <span className="font-bold text-lg">Orders sent successfully!</span>
        </div>
      )}

      {configModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm" onClick={() => setConfigModal(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] p-4 sm:p-6 transform transition-all border border-transparent dark:border-slate-800 overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 sm:mb-6 shrink-0">
              <div className="flex items-center space-x-3">
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">
                  {settings.isFastPaceModeEnabled ? <Zap className="w-6 h-6 text-amber-500 inline mr-2" /> : null}
                  {settings.isFastPaceModeEnabled ? 'Fast-Pace Order:' : 'Configure'} {configModal.drink.name}
                </h3>
              </div>
              <button onClick={() => setConfigModal(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-500 dark:text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
              {(() => {
                const enabledSteps = getEnabledSteps(configModal.drink);
                
                const renderStepContent = (stepType: string, isCompact: boolean = false) => {
                  return (
                    <div key={stepType} className={`${isCompact ? 'p-2' : 'p-4'} bg-slate-50 dark:bg-slate-800/50 rounded-xl ${!isCompact ? 'mb-3' : ''} flex flex-col border border-slate-100 dark:border-slate-800`}>
                      <h4 className={`${isCompact ? 'text-[10px]' : 'text-xs sm:text-sm'} font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ${isCompact ? 'mb-1' : 'mb-4'}`}>
                        {stepType.startsWith('custom_') 
                          ? customOptions.find(o => o.id === stepType.replace('custom_', ''))?.name 
                          : stepType === 'sweetener' ? 'Sweetener'
                          : stepType === 'notes' ? 'Additional Notes' : stepType}
                      </h4>
                      
                      <div className="flex items-center justify-center w-full flex-1">
                        {stepType === 'sweetener' && (
                          <div className={`flex flex-col ${isCompact ? 'gap-1' : 'gap-6'} w-full`}>
                            {(configModal.drink.enabledConfigurations?.legacy_sugar || configModal.drink.enabledConfigurations?.sugar) && (
                              <div className="flex flex-col items-center">
                                <span className={`${isCompact ? 'text-[8px]' : 'text-[10px]'} font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-widest`}>Sugar</span>
                                <div className={`flex items-center ${isCompact ? 'space-x-1' : 'space-x-8'}`}>
                                  <button
                                    onClick={() => setConfigModal({
                                      ...configModal,
                                      selections: { ...configModal.selections, custom_options: { ...configModal.selections.custom_options, legacy_sugar: Math.max(0, (configModal.selections.custom_options.legacy_sugar || 0) - 1) } }
                                    })}
                                    className={`${isCompact ? 'w-7 h-7' : 'w-12 h-12'} rounded-full bg-white dark:bg-slate-900 flex items-center justify-center border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm`}
                                  >
                                    <Minus className={`${isCompact ? 'w-3 h-3' : 'w-6 h-6'}`} />
                                  </button>
                                  <span className={`${isCompact ? 'text-lg w-5' : 'text-4xl w-16'} font-black text-slate-900 dark:text-white text-center`}>
                                    {configModal.selections.custom_options.legacy_sugar || 0}
                                  </span>
                                  <button
                                    onClick={() => setConfigModal({
                                      ...configModal,
                                      selections: { ...configModal.selections, custom_options: { ...configModal.selections.custom_options, legacy_sugar: (configModal.selections.custom_options.legacy_sugar || 0) + 1 } }
                                    })}
                                    className={`${isCompact ? 'w-7 h-7' : 'w-12 h-12'} rounded-full bg-white dark:bg-slate-900 flex items-center justify-center border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm`}
                                  >
                                    <Plus className={`${isCompact ? 'w-3 h-3' : 'w-6 h-6'}`} />
                                  </button>
                                </div>
                              </div>
                            )}
                            
                            {(configModal.drink.enabledConfigurations?.legacy_equal || configModal.drink.enabledConfigurations?.equal) && (
                              <div className="flex flex-col items-center">
                                <span className={`${isCompact ? 'text-[8px]' : 'text-[10px]'} font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-widest`}>Equal</span>
                                <div className={`flex items-center ${isCompact ? 'space-x-1' : 'space-x-8'}`}>
                                  <button
                                    onClick={() => setConfigModal({
                                      ...configModal,
                                      selections: { ...configModal.selections, custom_options: { ...configModal.selections.custom_options, legacy_equal: Math.max(0, (configModal.selections.custom_options.legacy_equal || 0) - 1) } }
                                    })}
                                    className={`${isCompact ? 'w-7 h-7' : 'w-12 h-12'} rounded-full bg-white dark:bg-slate-900 flex items-center justify-center border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm`}
                                  >
                                    <Minus className={`${isCompact ? 'w-3 h-3' : 'w-6 h-6'}`} />
                                  </button>
                                  <span className={`${isCompact ? 'text-lg w-5' : 'text-4xl w-16'} font-black text-slate-900 dark:text-white text-center`}>
                                    {configModal.selections.custom_options.legacy_equal || 0}
                                  </span>
                                  <button
                                    onClick={() => setConfigModal({
                                      ...configModal,
                                      selections: { ...configModal.selections, custom_options: { ...configModal.selections.custom_options, legacy_equal: (configModal.selections.custom_options.legacy_equal || 0) + 1 } }
                                    })}
                                    className={`${isCompact ? 'w-7 h-7' : 'w-12 h-12'} rounded-full bg-white dark:bg-slate-900 flex items-center justify-center border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm`}
                                  >
                                    <Plus className={`${isCompact ? 'w-3 h-3' : 'w-6 h-6'}`} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {stepType.startsWith('custom_') && (() => {
                          const optId = stepType.replace('custom_', '');
                          const opt = customOptions.find(o => o.id === optId);
                          if (!opt) return null;
                          const val = configModal.selections.custom_options[optId];

                          if (opt.type === 'switch') {
                            return (
                              <button
                                onClick={() => setConfigModal({
                                  ...configModal,
                                  selections: { ...configModal.selections, custom_options: { ...configModal.selections.custom_options, [optId]: !val } }
                                })}
                                className={`w-full py-4 rounded-xl border-2 font-black transition-all active:scale-95 ${
                                  val 
                                    ? 'bg-amber-100 border-amber-500 text-amber-900 shadow-sm' 
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500'
                                }`}
                              >
                                {val ? 'YES' : 'NO'}
                              </button>
                            );
                          } else if (opt.type === 'quantity') {
                            return (
                              <div className={`flex items-center ${isCompact ? 'space-x-1.5' : 'space-x-8'}`}>
                                <button
                                  onClick={() => setConfigModal({
                                    ...configModal,
                                    selections: { ...configModal.selections, custom_options: { ...configModal.selections.custom_options, [optId]: Math.max(0, (val || 0) - 1) } }
                                  })}
                                  className={`${isCompact ? 'w-7 h-7' : 'w-12 h-12'} rounded-full bg-white dark:bg-slate-900 flex items-center justify-center border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm`}
                                >
                                  <Minus className={`${isCompact ? 'w-3 h-3' : 'w-6 h-6'}`} />
                                </button>
                                <span className={`${isCompact ? 'text-lg w-5' : 'text-3xl sm:text-4xl w-16'} font-black text-slate-900 dark:text-white text-center`}>{val || 0}</span>
                                <button
                                  onClick={() => setConfigModal({
                                    ...configModal,
                                    selections: { ...configModal.selections, custom_options: { ...configModal.selections.custom_options, [optId]: (val || 0) + 1 } }
                                  })}
                                  className={`${isCompact ? 'w-7 h-7' : 'w-12 h-12'} rounded-full bg-white dark:bg-slate-900 flex items-center justify-center border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm`}
                                >
                                  <Plus className={`${isCompact ? 'w-3 h-3' : 'w-6 h-6'}`} />
                                </button>
                              </div>
                            );
                          } else if (opt.type === 'list') {
                            return (
                              <div className={`${isCompact ? 'flex flex-col gap-1 overflow-y-auto max-h-[140px]' : 'grid grid-cols-2 sm:grid-cols-3 gap-2'} w-full`}>
                                {(opt.listOptions || []).map(item => (
                                  <button
                                    key={item}
                                    onClick={() => setConfigModal({
                                      ...configModal,
                                      selections: { ...configModal.selections, custom_options: { ...configModal.selections.custom_options, [optId]: item } }
                                    })}
                                    className={`py-2 px-2 rounded-lg border-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                                      val === item
                                        ? 'bg-amber-100 border-amber-500 text-amber-900 shadow-sm'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-amber-200'
                                    }`}
                                  >
                                    {item}
                                  </button>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {stepType === 'notes' && (
                          <textarea
                            value={configModal.selections.notes}
                            onChange={(e) => setConfigModal({
                              ...configModal,
                              selections: { ...configModal.selections, notes: e.target.value }
                            })}
                            placeholder="Any special requests?"
                            className="w-full h-20 bg-white dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white transition-colors text-sm"
                          />
                        )}
                      </div>
                    </div>
                  );
                };

                const itemsOnOneLine = ['sweetener', 'custom_legacy_extra_shot', ...enabledSteps.filter(s => s.toLowerCase().includes('syrup'))];

                // Chunk steps into rows to respect order while grouping compact items
                const layoutRows: string[][] = [];
                let currentRow: string[] = [];

                enabledSteps.forEach((step) => {
                  const isStepCompact = itemsOnOneLine.includes(step);
                  
                  if (isStepCompact) {
                    if (currentRow.length > 0 && itemsOnOneLine.includes(currentRow[0]) && currentRow.length < 3) {
                      currentRow.push(step);
                    } else {
                      if (currentRow.length > 0) layoutRows.push(currentRow);
                      currentRow = [step];
                    }
                  } else {
                    if (currentRow.length > 0) layoutRows.push(currentRow);
                    layoutRows.push([step]);
                    currentRow = [];
                  }
                });
                if (currentRow.length > 0) layoutRows.push(currentRow);

                return (
                  <div className="space-y-3">
                     {layoutRows.map((row, rowIdx) => {
                       const isCompactRow = itemsOnOneLine.includes(row[0]);
                       if (isCompactRow) {
                         return (
                           <div key={rowIdx} className={`grid ${row.length === 1 ? 'grid-cols-1' : row.length === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-3 mb-1`}>
                              {row.map(step => renderStepContent(step, true))}
                           </div>
                         );
                       }
                       return renderStepContent(row[0], false);
                     })}
                  </div>
                );
              })()}
            </div>

            <div className="flex gap-3 shrink-0 pt-4 border-t border-slate-100 dark:border-slate-800 flex-row">
              <button
                onClick={() => addToCart(configModal.drink, configModal.selections)}
                className="flex-1 py-4 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all active:scale-95 shadow-lg shadow-amber-600/20 flex items-center justify-center text-sm"
              >
                Add to Order
              </button>

              <button
                onClick={() => handleImmediateSend(configModal.drink, configModal.selections, !settings.isFastPaceModeEnabled)}
                disabled={isSending}
                className="flex-[2] py-4 bg-green-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-green-700 transition-all active:scale-95 shadow-lg shadow-green-600/20 disabled:opacity-50 flex items-center justify-center px-4"
              >
                {isSending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 p-3 sm:p-6 lg:p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex-1 flex flex-col transition-colors duration-300">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-2 sm:mb-6 lg:mb-8 gap-2 sm:gap-4">
          <h2 className="text-xl sm:text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white text-center shrink-0">New Order</h2>
          
          <div className="flex items-center space-x-3 bg-slate-100 dark:bg-slate-800 p-2 rounded-full px-4 border border-slate-200 dark:border-slate-700 shadow-inner">
            <Settings2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Size Selection</span>
            <button
              onClick={toggleSizeSelection}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                settings.isSizeSelectionEnabled ? 'bg-amber-600' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.isSizeSelectionEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center space-x-3 bg-slate-100 dark:bg-slate-800 p-2 rounded-full px-4 border border-slate-200 dark:border-slate-700 shadow-inner">
            <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Fast Pace</span>
            <button
              onClick={toggleFastPaceMode}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                settings.isFastPaceModeEnabled ? 'bg-amber-600' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.isFastPaceModeEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-4 sm:space-y-6 lg:space-y-8 overflow-y-auto pr-2">
          <div className="shrink-0">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-base sm:text-lg lg:text-xl font-medium text-slate-700 dark:text-slate-300">Customer Details</label>
              <button 
                type="button" 
                onClick={() => { setCart({}); setCustomerName(''); }} 
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-bold px-3 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Clear Order
              </button>
            </div>
            <div className="flex gap-4">
              <div className="w-1/3">
                <input
                  type="text"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="block w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-amber-500 focus:ring-amber-500 text-base sm:text-lg lg:text-xl p-3 lg:p-4 border transition-colors"
                  placeholder="Table #"
                />
              </div>
              <div className="w-2/3">
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="block w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-amber-500 focus:ring-amber-500 text-base sm:text-lg lg:text-xl p-3 lg:p-4 border transition-colors"
                  placeholder="Customer Name (Ex: John)"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-[200px] flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 sm:mb-4 gap-2 sm:gap-4 shrink-0">
              <label className="block text-sm sm:text-lg lg:text-xl font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wide">Menu Items</label>
              <div className="flex flex-wrap gap-1 sm:gap-2">
                {categories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-bold transition-colors ${
                      selectedCategory === cat 
                        ? 'bg-amber-600 text-white shadow-sm' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 lg:gap-6 overflow-y-auto p-1 flex-1 pb-24">
              {displayedDrinks.map((drink) => {
                const drinkCartItems = (Object.entries(cart) as [string, CartItem][]).filter(([key, item]) => item.drinkId === drink.id);
                const isSelected = drinkCartItems.length > 0;
                
                return (
                <div
                  key={drink.id}
                  onClick={() => handleDrinkClick(drink)}
                  className={`rounded-xl border-2 p-2 sm:p-3 lg:p-6 flex flex-col justify-between transition-all cursor-pointer active:scale-[0.98] ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-md'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-6">
                    <div className="w-12 h-16 sm:w-16 sm:h-20 lg:w-24 lg:h-32 bg-black rounded-md flex items-center justify-center overflow-hidden shrink-0 border border-slate-800">
                      <DrinkVisualizer drink={drink} className="scale-[0.3] sm:scale-[0.45] lg:scale-[0.7] origin-center" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm lg:text-xl leading-tight">{drink.name}</h3>
                      <p className="text-[10px] sm:text-xs lg:text-base text-slate-500 dark:text-slate-400">{drink.espresso_shots} shots</p>
                    </div>
                  </div>
                  
                  {drinkCartItems.map(([cartKey, cartItem]) => (
                    <div key={cartKey} className="mt-2 sm:mt-4 p-2 lg:p-3 bg-white dark:bg-slate-800 rounded-lg border border-amber-200 dark:border-amber-900/50 shadow-sm space-y-2 sm:space-y-3 transition-colors" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-1.5 sm:pb-2">
                        {settings.isSizeSelectionEnabled && (
                          <span className="font-black text-amber-600 dark:text-amber-500 uppercase text-[10px] sm:text-xs tracking-widest">{cartItem.size}</span>
                        )}
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <button 
                            type="button" 
                            onClick={() => updateCartQuantity(cartKey, -1)} 
                            className="p-0.5 sm:p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                          >
                            <Minus className="w-3 h-3 sm:w-4 h-4 text-slate-600 dark:text-slate-400"/>
                          </button>
                          <span className="font-bold text-sm sm:text-base w-4 sm:w-6 text-center text-slate-900 dark:text-white">{cartItem.quantity}</span>
                          <button 
                            type="button" 
                            onClick={() => updateCartQuantity(cartKey, 1)} 
                            className="p-0.5 sm:p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                          >
                            <Plus className="w-3 h-3 sm:w-4 h-4 text-slate-600 dark:text-slate-400"/>
                          </button>
                        </div>
                      </div>

                      {customOptions.map((opt) => {
                        const isEnabled = drinks.find(d => d.id === cartItem.drinkId)?.enabledConfigurations?.[opt.id] === true ||
                                        drinks.find(d => d.id === cartItem.drinkId)?.enabledConfigurations?.[opt.id === 'legacy_milk' ? 'milk' :
                                                                                    opt.id === 'legacy_sugar' ? 'sugar' :
                                                                                    opt.id === 'legacy_equal' ? 'equal' :
                                                                                    opt.id === 'legacy_size' ? 'size' :
                                                                                    opt.id === 'legacy_extra_shot' ? 'extra_shot' : ''] === true;

                        if (!cartItem.drinkId || !isEnabled) return null;

                        const val = cartItem.custom_options[opt.id];
                        
                        if (opt.type === 'switch') {
                          return (
                            <div key={opt.id}>
                              <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">{opt.name}</label>
                              <button
                                type="button"
                                onClick={() => updateCartCustomization(cartKey, 'custom_options', { ...cartItem.custom_options, [opt.id]: !val })}
                                className={`w-full p-1.5 rounded-md border text-xs font-bold uppercase transition-colors ${
                                  val 
                                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-400 border-amber-200 dark:border-amber-800' 
                                    : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-500 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                {val ? 'YES' : 'NO'}
                              </button>
                            </div>
                          );
                        }

                        if (opt.type === 'quantity') {
                          return (
                            <div key={opt.id}>
                              <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">{opt.name}</label>
                              <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700 p-1 transition-colors">
                                <button
                                  type="button"
                                  onClick={() => updateCartCustomization(cartKey, 'custom_options', { ...cartItem.custom_options, [opt.id]: Math.max(0, (val || 0) - 1) })}
                                  className="p-1 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-sm flex-1 flex justify-center border border-slate-200 dark:border-slate-700"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="font-bold text-xs w-4 text-center text-slate-900 dark:text-white">{val || 0}</span>
                                <button
                                  type="button"
                                  onClick={() => updateCartCustomization(cartKey, 'custom_options', { ...cartItem.custom_options, [opt.id]: (val || 0) + 1 })}
                                  className="p-1 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-sm flex-1 flex justify-center border border-slate-200 dark:border-slate-700"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        }

                        if (opt.type === 'list') {
                          return (
                            <div key={opt.id}>
                              <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">{opt.name}</label>
                              <select
                                value={val || ''}
                                onChange={(e) => updateCartCustomization(cartKey, 'custom_options', { ...cartItem.custom_options, [opt.id]: e.target.value })}
                                className="block w-full rounded-md border-slate-300 dark:border-slate-700 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-xs p-1.5 border bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors"
                              >
                                {opt.listOptions?.map(item => (
                                  <option key={item} value={item}>{item}</option>
                                ))}
                              </select>
                            </div>
                          );
                        }

                        return null;
                      })}

                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">Notes</label>
                        <input
                          type="text"
                          value={cartItem.notes}
                          onChange={(e) => updateCartCustomization(cartKey, 'notes', e.target.value)}
                          className="block w-full rounded-md border-slate-300 dark:border-slate-700 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-xs p-1.5 border bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors"
                          placeholder="Notes..."
                        />
                      </div>
                    </div>
                  ))}
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
          disabled={totalItems === 0 || !customerName || isSending}
          className="flex items-center justify-center py-4 px-8 border border-transparent rounded-full shadow-2xl text-xl font-bold text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all duration-150 ease-in-out transform hover:-translate-y-1 min-w-[160px]"
        >
          {isSending ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center"
            >
              <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin mr-3" />
              SENDING...
            </motion.div>
          ) : (
            `SEND (${totalItems})`
          )}
        </button>
      </div>
    </div>
  );
}

