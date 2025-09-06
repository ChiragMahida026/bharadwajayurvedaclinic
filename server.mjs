// server.mjs — Express + EJS + express-ejs-layouts (ESM)
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import expressLayouts from "express-ejs-layouts";
import helmet from "helmet";
import dotenv from "dotenv";
import compression from "compression";
import rateLimit from "express-rate-limit";
import morgan from "morgan";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.locals.siteName = process.env.SITE_NAME || 'Bharadwaj Ayurveda';
app.locals.siteUrl = process.env.SITE_URL || 'https://bharadwaj-ayurveda.example';
app.locals.imageUrl = process.env.IMAGE_URL || '/assets/BHARADWAJ%20LOGO%20WITH%20NAME.png';
app.locals.imageAlt = process.env.IMAGE_ALT || 'Bharadwaj Ayurveda Clinic logo';
app.locals.themeColor = process.env.THEME_COLOR || '#364f3b';
app.locals.defaultTitle = `${app.locals.siteName} | Dr. Jayveersinh J. Mahida`;


/* ---------- Basic runtime config ---------- */
const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";
const TRUST_PROXY = process.env.TRUST_PROXY === "true";
const LOG_CONTACTS = process.env.LOG_CONTACTS === "true";

/* ---------- Trust proxy (if running behind a proxy/load balancer) ---------- */
if (TRUST_PROXY) app.set("trust proxy", 1);

/* ---------- Security & performance ---------- */
/*
  CSP here tries to be reasonably strict while allowing fonts and the Razorpay checkout.
  If you change how/when you load external scripts (eg. lazy-loading Razorpay) update CSP accordingly.
*/
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "https://checkout.razorpay.com"],
        "connect-src": ["'self'", "https://checkout.razorpay.com"],
        "img-src": ["'self'", "data:", "https:"],
        "frame-src": ["https://checkout.razorpay.com", "https://api.razorpay.com"],
        "style-src": ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "frame-ancestors": ["'self'"]
      }
    },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-site" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    // HSTS is useful in production
    hsts: NODE_ENV === "production" ? { maxAge: 60 * 60 * 24 * 365, includeSubDomains: true, preload: true } : false
  })
);

app.disable("x-powered-by");
app.use(compression());

/* ---------- Logging ---------- */
if (NODE_ENV !== "production") {
  app.use(morgan("dev"));
} else {
  // in production you could use a combined logger or external log aggregator
  app.use(morgan("common"));
}

/* ---------- Rate limiting ---------- */
/* General API limiter (applied to /api/*) to prevent abuse */
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // per IP
  standardHeaders: true,
  legacyHeaders: false
});
app.use("/api/", generalApiLimiter);

/* Stricter limiter for contact form specifically to prevent spam */
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // at most 10 submissions per IP per hour
  message: { message: "Too many contact requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false
});

/* ---------- Body parsers ---------- */
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

/* ---------- Views ---------- */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout"); // views/layout.ejs

/* ---------- Static ---------- */
app.use(
  express.static(path.join(__dirname, "public"), {
    index: false,
    etag: true,
    lastModified: true,
    maxAge: "7d",
    setHeaders(res, filePath) {
      // long-term caching for static assets with immutable filenames
      if (/\.(?:woff2?|ttf|eot|png|jpe?g|gif|svg|webp|avif)$/.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    }
  })
);

/* ---------- Utilities: validation & sanitization ---------- */
const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function sanitizeText(s = "") {
  // Basic sanitization: trim, limit length, strip control characters and angle brackets
  return String(s)
    .replace(/[\x00-\x1F\x7F]/g, "") // remove control chars
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .trim()
    .slice(0, 2000); // cap at 2000 chars
}

function validateContact({ name, email, message }) {
  const errors = [];
  const n = sanitizeText(name || "");
  const e = (email || "").trim();
  const m = sanitizeText(message || "");

  if (!n || n.length < 2) errors.push("name");
  if (!e || !EMAIL_REGEX.test(e) || e.length > 254) errors.push("email");
  if (!m || m.length < 10 || m.length > 5000) errors.push("message");

  return {
    ok: errors.length === 0,
    fields: { name: n, email: e, message: m },
    errors
  };
}

/* ---------- Routes ---------- */
app.get("/", (_req, res) => res.render("home"));

/* Admin route simply opens the client admin modal — keep server-side route simple */
app.get("/admin", (_req, res) => res.render("home", { showAdmin: true }));

/* Health / readiness endpoints */
app.get("/health", (_req, res) => res.json({ status: "ok", uptime: process.uptime() }));
app.get("/ready", (_req, res) => res.json({ status: "ready" }));

/* ---------- API: contact ---------- */
/* Apply contact-specific rate limiter */
app.post("/api/contact", contactLimiter, async (req, res) => {
  try {
    const result = validateContact(req.body || {});
    if (!result.ok) {
      return res.status(400).json({
        message: "Validation failed",
        invalid: result.errors
      });
    }

    const { name, email, message } = result.fields;

    // Example: if you want to actually send email, enable nodemailer and configure SMTP credentials.
    // This block is optional — for now we log the sanitized data.
    // If you enable email sending, make sure to handle it asynchronously and catch errors.

    if (LOG_CONTACTS) {
      console.info("Contact submission:", { name, email, message });
    } else {
      // log only minimal info in production by default
      console.info("Contact submission (reduced):", { name, email });
    }

    // Example: stub for sending email / webhook
    // await sendContactEmail({ name, email, message });

    // Return friendly success message
    return res.status(200).json({ message: "Thank you! Your message has been received." });
  } catch (err) {
    console.error("Error in /api/contact:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

/* ---------- 404 ---------- */
app.use((req, res) => {
  // for APIs return JSON
  if (req.path.startsWith("/api/") || req.headers.accept?.includes("application/json")) {
    return res.status(404).json({ message: "Not Found" });
  }
  // render home with status so client can show a friendly message
  res.status(404).render("home", { status: 404, error: "Page not found" });
});

/* ---------- Error handler (must have 4 args) ---------- */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err && (err.stack || err));
  if (req.path.startsWith("/api/") || req.headers.accept?.includes("application/json")) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
  res.status(500).render("home", { status: 500, error: "Something went wrong." });
});

/* ---------- Graceful shutdown ---------- */
function shutdown(signal) {
  console.log(`Received ${signal}. Graceful shutdown start.`);
  server.close(() => {
    console.log("Http server closed.");
    // If you have DB connections or external resources, close them here.
    process.exit(0);
  });

  // Force shutdown after timeout
  setTimeout(() => {
    console.warn("Forcing shutdown.");
    process.exit(1);
  }, 30_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

/* ---------- Start server ---------- */
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT} (${NODE_ENV})`);
});
