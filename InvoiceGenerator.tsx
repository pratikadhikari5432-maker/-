import React, { useState, useEffect, useRef } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc, runTransaction, onSnapshot, orderBy } from 'firebase/firestore';
import { Plus, Trash2, Download, Printer, Save, FileText, User, Calendar, CreditCard, Search, Package, AlertCircle, Phone, Hash, Tag, Percent, Calculator, ChevronDown, CheckCircle2, Cloud, Filter, Mail, Loader2, DollarSign, ShieldCheck, MessageCircle } from 'lucide-react';
import { Invoice, InvoiceItem, UserProfile, Product, Customer } from '../../types';
import { formatCurrency, generateId, cn } from '../../lib/utils';
import { localStore } from '../../lib/localStorage';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { useLanguage } from '../../context/LanguageContext';
import { storageService } from '../../services/storageService';
import { notificationService } from '../../services/notificationService';
import { motion, AnimatePresence } from 'motion/react';

export default function InvoiceGenerator({ ownerId }: { ownerId?: string }) {
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const barcodeRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentStatus, setCurrentStatus] = useState<Invoice['status']>('paid');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: generateId(), description: '', quantity: 1, price: 0, discount: 0, gstPercent: 18, hsnCode: '', total: 0 }
  ]);
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    const targetUid = ownerId || auth.currentUser?.uid;
    if (!targetUid) return;
    setLoading(true);

    // Load from LocalStorage first
    const cachedInvoices = localStore.getInvoices();
    if (cachedInvoices.length > 0) setInvoices(cachedInvoices);
    
    const cachedProducts = localStore.getProducts();
    if (cachedProducts.length > 0) setProducts(cachedProducts);

    const draft = localStore.getDraftInvoice();
    if (draft) {
      setClientName(draft.clientName || '');
      setClientPhone(draft.clientPhone || '');
      setItems(draft.items || items);
    }

    const unsubscribeProfile = onSnapshot(doc(db, 'users', targetUid), (snap) => {
      if (snap.exists()) setProfile(snap.data() as UserProfile);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${targetUid}`);
    });

    const invQuery = query(collection(db, 'invoices'), where('userId', '==', targetUid), orderBy('createdAt', 'desc'));
    const unsubscribeInvoices = onSnapshot(invQuery, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
      setInvoices(data);
      localStore.saveInvoices(data);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'invoices');
      setOfflineMode(true);
      setLoading(false);
    });

    const unsubscribeProducts = onSnapshot(query(collection(db, 'products'), where('userId', '==', targetUid)), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      setProducts(data);
      localStore.saveProducts(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'products');
    });

    const unsubscribeCustomers = onSnapshot(query(collection(db, 'customers'), where('userId', '==', targetUid)), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
      setCustomers(data);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'customers');
    });

    setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
    
    const handleKeys = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        setIsCreating(true);
        setTimeout(() => barcodeRef.current?.focus(), 100);
      }
      if (e.altKey && e.key === 'a') {
        addItem();
      }
    };

    window.addEventListener('keydown', handleKeys);
    return () => {
      window.removeEventListener('keydown', handleKeys);
      unsubscribeProfile();
      unsubscribeInvoices();
      unsubscribeProducts();
      unsubscribeCustomers();
    };
  }, [ownerId]);

  // Save draft periodically
  useEffect(() => {
    if (isCreating && (clientName || items[0].description)) {
      localStore.saveDraftInvoice({ clientName, clientPhone, items });
    }
  }, [clientName, clientPhone, items, isCreating]);

  const addItem = () => {
    setItems([...items, { id: generateId(), description: '', quantity: 1, price: 0, discount: 0, gstPercent: 18, hsnCode: '', total: 0 }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(i => i.id !== id));
    }
  };

  const generateWhatsAppShare = (inv: Invoice) => {
    const message = `*INVOICE FROM ${profile?.businessName || 'Business'}*\n` +
      `--------------------------------\n` +
      `Invoice No: ${inv.invoiceNumber}\n` +
      `Date: ${format(new Date(inv.createdAt), 'PP')}\n` +
      `Customer: ${inv.clientName}\n` +
      `Total Amount: ₹${inv.totalAmount.toLocaleString('en-IN')}\n\n` +
      `*Items:*\n` +
      inv.items.map(i => `- ${i.description} (x${i.quantity}): ₹${i.total?.toFixed(2)}`).join('\n') +
      `\n\n_Thank you for your business!_`;
    
    const encoded = encodeURIComponent(message);
    const phone = inv.clientPhone ? inv.clientPhone.replace(/\D/g, '') : '';
    // Use international format for India if only 10 digits
    const formattedPhone = phone.length === 10 ? `91${phone}` : phone;
    
    window.open(`https://wa.me/${formattedPhone}?text=${encoded}`, '_blank');
  };


  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // Recalculate item total
        const qty = field === 'quantity' ? Number(value) : updated.quantity;
        const price = field === 'price' ? Number(value) : updated.price;
        const disc = field === 'discount' ? Number(value) : (updated.discount || 0);
        const gst = field === 'gstPercent' ? Number(value) : (updated.gstPercent || 0);
        
        const taxable = (qty * price) - disc;
        const tax = taxable * (gst / 100);
        updated.total = taxable + tax;
        
        return updated;
      }
      return item;
    }));
  };

  const handleBarcodeScan = (code: string) => {
    const product = products.find(p => p.barcode === code);
    if (product) {
      // Check if item already in list
      const existingItem = items.find(i => i.productId === product.id);
      if (existingItem) {
        updateItem(existingItem.id, 'quantity', (existingItem.quantity || 1) + 1);
      } else {
        const taxable = (1 * product.price) - 0;
        const tax = taxable * ((product.gstPercent || 18) / 100);
        const newItem: InvoiceItem = {
          id: generateId(),
          productId: product.id,
          description: product.name,
          quantity: 1,
          price: product.price,
          purchasePrice: product.purchasePrice,
          discount: 0,
          gstPercent: product.gstPercent || 18,
          hsnCode: product.hsnCode || '',
          total: taxable + tax
        };
        // Replace last empty item if it exists
        if (items.length === 1 && !items[0].description) {
          setItems([newItem]);
        } else {
          setItems([...items, newItem]);
        }
      }
      setBarcodeInput('');
      setMessage({ type: 'success', text: `Added: ${product.name}` });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const selectProduct = (itemId: string, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setItems(items.map(item => {
        if (item.id === itemId) {
          const taxable = (1 * product.price) - 0;
          const tax = taxable * ((product.gstPercent || 18) / 100);
          return { 
            ...item, 
            productId: product.id,
            description: product.name, 
            price: product.price,
            purchasePrice: product.purchasePrice,
            hsnCode: product.hsnCode || '',
            gstPercent: product.gstPercent || 18,
            total: taxable + tax
          };
        }
        return item;
      }));
    }
  };

  const totals = items.reduce((acc, item) => {
    const taxable = (item.quantity * item.price) - (item.discount || 0);
    const tax = taxable * ((item.gstPercent || 0) / 100);
    return {
      subTotal: acc.subTotal + taxable,
      taxAmount: acc.taxAmount + tax,
      discountAmount: acc.discountAmount + (item.discount || 0)
    };
  }, { subTotal: 0, taxAmount: 0, discountAmount: 0 });

  const rawTotal = totals.subTotal + totals.taxAmount;
  const grandTotal = Math.round(rawTotal);
  const displayRoundOff = grandTotal - rawTotal;
  const dueAmount = grandTotal - amountPaid;
  const paymentStatus = amountPaid >= grandTotal ? 'paid' : amountPaid > 0 ? 'partial' : 'pending';

  const selectCustomer = (idOrName: string) => {
    const customer = customers.find(c => c.id === idOrName || c.name === idOrName);
    if (customer) {
      setCustomerId(customer.id!);
      setClientName(customer.name);
      setClientPhone(customer.phone);
      setClientEmail(customer.email || '');
    } else {
      setCustomerId(null);
      setClientName(idOrName);
    }
  };

  const sendEmail = (inv: Invoice) => {
    const subject = `Invoice ${inv.invoiceNumber} from ${profile?.businessName || 'our business'}`;
    const body = `Hello ${inv.clientName},\n\nPlease find your invoice #${inv.invoiceNumber} attached/linked below.\n\nTotal Amount: ${formatCurrency(inv.totalAmount)}\nStatus: ${inv.status.toUpperCase()}\n\nView Invoice: ${inv.pdfUrl || 'Link will be available soon'}\n\nThank you for your business!`;
    const email = inv.clientEmail || '';
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const saveInvoice = async () => {
    if (!auth.currentUser && !offlineMode) return;
    if (!clientName) { setMessage({ type: 'error', text: "Please enter customer name" }); return; }

    setSaving(true);
    setMessage(null);
    let pdfUrl = '';

    const invoiceData: Invoice = {
      invoiceNumber,
      customerId: customerId || undefined,
      clientName,
      clientPhone,
      clientEmail,
      items,
      subTotal: totals.subTotal,
      taxAmount: totals.taxAmount,
      discountAmount: totals.discountAmount,
      roundOff: displayRoundOff,
      totalAmount: grandTotal,
      amountPaid: Number(amountPaid),
      dueAmount,
      status: currentStatus,
      paymentStatus,
      dueDate,
      createdAt: new Date().toISOString(),
      userId: auth.currentUser?.uid || 'offline_user'
    };

    try {
      if (navigator.onLine && !offlineMode && auth.currentUser) {
        // Generate and upload PDF before transaction
        try {
          const docRef = generatePDF(invoiceData, true);
          const pdfBlob = docRef.output('blob');
          const targetUid = ownerId || auth.currentUser.uid;
          const { url } = await storageService.uploadInvoicePDF(targetUid, invoiceData.invoiceNumber, pdfBlob);
          pdfUrl = url;
          invoiceData.pdfUrl = url;
        } catch (pdfErr) {
          console.warn("PDF Upload failed, saving invoice anyway:", pdfErr);
        }

        // Use Transaction for atomic updates
        await runTransaction(db, async (transaction) => {
          // 1. Add Invoice
          const invoiceRef = doc(collection(db, 'invoices'));
          transaction.set(invoiceRef, invoiceData);

          // 2. Update Customer Totals
          if (customerId) {
            const customerRef = doc(db, 'customers', customerId);
            const customerDoc = await transaction.get(customerRef);
            if (customerDoc.exists()) {
              const cData = customerDoc.data() as Customer;
              transaction.update(customerRef, {
                totalPurchaseValue: (cData.totalPurchaseValue || 0) + grandTotal,
                totalDue: (cData.totalDue || 0) + dueAmount
              });
            }
          }

          // 3. Update Product Stock
          for (const item of items) {
            if (item.productId) {
              const productRef = doc(db, 'products', item.productId);
              const productDoc = await transaction.get(productRef);
              if (productDoc.exists()) {
                const pData = productDoc.data() as Product;
                transaction.update(productRef, {
                  stock: pData.stock - item.quantity
                });
              }
            }
          }
        });

        setMessage({ type: 'success', text: "Invoice Saved & Ledger Updated!" });
      } else {
        localStore.addPendingInvoice(invoiceData);
        setMessage({ type: 'success', text: "Offline: Invoice saved locally." });
      }
      
      setTimeout(() => setMessage(null), 3000);
      localStore.clearDraft();
      setIsCreating(false);
      resetForm();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'invoices_transaction');
      setMessage({ type: 'error', text: "Error saving invoice." });
    } finally {
      setSaving(false);
    }
  };

  // Auto-sync effect
  useEffect(() => {
    const handleOnline = async () => {
      const pending = localStore.getPendingInvoices();
      if (pending.length === 0 || !auth.currentUser) return;

      console.log("Online: Syncing pending invoices...");
      for (const inv of pending) {
        try {
          const { id, ...data } = inv; // remove offline id
          
          if (auth.currentUser) {
            // Re-generate and upload PDF for offline bills
            const doc = generatePDF(data as any, true);
            const pdfBlob = doc.output('blob');
            try {
              const { url } = await storageService.uploadInvoicePDF(auth.currentUser.uid, data.invoiceNumber, pdfBlob);
              data.pdfUrl = url;
            } catch (sErr) {
              console.warn("Storage sync error:", sErr);
            }
          }

          await addDoc(collection(db, 'invoices'), { ...data, userId: auth.currentUser.uid });
        } catch (err) {
          console.error("Sync failed for", inv.invoiceNumber, err);
        }
      }
      localStore.clearPendingInvoices();
      alert("All offline invoices synchronized!");
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const deleteInvoice = async (id: string) => {
    if (!confirm("Delete this invoice permanentally?")) return;
    try {
      await deleteDoc(doc(db, 'invoices', id));
      alert("Invoice deleted");
    } catch (err) {
      alert("Error deleting invoice");
    }
  };

  const updateInvoiceStatus = async (id: string, newStatus: Invoice['status']) => {
    try {
      await updateDoc(doc(db, 'invoices', id), { status: newStatus });
    } catch (err) {
      alert("Error updating status");
    }
  };

  const resetForm = () => {
    setCustomerId(null);
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setAmountPaid(0);
    setItems([{ id: generateId(), description: '', quantity: 1, price: 0, discount: 0, gstPercent: 18, hsnCode: '', total: 0 }]);
    setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
    setCurrentStatus('paid');
  };

  const generatePDF = (inv: Invoice, returnDoc = false) => {
    const doc = new jsPDF() as any;
    const primaryColor = [79, 70, 229]; // Indigo-600
    
    // Header background for professional look
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, 210, 50, 'F');
    
    // Logo / Business Name
    if (profile?.logo) {
      try {
        doc.addImage(profile.logo, 'PNG', 20, 10, 30, 30);
      } catch (e) {
        doc.setFontSize(22);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFont(undefined, 'bold');
        doc.text(profile?.businessName || 'INVOICE', 20, 20);
      }
    } else {
      doc.setFontSize(24);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont(undefined, 'bold');
      doc.text(profile?.businessName || 'INVOICE', 20, 25);
    }
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.setFont(undefined, 'normal');
    doc.text(profile?.address || '', 20, 32);
    doc.text(`Phone: ${profile?.phone || ''} | Email: ${profile?.email || ''}`, 20, 37);
    if (profile?.gstin) doc.text(`GSTIN: ${profile.gstin}`, 20, 42);
    
    // Invoice Label shifted to right
    doc.setFontSize(28);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont(undefined, 'bold');
    doc.text('INVOICE', 140, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(`No: ${inv.invoiceNumber}`, 140, 32);
    doc.text(`Date: ${format(new Date(inv.createdAt), 'PP')}`, 140, 37);
    doc.text(`Due: ${format(new Date(inv.dueDate), 'PP')}`, 140, 42);
    
    // Billing Details
    doc.setFontSize(11);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont(undefined, 'bold');
    doc.text('BILL TO:', 20, 60);
    
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`${inv.clientName}`, 20, 66);
    doc.setTextColor(100, 116, 139);
    doc.setFont(undefined, 'normal');
    if (inv.clientPhone) doc.text(`Phone: ${inv.clientPhone}`, 20, 71);
    if (inv.clientEmail) doc.text(`Email: ${inv.clientEmail}`, 20, 76);
    
    // Table
    const tableData = inv.items.map((item, i) => [
      i + 1,
      item.description,
      item.hsnCode || '-',
      item.quantity,
      item.price.toFixed(2),
      item.discount?.toFixed(2) || '0.00',
      `${item.gstPercent}%`,
      item.total?.toFixed(2)
    ]);
    
    doc.autoTable({
      startY: 85,
      head: [['#', 'Item Description', 'HSN', 'Qty', 'Unit Price', 'Disc', 'Tax', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: primaryColor, 
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 'auto' },
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'center', cellWidth: 15 },
        4: { halign: 'right', cellWidth: 25 },
        5: { halign: 'right', cellWidth: 20 },
        6: { halign: 'center', cellWidth: 15 },
        7: { halign: 'right', cellWidth: 25 }
      },
      styles: { fontSize: 9, cellPadding: 3 }
    });
    
    let finalY = doc.lastAutoTable.finalY + 10;
    
    // Check for page break
    if (finalY > 240) {
      doc.addPage();
      finalY = 20;
    }
    
    // Calculation Summary Box
    doc.setFillColor(248, 250, 252);
    doc.rect(130, finalY - 5, 65, 55, 'F');
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Sub Total:`, 135, finalY + 5);
    doc.text(`₹${inv.subTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`, 188, finalY + 5, { align: 'right' });
    
    doc.text(`CGST + SGST:`, 135, finalY + 12);
    doc.text(`₹${inv.taxAmount.toLocaleString('en-IN', {minimumFractionDigits: 2})}`, 188, finalY + 12, { align: 'right' });
    
    doc.text(`Discount:`, 135, finalY + 19);
    doc.text(`-₹${inv.discountAmount.toLocaleString('en-IN', {minimumFractionDigits: 2})}`, 188, finalY + 19, { align: 'right' });

    if (inv.roundOff !== 0) {
      doc.text(`Round Off:`, 135, finalY + 26);
      doc.text(`${inv.roundOff > 0 ? '+' : ''}${inv.roundOff.toFixed(2)}`, 188, finalY + 26, { align: 'right' });
    }
    
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(130, finalY + 32, 65, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.text(`GRAND TOTAL:`, 135, finalY + 39);
    doc.text(`₹${inv.totalAmount.toLocaleString('en-IN', {minimumFractionDigits: 2})}`, 188, finalY + 39, { align: 'right' });
    
    // Left side: Bank Details & Terms
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Payment Information:', 20, finalY + 5);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    
    if (profile?.bankDetails) {
      doc.text(`Bank: ${profile.bankDetails.bankName}`, 20, finalY + 12);
      doc.text(`A/C: ${profile.bankDetails.accountNumber}`, 20, finalY + 17);
      doc.text(`IFSC: ${profile.bankDetails.ifsc}`, 20, finalY + 22);
      if (profile.bankDetails.upiId) doc.text(`UPI: ${profile.bankDetails.upiId}`, 20, finalY + 27);
    } else {
      doc.text('CASH / CHECK / UPI', 20, finalY + 12);
    }
    
    doc.setFont(undefined, 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Terms & Conditions:', 20, finalY + 40);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const terms = profile?.billingTerms || '1. Goods once sold will not be taken back.\n2. Interest @18% will be charged if not paid within due date.\n3. Subject to local jurisdiction.';
    doc.text(terms, 20, finalY + 45);
    
    // Vertical spacing
    const signatureY = Math.max(finalY + 80, 270);
    
    doc.setFontSize(9);
    doc.text('Authorized Signatory', 160, signatureY, { align: 'center' });
    doc.line(140, signatureY - 5, 180, signatureY - 5);
    
    doc.setFontSize(8);
    doc.setFont(undefined, 'italic');
    doc.text('This is a computer generated invoice and does not require a physical signature.', 105, 285, { align: 'center' });

    if (returnDoc) return doc;
    doc.save(`Invoice_${inv.invoiceNumber}.pdf`);
  };

  const printInvoice = (inv: Invoice, thermal: boolean = false) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Bill - ${inv.invoiceNumber}</title>
          <style>
            ${thermal ? `
              @page { size: 80mm auto; margin: 0; }
              body { font-family: 'Courier New', monospace; width: 72mm; margin: 0 auto; padding: 5mm 2mm; font-size: 10px; color: #000; line-height: 1.2; }
              .center { text-align: center; }
              .bold { font-weight: bold; }
              .hr { border-bottom: 1px dashed #000; margin: 5px 0; }
              .table { width: 100%; border-collapse: collapse; }
              .table th, .table td { text-align: left; padding: 2px 0; font-size: 10px; }
              .text-right { text-align: right; }
              .header h2 { margin: 2px 0; font-size: 14px; }
              .header p { margin: 1px 0; font-size: 9px; }
              .summary { margin-top: 5px; }
              .grand-total { font-size: 12px; font-weight: bold; border-top: 1px double #000; padding-top: 3px; }
              .footer { margin-top: 10px; font-size: 8px; text-align: center; }
            ` : `
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
              body { font-family: 'Inter', sans-serif; padding: 20px; color: #1e293b; line-height: 1.5; }
              .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
              .biz-info h1 { margin: 0; color: #4f46e5; font-size: 24px; }
              .biz-info p { margin: 2px 0; font-size: 12px; color: #64748b; }
              .inv-label { text-align: right; }
              .inv-label h2 { margin: 0; font-size: 32px; color: #4f46e5; }
              .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
              .detail-box h4 { margin: 0 0 8px 0; color: #4f46e5; font-size: 12px; text-transform: uppercase; }
              .detail-box p { margin: 2px 0; font-size: 14px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
              th { background: #4f46e5; color: white; padding: 12px; font-size: 12px; text-align: left; }
              td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
              .text-right { text-align: right; }
              .summary { margin-left: auto; width: 300px; }
              .summary-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
              .grand-total { background: #4f46e5; color: white; padding: 12px; border-radius: 8px; margin-top: 10px; font-weight: bold; font-size: 18px; }
              .footer { margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; border-top: 1px solid #f1f5f9; pt: 20px; }
              .notes h5 { margin: 0 0 8px 0; font-size: 12px; }
              .notes p { margin: 0; font-size: 11px; color: #64748b; white-space: pre-line; }
              .signature { text-align: right; align-self: flex-end; }
              .sig-line { border-top: 1px solid #1e293b; width: 200px; margin-left: auto; margin-top: 40px; padding-top: 8px; font-size: 12px; font-weight: bold; }
            `}
          </style>
        </head>
        <body>
          ${thermal ? `
            <div class="header center">
              <h2>${profile?.businessName || 'Business'}</h2>
              <p>${profile?.address || ''}</p>
              <p>Ph: ${profile?.phone || ''}</p>
              ${profile?.gstin ? `<p>GSTIN: ${profile.gstin}</p>` : ''}
              <div class="hr"></div>
              <p class="bold">TAX INVOICE</p>
              <p>NO: ${inv.invoiceNumber}</p>
              <p>DT: ${format(new Date(inv.createdAt), 'PP p')}</p>
              <div class="hr"></div>
            </div>
            <div class="customer-info">
              <p>CUST: ${inv.clientName}</p>
              <p>MOB: ${inv.clientPhone || '-'}</p>
              <div class="hr"></div>
            </div>
            <table class="table">
              <thead>
                <tr>
                  <th>ITEM</th>
                  <th class="text-right">QTY</th>
                  <th class="text-right">AMT</th>
                </tr>
              </thead>
              <tbody>
                ${inv.items.map(i => `
                  <tr>
                    <td colspan="3">${i.description}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 8px">HSN:${i.hsnCode || '-'}</td>
                    <td class="text-right">${i.quantity} x ${i.price.toFixed(2)}</td>
                    <td class="text-right">${i.total?.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="hr"></div>
            <div class="summary">
              <div style="display: flex; justify-content: space-between font-size: 10px;"><span>Subtotal:</span> <span>₹${inv.subTotal.toFixed(2)}</span></div>
              <div style="display: flex; justify-content: space-between font-size: 10px;"><span>GST:</span> <span>₹${inv.taxAmount.toFixed(2)}</span></div>
              <div style="display: flex; justify-content: space-between font-size: 10px;"><span>Disc:</span> <span>-₹${inv.discountAmount.toFixed(2)}</span></div>
              <div class="grand-total" style="display: flex; justify-content: space-between font-size: 12px; padding-top: 5px;">
                <span>NET TOTAL:</span> <span>₹${inv.totalAmount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
              </div>
            </div>
            <div class="hr"></div>
            <div class="footer">
              <p>Thank you for shopping!</p>
              <p>Visit again</p>
            </div>
          ` : `
            <div class="header">
              <div class="biz-info">
                <h1>${profile?.businessName || 'Business Name'}</h1>
                <p>${profile?.address || ''}</p>
                <p>Phone: ${profile?.phone || ''} | Email: ${profile?.email || ''}</p>
                ${profile?.gstin ? `<p>GSTIN: ${profile.gstin}</p>` : ''}
              </div>
              <div class="inv-label">
                <h2>INVOICE</h2>
                <p>#${inv.invoiceNumber}</p>
                <p>Date: ${format(new Date(inv.createdAt), 'PP')}</p>
              </div>
            </div>

            <div class="details-grid">
              <div class="detail-box">
                <h4>Bill To</h4>
                <p><strong>${inv.clientName}</strong></p>
                <p>${inv.clientPhone || ''}</p>
                <p>${inv.clientEmail || ''}</p>
              </div>
              <div class="detail-box" style="text-align: right">
                <h4>Payment Info</h4>
                <p>Status: <span style="color: ${inv.status === 'paid' ? '#10b981' : '#f59e0b'}">${inv.status.toUpperCase()}</span></p>
                <p>Due Date: ${format(new Date(inv.dueDate), 'PP')}</p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Item Description</th>
                  <th class="text-right">Qty</th>
                  <th class="text-right">Price</th>
                  <th class="text-right">Disc</th>
                  <th class="text-right">GST</th>
                  <th class="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${inv.items.map(item => `
                  <tr>
                    <td><strong>${item.description}</strong><br/><small style="color: #64748b">HSN: ${item.hsnCode || '-'}</small></td>
                    <td class="text-right">${item.quantity}</td>
                    <td class="text-right">₹${item.price.toFixed(2)}</td>
                    <td class="text-right">₹${(item.discount || 0).toFixed(2)}</td>
                    <td class="text-right">${item.gstPercent}%</td>
                    <td class="text-right">₹${item.total?.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="summary">
              <div class="summary-row"><span>Sub Total:</span> <span>₹${inv.subTotal.toFixed(2)}</span></div>
              <div class="summary-row"><span>Tax (GST):</span> <span>₹${inv.taxAmount.toFixed(2)}</span></div>
              <div class="summary-row"><span>Discount:</span> <span>-₹${inv.discountAmount.toFixed(2)}</span></div>
              ${inv.roundOff !== 0 ? `<div class="summary-row"><span>Round Off:</span> <span>${inv.roundOff > 0 ? '+' : ''}${inv.roundOff.toFixed(2)}</span></div>` : ''}
              <div class="grand-total">
                <div class="summary-row" style="padding: 0"><span>Grand Total:</span> <span>₹${inv.totalAmount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
              </div>
            </div>

            <div class="footer">
              <div class="notes">
                ${profile?.bankDetails ? `
                  <h5>Payment Details:</h5>
                  <p style="margin-bottom: 10px; font-size: 10px;">
                    ${profile.bankDetails.bankName}<br/>
                    A/C: ${profile.bankDetails.accountNumber}<br/>
                    IFSC: ${profile.bankDetails.ifsc}<br/>
                    ${profile.bankDetails.upiId ? `UPI: ${profile.bankDetails.upiId}` : ''}
                  </p>
                ` : ''}
                <h5>Terms & Conditions:</h5>
                <p>${profile?.billingTerms || '1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction.'}</p>
              </div>
              <div class="signature">
                <div class="sig-line">Authorized Signatory</div>
              </div>
            </div>
            
            <p style="text-align: center; font-size: 10px; color: #64748b; margin-top: 100px;">
              Thank you for your business!
            </p>
          `}
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      inv.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.clientEmail && inv.clientEmail.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = filterStatus === 'all' || inv.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusStyle = (status: Invoice['status'], dueDate: string) => {
    const isOverdue = status !== 'paid' && new Date(dueDate) < new Date();
    if (isOverdue || status === 'overdue') return "text-red-600 bg-red-50 ring-red-100";
    
    switch (status) {
      case 'paid': return "text-emerald-600 bg-emerald-50 ring-emerald-100";
      case 'sent': return "text-blue-600 bg-blue-50 ring-blue-100";
      case 'draft': return "text-slate-600 bg-slate-50 ring-slate-100";
      default: return "text-slate-400 bg-slate-50 ring-slate-100";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Retail Billing Terminal</h2>
          <p className="text-slate-500">Fast checkout for retail & wholesale</p>
        </div>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-black transition-all"
        >
          {isCreating ? <ChevronDown className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {isCreating ? "View History" : "New Bill (F2)"}
        </button>
      </div>

      {isCreating ? (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3 space-y-6">
            {/* Customer Info Card */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 overflow-hidden relative">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 italic">
                    <User className="w-3 h-3" /> Customer Name
                  </label>
                  <div className="relative">
                    <input 
                      value={clientName}
                      onChange={e => selectCustomer(e.target.value)}
                      list="customer-list"
                      placeholder="Select or enter customer"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                    />
                    <datalist id="customer-list">
                      {customers.map(c => (
                        <option key={c.id} value={c.name}>{c.phone}</option>
                      ))}
                    </datalist>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 italic">
                    <Phone className="w-3 h-3" /> Phone Number
                  </label>
                  <input 
                    value={clientPhone}
                    onChange={e => setClientPhone(e.target.value)}
                    placeholder="Mobile number"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 italic">
                    <Hash className="w-3 h-3" /> Invoice No.
                  </label>
                  <input 
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono font-bold"
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    ref={barcodeRef}
                    value={barcodeInput}
                    onChange={e => {
                      setBarcodeInput(e.target.value);
                      if (e.target.value.length >= 4) handleBarcodeScan(e.target.value);
                    }}
                    placeholder="Scan Barcode or Type Code..."
                    className="w-full pl-10 pr-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Bill Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-xs font-bold text-slate-500 uppercase">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3 min-w-[200px]">Item / Product</th>
                    <th className="px-4 py-3">HSN</th>
                    <th className="px-4 py-3 w-20 text-center">Qty</th>
                    <th className="px-4 py-3 w-24">Price</th>
                    <th className="px-4 py-3 w-24">Disc</th>
                    <th className="px-4 py-3 w-20">GST%</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 italic">
                  {items.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-xs font-bold text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3 space-y-1">
                        <select 
                          onChange={e => selectProduct(item.id, e.target.value)}
                          value={item.productId || ''}
                          className="w-full text-sm font-bold bg-transparent outline-none focus:text-indigo-600"
                        >
                          <option value="">Search Product...</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <input 
                          value={item.description}
                          onChange={e => updateItem(item.id, 'description', e.target.value)}
                          placeholder="Or type item description"
                          className="w-full text-xs text-slate-500 bg-transparent outline-none italic"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          value={item.hsnCode}
                          onChange={e => updateItem(item.id, 'hsnCode', e.target.value)}
                          className="w-full text-xs bg-transparent outline-none font-mono"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="number"
                          value={item.quantity}
                          onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                          className="w-full text-sm text-center font-bold bg-transparent outline-none"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="number"
                          value={item.price}
                          onChange={e => updateItem(item.id, 'price', e.target.value)}
                          className="w-full text-sm font-bold bg-transparent outline-none font-mono"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="number"
                          value={item.discount}
                          onChange={e => updateItem(item.id, 'discount', e.target.value)}
                          className="w-full text-sm bg-transparent outline-none italic text-indigo-400"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select 
                          value={item.gstPercent}
                          onChange={e => updateItem(item.id, 'gstPercent', e.target.value)}
                          className="w-full text-xs bg-transparent outline-none"
                        >
                          <option value={0}>0%</option>
                          <option value={5}>5%</option>
                          <option value={12}>12%</option>
                          <option value={18}>18%</option>
                          <option value={28}>28%</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold font-mono">
                        {(item.total || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                <button 
                  onClick={addItem}
                  className="text-xs font-bold text-indigo-600 hover:bg-white px-4 py-2 rounded-lg transition-all"
                >
                  + Add New Row (Alt+A)
                </button>
                <div className="text-xs text-slate-400 font-medium uppercase italic">CGST + SGST will be split automatically in print</div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Calculation Card */}
            <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl sticky top-6">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 italic">
                <Calculator className="w-5 h-5 text-indigo-400" /> Summary
              </h3>
              
              <div className="space-y-4 font-mono text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span>₹{totals.subTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Tax Amount:</span>
                  <span>₹{totals.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-indigo-400">
                  <span>Discount:</span>
                  <span>-₹{totals.discountAmount.toFixed(2)}</span>
                </div>
                {displayRoundOff !== 0 && (
                   <div className="flex justify-between text-slate-500">
                    <span>Round Off:</span>
                    <span>{displayRoundOff > 0 ? '+' : ''}{displayRoundOff.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="my-6 border-t border-slate-800 border-dashed" />

              <div className="flex justify-between items-end mb-8">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest italic">Payable Amount</span>
                <div className="text-right">
                  <div className="text-4xl font-black text-indigo-400 font-mono">
                    ₹{grandTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 mt-8">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider italic">Cash Received</label>
                    <input 
                      type="number"
                      value={amountPaid}
                      onChange={e => setAmountPaid(Number(e.target.value))}
                      className="w-full bg-slate-800 border-none rounded-xl p-3 text-xl font-bold text-indigo-300 focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider italic">Return / Due</label>
                    <div className={cn(
                      "w-full bg-slate-800/50 rounded-xl p-3 text-xl font-bold font-mono text-right",
                      dueAmount > 0 ? "text-orange-400" : "text-emerald-400"
                    )}>
                      ₹{Math.abs(dueAmount).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="pt-6 space-y-3">
                  <button 
                    onClick={() => saveInvoice()}
                    disabled={saving}
                    className="w-full bg-indigo-600 hover:bg-white hover:text-indigo-900 py-4 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/40 transition-all active:scale-95 disabled:opacity-50 h-16"
                  >
                    {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Printer className="w-6 h-6" />}
                    {saving ? "SAVING..." : "SAVE & PRINT BILL"}
                  </button>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => generatePDF({ 
                        invoiceNumber, clientName, clientPhone, clientEmail, items, 
                        subTotal: totals.subTotal, taxAmount: totals.taxAmount, 
                        discountAmount: totals.discountAmount, roundOff: displayRoundOff, 
                        totalAmount: grandTotal, amountPaid, dueAmount,
                        status: 'paid', paymentStatus, dueDate, 
                        createdAt: new Date().toISOString(), userId: auth.currentUser?.uid || '' 
                      })} 
                      className="bg-slate-800 hover:bg-slate-700 py-3 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 uppercase tracking-tighter"
                    >
                      <Download className="w-4 h-4 text-indigo-400" /> Download PDF
                    </button>
                    <button 
                      onClick={resetForm}
                      className="bg-slate-800 hover:bg-red-500/10 hover:text-red-400 py-3 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 uppercase tracking-tighter"
                    >
                      <Trash2 className="w-4 h-4" /> Reset
                    </button>
                  </div>
                </div>
              </div>

              {message && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "mt-4 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold",
                    message.type === 'success' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                  )}
                >
                  {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  {message.text}
                </motion.div>
              )}
            </div>

            {/* Quick Shortcuts */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hidden xl:block">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 italic flex items-center gap-2">
                <ShieldCheck className="w-3 h-3 text-emerald-500" /> Billing Shortcuts
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-medium italic">F2 Key</span>
                  <span className="font-bold text-slate-800 px-2 py-0.5 rounded bg-white shadow-sm border border-slate-200">NEW BILL</span>
                </div>
                <div className="flex justify-between items-center text-xs p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-medium italic">Alt + A</span>
                  <span className="font-bold text-slate-800 px-2 py-0.5 rounded bg-white shadow-sm border border-slate-200">ADD LINE</span>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 italic">
                <p className="text-[10px] font-black text-indigo-500 uppercase mb-2">Inventory Sync:</p>
                <p className="text-[10px] text-indigo-600 leading-relaxed font-medium">Items scanned or selected will automatically decrease stock count after bill generation.</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by customer name, email or bill number..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
              <select 
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full sm:w-40 p-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="sent">Sent</option>
                <option value="draft">Draft</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100 italic">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Bill Details</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Grand Total</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.length > 0 ? filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-black text-slate-900 font-mono">#{inv.invoiceNumber}</div>
                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">{format(new Date(inv.createdAt), 'PP p')}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-slate-900">{inv.clientName}</div>
                        <div className="text-[10px] text-slate-500 font-medium italic">{inv.clientEmail || 'No Email'}</div>
                        <div className="text-xs text-indigo-500 italic flex items-center gap-1 font-medium font-mono mt-1"><Phone className="w-3 h-3" /> {inv.clientPhone || 'No Contact'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          value={inv.status}
                          onChange={(e) => updateInvoiceStatus(inv.id!, e.target.value as any)}
                          className={cn(
                            "text-[10px] font-bold px-2 py-1 rounded-full uppercase ring-1 outline-none appearance-none cursor-pointer",
                            getStatusStyle(inv.status, inv.dueDate)
                          )}
                        >
                          <option value="paid">Paid</option>
                          <option value="sent">Sent</option>
                          <option value="draft">Draft</option>
                          <option value="overdue">Overdue</option>
                        </select>
                        {(inv.status !== 'paid' && new Date(inv.dueDate) < new Date()) && (
                          <div className="text-[8px] text-red-500 font-bold mt-1 uppercase tracking-tighter">Overdue since {format(new Date(inv.dueDate), 'PP')}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-lg font-black text-slate-900 font-mono italic">₹{inv.totalAmount.toFixed(2)}</div>
                      </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {inv.pdfUrl && (
                          <a 
                            href={inv.pdfUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="p-2 text-indigo-400 hover:text-indigo-600 transition-colors" 
                            title="View Cloud PDF"
                          >
                            <Cloud className="w-5 h-5" />
                          </a>
                        )}
                        <button onClick={() => printInvoice(inv, true)} className="p-2 text-slate-400 hover:text-emerald-600 transition-colors" title="Thermal Print (80mm)">
                          <Printer className="w-5 h-5 text-emerald-500" />
                        </button>
                        <button onClick={() => printInvoice(inv, false)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Standard Print (A4)">
                          <Printer className="w-5 h-5" />
                        </button>
                        <button onClick={() => generatePDF(inv)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Download PDF">
                          <Download className="w-5 h-5" />
                        </button>
                        <button onClick={() => generateWhatsAppShare(inv)} className="p-2 text-slate-400 hover:text-emerald-600 transition-colors" title="WhatsApp Share">
                          <MessageCircle className="w-5 h-5 text-emerald-500" />
                        </button>
                        <button onClick={() => sendEmail(inv)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Send via Email">
                          <Mail className="w-5 h-5" />
                        </button>
                        <button onClick={() => deleteInvoice(inv.id!)} className="p-2 text-slate-300 hover:text-red-500 transition-colors" title="Delete Bill">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center italic text-slate-400">
                      {loading ? (
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                          <span>Syncing terminal...</span>
                        </div>
                      ) : "No transaction history found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
