import React, { useState, useRef, useEffect } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { Palette, Download, Save, RefreshCw, Type, Layout, Star, Store, Sparkles, Building2, Check, AlertCircle } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';
import { cn } from '../../lib/utils';

const ICON_LIST = [
  'Store', 'ShoppingBag', 'Coffee', 'Utensils', 'Truck', 'Zap', 
  'Leaf', 'Heart', 'Star', 'Smile', 'Sun', 'Moon', 
  'Axe', 'Hammer', 'Scissors', 'Wind', 'Cloud'
];

const COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', 
  '#0891b2', '#000000', '#475569', '#f97316', '#db2777'
];

const INDUSTRIES = [
  'Technology', 'Retail & Fashion', 'Food & Beverage', 'Health & Wellness',
  'Creative & Design', 'Professional Services', 'Construction', 
  'Education', 'Automotive', 'Real Estate', 'Fitness', 'Music'
];

export default function LogoMaker({ ownerId }: { ownerId?: string }) {
  const [logoName, setLogoName] = useState('My Business');
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [slogan, setSlogan] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('Store');
  const [color, setColor] = useState('#2563eb');
  const [fontSize, setFontSize] = useState(32);
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical');
  const [generating, setGenerating] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const previewRef = useRef<HTMLDivElement>(null);

  const LogoIcon = (LucideIcons as any)[selectedIcon] || Store;

  const downloadLogo = async () => {
    if (!previewRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: null,
        scale: 3, // Reduced scale slightly to avoid massive files
        useCORS: true,
        logging: false
      });
      
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${logoName.replace(/\s+/g, '_')}_logo.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to download logo. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const saveLogo = async () => {
    if (!previewRef.current) return;
    const targetUid = ownerId || auth.currentUser?.uid;
    if (!targetUid) {
      alert("Please sign in to save your logo.");
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);
    try {
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: null,
        scale: 2, // Even smaller scale for Firestore storage to keep within 1MB limit
        useCORS: true
      });
      
      const dataUrl = canvas.toDataURL('image/png');
      
      await addDoc(collection(db, 'logos'), {
        userId: targetUid,
        imageUrl: dataUrl,
        name: logoName,
        createdAt: new Date().toISOString()
      });
      
      setSaveStatus({ type: 'success', text: "Creative logo saved to your cloud gallery!" });
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err) {
      console.error("Save failed:", err);
      setSaveStatus({ type: 'error', text: "Failed to save logo. File might be too heavy." });
    } finally {
      setIsSaving(false);
    }
  };

  const generateSlogan = async () => {
    if (!logoName) return;
    setGenerating(true);
    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: `Generate exactly 5 catchy, extremely short, and professional business slogans for a company named "${logoName}" in the ${industry} industry. Return only the single best one without any quotes, periods, or extra text.`
        }),
      });
      const data = await response.json();
      
      if (data.text) {
        setSlogan(data.text.replace(/["']/g, '').replace(/\.$/, '').trim());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Logo Maker</h2>
          <p className="text-slate-500">Create a professional visual identity in seconds</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Editor */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6 text-sm">
            <div className="space-y-4">
              <label className="block font-bold text-slate-700">Business Name</label>
              <input 
                value={logoName} 
                onChange={e => setLogoName(e.target.value)}
                placeholder="Enter business name"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-4">
              <label className="block font-bold text-slate-700">Industry</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select 
                  value={industry}
                  onChange={e => setIndustry(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                >
                  {INDUSTRIES.map(ind => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-slate-700">Slogan (Optional)</label>
                <button 
                  onClick={generateSlogan}
                  disabled={generating}
                  className="text-blue-600 font-bold flex items-center gap-1 hover:underline disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" /> Suggest
                </button>
              </div>
              <input 
                value={slogan} 
                onChange={e => setSlogan(e.target.value)}
                placeholder="Business slogan"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-4">
              <label className="block font-bold text-slate-700">Brand Color</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-slate-900 scale-110 shadow-md' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="block font-bold text-slate-700">Select Icon</label>
              <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
                {ICON_LIST.map(iconName => {
                  const Icon = (LucideIcons as any)[iconName];
                  return (
                    <button
                      key={iconName}
                      onClick={() => setSelectedIcon(iconName)}
                      className={`p-2 rounded-xl border-2 transition-all flex items-center justify-center ${selectedIcon === iconName ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                    >
                      <Icon className="w-5 h-5" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block font-bold text-slate-700">Layout</label>
                <div className="flex gap-2">
                  <button onClick={() => setLayout('vertical')} className={`flex-1 p-2 rounded-lg border text-xs font-bold ${layout === 'vertical' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 border-slate-200'}`}>Vertical</button>
                  <button onClick={() => setLayout('horizontal')} className={`flex-1 p-2 rounded-lg border text-xs font-bold ${layout === 'horizontal' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 border-slate-200'}`}>Horizontal</button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block font-bold text-slate-700">Text Size</label>
                <input type="range" min="20" max="60" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} className="w-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-6">
          <div className="aspect-square bg-slate-200/50 rounded-3xl border-2 border-dashed border-slate-300 flex items-center justify-center relative overflow-hidden group">
            <div 
              ref={previewRef}
              className={`p-12 flex items-center justify-center rounded-2xl ${layout === 'vertical' ? 'flex-col gap-4' : 'flex-row gap-6'}`}
              style={{ 
                width: '80%', 
                height: '80%', 
                backgroundColor: '#ffffff',
                boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
              }}
            >
              <LogoIcon className="w-20 h-20" style={{ color: color }} />
              <div className={`flex flex-col ${layout === 'vertical' ? 'items-center text-center' : 'items-start'}`}>
                <h1 className="font-black tracking-tight leading-none" style={{ color: color, fontSize: `${fontSize}px` }}>
                  {logoName}
                </h1>
                {slogan && (
                  <p className="font-medium tracking-widest uppercase mt-1" style={{ color: '#64748b', fontSize: `${fontSize * 0.3}px` }}>
                    {slogan}
                  </p>
                )}
              </div>
            </div>
            
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all text-transparent peer flex items-center justify-center" />
          </div>

          <AnimatePresence>
            {saveStatus && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={cn(
                  "p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 border shadow-sm",
                  saveStatus.type === 'success' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                )}
              >
                {saveStatus.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {saveStatus.text}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-4">
            <button 
              onClick={downloadLogo}
              disabled={isDownloading || isSaving}
              className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all shadow-xl shadow-slate-200 disabled:opacity-50"
            >
              {isDownloading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              {isDownloading ? 'Downloading...' : 'Download PNG'}
            </button>
            <button 
              onClick={saveLogo}
              disabled={isDownloading || isSaving}
              className="px-6 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
