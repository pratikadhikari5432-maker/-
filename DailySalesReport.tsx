import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { TrendingUp, ShoppingBag, CreditCard, Calendar, BarChart3, ChevronRight, FileText, Download, DollarSign } from 'lucide-react';
import { Invoice } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { motion } from 'motion/react';

export default function DailySalesReport({ ownerId }: { ownerId?: string }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const targetUid = ownerId || auth.currentUser?.uid;
    if (!targetUid) return;
    
    const start = startOfDay(new Date(selectedDate)).toISOString();
    const end = endOfDay(new Date(selectedDate)).toISOString();

    const q = query(
      collection(db, 'invoices'),
      where('userId', '==', targetUid),
      where('createdAt', '>=', start),
      where('createdAt', '<=', end),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'invoices');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedDate, ownerId]);

  const stats = invoices.reduce((acc, inv) => {
    const invoiceProfit = inv.items.reduce((sum, item) => {
      const buyPrice = item.purchasePrice || 0;
      const sellPrice = item.price;
      const discPerUnit = (item.discount || 0) / (item.quantity || 1);
      // Simple profit: (Sell Price - Buy Price - Discount) * Qty
      // Tax is usually external but if price is tax inclusive it depends. 
      // Usually Profit = (Taxable Amount - Cost)
      const taxableAmount = (item.price * item.quantity) - (item.discount || 0);
      const cost = (item.purchasePrice || 0) * item.quantity;
      return sum + (taxableAmount - cost);
    }, 0);

    return {
      totalSales: acc.totalSales + inv.totalAmount,
      totalTax: acc.totalTax + inv.taxAmount,
      totalProfit: acc.totalProfit + invoiceProfit,
      totalCount: acc.totalCount + 1,
      totalItems: acc.totalItems + inv.items.reduce((sum, item) => sum + item.quantity, 0)
    };
  }, { totalSales: 0, totalTax: 0, totalProfit: 0, totalCount: 0, totalItems: 0 });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 italic">Daily Sales Insights</h2>
          <p className="text-slate-500">Track your business performance in real-time</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
          <Calendar className="w-5 h-5 text-indigo-600 ml-2" />
          <input 
            type="date" 
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="border-none outline-none text-sm font-bold bg-transparent pr-4"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Today\'s Sales', value: formatCurrency(stats.totalSales), icon: TrendingUp, color: 'emerald' },
          { label: 'Estimated Profit', value: formatCurrency(stats.totalProfit), icon: DollarSign, color: 'indigo' },
          { label: 'Tax Collected', value: formatCurrency(stats.totalTax), icon: CreditCard, color: 'blue' },
          { label: 'Items Sold', value: stats.totalItems, icon: ShoppingBag, color: 'amber' }
        ].map((stat, idx) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden"
          >
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 bg-${stat.color}-50 rounded-full blur-2xl opacity-50`} />
            <stat.icon className={`w-8 h-8 text-${stat.color}-600 mb-4`} />
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">{stat.label}</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{stat.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mt-8">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" /> Transaction List
          </h3>
          <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full uppercase italic">
            {format(new Date(selectedDate), 'PP')}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100 italic">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Bill No</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Time</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Customer</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.length > 0 ? invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-black text-slate-900 font-mono">#{inv.invoiceNumber}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 font-mono">{format(new Date(inv.createdAt), 'p')}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">{inv.clientName}</td>
                  <td className="px-6 py-4 text-right text-sm font-black text-slate-900 italic">{formatCurrency(inv.totalAmount)}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-indigo-600 hover:text-indigo-800">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic text-sm">
                    No transactions recorded for this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
