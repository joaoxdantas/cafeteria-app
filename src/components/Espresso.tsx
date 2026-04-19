import React, { useState } from 'react';
import { useTranslation } from '../lib/i18n';
import { useAppStore } from '../context/StoreContext';
import { Coffee, Wrench, FileText } from 'lucide-react';
import EspressoCalibration from './espresso/EspressoCalibration';
import MachineMaintenance from './espresso/MachineMaintenance';

type EspressoTab = 'calibration' | 'maintenance';

export default function Espresso() {
  const { language } = useAppStore();
  const { t } = useTranslation(language);
  const [activeTab, setActiveTab] = useState<EspressoTab>('calibration');

  const tabs = [
    { id: 'calibration', label: t('espressoCalibration'), icon: Coffee },
    { id: 'maintenance', label: t('maintenance'), icon: Wrench },
  ] as const;

  return (
    <div className="space-y-6">
      <header className="mb-[24px]">
        <h1 className="text-[28px] font-normal tracking-[-0.5px]">{t('espressoTest')}</h1>
      </header>

      {/* Internal Tabs */}
      <div className="flex border-b border-cafe-border mb-8 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as EspressoTab)}
            className={`flex items-center gap-2 px-6 py-3 text-[14px] font-medium border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-cafe-accent text-cafe-accent bg-cafe-accent/5'
                : 'border-transparent text-cafe-text-dim hover:text-cafe-text hover:bg-cafe-surface'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'calibration' && <EspressoCalibration />}
        {activeTab === 'maintenance' && <MachineMaintenance />}
      </div>
    </div>
  );
}
