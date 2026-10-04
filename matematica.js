// matematica.js — modelli Black-76 / Black-Scholes, probabilità e helper data
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.
  // ============================================================
  // MATEMATICA BLACK-76 (per opzioni su futures)
  // ============================================================
  function erf(x) {
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const t = 1 / (1 + p * x);
    const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
  }
  function normCDF(x) { return 0.5 * (1 + erf(x / Math.SQRT2)); }
  function normPDF(x) { return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI); }

  // ProbabilitÃ  che il sottostante (GBM, drift nullo) tocchi il livello H
  // prima della scadenza T (in anni), con volatilitÃ  vol (frazione).
  // Identica alla funzione del Calcolatore Payoff (formula della riflessione).
  function touchProbability(S0, H, vol, T) {
    if (!(S0 > 0) || !(H > 0) || !(vol > 0) || !(T > 0)) return null;
    const b = Math.log(H / S0);
    if (Math.abs(b) < 1e-12) return 1;
    const nu = -0.5 * vol * vol;
    const sqrtT = Math.sqrt(T);
    const denom = vol * sqrtT;
    let p;
    if (b > 0) {
      const m = b;
      p = normCDF((nu * T - m) / denom) + Math.exp((2 * nu * m) / (vol * vol)) * normCDF((-nu * T - m) / denom);
    } else {
      const m = -b;
      p = normCDF((-nu * T - m) / denom) + Math.exp((-2 * nu * m) / (vol * vol)) * normCDF((nu * T - m) / denom);
    }
    return Math.min(1, Math.max(0, p));
  }

  // CDF lognormale del sottostante a scadenza T (anni), vol ATM in frazione
  function lognormalCDF(S, S0, vol, T) {
    if (!(S > 0) || !(S0 > 0)) return S >= S0 ? 1 : 0;
    const sigT = vol * Math.sqrt(T);
    if (!(sigT > 0)) return S >= S0 ? 1 : 0;
    // P(S_T <= S) con drift 0 (futures / Black-76)
    const d = (Math.log(S / S0) + 0.5 * vol * vol * T) / sigT;
    return normCDF(d);
  }

  // Giorni / anni alla scadenza opzione piÃ¹ vicina tra quelle attive e aperte
  // (della scheda indicata; default = scheda attiva). Ã la "prima scadenza"
  // usata come orizzonte da POP e bande sigma: coerente col metodo calendar.
  function nearestOptionYears(scheda) {
    const today = dataAnalisiDate();
    let minT = null;
    const ops = (scheda && scheda.opzioni) || (schedaAttiva().opzioni || []);
    ops.forEach(o => {
      if (o.attivo === false || o.stato === 'CHIUSA') return;
      if (!o.scadenza) return;
      const T = yearsBetween(today, o.scadenza);
      if (T == null || T < 0) return;
      if (minT === null || T < minT) minT = T;
    });
    return minT;
  }

  // POP: probabilità che a scadenza il P&L combinato sia > 0.
  // Ritorna { total, zones } dove zones = [{ lo, hi, prob, profitable }].
  // Nota: tra due BE consecutivi il payoff a scadenza non può cambiare segno
  // (zero-crossing contigui), quindi il test a punto medio è corretto.
  function calcolaPOP(scheda, spot, breakevens, resNES, resMES, scanMin, scanMax) {
    const volPct = parseFloat(el('volAtm') && el('volAtm').value) || 0;
    const vol = volPct / 100;
    // POP alla scadenza più corta (coerente con la curva A SCADENZA calendar)
    let T = nearestOptionYears(scheda);
    // Se non ci sono opzioni ma ci sono futures, usa orizzonte 30 giorni come riferimento
    if (T === null) {
      const hasFut = (resNES && resNES.qtaNetta !== 0) || (resMES && resMES.qtaNetta !== 0);
      if (!hasFut) return null;
      T = 30 / 365.25;
    }
    if (!(spot > 0) || !(vol > 0) || !(T > 0)) return null;

    const bes = (breakevens || []).filter(b => isFinite(b) && b > 0).sort((a, b) => a - b);

    let bounds;
    if (bes.length > 0) {
      bounds = [0, ...bes, Infinity];
    } else {
      // Nessun BE trovato: segmenta il range scansionato e valuta ogni tratto
      const lo = (isFinite(scanMin) && scanMin > 0) ? scanMin : Math.max(1, spot * 0.55);
      const hi = (isFinite(scanMax) && scanMax > lo) ? scanMax : spot * 1.45;
      const n = 10;
      const step = (hi - lo) / n;
      bounds = [];
      for (let i = 0; i <= n; i++) bounds.push(lo + i * step);
    }

    let prob = 0;
    const zones = [];
    for (let i = 0; i < bounds.length - 1; i++) {
      const lo = bounds[i];
      const hi = bounds[i + 1];
      const mid = hi === Infinity
        ? (bes.length ? Math.max(...bes) : spot) + Math.max(spot * 0.05, 50)
        : (lo + hi) / 2;
      const midS = mid <= 0 ? 0.01 : mid;
      const pnl = pnlCombinatoAt(scheda, midS, 'expiry', resNES, resMES);
      const cdfHi = hi === Infinity ? 1 : lognormalCDF(hi, spot, vol, T);
      const cdfLo = lognormalCDF(lo <= 0 ? 0.0001 : lo, spot, vol, T);
      const pZone = Math.max(0, cdfHi - cdfLo);
      const profitable = pnl > 0;
      if (profitable) prob += pZone;
      // Zone significative solo quando ci sono BE (altrimenti troppo frammentate)
      if (bes.length > 0) {
        zones.push({ lo, hi, prob: pZone, profitable });
      }
    }
    return {
      total: Math.min(1, Math.max(0, prob)),
      zones
    };
  }

  function updatePOPLabel(popResult) {
    const e = el('popValue');
    const wrap = el('popZoneWrap');
    if (!e) return;

    const pop = (popResult && typeof popResult === 'object') ? popResult.total : popResult;
    const zones = (popResult && typeof popResult === 'object') ? (popResult.zones || []) : [];

    if (pop === null || !isFinite(pop)) {
      e.textContent = '—';
      e.style.color = 'var(--muted)';
      if (wrap) wrap.innerHTML = '';
      return;
    }
    e.textContent = (pop * 100).toLocaleString('it-IT', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + '%';
    e.style.color = pop >= 0.5 ? 'var(--green)' : 'var(--red)';

    // Etichette per zona di profitto (come nel calcolatore di riferimento)
    if (!wrap) return;
    if (!zones.length) {
      wrap.innerHTML = '';
      return;
    }
    const fmtPct = p => (p * 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
    const fmtBound = v => (!isFinite(v) || v === Infinity) ? '+∞' : (v <= 0 ? '0' : v.toFixed(0));
    // Zone in profitto con descrizione chiara del significato
    const profitZones = zones.filter(z => z.profitable);
    if (!profitZones.length) {
      wrap.innerHTML = '<span style="color:var(--red);">nessuna zona in profitto</span>';
      return;
    }
    wrap.innerHTML = profitZones.map(z => {
      const isLower = z.lo <= 0 || z.lo < 1;              // sotto il BE inferiore
      const isUpper = !isFinite(z.hi) || z.hi === Infinity; // sopra il BE superiore
      let label, title;
      if (isLower && isUpper) {
        label = 'profitto ovunque';
        title = 'A scadenza il P&L è positivo su tutto il dominio';
      } else if (isLower) {
        label = `profitto sotto BE inf. (S &lt; ${fmtBound(z.hi)})`;
        title = `Probabilità di realizzare profitto scendendo sotto il BE inferiore (${fmtBound(z.hi)})`;
      } else if (isUpper) {
        label = `profitto sopra BE sup. (S &gt; ${fmtBound(z.lo)})`;
        title = `Probabilità di rimanere sopra il BE superiore (${fmtBound(z.lo)}) e realizzare profitto`;
      } else {
        label = `profitto tra ${fmtBound(z.lo)} e ${fmtBound(z.hi)}`;
        title = `Probabilità che a scadenza il sottostante sia tra ${fmtBound(z.lo)} e ${fmtBound(z.hi)} (zona di profitto)`;
      }
      const col = z.prob >= 0.5 ? 'var(--green)' : (z.prob > 0.05 ? 'var(--yellow)' : 'var(--muted)');
      return `<span title="${title}">${label} <strong style="color:${col};">${fmtPct(z.prob)}</strong></span>`;
    }).join('<span style="opacity:0.35; margin:0 2px;">|</span>');
  }

  // Bande Â±1Ï/Â±2Ï attorno allo spot: Vol ATM e orizzonte T del POP
  function sigmaBandsAt(spot, resNES, resMES) {
    const volPct = parseFloat(el('volAtm') && el('volAtm').value) || 0;
    const vol = volPct / 100;
    let T = nearestOptionYears();
    if (T === null) {
      const hasFut = (resNES && resNES.qtaNetta !== 0) || (resMES && resMES.qtaNetta !== 0);
      if (!hasFut) return null;
      T = 30 / 365.25;
    }
    if (!(spot > 0) || !(vol > 0) || !(T > 0)) return null;
    const s1 = spot * vol * Math.sqrt(T);
    return { s1, lo1: spot - s1, hi1: spot + s1, lo2: spot - 2 * s1, hi2: spot + 2 * s1 };
  }

  function yearsBetween(d1, d2) {
    const start = typeof d1 === 'string' ? parseDataLocal(d1) : d1;
    const end = typeof d2 === 'string' ? parseDataLocal(d2) : d2;
    if (!(start instanceof Date) || !(end instanceof Date) || isNaN(start) || isNaN(end)) return null;
    return (end - start) / (365.25 * 86400000);
  }

  // Parse 'YYYY-MM-DD' come mezzanotte locale (coerente con il today locale:
  // evita lo sfasamento UTC che alterava T di alcune ore)
  function parseDataLocal(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) {
      const d = new Date(s);
      return isNaN(d) ? null : d;
    }
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  // Data di analisi: default oggi, modificabile dal calendario.
  // Le opzioni fanno riferimento a questa data per il time decay
  // (consente simulazioni su date passate o future).
  function dataAnalisiDate() {
    const v = el('dataAnalisi') && el('dataAnalisi').value;
    if (v) {
      const d = parseDataLocal(v);
      if (d) return d;
    }
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }

  function dataOggiIso() {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }

  // Giorni residui tra la data analisi e la scadenza dell'opzione
  function giorniResiduiOpzione(opz) {
    if (!opz.scadenza) return null;
    const scad = parseDataLocal(opz.scadenza);
    if (!scad) return null;
    return Math.round((scad - dataAnalisiDate()) / 86400000);
  }

  // Moneyness: ATM se |KâS| â¤ 25 punti, altrimenti ITM/OTM in base al tipo
  function moneynessOpzione(opz) {
    const S = parseFloat(el('prezzoSpot').value) || 0;
    const K = parseFloat(opz.strike) || 0;
    if (!(S > 0) || !(K > 0)) return null;
    const tipo = (opz.tipo || 'PUT').toLowerCase() === 'call' ? 'call' : 'put';
    const diff = K - S;
    // ATM: Â±25 punti sui futures; sulle azioni Â±1% del prezzo (min Â±0,5)
    const sogliaAtm = (opz.strumento || 'MES') === 'AZIONI' ? Math.max(0.5, S * 0.01) : 25;
    let label;
    if (Math.abs(diff) <= sogliaAtm) label = 'ATM';
    else if (tipo === 'put') label = diff < 0 ? 'OTM' : 'ITM';
    else label = diff > 0 ? 'OTM' : 'ITM';
    return { label, diff, S };
  }

  // Distanza strike-spot in deviazioni standard: (KâS) / (S Â· VolATM Â· â(DTE/365.25))
  function sigmaDistanceOpzione(opz) {
    const m = moneynessOpzione(opz);
    if (!m) return null;
    const volPct = parseFloat(el('volAtm') && el('volAtm').value) || 0;
    const vol = volPct / 100;
    if (!(vol > 0)) return null;
    const gg = giorniResiduiOpzione(opz);
    if (gg === null || gg <= 0) return null;
    const sigma = m.S * vol * Math.sqrt(gg / 365.25);
    if (!(sigma > 0)) return null;
    return m.diff / sigma;
  }

  function aggiornaMoneyness(tr, opz) {
    const mCell = tr.querySelector('[data-field="ms"]');
    const sCell = tr.querySelector('[data-field="msSigma"]');
    if (!mCell || !sCell) return;
    if (opz.attivo === false) { mCell.textContent = 'â'; mCell.style.color = ''; sCell.textContent = ''; return; }
    const m = moneynessOpzione(opz);
    if (!m) { mCell.textContent = 'â'; mCell.style.color = ''; sCell.textContent = ''; return; }
    mCell.textContent = m.label;
    mCell.style.color = m.label === 'ATM' ? 'var(--yellow)' : (m.label === 'ITM' ? 'var(--green)' : 'var(--muted)');
    const sig = sigmaDistanceOpzione(opz);
    if (sig === null) { sCell.textContent = ''; return; }
    const sign = sig >= 0 ? '+' : 'â';
    sCell.textContent = sign + Math.abs(sig).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'Ï';
  }

  function black76(F, K, T, sigma, type, r) {
    F = Number(F); K = Number(K); T = Number(T); sigma = Number(sigma); r = Number(r) || 0;
    if (!isFinite(F) || !isFinite(K) || F <= 0 || K <= 0) {
      return { price: 0, delta: 0, gamma: 0, vega: 0, theta: 0, intrinsic: 0 };
    }
    if (!isFinite(T) || T < 0) T = 0;
    if (!isFinite(sigma) || sigma < 0) sigma = 0;

    const intrinsic = type === 'call' ? Math.max(F - K, 0) : Math.max(K - F, 0);

    if (T <= 0 || sigma <= 0) {
      let delta = 0;
      if (type === 'call') delta = F > K ? 1 : 0;
      else delta = F < K ? -1 : 0;
      return { price: intrinsic, delta, gamma: 0, vega: 0, theta: 0, intrinsic };
    }

    const sqrtT = Math.sqrt(T);
    const d1 = (Math.log(F / K) + 0.5 * sigma * sigma * T) / (sigma * sqrtT);
    const d2 = d1 - sigma * sqrtT;
    const pdf1 = normPDF(d1);
    const disc = Math.exp(-r * T);

    let price, delta;
    if (type === 'call') {
      price = disc * (F * normCDF(d1) - K * normCDF(d2));
      delta = disc * normCDF(d1);
    } else {
      price = disc * (K * normCDF(-d2) - F * normCDF(-d1));
      delta = -disc * normCDF(-d1);
    }
    const gamma = disc * pdf1 / (F * sigma * sqrtT);
    const vega = F * disc * pdf1 * sqrtT / 100; // per 1% IV
    const thetaAnnual = r * price - (F * disc * pdf1 * sigma) / (2 * sqrtT);
    const thetaPerDay = thetaAnnual / 365;

    return { price, delta, gamma, vega, theta: thetaPerDay, intrinsic };
  }

  // Black-Scholes con tasso r e dividendo continuo q (il modello "bs" con
  // r/q del calcolatore di riferimento): usato per le opzioni su AZIONI,
  // dove il sottostante Ã¨ lo spot azionario e non il future.
  function blackScholes(S, K, T, sigma, type, r, q) {
    S = Number(S); K = Number(K); T = Number(T); sigma = Number(sigma);
    r = Number(r) || 0; q = Number(q) || 0;
    if (!isFinite(S) || !isFinite(K) || S <= 0 || K <= 0) {
      return { price: 0, delta: 0, gamma: 0, vega: 0, theta: 0, intrinsic: 0 };
    }
    if (!isFinite(T) || T < 0) T = 0;
    if (!isFinite(sigma) || sigma < 0) sigma = 0;

    const intrinsic = type === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);

    if (T <= 0 || sigma <= 0) {
      let delta = 0;
      if (type === 'call') delta = S > K ? 1 : 0;
      else delta = S < K ? -1 : 0;
      return { price: intrinsic, delta, gamma: 0, vega: 0, theta: 0, intrinsic };
    }

    const sqrtT = Math.sqrt(T);
    const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
    const d2 = d1 - sigma * sqrtT;
    const pdf1 = normPDF(d1);
    const eqT = Math.exp(-q * T);
    const erT = Math.exp(-r * T);

    let price, delta, thetaAnnual;
    if (type === 'call') {
      price = S * eqT * normCDF(d1) - K * erT * normCDF(d2);
      delta = eqT * normCDF(d1);
      thetaAnnual = -S * eqT * pdf1 * sigma / (2 * sqrtT)
                  + q * S * eqT * normCDF(d1)
                  - r * K * erT * normCDF(d2);
    } else {
      price = K * erT * normCDF(-d2) - S * eqT * normCDF(-d1);
      delta = -eqT * normCDF(-d1);
      thetaAnnual = -S * eqT * pdf1 * sigma / (2 * sqrtT)
                  - q * S * eqT * normCDF(-d1)
                  + r * K * erT * normCDF(-d2);
    }
    const gamma = eqT * pdf1 / (S * sigma * sqrtT);
    const vega = S * eqT * pdf1 * sqrtT / 100; // per 1% IV

    return { price, delta, gamma, vega, theta: thetaAnnual / 365, intrinsic };
  }

  // Prezzo teorico di un'opzione a T anni dalla valutazione, col modello
  // corretto per strumento: AZIONI â Black-Scholes (r e q);
  // MES / ES â Black-76 (opzioni su futures, q non si applica).
  // Ritorna null se gli input non bastano (chiamante: fallback intrinseco).
  function modelPrice(S, opz, T, tipo) {
    const r = (parseFloat(el('riskFree').value) || 0) / 100;
    const vol = (parseFloat(opz.vol) || 0) / 100;
    const K = opz.strike || 0;
    if (!(T > 0) || !(vol > 0) || !(K > 0) || !(S > 0)) return null;
    if ((opz.strumento || 'MES') === 'AZIONI') {
      const q = (parseFloat(el('divYield') && el('divYield').value) || 0) / 100;
      return blackScholes(S, K, T, vol, tipo, r, q).price;
    }
    return black76(S, K, T, vol, tipo, r).price;
  }

  function calcolaGrecheOpzione(opz) {
    const spot = parseFloat(el('prezzoSpot').value) || 0;
    const r = (parseFloat(el('riskFree').value) || 0) / 100;
    const vol = (parseFloat(opz.vol) || 0) / 100;
    const K = parseFloat(opz.strike) || 0;
    const tipo = (opz.tipo || 'PUT').toLowerCase() === 'call' ? 'call' : 'put';
    const today = dataAnalisiDate();
    const T = opz.scadenza ? yearsBetween(today, opz.scadenza) : 0;
    if (!(K > 0) || !(spot > 0) || T == null) {
      // input incompleti: 'â' a video (NaN) invece di falsi 0,00
      return { price: NaN, delta: NaN, gamma: NaN, vega: NaN, theta: NaN, intrinsic: NaN, T: T || 0 };
    }
    // T<=0 (scaduta) â intrinseco; vol=0 â intrinseco.
    // Modello per strumento: AZIONI â Black-Scholes (r, q); MES/ES â Black-76
    const q = (parseFloat(el('divYield') && el('divYield').value) || 0) / 100;
    const g = (opz.strumento || 'MES') === 'AZIONI'
      ? blackScholes(spot, K, Math.max(0, T), vol, tipo, r, q)
      : black76(spot, K, Math.max(0, T), vol, tipo, r);
    return { ...g, T };
  }

  function formatEuro(v) {
    if (!isFinite(v)) return 'â';
    return v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function formatPrezzo(v) {
    if (!isFinite(v)) return 'â';
    return v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
