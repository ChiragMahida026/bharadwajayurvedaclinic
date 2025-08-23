// server.mjs — Express + EJS + express-ejs-layouts (ESM)
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import expressLayouts from "express-ejs-layouts";
import helmet from "helmet";
import dotenv from "dotenv";
import compression from "compression";
import rateLimit from "express-rate-limit";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* ---------- Security & perf ---------- */
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "https://checkout.razorpay.com"],
      "connect-src": ["'self'", "https://checkout.razorpay.com"],
      "img-src": ["'self'", "data:", "https:"],
      "frame-src": ["https://api.razorpay.com", "https://checkout.razorpay.com"],
      "style-src": ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
      "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "frame-ancestors": ["'self'"]
    }
  },
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-site" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));

app.disable("x-powered-by");
/** @type {import('express').RequestHandler} */
const compress = /** @type {import('express').RequestHandler} */ (compression());
app.use(compress);

// modest rate‑limit for APIs
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use("/api/", apiLimiter);

/* ---------- Body parsers ---------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ---------- Views ---------- */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout"); // views/layout.ejs

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
app.get("/admin", (_req, res) => res.render("home")); // client opens admin modal

/* ---------- APIs ---------- */
app.post("/api/contact", (req, res) => {
  const { name, email, message } = req.body ?? {};
  if (!name || !email || !message || message.trim().length < 10) {
    return res.status(400).json({ message: "All fields are required." });
  }
  console.log("New Contact Form Submission:", { name, email, message });
  return res.status(200).json({ message: "Thank you! Your message has been sent." });
});

/* ---------- 404 & Errors ---------- */
/** @type {import('express').RequestHandler} */
/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function notFound(req, res, next) {
  res.status(404).render("home", { status: 404 });
}
/** @type {import('express').ErrorRequestHandler} */
/**
 * @param {*} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function onError(err, req, res, next) {
  console.error(err);
  res.status(500).send("Something went wrong.");
}

app.use(notFound);
app.use(onError);

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});