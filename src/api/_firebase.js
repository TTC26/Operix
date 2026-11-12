// Reads the Firebase web config from the FIREBASE_CONFIG environment variable.
// Accepts any of these pasted as the value:
//   - plain JSON:                 {"apiKey":"...","projectId":"..."}
//   - the object from the console: { apiKey: "...", projectId: "..." }
//   - the whole console code block (import lines, comments, const firebaseConfig = {...}; initializeApp(...))
export function readFirebaseConfig() {
  const raw = process.env.FIREBASE_CONFIG;
  if (!raw || !raw.trim()) return { config: null, reason: 'FIREBASE_CONFIG is not set in Vercel.' };
  let txt = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'])\/\/.*$/gm, '$1');
  const m = txt.match(/\{[^{}]*apiKey[^{}]*\}/);
  if (!m) return { config: null, reason: 'FIREBASE_CONFIG does not contain an apiKey.' };
  let obj = m[0];
  let cfg = null;
  try { cfg = JSON.parse(obj); } catch (e) {
    try {
      obj = obj.replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":').replace(/'/g, '"').replace(/,\s*}/g, '}');
      cfg = JSON.parse(obj);
    } catch (e2) { return { config: null, reason: 'FIREBASE_CONFIG could not be read. Paste the firebaseConfig block from the Firebase console.' }; }
  }
  if (!cfg.apiKey || !cfg.projectId) return { config: null, reason: 'FIREBASE_CONFIG is missing apiKey or projectId.' };
  if (/\.\.\.|xxxx/i.test(cfg.apiKey + cfg.projectId) || !/^AIza[\w-]{30,}$/.test(cfg.apiKey)) return { config: null, reason: 'FIREBASE_CONFIG still has example values (like "AIza...." or "bizvora-xxxx"). Paste the real firebaseConfig block from Firebase → Project settings → Your apps.' };
  return { config: cfg, reason: null };
}
export function firebaseConfig() { return readFirebaseConfig().config; }
