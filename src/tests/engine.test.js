// Run: npm test — checks the financial engine on the example project.
import fs from 'node:fs';
import vm from 'node:vm';
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../js/engine.js', import.meta.url), 'utf8') + ';this.Engine=Engine;', ctx);
vm.runInContext(fs.readFileSync(new URL('../js/example.js', import.meta.url), 'utf8') + ';this.exampleProject=exampleProject;', ctx);
const r = ctx.Engine.compute(ctx.exampleProject());
const fail = (m) => { console.error('FAIL', m); process.exitCode = 1; };
if (Math.abs(r.pc.total - r.means.total) >= 1) fail('project cost ≠ means of finance');
if (!r.bsDiff.every(d => Math.abs(d) < 1)) fail('balance sheet does not balance');
if (!(r.avgDscr > 1)) fail('average DSCR not computed');
console.log(process.exitCode ? 'Engine tests failed' : `Engine OK — cost ${r.pc.total}, avg DSCR ${r.avgDscr.toFixed(2)}, BS balanced`);
