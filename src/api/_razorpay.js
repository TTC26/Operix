import crypto from 'node:crypto';
export function rzpKeys() {
  const id = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw Object.assign(new Error('Payments are not set up yet.'), { status: 503 });
  return { id, secret };
}
export async function rzp(path, { method = 'GET', body } = {}) {
  const { id, secret } = rzpKeys();
  const r = await fetch('https://api.razorpay.com/v1' + path, {
    method, headers: { authorization: 'Basic ' + Buffer.from(id + ':' + secret).toString('base64'), 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error((j.error && j.error.description) || 'Payment service error.'), { status: 502 });
  return j;
}
export function validSignature(orderId, paymentId, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(orderId + '|' + paymentId).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(String(signature || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
