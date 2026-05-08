import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import AuthPage from './components/auth/AuthPage';
import DashboardLayout from './components/layout/DashboardLayout';
import Overview from './components/dashboard/Overview';
import InvoiceGenerator from './components/tools/InvoiceGenerator';
import LogoMaker from './components/tools/LogoMaker';
import AdCopyGenerator from './components/tools/AdCopyGenerator';
import WhatsAppAutoReply from './components/tools/WhatsAppAutoReply';
import InventoryManager from './components/tools/InventoryManager';
import CustomerManager from './components/tools/CustomerManager';
import DailySalesReport from './components/tools/DailySalesReport';
import SubscriptionPlans from './components/dashboard/SubscriptionPlans';
import ProfileSettings from './components/profile/ProfileSettings';
import AdminPanel from './components/admin/AdminPanel';
import StaffManagement from './components/dashboard/StaffManagement';
import ActivityLogs from './components/dashboard/ActivityLogs';
import ContactSupport from './components/dashboard/ContactSupport';
import { UserProfile, StaffAccount } from './types';
import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [staffAccount, setStaffAccount] = useState<StaffAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      if (u) {
        setLoading(true);
        try {
          // 1. Try to fetch as Owner
          const ownerRef = doc(db, 'users', u.uid);
          const ownerSnap = await getDoc(ownerRef);
          
          if (ownerSnap.exists()) {
            setProfile(ownerSnap.data() as UserProfile);
            setStaffAccount(null);
            localStorage.removeItem('staff_session'); // Clean up if owner logs in
          } else {
            // 2. Try to fetch as Staff
            const staffRef = doc(db, 'staff_accounts', u.uid);
            const staffSnap = await getDoc(staffRef);
            
            if (staffSnap.exists()) {
              const sData = { id: staffSnap.id, ...staffSnap.data() } as StaffAccount;
              setStaffAccount(sData);
              
              // Fetch Owner Profile for the staff
              const oRef = doc(db, 'users', sData.userId);
              const oSnap = await getDoc(oRef);
              if (oSnap.exists()) setProfile(oSnap.data() as UserProfile);
            }
          }
        } catch (err: any) {
          handleFirestoreError(err, OperationType.GET, 'auth_profile_init');
        }
      } else {
        setProfile(null);
        setStaffAccount(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center animate-bounce shadow-xl shadow-blue-200">
           <span className="text-white font-bold text-2xl">EB</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400 font-medium animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin" />
          Setting up your workspace...
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const renderContent = () => {
    const ownerId = staffAccount ? staffAccount.userId : user?.uid;

    switch (activeTab) {
      case 'overview': return <Overview onAction={setActiveTab} ownerId={ownerId} />;
      case 'inventory': return <InventoryManager ownerId={ownerId} />;
      case 'customers': return <CustomerManager ownerId={ownerId} />;
      case 'invoice': return <InvoiceGenerator ownerId={ownerId} />;
      case 'logo': return <LogoMaker ownerId={ownerId} />;
      case 'adcopy': return <AdCopyGenerator ownerId={ownerId} />;
      case 'whatsapp': return <WhatsAppAutoReply ownerId={ownerId} />;
      case 'sales': return <DailySalesReport ownerId={ownerId} />;
      case 'plans': return <SubscriptionPlans />;
      case 'profile': return <ProfileSettings />;
      case 'staff': return <StaffManagement ownerId={ownerId} />;
      case 'logs': return <ActivityLogs ownerId={ownerId} />;
      case 'support': return <ContactSupport profile={profile} />;
      case 'admin': return <AdminPanel />;
      default: return <Overview onAction={setActiveTab} ownerId={ownerId} />;
    }
  };

  return (
    <DashboardLayout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      profile={profile} 
      role={staffAccount ? 'staff' : 'owner'}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
    </DashboardLayout>
  );
}
