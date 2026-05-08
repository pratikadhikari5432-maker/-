import React, { useState, useEffect } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, query, getDocs, doc, updateDoc, onSnapshot, orderBy, where, addDoc, writeBatch, limit } from 'firebase/firestore';
import { Users, FileText, ShoppingBag, TrendingUp, Shield, Activity, Search, AlertCircle, RefreshCcw, CreditCard, Plus, Trash2, Save, Check, MessageSquare, Phone, Mail, ExternalLink, Filter, Wallet, ArrowDownCircle, ArrowUpCircle, X, Send, Smartphone, Landmark, Loader2 } from 'lucide-react';
import { UserProfile, Invoice, Product, SubscriptionPlan, ContactRequest, PlanRequest, RevenueRecord, WithdrawalRequest } from '../../types';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import * as LucideIcons from 'lucide-react';

const ADMIN_DETAILS = {
  email: 'prodyutadhikari99@gmail.com',
  phone: '8768003413',
  name: 'Platform Administrator'
};

const DEFAULT_PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Standard',
    price: '₹99',
    amount: 99,
    period: '/mo',
    description: 'Perfect for small shops and individuals.',
    features: [
      '50 Invoices per month',
      'Inventory (100 products)',
      'WhatsApp Auto-Reply (10 rules)',
      'Basic AI Tools',
      'Auto-pay Enabled',
      'Standard Support'
    ],
    icon: 'Zap',
    color: 'blue'
  },
  {
    id: 'growth',
    name: 'Popular',
    price: '₹200',
    amount: 200,
    period: '/3mo',
    description: 'Quarterly savings for growing businesses.',
    features: [
      '300 Invoices per month',
      'Inventory (500 products)',
      'WhatsApp Auto-Reply (50 rules)',
      'Premium AI Ad Copy',
      'Logo Maker Access',
      'Auto-pay Enabled',
      'Priority Support'
    ],
    icon: 'Star',
    color: 'purple',
    popular: true
  },
  {
    id: 'pro',
    name: 'Advanced',
    price: '₹400',
    amount: 400,
    period: '/6mo',
    description: 'Enterprise grade tools for high volume stores.',
    features: [
      'Unlimited Invoices',
      'Unlimited Inventory',
      'Unlimited WhatsApp Rules',
      'Super AI Tools',
      'Advanced Analytics',
      'Auto-pay Enabled',
      'Dedicated Manager'
    ],
    icon: 'Crown',
    color: 'amber'
  }
];

export default function AdminPanel() {
  const [activeTab, setActiveTab ] = useState<'users' | 'pricing' | 'support' | 'requests' | 'wallets'>('users');
  const userEmail = auth.currentUser?.email;
  const isSuperAdmin = userEmail === 'prodyutadhikari99@gmail.com' || userEmail === 'pratikadhikari5432@gmail.com';

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-4">
          <Shield className="w-16 h-16 text-slate-200 mx-auto" />
          <h2 className="text-2xl font-black text-slate-900">Access Restricted</h2>
          <p className="text-slate-500 font-medium">Only platform administrators can access this console.</p>
        </div>
      </div>
    );
  }
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [supportRequests, setSupportRequests] = useState<ContactRequest[]>([]);
  const [planRequests, setPlanRequests] = useState<PlanRequest[]>([]);
  const [revenueHistory, setRevenueHistory] = useState<RevenueRecord[]>([]);
  const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalRequest[]>([]);
  
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalInvoices: 0,
    totalProducts: 0,
    totalRevenue: 0,
    withdrawn: 0,
    pendingSupport: 0,
    pendingRequests: 0
  });
  
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState<'upi' | 'bank_transfer'>('upi');
  const [upiId, setUpiId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Real-time users list
    const unsubscribe = onSnapshot(collection(db, 'users'), (snap) => {
      const usersList = snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile));
      setUsers(usersList);
      
      const fetchGlobalStats = async () => {
        const invSnap = await getDocs(collection(db, 'invoices'));
        const prodSnap = await getDocs(collection(db, 'products'));
        const supportSnap = await getDocs(query(collection(db, 'contact_requests'), where('status', '==', 'pending')));
        const reqSnap = await getDocs(query(collection(db, 'plan_requests'), where('status', '==', 'pending')));
        
        const revSnap = await getDocs(collection(db, 'revenue_records'));
        const totalRev = revSnap.docs.reduce((acc, d) => acc + (d.data().amount || 0), 0);
        
        const wdSnap = await getDocs(collection(db, 'withdrawal_requests'));
        const totalWithdrawn = wdSnap.docs.reduce((acc, d) => acc + (d.data().amount || 0), 0);
        
        setStats({
          totalUsers: snap.size,
          totalInvoices: invSnap.size,
          totalProducts: prodSnap.size,
          totalRevenue: totalRev,
          withdrawn: totalWithdrawn,
          pendingSupport: supportSnap.size,
          pendingRequests: reqSnap.size
        });
        setLoading(false);
      };

      fetchGlobalStats();
    });

    // Listen to plans
    const unsubscribePlans = onSnapshot(collection(db, 'plans'), (snap) => {
      const plansList = snap.docs.map(d => ({ ...d.data(), id: d.id } as SubscriptionPlan));
      setPlans(plansList);
    });

    // Listen to support requests
    const unsubscribeSupport = onSnapshot(query(collection(db, 'contact_requests'), orderBy('createdAt', 'desc')), (snap) => {
      const requests = snap.docs.map(d => ({ ...d.data(), id: d.id } as ContactRequest));
      setSupportRequests(requests);
    });

    // Listen to plan requests
    const unsubscribePlanReqs = onSnapshot(query(collection(db, 'plan_requests'), orderBy('createdAt', 'desc')), (snap) => {
      const requests = snap.docs.map(d => ({ ...d.data(), id: d.id } as PlanRequest));
      setPlanRequests(requests);
    });

    // Listen to revenue
    const unsubscribeRev = onSnapshot(query(collection(db, 'revenue_records'), orderBy('createdAt', 'desc')), (snap) => {
      const records = snap.docs.map(d => ({ ...d.data(), id: d.id } as RevenueRecord));
      setRevenueHistory(records);
    });

    // Listen to withdrawals
    const unsubscribeWith = onSnapshot(query(collection(db, 'withdrawal_requests'), orderBy('createdAt', 'desc')), (snap) => {
      const records = snap.docs.map(d => ({ ...d.data(), id: d.id } as WithdrawalRequest));
      setWithdrawalHistory(records);
    });

    return () => {
      unsubscribe();
      unsubscribePlans();
      unsubscribeSupport();
      unsubscribePlanReqs();
      unsubscribeRev();
      unsubscribeWith();
    };
  }, []);

  const handleWithdrawRequest = async () => {
    const amount = parseFloat(withdrawAmount);
    const balance = stats.totalRevenue - stats.withdrawn;
    if (isNaN(amount) || amount <= 0) return alert("Enter valid amount");
    if (amount > balance) return alert("Insufficient balance");
    if (!auth.currentUser?.email) return;

    setWithdrawing(true);
    try {
      const wdData: WithdrawalRequest = {
        adminEmail: auth.currentUser.email,
        amount,
        paymentDetails: {
          method: withdrawMethod,
          upiId: withdrawMethod === 'upi' ? upiId : undefined,
          accountNumber: withdrawMethod === 'bank_transfer' ? accountNumber : undefined,
          ifsc: withdrawMethod === 'bank_transfer' ? ifsc : undefined,
          accountHolder: withdrawMethod === 'bank_transfer' ? accountHolder : undefined
        },
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'withdrawal_requests'), wdData);
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      alert("Withdrawal request created!");
    } catch (err) {
      console.error(err);
      alert("Failed to create request");
    } finally {
      setWithdrawing(false);
    }
  };

  const handleApprovePlan = async (req: PlanRequest) => {
    if (!confirm(`Approve ${req.planName} plan for ${req.businessName}?`)) return;
    
    try {
      const batch = writeBatch(db);
      
      // 1. Update request status
      batch.update(doc(db, 'plan_requests', req.id!), { 
        status: 'approved',
        updatedAt: new Date().toISOString()
      });
      
      // 2. Update user plan
      batch.update(doc(db, 'users', req.userId), { 
        plan: req.planId 
      });
      
      // 3. Create revenue record
      const revRef = doc(collection(db, 'revenue_records'));
      batch.set(revRef, {
        userId: req.userId,
        planId: req.planId,
        amount: req.amount,
        type: 'subscription',
        createdAt: new Date().toISOString()
      });
      
      await batch.commit();
      alert("Plan activated and revenue recorded!");
    } catch (err) {
      console.error(err);
      alert("Error approving plan");
    }
  };

  const handleRejectPlan = async (id: string) => {
    if (!confirm("Reject this plan request?")) return;
    try {
      await updateDoc(doc(db, 'plan_requests', id), { 
        status: 'rejected',
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      alert("Error rejecting plan");
    }
  };

  const fetchUserDetailStats = async (userId: string) => {
    try {
      const invQuery = query(collection(db, 'invoices'), where('userId', '==', userId));
      const prodQuery = query(collection(db, 'products'), where('userId', '==', userId));
      const invSnap = await getDocs(invQuery);
      const prodSnap = await getDocs(prodQuery);
      
      setUserStats({
        invoices: invSnap.size,
        products: prodSnap.size,
        revenue: invSnap.docs.reduce((acc, d) => acc + (d.data().totalAmount || 0), 0)
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveRequest = async (id: string) => {
    try {
      await updateDoc(doc(db, 'contact_requests', id), { status: 'resolved' });
    } catch (err) {
      alert("Error resolving request");
    }
  };

  const initializeDefaultPlans = async () => {
    if (!confirm("Reset all pricing plans to defaults? This will overwrite manual changes.")) return;
    try {
      const { setDoc } = await import('firebase/firestore');
      for (const plan of DEFAULT_PLANS) {
        await setDoc(doc(db, 'plans', plan.id), { ...plan });
      }
      alert("Plans initialized successfully!");
    } catch (err) {
      console.error(err);
      alert("Error initializing plans.");
    }
  };

  const handleUpdatePlan = async () => {
    if (!editingPlan) return;
    try {
      await updateDoc(doc(db, 'plans', editingPlan.id), { ...editingPlan });
      setEditingPlan(null);
      alert("Plan updated successfully!");
    } catch (err) {
      console.error(err);
      alert("Error updating plan.");
    }
  };

  const toggleAdmin = async (userId: string, currentRole: string | undefined) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`Switch user to ${newRole}?`)) return;
    
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
    } catch (err) {
      alert("Permission denied. Only root admins can change roles.");
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.businessName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={cn("p-3 rounded-2xl", color)}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tighter">
            <Shield className="w-10 h-10 text-indigo-600" />
            Control Center
          </h2>
          <p className="text-slate-500 font-medium">Empowering multiple business owners with SaaS solutions</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Super Admin</p>
            <p className="text-xs font-black text-slate-900 leading-none">{ADMIN_DETAILS.name}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Users" value={stats.totalUsers} icon={Users} color="bg-blue-50 text-blue-600" />
        <StatCard title="Total Invoices" value={stats.totalInvoices} icon={FileText} color="bg-emerald-50 text-emerald-600" />
        <StatCard title="Inventory Items" value={stats.totalProducts} icon={ShoppingBag} color="bg-orange-50 text-orange-600" />
        <StatCard title="Wallet Balance" value={`₹${(stats.totalRevenue - stats.withdrawn).toLocaleString()}`} icon={Wallet} color="bg-purple-50 text-purple-600" />
        <StatCard title="Total Earnings" value={`₹${stats.totalRevenue.toLocaleString()}`} icon={TrendingUp} color="bg-emerald-50 text-emerald-600" />
      </div>

      <div className="flex bg-white p-1 rounded-2xl w-fit border border-slate-100 shadow-sm overflow-x-auto max-w-full">
        <button 
          onClick={() => setActiveTab('users')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-black transition-all whitespace-nowrap",
            activeTab === 'users' ? "bg-slate-900 text-white shadow-xl shadow-slate-200" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Users
        </button>
        <button 
          onClick={() => setActiveTab('requests')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-black transition-all relative whitespace-nowrap",
            activeTab === 'requests' ? "bg-slate-900 text-white shadow-xl shadow-slate-200" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Requests
          {stats.pendingRequests > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-[10px] flex items-center justify-center rounded-full animate-bounce">
              {stats.pendingRequests}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('wallets')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-black transition-all whitespace-nowrap",
            activeTab === 'wallets' ? "bg-slate-900 text-white shadow-xl shadow-slate-200" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Earnings
        </button>
        <button 
          onClick={() => setActiveTab('pricing')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-black transition-all",
            activeTab === 'pricing' ? "bg-slate-900 text-white shadow-xl shadow-slate-200" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Plans
        </button>
        <button 
          onClick={() => setActiveTab('support')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-black transition-all relative",
            activeTab === 'support' ? "bg-slate-900 text-white shadow-xl shadow-slate-200" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Support
          {stats.pendingSupport > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full animate-bounce">
              {stats.pendingSupport}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                <Users className="w-6 h-6 text-indigo-600" />
                Active Businesses
              </h3>
              <p className="text-sm font-medium text-slate-500 mt-1">Manage and monitor all business accounts on the platform</p>
            </div>
            <div className="relative group">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-600 transition-colors" />
              <input 
                type="text"
                placeholder="Find business by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 pr-6 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-600 w-full md:w-80 outline-none transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">
                  <th className="px-8 py-5">Business Details</th>
                  <th className="px-8 py-5">Current Tier</th>
                  <th className="px-8 py-5">Contact</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredUsers.map((user) => (
                  <tr key={user.uid} className="group hover:bg-slate-50 transition-all cursor-pointer" onClick={() => {
                    setSelectedUser(user);
                    fetchUserDetailStats(user.uid!);
                  }}>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center font-black text-indigo-600 overflow-hidden ring-4 ring-white group-hover:ring-indigo-100 transition-all">
                          {user.logo ? <img src={user.logo} className="w-full h-full object-cover" /> : user.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{user.businessName || 'Unnamed Business'}</p>
                          <p className="text-xs font-bold text-slate-400 mt-0.5">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider w-fit",
                          user.plan === 'pro' ? "bg-purple-100 text-purple-700" : user.plan === 'enterprise' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                        )}>
                          {user.plan || 'Free Plan'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 pl-1 uppercase tracking-tighter">
                          Joined {new Date(user.createdAt!).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-sm font-medium text-slate-600">
                      {user.phone || 'No Phone'}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAdmin(user.uid!, user.role);
                          }}
                          className={cn(
                            "p-2.5 rounded-xl transition-all border border-transparent",
                            user.role === 'admin' 
                              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                              : "text-slate-400 hover:bg-white hover:border-slate-200 hover:text-indigo-600"
                          )}
                          title={user.role === 'admin' ? "Super Admin Access" : "Grant Admin Rights"}
                        >
                          <Shield className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                <CreditCard className="w-8 h-8 text-indigo-600" />
                Plan Requests
              </h3>
              <p className="text-slate-500 font-medium">Verify payments and activate subscription plans</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <AnimatePresence mode="popLayout">
              {planRequests.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-20 text-center bg-white rounded-[3rem] border border-slate-100 shadow-sm"
                >
                  <Check className="w-16 h-16 text-emerald-100 mx-auto mb-4" />
                  <p className="text-slate-500 font-bold">No plan requests found.</p>
                </motion.div>
              ) : (
                planRequests.map((req) => (
                  <motion.div 
                    layout
                    key={req.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "bg-white p-8 rounded-[2.5rem] border transition-all shadow-sm flex flex-col gap-6",
                      req.status === 'pending' ? "border-slate-100" : "border-slate-50 opacity-60"
                    )}
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center font-black text-xl text-indigo-600">
                          {req.businessName?.[0].toUpperCase() || 'U'}
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{req.businessName}</h4>
                          <p className="text-xs font-bold text-slate-400 mt-0.5">{req.userEmail}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-2xl font-black text-slate-900 tracking-tight">₹{req.amount}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{req.planName} Plan</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Method</p>
                        <p className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wide">
                          {req.paymentDetails.method}
                        </p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ref / ID</p>
                        <p className="text-sm font-black text-slate-900">{req.paymentDetails.transactionId || 'N/A'}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Request Date</p>
                        <p className="text-sm font-bold text-slate-600">{new Date(req.createdAt).toLocaleString()}</p>
                      </div>
                    </div>

                    {req.paymentDetails.method === 'bank_transfer' && (
                      <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-center">
                         <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Account Details</p>
                         <p className="text-sm font-black text-blue-900">{req.paymentDetails.accountHolder} • {req.paymentDetails.accountNumber} • {req.paymentDetails.ifsc}</p>
                      </div>
                    )}

                    {req.status === 'pending' ? (
                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button 
                          onClick={() => handleApprovePlan(req)}
                          className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-emerald-50 hover:bg-emerald-700 transition-all"
                        >
                          <Check className="w-4 h-4" /> Approve & Activate
                        </button>
                        <button 
                          onClick={() => handleRejectPlan(req.id!)}
                          className="flex-1 bg-white border border-red-100 text-red-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-50 transition-all"
                        >
                          <X className="w-4 h-4" /> Reject Request
                        </button>
                      </div>
                    ) : (
                      <div className="pt-2">
                        <span className={cn(
                          "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest",
                          req.status === 'approved' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                        )}>
                          Request {req.status}
                        </span>
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {activeTab === 'wallets' && (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                <Wallet className="w-8 h-8 text-indigo-600" />
                Revenue & Wallets
              </h3>
              <p className="text-slate-500 font-medium">Keep track of your earnings and withdraw funds</p>
            </div>
            <button 
              onClick={() => setShowWithdrawModal(true)}
              className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-black shadow-xl shadow-slate-200 transition-all"
            >
              <ArrowDownCircle className="w-4 h-4" /> Withdraw Funds
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-50">
                  <h4 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Revenue History</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 text-[10px] uppercase tracking-widest font-black text-slate-400">
                        <th className="px-8 py-4">Source</th>
                        <th className="px-8 py-4">Amount</th>
                        <th className="px-8 py-4 text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {revenueHistory.length === 0 ? (
                        <tr>
                           <td colSpan={3} className="px-8 py-12 text-center text-slate-400 font-bold italic font-mono">No revenue recorded yet.</td>
                        </tr>
                      ) : (
                        revenueHistory.map((rev) => (
                          <tr key={rev.id} className="hover:bg-slate-50/50 transition-all">
                            <td className="px-8 py-4">
                               <p className="text-sm font-black text-slate-900 uppercase">Subscription</p>
                               <p className="text-[10px] font-bold text-slate-400 uppercase">{rev.planId}</p>
                            </td>
                            <td className="px-8 py-4">
                               <span className="text-emerald-600 font-black">+ ₹{rev.amount}</span>
                            </td>
                            <td className="px-8 py-4 text-right text-xs font-bold text-slate-400">
                               {new Date(rev.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-50">
                  <h4 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Withdrawals</h4>
                </div>
                <div className="p-4 space-y-3">
                   {withdrawalHistory.length === 0 ? (
                     <div className="py-10 text-center text-slate-400 text-xs font-bold italic font-mono uppercase tracking-widest">No history.</div>
                   ) : (
                     withdrawalHistory.map((wd) => (
                       <div key={wd.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-3 shadow-inner">
                          <div className="flex items-center justify-between">
                             <div className="p-2 bg-white rounded-xl shadow-sm">
                                <ArrowUpCircle className="w-5 h-5 text-red-500" />
                             </div>
                             <span className={cn(
                               "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest",
                               wd.status === 'completed' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                             )}>
                               {wd.status}
                             </span>
                          </div>
                          <div>
                             <p className="text-lg font-black text-slate-900 tracking-tighter">₹{wd.amount}</p>
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-200/50 pt-2">{new Date(wd.createdAt).toLocaleString()}</p>
                          </div>
                       </div>
                     ))
                   )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'support' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                <MessageSquare className="w-8 h-8 text-indigo-600" />
                Support Inbox
              </h3>
              <p className="text-slate-500 font-medium">Respond to inquiries and help solve user problems</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <AnimatePresence mode="popLayout">
              {supportRequests.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-20 text-center bg-white rounded-[3rem] border border-slate-100 shadow-sm"
                >
                  <Check className="w-16 h-16 text-emerald-100 mx-auto mb-4" />
                  <p className="text-slate-500 font-bold">All caught up! No pending requests.</p>
                </motion.div>
              ) : (
                supportRequests.map((req) => (
                  <motion.div 
                    layout
                    key={req.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "bg-white p-8 rounded-[2.5rem] border transition-all shadow-sm flex flex-col md:flex-row gap-8 items-start",
                      req.status === 'pending' ? "border-slate-100" : "border-slate-50 opacity-60"
                    )}
                  >
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black">
                          {req.userName[0].toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">{req.subject || 'Support Request'}</h4>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                              <Mail className="w-3 h-3" /> {req.userEmail}
                            </span>
                            <span className="text-xs font-bold text-slate-300">•</span>
                            <span className="text-xs font-bold text-slate-400">
                              {new Date(req.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <p className="text-slate-700 font-medium leading-relaxed italic">"{req.message}"</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 w-full md:w-auto flex-shrink-0">
                      {req.status === 'pending' ? (
                        <>
                          <a 
                            href={`mailto:${req.userEmail}?subject=Re: ${req.subject}`}
                            className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-sm text-center shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                          >
                            <Mail className="w-4 h-4" /> Reply Now
                          </a>
                          <button 
                            onClick={() => handleResolveRequest(req.id!)}
                            className="bg-emerald-50 text-emerald-600 px-8 py-4 rounded-2xl font-black text-sm text-center border border-emerald-100 hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
                          >
                            <Check className="w-4 h-4" /> Mark Resolved
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 text-emerald-600 font-black text-sm uppercase px-8 py-4">
                          <Check className="w-5 h-5" /> Resolved
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {activeTab === 'pricing' && (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                <CreditCard className="w-8 h-8 text-indigo-600" />
                Subscription Plans
              </h3>
              <p className="text-slate-500 font-medium">Customize features and pricing for each tier</p>
            </div>
            <button 
              onClick={initializeDefaultPlans}
              className="px-6 py-3 bg-white border border-slate-200 text-slate-900 rounded-2xl text-sm font-black hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" /> Reset Defaults
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.sort((a,b) => a.amount - b.amount).map((plan) => (
              <motion.div 
                layout
                key={plan.id}
                className={cn(
                  "bg-white p-8 rounded-[2.5rem] border-4 transition-all group relative overflow-hidden",
                  plan.popular ? "border-indigo-600 shadow-2xl shadow-indigo-100" : "border-slate-50"
                )}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest px-6 py-2 rounded-bl-2xl">
                    Popular
                  </div>
                )}

                <div className="flex justify-between items-start mb-8">
                  <div className={cn(
                    "p-5 rounded-3xl",
                    plan.color === 'blue' ? "bg-blue-50 text-blue-600" : 
                    plan.color === 'purple' ? "bg-purple-50 text-purple-600" : "bg-amber-50 text-amber-600"
                  )}>
                    {LucideIcons[plan.icon as keyof typeof LucideIcons] ? (
                      React.createElement(LucideIcons[plan.icon as keyof typeof LucideIcons] as any, { className: "w-8 h-8" })
                    ) : <ShoppingBag className="w-8 h-8" />}
                  </div>
                  <button 
                    onClick={() => setEditingPlan(plan)}
                    className="p-3 bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white rounded-2xl transition-all"
                  >
                    <Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>

                <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{plan.name}</h4>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-4xl font-black text-slate-900 tracking-tighter">{plan.price}</span>
                  <span className="text-slate-400 font-bold text-sm uppercase">{plan.period}</span>
                </div>

                <p className="text-slate-500 font-medium text-sm mt-4 min-h-[48px] line-clamp-2">{plan.description}</p>

                <div className="mt-8 space-y-4">
                  {plan.features.slice(0, 5).map((f, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-emerald-600" />
                      </div>
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">{f}</span>
                    </div>
                  ))}
                  {plan.features.length > 5 && (
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest pl-8">+{plan.features.length - 5} More Features</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* User Stats Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedUser(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-10 text-center relative">
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full text-slate-400"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>

                <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-4xl font-black text-indigo-600 ring-8 ring-white shadow-xl shadow-slate-100 overflow-hidden">
                   {selectedUser.logo ? <img src={selectedUser.logo} className="w-full h-full object-cover" /> : selectedUser.email[0].toUpperCase()}
                </div>
                
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{selectedUser.businessName || 'Unnamed Business'}</h3>
                <p className="text-slate-400 font-bold flex items-center justify-center gap-2 mt-1">
                  <Mail className="w-4 h-4" /> {selectedUser.email}
                </p>

                <div className="grid grid-cols-3 gap-4 mt-10">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Invoices</p>
                    <p className="text-2xl font-black text-slate-900 leading-none">{userStats?.invoices || 0}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Products</p>
                    <p className="text-2xl font-black text-slate-900 leading-none">{userStats?.products || 0}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Revenue</p>
                    <p className="text-xl font-black text-slate-900 leading-none">₹{userStats?.revenue?.toLocaleString() || 0}</p>
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  {selectedUser.address && (
                    <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-2xl text-left border border-slate-100">
                      <ShoppingBag className="w-5 h-5 text-slate-400 flex-shrink-0" />
                      <p className="text-xs font-bold text-slate-600">{selectedUser.address}</p>
                    </div>
                  )}
                  {selectedUser.phone && (
                    <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl text-left border border-slate-100">
                      <Phone className="w-5 h-5 text-slate-400 flex-shrink-0" />
                      <p className="text-xs font-bold text-slate-600">{selectedUser.phone}</p>
                    </div>
                  )}
                </div>

                <button 
                   onClick={() => setSelectedUser(null)}
                   className="w-full mt-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                >
                  Close Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="pt-10 border-t border-slate-100 text-center">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Root Administrator Contact</p>
        <div className="flex items-center justify-center gap-8 mt-4">
          <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
            <Mail className="w-4 h-4 text-indigo-400" /> {ADMIN_DETAILS.email}
          </div>
          <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
            <Phone className="w-4 h-4 text-indigo-400" /> {ADMIN_DETAILS.phone}
          </div>
        </div>
      </footer>

      {/* Editor Modal is handled above (pricing section) */}
      
      {/* Withdrawal Modal */}
      <AnimatePresence>
        {showWithdrawModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setShowWithdrawModal(false)}
               className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="relative bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden"
            >
               <div className="p-8 md:p-12 space-y-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Withdraw Revenue</h3>
                      <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">
                        Available Balance: ₹{(stats.totalRevenue - stats.withdrawn).toLocaleString()}
                      </p>
                    </div>
                    <button onClick={() => setShowWithdrawModal(false)} className="p-3 bg-slate-100 text-slate-400 rounded-2xl"><X /></button>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                       <button 
                         onClick={() => setWithdrawMethod('upi')}
                         className={cn(
                           "p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-2",
                           withdrawMethod === 'upi' ? "border-indigo-600 bg-indigo-50 text-indigo-600" : "bg-slate-50 border-transparent text-slate-400"
                         )}
                       >
                         <Smartphone />
                         <span className="font-black text-[10px] uppercase tracking-widest">UPI</span>
                       </button>
                       <button 
                         onClick={() => setWithdrawMethod('bank_transfer')}
                         className={cn(
                           "p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-2",
                           withdrawMethod === 'bank_transfer' ? "border-indigo-600 bg-indigo-50 text-indigo-600" : "bg-slate-50 border-transparent text-slate-400"
                         )}
                       >
                         <Landmark />
                         <span className="font-black text-[10px] uppercase tracking-widest">Bank</span>
                       </button>
                    </div>

                    <div className="space-y-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount to Withdraw</label>
                          <input 
                             type="number"
                             value={withdrawAmount}
                             onChange={e => setWithdrawAmount(e.target.value)}
                             placeholder="Enter amount in ₹"
                             className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-indigo-600 focus:bg-white outline-none font-black text-xl"
                          />
                       </div>

                       {withdrawMethod === 'upi' ? (
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Your UPI ID</label>
                            <input 
                               type="text"
                               value={upiId}
                               onChange={e => setUpiId(e.target.value)}
                               placeholder="user@upi"
                               className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-indigo-600 focus:bg-white outline-none font-bold"
                            />
                         </div>
                       ) : (
                         <div className="space-y-4">
                            <input 
                               placeholder="Account Holder Name"
                               value={accountHolder}
                               onChange={e => setAccountHolder(e.target.value)}
                               className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-indigo-600 focus:bg-white outline-none font-bold"
                            />
                            <input 
                               placeholder="Account Number"
                               value={accountNumber}
                               onChange={e => setAccountNumber(e.target.value)}
                               className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-indigo-600 focus:bg-white outline-none font-bold"
                            />
                            <input 
                               placeholder="IFSC Code"
                               value={ifsc}
                               onChange={e => setIfsc(e.target.value)}
                               className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-indigo-600 focus:bg-white outline-none font-bold"
                            />
                         </div>
                       )}
                    </div>
                  </div>

                  <button
                    disabled={withdrawing}
                    onClick={handleWithdrawRequest}
                    className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-2xl shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {withdrawing ? <Loader2 className="animate-spin" /> : <Shield className="w-5 h-5" />}
                    Confirm Withdrawal
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
