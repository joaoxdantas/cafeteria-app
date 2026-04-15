import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Coffee, ClipboardList, UserCircle, Layers, LogOut, Store, Sun, Moon } from 'lucide-react';
import { cn } from '../lib/utils';
import { useShop } from '../contexts/ShopContext';
import { useTheme } from '../contexts/ThemeContext';

export function Layout() {
  const location = useLocation();
  const { selectedShop, logoutShop } = useShop();
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { path: '/admin', label: 'Admin', icon: UserCircle },
    { path: '/orders', label: 'Orders', icon: ClipboardList },
    { path: '/barista', label: 'Barista', icon: Coffee },
    { path: '/assembler', label: 'Assembler', icon: Layers },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans transition-colors duration-300">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex justify-between h-10 sm:h-14">
            <div className="flex overflow-x-auto no-scrollbar w-full items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0 flex items-center mr-4 sm:mr-6">
                  <Coffee className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />
                  <span className="ml-2 text-base sm:text-lg font-bold text-slate-900 dark:text-white hidden sm:block">EduCafe</span>
                </div>
                <nav className="flex space-x-2 sm:space-x-8 h-full">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                          "inline-flex items-center px-2 sm:px-1 border-b-2 text-xs sm:text-sm font-medium whitespace-nowrap h-full transition-colors",
                          isActive
                            ? "border-amber-500 text-slate-900 dark:text-white"
                            : "border-transparent text-slate-500 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                      >
                        <Icon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <div className="flex items-center gap-2 sm:gap-4 ml-4">
                <button
                  onClick={toggleTheme}
                  className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                >
                  {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </button>
                <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700">
                  <Store className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{selectedShop?.name}</span>
                </div>
                <button
                  onClick={logoutShop}
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  title="Switch Shop"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full mx-auto p-2 sm:p-4 lg:p-6 overflow-x-hidden flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}

