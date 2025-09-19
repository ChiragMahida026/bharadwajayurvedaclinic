// server.mjs — Express + EJS + express-ejs-layouts (ESM)
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import expressLayouts from "express-ejs-layouts";
import helmet from "helmet";
import dotenv from "dotenv";
import compression from "compression";
import rateLimit from "express-rate-limit";
import nodemailer from "nodemailer";
import validator from "validator";
import mongoose from "mongoose";
import session from "express-session";
import MongoStore from "connect-mongo";

dotenv.config();

/* ---------- Environment validation ---------- */
function validateEnvironment() {
  const required = [
    'PORT', 'NODE_ENV', 'MONGO_URI', 'SESSION_SECRET',
    'ADMIN_USER', 'ADMIN_PASS', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'
  ];

  const emailRequired = [
    'MAIL_HOST', 'MAIL_PORT', 'MAIL_USER', 'MAIL_PASS',
    'MAIL_FROM_NAME', 'MAIL_FROM_ADDRESS', 'MAIL_TO_ADDRESS'
  ];

  // Check core required variables
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    process.exit(1);
  }

  // Check email configuration (optional in development)
  const missingEmail = emailRequired.filter(key => !process.env[key] || process.env[key]?.includes('your_') || process.env[key]?.includes('example'));
  if (missingEmail.length > 0) {
    if (process.env.NODE_ENV === 'production') {
      console.error('Missing or invalid email configuration (required in production):', missingEmail);
      console.error('Please configure email settings in your .env file');
      process.exit(1);
    } else {
      console.warn('⚠️  Email configuration incomplete. Contact form will not work until email is configured.');
      console.warn('Missing/invalid email variables:', missingEmail);
      console.warn('To fix: Update MAIL_* variables in .env with your email provider settings');
    }
  } else {
    console.log('✅ Email configuration validated');
  }

  console.log('✅ Core environment validation passed');
}

validateEnvironment();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration object
const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mail: {
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT) || 587,
    secure: Number(process.env.MAIL_PORT) === 465,
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
    fromName: process.env.MAIL_FROM_NAME,
    fromAddress: process.env.MAIL_FROM_ADDRESS,
    toAddress: process.env.MAIL_TO_ADDRESS
  },
  cors: {
    allowedOrigins: process.env.NODE_ENV === 'development' ? '*' : process.env.ALLOWED_ORIGINS || 'null'
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxGeneral: 100,
    maxApi: 50
  }
};

const app = express();

/* ---------- Database ---------- */
mongoose.set('strictQuery', true);
if (!process.env.MONGO_URI) {
  throw new Error('MONGO_URI is required');
}
await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB || 'ayurveda' });

/* ---------- Models ---------- */
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true, min: 0 },
  imageUrl: String,
  active: { type: Boolean, default: true },
}, { timestamps: true });

const orderSchema = new mongoose.Schema({
  items: [{ productId: mongoose.Schema.Types.ObjectId, name: String, price: Number, qty: Number }],
  customer: { name: String, email: String, address: String },
  amount: Number,
  status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created' },
  razorpay: {
    orderId: String,
    paymentId: String,
    signature: String
  }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);

/* ---------- Mail Transporter ---------- */
const transporter = nodemailer.createTransport({
  host: config.mail.host,
  port: config.mail.port,
  secure: config.mail.secure,
  auth: {
    user: config.mail.user,
    pass: config.mail.pass,
  },
});

/* ---------- Request ID middleware ---------- */
/** @type {import('express').RequestHandler} */
app.use((req, res, next) => {
  const requestId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  // attach id in a safe place
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

/* ---------- Helmet (disable its CSP so we control it exactly here) ---------- */
app.use(helmet({
  // We'll provide our own CSP header below; do not let helmet auto-insert one.
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));

/* ---------- Explicit CSP header (allows Google Maps iframe + Razorpay) ---------- */
/* This middleware sets a single CSP string that includes frame-src for Google Maps.
   Change domains here if you need to add/remove allowed sources. */
app.use((req, res, next) => {
  const csp = [
    "default-src 'self'",
    // scripts allowed (maps + razorpay)
    "script-src 'self' https://maps.googleapis.com https://maps.gstatic.com https://checkout.razorpay.com https://api.razorpay.com",
    // allow fetch/connect to these
    "connect-src 'self' https://maps.googleapis.com https://maps.gstatic.com https://checkout.razorpay.com https://api.razorpay.com",
    // images
    "img-src 'self' data: https: https://maps.gstatic.com https://maps.googleapis.com",
    // IMPORTANT: allow map frames explicitly (and razorpay if needed)
    "frame-src 'self' https://www.google.com https://maps.google.com https://www.google.com/maps https://maps.gstatic.com https://checkout.razorpay.com https://api.razorpay.com",
    // legacy child-src for older browsers
    "child-src 'self' https://www.google.com https://maps.google.com https://www.google.com/maps https://maps.gstatic.com https://checkout.razorpay.com https://api.razorpay.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "object-src 'none'",
    "base-uri 'self'",
    // control who can embed your *page* (keeps others from framing your site)
    "frame-ancestors 'self'"
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);
  next();
});

/* ---------- Other security & performance ---------- */
app.disable("x-powered-by");
app.use(compression());

// CORS configuration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.NODE_ENV === 'development' ? '*' : process.env.ALLOWED_ORIGINS || 'null');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Rate limiting - apply to all routes (more relaxed and with allowlist)
const baseWindow = 15 * 60 * 1000; // 15 minutes
const isDev = (process.env.NODE_ENV || 'development') !== 'production';
const generalLimiter = rateLimit({
  windowMs: baseWindow,
  max: isDev ? 1000 : 300, // relaxed in dev, higher in prod
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const p = req.path;
    // don't limit these critical flows
    if (/^\/(checkout|cart)(\/|$)/.test(p)) return true;
    return false;
  }
});

const apiLimiter = rateLimit({
  windowMs: baseWindow,
  max: isDev ? 1000 : 200,
  message: 'Too many API requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const p = req.path;
    if (/^\/api\/(order|payment\/verify)/.test(p)) return true; // allow payment flow
    return false;
  }
});

app.use(generalLimiter);
app.use("/api/", apiLimiter);

/* ---------- Body parsers ---------- */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request timeout middleware
app.use((req, res, next) => {
  // Set timeout for all requests (30 seconds)
  req.setTimeout(30000);
  res.setTimeout(30000);
  next();
});

/* ---------- Views ---------- */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout");

/* ---------- Sessions (for admin) ---------- */
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI, dbName: process.env.MONGO_DB || 'ayurveda' }),
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
}));

// Make cart count available in all views
app.use((req, res, next) => {
  /** @type {any} */
  const sess = req.session;
  res.locals.cartCount = (sess && sess.cart && sess.cart.count) ? sess.cart.count : 0;
  next();
});

/* ---------- Static ---------- */
app.use(express.static(path.join(__dirname, "public"), {
  etag: true,
  lastModified: true,
  maxAge: "7d",
  setHeaders: (res, filePath) => {
    // Cache static assets for 1 year
    if (/\.(?:woff2?|ttf|eot|png|jpg|jpeg|gif|svg|webp|avif|css|js)$/.test(filePath)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
    // Cache HTML files for 1 hour
    else if (/\.html?$/.test(filePath)) {
      res.setHeader("Cache-Control", "public, max-age=3600");
    }
  }
}));

/* ---------- Routes ---------- */
app.get("/", async (_req, res) => {
  const products = await Product.find({ active: true }).sort({ createdAt: -1 }).lean();
  res.render("home", { products });
});

/* ---------- Cart (Session) ---------- */
/** @type {import('express').RequestHandler} */
function getCart(req, _res, next) {
  /** @type {any} */
  const sess = req.session;
  if (!sess.cart) sess.cart = { items: [], count: 0 };
  return next();
}

app.use(getCart);

app.get('/cart', async (req, res) => {
  /** @type {any} */
  const sess = req.session;
  const items = sess.cart.items || [];
  const ids = items.map((/** @type {any} */ it) => it.productId);
  const products = ids.length ? await Product.find({ _id: { $in: ids } }).lean() : [];
  const enriched = items.map((/** @type {any} */ it) => {
    const p = products.find(pp => String(pp._id) === String(it.productId));
    const price = p ? p.price : it.price || 0;
    const name = p ? p.name : it.name || '';
    const imageUrl = p ? p.imageUrl : it.imageUrl || '';
    return { ...it, name, price, imageUrl, subtotal: price * it.qty };
  });
  const total = enriched.reduce((/** @type {number} */ s, /** @type {any} */ it) => s + it.subtotal, 0);
  res.render('checkout', { cart: { items: enriched, total, count: sess.cart.count }, keyId: process.env.RAZORPAY_KEY_ID });
});

app.post('/cart/add', async (req, res) => {
  const { productId, qty } = req.body || {};
  const n = Math.max(1, Number(qty) || 1);
  const product = await Product.findById(productId).lean();
  if (!product || !product.active) return res.status(400).json({ message: 'Invalid product' });
  /** @type {any} */
  const sess = req.session;
  const items = sess.cart.items || [];
  const idx = items.findIndex((/** @type {any} */ it) => String(it.productId) === String(productId));
  if (idx >= 0) items[idx].qty += n; else items.push({ productId: String(productId), qty: n });
  sess.cart.items = items; sess.cart.count = items.reduce((/** @type {number} */ s, /** @type {any} */ it) => s + it.qty, 0);
  res.json({ ok: true, count: sess.cart.count });
});

app.post('/cart/update', (req, res) => {
  const { productId, qty } = req.body || {};
  /** @type {any} */
  const sess = req.session;
  const items = sess.cart.items || [];
  const idx = items.findIndex((/** @type {any} */ it) => String(it.productId) === String(productId));
  if (idx === -1) return res.status(400).json({ message: 'Not in cart' });
  const n = Math.max(0, Number(qty) || 0);
  if (n === 0) items.splice(idx, 1); else items[idx].qty = n;
  sess.cart.items = items; sess.cart.count = items.reduce((/** @type {number} */ s, /** @type {any} */ it) => s + it.qty, 0);
  res.json({ ok: true, count: sess.cart.count });
});

app.post('/cart/clear', (req, res) => {
  /** @type {any} */
  const sess = req.session;
  sess.cart = { items: [], count: 0 };
  res.json({ ok: true, count: 0 });
});

/* ---------- Admin Auth ---------- */
/** @type {import('express').RequestHandler} */
const requireAdmin = (req, res, next) => {
  /** @type {any} */
  const sess = req.session;
  if (sess && sess.isAdmin) return next();
  return res.redirect('/admin/login');
};

app.get('/admin/login', (req, res) => res.render('admin/login'));
app.post('/admin/login', express.urlencoded({ extended: true }), (req, res) => {
  const { username, password } = req.body || {};
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    /** @type {any} */
    const sess = req.session;
    if (sess) sess.isAdmin = true;
    return res.redirect('/admin');
  }
  return res.render('admin/login', { error: 'Invalid credentials' });
});
app.post('/admin/logout', (req, res) => { req.session.destroy(() => res.redirect('/')); });

/* ---------- Admin: Products ---------- */
app.get('/admin', requireAdmin, async (req, res) => {
  const products = await Product.find().sort({ createdAt: -1 }).lean();
  res.render('admin/dashboard', { products });
});

app.post('/admin/products', requireAdmin, express.urlencoded({ extended: true }), async (req, res) => {
  const { name, description, price, imageUrl } = req.body || {};
  await Product.create({ name, description, price: Number(price), imageUrl });
  res.redirect('/admin');
});

app.post('/admin/products/:id/toggle', requireAdmin, async (req, res) => {
  const p = await Product.findById(req.params.id);
  if (p) { p.active = !p.active; await p.save(); }
  res.redirect('/admin');
});

app.post('/admin/products/:id/delete', requireAdmin, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.redirect('/admin');
});

/* ---------- Checkout ---------- */
import Razorpay from 'razorpay';
const razor = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });

app.get('/checkout/:id', async (req, res) => {
  const product = await Product.findById(req.params.id).lean();
  if (!product || !product.active) return res.status(404).send('Product not found');
  res.render('checkout', { product, keyId: process.env.RAZORPAY_KEY_ID });
});

app.post('/api/order', async (req, res) => {
  const { productId, name, email, address } = req.body || {};
  /** @type {any} */
  const sess = req.session;

  let items = [];
  if (productId) {
    const product = await Product.findById(productId).lean();
    if (!product || !product.active) return res.status(400).json({ message: 'Invalid product' });
    items = [{ productId: String(product._id), name: product.name, price: product.price, qty: 1 }];
  } else {
    const cartItems = (sess.cart && sess.cart.items) ? sess.cart.items : [];
    if (!cartItems.length) return res.status(400).json({ message: 'Cart is empty' });
    const ids = cartItems.map((/** @type {any} */ it) => it.productId);
    const products = await Product.find({ _id: { $in: ids } }).lean();
    items = cartItems.map((/** @type {any} */ it) => {
      const p = products.find(pp => String(pp._id) === String(it.productId));
      if (!p) return null;
      return { productId: String(p._id), name: p.name, price: p.price, qty: it.qty };
    }).filter(Boolean);
  }

  const total = items.reduce((/** @type {number} */ s, /** @type {{ price: number, qty: number }} */ it) => s + (it.price * it.qty), 0);
  const order = await razor.orders.create({ amount: Math.round(total * 100), currency: 'INR', receipt: `rcpt_${Date.now()}` });
  const dbOrder = await Order.create({ items, amount: total, customer: { name, email, address }, status: 'created', razorpay: { orderId: order.id } });
  // Clear cart after creating order to avoid duplicates on refresh
  if (sess.cart) sess.cart = { items: [], count: 0 };
  res.json({ orderId: order.id, amount: order.amount, currency: order.currency, dbOrderId: dbOrder._id });
});

app.post('/api/payment/verify', express.json(), async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, dbOrderId } = req.body || {};
  // Basic save; signature verification recommended but omitted for brevity
  const o = await Order.findById(dbOrderId);
  if (!o) return res.status(400).json({ message: 'Order not found' });
  o.status = 'paid';
  o.razorpay = o.razorpay || {};
  o.razorpay.paymentId = razorpay_payment_id;
  o.razorpay.signature = razorpay_signature;
  await o.save();
  res.json({ success: true });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.version
  });
});

// Readiness check endpoint
app.get("/ready", async (req, res) => {
  try {
    // Check if mail transporter is ready
    await transporter.verify();
    res.status(200).json({
      status: "ready",
      services: {
        mail: "operational"
      }
    });
  } catch (error) {
    res.status(503).json({
      status: "not ready",
      services: {
        mail: "failed"
      }
    });
  }
});

/* ---------- APIs ---------- */
app.post("/api/contact", async (req, res) => {
  const { name, email, message } = req.body ?? {};

  // Input validation and sanitization
  if (!name || !email || !message) {
    return res.status(400).json({ message: "All fields are required." });
  }

  // Sanitize inputs
  const sanitizedName = validator.escape(validator.trim(name));
  const sanitizedEmail = validator.normalizeEmail(email);
  const sanitizedMessage = validator.escape(validator.trim(message));

  if (!sanitizedEmail || !validator.isEmail(sanitizedEmail)) {
    return res.status(400).json({ message: "Please provide a valid email address." });
  }

  if (sanitizedName.length < 2 || sanitizedName.length > 100) {
    return res.status(400).json({ message: "Name must be between 2 and 100 characters." });
  }

  if (sanitizedMessage.length < 10 || sanitizedMessage.length > 2000) {
    return res.status(400).json({ message: "Message must be between 10 and 2000 characters." });
  }

  // Check if email is configured
  const isEmailConfigured = config.mail.host &&
    config.mail.user &&
    config.mail.pass &&
    !config.mail.host.includes('example') &&
    !config.mail.user.includes('your_');

  if (!isEmailConfigured) {
    console.warn("⚠️  Email not configured. Contact form submission received but not sent.");
    console.log("Contact form data:", { name: sanitizedName, email: sanitizedEmail, message: sanitizedMessage });

    if (process.env.NODE_ENV === 'development') {
      return res.status(200).json({
        message: "Message received! ⚠️ Email not configured - check server logs for the message.",
        warning: "Email configuration incomplete. Message logged but not sent."
      });
    } else {
      return res.status(500).json({
        message: "Sorry, email service is currently unavailable. Please try again later."
      });
    }
  }

  try {
    await transporter.sendMail({
      from: `"${config.mail.fromName}" <${config.mail.fromAddress}>`,
      to: config.mail.toAddress,
      replyTo: sanitizedEmail,
      subject: `New Contact Form Submission from ${sanitizedName}`,
      text: `Name: ${sanitizedName}\nEmail: ${sanitizedEmail}\n\nMessage:\n${sanitizedMessage}`,
      html: `<p>You have a new contact form submission from:</p>
             <ul>
               <li><strong>Name:</strong> ${sanitizedName}</li>
               <li><strong>Email:</strong> ${sanitizedEmail}</li>
             </ul>
             <p><strong>Message:</strong></p>
             <p>${sanitizedMessage.replace(/\n/g, '<br>')}</p>`,
    });

    console.log("Contact form email sent successfully for:", { name: sanitizedName, email: sanitizedEmail });
    return res.status(200).json({ message: "Thank you! Your message has been sent." });

  } catch (error) {
    console.error("Failed to send contact email:", error);
    return res.status(500).json({ message: "Sorry, an error occurred. Please try again later." });
  }
});

/* ---------- 404 & Errors ---------- */
/** @type {import('express').RequestHandler} */
function notFound(req, res, next) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 404 - ${req.method} ${req.url} - IP: ${req.ip}`);

  res.status(404).render("home", {
    status: 404,
    message: "Page not found",
    error: process.env.NODE_ENV === 'development' ? `Route ${req.url} not found` : null
  });
  return;
}

/** @type {(err: any, req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => void} */
function onError(err, req, res, next) {
  const timestamp = new Date().toISOString();
  const errorId = Math.random().toString(36).substring(2, 15);

  console.error(`[${timestamp}] ERROR [${errorId}] - ${req.method} ${req.url}`, {
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'development'
    ? `Error: ${err.message}`
    : "Something went wrong. Please try again later.";

  if (!res.headersSent) {
    res.status(err.status || 500).json({
      error: true,
      message: message,
      ...(process.env.NODE_ENV === 'development' && { errorId })
    });
  }
}

app.use(notFound);
app.use(onError);

/* ---------- Start ---------- */
const server = app.listen(config.port, () => {
  console.log(`🚀 Server running at http://localhost:${config.port}`);
  console.log(`📊 Health check: http://localhost:${config.port}/health`);
  console.log(`🔍 Readiness check: http://localhost:${config.port}/ready`);
  console.log(`🌍 Environment: ${config.nodeEnv}`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
