// matematica.js — Black-76 / Black-Scholes, greche, POP, moneyness, formattazione
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
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  function yearsBetween(dateA, dateB) {
    const a = (dateA instanceof Date) ? dateA : new Date(dateA);
    const b = (dateB instanceof Date) ? dateB : new Date(dateB);
    if (!isFinite(a.getTime()) || !isFinite(b.getTime())) return null;
        const giorni = Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
    return giorni / 365;
  }

  function giorniTra(dateA, dateB) {
    const a = (dateA instanceof Date) ? dateA : new Date(dateA);
    const b = (dateB instanceof Date) ? dateB : new Date(dateB);
    if (!isFinite(a.getTime()) || !isFinite(b.getTime())) return null;
    return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
  }

  // Giorni residui di un'opzione rispetto alla data analisi
  function giorniResiduiOpzione(opz) {
    if (!opz || !opz.scadenza) return null;
    const oggi = dataAnalisiDate();
    const scad = new Date(opz.scadenza);
    if (!isFinite(scad.getTime())) return null;
    return giorniTra(oggi, scad);
  }

  // ============================================================
  // BLACK-76 (futures) / BLACK-SCHOLES (azioni)
  // ============================================================
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
    let d1, d2, discount, discS;
    if (strumento === 'AZIONI') {
      const q = (parseFloat(el('divYield') && el('divYield').value) || 0) / 100;
      d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
      d2 = d1 - sigma * sqrtT;
      discount = Math.exp(-r * T);   // sconto su K
      discS = Math.exp(-q * T);      // sconto su S (dividendi)
    } else {
      d1 = (Math.log(S / K) + 0.5 * sigma * sigma * T) / (sigma * sqrtT);
      d2 = d1 - sigma * sqrtT;
      discount = Math.exp(-r * T);
      discS = discount;              // Black-76: S è il forward
    }
    const Nd1 = normCdf(d1);
    const Nd2 = normCdf(d2);
    if (tipo === 'call') return discS * S * Nd1 - discount * K * Nd2;
    return discount * K * (1 - Nd2) - discS * S * (1 - Nd1);
  }

  // Normale standard cumulata (Abramowitz-Stegun 26.2.17)
  function normCdf(x) {
    if (x < -10) return 0;
    if (x > 10) return 1;
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989422804014327 * Math.exp(-x * x / 2);
    const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return x >= 0 ? 1 - p : p;
  }

  function normPdf(x) {
    return 0.3989422804014327 * Math.exp(-x * x / 2);
  }

  // ============================================================
  // GRECHE
  // ============================================================
  // Ritorna { delta, gamma, vega, theta, price, intrinsic, T }
  // price     = prezzo teorico dell'opzione (una gamba, per contratto)
  // intrinsic = valore intrinseco
  // T         = anni residui
  function calcolaGrecheOpzione(opz) {
    const out = { delta: NaN, gamma: NaN, vega: NaN, theta: NaN, price: NaN, intrinsic: NaN, T: NaN };
    if (!opz || !(opz.strike > 0)) return out;
    const S = parseFloat(el('prezzoSpot').value) || 0;
    if (!(S > 0)) return out;
    const K = opz.strike;
    const sigma = Math.max(0.0001, (opz.vol || 0) / 100);
    const r = (parseFloat(el('riskFree').value) || 0) / 100;
    const today = dataAnalisiDate();
    const T = opz.scadenza ? yearsBetween(today, opz.scadenza) : 0;
    const tipo = (opz.tipo || 'PUT').toLowerCase() === 'call' ? 'call' : 'put';
    const intrinseco = tipo === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);
    out.intrinsic = intrinseco;
    out.T = T;

    if (T == null || T <= 0) {
      out.price = intrinseco;
      out.delta = (tipo === 'call' ? (S > K ? 1 : 0) : (S < K ? -1 : 0));
      out.gamma = 0; out.vega = 0; out.theta = 0;
      return out;
    }
    const sqrtT = Math.sqrt(T);
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

    // Delta
    if (tipo === 'call') {
      out.delta = strumento === 'AZIONI' ? discQ * Nd1 : discR * Nd1;
    } else {
      out.delta = strumento === 'AZIONI' ? discQ * (Nd1 - 1) : discR * (Nd1 - 1);
    }
    // Fattore di sconto su S: e^{-qT} per le azioni, e^{-rT} per Black-76
    const discS = strumento === 'AZIONI' ? discQ : discR;
    // Gamma
    out.gamma = discS * pdf1 / (S * sigma * sqrtT);
    // Vega (per 1% di vol)
    out.vega = discS * S * pdf1 * sqrtT / 100;
    // Theta (per giorno)
    let thetaAnn;
    if (strumento === 'AZIONI') {
      const term1 = -(S * discQ * pdf1 * sigma) / (2 * sqrtT);
      if (tipo === 'call') {
        thetaAnn = term1 - r * K * discR * Nd2 + q * S * discQ * Nd1;
      } else {
        thetaAnn = term1 + r * K * discR * (1 - Nd2) - q * S * discQ * (1 - Nd1);
      }
    } else {
      // Black-76: theta = r*prezzo - e^{-rT} * F * phi(d1) * sigma / (2*sqrt(T))
      const prezzoB76 = modelPrice(S, opz, T, tipo);
      thetaAnn = r * prezzoB76 - discR * (S * pdf1 * sigma) / (2 * sqrtT);
    }
    out.theta = thetaAnn / 365;

    // Prezzo teorico
    out.price = modelPrice(S, opz, T, tipo);

    return out;
  }

  // ============================================================
  // BANDE SIGMA
  // ============================================================
  function sigmaBandsAt(spot, resNES, resMES) {
    const volAtm = (parseFloat(el('volAtm') && el('volAtm').value) || 15) / 100;
    if (!(spot > 0)) return null;
    const scheda = schedaAttiva();
    const firstExp = firstExpiryOpzioni(scheda);
    let T = null;
    if (firstExp) T = yearsBetween(dataAnalisiDate(), firstExp);
    if (T == null || T <= 0) T = 30 / 365.25;
    const s1 = spot * volAtm * Math.sqrt(T);
    return { s1, T };
  }

  // ============================================================
  // POP — Probabilità di profitto (lognormale, Vol ATM)
  // ============================================================
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
    const zone = [];
        // Code della distribuzione incluse: la zona di profitto può estendersi oltre il range del grafico
    const loBound = 0.01;
    const hiBound = spot * 10;
    const sorted = (bes || []).filter(b => isFinite(b) && b > loBound && b < hiBound).sort((a, b) => a - b);
    const edges = [loBound, ...sorted, hiBound];
    for (let i = 0; i < edges.length - 1; i++) {
      const a = edges[i], b = edges[i + 1];
      const mid = (a + b) / 2;
      const pnlMid = pnlCombinatoAt(scheda_, mid, 'expiry', resNES, resMES);
      if (pnlMid > 0) {
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
    elPop.textContent = (pop.pop * 100).toFixed(10) + '%';
    if (elZone) {
      elZone.innerHTML = pop.zone.map(z =>
        `<span>${formatPrezzo(z.da)}–${formatPrezzo(z.a)}: <strong style="color:var(--text);">${(z.pop * 100).toFixed(4)}%</strong></span>`
      ).join('');
    }
  }

  // ============================================================
  // PROBABILITÀ DI TOCCO
  // ============================================================
  function touchProbability(spot, strike, volFrac, T) {
    if (!(spot > 0) || !(strike > 0) || !(volFrac > 0) || !(T > 0)) return null;
    const sigma = volFrac;
    const sigmaT = sigma * Math.sqrt(T);
    if (!(sigmaT > 0)) return null;
    const mu = Math.log(spot) - 0.5 * sigma * sigma * T;
    const z = (Math.log(strike) - mu) / sigmaT;
    // Strike sopra lo spot: coda destra; strike sotto lo spot: coda sinistra
    const pFine = strike >= spot ? 1 - normCdf(z) : normCdf(z);
    return Math.min(1, 2 * pFine);
  }

  // ============================================================
  // MONEYNESS
  // ============================================================
  function aggiornaMoneyness(tr, opz) {
    const spanM = tr.querySelector('[data-field="ms"]');
    const spanSigma = tr.querySelector('[data-field="msSigma"]');
    if (!spanM) return;

    if (opz.attivo === false || opz.stato === 'CHIUSA') {
      spanM.textContent = '—';
      spanM.style.color = '';
      if (spanSigma) spanSigma.textContent = '';
      return;
    }

    const spot = parseFloat(el('prezzoSpot').value) || 0;
    const K = parseFloat(opz.strike) || 0;
    if (!(spot > 0) || !(K > 0)) {
      spanM.textContent = '—';
      spanM.style.color = '';
      if (spanSigma) spanSigma.textContent = '';
      return;
    }

    const tipo = (opz.tipo || 'PUT').toLowerCase() === 'call' ? 'call' : 'put';
    let label, classe;
    if (Math.abs(spot - K) / spot < 0.005) {
      label = 'ATM'; classe = 'atm';
    } else if (tipo === 'call') {
      label = spot > K ? 'ITM' : 'OTM';
      classe = spot > K ? 'itm' : 'otm';
    } else {
      label = spot < K ? 'ITM' : 'OTM';
      classe = spot < K ? 'itm' : 'otm';
    }
    spanM.textContent = label;
    spanM.style.color = classe === 'atm' ? 'var(--yellow)'
                       : classe === 'itm' ? 'var(--green)'
                       : 'var(--muted)';

    if (spanSigma) {
      const volFrac = (parseFloat(opz.vol) || 0) / 100;
      const T = opz.scadenza ? yearsBetween(dataAnalisiDate(), opz.scadenza) : 0;
      if (volFrac > 0 && T > 0) {
        const sd = volFrac * Math.sqrt(T);
        const dist = Math.abs(Math.log(K / spot)) / sd;
        spanSigma.textContent = dist.toFixed(2) + 'σ';
      } else {
        spanSigma.textContent = '';
      }
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

  function strumentoOpzSelezionato() {
    const sel = el('strumentoOpzioni');
    if (sel && sel.value) return sel.value;
    const scheda = schedaAttiva();
    return (scheda && scheda.strumentoOpzioni) || 'MES';
  }
