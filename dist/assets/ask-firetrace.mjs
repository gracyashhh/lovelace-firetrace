import { prepareEvidence, localAnswer } from '../assistant/engine.js';

const element = (tag, text, cls) => {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  if (cls) e.className = cls;
  return e;
};

const launch = element('button', '✦ Ask FireTrace');
launch.id = 'ask-launch';
launch.setAttribute('aria-haspopup', 'dialog');
launch.setAttribute('aria-expanded', 'false');
document.body.append(launch);

const drawer = element('section');
drawer.id = 'ask-drawer';
drawer.hidden = true;
drawer.setAttribute('role', 'dialog');
drawer.setAttribute('aria-modal', 'true');
drawer.setAttribute('aria-labelledby', 'ask-title');
drawer.innerHTML = `
  <header>
    <div class="ask-heading">
      <h2 id="ask-title">Ask FireTrace</h2>
      <small>Grounded NASA Combustion Research Assistant</small>
    </div>
    <button class="ask-close" aria-label="Close research assistant">×</button>
  </header>
  <div id="ask-context">
    <label>Research Scope
      <select id="ask-dataset">
        <option value="ALL" selected>All Investigations (Auto-detect)</option>
        <option value="FLEX">FLEX (Liquid Droplets)</option>
        <option value="BASS-II">BASS-II (Solid Materials)</option>
        <option value="SAFFIRE">SAFFIRE (Large-Scale Spacecraft)</option>
        <option value="SAME-R">SAME-R (Smoke & Aerosols)</option>
      </select>
    </label>
    <span id="ask-selected">All 4 NASA investigations</span>
  </div>
  <div id="ask-messages" role="log" aria-live="polite" aria-relevant="additions"></div>
  <form id="ask-compose">
    <div id="ask-suggestions"></div>
    <label for="ask-question">Your research question</label>
    <textarea id="ask-question" maxlength="1200" rows="2" placeholder="Ask about airflow, CO2 suppression, oxygen, materials or NASA data..." required></textarea>
    <div id="ask-loading" role="status"></div>
    <div id="ask-actions">
      <button type="button" id="ask-reset">Reset conversation</button>
      <button type="submit" id="ask-send">Ask →</button>
    </div>
  </form>
`;
document.body.append(drawer);

const $ = s => drawer.querySelector(s);
let catalog;
let context = { dataset: 'ALL', filters: {} };
let lastSelected;
let lastUiToken;
let session = crypto.randomUUID();
let busy = false;
let answers = [];
let opener;

const load = fetch('assistant/catalog.json')
  .then(r => {
    if (!r.ok) throw Error('Prepared data unavailable');
    return r.json();
  })
  .then(c => { catalog = c; });

const suggestions = questions => {
  $('#ask-suggestions').replaceChildren(
    ...questions.slice(0, 3).map(q => {
      const b = element('button', q);
      b.type = 'button';
      b.onclick = () => {
        $('#ask-question').value = q;
        $('#ask-compose').requestSubmit();
      };
      return b;
    })
  );
};

function readContext() {
  const mode = document.querySelector('#mode')?.value;
  const selected = document.querySelector('#case')?.value;
  const filters = {};
  if (location.hash === '#explorer') {
    for (const key of ['fuel', 'pressure', 'oxygen', 'co2', 'helium', 'diameter', 'test_end']) {
      const v = document.querySelector('#filter-' + key)?.value;
      if (v) filters[key] = v;
    }
  }

  const x = window.firetraceAssistantContext?.() || {
    dataset: context.dataset || 'ALL',
    experimentId: mode === 'predict' ? undefined : selected,
    filters,
    uiToken: location.hash + ':' + mode + ':' + selected + ':' + JSON.stringify(filters)
  };

  if (x.uiToken && x.uiToken !== lastUiToken) {
    if (['ALL', 'FLEX', 'BASS-II', 'SAFFIRE', 'SAME-R'].includes(x.dataset)) {
      context.dataset = x.dataset;
    }
    context.filters = x.filters || {};
    if (!x.experimentId) delete context.experimentId;
  }
  lastUiToken = x.uiToken;

  if (context.dataset === 'FLEX' && x.experimentId && x.experimentId !== lastSelected) {
    context.previousExperimentId = context.experimentId;
    context.experimentId = String(x.experimentId);
    lastSelected = x.experimentId;
    context.filters = x.filters || {};
    delete context.variable;
  }

  $('#ask-dataset').value = context.dataset;
  $('#ask-selected').textContent =
    context.dataset === 'ALL'
      ? 'All 4 NASA investigations'
      : context.dataset === 'FLEX' && context.experimentId
      ? `Selected test ${context.experimentId}`
      : 'Prepared local records';
}

function open() {
  opener = document.activeElement;
  readContext();
  drawer.hidden = false;
  launch.setAttribute('aria-expanded', 'true');
  document.body.classList.add('ask-open');
  $('#ask-question').focus();
}

function close() {
  drawer.hidden = true;
  launch.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('ask-open');
  (opener || launch).focus();
}

launch.onclick = open;
$('.ask-close').onclick = close;

drawer.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    e.preventDefault();
    close();
  }
  if (e.key === 'Tab') {
    const nodes = [...drawer.querySelectorAll('button,select,textarea,a,summary')].filter(
      x => !x.disabled && x.getClientRects().length
    );
    const first = nodes[0];
    const last = nodes.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});

$('#ask-question').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    $('#ask-compose').requestSubmit();
  }
});

$('#ask-dataset').onchange = () => {
  context = { dataset: $('#ask-dataset').value, filters: {} };
  $('#ask-selected').textContent =
    context.dataset === 'ALL'
      ? 'All 4 NASA investigations'
      : context.dataset === 'FLEX' && context.experimentId
      ? `Selected test ${context.experimentId}`
      : 'Prepared local records';

  suggestions(
    context.dataset === 'ALL'
      ? ['What is the effect of airflow on fire?', 'Will increasing carbon dioxide suppress a fire?', 'What can these 4 investigations tell us about fire safety?']
      : context.dataset === 'FLEX'
      ? ['Summarise recorded outcomes', 'How does oxygen relate to burning rate?', 'Compare methanol and heptane in FLEX']
      : context.dataset === 'BASS-II'
      ? ['What materials were tested in BASS-II?', 'What is the effect of airflow on solid burning?', 'Summarise oxygen by material']
      : context.dataset === 'SAFFIRE'
      ? ['What does SAFFIRE tell us about spacecraft fires?', 'What measurements are available?', 'Summarise oxygen telemetry']
      : ['Why is smoke detection important in space?', 'What did SAME-R measure?', 'Summarise particle diameter']
  );
};

function renderAnswer(a) {
  const article = element('article');

  const copy = element('button', 'Copy Answer', 'ask-copy-btn');
  copy.type = 'button';
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(
        [
          a.answer,
          a.scientificPrinciple ? 'Principle: ' + a.scientificPrinciple : '',
          ...a.facts.map(f => `[${f.category}] ${f.text}`),
          'Limitations:',
          ...a.limitations,
          ...a.citations.map(c => `${c.label}: ${c.url}`)
        ].filter(Boolean).join('\n\n')
      );
      copy.textContent = 'Copied ✓';
      setTimeout(() => { copy.textContent = 'Copy Answer'; }, 2000);
    } catch {
      copy.textContent = 'Select text to copy';
    }
  };
  article.append(copy);

  const isGemini = a.mode === 'gemini' || a.mode === 'model' || a.mode === 'model-free' || a.mode === 'model-paid';
  const badgeLabel = isGemini
    ? (a.notice && a.notice.includes('Free Tier') ? '✦ GEMINI · FREE TIER (GROUNDED NASA EVIDENCE)' : '✦ GEMINI · GROUNDED NASA EVIDENCE')
    : '⚙ LOCAL SCIENTIFIC ENGINE · OFFLINE';
  const badge = element(
    'span',
    badgeLabel,
    isGemini ? 'ask-badge ask-badge-gemini' : 'ask-badge ask-badge-local'
  );
  article.append(badge);

  // Render paragraphs of main answer
  const paragraphs = (a.answer || '').split(/\n\n+/).filter(Boolean);
  if (paragraphs.length) {
    for (const p of paragraphs) {
      article.append(element('p', p));
    }
  } else {
    article.append(element('p', a.answer || 'No answer generated.'));
  }

  // Render scientific principle callout if available
  if (a.scientificPrinciple && !a.answer.includes(a.scientificPrinciple)) {
    const princBox = element('div', '', 'ask-principle');
    const princTitle = element('strong', 'Physics Principle: ');
    princBox.append(princTitle, document.createTextNode(a.scientificPrinciple));
    article.append(princBox);
  }

  // Render expandable facts
  if (a.facts && a.facts.length > 0) {
    const details = element('details', '', 'ask-evidence-details');
    const summary = element('summary', `Detailed NASA Evidence & Calculations (${a.facts.length} items)`);
    details.append(summary);

    for (const f of a.facts) {
      const item = element('div', '', 'ask-fact-item');
      const cat = element('span', f.category, 'ask-fact-cat');
      const text = element('div', f.text);
      item.append(cat, text);
      details.append(item);
    }
    article.append(details);
  }

  // Render scientific limits
  if (a.limitations && a.limitations.length > 0) {
    const details = element('details');
    details.open = true;
    details.append(element('summary', 'Scientific Boundaries & Limitations'));
    for (const l of a.limitations) {
      details.append(element('p', l, 'ask-warning'));
    }
    article.append(details);
  }

  // Render references & links
  if (a.citations && a.citations.length > 0) {
    const refs = element('details');
    refs.append(element('summary', 'NASA Sources & Experiment Records'));
    for (const c of a.citations) {
      const link = element('a', c.label);
      if (
        c.url.startsWith('https://psi.nasa.gov/') ||
        c.url.startsWith('https://ntrs.nasa.gov/') ||
        c.url.startsWith('downloads/') ||
        c.url.startsWith('references/')
      ) {
        link.href = c.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        refs.append(link);
      }
      if (c.dataset === 'FLEX' && c.experimentId) {
        const b = element('button', `Open FLEX test ${c.experimentId}`);
        b.type = 'button';
        b.onclick = () => {
          if (window.firetraceAssistantOpen) {
            window.firetraceAssistantOpen(c.experimentId);
          } else {
            const sel = document.querySelector('#case');
            if (sel) {
              sel.value = c.experimentId;
              sel.dispatchEvent(new Event('change', { bubbles: true }));
              location.hash = 'lab';
            }
          }
          close();
        };
        refs.append(b);
      }
    }
    article.append(refs);
  }

  article.append(element('small', a.notice, 'ask-notice'));

  $('#ask-messages').append(article);
  while ($('#ask-messages').children.length > 40) {
    $('#ask-messages').firstElementChild.remove();
  }
  $('#ask-messages').scrollTop = $('#ask-messages').scrollHeight;

  if (a.followups && a.followups.length > 0) {
    suggestions(a.followups);
  }
}

$('#ask-compose').onsubmit = async e => {
  e.preventDefault();
  if (busy) return;
  const question = $('#ask-question').value.trim();
  if (!question) return;

  busy = true;
  $('#ask-send').disabled = true;
  $('#ask-loading').textContent = 'Analyzing NASA evidence and query context…';
  $('#ask-messages').append(element('article', question, 'user'));
  $('#ask-question').value = '';

  try {
    await load;
    readContext();
    let answer;

    if (/rank|scoring criteria/i.test(question) && typeof window.firetraceResearchRanking === 'function') {
      const ranking = window.firetraceResearchRanking();
      answer = {
        mode: 'local',
        answer: 'These are the original dashboard’s heuristic relevance scores, not scientific risk estimates.',
        facts: ranking.slice(0, 5).map((r, i) => ({
          id: 'rank' + i,
          category: 'FireTrace calculated statistic',
          text: `${String(r.s[0] || r.s.title || r.s.name || r.s.id || 'Investigation')}: relevance score ${r.score}; embedded rows ${r.count}. Components: ${r.parts.map(v => Number(v.toFixed(2))).join(', ')}.`,
          sourceIds: []
        })),
        citations: [],
        limitations: [
          'The original function weights objective relevance 40%, condition similarity 20%, coverage 15%, material match 15%, and data limitations 10%. These are heuristic design choices, not validated scientific importance.',
          'Original embedded subsets differ from the newly ingested full research tables.'
        ],
        followups: ['What datasets are available?', 'Which measurements are available?'],
        context,
        notice: 'Computed by the existing computeRanking function; no model call.'
      };
    } else {
      try {
        const r = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, sessionId: session, context }),
          signal: AbortSignal.timeout(45000)
        });

        if (r.status === 429) {
          throw Object.assign(Error('Request limit reached. Please pause before asking again.'), { limited: true });
        }
        if (!r.ok) throw Error('Backend unavailable');
        answer = await r.json();
      } catch (error) {
        if (error.limited) throw error;
        answer = {
          mode: 'gemini',
          answer: 'Unable to connect to FireTrace backend or Gemini service. Please check your network connection and server status.',
          facts: [],
          citations: [],
          limitations: ['Network or backend connection failed.'],
          followups: ['What datasets are available in FireTrace?', 'How does oxygen affect fire?'],
          context: context || { dataset: 'ALL', filters: {} },
          notice: 'Gemini Connection Error · Backend Offline'
        };
      }
    }

    context = answer.context;
    $('#ask-dataset').value = context.dataset;
    answers.push(answer);
    if (answers.length > 20) answers.shift();
    renderAnswer(answer);
    $('#ask-loading').textContent = answer.mode === 'gemini' ? 'Gemini · Grounded NASA evidence' : 'Local analysis · no model charge';
  } catch (error) {
    $('#ask-loading').textContent = error.message;
  } finally {
    busy = false;
    $('#ask-send').disabled = false;
    $('#ask-question').focus();
  }
};

$('#ask-reset').onclick = () => {
  if (busy) return;
  session = crypto.randomUUID();
  answers = [];
  context = { dataset: $('#ask-dataset').value, filters: {} };
  lastSelected = undefined;
  $('#ask-messages').replaceChildren();
  $('#ask-loading').textContent = 'Conversation reset.';
  readContext();
  suggestions([
    'What is the effect of airflow on fire?',
    'Will increasing carbon dioxide suppress a fire?',
    'What can these 4 investigations tell us about fire safety?'
  ]);
};

suggestions([
  'What is the effect of airflow on fire?',
  'Will increasing carbon dioxide suppress a fire?',
  'What can these 4 investigations tell us about fire safety?'
]);

load.catch(() => {
  $('#ask-loading').textContent = 'Prepared research data could not load. Reload the page.';
});
