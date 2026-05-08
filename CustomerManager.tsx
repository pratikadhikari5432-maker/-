import React, { useEffect, useState } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc, orderBy, onSnapshot } from 'firebase/firestore';
import { Plus, Trash2, Edit3, User, Phone, Mail, MapPin, Search, History, DollarSign, ArrowRight, UserPlus, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Customer, Invoice } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../../context/LanguageContext';

export default function CustomerManager({ ownerId }: { ownerId?: string }) {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  // History State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const targetUid = ownerId || auth.currentUser?.uid;
    if (!targetUid) return;

    const q = query(
      collection(db, 'customers'),
      where('userId', '==', targetUid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const customerData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      setCustomers(customerData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ownerId]);

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setEditingId(null);
    setShowAddForm(false);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !name || !phone) return;

    setSaving(true);
    setMessage(null);
    const data: Partial<Customer> = {
      name,
      phone,
      email,
      address,
      userId: auth.currentUser.uid,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'customers', editingId), data);
      } else {
        await addDoc(collection(db, 'customers'), {
          ...data,
          totalPurchaseValue: 0,
          totalDue: 0,
          createdAt: new Date().toISOString()
        });
      }
      resetForm();
      setMessage({ type: 'success', text: editingId ? 'Customer updated!' : 'New customer added!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Error saving customer:", error);
      setMessage({ type: 'error', text: 'Failed to save customer details.' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (c: Customer) => {
    setName(c.name);
    setPhone(c.phone);
    setEmail(c.email || '');
    setAddress(c.address || '');
    setEditingId(c.id || null);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this customer?')) {
      await deleteDoc(doc(db, 'customers', id));
    }
  };

  const viewHistory = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, 'invoices'),
        where('customerId', '==', customer.id),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const invoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Invoice[];
      setCustomerInvoices(invoices);
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Customer Relationship</h2>
          <p className="text-slate-500 font-medium">Manage clients, track history & dues</p>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-slate-200"
        >
          <UserPlus className="w-5 h-5" /> Add Customer
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text"
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-slate-100 outline-none transition-all font-medium"
            />
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Balance</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.length > 0 ? filteredCustomers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{c.name}</p>
                            <p className="text-xs text-slate-400 font-medium">{c.email || 'No email'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-700">{c.phone}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[150px]">{c.address || 'No address'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-400 uppercase">Total Due</span>
                          <span className={cn(
                            "text-sm font-black",
                            c.totalDue > 0 ? "text-red-600" : "text-emerald-600"
                          )}>
                            {formatCurrency(c.totalDue)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end bg-slate-50 p-1 rounded-xl w-fit ml-auto">
                          <button 
                            onClick={() => viewHistory(c)}
                            className="p-2 hover:bg-white hover:text-blue-600 text-slate-400 rounded-lg transition-all"
                            title="View History"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleEdit(c)}
                            className="p-2 hover:bg-white hover:text-slate-900 text-slate-400 rounded-lg transition-all"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(c.id!)}
                            className="p-2 hover:bg-white hover:text-red-600 text-slate-400 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic text-sm">
                        {loading ? 'Crunching data...' : 'No customers found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Detail Panel / Add Form */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {showAddForm ? (
              <motion.div 
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-lg text-slate-900">{editingId ? 'Edit Customer' : 'Add Customer'}</h3>
                  <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                </div>
                
                <form onSubmit={handleSaveCustomer} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">Full Name</label>
                    <input 
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">Phone Number</label>
                    <input 
                      required
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="+91 XXXXX XXXXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">Email (Optional)</label>
                    <input 
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase ml-1">Address</label>
                    <textarea 
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"
                      placeholder="Billing Address..."
                    />
                  </div>
                  
                  <button 
                    type="submit"
                    disabled={saving}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-lg shadow-slate-200 hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : editingId ? 'Update Customer' : 'Save Customer'}
                  </button>

                  <AnimatePresence>
                    {message && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={cn(
                          "p-3 rounded-xl text-center text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2",
                          message.type === 'success' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                        )}
                      >
                        {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {message.text}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </form>
              </motion.div>
            ) : selectedCustomer ? (
              <motion.div 
                key="history"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-fit"
              >
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-white rounded-2xl border border-slate-100 flex items-center justify-center text-blue-600 font-black shadow-sm">
                      {selectedCustomer.name.charAt(0).toUpperCase()}
                    </div>
                    <button onClick={() => setSelectedCustomer(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                  </div>
                  <h3 className="font-black text-xl text-slate-900">{selectedCustomer.name}</h3>
                  <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mt-1">
                    <Phone className="w-3 h-3" /> {selectedCustomer.phone}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] font-black text-slate-400 uppercase">Total Buy</p>
                      <p className="text-sm font-black text-slate-900">{formatCurrency(selectedCustomer.totalPurchaseValue)}</p>
                    </div>
                    <div className="bg-red-50 p-3 rounded-2xl border border-red-100 shadow-sm">
                      <p className="text-[10px] font-black text-red-400 uppercase">Outstanding</p>
                      <p className="text-sm font-black text-red-600">{formatCurrency(selectedCustomer.totalDue)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  <h4 className="text-xs font-black text-slate-400 uppercase mb-4 flex items-center gap-2">
                    <History className="w-3 h-3" /> Transaction History
                  </h4>
                  
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {loadingHistory ? (
                      <div className="animate-pulse space-y-3">
                        {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-50 rounded-xl" />)}
                      </div>
                    ) : customerInvoices.length > 0 ? customerInvoices.map((inv) => (
                      <div key={inv.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-sm transition-all">
                        <div>
                          <p className="text-xs font-bold text-slate-900">Inv #{inv.invoiceNumber}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{new Date(inv.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-slate-900">{formatCurrency(inv.totalAmount)}</p>
                          <span className={cn(
                            "text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
                            inv.paymentStatus === 'paid' ? "bg-emerald-100 text-emerald-700" :
                            inv.paymentStatus === 'partial' ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                          )}>
                            {inv.paymentStatus}
                          </span>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-8 text-slate-400 italic text-xs">
                        No transactions found
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 border-dashed rounded-3xl p-12 text-center">
                <div className="w-16 h-16 bg-white rounded-2xl border border-slate-100 flex items-center justify-center mx-auto text-slate-300 mb-4 shadow-sm">
                  <User className="w-8 h-8" />
                </div>
                <p className="text-slate-400 font-medium text-sm">Select a customer to view details or add a new one.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
