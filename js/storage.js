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

// Riporta nell'header Back i valori della scheda attiva (basis e vol ATM Back)
function aggiornaHeaderBack(scheda) {
  const s = scheda || {};
  if (el('basisInput')) el('basisInput').value = (s.basis !== undefined && s.basis !== null) ? s.basis : 0;
  if (el('volAtmBack')) el('volAtmBack').value = (s.volAtmBack !== undefined && s.volAtmBack !== null) ? s.volAtmBack : '';
  if (typeof aggiornaSBack === 'function') aggiornaSBack();
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
    aggiornaHeaderBack(schedaAttiva());

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
