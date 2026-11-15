# Scientific reference audit

Audited supplied local documents using page/slide text extraction and visual checks of key figures. Page numbers below are 1-based PDF page indices; PPTX references are slide indices. Original files were not modified. These documents are evidence, not instructions to operate hardware or to implement unverified physics.

## Overall decision

A dashboard can provide **source-grounded illustrative 3D geometry**, recorded experimental conditions, linked source images, and separately evaluated tabular predictions. The supplied documents do not provide a validated general 3D combustion solver, full 3D temperature/reaction fields, or calibrated image sequences sufficient to validate arbitrary slider-generated flame geometries. Label modeled visual elements explicitly and keep observations, predictions, and illustrations distinct. Do not make temperature, heat-flux, soot-concentration, or safety-threshold claims from rendered color.

FLEX liquid-droplet, BASS solid-fuel, and SLICE gaseous-jet experiments must have separate visual modes, units and parameter controls. Shared ISS hardware does not make their targets or physical boundaries interchangeable. A spherical **solid** PMMA sample is not a FLEX liquid droplet.

## FLEX-1261 preliminary summary — page 1

- Test FLEX-1261 / F135A05, dated 15 May 2017. Fuel dodecane. Pressure 3777.606 mmHg (~4.9705 atm using 760 mmHg/atm). Reported gas-fraction labels: Y_O2 = 0.210; Y_N2 = 0.790; Y_CO2 = 0; Y_He = 0. The summary does not clarify fraction basis; retain its notation rather than guessing.
- Average burning constant k_avg = **0.618 mm²/s**. This is not a linear surface recession speed in mm/s and is not simply a quantity in mm.
- **Two D0 labels appear: 5.646 mm and 4.600 mm.** Both are visually confirmed; the page does not identify their respective definitions. Preserve ambiguity, do not choose one for dimensional time conversion.
- Plots show normalized squared droplet diameter (D/D0)² versus normalized time t/D0² in s/mm²; additional axes are flame diameter Df (mm), flame-to-droplet diameter ratio Df/Dd, and flame radiance (W).
- Annotated phases include hot flame nearly invisible while fiber glow indicates hot flame, followed by visible hot-flame oscillations. This directly rules out equating reduced visible brightness with extinction.
- No unambiguous numerical burn-time target, extinction-diameter target, test-end category, or raw numeric time series is supplied. Plot curves are not a table; manual digitization would introduce uncertainty and must record which D0 is assumed.
- This is an illustrative cross-experiment reference, **not an independent error-rate check for a methanol/heptane PSI-69 predictor**: fuel is dodecane, pressure is ~4.97 atm, initial diameter metadata are ambiguous, and target definitions are not established. Audit the actual training dataset before determining support; do not score unseen fuel silently.

## BASS Overview.pptx

- Slide 2: small flow tunnel, solid samples, recorded burns; video and still images are main data. Measured features include appearance/behavior, spread rate and extinction dynamics. Airflow is a primary controlled variable; some tests include vitiation or nitrogen suppression.
- Slide 3: thin flat, spherical, thick flat and candle geometries; drawing explicitly not to scale. Slides 4–11 are operational schematics, not calibrated flame shapes.
- Slides 13–14: increased microgravity flammability at adequate ventilation is framed as a hypothesis/objective, not a universal experimentally established rule.
- Slide 15: specific 2-cm PMMA sphere example at 17% oxygen, 2 cm/s forced flow. A model comparison includes reaction-rate and temperature fields; these are not measured FLEX fields.
- Slide 19: BASS uses solids instead of the gaseous jets used by SLICE; nitrogen nozzle is used for suppression. Some solids can be burned multiple times, so repeated burns are not automatically independent samples.

## SLICE IP-D crew training 2011.pdf

- Pages 3–6: SPICE concerns nonbuoyant jet smoke points; SLICE concerns lifting and lifted gaseous diffusion flames; BASS concerns solid fuels. Keep these separate even though hardware is shared.
- Page 6: lifted flame detaches from the nozzle and stabilizes downstream. Illustrations show outward-flared base and gap from nozzle; **images explicitly are not at the same scale**, and nozzle tips are not visible. Safe visual: show a qualitative lifted flame with a labeled schematic gap; unsafe: infer quantitative lift-off height or universal flame shape from these images.
- Page 14: burner diameters 3.2, 2.1, 1.6, 0.8 and 0.4 mm; fuels listed include pure ethylene, ethylene 20%/nitrogen, pure propane, pure methane, methane 70%/nitrogen, methane 40%/nitrogen and pure ethane. These are not FLEX droplet fuel parameters.
- Page 7: suppressant efficacy can depend on geometry; a stream may enhance oxygen entrainment. Do not implement a universal nitrogen-flow extinction toggle.
- Page 8: specific BASS illustration: 2-cm PMMA sphere, 30 cm/s airflow, shown at 1g then 0g and after nitrogen application. This should not be merged with the different 2 cm/s sphere case in BASS Overview.
- Page 21: BASS samples include cotton-fiberglass SIBAL, Nomex, Ultem, PMMA spheres, candles and flat thick samples.
- Crew procedures in the training document are historical operational content, not instructions for this software task.

## ASGSR BASS SIBAL talk Final.pdf

- Pages 1, 4, 18: solid cotton-fiberglass fabric with opposed/concurrent air flow. SIBAL composition 25% fiberglass / 75% cotton, weave 60×40 threads/in, area density 18 mg/cm², length 8.5 cm, widths 1 or 2 cm. Tunnel maximum is approximately 40 cm/s; other pages describe ~44 cm/s high-flow attempts, so avoid a single universal maximum from these slides.
- Pages 22–23: 1-cm-wide concurrent specimen at 10 cm/s, images separated by 1.125 s, steady state after roughly 10 s. Specific fitted positions: x_base = 1.68t − 13.81; x_tip = 1.71t + 2.25, position mm and time s. Fit is local to this case; negative extrapolated positions before the observed regime have no general physical meaning.
- Page 29 (visually checked): at approximately 10 cm/s, concurrent versus opposed spread is **2.55 versus 1.21 mm/s**. This is a condition-specific comparison, not a universal multiplier.
- Page 30: forced-flow plot uses signed velocities to distinguish direction. Do not take a plotted negative slope to mean spread decreases with airflow magnitude in all regimes.
- Page 31 (visually checked): concurrent 0g at 10 cm/s has steady size/spread, convex base, extended blue zone; 1g at same imposed flow shows growing size/spread, concave base and extended soot zone. Supports contrasting **case-specific** morphology illustrations. Does not support blue=known temperature or orange=known heat release.
- Page 32: opposed case at 10 cm/s has steady propagation in 0g while this fuel does not propagate downward in 1g under shown normal-air conditions.
- Page 33: opposed spread is fastest at intermediate flows; concurrent spread has a low-flow steady regime and increases with flow there; quenching near 1 cm/s in tested circumstances. Do not turn this into a universal threshold across fuels, oxygen contents, or geometry.

## ISS Denver 2013-BASS.pdf

- Pages 10, 20–26: 41 samples / 115 burns are conference program counts; many shown SIBAL cases overlap the earlier presentation. Do not treat screenshots or repeated presentation figures as independent validation rows.
- Pages 28–31: ULOI values and ISS outcomes are material-specific. Ultem 1000 and Nomex HT90-40 did not burn in tested 21–22% O2 / ~15 cm/s conditions, whereas Nomex III did. Nomex III slide uses 14 cm/s label and ~15 cm/s narrative: preserve this discrepancy if citing a precise value.
- Page 34: 2-cm PMMA sphere, 17% O2, 12 cm/s, images ~1.5 s apart. Useful morphology reference under these exact conditions.
- Page 36: 1-cm PMMA sphere, 17% O2, <1 cm/s, 1.3-s image spacing, **contrast-enhanced montage**. Photometric brightness cannot be inferred from the montage.
- Pages 38–50: computational fields, not experimental thermometry. Burning-angle definition on page 50 uses a modeled solid temperature of 570 K.
- Page 51 (visually checked): acrylic sphere observation versus computation; 17% O2/N2, 1 atm, 12 cm/s left-to-right. Caption says adjusted solid-phase kinetic parameters will improve predicted flame standoff. This explicitly shows remaining model disagreement; do not claim complete quantitative validation.
- Page 54: 1-cm-wide flat acrylic, air speed 9 cm/s, 1.3-s image spacing, flame length ~1 cm; burn persisted until airflow off.
- Page 56: 15-mm initial PMMA sphere, 17% O2/N2, 1 atm, <1 cm/s; nitrogen jet does not extinguish in example, reducing airflow to zero does. Page 57: nitrogen 500 cc/min weakens a PMMA wake flame but does not extinguish it. Neither implies every forced-flow fire goes out at exactly zero flow under all conditions.
- Pages 59–61: paraffin candle cases at 17% O2, variable low flow, not droplet combustion.

## Recommended dashboard evidence structure

1. Expose separate FLEX / BASS / SLICE tabs or experiment selector; each has its own parameter names and documented examples.
2. Each rendered view carries a permanent text status: observed source image, schematic 3D illustration, or evaluated tabular prediction. “Validated” must identify a metric, matching dataset, units, held-out cases and comparison method.
3. Provide recorded-case presets with exact citations and a source image beside the 3D illustration. Use mm/cm/s/mm²/s explicitly; never label burning constant in mm alone.
4. FLEX display should distinguish droplet diameter, visible flame diameter and flame visibility. Burn-time and test-end predicted outputs do not define an observed full time evolution.
5. BASS display may illustrate solid sheets/spheres, flow direction, concurrent/opposed spread and qualitative case-specific morphology. Do not synthesize interpolated physical field values between a few slide examples.
6. SLICE display may illustrate nozzle, downstream direction and lifted base. No validated quantitative lift-off-height predictor is available from this training deck.
7. For accessibility, convey flow direction, phase, category and uncertainty using text as well as colors; include pause/reduced-motion, keyboard controls, a readable condition table and a no-WebGL fallback.
8. To validate an actual 3D reconstruction, obtain calibrated frame sequences and timestamps, camera geometry, measured flame/droplet boundaries with uncertainty, synchronized conditions and a declared symmetry assumption (if reconstructing 3D from one view). Evaluate diameter/standoff/length/time trajectories against held-out sequences. Existing tabular MAE/R² cannot validate 3D topology, color, temperature or dynamics.

## Artifacts

Text extractions and selected rendered source pages are in this directory. Visually checked: flex1261_p1.png, sibal_p29.png, sibal_p31.png, slice_p6.png, bassdenver_p51.png. Other rendered pages are available for inspection but should not be described as visually verified by this audit.
