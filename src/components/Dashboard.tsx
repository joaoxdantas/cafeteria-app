import React from 'react';
import { useAppStore } from '../context/StoreContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Package, AlertTriangle, Trash2, Clock } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { differenceInDays, parse, startOfDay } from 'date-fns';

export default function Dashboard() {
  const { items, transactions, espressoTests, language } = useAppStore();
  const { t } = useTranslation(language);

  const lowStockItems = items.filter(i => i.quantity <= i.minStock);
  const totalItems = items.length;

  const today = startOfDay(new Date());
  
  const expiringItems = items
    .filter(item => item.bestBefore)
    .map(item => {
      try {
        const expiryDate = parse(item.bestBefore!, 'dd/MM/yyyy', new Date());
        const daysLeft = differenceInDays(expiryDate, today);
        return { ...item, daysLeft };
      } catch (e) {
        return { ...item, daysLeft: 999 };
      }
    })
    .filter(item => item.daysLeft <= 2)
    .sort((a, b) => a.daysLeft - b.daysLeft);
  
  const wasteData = transactions
    .filter(t => t.type === 'WASTE')
    .slice(-5)
    .map(t => ({
      name: t.itemName,
      quantidade: t.quantity,
    }));

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end mb-[24px]">
        <div>
          <h1 className="text-[28px] font-normal tracking-[-0.5px]">{t('operationalDashboard')}</h1>
          <div className="text-[14px] text-cafe-text-dim mt-1">{t('overview')}</div>
        </div>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-[16px]">
        <div className="bg-cafe-surface border border-cafe-border p-[20px] rounded-[8px]">
          <div className="text-[11px] uppercase tracking-[1px] text-cafe-text-dim mb-[8px]">{t('totalItems')}</div>
          <div className="font-mono text-[22px] font-semibold">{totalItems}</div>
        </div>

        <div className="bg-cafe-surface border border-cafe-border p-[20px] rounded-[8px]">
          <div className="text-[11px] uppercase tracking-[1px] text-cafe-text-dim mb-[8px]">{t('lowStock')}</div>
          <div className={`font-mono text-[22px] font-semibold ${
            lowStockItems.length === 0 ? 'text-cafe-success' : 
            lowStockItems.length <= 3 ? 'text-[#ffeb3b]' : 
            'text-cafe-danger'
          }`}>
            {lowStockItems.length}
          </div>
        </div>

        <div className="bg-cafe-surface border border-cafe-border p-[20px] rounded-[8px]">
          <div className="text-[11px] uppercase tracking-[1px] text-cafe-text-dim mb-[8px]">{t('expiringSoon')}</div>
          <div className={`font-mono text-[22px] font-semibold ${expiringItems.some(i => i.daysLeft <= 1) ? 'text-cafe-danger' : expiringItems.length > 0 ? 'text-[#ffeb3b]' : 'text-cafe-success'}`}>
            {expiringItems.length}
          </div>
        </div>

        <div className="bg-cafe-surface border border-cafe-border p-[20px] rounded-[8px]">
          <div className="text-[11px] uppercase tracking-[1px] text-cafe-text-dim mb-[8px]">{t('lastCalibration')}</div>
          <div className="font-mono text-[22px] font-semibold text-cafe-accent truncate">
            {espressoTests.length > 0 ? 
                [...espressoTests].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].operator
                : 'N/A'
            }
         </div>
         <div className="text-[12px] text-cafe-text-dim mt-1">
            {espressoTests.length > 0 ? 
                (() => {
                  const date = new Date([...espressoTests].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date);
                  return date.toLocaleDateString(language, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                })()
                : t('noRecords')
            }
         </div>
        </div>
      </div>

      {expiringItems.length > 0 && (
        <div className="bg-cafe-surface border border-cafe-border rounded-[12px] overflow-hidden">
          <div className="p-[16px_20px] bg-cafe-bg/50 border-b border-cafe-border flex items-center gap-2 text-cafe-accent font-semibold text-[14px] uppercase tracking-[0.5px]">
            <Clock className="w-4 h-4" />
            {t('expiringSoon')}
          </div>
          <div className="p-[12px_20px] space-y-3">
            {expiringItems.map(item => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-cafe-border last:border-0">
                <div className="flex flex-col">
                  <span className="text-[14px] font-medium">{item.name}</span>
                  <span className="text-[11px] text-cafe-text-dim">{t('batchLabel')}: {item.batch || 'N/A'} • {t('bestBeforeLabel')}: {item.bestBefore}</span>
                </div>
                <div className={`text-[12px] font-bold px-3 py-1 rounded-full ${
                  item.daysLeft <= 1 ? 'bg-cafe-danger/20 text-cafe-danger border border-cafe-danger/30' :
                  'bg-[#ffeb3b]/10 text-[#ffeb3b] border border-[#ffeb3b]/20'
                }`}>
                  {item.daysLeft < 0 ? t('expired') : 
                   item.daysLeft === 0 ? t('today') :
                   item.daysLeft === 1 ? t('tomorrow') :
                   `${t('expiresIn')} ${item.daysLeft} ${t('days')}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-[24px]">
        <div className="bg-cafe-surface border border-cafe-border rounded-[12px] flex flex-col">
          <div className="p-[20px] border-b border-cafe-border flex justify-between items-center">
            <span className="text-[14px] font-semibold uppercase tracking-[0.5px]">{t('criticalStock')}</span>
          </div>
          {lowStockItems.length === 0 ? (
            <p className="text-cafe-text-dim p-5 text-[13px]">{t('stockAllOrder')}</p>
          ) : (
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="p-[12px_20px] text-cafe-text-dim font-normal border-b border-cafe-border">{t('item')}</th>
                  <th className="p-[12px_20px] text-cafe-text-dim font-normal border-b border-cafe-border">{t('group')}</th>
                  <th className="p-[12px_20px] text-cafe-text-dim font-normal border-b border-cafe-border">{t('currentQty')}</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.slice(0, 5).map(item => (
                  <tr key={item.id}>
                    <td className="p-[16px_20px] border-b border-cafe-border">{item.name}</td>
                    <td className="p-[16px_20px] border-b border-cafe-border">
                      <span className="p-[2px_8px] rounded-[4px] text-[11px] bg-[#333]">{item.categoryName}</span>
                    </td>
                    <td className="p-[16px_20px] border-b border-cafe-border font-mono text-cafe-danger">
                      {item.quantity} {item.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-cafe-surface border border-cafe-border rounded-[12px] flex flex-col">
          <div className="p-[20px] border-b border-cafe-border flex justify-between items-center">
             <span className="text-[14px] font-semibold uppercase tracking-[0.5px]">{t('recentWaste')}</span>
          </div>
          <div className="h-[240px] p-[20px]">
            {wasteData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={wasteData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-cafe-border)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--color-cafe-text-dim)', fontSize: 11}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--color-cafe-text-dim)', fontSize: 11}} />
                  <Tooltip 
                    cursor={{fill: 'var(--color-cafe-border)'}}
                    contentStyle={{borderRadius: '4px', border: '1px solid var(--color-cafe-border)', background: 'var(--color-cafe-surface)', color: 'var(--color-cafe-text)'}}
                  />
                  <Bar dataKey="quantidade" fill="var(--color-cafe-danger)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-cafe-text-dim text-[13px]">
                {t('noRecentRecords')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
