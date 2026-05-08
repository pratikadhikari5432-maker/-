import React, { useState } from 'react';
import { auth } from '../../lib/firebase';
import { MessageSquare, Send, Mail, User, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../../types';

interface ContactSupportProps {
  profile: UserProfile | null;
}

export default function ContactSupport({ profile }: ContactSupportProps) {
  const [formData, setFormData] = useState({
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !formData.subject || !formData.message) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/contact/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: auth.currentUser.uid,
          userName: profile?.businessName || profile?.email?.split('@')[0] || 'User',
          userEmail: auth.currentUser.email,
          subject: formData.subject,
          message: formData.message,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      setSuccess(true);
      setFormData({ subject: '', message: '' });
    } catch (err: any) {
      console.error(err);
      setError("Failed to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-sm">
          <MessageSquare className="w-10 h-10 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Support Center</h2>
          <p className="text-slate-500 font-medium text-lg">We're here to help you grow your business</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
            <AnimatePresence mode="wait">
              {success ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12 space-y-6"
                >
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">Message Sent!</h3>
                    <p className="text-slate-500 font-medium">Our team will get back to you via email shortly.</p>
                  </div>
                  <button 
                    onClick={() => setSuccess(false)}
                    className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                  >
                    Send Another Message
                  </button>
                </motion.div>
              ) : (
                <motion.form 
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onSubmit={handleSubmit} 
                  className="space-y-8"
                >
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Inquiry Category</label>
                      <div className="relative group">
                        <Info className="w-5 h-5 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-600 transition-colors" />
                        <select 
                          required
                          value={formData.subject}
                          onChange={e => setFormData({...formData, subject: e.target.value})}
                          className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-slate-900 font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all appearance-none"
                        >
                          <option value="">Select a topic...</option>
                          <option value="Technical Issue">Technical Issue</option>
                          <option value="Billing & Plans">Billing & Plans</option>
                          <option value="Feature Request">Feature Request</option>
                          <option value="Account Privacy">Account Privacy</option>
                          <option value="Partnership">Partnership</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Detailed Message</label>
                      <textarea 
                        required
                        value={formData.message}
                        onChange={e => setFormData({...formData, message: e.target.value})}
                        placeholder="Please describe your issue or question in detail..."
                        rows={6}
                        className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-slate-900 font-medium focus:border-indigo-600 focus:bg-white outline-none transition-all resize-none"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-3 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 text-sm font-bold">
                      <AlertCircle className="w-5 h-5" />
                      {error}
                    </div>
                  )}

                  <button 
                    disabled={loading}
                    type="submit"
                    className="w-full bg-indigo-600 text-white py-5 rounded-[1.5rem] font-black text-lg flex items-center justify-center gap-3 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-2xl shadow-indigo-100"
                  >
                    {loading ? (
                      <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Send Support Request
                      </>
                    )}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white space-y-6 relative overflow-hidden">
            <div className="relative z-10">
              <h4 className="text-xl font-black uppercase tracking-tight">Direct Support</h4>
              <p className="text-slate-400 text-sm font-medium mt-2">Need immediate help? Reach out to our leads directly.</p>
              
              <div className="mt-8 space-y-4">
                <a href="mailto:pratikadhikari5432@gmail.com" className="flex items-center gap-4 group">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 transition-all">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Email</p>
                    <p className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">pratikadhikari5432@gmail.com</p>
                  </div>
                </a>
                
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Support Hours</p>
                    <p className="text-xs font-bold text-white">Mon - Sat, 10AM - 8PM</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-600/20 rounded-full blur-3xl" />
          </div>

          <div className="bg-indigo-50 p-8 rounded-[2.5rem] border border-indigo-100">
             <div className="flex items-center gap-3 mb-4 text-indigo-600">
               <Info className="w-6 h-6" />
               <h4 className="font-black uppercase tracking-tight text-sm">Pro Tip</h4>
             </div>
             <p className="text-sm font-medium text-slate-600 leading-relaxed">
               Check out the "Overview" dashboard for quick tutorials on how to use each tool effectively.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
