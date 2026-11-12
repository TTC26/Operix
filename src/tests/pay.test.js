// Run: npm test — checks pricing and Razorpay signature verification.
import crypto from 'node:crypto';
import { amountDue, prices } from '../api/_pricing.js';
import { validSignature } from '../api/_razorpay.js';
const fail = m => { console.error('FAIL', m); process.exitCode = 1; };
const p = prices();
if (p[1] !== 599 || p[2] !== 999 || p[3] !== 1499) fail('default prices');
if (amountDue(1, 0) !== 599) fail('mode 1 new');
if (amountDue(3, 1) !== 900) fail('upgrade 1→3 should cost the difference');
if (amountDue(2, 3) !== 0) fail('already unlocked at a higher mode');
const sig = crypto.createHmac('sha256', 's3cret').update('order_1|pay_1').digest('hex');
if (!validSignature('order_1', 'pay_1', sig, 's3cret')) fail('valid signature rejected');
if (validSignature('order_1', 'pay_2', sig, 's3cret')) fail('tampered payment accepted');
if (validSignature('order_1', 'pay_1', 'short', 's3cret')) fail('bad signature accepted');
console.log(process.exitCode ? 'Payment tests failed' : 'Payment OK — prices 599/999/1499, upgrade difference, signature check');
