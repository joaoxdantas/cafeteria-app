import React, { useState } from 'react';
import { useAppStore } from '../context/StoreContext';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Coffee, Calendar, Trash2, User } from 'lucide-react';
import { EspressoTest, GroupHeadTest, TestMeasurement } from '../types';
import { format } from 'date-fns';
import { ptBR, enAU } from 'date-fns/locale';
import { useTranslation } from '../lib/i18n';

const defaultDouble: TestMeasurement = { dose: 21, time: 25, yieldAmount: 40 };
const defaultLongo: TestMeasurement = { dose: 21, time: 28, yieldAmount: 47 };

export const isOptimal = (type: 'double' | 'lungo', field: keyof TestMeasurement, value: number) => {
  if (type === 'double') {
    if (field === 'dose') return value >= 20.5 && value <= 21.5;
    if (field === 'time') return value >= 22 && value <= 27;
    if (field === 'yieldAmount') return value >= 40 && value <= 42;
  } else {
    if (field === 'dose') return value >= 20.5 && value <= 21.5;
    if (field === 'time') return value >= 26 && value <= 31;
    if (field === 'yieldAmount') return value >= 47 && value <= 48;
  }
  return false;
};

export default function EspressoTests() {
  const { espressoTests, setEspressoTests, language } = useAppStore();
  const { t } = useTranslation(language);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getLocale = () => {
    if (language === 'en-AU') return enAU;
    return ptBR;
  };
  
  const [operator, setOperator] = useState('');
  const [group1, setGroup1] = useState<GroupHeadTest>({ double: { ...defaultDouble }, lungo: { ...defaultLongo } });
  const [group2, setGroup2] = useState<GroupHeadTest>({ double: { ...defaultDouble }, lungo: { ...defaultLongo } });

  const tests = [...espressoTests].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const newTest: EspressoTest = {
      id: uuidv4(),
      date: new Date().toISOString(),
      operator,
      group1,
      group2
    };
    setEspressoTests([...espressoTests, newTest]);
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setOperator('');
    setGroup1({ double: { ...defaultDouble }, lungo: { ...defaultLongo } });
    setGroup2({ double: { ...defaultDouble }, lungo: { ...defaultLongo } });
  };

  const updateMeasurement = (group: 1 | 2, type: 'double' | 'lungo', field: keyof TestMeasurement, value: number) => {
    if (group === 1) {
      setGroup1(prev => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
    } else {
      setGroup2(prev => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-[24px]">
        <div>
          <h1 className="text-[28px] font-normal tracking-[-0.5px]">{t('espressoCalibration')}</h1>
          <div className="text-[14px] text-cafe-text-dim mt-1">{t('calibrationDesc')}</div>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="p-[8px_16px] bg-cafe-accent text-black rounded-[4px] text-[12px] font-semibold cursor-pointer border-none flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          {t('newTest')}
        </button>
      </header>

      <div className="space-y-[16px]">
        {tests.length === 0 ? (
          <div className="p-[32px] text-center text-cafe-text-dim bg-cafe-surface rounded-[8px] border border-cafe-border">
            {t('noTestsRegistered')}
          </div>
        ) : tests.map(test => (
          <div key={test.id} className="bg-cafe-surface p-[24px] rounded-[8px] border border-cafe-border flex flex-col gap-6">
            <div className="flex justify-between items-center border-b border-cafe-border pb-4">
              <div>
                <h3 className="font-semibold text-cafe-text text-[16px] flex items-center gap-2">
                  <User className="w-4 h-4 text-cafe-accent" />
                  {test.operator || t('operatorNotReported')}
                </h3>
                <div className="flex items-center gap-2 mt-2 text-[12px] text-cafe-text-dim font-mono">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{format(new Date(test.date), "dd 'MMMM' HH:mm", { locale: getLocale() })}</span>
                </div>
              </div>
              <button onClick={() => {
                  if(confirm(t('removeTestConfirm'))) {
                      setEspressoTests(espressoTests.filter(t => t.id !== test.id));
                  }
              }} className="text-cafe-text-dim hover:text-cafe-danger transition-colors p-2">
                  <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Group Head 1 */}
              <div>
                <h4 className="text-[14px] font-medium text-cafe-accent uppercase tracking-[1px] mb-4 flex items-center gap-2">
                  <Coffee className="w-4 h-4" /> Group Head 1
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[13px]">
                    <thead>
                      <tr>
                        <th className="p-[8px_12px] text-cafe-text-dim font-normal border-b border-cafe-border">{t('type')}</th>
                        <th className="p-[8px_12px] text-cafe-text-dim font-normal border-b border-cafe-border text-right">{t('doseG')}</th>
                        <th className="p-[8px_12px] text-cafe-text-dim font-normal border-b border-cafe-border text-right">{t('timeS')}</th>
                        <th className="p-[8px_12px] text-cafe-text-dim font-normal border-b border-cafe-border text-right">{t('yieldG')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="hover:bg-cafe-bg/50">
                        <td className="p-[8px_12px] border-b border-cafe-border font-medium text-cafe-text">{t('double')}</td>
                        <td className={`p-[8px_12px] border-b border-cafe-border font-mono text-right ${test.group1?.double?.dose !== undefined && !isOptimal('double', 'dose', test.group1.double.dose) ? 'text-cafe-danger' : 'text-cafe-success'}`}>{test.group1?.double?.dose !== undefined ? test.group1.double.dose : '-'}</td>
                        <td className={`p-[8px_12px] border-b border-cafe-border font-mono text-right ${test.group1?.double?.time !== undefined && !isOptimal('double', 'time', test.group1.double.time) ? 'text-cafe-danger' : 'text-cafe-success'}`}>{test.group1?.double?.time !== undefined ? test.group1.double.time : '-'}</td>
                        <td className={`p-[8px_12px] border-b border-cafe-border font-mono text-right ${test.group1?.double?.yieldAmount !== undefined && !isOptimal('double', 'yieldAmount', test.group1.double.yieldAmount) ? 'text-cafe-danger' : 'text-cafe-success'}`}>{test.group1?.double?.yieldAmount !== undefined ? test.group1.double.yieldAmount : '-'}</td>
                      </tr>
                      <tr className="hover:bg-cafe-bg/50">
                        <td className="p-[8px_12px] border-b border-cafe-border font-medium text-cafe-text">{t('longo')}</td>
                        <td className={`p-[8px_12px] border-b border-cafe-border font-mono text-right ${test.group1?.lungo?.dose !== undefined && !isOptimal('lungo', 'dose', test.group1.lungo.dose) ? 'text-cafe-danger' : 'text-cafe-success'}`}>{test.group1?.lungo?.dose !== undefined ? test.group1.lungo.dose : '-'}</td>
                        <td className={`p-[8px_12px] border-b border-cafe-border font-mono text-right ${test.group1?.lungo?.time !== undefined && !isOptimal('lungo', 'time', test.group1.lungo.time) ? 'text-cafe-danger' : 'text-cafe-success'}`}>{test.group1?.lungo?.time !== undefined ? test.group1.lungo.time : '-'}</td>
                        <td className={`p-[8px_12px] border-b border-cafe-border font-mono text-right ${test.group1?.lungo?.yieldAmount !== undefined && !isOptimal('lungo', 'yieldAmount', test.group1.lungo.yieldAmount) ? 'text-cafe-danger' : 'text-cafe-success'}`}>{test.group1?.lungo?.yieldAmount !== undefined ? test.group1.lungo.yieldAmount : '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Group Head 2 */}
              <div>
                <h4 className="text-[14px] font-medium text-cafe-accent uppercase tracking-[1px] mb-4 flex items-center gap-2">
                  <Coffee className="w-4 h-4" /> Group Head 2
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[13px]">
                    <thead>
                      <tr>
                        <th className="p-[8px_12px] text-cafe-text-dim font-normal border-b border-cafe-border">{t('type')}</th>
                        <th className="p-[8px_12px] text-cafe-text-dim font-normal border-b border-cafe-border text-right">{t('doseG')}</th>
                        <th className="p-[8px_12px] text-cafe-text-dim font-normal border-b border-cafe-border text-right">{t('timeS')}</th>
                        <th className="p-[8px_12px] text-cafe-text-dim font-normal border-b border-cafe-border text-right">{t('yieldG')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="hover:bg-cafe-bg/50">
                        <td className="p-[8px_12px] border-b border-cafe-border font-medium text-cafe-text">{t('double')}</td>
                        <td className={`p-[8px_12px] border-b border-cafe-border font-mono text-right ${test.group2?.double?.dose !== undefined && !isOptimal('double', 'dose', test.group2.double.dose) ? 'text-cafe-danger' : 'text-cafe-success'}`}>{test.group2?.double?.dose !== undefined ? test.group2.double.dose : '-'}</td>
                        <td className={`p-[8px_12px] border-b border-cafe-border font-mono text-right ${test.group2?.double?.time !== undefined && !isOptimal('double', 'time', test.group2.double.time) ? 'text-cafe-danger' : 'text-cafe-success'}`}>{test.group2?.double?.time !== undefined ? test.group2.double.time : '-'}</td>
                        <td className={`p-[8px_12px] border-b border-cafe-border font-mono text-right ${test.group2?.double?.yieldAmount !== undefined && !isOptimal('double', 'yieldAmount', test.group2.double.yieldAmount) ? 'text-cafe-danger' : 'text-cafe-success'}`}>{test.group2?.double?.yieldAmount !== undefined ? test.group2.double.yieldAmount : '-'}</td>
                      </tr>
                      <tr className="hover:bg-cafe-bg/50">
                        <td className="p-[8px_12px] border-b border-cafe-border font-medium text-cafe-text">{t('longo')}</td>
                        <td className={`p-[8px_12px] border-b border-cafe-border font-mono text-right ${test.group2?.lungo?.dose !== undefined && !isOptimal('lungo', 'dose', test.group2.lungo.dose) ? 'text-cafe-danger' : 'text-cafe-success'}`}>{test.group2?.lungo?.dose !== undefined ? test.group2.lungo.dose : '-'}</td>
                        <td className={`p-[8px_12px] border-b border-cafe-border font-mono text-right ${test.group2?.lungo?.time !== undefined && !isOptimal('lungo', 'time', test.group2.lungo.time) ? 'text-cafe-danger' : 'text-cafe-success'}`}>{test.group2?.lungo?.time !== undefined ? test.group2.lungo.time : '-'}</td>
                        <td className={`p-[8px_12px] border-b border-cafe-border font-mono text-right ${test.group2?.lungo?.yieldAmount !== undefined && !isOptimal('lungo', 'yieldAmount', test.group2.lungo.yieldAmount) ? 'text-cafe-danger' : 'text-cafe-success'}`}>{test.group2?.lungo?.yieldAmount !== undefined ? test.group2.lungo.yieldAmount : '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-cafe-surface border border-cafe-border w-full max-w-4xl max-h-[95vh] flex flex-col rounded-[8px] text-left">
            <div className="shrink-0 p-[20px] border-b border-cafe-border">
              <h2 className="text-[18px] m-0 tracking-[-0.5px]">{t('newMachineTest')}</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-[20px]">
              <form id="test-form" onSubmit={handleSave} className="space-y-[20px]">
                <div>
                  <label className="block text-[12px] uppercase text-cafe-text-dim mb-[8px] tracking-[1px]">{t('operatorLabel')}</label>
                  <input required type="text" value={operator} onChange={e => setOperator(e.target.value)} className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[10px_12px] text-cafe-text text-[13px] outline-none focus:border-cafe-accent" placeholder={t('operatorPlaceholder')} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px]">
                  {[1, 2].map((groupNum) => {
                    const group = groupNum === 1 ? group1 : group2;
                    return (
                      <div key={groupNum} className="border border-cafe-border rounded-[8px] p-4 bg-cafe-bg/30">
                        <h3 className="text-[14px] font-medium text-cafe-accent uppercase tracking-[1px] mb-4">Group Head {groupNum}</h3>
                        <div className="space-y-4">
                          {/* Double row */}
                          <div className="space-y-2">
                            <h4 className="text-[13px] text-cafe-text border-b border-cafe-border/50 pb-2">{t('doubleEspresso')}</h4>
                            <div className="grid grid-cols-3 gap-3 pt-2">
                              <div>
                                <label className="block text-[10px] text-cafe-text-dim mb-1 flex flex-col xl:flex-row xl:justify-between"><span className="truncate">{t('doseG')}</span><span className="text-cafe-accent/70 text-[10px]">{t('target')}: 20.5-21.5</span></label>
                                <input required type="number" min="0" step="0.1" value={group.double.dose} onChange={e => updateMeasurement(groupNum as 1|2, 'double', 'dose', Number(e.target.value))} className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[8px] font-mono text-cafe-text text-[13px] outline-none focus:border-cafe-accent" />
                              </div>
                              <div>
                                <label className="block text-[10px] text-cafe-text-dim mb-1 flex flex-col xl:flex-row xl:justify-between"><span className="truncate">{t('timeS')}</span><span className="text-cafe-accent/70 text-[10px]">{t('target')}: 22-27</span></label>
                                <input required type="number" min="0" step="0.1" value={group.double.time} onChange={e => updateMeasurement(groupNum as 1|2, 'double', 'time', Number(e.target.value))} className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[8px] font-mono text-cafe-text text-[13px] outline-none focus:border-cafe-accent" />
                              </div>
                              <div>
                                <label className="block text-[10px] text-cafe-text-dim mb-1 flex flex-col xl:flex-row xl:justify-between"><span className="truncate">{t('yieldG')}</span><span className="text-cafe-accent/70 text-[10px]">{t('target')}: 40-42</span></label>
                                <input required type="number" min="0" step="0.1" value={group.double.yieldAmount} onChange={e => updateMeasurement(groupNum as 1|2, 'double', 'yieldAmount', Number(e.target.value))} className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[8px] font-mono text-cafe-text text-[13px] outline-none focus:border-cafe-accent" />
                              </div>
                            </div>
                          </div>

                          {/* Lungo row */}
                          <div className="space-y-2">
                            <h4 className="text-[13px] text-cafe-text border-b border-cafe-border/50 pb-2">{t('longo')}</h4>
                            <div className="grid grid-cols-3 gap-3 pt-2">
                              <div>
                                <label className="block text-[10px] text-cafe-text-dim mb-1 flex flex-col xl:flex-row xl:justify-between"><span className="truncate">{t('doseG')}</span><span className="text-cafe-accent/70 text-[10px]">{t('target')}: 20.5-21.5</span></label>
                                <input required type="number" min="0" step="0.1" value={group.lungo.dose} onChange={e => updateMeasurement(groupNum as 1|2, 'lungo', 'dose', Number(e.target.value))} className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[8px] font-mono text-cafe-text text-[13px] outline-none focus:border-cafe-accent" />
                              </div>
                              <div>
                                <label className="block text-[10px] text-cafe-text-dim mb-1 flex flex-col xl:flex-row xl:justify-between"><span className="truncate">{t('timeS')}</span><span className="text-cafe-accent/70 text-[10px]">{t('target')}: 26-31</span></label>
                                <input required type="number" min="0" step="0.1" value={group.lungo.time} onChange={e => updateMeasurement(groupNum as 1|2, 'lungo', 'time', Number(e.target.value))} className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[8px] font-mono text-cafe-text text-[13px] outline-none focus:border-cafe-accent" />
                              </div>
                              <div>
                                <label className="block text-[10px] text-cafe-text-dim mb-1 flex flex-col xl:flex-row xl:justify-between"><span className="truncate">{t('yieldG')}</span><span className="text-cafe-accent/70 text-[10px]">{t('target')}: 47-48</span></label>
                                <input required type="number" min="0" step="0.1" value={group.lungo.yieldAmount} onChange={e => updateMeasurement(groupNum as 1|2, 'lungo', 'yieldAmount', Number(e.target.value))} className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[8px] font-mono text-cafe-text text-[13px] outline-none focus:border-cafe-accent" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </form>
            </div>
            
            <div className="shrink-0 p-[16px_20px] border-t border-cafe-border flex justify-end gap-[12px] bg-cafe-surface rounded-b-[8px]">
              <button type="button" onClick={() => setIsModalOpen(false)} className="p-[8px_16px] bg-transparent border border-cafe-border text-cafe-text rounded-[4px] text-[12px] font-semibold cursor-pointer">{t('cancel')}</button>
              <button form="test-form" type="submit" className="p-[8px_16px] bg-cafe-accent text-black border-none rounded-[4px] text-[12px] font-semibold cursor-pointer">{t('saveTest')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
