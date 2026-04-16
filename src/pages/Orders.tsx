import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Drink, MilkType, OperationType, DrinkSize, AppSettings, Shop, CustomOption } from '../types';
import { handleFirestoreError } from '../lib/firestore-error';
import { DrinkVisualizer } from '../components/DrinkVisualizer';
import { Minus, Plus, CheckCircle2, X, Settings2 } from 'lucide-react';
import { useShop } from '../contexts/ShopContext';

interface CartItem {
  quantity: number;
  milk: MilkType;
  sugar: number;
  equal: number;
  extraShot: number;
  syrup: string;
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
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [configModal, setConfigModal] = useState<{
    drink: Drink;
    step: number;
    selections: {
      size: DrinkSize;
      milk: MilkType;
      sugar: number;
      equal: number;
      extraShot: number;
      syrup: string;
      notes: string;
    };
  } | null>(null);
  const [syrups, setSyrups] = useState<{id: string, name: string}[]>([]);
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

    const unsubscribeSyrups = onSnapshot(
      collection(db, 'shops', selectedShop.id, 'syrups'),
      (snapshot) => {
        const syrupsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as {id: string, name: string}[];
        setSyrups(syrupsData);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `shops/${selectedShop.id}/syrups`)
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
      unsubscribeSyrups();
      unsubscribeSettings();
    };
  }, [selectedShop, selectedCategory]);

  const toggleSizeSelection = async () => {
    if (!selectedShop) return;
    try {
      await setDoc(doc(db, 'shops', selectedShop.id, 'settings', 'app'), {
        isSizeSelectionEnabled: !settings.isSizeSelectionEnabled
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `shops/${selectedShop.id}/settings/app`);
    }
  };

  const getEnabledSteps = (drink: Drink) => {
    const steps = [];
    if (settings.isSizeSelectionEnabled && drink.enabledConfigurations?.size !== false) steps.push('size');
    if (drink.enabledConfigurations?.milk !== false && drink.leite) steps.push('milk');
    
    const hasSugar = drink.enabledConfigurations?.sugar !== false;
    const hasEqual = drink.enabledConfigurations?.equal;
    if (hasSugar || hasEqual) steps.push('sweetener');
    
    if (drink.enabledConfigurations?.extra_shot) steps.push('extra_shot');
    if (drink.enabledConfigurations?.syrup) steps.push('syrup');
    
    // Add custom options
    customOptions.forEach(opt => {
      if (drink.enabledConfigurations?.[opt.id]) {
        steps.push(`custom_${opt.id}`);
      }
    });

    steps.push('notes');
    return steps;
  };

  const handleDrinkClick = (drink: Drink) => {
    const enabledSteps = getEnabledSteps(drink);
    if (enabledSteps.length > 1 || (enabledSteps.length === 1 && enabledSteps[0] !== 'notes')) {
      setConfigModal({
        drink,
        step: 0,
        selections: {
          size: 'Medium',
          milk: 'full cream',
          sugar: 0,
          equal: 0,
          extraShot: 0,
          syrup: '',
          notes: '',
          custom_options: {}
        }
      });
    } else {
      addToCart(drink, {
        size: 'Medium',
        milk: 'full cream',
        sugar: 0,
        equal: 0,
        extraShot: 0,
        syrup: '',
        notes: '',
        custom_options: {}
      });
    }
  };

  const addToCart = (drink: Drink, selections: any) => {
    const customOptionsKey = JSON.stringify(selections.custom_options || {});
    const cartKey = `${drink.id}-${selections.size}-${selections.milk}-${selections.sugar}-${selections.equal}-${selections.extraShot}-${selections.syrup}-${selections.notes}-${customOptionsKey}`;
    setCart(prev => {
      const current = prev[cartKey];
      const nextQty = (current?.quantity || 0) + 1;
      
      return { 
        ...prev, 
        [cartKey]: { 
          drinkId: drink.id,
          quantity: nextQty, 
          ...selections
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

  const updateCartCustomization = (cartKey: string, field: 'milk' | 'sugar' | 'equal' | 'extraShot' | 'syrup' | 'notes' | 'custom_options', value: any) => {
    setCart(prev => {
      if (!prev[cartKey]) return prev;
      return {
        ...prev,
        [cartKey]: {
          ...prev[cartKey],
          [field]: value
        }
      };
    });
  };

  const totalItems = (Object.values(cart) as CartItem[]).reduce((a, b) => a + b.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || totalItems === 0 || !selectedShop) return;

    try {
      const promises = [];
      for (const [cartKey, item] of Object.entries(cart) as [string, CartItem][]) {
        const drink = drinks.find(d => d.id === item.drinkId);
        if (!drink) continue;

        for (let i = 0; i < item.quantity; i++) {
          const isExtraShotSize = settings.isSizeSelectionEnabled && (item.size === 'Medium' || item.size === 'Large');
          const finalShots = (drink.espresso_shots || 0) + (isExtraShotSize ? 1 : 0) + (item.extraShot || 0);
          
          // Create a modified snapshot to reflect the extra shot in the recipe and visualizer
          const modifiedSnapshot = {
            ...drink,
            espresso_shots: finalShots,
            layer_order: [...(drink.layer_order || [])]
          };

          // If extra shots added (size or manual), insert additional 'espresso' layers into the recipe
          const totalExtraShots = (isExtraShotSize ? 1 : 0) + (item.extraShot || 0);
          for (let s = 0; s < totalExtraShots; s++) {
            const firstEspressoIndex = modifiedSnapshot.layer_order.indexOf('espresso');
            if (firstEspressoIndex !== -1) {
              modifiedSnapshot.layer_order.splice(firstEspressoIndex, 0, 'espresso');
            } else {
              modifiedSnapshot.layer_order.push('espresso');
            }
          }

          promises.push(addDoc(collection(db, 'shops', selectedShop.id, 'orders'), {
            customer_name: customerName,
            drink_id: drink.id,
            drink_name: drink.name,
            drink_snapshot: modifiedSnapshot,
            milk_type: drink.leite ? item.milk : 'full cream',
            size: settings.isSizeSelectionEnabled ? item.size : 'Medium',
            notes: item.notes || '',
            sugar: item.sugar,
            equal: item.equal || 0,
            extra_shot: item.extraShot || 0,
            syrup: item.syrup || '',
            custom_options: item.custom_options || {},
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

      {/* Sequential Configuration Modal */}
      {configModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setConfigModal(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all border border-transparent dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                Configure {configModal.drink.name}
              </h3>
              <button onClick={() => setConfigModal(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-500 dark:text-slate-400" />
              </button>
            </div>

            <div className="mb-8">
              {(() => {
                const enabledSteps = getEnabledSteps(configModal.drink);
                const currentStepType = enabledSteps[configModal.step];

                return (
                  <div className="space-y-6">
                    <div className="flex justify-center mb-4">
                      <div className="w-24 h-32 bg-black rounded-lg flex items-center justify-center overflow-hidden border border-slate-800">
                        <DrinkVisualizer drink={configModal.drink} className="scale-[0.6] origin-center" />
                      </div>
                    </div>

                    <div className="text-center">
                      <span className="text-xs font-black uppercase tracking-widest text-amber-600 dark:text-amber-500">
                        Step {configModal.step + 1} of {enabledSteps.length}
                      </span>
                      <h4 className="text-xl font-bold text-slate-900 dark:text-white capitalize">
                        {currentStepType === 'sweetener' 
                          ? 'Sweetener' 
                          : currentStepType.startsWith('custom_') 
                            ? customOptions.find(o => o.id === currentStepType.replace('custom_', ''))?.name 
                            : currentStepType}
                      </h4>
                    </div>

                    <div className="min-h-[120px] flex items-center justify-center">
                      {currentStepType === 'size' && (
                        <div className="grid grid-cols-2 gap-3 w-full">
                          {(['Piccolo', 'Small', 'Medium', 'Large'] as DrinkSize[]).map((size) => (
                            <button
                              key={size}
                              onClick={() => setConfigModal({
                                ...configModal,
                                selections: { ...configModal.selections, size }
                              })}
                              className={`py-3 rounded-xl font-bold text-lg transition-all border-2 ${
                                configModal.selections.size === size
                                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                                  : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      )}

                      {currentStepType === 'milk' && (
                        <div className="grid grid-cols-2 gap-3 w-full">
                          {(['full cream', 'lactose free', 'skinny', 'almond', 'oat', 'soy'] as MilkType[]).map((milk) => (
                            <button
                              key={milk}
                              onClick={() => setConfigModal({
                                ...configModal,
                                selections: { ...configModal.selections, milk }
                              })}
                              className={`py-3 rounded-xl font-bold text-sm transition-all border-2 capitalize ${
                                configModal.selections.milk === milk
                                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                                  : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {milk}
                            </button>
                          ))}
                        </div>
                      )}

                      {currentStepType === 'sweetener' && (
                        <div className="flex flex-col gap-6 w-full">
                          {configModal.drink.enabledConfigurations?.sugar !== false && (
                            <div className="flex flex-col items-center">
                              <span className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest">Sugar</span>
                              <div className="flex items-center space-x-8">
                                <button
                                  onClick={() => setConfigModal({
                                    ...configModal,
                                    selections: { 
                                      ...configModal.selections, 
                                      sugar: Math.max(0, configModal.selections.sugar - 1) 
                                    }
                                  })}
                                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors border border-slate-200 dark:border-slate-700"
                                >
                                  <Minus className="w-6 h-6 sm:w-8 sm:h-8" />
                                </button>
                                <span className="text-4xl sm:text-6xl font-black text-slate-900 dark:text-white w-16 sm:w-20 text-center">
                                  {configModal.selections.sugar}
                                </span>
                                <button
                                  onClick={() => setConfigModal({
                                    ...configModal,
                                    selections: { 
                                      ...configModal.selections, 
                                      sugar: configModal.selections.sugar + 1 
                                    }
                                  })}
                                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors border border-slate-200 dark:border-slate-700"
                                >
                                  <Plus className="w-6 h-6 sm:w-8 sm:h-8" />
                                </button>
                              </div>
                            </div>
                          )}
                          
                          {configModal.drink.enabledConfigurations?.equal && (
                            <div className="flex flex-col items-center">
                              <span className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest">Equal</span>
                              <div className="flex items-center space-x-8">
                                <button
                                  onClick={() => setConfigModal({
                                    ...configModal,
                                    selections: { 
                                      ...configModal.selections, 
                                      equal: Math.max(0, configModal.selections.equal - 1) 
                                    }
                                  })}
                                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors border border-slate-200 dark:border-slate-700"
                                >
                                  <Minus className="w-6 h-6 sm:w-8 sm:h-8" />
                                </button>
                                <span className="text-4xl sm:text-6xl font-black text-slate-900 dark:text-white w-16 sm:w-20 text-center">
                                  {configModal.selections.equal}
                                </span>
                                <button
                                  onClick={() => setConfigModal({
                                    ...configModal,
                                    selections: { 
                                      ...configModal.selections, 
                                      equal: configModal.selections.equal + 1 
                                    }
                                  })}
                                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors border border-slate-200 dark:border-slate-700"
                                >
                                  <Plus className="w-6 h-6 sm:w-8 sm:h-8" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {currentStepType === 'extra_shot' && (
                        <div className="flex flex-col items-center">
                          <span className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest">Extra Espresso Shots</span>
                          <div className="flex items-center space-x-8">
                            <button
                              onClick={() => setConfigModal({
                                ...configModal,
                                selections: { 
                                  ...configModal.selections, 
                                  extraShot: Math.max(0, configModal.selections.extraShot - 1) 
                                }
                              })}
                              className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors border border-slate-200 dark:border-slate-700"
                            >
                              <Minus className="w-8 h-8" />
                            </button>
                            <span className="text-6xl font-black text-slate-900 dark:text-white w-20 text-center">
                              {configModal.selections.extraShot}
                            </span>
                            <button
                              onClick={() => setConfigModal({
                                ...configModal,
                                selections: { 
                                  ...configModal.selections, 
                                  extraShot: configModal.selections.extraShot + 1 
                                }
                              })}
                              className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors border border-slate-200 dark:border-slate-700"
                            >
                              <Plus className="w-8 h-8" />
                            </button>
                          </div>
                        </div>
                      )}

                      {currentStepType.startsWith('custom_') && (() => {
                        const optId = currentStepType.replace('custom_', '');
                        const opt = customOptions.find(o => o.id === optId);
                        if (!opt) return null;

                        if (opt.type === 'switch') {
                          return (
                            <div className="flex flex-col items-center">
                              <button
                                onClick={() => setConfigModal({
                                  ...configModal,
                                  selections: {
                                    ...configModal.selections,
                                    custom_options: {
                                      ...configModal.selections.custom_options,
                                      [optId]: !configModal.selections.custom_options[optId]
                                    }
                                  }
                                })}
                                className={`w-24 h-24 rounded-2xl flex flex-col items-center justify-center transition-all border-4 ${
                                  configModal.selections.custom_options[optId]
                                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                                    : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                <span className="text-lg font-black uppercase">{configModal.selections.custom_options[optId] ? 'ON' : 'OFF'}</span>
                              </button>
                            </div>
                          );
                        }

                        if (opt.type === 'quantity') {
                          return (
                            <div className="flex items-center space-x-8">
                              <button
                                onClick={() => setConfigModal({
                                  ...configModal,
                                  selections: {
                                    ...configModal.selections,
                                    custom_options: {
                                      ...configModal.selections.custom_options,
                                      [optId]: Math.max(0, (configModal.selections.custom_options[optId] || 0) - 1)
                                    }
                                  }
                                })}
                                className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors border border-slate-200 dark:border-slate-700"
                              >
                                <Minus className="w-8 h-8" />
                              </button>
                              <span className="text-6xl font-black text-slate-900 dark:text-white w-20 text-center">
                                {configModal.selections.custom_options[optId] || 0}
                              </span>
                              <button
                                onClick={() => setConfigModal({
                                  ...configModal,
                                  selections: {
                                    ...configModal.selections,
                                    custom_options: {
                                      ...configModal.selections.custom_options,
                                      [optId]: (configModal.selections.custom_options[optId] || 0) + 1
                                    }
                                  }
                                })}
                                className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors border border-slate-200 dark:border-slate-700"
                              >
                                <Plus className="w-8 h-8" />
                              </button>
                            </div>
                          );
                        }

                        if (opt.type === 'list') {
                          return (
                            <div className="grid grid-cols-2 gap-3 w-full max-h-[300px] overflow-y-auto pr-2">
                              {opt.listOptions?.map((item) => (
                                <button
                                  key={item}
                                  onClick={() => setConfigModal({
                                    ...configModal,
                                    selections: {
                                      ...configModal.selections,
                                      custom_options: {
                                        ...configModal.selections.custom_options,
                                        [optId]: item
                                      }
                                    }
                                  })}
                                  className={`py-3 rounded-xl font-bold text-sm transition-all border-2 ${
                                    configModal.selections.custom_options[optId] === item
                                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                                      : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
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

                      {currentStepType === 'syrup' && (
                        <div className="grid grid-cols-2 gap-3 w-full max-h-[200px] overflow-y-auto pr-2">
                          <button
                            onClick={() => setConfigModal({
                              ...configModal,
                              selections: { ...configModal.selections, syrup: '' }
                            })}
                            className={`py-3 rounded-xl font-bold text-sm transition-all border-2 ${
                              configModal.selections.syrup === ''
                                ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                                : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            None
                          </button>
                          {syrups.map((syrup) => (
                            <button
                              key={syrup.id}
                              onClick={() => setConfigModal({
                                ...configModal,
                                selections: { ...configModal.selections, syrup: syrup.name }
                              })}
                              className={`py-3 rounded-xl font-bold text-sm transition-all border-2 ${
                                configModal.selections.syrup === syrup.name
                                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                                  : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {syrup.name}
                            </button>
                          ))}
                        </div>
                      )}

                      {currentStepType === 'notes' && (
                        <textarea
                          value={configModal.selections.notes}
                          onChange={(e) => setConfigModal({
                            ...configModal,
                            selections: { ...configModal.selections, notes: e.target.value }
                          })}
                          placeholder="Any special requests?"
                          className="w-full h-32 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                        />
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex gap-4">
              {configModal.step > 0 && (
                <button
                  onClick={prevStep}
                  className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={nextStep}
                className="flex-[2] py-4 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all active:scale-95 shadow-lg shadow-amber-600/20"
              >
                {configModal.step === getEnabledSteps(configModal.drink).length - 1 ? 'Add to Order' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 lg:p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex-1 flex flex-col transition-colors duration-300">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6 lg:mb-8 gap-4">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white text-center shrink-0">New Order</h2>
          
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
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-4 sm:space-y-6 lg:space-y-8 overflow-y-auto pr-2">
          <div className="shrink-0">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-base sm:text-lg lg:text-xl font-medium text-slate-700 dark:text-slate-300">Customer Name</label>
              <button 
                type="button" 
                onClick={() => { setCart({}); setCustomerName(''); }} 
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-bold px-3 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Clear Order
              </button>
            </div>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="block w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-amber-500 focus:ring-amber-500 text-base sm:text-lg lg:text-xl p-3 lg:p-4 border transition-colors"
              placeholder="Ex: John"
            />
          </div>

          <div className="flex-1 min-h-[200px] flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4 shrink-0">
              <label className="block text-base sm:text-lg lg:text-xl font-medium text-slate-700 dark:text-slate-300">Menu Items</label>
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 overflow-y-auto p-1 flex-1 pb-24">
              {displayedDrinks.map((drink) => {
                const drinkCartItems = (Object.entries(cart) as [string, CartItem][]).filter(([key, item]) => item.drinkId === drink.id);
                const isSelected = drinkCartItems.length > 0;
                
                return (
                <div
                  key={drink.id}
                  onClick={() => handleDrinkClick(drink)}
                  className={`rounded-xl border-2 p-3 sm:p-4 lg:p-6 flex flex-col justify-between transition-all cursor-pointer active:scale-[0.98] ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-md'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center space-x-3 sm:space-x-4 lg:space-x-6">
                    <div className="w-16 h-20 sm:w-20 sm:h-28 lg:w-24 lg:h-32 bg-black rounded-md flex items-center justify-center overflow-hidden shrink-0 border border-slate-800">
                      <DrinkVisualizer drink={drink} className="scale-[0.4] sm:scale-[0.55] lg:scale-[0.7] origin-center" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base lg:text-xl">{drink.name}</h3>
                      <p className="text-xs sm:text-sm lg:text-base text-slate-500 dark:text-slate-400">{drink.espresso_shots} shots</p>
                    </div>
                  </div>
                  
                  {drinkCartItems.map(([cartKey, cartItem]) => (
                    <div key={cartKey} className="mt-4 p-3 bg-white dark:bg-slate-800 rounded-lg border border-amber-200 dark:border-amber-900/50 shadow-sm space-y-3 transition-colors" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-2">
                        {settings.isSizeSelectionEnabled && (
                          <span className="font-black text-amber-600 dark:text-amber-500 uppercase text-xs tracking-widest">{cartItem.size}</span>
                        )}
                        <div className="flex items-center space-x-2">
                          <button 
                            type="button" 
                            onClick={() => updateCartQuantity(cartKey, -1)} 
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                          >
                            <Minus className="w-4 h-4 text-slate-600 dark:text-slate-400"/>
                          </button>
                          <span className="font-bold text-base w-6 text-center text-slate-900 dark:text-white">{cartItem.quantity}</span>
                          <button 
                            type="button" 
                            onClick={() => updateCartQuantity(cartKey, 1)} 
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                          >
                            <Plus className="w-4 h-4 text-slate-600 dark:text-slate-400"/>
                          </button>
                        </div>
                      </div>

                      {(() => {
                        const drink = drinks.find(d => d.id === cartItem.drinkId);
                        if (drink?.leite && drink?.enabledConfigurations?.milk !== false) {
                          return (
                            <div>
                              <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">Milk</label>
                              <select
                                value={cartItem.milk}
                                onChange={(e) => updateCartCustomization(cartKey, 'milk', e.target.value as MilkType)}
                                className="block w-full rounded-md border-slate-300 dark:border-slate-700 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-xs p-1.5 border bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors"
                              >
                                <option value="full cream">Full Cream</option>
                                <option value="lactose free">Lactose Free</option>
                                <option value="skinny">Skinny</option>
                                <option value="almond">Almond</option>
                                <option value="oat">Oat</option>
                                <option value="soy">Soy</option>
                              </select>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      
                      {(() => {
                        const drink = drinks.find(d => d.id === cartItem.drinkId);
                        if (drink?.enabledConfigurations?.sugar !== false) {
                          return (
                            <div>
                              <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">Sugar</label>
                              <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700 p-1 transition-colors">
                                <button
                                  type="button"
                                  onClick={() => updateCartCustomization(cartKey, 'sugar', Math.max(0, cartItem.sugar - 1))}
                                  className="p-1 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-sm flex-1 flex justify-center border border-slate-200 dark:border-slate-700"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="font-bold text-xs w-4 text-center text-slate-900 dark:text-white">{cartItem.sugar}</span>
                                <button
                                  type="button"
                                  onClick={() => updateCartCustomization(cartKey, 'sugar', cartItem.sugar + 1)}
                                  className="p-1 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-sm flex-1 flex justify-center border border-slate-200 dark:border-slate-700"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {(() => {
                        const drink = drinks.find(d => d.id === cartItem.drinkId);
                        if (drink?.enabledConfigurations?.equal) {
                          return (
                            <div>
                              <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">Equal</label>
                              <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700 p-1 transition-colors">
                                <button
                                  type="button"
                                  onClick={() => updateCartCustomization(cartKey, 'equal', Math.max(0, cartItem.equal - 1))}
                                  className="p-1 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-sm flex-1 flex justify-center border border-slate-200 dark:border-slate-700"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="font-bold text-xs w-4 text-center text-slate-900 dark:text-white">{cartItem.equal}</span>
                                <button
                                  type="button"
                                  onClick={() => updateCartCustomization(cartKey, 'equal', cartItem.equal + 1)}
                                  className="p-1 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-sm flex-1 flex justify-center border border-slate-200 dark:border-slate-700"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {cartItem.syrup && (
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">Syrup</label>
                          <div className="p-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-400 rounded-md border border-amber-200 dark:border-amber-800 text-xs font-bold uppercase text-center">
                            {cartItem.syrup}
                          </div>
                        </div>
                      )}
                      
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
          disabled={totalItems === 0 || !customerName}
          className="flex items-center justify-center py-4 px-8 border border-transparent rounded-full shadow-2xl text-xl font-bold text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all duration-150 ease-in-out transform hover:-translate-y-1"
        >
          SEND ({totalItems})
        </button>
      </div>
    </div>
  );
}

