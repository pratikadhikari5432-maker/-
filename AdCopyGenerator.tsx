import React, { useState } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { Send, Copy, Trash2, Layout, Sparkles, Facebook, Instagram, Search, MessageCircle, AlertCircle, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../lib/utils';

const PLATFORMS = [
  { id: 'Facebook', icon: Facebook, color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'Instagram', icon: Instagram, color: 'text-pink-600', bg: 'bg-pink-50' },
  { id: 'Google', icon: Search, color: 'text-orange-600', bg: 'bg-orange-50' },
  { id: 'WhatsApp', icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-50' },
];

export default function AdCopyGenerator({ ownerId }: { ownerId?: string }) {
  const { t } = useLanguage();
  const [product, setProduct] = useState('');
  const [features, setFeatures] = useState('');
  const [platform, setPlatform] = useState('Facebook');
  const [tone, setTone] = useState('Professional');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const generateCopy = async () => {
    if (!product) return;
    setLoading(true);
    try {
      const prompt = `Write a high-converting ${platform} advertisement copy for my product: "${product}". 
      Features: ${features}. 
      Tone: ${tone}. 
      Use emojis if appropriate for the platform. Format the output using clean Markdown. Don't include preamble, just the ad copy.`;
      
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      if (data.text) {
        setResult(data.text);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      alert("Copied!");
    }
  };

  const saveCopy = async () => {
    const targetUid = ownerId || auth.currentUser?.uid;
    if (!result || !targetUid) return;
    try {
      await addDoc(collection(db, 'ad_copies'), {
        userId: targetUid,
        title: product,
        content: result,
        platform,
        createdAt: new Date().toISOString()
      });
      alert("Saved!");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('adCopy')}</h2>
          <p className="text-slate-500">Perfect messages for your promotions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="space-y-4">
              <label className="block font-bold text-slate-700 text-sm">Product or Service Name</label>
              <input 
                value={product} 
                onChange={e => setProduct(e.target.value)}
                placeholder="e.g. Handmade Leather Wallets"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-4">
              <label className="block font-bold text-slate-700 text-sm">Key Features / Offer</label>
              <textarea 
                rows={3}
                value={features} 
                onChange={e => setFeatures(e.target.value)}
                placeholder="e.g. 20% discount this week, free shipping, 5 year warranty"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block font-bold text-slate-700 text-sm">Platform</label>
                <select 
                  value={platform} 
                  onChange={e => setPlatform(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.id}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block font-bold text-slate-700 text-sm">Tone</label>
                <select 
                  value={tone} 
                  onChange={e => setTone(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option>Professional</option>
                  <option>Witty & Fun</option>
                  <option>Urgent / FOMO</option>
                  <option>Minimalist</option>
                </select>
              </div>
            </div>

            <button 
              onClick={generateCopy}
              disabled={loading || !product}
              className="w-full bg-purple-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {loading ? 'Thinking...' : t('generate')}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white min-h-[400px] p-8 rounded-3xl border border-slate-200 shadow-sm relative group overflow-hidden">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="prose prose-slate max-w-none text-slate-800"
                >
                  <ReactMarkdown>{result}</ReactMarkdown>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center text-center p-12 space-y-4"
                >
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
                    <Layout className="w-8 h-8" />
                  </div>
                  <p className="text-slate-400 font-medium italic">Your generated ad copy will appear here.</p>
                </motion.div>
              )}
            </AnimatePresence>

            {result && (
              <div className="absolute top-4 right-4 flex gap-2">
                <button 
                  onClick={copyToClipboard}
                  className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-slate-50 transition-all shadow-sm"
                  title="Copy"
                >
                  <Copy className="w-5 h-5" />
                </button>
                <button 
                  onClick={saveCopy}
                  className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-emerald-600 hover:bg-slate-50 transition-all shadow-sm"
                  title="Save to Library"
                >
                  <Save className="w-5 h-5" />
                </button>
              </div>
            )}
            
            {/* Visual platform markers */}
            {result && (
              <div className="absolute bottom-4 left-4">
                {PLATFORMS.filter(p => p.id === platform).map(p => (
                  <div key={p.id} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold", p.bg, p.color)}>
                    <p.icon className="w-4 h-4" />
                    {p.id} Optimized
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3 text-amber-800 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p><strong>Note:</strong> While AI generates great starting points, always review for accuracy before publishing your ads.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RefreshCw(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
