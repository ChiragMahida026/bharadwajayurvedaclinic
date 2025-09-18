# Bharadwaj Ayurveda Clinic - Environment Setup Guide

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/ChiragMahida026/bharadwajayurvedaclinic.git
   cd bharadwajayurvedaclinic
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

4. **Validate configuration**
   ```bash
   node validate-env.mjs
   ```

5. **Start the development server**
   ```bash
   npm start
   ```

## 🔧 Environment Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `MONGO_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/db` |
| `SESSION_SECRET` | Secure session secret | `91e42fcba373...` |
| `ADMIN_USER` | Admin username | `admin` |
| `ADMIN_PASS` | Admin password | `secure_password` |
| `RAZORPAY_KEY_ID` | Razorpay key ID | `rzp_test_xxx` |
| `RAZORPAY_KEY_SECRET` | Razorpay secret | `your_secret` |
| `MAIL_HOST` | SMTP host | `smtp.gmail.com` |
| `MAIL_PORT` | SMTP port | `587` |
| `MAIL_USER` | SMTP username | `user@gmail.com` |
| `MAIL_PASS` | SMTP password/app key | `app_password` |
| `MAIL_FROM_NAME` | Sender name | `"Clinic Name"` |
| `MAIL_FROM_ADDRESS` | Sender email | `noreply@domain.com` |
| `MAIL_TO_ADDRESS` | Contact recipient | `contact@domain.com` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ALLOWED_ORIGINS` | CORS origins | `null` |
| `LOG_LEVEL` | Logging level | `info` |
| `ENABLE_CORS` | Enable CORS | `true` |
| `RATE_LIMIT_WINDOW` | Rate limit window (ms) | `900000` |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |
| `API_RATE_LIMIT_MAX` | Max API requests | `50` |
| `MAX_FILE_SIZE` | Max upload size (bytes) | `10485760` |
| `CACHE_TTL` | Cache TTL (seconds) | `3600` |

## 🔒 Security Best Practices

### 1. Generate Secure Secrets

```bash
# Generate session secret (128 chars)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate admin password (32 chars)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### 2. Environment Separation

- **Development**: Use `.env` with test credentials
- **Production**: Use `.env.production` with real credentials
- **Never commit** real secrets to version control

### 3. File Permissions

```bash
# Set restrictive permissions on .env files
chmod 600 .env
chmod 600 .env.production
```

## 📧 Email Configuration

### Gmail Setup
1. Enable 2-factor authentication
2. Generate an App Password
3. Use App Password in `MAIL_PASS`

### SendGrid Setup
```env
MAIL_HOST=smtp.sendgrid.net
MAIL_PORT=587
MAIL_USER=apikey
MAIL_PASS=your_sendgrid_api_key
```

### AWS SES Setup
```env
MAIL_HOST=email-smtp.us-east-1.amazonaws.com
MAIL_PORT=587
MAIL_USER=your_ses_smtp_username
MAIL_PASS=your_ses_smtp_password
```

## 💳 Payment Gateway Setup

### Razorpay Configuration
1. Sign up at [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Get your API Keys from Settings > API Keys
3. Use test keys for development, live keys for production

```env
# Test Keys (Development)
RAZORPAY_KEY_ID=rzp_test_your_test_key_id
RAZORPAY_KEY_SECRET=your_test_secret_key

# Live Keys (Production)
RAZORPAY_KEY_ID=rzp_live_your_live_key_id
RAZORPAY_KEY_SECRET=your_live_secret_key
```

## 🗄️ Database Setup

### Local MongoDB
```bash
# Install MongoDB locally
# Windows: https://docs.mongodb.com/manual/tutorial/install-mongodb-on-windows/
# macOS: brew install mongodb-community
# Linux: https://docs.mongodb.com/manual/administration/install-on-linux/

# Start MongoDB
mongod

# Connection string
MONGO_URI=mongodb://127.0.0.1:27017/bharadwaj_ayurveda
```

### MongoDB Atlas (Cloud)
1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a cluster
3. Get connection string from Connect > Connect your application

```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/bharadwaj_ayurveda
```

## 🚀 Deployment

### Environment Files for Different Stages

```bash
# Development
cp .env.example .env

# Production
cp .env.example .env.production

# Staging
cp .env.example .env.staging
```

### Validation Before Deployment

```bash
# Validate all configurations
node validate-env.mjs

# Check for security issues
npm audit

# Run tests
npm test
```

## 🔍 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Find process using port 3000
   netstat -ano | findstr :3000
   # Kill the process
   taskkill /PID <PID> /F
   ```

2. **MongoDB connection failed**
   - Check if MongoDB is running
   - Verify connection string
   - Check firewall settings

3. **Email not sending**
   - Verify SMTP credentials
   - Check spam folder
   - Use app passwords for Gmail

4. **Environment validation fails**
   ```bash
   node validate-env.mjs
   # Fix any missing or placeholder values
   ```

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm start

# Check environment variables
node -e "console.log(process.env)"
```

## 📚 Additional Resources

- [Razorpay Documentation](https://docs.razorpay.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [OWASP Environment Configuration](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/05-Review_Old_Backup_and_Unreferenced_Files_for_Sensitive_Information)

## 🤝 Support

For issues related to environment setup:
1. Check this documentation
2. Run `node validate-env.mjs` to identify issues
3. Check the application logs
4. Create an issue on GitHub with relevant error messages