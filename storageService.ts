import { storage, db } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { UserProfile } from '../types';

const PLAN_LIMITS = {
  free: 2 * 1024 * 1024 * 1024, // 2GB
  pro: 10 * 1024 * 1024 * 1024, // 10GB
  enterprise: 100 * 1024 * 1024 * 1024 // 100GB (effectively large)
};

export const storageService = {
  getPlanLimit: (plan: string = 'free') => {
    return PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;
  },

  uploadInvoicePDF: async (uid: string, invoiceNumber: string, pdfBlob: Blob) => {
    // 1. Check current usage
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) throw new Error("User profile not found");
    
    const profile = userDoc.data() as UserProfile;
    const currentUsed = profile.storageUsed || 0;
    const limit = profile.storageLimit || storageService.getPlanLimit(profile.plan);
    
    if (currentUsed + pdfBlob.size > limit) {
      throw new Error("Storage quota exceeded. Please upgrade your plan.");
    }

    // 2. Upload
    const fileName = `invoices/${uid}/${invoiceNumber}_${Date.now()}.pdf`;
    const storageRef = ref(storage, fileName);
    
    await uploadBytes(storageRef, pdfBlob);
    const url = await getDownloadURL(storageRef);

    // 3. Update profile usage
    await updateDoc(doc(db, 'users', uid), {
      storageUsed: increment(pdfBlob.size),
      storageLimit: limit // Sync limit if not already set
    });

    return { url, size: pdfBlob.size, fileName };
  },

  deleteFile: async (path: string, size?: number, uid?: string) => {
    try {
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
      
      if (size && uid) {
        await updateDoc(doc(db, 'users', uid), {
          storageUsed: increment(-size)
        });
      }
    } catch (err) {
      console.error("Storage delete error:", err);
    }
  }
};
