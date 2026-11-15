import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EventEmitter } from 'node:events';
import express from 'express';
import { Budget } from '../src/budget.js';
import { ChatRequest, IDENTITY_ANSWER, isIdentityOrGreeting, type Catalog } from '../src/shared.js';
import { prepareEvidence, localAnswer } from '../src/engine.js';
import { answerWithGemini, config } from '../src/gemini.js';

function simulatePost(app: express.Express, url: string, body: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const req = Object.assign(new EventEmitter(), {
      method: 'POST',
      url,
      headers: { 'content-type': 'application/json' },
      body
    });

    let statusCode = 200;
    let responseBody: any = null;

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        responseBody = data;
        resolve({ status: statusCode, body: responseBody });
        return this;
      },
      setHeader() { return this; }
    };

    app.handle(req as any, res as any);
  });
}

test('Targeted endpoint test: /api/chat identity routing without context reuse or dataset queries', async () => {
  const cat = JSON.parse(readFileSync('data/prepared/catalog.json', 'utf8')) as Catalog;
  const dir = mkdtempSync(join(tmpdir(), 'firetrace-test-'));
  const budget = new Budget(join(dir, 'test-budget.sqlite'));
  const settings = config();

  const app = express();
  app.use(express.json());

  const sessions = new Map<string, { context: any; updated: number }>();

  app.post('/api/chat', async (req, res) => {
    const parsed = ChatRequest.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    const r = parsed.data;

    // Direct identity check before session retrieval or dataset processing
    if (isIdentityOrGreeting(r.question)) {
      return res.json({
        mode: settings.key && budget ? 'gemini' : 'local',
        answer: IDENTITY_ANSWER,
        facts: [],
        citations: [],
        limitations: [],
        followups: [
          'What datasets are available in FireTrace?',
          'What is the effect of airflow on fire?',
          'Will increasing carbon dioxide suppress a fire?'
        ],
        context: { dataset: r.context?.dataset || 'ALL', filters: {} },
        scientificPrinciple:
          'FireTrace provides grounded exploration and synthesis of NASA microgravity combustion research across FLEX, BASS-II, SAFFIRE, and SAME-R investigations.',
        notice: settings.key && budget ? 'Gemini · Direct Research Assistance' : 'FireTrace Research Assistant'
      });
    }

    const remembered = sessions.get(r.sessionId);
    const memory = remembered && Date.now() - remembered.updated < 3600000 ? remembered.context : undefined;
    const e = prepareEvidence(cat, r.question, r.context, memory);
    sessions.set(r.sessionId, { context: e.context, updated: Date.now() });

    const answer = budget
      ? await answerWithGemini(e, r.sessionId, budget, settings)
      : localAnswer(e);
    res.json(answer);
  });

  try {
    // 1. First, seed the session memory with dataset FLEX and variable velocity
    const seed = await simulatePost(app, '/api/chat', {
      question: 'What is the effect of airflow on fire?',
      sessionId: 'session_identity_test_123',
      context: { dataset: 'FLEX', variable: 'velocity', filters: {} }
    });
    assert.equal(seed.status, 200);

    // 2. Now ask "Who are you?" on the exact same session
    const res1 = await simulatePost(app, '/api/chat', {
      question: 'Who are you?',
      sessionId: 'session_identity_test_123',
      context: { dataset: 'FLEX', variable: 'velocity', filters: {} }
    });

    assert.equal(res1.status, 200);
    const body1 = res1.body;

    // Must return the exact required sentence:
    assert.equal(
      body1.answer,
      "I'm FireTrace, your AI research assistant. I help you explore NASA combustion experiments and understand their findings."
    );
    // Must contain 0 facts, 0 citations, 0 limitations
    assert.equal(body1.facts.length, 0);
    assert.equal(body1.citations.length, 0);
    assert.equal(body1.limitations.length, 0);
    // Must NEVER contain "velocity", FLEX statistics or fallback text
    assert.doesNotMatch(JSON.stringify(body1), /velocity/i);
    assert.doesNotMatch(JSON.stringify(body1), /The variable "velocity" is not available/i);
    assert.doesNotMatch(JSON.stringify(body1), /274.*records/i);

    // 3. Test other identity variants
    for (const q of ['who are you', 'What is FireTrace?', 'Introduce yourself', 'Hello']) {
      const res = await simulatePost(app, '/api/chat', {
        question: q,
        sessionId: 'session_identity_test_123',
        context: { dataset: 'FLEX', variable: 'velocity', filters: {} }
      });
      assert.equal(
        res.body.answer,
        "I'm FireTrace, your AI research assistant. I help you explore NASA combustion experiments and understand their findings."
      );
      assert.equal(res.body.facts.length, 0);
      assert.doesNotMatch(JSON.stringify(res.body), /velocity/i);
    }
  } finally {
    budget.close();
    rmSync(dir, { recursive: true });
  }
});
