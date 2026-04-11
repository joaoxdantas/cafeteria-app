import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Drink, OperationType } from '../types';
import { DrinkVisualizer } from '../components/DrinkVisualizer';
import { OrderHistory } from '../components/OrderHistory';
import { handleFirestoreError } from '../lib/firestore-error';
import { Trash2, Plus, ArrowUp, ArrowDown, History, Coffee, Edit2, X, Eye, EyeOff, Beaker } from 'lucide-react';
import { useIngredients } from '../hooks/useIngredients';

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
  const ingredients = useIngredients();
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [name, setName] = useState('');
  const [layers, setLayers] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'drinks' | 'history' | 'ingredients'>('drinks');
  const [editingDrinkId, setEditingDrinkId] = useState<string | null>(null);

  const [newIngName, setNewIngName] = useState('');
  const [newIngColor, setNewIngColor] = useState('#ff0000');

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'drinks'),
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
      (error) => handleFirestoreError(error, OperationType.LIST, 'drinks')
    );
    return () => unsubscribe();
  }, []);

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
    if (!name || layers.length === 0) {
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
      };

      if (editingDrinkId) {
        await updateDoc(doc(db, 'drinks', editingDrinkId), drinkData);
        setEditingDrinkId(null);
      } else {
        await addDoc(collection(db, 'drinks'), {
          ...drinkData,
          createdAt: new Date().toISOString(),
          sortOrder: drinks.length,
          available: true,
        });
      }
      
      setName('');
      setLayers([]);
    } catch (error) {
      handleFirestoreError(error, editingDrinkId ? OperationType.UPDATE : OperationType.CREATE, 'drinks');
    }
  };

  const handleEdit = (drink: Drink) => {
    setName(drink.name);
    setLayers(drink.layer_order);
    setEditingDrinkId(drink.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setName('');
    setLayers([]);
    setEditingDrinkId(null);
  };

  const handleDelete = async (id: string) => {
    if (editingDrinkId === id) handleCancelEdit();
    try {
      await deleteDoc(doc(db, 'drinks', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `drinks/${id}`);
    }
  };

  const toggleAvailability = async (drink: Drink) => {
    try {
      await updateDoc(doc(db, 'drinks', drink.id), {
        available: drink.available === false ? true : false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `drinks/${drink.id}`);
    }
  };

  const moveDrink = async (index: number, direction: 'up' | 'down') => {
    try {
      const updates = drinks.map((d, i) => {
        if (d.sortOrder !== i) {
          return updateDoc(doc(db, 'drinks', d.id), { sortOrder: i });
        }
        return Promise.resolve();
      });
      await Promise.all(updates);

      if (direction === 'up' && index > 0) {
        await updateDoc(doc(db, 'drinks', drinks[index].id), { sortOrder: index - 1 });
        await updateDoc(doc(db, 'drinks', drinks[index - 1].id), { sortOrder: index });
      } else if (direction === 'down' && index < drinks.length - 1) {
        await updateDoc(doc(db, 'drinks', drinks[index].id), { sortOrder: index + 1 });
        await updateDoc(doc(db, 'drinks', drinks[index + 1].id), { sortOrder: index });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'drinks');
    }
  };

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngName) return;
    const id = newIngName.toLowerCase().replace(/\s+/g, '_');
    try {
      await setDoc(doc(db, 'ingredients', id), {
        name: newIngName,
        color: newIngColor
      });
      setNewIngName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'ingredients');
    }
  };

  const handleDeleteIngredient = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'ingredients', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `ingredients/${id}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap gap-2 sm:gap-4 mb-6">
        <button
          onClick={() => setActiveTab('drinks')}
          className={`flex items-center px-4 py-2 rounded-lg font-bold transition-colors ${
            activeTab === 'drinks' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Coffee className="w-5 h-5 mr-2" />
          Manage Drinks
        </button>
        <button
          onClick={() => setActiveTab('ingredients')}
          className={`flex items-center px-4 py-2 rounded-lg font-bold transition-colors ${
            activeTab === 'ingredients' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Beaker className="w-5 h-5 mr-2" />
          Manage Ingredients
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center px-4 py-2 rounded-lg font-bold transition-colors ${
            activeTab === 'history' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <History className="w-5 h-5 mr-2" />
          Order History
        </button>
      </div>

      {activeTab === 'drinks' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                {editingDrinkId ? 'Edit Drink' : 'Create New Drink'}
              </h2>
              {editingDrinkId && (
                <button onClick={handleCancelEdit} className="text-slate-500 hover:text-slate-700 flex items-center text-sm font-medium">
                  <X className="w-4 h-4 mr-1" /> Cancel
                </button>
              )}
            </div>
            
            <form onSubmit={handleSave} className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700">Drink Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-2 border"
                  placeholder="Ex: Double Cappuccino"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2 sm:mb-3">Add Ingredients (Bottom to Top)</label>
                <div className="flex flex-wrap gap-2 mb-4">
                  {ingredients.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => addLayer(opt.id)}
                      className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium flex items-center transition-transform active:scale-95 border shadow-sm"
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

                <div className="bg-slate-50 rounded-lg border border-slate-200 p-2 sm:p-4 min-h-[150px] sm:min-h-[200px] flex flex-col-reverse gap-2">
                  {layers.map((layer, index) => {
                    const opt = ingredients.find(o => o.id === layer);
                    const bgColor = opt?.color === 'transparent' ? '#f8fafc' : (opt?.color || '#e2e8f0');
                    const textColor = getContrastYIQ(bgColor);
                    
                    return (
                      <div key={`${layer}-${index}`} className="flex items-center justify-between p-2 rounded-md shadow-sm border" style={{ backgroundColor: bgColor, color: textColor }}>
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
                    <div className="text-center text-slate-400 py-4 sm:py-8 flex-1 flex items-center justify-center text-sm">
                      No ingredients added.<br/>The cup is empty.
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 active:scale-95 transition-transform"
              >
                {editingDrinkId ? 'Update Drink' : 'Save Drink'}
              </button>
            </form>
          </div>

          <div className="space-y-4 sm:space-y-8">
            <div className="bg-black p-4 sm:p-6 rounded-xl shadow-sm flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px]">
              <h3 className="text-white font-medium mb-4 sm:mb-8">Visual Preview</h3>
              <DrinkVisualizer drink={currentDrinkPreview} className="scale-100 sm:scale-125" />
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Registered Drinks</h3>
              <ul className="divide-y divide-slate-200">
                {drinks.map((drink, index) => (
                  <li key={drink.id} className={`py-2 sm:py-3 flex justify-between items-center ${drink.available === false ? 'opacity-50' : ''}`}>
                    <div>
                      <p className="text-sm font-medium text-slate-900 flex items-center">
                        {drink.name}
                        {drink.available === false && <span className="ml-2 text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">Unavailable</span>}
                      </p>
                      <p className="text-xs text-slate-500">
                        {drink.espresso_shots} shots, {drink.leite ? 'with milk' : 'no milk'}
                      </p>
                    </div>
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <button onClick={() => toggleAvailability(drink)} className="p-1 text-slate-500 hover:text-slate-700" title={drink.available === false ? "Make Available" : "Make Unavailable"}>
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
                {drinks.length === 0 && (
                  <li className="py-3 text-sm text-slate-500 text-center">No drinks registered.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ingredients' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 sm:mb-6">Create New Ingredient</h2>
            <form onSubmit={handleAddIngredient} className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700">Ingredient Name</label>
                <input
                  type="text"
                  required
                  value={newIngName}
                  onChange={(e) => setNewIngName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm p-2 border"
                  placeholder="Ex: Caramel Syrup"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Color</label>
                <div className="flex items-center space-x-4 mt-1">
                  <input
                    type="color"
                    value={newIngColor}
                    onChange={(e) => setNewIngColor(e.target.value)}
                    className="h-10 w-20 rounded cursor-pointer"
                  />
                  <span className="text-sm text-slate-500">{newIngColor}</span>
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

          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Available Ingredients</h3>
            <ul className="divide-y divide-slate-200 max-h-[500px] overflow-y-auto pr-2">
              {ingredients.map((ing) => (
                <li key={ing.id} className="py-2 sm:py-3 flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-6 h-6 rounded-full border border-slate-200 shadow-sm" 
                      style={{ backgroundColor: ing.color === 'transparent' ? '#f8fafc' : ing.color }}
                    />
                    <p className="text-sm font-medium text-slate-900">{ing.name}</p>
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
    </div>
  );
}

