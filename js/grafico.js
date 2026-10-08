// grafico.js — grafico payoff: range, breakeven, POP, zoom e touch
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.
  // ============================================================
  // PAYOFF COMBINATO
  // ============================================================
  // P&L di una gamba futures/azioni a un prezzo S: somma del P&L realizzato
  // (chiusure, già incassato, non dipende da S) e del P&L aperto (mark-to-market
  // sulla posizione residua). Il realizzato è una traslazione verticale.
  function pnlFutureApertoAt(S, col, res) {
    if (!res) return 0;
    const tipo = res.tipo;
    if (!tipo || tipo === '-') return 0;
    const molt = MOLTIPLICATORI[tipo] || 0;

    const pnlRealizzato = res.pnlRealizzato || 0;

    let pnlAperto = 0;
    if (res.qtaNetta !== 0 && !isNaN(res.mediaPulita)) {
      const segno = res.qtaNetta > 0 ? 1 : -1;
      const q = Math.abs(res.qtaNetta);
      pnlAperto = (S - res.mediaPulita) * q * segno * molt - feeLatoFuture(tipo) * q;
    }

    return pnlRealizzato + pnlAperto;
  }

  function firstExpiryOpzioni(scheda) {
    const today = dataAnalisiDate();
    let minScad = null;
    (scheda.opzioni || []).forEach(o => {
      if (o.attivo === false || o.stato === 'CHIUSA') return;
      if (!o.scadenza) return;
      const T = yearsBetween(today, o.scadenza);
      if (T == null || T < 0) return;
      if (minScad === null || o.scadenza < minScad) minScad = o.scadenza;
    });
    return minScad;
  }

  // Prezzo di carico effettivo di un'opzione: se premio vuoto → teorico allo spot.
  function premioCarico(opz) {
    if (opz.premio && opz.premio !== 0) return opz.premio;
    const spot = parseFloat(el('prezzoSpot').value) || 0;
    if (!(spot > 0)) return 0;
    const tipo = (opz.tipo || 'PUT').toLowerCase() === 'call' ? 'call' : 'put';
    const today = dataAnalisiDate();
    const T = opz.scadenza ? yearsBetween(today, opz.scadenza) : 0;
    const teoSpot = modelPrice(spot, opz, T, tipo);
    return teoSpot === null ? 0 : teoSpot;
  }

  function pnlOpzioneAt(S, opz, mode, firstExpiry) {
    if (opz.attivo === false || opz.stato === 'CHIUSA') return 0;
    const qta = opz.qta || 0;
    if (qta === 0) return 0;
    const K = opz.strike || 0;
    const tipo = (opz.tipo || 'PUT').toLowerCase() === 'call' ? 'call' : 'put';
    const intrinseco = tipo === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);

    let valoreOpzione = 0;
    if (mode === 'expiry') {
      if (firstExpiry && opz.scadenza && opz.scadenza > firstExpiry) {
        const Tres = yearsBetween(firstExpiry, opz.scadenza);
        const teo = modelPrice(S, opz, Tres, tipo);
        valoreOpzione = teo === null ? intrinseco : teo;
      } else {
        valoreOpzione = intrinseco;
      }
    } else {
      const today = dataAnalisiDate();
      const T = opz.scadenza ? yearsBetween(today, opz.scadenza) : 0;
      const teo = modelPrice(S, opz, T, tipo);
      valoreOpzione = teo === null ? intrinseco : teo;
    }

    const premio = premioCarico(opz);
    const side = opz.pos === 'SELL' ? -1 : 1;
    const fee = feeLatoOpzione() * qta;
    return (valoreOpzione - premio) * side * qta * moltOpz(opz) - fee;
  }

  function aggiornaStileCash() {
    const inp = el('cash');
    if (!inp) return;
    const v = parseFloat(inp.value) || 0;
    inp.classList.remove('pos', 'neg');
    if (v > 0) inp.classList.add('pos');
    else if (v < 0) inp.classList.add('neg');
  }

  // Cash manuale (annotato dall'utente): entra se non escluso.
  function cashAttivo() {
    const c = (typeof stato.cash === 'number') ? stato.cash : 0;
    return stato.cashEscluso ? 0 : c;
  }

  // P&L combinato a un prezzo S: cash + futures/azioni (realizzato + aperto) + opzioni.
  function pnlCombinatoAt(scheda, S, mode, resNES, resMES) {
    let tot = cashAttivo();
    tot += pnlFutureApertoAt(S, 'NES', resNES);
    tot += pnlFutureApertoAt(S, 'MES', resMES);
    const firstExp = mode === 'expiry' ? firstExpiryOpzioni(scheda) : null;
    (scheda.opzioni || []).forEach(opz => {
      tot += pnlOpzioneAt(S, opz, mode, firstExp);
    });
    return tot;
  }

  function deltaNettoTotale(scheda, resNES, resMES) {
    let d = 0;
    if (resNES && resNES.qtaNetta !== 0) {
      const molt = MOLTIPLICATORI[resNES.tipo] || 0.5;
      d += resNES.qtaNetta * (molt / 5);
    }
    if (resMES && resMES.qtaNetta !== 0) {
      const molt = MOLTIPLICATORI[resMES.tipo] || 5;
      d += resMES.qtaNetta * (molt / 5);
    }
    (scheda.opzioni || []).forEach(opz => {
      if (opz.attivo === false || opz.stato === 'CHIUSA') return;
      const g = calcolaGrecheOpzione(opz);
      if (!isFinite(g.delta)) return;
      const segno = opz.pos === 'SELL' ? -1 : 1;
      const qta = opz.qta || 0;
      d += segno * qta * g.delta * (moltOpz(opz) / 5);
    });
    return d;
  }

  let chartView = {
    xMin: null, xMax: null,
    baseMin: null, baseMax: null,
    lastResNES: null, lastResMES: null, lastSpot: 0,
    lastResNESPrec: null, lastResMESPrec: null, hasPrecedente: false,
    breakevens: [],
    sigma: null,
    _sig: null
  };
  let chartGeom = null;
  let chartHoverBound = false;
  let chartInteractBound = false;
  let isPanning = false;
  let panStartX = 0;
  let panStartMin = 0;
  let panStartMax = 0;
  let touchGesture = null;
  let chartRedrawScheduled = false;

  function scheduleChartRedraw() {
    if (chartRedrawScheduled) return;
    chartRedrawScheduled = true;
    requestAnimationFrame(() => {
      chartRedrawScheduled = false;
      redrawChartFromView();
    });
  }

  function defaultChartRange(spot) {
    const rangePct = 0.12;
    let minS = spot * (1 - rangePct);
    let maxS = spot * (1 + rangePct);
    const minRange = 80;
    if (maxS - minS < minRange * 2) {
      minS = spot - minRange;
      maxS = spot + minRange;
    }
    return { minS: Math.max(1, minS), maxS };
  }

  // Ancore di struttura: spot + medie + prezzi movimenti + strike opzioni.
  // Se `scheda` è passata, usa quella; altrimenti la scheda attiva.
  function collectStructureAnchors(spot, scheda) {
    const pts = [spot];
    const target = scheda || schedaAttiva();
    if (!target) return pts.filter(p => isFinite(p) && p > 0);
    ['NES', 'MES'].forEach(col => {
      const res = calcolaColonna(target, col);
      if (res && !isNaN(res.mediaPulita) && res.qtaNetta !== 0) pts.push(res.mediaPulita);
      (target[col] || []).forEach(m => {
        if (m.attivo === false) return;
        if (m.prezzoPulito > 0) pts.push(m.prezzoPulito);
      });
    });
    (target.opzioni || []).forEach(o => {
      if (o.attivo === false) return;
      const k = parseFloat(o.strike) || 0;
      if (k > 0) pts.push(k);
    });
    return pts.filter(p => isFinite(p) && p > 0);
  }

  // Range di scansione per i BE: include anche la scheda precedente (se esiste).
  function scanRangeForBE(spot) {
    let minS = Math.max(1, spot * 0.55);
    let maxS = spot * 1.45;
    const anchors = collectStructureAnchors(spot, schedaAttiva());
    const prec = schedaPrecedente();
    if (prec) {
      collectStructureAnchors(spot, prec).forEach(a => anchors.push(a));
    }
    anchors.forEach(a => {
      minS = Math.min(minS, Math.max(1, a * 0.7));
      maxS = Math.max(maxS, a * 1.3);
    });
    return { minS, maxS };
  }

  function computeSmartChartRange(spot, breakevens) {
    const anchors = collectStructureAnchors(spot, schedaAttiva());
    const prec = schedaPrecedente();
    if (prec) {
      collectStructureAnchors(spot, prec).forEach(a => anchors.push(a));
    }
    const bes = (breakevens || []).filter(b => isFinite(b) && b > 0);

    let minS, maxS;

    if (bes.length >= 2) {
      const lo = Math.min(...bes);
      const hi = Math.max(...bes);
      const span = Math.max(hi - lo, 40);
      const pad = span * 0.35;
      minS = lo - pad;
      maxS = hi + pad;
      if (spot < minS) minS = spot - span * 0.15;
      if (spot > maxS) maxS = spot + span * 0.15;
    } else if (bes.length === 1) {
      const be = bes[0];
      const dist = Math.abs(be - spot);
      const pad = Math.max(dist * 0.45, 50);
      if (be < spot) {
        minS = be - pad;
        maxS = spot + Math.max(pad * 0.7, 40);
      } else {
        minS = spot - Math.max(pad * 0.7, 40);
        maxS = be + pad;
      }
    } else {
      const def = defaultChartRange(spot);
      minS = def.minS;
      maxS = def.maxS;
      if (anchors.length > 1) {
        const lo = Math.min(...anchors);
        const hi = Math.max(...anchors);
        const span = Math.max(hi - lo, 60);
        minS = Math.min(minS, lo - span * 0.25);
        maxS = Math.max(maxS, hi + span * 0.25);
      }
    }

    const minWidth = Math.max(60, spot * 0.04);
    if (maxS - minS < minWidth) {
      const mid = (minS + maxS) / 2;
      minS = mid - minWidth / 2;
      maxS = mid + minWidth / 2;
    }

    minS = Math.max(1, minS);
    return { minS, maxS };
  }

  function zoomChartByFactor(factor) {
    if (chartView.xMin == null || chartView.xMax == null) return;
    const mid = (chartView.xMin + chartView.xMax) / 2;
    let half = (chartView.xMax - chartView.xMin) / 2 * factor;
    const baseW = (chartView.baseMax - chartView.baseMin) || half * 2;
    half = Math.max(baseW * 0.04 / 2, Math.min(baseW * 3, half));
    let newMin = mid - half;
    let newMax = mid + half;
    if (newMin < 1) {
      newMax += (1 - newMin);
      newMin = 1;
    }
    chartView.xMin = newMin;
    chartView.xMax = newMax;
    redrawChartFromView();
  }

  function fitChartToStructure() {
    if (!(chartView.lastSpot > 0)) return;
    const spot = chartView.lastSpot;
    const scheda = schedaAttiva();
    const resNES = calcolaColonna(scheda, 'NES');
    const resMES = calcolaColonna(scheda, 'MES');
    const scan = scanRangeForBE(spot);
    const bes = findBreakevensRobust(scheda, spot, scan.minS, scan.maxS, resNES, resMES);
    chartView.breakevens = bes;
    updateBreakevenLabels(bes, spot);
    updatePOPLabel(calcolaPOP(scheda, spot, bes, resNES, resMES, scan.minS, scan.maxS));
    const smart = computeSmartChartRange(spot, bes);
    chartView.xMin = smart.minS;
    chartView.xMax = smart.maxS;
    chartView.baseMin = smart.minS;
    chartView.baseMax = smart.maxS;
    redrawChartFromView();
  }

  function buildPayoffPoints(scheda, minS, maxS, resNES, resMES) {
    const n = 220;
    const events = new Set([minS, maxS]);
    (scheda.opzioni || []).forEach(o => {
      if (o.attivo === false || o.stato === 'CHIUSA') return;
      const k = parseFloat(o.strike) || 0;
      if (k > 0) events.add(k);
    });
    [['NES', resNES], ['MES', resMES]].forEach(([col, res]) => {
      if (res && !isNaN(res.mediaPulita) && res.qtaNetta !== 0) events.add(res.mediaPulita);
      (scheda[col] || []).forEach(m => {
        if (m.attivo === false) return;
        if (m.prezzoPulito > 0) events.add(m.prezzoPulito);
      });
    });
    const xs = [];
    for (let i = 0; i <= n; i++) xs.push(minS + i * (maxS - minS) / n);
    events.forEach(e => {
      if (isFinite(e) && e >= minS && e <= maxS) xs.push(e);
    });
    const sorted = [...new Set(xs.map(x => +x))].filter(x => isFinite(x)).sort((a, b) => a - b);
    return sorted.map(S => ({
      S,
      pnlExpiry: pnlCombinatoAt(scheda, S, 'expiry', resNES, resMES),
      pnlNow:    pnlCombinatoAt(scheda, S, 'now',    resNES, resMES)
    }));
  }

  // Curve da disegnare: solo [precedente, corrente] (o [corrente] se Matrice).
  // Ogni set ha ruolo 'corrente' o 'precedente' + colore fisso.
  function buildCurveSets(minS, maxS) {
    const sets = [];
    const prec = schedaPrecedente();
    if (prec) {
      const resNES = calcolaColonna(prec, 'NES');
      const resMES = calcolaColonna(prec, 'MES');
      sets.push({
        nome: prec.nome,
        ruolo: 'precedente',
        colore: COLORE_PRECEDENTE,
        pts: buildPayoffPoints(prec, minS, maxS, resNES, resMES),
        resNES, resMES
      });
    }
    const att = schedaAttiva();
    const resNES = calcolaColonna(att, 'NES');
    const resMES = calcolaColonna(att, 'MES');
    sets.push({
      nome: att.nome,
      ruolo: 'corrente',
      colore: COLORE_CORRENTE,
      pts: buildPayoffPoints(att, minS, maxS, resNES, resMES),
      resNES, resMES
    });
    return sets;
  }

  function findBreakevens(pts) {
    const out = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1].pnlExpiry;
      const b = pts[i].pnlExpiry;
      if (!isFinite(a) || !isFinite(b)) continue;
      if ((a <= 0 && b > 0) || (a >= 0 && b < 0)) {
        const frac = a === b ? 0 : (0 - a) / (b - a);
        out.push(pts[i - 1].S + frac * (pts[i].S - pts[i - 1].S));
      }
      if (b === 0 && i + 1 < pts.length) {
        const c = pts[i + 1].pnlExpiry;
        if (isFinite(c) && ((a > 0 && c > 0) || (a < 0 && c < 0))) out.push(pts[i].S);
      }
    }
    if (pts.length > 1 && pts[0].pnlExpiry === 0 && pts[1].pnlExpiry > 0) {
      out.push(pts[0].S);
    }
    return out;
  }

  function buildPayoffPointsDense(scheda, minS, maxS, resNES, resMES) {
    const n = 200;
    const events = new Set([minS, maxS]);
    (scheda.opzioni || []).forEach(o => {
      if (o.attivo === false || o.stato === 'CHIUSA') return;
      const k = parseFloat(o.strike) || 0;
      if (k > 0) events.add(k);
    });
    [['NES', resNES], ['MES', resMES]].forEach(([col, res]) => {
      if (res && !isNaN(res.mediaPulita) && res.qtaNetta !== 0) events.add(res.mediaPulita);
      (scheda[col] || []).forEach(m => {
        if (m.attivo === false) return;
        if (m.prezzoPulito > 0) events.add(m.prezzoPulito);
      });
    });
    const grid = [];
    for (let i = 0; i <= n; i++) grid.push(minS + i * (maxS - minS) / n);
    const eps = Math.max((maxS - minS) * 1e-4, 1e-6);
    events.forEach(e => {
      const v = Math.min(maxS, Math.max(minS, e));
      grid.push(v - eps, v, v + eps);
    });
    const xs = [...new Set(grid.filter(x => isFinite(x) && x >= minS && x <= maxS))].sort((a, b) => a - b);
    return xs.map(S => ({ S, pnlExpiry: pnlCombinatoAt(scheda, S, 'expiry', resNES, resMES) }));
  }

  function findBreakevensRobust(scheda, spot, minS, maxS, resNES, resMES) {
    let lo = Math.max(0.01, Math.min(minS, spot * 0.55));
    let hi = Math.max(maxS, spot * 1.45);
    if (!(hi > lo)) return [];
    let bes = [];
    for (let iter = 0; iter < 6; iter++) {
      const pts = buildPayoffPointsDense(scheda, lo, hi, resNES, resMES);
      bes = findBreakevens(pts);
      const p0 = pts[0], p1 = pts[1], pN = pts[pts.length - 1], pN1 = pts[pts.length - 2];
      let expLo = false, expHi = false, newLo = lo, newHi = hi;
      if (p0 && p1 && isFinite(p0.pnlExpiry) && isFinite(p1.pnlExpiry) && p1.S > p0.S) {
        const m = (p1.pnlExpiry - p0.pnlExpiry) / (p1.S - p0.S);
        if (Math.abs(m) > 1e-12) {
          const z = p0.S - p0.pnlExpiry / m;
          if (z < lo && z > 0) { expLo = true; newLo = Math.max(0.01, z * 0.98); }
        }
      }
      if (pN && pN1 && isFinite(pN.pnlExpiry) && isFinite(pN1.pnlExpiry) && pN.S > pN1.S) {
        const m = (pN.pnlExpiry - pN1.pnlExpiry) / (pN.S - pN1.S);
        if (Math.abs(m) > 1e-12) {
          const z = pN.S - pN.pnlExpiry / m;
          if (z > hi && isFinite(z) && z < hi * 50) { expHi = true; newHi = z * 1.02; }
        }
      }
      if (!expLo && !expHi) break;
      lo = newLo; hi = newHi;
    }
    bes = bes.filter(b => isFinite(b) && b > 0).sort((a, b) => a - b);
    const out = [];
    bes.forEach(b => {
      const ref = spot > 0 ? spot : (Math.abs(b) || 1);
      if (!out.length || Math.abs(b - out[out.length - 1]) > ref * 0.001) out.push(b);
    });
    return out;
  }

  function updateBreakevenLabels(bes, spot) {
    const beInfEl = el('beInf');
    const beSupEl = el('beSup');
    if (!beInfEl || !beSupEl) return;

    if (!bes.length || !(spot > 0)) {
      beInfEl.textContent = '—';
      beSupEl.textContent = '—';
      return;
    }

    const sorted = [...bes].filter(Number.isFinite).sort((a, b) => a - b);

    const fmtBe = (v) => {
      if (v == null || !isFinite(v)) return '—';
      const dist = v - spot;
      const sign = dist >= 0 ? '+' : '';
      return `${v.toFixed(1)} (${sign}${dist.toFixed(1)})`;
    };

    if (sorted.length === 1) {
      if (sorted[0] < spot) {
        beInfEl.textContent = fmtBe(sorted[0]);
        beSupEl.textContent = '—';
      } else {
        beInfEl.textContent = '—';
        beSupEl.textContent = fmtBe(sorted[0]);
      }
      return;
    }

    beInfEl.textContent = fmtBe(sorted[0]);
    beSupEl.textContent = fmtBe(sorted[sorted.length - 1]);
  }

  // Mostra/nascondi il gruppo toggle "Precedente" in base alla scheda attiva.
  function aggiornaTogglePrecedente() {
    const grp = el('ctrlGroupPrecedente');
    if (!grp) return;
    const hasPrec = !!schedaPrecedente();
    grp.style.display = hasPrec ? '' : 'none';
  }

  function redrawChartFromView() {
    const { xMin, xMax, lastSpot, breakevens } = chartView;
    if (!(lastSpot > 0) || xMin == null || xMax == null) return;
    const showExpiryC = el('showExpiryCorrente')   ? el('showExpiryCorrente').checked   : true;
    const showNowC    = el('showNowCorrente')      ? el('showNowCorrente').checked      : true;
    const showExpiryP = el('showExpiryPrecedente') ? el('showExpiryPrecedente').checked : true;
    const showNowP    = el('showNowPrecedente')    ? el('showNowPrecedente').checked    : true;
    const curveSets = buildCurveSets(xMin, xMax);
    drawPayoffChart(
      curveSets, lastSpot,
      { showExpiryC, showNowC, showExpiryP, showNowP },
      breakevens || [], chartView.sigma, stato.attiva
    );
  }

  function resetChartZoom() {
    fitChartToStructure();
  }

  // Firma della struttura: serve a capire se il range X va ricalcolato.
  // Include sia la scheda attiva sia la precedente.
  function _firmaScheda(scheda) {
    const parts = [];
    ['NES', 'MES'].forEach(col => {
      const res = calcolaColonna(scheda, col);
      parts.push(`${res.qtaNetta}:${res.mediaPulita || 0}:${res.pnlRealizzato || 0}`);
      (scheda[col] || []).forEach(m => {
        parts.push(`${m.attivo !== false ? 1 : 0}:${m.direzione}:${m.quantita}:${m.prezzoPulito}:${m.stato || 'APERTA'}`);
      });
    });
    (scheda.opzioni || []).forEach(o => {
      parts.push(`${o.attivo !== false ? 1 : 0}:${o.pos}:${o.tipo}:${o.qta}:${o.strike}:${o.premio}:${o.stato}:${o.vol}:${o.scadenza}:${o.rlzd}:${o.strumento || 'MES'}`);
    });
    return parts.join('|');
  }

  function structureSignature() {
    const parts = [`${stato.schede.length}:${stato.attiva}`];
    parts.push('C:' + _firmaScheda(schedaAttiva()));
    const prec = schedaPrecedente();
    if (prec) parts.push('P:' + _firmaScheda(prec));
    parts.push(`cash:${(typeof stato.cash === 'number') ? stato.cash : 0}:${stato.cashEscluso ? 1 : 0}`);
    parts.push(`fee:${commissioniAttive() ? 1 : 0}`);
    return parts.join('|');
  }

  function aggiornaPayoffPreview(scheda, resNES, resMES) {
    const spot = parseFloat(el('prezzoSpot').value) || 0;
    const deltaEl = el('payoffDeltaNetto');
    aggiornaTogglePrecedente();

    if (!(spot > 0)) {
      deltaEl.textContent = '—';
      chartView.lastSpot = 0;
      chartView.breakevens = [];
      chartView._sig = null;
      chartView.hasPrecedente = false;
      updateBreakevenLabels([], 0);
      updatePOPLabel(null);
      chartView.sigma = null;
      drawPayoffChart([], spot, { showExpiryC: false, showNowC: false, showExpiryP: false, showNowP: false }, [], null, stato.attiva);
      return;
    }

    const delta = deltaNettoTotale(scheda, resNES, resMES);
    deltaEl.textContent = formatGreek(delta, 3);
    deltaEl.style.color = delta >= 0 ? 'var(--green)' : 'var(--red)';

    const prec = schedaPrecedente();
    const resNESPrec = prec ? calcolaColonna(prec, 'NES') : null;
    const resMESPrec = prec ? calcolaColonna(prec, 'MES') : null;

    chartView.lastResNES = resNES;
    chartView.lastResMES = resMES;
    chartView.lastResNESPrec = resNESPrec;
    chartView.lastResMESPrec = resMESPrec;
    chartView.hasPrecedente = !!prec;
    chartView.lastSpot = spot;

    const scan = scanRangeForBE(spot);
    let scanMin = scan.minS, scanMax = scan.maxS;
    if (chartView.xMin != null && chartView.xMax != null && chartView.xMax > chartView.xMin) {
      scanMin = Math.min(scanMin, chartView.xMin);
      scanMax = Math.max(scanMax, chartView.xMax);
    }
    // I BE sono calcolati solo sulla scheda attiva (sono i suoi BE).
    chartView.breakevens = findBreakevensRobust(scheda, spot, scanMin, scanMax, resNES, resMES);
    updateBreakevenLabels(chartView.breakevens, spot);
    updatePOPLabel(calcolaPOP(scheda, spot, chartView.breakevens, resNES, resMES, scanMin, scanMax));

    const sig = structureSignature();
    const structureChanged = sig !== chartView._sig;
    chartView._sig = sig;

    if (chartView.xMin == null || structureChanged) {
      const smart = computeSmartChartRange(spot, chartView.breakevens);
      chartView.xMin = smart.minS;
      chartView.xMax = smart.maxS;
      chartView.baseMin = smart.minS;
      chartView.baseMax = smart.maxS;
    }

    const showExpiryC = el('showExpiryCorrente')   ? el('showExpiryCorrente').checked   : true;
    const showNowC    = el('showNowCorrente')      ? el('showNowCorrente').checked      : true;
    const showExpiryP = el('showExpiryPrecedente') ? el('showExpiryPrecedente').checked : true;
    const showNowP    = el('showNowPrecedente')    ? el('showNowPrecedente').checked    : true;

    chartView.sigma = sigmaBandsAt(spot, resNES, resMES);
    const curveSets = buildCurveSets(chartView.xMin, chartView.xMax);
    drawPayoffChart(
      curveSets, spot,
      { showExpiryC, showNowC, showExpiryP, showNowP },
      chartView.breakevens, chartView.sigma, stato.attiva
    );
  }

  // Curve visibili: capisce quali curve (Expiry/Now) mostrare per ogni ruolo.
  // Ritorna { corrente: {expiry, now}, precedente: {expiry, now} } con booleani.
  function _visibilitaCurve(flags, hasPrecedente) {
    return {
      corrente:   { expiry: !!flags.showExpiryC, now: !!flags.showNowC },
      precedente: { expiry: hasPrecedente && !!flags.showExpiryP, now: hasPrecedente && !!flags.showNowP }
    };
  }

  function drawPayoffChart(curveSets, spot, flags, breakevens, sigma, attivaIdx) {
    const svg = el('payoffChart');
    if (!svg) return;
    breakevens = breakevens || [];
    curveSets = curveSets || [];
    flags = flags || { showExpiryC: true, showNowC: true, showExpiryP: true, showNowP: true };

    const W = 920, H = 380;
    const padL = 58, padR = 18, padT = 28, padB = 32;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    // Individua la corrente (ruolo 'corrente') e la precedente (ruolo 'precedente').
    const corrente = curveSets.find(cs => cs.ruolo === 'corrente') || curveSets[curveSets.length - 1] || null;
    const precedente = curveSets.find(cs => cs.ruolo === 'precedente') || null;

    const pts = corrente ? corrente.pts : [];
    if (!pts.length) {
      chartGeom = null;
      svg.innerHTML = `<text x="${W/2}" y="${H/2}" fill="#8b93a7" font-size="13" text-anchor="middle">Inserisci una posizione per vedere il payoff</text>`;
      return;
    }

    const hasPrec = !!precedente;
    const vis = _visibilitaCurve(flags, hasPrec);

    const xs = pts.map(p => p.S);
    let ys = [];
    if (vis.corrente.expiry) ys = ys.concat(corrente.pts.map(p => p.pnlExpiry));
    if (vis.corrente.now)    ys = ys.concat(corrente.pts.map(p => p.pnlNow));
    if (precedente) {
      if (vis.precedente.expiry) ys = ys.concat(precedente.pts.map(p => p.pnlExpiry));
      if (vis.precedente.now)    ys = ys.concat(precedente.pts.map(p => p.pnlNow));
    }
    if (!ys.length) ys = [0];

    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    let yMin = Math.min(0, ...ys), yMax = Math.max(0, ...ys);
    const yPad = (yMax - yMin) * 0.10 || 10;
    yMin -= yPad; yMax += yPad;
    if (yMax - yMin < 20) { yMin = -10; yMax = 10; }

    const xPix = x => padL + ((x - xMin) / (xMax - xMin || 1)) * plotW;
    const yPix = y => padT + (1 - (y - yMin) / (yMax - yMin || 1)) * plotH;

    const pathFrom = (ptsArr, key) =>
      ptsArr.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xPix(p.S).toFixed(1)} ${yPix(p[key]).toFixed(1)}`).join(' ');

    let svgContent = '';

    // Griglia Y
    const nGridY = 6;
    for (let i = 0; i <= nGridY; i++) {
      const y = yMin + (i / nGridY) * (yMax - yMin);
      const py = yPix(y);
      svgContent += `<line x1="${padL}" y1="${py}" x2="${W - padR}" y2="${py}" stroke="#2a2f3a" stroke-dasharray="3,3"/>`;
      svgContent += `<text x="${padL - 6}" y="${py + 3}" fill="#8b93a7" font-size="10" text-anchor="end">${y.toFixed(0)}</text>`;
    }

    // Griglia X
    const nGridX = 8;
    for (let i = 0; i <= nGridX; i++) {
      const x = xMin + (i / nGridX) * (xMax - xMin);
      const px = xPix(x);
      svgContent += `<text x="${px}" y="${H - padB + 16}" fill="#8b93a7" font-size="10" text-anchor="middle">${Math.round(x)}</text>`;
    }

    // Bande sigma
    const nSDsel = el('nSD');
    const nSD = nSDsel ? Math.max(1, Math.min(10, parseInt(nSDsel.value) || 2)) : 2;
    const nascondiSigma = !!(el('showSigma') && el('showSigma').checked);
    if (sigma && !nascondiSigma && sigma.s1 > 0) {
      for (let k = 1; k <= nSD; k++) {
        const op = Math.max(0.15, 0.9 - (k - 1) * 0.08).toFixed(2);
        [[spot - k * sigma.s1, '\u2212' + k + '\u03c3'], [spot + k * sigma.s1, '+' + k + '\u03c3']].forEach(pair => {
          const v = pair[0], txt = pair[1];
          if (v < xMin || v > xMax) return;
          const tx = xPix(v);
          svgContent += `<line x1="${tx}" y1="${padT}" x2="${tx}" y2="${H - padB}" stroke="#2ecc71" stroke-width="1.2" stroke-dasharray="4,3" stroke-opacity="${op}"/>`;
          svgContent += `<text x="${tx}" y="${padT - 8}" fill="#2ecc71" fill-opacity="${op}" font-size="9" text-anchor="middle">${txt}</text>`;
        });
      }
    }

    // Linea zero
    const zeroY = yPix(0);
    svgContent += `<line x1="${padL}" y1="${zeroY}" x2="${W - padR}" y2="${zeroY}" stroke="#8b93a7" stroke-width="1"/>`;

    // Area sotto la curva Expiry: SOLO per la corrente (verde/rosso).
    if (vis.corrente.expiry) {
      const areaPath = `${pathFrom(corrente.pts, 'pnlExpiry')} L ${xPix(xMax)} ${zeroY} L ${xPix(xMin)} ${zeroY} Z`;
      const clipPosH = Math.max(0, zeroY - padT);
      const clipNegH = Math.max(0, H - padB - zeroY);
      svgContent += `
        <defs>
          <clipPath id="clipPos"><rect x="${padL}" y="${padT}" width="${plotW}" height="${clipPosH}"/></clipPath>
          <clipPath id="clipNeg"><rect x="${padL}" y="${zeroY}" width="${plotW}" height="${clipNegH}"/></clipPath>
        </defs>
        <path d="${areaPath}" fill="#2ecc71" fill-opacity="0.12" clip-path="url(#clipPos)" stroke="none"/>
        <path d="${areaPath}" fill="#e74c3c" fill-opacity="0.12" clip-path="url(#clipNeg)" stroke="none"/>
      `;
    }

    // Disegno curve: prima la precedente (sotto), poi la corrente (sopra).
    if (precedente) {
      if (vis.precedente.expiry) {
        svgContent += `<path d="${pathFrom(precedente.pts, 'pnlExpiry')}" fill="none" stroke="${precedente.colore}" stroke-width="2" stroke-dasharray="6,3" opacity="0.9"/>`;
      }
      if (vis.precedente.now) {
        svgContent += `<path d="${pathFrom(precedente.pts, 'pnlNow')}" fill="none" stroke="${precedente.colore}" stroke-width="1.6" stroke-dasharray="3,3" opacity="0.7"/>`;
      }
    }
    if (vis.corrente.expiry) {
      svgContent += `<path d="${pathFrom(corrente.pts, 'pnlExpiry')}" fill="none" stroke="${corrente.colore}" stroke-width="2.6"/>`;
    }
    if (vis.corrente.now) {
      svgContent += `<path d="${pathFrom(corrente.pts, 'pnlNow')}" fill="none" stroke="${corrente.colore}" stroke-width="1.8" stroke-dasharray="5,4" opacity="0.85"/>`;
    }

    // Linee BE (calcolate sulla scheda attiva)
    const showBEFlag = el('showBE') ? el('showBE').checked : true;
    if (showBEFlag) breakevens.forEach((be) => {
      if (be < xMin || be > xMax) return;
      const bx = xPix(be);
      svgContent += `<line x1="${bx}" y1="${padT}" x2="${bx}" y2="${H - padB}" stroke="#f1c40f" stroke-width="1.4" stroke-dasharray="5,3" stroke-opacity="0.9"/>`;
      svgContent += `<text x="${bx + 3}" y="${H - padB - 6}" fill="#f1c40f" font-size="10" text-anchor="start">BE ${be.toFixed(0)}</text>`;
    });

    // Linea Spot
    if (spot >= xMin && spot <= xMax) {
      const sx = xPix(spot);
      svgContent += `<line x1="${sx}" y1="${padT}" x2="${sx}" y2="${H - padB}" stroke="#4f8cff" stroke-width="1.5" stroke-dasharray="4,3"/>`;
      svgContent += `<text x="${sx}" y="${padT - 8}" fill="#4f8cff" font-size="11" text-anchor="middle">Spot ${Math.round(spot)}</text>`;
    }

    svgContent += `<rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="none" stroke="#2a2f3a"/>`;

    // Hover layer
    svgContent += `
      <g id="hoverLayer" style="pointer-events:none;">
        <line id="hoverLine" x1="0" y1="${padT}" x2="0" y2="${H - padB}" stroke="#7d8590" stroke-width="1" stroke-dasharray="3,3" style="display:none"/>
        <circle id="hoverDotCorrente" cx="0" cy="0" r="4" fill="${corrente.colore}" stroke="#0c0e12" stroke-width="1.5" style="display:none"/>
        <circle id="hoverDotPrecedente" cx="0" cy="0" r="4" fill="${precedente ? precedente.colore : '#fb923c'}" stroke="#0c0e12" stroke-width="1.5" style="display:none"/>
        <rect id="hoverBox" x="0" y="0" width="200" height="72" rx="5" fill="#0f1115" stroke="#2a2f3a" stroke-width="1" style="display:none"/>
        <circle id="hoverPallinoC" cx="0" cy="0" r="4" fill="${corrente.colore}" style="display:none"/>
        <circle id="hoverPallinoP" cx="0" cy="0" r="4" fill="none" stroke="${precedente ? precedente.colore : '#fb923c'}" stroke-width="1.5" style="display:none"/>
        <text id="hoverTextPrezzo" x="0" y="0" fill="#a8b0c0" font-size="11" font-family="Segoe UI, Roboto, sans-serif" style="display:none"></text>
        <text id="hoverTextCorrente" x="0" y="0" fill="#e6e8ee" font-size="11" font-family="Segoe UI, Roboto, sans-serif" style="display:none"></text>
        <text id="hoverTextPrecedente" x="0" y="0" fill="#e6e8ee" font-size="11" font-family="Segoe UI, Roboto, sans-serif" style="display:none"></text>
      </g>
    `;

    svg.innerHTML = svgContent;

    chartGeom = {
      W, H, padL, padR, padT, padB, plotW, plotH,
      xMin, xMax, yMin, yMax, xPix, yPix,
      ptsCorrente: corrente.pts,
      ptsPrecedente: precedente ? precedente.pts : null,
      nomeCorrente: corrente.nome,
      nomePrecedente: precedente ? precedente.nome : null,
      vis,
      activeColor: corrente.colore
    };

    bindChartHover();
  }

  function clearChartHover() {
    ['hoverLine', 'hoverDotCorrente', 'hoverDotPrecedente', 'hoverBox',
     'hoverPallinoC', 'hoverPallinoP',
     'hoverTextPrezzo', 'hoverTextCorrente', 'hoverTextPrecedente'].forEach(id => {
      const e = document.getElementById(id);
      if (e) e.style.display = 'none';
    });
  }

  function handleChartHover(e) {
    if (!chartGeom || !chartGeom.ptsCorrente || !chartGeom.ptsCorrente.length) return;
    const svg = el('payoffChart');
    if (!svg) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const svgPt = pt.matrixTransform(ctm.inverse());

    const { padL, padR, padT, padB, W, H, xMin, xMax, xPix, yPix,
            ptsCorrente, ptsPrecedente, vis } = chartGeom;

    if (svgPt.x < padL || svgPt.x > W - padR || svgPt.y < padT || svgPt.y > H - padB) {
      clearChartHover();
      return;
    }

    const S = xMin + ((svgPt.x - padL) / (W - padL - padR)) * (xMax - xMin);

    // Trova il punto più vicino sulla curva CORRENTE (usato per agganciare la X).
    let nearestC = ptsCorrente[0];
    let bestC = Infinity;
    for (const p of ptsCorrente) {
      const d = Math.abs(p.S - S);
      if (d < bestC) { bestC = d; nearestC = p; }
    }

    // Trova il punto più vicino sulla curva PRECEDENTE (stessa ascissa).
    let nearestP = null;
    if (ptsPrecedente && ptsPrecedente.length) {
      let bestP = Infinity;
      for (const p of ptsPrecedente) {
        const d = Math.abs(p.S - nearestC.S);
        if (d < bestP) { bestP = d; nearestP = p; }
      }
    }

    const px = xPix(nearestC.S);
    const line = document.getElementById('hoverLine');
    if (!line) return;

    line.setAttribute('x1', px);
    line.setAttribute('x2', px);
    line.style.display = '';

    const dotC = document.getElementById('hoverDotCorrente');
    const dotP = document.getElementById('hoverDotPrecedente');
    const box = document.getElementById('hoverBox');
    const palC = document.getElementById('hoverPallinoC');
    const palP = document.getElementById('hoverPallinoP');
    const tPrezzo = document.getElementById('hoverTextPrezzo');
    const tCorr = document.getElementById('hoverTextCorrente');
    const tPrec = document.getElementById('hoverTextPrecedente');
    if (!box || !tPrezzo || !tCorr) return;

    // Pallino corrente: pieno, sulla curva Expiry se visibile, altrimenti Now.
    if (dotC) {
      const yValC = vis.corrente.expiry ? nearestC.pnlExpiry
                  : (vis.corrente.now ? nearestC.pnlNow : null);
      if (yValC != null) {
        dotC.setAttribute('cx', px);
        dotC.setAttribute('cy', yPix(yValC));
        dotC.style.display = '';
      } else {
        dotC.style.display = 'none';
      }
    }

    // Pallino precedente: pieno, sulla curva Expiry se visibile, altrimenti Now.
    if (dotP) {
      const yValP = nearestP
        ? (vis.precedente.expiry ? nearestP.pnlExpiry
           : (vis.precedente.now ? nearestP.pnlNow : null))
        : null;
      if (yValP != null) {
        dotP.setAttribute('cx', px);
        dotP.setAttribute('cy', yPix(yValP));
        dotP.style.display = '';
      } else {
        dotP.style.display = 'none';
      }
    }

    const fmt = v => (v >= 0 ? '+' : '') + v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Righe tooltip: Prezzo + Corrente (Expiry/Now) + Precedente (Expiry/Now).
    const righe = [];
    righe.push({ tipo: 'prezzo', testo: `Prezzo  ${nearestC.S.toFixed(2)}` });

    // Corrente: se entrambe visibili, due righe; altrimenti una sola.
    if (vis.corrente.expiry && vis.corrente.now) {
      righe.push({ tipo: 'corrente', testo: `● ${chartGeom.nomeCorrente} Scad.  ${fmt(nearestC.pnlExpiry)}` });
      righe.push({ tipo: 'corrente', testo: `● ${chartGeom.nomeCorrente} Now   ${fmt(nearestC.pnlNow)}` });
    } else if (vis.corrente.expiry) {
      righe.push({ tipo: 'corrente', testo: `● ${chartGeom.nomeCorrente}  ${fmt(nearestC.pnlExpiry)}` });
    } else if (vis.corrente.now) {
      righe.push({ tipo: 'corrente', testo: `● ${chartGeom.nomeCorrente} Now  ${fmt(nearestC.pnlNow)}` });
    }

    // Precedente: idem.
    if (nearestP) {
      if (vis.precedente.expiry && vis.precedente.now) {
        righe.push({ tipo: 'precedente', testo: `○ ${chartGeom.nomePrecedente} Scad.  ${fmt(nearestP.pnlExpiry)}` });
        righe.push({ tipo: 'precedente', testo: `○ ${chartGeom.nomePrecedente} Now   ${fmt(nearestP.pnlNow)}` });
      } else if (vis.precedente.expiry) {
        righe.push({ tipo: 'precedente', testo: `○ ${chartGeom.nomePrecedente}  ${fmt(nearestP.pnlExpiry)}` });
      } else if (vis.precedente.now) {
        righe.push({ tipo: 'precedente', testo: `○ ${chartGeom.nomePrecedente} Now  ${fmt(nearestP.pnlNow)}` });
      }
    }

    // Box dimensioni in base al numero di righe.
    const boxW = 210;
    const boxH = 8 + righe.length * 15;
    let boxX = px + 12;
    if (boxX + boxW > W - padR) boxX = px - boxW - 12;
    const refY = vis.corrente.expiry ? yPix(nearestC.pnlExpiry) : yPix(nearestC.pnlNow);
    let boxY = Math.max(padT + 4, Math.min(refY - boxH - 8, H - padB - boxH - 4));

    box.setAttribute('x', boxX);
    box.setAttribute('y', boxY);
    box.setAttribute('width', boxW);
    box.setAttribute('height', boxH);
    box.style.display = '';

    // Pallini del tooltip
    if (palC && palP) {
      let idxCorr = -1, idxPrec = -1;
      for (let i = 0; i < righe.length; i++) {
        if (righe[i].tipo === 'corrente' && idxCorr < 0) idxCorr = i;
        if (righe[i].tipo === 'precedente' && idxPrec < 0) idxPrec = i;
      }
      if (idxCorr >= 0) {
        palC.setAttribute('cx', boxX + 10);
        palC.setAttribute('cy', boxY + 16 + idxCorr * 15);
        palC.style.display = '';
      } else {
        palC.style.display = 'none';
      }
      if (idxPrec >= 0) {
        palP.setAttribute('cx', boxX + 10);
        palP.setAttribute('cy', boxY + 16 + idxPrec * 15);
        palP.style.display = '';
      } else {
        palP.style.display = 'none';
      }
    }

    // Riempie i testi. Uso un'unica text per ogni riga, con x spostato di +22
    // quando c'è il pallino, altrimenti +10.
    const setRow = (elText, i, tipo) => {
      if (!elText) return;
      const r = righe[i];
      if (!r) { elText.style.display = 'none'; return; }
      const hasPallino = (r.tipo === 'corrente' || r.tipo === 'precedente');
      elText.setAttribute('x', boxX + (hasPallino ? 22 : 10));
      elText.setAttribute('y', boxY + 16 + i * 15);
      // Rimuovo il pallino dal testo (già disegnato come cerchio SVG)
      elText.textContent = r.testo.replace(/^[●○]\s*/, '');
      if (r.tipo === 'prezzo') elText.setAttribute('fill', '#a8b0c0');
      else if (r.tipo === 'corrente') elText.setAttribute('fill', chartGeom.activeColor);
      else elText.setAttribute('fill', '#fb923c');
      elText.style.display = '';
    };

    // Uso i 3 text disponibili; per righe extra (fino a 5) creo/riuso un pool.
    // Pool dinamico: hoverTextPrezzo, hoverTextCorrente, hoverTextPrecedente sono i primi 3.
    // Per ulteriori righe, riciclo in ordine: preferisco un pool più ampio.
    // Soluzione: rimuovo i 3 text dal DOM e ne creo N.
    // (semplice, il layer hover è ricreato ad ogni redraw)
    const layer = document.getElementById('hoverLayer');
    if (layer) {
      // Rimuovo i text esistenti con data-hover-row
      layer.querySelectorAll('text[data-hover-row]').forEach(n => n.remove());
      // Creo un text per ogni riga
      for (let i = 0; i < righe.length; i++) {
        const r = righe[i];
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('data-hover-row', String(i));
        t.setAttribute('font-size', '11');
        t.setAttribute('font-family', 'Segoe UI, Roboto, sans-serif');
        const hasPallino = (r.tipo === 'corrente' || r.tipo === 'precedente');
        t.setAttribute('x', boxX + (hasPallino ? 22 : 10));
        t.setAttribute('y', boxY + 16 + i * 15);
        t.textContent = r.testo.replace(/^[●○]\s*/, '');
        if (r.tipo === 'prezzo') t.setAttribute('fill', '#a8b0c0');
        else if (r.tipo === 'corrente') t.setAttribute('fill', chartGeom.activeColor);
        else t.setAttribute('fill', '#fb923c');
        layer.appendChild(t);
      }
      // I 3 text statici non servono più: nascondo.
      [tPrezzo, tCorr, tPrec].forEach(t => { if (t) t.style.display = 'none'; });
    }
  }

  function touchPointFrac(svg, t0, t1) {
    if (!chartGeom) return null;
    const pt = svg.createSVGPoint();
    pt.x = (t0.clientX + t1.clientX) / 2;
    pt.y = (t0.clientY + t1.clientY) / 2;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const sp = pt.matrixTransform(ctm.inverse());
    const plotW = chartGeom.W - chartGeom.padL - chartGeom.padR;
    return Math.max(0, Math.min(1, (sp.x - chartGeom.padL) / plotW));
  }

  function buildTwoFingerGesture(svg, touches) {
    const t0 = touches[0], t1 = touches[1];
    if (chartView.xMin == null) return { mode: 'hover' };
    const frac = touchPointFrac(svg, t0, t1);
    if (frac == null) return { mode: 'hover' };
    const startW = chartView.xMax - chartView.xMin;
    return {
      mode: 'two',
      startDist: Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY) || 1,
      startW,
      anchorS: chartView.xMin + frac * startW
    };
  }

  function bindChartHover() {
    const svg = el('payoffChart');
    if (!svg) return;

    if (!chartHoverBound) {
      svg.addEventListener('mousemove', (e) => {
        if (isPanning || touchGesture) return;
        handleChartHover(e);
      });
      svg.addEventListener('mouseleave', () => {
        clearChartHover();
        if (isPanning) {
          isPanning = false;
          svg.style.cursor = 'crosshair';
        }
      });
      chartHoverBound = true;
    }

    if (!chartInteractBound) {
      svg.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (!chartGeom || chartView.xMin == null) return;

        const pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const ctm = svg.getScreenCTM();
        if (!ctm) return;
        const svgPt = pt.matrixTransform(ctm.inverse());

        const { padL, W, padR } = chartGeom;
        const plotW = W - padL - padR;
        const frac = Math.max(0, Math.min(1, (svgPt.x - padL) / plotW));
        const cursorS = chartView.xMin + frac * (chartView.xMax - chartView.xMin);

        const factor = e.deltaY < 0 ? 0.85 : 1.18;
        let newWidth = (chartView.xMax - chartView.xMin) * factor;
        const baseW = (chartView.baseMax - chartView.baseMin) || newWidth;
        newWidth = Math.max(baseW * 0.05, Math.min(baseW * 4, newWidth));

        let newMin = cursorS - frac * newWidth;
        let newMax = newMin + newWidth;
        if (newMin < 1) { newMin = 1; newMax = newMin + newWidth; }

        chartView.xMin = newMin;
        chartView.xMax = newMax;
        clearChartHover();
        scheduleChartRedraw();
      }, { passive: false });

      svg.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || !chartGeom) return;
        isPanning = true;
        panStartX = e.clientX;
        panStartMin = chartView.xMin;
        panStartMax = chartView.xMax;
        svg.style.cursor = 'grabbing';
        clearChartHover();
        e.preventDefault();
      });

      window.addEventListener('mousemove', (e) => {
        if (!isPanning || !chartGeom) return;
        const { plotW } = chartGeom;
        const dxPx = e.clientX - panStartX;
        const range = panStartMax - panStartMin;
        const dxS = -(dxPx / plotW) * range;
        let newMin = panStartMin + dxS;
        let newMax = panStartMax + dxS;
        if (newMin < 1) {
          const shift = 1 - newMin;
          newMin += shift;
          newMax += shift;
        }
        chartView.xMin = newMin;
        chartView.xMax = newMax;
        scheduleChartRedraw();
      });

      window.addEventListener('mouseup', () => {
        if (!isPanning) return;
        isPanning = false;
        const svgEl = el('payoffChart');
        if (svgEl) svgEl.style.cursor = 'crosshair';
      });

      svg.addEventListener('touchstart', (e) => {
        if (!chartGeom || chartView.xMin == null) return;
        if (e.touches.length === 1) {
          touchGesture = { mode: 'hover' };
          handleChartHover(e.touches[0]);
        } else if (e.touches.length >= 2) {
          touchGesture = buildTwoFingerGesture(svg, e.touches);
        }
      }, { passive: true });

      svg.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!touchGesture || !chartGeom) return;

        if (touchGesture.mode === 'hover') {
          if (e.touches.length === 1) {
            handleChartHover(e.touches[0]);
          } else if (e.touches.length >= 2) {
            touchGesture = buildTwoFingerGesture(svg, e.touches);
          }
          return;
        }

        if (touchGesture.mode === 'two' && e.touches.length === 2) {
          const t0 = e.touches[0], t1 = e.touches[1];
          const curDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
          if (!(curDist > 0) || !(touchGesture.startDist > 0)) return;
          let newW = touchGesture.startW * (touchGesture.startDist / curDist);
          const baseW = (chartView.baseMax - chartView.baseMin) || touchGesture.startW;
          newW = Math.max(baseW * 0.05, Math.min(baseW * 4, newW));
          const frac = touchPointFrac(svg, t0, t1);
          if (frac == null) return;
          let newMin = touchGesture.anchorS - frac * newW;
          let newMax = newMin + newW;
          if (newMin < 1) { newMin = 1; newMax = newMin + newW; }
          chartView.xMin = newMin;
          chartView.xMax = newMax;
          scheduleChartRedraw();
        }
      }, { passive: false });

      svg.addEventListener('touchend', (e) => {
        if (e.touches.length === 0) {
          touchGesture = null;
          clearChartHover();
        } else if (e.touches.length === 1 && chartView.xMin != null) {
          touchGesture = { mode: 'hover' };
          handleChartHover(e.touches[0]);
        }
      }, { passive: true });
      svg.addEventListener('touchcancel', () => { touchGesture = null; clearChartHover(); }, { passive: true });

      svg.addEventListener('dblclick', (e) => {
        e.preventDefault();
        resetChartZoom();
      });

      const btnReset = el('btnResetZoom');
      if (btnReset) btnReset.addEventListener('click', resetChartZoom);
      const btnFit = el('btnFitView');
      if (btnFit) btnFit.addEventListener('click', fitChartToStructure);
      const btnIn = el('btnZoomIn');
      if (btnIn) btnIn.addEventListener('click', () => zoomChartByFactor(0.75));
      const btnOut = el('btnZoomOut');
      if (btnOut) btnOut.addEventListener('click', () => zoomChartByFactor(1.35));

      chartInteractBound = true;
    }
  }
