import { supabase } from './supabase-client.js';

const ROLE_REDIRECTS = {
  diver: '/dashboard.html',
  vessel_owner: '/vessel-dashboard.html',
  admin: '/admin.html'
};

// Call on every protected page — redirects to login if no session
// Returns { session, profile } or null
export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/index.html';
    return null;
  }
  const profile = await getProfile(session.user.id);
  return { session, profile };
}

// Call on role-protected pages — redirects to correct dashboard if wrong role
// allowedRoles: string or array e.g. 'diver' or ['diver', 'admin']
export async function requireRole(allowedRoles) {
  const result = await requireAuth();
  if (!result) return null;

  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!roles.includes(result.profile?.role)) {
    window.location.href = ROLE_REDIRECTS[result.profile?.role] || '/index.html';
    return null;
  }
  return result;
}

// Get the current user's profile from the profiles table
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) console.error('Profile fetch error:', error);
  return data;
}

// Sign in with email + password
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

// Sign up — role is embedded in user metadata so the DB trigger picks it up
export async function signUp(email, password, role, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role, full_name: fullName } }
  });
  if (!error && data.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      role,
      full_name: fullName
    });
  }
  return { data, error };
}

// Sign out
export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/index.html';
}

// Send password reset email
export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/index.html'
  });
  return { error };
}

// Get the redirect URL for a given role
export function getRoleRedirect(role) {
  return ROLE_REDIRECTS[role] || '/dashboard.html';
}
