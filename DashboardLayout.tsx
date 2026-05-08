import React, { useState, useEffect } from 'react';
import { LayoutDashboard, FileText, Palette, MessageSquare, Send, User, LogOut, Menu, X, Package, CreditCard, Languages, ShieldCheck, BarChart3, Users, Bell, Clock, Shield } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { doc, onSnapshot, collection, query, where, orderBy, limit, updateDoc } from 'firebase/firestore';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../../context/LanguageContext';
import { Language, translations } from '../../lib/translations';
import { UserProfile, Notification } from '../../types';

interface SidebarItem {
  id: string;
  labelKey: keyof typeof translations['en'];
  icon: React.ElementType;
  adminOnly?: boolean;
}

const sidebarItems: SidebarItem[] = [
  { id: 'overview', labelKey: 'overview', icon: LayoutDashboard },
  { id: 'inventory', labelKey: 'inventory', icon: Package },
  { id: 'customers', labelKey: 'customers' as any, icon: Users },
  { id: 'invoice', labelKey: 'invoice', icon: FileText },
  { id: 'sales', labelKey: 'salesReport', icon: BarChart3 },
  { id: 'logo', labelKey: 'logoMaker', icon: Palette },
  { id: 'adcopy', labelKey: 'adCopy', icon: Send },
  { id: 'whatsapp', labelKey: 'whatsapp', icon: MessageSquare },
  { id: 'staff', labelKey: 'staff' as any, icon: ShieldCheck, adminOnly: true },
  { id: 'logs', labelKey: 'activity_logs' as any, icon: Clock, adminOnly: true },
  { id: 'plans', labelKey: 'plans', icon: CreditCard },
  { id: 'profile', labelKey: 'profile', icon: User },
  { id: 'support', labelKey: 'support' as any, icon: MessageSquare },
  { id: 'admin', labelKey: 'superAdmin' as any, icon: Shield, adminOnly: true },
];

export default function DashboardLayout({ 
  children, 
  activeTab, 
  setActiveTab,
  profile: initialProfile,
  role = 'owner'
}: { 
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  profile: UserProfile | null;
  role?: 'owner' | 'staff';
}) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile);
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    if (!auth.currentUser || role !== 'owner') return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
    });

    return () => unsubscribe();
  }, [role]);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const unsubscribe = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      } else {
        // Fallback or check staff collection if it's the only one
        onSnapshot(doc(db, 'staff_accounts', auth.currentUser.uid), (sSnap) => {
          if (sSnap.exists()) {
            const sData = sSnap.data() as any;
            onSnapshot(doc(db, 'users', sData.userId), (oSnap) => {
              if (oSnap.exists()) setProfile(oSnap.data() as UserProfile);
            });
          }
        });
      }
    });

    return () => unsubscribe();
  }, [initialProfile]);

  const ADMIN_EMAILS = ['prodyutadhikari99@gmail.com', 'pratikadhikari5432@gmail.com'];
  const isAdmin = (profile?.role === 'admin' || (auth.currentUser?.email && ADMIN_EMAILS.includes(auth.currentUser.email))) && role === 'owner';
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as Language);
  };

  const handleLogout = async () => {
    localStorage.removeItem('staff_session');
    await auth.signOut();
    window.location.reload();
  };

  const visibleSidebarItems = sidebarItems.filter(item => {
    if (role === 'staff' && item.adminOnly) return false;
    if (item.adminOnly && !isAdmin && role === 'owner') return false;
    return true;
  });

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Toast Notification */}
      <AnimatePresence>
        {notifications.filter(n => !n.read).slice(0, 1).map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-6 right-6 z-[200] w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 p-4 flex gap-4 pointer-events-auto"
          >
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-slate-900 truncate">{n.title}</p>
              <p className="text-[10px] text-slate-500 font-bold mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
              <button 
                onClick={() => updateDoc(doc(db, 'notifications', n.id!), { read: true })}
                className="text-[9px] font-black text-indigo-600 uppercase mt-2 hover:underline tracking-wider"
              >
                Dismiss Alert
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
              <span className="text-white font-bold text-xl">EB</span>
            </div>
            <div>
              <h1 className="font-bold text-slate-900 leading-tight">EasyBill</h1>
              <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">{t('businessSuite')}</p>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {visibleSidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm",
                  activeTab === item.id 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-100 scale-[1.02]" 
                    : "text-slate-600 hover:bg-slate-50"
                )}
                id={`sidebar-item-${item.id}`}
              >
                <item.icon className="w-5 h-5" />
                {t(item.labelKey as any) || item.id}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-100">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all font-medium text-sm"
              id="logout-button"
            >
              <LogOut className="w-5 h-5" />
              {t('logout')}
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <h2 className="text-lg font-semibold text-slate-800 capitalize">
            {t(sidebarItems.find(i => i.id === activeTab)?.labelKey || 'overview')}
          </h2>

          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => {
                  if (unreadCount > 0) {
                    notifications.filter(n => !n.read).forEach(n => {
                      updateDoc(doc(db, 'notifications', n.id!), { read: true });
                    });
                  }
                }}
                className="p-2.5 text-slate-500 hover:bg-slate-50 rounded-xl transition-all relative border border-slate-100"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 text-white text-[8px] font-black flex items-center justify-center rounded-full border-2 border-white animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* Language Switcher */}
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              <Languages className="w-4 h-4 text-slate-500" />
              <select 
                value={language}
                onChange={handleLanguageChange}
                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="en">EN</option>
                <option value="bn">BN</option>
                <option value="hi">HI</option>
              </select>
            </div>

            <div className="relative" id="profile-dropdown-container">
              <button 
                onClick={() => setProfileOpen(!isProfileOpen)}
                className="group flex items-center gap-3 p-1 rounded-xl hover:bg-slate-50 transition-all text-right"
                id="header-profile-button"
              >
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {profile?.businessName || auth.currentUser?.displayName || 'User'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">{auth.currentUser?.email}</span>
                </div>
                <div 
                  className="w-10 h-10 bg-slate-200 rounded-xl border-2 border-white shadow-sm overflow-hidden bg-cover bg-center group-hover:ring-2 group-hover:ring-blue-100 transition-all" 
                  style={{ backgroundImage: `url(${profile?.logo || auth.currentUser?.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'})` }} 
                />
              </button>

              <AnimatePresence>
                {isProfileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/50 p-2 z-50"
                  >
                    <button
                      onClick={() => {
                        setActiveTab('profile');
                        setProfileOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-50 transition-all font-medium text-sm"
                    >
                      <User className="w-4 h-4 text-blue-600" />
                      {t('profile')}
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('plans');
                        setProfileOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-50 transition-all font-medium text-sm"
                    >
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                      {t('plans')}
                    </button>
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-all font-medium text-sm"
                    >
                      <LogOut className="w-4 h-4" />
                      {t('logout')}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
