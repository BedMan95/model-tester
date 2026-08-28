const express = require('express');
const path = require('path');
const { OpenAI } = require('openai');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Non-OpenAI API handlers (Anthropic, Gemini)
async function handleAnthropicModels(key) {
  return ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'];
}

async function handleGeminiModels(key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.models || []).map(m => m.name.replace('models/', ''));
}

app.post('/api/models', async (req, res) => {
  const { url, key, preset } = req.body;
  try {
    if (preset === 'anthropic' || url?.includes('anthropic.com')) {
      const models = await handleAnthropicModels(key);
      return res.json({ models });
    }
    if (preset === 'gemini' || url?.includes('generativelanguage.googleapis.com')) {
      const models = await handleGeminiModels(key);
      return res.json({ models });
    }

    const client = new OpenAI({ apiKey: key || 'dummy', baseURL: url });
    const list = await client.models.list();
    const models = [];
    for await (const m of list) {
      models.push(typeof m === 'string' ? m : (m.id || m.toString()));
    }
    res.json({ models });
  } catch (e) {
    res.json({ error: `${e.name}: ${e.message}` });
  }
});

app.post('/api/chat', async (req, res) => {
  const { url, key, preset, model, sysPrompt, userPrompt, temp, topP, maxTokens, timeoutMs, stream: isClientStream } = req.body;
  const t0 = Date.now();
  let ttft = 0;
  const timeout = timeoutMs || 30000;
  const tokenCap = maxTokens || 2048;

  if (isClientStream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
  }

  try {
    // Anthropic Native Handler
    if (preset === 'anthropic' || url?.includes('anthropic.com')) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: req.body.messages ? req.body.messages.filter(m => m.role !== 'system') : [{ role: 'user', content: userPrompt || 'OK' }],
          max_tokens: tokenCap
        }),
        signal: controller.signal
      });
      clearTimeout(timer);
      const data = await response.json();
      const latency = Date.now() - t0;
      const text = data.content?.[0]?.text || data.error?.message || '';
      const tokens = text.split(/\s+/).length;
      const tps = (tokens / (latency / 1000)).toFixed(1);

      if (isClientStream) {
        res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true, reply: text, metrics: { ttft: Math.round(latency * 0.4), latency, tps, tokens } })}\n\n`);
        return res.end();
      }
      return res.json({ reply: text, metrics: { ttft: Math.round(latency * 0.4), latency, tps, tokens } });
    }

    // Standard OpenAI API Handler
    const client = new OpenAI({ apiKey: key || 'dummy', baseURL: url, timeout });
    const formattedMessages = req.body.messages || [
      { role: 'system', content: sysPrompt || 'You are a helpful assistant.' },
      { role: 'user', content: userPrompt || 'Reply with exactly: OK' }
    ];

    const stream = await client.chat.completions.create({
      model,
      messages: formattedMessages,
      temperature: temp ?? 0.7,
      top_p: topP ?? 1.0,
      max_tokens: tokenCap,
      stream: true
    });

    let reply = '';
    let firstChunk = true;

    for await (const chunk of stream) {
      if (firstChunk) {
        ttft = Date.now() - t0;
        firstChunk = false;
      }
      const content = chunk.choices[0]?.delta?.content || '';
      reply += content;

      if (isClientStream && content) {
        res.write(`data: ${JSON.stringify({ chunk: content })}\n\n`);
      }
    }

    const latency = Date.now() - t0;
    const tokenCount = reply.split(/\s+/).length || 1;
    const tps = (tokenCount / (latency / 1000)).toFixed(1);

    if (isClientStream) {
      res.write(`data: ${JSON.stringify({ done: true, reply, metrics: { ttft: ttft || latency, latency, tps, tokens: tokenCount } })}\n\n`);
      return res.end();
    }

    res.json({ reply, metrics: { ttft: ttft || latency, latency, tps, tokens: tokenCount } });
  } catch (e) {
    if (isClientStream) {
      res.write(`data: ${JSON.stringify({ done: true, error: `${e.name}: ${e.message}` })}\n\n`);
      return res.end();
    }
    res.json({ error: `${e.name}: ${e.message}` });
  }
});

const LIMIT_HINT = [
  'prevent abuse of free resources',
  'limit exceeded',
  'rate limit exceeded',
  'rate_limit_exceeded',
  'insufficient quota',
  'quota exceeded',
  '429',
  'requests per minute',
  'tokens per minute',
  'unlock',
  'add credits',
];

app.post('/api/compat', async (req, res) => {
  const { url, key, model } = req.body;
  const client = new OpenAI({ apiKey: key || 'dummy', baseURL: url, timeout: 5000 });
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
    if (LIMIT_HINT.some(h => content.includes(h))) {
      out.chat = 'limit'; out.tools = 'limit'; out.json = 'limit';
    } else {
      out.chat = 'ok';
      out.tools = (r.choices[0]?.message?.tool_calls?.length || content.toLowerCase().includes('f')) ? 'ok' : 'fail';
      out.json = content.trim().startsWith('{') ? 'ok' : 'fail';
    }
  } catch (e) {
    const st = LIMIT_HINT.some(h => e.message?.includes(h)) ? 'limit' : 'fail';
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
    out.stream = LIMIT_HINT.some(h => e.message?.includes(h)) ? 'limit' : 'fail';
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
    out.vision = LIMIT_HINT.some(h => content.includes(h)) ? 'limit' : 'ok';
  } catch (e) {
    out.vision = LIMIT_HINT.some(h => e.message?.includes(h)) ? 'limit' : 'fail';
  }

  res.json({ result: out });
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
