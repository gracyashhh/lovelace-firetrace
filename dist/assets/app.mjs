import { predict } from './engine.mjs';

const $ = s => document.querySelector(s);
const el = id => document.getElementById(id);
const fmt = (v, n = 1) => v === null || v === undefined || !Number.isFinite(+v) ? 'Not recorded' : Number(v).toFixed(n);
const fmtPrecise = (v, n = 3) => v == null || !Number.isFinite(+v) ? '—' : Number(v).toFixed(n);
const safe = s => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

function sourceLink(url, text = 'NASA PSI source') {
  return `<a href="${url}" target="_blank" rel="noopener" class="text-link">${text} ↗</a>`;
}
function metric(k, v) {
  return `<div class="metric"><span>${k}</span><strong>${v}</strong></div>`;
}
function slider(id, label, min, max, step, unit) {
  return `<div class="preview-control"><label>${label}<span id="${id}-value">${conditions[id]}${unit}</span></label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${conditions[id]}"></div>`;
}
function table(id, head, rows) {
  $(id).innerHTML = `<thead><tr>${head.map(x => `<th scope="col">${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody>`;
}

const names = { extinction_diameter: 'Extinction droplet diameter', burning_rate: 'Burning constant', burn_time: 'Burn time', test_end: 'Test end' };
const units = { extinction_diameter: 'mm', burning_rate: 'mm²/s', burn_time: 's', test_end: '' };
const targets = Object.keys(names);

let data, models;
let flexRecords = [];
let mode = 'recorded';
let selected = '20CAL10';
let progress = 0;
let playing = true;
let speed = 1;
let drag = false;
let angle = 0.1;
let zoom = 1;
let conditions = { oxygen: 21, pressure: 1, fuel: 'Methanol', diameter: 1.86, gas: 'N₂ balance' };
let reduced = false;
let lastTime = 0;
let currentRoute = 'lab';

function activeRecord() {
  return flexRecords.find(r => r.id === selected) || flexRecords.find(r => r.initialDiameterMm && r.burnTimeS) || flexRecords[0] || {
    id: '20CAL10', testNumber: 2, fuel: 'Methanol', pressureMmHg: 762.0, oxygenFraction: 0.21, nitrogenFraction: 0.79,
    co2Fraction: 0.0, heliumFraction: 0.0, initialDiameterMm: 1.86, extinctionDiameterMm: 0.94, burningRateSourceMm: 0.60,
    burnTimeS: 5.0, outcome: 'Extinction', source: 'https://psi.nasa.gov/physci/repo/data/investigations/PSI-69'
  };
}

function renderLab() {
  const r = activeRecord(), s = mode === 'recorded';
  return `<div class="lab-page page-enter">
  <div class="page-heading lab-heading">
    <div>
      <div class="eyebrow"><span class="line-dot"></span>NASA PSI / MICROGRAVITY COMBUSTION LAB</div>
      <h1>Fire behaves differently <span>beyond gravity.</span></h1>
      <p>Actual archived experiments meet interactive, explicitly illustrative fire visualisation.</p>
    </div>
    <div class="mission-tag">
      <div class="signal"></div>
      <span>RESEARCH SESSION<br><b>FLEX / PSI-69</b></span>
    </div>
  </div>
  <div class="lab-grid">
    <section class="scene-panel preview-surface">
      <div class="scene-top">
        <span class="scene-label"><span class="scene-live"></span> EXPERIMENT CHAMBER / VIEW 001</span>
        <button class="tiny-action" id="reduced">${reduced ? 'STANDARD EFFECTS' : 'REDUCED EFFECTS'}</button>
      </div>
      <div class="canvas-overlay">FREE-FLOATING FUEL DROPLET<b>Microgravity / μg</b></div>
      <canvas class="preview-canvas" id="flame"></canvas>
      <div class="scene-overlay-preview">DRAG TO ORBIT · SCROLL TO ZOOM</div>
      <div class="scene-bottom">
        <span>● ILLUSTRATIVE OPTICAL MODEL</span>
        <span>NOT CFD</span>
      </div>
    </section>
    <div class="control-panel">
      <div class="control-title">
        <div><span class="kicker">CONTROL DECK</span><h3>Experiment parameters</h3></div>
        <span>⚙</span>
      </div>
      <div class="mode-switch">
        <button id="record" class="${s ? 'active' : ''}">NASA recorded</button>
        <button id="explore" class="${!s ? 'active' : ''}">Explore</button>
      </div>
      ${s ? `
        <label class="field-label">SELECT NASA EXPERIMENT
          <select id="exp">${flexRecords.filter(x => x.initialDiameterMm && x.burnTimeS).map(x => `<option value="${safe(x.id)}" ${x.id === r.id ? 'selected' : ''}>${safe(x.id)} · ${safe(x.fuel)} · ${safe(x.outcome)}</option>`).join('')}</select>
        </label>
        <div class="experiment-card">
          <div class="mini-top"><span class="record-chip">✓ RECORDED TEST</span><span>FLEX #${r.testNumber}</span></div>
          <h3>${r.id}</h3>
          <p>${r.fuel} in a controlled gas mixture</p>
          <div class="measure-grid">
            ${metric('OXYGEN', fmt(r.oxygenFraction * 100, 1) + '%')}
            ${metric('PRESSURE', fmt(r.pressureMmHg, 1) + ' mmHg')}
            ${metric('INITIAL Ø', fmt(r.initialDiameterMm, 2) + ' mm')}
            ${metric('EXTINCTION Ø', fmt(r.extinctionDiameterMm, 2) + ' mm')}
            ${metric('RATE (ARCHIVE UNIT)', fmt(r.burningRateSourceMm, 2) + ' mm')}
            ${metric('BURN DURATION', fmt(r.burnTimeS, 1) + ' s')}
          </div>
        </div>
        <div class="outcome-strip">
          <span>RECORDED OUTCOME</span>
          <strong class="${r.outcome === 'Extinction' ? 'green-text' : 'amber-text'}">${r.outcome}</strong>
        </div>
        <p class="gas-note">Mole fractions O₂ ${fmt(r.oxygenFraction, 2)} · N₂ ${fmt(r.nitrogenFraction, 2)} · CO* ${fmt(r.co2Fraction, 2)} · He ${fmt(r.heliumFraction, 2)}</p>
      ` : `
        <div class="exploration-caption">Qualitative parameter study — no combustion predictions.</div>
        ${slider('oxygen', 'Oxygen concentration', 10, 40, .5, '%')}
        ${slider('pressure', 'Ambient pressure', .4, 3.3, .1, ' bar')}
        ${slider('diameter', 'Initial droplet diameter', 1, 5, .1, ' mm')}
        <label class="field-label">LIQUID FUEL
          <select id="fuel">
            <option ${conditions.fuel === 'Methanol' ? 'selected' : ''}>Methanol</option>
            <option ${conditions.fuel === 'Heptane' ? 'selected' : ''}>Heptane</option>
          </select>
        </label>
        <label class="field-label">SURROUNDING GAS
          <select id="gas">
            <option>N₂ balance</option>
            <option ${conditions.gas === 'CO₂ enriched' ? 'selected' : ''}>CO₂ enriched</option>
            <option ${conditions.gas === 'Helium mix' ? 'selected' : ''}>Helium mix</option>
          </select>
        </label>
        <div class="context-alert">Illustrative visualisation — not a validated combustion prediction. No invented extinction times or burning rates.</div>
      `}
      <button id="insights-from-lab" class="go-analysis">Inspect measured FLEX evidence <span>→</span></button>
    </div>
  </div>
  <div class="under-scene">
    <section class="playback-panel">
      <div class="playback-header">
        <div><span class="kicker">EXPERIMENT TIMELINE</span><h3>${s ? 'Recorded outcomes · reconstructed frames' : 'Uncalibrated visual sequence'}</h3></div>
        <span id="time-value" class="time-text">0.0 s</span>
      </div>
      <div class="playback-track">
        <button id="toggle" class="play-button">${playing ? 'Ⅱ' : '▶'}</button>
        <button id="restart" class="restart-button">↻</button>
        <input id="timeline" type="range" min="0" max="1" step=".001" value="${progress}"/>
        <select id="speed" class="speed-select">
          <option value=".5" ${speed === .5 ? 'selected' : ''}>0.5×</option>
          <option value="1" ${speed === 1 ? 'selected' : ''}>1×</option>
          <option value="2" ${speed === 2 ? 'selected' : ''}>2×</option>
        </select>
      </div>
      <div class="timeline-labels"><span>START</span><span>${s ? r.outcome.toUpperCase() : 'END'}</span></div>
      <div class="disclosure" id="interp-message">NASA test parameters are scalar measurements. Intermediate flame frames are illustrative.</div>
    </section>
    <section class="insight-panel">
      <div class="insight-icon">✦</div>
      <div class="insight-content">
        <span class="kicker">EVIDENCE INTERPRETATION</span>
        <h3>${s ? (r.outcome === 'Extinction' ? 'A recorded flame extinction event' : r.outcome === 'Disruption' ? 'A disruption is not extinction' : 'Experiment completed') : 'Explore near known experiments'}</h3>
        <p>${s ? 'Visuals reproduce the outcome category but not measured high-speed footage. Interpolation is clearly labelled.' : `Evidence proximity is not a physical model. There are ${flexRecords.filter(x => x.fuel === conditions.fuel).length} locally loaded tests for ${conditions.fuel}.`}</p>
        ${sourceLink(r.source)}
      </div>
    </section>
  </div>
  ${!s ? `
    <section class="nearby-panel">
      <div class="section-small-heading">
        <div><span class="kicker">NEAR YOUR SETTINGS</span><h3>Similar archived tests</h3></div>
        <span>Nearest values are not predictions</span>
      </div>
      <div id="near"></div>
    </section>
  ` : ''}
  <p class="preview-note">This standalone fallback renders an animated 2D optical illustration. The primary React project uses Three.js + React Three Fiber for actual orbitable 3D flame geometry.</p>
  <input type="hidden" id="case" value="${r.id}"/>
  <input type="hidden" id="mode" value="${mode}"/>
</div>`;
}

function wireLab() {
  const rec = el('record');
  if (rec) rec.onclick = () => { mode = 'recorded'; progress = 0; playing = true; renderLabUI(); };
  const exp = el('explore');
  if (exp) exp.onclick = () => { mode = 'explore'; progress = 0; playing = true; renderLabUI(); };
  const red = el('reduced');
  if (red) red.onclick = () => { reduced = !reduced; renderLabUI(); };
  const ins = el('insights-from-lab');
  if (ins) ins.onclick = () => { location.hash = 'scientific-plots'; };
  const tog = el('toggle');
  if (tog) tog.onclick = () => {
    if (progress >= 1) progress = 0;
    playing = !playing;
    tog.textContent = playing ? 'Ⅱ' : '▶';
  };
  const rst = el('restart');
  if (rst) rst.onclick = () => {
    progress = 0;
    playing = true;
    if (el('toggle')) el('toggle').textContent = 'Ⅱ';
    updatePlayback();
  };
  const tl = el('timeline');
  if (tl) tl.oninput = e => {
    progress = Number(e.target.value);
    playing = false;
    if (el('toggle')) el('toggle').textContent = '▶';
    updatePlayback();
  };
  const spd = el('speed');
  if (spd) spd.onchange = e => { speed = Number(e.target.value); };

  if (mode === 'recorded') {
    const expSel = el('exp');
    if (expSel) expSel.onchange = e => {
      selected = e.target.value;
      progress = 0;
      playing = true;
      renderLabUI();
    };
  } else {
    for (const k of ['oxygen', 'pressure', 'diameter']) {
      const sl = el(k);
      if (sl) sl.oninput = e => {
        conditions[k] = Number(e.target.value);
        const valEl = el(k + '-value');
        if (valEl) valEl.textContent = e.target.value + (k === 'oxygen' ? '%' : k === 'pressure' ? ' bar' : ' mm');
        renderNear();
      };
    }
    const fuelSel = el('fuel');
    if (fuelSel) fuelSel.onchange = e => {
      conditions.fuel = e.target.value;
      renderNear();
    };
    const gasSel = el('gas');
    if (gasSel) gasSel.onchange = e => {
      conditions.gas = e.target.value;
      renderNear();
    };
    renderNear();
  }

  const caseInput = el('case');
  if (caseInput) {
    caseInput.onchange = e => {
      selectExperiment(e.target.value);
    };
  }

  const c = el('flame');
  if (c) {
    let x = 0;
    c.onpointerdown = e => {
      drag = true;
      x = e.clientX;
      c.setPointerCapture(e.pointerId);
    };
    c.onpointermove = e => {
      if (drag) {
        angle += (e.clientX - x) * 0.015;
        x = e.clientX;
      }
    };
    c.onpointerup = () => { drag = false; };
    c.onwheel = e => {
      e.preventDefault();
      zoom = Math.max(0.65, Math.min(1.5, zoom - e.deltaY * 0.0004));
    };
  }
  updatePlayback();
}

function renderNear() {
  const target = el('near');
  if (!target) return;
  const a = flexRecords.filter(x => x.fuel === conditions.fuel && x.oxygenFraction !== null && x.pressureMmHg !== null)
    .map(x => ({ ...x, dist: Math.abs(x.oxygenFraction * 100 - conditions.oxygen) / 10 + Math.abs(x.pressureMmHg / 750 - conditions.pressure) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 4);
  target.innerHTML = a.map(r => `<div class="preview-row"><b>${r.id}</b><span>${fmt(r.oxygenFraction * 100, 1)}% O₂</span><span>${fmt(r.pressureMmHg / 750, 2)} bar</span><span>${r.outcome}</span><button data-load="${r.id}">LOAD →</button></div>`).join('');
  target.querySelectorAll('[data-load]').forEach(b => b.onclick = () => {
    selected = b.dataset.load;
    mode = 'recorded';
    progress = 0;
    playing = true;
    renderLabUI();
  });
}

function updatePlayback() {
  if (currentRoute !== 'lab') return;
  const r = activeRecord();
  const tl = el('timeline');
  if (tl) {
    tl.value = progress;
    tl.style.setProperty('--fill', (100 * progress) + '%');
    const timeVal = el('time-value');
    if (timeVal) {
      timeVal.textContent = mode === 'recorded' && r.burnTimeS !== null && r.burnTimeS !== undefined ? `${(r.burnTimeS * progress).toFixed(2)} / ${Number(r.burnTimeS).toFixed(2)} s` : `${Math.round(progress * 100)}%`;
    }
    const hasInter = mode === 'recorded' && r.outcome === 'Extinction' && r.initialDiameterMm !== null && r.extinctionDiameterMm !== null;
    const interp = el('interp-message');
    if (interp) {
      interp.textContent = mode === 'recorded' ? (hasInter ? `Droplet radius follows an illustrative squared-diameter interpolation between ${r.initialDiameterMm} mm and ${r.extinctionDiameterMm} mm. Intermediate observations were not measured.` : 'No valid paired extinction diameters. Droplet size is not extrapolated. The flame is illustrative.') : 'Sequence progress is not experimental physical time and produces no numerical prediction.';
    }
  }
}

function drawFlame() {
  if (currentRoute !== 'lab') return;
  const c = el('flame');
  if (!c) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1), w = c.clientWidth, h = c.clientHeight, needW = Math.round(w * dpr), needH = Math.round(h * dpr);
  if (c.width !== needW || c.height !== needH) {
    c.width = needW;
    c.height = needH;
  }
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const cx = w * 0.51 + Math.sin(angle) * 20, cy = h * 0.51, base = Math.min(w, h), r = base * 0.24 * zoom;
  const now = performance.now() * 0.001;
  const rec = activeRecord(), oxygen = mode === 'recorded' ? (rec.oxygenFraction != null ? rec.oxygenFraction * 100 : 21) : conditions.oxygen;
  const fuel = mode === 'recorded' ? rec.fuel : conditions.fuel;
  let cool = Math.min(1, Math.max(0, (oxygen < 18 ? 0.9 : oxygen < 24 ? 0.62 : 0.26) + (fuel === 'Methanol' ? 0.13 : -0.10) + (mode === 'explore' && conditions.gas === 'CO₂ enriched' ? 0.15 : 0)));
  let fade = mode === 'recorded' && rec.outcome === 'Extinction' && progress > 0.82 ? Math.max(0, 1 - (progress - 0.82) / 0.18) : 1;
  const droplet0 = mode === 'recorded' ? rec.initialDiameterMm : conditions.diameter;
  let diameter = droplet0 || 2;
  const hasEnd = mode === 'recorded' && rec.outcome === 'Extinction' && rec.extinctionDiameterMm !== null && rec.initialDiameterMm !== null;
  if (hasEnd) diameter = Math.sqrt(diameter * diameter + (rec.extinctionDiameterMm ** 2 - diameter * diameter) * progress);
  const dropletR = Math.max(14, Math.min(35, diameter * 10 * zoom));

  // Perspective-reticle guides and gridded experiment chamber.
  g.save();
  g.strokeStyle = 'rgba(64,133,188,.14)';
  g.lineWidth = 1;
  for (let i = -10; i <= 10; i++) {
    g.beginPath();
    g.moveTo(cx + i * 60, -20);
    g.lineTo(cx + i * 60, h + 30);
    g.stroke();
    g.beginPath();
    g.moveTo(-20, cy + i * 54);
    g.lineTo(w + 20, cy + i * 54);
    g.stroke();
  }
  g.restore();
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.ellipse(cx, cy, r * (1.14 + i * 0.23), r * (1.14 + i * 0.23) * (0.86 + 0.14 * Math.abs(Math.cos(angle + i))), angle * 0.2 + i * 0.39, 0, Math.PI * 2);
    g.setLineDash([3, 11]);
    g.strokeStyle = `rgba(75,150,215,${0.29 - i * 0.06})`;
    g.lineWidth = 1;
    g.stroke();
  }
  g.setLineDash([]);

  // Volumetric-looking additive light diffusion, but not CFD.
  g.save();
  g.globalCompositeOperation = 'lighter';
  if (!reduced) {
    for (let j = 4; j >= 1; j--) {
      const glow = g.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * (1 + j * 0.16));
      glow.addColorStop(0, `rgba(18,108,255,${0.018 * fade})`);
      glow.addColorStop(0.55, `rgba(23,75,245,${0.022 * fade})`);
      glow.addColorStop(1, 'rgba(5,20,44,0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(cx, cy, r * (1 + j * 0.16), 0, Math.PI * 2);
      g.fill();
    }
  }
  for (let layer = 0; layer < 4; layer++) {
    const segments = reduced ? 80 : 180;
    const rr = r * (0.67 + layer * 0.16) * (mode === 'explore' ? (1 + (conditions.pressure - 1) * 0.05) : 1);
    g.beginPath();
    for (let i = 0; i <= segments; i++) {
      const theta = Math.PI * 2 * i / segments;
      const flutter = Math.sin(theta * 8 + now * 1.2 + layer) * 0.029 + Math.sin(theta * 13 - now * 0.9 + layer) * 0.024 + Math.sin(theta * 21 + now * 0.6) * 0.009;
      const radial = rr * (1 + flutter);
      const x = cx + Math.cos(theta) * radial;
      const y = cy + Math.sin(theta) * radial * (0.99 + 0.02 * Math.cos(angle));
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    const grad = g.createRadialGradient(cx - r * 0.1, cy + r * 0.02, r * 0.12, cx, cy, rr * 1.1);
    grad.addColorStop(0, `rgba(38,172,255,${0.015 * fade})`);
    grad.addColorStop(0.55, `rgba(${Math.round(45 + cool * 20)},${Math.round(106 + cool * 80)},255,${(0.07 + layer * 0.013) * fade})`);
    grad.addColorStop(0.83, `rgba(${Math.round(220 - 130 * cool)},${Math.round(92 + 40 * cool)},${Math.round(190 + 45 * cool)},${(0.055 + layer * 0.015) * fade})`);
    grad.addColorStop(1, `rgba(40,112,250,${0.015 * fade})`);
    g.fillStyle = grad;
    g.fill();
    g.strokeStyle = `rgba(${Math.round(230 - 145 * cool)},${Math.round(133 + 82 * cool)},255,${(0.16 + layer * 0.026) * fade})`;
    g.lineWidth = layer === 0 ? 2.3 : 1.5;
    g.stroke();
  }
  g.restore();

  // Liquid droplet with specular highlight and shaded edge.
  const ball = g.createRadialGradient(cx - dropletR * 0.42, cy - dropletR * 0.43, 2, cx, cy, dropletR);
  ball.addColorStop(0, '#aacce5');
  ball.addColorStop(0.09, '#436b91');
  ball.addColorStop(0.4, '#254666');
  ball.addColorStop(0.76, '#122942');
  ball.addColorStop(1, '#071623');
  g.beginPath();
  g.arc(cx, cy, dropletR, 0, Math.PI * 2);
  g.fillStyle = ball;
  g.fill();
  g.strokeStyle = 'rgba(164,226,250,.6)';
  g.lineWidth = 1.5;
  g.stroke();
  g.beginPath();
  g.ellipse(cx - dropletR * 0.3, cy - dropletR * 0.35, dropletR * 0.23, dropletR * 0.1, -0.6, 0, Math.PI * 2);
  g.fillStyle = 'rgba(193,246,255,.48)';
  g.fill();
}

function animate(t) {
  let dt = Math.min((t - lastTime) || 16, 100);
  lastTime = t;
  if (playing && currentRoute === 'lab') {
    progress = Math.min(1, progress + dt / 14000 * speed);
    if (progress === 1) {
      playing = false;
      const tog = el('toggle');
      if (tog) tog.textContent = '▶';
    }
    if (Math.round(t) % 8 === 0) updatePlayback();
  }
  if (currentRoute === 'lab') drawFlame();
  requestAnimationFrame(animate);
}

function renderLabUI() {
  const lab = el('lab');
  if (!lab) return;
  lab.innerHTML = renderLab();
  wireLab();
  drawFlame();
}

function selectExperiment(id) {
  const found = flexRecords.find(r => r.id === id || String(r.testNumber) === String(id));
  if (found) {
    selected = found.id;
    mode = 'recorded';
    progress = 0;
    playing = true;
    renderLabUI();
  }
}
window.selectExperiment = selectExperiment;

window.firetraceAssistantContext = () => ({
  dataset: 'FLEX',
  experimentId: mode === 'recorded' ? selected : undefined,
  filters: {},
  uiToken: `${location.hash}:${mode}:${selected}`
});

function route() {
  let id = location.hash.slice(1) || 'lab';
  if (id === 'animation' || id === 'explorer') {
    id = 'lab';
    history.replaceState(null, '', '#lab');
  }
  if (!['lab', 'validation', 'evidence', 'ranking', 'scientific-plots'].includes(id)) id = 'lab';
  currentRoute = id;
  document.querySelectorAll('.page').forEach(p => p.hidden = p.id !== id);
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('active', a.hash === '#' + id));
  document.querySelectorAll('#' + id + ' iframe[data-src]:not([hidden])').forEach(loadComponent);
  if (id === 'lab' && flexRecords.length) {
    renderLabUI();
  }
}
addEventListener('hashchange', route);

let filters = {}, shown = [];
const filterNames = { fuel: 'Fuel', pressure: 'Pressure · mmHg', oxygen: 'Oxygen · fraction', co2: 'CO₂ · fraction', helium: 'Helium · fraction', diameter: 'Initial diameter · mm', test_end: 'Recorded test end', split: 'Model split' };

function filterRows() {
  shown = data.records.filter(r => Object.entries(filters).every(([k, v]) => !v || String(r[k]) === v));
  for (const k of Object.keys(filterNames)) {
    const compatible = data.records.filter(r => Object.entries(filters).every(([a, v]) => a === k || !v || String(r[a]) === v));
    let vals = [...new Set(compatible.map(r => r[k]).filter(v => v != null))].sort((a, b) => typeof a === 'number' ? a - b : String(a).localeCompare(String(b)));
    let sel = $('#filter-' + k);
    if (sel) {
      sel.innerHTML = '<option value="">All</option>' + vals.map(v => `<option>${v}</option>`).join('');
      sel.value = filters[k] || '';
    }
  }
  if ($('#count')) $('#count').textContent = `${shown.length} / 274 records`;
  table('#records', ['Test', 'Fuel', 'Pressure · mmHg', 'd₀ · mm', 'Extinction d · mm', 'K · mm²/s', 'Burn time · s', 'Test end', 'Split', 'Explore'], shown.map(r => [r.test, r.fuel, fmtPrecise(r.pressure, 1), fmtPrecise(r.diameter), fmtPrecise(r.extinction_diameter), fmtPrecise(r.burning_rate), fmtPrecise(r.burn_time) + (r.approximate_burn_time ? ' (approx.)' : ''), r.test_end ?? '—', r.split, `<button data-test="${r.test}" aria-label="View test ${r.test} in experiment lab">View ↗</button>`]));
}

if ($('#records')) {
  $('#records').addEventListener('click', e => {
    if (e.target.dataset.test) {
      selectExperiment(e.target.dataset.test);
      location.hash = 'lab';
    }
  });
}
if ($('#clear-filters')) {
  $('#clear-filters').addEventListener('click', () => { filters = {}; filterRows(); });
}
if ($('#export')) {
  $('#export').addEventListener('click', () => {
    const fields = Object.keys(data.records[0]), escape = v => '"' + String(v ?? '').replaceAll('"', '""') + '"';
    let csv = [fields, ...shown.map(r => fields.map(k => r[k]))].map(r => r.map(escape).join(',')).join('\n'), a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'FLEX_filtered_records.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}

function validation() {
  if (!data?.validation) return;
  let rows = [];
  for (const k of targets) {
    let original = data.validation.find(r => r.target === k && r.procedure === 'Original'), expanded = data.validation.find(r => r.target === k && r.procedure === 'Expanded');
    let field = k === 'test_end' ? 'macro_f1' : 'mae';
    rows.push([names[k], k === 'test_end' ? 'Macro F1 ↑' : 'MAE ↓ · ' + units[k], fmtPrecise(original[field]), fmtPrecise(expanded[field])]);
  }
  table('#cv-table', ['Output', 'Metric', 'Original search', 'Expanded search'], rows);
  $('#cv-chart').innerHTML = targets.slice(0, 3).map(k => {
    let a = data.validation.find(r => r.target === k && r.procedure === 'Original').mae, b = data.validation.find(r => r.target === k && r.procedure === 'Expanded').mae;
    return `<div><h3>${names[k]}</h3><div class="bar-label">Original ${fmtPrecise(a)} ${units[k]}</div><div class="bar" style="width:100%"></div><div class="bar-label">Expanded ${fmtPrecise(b)} ${units[k]}</div><div class="bar new" style="width:${b / a * 100}%"></div><small>${((a - b) / a * 100).toFixed(1)}% lower mean MAE</small></div>`;
  }).join('');
  table('#fixed-table', ['Output', 'Selected model', 'Train / test n', 'Test metric'], data.fixedMetrics.map(r => [names[r.target], r.chosen, `${r.train_n ?? r.n_train} / ${r.test_n ?? r.n_test}`, r.target === 'test_end' ? `Accuracy ${fmtPrecise(r.accuracy)} · macro F1 ${fmtPrecise(r.macro_f1)}` : `MAE ${fmtPrecise(r.mae)} ${units[r.target]} · R² ${fmtPrecise(r.r2)}`]));
  compare();
}

function compare() {
  if (!data?.testPredictions) return;
  let k = $('#compare-target').value, rows = data.testPredictions;
  table('#test-table', ['Test', 'Fuel', 'Actual', 'Predicted', k === 'test_end' ? 'Correct?' : 'Absolute error'], rows.map(r => [r.test, r.fuel, k === 'test_end' ? r[k] : fmtPrecise(r[k]), k === 'test_end' ? r[k + '_predicted'] : fmtPrecise(r[k + '_predicted']), k === 'test_end' ? (r.test_end_correct ? 'Yes' : 'No') : fmtPrecise(r[k + '_absolute_error'])]));
  if (k === 'test_end') {
    let errors = rows.filter(r => !r.test_end_correct).length;
    $('#prediction-plot').innerHTML = `<p>${errors} / ${rows.length} incorrect classifications · ${(100 * errors / rows.length).toFixed(2)}% error rate. Accuracy can hide poor minority-class performance; also inspect macro F1.</p>`;
    return;
  }
  let valid = rows.filter(r => r[k] != null), max = Math.max(...valid.flatMap(r => [r[k], r[k + '_predicted']])) * 1.08;
  let coords = v => 45 + v / max * 550;
  $('#prediction-plot').innerHTML = `<svg class="chart" viewBox="0 0 650 310" role="img" aria-label="Actual versus predicted ${names[k]}. Each point is a held-out case. Values and absolute errors are available in the table below."><line x1="45" y1="260" x2="595" y2="25" stroke="#708499" stroke-dasharray="5 5"/><line x1="45" y1="260" x2="610" y2="260" stroke="#8ca5b8"/><line x1="45" y1="260" x2="45" y2="15" stroke="#8ca5b8"/>${valid.map(r => `<circle cx="${coords(r[k])}" cy="${260 - r[k + '_predicted'] / max * 235}" r="4" fill="#77e4de" opacity=".8"><title>Test ${r.test}: actual ${fmtPrecise(r[k])}, predicted ${fmtPrecise(r[k + '_predicted'])}</title></circle>`).join('')}<text x="240" y="300" fill="#c2cfde" font-size="12">Actual · ${units[k]} (0 to ${fmtPrecise(max, 1)})</text><text x="55" y="18" fill="#c2cfde" font-size="12">Predicted · ${units[k]}</text><text x="440" y="35" fill="#a4b5c8" font-size="11">Dashed: perfect prediction</text></svg>`;
}

if ($('#compare-target')) {
  $('#compare-target').addEventListener('change', compare);
}

function evidence() {
  const cards = [
    ['FLEX / LIQUID DROPLET', 'Nearly invisible does not mean extinguished.', 'flex1261_p1.png', 'FLEX-1261 reports dodecane at 3777.606 mmHg (≈4.97 atm), with K = 0.618 mm²/s. Hot combustion can be nearly invisible. The page lists two unexplained initial diameters: 5.646 and 4.600 mm. Neither is silently selected. This is outside the current model’s fuel/pressure domain.', 'flex-1261.pdf#page=1', 'FLEX-1261 preliminary summary · p1'],
    ['BASS / SOLID FABRIC', 'Flow direction changes this measured case.', 'sibal_p29.png', 'For SIBAL at approximately 10 cm/s, concurrent versus opposed spread is 2.55 versus 1.21 mm/s. These are solid flame-spread rates, not FLEX burning constants. They are case-specific, not a universal factor.', 'bass-sibal.pdf#page=29', 'ASGSR BASS SIBAL · p29'],
    ['BASS / SOLID FABRIC', 'Morphology is condition-specific.', 'sibal_p31.png', 'At 10 cm/s concurrent flow, the shown 0g case has steady size and spread with a convex base and extended blue zone; the 1g case grows with a concave base and extended soot zone. Display colour alone does not determine temperature.', 'bass-sibal.pdf#page=31', 'ASGSR BASS SIBAL · p31'],
    ['SLICE / GAS JET', 'A lifted flame detaches downstream.', 'slice_p6.png', 'The training examples support a detached flame and a gap from the nozzle. The images are explicitly not at the same scale: no quantitative lift-off height or general 3D predictor can be derived from this page.', 'slice-training.pdf#page=6', 'SLICE crew training · p6'],
    ['BASS / SOLID SPHERE', 'Computation still disagrees with observation.', 'bassdenver_p51.png', 'The acrylic sphere case uses 17% oxygen in nitrogen, 1 atm and 12 cm/s flow. Its comparison calls for kinetic-parameter adjustments to improve flame standoff. It does not validate an exact 3D flame geometry.', 'bass-denver.pdf#page=51', 'ISS Denver BASS · p51']
  ];
  if ($('#evidence-cards')) {
    $('#evidence-cards').innerHTML = cards.map(c => `<article class="panel evidence-card"><img src="references/${c[2]}" alt="Source page: ${c[5]}. The key finding is transcribed below." loading="lazy"><div class="body"><span class="eyebrow">${c[0]}</span><h3>${c[1]}</h3><p>${c[3]}</p><a href="references/${c[4]}" target="_blank">Open source · ${c[5]} ↗</a></div></article>`).join('') + `<article class="panel"><span class="eyebrow">BASS / OVERVIEW</span><h3>Solid samples need their own model.</h3><p>Slides 2–3 describe the solid-fuel flow tunnel and different sample geometries. Slide 15 shows a specific 2-cm PMMA sphere at 17% oxygen and 2 cm/s flow. A solid PMMA sphere is not a liquid FLEX droplet.</p><a href="references/bass-overview.pptx" download>Download BASS Overview · slides 2, 3, 15 ↓</a><p>Reference page numbers here count PDF pages from 1. Historical crew procedures are source material, not dashboard instructions.</p></article>`;
  }
}

let batchResults = [];
const base = ['fuel', 'pressure', 'diameter', 'oxygen', 'co2', 'helium'];

function csvParse(text) {
  let rows = [], row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    let c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(field.trim()); field = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; field = '';
    } else field += c;
  }
  if (quoted) throw Error('Unclosed CSV quote.');
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function csvString(rows) {
  return rows.map(r => r.map(v => '"' + String(v ?? '').replaceAll('"', '""') + '"').join(',')).join('\n');
}

if ($('#batch-demo')) {
  $('#batch-demo').addEventListener('click', () => {
    const fields = [...base, ...targets];
    $('#batch-input').value = csvString([fields, ...data.testPredictions.map(r => fields.map(k => r[k]))]);
    $('#batch-summary').textContent = 'Loaded the fixed 53 test cases. These have been inspected previously; they are not a fresh independent evaluation.';
  });
}

if ($('#batch-run')) {
  $('#batch-run').addEventListener('click', () => {
    try {
      let rows = csvParse($('#batch-input').value), headers = rows.shift();
      if (!headers || base.some(k => !headers.includes(k))) throw Error('Required columns: ' + base.join(', '));
      if (rows.length > 5000) throw Error('Please use at most 5,000 rows per batch.');
      let stats = Object.fromEntries(targets.map(k => [k, []]));
      batchResults = rows.map((values, i) => {
        let r = Object.fromEntries(headers.map((k, j) => [k, values[j] ?? ''])), x = Object.fromEntries(base.map(k => [k, k === 'fuel' ? r[k] : Number(r[k])])), reason = '';
        if (base.some(k => r[k] === '') || base.slice(1).some(k => !Number.isFinite(x[k])) || !['Methanol', 'Heptane'].includes(x.fuel)) reason = 'Missing/invalid inputs or unsupported fuel';
        else if (x.pressure <= 0 || x.diameter <= 0 || x.oxygen < 0 || x.co2 < 0 || x.helium < 0 || x.oxygen + x.co2 + x.helium > 1) reason = 'Invalid physical inputs';
        if (reason) return { row: i + 1, status: reason };
        let y = predict(models, x), out = { row: i + 1, status: 'Predicted', ...x };
        for (const k of targets) {
          out[k + '_predicted'] = y[k];
          if (r[k] !== undefined && r[k] !== '') {
            if (k === 'test_end' && ['Extinction', 'Disruption', 'Completion'].includes(r[k])) {
              out[k + '_actual'] = r[k];
              out[k + '_correct'] = r[k] === y[k];
              stats[k].push(+out[k + '_correct']);
            } else if (k !== 'test_end' && Number.isFinite(+r[k])) {
              out[k + '_actual'] = +r[k];
              out[k + '_absolute_error'] = Math.abs(y[k] - Number(r[k]));
              stats[k].push(out[k + '_absolute_error']);
            }
          }
        }
        return out;
      });
      let good = batchResults.filter(r => r.status === 'Predicted').length;
      $('#batch-summary').textContent = `${good} predicted / ${batchResults.length} rows. ` + targets.filter(k => stats[k].length).map(k => `${names[k]}: ${k === 'test_end' ? 'accuracy' : 'MAE'} ${fmtPrecise(stats[k].reduce((a, b) => a + b, 0) / stats[k].length)} ${units[k]} (n=${stats[k].length})`).join(' · ');
      table('#batch-table', ['Row', 'Status', 'Extinction d · mm', 'K · mm²/s', 'Burn time · s', 'Test end'], batchResults.map(r => [r.row, r.status, fmtPrecise(r.extinction_diameter_predicted), fmtPrecise(r.burning_rate_predicted), fmtPrecise(r.burn_time_predicted), r.test_end_predicted ?? '—']));
      $('#batch-download').disabled = !batchResults.length;
    } catch (e) {
      $('#batch-summary').textContent = e.message;
      batchResults = [];
      $('#batch-download').disabled = true;
      $('#batch-table').innerHTML = '';
    }
  });
}

if ($('#batch-download')) {
  $('#batch-download').addEventListener('click', () => {
    let fields = [...new Set(batchResults.flatMap(Object.keys))], a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csvString([fields, ...batchResults.map(r => fields.map(k => r[k]))])], { type: 'text/csv' }));
    a.download = 'FireTrace_batch_predictions.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}

function loadComponent(frame) {
  if (!frame.hasAttribute('src')) frame.src = frame.dataset.src;
}
document.querySelectorAll('[data-plot]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-plot]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  document.querySelectorAll('[data-plot-frame]').forEach(frame => {
    frame.hidden = frame.dataset.plotFrame !== button.dataset.plot;
    if (!frame.hidden) loadComponent(frame);
  });
}));

if ($('#sidebar-toggle')) {
  $('#sidebar-toggle').addEventListener('click', () => {
    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    if ($('#site-sidebar')) $('#site-sidebar').hidden = collapsed;
    $('#sidebar-toggle').setAttribute('aria-expanded', String(!collapsed));
    const label = collapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar';
    $('#sidebar-toggle').setAttribute('aria-label', label);
    $('#sidebar-toggle').title = label;
  });
}

const plotsFrame = $('#scientific-plots-frame');
let plotsSizeObserver;
function sizeScientificPlots() {
  const content = plotsFrame?.contentDocument?.querySelector('main');
  if (!content) return;
  plotsSizeObserver?.disconnect();
  const resize = () => {
    if (plotsFrame.getBoundingClientRect().width) {
      plotsFrame.style.height = Math.ceil(content.getBoundingClientRect().height + 2) + 'px';
    }
  };
  plotsSizeObserver = new ResizeObserver(resize);
  plotsSizeObserver.observe(content);
  resize();
}
if (plotsFrame) {
  plotsFrame.addEventListener('load', sizeScientificPlots);
  sizeScientificPlots();
}

try {
  [data, models] = await Promise.all(['data', 'models'].map(async n => {
    let r = await fetch(`assets/${n}.json`);
    if (!r.ok) throw Error('Data unavailable');
    return r.json();
  }));
  if ($('#loading')) $('#loading').hidden = true;

  flexRecords = data.records.map(r => ({
    id: r.identifier,
    testNumber: r.test,
    fuel: r.fuel,
    pressureMmHg: r.pressure,
    oxygenFraction: r.oxygen,
    nitrogenFraction: r.nitrogen,
    co2Fraction: r.co2,
    heliumFraction: r.helium,
    initialDiameterMm: r.diameter,
    extinctionDiameterMm: r.extinction_diameter,
    burningRateSourceMm: r.burning_rate,
    burnTimeS: r.burn_time,
    outcome: r.test_end || 'Extinction',
    source: 'https://psi.nasa.gov/physci/repo/data/investigations/PSI-69'
  }));

  selected = flexRecords.find(r => r.id === '20CAL10')?.id || flexRecords[0]?.id || '20CAL10';
  renderLabUI();
  requestAnimationFrame(animate);

  if ($('#filters')) {
    $('#filters').innerHTML = Object.entries(filterNames).map(([k, v]) => `<label>${v}<select id="filter-${k}"></select></label>`).join('');
    Object.keys(filterNames).forEach(k => $('#filter-' + k)?.addEventListener('change', e => {
      filters[k] = e.target.value;
      filterRows();
    }));
  }
  filterRows();
  validation();
  evidence();
  route();
} catch (e) {
  if ($('#loading')) {
    $('#loading').hidden = false;
    $('#loading').textContent = 'The dashboard could not load its data. Please reload. ' + e.message;
  }
  console.error(e);
}
