import React, { useState } from 'react';
import { useAppStore } from '../../context/StoreContext';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Wrench, Calendar, Trash2, User, FileText } from 'lucide-react';
import { MaintenanceRecord } from '../../types';
import { format } from 'date-fns';
import { ptBR, enAU } from 'date-fns/locale';
import { useTranslation } from '../../lib/i18n';

export default function MachineMaintenance() {
  const { maintenanceRecords, setMaintenanceRecords, language } = useAppStore();
  const { t } = useTranslation(language);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const getLocale = () => {
    if (language === 'en-AU') return enAU;
    return ptBR;
  };
  
  const [task, setTask] = useState('');
  const [operator, setOperator] = useState('');
  const [notes, setNotes] = useState('');

  const records = [...maintenanceRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: MaintenanceRecord = {
      id: uuidv4(),
      date: new Date().toISOString(),
      task,
      operator,
      notes,
    };
    setMaintenanceRecords([...maintenanceRecords, newRecord]);
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setTask('');
    setOperator('');
    setNotes('');
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-[24px]">
        <div>
          <h2 className="text-[24px] font-normal tracking-[-0.5px]">{t('machineMaintenance')}</h2>
          <div className="text-[14px] text-cafe-text-dim mt-1">{t('maintenance')}</div>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="p-[8px_16px] bg-cafe-accent text-black rounded-[4px] text-[12px] font-semibold cursor-pointer border-none flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          {t('addMaintenance')}
        </button>
      </header>

      <div className="space-y-[16px]">
        {records.length === 0 ? (
          <div className="p-[32px] text-center text-cafe-text-dim bg-cafe-surface rounded-[8px] border border-cafe-border">
            {t('noMaintenance')}
          </div>
        ) : records.map(record => (
          <div key={record.id} className="bg-cafe-surface p-[24px] rounded-[8px] border border-cafe-border flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-cafe-accent/10 flex items-center justify-center shrink-0">
                  <Wrench className="w-5 h-5 text-cafe-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-cafe-text text-[16px]">{record.task}</h3>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="flex items-center gap-1.5 text-[12px] text-cafe-text-dim">
                      <User className="w-3.5 h-3.5" />
                      <span>{record.operator}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[12px] text-cafe-text-dim font-mono">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{format(new Date(record.date), "dd 'MMMM' HH:mm", { locale: getLocale() })}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative">
                <button 
                  onClick={() => setDeleteConfirmId(record.id)} 
                  className={`transition-colors p-2 rounded-full ${deleteConfirmId === record.id ? 'text-cafe-danger bg-cafe-danger/20' : 'text-cafe-text-dim hover:text-cafe-danger hover:bg-cafe-danger/10'}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {deleteConfirmId === record.id && (
                  <div className="absolute right-0 top-full mt-2 z-50 bg-cafe-surface border border-cafe-danger/50 p-3 rounded shadow-2xl min-w-[160px] animate-in fade-in slide-in-from-top-1 text-center font-normal">
                    <p className="text-[11px] text-cafe-text mb-3">{t('removeConfirm')}</p>
                    <div className="flex gap-2 justify-center">
                      <button 
                        onClick={() => setDeleteConfirmId(null)}
                        className="text-[10px] px-3 py-1.5 bg-cafe-bg rounded border border-cafe-border hover:bg-cafe-surface transition-colors"
                      >
                        {t('cancel')}
                      </button>
                      <button 
                        onClick={() => {
                          setMaintenanceRecords(maintenanceRecords.filter(r => r.id !== record.id));
                          setDeleteConfirmId(null);
                        }}
                        className="text-[10px] px-3 py-1.5 bg-cafe-danger text-white rounded hover:opacity-90 font-bold transition-opacity"
                      >
                        {t('remove')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {record.notes && (
              <div className="bg-cafe-bg p-4 rounded-[6px] border border-cafe-border flex gap-3">
                <FileText className="w-4 h-4 text-cafe-text-dim shrink-0 mt-0.5" />
                <p className="text-[13px] text-cafe-text line-clamp-2 md:line-clamp-none whitespace-pre-wrap">{record.notes}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex justify-center p-2 sm:p-4 z-50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-cafe-surface border border-cafe-border w-full max-w-lg h-fit my-auto flex flex-col rounded-[8px] text-left shadow-2xl relative">
            <button title="Fechar" onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-cafe-text-dim hover:text-cafe-text transition-colors">
              <Plus className="w-5 h-5 rotate-45" />
            </button>
            <div className="p-[20px] border-b border-cafe-border bg-cafe-bg/50">
              <h2 className="text-[18px] m-0 tracking-[-0.5px] font-medium">{t('addMaintenance')}</h2>
            </div>
            
            <form onSubmit={handleSave} className="p-[20px] space-y-[20px]">
              <div>
                <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('taskLabel')}</label>
                <input 
                  required 
                  type="text" 
                  value={task} 
                  onChange={e => setTask(e.target.value)} 
                  className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[10px_12px] text-cafe-text text-[13px] outline-none focus:border-cafe-accent" 
                  placeholder={t('taskPlaceholder')} 
                />
              </div>

              <div>
                <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('operatorLabel')}</label>
                <input 
                  required 
                  type="text" 
                  value={operator} 
                  onChange={e => setOperator(e.target.value)} 
                  className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[10px_12px] text-cafe-text text-[13px] outline-none focus:border-cafe-accent" 
                  placeholder={t('operatorPlaceholder')} 
                />
              </div>

              <div>
                <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('notesLabel')}</label>
                <textarea 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[10px_12px] text-cafe-text text-[13px] outline-none focus:border-cafe-accent min-h-[100px]" 
                  placeholder="..."
                />
              </div>

              <div className="pt-[16px] border-t border-cafe-border flex justify-end gap-[12px] bg-cafe-bg/30 rounded-b-[8px] -mx-[20px] -mb-[20px] p-[16px_20px]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="p-[8px_16px] bg-transparent border border-cafe-border text-cafe-text rounded-[4px] text-[12px] font-semibold cursor-pointer hover:bg-cafe-surface transition-colors">{t('cancel')}</button>
                <button type="submit" className="p-[8px_24px] bg-cafe-accent text-black border-none rounded-[4px] text-[12px] font-semibold cursor-pointer hover:opacity-90">{t('saveMaintenance')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
