import React, { useState } from 'react';
import { auth, db } from '../../lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { User, Lock, Mail, Store, ArrowRight, ShieldCheck, UserCircle, LogIn, ChevronRight, AlertCircle, Phone, MapPin, ShoppingBag } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function AuthPage() {
  const [isStaffLogin, setIsStaffLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    businessName: '',
    phone: '',
    address: '',
    pincode: '',
    logo: ''
  });

  const handleOwnerAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, form.email, form.password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password);
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: form.email,
          name: form.name,
          businessName: form.businessName,
          phone: form.phone,
          address: form.address,
          pinCode: form.pincode,
          logo: form.logo || '',
          role: 'owner',
          plan: 'free',
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOwnerGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if profile exists
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        await setDoc(docRef, {
          uid: user.uid,
          email: user.email,
          businessName: 'My Business',
          currency: 'INR',
          role: 'owner',
          plan: 'free',
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }

      // Sign in with Firebase Custom Token
      await signInWithCustomToken(auth, data.token);

      // Store staff session
      localStorage.setItem('staff_session', JSON.stringify({
        token: data.token,
        user: data.user
      }));

      // No need to reload manualy if onAuthStateChanged handles it, 
      // but App.tsx has special logic for staff session.
      // Let's keep it for now but remove reload to avoid flash if not needed.
      // window.location.reload();
      
    } catch (err: any) {
      setError(err.message || "Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 bg-white rounded-[40px] overflow-hidden shadow-2xl border border-slate-100">
        
        {/* Left Side: Branding/Intro */}
        <div className="bg-slate-900 p-8 md:p-12 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-12 translate-x-12" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl translate-y-12 -translate-x-12" />
          
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <span className="font-black text-xl tracking-tight uppercase">Creator Adda</span>
          </div>

          <div className="relative z-10 my-12">
            <h1 className="text-4xl md:text-5xl font-black mb-6 leading-tight">
              Manage your shop with <span className="text-indigo-400">precision.</span>
            </h1>
            <p className="text-slate-400 font-medium text-lg leading-relaxed">
              Professional billing, inventory, and staff management platform for modern businesses.
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-4 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
            <div className="flex -space-x-2">
              {[1,2,3].map(i => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-700 flex items-center justify-center text-[10px] font-bold">
                  {i}
                </div>
              ))}
            </div>
            <p className="text-xs font-bold text-slate-300">Trusted by 10,000+ businesses globally</p>
          </div>
        </div>

        {/* Right Side: Auth Forms */}
        <div className="p-8 md:p-12 flex flex-col justify-center bg-white relative">
          <div className="mb-8">
            <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit mb-8">
              <button 
                onClick={() => setIsStaffLogin(false)}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                  !isStaffLogin ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Owner
              </button>
              <button 
                onClick={() => setIsStaffLogin(true)}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                  isStaffLogin ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Staff
              </button>
            </div>

            <h2 className="text-3xl font-black text-slate-900 mb-2">
              {isStaffLogin ? 'Staff Login' : 'Welcome back!'}
            </h2>
            <p className="text-slate-500 font-medium">
              {isStaffLogin ? 'Access your assigned billing dashboard' : 'Sign in to manage your entire operation'}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {!isStaffLogin ? (
              <motion.div
                key="owner"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex bg-slate-100 p-1 rounded-xl w-full">
                  <button 
                    onClick={() => setMode('signin')}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
                      mode === 'signin' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                    )}
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={() => setMode('signup')}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
                      mode === 'signup' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                    )}
                  >
                    Create Account
                  </button>
                </div>

                <form onSubmit={handleOwnerAction} className="space-y-4">
                  {mode === 'signup' && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Full Name</label>
                        <div className="relative group">
                          <User className="w-4 h-4 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-600 transition-colors" />
                          <input
                            required
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                            placeholder="Owner Name"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Business Name</label>
                          <div className="relative">
                            <ShoppingBag className="w-4 h-4 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2" />
                            <input
                              required
                              type="text"
                              value={form.businessName}
                              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                              placeholder="Shop Name"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Phone Number</label>
                          <div className="relative">
                            <Phone className="w-4 h-4 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2" />
                            <input
                              required
                              type="tel"
                              value={form.phone}
                              onChange={(e) => setForm({ ...form, phone: e.target.value })}
                              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                              placeholder="Contact"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Shop Address</label>
                          <div className="relative">
                            <MapPin className="w-4 h-4 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2" />
                            <input
                              required
                              type="text"
                              value={form.address}
                              onChange={(e) => setForm({ ...form, address: e.target.value })}
                              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                              placeholder="Shop Location"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">PIN Code</label>
                          <input
                            required
                            type="text"
                            value={form.pincode}
                            onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, '') })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                            placeholder="PIN"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Shop Photo URL (Optional)</label>
                        <div className="relative">
                          <ShoppingBag className="w-4 h-4 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2" />
                          <input
                            type="url"
                            value={form.logo}
                            onChange={(e) => setForm({ ...form, logo: e.target.value })}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                            placeholder="https://example.com/shop.jpg"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Email</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        required
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        required
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-black flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  <button
                    disabled={loading}
                    type="submit"
                    className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                  >
                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : mode === 'signin' ? 'Sign In Now' : 'Register Shop'}
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>
                </form>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-100"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase">
                    <span className="bg-white px-4 text-slate-400 font-black tracking-widest">Or Continue With</span>
                  </div>
                </div>

                <button
                  onClick={handleOwnerGoogleLogin}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-4 bg-white border border-slate-200 py-3 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
                >
                  <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                  Google Workspace
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="staff"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleStaffLogin}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase ml-1">Username</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      required
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="Enter your username"
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase ml-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      required
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-red-500 text-sm font-bold flex items-center gap-2 px-1">
                    <AlertCircle className="w-4 h-4" /> {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-slate-900 text-white py-4 rounded-[20px] font-black text-lg shadow-xl shadow-slate-200 hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2 group disabled:opacity-50"
                >
                  {loading ? 'Authenticating...' : 'Sign In as Staff'}
                  {!loading && <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <p className="mt-8 text-center text-slate-400 text-sm font-medium">
            Contact your shop owner if you've forgotten your login credentials.
          </p>
        </div>

      </div>
    </div>
  );
}
