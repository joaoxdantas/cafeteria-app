import React, { useState } from 'react';
import { useAppStore } from '../context/StoreContext';
import { useTranslation } from '../lib/i18n';
import { Search, Thermometer, Info, Edit2, Save, Copy } from 'lucide-react';
import { ItemHandling } from '../types';

export default function Handling() {
  const { items, handlings, setHandlings, language } = useAppStore();
  const { t } = useTranslation(language);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [copySourceId, setCopySourceId] = useState('');
  
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [shelfLife, setShelfLife] = useState('');
  const [temperature, setTemperature] = useState('');
  const [prepInstructions, setPrepInstructions] = useState('');
  const [notes, setNotes] = useState('');

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.categoryName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedItem = items.find(i => i.id === selectedItemId);
  const existingHandling = handlings.find(h => h.itemId === selectedItemId);

  const handleSelectItem = (id: string) => {
    setSelectedItemId(id);
    const handling = handlings.find(h => h.itemId === id);
    if (handling) {
      setShelfLife(handling.shelfLife);
      setTemperature(handling.temperature);
      setPrepInstructions(handling.prepInstructions);
      setNotes(handling.notes);
      setIsEditing(false);
    } else {
      setShelfLife('');
      setTemperature('');
      setPrepInstructions('');
      setNotes('');
      setIsEditing(true); // Auto enter edit mode if not exists
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) return;

    const newHandling: ItemHandling = {
      id: selectedItemId,
      itemId: selectedItemId,
      shelfLife,
      temperature,
      prepInstructions,
      notes,
    };

    if (existingHandling) {
      setHandlings(handlings.map(h => h.itemId === selectedItemId ? newHandling : h));
    } else {
      setHandlings([...handlings, newHandling]);
    }
    
    setIsEditing(false);
  };

  const handleCopyFrom = () => {
    if (!copySourceId) return;
    const sourceHandling = handlings.find(h => h.itemId === copySourceId);
    if (sourceHandling) {
      setShelfLife(sourceHandling.shelfLife);
      setTemperature(sourceHandling.temperature);
      setPrepInstructions(sourceHandling.prepInstructions);
      setNotes(sourceHandling.notes);
      setCopySourceId('');
    }
  };

  const itemsWithHandling = items.filter(item => 
    handlings.some(h => h.itemId === item.id) && item.id !== selectedItemId
  );

  return (
    <div className="space-y-6 flex flex-col md:flex-row gap-6">
      {/* Left panel - Items List */}
      <div className="w-full md:w-[320px] shrink-0 space-y-4">
        <header className="mb-[24px]">
          <h1 className="text-[28px] font-normal tracking-[-0.5px]">{t('handling')}</h1>
          <div className="text-[14px] text-cafe-text-dim mt-1">{t('handlingDesc')}</div>
        </header>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-cafe-text-dim" />
          <input 
            type="text" 
            placeholder={t('searchItems')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-cafe-surface border border-cafe-border rounded-[8px] pl-10 pr-4 py-2.5 text-[13px] outline-none focus:border-cafe-accent text-cafe-text"
          />
        </div>

        <div className="bg-cafe-surface border border-cafe-border rounded-[8px] overflow-hidden flex flex-col h-[600px]">
          <div className="overflow-y-auto flex-1">
            {filteredItems.length === 0 ? (
              <div className="p-6 text-center text-cafe-text-dim text-[13px]">{t('noDataRegistered')}</div>
            ) : (
              filteredItems.map(item => {
                const hasHandling = handlings.some(h => h.itemId === item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectItem(item.id)}
                    className={`w-full text-left p-4 border-b border-cafe-border transition-colors hover:bg-cafe-bg/50 ${selectedItemId === item.id ? 'bg-cafe-bg' : ''}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className={`font-medium ${selectedItemId === item.id ? 'text-cafe-accent' : 'text-cafe-text'}`}>{item.name}</div>
                        <div className="text-[11px] text-cafe-text-dim mt-0.5">{item.categoryName}</div>
                      </div>
                      {hasHandling && (
                        <span className="w-2 h-2 rounded-full bg-cafe-success mt-1.5" />
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Right panel - Details / Form */}
      <div className="flex-1">
        {!selectedItem ? (
          <div className="h-full min-h-[400px] flex items-center justify-center p-6 text-center bg-cafe-surface/50 border border-cafe-border border-dashed rounded-[8px]">
            <div className="text-cafe-text-dim max-w-sm">
              <Thermometer className="w-10 h-10 mx-auto mb-4 opacity-20" />
              <p>{t('selectItemToHandling')}</p>
            </div>
          </div>
        ) : (
          <div className="bg-cafe-surface border border-cafe-border rounded-[8px] p-6 lg:p-8">
            <div className="flex justify-between items-start mb-8 pb-6 border-b border-cafe-border">
              <div>
                <h2 className="text-[24px] font-medium tracking-tight text-cafe-text">{selectedItem.name}</h2>
                <div className="text-[13px] text-cafe-text-dim mt-1">{selectedItem.categoryName}</div>
              </div>
              {!isEditing && existingHandling && (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="p-[8px_16px] bg-transparent border border-cafe-border text-cafe-text rounded-[4px] text-[12px] font-semibold hover:border-cafe-accent transition-colors flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  {t('editHandling')}
                </button>
              )}
            </div>

            {(!existingHandling && !isEditing) && (
                <div className="text-center py-10 text-cafe-text-dim">
                    <Info className="w-8 h-8 mx-auto mb-3 opacity-50" />
                    <p>{t('noHandlingData')}</p>
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="mt-4 p-[8px_16px] bg-cafe-accent text-black rounded-[4px] text-[12px] font-semibold"
                    >
                        {t('editHandling')}
                    </button>
                </div>
            )}

            {(isEditing || (!existingHandling && isEditing)) ? (
              <div className="space-y-6 max-w-2xl">
                {/* Copy From Section */}
                {itemsWithHandling.length > 0 && (
                  <div className="p-4 bg-cafe-bg rounded-[6px] border border-cafe-border flex flex-col sm:flex-row items-end gap-3 mb-6">
                    <div className="flex-1 w-full">
                      <label className="block text-[11px] uppercase text-cafe-text-dim mb-2 tracking-[0.5px]">
                        {t('copyFrom')}
                      </label>
                      <select 
                        value={copySourceId}
                        onChange={e => setCopySourceId(e.target.value)}
                        className="w-full bg-cafe-surface border border-cafe-border rounded-[4px] px-3 py-2 text-[13px] outline-none focus:border-cafe-accent text-cafe-text"
                      >
                        <option value="">{t('selectToCopy')}</option>
                        {itemsWithHandling.map(item => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </div>
                    <button 
                      type="button"
                      onClick={handleCopyFrom}
                      disabled={!copySourceId}
                      className="p-[9px_16px] bg-cafe-surface border border-cafe-border text-cafe-text rounded-[4px] text-[12px] font-semibold hover:border-cafe-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                    >
                      <Copy className="w-4 h-4" />
                      {t('copy')}
                    </button>
                  </div>
                )}

                <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('shelfLife')}</label>
                    <input 
                      required 
                      type="text" 
                      value={shelfLife} 
                      onChange={e => setShelfLife(e.target.value)} 
                      className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[12px] text-cafe-text text-[14px] outline-none focus:border-cafe-accent" 
                      placeholder="Ex: 5 dias, 3 meses..."
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('temperature')}</label>
                    <input 
                      required 
                      type="text" 
                      value={temperature} 
                      onChange={e => setTemperature(e.target.value)} 
                      className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[12px] text-cafe-text text-[14px] outline-none focus:border-cafe-accent" 
                      placeholder="Ex: Refrigerado (4°C), Ambiente..."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('prepInstructions')}</label>
                  <textarea 
                    value={prepInstructions} 
                    onChange={e => setPrepInstructions(e.target.value)} 
                    className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[12px] text-cafe-text text-[14px] outline-none focus:border-cafe-accent min-h-[120px]" 
                    placeholder="Ex: Forno a 180°C por 10 min, Microondas por 30s..."
                  />
                </div>

                <div>
                  <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('handlingNotesLabel')}</label>
                  <textarea 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)} 
                    className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[12px] text-cafe-text text-[14px] outline-none focus:border-cafe-accent min-h-[80px]" 
                    placeholder="Avisos sobre alergênicos, validade após aberto, etc."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-cafe-border">
                  {existingHandling && (
                    <button 
                      type="button" 
                      onClick={() => {
                          setIsEditing(false);
                          setShelfLife(existingHandling.shelfLife);
                          setTemperature(existingHandling.temperature);
                          setPrepInstructions(existingHandling.prepInstructions);
                          setNotes(existingHandling.notes);
                      }} 
                      className="p-[10px_20px] bg-transparent border border-cafe-border text-cafe-text rounded-[4px] text-[13px] font-semibold hover:bg-cafe-border/50"
                    >
                      {t('cancel')}
                    </button>
                  )}
                  <button type="submit" className="p-[10px_24px] bg-cafe-accent text-black border-none rounded-[4px] text-[13px] font-semibold hover:opacity-90 flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    {t('saveHandling')}
                  </button>
                </div>
              </form>
            </div>
          ) : (
                existingHandling && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 max-w-3xl">
                      <div>
                          <h4 className="text-[11px] uppercase tracking-[1px] text-cafe-text-dim mb-2">{t('shelfLife')}</h4>
                          <p className="text-[15px] text-cafe-text font-medium">{existingHandling.shelfLife}</p>
                      </div>
                      <div>
                          <h4 className="text-[11px] uppercase tracking-[1px] text-cafe-text-dim mb-2">{t('temperature')}</h4>
                          <p className="text-[15px] text-cafe-text font-medium">{existingHandling.temperature}</p>
                      </div>
                      
                      <div className="md:col-span-2 bg-cafe-bg p-5 rounded-[6px] border border-cafe-border">
                          <h4 className="text-[11px] uppercase tracking-[1px] text-cafe-text-dim mb-3">{t('prepInstructions')}</h4>
                          <p className="text-[14px] text-cafe-text whitespace-pre-wrap leading-relaxed">
                            {existingHandling.prepInstructions || '-'}
                          </p>
                      </div>

                      <div className="md:col-span-2">
                          <h4 className="text-[11px] uppercase tracking-[1px] text-cafe-text-dim mb-3">{t('handlingNotesLabel')}</h4>
                          <p className="text-[14px] text-cafe-text-dim whitespace-pre-wrap leading-relaxed">
                              {existingHandling.notes || '-'}
                          </p>
                      </div>
                  </div>
                )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
