import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Zap, Loader2, AlertCircle, X, CreditCard, Send, Smartphone, Landmark } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { doc, onSnapshot, collection, addDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { UserProfile, SubscriptionPlan, PlanRequest } from '../../types';
import { cn } from '../../lib/utils';
import * as LucideIcons from 'lucide-react';

export default function SubscriptionPlans() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  
  // Manual Payment State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'bank_transfer'>('upi');
  const [transactionId, setTransactionId] = useState('');
  const [upiId, setUpiId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<PlanRequest | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    // User profile listener
    const unsubscribeProfile = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
      if (snap.exists()) setProfile(snap.data() as UserProfile);
    });

    // Plans listener
    const unsubscribePlans = onSnapshot(collection(db, 'plans'), (snap) => {
      const plansList = snap.docs.map(d => ({ ...d.data(), id: d.id } as SubscriptionPlan));
      setPlans(plansList.sort((a,b) => a.amount - b.amount));
      setFetching(false);
    });

    // Pending/Recent requests listener
    const q = query(
      collection(db, 'plan_requests'), 
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const unsubscribeRequests = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data() as PlanRequest;
        // Only show status if it's pending OR if it's rejected (to inform user)
        if (data.status === 'pending' || data.status === 'rejected') {
          setPendingRequest({ ...data, id: snap.docs[0].id });
        } else {
          setPendingRequest(null);
        }
      } else {
        setPendingRequest(null);
      }
    });

    return () => {
      unsubscribeProfile();
      unsubscribePlans();
      unsubscribeRequests();
    };
  }, []);

  const handleSubmitRequest = async () => {
    if (!selectedPlan || !auth.currentUser) return;
    
    setSubmitting(true);
    try {
      const requestData: PlanRequest = {
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email || '',
        businessName: profile?.businessName || 'Business Owner',
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        amount: selectedPlan.amount,
        paymentDetails: {
          method: paymentMethod,
          transactionId: transactionId || undefined,
          upiId: paymentMethod === 'upi' ? upiId : undefined,
          accountNumber: paymentMethod === 'bank_transfer' ? accountNumber : undefined,
          ifsc: paymentMethod === 'bank_transfer' ? ifsc : undefined,
          accountHolder: paymentMethod === 'bank_transfer' ? accountHolder : undefined
        },
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'plan_requests'), requestData);
      setShowPaymentModal(false);
      alert("Plan purchase requested! Admin will verify and activate your plan soon.");
    } catch (err) {
      console.error("Request failed:", err);
      alert("Failed to submit request. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  const openPaymentModal = (plan: SubscriptionPlan) => {
    if (plan.amount === 0) return;
    setSelectedPlan(plan);
    setShowPaymentModal(true);
  };

  if (fetching) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-slate-500 font-bold uppercase tracking-tight">Loading plans...</p>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center bg-white p-12 rounded-[3rem] border-2 border-dashed border-slate-200">
        <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-6" />
        <h3 className="text-2xl font-black text-slate-900 mb-2">No Plans Available</h3>
        <p className="text-slate-500 mb-8 leading-relaxed">The system administrator hasn't configured any pricing plans yet.</p>
      </div>
    );
  }

  const currentPlanId = profile?.plan || 'free';

  return (
    <div className="space-y-12 max-w-6xl mx-auto p-4">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Simple, Transparent Pricing</h2>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto">
          Choose the plan that's right for your business. Manage your subscription with ease.
        </p>
      </div>

      {pendingRequest && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "border-2 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm",
            pendingRequest.status === 'rejected' ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100"
          )}
        >
          <div className={cn("flex items-center gap-4", pendingRequest.status === 'rejected' ? "text-red-700" : "text-amber-700")}>
            <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", pendingRequest.status === 'rejected' ? "bg-red-200" : "bg-amber-200 animate-pulse")}>
              {pendingRequest.status === 'rejected' ? <X className="w-6 h-6" /> : <Loader2 className="w-6 h-6 animate-spin" />}
            </div>
            <div>
              <h4 className="font-bold text-lg">{pendingRequest.status === 'rejected' ? 'Request Rejected' : 'Plan Request Pending'}</h4>
              <p className="text-sm opacity-80 uppercase font-bold tracking-tight">
                {pendingRequest.status === 'rejected' 
                  ? "Your request was declined. Please check details or contact support." 
                  : `We are verifying your payment for the ${pendingRequest.planName} plan.`}
              </p>
            </div>
          </div>
          <div className={cn(
            "px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest",
            pendingRequest.status === 'rejected' ? "bg-red-200 text-red-800" : "bg-amber-200 text-amber-800"
          )}>
            {pendingRequest.status === 'rejected' ? 'Action Required' : 'Verification in progress'}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan, idx) => {
          const isCurrent = currentPlanId === plan.id;
          const PlanIcon = LucideIcons[plan.icon as keyof typeof LucideIcons] || Zap;
          
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`relative bg-white rounded-[2.5rem] border ${plan.popular ? 'border-blue-500 ring-8 ring-blue-50 shadow-2xl' : 'border-slate-100 shadow-sm'} p-8 flex flex-col group hover:shadow-xl transition-all duration-300`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                  Most Popular
                </div>
              )}

              <div className="mb-8">
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 duration-300",
                  plan.color === 'blue' ? "bg-blue-50 text-blue-600" : plan.color === 'purple' ? "bg-purple-50 text-purple-600" : "bg-amber-50 text-amber-600"
                )}>
                  {/* @ts-ignore */}
                  <PlanIcon className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">{plan.name}</h3>
                <p className="text-slate-500 text-sm leading-relaxed font-medium">{plan.description}</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline text-slate-900">
                  <span className="text-sm font-bold opacity-50 mr-1">₹</span>
                  <span className="text-5xl font-black tracking-tighter">{plan.amount}</span>
                  {plan.period && <span className="text-slate-400 font-bold ml-1 text-lg">{plan.period}</span>}
                </div>
              </div>

              <ul className="space-y-4 mb-10 flex-grow">
                {plan.features.map(feature => (
                  <li key={feature} className="flex items-start gap-3">
                    <div className={cn(
                      "mt-1 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0",
                      plan.color === 'blue' ? "bg-blue-50 text-blue-600" : plan.color === 'purple' ? "bg-purple-50 text-purple-600" : "bg-amber-50 text-amber-600"
                    )}>
                      <Check className="w-3 h-3" />
                    </div>
                    <span className="text-sm text-slate-600 font-bold uppercase tracking-tight">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                disabled={isCurrent || loadingPlan !== null || !!pendingRequest}
                onClick={() => openPaymentModal(plan)}
                className={`w-full py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs ${
                  isCurrent 
                    ? 'bg-emerald-50 text-emerald-600 border-2 border-emerald-100 cursor-default' 
                    : plan.popular
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-100 hover:scale-[1.02]'
                      : 'bg-slate-900 text-white hover:bg-slate-800 hover:scale-[1.02]'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loadingPlan === plan.id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isCurrent ? (
                  'Active Plan'
                ) : pendingRequest?.planId === plan.id ? (
                  'Verification Pending'
                ) : (
                  'Choose Plan'
                )}
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && selectedPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPaymentModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 md:p-12 space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-3xl font-black text-slate-900 uppercase">Upgrade Plan</h3>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">
                      Purchase {selectedPlan.name} for ₹{selectedPlan.amount}
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowPaymentModal(false)}
                    className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Payment Method Selector */}
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setPaymentMethod('upi')}
                      className={cn(
                        "p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 group",
                        paymentMethod === 'upi' 
                          ? "border-blue-600 bg-blue-50 text-blue-600" 
                          : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
                      )}
                    >
                      <Smartphone className={cn("w-8 h-8 transition-transform group-hover:scale-110", paymentMethod === 'upi' && "text-blue-600")} />
                      <span className="font-black text-xs uppercase tracking-widest">UPI Payment</span>
                    </button>
                    <button
                      onClick={() => setPaymentMethod('bank_transfer')}
                      className={cn(
                        "p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 group",
                        paymentMethod === 'bank_transfer' 
                          ? "border-blue-600 bg-blue-50 text-blue-600" 
                          : "border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200"
                      )}
                    >
                      <Landmark className={cn("w-8 h-8 transition-transform group-hover:scale-110", paymentMethod === 'bank_transfer' && "text-blue-600")} />
                      <span className="font-black text-xs uppercase tracking-widest">Bank Transfer</span>
                    </button>
                  </div>

                  <div className="bg-slate-50 rounded-3xl p-6 space-y-4 border border-slate-100">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400 font-bold uppercase tracking-widest">Payable Amount</span>
                      <span className="text-2xl font-black text-slate-900 tracking-tight">₹{selectedPlan.amount}</span>
                    </div>
                  </div>

                  {/* Form */}
                  <div className="space-y-5">
                    {paymentMethod === 'upi' ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Your UPI ID</label>
                          <input 
                            type="text"
                            value={upiId}
                            onChange={e => setUpiId(e.target.value)}
                            placeholder="username@upi"
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all font-bold"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Transaction Ref / ID</label>
                          <input 
                            type="text"
                            value={transactionId}
                            onChange={e => setTransactionId(e.target.value)}
                            placeholder="Enter 12 digit Transaction ID"
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all font-bold"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2 space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Account Holder Name</label>
                          <input 
                            type="text"
                            value={accountHolder}
                            onChange={e => setAccountHolder(e.target.value)}
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all font-bold"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Account Number</label>
                          <input 
                            type="text"
                            value={accountNumber}
                            onChange={e => setAccountNumber(e.target.value)}
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all font-bold"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">IFSC Code</label>
                          <input 
                            type="text"
                            value={ifsc}
                            onChange={e => setIfsc(e.target.value)}
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:bg-white outline-none transition-all font-bold"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 flex flex-col gap-4">
                  <button
                    disabled={submitting}
                    onClick={handleSubmitRequest}
                    className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 shadow-2xl shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Submit Request
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                    By submitting, you confirm that you have made the payment. <br />Admin will verify the transaction within 24 hours.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
