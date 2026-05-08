
export const storageKeys = {
  INVOICES: 'smart_store_invoices',
  PRODUCTS: 'smart_store_products',
  PROFILE: 'smart_store_profile',
  PENDING_INVOICES: 'smart_store_pending_invoices'
};

export const localStore = {
  saveInvoices: (invoices: any[]) => {
    localStorage.setItem(storageKeys.INVOICES, JSON.stringify(invoices));
  },
  getInvoices: () => {
    const data = localStorage.getItem(storageKeys.INVOICES);
    return data ? JSON.parse(data) : [];
  },
  addPendingInvoice: (invoice: any) => {
    const pending = localStore.getPendingInvoices();
    pending.push({ ...invoice, id: `offline_${Date.now()}` });
    localStorage.setItem(storageKeys.PENDING_INVOICES, JSON.stringify(pending));
  },
  getPendingInvoices: () => {
    const data = localStorage.getItem(storageKeys.PENDING_INVOICES);
    return data ? JSON.parse(data) : [];
  },
  clearPendingInvoices: () => {
    localStorage.removeItem(storageKeys.PENDING_INVOICES);
  },
  saveProducts: (products: any[]) => {
    localStorage.setItem(storageKeys.PRODUCTS, JSON.stringify(products));
  },
  getProducts: () => {
    const data = localStorage.getItem(storageKeys.PRODUCTS);
    return data ? JSON.parse(data) : [];
  },
  saveDraftInvoice: (invoice: any) => {
    localStorage.setItem('temp_invoice_draft', JSON.stringify(invoice));
  },
  getDraftInvoice: () => {
    const data = localStorage.getItem('temp_invoice_draft');
    return data ? JSON.parse(data) : null;
  },
  clearDraft: () => {
    localStorage.removeItem('temp_invoice_draft');
  }
};
