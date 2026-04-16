import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, setDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Drink, OperationType, Shop, CustomOption, CustomOptionType } from '../types';
import { DrinkVisualizer } from '../components/DrinkVisualizer';
import { OrderHistory } from '../components/OrderHistory';
import { handleFirestoreError } from '../lib/firestore-error';
import { Trash2, Plus, ArrowUp, ArrowDown, History, Coffee, Edit2, X, Eye, EyeOff, Beaker, Store, Settings2, CheckCircle2, Upload } from 'lucide-react';
import { motion } from 'motion/react';
import { useIngredients } from '../hooks/useIngredients';
import { useShop } from '../contexts/ShopContext';

function getContrastYIQ(hexcolor: string){
  if (!hexcolor || hexcolor === 'transparent') return 'black';
  hexcolor = hexcolor.replace("#", "");
  if (hexcolor.length === 3) hexcolor = hexcolor.split('').map(c => c+c).join('');
  if (hexcolor.length !== 6) return 'black';
  var r = parseInt(hexcolor.substr(0,2),16);
  var g = parseInt(hexcolor.substr(2,2),16);
  var b = parseInt(hexcolor.substr(4,2),16);
  var yiq = ((r*299)+(g*587)+(b*114))/1000;
  return (yiq >= 128) ? 'black' : 'white';
}

export function Admin() {
  const { selectedShop } = useShop();
  const ingredients = useIngredients();
  const [categories, setCategories] = useState<string[]>(['Drinks']);
  const [selectedCategory, setSelectedCategory] = useState('Drinks');
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [name, setName] = useState('');
  const [layers, setLayers] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'drinks' | 'history' | 'ingredients' | 'shops' | 'configs' | 'settings'>('drinks');
  const [editingDrinkId, setEditingDrinkId] = useState<string | null>(null);
  const [editingShopName, setEditingShopName] = useState('');
  const [editingSplashUrl, setEditingSplashUrl] = useState('');
  const [editingShopIdInList, setEditingShopIdInList] = useState<string | null>(null);
  const [tempShopName, setTempShopName] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [enabledConfigs, setEnabledConfigs] = useState<Record<string, boolean>>({
    milk: true,
    sugar: true,
    equal: true,
    syrup: true,
    size: true,
    extra_shot: true
  });

  const [customOptions, setCustomOptions] = useState<CustomOption[]>([]);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionType, setNewOptionType] = useState<CustomOptionType>('switch');
  const [newOptionListItems, setNewOptionListItems] = useState<string[]>([]);
  const [newListItem, setNewListItem] = useState('');

  const [syrups, setSyrups] = useState<{id: string, name: string}[]>([]);
  const [newSyrupName, setNewSyrupName] = useState('');

  const [newIngName, setNewIngName] = useState('');
  const [newIngColor, setNewIngColor] = useState('#ff0000');
  const [newShopName, setNewShopName] = useState('');

  useEffect(() => {
    if (!selectedShop) return;

    setEditingShopName(selectedShop.name);
    setEditingSplashUrl(selectedShop.splashImageUrl || '');

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
        
        setDrinks(drinksData);
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

    let unsubscribeShops = () => {};
    if (selectedShop.isMaster) {
      const q = query(collection(db, 'shops'), orderBy('createdAt', 'asc'));
      unsubscribeShops = onSnapshot(
        q,
        (snapshot) => {
          const shopsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Shop[];
          setShops(shopsData);
        },
        (error) => handleFirestoreError(error, OperationType.LIST, 'shops')
      );
    }

    return () => {
      unsubscribeShop();
      unsubscribeDrinks();
      unsubscribeSyrups();
      unsubscribeShops();
    };
  }, [selectedShop, selectedCategory]);

  const handleNewCategory = () => {
    setNewCategoryName('');
    setCategoryError('');
    setShowNewCategoryModal(true);
  };

  const submitNewCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName || !newCategoryName.trim()) return;
    const trimmedName = newCategoryName.trim();
    if (categories.includes(trimmedName)) {
      setCategoryError('Category already exists!');
      return;
    }
    if (!selectedShop) return;
    try {
      await updateDoc(doc(db, 'shops', selectedShop.id), {
        categories: [...categories, trimmedName]
      });
      setSelectedCategory(trimmedName);
      setShowNewCategoryModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `shops/${selectedShop.id}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500000) { // ~500KB limit for Firestore safety (base64 overhead)
      alert("File is too large. Please use an image smaller than 500KB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditingSplashUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateShopSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop || !editingShopName.trim()) return;

    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'shops', selectedShop.id), {
        name: editingShopName.trim(),
        splashImageUrl: editingSplashUrl.trim()
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `shops/${selectedShop.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCustomOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOptionName || !selectedShop) return;
    
    const optionData: CustomOption = {
      id: editingOptionId || Math.random().toString(36).substr(2, 9),
      name: newOptionName,
      type: newOptionType,
      listOptions: newOptionType === 'list' ? newOptionListItems : undefined
    };

    try {
      let updatedOptions;
      if (editingOptionId) {
        updatedOptions = customOptions.map(o => o.id === editingOptionId ? optionData : o);
      } else {
        updatedOptions = [...customOptions, optionData];
      }

      await updateDoc(doc(db, 'shops', selectedShop.id), {
        customOptions: updatedOptions
      });
      setNewOptionName('');
      setNewOptionType('switch');
      setNewOptionListItems([]);
      setNewListItem('');
      setEditingOptionId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `shops/${selectedShop.id}`);
    }
  };

  const handleEditCustomOption = (option: CustomOption) => {
    setEditingOptionId(option.id);
    setNewOptionName(option.name);
    setNewOptionType(option.type);
    setNewOptionListItems(option.listOptions || []);
    setNewListItem('');
  };

  const handleCancelEditOption = () => {
    setEditingOptionId(null);
    setNewOptionName('');
    setNewOptionType('switch');
    setNewOptionListItems([]);
    setNewListItem('');
  };

  const handleDeleteCustomOption = async (optionId: string) => {
    if (!selectedShop) return;
    try {
      await updateDoc(doc(db, 'shops', selectedShop.id), {
        customOptions: customOptions.filter(o => o.id !== optionId)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `shops/${selectedShop.id}`);
    }
  };

  const addListItem = () => {
    if (!newListItem.trim()) return;
    setNewOptionListItems([...newOptionListItems, newListItem.trim()]);
    setNewListItem('');
  };

  const removeListItem = (index: number) => {
    setNewOptionListItems(newOptionListItems.filter((_, i) => i !== index));
  };

  const handleAddSyrup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSyrupName || !selectedShop) return;
    try {
      await addDoc(collection(db, 'shops', selectedShop.id, 'syrups'), {
        name: newSyrupName
      });
      setNewSyrupName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `shops/${selectedShop.id}/syrups`);
    }
  };

  const handleDeleteSyrup = async (id: string) => {
    if (!selectedShop) return;
    try {
      await deleteDoc(doc(db, 'shops', selectedShop.id, 'syrups', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `shops/${selectedShop.id}/syrups/${id}`);
    }
  };

  const handleAddShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopName.trim()) return;
    try {
      await addDoc(collection(db, 'shops'), {
        name: newShopName.trim(),
        isMaster: false,
        createdAt: new Date().toISOString(),
      });
      setNewShopName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'shops');
    }
  };

  const handleDeleteShop = async (id: string) => {
    if (id === selectedShop?.id) {
      alert("You cannot delete the shop you are currently logged into.");
      return;
    }
    if (!window.confirm('Are you sure? This will delete the shop profile.')) return;
    try {
      await deleteDoc(doc(db, 'shops', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `shops/${id}`);
    }
  };

  const handleEditShopName = async (shopId: string, currentName: string) => {
    setEditingShopIdInList(shopId);
    setTempShopName(currentName);
  };

  const submitEditShopName = async (shopId: string) => {
    if (!tempShopName.trim()) return;
    try {
      await updateDoc(doc(db, 'shops', shopId), {
        name: tempShopName.trim()
      });
      setEditingShopIdInList(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `shops/${shopId}`);
    }
  };

  const addLayer = (type: string) => {
    setLayers([...layers, type]);
  };

  const removeLayer = (index: number) => {
    setLayers(layers.filter((_, i) => i !== index));
  };

  const moveLayer = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newLayers = [...layers];
      [newLayers[index - 1], newLayers[index]] = [newLayers[index], newLayers[index - 1]];
      setLayers(newLayers);
    } else if (direction === 'down' && index < layers.length - 1) {
      const newLayers = [...layers];
      [newLayers[index + 1], newLayers[index]] = [newLayers[index], newLayers[index + 1]];
      setLayers(newLayers);
    }
  };

  const currentDrinkPreview: Partial<Drink> = {
    layer_order: layers,
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || layers.length === 0 || !selectedShop) {
      alert("Please add a name and at least one ingredient.");
      return;
    }

    const espresso_shots = layers.filter(l => l === 'espresso').length;
    const leite = layers.includes('leite');
    const hot_water = layers.includes('hot_water');
    const foam = Math.min(layers.filter(l => l === 'foam').length, 3);
    const chocolate = Math.min(layers.filter(l => l === 'chocolate').length, 3);
    const sprinkles = layers.includes('sprinkles');
    const chai = Math.min(layers.filter(l => l === 'chai').length, 3);
    const whipped_cream = layers.includes('whipped_cream');

    try {
      const drinkData = {
        name,
        espresso_shots,
        leite,
        hot_water,
        foam,
        chocolate,
        sprinkles,
        chai,
        whipped_cream,
        layer_order: layers,
        enabledConfigurations: enabledConfigs
      };

      if (editingDrinkId) {
        await updateDoc(doc(db, 'shops', selectedShop.id, 'drinks', editingDrinkId), drinkData);
        setEditingDrinkId(null);
      } else {
        await addDoc(collection(db, 'shops', selectedShop.id, 'drinks'), {
          ...drinkData,
          category: selectedCategory,
          createdAt: new Date().toISOString(),
          sortOrder: drinks.length,
          available: true,
        });
      }
      
      setName('');
      setLayers([]);
      const defaults: Record<string, boolean> = {
        milk: true,
        sugar: true,
        equal: true,
        syrup: true,
        size: true,
        extra_shot: true
      };
      customOptions.forEach(opt => {
        defaults[opt.id] = true;
      });
      setEnabledConfigs(defaults);
    } catch (error) {
      handleFirestoreError(error, editingDrinkId ? OperationType.UPDATE : OperationType.CREATE, `shops/${selectedShop.id}/drinks`);
    }
  };

  const handleEdit = (drink: Drink) => {
    setName(drink.name);
    setLayers(drink.layer_order);
    setEditingDrinkId(drink.id);
    
    const configs: Record<string, boolean> = {
      milk: drink.enabledConfigurations?.milk !== false,
      sugar: drink.enabledConfigurations?.sugar !== false,
      equal: !!drink.enabledConfigurations?.equal,
      syrup: !!drink.enabledConfigurations?.syrup,
      size: drink.enabledConfigurations?.size !== false,
      extra_shot: !!drink.enabledConfigurations?.extra_shot
    };
    
    customOptions.forEach(opt => {
      configs[opt.id] = !!drink.enabledConfigurations?.[opt.id];
    });
    
    setEnabledConfigs(configs);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setName('');
    setLayers([]);
    setEditingDrinkId(null);
    const defaults: Record<string, boolean> = {
      milk: true,
      sugar: true,
      equal: true,
      syrup: true,
      size: true,
      extra_shot: true
    };
    customOptions.forEach(opt => {
      defaults[opt.id] = true;
    });
    setEnabledConfigs(defaults);
  };

  const handleDelete = async (id: string) => {
    if (!selectedShop) return;
    if (editingDrinkId === id) handleCancelEdit();
    try {
      await deleteDoc(doc(db, 'shops', selectedShop.id, 'drinks', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `shops/${selectedShop.id}/drinks/${id}`);
    }
  };

  const toggleAvailability = async (drink: Drink) => {
    if (!selectedShop) return;
    try {
      await updateDoc(doc(db, 'shops', selectedShop.id, 'drinks', drink.id), {
        available: drink.available === false ? true : false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `shops/${selectedShop.id}/drinks/${drink.id}`);
    }
  };

  const moveDrink = async (index: number, direction: 'up' | 'down') => {
    if (!selectedShop) return;
    try {
      const updates = drinks.map((d, i) => {
        if (d.sortOrder !== i) {
          return updateDoc(doc(db, 'shops', selectedShop.id, 'drinks', d.id), { sortOrder: i });
        }
        return Promise.resolve();
      });
      await Promise.all(updates);

      if (direction === 'up' && index > 0) {
        await updateDoc(doc(db, 'shops', selectedShop.id, 'drinks', drinks[index].id), { sortOrder: index - 1 });
        await updateDoc(doc(db, 'shops', selectedShop.id, 'drinks', drinks[index - 1].id), { sortOrder: index });
      } else if (direction === 'down' && index < drinks.length - 1) {
        await updateDoc(doc(db, 'shops', selectedShop.id, 'drinks', drinks[index].id), { sortOrder: index + 1 });
        await updateDoc(doc(db, 'shops', selectedShop.id, 'drinks', drinks[index + 1].id), { sortOrder: index });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `shops/${selectedShop.id}/drinks`);
    }
  };

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngName || !selectedShop) return;
    const id = newIngName.toLowerCase().replace(/\s+/g, '_');
    try {
      await setDoc(doc(db, 'shops', selectedShop.id, 'ingredients', id), {
        name: newIngName,
        color: newIngColor,
        category: selectedCategory
      });
      setNewIngName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `shops/${selectedShop.id}/ingredients`);
    }
  };

  const handleDeleteIngredient = async (id: string) => {
    if (!selectedShop) return;
    try {
      await deleteDoc(doc(db, 'shops', selectedShop.id, 'ingredients', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `shops/${selectedShop.id}/ingredients/${id}`);
    }
  };

  const displayedDrinks = drinks.filter(d => (d.category || 'Drinks') === selectedCategory);
  const displayedIngredients = ingredients.filter(ing => (ing.category || 'Drinks') === selectedCategory);

  return (
    <div className="max-w-6xl mx-auto transition-colors duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 gap-4">
        <div className="flex items-center space-x-4">
          <span className="font-bold text-slate-700 dark:text-slate-300">Category:</span>
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500 outline-none"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <button 
          onClick={handleNewCategory}
          className="flex items-center justify-center px-4 py-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg font-bold hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Category
        </button>
      </div>

      <div className="flex flex-wrap gap-2 sm:gap-4 mb-6">
        <button
          onClick={() => setActiveTab('drinks')}
          className={`flex items-center px-4 py-2 rounded-lg font-bold transition-all ${
            activeTab === 'drinks' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <Coffee className="w-5 h-5 mr-2" />
          Manage Recipes
        </button>
        <button
          onClick={() => setActiveTab('ingredients')}
          className={`flex items-center px-4 py-2 rounded-lg font-bold transition-all ${
            activeTab === 'ingredients' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <Beaker className="w-5 h-5 mr-2" />
          Manage Ingredients
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center px-4 py-2 rounded-lg font-bold transition-all ${
            activeTab === 'history' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <History className="w-5 h-5 mr-2" />
          Order History
        </button>
        {selectedShop?.isMaster && (
          <button
            onClick={() => setActiveTab('shops')}
            className={`flex items-center px-4 py-2 rounded-lg font-bold transition-all ${
              activeTab === 'shops' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <Store className="w-5 h-5 mr-2" />
            Manage Shops
          </button>
        )}
        <button
          onClick={() => setActiveTab('configs')}
          className={`flex items-center px-4 py-2 rounded-lg font-bold transition-all ${
            activeTab === 'configs' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <Settings2 className="w-5 h-5 mr-2" />
          Config Options
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center px-4 py-2 rounded-lg font-bold transition-all ${
            activeTab === 'settings' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <Store className="w-5 h-5 mr-2" />
          Shop Settings
        </button>
      </div>

      {activeTab === 'drinks' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {editingDrinkId ? 'Edit Recipe' : 'Create New Recipe'}
              </h2>
              {editingDrinkId && (
                <button onClick={handleCancelEdit} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center text-sm font-medium">
                  <X className="w-4 h-4 mr-1" /> Cancel
                </button>
              )}
            </div>
            
            <form onSubmit={handleSave} className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Recipe Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-2 border transition-colors"
                  placeholder="Ex: Double Cappuccino"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 sm:mb-3">Add Ingredients (Bottom to Top)</label>
                <div className="flex flex-wrap gap-2 mb-4">
                  {displayedIngredients.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => addLayer(opt.id)}
                      className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium flex items-center transition-transform active:scale-95 border shadow-sm border-slate-200 dark:border-slate-700"
                      style={{ 
                        backgroundColor: opt.color === 'transparent' ? '#f8fafc' : opt.color, 
                        color: getContrastYIQ(opt.color === 'transparent' ? '#f8fafc' : opt.color) 
                      }}
                    >
                      <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      {opt.name}
                    </button>
                  ))}
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 p-2 sm:p-4 min-h-[150px] sm:min-h-[200px] flex flex-col-reverse gap-2 transition-colors">
                  {layers.map((layer, index) => {
                    const opt = ingredients.find(o => o.id === layer);
                    const bgColor = opt?.color === 'transparent' ? '#f8fafc' : (opt?.color || '#e2e8f0');
                    const textColor = getContrastYIQ(bgColor);
                    
                    return (
                      <div key={`${layer}-${index}`} className="flex items-center justify-between p-2 rounded-md shadow-sm border border-slate-200 dark:border-slate-700" style={{ backgroundColor: bgColor, color: textColor }}>
                        <span className="font-medium text-xs sm:text-sm">{index + 1}. {opt?.name || layer}</span>
                        <div className="flex items-center space-x-1">
                          <button type="button" onClick={() => moveLayer(index, 'down')} disabled={index === 0} className="p-1 hover:bg-black/10 rounded disabled:opacity-30">
                            <ArrowDown className="w-3 h-3 sm:w-4 sm:h-4" />
                          </button>
                          <button type="button" onClick={() => moveLayer(index, 'up')} disabled={index === layers.length - 1} className="p-1 hover:bg-black/10 rounded disabled:opacity-30">
                            <ArrowUp className="w-3 h-3 sm:w-4 sm:h-4" />
                          </button>
                          <button type="button" onClick={() => removeLayer(index)} className="p-1 hover:bg-black/10 rounded text-red-500 ml-1 sm:ml-2 bg-white/50">
                            <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {layers.length === 0 && (
                    <div className="text-center text-slate-400 dark:text-slate-600 py-4 sm:py-8 flex-1 flex items-center justify-center text-sm">
                      No ingredients added.<br/>The cup is empty.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Enabled Configurations</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                  {['milk', 'sugar', 'equal', 'syrup', 'size', 'extra_shot'].map((key) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">{key.replace('_', ' ')}</span>
                      <button
                        type="button"
                        onClick={() => setEnabledConfigs(prev => ({ ...prev, [key]: !prev[key] }))}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                          enabledConfigs[key] ? 'bg-amber-600' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          enabledConfigs[key] ? 'translate-x-5' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  ))}
                  {customOptions.map((opt) => (
                    <div key={opt.id} className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400 truncate mr-2" title={opt.name}>{opt.name}</span>
                      <button
                        type="button"
                        onClick={() => setEnabledConfigs(prev => ({ ...prev, [opt.id]: !prev[opt.id] }))}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                          enabledConfigs[opt.id] ? 'bg-amber-600' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          enabledConfigs[opt.id] ? 'translate-x-5' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 active:scale-95 transition-transform"
              >
                {editingDrinkId ? 'Update Recipe' : 'Save Recipe'}
              </button>
            </form>
          </div>

          <div className="space-y-4 sm:space-y-8">
            <div className="bg-black p-4 sm:p-6 rounded-xl shadow-sm flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px] border border-slate-800">
              <h3 className="text-white font-medium mb-4 sm:mb-8">Visual Preview</h3>
              <DrinkVisualizer drink={currentDrinkPreview} className="scale-100 sm:scale-125" />
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Registered Recipes</h3>
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {displayedDrinks.map((drink, index) => (
                  <li key={drink.id} className={`py-2 sm:py-3 flex justify-between items-center ${drink.available === false ? 'opacity-50' : ''}`}>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white flex items-center">
                        {drink.name}
                        {drink.available === false && <span className="ml-2 text-xs bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">Unavailable</span>}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {drink.espresso_shots} shots, {drink.leite ? 'with milk' : 'no milk'}
                      </p>
                    </div>
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <button onClick={() => toggleAvailability(drink)} className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" title={drink.available === false ? "Make Available" : "Make Unavailable"}>
                        {drink.available === false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button onClick={() => moveDrink(index, 'up')} disabled={index === 0} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button onClick={() => moveDrink(index, 'down')} disabled={index === drinks.length - 1} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleEdit(drink)} className="p-1 text-blue-500 hover:text-blue-700">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(drink.id)} className="p-1 text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
                {displayedDrinks.length === 0 && (
                  <li className="py-3 text-sm text-slate-500 dark:text-slate-400 text-center">No recipes registered in this category.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ingredients' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4 sm:mb-6">Create New Ingredient</h2>
            <form onSubmit={handleAddIngredient} className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Ingredient Name</label>
                <input
                  type="text"
                  required
                  value={newIngName}
                  onChange={(e) => setNewIngName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-2 border transition-colors"
                  placeholder="Ex: Caramel Syrup"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Color</label>
                <div className="flex items-center space-x-4 mt-1">
                  <input
                    type="color"
                    value={newIngColor}
                    onChange={(e) => setNewIngColor(e.target.value)}
                    className="h-10 w-20 rounded cursor-pointer bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                  />
                  <span className="text-sm text-slate-500 dark:text-slate-400">{newIngColor}</span>
                </div>
              </div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 active:scale-95 transition-transform"
              >
                Add Ingredient
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Available Ingredients</h3>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[500px] overflow-y-auto pr-2">
              {displayedIngredients.map((ing) => (
                <li key={ing.id} className="py-2 sm:py-3 flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-6 h-6 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm" 
                      style={{ backgroundColor: ing.color === 'transparent' ? '#f8fafc' : ing.color }}
                    />
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{ing.name}</p>
                  </div>
                  <button onClick={() => handleDeleteIngredient(ing.id)} className="p-1 text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-2xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 p-6 sm:p-10 rounded-[2.5rem] shadow-2xl shadow-slate-200/60 dark:shadow-none border border-slate-200 dark:border-slate-800 transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 via-amber-600 to-amber-400" />
            
            <div className="flex items-center space-x-4 mb-10">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl shadow-inner">
                <Store className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Shop Settings</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Customize your shop's identity and welcome experience</p>
              </div>
            </div>

            <form onSubmit={handleUpdateShopSettings} className="space-y-10">
              <div className="space-y-3">
                <label className="flex items-center text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                  Shop Name
                </label>
                <input
                  type="text"
                  required
                  value={editingShopName}
                  onChange={(e) => setEditingShopName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-4 text-slate-900 dark:text-white font-bold focus:border-amber-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all shadow-sm"
                  placeholder="Ex: Downtown Cafe"
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">
                  Splash Image
                </label>
                <div className="flex flex-col gap-4">
                  <div className="relative group">
                    <input
                      type="url"
                      value={editingSplashUrl}
                      onChange={(e) => setEditingSplashUrl(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-4 text-slate-900 dark:text-white font-medium focus:border-amber-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all shadow-sm pr-12"
                      placeholder="https://example.com/logo.png"
                    />
                    {editingSplashUrl && (
                      <button
                        type="button"
                        onClick={() => setEditingSplashUrl('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-500 transition-colors p-1"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                    <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">OR</span>
                    <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center w-full py-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all border-2 border-slate-100 dark:border-slate-700 hover:border-amber-500/30 group"
                  >
                    <Upload className="w-5 h-5 mr-3 text-amber-500 group-hover:scale-110 transition-transform" />
                    Upload from Computer
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium ml-1 flex items-center">
                  <span className="w-1 h-1 bg-amber-500 rounded-full mr-2" />
                  Recommended: Square or horizontal logo, max 500KB.
                </p>
              </div>

              {editingSplashUrl && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-8 bg-slate-50 dark:bg-slate-800/30 rounded-[2rem] border-2 border-dashed border-slate-100 dark:border-slate-800"
                >
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 text-center">Splash Preview</p>
                  <div className="aspect-video rounded-2xl overflow-hidden bg-black/5 dark:bg-black/20 flex items-center justify-center shadow-inner relative group">
                    <img 
                      src={editingSplashUrl} 
                      alt="Splash Preview" 
                      className="max-w-full max-h-full object-contain p-4 drop-shadow-2xl"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </motion.div>
              )}

              <div className="pt-6">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-5 bg-amber-600 text-white rounded-[1.5rem] font-black text-xl hover:bg-amber-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:cursor-not-allowed transition-all shadow-2xl shadow-amber-600/30 active:scale-[0.97] flex items-center justify-center"
                >
                  {isSaving ? (
                    <>
                      <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin mr-3" />
                      Saving Changes...
                    </>
                  ) : (
                    'Save Settings'
                  )}
                </button>
                {saveSuccess && (
                  <motion.p 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 text-center text-green-500 font-black flex items-center justify-center bg-green-50 dark:bg-green-900/10 py-3 rounded-xl"
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Settings saved successfully!
                  </motion.p>
                )}
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {activeTab === 'history' && <OrderHistory />}

      {activeTab === 'shops' && selectedShop?.isMaster && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4 sm:mb-6">Create New Shop Profile</h2>
            <form onSubmit={handleAddShop} className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Shop Name</label>
                <input
                  type="text"
                  required
                  value={newShopName}
                  onChange={(e) => setNewShopName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-2 border transition-colors"
                  placeholder="Ex: Downtown Cafe"
                />
              </div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 active:scale-95 transition-transform"
              >
                Add Shop Profile
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Registered Shop Profiles</h3>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {shops.map((shop) => (
                <li key={shop.id} className="py-2 sm:py-3 flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors">
                      <Store className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    </div>
                    <div>
                      {editingShopIdInList === shop.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            type="text"
                            value={tempShopName}
                            onChange={(e) => setTempShopName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') submitEditShopName(shop.id);
                              if (e.key === 'Escape') setEditingShopIdInList(null);
                            }}
                            className="text-sm font-medium text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border border-amber-500 rounded px-2 py-1 outline-none"
                          />
                          <button 
                            onClick={() => submitEditShopName(shop.id)}
                            className="p-1 text-green-600 hover:text-green-700"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setEditingShopIdInList(null)}
                            className="p-1 text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{shop.name}</p>
                          <span className={`text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${shop.isMaster ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                            {shop.isMaster ? 'Master' : 'Standard'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {editingShopIdInList !== shop.id && (
                      <button 
                        onClick={() => handleEditShopName(shop.id, shop.name)}
                        className="p-1 text-slate-400 hover:text-amber-600 transition-colors"
                        title="Edit Name"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {!shop.isMaster && (
                      <button onClick={() => handleDeleteShop(shop.id)} className="p-1 text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'configs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {editingOptionId ? 'Edit Config Option' : 'Create Config Option'}
              </h2>
              {editingOptionId && (
                <button onClick={handleCancelEditOption} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center text-sm font-medium">
                  <X className="w-4 h-4 mr-1" /> Cancel
                </button>
              )}
            </div>
            <form onSubmit={handleAddCustomOption} className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Option Name</label>
                <input
                  type="text"
                  required
                  value={newOptionName}
                  onChange={(e) => setNewOptionName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-2 border transition-colors"
                  placeholder="Ex: Temperature, Decaf, etc."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['switch', 'list', 'quantity'] as CustomOptionType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewOptionType(type)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border-2 transition-all capitalize ${
                        newOptionType === type
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                          : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {newOptionType === 'list' && (
                <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                  <label className="block text-xs font-bold uppercase text-slate-500">List Options</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newListItem}
                      onChange={(e) => setNewListItem(e.target.value)}
                      className="flex-1 rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-2 border"
                      placeholder="Ex: Hot, Extra Hot"
                    />
                    <button
                      type="button"
                      onClick={addListItem}
                      className="p-2 bg-amber-600 text-white rounded-md hover:bg-amber-700"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {newOptionListItems.map((item, idx) => (
                      <div key={idx} className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-md text-sm">
                        <span className="text-slate-700 dark:text-slate-300 mr-2">{item}</span>
                        <button type="button" onClick={() => removeListItem(idx)} className="text-red-500 hover:text-red-700">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 active:scale-95 transition-transform"
              >
                {editingOptionId ? 'Update Option' : 'Create Option'}
              </button>
            </form>

            <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4 sm:mb-6">Manage Syrups (Legacy)</h2>
              <form onSubmit={handleAddSyrup} className="space-y-4 sm:space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Syrup Name</label>
                  <input
                    type="text"
                    required
                    value={newSyrupName}
                    onChange={(e) => setNewSyrupName(e.target.value)}
                    className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-2 border transition-colors"
                    placeholder="Ex: Vanilla, Caramel, etc."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 active:scale-95 transition-transform"
                >
                  Add Syrup
                </button>
              </form>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Config Options</h3>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800 mb-8">
              {customOptions.map((opt) => (
                <li key={opt.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{opt.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{opt.type} {opt.listOptions ? `(${opt.listOptions.length} items)` : ''}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button onClick={() => handleEditCustomOption(opt)} className="p-1 text-slate-500 hover:text-amber-600">
                      <Settings2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteCustomOption(opt.id)} className="p-1 text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
              {customOptions.length === 0 && (
                <li className="py-3 text-sm text-slate-500 dark:text-slate-400 text-center">No custom options created.</li>
              )}
            </ul>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Syrups (Legacy)</h3>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {syrups.map((syrup) => (
                <li key={syrup.id} className="py-2 sm:py-3 flex justify-between items-center">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{syrup.name}</p>
                  <button onClick={() => handleDeleteSyrup(syrup.id)} className="p-1 text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
              {syrups.length === 0 && (
                <li className="py-3 text-sm text-slate-500 dark:text-slate-400 text-center">No syrups registered.</li>
              )}
            </ul>
          </div>
        </div>
      )}
      {showNewCategoryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowNewCategoryModal(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all border border-transparent dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                New Category
              </h3>
              <button onClick={() => setShowNewCategoryModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-500 dark:text-slate-400" />
              </button>
            </div>
            <form onSubmit={submitNewCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="e.g. Food, Merchandise"
                  autoFocus
                />
                {categoryError && <p className="text-red-500 text-sm mt-1">{categoryError}</p>}
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewCategoryModal(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 transition-colors"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

