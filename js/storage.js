// storage.js — persistenza localStorage + strategie cloud Supabase
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.

// ============================================================
// UTILITY
// ============================================================
let autosaveTimer = null;
function autosalva() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => salva(true), 800);
}
window.addEventListener('beforeunload', () => {
  if (autosaveTimer !== null) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
    salva(true);
  }
});

function raccogliDati() {
  const dati = {
    prezzoSpot: parseFloat(el('prezzoSpot').value) || 0,
    riskFree: parseFloat(el('riskFree').value) || 0,
    volAtm: parseFloat(el('volAtm').value) || 0,
    divYield: parseFloat(el('divYield') && el('divYield').value) || 0,
    cash: parseFloat(el('cash').value) || 0,
    dataAnalisiIniziale: el('dataAnalisiIniziale') ? (el('dataAnalisiIniziale').value || '') : '',
    dataAnalisi: el('dataAnalisi') ? (el('dataAnalisi').value || '') : '',
    tipoNES: el('tipoNES').value,
    tipoMES: el('tipoMES').value,
    attiva: stato.attiva,
    schede: stato.schede,
    // v28 — modalità globale: necessaria per riallineare il menu padre al load
    modalitaGlobale: (el('modalitaGlobale') ? el('modalitaGlobale').value : (stato.modalita || MODALITA_DEFAULT))
  };
  return dati;
}

function salva(silent) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raccogliDati()));
    if (!silent) mostraStatus('✓ Salvato');
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
    applicaDati(JSON.parse(raw));

    return true;
  } catch (e) { return false; }
}

// Deduce la modalità globale da una scheda (o da un dato legacy) quando il campo
// `modalitaGlobale` non è presente nei salvataggi precedenti alla v28.
function deduciModalita(schedaODati) {
  const s = schedaODati || {};
  const t = s.tipoNES || s.tipoMES || '';
  if (t === 'ZW' || t === 'custom') return 'futures-commodities';
  if (t === 'NES' || t === 'MES' || t === 'ES') return 'futures-indici';
  if (t === 'X' || s.strumentoOpzioni === 'AZIONI') return 'azioni';
  return MODALITA_DEFAULT;
}

// Applica un oggetto dati (corrente, salvato o importato) ai controlli della pagina
function applicaDati(dati) {
    if (typeof dati.prezzoSpot === 'number') el('prezzoSpot').value = dati.prezzoSpot;
    if (typeof dati.riskFree === 'number') el('riskFree').value = dati.riskFree;
    if (typeof dati.volAtm === 'number') el('volAtm').value = dati.volAtm;
    if (typeof dati.divYield === 'number' && el('divYield')) el('divYield').value = dati.divYield;
    if (typeof dati.cash === 'number') { el('cash').value = dati.cash; stato.cash = dati.cash; aggiornaStileCash(); }
    if (typeof dati.dataAnalisiIniziale === 'string' && dati.dataAnalisiIniziale && el('dataAnalisiIniziale')) {
      el('dataAnalisiIniziale').value = dati.dataAnalisiIniziale;
    }
    if (typeof dati.dataAnalisi === 'string' && dati.dataAnalisi) el('dataAnalisi').value = dati.dataAnalisi;

    // Schede: prima carica lo stato, poi applica la modalità (che sistema i select globali)
    if (Array.isArray(dati.schede) && dati.schede.length) {
      stato.schede = dati.schede.map(migraScheda);
    } else if (Array.isArray(dati.NES) || Array.isArray(dati.MES) || Array.isArray(dati.opzioni)) {
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

    // v28 — Determina la modalità da ripristinare.
    const modSalvata = dati.modalitaGlobale
      || deduciModalita(stato.schede[stato.attiva] || dati);

    const selMod = el('modalitaGlobale');
    if (selMod) selMod.value = modSalvata;

    applicaModalita(modSalvata);
}

// ============================================================
// SUPABASE — client + test connessione
// ============================================================
let _sbClient = null;

function supabaseConfigurato() {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY
    && SUPABASE_URL.indexOf('YOUR_') === -1
    && SUPABASE_ANON_KEY.indexOf('YOUR_') === -1
    && window.supabase && typeof window.supabase.createClient === 'function');
}

function getSupabase() {
  if (!supabaseConfigurato()) return null;
  if (!_sbClient) {
    _sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _sbClient;
}

async function testaConnessioneSupabase() {
  if (!supabaseConfigurato()) return;
  const sb = getSupabase();
  if (!sb) return;
  try {
    const { error } = await sb.from('strategie').select('nome').limit(1);
    if (error) {
      mostraStatus('Supabase: ' + (error.message || 'errore'), true);
      return false;
    }
    mostraStatus('✓ Supabase collegato');
    return true;
  } catch (e) {
    mostraStatus('Supabase: rete o chiave non valide', true);
    return false;
  }
}

// ============================================================
// STRATEGIE SALVATE — cloud Supabase + cache localStorage
// ============================================================
const STORAGE_SALVATI = 'mastering_salvati_v1';

function leggiSalvatiLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_SALVATI)) || {}; }
  catch (e) { return {}; }
}
function scriviSalvatiLocal(map) {
  localStorage.setItem(STORAGE_SALVATI, JSON.stringify(map));
}

async function listaSalvate() {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('strategie')
        .select('nome')
        .order('nome', { ascending: true });
      if (error) throw error;
      return (data || []).map(r => r.nome);
    } catch (e) {
      return Object.keys(leggiSalvatiLocal()).sort((a, b) => a.localeCompare(b));
    }
  }
  return Object.keys(leggiSalvatiLocal()).sort((a, b) => a.localeCompare(b));
}

// Riempe la finestra di scelta strategie (#modalListaStrategie) con i nomi
// disponibili (cloud, fallback locale). `filtro` (opzionale) filtra per nome,
// come digitato nel campo di ricerca del modale.
// Scarica nome+dati di tutte le strategie salvate (cloud, fallback locale)
async function mappaSalvatiDati() {
  const sb = getSupabase();
  const out = {};
  if (sb) {
    try {
      const { data, error } = await sb.from('strategie').select('nome, dati');
      if (!error && Array.isArray(data)) {
        data.forEach(r => { if (r && r.nome && r.dati) out[r.nome] = r.dati; });
        return out;
      }
    } catch (e) { /* fallback locale sotto */ }
  }
  const map = leggiSalvatiLocal();
  Object.keys(map).forEach(n => { if (map[n] && map[n].dati) out[n] = map[n].dati; });
  return out;
}

// Sparkline di anteprima: payoff a scadenza della strategia salvata,
// calcolato in un contesto temporaneo (input e stato vengono applicati,
// usati e ripristinati — la pagina corrente non cambia).
function sparklineSvg(dati) {
  if (!dati || !Array.isArray(dati.schede) || !dati.schede.length) return '';

  const campi = ['prezzoSpot', 'riskFree', 'volAtm', 'divYield', 'dataAnalisi',
                 'strumentoOpzioni', 'tipoNES', 'tipoMES', 'cash'];
  const bk = {};
  campi.forEach(id => {
    const e = el(id);
    if (e) bk[id] = (e.type === 'checkbox') ? e.checked : e.value;
  });
  const bkStato = {
    schede: stato.schede, attiva: stato.attiva, cash: stato.cash
  };

  let svg = '';
  try {
    // Applica i dati della strategia salvata
    if (typeof dati.prezzoSpot === 'number') el('prezzoSpot').value = dati.prezzoSpot;
    if (typeof dati.riskFree === 'number') el('riskFree').value = dati.riskFree;
    if (typeof dati.volAtm === 'number') el('volAtm').value = dati.volAtm;
    if (typeof dati.divYield === 'number' && el('divYield')) el('divYield').value = dati.divYield;
    if (typeof dati.cash === 'number') el('cash').value = dati.cash;
    if (dati.dataAnalisi && el('dataAnalisi')) el('dataAnalisi').value = dati.dataAnalisi;
    stato.cash = dati.cash || 0;
    stato.schede = dati.schede.map(migraScheda);
    stato.attiva = 0;
    const s0 = stato.schede[0] || {};
    if (el('strumentoOpzioni')) el('strumentoOpzioni').value = s0.strumentoOpzioni || 'MES';
    if (el('tipoNES')) el('tipoNES').value = s0.tipoNES || 'NES';
    if (el('tipoMES')) el('tipoMES').value = s0.tipoMES || 'MES';

    // Calcola il payoff a scadenza usando la stessa centratura del grafico
    // principale: si aggancia a breakeven e struttura (strike/medie) della
    // strategia, così l'anteprima è sempre centrata su ciò che conta.
    const scheda = s0;
    const resNES = calcolaColonna(scheda, 'NES');
    const resMES = calcolaColonna(scheda, 'MES');
    const spot = (dati.prezzoSpot > 0) ? dati.prezzoSpot : 100;
    const scan = scanRangeForBE(spot);
    const bes = findBreakevensRobust(scheda, spot, scan.minS, scan.maxS, resNES, resMES);
    const rng = centeredChartRange(spot, bes);
    const lo = rng.minS, hi = rng.maxS;
    const n = 60;
    const pnl = [];
    for (let i = 0; i <= n; i++) {
      const S = lo + (hi - lo) * i / n;
      pnl.push(pnlCombinatoAt(scheda, S, 'expiry', resNES, resMES));
    }

    // Costruisce l'anteprima: mini grafico payoff con aree verde/rosso,
    // curva, spot (linea azzurra) e breakeven (tacche gialle)
    const min = Math.min(0, ...pnl), max = Math.max(0, ...pnl);
    const W = 170, H = 54;
    const range = (max - min) || 1;
    const y = v => H * (1 - (v - min) / range);
    const x = i => (i / n) * W;
    const zeroY = y(0).toFixed(1);
    const curva = pnl.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
    const area = `M 0 ${zeroY} ` +
      pnl.map((v, i) => `L ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ') +
      ` L ${W} ${zeroY} Z`;

    // Breakeven (cambi di segno del payoff, interpolati)
    const bePts = [];
    for (let i = 1; i <= n; i++) {
      const a = pnl[i - 1], b = pnl[i];
      if ((a <= 0 && b > 0) || (a >= 0 && b < 0)) {
        const frac = a === b ? 0 : (0 - a) / (b - a);
        bePts.push(x(i - 1 + frac));
      }
    }
    const beSvg = bePts.map(bx =>
      `<line x1="${bx.toFixed(1)}" y1="${zeroY - 5}" x2="${bx.toFixed(1)}" y2="${+zeroY + 5}" stroke="#f1c40f" stroke-width="1.6"/>`
    ).join('');

    // Spot: posizione reale dello spot dentro il range centrato
    const spotX = (Math.max(0, Math.min(1, (spot - lo) / ((hi - lo) || 1))) * W).toFixed(1);

    const uid = 'ap' + Math.floor(Math.random() * 1e9);
    svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="pointer-events:none;display:block;">` +
          `<rect x="0" y="0" width="${W}" height="${H}" rx="5" fill="#0c0e12"/>` +
          `<defs>` +
          `<clipPath id="${uid}pos"><rect x="0" y="0" width="${W}" height="${zeroY}"/></clipPath>` +
          `<clipPath id="${uid}neg"><rect x="0" y="${zeroY}" width="${W}" height="${H - zeroY}"/></clipPath>` +
          `</defs>` +
          `<path d="${area}" fill="#2ecc71" fill-opacity="0.30" clip-path="url(#${uid}pos)"/>` +
          `<path d="${area}" fill="#e74c3c" fill-opacity="0.30" clip-path="url(#${uid}neg)"/>` +
          `<line x1="0" y1="${zeroY}" x2="${W}" y2="${zeroY}" stroke="#2a2f3a" stroke-width="1"/>` +
          beSvg +
          `<line x1="${spotX}" y1="0" x2="${spotX}" y2="${H}" stroke="#4f8cff" stroke-width="1" stroke-dasharray="3,3" opacity="0.9"/>` +
          `<path d="${curva}" fill="none" stroke="#e6e8ee" stroke-width="1.4" stroke-linejoin="round"/>` +
          `</svg>`;
  } catch (e) {
    svg = '';
  } finally {
    // Ripristina SEMPRE il contesto della pagina corrente
    campi.forEach(id => {
      const e = el(id);
      if (e) {
        if (e.type === 'checkbox') e.checked = bk[id];
        else e.value = bk[id];
      }
    });
    stato.schede = bkStato.schede;
    stato.attiva = bkStato.attiva;
    stato.cash = bkStato.cash;
  }
  return svg;
}

async function renderListaSalvate(filtro) {
  const nomi = await listaSalvate();
  const f = (filtro || '').trim().toLowerCase();
  const visibili = nomi.filter(n => !f || n.toLowerCase().includes(f));

  const box = el('modalListaStrategie');
  if (box) {
    box.innerHTML = '';
    if (!visibili.length) {
      const vuoto = document.createElement('div');
      vuoto.className = 'strategia-empty';
      vuoto.textContent = getSupabase()
        ? '— nessuna strategia in cloud —'
        : '— nessuna strategia salvata —';
      box.appendChild(vuoto);
    } else {
      // Scarica i dati una sola volta per tutte le righe
      const datiPerNome = await mappaSalvatiDati();
      visibili.forEach(n => {
        const r = document.createElement('button');
        r.type = 'button';
        r.className = 'strategia-row';
        r.dataset.nome = n;
        const nm = document.createElement('span');
        nm.className = 'strategia-nome';
        nm.textContent = n;
        r.appendChild(nm);
        const dati = datiPerNome[n];
        if (dati) {
          const wrap = document.createElement('span');
          wrap.className = 'strategia-spark';
          wrap.title = 'Anteprima payoff a scadenza (spot ±15%) · linea azzurra = spot · tacche gialle = breakeven';
          wrap.innerHTML = sparklineSvg(dati);
          r.appendChild(wrap);
        }
        box.appendChild(r);
      });
    }
  }
}

async function salvaConNome(nome) {
  nome = (nome || '').trim();
  const input = el('nomeStrategia');
  if (!nome) { mostraStatus('Inserisci un nome (es. AMZN)', true); if (input) input.focus(); return; }

  const dati = raccogliDati();
  const salvatoIl = new Date().toISOString();

  const map = leggiSalvatiLocal();
  const esisteLocale = !!(map[nome] && map[nome].dati);
  let esisteCloud = false;
  const sb = getSupabase();
  if (sb) {
    try {
      const { data } = await sb.from('strategie').select('nome').eq('nome', nome).maybeSingle();
      esisteCloud = !!(data && data.nome);
    } catch (e) { /* ignore */ }
  }
  if ((esisteLocale || esisteCloud) && !confirm('Esiste già una strategia "' + nome + '".\nSovrascriverla con i dati correnti?')) return;

  map[nome] = { salvatoIl: salvatoIl, dati: dati };
  try { scriviSalvatiLocal(map); }
  catch (e) { mostraStatus('Errore salvataggio locale', true); return; }

  if (sb) {
    try {
      const { error } = await sb
        .from('strategie')
        .upsert({ nome: nome, dati: dati, salvato_il: salvatoIl }, { onConflict: 'nome' });
      if (error) throw error;
      mostraStatus('✓ "' + nome + '" salvata in cloud');
    } catch (e) {
      mostraStatus('Salvata in locale; cloud non raggiungibile', true);
    }
  } else {
    mostraStatus('✓ Strategia "' + nome + '" salvata');
  }
  await renderListaSalvate();
}

async function caricaSalvato(nome) {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('strategie')
        .select('nome, dati, salvato_il')
        .eq('nome', nome)
        .maybeSingle();
      if (error) throw error;
      if (data && data.dati) {
        applicaDati(data.dati);
        const map = leggiSalvatiLocal();
        map[nome] = { salvatoIl: data.salvato_il || new Date().toISOString(), dati: data.dati };
        scriviSalvatiLocal(map);
        if (el('nomeStrategia')) el('nomeStrategia').value = nome;
        renderTabs(); renderScheda();
        await renderListaSalvate();
        mostraStatus('✓ "' + nome + '" caricata da cloud');
        return;
      }
    } catch (e) {
      // fallback locale
    }
  }

  const entry = leggiSalvatiLocal()[nome];
  if (!entry || !entry.dati) { mostraStatus('Strategia non trovata', true); return; }
  applicaDati(entry.dati);
  if (el('nomeStrategia')) el('nomeStrategia').value = nome;
  renderTabs(); renderScheda();
  await renderListaSalvate();
  mostraStatus('✓ "' + nome + '" caricata');
}

async function eliminaSalvato(nome) {
  if (!nome) return;
  if (!confirm('Eliminare la strategia salvata "' + nome + '"?\n\n(Il lavoro corrente a video non cambia.)')) return;

  const map = leggiSalvatiLocal();
  delete map[nome];
  scriviSalvatiLocal(map);

  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb.from('strategie').delete().eq('nome', nome);
      if (error) throw error;
      mostraStatus('✓ "' + nome + '" eliminata da cloud');
    } catch (e) {
      mostraStatus('Eliminata in locale; cloud non aggiornato', true);
    }
  } else {
    mostraStatus('✓ "' + nome + '" eliminata');
  }
  await renderListaSalvate();
}

// ============================================================
// EXPORT / IMPORT FILE JSON
// ============================================================
function esportaFile() {
  const nome = (el('nomeStrategia') && el('nomeStrategia').value.trim()) || 'strategia';
  const payload = {
    formato: 'mastering-strategia', versione: 1,
    nome, esportatoIl: new Date().toISOString(),
    dati: raccogliDati()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const oggi = new Date().toISOString().slice(0, 10);
  a.download = 'mastering-' + nome.replace(/[^a-z0-9_-]+/gi, '_') + '-' + oggi + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  mostraStatus('✓ File esportato');
}

function importaDaJson(testo) {
  const obj = JSON.parse(testo);
  const dati = (obj && obj.formato === 'mastering-strategia') ? obj.dati : obj;
  if (!dati || !Array.isArray(dati.schede)) throw new Error('formato non riconosciuto');
  applicaDati(dati);
  if (el('nomeStrategia') && obj && obj.nome) el('nomeStrategia').value = obj.nome;
  renderTabs(); renderScheda(); renderListaSalvate();
  mostraStatus('✓ Strategia importata');
}

function importaDaInputFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try { importaDaJson(String(reader.result)); }
    catch (e) { mostraStatus('File non valido', true); }
  };
  reader.readAsText(file);
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
    strumentoOpzioni: s.strumentoOpzioni || 'MES',
    // v29 — override commodities
    tickerCommodity: s.tickerCommodity || '',
    moltiplicatoreCommodity: (s.moltiplicatoreCommodity !== undefined && s.moltiplicatoreCommodity !== null)
      ? s.moltiplicatoreCommodity : null,
    // parametri di mercato della scheda (spot, vol, tassi, cash, date)
    par: (s.par && typeof s.par === 'object') ? { ...s.par } : null
  };
}

// v30 — Migrazione movimento:
// - Rimuove i campi obsoleti (dataOpen, dataClose).
// - Converte feeOpen + feeClose in un'unica fee di riga.
// - Rimuove i flag di "manuale" non più necessari.
function migraMov(m) {
  // compatibilità prezzo (vecchia chiave "prezzo")
  if (m.prezzoPulito === undefined) m.prezzoPulito = m.prezzo || 0;
  delete m.prezzo;
  if (m.attivo === undefined) m.attivo = true;

  // fee: se esistono feeOpen/feeClose li somma in fee, poi li elimina
  if (m.fee === undefined) {
    const fo = (typeof m.feeOpen === 'number') ? m.feeOpen : 0;
    const fc = (typeof m.feeClose === 'number') ? m.feeClose : 0;
    m.fee = fo + fc;
  }
  delete m.feeOpen;
  delete m.feeClose;
  delete m.feeOpenManuale;
  delete m.feeCloseManuale;

  // date: eliminate (non più usate)
  delete m.dataOpen;
  delete m.dataClose;

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

function reset(senzaConferma) {
  if (!senzaConferma && !confirm('Vuoi davvero azzerare tutti i dati?\n\nIl foglio tornerà completamente vuoto, pronto per nuovi inserimenti.')) return;
  localStorage.removeItem(STORAGE_KEY);
  STORAGE_KEYS_LEGACY.forEach(k => localStorage.removeItem(k));
  const mod = stato.modalita || MODALITA_DEFAULT;
  let tNES = '-', tMES = '-', sOpz = 'MES';
  if (mod === 'azioni') {
    tNES = 'X'; tMES = 'X'; sOpz = 'AZIONI';
  } else if (mod === 'futures-commodities') {
    tNES = 'ZW'; tMES = 'ZW'; sOpz = 'ZW';
  }
  stato.schede = [{
    nome: 'Matrice',
    tipoNES: tNES, tipoMES: tMES,
    NES: [], MES: [], opzioni: [],
    strumentoOpzioni: sOpz,
    tickerCommodity: '',
    moltiplicatoreCommodity: null
  }];
  stato.attiva = 0;
  el('prezzoSpot').value = '';
  el('riskFree').value = 0;
  el('volAtm').value = 0;
  if (el('divYield')) el('divYield').value = 0;
  el('cash').value = 0;
  stato.cash = 0;
  aggiornaStileCash();
  const oggi = dataOggiIso();
  if (el('dataAnalisiIniziale')) el('dataAnalisiIniziale').value = oggi;
  el('dataAnalisi').value = oggi;
  if (typeof chartView !== 'undefined') {
    chartView.xMin = null; chartView.xMax = null;
    chartView.baseMin = null; chartView.baseMax = null;
    chartView.userMoved = false;
    chartView._sig = null;
  }
  if (el('nomeStrategia')) el('nomeStrategia').value = '';
  renderListaSalvate('');
  renderTabs();
  renderScheda();
  mostraStatus('✓ Foglio azzerato');
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
