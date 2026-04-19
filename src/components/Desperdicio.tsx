import React, { useState } from 'react';
import { useAppStore } from '../context/StoreContext';
import { v4 as uuidv4 } from 'uuid';
import { Trash2, Calendar, Search, PlusCircle, History, Plus } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { useTranslation } from '../lib/i18n';

export default function Desperdicio() {
  const { items, setItems, transactions, setTransactions, language } = useAppStore();
  const { t } = useTranslation(language);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
  
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState(0);
  const [reasonType, setReasonType] = useState<string>('');
  const [notes, setNotes] = useState('');

  const reasonOptions = [
    { key: 'reasonExpired', value: 'Expired' },
    { key: 'reasonSpilled', value: 'Spilled' },
    { key: 'reasonWrongPrepared', value: 'Wrong Preparation' },
    { key: 'reasonQuality', value: 'Quality Issue' },
    { key: 'reasonOther', value: 'Other' },
  ];

  const wastes = transactions
    .filter(t => t.type === 'WASTE')
    .filter(t => t.itemName.toLowerCase().includes(searchTerm.toLowerCase()) || (t.notes && t.notes.toLowerCase().includes(searchTerm.toLowerCase())))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Aggregate today's waste per item
  const todayWastes = transactions.filter(t => t.type === 'WASTE' && isToday(new Date(t.date)));
  
  const getTodayWasteForItem = (itemId: string) => {
    return todayWastes
      .filter(t => t.itemId === itemId)
      .reduce((sum, t) => sum + t.quantity, 0);
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.categoryName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRegisterClick = (item: any) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const finalNotes = reasonType === 'reasonOther' ? notes : t(reasonType as any);

    // Deduct from stock
    const newQuantity = Math.max(0, selectedItem.quantity - quantity);
    setItems(items.map(i => i.id === selectedItem.id ? { ...i, quantity: newQuantity } : i));

    setTransactions(prev => [...prev, {
      id: uuidv4(),
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      type: 'WASTE',
      quantity,
      date: new Date().toISOString(),
      notes: finalNotes,
      batch: selectedItem.batch,
      bestBefore: selectedItem.bestBefore
    }]);

    setIsModalOpen(false);
    setSelectedItem(null);
    setQuantity(0);
    setReasonType('');
    setNotes('');
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-[24px]">
        <div>
          <h1 className="text-[28px] font-normal tracking-[-0.5px]">{t('waste')}</h1>
          <div className="text-[14px] text-cafe-text-dim mt-1">{t('wasteDesc')}</div>
        </div>
        <button 
          onClick={() => setShowHistory(!showHistory)}
          className={`p-[8px_16px] rounded-[4px] text-[12px] font-semibold cursor-pointer border flex items-center gap-2 transition-all ${
            showHistory 
            ? 'bg-cafe-surface border-cafe-border text-cafe-text' 
            : 'bg-cafe-surface border-cafe-border text-cafe-text-dim hover:text-cafe-text'
          }`}
        >
          <History className="w-4 h-4" />
          {showHistory ? t('allInventoryItems') : t('wasteHistory')}
        </button>
      </header>

      <div className="bg-cafe-surface border border-cafe-border rounded-[12px] flex flex-col overflow-hidden">
        <div className="p-[20px] border-b border-cafe-border flex items-center gap-3">
          <Search className="text-cafe-text-dim w-4 h-4" />
          <input 
            type="text" 
            placeholder={showHistory ? t('searchWaste') : t('searchItemGroup')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none focus:ring-0 w-full text-cafe-text placeholder:text-cafe-text-dim outline-none text-[13px]"
          />
        </div>

        {showHistory ? (
          /* HISTORY VIEW */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="p-[12px_20px] text-cafe-text-dim font-normal border-b border-cafe-border">{t('date')}</th>
                  <th className="p-[12px_20px] text-cafe-text-dim font-normal border-b border-cafe-border">{t('item')}</th>
                  <th className="p-[12px_20px] text-cafe-text-dim font-normal border-b border-cafe-border">{t('quantity')}</th>
                  <th className="p-[12px_20px] text-cafe-text-dim font-normal border-b border-cafe-border">{t('reasonNotes')}</th>
                  <th className="p-[12px_20px] text-cafe-text-dim font-normal border-b border-cafe-border"></th>
                </tr>
              </thead>
              <tbody>
                {wastes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-[16px_20px] text-center text-cafe-text-dim">
                      {t('noWasteFound')}
                    </td>
                  </tr>
                ) : wastes.map(waste => (
                  <tr key={waste.id} className="hover:bg-cafe-bg/50 transition-colors">
                    <td className="p-[16px_20px] border-b border-cafe-border text-cafe-text-dim">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(waste.date), 'dd/MM/yyyy HH:mm')}
                      </div>
                    </td>
                    <td className="p-[16px_20px] border-b border-cafe-border text-cafe-text">
                      <div className="font-medium">{waste.itemName}</div>
                      {(waste.batch || waste.bestBefore) && (
                        <div className="flex gap-2 mt-0.5 opacity-60 text-[10px] font-mono">
                          {waste.batch && <span>{t('batchLabel')}: {waste.batch}</span>}
                          {waste.bestBefore && <span>{t('bestBeforeLabel')}: {waste.bestBefore}</span>}
                        </div>
                      )}
                    </td>
                    <td className="p-[16px_20px] border-b border-cafe-border text-cafe-danger font-mono font-semibold">-{waste.quantity}</td>
                    <td className="p-[16px_20px] border-b border-cafe-border text-cafe-text-dim">{waste.notes || '-'}</td>
                    <td className="p-[16px_20px] border-b border-cafe-border text-right text-cafe-text-dim relative">
                      <button 
                        onClick={() => setDeleteConfirmId(waste.id)} 
                        className={`transition-colors p-1 rounded ${deleteConfirmId === waste.id ? 'text-cafe-danger bg-cafe-danger/20' : 'hover:text-cafe-danger'}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {deleteConfirmId === waste.id && (
                        <div className="absolute right-0 top-full mt-1 z-50 bg-cafe-surface border border-cafe-danger/50 p-2 rounded shadow-2xl min-w-[140px] animate-in fade-in slide-in-from-top-1 text-center">
                          <p className="text-[10px] text-cafe-text mb-2">{t('removeWasteConfirm')}</p>
                          <div className="flex gap-2 justify-center">
                            <button 
                              onClick={() => setDeleteConfirmId(null)}
                              className="text-[9px] px-2 py-1 bg-cafe-bg rounded border border-cafe-border hover:bg-cafe-surface"
                            >
                              {t('cancel')}
                            </button>
                            <button 
                              onClick={() => {
                                setTransactions(transactions.filter(t => t.id !== waste.id));
                                setDeleteConfirmId(null);
                              }}
                              className="text-[9px] px-2 py-1 bg-cafe-danger text-white rounded hover:opacity-90 font-bold"
                            >
                              {t('remove')}
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* DAILY LOG VIEW (All Items) */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="p-[12px_20px] text-cafe-text-dim font-normal border-b border-cafe-border">{t('item')}</th>
                  <th className="p-[12px_20px] text-cafe-text-dim font-normal border-b border-cafe-border">{t('group')}</th>
                  <th className="p-[12px_20px] text-cafe-text-dim font-normal border-b border-cafe-border">{t('currentQty')}</th>
                  <th className="p-[12px_20px] text-cafe-text-dim font-normal border-b border-cafe-border text-cafe-danger font-semibold">{t('todayWaste')}</th>
                  <th className="p-[12px_20px] text-cafe-text-dim font-normal border-b border-cafe-border text-right"></th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-[16px_20px] text-center text-cafe-text-dim">
                      {t('notFound')}
                    </td>
                  </tr>
                ) : filteredItems.map(item => {
                  const todayWaste = getTodayWasteForItem(item.id);
                  return (
                    <tr key={item.id} className="hover:bg-cafe-bg/50 transition-colors group">
                      <td className="p-[16px_20px] border-b border-cafe-border font-medium text-cafe-text">
                        <div>{item.name}</div>
                        {(item.batch || item.bestBefore) && (
                          <div className="flex gap-2 mt-1 opacity-60 text-[10px] font-mono">
                            {item.batch && <span className="bg-cafe-bg px-1 rounded border border-cafe-border">{t('batchLabel')}: {item.batch}</span>}
                            {item.bestBefore && <span className="bg-cafe-bg px-1 rounded border border-cafe-border">{t('bestBeforeLabel')}: {item.bestBefore}</span>}
                          </div>
                        )}
                      </td>
                      <td className="p-[16px_20px] border-b border-cafe-border">
                        <span className="text-[10px] uppercase tracking-[1px] p-[2px_6px] bg-cafe-bg border border-cafe-border rounded-[4px] text-cafe-text-dim">
                          {item.categoryName}
                        </span>
                      </td>
                      <td className="p-[16px_20px] border-b border-cafe-border font-mono text-cafe-text-dim">
                        {item.quantity} {getTranslatedUnit(item.unit)}
                      </td>
                      <td className={`p-[16px_20px] border-b border-cafe-border font-mono font-bold ${todayWaste > 0 ? 'text-cafe-danger' : 'text-cafe-text-dim opacity-30'}`}>
                        {todayWaste > 0 ? `-${todayWaste} ${getTranslatedUnit(item.unit)}` : `0 ${getTranslatedUnit(item.unit)}`}
                      </td>
                      <td className="p-[16px_20px] border-b border-cafe-border text-right">
                        <button 
                          onClick={() => handleRegisterClick(item)}
                          className="p-[6px_12px] bg-cafe-danger/10 text-cafe-danger border border-cafe-danger/20 rounded-[4px] text-[11px] font-bold uppercase tracking-[0.5px] hover:bg-cafe-danger hover:text-black transition-all flex items-center gap-1.5 ml-auto cursor-pointer"
                        >
                          <PlusCircle className="w-3 h-3" />
                          {t('registerAction')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black/80 flex justify-center p-2 sm:p-4 z-50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-cafe-surface border-t-4 border-cafe-danger rounded-[8px] w-full max-w-sm p-[24px] shadow-2xl my-auto relative">
            <button title="Fechar" onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-cafe-text-dim hover:text-cafe-text">
              <Plus className="w-5 h-5 rotate-45" />
            </button>
            <h2 className="text-[18px] mb-[4px] tracking-[-0.5px] font-medium">{t('registerWasteTitle')}</h2>
            <p className="text-[13px] text-cafe-text-dim mb-[24px]">
              {selectedItem.name} (<span className="font-mono">{selectedItem.quantity} {getTranslatedUnit(selectedItem.unit)}</span> disp.)
            </p>
            
            <form onSubmit={handleSave} className="space-y-[16px]">
              <div>
                <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('quantity')} ({getTranslatedUnit(selectedItem.unit)})</label>
                <input 
                  required 
                  type="number" 
                  min="0.01" 
                  max={selectedItem.quantity}
                  step="0.01" 
                  value={quantity || ''} 
                  onChange={e => setQuantity(Number(e.target.value))} 
                  className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[10px_12px] font-mono text-cafe-text text-[13px] outline-none focus:border-cafe-danger" 
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('selectReason')}</label>
                <select 
                  required 
                  value={reasonType} 
                  onChange={e => setReasonType(e.target.value)} 
                  className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[10px_12px] text-cafe-text text-[13px] outline-none focus:border-cafe-danger"
                >
                  <option value="" disabled>{t('selectItemPlaceholder')}</option>
                  {reasonOptions.map(opt => (
                    <option key={opt.key} value={opt.key}>{t(opt.key as any)}</option>
                  ))}
                </select>
              </div>
              {reasonType === 'reasonOther' && (
                <div>
                  <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('reasonNotes')}</label>
                  <input required type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[10px_12px] text-cafe-text text-[13px] outline-none focus:border-cafe-danger" placeholder={t('otherSpecify')} />
                </div>
              )}
              <div className="flex justify-end gap-[12px] pt-[16px]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="p-[8px_16px] bg-transparent border border-cafe-border text-cafe-text rounded-[4px] text-[12px] font-semibold cursor-pointer">{t('cancel')}</button>
                <button type="submit" className="p-[8px_16px] bg-cafe-danger text-black border-none rounded-[4px] text-[12px] font-semibold cursor-pointer hover:opacity-90">{t('register')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
