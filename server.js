const express = require('express');
const { OpenAI } = require('openai');

const app = express();
app.use(express.json());

const PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>AI Model Tester (Node.js)</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-50 text-slate-900 antialiased min-h-screen p-6">
  <div class="max-w-4xl mx-auto space-y-6">

    <!-- Card Config -->
    <div class="rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm p-6 space-y-4">
      <div>
        <h3 class="font-semibold leading-none tracking-tight text-xl">AI Model Tester </h3>
        <p class="text-sm text-slate-500 mt-1">Check endpoints, API keys, and model availability in real-time.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-2">
          <label class="text-sm font-medium leading-none">Base URL</label>
          <input id="url" type="text" class="flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950" value=""/>
        </div>
        <div class="space-y-2">
          <label class="text-sm font-medium leading-none">API Key</label>
          <input id="key" type="password" class="flex h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950" value=""/>
        </div>
      </div>

      <div class="flex gap-2 pt-2">
        <button id="btnLoad" onclick="loadModels()" class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 h-9 px-4 py-2 bg-slate-900 text-slate-50 shadow hover:bg-slate-900/90">
          Load Models
        </button>
        <button id="btnTest" onclick="testAll()" disabled class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 h-9 px-4 py-2 bg-slate-100 text-slate-900 shadow-sm hover:bg-slate-200 disabled:opacity-50 disabled:pointer-events-none">
          Test All Models
        </button>
      </div>

      <div id="err" class="hidden rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200"></div>
    </div>

    <!-- Models List Card -->
    <div class="rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm p-6 space-y-4">
      <div class="flex items-center justify-between border-b pb-4">
        <div>
          <h4 class="font-semibold leading-none tracking-tight">Models (<span id="count">0</span>)</h4>
          <div id="summary" class="hidden flex gap-3 text-xs mt-2">
            <span class="text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">Work: <b id="totWork">0</b></span>
            <span class="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Limit: <b id="totLimit">0</b></span>
            <span class="text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">Fail: <b id="totFail">0</b></span>
          </div>
        </div>
        <span id="loader" class="hidden text-sm text-slate-500 animate-pulse">Loading...</span>
      </div>

      <div id="empty" class="text-center py-8 text-sm text-slate-500">No models loaded. Click "Load Models" above.</div>
      <div id="models" class="space-y-6"></div>
    </div>

  </div>

  <script>
    let MODELS = [];
    let STATUS = {};
    const $ = id => document.getElementById(id);
    const safeId = s => btoa(unescape(encodeURIComponent(s))).replace(/[^a-zA-Z0-9]/g, '');

    function getProvider(m) {
      return m.includes('/') ? m.split('/')[0] : 'Other';
    }

    function updateSummary() {
      let w = 0, l = 0, f = 0;
      Object.values(STATUS).forEach(s => {
        if (s === 'ok') w++;
        else if (s === 'limit') l++;
        else if (s === 'fail') f++;
      });
      $('totWork').textContent = w;
      $('totLimit').textContent = l;
      $('totFail').textContent = f;
      $('summary').classList.remove('hidden');
    }

    async function loadModels() {
      $('err').classList.add('hidden');
      $('btnTest').disabled = true;
      $('loader').classList.remove('hidden');
      $('models').innerHTML = '';
      $('empty').classList.remove('hidden');
      $('empty').textContent = 'Fetching models...';
      STATUS = {};
      $('summary').classList.add('hidden');

      try {
        const res = await fetch('/api/models', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({url: $('url').value, key: $('key').value})
        });
        const d = await res.json();
        $('loader').classList.add('hidden');

        if (d.error) {
          $('err').textContent = d.error;
          $('err').classList.remove('hidden');
          $('empty').textContent = 'Failed to load models.';
          return;
        }

        MODELS = d.models || [];
        $('count').textContent = MODELS.length;

        if (!MODELS.length) {
          $('empty').textContent = 'No models found for this endpoint.';
          return;
        }

        $('empty').classList.add('hidden');

        const groups = {};
        MODELS.forEach(m => {
          const p = getProvider(m);
          if (!groups[p]) groups[p] = [];
          groups[p].push(m);
        });

        $('models').innerHTML = Object.keys(groups).map(p => {
          const list = groups[p].map(m => {
            const sid = safeId(m);
            return \`<div class="flex items-center justify-between py-2 text-sm">
              <div class="flex items-center gap-2">
                <span class="font-mono text-slate-700">\${m}</span>
                <button onclick="copyId('\${m}', this)" class="text-xs text-slate-400 hover:text-slate-700 border border-slate-200 rounded px-1.5 py-0.5 transition-colors">Copy</button>
              </div>
              <div id="st-\${sid}" class="flex items-center gap-2">
                <span class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">Untested</span>
                <button onclick="testCompat('\${m}')" id="cmp-\${sid}" class="ml-1 inline-flex items-center rounded-md text-xs font-medium h-7 px-2 bg-slate-100 text-slate-900 hover:bg-slate-200">Compat</button>
              </div>
            </div>\`;
          }).join('');

          return \`<div class="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-2">
            <div class="flex items-center justify-between border-b pb-2 border-slate-200">
              <h5 class="font-bold text-sm text-slate-800 uppercase tracking-wider">\${p} (\${groups[p].length})</h5>
            </div>
            <div class="divide-y divide-slate-100 bg-white rounded-md p-2 border border-slate-100">\${list}</div>
          </div>\`;
        }).join('');

        $('btnTest').disabled = false;
      } catch(e) {
        $('loader').classList.add('hidden');
        $('err').textContent = 'Network error standard fetch failed.';
        $('err').classList.remove('hidden');
      }
    }

    async function copyId(id, btn) {
      await navigator.clipboard.writeText(id);
      const prev = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('bg-green-50', 'text-green-600', 'border-green-200');
      setTimeout(() => {
        btn.textContent = prev;
        btn.classList.remove('bg-green-50', 'text-green-600', 'border-green-200');
      }, 1500);
    }

    async function testOne(m) {
      const sid = safeId(m);
      const target = $('st-' + sid);
      if (!target) return;

      target.innerHTML = \`<span class="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 animate-pulse">Testing...</span>\`;
      const t0 = performance.now();

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({url: $('url').value, key: $('key').value, model: m})
        });
        const d = await res.json();
        const ms = Math.round(performance.now() - t0);
        const cmp = \`<button onclick="testCompat('\${m}')" id="cmp-\${sid}" class="ml-1 inline-flex items-center rounded-md text-xs font-medium h-7 px-2 bg-slate-100 text-slate-900 hover:bg-slate-200">Compat</button>\`;

        if (ms > 4000) {
          STATUS[m] = 'fail';
          target.innerHTML = \`<span class="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 border border-red-200" title="Latency > 4000ms">Failed (Timeout)</span> <span class="text-xs text-slate-400 font-mono">\${ms}ms</span>\${cmp}\`;
        } else if (d.error) {
          STATUS[m] = 'fail';
          target.innerHTML = \`<span class="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 border border-red-200" title="\${d.error}">Failed</span> <span class="text-xs text-slate-400 font-mono">\${ms}ms</span>\${cmp}\`;
        } else if (d.reply && d.reply.includes("prevent abuse of free resources")) {
          STATUS[m] = 'limit';
          target.innerHTML = \`<span class="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200" title="\${d.reply}">Limit Exceeded</span> <span class="text-xs text-slate-400 font-mono">\${ms}ms</span>\${cmp}\`;
        } else {
          STATUS[m] = 'ok';
          target.innerHTML = \`<span class="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 border border-green-200">Work (OK)</span> <span class="text-xs text-slate-400 font-mono">\${ms}ms</span>\${cmp}\`;
        }
        updateSummary();
      } catch(e) {
        STATUS[m] = 'fail';
        target.innerHTML = \`<span class="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">Error</span>\`;
        updateSummary();
      }
    }

    async function testAll() {
      $('btnTest').disabled = true;
      const CONCURRENCY = 5;
      for (let i = 0; i < MODELS.length; i += CONCURRENCY) {
        const batch = MODELS.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(m => testOne(m)));
      }
      $('btnTest').disabled = false;
    }

    const FEATS = ["chat", "tools", "json", "stream", "vision"];
    const LABEL = {chat: "Chat", tools: "Tools", json: "JSON", stream: "Stream", vision: "Vision"};

    async function testCompat(m) {
      const sid = safeId(m);
      const btn = $('cmp-' + sid);
      if (btn) { btn.disabled = true; btn.textContent = 'Testing...'; }
      try {
        const res = await fetch('/api/compat', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({url: $('url').value, key: $('key').value, model: m, features: FEATS})
        });
        const d = await res.json();
        const r = d.result || {};
        const chips = FEATS.map(f => {
          const s = r[f] || 'fail';
          const cls = s === 'ok' ? 'bg-green-50 text-green-700 border-green-200'
                    : s === 'limit' ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-red-50 text-red-700 border-red-200';
          return \`<span class="inline-flex items-center rounded-full \${cls} border px-2 py-0.5 text-[10px] font-semibold">\${LABEL[f]}: \${s.toUpperCase()}</span>\`;
        }).join('');
        const target = $('st-' + sid);
        if (target) target.innerHTML = chips;
      } catch(e) {
        const target = $('st-' + sid);
        if (target) target.innerHTML = \`<span class="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 border border-red-200">Error</span>\`;
      }
    }
  </script>
</body>
</html>`;

app.get('/', (req, res) => res.send(PAGE));

app.post('/api/models', async (req, res) => {
  const { url, key } = req.body;
  try {
    const client = new OpenAI({ apiKey: key, baseURL: url });
    const list = await client.models.list();
    const models = [];
    for await (const m of list) models.push(m.id);
    res.json({ models });
  } catch (e) {
    res.json({ error: `${e.name}: ${e.message}` });
  }
});

app.post('/api/chat', async (req, res) => {
  const { url, key, model } = req.body;
  try {
    const client = new OpenAI({ apiKey: key, baseURL: url, timeout: 4000 });
    const resp = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      max_tokens: 5,
    });
    res.json({ reply: resp.choices[0]?.message?.content || '' });
  } catch (e) {
    res.json({ error: `${e.name}: ${e.message}` });
  }
});

const LIMIT_HINT = 'prevent abuse of free resources';

app.post('/api/compat', async (req, res) => {
  const { url, key, model } = req.body;
  const client = new OpenAI({ apiKey: key, baseURL: url, timeout: 5000 });
  const out = {};

  try {
    const r = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Call the function f.' }],
      tools: [{ type: 'function', function: { name: 'f', parameters: { type: 'object', properties: {} } } }],
      response_format: { type: 'json_object' },
      max_tokens: 32,
    });
    const content = r.choices[0]?.message?.content || '';
    if (content.includes(LIMIT_HINT)) {
      out.chat = 'limit'; out.tools = 'limit'; out.json = 'limit';
    } else {
      out.chat = 'ok';
      out.tools = (r.choices[0]?.message?.tool_calls?.length || content.toLowerCase().includes('f')) ? 'ok' : 'fail';
      out.json = content.trim().startsWith('{') ? 'ok' : 'fail';
    }
  } catch (e) {
    const st = e.message?.includes(LIMIT_HINT) ? 'limit' : 'fail';
    out.chat = st; out.tools = st; out.json = st;
  }

  try {
    const stream = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 5,
      stream: true,
    });
    let hasChunks = false;
    for await (const chunk of stream) { hasChunks = true; break; }
    out.stream = hasChunks ? 'ok' : 'fail';
  } catch (e) {
    out.stream = e.message?.includes(LIMIT_HINT) ? 'limit' : 'fail';
  }

  try {
    const r = await client.chat.completions.create({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Describe in one word.' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC' } }
        ]
      }],
      max_tokens: 5,
    });
    const content = r.choices[0]?.message?.content || '';
    out.vision = content.includes(LIMIT_HINT) ? 'limit' : 'ok';
  } catch (e) {
    out.vision = e.message?.includes(LIMIT_HINT) ? 'limit' : 'fail';
  }

  res.json({ result: out });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
