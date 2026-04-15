import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, setDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Drink, OperationType, Shop } from '../types';
import { DrinkVisualizer } from '../components/DrinkVisualizer';
import { OrderHistory } from '../components/OrderHistory';
import { handleFirestoreError } from '../lib/firestore-error';
import { Trash2, Plus, ArrowUp, ArrowDown, History, Coffee, Edit2, X, Eye, EyeOff, Beaker, Store, Settings2 } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'drinks' | 'history' | 'ingredients' | 'shops' | 'configs'>('drinks');
  const [editingDrinkId, setEditingDrinkId] = useState<string | null>(null);
  const [enabledConfigs, setEnabledConfigs] = useState({
    milk: true,
    sugar: true,
    equal: false,
    syrup: false,
    size: true
  });

  const [syrups, setSyrups] = useState<{id: string, name: string}[]>([]);
  const [newSyrupName, setNewSyrupName] = useState('');

  const [newIngName, setNewIngName] = useState('');
  const [newIngColor, setNewIngColor] = useState('#ff0000');
  const [newShopName, setNewShopName] = useState('');

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
      setEnabledConfigs({
        milk: true,
        sugar: true,
        equal: false,
        syrup: false,
        size: true
      });
    } catch (error) {
      handleFirestoreError(error, editingDrinkId ? OperationType.UPDATE : OperationType.CREATE, `shops/${selectedShop.id}/drinks`);
    }
  };

  const handleEdit = (drink: Drink) => {
    setName(drink.name);
    setLayers(drink.layer_order);
    setEditingDrinkId(drink.id);
    setEnabledConfigs(drink.enabledConfigurations || {
      milk: drink.leite,
      sugar: true,
      equal: false,
      syrup: false,
      size: true
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setName('');
    setLayers([]);
    setEditingDrinkId(null);
    setEnabledConfigs({
      milk: true,
      sugar: true,
      equal: false,
      syrup: false,
      size: true
    });
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
                  {Object.entries(enabledConfigs).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">{key}</span>
                      <button
                        type="button"
                        onClick={() => setEnabledConfigs(prev => ({ ...prev, [key]: !value }))}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                          value ? 'bg-amber-600' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          value ? 'translate-x-5' : 'translate-x-1'
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
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{shop.name}</p>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${shop.isMaster ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                        {shop.isMaster ? 'Master' : 'Standard'}
                      </span>
                    </div>
                  </div>
                  {!shop.isMaster && (
                    <button onClick={() => handleDeleteShop(shop.id)} className="p-1 text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'configs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4 sm:mb-6">Manage Syrups</h2>
            <form onSubmit={handleAddSyrup} className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Syrup Name</label>
                <input
                  type="text"
                  required
                  value={newSyrupName}
                  onChange={(e) => setNewSyrupName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-2 border transition-colors"
                  placeholder="Ex: Vanilla"
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

          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Available Syrups</h3>
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

