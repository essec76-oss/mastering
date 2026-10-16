// matematica.js — Black-76 / Black-Scholes, greche, POP, formattazione
// Parte di Mastering (già app.js): l'ordine di caricamento è definito in index.html.
// v27 — Nessun riferimento a commissioni: P&L lordo.

  // ============================================================
  // DATA ANALISI
  // ============================================================
  function dataOggiIso() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function dataAnalisiDate() {
    const inp = el('dataAnalisi');
    if (inp && inp.value) {
      const parts = inp.value.split('-').map(Number);
      if (parts.length === 3 && parts.every(n => isFinite(n))) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
      }
    }
    return new Date();
  }

  function yearsBetween(dateA, dateB) {
    const a = (dateA instanceof Date) ? dateA : new Date(dateA);
    const b = (dateB instanceof Date) ? dateB : new Date(dateB);
    if (!isFinite(a.getTime()) || !isFinite(b.getTime())) return null;
    const ms = b.getTime() - a.getTime();
    return ms / (365.25 * 24 * 60 * 60 * 1000);
  }

  function giorniTra(dateA, dateB) {
    const a = (dateA instanceof Date) ? dateA : new Date(dateA);
    const b = (dateB instanceof Date) ? dateB : new Date(dateB);
    if (!isFinite(a.getTime()) || !isFinite(b.getTime())) return null;
    return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
  }

  // ============================================================
  // BLACK-76 (futures) / BLACK-SCHOLES (azioni)
  // ============================================================
  // tipo: 'call' | 'put'
  // opz.strumento: 'AZIONI' → Black-Scholes con dividend yield; MES/ES/ticker → Black-76
  function modelPrice(S, opz, T, tipo) {
    if (!(S > 0) || !(opz.strike > 0)) return 0;
    const K = opz.strike;
    const sigma = Math.max(0.0001, (opz.vol || 0) / 100);
    const r = (parseFloat(el('riskFree').value) || 0) / 100;
    if (T == null || T <= 0) {
      return tipo === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);
    }
    const sqrtT = Math.sqrt(T);
    const strumento = opz.strumento || 'MES';
    let d1, d2, discount;
    if (strumento === 'AZIONI') {
      const q = (parseFloat(el('divYield') && el('divYield').value) || 0) / 100;
      d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
      d2 = d1 - sigma * sqrtT;
      discount = Math.exp(-r * T);
    } else {
      // Black-76: F = S (approssimazione, spot = future)
      d1 = (Math.log(S / K) + 0.5 * sigma * sigma * T) / (sigma * sqrtT);
      d2 = d1 - sigma * sqrtT;
      discount = Math.exp(-r * T);
    }
    const Nd1 = normCdf(d1);
    const Nd2 = normCdf(d2);
    if (tipo === 'call') return discount * (S * Nd1 - K * Nd2);
    return discount * (K * (1 - Nd2) - S * (1 - Nd1));
  }

  // Normale standard cumulata (Abramowitz-Stegun 26.2.17, precisione ~1e-7)
  function normCdf(x) {
    if (x < -10) return 0;
    if (x > 10) return 1;
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989422804014327 * Math.exp(-x * x / 2);
    const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return x >= 0 ? 1 - p : p;
  }

  // Normale standard densità
  function normPdf(x) {
    return 0.3989422804014327 * Math.exp(-x * x / 2);
  }

  // ============================================================
  // GRECHE (posizione = qta × segno)
  // ============================================================
  // Ritorna { delta, gamma, vega, theta } per UNA opzione (per contratto,
  // senza moltiplicatore): delta in unità "1.0 = 100 azioni".
  function calcolaGrecheOpzione(opz) {
    const out = { delta: NaN, gamma: NaN, vega: NaN, theta: NaN };
    if (!opz || !(opz.strike > 0)) return out;
    const S = parseFloat(el('prezzoSpot').value) || 0;
    if (!(S > 0)) return out;
    const K = opz.strike;
    const sigma = Math.max(0.0001, (opz.vol || 0) / 100);
    const r = (parseFloat(el('riskFree').value) || 0) / 100;
    const today = dataAnalisiDate();
    const T = opz.scadenza ? yearsBetween(today, opz.scadenza) : 0;
    if (T == null || T <= 0) {
      const tipo = (opz.tipo || 'PUT').toLowerCase() === 'call' ? 'call' : 'put';
      const intrinseco = tipo === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);
      out.delta = (tipo === 'call' ? (S > K ? 1 : 0) : (S < K ? -1 : 0));
      out.gamma = 0; out.vega = 0; out.theta = 0;
      return out;
    }
    const sqrtT = Math.sqrt(T);
    const tipo = (opz.tipo || 'PUT').toLowerCase() === 'call' ? 'call' : 'put';
    const strumento = opz.strumento || 'MES';
    const q = strumento === 'AZIONI'
      ? (parseFloat(el('divYield') && el('divYield').value) || 0) / 100
      : 0;
    let d1, d2;
    if (strumento === 'AZIONI') {
      d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
      d2 = d1 - sigma * sqrtT;
    } else {
      d1 = (Math.log(S / K) + 0.5 * sigma * sigma * T) / (sigma * sqrtT);
      d2 = d1 - sigma * sqrtT;
    }
    const Nd1 = normCdf(d1);
    const Nd2 = normCdf(d2);
    const pdf1 = normPdf(d1);
    const discR = Math.exp(-r * T);
    const discQ = Math.exp(-q * T);

    // Delta (in unità "1.0 = 100 azioni"): per AZIONI include e^{-qT}
    if (tipo === 'call') {
      out.delta = strumento === 'AZIONI' ? discQ * Nd1 : Nd1;
    } else {
      out.delta = strumento === 'AZIONI' ? discQ * (Nd1 - 1) : (Nd1 - 1);
    }
    // Gamma (identica BS / B76)
    out.gamma = pdf1 / (S * sigma * sqrtT);
    // Vega (per 1% di vol, in unità prezzo)
    out.vega = S * pdf1 * sqrtT / 100;
    // Theta (per giorno)
    let thetaAnn;
    if (strumento === 'AZIONI') {
      const term1 = -(S * pdf1 * sigma) / (2 * sqrtT);
      if (tipo === 'call') {
        thetaAnn = term1 - r * K * discR * Nd2 + q * S * discQ * Nd1;
      } else {
        thetaAnn = term1 + r * K * discR * (1 - Nd2) - q * S * discQ * (1 - Nd1);
      }
    } else {
      const term1 = -(S * pdf1 * sigma) / (2 * sqrtT);
      if (tipo === 'call') {
        thetaAnn = term1 + r * K * discR * Nd2;
      } else {
        thetaAnn = term1 - r * K * discR * (1 - Nd2);
      }
    }
    out.theta = thetaAnn / 365;
    return out;
  }

  // ============================================================
  // BANDE SIGMA (per il grafico)
  // ============================================================
  // Banda ±nσ basata sulla Vol ATM e sull'orizzonte della prima scadenza
  // del mondo attivo. Ritorna { s1 } = deviazione standard in punti indice.
  function sigmaBandsAt(spot, resNES, resMES) {
    const volAtm = (parseFloat(el('volAtm') && el('volAtm').value) || 15) / 100;
    if (!(spot > 0)) return null;
    const scheda = schedaAttiva();
    const firstExp = firstExpiryOpzioni(scheda);
    let T = null;
    if (firstExp) {
      T = yearsBetween(dataAnalisiDate(), firstExp);
    }
    if (T == null || T <= 0) {
      // Fallback: 30 giorni
      T = 30 / 365.25;
    }
    const s1 = spot * volAtm * Math.sqrt(T);
    return { s1, T };
  }

  // ============================================================
  // POP — Probabilità di profitto (lognormale, Vol ATM)
  // ============================================================
  // Calcola la POP come probabilità che il prezzo a scadenza cada in una
  // zona di profitto delimitata dai breakeven. Ritorna { pop, zone } dove
  // zone è [{da, a, pop}, ...] per la visualizzazione.
  function calcolaPOP(scheda, spot, bes, resNES, resMES, minS, maxS) {
    if (!(spot > 0) || !isFinite(spot)) return null;
    const volAtm = (parseFloat(el('volAtm') && el('volAtm').value) || 15) / 100;
    const scheda_ = scheda || schedaAttiva();
    const firstExp = firstExpiryOpzioni(scheda_);
    let T = null;
    if (firstExp) T = yearsBetween(dataAnalisiDate(), firstExp);
    if (T == null || T <= 0) T = 30 / 365.25;
    const sigma = volAtm * Math.sqrt(T);
    if (!(sigma > 0)) return null;
    const mu = Math.log(spot) - 0.5 * sigma * sigma;
    const sd = sigma;
    const sorted = (bes || []).filter(b => isFinite(b) && b > 0).sort((a, b) => a - b);
    // Zone di profitto: verifica ai punti medi tra BE e estremi
    const zone = [];
    const loBound = Math.max(0.01, (minS != null ? minS : spot * 0.5));
    const hiBound = (maxS != null ? maxS : spot * 1.5);
    const edges = [loBound, ...sorted, hiBound];
    for (let i = 0; i < edges.length - 1; i++) {
      const a = edges[i], b = edges[i + 1];
      const mid = (a + b) / 2;
      const pnlMid = pnlCombinatoAt(scheda_, mid, 'expiry', resNES, resMES);
      if (pnlMid > 0) {
        // Probabilità che S_T cada in [a, b] (lognormale)
        const zA = (Math.log(Math.max(a, 0.01)) - mu) / sd;
        const zB = (Math.log(Math.max(b, 0.01)) - mu) / sd;
        const p = normCdf(zB) - normCdf(zA);
        zone.push({ da: a, a: b, pop: p });
      }
    }
    const pop = zone.reduce((s, z) => s + z.pop, 0);
    return { pop: Math.max(0, Math.min(1, pop)), zone, T, sigma };
  }

  function updatePOPLabel(pop) {
    const elPop = el('popValue');
    const elZone = el('popZoneWrap');
    if (!elPop) return;
    if (!pop || !isFinite(pop.pop)) {
      elPop.textContent = '—';
      if (elZone) elZone.innerHTML = '';
      return;
    }
    elPop.textContent = (pop.pop * 100).toFixed(1) + '%';
    if (elZone) {
      elZone.innerHTML = pop.zone.map(z =>
        `<span>${formatPrezzo(z.da)}–${formatPrezzo(z.a)}: <strong style="color:var(--text);">${(z.pop * 100).toFixed(1)}%</strong></span>`
      ).join('');
    }
  }

  // ============================================================
  // FORMATTAZIONE
  // ============================================================
  function formatEuro(v) {
    if (v == null || !isFinite(v)) return '—';
    return v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatPrezzo(v) {
    if (v == null || !isFinite(v)) return '—';
    return v.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  }

  function formatGreek(v, dec) {
    if (v == null || !isFinite(v)) return '—';
    const d = (dec == null) ? 2 : dec;
    return v.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function formatGreekAuto(v, decMin, decMax) {
    if (v == null || !isFinite(v)) return '—';
    const a = (decMin == null) ? 2 : decMin;
    const b = (decMax == null) ? a : decMax;
    return v.toLocaleString('it-IT', { minimumFractionDigits: a, maximumFractionDigits: b });
  }

  // Strumento opzioni selezionato nella scheda attiva
  function strumentoOpzSelezionato() {
    const sel = el('strumentoOpzioni');
    if (sel && sel.value) return sel.value;
    const scheda = schedaAttiva();
    return (scheda && scheda.strumentoOpzioni) || 'MES';
  }
