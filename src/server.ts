import 'dotenv/config';
import express from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ChatRequest, type Catalog, type ContextType, IDENTITY_ANSWER, isIdentityOrGreeting } from './shared.js';
import { prepareEvidence, localAnswer } from './engine.js';
import { Budget } from './budget.js';
import { answerWithGemini, config } from './gemini.js';

const root = process.cwd();
const cat = JSON.parse(readFileSync(resolve(root, 'data/prepared/catalog.json'), 'utf8')) as Catalog;
const app = express();
const settings = config();

let budget: Budget | undefined;
try {
  budget = new Budget(resolve(process.env.BUDGET_DB_PATH || 'runtime/accounting.sqlite'));
} catch {
  console.warn('Persistent accounting unavailable. Paid requests disabled.');
}

const sessions = new Map<string, { context: ContextType; updated: number }>();
const fallbackLimits = new Map<string, { count: number; at: number }>();

app.disable('x-powered-by');
app.use(express.json({ limit: '12kb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  if (req.method === 'POST' && req.headers.origin && req.headers.origin !== `${req.protocol}://${req.get('host')}`) {
    return res.status(403).json({ error: 'Cross-origin requests are not allowed.' });
  }
  next();
});

app.post('/api/chat', async (req, res) => {
  const parsed = ChatRequest.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid question, session or context.' });
  }
  const r = parsed.data;

  try {
    if (budget) {
      budget.limit(r.sessionId, req.ip || 'local', Number(process.env.SESSION_REQUEST_LIMIT || 100), Number(process.env.REQUESTS_PER_MINUTE || 12));
    } else {
      let key = req.ip || 'local';
      let v = fallbackLimits.get(key);
      if (!v || Date.now() - v.at > 60000) v = { count: 0, at: Date.now() };
      if (++v.count > 12) throw Error('Request limit reached.');
      fallbackLimits.set(key, v);
    }
  } catch {
    return res.status(429).json({ error: 'Request limit reached. Please pause before asking again.' });
  }

  try {
    const remembered = sessions.get(r.sessionId);
    const memory = remembered && Date.now() - remembered.updated < 3600000 ? remembered.context : undefined;
    const e = prepareEvidence(cat, r.question, r.context, memory);
    sessions.set(r.sessionId, { context: e.context, updated: Date.now() });

    if (sessions.size > 2000) {
      for (const [k, v] of sessions) {
        if (Date.now() - v.updated > 3600000) sessions.delete(k);
      }
    }

    const answer = budget && settings.key
      ? await answerWithGemini(e, r.sessionId, budget, settings)
      : {
          mode: 'gemini',
          answer: 'Unable to connect to Gemini research assistant (API key or accounting service unavailable). Please check configuration.',
          facts: [],
          citations: e.citations,
          limitations: ['Gemini service unavailable.'],
          followups: ['Try asking again later.'],
          context: e.context,
          notice: 'Gemini Configuration Error'
        };

    res.json(answer);
  } catch {
    res.status(500).json({ error: 'The analysis could not be completed. No unsupported answer was generated.' });
  }
});

app.get('/api/status', (_req, res) => {
  const mode = settings.key && settings.paid && settings.persistent && budget
    ? 'model-paid'
    : settings.key && budget
    ? 'model-free'
    : 'local';
  res.json({
    mode,
    model: settings.model,
    fallbackModel: settings.fallbackModel,
    geminiConfigured: Boolean(settings.key),
    freeTierActive: Boolean(settings.key && !settings.paid),
    paidActive: Boolean(settings.paid),
    datasetVersion: cat.version
  });
});

app.get('/api/budget', (req, res) => {
  if (!process.env.DEVELOPER_STATUS_TOKEN || req.get('Authorization') !== `Bearer ${process.env.DEVELOPER_STATUS_TOKEN}`) {
    return res.sendStatus(403);
  }
  res.json(budget?.status(settings.total, settings.dev) || { paidDisabled: true });
});

app.get('/api/record/:id', (req, res) => {
  const row = cat.records.find(r => r.id === req.params.id);
  if (!row) return res.status(404).json({ error: 'Unknown record' });
  res.json(row);
});

app.use(express.static(resolve(root, 'dist')));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) =>
  res.status(400).json({ error: 'Malformed request.' })
);

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
app.listen(port, host, () =>
  console.log(`FireTrace running at http://${host}:${port} · ${settings.paid && settings.key ? `Gemini (${settings.model}) active` : 'local deterministic analysis active'}`)
);
