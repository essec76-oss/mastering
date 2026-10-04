// grafico.js — grafico payoff: range, breakeven, POP, zoom e touch
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.
  // ============================================================
  // PAYOFF COMBINATO
  // ============================================================
  // Restituisce il P&L di un singolo future aperto a un prezzo S
  // Usa media carico e quantitÃ  netta (come nel Mastering)
  function pnlFutureApertoAt(S, col, res) {
    if (!res || res.qtaNetta === 0 || isNaN(res.mediaPulita)) return 0;
    const tipo = res.tipo;
    if (!tipo || tipo === '-') return 0;
    const molt = MOLTIPLICATORI[tipo] || 0;
    const segno = res.qtaNetta > 0 ? 1 : -1;
    const q = Math.abs(res.qtaNetta);
    // Mark-to-market lineare + commissione di apertura (se toggle attivo)
    return (S - res.mediaPulita) * q * segno * molt - feeLatoFuture(tipo) * q;
  }

  // Prima scadenza (ISO) tra le opzioni ATTIVE e non CHIUSE della scheda.
  // Usata dal metodo "calendar": la curva A SCADENZA viene calcolata alla
  // scadenza della gamba piÃ¹ corta; le gambe piÃ¹ lunghe sono valutate al
  // loro prezzo teorico (BS per AZIONI, Black-76 per futures) col tempo
  // residuo a quella data.
  function firstExpiryOpzioni(scheda) {
    const today = dataAnalisiDate();
    let minScad = null;
    (scheda.opzioni || []).forEach(o => {
      if (o.attivo === false || o.stato === 'CHIUSA') return;
      if (!o.scadenza) return;
      const T = yearsBetween(today, o.scadenza);
      if (T == null || T < 0) return; // giÃ  scaduta: resta all'intrinseco
      if (minScad === null || o.scadenza < minScad) minScad = o.scadenza;
    });
    return minScad;
  }

  // P&L di una singola opzione a un prezzo S
  // mode = 'expiry' â alla prima scadenza della scheda: le gambe che scadono
  //   in quella data valgono l'intrinseco; le gambe con scadenza piÃ¹ lunga
  //   (strategie calendar) valgono il teorico col tempo residuo
  // mode = 'now'    â prezzo teorico (BS per AZIONI, Black-76 per futures)
  function pnlOpzioneAt(S, opz, mode, firstExpiry) {
    if (opz.attivo === false || opz.stato === 'CHIUSA') return 0;
    const qta = opz.qta || 0;
    if (qta === 0) return 0;
    const premio = opz.premio || 0;
    const K = opz.strike || 0;
    const tipo = (opz.tipo || 'PUT').toLowerCase() === 'call' ? 'call' : 'put';
    const intrinseco = tipo === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);

    let valoreOpzione = 0;
    if (mode === 'expiry') {
      if (firstExpiry && opz.scadenza && opz.scadenza > firstExpiry) {
        // Gamba con scadenza piÃ¹ lunga: valutata al teorico alla prima scadenza
        const Tres = yearsBetween(firstExpiry, opz.scadenza);
        const teo = modelPrice(S, opz, Tres, tipo);
        valoreOpzione = teo === null ? intrinseco : teo;
      } else {
        valoreOpzione = intrinseco;
      }
    } else {
      // now: teorico col modello dello strumento (BS per AZIONI, B76 per futures)
      const today = dataAnalisiDate();
      const T = opz.scadenza ? yearsBetween(today, opz.scadenza) : 0;
      const teo = modelPrice(S, opz, T, tipo);
      valoreOpzione = teo === null ? intrinseco : teo;
    }

    // P&L = (valore attuale - premio) * segno_posizione * qta * moltiplicatore
    // Per SELL (side=-1): se l'opzione vale meno del premio â profitto
    // Per BUY  (side=+1): se l'opzione vale piÃ¹ del premio â profitto
    const side = opz.pos === 'SELL' ? -1 : 1;
    const fee = feeLatoOpzione() * qta;
    return (valoreOpzione - premio) * side * qta * moltOpz(opz) - fee;
  }

  // Casella Cash: sfondo verde se il valore Ã¨ positivo, rosso se negativo
  function aggiornaStileCash() {
    const inp = el('cash');
    if (!inp) return;
    const v = parseFloat(inp.value) || 0;
    inp.classList.remove('pos', 'neg');
    if (v > 0) inp.classList.add('pos');
    else if (v < 0) inp.classList.add('neg');
  }

  // Cash annotato: entra nei conteggi se non escluso con il box di simulazione
  function cashAttivo() {
    const c = (typeof stato.cash === 'number') ? stato.cash : 0;
    return stato.cashEscluso ? 0 : c;
  }

  // P&L totale della posizione combinata a un generico prezzo S
  // (include il cash annotato: sposta tutta la curva e i breakeven)
  // In mode 'expiry' la valutazione Ã¨ fatta alla prima scadenza opzioni
  // (metodo calendar: le gambe piÃ¹ lunghe al teorico col tempo residuo).
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

  // Delta netto totale (futures + opzioni), in "unitÃ  MES" (1 MES = 1.0)
  function deltaNettoTotale(scheda, resNES, resMES) {
    let d = 0;
    // Futures: convertiamo tutto in equivalenti MES (moltiplicatore 5)
    if (resNES && resNES.qtaNetta !== 0) {
      const molt = MOLTIPLICATORI[resNES.tipo] || 0.5;
      d += resNES.qtaNetta * (molt / 5); // es. 10 NES long â +1.0 delta MES-eq
    }
    if (resMES && resMES.qtaNetta !== 0) {
      const molt = MOLTIPLICATORI[resMES.tipo] || 5;
      d += resMES.qtaNetta * (molt / 5);
    }
    // Opzioni
    (scheda.opzioni || []).forEach(opz => {
      if (opz.attivo === false || opz.stato === 'CHIUSA') return;
      const g = calcolaGrecheOpzione(opz);
      if (!isFinite(g.delta)) return; // input incompleti: nessun contributo
      const segno = opz.pos === 'SELL' ? -1 : 1;
      const qta = opz.qta || 0;
      d += segno * qta * g.delta * (moltOpz(opz) / 5); // in unitÃ  MES-equivalenti
    });
    return d;
  }

  // Stato vista grafico (zoom / pan)
  let chartView = {
    xMin: null, xMax: null,   // range corrente
    baseMin: null, baseMax: null, // range di default
    lastResNES: null, lastResMES: null, lastSpot: 0,
    breakevens: []
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

  // Redraw throttled: massimo un ridisegno per frame anche durante pan/zoom
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

  // Raccoglie punti chiave della struttura di TUTTE le schede
  // (strike, ingressi futures attivi): il grafico deve inquadrarle tutte
  function collectStructureAnchors(spot) {
    const pts = [spot];
    stato.schede.forEach(scheda => {
      ['NES', 'MES'].forEach(col => {
        const res = calcolaColonna(scheda, col);
        if (res && !isNaN(res.mediaPulita) && res.qtaNetta !== 0) pts.push(res.mediaPulita);
        (scheda[col] || []).forEach(m => {
          if (m.attivo === false) return;
          if (m.prezzoPulito > 0) pts.push(m.prezzoPulito);
        });
      });
      (scheda.opzioni || []).forEach(o => {
        if (o.attivo === false) return;
        const k = parseFloat(o.strike) || 0;
        if (k > 0) pts.push(k);
      });
    });
    return pts.filter(p => isFinite(p) && p > 0);
  }

  // Range di scansione BE/POP: parte da spotÂ±45% ma si estende per
  // includere tutti i punti della struttura (ingressi/strike) Â±30%.
  function scanRangeForBE(spot) {
    let minS = Math.max(1, spot * 0.55);
    let maxS = spot * 1.45;
    collectStructureAnchors(spot).forEach(a => {
      minS = Math.min(minS, Math.max(1, a * 0.7));
      maxS = Math.max(maxS, a * 1.3);
    });
    return { minS, maxS };
  }

  // Vista "smart": inquadra BE e struttura (sell put â BE a sx, sell call â a dx, due BE â entrambi)
  function computeSmartChartRange(spot, breakevens) {
    const anchors = collectStructureAnchors(spot);
    const bes = (breakevens || []).filter(b => isFinite(b) && b > 0);
    const all = [...anchors, ...bes];

    let minS, maxS;

    if (bes.length >= 2) {
      // Struttura con due (o piÃ¹) BE: inquadra tra il minimo e il massimo BE + padding
      const lo = Math.min(...bes);
      const hi = Math.max(...bes);
      const span = Math.max(hi - lo, 40);
      const pad = span * 0.35;
      minS = lo - pad;
      maxS = hi + pad;
      // includi sempre lo spot se vicino
      if (spot < minS) minS = spot - span * 0.15;
      if (spot > maxS) maxS = spot + span * 0.15;
    } else if (bes.length === 1) {
      // Un solo BE (tipico short put / short call / future sbilanciato)
      const be = bes[0];
      const dist = Math.abs(be - spot);
      const pad = Math.max(dist * 0.45, 50);
      if (be < spot) {
        // BE a sinistra (es. sell put): inquadra da BE-pad fino a spot+pad
        minS = be - pad;
        maxS = spot + Math.max(pad * 0.7, 40);
      } else {
        // BE a destra (es. sell call)
        minS = spot - Math.max(pad * 0.7, 40);
        maxS = be + pad;
      }
    } else {
      // Solo futures / linea piatta: centrato sullo spot, allarga se ci sono ingressi lontani
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

    // Garantisce un'ampiezza minima leggibile
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
    // Ricalcola BE su range ampio (adattivo) e applica smart frame
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
    // Aggiorna anche base cosÃ¬ Reset torna a questa inquadratura operativa
    chartView.baseMin = smart.minS;
    chartView.baseMax = smart.maxS;
    redrawChartFromView();
  }

  function buildPayoffPoints(scheda, minS, maxS, resNES, resMES) {
    // Griglia uniforme + punti esatti sugli strike e sugli ingressi futures:
    // senza i vertici esatti la polilinea SVG taglia le cuspidi del payoff
    // a scadenza e la curva appare morbida invece dello spigolo vivo.
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

  // Curve di payoff di TUTTE le schede (Matrice + comparazioni) per il grafico
  function buildCurveSets(minS, maxS) {
    return stato.schede.map((scheda, i) => ({
      nome: scheda.nome,
      colore: coloreScheda(i),
      pts: buildPayoffPoints(scheda, minS, maxS,
        calcolaColonna(scheda, 'NES'), calcolaColonna(scheda, 'MES'))
    }));
  }

  // Trova i punti in cui pnlExpiry attraversa lo zero (interpolazione lineare).
  // Oltre agli attraversamenti veri e propri gestisce anche i casi limite:
  //   - tangenza: la curva TOCCA lo zero senza attraversarlo (radice doppia);
  //   - tratti piatti esattamente a zero (es. ratio spread a credito pari):
  //     il cambio di segno 0â+/â rileva il bordo del tratto, che Ã¨ il BE
  //     significativo (il punto in cui il P&L smette di essere zero);
  //   - primo campione giÃ  a zero col successivo positivo (bordo sinistro).
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
      // tangenza: valore esattamente 0 con lo stesso segno prima e dopo
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

  // Campionamento DENSO per la ricerca dei breakeven: alla solita griglia
  // uniforme aggiunge i punti esatti sugli strike, sulla media carico e
  // sugli ingressi futures attivi (le cuspidi del payoff a scadenza), con un
  // piccolo intorno Â±Îµ. Motivazione: con la sola griglia a 180 punti, quando
  // il range di scansione Ã¨ molto piÃ¹ ampio della struttura (es. opzioni su
  // AZIONI con strike ~100 mentre lo spot resta sui valori dei futures
  // ~7700) l'intera struttura cade tra due campioni lontani e gli
  // attraversamenti venivano persi o stimati grossolanamente.
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

  // Ricerca breakeven ROBUSTA. Difetti storici della vecchia scansione:
  //   1) il range [spotÂ±45% âª strutturaÂ±30%] non copriva i BE che cadono
  //      piÃ¹ lontano (premi pesanti, strutture sbilanciate) â BE mai rilevati
  //      anche se la curva li mostrava a grafico;
  //   2) il campionamento uniforme perdeva attraversamenti quando la
  //      struttura occupava una fetta minima del range (vedi sopra).
  // Qui si scandisce col campionamento denso e, se alle estremitÃ  la coda
  // del payoff (rettilinea oltre ogni strike/ingresso) punta a uno zero
  // fuori range, il range viene esteso fino a intercettarlo (max 6 giri).
  // CosÃ¬ un BE viene individuato in ogni caso: se esiste, lo si trova.
  function findBreakevensRobust(scheda, spot, minS, maxS, resNES, resMES) {
    let lo = Math.max(0.01, Math.min(minS, spot * 0.55));
    let hi = Math.max(maxS, spot * 1.45);
    if (!(hi > lo)) return [];
    let bes = [];
    for (let iter = 0; iter < 6; iter++) {
      const pts = buildPayoffPointsDense(scheda, lo, hi, resNES, resMES);
      bes = findBreakevens(pts);
      // pendenza asintotica ai bordi: zero estrapolato fuori range â estendi
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
    // filtra, ordina e dedup (tolleranza relativa allo spot)
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

    // Caso 1 BE solo
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

    // Caso ≥ 2 BE → sempre estremi assoluti della struttura
    beInfEl.textContent = fmtBe(sorted[0]);
    beSupEl.textContent = fmtBe(sorted[sorted.length - 1]);
  }

  function redrawChartFromView() {
    const { xMin, xMax, lastSpot, breakevens } = chartView;
    if (!(lastSpot > 0) || xMin == null || xMax == null) return;
    const showExpiry = el('showExpiry') ? el('showExpiry').checked : true;
    const showNow    = el('showNow')    ? el('showNow').checked    : true;
    const curveSets = buildCurveSets(xMin, xMax);
    drawPayoffChart(curveSets, lastSpot, showExpiry, showNow, breakevens || [], chartView.sigma, stato.attiva);
  }

  function resetChartZoom() {
    // Reset = ri-applica inquadratura smart (non solo il vecchio Â±12%)
    fitChartToStructure();
  }

  function structureSignature() {
    // firma leggera per capire se la struttura Ã¨ cambiata (non solo lo spot)
    const parts = [`${stato.schede.length}:${stato.attiva}`];
    const scheda = schedaAttiva();
    ['NES', 'MES'].forEach(col => {
      const res = calcolaColonna(scheda, col);
      parts.push(`${res.qtaNetta}:${res.mediaPulita || 0}`);
      (scheda[col] || []).forEach(m => {
        parts.push(`${m.attivo !== false ? 1 : 0}:${m.direzione}:${m.quantita}:${m.prezzoPulito}`);
      });
    });
    (scheda.opzioni || []).forEach(o => {
      parts.push(`${o.attivo !== false ? 1 : 0}:${o.pos}:${o.tipo}:${o.qta}:${o.strike}:${o.premio}:${o.stato}:${o.vol}:${o.scadenza}:${o.rlzd}:${o.strumento || 'MES'}`);
    });
    return parts.join('|') + `|cash:${(typeof stato.cash === 'number') ? stato.cash : 0}:${stato.cashEscluso ? 1 : 0}|fee:${commissioniAttive() ? 1 : 0}`;
  }

  function aggiornaPayoffPreview(scheda, resNES, resMES) {
    const spot = parseFloat(el('prezzoSpot').value) || 0;
    const deltaEl = el('payoffDeltaNetto');
    if (!(spot > 0)) {
      deltaEl.textContent = 'â';
      chartView.lastSpot = 0;
      chartView.breakevens = [];
      chartView._sig = null;
      updateBreakevenLabels([], 0);
      updatePOPLabel(null);
      chartView.sigma = null;
      drawPayoffChart([], spot, false, false, [], null, stato.attiva);
      return;
    }

    const delta = deltaNettoTotale(scheda, resNES, resMES);
    deltaEl.textContent = formatGreek(delta, 3);
    deltaEl.style.color = delta >= 0 ? 'var(--green)' : 'var(--red)';

    chartView.lastResNES = resNES;
    chartView.lastResMES = resMES;
    chartView.lastSpot = spot;

    // BE su range di scansione ampio (adattivo alla struttura) con ricerca
    // ROBUSTA: campionamento denso sugli strike/ingressi + estensione
    // automatica del range se il BE cade oltre i confini. Il range include
    // anche la porzione di grafico attualmente visibile: un BE che si vede
    // a video non puÃ² piÃ¹ restare non rilevato.
    const scan = scanRangeForBE(spot);
    let scanMin = scan.minS, scanMax = scan.maxS;
    if (chartView.xMin != null && chartView.xMax != null && chartView.xMax > chartView.xMin) {
      scanMin = Math.min(scanMin, chartView.xMin);
      scanMax = Math.max(scanMax, chartView.xMax);
    }
    chartView.breakevens = findBreakevensRobust(scheda, spot, scanMin, scanMax, resNES, resMES);
    updateBreakevenLabels(chartView.breakevens, spot);
    updatePOPLabel(calcolaPOP(scheda, spot, chartView.breakevens, resNES, resMES, scanMin, scanMax));

    const sig = structureSignature();
    const structureChanged = sig !== chartView._sig;
    chartView._sig = sig;

    // Prima volta o struttura cambiata â inquadratura smart automatica
    // (cambio solo spot: mantiene lo zoom utente)
    if (chartView.xMin == null || structureChanged) {
      const smart = computeSmartChartRange(spot, chartView.breakevens);
      chartView.xMin = smart.minS;
      chartView.xMax = smart.maxS;
      chartView.baseMin = smart.minS;
      chartView.baseMax = smart.maxS;
    }

    const showExpiry = el('showExpiry') ? el('showExpiry').checked : true;
    const showNow    = el('showNow')    ? el('showNow').checked    : true;
    chartView.sigma = sigmaBandsAt(spot, resNES, resMES);
    const curveSets = buildCurveSets(chartView.xMin, chartView.xMax);
    drawPayoffChart(curveSets, spot, showExpiry, showNow, chartView.breakevens, chartView.sigma, stato.attiva);
  }

  function drawPayoffChart(curveSets, spot, showExpiry, showNow, breakevens, sigma, attivaIdx) {
    const svg = el('payoffChart');
    if (!svg) return;
    breakevens = breakevens || [];
    curveSets = curveSets || [];

    const W = 920, H = 380;
    const padL = 58, padR = 18, padT = 28, padB = 32;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    // Curva della scheda attiva (tooltip, area colorata, BE)
    const attiva = curveSets[attivaIdx] || curveSets[0] || null;
    const pts = attiva ? attiva.pts : [];

    if (!pts.length) {
      chartGeom = null;
      svg.innerHTML = `<text x="${W/2}" y="${H/2}" fill="#8b93a7" font-size="13" text-anchor="middle">Inserisci una posizione per vedere il payoff</text>`;
      return;
    }

    const xs = pts.map(p => p.S);
    let ys = [];
    curveSets.forEach(cs => {
      if (showExpiry) ys = ys.concat(cs.pts.map(p => p.pnlExpiry));
      if (showNow)    ys = ys.concat(cs.pts.map(p => p.pnlNow));
    });
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

    // Deviazioni standard verticali (Vol ATM, orizzonte POP): linee Â±kÂ·Ï attorno
    // allo spot, k = 1..N scelto dal menu a tendina. Colore verde per non
    // confonderle con la linea spot (azzurra). Logica come il resto del file:
    // box "Dev. std" spuntato = nascoste, non spuntato = visibili.
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

    // Area colorata sotto la curva a scadenza (solo della scheda attiva)
    if (showExpiry) {
      const areaPath = `${pathFrom(attiva.pts, 'pnlExpiry')} L ${xPix(xMax)} ${zeroY} L ${xPix(xMin)} ${zeroY} Z`;
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

    // Curve: una per scheda (Matrice + comparazioni). Prima le non attive,
    // poi l'attiva sopra le altre. Linea piena = a scadenza, tratteggiata = Now.
    curveSets.map((cs, i) => i)
      .filter(i => i !== attivaIdx)
      .concat([attivaIdx])
      .forEach(i => {
        const cs = curveSets[i];
        if (!cs) return;
        const isAttiva = i === attivaIdx;
        if (showExpiry) {
          svgContent += `<path d="${pathFrom(cs.pts, 'pnlExpiry')}" fill="none" stroke="${cs.colore}" stroke-width="${isAttiva ? 2.4 : 2}"/>`;
        }
        if (showNow) {
          svgContent += `<path d="${pathFrom(cs.pts, 'pnlNow')}" fill="none" stroke="${cs.colore}" stroke-width="1.8" stroke-dasharray="5,4" opacity="0.85"/>`;
        }
      });

    // Marker Breakeven (solo quelli nel range visibile; on/off col box "Breakeven")
    const showBEFlag = el('showBE') ? el('showBE').checked : true;
    if (showBEFlag) breakevens.forEach((be) => {
      if (be < xMin || be > xMax) return;
      const bx = xPix(be);
      svgContent += `<line x1="${bx}" y1="${padT}" x2="${bx}" y2="${H - padB}" stroke="#f1c40f" stroke-width="1.4" stroke-dasharray="5,3" stroke-opacity="0.9"/>`;
      svgContent += `<text x="${bx + 3}" y="${H - padB - 6}" fill="#f1c40f" font-size="10" text-anchor="start">BE ${be.toFixed(0)}</text>`;
    });

    // Marker Spot
    if (spot >= xMin && spot <= xMax) {
      const sx = xPix(spot);
      svgContent += `<line x1="${sx}" y1="${padT}" x2="${sx}" y2="${H - padB}" stroke="#4f8cff" stroke-width="1.5" stroke-dasharray="4,3"/>`;
      svgContent += `<text x="${sx}" y="${padT - 8}" fill="#4f8cff" font-size="11" text-anchor="middle">Spot ${Math.round(spot)}</text>`;
    }

    // Bordo
    svgContent += `<rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="none" stroke="#2a2f3a"/>`;

    // Layer hover (crosshair + tooltip)
    svgContent += `
      <g id="hoverLayer" style="pointer-events:none;">
        <line id="hoverLine" x1="0" y1="${padT}" x2="0" y2="${H - padB}" stroke="#7d8590" stroke-width="1" stroke-dasharray="3,3" style="display:none"/>
        <circle id="hoverDotExpiry" cx="0" cy="0" r="4" fill="#ffffff" stroke="#0c0e12" stroke-width="1.5" style="display:none"/>
        <circle id="hoverDotNow" cx="0" cy="0" r="4" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="2,1" style="display:none"/>
        <rect id="hoverBox" x="0" y="0" width="168" height="58" rx="5" fill="#0f1115" stroke="#2a2f3a" stroke-width="1" style="display:none"/>
        <text id="hoverText1" x="0" y="0" fill="#e6e8ee" font-size="11" font-family="Segoe UI, Roboto, sans-serif" style="display:none"></text>
        <text id="hoverText2" x="0" y="0" fill="#ffffff" font-size="11" font-family="Segoe UI, Roboto, sans-serif" style="display:none"></text>
        <text id="hoverText3" x="0" y="0" fill="#a8b0c0" font-size="11" font-family="Segoe UI, Roboto, sans-serif" style="display:none"></text>
      </g>
    `;

    svg.innerHTML = svgContent;

    chartGeom = {
      W, H, padL, padR, padT, padB, plotW, plotH,
      xMin, xMax, yMin, yMax, xPix, yPix, pts, showExpiry, showNow,
      activeColor: attiva.colore
    };

    bindChartHover();
  }

  function clearChartHover() {
    ['hoverLine', 'hoverDotExpiry', 'hoverDotNow', 'hoverBox', 'hoverText1', 'hoverText2', 'hoverText3'].forEach(id => {
      const e = document.getElementById(id);
      if (e) e.style.display = 'none';
    });
  }

  function handleChartHover(e) {
    if (!chartGeom || !chartGeom.pts.length) return;
    const svg = el('payoffChart');
    if (!svg) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const svgPt = pt.matrixTransform(ctm.inverse());

    const { padL, padR, padT, padB, W, H, xMin, xMax, xPix, yPix, pts, showExpiry, showNow } = chartGeom;

    if (svgPt.x < padL || svgPt.x > W - padR || svgPt.y < padT || svgPt.y > H - padB) {
      clearChartHover();
      return;
    }

    const S = xMin + ((svgPt.x - padL) / (W - padL - padR)) * (xMax - xMin);

    // punto piÃ¹ vicino nella curva
    let nearest = pts[0];
    let best = Infinity;
    for (const p of pts) {
      const d = Math.abs(p.S - S);
      if (d < best) { best = d; nearest = p; }
    }

    const px = xPix(nearest.S);
    const line = document.getElementById('hoverLine');
    const dotExp = document.getElementById('hoverDotExpiry');
    const dotNow = document.getElementById('hoverDotNow');
    const box = document.getElementById('hoverBox');
    const t1 = document.getElementById('hoverText1');
    const t2 = document.getElementById('hoverText2');
    const t3 = document.getElementById('hoverText3');
    if (!line || !box) return;

    line.setAttribute('x1', px);
    line.setAttribute('x2', px);
    line.style.display = '';

    if (showExpiry && dotExp) {
      dotExp.setAttribute('cx', px);
      dotExp.setAttribute('cy', yPix(nearest.pnlExpiry));
      dotExp.setAttribute('fill', chartGeom.activeColor || '#ffffff');
      dotExp.style.display = '';
    } else if (dotExp) dotExp.style.display = 'none';

    if (showNow && dotNow) {
      dotNow.setAttribute('cx', px);
      dotNow.setAttribute('cy', yPix(nearest.pnlNow));
      dotNow.style.display = '';
    } else if (dotNow) dotNow.style.display = 'none';

    const fmt = v => (v >= 0 ? '+' : '') + v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const lines = [
      `Prezzo  ${nearest.S.toFixed(2)}`,
      showExpiry ? `Scadenza  ${fmt(nearest.pnlExpiry)}` : null,
      showNow ? `Now  ${fmt(nearest.pnlNow)}` : null
    ].filter(Boolean);

    const boxW = 168;
    const boxH = 10 + lines.length * 15;
    let boxX = px + 12;
    if (boxX + boxW > W - padR) boxX = px - boxW - 12;
    let boxY = padT + 8;
    // posiziona vicino al punto principale
    const refY = showExpiry ? yPix(nearest.pnlExpiry) : yPix(nearest.pnlNow);
    boxY = Math.max(padT + 4, Math.min(refY - boxH - 8, H - padB - boxH - 4));

    box.setAttribute('x', boxX);
    box.setAttribute('y', boxY);
    box.setAttribute('width', boxW);
    box.setAttribute('height', boxH);
    box.style.display = '';

    const texts = [t1, t2, t3];
    lines.forEach((txt, i) => {
      if (!texts[i]) return;
      texts[i].setAttribute('x', boxX + 10);
      texts[i].setAttribute('y', boxY + 16 + i * 15);
      texts[i].textContent = txt;
      texts[i].style.display = '';
      // colori: prezzo muted, scadenza bianco, now grigio chiaro
      if (i === 0) texts[i].setAttribute('fill', '#a8b0c0');
      else if (txt.startsWith('Scadenza')) texts[i].setAttribute('fill', '#ffffff');
      else texts[i].setAttribute('fill', '#c8d0dc');
    });
    for (let i = lines.length; i < 3; i++) {
      if (texts[i]) texts[i].style.display = 'none';
    }
  }

  // Frazione (0..1) della larghezza plot sotto il centro di due dita
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

  // Gesture a due dita: pan + pinch combinati.
  // Memorizza la distanza iniziale e il prezzo ("ancora") sotto il centro dita.
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
      // Zoom con rotella (centrato sul cursore)
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
        // prezzo sotto il cursore
        const frac = Math.max(0, Math.min(1, (svgPt.x - padL) / plotW));
        const cursorS = chartView.xMin + frac * (chartView.xMax - chartView.xMin);

        const factor = e.deltaY < 0 ? 0.85 : 1.18; // zoom in / out
        let newWidth = (chartView.xMax - chartView.xMin) * factor;
        // limiti: non troppo stretto, non troppo largo rispetto alla base
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

      // Pan: trascina (desktop)
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
        const { padL, W, padR, plotW } = chartGeom;
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

      // ---- Touch: un dito = cursore prezzo/tooltip, due dita = sposta + pinch zoom ----
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
        e.preventDefault(); // niente scroll pagina: il dito controlla il grafico
        if (!touchGesture || !chartGeom) return;

        if (touchGesture.mode === 'hover') {
          if (e.touches.length === 1) {
            handleChartHover(e.touches[0]);
          } else if (e.touches.length >= 2) {
            // da cursore a due dita: passa a pan/zoom
            touchGesture = buildTwoFingerGesture(svg, e.touches);
          }
          return;
        }

        if (touchGesture.mode === 'two' && e.touches.length === 2) {
          const t0 = e.touches[0], t1 = e.touches[1];
          const curDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
          if (!(curDist > 0) || !(touchGesture.startDist > 0)) return;
          // zoom dal rapporto delle distanze
          let newW = touchGesture.startW * (touchGesture.startDist / curDist);
          const baseW = (chartView.baseMax - chartView.baseMin) || touchGesture.startW;
          newW = Math.max(baseW * 0.05, Math.min(baseW * 4, newW));
          // pan: l'ancora iniziale segue la posizione corrente del centro dita
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
          // da due dita a una: passa alla modalitÃ  cursore
          touchGesture = { mode: 'hover' };
          handleChartHover(e.touches[0]);
        }
      }, { passive: true });
      svg.addEventListener('touchcancel', () => { touchGesture = null; clearChartHover(); }, { passive: true });

      // Doppio click = reset
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
