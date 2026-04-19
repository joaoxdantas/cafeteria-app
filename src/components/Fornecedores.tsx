import React, { useState } from 'react';
import { useAppStore } from '../context/StoreContext';
import { v4 as uuidv4 } from 'uuid';
import { Building2, Phone, Trash2, Edit2, Plus } from 'lucide-react';
import { Supplier } from '../types';
import { useTranslation } from '../lib/i18n';

export default function Fornecedores() {
  const { suppliers, setSuppliers, language } = useAppStore();
  const { t } = useTranslation(language);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [categoriesStr, setCategoriesStr] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSupplierId) {
      setSuppliers(suppliers.map(s => s.id === editingSupplierId ? {
        ...s,
        name,
        contact,
        categories: categoriesStr.split(',').map(c => c.trim()).filter(Boolean)
      } : s));
    } else {
      const newSupplier: Supplier = {
        id: uuidv4(),
        name,
        contact,
        categories: categoriesStr.split(',').map(c => c.trim()).filter(Boolean)
      };
      setSuppliers([...suppliers, newSupplier]);
    }
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setContact('');
    setCategoriesStr('');
    setEditingSupplierId(null);
  };

  const openEditSupplier = (supplier: Supplier) => {
    setEditingSupplierId(supplier.id);
    setName(supplier.name);
    setContact(supplier.contact);
    setCategoriesStr(supplier.categories.join(', '));
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-[24px]">
        <div>
          <h1 className="text-[28px] font-normal tracking-[-0.5px]">{t('suppliers')}</h1>
          <div className="text-[14px] text-cafe-text-dim mt-1">{t('manageContacts')}</div>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="p-[8px_16px] bg-cafe-accent text-black rounded-[4px] text-[12px] font-semibold cursor-pointer border-none flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          {t('newSupplier')}
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[16px]">
        {suppliers.length === 0 ? (
          <div className="col-span-full p-[32px] text-center text-cafe-text-dim bg-cafe-surface rounded-[8px] border border-cafe-border">
            {t('noSuppliersRegistered')}
          </div>
        ) : suppliers.map(supplier => (
          <div key={supplier.id} className="bg-cafe-surface p-[24px] rounded-[8px] border border-cafe-border">
            <div className="flex items-start gap-4 mb-[16px]">
              <div className="text-cafe-accent mt-1">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-cafe-text text-[16px]">{supplier.name}</h3>
                  <div className="flex gap-2 text-cafe-text-dim relative">
                    <button onClick={() => openEditSupplier(supplier)} className="hover:text-cafe-accent transition-colors"><Edit2 className="w-4 h-4" /></button>
                    <button 
                      onClick={() => setDeleteConfirmId(supplier.id)} 
                      className={`transition-colors ${deleteConfirmId === supplier.id ? 'text-cafe-danger' : 'hover:text-cafe-danger'}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {deleteConfirmId === supplier.id && (
                      <div className="absolute right-0 top-full mt-2 z-50 bg-cafe-surface border border-cafe-danger/50 p-3 rounded shadow-2xl min-w-[160px] animate-in fade-in slide-in-from-top-1">
                        <p className="text-[11px] text-cafe-text mb-3 text-center font-medium">{t('removeSupplierConfirm')}</p>
                        <div className="flex gap-2 justify-center">
                          <button 
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-[10px] px-3 py-1.5 bg-cafe-bg rounded border border-cafe-border hover:bg-cafe-surface transition-colors"
                          >
                            {t('cancel')}
                          </button>
                          <button 
                            onClick={() => {
                              setSuppliers(suppliers.filter(s => s.id !== supplier.id));
                              setDeleteConfirmId(null);
                            }}
                            className="text-[10px] px-3 py-1.5 bg-cafe-danger text-white rounded hover:opacity-90 transition-opacity font-bold"
                          >
                            {t('remove')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 text-[13px] text-cafe-text-dim">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{supplier.contact}</span>
                </div>
              </div>
            </div>
            {supplier.categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-[16px]">
                {supplier.categories.map((cat, i) => (
                  <span key={i} className="p-[2px_8px] rounded-[4px] text-[11px] bg-[#333] text-cafe-text">
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex justify-center p-2 sm:p-4 z-50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-cafe-surface border border-cafe-border rounded-[8px] w-full max-w-sm p-[24px] my-auto">
            <div className="flex justify-between items-start mb-[24px]">
              <h2 className="text-[18px] tracking-[-0.5px]">{editingSupplierId ? t('editSupplier') : t('addSupplier')}</h2>
              <button title="Fechar" onClick={() => setIsModalOpen(false)} className="text-cafe-text-dim hover:text-cafe-text">
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-[16px]">
              <div>
                <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('companyName')}</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[10px_12px] text-cafe-text text-[13px] outline-none focus:border-cafe-accent" />
              </div>
              <div>
                <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('contactInfo')}</label>
                <input type="text" value={contact} onChange={e => setContact(e.target.value)} className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[10px_12px] text-cafe-text text-[13px] outline-none focus:border-cafe-accent" />
              </div>
              <div>
                <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('itemGroups')}</label>
                <input type="text" value={categoriesStr} placeholder={t('itemGroupsPlaceholder')} onChange={e => setCategoriesStr(e.target.value)} className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[10px_12px] text-cafe-text text-[13px] outline-none focus:border-cafe-accent" />
                <p className="text-[11px] text-cafe-text-dim mt-2">{t('separateByComma')}</p>
              </div>
              
              <div className="flex justify-end gap-[12px] pt-[16px]">
                <button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }} className="p-[8px_16px] bg-transparent border border-cafe-border text-cafe-text rounded-[4px] text-[12px] font-semibold cursor-pointer">{t('cancel')}</button>
                <button type="submit" className="p-[8px_16px] bg-cafe-accent text-black border-none rounded-[4px] text-[12px] font-semibold cursor-pointer">{t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
