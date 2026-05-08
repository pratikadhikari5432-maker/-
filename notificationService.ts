import { Invoice, Product, UserProfile } from '../types';

export const notificationService = {
  async sendEmail(to: string, subject: string, html: string) {
    try {
      const response = await fetch('/api/notify/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, html }),
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to send email notification:', error);
      return { success: false, error };
    }
  },

  async notifyNewInvoice(invoice: Invoice, profile: UserProfile | null) {
    const subject = `New Invoice: ${invoice.invoiceNumber} from ${profile?.businessName || 'EasyBill'}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
        <h2 style="color: #2563eb;">New Invoice Created</h2>
        <p>Hello ${invoice.clientName},</p>
        <p>A new invoice has been generated for you by <strong>${profile?.businessName || 'EasyBill'}</strong>.</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Invoice Number:</strong> #${invoice.invoiceNumber}</p>
          <p style="margin: 5px 0;"><strong>Amount Due:</strong> ${invoice.totalAmount.toFixed(2)}</p>
          <p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
        </div>
        <p>Thank you for your business!</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #64748b;">Powered by EasyBill</p>
      </div>
    `;
    
    // Notify the client
    await this.sendEmail(invoice.clientEmail, subject, html);
    
    // Notify the business owner if email available
    if (profile?.email) {
      const adminSubject = `Invoice #${invoice.invoiceNumber} Sent to ${invoice.clientName}`;
      const adminHtml = `<p>You just sent an invoice of ${invoice.totalAmount.toFixed(2)} to ${invoice.clientName}.</p>`;
      await this.sendEmail(profile.email, adminSubject, adminHtml);
    }
  },

  async notifyLowStock(product: Product, profile: UserProfile | null) {
    if (!profile?.email) return;

    const subject = `⚠️ Low Stock Alert: ${product.name}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ef4444; rounded: 12px;">
        <h2 style="color: #ef4444;">Low Stock Warning</h2>
        <p>Your product <strong>${product.name}</strong> is running low on stock.</p>
        <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Current Stock:</strong> ${product.stock} units</p>
          <p style="margin: 5px 0;"><strong>Product SKU:</strong> ${product.sku || 'N/A'}</p>
        </div>
        <p>Please restock soon to avoid missing out on orders.</p>
        <p><a href="${window.location.origin}/inventory" style="color: #2563eb; font-weight: bold;">Manage Inventory</a></p>
      </div>
    `;
    
    await this.sendEmail(profile.email, subject, html);
  },

  async notifySubscriptionRenewal(profile: UserProfile | null, planName: string, amount: number) {
    if (!profile?.email) return;

    const subject = `Success! Your EasyBill Subscription has been Renewed`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #10b981; rounded: 12px;">
        <h2 style="color: #10b981;">Subscription Renewed</h2>
        <p>Great news! Your subscription to the <strong>${planName}</strong> plan has been successfully renewed.</p>
        <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Plan:</strong> ${planName}</p>
          <p style="margin: 5px 0;"><strong>Amount:</strong> ${amount.toFixed(2)}</p>
          <p style="margin: 5px 0;"><strong>Status:</strong> Active</p>
        </div>
        <p>Thank you for continuing with EasyBill!</p>
        <p><a href="${window.location.origin}/settings" style="color: #2563eb; font-weight: bold;">View Subscription Details</a></p>
      </div>
    `;
    
    await this.sendEmail(profile.email, subject, html);
  }
};
