// Supabase client — credentials injected by Netlify at build time
// In Netlify dashboard: Site Settings → Environment Variables
// Add: SUPABASE_URL and SUPABASE_ANON_KEY

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = window.__SUPABASE_URL__;
const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase credentials not configured. See SETUP.md.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
