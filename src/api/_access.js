// Admins and full-access grants. Admin emails come from ADMIN_EMAILS (comma-separated) in Vercel;
// if it is not set, info.bizvora@gmail.com is the admin.
import { db } from './_admin.js';

export function adminEmails() {
  return String(process.env.ADMIN_EMAILS || 'info.bizvora@gmail.com').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}
export function isAdminUser(user) {
  return !!(user && user.email && user.email_verified && adminEmails().includes(user.email.toLowerCase()));
}
// Full access = admin, or a verified email that an admin has granted.
export async function hasFullAccess(user) {
  if (isAdminUser(user)) return true;
  if (!user || !user.email || !user.email_verified) return false;
  const g = await db().doc('grants/' + user.email.toLowerCase()).get();
  return g.exists && g.data().fullAccess === true;
}
