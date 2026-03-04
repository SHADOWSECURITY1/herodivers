# Hero Diver Portal — Setup Guide

## Overview
The portal lives at `portal/` and deploys to Netlify separately from the Shopify store.
Target URL: `portal.herodivingandmarine.com`

---

## Step 1 — Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Name it `herodivers-portal`
3. Once created, go to **Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon / public key** → `SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

### Run this SQL in Supabase → SQL Editor:

```sql
-- Diver profiles (extends Supabase Auth users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  full_name TEXT,
  cert_agency TEXT,
  cert_number TEXT,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Inspection reports
CREATE TABLE reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diver_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'draft',
  report_type TEXT,
  client_name TEXT,
  client_email TEXT,
  vessel_name TEXT,
  job_location TEXT,
  report_data JSONB,
  sent_at TIMESTAMPTZ
);

-- Row Level Security: divers see only their own reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Diver can view own reports" ON reports
  FOR ALL USING (diver_id = auth.uid());

CREATE POLICY "Diver can view own profile" ON profiles
  FOR ALL USING (id = auth.uid());
```

### Create your first diver account:
In Supabase → **Authentication → Users → Invite user**
Enter the diver's email. They'll receive a link to set a password.

---

## Step 2 — Resend

1. Go to [resend.com](https://resend.com) and create an account
2. **Add your domain**: Add `herodivingandmarine.com` and follow the DNS verification steps
3. Once verified, go to **API Keys → Create API Key**
4. Copy the key → `RESEND_API_KEY`

---

## Step 3 — Netlify Deploy

1. Go to [netlify.com](https://netlify.com) → **Add new site → Import from Git**
2. Connect to the `SHADOWSECURITY1/herodivers` GitHub repo
3. Set build settings:
   - **Base directory**: *(leave blank)*
   - **Publish directory**: `portal`
   - **Build command**: *(leave blank — no build step)*
4. Deploy the site

### Add Environment Variables:
In Netlify → **Site Settings → Environment Variables**, add:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `RESEND_API_KEY` | Your Resend API key |

### Install Supabase dependency for Netlify Functions:
In your terminal:
```bash
cd portal/netlify/functions
npm init -y
npm install @supabase/supabase-js
```
Commit the resulting `package.json` and `node_modules` (or add a `netlify.toml` build step).

> **Simpler option**: In `send-report.js`, the Supabase client is optional. If you skip the npm install, the email will still send — it just won't auto-update the status in the DB. You can update status manually via Supabase dashboard.

---

## Step 4 — Inject Credentials into Frontend

The HTML pages use `%%SUPABASE_URL%%` and `%%SUPABASE_ANON_KEY%%` as placeholders.
Netlify can replace these automatically using a build plugin, or you can:

**Option A (Simple):** Replace the placeholders directly in each HTML file with your actual values.
Search for `%%SUPABASE_URL%%` and `%%SUPABASE_ANON_KEY%%` in all HTML files and replace.
The anon key is safe to be public — it's designed for client-side use with RLS protecting data.

**Option B (Netlify Build Plugin):** Add a build script that replaces the placeholders using env vars. (Advanced — ask for help if needed.)

---

## Step 5 — Custom Domain

1. In Netlify → **Domain Management → Add custom domain**
2. Enter: `portal.herodivingandmarine.com`
3. In your DNS provider (wherever herodivingandmarine.com is managed), add:
   ```
   Type: CNAME
   Name: portal
   Value: [your-netlify-app-name].netlify.app
   ```
4. Netlify will auto-provision an SSL certificate (Let's Encrypt)

---

## Step 6 — Link from Shopify

In your Shopify theme nav, add a link to the portal:
- **Label**: Diver Portal
- **URL**: `https://portal.herodivingandmarine.com`

---

## File Structure Reference

```
portal/
├── index.html          Login page
├── dashboard.html      Diver home dashboard
├── new-report.html     9-section inspection report form
├── reports.html        All reports list
├── report-view.html    Single report (read-only + print)
├── styles.css          All portal styles
├── main.js             Atmospheric effects (copied from main site)
├── auth.js             Supabase auth + session guard
├── supabase-client.js  Supabase JS client
├── logo.png            Hero Diving logo
├── .env.example        Credential template
└── netlify/
    └── functions/
        └── send-report.js  Email sending (Resend)
```
