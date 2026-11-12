import { prices } from '../_pricing.js';
export default function handler(req, res) {
  const enabled = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.FIREBASE_SERVICE_ACCOUNT);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ enabled, currency: 'INR', prices: prices(), testMode: String(process.env.RAZORPAY_KEY_ID || '').startsWith('rzp_test_') });
}
