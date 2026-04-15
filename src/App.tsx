import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Admin } from './pages/Admin';
import { Orders } from './pages/Orders';
import { Barista } from './pages/Barista';
import { Assembler } from './pages/Assembler';
import { ShopProvider, useShop } from './contexts/ShopContext';
import { ShopSelection } from './components/ShopSelection';
import { ThemeProvider } from './contexts/ThemeContext';

function AppContent() {
  const { selectedShop } = useShop();

  if (!selectedShop) {
    return <ShopSelection />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/orders" replace />} />
          <Route path="admin" element={<Admin />} />
          <Route path="orders" element={<Orders />} />
          <Route path="barista" element={<Barista />} />
          <Route path="assembler" element={<Assembler />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ShopProvider>
        <AppContent />
      </ShopProvider>
    </ThemeProvider>
  );
}
