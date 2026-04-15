import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Order, OperationType } from '../types';
import { handleFirestoreError } from '../lib/firestore-error';
import { ChevronDown, ChevronUp, Download, Trash2, Filter, AlertTriangle } from 'lucide-react';
import { useShop } from '../contexts/ShopContext';

export function OrderHistory() {
  const { selectedShop } = useShop();
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Filters
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDrink, setFilterDrink] = useState('');

  useEffect(() => {
    if (!selectedShop) return;

    const q = query(collection(db, 'shops', selectedShop.id, 'orders'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const ordersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Order[];
        setOrders(ordersData);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `shops/${selectedShop.id}/orders`)
    );
    return () => unsubscribe();
  }, [selectedShop]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const orderDate = new Date(order.timestamp).toISOString().split('T')[0];
      const matchDate = filterDate ? orderDate === filterDate : true;
      const matchStatus = filterStatus !== 'all' ? order.status === filterStatus : true;
      const matchDrink = filterDrink ? order.drink_name.toLowerCase().includes(filterDrink.toLowerCase()) : true;
      return matchDate && matchStatus && matchDrink;
    });
  }, [orders, filterDate, filterStatus, filterDrink]);

  // Group orders by date
  const groupedOrders = useMemo(() => {
    return filteredOrders.reduce((acc, order) => {
      const dateObj = new Date(order.timestamp);
      // Use a standard format for grouping, e.g., YYYY-MM-DD
      const dateKey = dateObj.toLocaleDateString();
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(order);
      return acc;
    }, {} as Record<string, Order[]>);
  }, [filteredOrders]);

  // Expand the first date by default when data loads
  useEffect(() => {
    if (Object.keys(groupedOrders).length > 0 && Object.keys(expandedDates).length === 0) {
      setExpandedDates({ [Object.keys(groupedOrders)[0]]: true });
    }
  }, [groupedOrders, expandedDates]);

  const toggleDate = (date: string) => {
    setExpandedDates(prev => ({
      ...prev,
      [date]: !prev[date]
    }));
  };

  const exportToCSV = () => {
    if (filteredOrders.length === 0) return;

    const headers = ['Date', 'Time', 'Customer', 'Drink', 'Milk', 'Sugar', 'Notes', 'Status'];
    const rows = filteredOrders.map(order => {
      const dateObj = new Date(order.timestamp);
      return [
        dateObj.toLocaleDateString(),
        dateObj.toLocaleTimeString(),
        `"${order.customer_name}"`,
        `"${order.drink_name}"`,
        order.drink_snapshot?.leite ? order.milk_type : 'N/A',
        order.sugar,
        `"${order.notes || ''}"`,
        order.status
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `orders_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const confirmCleanHistory = async () => {
    if (!selectedShop) return;
    setShowConfirmModal(false);
    try {
      const batches = [];
      let currentBatch = writeBatch(db);
      let operationCount = 0;

      for (const order of filteredOrders) {
        currentBatch.delete(doc(db, 'shops', selectedShop.id, 'orders', order.id));
        operationCount++;

        if (operationCount === 500) {
          batches.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          operationCount = 0;
        }
      }

      if (operationCount > 0) {
        batches.push(currentBatch.commit());
      }

      await Promise.all(batches);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `shops/${selectedShop.id}/orders`);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 relative transition-colors duration-300">
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6 border border-transparent dark:border-slate-800">
            <div className="flex items-center space-x-3 text-red-600 dark:text-red-400 mb-4">
              <AlertTriangle className="w-8 h-8" />
              <h3 className="text-xl font-bold">Confirm Deletion</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Are you sure you want to delete all {filteredOrders.length} filtered orders? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmCleanHistory}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium transition-colors"
              >
                Delete Orders
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Order History</h2>
        <div className="flex space-x-2">
          <button 
            onClick={exportToCSV}
            disabled={filteredOrders.length === 0}
            className="flex items-center px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 text-sm font-medium"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
          <button 
            onClick={() => setShowConfirmModal(true)}
            disabled={filteredOrders.length === 0}
            className="flex items-center px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50 text-sm font-medium"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clean History
          </button>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800 mb-6 flex flex-col sm:flex-row gap-4 transition-colors">
        <div className="flex items-center text-slate-500 dark:text-slate-400 mb-2 sm:mb-0 shrink-0">
          <Filter className="w-5 h-5 mr-2" />
          <span className="font-medium">Filters:</span>
        </div>
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <input 
            type="date" 
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm p-2 border transition-colors"
          />
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm p-2 border transition-colors"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>
          <input 
            type="text" 
            placeholder="Search by drink name..."
            value={filterDrink}
            onChange={(e) => setFilterDrink(e.target.value)}
            className="rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm p-2 border transition-colors"
          />
        </div>
      </div>
      
      {Object.keys(groupedOrders).length === 0 ? (
        <div className="text-center text-slate-500 dark:text-slate-400 py-10">No orders found matching criteria.</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedOrders).map(([date, dayOrders]) => {
            const ordersList = dayOrders as Order[];
            return (
            <div key={date} className="bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
              <button 
                onClick={() => toggleDate(date)}
                className="w-full bg-slate-100 dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:outline-none"
              >
                <h3 className="font-bold text-slate-800 dark:text-white">{date} <span className="text-slate-500 dark:text-slate-400 font-normal text-sm ml-2">({ordersList.length} orders)</span></h3>
                {expandedDates[date] ? (
                  <ChevronUp className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                )}
              </button>
              
              {expandedDates[date] && (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {ordersList.map((order) => (
                    <div key={order.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            order.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-lg">{order.customer_name}</h4>
                        <p className="text-amber-700 dark:text-amber-500 font-medium">{order.drink_name}</p>
                      </div>
                      
                      <div className="flex-1 text-sm text-slate-600 dark:text-slate-400 space-y-1">
                        {order.drink_snapshot?.leite && (
                          <div><span className="font-medium text-slate-700 dark:text-slate-300">Milk:</span> <span className="uppercase">{order.milk_type}</span></div>
                        )}
                        <div><span className="font-medium text-slate-700 dark:text-slate-300">Sugar:</span> {order.sugar}</div>
                        {order.notes && (
                          <div><span className="font-medium text-slate-700 dark:text-slate-300">Notes:</span> {order.notes}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )})}
        </div>
      )}
    </div>
  );
}

