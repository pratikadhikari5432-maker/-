import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import admin from "firebase-admin";
import Razorpay from "razorpay";
import { Resend } from "resend";

// Initialize Services
let razorpayClient: any = null;
const getRazorpay = () => {
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: process.env.VITE_RAZORPAY_KEY || '',
      key_secret: process.env.RAZORPAY_SECRET_KEY || '',
    });
  }
  return razorpayClient;
};

let resendClient: any = null;
const getResend = () => {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY environment variable is required");
    }
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } catch (error) {
    console.warn("Firebase Admin could not initialize with applicationDefault. Ensure FIREBASE_CONFIG is set.");
    // Fallback or handle appropriately in your environment
  }
}

const db = admin.apps.length ? admin.firestore() : null;

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'billing-platform-secret-123-change-this';

// API Routes
app.post("/api/staff/create", async (req, res) => {
  const { username, name, password, role, ownerId } = req.body;
  
  if (!db) {
    return res.status(500).json({ error: "Database not initialized" });
  }

  if (!username || !password || !ownerId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Check if staff username already exists globally or within this owner
    // For this SaaS, we'll keep usernames unique globally for simplicity in login
    const existing = await db.collection("staff_accounts").where("username", "==", username).get();
    if (!existing.empty) {
      return res.status(400).json({ error: "Username already taken" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const staffRef = db.collection("staff_accounts").doc();
    await staffRef.set({
      username,
      name,
      role,
      userId: ownerId, // Owner's UID
      createdAt: new Date().toISOString()
    });

    await db.collection("staff_auth").doc(staffRef.id).set({
      password: hashedPassword,
      username
    });

    res.json({ success: true, staffId: staffRef.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/staff-login", async (req, res) => {
  const { username, password } = req.body;
  
  if (!db) {
    return res.status(500).json({ error: "Database not initialized" });
  }

  try {
    const staffSnap = await db.collection("staff_accounts").where("username", "==", username).limit(1).get();
    
    if (staffSnap.empty) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const staffDoc = staffSnap.docs[0];
    const staffData = staffDoc.data();
    
    const authSnap = await db.collection("staff_auth").doc(staffDoc.id).get();
    if (!authSnap.exists) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const authData = authSnap.data()!;
    const isMatch = await bcrypt.compare(password, authData.password);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const firebaseToken = await admin.auth().createCustomToken(staffDoc.id, {
      role: staffData.role,
      ownerId: staffData.userId
    });

    res.json({ 
      token: firebaseToken, 
      user: {
        id: staffDoc.id,
        username: staffData.username,
        name: staffData.name,
        role: staffData.role,
        ownerId: staffData.userId
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/contact/submit", async (req, res) => {
  const { userId, userName, userEmail, subject, message } = req.body;
  
  if (!db) {
    return res.status(500).json({ error: "Database not initialized" });
  }

  try {
    await db.collection("contact_requests").add({
      userId,
      userName,
      userEmail,
      subject,
      message,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/notify/email", async (req, res) => {
  const { to, subject, html } = req.body;
  
  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: "Email service not configured" });
  }

  try {
    const data = await getResend().emails.send({
      from: 'EasyBill <onboarding@resend.dev>',
      to: [to],
      subject,
      html,
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error("Resend error:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
});

app.post("/api/razorpay/create-order", async (req, res) => {
  const { amount, currency = "INR", receipt } = req.body;
  
  try {
    const options = {
      amount: amount * 100, // amount in the smallest currency unit
      currency,
      receipt,
    };
    const order = await getRazorpay().orders.create(options);
    res.json(order);
  } catch (error) {
    console.error("Razorpay error:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

app.post("/api/ai/generate", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt is required" });

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    res.json({ text });
  } catch (err: any) {
    console.error("AI Error:", err);
    res.status(500).json({ error: "Failed to generate AI content" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
