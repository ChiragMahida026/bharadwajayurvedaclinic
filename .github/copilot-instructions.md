
# Bharadwaj Ayurveda Clinic — AI Coding Agent Instructions

## Project Overview
- **Stack:** Node.js (ESM), Express, EJS templating, MongoDB (Mongoose), Razorpay, Nodemailer
- **Frontend:** Static assets in `public/`, EJS views in `views/`, modular CSS in `public/css/`
- **Purpose:** Clinic website with product catalog, admin dashboard, appointment/contact forms, and payment integration
- **Entry Point:** `server.mjs` (Express app)

## Key Architecture & Patterns
- **Views:** EJS templates in `views/` (main: `layout.ejs`, partials, admin, home, checkout)
- **Frontend:** JS in `public/app.js`, CSS in `public/css/` and `public/css/components/`
- **Assets:** Images in `public/assets/`
- **Environment:** Config via `.env` (see `ENVIRONMENT_SETUP.md` and `validate-env.mjs` for required vars)
- **Session:** Uses `express-session` with MongoDB store
- **Security:** Helmet, rate limiting, XSS protection
- **Payments:** Razorpay integration (see server code)
- **Email:** Nodemailer for notifications/contact forms

## Developer Workflows
- **Setup:**
	- `npm install` (installs dependencies)
	- Copy `.env.example` to `.env` and fill in required values
	- Validate config: `node validate-env.mjs`
- **Run:**
	- `npm start` (runs `server.mjs`)
- **Environment Validation:**
	- Fails fast if required env vars are missing (see `validate-env.mjs` and `server.mjs`)
- **Testing:**
	- No formal test suite; manual validation via browser and admin dashboard

## Project-Specific Conventions
- **EJS Layouts:** All pages use `views/layout.ejs` as the base; partials included for header, footer, dialogs, drawer
- **Accessibility:** ARIA labels, skip links, keyboard navigation, noscript fallback
- **Frontend Patterns:**
	- Loader overlay (`#loader`), scroll reveal, sticky nav, glassmorphism effects
	- Custom JS for UI/UX in `public/app.js`
- **Admin:**
	- Product management via forms/table in `views/admin/dashboard.ejs`
	- Actions: add, hide/show, delete products
- **Payments:**
	- Razorpay keys required in `.env`; payment logic in server and checkout view

## Integration Points
- **MongoDB:** Connection string in `.env` (`MONGO_URI`)
- **Razorpay:** API keys in `.env`, used for payment processing
- **Email:** SMTP config in `.env`, used for notifications

## Examples
- **Add product (admin):** POST to `/admin/products` with name, price, image, description
- **Checkout:** Payment flow via Razorpay, confirmation via email
- **Environment validation:** `node validate-env.mjs` (exits on missing/invalid vars)

## References
- `ENVIRONMENT_SETUP.md`: Setup steps, required env vars
- `server.mjs`: Main Express app, env validation, integration logic
- `validate-env.mjs`: Standalone env var validator
- `views/`: EJS templates for all pages
- `public/app.js`: Frontend JS logic

---
**For AI agents:**
- Always validate environment before running the server
- Use EJS layout/partials for new views
- Follow frontend JS/CSS patterns for UI features
- Reference admin/product/payment/email flows in server and views for backend/frontend integration

---

For unclear or missing conventions, ask the user for clarification or examples from existing code.
