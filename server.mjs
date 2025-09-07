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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* ---------- Mail Transporter ---------- */
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT) || 587,
  secure: Number(process.env.MAIL_PORT) === 465,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

/* ---------- Debug helper (prints CSP header sent by Express) ---------- */
/* Keep while debugging; remove in production if noisy. */
function printOutgoingHeaders(req, res, next) {
  res.once('finish', () => {
    // Print a few important headers to verify what the browser will receive
    const csp = res.getHeader('Content-Security-Policy');
    const corp = res.getHeader('Cross-Origin-Resource-Policy');
    console.log('[OUTGOING-HEADERS]', req.method, req.url, { 'Content-Security-Policy': csp, 'Cross-Origin-Resource-Policy': corp });
  });
  next();
}
app.use(printOutgoingHeaders);

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

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use("/api/", apiLimiter);

/* ---------- Body parsers ---------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  setHeaders(res, filePath) {
    if (/\.(?:woff2?|ttf|eot|png|jpg|jpeg|gif|svg|webp|avif)$/.test(filePath)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
  }
}));

/* ---------- Routes ---------- */
app.get("/", (_req, res) => res.render("home"));
app.get("/admin", (_req, res) => res.render("home"));

/* ---------- APIs ---------- */
app.post("/api/contact", async (req, res) => {
  const { name, email, message } = req.body ?? {};

  if (!name || !email || !message) {
    return res.status(400).json({ message: "All fields are required." });
  }
  if (!validator.isEmail(email)) {
    return res.status(400).json({ message: "Please provide a valid email address." });
  }
  if (message.trim().length < 10) {
    return res.status(400).json({ message: "Message must be at least 10 characters." });
  }

  try {
    await transporter.sendMail({
      from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
      to: process.env.MAIL_TO_ADDRESS,
      replyTo: email,
      subject: `New Contact Form Submission from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      html: `<p>You have a new contact form submission from:</p>
             <ul>
               <li><strong>Name:</strong> ${validator.escape(name)}</li>
               <li><strong>Email:</strong> ${validator.escape(email)}</li>
             </ul>
             <p><strong>Message:</strong></p>
             <p>${validator.escape(message)}</p>`,
    });

    console.log("Contact form email sent successfully for:", { name, email });
    return res.status(200).json({ message: "Thank you! Your message has been sent." });

  } catch (error) {
    console.error("Failed to send contact email:", error);
    return res.status(500).json({ message: "Sorry, an error occurred. Please try again later." });
  }
});

/* ---------- 404 & Errors ---------- */
function notFound(req, res, next) {
  res.status(404).render("home", { status: 404 });
}

function onError(err, req, res, next) {
  console.error(err);
  const message = process.env.NODE_ENV === 'development' ? err.stack : "Something went wrong.";
  res.status(500).send(message);
}

app.use(notFound);
app.use(onError);

/* ---------- Start ---------- */
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
