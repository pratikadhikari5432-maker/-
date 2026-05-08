import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, limit, orderBy, doc, onSnapshot } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { FileText, Send, MessageSquare, TrendingUp, Users, ArrowUpRight, Palette, Package, BarChart3, Cloud, AlertTriangle, DollarSign, ShieldCheck, Phone, Mail } from 'lucide-react';
import { motion } from 'motion/react';
import { formatCurrency, cn } from '../../lib/utils';
import { UserProfile } from '../../types';
import { storageService } from '../../services/storageService';
import { useLanguage } from '../../context/LanguageContext';

export default function Overview({ onAction, ownerId }: { onAction: (tab: string) => void, ownerId?: string }) {
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    totalInvoices: 0,
    totalSales: 0,
    totalCopies: 0,
    totalWA: 0,
    inventoryValue: 0,
    lowStockCount: 0,
    totalDue: 0
  });
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const targetUid = ownerId || auth.currentUser?.uid;
    if (!targetUid) return;

    const unsubscribeProfile = onSnapshot(doc(db, 'users', targetUid), (snap) => {
      if (snap.exists()) setProfile(snap.data() as UserProfile);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${targetUid}`);
    });

    async function fetchStats() {
      if (!targetUid) return;
      
      try {
        const invQuery = query(collection(db, 'invoices'), where('userId', '==', targetUid));
        const invSnap = await getDocs(invQuery);
        const totalSales = invSnap.docs.reduce((acc, doc) => acc + (doc.data().totalAmount || 0), 0);
        
        const copyQuery = query(collection(db, 'ad_copies'), where('userId', '==', targetUid));
        const copySnap = await getDocs(copyQuery);

        const waQuery = query(collection(db, 'whatsapp_configs'), where('userId', '==', targetUid));
        const waSnap = await getDocs(waQuery);

        const custQuery = query(collection(db, 'customers'), where('userId', '==', targetUid));
        const custSnap = await getDocs(custQuery);
        const totalDue = custSnap.docs.reduce((acc, d) => acc + (d.data().totalDue || 0), 0);

        const prodQuery = query(collection(db, 'products'), where('userId', '==', targetUid));
        const prodSnap = await getDocs(prodQuery);
        let inventoryValue = 0;
        let lowStockCount = 0;
        prodSnap.docs.forEach(d => {
          const data = d.data();
          inventoryValue += (data.price || 0) * (data.stock || 0);
          if (data.stock <= (data.lowStockThreshold || 5)) {
            lowStockCount++;
          }
        });

        setStats({
          totalInvoices: invSnap.size,
          totalSales,
          totalCopies: copySnap.size,
          totalWA: waSnap.size,
          inventoryValue,
          lowStockCount,
          totalDue
        });

        const recentInvQuery = query(
          collection(db, 'invoices'), 
          where('userId', '==', targetUid),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        const recentSnap = await getDocs(recentInvQuery);
        setRecentInvoices(recentSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      } catch (err) {
        console.error("Error fetching stats:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
    return () => unsubscribeProfile();
  }, [ownerId]);

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const used = profile?.storageUsed || 0;
  const limitSize = profile?.storageLimit || storageService.getPlanLimit(profile?.plan);
  const usagePercent = Math.min((used / limitSize) * 100, 100);

  const cards = [
    { label: t('totalRevenue'), value: formatCurrency(stats.totalSales), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Out Standing Due', value: formatCurrency(stats.totalDue), icon: DollarSign, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Inventory Value', value: formatCurrency(stats.inventoryValue), icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: t('totalInvoices'), value: stats.totalInvoices, icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ];

  const currentPlan = profile?.plan || 'free';

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <section>
          <h1 className="text-2xl font-bold text-slate-900">{t('welcome')}, {profile?.businessName || auth.currentUser?.displayName?.split(' ')[0] || 'User'}!</h1>
          <p className="text-slate-500">{t('growBusiness')}</p>
        </section>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white px-6 py-4 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4"
        >
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('currentPlan')}</span>
            <span className="font-black text-slate-900 uppercase tracking-tight">{currentPlan}</span>
          </div>
          <div className="w-px h-8 bg-slate-100" />
          <button 
            onClick={() => onAction('plans')}
            className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors border border-blue-50"
          >
            {t('upgrade')}
          </button>
        </motion.div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4", card.bg)}>
              <card.icon className={cn("w-6 h-6", card.color)} />
            </div>
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? <span className="animate-pulse bg-slate-200 h-8 w-16 block rounded"></span> : card.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Cloud Storage Usage */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Cloud className="w-4 h-4 text-indigo-600" />
            </div>
            <span className="font-bold text-slate-900">Cloud Storage Usage</span>
          </div>
          <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">
            {formatSize(used)} / {formatSize(limitSize)}
          </span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-2">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${usagePercent}%` }}
            className={cn(
              "h-full rounded-full transition-all duration-500",
              usagePercent > 90 ? "bg-red-500" : usagePercent > 70 ? "bg-amber-500" : "bg-indigo-600"
            )}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <span>{Math.round(usagePercent)}% Used</span>
          {usagePercent > 80 && <span className="text-red-500 animate-pulse font-black">Storage Full - Please Upgrade</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">{t('recentInvoices')}</h3>
            <button onClick={() => onAction('invoice')} className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1">
              {t('viewAll')} <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">{t('invoiceNumber')}</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">{t('client')}</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">{t('amount')}</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">{t('status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentInvoices.length > 0 ? recentInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => onAction('invoice')}>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">#{inv.invoiceNumber}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{inv.clientName}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">{formatCurrency(inv.totalAmount)}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase",
                          inv.status === 'paid' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        )}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-sm italic">
                        {loading ? 'Crunching data...' : 'No invoices generated yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900">{t('quickActions')}</h3>
          <div className="grid grid-cols-1 gap-3">
            <button 
              onClick={() => onAction('invoice')}
              className="flex items-center gap-4 p-4 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all font-bold group"
            >
              <FileText className="w-6 h-6" />
              <span>{t('createInvoice')}</span>
              <ArrowUpRight className="ml-auto w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button 
              onClick={() => onAction('sales')}
              className="flex items-center gap-4 p-4 bg-white border border-slate-200 text-slate-800 rounded-2xl hover:bg-slate-50 transition-all font-bold text-left group"
            >
              <BarChart3 className="w-6 h-6 text-indigo-600" />
              <span>{t('salesReport')}</span>
              <ArrowUpRight className="ml-auto w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button 
              onClick={() => onAction('inventory')}
              className="flex items-center gap-4 p-4 bg-white border border-slate-200 text-slate-800 rounded-2xl hover:bg-slate-50 transition-all font-bold text-left group"
            >
              <Package className="w-6 h-6 text-emerald-600" />
              <span>{t('checkInventory')}</span>
              <ArrowUpRight className="ml-auto w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button 
              onClick={() => onAction('adcopy')}
              className="flex items-center gap-4 p-4 bg-white border border-slate-200 text-slate-800 rounded-2xl hover:bg-slate-50 transition-all font-bold text-left group"
            >
              <Send className="w-6 h-6 text-purple-600" />
              <span>{t('generateAd')}</span>
              <ArrowUpRight className="ml-auto w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button 
              onClick={() => onAction('logo')}
              className="flex items-center gap-4 p-4 bg-white border border-slate-200 text-slate-800 rounded-2xl hover:bg-slate-50 transition-all font-bold text-left group"
            >
              <Palette className="w-6 h-6 text-blue-500" />
              <span>{t('designLogo')}</span>
              <ArrowUpRight className="ml-auto w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        </div>
      </div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[2.5rem] p-10 border border-indigo-100 shadow-xl shadow-indigo-50/50 relative overflow-hidden group"
      >
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-10">
          <div className="flex-1 space-y-4 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4" /> Official Platform Support
            </div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter">Need a Custom Solution or Help?</h3>
            <p className="text-slate-500 font-medium text-lg leading-relaxed max-w-xl">
              Connect directly with our lead developer <span className="text-indigo-600 font-black">Pratik Adhikari</span> for prioritized technical assistance, custom plan approvals, or feature requests.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full lg:w-auto">
            <a href="tel:8768003413" className="flex items-center gap-4 p-6 bg-slate-50 rounded-3xl hover:bg-slate-900 hover:text-white transition-all group/card border border-slate-100">
               <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover/card:bg-white/10">
                 <Phone className="w-5 h-5 text-indigo-600 group-hover/card:text-white" />
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Call / WhatsApp</p>
                  <p className="text-sm font-black whitespace-nowrap">8768003413</p>
               </div>
            </a>
            <a href="mailto:pratikadhikari5432@gmail.com" className="flex items-center gap-4 p-6 bg-slate-50 rounded-3xl hover:bg-indigo-600 hover:text-white transition-all group/card border border-slate-100">
               <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover/card:bg-white/10">
                 <Mail className="w-5 h-5 text-indigo-600 group-hover/card:text-white" />
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Email Support</p>
                  <p className="text-sm font-black whitespace-nowrap">pratikadhikari5432@gmail.com</p>
               </div>
            </a>
          </div>
        </div>
        
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-20 pointer-events-none" />
      </motion.div>
    </div>
  );
}
