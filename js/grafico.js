// grafico.js — grafico payoff: range, breakeven, POP, zoom e touch
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.
// v28 — delta a taglia relativa: vedi tipoRiferimentoFut / deltaInRiferimento
//       in render-futures.js (caricato prima di questo file).
  // ============================================================
  // MONDI SEPARATI: AZIONI vs FUTURES (NES/MES/ES)
  // ============================================================
  function mondoDiTipo(tipo) {
    return (tipo === 'X' || tipo === 'AZIONI') ? 'AZIONI' : 'FUT';
  }
  function mondoOpzione(opz) {
    return (opz && (opz.strumento || 'MES')) === 'AZIONI' ? 'AZIONI' : 'FUT';
  }
  function mondoAttivo() {
    return strumentoOpzSelezionato() === 'AZIONI' ? 'AZIONI' : 'FUT';
  }
  function colonnaNelMondo(res) {
    if (!res || !res.tipo || res.tipo === '-') return false;
    return mondoDiTipo(res.tipo) === mondoAttivo();
  }

  // ============================================================
  // PAYOFF COMBINATO
  // ============================================================
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
    const mondo = mondoAttivo();
    let minScad = null;
    (scheda.opzioni || []).forEach(o => {
      if (o.attivo === false || o.stato === 'CHIUSA') return;
      if (mondoOpzione(o) !== mondo) return;
      if (!o.scadenza) return;
      const T = yearsBetween(today, o.scadenza);
      if (T == null || T < 0) return;
      if (minScad === null || o.scadenza < minScad) minScad = o.scadenza;
    });
    return minScad;
  }

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

  // Box "Escludi cash" eliminato: il cash entra sempre nei conteggi
  function cashAttivo() {
    const c = (typeof stato.cash === 'number') ? stato.cash : 0;
    return c;
  }

  function pnlCombinatoAt(scheda, S, mode, resNES, resMES) {
    let tot = cashAttivo();
    if (colonnaNelMondo(resNES)) tot += pnlFutureApertoAt(S, 'NES', resNES);
    if (colonnaNelMondo(resMES)) tot += pnlFutureApertoAt(S, 'MES', resMES);
    const mondo = mondoAttivo();
    const firstExp = mode === 'expiry' ? firstExpiryOpzioni(scheda) : null;
    (scheda.opzioni || []).forEach(opz => {
      if (mondoOpzione(opz) !== mondo) return;
      tot += pnlOpzioneAt(S, opz, mode, firstExp);
    });
    return tot;
  }

  // ============================================================
  // DELTA NETTO (v28)
  // ============================================================
  // Mondo FUT: delta nell'unità del contratto di taglia maggiore della scheda
  //            (NES/MES/ES, opzioni incluse). Scheda con un solo tipo: 1 per contratto.
  // Mondo AZIONI: 100 azioni = delta 1.
  // Opzioni: qta × delta × segno, scalate come lo strumento sottostante.
  function deltaNettoTotale(scheda, resNES, resMES) {
    let d = 0;
    const mondo = mondoAttivo();

    // Mondo AZIONI: 100 azioni = delta 1
    const divLotto = (mondo === 'AZIONI') ? 100 : 1;

    // Riferimento FUT: contratto di taglia maggiore presente nella scheda
    const tipoRif = (mondo === 'FUT') ? tipoRiferimentoFut(scheda) : null;
    const scala = (tipo) => {
      if (mondo !== 'FUT' || !tipoRif || !TAGLIA_FUT[tipo]) return 1;
      return TAGLIA_FUT[tipo] / TAGLIA_FUT[tipoRif];
    };

    if (colonnaNelMondo(resNES) && resNES && resNES.qtaNetta !== 0) {
      d += (resNES.qtaNetta / divLotto) * scala(resNES.tipo);
    }
    if (colonnaNelMondo(resMES) && resMES && resMES.qtaNetta !== 0) {
      d += (resMES.qtaNetta / divLotto) * scala(resMES.tipo);
    }

    (scheda.opzioni || []).forEach(opz => {
      if (opz.attivo === false || opz.stato === 'CHIUSA') return;
      if (mondoOpzione(opz) !== mondo) return;
      const g = calcolaGrecheOpzione(opz);
      if (!isFinite(g.delta)) return;
      const segno = opz.pos === 'SELL' ? -1 : 1;
      d += segno * (opz.qta || 0) * g.delta * scala(opz.strumento || 'MES');
    });

    return d;
  }

  // v28 — Sensibilità del P&L per punto di movimento del sottostante.
  // Il delta è nell'unità del contratto di riferimento: il P&L per punto
  // è delta × moltiplicatore di quel contratto (mondo AZIONI: lotto da 100).
  function deltaSensibilitaPerPunto(delta) {
    let molt;
    if (mondoAttivo() === 'AZIONI') {
      molt = 100;
    } else {
      const tipoRif = tipoRiferimentoFut(schedaAttiva());
      molt = (tipoRif && MOLTIPLICATORI[tipoRif]) || MOLTIPLICATORI['MES'] || 5;
    }
    const sens = delta * molt;
    if (!isFinite(sens)) return null;
    const sign = sens >= 0 ? '+' : '−';
    return `(${sign}${Math.abs(sens).toLocaleString('it-IT',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per punto)`;
  }

  let chartView = {
    userMoved: false,
    xMin: null, xMax: null,
    baseMin: null, baseMax: null,
    lastResNES: null, lastResMES: null, lastSpot: 0,
    lastResNESPrec: null, lastResMESPrec: null, hasPrecedente: false,
    breakevens: [],
    sigma: null,
    _sig: null,
    _sigContesto: null        // firma del contesto (scheda/sottostante/mondo)
  };
  let chartGeom = null;
  let chartHoverSvg = null;
  let chartInteractSvg = null;
  let windowInteractBound = false;
  let isPanning = false;
  let panStartX = 0;
  let panStartMin = 0;
  let panStartMax = 0;
  let touchGesture = null;
  let chartRedrawScheduled = false;
let rotellaZoomAttiva = false;

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
    // minimo proporzionale al prezzo (vale per futures, azioni e titoli a basso prezzo)
    const minHalf = Math.max(spot * 0.04, 0.01);
    if (maxS - minS < minHalf * 2) {
      minS = spot - minHalf;
      maxS = spot + minHalf;
    }
    return { minS: Math.max(1, minS), maxS };
  }

  function collectStructureAnchors(spot, scheda) {
    const pts = [spot];
    const target = scheda || schedaAttiva();
    if (!target) return pts.filter(p => isFinite(p) && p > 0);
    ['NES', 'MES'].forEach(col => {
      const res = calcolaColonna(target, col);
      if (!colonnaNelMondo(res)) return;
      if (res && !isNaN(res.mediaPulita) && res.qtaNetta !== 0) pts.push(res.mediaPulita);
      (target[col] || []).forEach(m => {
        if (m.attivo === false) return;
        if (m.prezzoPulito > 0) pts.push(m.prezzoPulito);
      });
    });
    const mondo = mondoAttivo();
    (target.opzioni || []).forEach(o => {
      if (o.attivo === false) return;
      if (mondoOpzione(o) !== mondo) return;
      const k = parseFloat(o.strike) || 0;
      if (k > 0) pts.push(k);
    });
    return pts.filter(p => isFinite(p) && p > 0);
  }

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

  function centeredChartRange(spot, bes) {
    const valid = (bes || []).filter(b => isFinite(b) && b > 0).sort((a, b) => a - b);
    // scala di riferimento della struttura: usa il BE se c'è, altrimenti lo spot.
    // Serve per minimi proporzionali al prezzo (5$ come 5000$).
    const ref = valid.length ? valid[valid.length - 1] : spot;
    const minHalf = Math.max(ref * 0.04, 0.01);

    let center, half;

    if (valid.length === 0) {
      const def = defaultChartRange(spot);
      center = (def.minS + def.maxS) / 2;
      half = (def.maxS - def.minS) / 2;
    } else if (valid.length === 1) {
      center = valid[0];
      const dist = Math.abs(spot - center);
      half = Math.max(dist * 1.6, minHalf);
    } else {
      const lo = valid[0];
      const hi = valid[valid.length - 1];
      center = (lo + hi) / 2;
      const span = Math.max(hi - lo, minHalf * 2);
      half = (span / 2) * 1.45;
    }

    // lo spot deve restare visibile, allargando in modo simmetrico
    const distSpot = Math.abs(spot - center);
    if (distSpot > half * 0.9) half = distSpot * 1.1;

    let minS = center - half;
    let maxS = center + half;
    if (minS < 1) { minS = 1; maxS = 1 + half * 2; }

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
    chartView.userMoved = true;
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
    
    const centered = centeredChartRange(spot, bes);
    chartView.userMoved = false;
    chartView.xMin = centered.minS;
    chartView.xMax = centered.maxS;
    chartView.baseMin = centered.minS;
    chartView.baseMax = centered.maxS;
    
    redrawChartFromView();
  }

  function collectPayoffEvents(scheda, minS, maxS, resNES, resMES) {
    const events = new Set([minS, maxS]);
    const mondo = mondoAttivo();
    (scheda.opzioni || []).forEach(o => {
      if (o.attivo === false || o.stato === 'CHIUSA') return;
      if (mondoOpzione(o) !== mondo) return;
      const k = parseFloat(o.strike) || 0;
      if (k > 0) events.add(k);
    });
    [['NES', resNES], ['MES', resMES]].forEach(([col, res]) => {
      if (!colonnaNelMondo(res)) return;
      if (res && !isNaN(res.mediaPulita) && res.qtaNetta !== 0) events.add(res.mediaPulita);
      (scheda[col] || []).forEach(m => {
        if (m.attivo === false) return;
        if (m.prezzoPulito > 0) events.add(m.prezzoPulito);
      });
    });
    return events;
  }

  function buildPayoffPoints(scheda, minS, maxS, resNES, resMES) {
    const n = 220;
    const events = collectPayoffEvents(scheda, minS, maxS, resNES, resMES);
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
    const events = collectPayoffEvents(scheda, minS, maxS, resNES, resMES);
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

  // Richiesta 1 — Distanza del breakeven dallo spot in deviazioni standard.
  // Stesso criterio delle bande σ del grafico: Vol ATM e orizzonte della
  // prima scadenza opzioni attive (o 30 giorni se ci sono solo futures).
  function beSigmaDistance(v, spot) {
    if (v == null || !isFinite(v) || !(spot > 0)) return null;
    const volPct = parseFloat(el('volAtm') && el('volAtm').value) || 0;
    const vol = volPct / 100;
    if (!(vol > 0)) return null;
    let T = nearestOptionYears(schedaAttiva());
    if (T === null) T = 30 / 365.25;
    if (!(T > 0)) return null;
    const s1 = spot * vol * Math.sqrt(T);
    if (!(s1 > 0)) return null;
    return (v - spot) / s1;
  }

  function updateBreakevenLabels(bes, spot) {
    const beInfEl = el('beInf');
    const beSupEl = el('beSup');
    const beInfPtsEl = el('beInfDist');
    const beSupPtsEl = el('beSupDist');
    const beInfPctEl = el('beInfPct');
    const beSupPctEl = el('beSupPct');
    const beInfSigEl = el('beInfSigma');
    const beSupSigEl = el('beSupSigma');
    if (!beInfEl || !beSupEl) return;

    const fmtNum = (v) => v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Valore del breakeven (prezzo assoluto)
    const fmtVal = (v) => (v == null || !isFinite(v)) ? '—' : fmtNum(v);

    // Distanza dallo spot in punti (con segno)
    const fmtPts = (v) => {
      if (v == null || !isFinite(v) || !(spot > 0)) return '—';
      const dist = v - spot;
      const sign = dist >= 0 ? '+' : '−';
      return `${sign}${fmtNum(Math.abs(dist))} pt`;
    };

    // Distanza dallo spot in percentuale (con segno)
    const fmtPct = (v) => {
      if (v == null || !isFinite(v) || !(spot > 0)) return '—';
      const pct = ((v - spot) / spot) * 100;
      const sign = pct >= 0 ? '+' : '−';
      return `${sign}${fmtNum(Math.abs(pct))}%`;
    };

    // Richiesta 1 — Distanza dallo spot in deviazioni standard (con segno)
    const fmtSigma = (v) => {
      const sig = beSigmaDistance(v, spot);
      if (sig === null || !isFinite(sig)) return '—';
      const sign = sig >= 0 ? '+' : '−';
      return `${sign}${Math.abs(sig).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}σ`;
    };

    const setBlock = (valEl, ptsEl, pctEl, sigEl, v) => {
      valEl.textContent = fmtVal(v);
      if (ptsEl) ptsEl.textContent = fmtPts(v);
      if (pctEl) pctEl.textContent = fmtPct(v);
      if (sigEl) sigEl.textContent = fmtSigma(v);
    };

    if (!bes.length || !(spot > 0)) {
      setBlock(beInfEl, beInfPtsEl, beInfPctEl, beInfSigEl, null);
      setBlock(beSupEl, beSupPtsEl, beSupPctEl, beSupSigEl, null);
      return;
    }

    const sorted = [...bes].filter(Number.isFinite).sort((a, b) => a - b);

    let inf = null, sup = null;
    if (sorted.length === 1) {
      if (sorted[0] < spot) inf = sorted[0];
      else sup = sorted[0];
    } else {
      inf = sorted[0];
      sup = sorted[sorted.length - 1];
    }

    setBlock(beInfEl, beInfPtsEl, beInfPctEl, beInfSigEl, inf);
    setBlock(beSupEl, beSupPtsEl, beSupPctEl, beSupSigEl, sup);
  }

  function aggiornaTogglePrecedente() {
    const grp = el('ctrlGroupPrecedente');
    if (!grp) return;
    const hasPrec = !!schedaPrecedente();
    grp.style.display = hasPrec ? '' : 'none';
  }

  // Header comparazione: BE e POP della scheda precedente (visibile solo in comparazione)
  function aggiornaHeaderComparazione(spot) {
    const box = el('cmpHeader');
    if (!box) return;
    const prec = schedaPrecedente();
    if (!prec || !(spot > 0)) {
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }
    const resNESp = calcolaColonna(prec, 'NES');
    const resMESp = calcolaColonna(prec, 'MES');
    const scan = scanRangeForBE(spot);
    const bes = findBreakevensRobust(prec, spot, scan.minS, scan.maxS, resNESp, resMESp);
    const pop = calcolaPOP(prec, spot, bes, resNESp, resMESp, scan.minS, scan.maxS);

    // Stessa logica di updateBreakevenLabels: BE inferiore e superiore
    const sorted = [...bes].filter(Number.isFinite).sort((a, b) => a - b);
    let inf = null, sup = null;
    if (sorted.length === 1) {
      if (sorted[0] < spot) inf = sorted[0];
      else sup = sorted[0];
    } else if (sorted.length > 1) {
      inf = sorted[0];
      sup = sorted[sorted.length - 1];
    }

    const fmtB = v => (v == null || !isFinite(v)) ? '—'
      : v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const popTxt = (pop && isFinite(pop.total))
      ? (pop.total * 100).toLocaleString('it-IT', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + '%'
      : '—';

    box.style.display = 'inline-flex';
    box.innerHTML =
      `<span style="color:var(--muted);">Precedente (${prec.nome}):</span>` +
      `<span>BE sup <strong>${fmtB(sup)}</strong></span>` +
      `<span>BE inf <strong>${fmtB(inf)}</strong></span>` +
      `<span>POP <strong style="color:var(--purple);">${popTxt}</strong></span>`;
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
    parts.push('M:' + mondoAttivo());
    parts.push('C:' + _firmaScheda(schedaAttiva()));
    const prec = schedaPrecedente();
    if (prec) parts.push('P:' + _firmaScheda(prec));
    parts.push(`cash:${(typeof stato.cash === 'number') ? stato.cash : 0}`);
    parts.push(`fee:${commissioniAttive() ? 1 : 0}`);
    return parts.join('|');
  }

  function _firmaContesto() {
    // Cambia quando l'utente passa ad un'altra scheda, cambia sottostante o cambia mondo
    const scheda = schedaAttiva();
    const nomeScheda = scheda ? (scheda.nome || '') : '';
    const spotEl = el('prezzoSpot');
    const spot = spotEl ? (parseFloat(spotEl.value) || 0) : 0;
    return [
      stato.attiva,
      nomeScheda,
      mondoAttivo(),
      spot
    ].join('|');
  }

  function aggiornaPayoffPreview(scheda, resNES, resMES) {
    const spot = parseFloat(el('prezzoSpot').value) || 0;
    // v27 — Delta netto spostato nel riepilogo (#deltaTot + #deltaSens),
    // rimosso il vecchio #payoffDeltaNetto dai controlli del grafico.
    const deltaEl = el('deltaTot');
    const deltaSensEl = el('deltaSens');
    aggiornaTogglePrecedente();
    aggiornaHeaderComparazione(spot);

    if (!(spot > 0)) {
      if (deltaEl) deltaEl.textContent = '—';
      if (deltaSensEl) deltaSensEl.textContent = '';
      chartView.lastSpot = 0;
      chartView.breakevens = [];
      chartView._sig = null;
      chartView._sigContesto = null;
      chartView.hasPrecedente = false;
      updateBreakevenLabels([], 0);
      updatePOPLabel(null);
      chartView.sigma = null;
      drawPayoffChart([], spot, { showExpiryC: false, showNowC: false, showExpiryP: false, showNowP: false }, [], null, stato.attiva);
      return;
    }

    const delta = deltaNettoTotale(scheda, resNES, resMES);
    if (deltaEl) {
      deltaEl.textContent = formatGreek(delta, 3);
      deltaEl.style.color = delta >= 0 ? 'var(--green)' : 'var(--red)';
    }
    if (deltaSensEl) {
      const sensTxt = deltaSensibilitaPerPunto(delta);
      deltaSensEl.textContent = sensTxt || '';
      deltaSensEl.style.color = delta >= 0 ? 'var(--green)' : 'var(--red)';
    }

    const prec = schedaPrecedente();
    const resNESPrec = prec ? calcolaColonna(prec, 'NES') : null;
    const resMESPrec = prec ? calcolaColonna(prec, 'MES') : null;

    chartView.lastResNES = resNES;
    chartView.lastResMES = resMES;
    chartView.lastResNESPrec = resNESPrec;
    chartView.lastResMESPrec = resMESPrec;
    chartView.hasPrecedente = !!prec;
    chartView.lastSpot = spot;

    // Se cambia il contesto (scheda attiva, sottostante, mondo), sblocca il ri-centraggio
    const sigContesto = _firmaContesto();
    if (sigContesto !== chartView._sigContesto) {
      chartView._sigContesto = sigContesto;
      chartView.userMoved = false;
    }

    const scan = scanRangeForBE(spot);
    const scanMin = scan.minS, scanMax = scan.maxS;
    chartView.breakevens = findBreakevensRobust(scheda, spot, scanMin, scanMax, resNES, resMES);
    updateBreakevenLabels(chartView.breakevens, spot);
    updatePOPLabel(calcolaPOP(scheda, spot, chartView.breakevens, resNES, resMES, scanMin, scanMax));

    const sig = structureSignature();
    const structureChanged = sig !== chartView._sig;
    chartView._sig = sig;

    if (chartView.xMin == null || (structureChanged && !chartView.userMoved)) {
      const centered = centeredChartRange(spot, chartView.breakevens);
      chartView.xMin = centered.minS;
      chartView.xMax = centered.maxS;
      chartView.baseMin = centered.minS;
      chartView.baseMax = centered.maxS;
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

    const W = 920, H = 570;
    const padL = 58, padR = 18, padT = 28, padB = 32;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

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

    const nGridY = 9;
    for (let i = 0; i <= nGridY; i++) {
      const y = yMin + (i / nGridY) * (yMax - yMin);
      const py = yPix(y);
      svgContent += `<line x1="${padL}" y1="${py}" x2="${W - padR}" y2="${py}" stroke="#2a2f3a" stroke-dasharray="3,3"/>`;
      svgContent += `<text x="${padL - 6}" y="${py + 3}" fill="#8b93a7" font-size="10" text-anchor="end">${y.toFixed(0)}</text>`;
    }

    const nGridX = 12;
    for (let i = 0; i <= nGridX; i++) {
      const x = xMin + (i / nGridX) * (xMax - xMin);
      const px = xPix(x);
      svgContent += `<text x="${px}" y="${H - padB + 16}" fill="#8b93a7" font-size="10" text-anchor="middle">${Math.round(x)}</text>`;
    }

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

    const zeroY = yPix(0);
    svgContent += `<line x1="${padL}" y1="${zeroY}" x2="${W - padR}" y2="${zeroY}" stroke="#8b93a7" stroke-width="1"/>`;

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

    if (precedente) {
      if (vis.precedente.expiry) {
        svgContent += `<path d="${pathFrom(precedente.pts, 'pnlExpiry')}" fill="none" stroke="${precedente.colore}" stroke-width="1.4" stroke-dasharray="6,3" opacity="0.9"/>`;
      }
      if (vis.precedente.now) {
        svgContent += `<path d="${pathFrom(precedente.pts, 'pnlNow')}" fill="none" stroke="${precedente.colore}" stroke-width="1.1" stroke-dasharray="3,3" opacity="0.7"/>`;
      }
    }
    if (vis.corrente.expiry) {
      svgContent += `<path d="${pathFrom(corrente.pts, 'pnlExpiry')}" fill="none" stroke="${corrente.colore}" stroke-width="1.8"/>`;
    }
    if (vis.corrente.now) {
      // In comparazione: la scheda corrente è SEMPRE continua (sia Now che Scadenza);
      // il tratteggio distingue solo la scheda precedente. Fuori comparazione
      // il Now della corrente resta tratteggiato come prima.
      const dashCorrente = precedente ? '' : ' stroke-dasharray="5,4"';
      svgContent += `<path d="${pathFrom(corrente.pts, 'pnlNow')}" fill="none" stroke="${corrente.colore}" stroke-width="1.2"${dashCorrente} opacity="0.85"/>`;
    }
    const showBEFlag = el('showBE') ? el('showBE').checked : true;
    if (showBEFlag) breakevens.forEach((be) => {
      if (be < xMin || be > xMax) return;
      const bx = xPix(be);
      svgContent += `<line x1="${bx}" y1="${padT}" x2="${bx}" y2="${H - padB}" stroke="#f1c40f" stroke-width="1.4" stroke-dasharray="5,3" stroke-opacity="0.9"/>`;
      svgContent += `<text x="${bx + 3}" y="${H - padB - 6}" fill="#f1c40f" font-size="10" text-anchor="start">BE ${be.toFixed(0)}</text>`;
    });

    if (spot >= xMin && spot <= xMax) {
      const sx = xPix(spot);
      svgContent += `<line x1="${sx}" y1="${padT}" x2="${sx}" y2="${H - padB}" stroke="#4f8cff" stroke-width="1.5" stroke-dasharray="4,3"/>`;
      svgContent += `<text x="${sx}" y="${padT - 8}" fill="#4f8cff" font-size="11" text-anchor="middle">Spot ${Math.round(spot)}</text>`;
    }

    svgContent += `<rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="none" stroke="#2a2f3a"/>`;

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

    let nearestC = ptsCorrente[0];
    let bestC = Infinity;
    for (const p of ptsCorrente) {
      const d = Math.abs(p.S - S);
      if (d < bestC) { bestC = d; nearestC = p; }
    }

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

    const righe = [];
    righe.push({ tipo: 'prezzo', testo: `Prezzo  ${nearestC.S.toFixed(2)}` });

    if (vis.corrente.expiry && vis.corrente.now) {
      righe.push({ tipo: 'corrente', testo: `● ${chartGeom.nomeCorrente} Scad.  ${fmt(nearestC.pnlExpiry)}` });
      righe.push({ tipo: 'corrente', testo: `● ${chartGeom.nomeCorrente} Now   ${fmt(nearestC.pnlNow)}` });
    } else if (vis.corrente.expiry) {
      righe.push({ tipo: 'corrente', testo: `● ${chartGeom.nomeCorrente}  ${fmt(nearestC.pnlExpiry)}` });
    } else if (vis.corrente.now) {
      righe.push({ tipo: 'corrente', testo: `● ${chartGeom.nomeCorrente} Now  ${fmt(nearestC.pnlNow)}` });
    }

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

    const layer = document.getElementById('hoverLayer');
    if (layer) {
      layer.querySelectorAll('text[data-hover-row]').forEach(n => n.remove());
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

    // --- Listener hover: riagganciati se l'SVG è stato ricreato ---
    if (chartHoverSvg !== svg) {
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
      chartHoverSvg = svg;
    }

    // --- Listener interazione su SVG e bottoni: riagganciati se ricreati ---
    if (chartInteractSvg !== svg) {
      svg.addEventListener('wheel', (e) => {
        if (!rotellaZoomAttiva && !e.ctrlKey && !e.metaKey) return; // lascia scorrere la pagina
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
        chartView.userMoved = true;
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
          chartView.userMoved = true;
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

      chartInteractSvg = svg;
    }

    // --- Listener su window: una sola volta, mai duplicati ---
    if (!windowInteractBound) {
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
        chartView.userMoved = true;
        scheduleChartRedraw();
      });

      window.addEventListener('mouseup', () => {
        if (!isPanning) return;
        isPanning = false;
        const svgEl = el('payoffChart');
        if (svgEl) svgEl.style.cursor = 'crosshair';
      });

      windowInteractBound = true;
    }
  }
