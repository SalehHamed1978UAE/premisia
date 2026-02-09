#!/usr/bin/env node

/**
 * Verification script for Supabase Auth setup
 * Run this to verify your Supabase configuration is correct
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });
dotenv.config({ path: join(__dirname, '../.env') });

console.log('🔍 Verifying Supabase Authentication Setup...\n');

// Check required environment variables
const requiredVars = {
  'VITE_SUPABASE_URL': process.env.VITE_SUPABASE_URL,
  'VITE_SUPABASE_ANON_KEY': process.env.VITE_SUPABASE_ANON_KEY,
  'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
  'DATABASE_URL': process.env.DATABASE_URL,
  'SESSION_SECRET': process.env.SESSION_SECRET,
  'ENCRYPTION_KEY': process.env.ENCRYPTION_KEY,
};

let hasErrors = false;

console.log('1️⃣  Checking environment variables:');
for (const [name, value] of Object.entries(requiredVars)) {
  if (!value) {
    console.log(`   ❌ ${name} is not set`);
    hasErrors = true;
  } else {
    const displayValue = name.includes('URL') ? value : value.substring(0, 10) + '...';
    console.log(`   ✅ ${name} is set (${displayValue})`);
  }
}

if (hasErrors) {
  console.log('\n❌ Missing required environment variables. Please check your .env.local file.');
  process.exit(1);
}

console.log('\n2️⃣  Testing Supabase connection:');

// Test Supabase client connection
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

try {
  // Test anon key client (used by frontend)
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  const { error: anonError } = await anonClient.auth.getSession();

  if (anonError) {
    console.log(`   ❌ Anon client error: ${anonError.message}`);
    hasErrors = true;
  } else {
    console.log(`   ✅ Anon client connection successful`);
  }

  // Test service role client (used by backend)
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Try to list users (will fail if service key is invalid)
  const { data: users, error: serviceError } = await serviceClient.auth.admin.listUsers({
    page: 1,
    perPage: 1
  });

  if (serviceError) {
    console.log(`   ❌ Service role client error: ${serviceError.message}`);
    hasErrors = true;
  } else {
    console.log(`   ✅ Service role client connection successful`);
    console.log(`   ℹ️  Total users in Supabase: ${users?.users?.length || 0}`);
  }
} catch (error) {
  console.log(`   ❌ Connection error: ${error.message}`);
  hasErrors = true;
}

console.log('\n3️⃣  Checking Google OAuth configuration:');
console.log('   ℹ️  Make sure you have configured Google OAuth in your Supabase dashboard:');
console.log('      1. Go to Authentication > Providers in Supabase dashboard');
console.log('      2. Enable Google provider');
console.log('      3. Add your Google OAuth credentials');
console.log('      4. Add redirect URLs:');
console.log(`         - ${supabaseUrl}/auth/v1/callback`);
console.log(`         - http://localhost:5173/ (for local development)`);
console.log(`         - Your production URL`);

console.log('\n4️⃣  Database migration reminder:');
console.log('   ℹ️  Run the following to add the supabaseUid column to your users table:');
console.log('      npm run db:push');
console.log('   Or manually run the SQL in: migrations/add_supabase_uid.sql');

if (!hasErrors) {
  console.log('\n✅ Supabase setup verification complete! Your configuration looks good.');
  console.log('\n🚀 Next steps:');
  console.log('   1. Run the database migration: npm run db:push');
  console.log('   2. Start the development server: npm run dev');
  console.log('   3. Navigate to http://localhost:5173/auth');
  console.log('   4. Test the authentication flows');
} else {
  console.log('\n❌ Setup verification failed. Please fix the issues above and try again.');
  process.exit(1);
}