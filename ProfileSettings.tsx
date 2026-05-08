import React, { useState, useEffect } from 'react';
import { db, auth, storage } from '../../lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MapPin, Camera, Save, CheckCircle2, Loader2, Globe, DollarSign, Lock, Store, User, Phone, CreditCard, Sparkles, ShieldCheck, Hash, Trash2, AlertCircle, FileText } from 'lucide-react';
import { UserProfile } from '../../types';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function ProfileSettings() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    businessName: '',
    phone: '',
    address: '',
    pinCode: '',
    currency: 'INR',
    gstin: '',
    bankDetails: {
      accountHolder: '',
      accountNumber: '',
      ifsc: '',
      bankName: '',
      upiId: ''
    },
    billingTerms: ''
  });

  useEffect(() => {
    if (!auth.currentUser) return;
    
    // Real-time listener for profile
    const unsubscribe = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        setProfile(data);
        setFormData({
          businessName: data.businessName || '',
          phone: data.phone || '',
          address: data.address || '',
          pinCode: data.pinCode || '',
          currency: data.currency || 'INR',
          gstin: data.gstin || '',
          bankDetails: data.bankDetails || {
            accountHolder: '',
            accountNumber: '',
            ifsc: '',
            bankName: '',
            upiId: ''
          } as any,
          billingTerms: data.billingTerms || ''
        });
      }
      setLoading(false);
    }, (error) => {
      console.error("Profile sync error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), formData);
      setMessage({ type: 'success', text: 'Settings updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `shops/${auth.currentUser.uid}/logo`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        logo: url,
        shopPhotoUrl: url
      });
    } catch (err) {
      alert("Error uploading image");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Business Console</h2>
          <p className="text-slate-500 font-medium text-lg">Manage your business information and subscription</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm">
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{profile?.plan || 'Free'} Plan Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm text-center relative overflow-hidden group">
            <div className="relative z-10">
              <div className="relative inline-block">
                <div 
                  className="w-32 h-32 rounded-[2rem] overflow-hidden bg-slate-50 border-2 border-slate-100 shadow-inner flex items-center justify-center bg-cover bg-center"
                  style={{ backgroundImage: (profile?.logo || profile?.shopPhotoUrl) ? `url(${profile.logo || profile.shopPhotoUrl})` : 'none' }}
                >
                  {!(profile?.logo || profile?.shopPhotoUrl) && <Store className="w-12 h-12 text-slate-300" />}
                  {uploading && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    </div>
                  )}
                </div>
                <label className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-2.5 rounded-xl shadow-lg cursor-pointer hover:bg-indigo-700 transition-all border-2 border-white group-hover:scale-110">
                  <Camera className="w-5 h-5" />
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                </label>
              </div>
              <h3 className="mt-6 font-black text-slate-900 truncate px-4">{formData.businessName || 'My Business'}</h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Shop Profile Picture</p>
            </div>
          </div>

          <div className="bg-slate-900 p-8 rounded-[3rem] text-white space-y-6">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                 <Sparkles className="w-5 h-5 text-indigo-400" />
               </div>
               <h4 className="font-black text-xs uppercase tracking-[0.2em]">Management Plan</h4>
             </div>
             
             <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
               <p className="text-xs font-bold text-slate-400 mb-1">Current Tier</p>
               <p className="text-xl font-black uppercase tracking-tight">{profile?.plan || 'Free Starter'}</p>
             </div>

             <div className="space-y-3">
               {['Custom Invoices', 'Staff Roles', 'Cloud Logs'].map((f, i) => (
                 <div key={i} className="flex items-center gap-3 text-xs font-bold text-slate-300">
                   <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                   {f}
                 </div>
               ))}
             </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleUpdate} className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Business Name</label>
                <div className="relative group">
                  <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                  <input 
                    value={formData.businessName}
                    onChange={e => setFormData({ ...formData, businessName: e.target.value })}
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-slate-900 font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Contact Number</label>
                <div className="relative group">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                  <input 
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-slate-900 font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Business Address</label>
                <div className="relative group">
                  <MapPin className="absolute left-4 top-5 w-4 h-4 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                  <textarea 
                    rows={3}
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-slate-900 font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all resize-none"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Area PIN Code</label>
                <div className="relative group">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                  <input 
                    value={formData.pinCode}
                    onChange={e => setFormData({ ...formData, pinCode: e.target.value.replace(/\D/g, '') })}
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-slate-900 font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">GSTIN (Optional)</label>
                <input 
                  value={formData.gstin}
                  onChange={e => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-slate-900 font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Dashboard Currency</label>
                <div className="relative group">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                  <select 
                    value={formData.currency}
                    onChange={e => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full pl-12 pr-10 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-slate-900 font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all appearance-none"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="BDT">BDT (৳)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Bank Details Section */}
            <div className="pt-8 border-t border-slate-100">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2 italic">
                <CreditCard className="w-5 h-5 text-indigo-600" /> Bank Payment Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Account Holder Name</label>
                  <input 
                    value={formData.bankDetails.accountHolder}
                    onChange={e => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, accountHolder: e.target.value } })}
                    className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-slate-900 font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                    placeholder="E.g. John Doe Business"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Account Number</label>
                  <input 
                    value={formData.bankDetails.accountNumber}
                    onChange={e => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, accountNumber: e.target.value } })}
                    className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-slate-900 font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                    placeholder="Your Bank Account No"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">IFSC Code</label>
                  <input 
                    value={formData.bankDetails.ifsc}
                    onChange={e => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, ifsc: e.target.value.toUpperCase() } })}
                    className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-slate-900 font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                    placeholder="BANK0001234"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Bank Name</label>
                  <input 
                    value={formData.bankDetails.bankName}
                    onChange={e => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, bankName: e.target.value } })}
                    className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-slate-900 font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                    placeholder="Your Bank Name"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">UPI ID (Optional)</label>
                  <input 
                    value={formData.bankDetails.upiId}
                    onChange={e => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, upiId: e.target.value } })}
                    className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-slate-900 font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                    placeholder="yourname@upi"
                  />
                </div>
              </div>
            </div>

            {/* Billing Terms Section */}
            <div className="pt-8 border-t border-slate-100">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2 italic">
                <FileText className="w-5 h-5 text-indigo-600" /> Invoice Terms & Conditions
              </h4>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Terms (Printed on Bill)</label>
                <textarea 
                  rows={4}
                  value={formData.billingTerms}
                  onChange={e => setFormData({ ...formData, billingTerms: e.target.value })}
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-slate-900 font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all resize-none italic text-sm"
                  placeholder="E.g. No returns after 7 days. Warranty as per manufacturer."
                />
              </div>
            </div>

            <AnimatePresence>
              {message && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    "p-4 rounded-2xl text-sm font-black flex items-center gap-3",
                    message.type === 'success' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-red-50 text-red-600 border border-red-100"
                  )}
                >
                  {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  {message.text}
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              type="submit"
              disabled={saving}
              className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
              Save Business Identity
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
