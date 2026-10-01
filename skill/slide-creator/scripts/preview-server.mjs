import { createServer } from 'node:http';
import { watch as watchFs, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { SKILL_DIR, loadStyle, resolveTokens } from './lib/style.mjs';
import { loadConfig, parseArgs } from './lib/project.mjs';
import { runLint } from './lint.mjs';

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

export async function watch(projectDir, argv = []) {
  const args = parseArgs(argv);
  let cfg, startupError;
  try { cfg = await loadConfig(projectDir, { style: args.style, scheme: args.scheme, out: args.out, density: args.density, page: args.page }); }
  catch (e) {
    startupError = e.message;
    cfg = { style: args.style || 'editorial', outDir: path.resolve(projectDir, args.out || 'build') };
  }
  const clients = new Set();
  const watchers = new Map();
  const changed = new Set();
  let timer, running = false, again = false, errors = startupError ? [startupError] : [], findings = [];
  const send = () => {
    const payload = `data: ${JSON.stringify({ errors, findings, stamp: Date.now() })}\n\n`;
    for (const client of clients) client.write(payload);
  };
  const queue = (file) => {
    changed.add(file);
    clearTimeout(timer);
    timer = setTimeout(rebuild, 250);
  };
  const watchDir = (dir, prefix, accept) => {
    if (watchers.has(dir) || !existsSync(dir)) return;
    try {
      watchers.set(dir, watchFs(dir, { recursive: !!prefix }, (event, file) => {
        const name = file?.toString();
        if (!name || !accept(name)) return;
        queue(prefix + name.replace(/\\/g, '/'));
      }));
    } catch (e) { console.error(`Watch: ${dir}: ${e.message}`); }
  };
  const attach = () => {
    watchDir(projectDir, '', (f) => ['deck.md', 'slides.json'].includes(f));
    for (const [dir, accept] of [
      ['diagrams', (f) => f.endsWith('.d2')],
      ['charts', (f) => /\.(json|csv|xlsx)$/i.test(f)],
      ['data', (f) => /\.(csv|xlsx)$/i.test(f)],
      ['images', () => true],
      ['illustrations', (f) => f.endsWith('.svg')],
    ]) watchDir(path.join(projectDir, dir), `${dir}/`, accept);
    const styleDir = existsSync(path.join(projectDir, 'styles', cfg.style))
      ? path.join(projectDir, 'styles', cfg.style) : path.join(SKILL_DIR, 'styles', cfg.style);
    watchDir(styleDir, 'styles/', () => true);
  };
  const rebuild = async () => {
    if (running) { again = true; return; }
    running = true;
    const batch = [...changed];
    changed.clear();
    try {
      cfg = await loadConfig(projectDir, { style: args.style, scheme: args.scheme, out: args.out, density: args.density, page: args.page });
      attach();
      const buildArgs = [path.join(SKILL_DIR, 'scripts', 'build.mjs'), projectDir, '--preview'];
      for (const key of ['style', 'scheme', 'out', 'density', 'page']) if (args[key]) buildArgs.push(`--${key}`, String(args[key]));
      if (batch.length) buildArgs.push('--changed', batch.join('|'));
      const output = await new Promise((resolve) => {
        const child = spawn(process.execPath, buildArgs, { cwd: SKILL_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '', stderr = '';
        child.stdout.on('data', (b) => { stdout += b; });
        child.stderr.on('data', (b) => { stderr += b; });
        child.on('error', (e) => resolve({ code: 1, stdout, stderr: e.message }));
        child.on('close', (code) => resolve({ code, stdout, stderr }));
      });
      if (output.stdout.trim()) console.log(output.stdout.trim());
      errors = output.code ? [output.stderr.trim() || 'Build failed. Check the terminal.'] : [];
      if (output.stderr.trim()) console.error(output.stderr.trim());
      try {
        const style = await loadStyle(cfg.style, projectDir);
        const lint = await runLint(cfg, resolveTokens(style, cfg.scheme, cfg.overrides));
        findings = [...lint.globalIssues, ...lint.slideIssues];
      } catch (e) { findings = []; errors.push(e.message); }
      send();
    } catch (e) { errors = [e.message]; send(); console.error(e); }
    finally {
      running = false;
      if (again || changed.size) { again = false; clearTimeout(timer); timer = setTimeout(rebuild, 250); }
    }
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/__events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      clients.add(res);
      res.write(`data: ${JSON.stringify({ errors, findings, stamp: Date.now() })}\n\n`);
      req.on('close', () => clients.delete(res));
      return;
    }
    const rel = url.pathname === '/' ? 'inspect.html' : decodeURIComponent(url.pathname.slice(1));
    const file = path.resolve(cfg.outDir, rel);
    if (!file.startsWith(cfg.outDir + path.sep) || !existsSync(file)) {
      if (rel !== 'inspect.html') { res.writeHead(404); res.end('Not found'); return; }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(inject('<main><h1>Building preview…</h1></main>'));
      return;
    }
    try {
      let data = await readFile(file);
      if (rel === 'inspect.html') data = Buffer.from(inject(data.toString()));
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    } catch (e) { res.writeHead(500); res.end(e.message); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  console.log(`Preview: http://127.0.0.1:${server.address().port}/`);
  attach();
  await rebuild();
  process.on('SIGINT', () => { for (const w of watchers.values()) w.close(); server.close(); process.exit(); });
}

function inject(html) {
  const client = `<style id="__preview_style">#__preview_panel{position:fixed;bottom:1rem;right:1rem;max-width:min(32rem,85vw);max-height:40vh;overflow:auto;z-index:999999;background:Canvas;color:CanvasText;border:1px solid currentColor;padding:.7rem;font:14px system-ui;box-shadow:0 2px 12px ButtonShadow}#__preview_panel:empty{display:none}#__preview_panel p{margin:.3rem 0}</style>
<aside id="__preview_panel" aria-live="polite"></aside><script>
let first=true;const panel=document.getElementById('__preview_panel');
new EventSource('/__events').onmessage=(event)=>{const state=JSON.parse(event.data);if(!first&&!state.errors.length)location.reload();first=false;panel.replaceChildren();for(const message of state.errors){const p=document.createElement('p');p.textContent='Build: '+message;panel.append(p)}for(const issue of state.findings){const p=document.createElement('p');p.textContent=(issue.slide?'Slide '+issue.slide:issue.file||'Deck')+' · '+issue.severity+': '+issue.message;panel.append(p)}};
</script>`;
  return html.includes('</body>') ? html.replace('</body>', `${client}</body>`) : html + client;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const project = parseArgs(args)._[0] || '.';
  await watch(path.resolve(project), args.filter((a) => a !== project));
}
