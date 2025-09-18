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
app.use((req, res, next) => {
  const requestId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  req.requestId = requestId;
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

// Rate limiting - apply to all routes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 API requests per windowMs
  message: 'Too many API requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
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
app.get("/", (_req, res) => res.render("home"));
app.get("/admin", (_req, res) => res.render("home"));

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
function notFound(req, res, next) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 404 - ${req.method} ${req.url} - IP: ${req.ip}`);

  res.status(404).render("home", {
    status: 404,
    message: "Page not found",
    error: process.env.NODE_ENV === 'development' ? `Route ${req.url} not found` : null
  });
}

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
