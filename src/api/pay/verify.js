// Verifies a Razorpay payment and unlocks the project. The unlock is written only here, with admin rights.
import { requireUser, db, sendError } from '../_admin.js';
import { rzp, rzpKeys, validSignature } from '../_razorpay.js';
import admin from 'firebase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await requireUser(req);
    const { orderId, paymentId, signature } = req.body || {};
    if (!validSignature(orderId, paymentId, signature, rzpKeys().secret)) return res.status(400).json({ error: 'Payment could not be verified.' });
    const order = await rzp('/orders/' + encodeURIComponent(orderId));
    const n = order.notes || {};
    if (n.uid !== user.uid) return res.status(403).json({ error: 'This payment belongs to another account.' });
    if (order.status !== 'paid' && order.amount_paid < order.amount) {
      const pay = await rzp('/payments/' + encodeURIComponent(paymentId));
      if (!(pay.order_id === orderId && (pay.status === 'captured' || pay.status === 'authorized'))) return res.status(402).json({ error: 'Payment is not complete yet.' });
    }
    const ref = db().doc(`users/${user.uid}/unlocks/${n.projectId}`);
    const mode = Number(n.mode) || 1;
    await db().runTransaction(async tx => {
      const cur = await tx.get(ref);
      const prev = cur.exists ? cur.data() : {};
      const payments = Array.isArray(prev.payments) ? prev.payments : [];
      if (payments.some(p => p.paymentId === paymentId)) return;
      tx.set(ref, {
        mode: Math.max(mode, prev.mode || 0), unlockedAt: admin.firestore.FieldValue.serverTimestamp(),
        payments: payments.concat([{ paymentId, orderId, amount: order.amount / 100, mode, at: Date.now() }])
      });
    });
    res.status(200).json({ ok: true, projectId: n.projectId, mode });
  } catch (e) { sendError(res, e); }
}
