// Public client configuration. Firebase web config values are designed to be public;
// firestore.rules keeps each user's projects private.
import { readFirebaseConfig } from './_firebase.js';
export default function handler(req, res) {
  const { config: c, reason } = readFirebaseConfig();
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    firebase: c ? { apiKey: c.apiKey, authDomain: c.authDomain, projectId: c.projectId, appId: c.appId, storageBucket: c.storageBucket, messagingSenderId: c.messagingSenderId } : null,
    reason: reason || null
  });
}
