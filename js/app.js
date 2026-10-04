
// v22 â breakeven sempre individuati + greche di posizione scalate + fix mobile.
  // BE: la vecchia scansione (griglia uniforme a 180 punti su spotÂ±45% esteso
  // alla strutturaÂ±30%) perdeva gli attraversamenti quando la struttura occupava
  // una fetta minima del range (es. opzioni AZIONI con strike ~100 e spot ~7700:
  // step di scansione ~60 punti) oppure quando il BE cadeva fuori range (premi
  // pesanti). Ora la ricerca usa un campionamento DENSO con punti esatti sugli
  // strike/ingressi (buildPayoffPointsDense) e un'estensione ADATTIVA del range
  // (findBreakevensRobust): se le code del payoff puntano a uno zero fuori range
  // il range si estende finchÃ© non Ã¨ intercettato. Il range include anche la
  // porzione di grafico visibile: un BE mostrato a video non puÃ² piÃ¹ sfuggire.
  // Gestiti anche tangenze (curva che tocca lo zero senza attraversarlo) e tratti
  // piatti a zero (ratio spread a credito pari: si segnala il bordo del tratto).
  // GRECHE: i totali Î/Î/Vega/Î in header e le colonne per riga sommavano greche
  // PER UNITÃ mescolando strumenti con moltiplicatori diversi (MES Ã5, ES Ã50,
  // AZIONI Ã100): un numero privo di unitÃ , arbitrariamente grande o piccolo.
  // Ora sono greche di POSIZIONE in $ (q.tÃ  Ã greca Ã moltiplicatore): Î $/pt,
  // Î $/ptÂ², Vega $/1% IV, Î $/gg â omogenee e sommabili tra strumenti.
  // MOBILE: font 16px sui campi input/select sotto gli 800px (iOS zooma la
  // pagina intera al focus dei campi < 16px: la causa dei dati "fuori schermo"),
  // nessuno scroll orizzontale a livello pagina, prime 3 colonne della tabella
  // opzioni sticky durante lo scorrimento, .table-scroll irrobustito.
  // Nessun cambiamento di storage: STORAGE_KEY resta mastering_v20.
  // v21 â riga opzioni portata in paritÃ  con la gamba opzioni del Calcolatore
  // Payoff: aggiunte le colonne V. Intr (valore intrinseco), V. Temp (valore
  // temporale = teorico â intrinseco), P. Tocco (probabilitÃ  che il
  // sottostante tocchi lo strike prima della scadenza della gamba, stessa
  // formula del Calcolatore), P&L Scad. (P&L della singola riga alla prima
  // scadenza della scheda, metodo calendar: gambe piÃ¹ lunghe al teorico col
  // tempo residuo) e Deb/Cred (premio Ã q.tÃ  Ã moltiplicatore). Tutte le
  // colonne e i valori esistenti restano invariati; lo storage non cambia.
  // v20 â metodo "calendar" per le scadenze miste: la curva A SCADENZA (e i
  // totali/POP/BE collegati) Ã¨ calcolata alla scadenza della gamba opzioni
  // piÃ¹ corta; le gambe con scadenza piÃ¹ lunga sono valutate al teorico
  // Black-76 col tempo residuo a quella data (picco tipico delle calendar
  // senza cambiare la data di analisi). POP e bande sigma usano lo stesso
  // orizzonte della prima scadenza. Moltiplicatore AZIONI corretto a Ã100
  // (un'opzione eq. muove 100 azioni), in linea con MES Ã5 ed ES Ã50.
  // Vol ATM spostata dalla testata superiore all'header Opzioni (affianco al
  // selettore strumento), con stile dedicato coerente al pannello. Aggiunto
  // il modello Black-Scholes con tasso r e dividendo continuo q per le
  // opzioni su AZIONI (nuovo input "Div %" nell'header): teorico, greche,
  // curve Now e valutazione calendar usano BS per AZIONI e Black-76 per
  // MES/ES. Storage v20 con persistenza anche del dividendo.
  // v19 â schede multi-scenario: la scheda "Matrice" (non rimovibile) e le
  // comparazioni clonabili col pulsante "Crea comparazione"; i valori a video
  // (futures, opzioni, riepilogo, greche) sono della scheda attiva, il grafico
  // disegna e confronta le curve di TUTTE le schede. Etichetta "Escludi cash",
  // sfondo casella cash verde/rosso, spinner numerici rimossi, badge q.tÃ 
  // rimosso (il totale aperti Ã¨ giÃ  nella riga di intestazione), voce
  // "Realizzato" eliminata.
  // v18 â deviazioni standard verdi (prima azzurre come lo spot), box "Dev. std"
  // con logica invertita come il resto del file (spunta = nasconde), header
  // Opzioni selezionabile da menu a tendina (MES / ES / AZIONI) con
  // moltiplicatore dedicato (5 / 50 / 100), scheda opzioni non eliminabile
  // (dormiente se vuota), ROI e voci legate al margine rimosse.
  // v17 â strumenti ES (Ã50) e X (Ã100), logica box invertita (spunta = esclusa),
  // colonna M/S (ATM/OTM/ITM + distanza in Ï), bande Â±1Ï/Â±2Ï sul grafico,
  // totali AT NOW / A SCADENZA, POP a 4 decimali, colonna RLZD rimossa
  // (il realizzato va nel box Cash), cash compreso nei totali e nel grafico
  // con box di esclusione per simulazione, toggle BE e linee dev. standard
  // verticali (menu 1Â°â10Â° SD vicino al POP).
  // v16 â fix: persistenza riskFree/volAtm, chiusura opzioni da UI, P&L opzioni MTM,
  // scansione BE/POP adattiva al di fuori di spotÂ±45%, perf (niente calcoli morti,
  // redraw throttled), touch pan/pinch, intrinseco a scadenza, autosave, robustezza margini.

  const MOLTIPLICATORI = { NES: 0.5, MES: 5, ES: 50, X: 100 };
  const FEE_LATO = 1.205; // per ora usiamo lo stesso valore anche per MES
  const FEE_ROUND_TRIP = FEE_LATO * 2;
  const MOLTIPLICATORI_OPZ = { MES: 5, ES: 50, AZIONI: 100 };
  function moltOpz(opz) { return MOLTIPLICATORI_OPZ[(opz && opz.strumento) || 'MES']; }
  const STORAGE_KEY = 'mastering_v20';
  const STORAGE_KEYS_LEGACY = ['mastering_v19', 'mastering_v18', 'mastering_v17', 'mastering_v16', 'mastering_v15', 'mastering_v14', 'mastering_v13', 'mastering_v12', 'mastering_v11'];

  // Colori delle curve sul grafico: Matrice = bianco, comparazioni = palette
  const PALETTE_COMP = ['#f97316', '#22d3ee', '#e879f9', '#a78bfa', '#fb7185', '#facc15'];
  function coloreScheda(i) { return i === 0 ? '#ffffff' : PALETTE_COMP[(i - 1) % PALETTE_COMP.length]; }

  // Una scheda = uno scenario completo (futures NES/MES + opzioni).
  // La scheda 0 Ã¨ la "Matrice": non puÃ² essere rimossa.
  function nuovaScheda(nome) {
    return {
      nome: nome || 'Matrice',
      tipoNES: 'NES', tipoMES: 'MES',
      NES: [], MES: [], opzioni: [],
      strumentoOpzioni: 'MES'
    };
  }

  const stato = {
    schede: [nuovaScheda('Matrice')],
    attiva: 0,
    prezzoSpot: 7700,
    cash: 0,
    cashEscluso: false
  };

  function schedaAttiva() { return stato.schede[stato.attiva] || stato.schede[0]; }

  const el = id => document.getElementById(id);

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

  // POP: probabilitÃ  che a scadenza il P&L combinato sia > 0.
  // Nota: tra due BE consecutivi il payoff a scadenza non puÃ² cambiare segno
  // (zero-crossing contigui), quindi il test a punto medio Ã¨ corretto.
  // Se NON vengono trovati BE (struttura sempre in profitto/perdita nel range
  // scansionato, o BE fuori range), il dominio viene segmentato in tratti.
  function calcolaPOP(scheda, spot, breakevens, resNES, resMES, scanMin, scanMax) {
    const volPct = parseFloat(el('volAtm') && el('volAtm').value) || 0;
    const vol = volPct / 100;
    // POP alla scadenza piÃ¹ corta (coerente con la curva A SCADENZA calendar)
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
    for (let i = 0; i < bounds.length - 1; i++) {
      const lo = bounds[i];
      const hi = bounds[i + 1];
      const mid = hi === Infinity
        ? (bes.length ? Math.max(...bes) : spot) + Math.max(spot * 0.05, 50)
        : (lo + hi) / 2;
      const midS = mid <= 0 ? 0.01 : mid;
      const pnl = pnlCombinatoAt(scheda, midS, 'expiry', resNES, resMES);
      if (pnl > 0) {
        const cdfHi = hi === Infinity ? 1 : lognormalCDF(hi, spot, vol, T);
        const cdfLo = lognormalCDF(lo <= 0 ? 0.0001 : lo, spot, vol, T);
        prob += Math.max(0, cdfHi - cdfLo);
      }
    }
    return Math.min(1, Math.max(0, prob));
  }

  function updatePOPLabel(pop) {
    const e = el('popValue');
    if (!e) return;
    if (pop === null || !isFinite(pop)) {
      e.textContent = 'â';
      e.style.color = 'var(--muted)';
      return;
    }
    e.textContent = (pop * 100).toLocaleString('it-IT', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + '%';
    e.style.color = pop >= 0.5 ? 'var(--green)' : 'var(--red)';
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

  // ============================================================
  // CALCOLO COLONNA
  // ============================================================
  function calcolaColonna(scheda, col) {
    const movimenti = scheda[col];
    const tipo = scheda['tipo' + col];

    if (tipo === '-' || movimenti.length === 0) {
      return { righe: [], mediaPulita: NaN, pnlAperto: 0, pnlRealizzato: 0,
        pnlTotale: 0, qtaNetta: 0, qtaAssolutaCorrente: 0, tipo };
    }

    const molt = MOLTIPLICATORI[tipo];
    const spot = parseFloat(el('prezzoSpot').value) || 0;

    let qtaNetta = 0, sommaPulitaPesata = 0, qtaAssolutaCorrente = 0, pnlRealizzatoTot = 0;

    const righe = movimenti.map(m => ({
      tipo: 'vuota', qOriginale: m.quantita || 0, prezzo: m.prezzoPulito || 0,
      direzione: m.direzione, qAperta: 0, qChiusa: 0, mediaIngresso: 0,
      pnlRealizzato: 0, pnlAperto: 0, pnlTotale: 0
    }));

    const fifo = [];

    movimenti.forEach((m, idx) => {
      // Riga disattivata: esclusa da FIFO, P&L, media e payoff
      if (m.attivo === false) {
        righe[idx].tipo = 'off';
        return;
      }
      const q = m.quantita || 0;
      const prezzo = m.prezzoPulito || 0;
      const segno = m.direzione === 'LONG' ? 1 : -1;
      const qtaConSegno = segno * q;
      if (q === 0) return;

      const segnoPos = Math.sign(qtaNetta);

      if (segnoPos === 0 || segnoPos === segno) {
        // APERTURA
        righe[idx].tipo = 'apertura';
        righe[idx].qAperta = q;
        fifo.push({ rowIdx: idx, qta: q, prezzo, segno });

        qtaNetta += qtaConSegno;
        sommaPulitaPesata += prezzo * q;
        qtaAssolutaCorrente += q;
      } else {
        // CHIUSURA
        righe[idx].tipo = 'chiusura';
        const mediaIngresso = qtaAssolutaCorrente > 0
          ? sommaPulitaPesata / qtaAssolutaCorrente : 0;
        const qtaChiusa = Math.min(Math.abs(qtaConSegno), Math.abs(qtaNetta));
        const qtaApre = q - qtaChiusa;

        const pnlRea = (prezzo - mediaIngresso) * qtaChiusa * segnoPos * molt
                     - FEE_ROUND_TRIP * qtaChiusa;
        righe[idx].pnlRealizzato = pnlRea;
        righe[idx].qChiusa = qtaChiusa;
        righe[idx].mediaIngresso = mediaIngresso;

        pnlRealizzatoTot += pnlRea;

        let daChiudere = qtaChiusa;
        while (daChiudere > 0 && fifo.length > 0) {
          const f = fifo[0];
          const qc = Math.min(daChiudere, f.qta);
          f.qta -= qc;
          righe[f.rowIdx].qAperta -= qc;
          righe[f.rowIdx].qChiusa += qc;
          daChiudere -= qc;
          if (f.qta === 0) fifo.shift();
        }

        if (qtaApre > 0) {
          righe[idx].qAperta = qtaApre;
          righe[idx].tipo = 'mista';
          fifo.push({ rowIdx: idx, qta: qtaApre, prezzo, segno });
        }

        const vecchioSegno = segnoPos;
        qtaNetta += qtaConSegno;
        if (qtaNetta === 0) { sommaPulitaPesata = 0; qtaAssolutaCorrente = 0; }
        else if (Math.sign(qtaNetta) !== vecchioSegno) {
          sommaPulitaPesata = prezzo * Math.abs(qtaNetta);
          qtaAssolutaCorrente = Math.abs(qtaNetta);
        } else {
          const frazione = Math.abs(qtaNetta) / qtaAssolutaCorrente;
          sommaPulitaPesata *= frazione;
          qtaAssolutaCorrente = Math.abs(qtaNetta);
        }
      }
    });

    let pnlApertoTot = 0;
    righe.forEach(r => {
      if (r.qAperta > 0) {
        const segno = r.direzione === 'LONG' ? 1 : -1;
        const pnlLive = (spot - r.prezzo) * r.qAperta * segno * molt
                      - FEE_ROUND_TRIP * r.qAperta;
        r.pnlAperto = pnlLive;
        pnlApertoTot += pnlLive;
      }
      r.pnlTotale = r.pnlAperto + r.pnlRealizzato;
    });

    const mediaPulita = qtaAssolutaCorrente > 0
      ? sommaPulitaPesata / qtaAssolutaCorrente : NaN;

    const pnlTotale = pnlApertoTot + pnlRealizzatoTot;

    return {
      righe, mediaPulita, pnlAperto: pnlApertoTot, pnlRealizzato: pnlRealizzatoTot,
      pnlTotale, qtaNetta, qtaAssolutaCorrente, tipo
    };
  }

  // ============================================================
  // OPZIONI
  // ============================================================
  function valoreNominaleOpzione(opz) {
    return (opz.premio || 0) * moltOpz(opz) * (opz.qta || 0);
  }
  // P&L di una singola opzione:
  // - disattivata â 0
  // - CHIUSA â 0 (il realizzato va annotato nel box Cash in alto)
  // - APERTA â mark-to-market: (teorico â premio) Ã side Ã qta Ã 5
  //   Coerente con la curva "Now" del grafico e con il balance IBKR.
  function calcolaPnlOpzione(opz) {
    if (opz.attivo === false) return 0;
    if (opz.stato === 'CHIUSA') return 0;
    const spot = parseFloat(el('prezzoSpot').value) || 0;
    return pnlOpzioneAt(spot, opz, 'now');
  }
  // Totale P&L opzioni: con filtro = solo dello strumento indicato,
  // senza filtro = tutti gli strumenti (riepilogo, TWS, payoff)
  function calcolaPnlOpzioniTotale(filtro) {
    return schedaAttiva().opzioni.reduce((sum, o) => {
      if (filtro && (o.strumento || 'MES') !== filtro) return sum;
      return sum + calcolaPnlOpzione(o);
    }, 0);
  }

  // ============================================================
  // RENDER
  // ============================================================
  function renderRigaTotale(col, res) {
    const rt = el('rt' + col);
    const qtaEl = rt.querySelector('.rt-qta');
    const prezzoEl = rt.querySelector('.rt-prezzo strong');

    if (res.qtaNetta === 0) {
      qtaEl.innerHTML = '<span class="dir-flat">â</span>';
      prezzoEl.textContent = 'â';
    } else {
      const dir = res.qtaNetta > 0 ? 'LONG' : 'SHORT';
      const dirClsName = res.qtaNetta > 0 ? 'dir-long' : 'dir-short';
      qtaEl.innerHTML = `${Math.abs(res.qtaNetta)} <span class="${dirClsName}">${dir}</span>`;
      prezzoEl.textContent = isNaN(res.mediaPulita) ? 'â' : formatPrezzo(res.mediaPulita);
    }

    const setVal = (id, val) => {
      const e = el(id);
      e.textContent = formatEuro(val);
      e.classList.remove('green', 'red', 'muted');
      if (!isFinite(val) || val === 0) e.classList.add('muted');
      else e.classList.add(val >= 0 ? 'green' : 'red');
    };
    setVal('rtAperto' + col, res.pnlAperto);
    setVal('rtTot' + col, res.pnlTotale);
  }

  function aggiornaCalcolati(col) {
    const res = calcolaColonna(schedaAttiva(), col);
    renderRigaTotale(col, res);

    const tbody = el('body' + col);
    const trs = tbody.querySelectorAll('tr');
    trs.forEach((tr, idx) => {
      const info = res.righe[idx];
      if (!info) return;
      const tdPnl = tr.querySelector('.pnl-riga');
      if (tdPnl) {
        const pnlVal = info.pnlTotale || 0;
        tdPnl.textContent = formatEuro(pnlVal);
        tdPnl.classList.remove('green', 'red', 'muted');
        if (pnlVal === 0 && info.tipo === 'vuota') tdPnl.classList.add('muted');
        else tdPnl.classList.add(pnlVal >= 0 ? 'green' : 'red');
      }
    });
  }

  function renderMovimenti(col) {
    const scheda = schedaAttiva();
    const res = calcolaColonna(scheda, col);
    renderRigaTotale(col, res);

    const tbody = el('body' + col);
    tbody.innerHTML = '';

    scheda[col].forEach((mov, idx) => {
      const info = res.righe[idx] || { tipo: 'vuota', qAperta: 0, qChiusa: 0, pnlTotale: 0 };
      const tr = document.createElement('tr');
      if (info.tipo === 'chiusura') tr.classList.add('row-chiusura');
      const isOn = mov.attivo !== false;
      if (!isOn) tr.classList.add('row-off');

      // Attivo (toggle)
      const tdAtt = document.createElement('td');
      tdAtt.dataset.label = 'ï';
      const inAtt = document.createElement('input');
      inAtt.type = 'checkbox';
      inAtt.className = 'toggle-on';
      inAtt.checked = !isOn;
      inAtt.title = 'Spunta per escludere dai conteggi (riga oscurata)';
      inAtt.addEventListener('change', e => {
        scheda[col][idx].attivo = !e.target.checked;
        renderMovimenti(col);
        calcolaTutto();
      });
      tdAtt.appendChild(inAtt); tr.appendChild(tdAtt);

      // Dir
      const tdDir = document.createElement('td');
      tdDir.dataset.label = 'Dir';
      const selDir = document.createElement('select');
      selDir.innerHTML = '<option value="LONG">LONG</option><option value="SHORT">SHORT</option>';
      selDir.value = mov.direzione;
      selDir.addEventListener('change', e => {
        scheda[col][idx].direzione = e.target.value;
        aggiornaCalcolati(col); calcolaTutto();
      });
      tdDir.appendChild(selDir); tr.appendChild(tdDir);

      // Q.tÃ  (il totale delle posizioni aperte Ã¨ nella riga di intestazione)
      const tdQta = document.createElement('td');
      tdQta.dataset.label = 'Q.tÃ ';
      const inQta = document.createElement('input');
      inQta.type = 'number'; inQta.step = '1'; inQta.min = '0';
      inQta.value = mov.quantita;
      inQta.addEventListener('input', e => {
        const v = e.target.value;
        scheda[col][idx].quantita = v === '' ? 0 : (parseFloat(v) || 0);
        aggiornaCalcolati(col); calcolaTutto();
      });
      tdQta.appendChild(inQta); tr.appendChild(tdQta);

      // Prezzo nominale
      const tdPrezzo = document.createElement('td');
      tdPrezzo.dataset.label = 'Prezzo nominale';
      const inPrezzo = document.createElement('input');
      inPrezzo.type = 'number'; inPrezzo.step = '0.25';
      inPrezzo.className = 'prezzo-nominale';
      inPrezzo.value = (mov.prezzoPulito === 0 || mov.prezzoPulito === undefined) ? '' : mov.prezzoPulito;
      inPrezzo.placeholder = 'â';
      inPrezzo.addEventListener('input', e => {
        const v = e.target.value;
        scheda[col][idx].prezzoPulito = v === '' ? 0 : (parseFloat(v) || 0);
        aggiornaCalcolati(col); calcolaTutto();
      });
      tdPrezzo.appendChild(inPrezzo); tr.appendChild(tdPrezzo);

      // DEL
      const tdDel = document.createElement('td');
      tdDel.className = 'td-del';
      const btnDel = document.createElement('button');
      btnDel.className = 'btn-del'; btnDel.textContent = 'DEL';
      btnDel.title = 'Elimina riga';
      btnDel.addEventListener('click', () => {
        if (!confirm('Eliminare questa riga di movimento?')) return;
        scheda[col].splice(idx, 1);
        renderMovimenti(col); calcolaTutto();
      });
      tdDel.appendChild(btnDel); tr.appendChild(tdDel);

      // P&L
      const tdPnl = document.createElement('td');
      tdPnl.className = 'pnl-riga td-pnl';
      tdPnl.dataset.label = 'P&L';
      if (!isOn) {
        tdPnl.textContent = 'â';
        tdPnl.classList.add('muted');
      } else {
        const pnlVal = info.pnlTotale || 0;
        tdPnl.textContent = formatEuro(pnlVal);
        if (pnlVal === 0 && info.tipo === 'vuota') tdPnl.classList.add('muted');
        else tdPnl.classList.add(pnlVal >= 0 ? 'green' : 'red');
      }
      tr.appendChild(tdPnl);

      tbody.appendChild(tr);
    });
  }

  // ============================================================
  // OPZIONI RENDER
  // ============================================================
  function formatGreek(v, digits = 3) {
    if (!isFinite(v)) return 'â';
    return v.toLocaleString('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  // Formato adattivo per le greche di POSIZIONE (scalate col moltiplicatore
  // dello strumento): i valori spaziano da frazioni (1 lotto MES Ã5) a
  // centinaia (lotti AZIONI Ã100); decimali min/max evitano sia la perdita
  // di precisione sia gli zeri in coda inutili.
  function formatGreekAuto(v, minDig, maxDig) {
    if (!isFinite(v)) return 'â';
    return v.toLocaleString('it-IT', { minimumFractionDigits: minDig, maximumFractionDigits: maxDig });
  }

  // Aggiorna la cella GG residui di una riga opzione
  function aggiornaGiorniResidui(tr, opz) {
    const ggCell = tr.querySelector('[data-field="gg"]');
    if (!ggCell) return;
    const gg = giorniResiduiOpzione(opz);
    if (gg === null) {
      ggCell.textContent = 'â';
      ggCell.style.color = '';
      return;
    }
    ggCell.textContent = String(gg);
    ggCell.style.color = gg < 0 ? 'var(--red)' : (gg <= 7 ? 'var(--yellow)' : 'var(--muted)');
  }

  // Aggiorna le celle aggiuntive della riga opzione (V. Intr, V. Temp,
  // P. Tocco, P&L Scad., Deb/Cred) â le stesse colonne della gamba opzioni
  // del Calcolatore Payoff, calcolate col metodo giÃ  usato dal file:
  // intrinseco/teorico dal modello dello strumento (BS per AZIONI, Black-76
  // per MES/ES), P&L Scad. alla prima scadenza della scheda (metodo calendar).
  function aggiornaExtraOpzione(tr, opz) {
    const setG = (f, val, dig) => {
      const cell = tr.querySelector(`[data-field="${f}"]`);
      if (cell) cell.textContent = formatGreek(val, dig);
    };
    const setPct = (f, p) => {
      const cell = tr.querySelector(`[data-field="${f}"]`);
      if (!cell) return;
      if (p === null || !isFinite(p)) { cell.textContent = 'â'; return; }
      cell.textContent = (p * 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
    };

    if (opz.attivo === false || opz.stato === 'CHIUSA') {
      setG('intrinseco', NaN, 2);
      setG('temporale', NaN, 2);
      setPct('tocco', null);
      const sc = tr.querySelector('[data-field="pnlScad"]');
      if (sc) { sc.textContent = 'â'; sc.classList.remove('green', 'red', 'muted'); sc.classList.add('muted'); }
      const dc = tr.querySelector('[data-field="debitcredit"]');
      if (dc) dc.textContent = 'â';
      return;
    }

    // Valori dal modello (price/intrinsic giÃ  calcolati dalle greche)
    const g = calcolaGrecheOpzione(opz);
    setG('intrinseco', g.intrinsic, 2);
    setG('temporale', (isFinite(g.price) && isFinite(g.intrinsic)) ? g.price - g.intrinsic : NaN, 2);

    // ProbabilitÃ  di tocco dello strike (come nel Calcolatore Payoff)
    const spot = parseFloat(el('prezzoSpot').value) || 0;
    const volFrac = (parseFloat(opz.vol) || 0) / 100;
    const T = (g && isFinite(g.T)) ? Math.max(0, g.T) : 0;
    setPct('tocco', touchProbability(spot, opz.strike, volFrac, T));

    // P&L a scadenza della riga (metodo calendar della scheda attiva)
    const sc = tr.querySelector('[data-field="pnlScad"]');
    if (sc) {
      const pnlScad = pnlOpzioneAt(spot, opz, 'expiry', firstExpiryOpzioni(schedaAttiva()));
      sc.textContent = formatEuro(pnlScad);
      sc.classList.remove('green', 'red', 'muted');
      sc.classList.add(pnlScad >= 0 ? 'green' : 'red');
    }

    // Debit/Credit: premio Ã q.tÃ  Ã moltiplicatore (senza segno di posizione)
    const dc = tr.querySelector('[data-field="debitcredit"]');
    if (dc) dc.textContent = formatEuro((opz.premio || 0) * (opz.qta || 0) * moltOpz(opz));
  }

  function aggiornaRigaOpzione(idx) {
    const tbody = el('bodyOpzioni');
    const tr = tbody.querySelector(`tr[data-idx="${idx}"]`);
    if (!tr) return;
    const opz = schedaAttiva().opzioni[idx];
    if (!opz) return;

    const tdPnl = tr.querySelector('.pnl-riga[data-label="P&L"]');
    if (tdPnl) {
      const pnl = calcolaPnlOpzione(opz);
      tdPnl.textContent = formatEuro(pnl);
      tdPnl.classList.remove('green', 'red', 'muted');
      tdPnl.classList.add(pnl >= 0 ? 'green' : 'red');
    }

    // Giorni residui (dipende da scadenza e data analisi)
    aggiornaGiorniResidui(tr, opz);
    aggiornaMoneyness(tr, opz);

    const setG = (sel, val, dig) => {
      const cell = tr.querySelector(sel);
      if (cell) cell.textContent = formatGreek(val, dig);
    };

    // Greche e teorico solo se attiva e aperta (altrimenti 'â')
    if (opz.attivo === false || opz.stato === 'CHIUSA') {
      ['teorico','delta','gamma','vega','theta'].forEach(f => setG(`[data-field="${f}"]`, NaN, 2));
      aggiornaExtraOpzione(tr, opz);
      return;
    }

    const g = calcolaGrecheOpzione(opz);
    const segno = opz.pos === 'SELL' ? -1 : 1;
    const qta = opz.qta || 0;

    setG('[data-field="teorico"]', g.price, 2);
    // Greche di posizione scalate col moltiplicatore ($/pt, $/ptÂ², $/1% IV, $/gg)
    const molt = moltOpz(opz);
    const setPos = (f, v, minD, maxD) => {
      const cell = tr.querySelector(`[data-field="${f}"]`);
      if (cell) cell.textContent = formatGreekAuto(v, minD, maxD);
    };
    setPos('delta', segno * qta * g.delta * molt, 2, 3);
    setPos('gamma', segno * qta * g.gamma * molt, 2, 4);
    setPos('vega', segno * qta * g.vega * molt, 2, 3);
    setPos('theta', segno * qta * g.theta * molt, 2, 3);
    aggiornaExtraOpzione(tr, opz);
  }

  // Strumento selezionato nel menu a tendina dell'header (MES / ES / AZIONI)
  function strumentoOpzSelezionato() {
    const sel = el('strumentoOpzioni');
    return sel ? sel.value : 'MES';
  }

  function renderOpzioni() {
    const tbody = el('bodyOpzioni');
    tbody.innerHTML = '';
    const strumentoSel = strumentoOpzSelezionato();
    const opzioniScheda = schedaAttiva().opzioni;
    opzioniScheda.forEach((opz, idx) => {
      // Mostra solo le opzioni dello strumento selezionato:
      // le altre restano salvate e dormienti, pronte quando le richiami
      if ((opz.strumento || 'MES') !== strumentoSel) return;
      const tr = document.createElement('tr');
      tr.dataset.idx = idx;
      if (opz.attivo === false) tr.classList.add('row-off');
      if (opz.stato === 'CHIUSA') tr.classList.add('row-chiusa');

      // A
      const tdA = document.createElement('td');
      tdA.dataset.label = 'ï';
      const inA = document.createElement('input');
      inA.type = 'checkbox';
      inA.className = 'toggle-on';
      inA.checked = opz.attivo === false;
      inA.title = 'Spunta per escludere dai conteggi (riga oscurata)';
      inA.addEventListener('change', e => {
        opzioniScheda[idx].attivo = !e.target.checked;
        renderOpzioni();
        calcolaTutto();
      });
      tdA.appendChild(inA); tr.appendChild(tdA);

      // Stato (APERTA / CHIUSA) â click per commutare
      const tdStato = document.createElement('td');
      tdStato.dataset.label = 'Stato';
      const btnStato = document.createElement('button');
      const isChiusa = opz.stato === 'CHIUSA';
      btnStato.className = 'btn-stato' + (isChiusa ? ' chiusa' : '');
      btnStato.textContent = isChiusa ? 'CHIUSA' : 'APERTA';
      btnStato.title = 'Clicca per aprire/chiudere la posizione: se CHIUSA il P&L = 0, il realizzato va annotato nel box Cash in alto';
      btnStato.addEventListener('click', () => {
        opzioniScheda[idx].stato = opzioniScheda[idx].stato === 'CHIUSA' ? 'APERTA' : 'CHIUSA';
        renderOpzioni();
        calcolaTutto();
      });
      tdStato.appendChild(btnStato); tr.appendChild(tdStato);

      // DEL
      const tdDel = document.createElement('td');
      tdDel.className = 'td-del';
      tdDel.dataset.label = 'DEL';
      const btnDel = document.createElement('button');
      btnDel.className = 'btn-del'; btnDel.textContent = 'DEL';
      btnDel.title = 'Elimina riga';
      btnDel.addEventListener('click', () => {
        if (!confirm('Eliminare questa riga di opzione?')) return;
        opzioniScheda.splice(idx, 1); renderOpzioni(); calcolaTutto();
      });
      tdDel.appendChild(btnDel); tr.appendChild(tdDel);

      // Pos
      const tdPos = document.createElement('td');
      tdPos.dataset.label = 'Pos';
      const selPos = document.createElement('select');
      selPos.innerHTML = '<option value="SELL">SELL</option><option value="BUY">BUY</option>';
      selPos.value = opz.pos || 'SELL';
      selPos.addEventListener('change', e => { opzioniScheda[idx].pos = e.target.value; aggiornaRigaOpzione(idx); calcolaTutto(); });
      tdPos.appendChild(selPos); tr.appendChild(tdPos);

      // Tipo
      const tdTipo = document.createElement('td');
      tdTipo.dataset.label = 'Tipo';
      const selTipo = document.createElement('select');
      selTipo.innerHTML = '<option value="PUT">PUT</option><option value="CALL">CALL</option>';
      selTipo.value = opz.tipo || 'PUT';
      selTipo.addEventListener('change', e => { opzioniScheda[idx].tipo = e.target.value; aggiornaRigaOpzione(idx); calcolaTutto(); });
      tdTipo.appendChild(selTipo); tr.appendChild(tdTipo);

      // Q.tÃ 
      const tdQta = document.createElement('td');
      tdQta.dataset.label = 'Q.tÃ ';
      const inQta = document.createElement('input');
      inQta.type = 'number'; inQta.step = '1'; inQta.min = '0'; inQta.value = opz.qta || 1;
      inQta.addEventListener('input', e => {
        const v = e.target.value;
        opzioniScheda[idx].qta = v === '' ? 0 : (parseFloat(v) || 0);
        aggiornaRigaOpzione(idx); calcolaTutto();
      });
      tdQta.appendChild(inQta); tr.appendChild(tdQta);

      // K
      const tdK = document.createElement('td');
      tdK.dataset.label = 'Strike';
      const inK = document.createElement('input');
      inK.type = 'number'; inK.step = '1'; inK.value = opz.strike || '';
      inK.addEventListener('input', e => {
        const v = e.target.value;
        opzioniScheda[idx].strike = v === '' ? 0 : (parseFloat(v) || 0);
        aggiornaRigaOpzione(idx); calcolaTutto();
      });
      tdK.appendChild(inK); tr.appendChild(tdK);

      // Premio
      const tdPremio = document.createElement('td');
      tdPremio.dataset.label = 'Premio';
      const inPremio = document.createElement('input');
      inPremio.type = 'number'; inPremio.step = '0.05'; inPremio.value = opz.premio || '';
      inPremio.addEventListener('input', e => {
        const v = e.target.value;
        opzioniScheda[idx].premio = v === '' ? 0 : (parseFloat(v) || 0);
        aggiornaRigaOpzione(idx); calcolaTutto();
      });
      tdPremio.appendChild(inPremio); tr.appendChild(tdPremio);

      // Vol%
      const tdVol = document.createElement('td');
      tdVol.dataset.label = 'Vol%';
      const inVol = document.createElement('input');
      inVol.type = 'number'; inVol.step = '0.1'; inVol.value = opz.vol || '';
      inVol.placeholder = 'â';
      inVol.addEventListener('input', e => {
        const v = e.target.value;
        opzioniScheda[idx].vol = v === '' ? 0 : (parseFloat(v) || 0);
        aggiornaRigaOpzione(idx); calcolaTutto();
      });
      tdVol.appendChild(inVol); tr.appendChild(tdVol);

      // Scadenza
      const tdScad = document.createElement('td');
      tdScad.dataset.label = 'Scadenza';
      const inScad = document.createElement('input');
      inScad.type = 'date';
      inScad.value = opz.scadenza || '';
      inScad.addEventListener('change', e => {
        opzioniScheda[idx].scadenza = e.target.value;
        aggiornaRigaOpzione(idx); calcolaTutto();
      });
      tdScad.appendChild(inScad); tr.appendChild(tdScad);

      // GG residui (data analisi â scadenza)
      const tdGG = document.createElement('td');
      tdGG.dataset.label = 'GG';
      const spanGG = document.createElement('span');
      spanGG.dataset.field = 'gg';
      spanGG.textContent = 'â';
      spanGG.style.fontVariantNumeric = 'tabular-nums';
      tdGG.appendChild(spanGG); tr.appendChild(tdGG);
      aggiornaGiorniResidui(tr, opz);

      // Moneyness: ATM/OTM/ITM + distanza in Ï (Vol ATM)
      const tdMS = document.createElement('td');
      tdMS.dataset.label = 'M/S';
      const wrapMS = document.createElement('div');
      wrapMS.className = 'ms-wrap';
      const spanM = document.createElement('span');
      spanM.dataset.field = 'ms';
      spanM.textContent = 'â';
      const spanMSigma = document.createElement('span');
      spanMSigma.dataset.field = 'msSigma';
      spanMSigma.className = 'ms-sub';
      wrapMS.appendChild(spanM); wrapMS.appendChild(spanMSigma);
      tdMS.appendChild(wrapMS); tr.appendChild(tdMS);
      aggiornaMoneyness(tr, opz);

      // Teorico (readonly)
      const tdTeorico = document.createElement('td');
      tdTeorico.dataset.label = 'Teorico';
      const spanTeorico = document.createElement('span');
      spanTeorico.dataset.field = 'teorico';
      spanTeorico.textContent = 'â';
      spanTeorico.style.fontVariantNumeric = 'tabular-nums';
      tdTeorico.appendChild(spanTeorico); tr.appendChild(tdTeorico);

      // Delta
      const tdDelta = document.createElement('td');
      tdDelta.dataset.label = 'Î';
      const spanDelta = document.createElement('span');
      spanDelta.dataset.field = 'delta';
      spanDelta.textContent = 'â';
      spanDelta.style.fontVariantNumeric = 'tabular-nums';
      tdDelta.appendChild(spanDelta); tr.appendChild(tdDelta);

      // Gamma
      const tdGamma = document.createElement('td');
      tdGamma.dataset.label = 'Î';
      const spanGamma = document.createElement('span');
      spanGamma.dataset.field = 'gamma';
      spanGamma.textContent = 'â';
      spanGamma.style.fontVariantNumeric = 'tabular-nums';
      tdGamma.appendChild(spanGamma); tr.appendChild(tdGamma);

      // Vega
      const tdVega = document.createElement('td');
      tdVega.dataset.label = 'Vega';
      const spanVega = document.createElement('span');
      spanVega.dataset.field = 'vega';
      spanVega.textContent = 'â';
      spanVega.style.fontVariantNumeric = 'tabular-nums';
      tdVega.appendChild(spanVega); tr.appendChild(tdVega);

      // Theta
      const tdTheta = document.createElement('td');
      tdTheta.dataset.label = 'Î';
      const spanTheta = document.createElement('span');
      spanTheta.dataset.field = 'theta';
      spanTheta.textContent = 'â';
      spanTheta.style.fontVariantNumeric = 'tabular-nums';
      tdTheta.appendChild(spanTheta); tr.appendChild(tdTheta);

      // Valore intrinseco (come la gamba opzioni del Calcolatore Payoff)
      const tdVintr = document.createElement('td');
      tdVintr.dataset.label = 'V. Intr';
      const spanVintr = document.createElement('span');
      spanVintr.dataset.field = 'intrinseco';
      spanVintr.textContent = 'â';
      spanVintr.style.fontVariantNumeric = 'tabular-nums';
      tdVintr.appendChild(spanVintr); tr.appendChild(tdVintr);

      // Valore temporale (teorico â intrinseco)
      const tdVtemp = document.createElement('td');
      tdVtemp.dataset.label = 'V. Temp';
      const spanVtemp = document.createElement('span');
      spanVtemp.dataset.field = 'temporale';
      spanVtemp.textContent = 'â';
      spanVtemp.style.fontVariantNumeric = 'tabular-nums';
      tdVtemp.appendChild(spanVtemp); tr.appendChild(tdVtemp);

      // ProbabilitÃ  di tocco dello strike
      const tdTocco = document.createElement('td');
      tdTocco.dataset.label = 'P. Tocco';
      const spanTocco = document.createElement('span');
      spanTocco.dataset.field = 'tocco';
      spanTocco.textContent = 'â';
      spanTocco.style.fontVariantNumeric = 'tabular-nums';
      tdTocco.appendChild(spanTocco); tr.appendChild(tdTocco);

      // P&L a scadenza della gamba piÃ¹ corta (metodo calendar)
      const tdPnlScad = document.createElement('td');
      tdPnlScad.className = 'pnl-riga td-pnl';
      tdPnlScad.dataset.label = 'P&L Scad.';
      const spanPnlScad = document.createElement('span');
      spanPnlScad.dataset.field = 'pnlScad';
      tdPnlScad.appendChild(spanPnlScad);
      tr.appendChild(tdPnlScad);

      // P&L (now)
      const tdPnl = document.createElement('td');
      tdPnl.className = 'pnl-riga td-pnl';
      tdPnl.dataset.label = 'P&L';
      tr.appendChild(tdPnl);

      // Debit/Credit (premio Ã q.tÃ  Ã moltiplicatore)
      const tdDebCred = document.createElement('td');
      tdDebCred.dataset.label = 'Deb/Cred';
      const spanDebCred = document.createElement('span');
      spanDebCred.dataset.field = 'debitcredit';
      spanDebCred.style.fontVariantNumeric = 'tabular-nums';
      tdDebCred.appendChild(spanDebCred); tr.appendChild(tdDebCred);

      tbody.appendChild(tr);
    });
    aggiornaPnlOpzioni();
  }

  function aggiornaPnlOpzioni() {
    const tbody = el('bodyOpzioni');
    let totDelta = 0, totGamma = 0, totVega = 0, totTheta = 0;

    tbody.querySelectorAll('tr').forEach((tr) => {
      const idx = Number(tr.dataset.idx);
      const opz = schedaAttiva().opzioni[idx];
      if (!opz) return;

      const tdPnl = tr.querySelector('.pnl-riga[data-label="P&L"]');
      if (tdPnl) {
        if (opz.attivo === false) {
          tdPnl.textContent = 'â';
          tdPnl.classList.remove('green', 'red');
          tdPnl.classList.add('muted');
        } else {
          const pnl = calcolaPnlOpzione(opz);
          tdPnl.textContent = formatEuro(pnl);
          tdPnl.classList.remove('green', 'red', 'muted');
          tdPnl.classList.add(pnl >= 0 ? 'green' : 'red');
        }
      }

      // Giorni residui (dipendono dalla data analisi)
      aggiornaGiorniResidui(tr, opz);
      aggiornaMoneyness(tr, opz);
      aggiornaExtraOpzione(tr, opz);

      const setG = (sel, val, dig) => {
        const cell = tr.querySelector(sel);
        if (cell) cell.textContent = formatGreek(val, dig);
      };

      // Greche solo se attiva e aperta
      if (opz.attivo !== false && opz.stato !== 'CHIUSA') {
        const g = calcolaGrecheOpzione(opz);
        const segno = opz.pos === 'SELL' ? -1 : 1;
        const qta = opz.qta || 0;
        // Greche di posizione SCALATE COL MOLTIPLICATORE dello strumento
        // (MES Ã5, ES Ã50, AZIONI Ã100): sono dollari per punto di movimento
        // del sottostante, omogenee e sommabili tra strumenti diversi.
        // Prima si sommavano greche per unitÃ  mescolando strumenti non
        // confrontabili: il totale non aveva unitÃ  di senso.
        const molt = moltOpz(opz);
        // input incompleti â NaN: esclusi dai totali, 'â' a video
        if (isFinite(g.delta)) totDelta += segno * qta * g.delta * molt;
        if (isFinite(g.gamma)) totGamma += segno * qta * g.gamma * molt;
        if (isFinite(g.vega)) totVega += segno * qta * g.vega * molt;
        if (isFinite(g.theta)) totTheta += segno * qta * g.theta * molt;

        setG('[data-field="teorico"]', g.price, 2);
        const setPos = (f, v, minD, maxD) => {
          const cell = tr.querySelector(`[data-field="${f}"]`);
          if (cell) cell.textContent = formatGreekAuto(v, minD, maxD);
        };
        setPos('delta', segno * qta * g.delta * molt, 2, 3);
        setPos('gamma', segno * qta * g.gamma * molt, 2, 4);
        setPos('vega', segno * qta * g.vega * molt, 2, 3);
        setPos('theta', segno * qta * g.theta * molt, 2, 3);
      } else {
        ['teorico','delta','gamma','vega','theta'].forEach(f => setG(`[data-field="${f}"]`, NaN, 2));
      }
    });

    // Aggiorna totali greche in header (Î $/pt, Î $/ptÂ², Vega $/1% IV, Î $/gg)
    el('greeksDelta').textContent = formatGreekAuto(totDelta, 2, 3);
    el('greeksGamma').textContent = formatGreekAuto(totGamma, 2, 4);
    el('greeksVega').textContent = formatGreekAuto(totVega, 2, 3);
    el('greeksTheta').textContent = formatGreekAuto(totTheta, 2, 3);
  }

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
    // P&L aperto senza fee residuali (le fee sono giÃ  nel realizzato)
    // Per il payoff usiamo solo il mark-to-market lineare
    return (S - res.mediaPulita) * q * segno * molt;
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
    return (valoreOpzione - premio) * side * qta * moltOpz(opz);
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
    const n = 180;
    const step = (maxS - minS) / n;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const S = minS + i * step;
      pts.push({
        S,
        pnlExpiry: pnlCombinatoAt(scheda, S, 'expiry', resNES, resMES),
        pnlNow:    pnlCombinatoAt(scheda, S, 'now',    resNES, resMES)
      });
    }
    return pts;
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
      beInfEl.textContent = 'â';
      beSupEl.textContent = 'â';
      return;
    }

    const sorted = [...bes].filter(Number.isFinite).sort((a, b) => a - b);
    // BE inferiore = il piÃ¹ alto sotto lo spot (o il minimo se tutti sopra)
    // BE superiore = il piÃ¹ basso sopra lo spot (o il massimo se tutti sotto)
    const below = sorted.filter(s => s < spot);
    const above = sorted.filter(s => s > spot);

    const fmtBe = (v) => {
      if (v == null || !isFinite(v)) return 'â';
      const dist = v - spot;
      const sign = dist >= 0 ? '+' : '';
      return `${v.toFixed(1)} (${sign}${dist.toFixed(1)})`;
    };

    beInfEl.textContent = below.length ? fmtBe(below[below.length - 1]) : (sorted.length ? fmtBe(sorted[0]) : 'â');
    beSupEl.textContent = above.length ? fmtBe(above[0]) : (sorted.length ? fmtBe(sorted[sorted.length - 1]) : 'â');

    // se c'Ã¨ un solo BE, mettilo nel lato corretto e lascia l'altro â
    if (sorted.length === 1) {
      if (sorted[0] < spot) {
        beInfEl.textContent = fmtBe(sorted[0]);
        beSupEl.textContent = 'â';
      } else {
        beInfEl.textContent = 'â';
        beSupEl.textContent = fmtBe(sorted[0]);
      }
    }
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
    return parts.join('|') + `|cash:${(typeof stato.cash === 'number') ? stato.cash : 0}:${stato.cashEscluso ? 1 : 0}`;
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

  // ============================================================
  // CALCOLA TUTTO
  // ============================================================
  function calcolaTutto() {
    const scheda = schedaAttiva();
    const resNES = calcolaColonna(scheda, 'NES');
    const resMES = calcolaColonna(scheda, 'MES');

    renderRigaTotale('NES', resNES);
    renderRigaTotale('MES', resMES);

    el('rpmNES').textContent = isNaN(resNES.mediaPulita) ? 'â' : formatPrezzo(resNES.mediaPulita);
    el('rpmMES').textContent = isNaN(resMES.mediaPulita) ? 'â' : formatPrezzo(resMES.mediaPulita);

    // Header scheda: P&L delle opzioni dello strumento selezionato nel menu
    const pnlOpz = calcolaPnlOpzioniTotale(strumentoOpzSelezionato());
    el('pnlOpzioni').textContent = formatEuro(pnlOpz);
    el('pnlOpzioni').className = 'value ' + (pnlOpz >= 0 ? 'green' : 'red');

    // Aggiorna greche e P&L di ogni riga opzione
    aggiornaPnlOpzioni();

    el('rpnlNES').textContent = formatEuro(resNES.pnlTotale);
    el('rpnlNES').className = 'value ' + (resNES.pnlTotale >= 0 ? 'green' : 'red');
    el('rpnlMES').textContent = formatEuro(resMES.pnlTotale);
    el('rpnlMES').className = 'value ' + (resMES.pnlTotale >= 0 ? 'green' : 'red');
    const pnlOpzTutti = calcolaPnlOpzioniTotale();
    el('rpnlOpzioni').textContent = formatEuro(pnlOpzTutti);
    el('rpnlOpzioni').className = 'value ' + (pnlOpzTutti >= 0 ? 'green' : 'red');

    // Cash annotato (incassi esternalizzati: premi a scadenza, righe rimosse/disattivate)
    const cashInserito = (typeof stato.cash === 'number') ? stato.cash : 0;
    const cash = cashAttivo();
    el('rcash').textContent = formatEuro(cashInserito);
    el('rcash').className = 'value ' + (stato.cashEscluso ? 'muted' : (cashInserito > 0 ? 'green' : cashInserito < 0 ? 'red' : 'muted'));

    const totaleTWS = resNES.pnlTotale + resMES.pnlTotale + pnlOpzTutti + cash;
    el('totaleTWS').textContent = formatEuro(totaleTWS);
    el('totaleTWS').className = 'big-value ' + (totaleTWS >= 0 ? 'green' : 'red');

    // Titolo del totale: "TWS" solo per la Matrice, nelle comparazioni nome scheda
    const twsLabel = el('totaleTwsLabel');
    if (twsLabel) twsLabel.textContent = scheda.nome === 'Matrice'
      ? 'TOTALE FUTURES TWS'
      : 'TOTALE FUTURES â ' + scheda.nome;

    // AT NOW = teorico Black-76 allo spot attuale (profitto se chiudessi ora),
    // A SCADENZA = valutato alla prima scadenza opzioni: intrinseco per le
    // gambe che scadono in quella data, teorico col tempo residuo per le
    // gambe piÃ¹ lunghe (strategie calendar). Il cash annotato (se non escluso
    // col box) Ã¨ compreso in entrambi.
    const spotVal = parseFloat(el('prezzoSpot').value) || 0;
    const pnlNowVal = spotVal > 0 ? pnlCombinatoAt(scheda, spotVal, 'now', resNES, resMES) : NaN;
    const pnlScad = spotVal > 0 ? pnlCombinatoAt(scheda, spotVal, 'expiry', resNES, resMES) : NaN;
    const pnlNowEl = el('pnlNowTot');
    pnlNowEl.textContent = formatEuro(pnlNowVal);
    pnlNowEl.className = 'value ' + (!isFinite(pnlNowVal) ? 'muted' : (pnlNowVal >= 0 ? 'green' : 'red'));
    const pnlScadEl = el('pnlScadenzaTot');
    pnlScadEl.textContent = formatEuro(pnlScad);
    pnlScadEl.className = 'value ' + (!isFinite(pnlScad) ? 'muted' : (pnlScad >= 0 ? 'green' : 'red'));

    // Aggiorna anteprima payoff (tutte le schede) e legenda colori
    aggiornaPayoffPreview(scheda, resNES, resMES);
    aggiornaLegendaGrafico();

    // Autosave (debounce): ogni modifica viene comunque persistita
    autosalva();
  }

  // ============================================================
  // SCHEDE: MATRICE + COMPARAZIONI
  // ============================================================
  function renderTabs() {
    const wrap = el('schedeTabs');
    if (!wrap) return;
    wrap.innerHTML = '';
    stato.schede.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'scheda-tab' + (i === stato.attiva ? ' active' : '');
      b.title = i === 0
        ? 'Scheda principale Matrice â non rimovibile'
        : 'Scheda comparazione: modifica la strategia e confrontala sul grafico';
      const nome = document.createElement('span');
      nome.textContent = s.nome;
      b.appendChild(nome);
      if (i > 0) {
        const x = document.createElement('span');
        x.className = 'tab-close';
        x.textContent = 'Ã';
        x.title = 'Rimuovi "' + s.nome + '"';
        x.addEventListener('click', ev => {
          ev.stopPropagation();
          if (!confirm(`Rimuovere la scheda "${s.nome}"?\n\nTutte le sue righe (futures e opzioni) verranno eliminate.`)) return;
          rimuoviScheda(i);
        });
        b.appendChild(x);
      }
      b.addEventListener('click', () => selezionaScheda(i));
      wrap.appendChild(b);
    });
  }

  function selezionaScheda(i) {
    if (i < 0 || i >= stato.schede.length || i === stato.attiva) return;
    stato.attiva = i;
    renderTabs();
    renderScheda();
  }

  // Riporta la pagina sui dati della scheda attiva (valori solo della scheda)
  function renderScheda() {
    const scheda = schedaAttiva();
    // Tema arancione + pulsante "Promuovi" solo sulle schede comparazione
    document.body.classList.toggle('scheda-comp', stato.attiva > 0);
    const btnP = el('btnPromuovi');
    if (btnP) btnP.style.display = stato.attiva > 0 ? '' : 'none';
    el('tipoNES').value = scheda.tipoNES || 'NES';
    el('tipoMES').value = scheda.tipoMES || 'MES';
    if (el('strumentoOpzioni')) el('strumentoOpzioni').value = scheda.strumentoOpzioni || 'MES';
    renderMovimenti('NES');
    renderMovimenti('MES');
    renderOpzioni();
    calcolaTutto();
  }

  // Clona la scheda attuale in una nuova "Comparazione N"
  function creaComparazione() {
    const clone = JSON.parse(JSON.stringify(schedaAttiva()));
    clone.nome = 'Comparazione ' + stato.schede.length;
    stato.schede.push(clone);
    stato.attiva = stato.schede.length - 1;
    renderTabs();
    renderScheda();
    mostraStatus('â ' + clone.nome + ' creata');
  }

  // Le comparazioni si rimuovono, la Matrice mai
  function rimuoviScheda(i) {
    if (i <= 0) return;
    stato.schede.splice(i, 1);
    if (stato.attiva >= i) stato.attiva = Math.max(0, stato.attiva - 1);
    renderTabs();
    renderScheda();
  }

  // Passaggio inverso della comparazione: copia la strategia della
  // comparazione attiva SOPRA la Matrice, che torna la strategia primaria
  // (Ã¨ la soluzione che hai trasmesso in reale sulla piattaforma).
  // La comparazione non viene cancellata: resta per riferimento.
  function promuoviSuMatrice() {
    if (stato.attiva <= 0) return;
    const comp = schedaAttiva();
    if (!confirm(`Promuovere "${comp.nome}" su Matrice?\n\nLa strategia attuale della Matrice verrÃ  SOSTITUITA da quella di "${comp.nome}".\nLa scheda "${comp.nome}" resterÃ  disponibile per riferimento.`)) return;
    const copia = JSON.parse(JSON.stringify(comp));
    copia.nome = 'Matrice';
    stato.schede[0] = copia;
    stato.attiva = 0;
    renderTabs();
    renderScheda();
    mostraStatus('â ' + comp.nome + ' promossa su Matrice');
  }

  // Legenda del grafico: nome e colore di ogni scheda
  function aggiornaLegendaGrafico() {
    const wrap = el('legendSchede');
    if (!wrap) return;
    wrap.innerHTML = stato.schede.map((s, i) =>
      `<span><i style="background:${coloreScheda(i)};"></i> ${s.nome}</span>`).join('');
  }

  // ============================================================
  // UTILITY
  // ============================================================
  let autosaveTimer = null;
  function autosalva() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => salva(true), 800);
  }
  // Flush immediato alla chiusura della pagina
  window.addEventListener('beforeunload', () => {
    if (autosaveTimer !== null) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
      salva(true);
    }
  });

  function salva(silent) {
    const dati = {
      prezzoSpot: parseFloat(el('prezzoSpot').value) || 0,
      riskFree: parseFloat(el('riskFree').value) || 0,
      volAtm: parseFloat(el('volAtm').value) || 0,
      divYield: parseFloat(el('divYield') && el('divYield').value) || 0,
      cash: parseFloat(el('cash').value) || 0,
      cashEscluso: !!stato.cashEscluso,
      dataAnalisi: el('dataAnalisi') ? (el('dataAnalisi').value || '') : '',
      tipoNES: el('tipoNES').value,
      tipoMES: el('tipoMES').value,
      attiva: stato.attiva,
      schede: stato.schede
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dati));
      if (!silent) mostraStatus('â Salvato');
    } catch (e) { mostraStatus('Errore salvataggio', true); }
  }

  function carica() {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      for (const k of STORAGE_KEYS_LEGACY) {
        if (raw) break;
        raw = localStorage.getItem(k);
      }
      if (!raw) return false;
      const dati = JSON.parse(raw);
      if (typeof dati.prezzoSpot === 'number') el('prezzoSpot').value = dati.prezzoSpot;
      if (typeof dati.riskFree === 'number') el('riskFree').value = dati.riskFree;
      if (typeof dati.volAtm === 'number') el('volAtm').value = dati.volAtm;
      if (typeof dati.divYield === 'number' && el('divYield')) el('divYield').value = dati.divYield;
      if (typeof dati.cash === 'number') { el('cash').value = dati.cash; stato.cash = dati.cash; aggiornaStileCash(); }
      stato.cashEscluso = dati.cashEscluso === true;
      if (el('cashEscludi')) el('cashEscludi').checked = stato.cashEscluso;
      if (typeof dati.dataAnalisi === 'string' && dati.dataAnalisi) el('dataAnalisi').value = dati.dataAnalisi;
      if (dati.tipoNES) el('tipoNES').value = dati.tipoNES;
      if (dati.tipoMES) el('tipoMES').value = dati.tipoMES;
      if (Array.isArray(dati.schede) && dati.schede.length) {
        stato.schede = dati.schede.map(migraScheda);
      } else if (Array.isArray(dati.NES) || Array.isArray(dati.MES) || Array.isArray(dati.opzioni)) {
        // v18 e precedenti: una sola scheda â diventa la Matrice
        stato.schede = [migraScheda({
          nome: 'Matrice',
          tipoNES: dati.tipoNES || 'NES',
          tipoMES: dati.tipoMES || 'MES',
          NES: dati.NES, MES: dati.MES,
          opzioni: dati.opzioni,
          strumentoOpzioni: dati.strumentoOpzioni || 'MES'
        })];
      }
      stato.attiva = Math.max(0, Math.min(stato.schede.length - 1, dati.attiva || 0));
      return true;
    } catch (e) { return false; }
  }

  // Migrazione di una scheda (dati vecchi/corrotti non rompono nulla)
  function migraScheda(s) {
    return {
      nome: s.nome || 'Matrice',
      tipoNES: s.tipoNES || 'NES',
      tipoMES: s.tipoMES || 'MES',
      NES: Array.isArray(s.NES) ? s.NES.map(migraMov) : [],
      MES: Array.isArray(s.MES) ? s.MES.map(migraMov) : [],
      opzioni: Array.isArray(s.opzioni) ? s.opzioni.map(migraOpz) : [],
      strumentoOpzioni: s.strumentoOpzioni || 'MES'
    };
  }

  function migraMov(m) {
    if (m.prezzoPulito === undefined) m.prezzoPulito = m.prezzo || 0;
    delete m.prezzo;
    if (m.attivo === undefined) m.attivo = true;
    return m;
  }

  function migraOpz(o) {
    return {
      attivo: o.attivo !== false,
      strumento: o.strumento || 'MES',
      pos: o.pos || 'SELL',
      tipo: o.tipo || 'PUT',
      qta: o.qta || 0,
      assgn: !!o.assgn,
      strike: o.strike || 0,
      premio: o.premio || 0,
      vol: o.vol || 0,
      scadenza: o.scadenza || '',
      rlzd: (o.rlzd === undefined || o.rlzd === null) ? '' : o.rlzd,
      stato: o.stato === 'CHIUSA' ? 'CHIUSA' : 'APERTA'
    };
  }

  function reset() {
    if (!confirm('Vuoi davvero azzerare tutti i dati?')) return;
    localStorage.removeItem(STORAGE_KEY);
    STORAGE_KEYS_LEGACY.forEach(k => localStorage.removeItem(k));
    stato.schede = [nuovaScheda('Matrice')];
    stato.attiva = 0;
    el('prezzoSpot').value = 7700;
    el('riskFree').value = 4.0;
    el('volAtm').value = 15;
    if (el('divYield')) el('divYield').value = 0;
    el('cash').value = 0;
    stato.cash = 0;
    aggiornaStileCash();
    stato.cashEscluso = false;
    if (el('cashEscludi')) el('cashEscludi').checked = false;
    el('dataAnalisi').value = dataOggiIso();
    const spot = 7700;
    stato.schede[0].NES.push({ direzione: 'LONG', quantita: 1, prezzoPulito: spot, attivo: true });
    stato.schede[0].MES.push({ direzione: 'LONG', quantita: 1, prezzoPulito: spot, attivo: true });
    renderTabs();
    renderScheda();
  }

  let statusTimer = null;
  function mostraStatus(txt, err) {
    const s = el('saveStatus');
    s.textContent = txt;
    s.style.color = err ? 'var(--red)' : 'var(--green)';
    s.classList.add('show');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => s.classList.remove('show'), 1800);
  }

  // ============================================================
  // EVENTI
  // ============================================================
  el('prezzoSpot').addEventListener('input', () => {
    aggiornaCalcolati('NES');
    aggiornaCalcolati('MES');
    calcolaTutto();
  });
  el('riskFree').addEventListener('input', () => {
    calcolaTutto();
  });
  if (el('volAtm')) el('volAtm').addEventListener('input', () => {
    calcolaTutto();
  });
  if (el('divYield')) el('divYield').addEventListener('input', () => {
    calcolaTutto();
  });
  if (el('cash')) el('cash').addEventListener('input', () => {
    stato.cash = parseFloat(el('cash').value) || 0;
    aggiornaStileCash();
    calcolaTutto();
  });
  if (el('cashEscludi')) el('cashEscludi').addEventListener('change', () => {
    stato.cashEscludi = el('cashEscludi').checked;
    calcolaTutto();
  });
  if (el('dataAnalisi')) el('dataAnalisi').addEventListener('change', () => {
    // Ricalcola greche, teorico, GG residui e POP rispetto alla nuova data
    calcolaTutto();
  });
  if (el('showExpiry')) el('showExpiry').addEventListener('change', () => calcolaTutto());
  if (el('showNow'))    el('showNow').addEventListener('change', () => calcolaTutto());
  if (el('showBE'))     el('showBE').addEventListener('change', () => redrawChartFromView());
  if (el('showSigma'))  el('showSigma').addEventListener('change', () => redrawChartFromView());
  if (el('nSD'))        el('nSD').addEventListener('change', () => redrawChartFromView());

  el('tipoNES').addEventListener('change', e => {
    schedaAttiva().tipoNES = e.target.value;
    renderMovimenti('NES'); calcolaTutto();
  });
  el('tipoMES').addEventListener('change', e => {
    schedaAttiva().tipoMES = e.target.value;
    renderMovimenti('MES'); calcolaTutto();
  });

  document.querySelectorAll('.btn-add[data-col]').forEach(btn => {
    btn.addEventListener('click', () => {
      const col = btn.dataset.col;
      const spot = parseFloat(el('prezzoSpot').value) || 0;
      schedaAttiva()[col].push({ direzione: 'LONG', quantita: 1, prezzoPulito: spot, attivo: true });
      renderMovimenti(col); calcolaTutto();
    });
  });

  el('btnAddOpzione').addEventListener('click', () => {
    // Scadenza di default: data analisi + 30 giorni
    const defaultScad = dataAnalisiDate();
    defaultScad.setDate(defaultScad.getDate() + 30);
    const yyyy = defaultScad.getFullYear();
    const mm = String(defaultScad.getMonth() + 1).padStart(2, '0');
    const dd = String(defaultScad.getDate()).padStart(2, '0');
    schedaAttiva().opzioni.push({
      attivo: true, strumento: strumentoOpzSelezionato(),
      pos: 'SELL', tipo: 'PUT', qta: 1, assgn: false,
      strike: 0, rlzd: '', premio: 0, vol: 15, scadenza: `${yyyy}-${mm}-${dd}`,
      stato: 'APERTA'
    });
    renderOpzioni(); calcolaTutto();
  });

  el('strumentoOpzioni').addEventListener('change', () => {
    // Il menu a tendina dell'header cambia lo strumento della scheda
    // (MES / ES / AZIONI): le righe degli altri strumenti restano dormienti
    schedaAttiva().strumentoOpzioni = el('strumentoOpzioni').value;
    renderOpzioni();
    calcolaTutto();
  });
  el('btnCreaComp').addEventListener('click', creaComparazione);
  if (el('btnPromuovi')) el('btnPromuovi').addEventListener('click', promuoviSuMatrice);
  el('btnSalva').addEventListener('click', () => salva(false));
  el('btnReset').addEventListener('click', reset);

  // ============================================================
  // AVVIO
  // ============================================================
  // Data analisi di default: oggi (sovrascritta dal salvataggio se presente)
  el('dataAnalisi').value = dataOggiIso();

  const caricato = carica();
  if (!caricato) {
    const spotIniziale = parseFloat(el('prezzoSpot').value) || 7700;
    stato.schede[0].NES.push({ direzione: 'LONG', quantita: 1, prezzoPulito: spotIniziale, attivo: true });
    stato.schede[0].MES.push({ direzione: 'LONG', quantita: 1, prezzoPulito: spotIniziale, attivo: true });
  }

  renderTabs();
  renderScheda();
