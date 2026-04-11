import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Order, OperationType } from '../types';
import { handleFirestoreError } from '../lib/firestore-error';
import { ChevronDown, ChevronUp, Download, Trash2, Filter, AlertTriangle } from 'lucide-react';

export function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Filters
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDrink, setFilterDrink] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const ordersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Order[];
        setOrders(ordersData);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'orders')
    );
    return () => unsubscribe();
  }, []);

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
    setShowConfirmModal(false);
    try {
      const batches = [];
      let currentBatch = writeBatch(db);
      let operationCount = 0;

      for (const order of filteredOrders) {
        currentBatch.delete(doc(db, 'orders', order.id));
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
      handleFirestoreError(error, OperationType.DELETE, 'orders');
    }
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 relative">
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center space-x-3 text-red-600 mb-4">
              <AlertTriangle className="w-8 h-8" />
              <h3 className="text-xl font-bold">Confirm Deletion</h3>
            </div>
            <p className="text-slate-600 mb-6">
              Are you sure you want to delete all {filteredOrders.length} filtered orders? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
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
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Order History</h2>
        <div className="flex space-x-2">
          <button 
            onClick={exportToCSV}
            disabled={filteredOrders.length === 0}
            className="flex items-center px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 text-sm font-medium"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
          <button 
            onClick={() => setShowConfirmModal(true)}
            disabled={filteredOrders.length === 0}
            className="flex items-center px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 text-sm font-medium"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clean History
          </button>
        </div>
      </div>

      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex items-center text-slate-500 mb-2 sm:mb-0 shrink-0">
          <Filter className="w-5 h-5 mr-2" />
          <span className="font-medium">Filters:</span>
        </div>
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <input 
            type="date" 
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="rounded-md border-slate-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm p-2 border"
          />
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border-slate-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm p-2 border"
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
            className="rounded-md border-slate-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm p-2 border"
          />
        </div>
      </div>
      
      {Object.keys(groupedOrders).length === 0 ? (
        <div className="text-center text-slate-500 py-10">No orders found matching criteria.</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedOrders).map(([date, dayOrders]) => {
            const ordersList = dayOrders as Order[];
            return (
            <div key={date} className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
              <button 
                onClick={() => toggleDate(date)}
                className="w-full bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center hover:bg-slate-200 transition-colors focus:outline-none"
              >
                <h3 className="font-bold text-slate-800">{date} <span className="text-slate-500 font-normal text-sm ml-2">({ordersList.length} orders)</span></h3>
                {expandedDates[date] ? (
                  <ChevronUp className="w-5 h-5 text-slate-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-500" />
                )}
              </button>
              
              {expandedDates[date] && (
                <div className="divide-y divide-slate-200">
                  {ordersList.map((order) => (
                    <div key={order.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-slate-500">
                            {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            order.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-lg">{order.customer_name}</h4>
                        <p className="text-amber-700 font-medium">{order.drink_name}</p>
                      </div>
                      
                      <div className="flex-1 text-sm text-slate-600 space-y-1">
                        {order.drink_snapshot?.leite && (
                          <div><span className="font-medium">Milk:</span> <span className="uppercase">{order.milk_type}</span></div>
                        )}
                        <div><span className="font-medium">Sugar:</span> {order.sugar}</div>
                        {order.notes && (
                          <div><span className="font-medium">Notes:</span> {order.notes}</div>
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

