import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Coffee, ClipboardList, UserCircle, Layers } from 'lucide-react';
import { cn } from '../lib/utils';

export function Layout() {
  const location = useLocation();

  const navItems = [
    { path: '/admin', label: 'Admin', icon: UserCircle },
    { path: '/orders', label: 'Orders', icon: ClipboardList },
    { path: '/barista', label: 'Barista', icon: Coffee },
    { path: '/assembler', label: 'Assembler', icon: Layers },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex justify-between h-10 sm:h-14">
            <div className="flex overflow-x-auto no-scrollbar w-full items-center">
              <div className="flex-shrink-0 flex items-center mr-4 sm:mr-6">
                <Coffee className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />
                <span className="ml-2 text-base sm:text-lg font-bold text-slate-900 hidden sm:block">EduCafe</span>
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
                        "inline-flex items-center px-2 sm:px-1 border-b-2 text-xs sm:text-sm font-medium whitespace-nowrap h-full",
                        isActive
                          ? "border-amber-500 text-slate-900"
                          : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                      )}
                    >
                      <Icon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
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

