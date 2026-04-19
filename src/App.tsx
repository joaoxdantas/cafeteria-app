import React, { useState } from 'react';
import { StoreProvider, useAppStore } from './context/StoreContext';
import { LayoutDashboard, Package, Truck, Trash2, Coffee, Menu, X, BarChart, Globe, Thermometer, LogOut } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Estoque from './components/Estoque';
import Fornecedores from './components/Fornecedores';
import Desperdicio from './components/Desperdicio';
import Relatorios from './components/Relatorios';
import Handling from './components/Handling';
import Espresso from './components/Espresso';
import DrinkRecipes from './components/espresso/DrinkRecipes';
import { useTranslation } from './lib/i18n';
import { Language } from './types';
import { signInWithGoogle, logout } from './lib/firebase';

type Tab = 'dashboard' | 'estoque' | 'fornecedores' | 'desperdicio' | 'espresso' | 'relatorios' | 'handling' | 'recipes';

function MainApp() {
  const { language, setLanguage, isLoaded, user, syncError } = useAppStore();
  const { t } = useTranslation(language);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loginError, setLoginError] = useState<string>('');

  const handleLogin = async () => {
    try {
      setLoginError('');
      await signInWithGoogle();
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/popup-closed-by-user') {
        setLoginError('The popup was closed before completing the sign in. If you are inside the editor preview, please open the app in a new tab using the diagonal arrow icon at the top right.');
      } else if (error.code === 'auth/unauthorized-domain') {
        setLoginError('This domain is not authorized for OAuth operations. Please ensure you added it to the Firebase console correctly.');
      } else {
        setLoginError(error.message || 'An unknown error occurred during sign in.');
      }
    }
  };

  const tabs = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { id: 'estoque', label: t('inventory'), icon: Package },
    { id: 'handling', label: t('handling'), icon: Thermometer },
    { id: 'fornecedores', label: t('suppliers'), icon: Truck },
    { id: 'desperdicio', label: t('waste'), icon: Trash2 },
    { id: 'espresso', label: t('espressoTest'), icon: Coffee },
    { id: 'recipes', label: t('recipes'), icon: Menu },
    { id: 'relatorios', label: t('reports'), icon: BarChart },
  ] as const;

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-cafe-bg flex items-center justify-center font-sans text-cafe-text">
        <div className="flex flex-col items-center gap-4">
          <Coffee className="w-12 h-12 text-cafe-accent animate-pulse" />
          <span className="text-cafe-text-dim text-sm uppercase tracking-wider font-semibold">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-cafe-bg flex flex-col items-center justify-center font-sans text-cafe-text p-6">
        <div className="max-w-md w-full bg-cafe-surface border border-cafe-border rounded-xl p-8 flex flex-col items-center text-center">
          <Coffee className="w-16 h-16 text-cafe-accent mb-6" />
          <h1 className="text-2xl font-bold mb-2 uppercase tracking-[1.5px]">{t('cafeMaster')}</h1>
          <p className="text-cafe-text-dim mb-8">Sign in to sync your inventory and recipes seamlessly across all your devices.</p>
          
          {loginError && (
            <div className="w-full bg-red-400/10 border border-red-400/30 text-red-400 p-3 rounded text-sm mb-4 text-left">
              {loginError}
            </div>
          )}

          <button 
            onClick={handleLogin}
            className="w-full py-3 px-4 bg-cafe-accent text-cafe-bg hover:bg-opacity-90 font-bold rounded flex items-center justify-center gap-2 transition-all"
          >
            <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cafe-bg flex flex-col md:flex-row font-sans text-cafe-text">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-cafe-surface border-b border-cafe-border no-print">
        <div className="flex items-center gap-2 text-cafe-accent uppercase tracking-[1px]">
          <Coffee className="w-5 h-5" />
          <span className="font-bold text-sm">{t('cafeMaster')}</span>
        </div>
        <button className="text-cafe-text" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar */}
      <nav className={`${isMobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[240px] bg-cafe-surface border-r border-cafe-border py-[32px] px-[24px] md:min-h-screen shrink-0 no-print`}>
        <div className="hidden md:flex items-center gap-2 text-cafe-accent uppercase tracking-[1px] mb-10">
          <Coffee className="w-5 h-5" />
          <span className="font-bold text-[20px]">{t('cafeMaster')}</span>
        </div>
        <div className="flex flex-col flex-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 py-3 text-[14px] font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-cafe-text'
                  : 'text-cafe-text-dim hover:text-cafe-text'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeTab === tab.id ? 'bg-cafe-accent' : 'bg-transparent'}`} />
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Language Selector */}
        <div className="mt-8 border-t border-cafe-border pt-6">
          <button 
            onClick={logout}
            className="w-full flex items-center gap-2 py-2 px-3 mb-4 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
          
          <div className="flex items-center gap-2 text-[12px] text-cafe-text-dim mb-3 uppercase tracking-wider font-semibold">
            <Globe className="w-4 h-4" />
            {t('language')}
          </div>
          <select 
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="w-full bg-cafe-bg border border-cafe-border rounded-[4px] p-[8px_12px] text-cafe-text text-[13px] outline-none focus:border-cafe-accent mb-4"
          >
            <option value="pt-BR">Português (BR)</option>
            <option value="en-AU">English (AU)</option>
            <option value="fil">Filipino</option>
          </select>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full max-w-7xl mx-auto printable-content flex flex-col relative">
        {syncError && (
          <div className="bg-red-500 text-white p-3 text-sm text-center sticky top-0 z-50 flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span><strong>Cloud Sync Failed:</strong> {syncError} (Data is only saved locally)</span>
          </div>
        )}
        <div className="py-[32px] px-[20px] sm:px-[40px] flex-1">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'estoque' && <Estoque />}
          {activeTab === 'fornecedores' && <Fornecedores />}
          {activeTab === 'desperdicio' && <Desperdicio />}
          {activeTab === 'espresso' && <Espresso />}
          {activeTab === 'recipes' && <DrinkRecipes />}
          {activeTab === 'handling' && <Handling />}
          {activeTab === 'relatorios' && <Relatorios />}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <MainApp />
    </StoreProvider>
  );
}
