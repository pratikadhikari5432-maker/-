import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc, orderBy, onSnapshot } from 'firebase/firestore';
import { Plus, Trash2, Edit3, Package, Archive, AlertTriangle, Search, Filter, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Product, UserProfile } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { localStore } from '../../lib/localStorage';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../../context/LanguageContext';
import { notificationService } from '../../services/notificationService';

export default function InventoryManager({ ownerId }: { ownerId?: string }) {
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [search, setSearch] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(0);
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [stock, setStock] = useState(0);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [sku, setSku] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [gstPercent, setGstPercent] = useState(18);
  const [barcode, setBarcode] = useState('');

  useEffect(() => {
    const targetUid = ownerId || auth.currentUser?.uid;
    if (!targetUid) return;
    setLoading(true);
    
    // Load cache
    const cached = localStore.getProducts();
    if (cached.length > 0) setProducts(cached);

    // Profile listener
    const unsubscribeProfile = onSnapshot(doc(db, 'users', targetUid), (snap) => {
      if (snap.exists()) setProfile(snap.data() as UserProfile);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${targetUid}`);
    });

    // Real-time listener for products
    const q = query(
      collection(db, 'products'), 
      where('userId', '==', targetUid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribeProducts = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      setProducts(data);
      localStore.saveProducts(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
      setLoading(false);
    });

    return () => {
      unsubscribeProfile();
      unsubscribeProducts();
    };
  }, [ownerId]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setPrice(0);
    setPurchasePrice(0);
    setStock(0);
    setLowStockThreshold(5);
    setSku('');
    setHsnCode('');
    setGstPercent(18);
    setBarcode('');
    setEditingId(null);
    setIsAdding(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !name) return;
    setSaving(true);
    setMessage(null);

    const data: Partial<Product> = {
      name,
      description,
      price: Number(price),
      purchasePrice: Number(purchasePrice),
      stock: Number(stock),
      lowStockThreshold: Number(lowStockThreshold),
      sku,
      hsnCode,
      gstPercent: Number(gstPercent),
      barcode,
      userId: auth.currentUser.uid,
      createdAt: new Date().toISOString()
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'products', editingId), data);
      } else {
        await addDoc(collection(db, 'products'), data);
      }

      if (data.stock! <= (data.lowStockThreshold || 5)) {
        notificationService.notifyLowStock({ id: editingId || 'new', ...data } as Product, profile);
      }

      resetForm();
      setMessage({ type: 'success', text: editingId ? 'Product updated!' : 'Product added to inventory!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'products');
      setMessage({ type: 'error', text: 'Failed to save product.' });
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Really delete this product?")) return;
    await deleteDoc(doc(db, 'products', id));
  };

  const startEdit = (p: Product) => {
    setName(p.name);
    setDescription(p.description);
    setPrice(p.price);
    setPurchasePrice(p.purchasePrice || 0);
    setStock(p.stock);
    setLowStockThreshold(p.lowStockThreshold || 5);
    setSku(p.sku || '');
    setHsnCode(p.hsnCode || '');
    setGstPercent(p.gstPercent || 18);
    setBarcode(p.barcode || '');
    setEditingId(p.id!);
    setIsAdding(true);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('inventoryManagement')}</h2>
          <p className="text-slate-500">{t('manageStock')}</p>
        </div>
        <button 
          onClick={() => { if(isAdding) resetForm(); else setIsAdding(true); }}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
        >
          {isAdding ? <Archive className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {isAdding ? t('viewInventory') : t('addProduct')}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {isAdding ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">{editingId ? t('updateProduct') : t('addProduct')}</h3>
              <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                Cancel
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700">Product Name</label>
                  <input 
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Premium Leather Bag"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700">SKU / Code</label>
                  <input 
                    value={sku}
                    onChange={e => setSku(e.target.value)}
                    placeholder="e.g. BG-001"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Description</label>
                <textarea 
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Tell clients about this product..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700">Selling Price</label>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    value={price}
                    onChange={e => setPrice(Number(e.target.value))}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="block text-sm font-bold text-slate-700">Purchase Price (Cost)</label>
                    {price > 0 && purchasePrice > 0 && (
                      <span className="text-[10px] font-black text-emerald-600 uppercase">
                        Profit: {formatCurrency(price - purchasePrice)} ({Math.round(((price - purchasePrice) / price) * 100)}%)
                      </span>
                    )}
                  </div>
                  <input 
                    type="number"
                    step="0.01"
                    value={purchasePrice}
                    onChange={e => setPurchasePrice(Number(e.target.value))}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700">Current Stock</label>
                  <input 
                    type="number"
                    required
                    value={stock}
                    onChange={e => setStock(Number(e.target.value))}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700">Low Stock Alert Threshold</label>
                  <input 
                    type="number"
                    required
                    value={lowStockThreshold}
                    onChange={e => setLowStockThreshold(Number(e.target.value))}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700">HSN/SAC Code</label>
                  <input 
                    value={hsnCode}
                    onChange={e => setHsnCode(e.target.value)}
                    placeholder="e.g. 9983"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700">GST %</label>
                  <select 
                    value={gstPercent}
                    onChange={e => setGstPercent(Number(e.target.value))}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value={0}>0% (Exempt)</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700">Barcode/Scanner Data</label>
                  <input 
                    value={barcode}
                    onChange={e => setBarcode(e.target.value)}
                    placeholder="Scan or enter code"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-4">
                <AnimatePresence>
                  {message && (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className={cn(
                        "text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg flex items-center gap-2",
                        message.type === 'success' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                      )}
                    >
                      {message.type === 'success' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {message.text}
                    </motion.div>
                  )}
                </AnimatePresence>
                <button 
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 text-white px-10 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? t('updateProduct') : t('saveProduct')}
                </button>
              </div>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                type="text"
                placeholder="Search by name or SKU..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              />
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('productInfo')}</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Pricing</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Margin</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('inventory')}</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.length > 0 ? filteredProducts.map((p) => {
                      const isLow = p.stock <= (p.lowStockThreshold || 5);
                      const profit = p.purchasePrice ? p.price - p.purchasePrice : 0;
                      const margin = p.purchasePrice && p.price > 0 ? (profit / p.price) * 100 : 0;
                      
                      return (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                              isLow ? "bg-red-50 text-red-400" : "bg-slate-100 text-slate-400"
                            )}>
                              <Package className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="text-sm font-bold text-slate-900">{p.name}</div>
                              <div className="text-xs text-slate-500">{p.sku || 'No SKU'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900 font-mono">{formatCurrency(p.price)}</span>
                            {p.purchasePrice && (
                              <span className="text-[10px] text-slate-400 font-bold uppercase">Cost: {formatCurrency(p.purchasePrice)}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {p.purchasePrice ? (
                            <div className="flex flex-col items-center">
                              <span className={cn(
                                "px-2 py-0.5 rounded-md text-[10px] font-black uppercase",
                                margin > 20 ? "bg-emerald-100 text-emerald-700" : margin > 0 ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                              )}>
                                {Math.round(margin)}% Margin
                              </span>
                              <span className="text-[9px] text-slate-400 font-bold mt-1">+{formatCurrency(profit)} profit</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-300 font-bold uppercase">No Cost Data</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                             <div className={`w-2 h-2 rounded-full ${isLow ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                             <span className={`text-sm font-bold ${isLow ? 'text-red-600' : 'text-slate-700'}`}>
                               {p.stock} units
                             </span>
                          </div>
                          {isLow && (
                            <div className="text-[10px] font-bold text-red-500 uppercase mt-0.5 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> {t('lowStockAlert')}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => startEdit(p)}
                              className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                            >
                              <Edit3 className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => deleteProduct(p.id!)}
                              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic text-sm">
                          {loading ? 'Crunching data...' : 'No products found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
