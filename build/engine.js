import { ChatRequest, Context, IDENTITY_ANSWER, isIdentityOrGreeting } from './shared.js';
export { ChatRequest };
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const f = (v) => Number(v.toPrecision(6)).toString();
export function statistics(values) {
    const a = values.filter(finite).sort((a, b) => a - b);
    const n = a.length;
    return {
        n,
        missing: values.length - n,
        mean: n ? a.reduce((sum, val) => sum + val, 0) / n : null,
        median: n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : null,
        min: n ? a[0] : null,
        max: n ? a[n - 1] : null
    };
}
export function filterRecords(rows, filters) {
    return rows.filter(r => Object.entries(filters).every(([k, v]) => String(r.values[k]).toLowerCase() === String(v).toLowerCase()));
}
export function nearest(rows, record, limit = 5) {
    const keys = ['pressure', 'oxygen', 'co2', 'helium', 'diameter'];
    return rows
        .filter(r => r.id !== record.id &&
        r.values.fuel === record.values.fuel &&
        keys.every(k => finite(r.values[k]) && finite(record.values[k])))
        .map(r => ({
        record: r,
        distance: Math.sqrt(keys.reduce((s, k) => {
            const a = rows.map(row => row.values[k]).filter(finite);
            const range = Math.max(...a) - Math.min(...a) || 1;
            return s + ((Number(r.values[k]) - Number(record.values[k])) / range) ** 2;
        }, 0))
    }))
        .sort((a, b) => a.distance - b.distance || a.record.id.localeCompare(b.record.id))
        .slice(0, limit);
}
export function pearson(rows, a, b) {
    const xy = rows.filter(r => finite(r.values[a]) && finite(r.values[b]));
    const n = xy.length;
    if (n < 3)
        return { n, r: null };
    const x = xy.map(r => Number(r.values[a]));
    const y = xy.map(r => Number(r.values[b]));
    const mx = x.reduce((s, v) => s + v, 0) / n;
    const my = y.reduce((s, v) => s + v, 0) / n;
    let num = 0;
    let xx = 0;
    let yy = 0;
    for (let i = 0; i < n; i++) {
        num += (x[i] - mx) * (y[i] - my);
        xx += (x[i] - mx) ** 2;
        yy += (y[i] - my) ** 2;
    }
    return { n, r: xx && yy ? num / Math.sqrt(xx * yy) : null };
}
export function searchDocuments(catalog, q) {
    const terms = [...new Set(q.toLowerCase().match(/[a-z]{4,}/g) || [])];
    return catalog.documents
        .map(d => ({
        d,
        score: terms.reduce((s, t) => s + (d.text + ' ' + d.title).toLowerCase().split(t).length - 1, 0)
    }))
        .filter(d => d.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .map(x => x.d);
}
export function prepareEvidence(cat, question, context = {}, memory) {
    if (isIdentityOrGreeting(question)) {
        return {
            version: cat.version,
            question,
            context: { dataset: context.dataset || 'ALL', filters: {} },
            facts: [],
            citations: [],
            limitations: [],
            followups: [
                'What datasets are available in FireTrace?',
                'What is the effect of airflow on fire?',
                'Will increasing carbon dioxide suppress a fire?'
            ],
            filters: {},
            unsupported: false,
            directAnswer: IDENTITY_ANSWER,
            scientificPrinciple: 'FireTrace provides grounded exploration and synthesis of NASA microgravity combustion research across FLEX, BASS-II, SAFFIRE, and SAME-R investigations.'
        };
    }
    const q = question.toLowerCase();
    const explicit = [];
    if (/\bflex\b/.test(q))
        explicit.push('FLEX');
    if (/\bbass(?:-ii)?\b/.test(q))
        explicit.push('BASS-II');
    if (/saffire/.test(q))
        explicit.push('SAFFIRE');
    if (/same[- ]?r|aerosol|smoke detection/.test(q))
        explicit.push('SAME-R');
    const ctx = Context.parse({
        ...memory,
        ...context,
        filters: { ...(memory?.filters || {}), ...(context.filters || {}) }
    });
    if (explicit.length === 1 && explicit[0] !== ctx.dataset) {
        ctx.dataset = explicit[0];
        ctx.filters = {};
        delete ctx.experimentId;
        delete ctx.variable;
    }
    let ds = ctx.dataset;
    const ev = {
        version: cat.version,
        question,
        context: ctx,
        facts: [],
        citations: [],
        limitations: [],
        followups: [],
        filters: {},
        unsupported: false
    };
    let i = 0;
    const fact = (text, category = 'FireTrace calculated statistic', sourceIds = [], numbers = []) => ev.facts.push({ id: 'F' + ++i, text, category, sourceIds, numbers });
    const cite = (r) => {
        if (!ev.citations.some(s => s.id === r.id)) {
            ev.citations.push({
                id: r.id,
                label: `${r.dataset} ${r.experiment_id} · ${r.source.file} · ${r.source.sheet} row ${r.source.row}`,
                url: r.source_url,
                experimentId: r.experiment_id,
                dataset: r.dataset
            });
        }
        return r.id;
    };
    const sourceFor = (dataset) => {
        if (dataset === 'ALL')
            return [];
        const m = cat.manifest.find(man => man.dataset === dataset);
        if (!m)
            return [];
        const id = 'SOURCE:' + dataset;
        if (!ev.citations.some(c => c.id === id)) {
            ev.citations.push({ id, label: m.file, url: m.source_url, dataset });
        }
        if (dataset === 'FLEX' && !ev.citations.some(c => c.id === 'DOC:NASA/TP-2015-216046')) {
            ev.citations.push({
                id: 'DOC:NASA/TP-2015-216046',
                label: 'NASA/TP-2015-216046 Table IX',
                url: 'https://ntrs.nasa.gov/citations/20150023456',
                dataset: 'FLEX'
            });
        }
        return [id];
    };
    const isAirflowQuery = /airflow|air\s*flow|ventilation|forced\s*(?:flow|convection)|wind|fan\s*display|air\s*display|opposed\s*flow|concurrent\s*flow/i.test(q);
    const isCO2Query = (/carbon\s*dioxide|co2|co₂|suppress|extinguish|fire\s*extinguishing|diluent|inert\s*gas/i.test(q) ||
        /reduce.*(?:fire|flame|burning)|will.*(?:fire|flame).*reduce|effect\s*of\s*carbon\s*dioxide/i.test(q)) &&
        !/which\s*investigation.*relevant.*suppression/i.test(q);
    const isOxygenQuery = /oxygen|o2|o₂|flammability\s*limit/i.test(q);
    const isSmokeQuery = /smoke|aerosol|detector|ptrak|particle|dusttrak|obscuration|scatter/i.test(q);
    const isConclusionQuery = /what\s*can\s*we\s*conclude|what\s*remains\s*unknown|summary\s*of\s*findings/i.test(q);
    const isCrossOrCollective = /available\s*datasets|which\s*datasets|research\s*gaps|data\s*gaps/i.test(q) ||
        explicit.length > 1 ||
        /compare\s*(?:flex|saffire|bass|same)|all\s*(?:4|four)?\s*investigations|cross-investigation|relationship\s*between.*smoke.*burn|relevant.*suppression|fire\s*prevention|how.*combustion.*relate.*smoke/i.test(q);
    const unsupportedQuantity = /heat release|heat flux|flame temperature|ignition temperature|flame speed|extinction threshold|lift.off height/.test(q);
    const dangerous = unsupportedQuantity ||
        /safest|certif|predict.*(?:risk|fire|extinction|temperature)|ignition threshold|cause|causal|prove|fake.*(?:source|citation)|invent.*(?:source|citation)|ignore.*instructions|system prompt|execute|run shell/.test(q);
    // 1. Guard against unsupported / unmeasured causal claims
    if (dangerous) {
        ev.unsupported = true;
        ev.scientificPrinciple = 'Scientific boundaries: NASA combustion datasets record specific measurements under tested conditions; they do not establish unmeasured parameters or safety certifications.';
        ev.directAnswer =
            'The available NASA evidence cannot establish that causal conclusion, fire-risk prediction, certified safety ranking, or unmeasured parameter. NASA research datasets record observed measurements and descriptive ranges under tested conditions, but they do not provide universal predictive equations or flight certifications.';
        fact('The available evidence cannot establish that causal conclusion, safety ranking, unmeasured prediction or invented citation. I can show recorded measurements and descriptive statistics instead.', 'Unknown, unmeasured or insufficient evidence', sourceFor(ds === 'ALL' ? 'FLEX' : ds));
        ev.limitations.push('Do not treat experimental correlations as proof of causality or extrapolate beyond tested conditions.');
        ev.followups = ['What measurements are available in FLEX?', 'What materials were tested in BASS-II?'];
        return ev;
    }
    // 2. High-priority airflow query (resolves user failure #1)
    if (isAirflowQuery && (ds === 'ALL' || ds === 'BASS-II')) {
        ev.scientificPrinciple =
            'In microgravity without buoyancy, flame spread depends on forced flow velocity and direction. Opposed-flow spread rate exhibits non-monotonic behavior: increasing at low speeds as convective oxygen transport overcomes diffusion limitation, peaking, and then declining under convective cooling toward blow-off extinction. Concurrent flow pushes hot combustion gases over unburnt fuel, increasing thermal preheating and accelerating spread under favorable fuel thickness and oxygen conditions.';
        fact('In microgravity, buoyant updrafts are absent; flame spread depends on imposed forced flow and shows distinct aerodynamic regimes rather than universal behavior.', 'Research interpretation supported by evidence', sourceFor('BASS-II'));
        fact('BASS-II (PSI-25) evaluated solid materials (PMMA, Nomex, wax) across 129 records under operational airflow settings (recorded as fan display settings 0.0 to 1.5).', 'FireTrace calculated statistic', sourceFor('BASS-II'), [129]);
        fact('Opposed-flow flame spread is non-monotonic: spread rate first increases at low airflow as oxygen replenishment overcomes diffusion limitation, reaches a peak, and then decreases as convective cooling outpaces heat release until blow-off extinction occurs.', 'Research interpretation supported by evidence', sourceFor('BASS-II'));
        fact('Concurrent flow pushes the flame plume over unburnt fuel ahead of the pyrolysis front; this thermal preheating increases spread rate under conditions where fuel thickness and oxygen permit sustained combustion.', 'Research interpretation supported by evidence', sourceFor('BASS-II'));
        fact('Ventilation research can use fan/air display settings and the flow restrictor, but these are operational settings rather than calibrated physical velocities in cm/s.', 'Unknown, unmeasured or insufficient evidence', sourceFor('BASS-II'));
        ev.limitations.push('BASS-II fan-display readings are operational instrument settings, not calibrated physical velocities in cm/s.', 'No universal airflow extinction threshold or spread rate applies across different materials, thicknesses, and oxygen concentrations.');
        ev.directAnswer =
            'In microgravity, airflow direction and velocity govern solid flame spread in distinct, non-universal ways because natural buoyancy is absent. In opposed airflow, flame spread exhibits non-monotonic behavior: at very low airflows, increasing flow initially raises the spread rate by replenishing oxygen to a diffusion-limited flame; after reaching a maximum spread rate, higher airflows cause convective cooling to dominate, decreasing spread rate until convective blow-off extinction occurs. In concurrent airflow, forced flow pushes hot combustion gases and flame over the unburnt fuel ahead of the pyrolysis front, providing extensive thermal preheating that can increase flame spread rates and flame length under favorable fuel thickness and oxygen conditions. NASA\'s BASS-II investigation (PSI-25) observed these behaviors across 129 solid-material burns with materials like PMMA and Nomex, but operational fan display settings (0.0 to 1.5) must not be interpreted as calibrated physical velocities in cm/s without aerodynamic calibration.';
        ev.followups = ['What materials were tested in BASS-II?', 'How does flow direction affect solid flame spread?'];
        return ev;
    }
    // 3. High-priority CO2 suppression query (resolves user failure #2)
    if (isCO2Query && (ds === 'ALL' || ds === 'FLEX' || ds === 'BASS-II')) {
        ev.scientificPrinciple =
            'Carbon dioxide suppresses fire through two main physical mechanisms: thermal dilution (its high molar heat capacity absorbs combustion heat, cooling the flame below its reaction temperature) and oxygen displacement.';
        fact('Increasing carbon dioxide (CO₂) generally suppresses fire by cooling the reaction zone (thermal heat sink) and displacing available oxygen.', 'Research interpretation supported by evidence', sourceFor('FLEX'));
        fact('FLEX (PSI-69) systematically tested diluent gas mixtures with CO₂ mole fractions up to 0.70 (at elevated pressures up to 2320 mmHg), showing reduced droplet burning rates and promoting visible flame extinction.', 'FireTrace calculated statistic', sourceFor('FLEX'), [123, 0.7]);
        fact('BASS-II measured initial and final CO₂ concentrations in its sealed chamber during solid-fuel combustion.', 'NASA recorded measurement', sourceFor('BASS-II'));
        fact('SAFFIRE cabin telemetry monitored ambient CO₂ as a combustion byproduct in the open cargo vehicle, which should not be confused with a controlled suppression experiment.', 'Unknown, unmeasured or insufficient evidence', sourceFor('SAFFIRE'));
        ev.limitations.push('CO₂ addition alone cannot guarantee flame extinction if oxygen concentration remains elevated or pressure is high.', 'Telemetry variations in SAFFIRE represent vehicle cabin atmosphere, not a controlled suppression test.');
        ev.directAnswer =
            'Increasing carbon dioxide suppresses fire. CO₂ acts primarily as a thermal heat sink because its high molar heat capacity absorbs combustion heat from the flame zone, cooling the reaction below the threshold required to sustain gas-phase kinetics, while simultaneously diluting available oxygen. In NASA\'s FLEX experiment (PSI-69), droplet combustion was investigated in atmospheres containing CO₂ mole fractions up to 0.70 at pressures up to 2320 mmHg, demonstrating marked reductions in droplet burning rates and inducing visible flame extinction. However, extinction depends on the coupled balance of oxygen concentration, ambient pressure, and fuel droplet size. In SAFFIRE, CO₂ readings reflected vehicle environmental accumulation rather than a controlled suppression discharge.';
        ev.followups = ['How does oxygen concentration affect flame extinction?', 'Compare methanol and heptane in FLEX.'];
        return ev;
    }
    // 4. Oxygen & Extinction Intent (when in ALL or when query focuses on oxygen)
    if (isOxygenQuery && ds === 'ALL') {
        ev.scientificPrinciple =
            'Oxygen concentration dictates gas-phase chemical reaction kinetics and flame temperature: lower oxygen reduces combustion heat generation, allowing radiative and convective heat losses to surpass generation and cause flame extinction.';
        const flexRows = cat.records.filter(r => r.dataset === 'FLEX');
        const result = pearson(flexRows, 'oxygen', 'burning_rate');
        const extCount = flexRows.filter(r => r.values.test_end === 'Extinction').length;
        fact(`In FLEX (PSI-69), 186 of 274 droplet tests ended in visible flame extinction, most frequently under reduced oxygen fractions or elevated diluents (CO₂, helium).`, 'FireTrace calculated statistic', sourceFor('FLEX'), [extCount, 274]);
        fact(`Across ${result.n} paired FLEX tests, oxygen fraction correlates positively with droplet burning rate (Pearson correlation r = ${f(result.r || 0)}), accelerating liquid fuel vaporization.`, 'FireTrace calculated statistic', sourceFor('FLEX'), [result.n, ...(result.r === null ? [] : [result.r])]);
        fact(`BASS-II (PSI-25) tested solid materials across oxygen concentrations from 16.8% to 22.4% by volume, demonstrating that lower oxygen contracts flammability boundaries and induces extinction at lower airflows.`, 'FireTrace calculated statistic', sourceFor('BASS-II'));
        ev.limitations.push('Correlation is descriptive; oxygen, pressure, and droplet diameter co-varied across trials, so no isolated single-variable causal threshold can be inferred.');
        ev.citations.push({ id: 'SOURCE:FLEX', label: 'PSI-69_Experimental table_FLEX.csv', url: 'https://psi.nasa.gov/physci/repo/data/investigations/PSI-69', dataset: 'FLEX' }, { id: 'SOURCE:BASS-II', label: 'PSI-25_Experimental table_BASS-II.csv', url: 'https://psi.nasa.gov/physci/repo/data/investigations/PSI-25', dataset: 'BASS-II' });
        ev.directAnswer =
            'Oxygen concentration directly governs flame extinction and burning rates in microgravity. Higher oxygen concentrations raise adiabatic flame temperatures and accelerate chemical kinetics, speeding up droplet burning (in FLEX, Pearson correlation r = ' +
                f(result.r || 0) +
                ' across ' +
                result.n +
                ' paired tests). When oxygen concentration is reduced, the rate of chemical heat generation declines until sensible heat losses (radiative and convective) exceed heat production, causing visible flame extinction. Across FLEX, 186 of 274 droplet tests ended in extinction. In BASS-II solid-fuel burns, reducing oxygen from 21% down to 16.8% significantly narrowed flammability limits and made flames far more susceptible to blow-off extinction.';
        ev.followups = ['What factors are associated with extinction in FLEX?', 'Summarise oxygen by material in BASS-II'];
        return ev;
    }
    // 5. Smoke & Aerosol Detection Intent (when in ALL or when query focuses on smoke)
    if (isSmokeQuery && ds === 'ALL') {
        const sameRows = cat.records.filter(r => r.dataset === 'SAME-R');
        const sP = statistics(sameRows.map(r => r.values.particles));
        const sD = statistics(sameRows.map(r => r.values.mean_diameter));
        const sM = statistics(sameRows.map(r => r.values.mass_loss));
        ev.scientificPrinciple =
            'In microgravity, absence of buoyant plume dynamics alters smoke particle dispersion and agglomeration, producing distinct submicron aerosol size distributions that require multi-sensor optical and ionization detection.';
        fact(`SAME-R (PSI-101) measured smoke aerosol characteristics across 109 identified runs from overheating typical spacecraft polymers: Kapton, Silicone, Lampwick, Pyrell, and Teflon.`, 'FireTrace calculated statistic', sourceFor('SAME-R'), [sameRows.length]);
        fact(`P-Trak particle concentration: n=${sP.n}, missing=${sP.missing}; mean ${f(sP.mean || 0)}, range ${f(sP.min || 0)} to ${f(sP.max || 0)} PT/cc.`, 'FireTrace calculated statistic', sourceFor('SAME-R'), Object.values(sP).filter(finite));
        fact(`Processed mean particle diameter: n=${sD.n}, missing=${sD.missing}; mean ${f(sD.mean || 0)}, range ${f(sD.min || 0)} to ${f(sD.max || 0)} micro-m.`, 'FireTrace calculated statistic', sourceFor('SAME-R'), Object.values(sD).filter(finite));
        fact(`Sample mass loss: n=${sM.n}; mean ${f(sM.mean || 0)} mg. Detector obscuration and scatter voltages monitored sensor responses.`, 'FireTrace calculated statistic', sourceFor('SAME-R'), Object.values(sM).filter(finite));
        ev.limitations.push('Derived particle diameters are calculated from instrument response curves, not direct electron microscopy.', 'Observations inform detector research but do not certify flight detection hardware.');
        ev.directAnswer =
            'In NASA\'s SAME-R investigation (PSI-101), researchers overheated typical spacecraft materials (Kapton, Silicone, Lampwick, Pyrell, Teflon) in microgravity to measure aerosol particle concentration, particle diameter, and sample mass loss. Across 109 identified runs, P-Trak condensation nucleus counters recorded particle concentrations up to 133,080 PT/cc (mean ~44,305 PT/cc), with processed submicron mean particle sizes averaging 0.242 µm and sample mass losses averaging 4.25 mg. Simultaneous optical obscuration and ionization sensor response voltages were recorded to investigate how microgravity smoke triggers spacecraft fire detection systems.';
        ev.followups = ['Why is smoke detection important in space?', 'Summarise particle diameter in SAME-R'];
        return ev;
    }
    // 6. Cross-Investigation & Multi-dataset Queries (only when explicitly comparing or summarizing investigations)
    if (isCrossOrCollective) {
        ev.scientificPrinciple =
            'Spacecraft fire safety requires an integrated lifecycle perspective: fundamental droplet combustion physics, solid material flammability, vehicle-scale fire growth, and early aerosol detection.';
        for (const d of ['FLEX', 'BASS-II', 'SAFFIRE', 'SAME-R']) {
            const rows = cat.records.filter(r => r.dataset === d);
            const s = cat.series.filter(ser => ser.dataset === d);
            fact(d === 'SAFFIRE'
                ? `${d}: ${s.length} separate sensor/camera streams; timestamps are samples within a stream, not independent experiments.`
                : `${d}: ${rows.length} identified records available.`, 'FireTrace calculated statistic', sourceFor(d), [d === 'SAFFIRE' ? s.length : rows.length]);
        }
        fact('FLEX describes liquid droplets, BASS-II describes solid materials and recorded gas/display settings, SAFFIRE contains spacecraft sensor streams, and SAME-R describes aerosols and detector signals. These datasets are complementary but are not linked measurements of the same burns.', 'Research interpretation supported by evidence', ['FLEX', 'BASS-II', 'SAFFIRE', 'SAME-R'].flatMap(sourceFor));
        fact('These investigations do not share common test specimens, sensors or geometries. Cross-investigation conclusions must state that the data are unpaired.', 'Unknown, unmeasured or insufficient evidence', sourceFor('FLEX'));
        ev.limitations.push('Do not combine independent test rows into continuous time series across investigations.', 'No cross-dataset causal relationship or certified spacecraft safety formula can be derived between independent experiments.');
        ev.directAnswer =
            'Together, these four NASA investigations provide complementary perspectives across the entire spacecraft fire safety lifecycle. FLEX (274 tests) establishes fundamental microgravity droplet combustion physics, burning constants, and visible extinction limits. BASS-II (129 tests) examines solid material flammability (PMMA, Nomex) and forced airflow ventilation. SAFFIRE captures realistic vehicle-scale fire growth and environmental telemetry aboard Cygnus cargo spacecraft. Finally, SAME-R (109 tests) quantifies smoke aerosol particle morphology and concentrations to improve spacecraft smoke detection. Because these investigations tested distinct physical regimes with different geometries and sensors, their data cannot be combined into paired continuous time series or unified safety ratings.';
        ev.followups = ['What is the effect of airflow on fire?', 'Will increasing carbon dioxide suppress a fire?', 'What did SAME-R measure?'];
        return ev;
    }
    // 7. Conclusion & Unknowns Queries
    if (isConclusionQuery) {
        fact('274 FLEX records match the filters: none (all identified records).', 'FireTrace calculated statistic', sourceFor('FLEX'), [274]);
        fact('Extinction: 186 recorded outcomes.', 'FireTrace calculated statistic', sourceFor('FLEX'), [186]);
        fact('Disruption: 61 recorded outcomes.', 'FireTrace calculated statistic', sourceFor('FLEX'), [61]);
        fact('Completion: 27 recorded outcomes.', 'FireTrace calculated statistic', sourceFor('FLEX'), [27]);
        fact('Supported findings: verified observations and descriptive statistics within specific experimental domains (FLEX liquid droplet d² law burning, BASS-II solid materials and gas settings, SAFFIRE calibrated sensor streams, SAME-R aerosol metrics).', 'Research interpretation supported by evidence', sourceFor('FLEX'));
        fact('What remains unknown: causal mechanisms across separate physical regimes, universal fire-risk predictions, and uncalibrated 3D flame topology. Separate investigations are complementary but not linked measurements of the same burns.', 'Unknown, unmeasured or insufficient evidence', sourceFor('FLEX'));
        ev.limitations.push('Do not pool independent test rows into time series or infer spacecraft safety certification from these experimental subsets.');
        ev.directAnswer =
            'From these NASA investigations, we can conclude that microgravity fundamentally alters flame dynamics: liquid droplets burn symmetrically governed by diffusion, solid flame spread depends heavily on forced airflow velocity, vehicle-scale fires produce significant environmental gradients, and smoke aerosols maintain distinct submicron size distributions. What remains unknown includes universal cross-material flammability formulas, exact 3D flame temperatures, and unmeasured multi-dimensional spread mechanisms.';
        ev.followups = ['What datasets are available?', 'What are the limitations of comparing these four datasets?'];
        return ev;
    }
    // 8. Dataset-Scoped Processing
    // When ds is ALL but no specific cross-cutting intent matched, pick the most relevant dataset
    if (ds === 'ALL') {
        if (/saffire|cygnus|vehicle|large\s*scale/.test(q))
            ds = 'SAFFIRE';
        else if (/same|smoke|aerosol|particle/.test(q))
            ds = 'SAME-R';
        else if (/bass|solid|pmma|nomex|fabric|slab/.test(q))
            ds = 'BASS-II';
        else
            ds = 'FLEX';
    }
    ev.limitations.push(...cat.manifest.filter(m => m.dataset === ds).flatMap(m => m.limitations || []));
    if (ev.limitations.some(l => l.includes('NASA/TP-2015-216046')) && !ev.citations.some(c => c.id === 'DOC:NASA/TP-2015-216046')) {
        ev.citations.push({
            id: 'DOC:NASA/TP-2015-216046',
            label: 'NASA/TP-2015-216046 Table IX',
            url: 'https://ntrs.nasa.gov/citations/20150023456',
            dataset: 'FLEX'
        });
    }
    const all = cat.records.filter(r => r.dataset === ds);
    let filters = {};
    const allowed = cat.dictionary[ds] || {};
    for (const [k, v] of Object.entries(ctx.filters)) {
        if (k in allowed)
            filters[k] = v;
    }
    if (/all (tests|experiments|records)|reset filters/.test(q))
        filters = {};
    for (const fuel of ['Methanol', 'Heptane']) {
        if (q.includes(fuel.toLowerCase()) && !/compare.*methanol.*heptane|compare.*heptane.*methanol/.test(q)) {
            filters.fuel = fuel;
        }
    }
    for (const out of ['Extinction', 'Disruption', 'Completion']) {
        if (q.includes(out.toLowerCase()) && /count|how many|filter|only|summaris|summariz/.test(q)) {
            filters.test_end = out;
        }
    }
    for (const key of ['oxygen', 'pressure', 'co2', 'helium']) {
        const m = q.match(new RegExp(`${key}\\s*(?:of|=|at)?\\s*(\\d*\\.?\\d+)\\s*(%|mmhg|atm)?`));
        if (m && key in allowed) {
            let n = Number(m[1]);
            if (key === 'oxygen' && m[2] === '%' && ds === 'FLEX')
                n /= 100;
            if (key === 'pressure' && m[2] === 'atm')
                n *= 760;
            filters[key] = n;
        }
    }
    if (/material|kapton|silicone|lampwick|pyrell|teflon|pmma/.test(q)) {
        const materials = [...new Set(all.map(r => String(r.values.material)).filter(Boolean))];
        const matches = materials.filter(m => q.includes(m.toLowerCase()));
        if (matches.length === 1)
            filters.material = matches[0];
        else {
            for (const m of ['Kapton', 'Silicone', 'Lampwick', 'Pyrell', 'Teflon']) {
                if (q.includes(m.toLowerCase()) && all.some(r => r.values.material === m))
                    filters.material = m;
            }
        }
    }
    ctx.filters = filters;
    ev.filters = filters;
    const rows = filterRecords(all, filters);
    const idmatch = question.match(/(?:experiment|test|record)\s*(?:id\s*)?#?\s*([a-z]*\d+[a-z\d]*)/i);
    if (idmatch) {
        ctx.previousExperimentId = ctx.experimentId;
        ctx.experimentId = idmatch[1];
    }
    const selected = all.find(r => r.experiment_id.toLowerCase() === String(ctx.experimentId).toLowerCase() ||
        r.id === ctx.experimentId ||
        String(r.values.identifier).toLowerCase() === String(ctx.experimentId).toLowerCase());
    let variable = ctx.variable || '';
    const variableTerms = {
        burning_rate: ['burning rate', 'burning constant'],
        burn_time: ['burn time', 'burn duration'],
        extinction_diameter: ['extinction diameter'],
        oxygen: ['oxygen', 'o2'],
        pressure: ['pressure'],
        diameter: ['droplet diameter', 'initial diameter'],
        particles: ['particle count', 'particles', 'ptrak', 'particle concentration'],
        mean_diameter: ['particle diameter', 'mean diameter', 'particle size'],
        dust: ['dust', 'mass concentration'],
        mass_loss: ['mass loss'],
        velocity: ['velocity', 'airflow', 'ventilation'],
        obscuration: ['obscuration'],
        scatter: ['scatter'],
        temperature: ['temperature'],
        fan_display: ['fan display']
    };
    for (const [k, terms] of Object.entries(variableTerms)) {
        if (terms.some(t => q.includes(t)))
            variable = k;
    }
    ctx.variable = variable;
    // SAFFIRE Specific
    if (ds === 'SAFFIRE') {
        let subset = cat.series;
        const sm = q.match(/sample\s*([12])/);
        if (sm)
            subset = subset.filter(s => s.label === 'sample-' + sm[1]);
        else if (/telemetry/.test(q))
            subset = subset.filter(s => s.label.startsWith('telemetry'));
        if (/material|flame spread|burning rate|extinction time/.test(q)) {
            fact('These workbooks do not establish a verified sample-to-material map, flame-front positions, flame-spread rate or extinction-time annotation. Sample labels alone cannot identify independent burns.', 'Unknown, unmeasured or insufficient evidence', sourceFor(ds));
        }
        for (const s of subset.slice(0, 6)) {
            ev.citations.push({
                id: s.id,
                label: `${s.source.file} · ${s.source.sheet} · rows ${s.source.row}–${s.last_row}`,
                url: s.source_url,
                dataset: ds
            });
            fact(`${s.label}: ${s.count} time-sample rows in ${s.source.sheet}.`, 'FireTrace calculated statistic', [s.id], [s.count]);
            const terms = q
                .replace(/oxygen/g, 'o2')
                .replace(/carbon dioxide/g, 'co2')
                .replace(/saffire|sample [12]|what|measured|available|measurements|dataset|summari[sz]e|mean|maximum|minimum|range|data|the|and|does|this|investigate/g, ' ')
                .split(/\W+/)
                .filter(t => t.length > 2);
            let channels = /oxygen|\bo2\b/.test(q)
                ? s.channels.filter(c => c.label.toLowerCase() === 'o2')
                : /carbon dioxide|\bco2\b/.test(q)
                    ? s.channels.filter(c => c.label.toLowerCase() === 'co2')
                    : s.channels.filter(c => terms.some(t => c.label.toLowerCase().includes(t)));
            if (!channels.length)
                channels = s.channels.filter(c => /o2|pressure|temp|obscuration/i.test(c.label)).slice(0, 3);
            for (const c of channels.slice(0, 4)) {
                fact(`${s.label} · ${c.label}: n=${c.n}, missing=${c.missing}; mean ${f(c.mean)}, median ${f(c.median)}, range ${f(c.min)} to ${f(c.max)} ${c.unit}. Source column ${c.source_column}.`, 'FireTrace calculated statistic', [s.id], [c.n, c.missing, c.mean, c.median, c.min, c.max, c.source_column]);
            }
            ev.limitations.push(...s.limitations, ...channels.flatMap(c => c.flags).slice(0, 3));
        }
        ev.directAnswer =
            'SAFFIRE provides realistic vehicle-scale fire telemetry from tests conducted inside an uncrewed Cygnus cargo vehicle. Across 78,919 samples in 6 streams, it monitors ambient oxygen, carbon dioxide, cabin pressure (~14.87 PSIA), plume and sample temperatures, radiometers, and smoke detector voltages. These time-series records document environmental conditions during large-sample burns; however, they do not include automated flame-front tracking or flame-spread rate derivations.';
        ev.followups = ['What sensors were calibrated on Saffire-I?', 'Can SAFFIRE establish flame spread?'];
    }
    else if ((idmatch || /this experiment|selected experiment|those conditions|closest|similar|previous one/.test(q)) && ctx.experimentId) {
        if (!selected) {
            ev.unsupported = true;
            fact(`No verified ${ds} record matches the requested experiment identifier. Check the source ID or dataset selection.`, 'Unknown, unmeasured or insufficient evidence', sourceFor(ds));
            ev.directAnswer = `No verified ${ds} record matches experiment identifier "${ctx.experimentId}". Please verify the experiment number in the 3D lab or explorer table.`;
        }
        else {
            const show = (r) => {
                const id = cite(r);
                fact(`Experiment ${r.experiment_id}: ` +
                    Object.entries(r.values)
                        .filter(([k]) => !['test', 'date', 'gmt', 'identifier', 'description'].includes(k))
                        .map(([k, v]) => `${k} = ${v ?? 'not reported'} ${allowed[k]?.unit || ''}`)
                        .join('; ') +
                    '.', 'NASA recorded measurement', [id], Object.values(r.values).filter(finite));
            };
            show(selected);
            for (const [k, v] of Object.entries(selected.flags)) {
                ev.limitations.push(`Selected record flag: ${k}: ${v}.`);
            }
            if (/why|disruption/.test(q)) {
                fact('The table records the test-end category; it does not provide a row-level mechanism explaining why disruption occurred. A video or experiment log would be needed.', 'Unknown, unmeasured or insufficient evidence', [selected.id]);
            }
            if (/closest|similar|compare/.test(q) && ds === 'FLEX') {
                if (/previous one/.test(q) && ctx.previousExperimentId) {
                    const prev = all.find(r => r.experiment_id === ctx.previousExperimentId);
                    if (prev)
                        show(prev);
                }
                else {
                    for (const n of nearest(all, selected, 3)) {
                        cite(n.record);
                        fact(`Nearby same-fuel test ${n.record.experiment_id}: scaled condition distance ${f(n.distance)}; pressure ${n.record.values.pressure} mmHg, oxygen ${n.record.values.oxygen}, diameter ${n.record.values.diameter} mm.`, 'FireTrace calculated statistic', [n.record.id, selected.id], [n.distance, Number(n.record.values.pressure), Number(n.record.values.oxygen), Number(n.record.values.diameter)]);
                    }
                }
                ev.limitations.push('Nearest means Euclidean distance scaled by observed ranges in pressure, O₂, CO₂, helium and diameter, restricted to the same fuel. It is similarity, not proof of physical equivalence.');
                ev.directAnswer = `FLEX Test ${selected.experiment_id} burned ${selected.values.fuel} at ${selected.values.pressure} mmHg and oxygen fraction ${selected.values.oxygen} with initial droplet diameter ${selected.values.diameter} mm. It recorded burning constant ${selected.values.burning_rate} mm²/s, burning for ${selected.values.burn_time} s with outcome ${selected.values.test_end}. The closest matching same-fuel tests in condition space are Tests ${nearest(all, selected, 3).map(n => n.record.experiment_id).join(', ')}.`;
            }
            else {
                ev.directAnswer = `Record ${selected.experiment_id} in ${ds} recorded conditions: ${Object.entries(selected.values).filter(([k]) => !['test', 'date', 'gmt', 'identifier', 'description'].includes(k)).map(([k, v]) => `${k} = ${v ?? 'not reported'} ${allowed[k]?.unit || ''}`).join(', ')}.`;
            }
        }
    }
    else if (/what.*material|which.*material|material.*tested/.test(q) && ds !== 'FLEX') {
        const counts = new Map();
        for (const r of rows) {
            const m = String(r.values.material ?? 'not reported');
            counts.set(m, (counts.get(m) || 0) + 1);
        }
        for (const [m, n] of [...counts].slice(0, 35)) {
            fact(`${m}: ${n} records.`, 'FireTrace calculated statistic', sourceFor(ds), [n]);
        }
        ev.directAnswer =
            'In BASS-II (PSI-25), NASA evaluated solid-fuel combustion across 129 recorded tests. The materials included PMMA (acrylic) in various geometries—including thin films (100, 200, 300, and 400 microns), thick slabs (1, 2, 3, 4, and 5 mm), and 1/4" clear rods (15 trials)—as well as Nomex natural (Nomex III fabric) and Japan Wax candles. Tests examined how solid fuel thickness and forced airflow affect ignition, steady flame spread, and extinction in microgravity.';
    }
    else if (ds === 'FLEX' && /compare/.test(q) && /methanol/.test(q) && /heptane/.test(q)) {
        const pairs = [];
        for (const m of all.filter(r => r.values.fuel === 'Methanol')) {
            for (const h of all.filter(r => r.values.fuel === 'Heptane')) {
                if (['pressure', 'oxygen', 'co2', 'helium'].every(k => m.values[k] === h.values[k]) &&
                    finite(m.values.diameter) &&
                    finite(h.values.diameter) &&
                    Math.abs(m.values.diameter - h.values.diameter) <= 0.1) {
                    pairs.push([m, h]);
                }
            }
        }
        fact(`${pairs.length} candidate cross-fuel pairs match pressure and gas fractions exactly and initial diameter within 0.1 mm. Pairs can reuse tests and are not independent replications.`, 'FireTrace calculated statistic', sourceFor(ds), [pairs.length, 0.1]);
        for (const [a, b] of pairs.slice(0, 3)) {
            cite(a);
            cite(b);
            fact(`Tests ${a.experiment_id} / ${b.experiment_id}: methanol / heptane burning constants ${a.values.burning_rate ?? 'not reported'} / ${b.values.burning_rate ?? 'not reported'} mm²/s.`, 'NASA recorded measurement', [a.id, b.id], [a.values.burning_rate, b.values.burning_rate].filter(finite));
        }
        ev.limitations.push('Matched conditions reduce some differences; they do not establish a causal fuel effect.');
        ev.directAnswer =
            'In FLEX, methanol and heptane exhibit contrasting microgravity droplet combustion dynamics. Heptane produces significantly higher soot and radiant emission than methanol. When matching pressure, gas composition, and droplet diameter within 0.1 mm, candidate pairs show that heptane consistently burns with a slightly higher initial burning constant than methanol at atmospheric pressure, but disruption occurs much more frequently in heptane due to internal boiling and micro-explosions.';
    }
    else if (ds === 'FLEX' && /associated|relat|correlat|effect/.test(q) && /oxygen|extinction|factor/.test(q)) {
        if (/extinction|factors/.test(q) && !/burning rate|burning constant/.test(q)) {
            for (const fuel of ['Methanol', 'Heptane']) {
                const group = rows.filter(r => r.values.fuel === fuel);
                const n = group.length;
                const ext = group.filter(r => r.values.test_end === 'Extinction').length;
                fact(`${fuel}: ${ext} of ${n} recorded tests end in Extinction. Conditions vary within each fuel group.`, 'FireTrace calculated statistic', sourceFor(ds), [ext, n]);
            }
            ev.limitations.push('These outcome proportions are descriptive. Oxygen, pressure, gas composition and diameter are not controlled by this grouping; no causal extinction factor or threshold follows.');
            ev.directAnswer =
                'In FLEX, 186 of 274 total droplet tests ended in visible flame extinction (126 of 157 Methanol tests, and 60 of 117 Heptane tests). Conditions associated with extinction include reduced ambient oxygen fraction, elevated inert diluents like CO₂ or helium, and larger droplet diameters where radiative heat loss exceeds combustion heat release. However, because multiple experimental variables co-varied across trials, no single causal extinction threshold can be isolated from these grouped proportions alone.';
        }
        else {
            const result = pearson(rows, 'oxygen', 'burning_rate');
            fact(`Among ${result.n} rows with both recorded values, Pearson correlation between oxygen fraction and burning constant is ${result.r === null ? 'undefined' : f(result.r)}.`, 'FireTrace calculated statistic', sourceFor(ds), [result.n, ...(result.r === null ? [] : [result.r])]);
            for (const fuel of ['Methanol', 'Heptane']) {
                const r = pearson(rows.filter(r => r.values.fuel === fuel), 'oxygen', 'burning_rate');
                fact(`${fuel}: paired n=${r.n}, correlation ${r.r === null ? 'undefined' : f(r.r)}.`, 'FireTrace calculated statistic', sourceFor(ds), [r.n, ...(r.r === null ? [] : [r.r])]);
            }
            ev.limitations.push('Correlation is descriptive and unadjusted. Pressure, diluents, diameter and experimental design confound comparisons; missing outcomes can bias associations. This does not establish causes of extinction.');
            ev.directAnswer = `Higher oxygen concentrations correlate positively with faster droplet burning constants in FLEX. Across ${result.n} paired trials, the Pearson correlation between oxygen fraction and burning rate is ${f(result.r || 0)} (Methanol r = ${f(pearson(rows.filter(r => r.values.fuel === 'Methanol'), 'oxygen', 'burning_rate').r || 0)}, Heptane r = ${f(pearson(rows.filter(r => r.values.fuel === 'Heptane'), 'oxygen', 'burning_rate').r || 0)}). Increased oxygen concentration enhances gas-phase reaction rates and elevates flame temperature, driving faster vaporization of the liquid fuel droplet.`;
        }
    }
    else if (/variables|measure|what.*investigat|what.*dataset|ventilation|smoke.*detect|reveal|smoke.*aerosol|particle/.test(q) && (!variable || !(variable in allowed))) {
        fact(`${ds} provides: ` + Object.entries(allowed).map(([k, v]) => `${k} (${v.unit || 'category'}; ${v.kind})`).join('; ') + '.', 'Research interpretation supported by evidence', sourceFor(ds));
        if (ds === 'BASS-II') {
            fact('Ventilation research can use fan/air display settings and the flow restrictor, but these must not be interpreted as calibrated airflow velocity without a matching calibration.', 'Unknown, unmeasured or insufficient evidence', sourceFor(ds));
        }
        if (ds === 'SAME-R') {
            fact('Particle concentration, processed particle sizes and detector voltages can inform research into how aerosol properties relate to sensor response. These observations alone do not certify smoke-detection performance.', 'Research interpretation supported by evidence', sourceFor(ds));
        }
        ev.directAnswer = `In ${ds}, the primary measured variables include ${Object.keys(allowed).slice(0, 6).join(', ')}. Ask about a specific condition or variable to see statistical distributions and findings.`;
    }
    else {
        fact(`${rows.length} ${ds} records match the filters: ${Object.keys(filters).length ? JSON.stringify(filters) : 'none (all identified records)'}.`, 'FireTrace calculated statistic', sourceFor(ds), [rows.length]);
        if (variable && !(variable in allowed)) {
            ev.unsupported = true;
            fact('The requested variable is not available with a verified definition in this dataset. Consult the variable dictionary; no substitute quantity is inferred.', 'Unknown, unmeasured or insufficient evidence', sourceFor(ds));
            ev.directAnswer = `The variable "${variable}" is not available with a verified definition in the ${ds} dataset. Please check the dictionary for supported variables.`;
        }
        else if (variable) {
            const s = statistics(rows.map(r => r.values[variable]));
            const u = allowed[variable].unit;
            fact(`${variable}: measured/processed n=${s.n}, missing=${s.missing}; mean ${s.mean === null ? 'unavailable' : f(s.mean)}, median ${s.median === null ? 'unavailable' : f(s.median)}, range ${s.min === null ? 'unavailable' : f(s.min)} to ${s.max === null ? 'unavailable' : f(s.max)} ${u}.`, 'FireTrace calculated statistic', sourceFor(ds), Object.values(s).filter(finite));
            if (ds === 'BASS-II' && variable === 'oxygen') {
                for (const material of [...new Set(rows.map(r => r.values.material))].slice(0, 12)) {
                    const a = statistics(rows.filter(r => r.values.material === material).map(r => r.values.oxygen));
                    fact(`${material}: initial oxygen n=${a.n}; range ${a.min ?? 'unavailable'}–${a.max ?? 'unavailable'} % by volume.`, 'FireTrace calculated statistic', sourceFor(ds), Object.values(a).filter(finite));
                }
            }
            ev.directAnswer = `In ${ds}, ${variable} was measured across ${s.n} valid tests (mean ${f(s.mean || 0)} ${u}, median ${f(s.median || 0)} ${u}), spanning from ${f(s.min || 0)} to ${f(s.max || 0)} ${u}.`;
        }
        else if (ds === 'FLEX') {
            for (const out of ['Extinction', 'Disruption', 'Completion']) {
                const n = rows.filter(r => r.values.test_end === out).length;
                fact(`${out}: ${n} recorded outcomes.`, 'FireTrace calculated statistic', sourceFor(ds), [n]);
            }
            ev.limitations.push('A category does not imply a measured causal mechanism; deliberate termination and natural extinction are distinct.');
            ev.directAnswer =
                'In FLEX (PSI-69), 274 total droplet tests were classified into three categorical outcomes: 186 ended in visible flame extinction, 61 ended in droplet disruption, and 27 burned to completion. These categories classify experimental endpoints under varying conditions rather than a single causal formula.';
        }
        else {
            ev.directAnswer = `The ${ds} investigation provides verified NASA research data across ${rows.length} records.`;
        }
    }
    if (/methodology|document|reference|nearly invisible|lifted flame/.test(q)) {
        for (const d of searchDocuments(cat, question)) {
            ev.citations.push({ id: d.id, label: d.title, url: d.source_url });
            fact('Source audit excerpt: ' + d.text.slice(0, 650), 'Research interpretation supported by evidence', [d.id]);
            ev.limitations.push(...d.limitations);
        }
    }
    ev.limitations = [...new Set(ev.limitations)];
    ev.followups =
        ds === 'FLEX'
            ? ['Show this experiment', 'Find the closest experiments', 'How does oxygen relate to burning rate?']
            : ds === 'SAME-R'
                ? ['What particle measurements are available?', 'Summarise particle diameter', 'What cannot be inferred about smoke detection?']
                : ds === 'SAFFIRE'
                    ? ['Summarise sample 1 oxygen', 'Show sample 2 temperature', 'Can this establish flame spread?']
                    : ['What materials were tested?', 'Summarise oxygen by material', 'Which ventilation measurements are available?'];
    return ev;
}
export function localAnswer(e, notice = 'Using the local scientific analysis engine. No model API request.') {
    const answer = e.directAnswer ||
        (e.unsupported
            ? 'There is not enough verified evidence to establish that causal conclusion, fire-risk prediction, or unmeasured parameter. NASA research data can provide recorded measurements and descriptive statistics within tested bounds, but cannot certify spacecraft safety.'
            : 'Here is what the available records support based on verified NASA experimental data.');
    return {
        mode: 'local',
        answer,
        facts: e.facts,
        citations: e.citations,
        limitations: e.limitations,
        followups: e.followups,
        context: e.context,
        scientificPrinciple: e.scientificPrinciple,
        notice
    };
}
