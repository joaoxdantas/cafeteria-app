import React, { useMemo, useState } from 'react';
import { useAppStore } from '../context/StoreContext';
import { format, startOfMonth, subMonths, isToday, isWithinInterval, startOfDay, endOfDay, parseISO, differenceInDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from '../lib/i18n';
import { Printer, Calendar as CalendarIcon, FileSpreadsheet, Info } from 'lucide-react';

export default function Relatorios() {
  const { transactions, items, language } = useAppStore();
  const { t } = useTranslation(language);

  // Filter states
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT' | 'WASTE'>('ALL');
  const [showPrintHint, setShowPrintHint] = useState(false);

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
    const result = formatted.substring(0, 10);
    if (result.length === 10) {
      const [d, m, y] = result.split('/');
      setter(`${y}-${m}-${d}`);
    }
  };

  const onCalendarChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const date = e.target.value;
    if (!date) return;
    setter(date);
  };

  const getDisplayDate = (isoDate: string) => {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tr => {
      const trDate = parseISO(tr.date);
      const isWithinDate = isWithinInterval(trDate, {
        start: startOfDay(parseISO(startDate)),
        end: endOfDay(parseISO(endDate))
      });
      const isTypeMatch = filterType === 'ALL' || tr.type === filterType;
      return isWithinDate && isTypeMatch;
    }).sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  }, [transactions, startDate, endDate, filterType]);

  const metrics = useMemo(() => {
    // Current Filter range values
    const wasteCount = filteredTransactions.filter(t => t.type === 'WASTE').length;
    const inCount = filteredTransactions.filter(t => t.type === 'IN').length;
    const outCount = filteredTransactions.filter(t => t.type === 'OUT').length;
    
    // Efficiency: Average waste per day in selected range
    const daysInRange = Math.max(1, differenceInDays(parseISO(endDate), parseISO(startDate)) + 1);
    const avgDailyWaste = (wasteCount / daysInRange).toFixed(1);

    // Filter-aware Top Selling
    const topSoldGeneral = Object.entries(
      filteredTransactions.filter(t => t.type === 'OUT').reduce((acc, t) => {
        acc[t.itemName] = (acc[t.itemName] || 0) + t.quantity;
        return acc;
      }, {} as Record<string, number>)
    ).map(([name, quantity]) => ({ name, quantity: Number(quantity) }))
     .sort((a, b) => b.quantity - a.quantity)
     .slice(0, 5);

    // Global items count
    const totalItemsInStock = items.filter(item => item.quantity > 0).length;

    return { 
      wasteCount,
      inCount, 
      outCount, 
      totalItemsInStock,
      topSoldGeneral,
      avgDailyWaste
    };
  }, [filteredTransactions, items, startDate, endDate]);

  const exportToCSV = () => {
    try {
      const headers = [t('date'), t('type'), t('item'), t('quantity'), t('batchLabel'), t('notesLabel')];
      const rows = filteredTransactions.map(tr => [
        `"${format(parseISO(tr.date), 'dd/MM/yyyy HH:mm')}"`,
        `"${tr.type}"`,
        `"${tr.itemName.replace(/"/g, '""')}"`,
        tr.quantity,
        `"${(tr.batch || '').replace(/"/g, '""')}"`,
        `"${(tr.notes || '').replace(/"/g, '""')}"`
      ]);

      const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      
      link.setAttribute("href", url);
      link.setAttribute("download", `cafemestre_relatorio_${startDate}_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export CSV:', error);
    }
  };

  const handlePrint = () => {
    // Basic check for iframe environment
    if (window.self !== window.top) {
      setShowPrintHint(true);
      setTimeout(() => setShowPrintHint(false), 8000);
    }
    
    window.focus();
    // Wrap in timeout to allow potential UI reactions to settle
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-[24px] no-print">
        <div>
          <h1 className="text-[28px] font-normal tracking-[-0.5px]">{t('reportsTitle')}</h1>
          <div className="text-[14px] text-cafe-text-dim mt-1">{t('reportsDesc')}</div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-cafe-surface border border-cafe-border px-4 py-2 rounded-[6px] text-[13px] font-medium hover:border-cafe-accent transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-cafe-success" />
            {t('exportCSV')}
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 bg-cafe-accent text-black px-4 py-2 rounded-[6px] text-[13px] font-bold hover:opacity-90 transition-opacity shadow-lg shadow-cafe-accent/20"
          >
            <Printer className="w-4 h-4" />
            {t('printReport')}
          </button>
        </div>
      </header>

      {showPrintHint && (
        <div className="bg-blue-500/10 border border-blue-500/30 text-blue-200 p-4 rounded-[8px] flex items-start gap-3 animate-in fade-in slide-in-from-top-2 no-print">
          <Info className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-[13px]">
            <p className="font-semibold mb-1">{t('printHintTitle')}</p>
            <p>{t('printHintDesc')}</p>
          </div>
        </div>
      )}

      {/* Print header (only visible during printing) */}
      <div className="hidden print:block mb-8 text-center border-b-2 border-black pb-4">
        <h1 className="text-3xl font-bold uppercase tracking-widest">{t('cafeMaster')} - {t('reportsTitle')}</h1>
        <p className="text-sm mt-2">{t('filterBy')}: {format(parseISO(startDate), 'dd/MM/yy')} {t('endDate')} {format(parseISO(endDate), 'dd/MM/yy')}</p>
      </div>
      
      {/* Metrics Row - Now dynamic based on filter */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-[16px]">
        <div className="bg-cafe-surface p-[24px] rounded-[8px] border border-cafe-border printable-card">
          <div className="text-[11px] uppercase tracking-[1.5px] text-cafe-text-dim mb-2">{t('transactionWaste')}</div>
          <div className="text-[28px] font-mono text-cafe-text mb-2">{metrics.wasteCount}</div>
          <div className="text-[12px] text-cafe-text-dim">{t('avgPerDay')} {metrics.avgDailyWaste}{t('avgPerDaySuffix')}</div>
        </div>
        <div className="bg-cafe-surface p-[24px] rounded-[8px] border border-cafe-border printable-card">
          <div className="text-[11px] uppercase tracking-[1.5px] text-cafe-text-dim mb-2">{t('transactionIn')}</div>
          <div className="text-[28px] font-mono text-cafe-text mb-2">{metrics.inCount}</div>
          <div className="text-[12px] text-cafe-text-dim">{t('inSelectedPeriod')}</div>
        </div>
        <div className="bg-cafe-surface p-[24px] rounded-[8px] border border-cafe-border printable-card">
          <div className="text-[11px] uppercase tracking-[1.5px] text-cafe-text-dim mb-2">{t('transactionOut')}</div>
          <div className="text-[28px] font-mono text-cafe-text mb-2">{metrics.outCount}</div>
          <div className="text-[12px] text-cafe-text-dim">{t('inSelectedPeriod')}</div>
        </div>
        <div className="bg-cafe-surface p-[24px] rounded-[8px] border border-cafe-border printable-card">
          <div className="text-[11px] uppercase tracking-[1.5px] text-cafe-text-dim mb-2">{t('currentQty')}</div>
          <div className="text-[28px] font-mono text-cafe-accent mb-2">{metrics.totalItemsInStock}</div>
          <div className="text-[12px] text-cafe-text-dim">{t('activeItemsNow')}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 min-h-[300px] bg-cafe-surface p-[24px] rounded-[8px] border border-cafe-border printable-card">
          <h3 className="text-[16px] font-semibold mb-[24px] tracking-tight">{t('topSoldGeneral')}</h3>
          <div className="h-[220px]">
            {metrics.topSoldGeneral.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.topSoldGeneral} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#333" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 11}} width={80} />
                  <Tooltip cursor={{fill: '#222'}} contentStyle={{background: '#1A1A1A', border: '1px solid #333', color: '#fff'}} />
                  <Bar dataKey="quantity" fill="var(--color-cafe-accent)" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
               <div className="h-full flex items-center justify-center text-cafe-text-dim text-sm italic">{t('noRecentData')}</div>
            )}
          </div>
        </div>

        {/* Filters and History */}
        <div className="lg:col-span-2 bg-cafe-surface rounded-[8px] border border-cafe-border flex flex-col pt-0 printable-card">
          <div className="p-4 border-b border-cafe-border flex flex-wrap gap-4 items-center justify-between no-print">
            <h3 className="text-[15px] font-semibold">{t('detailedHistory')} ({filteredTransactions.length})</h3>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-3 bg-cafe-bg px-3 py-1.5 rounded-[4px] border border-cafe-border">
                <div className="flex items-center gap-2">
                   <div className="relative w-24">
                      <input 
                        type="text"
                        value={getDisplayDate(startDate)}
                        onChange={e => handleDateInput(e.target.value, setStartDate)}
                        className="bg-transparent text-[12px] outline-none border-none text-cafe-text w-full text-center"
                        placeholder="DD/MM/YYYY"
                      />
                      <div className="absolute -inset-1 pointer-events-none" />
                   </div>
                   <div className="relative w-4 h-4 overflow-hidden shrink-0">
                      <CalendarIcon className="w-4 h-4 text-cafe-accent cursor-pointer" />
                      <input 
                        type="date"
                        value={startDate}
                        onChange={e => onCalendarChange(e, setStartDate)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                   </div>
                </div>
                
                <span className="text-cafe-text-dim px-1">→</span>
                
                <div className="flex items-center gap-2">
                   <div className="relative w-24">
                      <input 
                        type="text"
                        value={getDisplayDate(endDate)}
                        onChange={e => handleDateInput(e.target.value, setEndDate)}
                        className="bg-transparent text-[12px] outline-none border-none text-cafe-text w-full text-center"
                        placeholder="DD/MM/YYYY"
                      />
                   </div>
                   <div className="relative w-4 h-4 overflow-hidden shrink-0">
                      <CalendarIcon className="w-4 h-4 text-cafe-accent cursor-pointer" />
                      <input 
                        type="date"
                        value={endDate}
                        onChange={e => onCalendarChange(e, setEndDate)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                   </div>
                </div>
              </div>
              <select 
                value={filterType} 
                onChange={e => setFilterType(e.target.value as any)}
                className="bg-cafe-bg border border-cafe-border rounded-[4px] px-3 py-1.5 text-[12px] outline-none cursor-pointer"
              >
                <option value="ALL">{t('allTypes')}</option>
                <option value="IN">{t('transactionIn')}</option>
                <option value="OUT">{t('transactionOut')}</option>
                <option value="WASTE">{t('transactionWaste')}</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead className="sticky top-0 bg-cafe-bg border-b border-cafe-border z-10 print:static">
                <tr>
                  <th className="p-[12px_16px] font-semibold text-cafe-accent uppercase tracking-[0.5px] text-[11px]">{t('date')}</th>
                  <th className="p-[12px_16px] font-semibold text-cafe-accent uppercase tracking-[0.5px] text-[11px]">{t('type')}</th>
                  <th className="p-[12px_16px] font-semibold text-cafe-accent uppercase tracking-[0.5px] text-[11px]">{t('item')}</th>
                  <th className="p-[12px_16px] font-semibold text-cafe-accent uppercase tracking-[0.5px] text-[11px]">{t('quantity')}</th>
                  <th className="p-[12px_16px] font-semibold text-cafe-accent uppercase tracking-[0.5px] text-[11px] no-print">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cafe-border">
                {filteredTransactions.map((tr) => (
                  <tr key={tr.id} className="hover:bg-cafe-bg/40 transition-colors">
                    <td className="p-[12px_16px] font-mono whitespace-nowrap opacity-80">{format(parseISO(tr.date), 'dd/MM/yy HH:mm')}</td>
                    <td className="p-[12px_16px]">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        tr.type === 'IN' ? 'bg-cafe-success/10 text-cafe-success border border-cafe-success/30' :
                        tr.type === 'OUT' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' :
                        'bg-cafe-danger/10 text-cafe-danger border border-cafe-danger/30'
                      }`}>
                        {tr.type === 'IN' ? t('transactionIn') : tr.type === 'OUT' ? t('transactionOut') : t('transactionWaste')}
                      </span>
                    </td>
                    <td className="p-[12px_16px]">
                      <div className="font-medium">{tr.itemName}</div>
                      {(tr.batch || tr.bestBefore) && (
                        <div className="flex gap-2 mt-0.5 opacity-60 text-[10px] font-mono">
                          {tr.batch && <span>{t('batchLabel')}: {tr.batch}</span>}
                          {tr.bestBefore && <span>{t('bestBeforeLabel')}: {tr.bestBefore}</span>}
                        </div>
                      )}
                    </td>
                    <td className="p-[12px_16px] font-mono">
                      {tr.type === 'IN' ? '+' : '-'}{tr.quantity}
                    </td>
                    <td className="p-[12px_16px] no-print">
                      <div className="flex gap-2">
                        {/* Placeholder for any per-row actions */}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-cafe-text-dim italic">{t('noRecords')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
