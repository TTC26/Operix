// Creates a Razorpay order for unlocking one project's PDF + Word report.
import { requireUser, db, sendError } from '../_admin.js';
import { amountDue } from '../_pricing.js';
import { rzp, rzpKeys } from '../_razorpay.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await requireUser(req);
    const { projectId, mode } = req.body || {};
    if (typeof projectId !== 'string' || !projectId || projectId.length > 100) return res.status(400).json({ error: 'Invalid project.' });
    const m = Math.min(3, Math.max(1, Math.round(Number(mode)) || 1));
    const proj = await db().doc(`users/${user.uid}/projects/${projectId}`).get();
    if (!proj.exists) return res.status(404).json({ error: 'Save the project before unlocking it.' });
    const un = await db().doc(`users/${user.uid}/unlocks/${projectId}`).get();
    const paidMode = un.exists ? (un.data().mode || 0) : 0;
    const rupees = amountDue(m, paidMode);
    if (rupees <= 0) return res.status(200).json({ alreadyUnlocked: true });
    const order = await rzp('/orders', { method: 'POST', body: {
      amount: rupees * 100, currency: 'INR', receipt: ('bz_' + projectId).slice(0, 40),
      notes: { uid: user.uid, projectId, mode: String(m), email: user.email || '' }
    } });
    res.status(200).json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: rzpKeys().id, upgradeFrom: paidMode || null });
  } catch (e) { sendError(res, e); }
}
