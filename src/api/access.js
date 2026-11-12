// Tells the signed-in user whether they are an admin and whether they have full access.
import { requireUser, sendError } from './_admin.js';
import { isAdminUser, hasFullAccess } from './_access.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const user = await requireUser(req);
    const isAdmin = isAdminUser(user);
    const fullAccess = await hasFullAccess(user);
    res.status(200).json({ isAdmin, fullAccess, emailVerified: !!user.email_verified });
  } catch (e) { sendError(res, e); }
}
