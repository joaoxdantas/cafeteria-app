import React, { useState, useRef } from 'react';
import { useAppStore } from '../context/StoreContext';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Search, ArrowUpRight, ArrowDownRight, Edit2, Trash2, Filter, Minus, Zap, Calendar, ChevronUp, ChevronDown, ArrowUpDown, Download, Upload } from 'lucide-react';
import { Item, Unit } from '../types';
import { useTranslation } from '../lib/i18n';

export default function Estoque() {
  const { items, setItems, suppliers, setSuppliers, setTransactions, handlings, setHandlings, language } = useAppStore();
  const { t } = useTranslation(language);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'LOW'>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterSupplier, setFilterSupplier] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFastMode, setIsFastMode] = useState(false);
  const [pendingFastAdjusts, setPendingFastAdjusts] = useState<Record<string, number>>({});
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<Item | null>(null);
  const [keepModalOpen, setKeepModalOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [sortField, setSortField] = useState<keyof Item | 'supplier'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [importConfirmData, setImportConfirmData] = useState<any | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [minStock, setMinStock] = useState(0);
  const [unit, setUnit] = useState<Unit>('unidade');
  const [supplierId, setSupplierId] = useState('');
  const [bestBefore, setBestBefore] = useState('');
  const [batch, setBatch] = useState('');

  // Adjust form states
  const [adjustType, setAdjustType] = useState<'IN' | 'OUT'>('IN');
  const [adjustQuantity, setAdjustQuantity] = useState(0);
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjustBestBefore, setAdjustBestBefore] = useState('');
  const [adjustBatch, setAdjustBatch] = useState('');

  const getTranslatedUnit = (u: string) => {
    switch (u) {
      case 'unidade': return t('unitUnidade');
      case 'kg': return t('unitKG');
      case 'g': return t('unitG');
      case 'L': return t('unitL');
      case 'ml': return t('unitML');
      case 'caixa': return t('unitCaixa');
      default: return u;
    }
  };

  const handleDateInput = (val: string, setter: (v: string) => void) => {
    const numbers = val.replace(/\D/g, '');
    let formatted = '';
    if (numbers.length > 0) {
      formatted += numbers.substring(0, 2);
      if (numbers.length >= 3) {
        formatted += '/' + numbers.substring(2, 4);
        if (numbers.length >= 5) {
          formatted += '/' + numbers.substring(4, 8);
        }
      }
    }
    setter(formatted.substring(0, 10));
  };

  const onCalendarChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const date = e.target.value;
    if (!date) return;
    const [y, m, d] = date.split('-');
    setter(`${d}/${m}/${y}`);
  };

  const categories = Array.from(new Set(items.map(i => i.categoryName)));

  const filteredItems = items.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          i.categoryName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || (filterStatus === 'LOW' && i.quantity <= i.minStock);
    const matchesCategory = filterCategory === 'ALL' || i.categoryName === filterCategory;
    const matchesSupplier = filterSupplier === 'ALL' || 
                            (filterSupplier === 'NONE' && !i.supplierId) || 
                            i.supplierId === filterSupplier;
    return matchesSearch && matchesStatus && matchesCategory && matchesSupplier;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    let aVal: any;
    let bVal: any;

    if (sortField === 'supplier') {
      const sA = suppliers.find(s => s.id === a.supplierId)?.name || '';
      const sB = suppliers.find(s => s.id === b.supplierId)?.name || '';
      aVal = sA.toLowerCase();
      bVal = sB.toLowerCase();
    } else if (sortField === 'categoryName' || sortField === 'name') {
      aVal = (a[sortField] as string).toLowerCase();
      bVal = (b[sortField] as string).toLowerCase();
    } else {
      aVal = a[sortField as keyof Item];
      bVal = b[sortField as keyof Item];
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: keyof Item | 'supplier') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: keyof Item | 'supplier' }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-20" />;
    return sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-cafe-accent" /> : <ChevronDown className="w-3 h-3 text-cafe-accent" />;
  };

  const handleCategoryChange = (val: string) => {
    setCategoryName(val);
    // Find if any item in this category already has a supplier
    const existingItemWithSupplier = items.find(i => 
      i.categoryName.toLowerCase() === val.toLowerCase() && i.supplierId
    );
    if (existingItemWithSupplier && !supplierId) {
      setSupplierId(existingItemWithSupplier.supplierId!);
    }
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItemId) {
      setItems(items.map(i => i.id === editingItemId ? {
        ...i,
        name,
        categoryId: categoryName.toLowerCase().replace(/\s+/g, '-'),
        categoryName,
        quantity,
        unit,
        minStock,
        supplierId: supplierId || undefined,
        bestBefore: bestBefore || undefined,
        batch: batch || undefined,
      } : i));
    } else {
      const newItem: Item = {
        id: uuidv4(),
        name,
        categoryId: categoryName.toLowerCase().replace(/\s+/g, '-'),
        categoryName,
        quantity,
        unit,
        minStock,
        supplierId: supplierId || undefined,
        bestBefore: bestBefore || undefined,
        batch: batch || undefined,
      };
      setItems([...items, newItem]);
      
      // Create initial transaction if > 0
      if (quantity > 0) {
        setTransactions(prev => [...prev, {
          id: uuidv4(),
          itemId: newItem.id,
          itemName: newItem.name,
          type: 'IN',
          quantity,
          date: new Date().toISOString(),
          notes: 'Estoque Inicial',
          bestBefore: bestBefore || undefined,
          batch: batch || undefined,
        }]);
      }
    }
    
    if (!keepModalOpen || editingItemId) {
      setIsModalOpen(false);
      resetForm();
    } else {
      setName('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    }
  };

  const handleAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;

    if (adjustType === 'IN') {
      const hasNewInfo = (adjustBestBefore && adjustBestBefore !== adjustItem.bestBefore) || 
                         (adjustBatch && adjustBatch !== adjustItem.batch);

      if (hasNewInfo) {
        // Try to find an item that already matches this new batch/expiry info (same name and info)
        const targetBatch = adjustBatch || adjustItem.batch;
        const targetBestBefore = adjustBestBefore || adjustItem.bestBefore;

        const existingBatchItem = items.find(i => 
          i.name === adjustItem.name && 
          (i.bestBefore || '') === (targetBestBefore || '') && 
          (i.batch || '') === (targetBatch || '')
        );

        if (existingBatchItem) {
          // Add to the existing batch item
          setItems(items.map(i => i.id === existingBatchItem.id ? { ...i, quantity: i.quantity + adjustQuantity } : i));
          setTransactions(prev => [...prev, {
            id: uuidv4(),
            itemId: existingBatchItem.id,
            itemName: existingBatchItem.name,
            type: 'IN',
            quantity: adjustQuantity,
            date: new Date().toISOString(),
            notes: adjustNotes,
            bestBefore: targetBestBefore || undefined,
            batch: targetBatch || undefined,
          }]);
        } else {
          // Create a completely new item line
          const newItem: Item = {
            ...adjustItem,
            id: uuidv4(),
            quantity: adjustQuantity,
            bestBefore: targetBestBefore || undefined,
            batch: targetBatch || undefined,
          };
          setItems([...items, newItem]);
          setTransactions(prev => [...prev, {
            id: uuidv4(),
            itemId: newItem.id,
            itemName: newItem.name,
            type: 'IN',
            quantity: adjustQuantity,
            date: new Date().toISOString(),
            notes: adjustNotes,
            bestBefore: targetBestBefore || undefined,
            batch: targetBatch || undefined,
          }]);
        }
      } else {
        // Normal update: just add to current item
        const newQuantity = adjustItem.quantity + adjustQuantity;
        setItems(items.map(i => i.id === adjustItem.id ? { ...i, quantity: newQuantity } : i));
        setTransactions(prev => [...prev, {
          id: uuidv4(),
          itemId: adjustItem.id,
          itemName: adjustItem.name,
          type: 'IN',
          quantity: adjustQuantity,
          date: new Date().toISOString(),
          notes: adjustNotes,
          bestBefore: adjustItem.bestBefore,
          batch: adjustItem.batch,
        }]);
      }
    } else {
      // OUT adjustment: always just decrement the specific item picked
      const newQuantity = Math.max(0, adjustItem.quantity - adjustQuantity);
      setItems(items.map(i => i.id === adjustItem.id ? { ...i, quantity: newQuantity } : i));
      setTransactions(prev => [...prev, {
        id: uuidv4(),
        itemId: adjustItem.id,
        itemName: adjustItem.name,
        type: 'OUT',
        quantity: adjustQuantity,
        date: new Date().toISOString(),
        notes: adjustNotes,
        bestBefore: adjustItem.bestBefore,
        batch: adjustItem.batch,
      }]);
    }

    setIsAdjustModalOpen(false);
    setAdjustItem(null);
    setAdjustQuantity(0);
    setAdjustNotes('');
    setAdjustBestBefore('');
    setAdjustBatch('');
  };

  const resetForm = () => {
    setName('');
    setCategoryName('');
    setQuantity(0);
    setMinStock(0);
    setUnit('unidade');
    setSupplierId('');
    setBestBefore('');
    setBatch('');
    setEditingItemId(null);
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleExport = () => {
    const data = {
      items,
      suppliers,
      handlings,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cafemestre_estoque_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.items && Array.isArray(data.items)) {
          setImportConfirmData(data);
        } else {
          showNotification(t('importError'), 'error');
        }
      } catch (error) {
        console.error('Import failed:', error);
        showNotification(t('importError'), 'error');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const executeImport = () => {
    if (!importConfirmData) return;
    setItems(importConfirmData.items);
    if (importConfirmData.suppliers && Array.isArray(importConfirmData.suppliers)) {
      setSuppliers(importConfirmData.suppliers);
    }
    if (importConfirmData.handlings && Array.isArray(importConfirmData.handlings)) {
      setHandlings(importConfirmData.handlings);
    }
    showNotification(t('importSuccess'));
    setImportConfirmData(null);
  };

  const openEditItem = (item: Item) => {
    setEditingItemId(item.id);
    setName(item.name);
    setCategoryName(item.categoryName);
    setQuantity(item.quantity);
    setMinStock(item.minStock);
    setUnit(item.unit);
    setSupplierId(item.supplierId || '');
    setBestBefore(item.bestBefore || '');
    setBatch(item.batch || '');
    setIsModalOpen(true);
  };

  const openAdjust = (item: Item, type: 'IN' | 'OUT') => {
    setAdjustItem(item);
    setAdjustType(type);
    setAdjustBestBefore('');
    setAdjustBatch('');
    setIsAdjustModalOpen(true);
  };

  const handleFastAdjust = (item: Item, action: 'IN' | 'OUT') => {
    const change = action === 'IN' ? 1 : -1;
    setPendingFastAdjusts(prev => {
      const currentChange = prev[item.id] || 0;
      if (item.quantity + currentChange + change < 0) {
        return prev;
      }
      return {
        ...prev,
        [item.id]: currentChange + change
      };
    });
  };

  const toggleFastMode = () => {
    if (isFastMode) {
      const changesArray = (Object.entries(pendingFastAdjusts) as [string, number][]).filter(([_, val]) => val !== 0);
      
      if (changesArray.length > 0) {
        setItems(items.map(i => {
           const change = pendingFastAdjusts[i.id];
           if (change) {
             return { ...i, quantity: Math.max(0, i.quantity + change) };
           }
           return i;
        }));

        setTransactions(prev => {
           const now = new Date().toISOString();
           const newTrans = changesArray.map(([itemId, change]) => {
              const item = items.find(i => i.id === itemId);
              if (!item) return null;
              return {
                 id: uuidv4(),
                 itemId: item.id,
                 itemName: item.name,
                 type: change > 0 ? 'IN' : 'OUT',
                 quantity: Math.abs(change),
                 date: now,
                 notes: t('fastAdjustDesc'),
              } as const;
           }).filter((t): t is NonNullable<typeof t> => t !== null);
           return [...prev, ...newTrans];
        });
      }
      setPendingFastAdjusts({});
    }
    setIsFastMode(!isFastMode);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-[24px] gap-4">
        <div>
          <h1 className="text-[28px] font-normal tracking-[-0.5px]">{t('inventory')}</h1>
          <div className="text-[14px] text-cafe-text-dim mt-1">{t('manageSupplies')}</div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button 
            onClick={handleExport}
            className="p-[8px_12px] bg-transparent border border-cafe-border text-cafe-text-dim rounded-[4px] text-[12px] font-semibold cursor-pointer flex items-center gap-2 hover:bg-cafe-bg hover:text-cafe-text transition-all"
            title={t('exportInventory')}
          >
            <Upload className="w-4 h-4" />
            <span className="hidden lg:inline">{t('exportInventory')}</span>
          </button>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-[8px_12px] bg-transparent border border-cafe-border text-cafe-text-dim rounded-[4px] text-[12px] font-semibold cursor-pointer flex items-center gap-2 hover:bg-cafe-bg hover:text-cafe-text transition-all"
            title={t('importInventory')}
          >
            <Download className="w-4 h-4" />
            <span className="hidden lg:inline">{t('importInventory')}</span>
          </button>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImport} 
            accept=".json" 
            className="hidden" 
          />

          <button 
            onClick={toggleFastMode}
            className={`p-[8px_16px] rounded-[4px] text-[12px] font-semibold cursor-pointer flex items-center gap-2 transition-all ${isFastMode ? 'bg-[#ffeb3b] text-black shadow-[0_0_15px_rgba(255,235,59,0.3)] border-none' : 'bg-transparent border border-cafe-border text-cafe-text-dim hover:bg-cafe-bg hover:text-cafe-text'}`}
          >
            <Zap className={`w-4 h-4 ${isFastMode ? 'fill-black' : ''}`} />
            {isFastMode ? t('turnOffConfirm') : t('fastMode')}
          </button>
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="p-[8px_16px] bg-cafe-accent text-black rounded-[4px] text-[12px] font-semibold cursor-pointer border-none flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            {t('newRecord')}
          </button>
        </div>
      </header>

      {/* Import Confirmation Modal */}
      {importConfirmData && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
          <div className="bg-cafe-surface border border-cafe-border p-6 rounded-lg max-w-sm w-full shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-bold mb-3">{t('importInventory')}</h3>
            <p className="text-sm text-cafe-text-dim mb-6">{t('importReplaceConfirm')}</p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setImportConfirmData(null)}
                className="px-4 py-2 text-sm border border-cafe-border rounded hover:bg-cafe-bg"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={executeImport}
                className="px-4 py-2 text-sm bg-cafe-accent text-black font-bold rounded hover:opacity-90"
              >
                {t('confirmAdjust')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications */}
      {notification && (
        <div className={`fixed bottom-8 right-8 z-[100] px-6 py-3 rounded-md shadow-2xl border flex items-center gap-3 animate-in slide-in-from-right-4 transition-all ${
          notification.type === 'error' ? 'bg-cafe-danger/10 border-cafe-danger text-cafe-danger' : 'bg-cafe-success/10 border-cafe-success text-cafe-success'
        }`}>
           <Zap className="w-4 h-4" />
           <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      <div className={`border rounded-[12px] flex flex-col overflow-hidden transition-colors duration-300 ${isFastMode ? 'bg-cafe-bg/20 border-[#ffeb3b]/30' : 'bg-cafe-surface border-cafe-border'} min-h-0 min-w-0`}>
        <div className="p-[20px] border-b border-cafe-border flex flex-col lg:flex-row items-start lg:items-center gap-4">
          <div className="flex bg-cafe-bg/50 border border-cafe-border rounded-[4px] p-[8px_12px] flex-1 items-center gap-3 w-full">
            <Search className="text-cafe-text-dim w-4 h-4 shrink-0" />
            <input 
              type="text" 
              placeholder={t('searchItemGroup')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none focus:ring-0 w-full text-cafe-text placeholder:text-cafe-text-dim outline-none text-[13px]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2 text-cafe-text-dim mr-1">
              <Filter className="w-4 h-4" />
              <span className="text-[12px] uppercase tracking-wider font-semibold lg:hidden">{t('filterBy')}</span>
            </div>
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:flex lg:w-auto">
              <select 
                value={filterCategory} 
                onChange={e => setFilterCategory(e.target.value)}
                className="bg-cafe-bg/50 border border-cafe-border rounded-[4px] p-[8px_12px] text-cafe-text text-[13px] outline-none focus:border-cafe-accent w-full lg:min-w-[140px]"
              >
                <option value="ALL">{t('allCategories')}</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select 
                value={filterSupplier} 
                onChange={e => setFilterSupplier(e.target.value)}
                className="bg-cafe-bg/50 border border-cafe-border rounded-[4px] p-[8px_12px] text-cafe-text text-[13px] outline-none focus:border-cafe-accent w-full lg:min-w-[140px]"
              >
                <option value="ALL">{t('allSuppliers')}</option>
                <option value="NONE">{t('noSupplier')}</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select 
                value={filterStatus} 
                onChange={e => setFilterStatus(e.target.value as 'ALL' | 'LOW')}
                className="bg-cafe-bg/50 border border-cafe-border rounded-[4px] p-[8px_12px] text-cafe-text text-[13px] outline-none focus:border-cafe-accent w-full lg:min-w-[140px]"
              >
                <option value="ALL">{t('allLevels')}</option>
                <option value="LOW">{t('lowStockOnly')}</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr>
                <th 
                  className="p-[12px_20px] text-cafe-text-dim font-normal border-b border-cafe-border cursor-pointer hover:text-cafe-text transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    {t('item')}
                    <SortIcon field="name" />
                  </div>
                </th>
                <th 
                  className="p-[12px_20px] text-cafe-text-dim font-normal border-b border-cafe-border cursor-pointer hover:text-cafe-text transition-colors"
                  onClick={() => handleSort('categoryName')}
                >
                  <div className="flex items-center gap-2">
                    {t('group')}
                    <SortIcon field="categoryName" />
                  </div>
                </th>
                <th 
                  className="p-[12px_20px] text-cafe-text-dim font-normal border-b border-cafe-border cursor-pointer hover:text-cafe-text transition-colors"
                  onClick={() => handleSort('quantity')}
                >
                  <div className="flex items-center gap-2">
                    {t('currentQty')}
                    <SortIcon field="quantity" />
                  </div>
                </th>
                <th 
                  className="p-[12px_20px] text-cafe-text-dim font-normal border-b border-cafe-border cursor-pointer hover:text-cafe-text transition-colors"
                  onClick={() => handleSort('supplier')}
                >
                  <div className="flex items-center gap-2">
                    {t('supplier')}
                    <SortIcon field="supplier" />
                  </div>
                </th>
                <th className="p-[12px_20px] text-cafe-text-dim font-normal border-b border-cafe-border text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-[16px_20px] text-center text-cafe-text-dim">
                    {t('notFound')}
                  </td>
                </tr>
              )}
              {sortedItems.map(item => {
                const supplier = suppliers.find(s => s.id === item.supplierId);
                const isLow = item.quantity <= item.minStock;
                return (
                  <tr key={item.id} className="hover:bg-cafe-bg/50 transition-colors">
                    <td className="p-[16px_20px] border-b border-cafe-border">
                      <div className="font-medium text-cafe-text">{item.name}</div>
                      {(item.batch || item.bestBefore) && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {item.batch && (
                            <span className="text-[10px] bg-cafe-surface border border-cafe-border px-1 rounded text-cafe-text-dim">
                              {t('batchLabel')}: {item.batch}
                            </span>
                          )}
                          {item.bestBefore && (
                            <span className="text-[10px] bg-cafe-surface border border-cafe-border px-1 rounded text-cafe-text-dim">
                              {t('bestBeforeLabel')}: {item.bestBefore}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-[16px_20px] border-b border-cafe-border">
                      <span className="p-[2px_8px] rounded-[4px] text-[11px] bg-[#333]">
                        {item.categoryName}
                      </span>
                    </td>
                    <td className="p-[16px_20px] border-b border-cafe-border font-mono relative">
                      {isFastMode ? (
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => handleFastAdjust(item, 'OUT')} className="w-10 h-10 flex items-center justify-center rounded-[8px] bg-cafe-surface border border-cafe-border text-cafe-text hover:bg-cafe-danger hover:border-cafe-danger transition-colors shrink-0 shadow-sm">
                             <Minus className="w-5 h-5" />
                          </button>
                          <div className="flex flex-col items-center min-w-[70px] justify-center">
                            <span className="text-cafe-text text-[18px] font-bold">
                              {item.quantity + (pendingFastAdjusts[item.id] || 0)}
                            </span>
                            <span className="text-cafe-text-dim text-[10px] uppercase tracking-widest">{getTranslatedUnit(item.unit)}</span>
                          </div>
                          <button type="button" onClick={() => handleFastAdjust(item, 'IN')} className="w-10 h-10 flex items-center justify-center rounded-[8px] bg-cafe-surface border border-cafe-border text-cafe-text hover:bg-cafe-success hover:border-cafe-success transition-colors shrink-0 shadow-sm">
                             <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {isLow && <span className="inline-block w-2 h-2 rounded-full bg-cafe-danger" title="Estoque crítico" />}
                          {!isLow && <span className="inline-block w-2 h-2 rounded-full bg-cafe-success" title="Estável" />}
                          <span className={isLow ? 'text-cafe-danger text-[14px]' : 'text-cafe-text text-[14px]'}>
                            {item.quantity} {getTranslatedUnit(item.unit)}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="p-[16px_20px] border-b border-cafe-border">
                      {supplier ? supplier.name : '-'}
                    </td>
                    <td className="p-[16px_20px] border-b border-cafe-border text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => openAdjust(item, 'IN')}
                          className="p-1 px-[8px] bg-transparent text-cafe-success border border-cafe-success rounded-[4px] text-[11px] cursor-pointer hover:bg-cafe-success/10 uppercase font-bold"
                          title={t('entry')}
                        >
                          {t('entry')}
                        </button>
                        <button 
                          onClick={() => openAdjust(item, 'OUT')}
                          className="p-1 px-[8px] bg-transparent text-cafe-accent border border-cafe-accent rounded-[4px] text-[11px] cursor-pointer hover:bg-cafe-accent/10 uppercase font-bold"
                          title={t('exit')}
                        >
                          {t('exit')}
                        </button>
                        <button 
                          onClick={() => openEditItem(item)}
                          className="p-1 text-cafe-text-dim hover:text-cafe-accent hover:bg-cafe-accent/10 rounded-[4px] transition-colors"
                          title="Editar Item"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setDeleteConfirmId(item.id)}
                          className={`p-1 transition-colors rounded-[4px] ${deleteConfirmId === item.id ? 'text-cafe-danger bg-cafe-danger/20' : 'text-cafe-text-dim hover:text-cafe-danger hover:bg-cafe-danger/10'}`}
                          title={t('remove')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        
                        {deleteConfirmId === item.id && (
                          <div className="absolute right-0 top-full mt-1 z-50 bg-cafe-surface border border-cafe-danger/50 p-2 rounded shadow-xl min-w-[120px] animate-in fade-in slide-in-from-top-1">
                             <p className="text-[10px] text-cafe-text mb-2 text-center">{t('removeConfirm')}</p>
                             <div className="flex gap-2 justify-center">
                                <button 
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="text-[10px] px-2 py-1 bg-cafe-bg rounded border border-cafe-border hover:bg-cafe-surface"
                                >
                                  {t('cancel')}
                                </button>
                                <button 
                                  onClick={() => {
                                    setItems(prev => prev.filter(i => i.id !== item.id));
                                    setDeleteConfirmId(null);
                                    showNotification(t('removeItem'));
                                  }}
                                  className="text-[10px] px-2 py-1 bg-cafe-danger text-white rounded hover:opacity-90"
                                >
                                  {t('remove')}
                                </button>
                             </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Item */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex justify-center p-2 sm:p-4 z-50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-cafe-surface border border-cafe-border rounded-[8px] w-full max-w-2xl p-[24px] my-auto relative">
            <button title="Fechar" onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-cafe-text-dim hover:text-cafe-text">
              <Plus className="w-5 h-5 rotate-45" />
            </button>
            {showSuccess && (
              <div className="absolute top-4 right-12 bg-cafe-success text-black px-3 py-1 rounded-[4px] text-[12px] font-bold animate-in fade-in zoom-in slide-in-from-top-1 duration-200">
                {t('itemAdded')}
              </div>
            )}
            <h2 className="text-[18px] mb-[20px] tracking-[-0.5px]">{editingItemId ? t('editItem') : t('addItem')}</h2>
            <form onSubmit={handleSaveItem} className="space-y-[16px]">
              <div className="flex flex-col sm:flex-row gap-[16px]">
                <div className="flex-1">
                  <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('itemName')}</label>
                  <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[10px_12px] text-cafe-text text-[13px] outline-none focus:border-cafe-accent" />
                </div>
                <div className="w-full sm:w-[120px]">
                  <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('unitLabel')}</label>
                  <select value={unit} onChange={e => setUnit(e.target.value as Unit)} className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[10px_12px] text-cafe-text text-[13px] outline-none focus:border-cafe-accent">
                    <option value="unidade">{t('unitUnidade')}</option>
                    <option value="kg">{t('unitKG')}</option>
                    <option value="g">{t('unitG')}</option>
                    <option value="L">{t('unitL')}</option>
                    <option value="ml">{t('unitML')}</option>
                    <option value="caixa">{t('unitCaixa')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px]">
                <div>
                  <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('group')}</label>
                  <input 
                    required 
                    type="text" 
                    list="category-list"
                    value={categoryName} 
                    onChange={e => handleCategoryChange(e.target.value)} 
                    className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[10px_12px] text-cafe-text text-[13px] outline-none focus:border-cafe-accent" 
                    placeholder={t('groupPlaceholder')} 
                  />
                  <datalist id="category-list">
                    {categories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('supplier')}</label>
                  <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[10px_12px] text-cafe-text text-[13px] outline-none focus:border-cafe-accent">
                    <option value="">{t('noSupplier')}</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px]">
                <div>
                  <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('currentQty')}</label>
                  <input required type="number" min="0" step="0.01" value={quantity} onChange={e => setQuantity(Number(e.target.value))} className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[10px_12px] font-mono text-cafe-text text-[13px] outline-none focus:border-cafe-accent" />
                </div>
                <div>
                  <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('minStockLabel')}</label>
                  <input required type="number" min="0" step="0.01" value={minStock} onChange={e => setMinStock(Number(e.target.value))} className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[10px_12px] font-mono text-cafe-text text-[13px] outline-none focus:border-cafe-accent" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px]">
                <div>
                  <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('batchLabel')}</label>
                  <input type="text" value={batch} onChange={e => setBatch(e.target.value)} className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[10px_12px] text-cafe-text text-[13px] outline-none focus:border-cafe-accent" placeholder="Ex: A123" />
                </div>
                <div>
                  <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('bestBeforeLabel')}</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={bestBefore} 
                      onChange={e => handleDateInput(e.target.value, setBestBefore)} 
                      className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[10px_12px] pr-[40px] text-cafe-text text-[13px] outline-none focus:border-cafe-accent" 
                      placeholder="DD/MM/YYYY" 
                      maxLength={10}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 overflow-hidden">
                      <Calendar className="w-4 h-4 text-cafe-text-dim hover:text-cafe-accent" />
                      <input 
                        type="date" 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                        onChange={(e) => onCalendarChange(e, setBestBefore)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="keepOpen" 
                  checked={keepModalOpen} 
                  onChange={e => setKeepModalOpen(e.target.checked)}
                  className="w-4 h-4 accent-cafe-accent bg-cafe-bg border-cafe-border rounded cursor-pointer"
                />
                <label htmlFor="keepOpen" className="text-[13px] text-cafe-text cursor-pointer select-none">
                  {t('keepOpen')}
                </label>
              </div>
              <div className="flex justify-end gap-[12px] pt-[16px]">
                <button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }} className="p-[8px_16px] bg-transparent border border-cafe-border text-cafe-text rounded-[4px] text-[12px] font-semibold cursor-pointer">{t('cancel')}</button>
                <button type="submit" className="p-[8px_16px] bg-cafe-accent text-black border-none rounded-[4px] text-[12px] font-semibold cursor-pointer">{t('saveItem')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Adjust Stock */}
      {isAdjustModalOpen && adjustItem && (
        <div className="fixed inset-0 bg-black/80 flex justify-center p-2 sm:p-4 z-50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-cafe-surface border border-cafe-border rounded-[8px] w-full max-w-sm p-[24px] my-auto relative">
            <button title="Fechar" onClick={() => setIsAdjustModalOpen(false)} className="absolute top-4 right-4 text-cafe-text-dim hover:text-cafe-text">
              <Plus className="w-5 h-5 rotate-45" />
            </button>
            <h2 className="text-[18px] mb-[8px] tracking-[-0.5px]">
              {adjustType === 'IN' ? t('stockAdjustmentIn') : t('stockAdjustmentOut')}{t('stockAdjustment')}
            </h2>
            <div className="text-[13px] text-cafe-text-dim mb-[24px]">
              {adjustItem.name} (<span className="font-mono">{adjustItem.quantity} {getTranslatedUnit(adjustItem.unit)}</span> {t('currentQty').toLowerCase()})
            </div>
            
            <form onSubmit={handleAdjust} className="space-y-[16px]">
              <div>
                <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('quantity')}</label>
                <input required type="number" min="0.01" step="0.01" value={adjustQuantity || ''} onChange={e => setAdjustQuantity(Number(e.target.value))} className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[10px_12px] font-mono text-cafe-text text-[13px] outline-none focus:border-cafe-accent" />
              </div>
              <div>
                <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('notesLabel')}</label>
                <input type="text" value={adjustNotes} onChange={e => setAdjustNotes(e.target.value)} className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[10px_12px] text-cafe-text text-[13px] outline-none focus:border-cafe-accent" placeholder={t('notesPlaceholder')} />
              </div>
              {adjustType === 'IN' && (
                <div className="grid grid-cols-2 gap-[16px]">
                  <div>
                    <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('batchLabel')}</label>
                    <input type="text" value={adjustBatch} onChange={e => setAdjustBatch(e.target.value)} className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[10px_12px] text-cafe-text text-[13px] outline-none focus:border-cafe-accent" />
                  </div>
                  <div>
                    <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('bestBeforeLabel')}</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={adjustBestBefore} 
                        onChange={e => handleDateInput(e.target.value, setAdjustBestBefore)} 
                        className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[10px_12px] pr-[40px] text-cafe-text text-[13px] outline-none focus:border-cafe-accent" 
                        maxLength={10}
                        placeholder="DD/MM/YYYY"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 overflow-hidden">
                        <Calendar className="w-4 h-4 text-cafe-text-dim hover:text-cafe-accent" />
                        <input 
                          type="date" 
                          className="absolute inset-0 opacity-0 cursor-pointer" 
                          onChange={(e) => onCalendarChange(e, setAdjustBestBefore)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-[12px] pt-[16px]">
                <button type="button" onClick={() => setIsAdjustModalOpen(false)} className="p-[8px_16px] bg-transparent border border-cafe-border text-cafe-text rounded-[4px] text-[12px] font-semibold cursor-pointer">{t('cancel')}</button>
                <button type="submit" className={`p-[8px_16px] text-black border-none rounded-[4px] text-[12px] font-semibold cursor-pointer ${adjustType === 'IN' ? 'bg-cafe-success' : 'bg-cafe-accent'}`}>{t('confirmAdjust')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
