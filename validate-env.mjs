#!/usr/bin/env node

/**
 * Environment Configuration Validator
 * Validates that all required environment variables are set
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const requiredVars = [
    'PORT',
    'NODE_ENV',
    'MONGO_URI',
    'SESSION_SECRET',
    'ADMIN_USER',
    'ADMIN_PASS',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'MAIL_HOST',
    'MAIL_PORT',
    'MAIL_USER',
    'MAIL_PASS',
    'MAIL_FROM_NAME',
    'MAIL_FROM_ADDRESS',
    'MAIL_TO_ADDRESS'
];

const optionalVars = [
    'ALLOWED_ORIGINS',
    'LOG_LEVEL',
    'ENABLE_CORS',
    'RATE_LIMIT_WINDOW',
    'RATE_LIMIT_MAX',
    'API_RATE_LIMIT_MAX',
    'MAX_FILE_SIZE',
    'ALLOWED_FILE_TYPES',
    'CACHE_TTL',
    'STATIC_CACHE_TTL'
];

console.log('🔍 Validating environment configuration...\n');

let hasErrors = false;
let hasWarnings = false;

// Check required variables
console.log('📋 Checking required variables:');
requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
        console.log(`❌ ${varName}: MISSING (required)`);
        hasErrors = true;
    } else if (value.includes('your_') || value.includes('example') || value.includes('change_me')) {
        console.log(`⚠️  ${varName}: PLACEHOLDER VALUE (needs to be changed)`);
        hasWarnings = true;
    } else {
        console.log(`✅ ${varName}: SET`);
    }
});

// Check optional variables
console.log('\n📋 Checking optional variables:');
optionalVars.forEach(varName => {
    const value = process.env[varName];
    if (value && value.trim() !== '') {
        console.log(`✅ ${varName}: SET (${value})`);
    } else {
        console.log(`ℹ️  ${varName}: NOT SET (using defaults)`);
    }
});

// Security checks
console.log('\n🔒 Security validation:');

// Check session secret length
const sessionSecret = process.env.SESSION_SECRET;
if (sessionSecret && sessionSecret.length < 32) {
    console.log('⚠️  SESSION_SECRET: Too short (should be at least 32 characters)');
    hasWarnings = true;
} else if (sessionSecret) {
    console.log('✅ SESSION_SECRET: Good length');
}

// Check admin password strength
const adminPass = process.env.ADMIN_PASS;
if (adminPass && adminPass.length < 8) {
    console.log('⚠️  ADMIN_PASS: Too short (should be at least 8 characters)');
    hasWarnings = true;
} else if (adminPass && adminPass === 'password123') {
    console.log('❌ ADMIN_PASS: Using default weak password');
    hasErrors = true;
} else if (adminPass) {
    console.log('✅ ADMIN_PASS: Good length');
}

// Environment-specific checks
const nodeEnv = process.env.NODE_ENV;
if (nodeEnv === 'production') {
    console.log('\n🏭 Production environment checks:');

    if (!process.env.ALLOWED_ORIGINS) {
        console.log('⚠️  ALLOWED_ORIGINS: Not set (recommended for production)');
        hasWarnings = true;
    }

    if (process.env.ENABLE_CORS !== 'false') {
        console.log('⚠️  ENABLE_CORS: Should be false in production unless needed');
        hasWarnings = true;
    }
}

// Summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
    console.log('❌ Configuration has errors that must be fixed!');
    process.exit(1);
} else if (hasWarnings) {
    console.log('⚠️  Configuration has warnings that should be reviewed');
    process.exit(0);
} else {
    console.log('✅ All required configuration is valid!');
    process.exit(0);
}