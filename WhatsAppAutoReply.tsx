import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { MessageSquare, Plus, Trash2, Shield, Info, HelpCircle, ToggleLeft as Toggle, ToggleRight, CheckCircle2, Loader2 } from 'lucide-react';
import { WhatsAppConfig } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../lib/utils';

export default function WhatsAppAutoReply({ ownerId }: { ownerId?: string }) {
  const { t } = useLanguage();
  const [configs, setConfigs] = useState<WhatsAppConfig[]>([]);
  const [keyword, setKeyword] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    const targetUid = ownerId || auth.currentUser?.uid;
    if (!targetUid) return;
    setLoading(true);

    const q = query(collection(db, 'whatsapp_configs'), where('userId', '==', targetUid));
    const unsubscribe = onSnapshot(q, (snap) => {
      setConfigs(snap.docs.map(d => ({ id: d.id, ...d.data() } as WhatsAppConfig)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'whatsapp_configs');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ownerId]);

  const addRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUid = ownerId || auth.currentUser?.uid;
    if (!keyword || !replyMessage || !targetUid) return;
    
    setSaving(true);
    setMessage(null);
    try {
      const newRule: Omit<WhatsAppConfig, 'id'> = {
        userId: targetUid,
        keyword,
        replyMessage,
        enabled: true,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'whatsapp_configs'), newRule);
      setKeyword('');
      setReplyMessage('');
      setMessage({ type: 'success', text: "Rule added successfully!" });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'whatsapp_configs');
      setMessage({ type: 'error', text: "Error adding rule" });
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (config: WhatsAppConfig) => {
    if (!config.id) return;
    await updateDoc(doc(db, 'whatsapp_configs', config.id), {
      enabled: !config.enabled
    });
  };

  const deleteRule = async (id: string) => {
    await deleteDoc(doc(db, 'whatsapp_configs', id));
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('whatsAppPlanner')}</h2>
          <p className="text-slate-500">Plan and manage your automated messages</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" /> {t('addRule')}
            </h3>
            <form onSubmit={addRule} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">{t('keyword')}</label>
                  <input 
                    value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                    placeholder="e.g. Price, Menu, Location"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">{t('replyMessage')}</label>
                  <input 
                    value={replyMessage}
                    onChange={e => setReplyMessage(e.target.value)}
                    placeholder="Enter your auto reply"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4 mt-2">
                <button 
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {t('addRule')}
                </button>

                <AnimatePresence>
                  {message && (
                    <motion.div 
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className={cn(
                        "text-xs font-bold uppercase tracking-tight",
                        message.type === 'success' ? "text-emerald-600" : "text-red-600"
                      )}
                    >
                      {message.text}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">{t('whatsappRules')}</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {configs.length > 0 ? configs.map((config) => (
                <div key={config.id} className="p-6 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('keyword')}:</span>
                      <span className="font-black text-slate-900">{config.keyword}</span>
                    </div>
                    <div className="mt-1 flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
                      <p className="text-slate-600 text-sm leading-relaxed">{config.replyMessage}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => toggleRule(config)}
                      className={cn(
                        "p-1 rounded-full transition-colors",
                        config.enabled ? "text-green-500" : "text-slate-300"
                      )}
                    >
                      {config.enabled ? <ToggleRight className="w-8 h-8" /> : <Toggle className="w-8 h-8" />}
                    </button>
                    <button 
                      onClick={() => deleteRule(config.id!)}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )) : (
                <div className="p-12 text-center text-slate-400 italic text-sm">
                  {loading ? 'Crunching data...' : 'No rules defined.'}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-blue-600 text-white p-8 rounded-3xl shadow-xl shadow-blue-100 relative overflow-hidden">
            <Shield className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" />
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Info className="w-5 h-5" /> Implementation Guide
            </h3>
            <p className="text-sm text-blue-100 mb-6 leading-relaxed">
              To use these rules with WhatsApp, we recommend using an automation app on your mobile device (like "AutoResponder for WA"). 
            </p>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold font-mono">1</div>
                <p className="text-xs text-blue-50 drop-shadow-sm">Open your chosen auto-reply app.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold font-mono">2</div>
                <p className="text-xs text-blue-50 drop-shadow-sm">Create a rule and use your "Keywords" here as triggers.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold font-mono">3</div>
                <p className="text-xs text-blue-50 drop-shadow-sm">Copy the "Reply Messages" from your EasyBill dashboard.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
