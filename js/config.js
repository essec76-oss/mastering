// config.js — costanti, moltiplicatori, stato iniziale e helper DOM
// Parte di Mastering: l'ordine di caricamento dei moduli è definito in index.html.

// v27 — Commissioni: nessun P&L include fee (P&L lordo). Le costanti che
//   seguono restano SOLO per la stima informativa mostrata nell'header di
//   colonna (render-futures.js). Le funzioni feeLato* ritornano sempre 0.
// v23 — futures X (azioni): moltiplicatore ×1 (q.tà 1 = 1 singola azione).
//   Le OPZIONI AZIONI restano ×100 (MOLTIPLICATORI_OPZ).
// Changelog precedente (v22 e precedenti): consultare la cronologia git.

// Moltiplicatori futures: X = azioni (q.tà 1 = 1 azione), ZW = Wheat (×50).
const MOLTIPLICATORI = { NES: 0.5, MES: 5, ES: 50, X: 1, ZW: 50 };

// Whitelist commissioni futures: solo NES paga fee (per la stima informativa).
const STRUMENTI_CON_COMMISSIONI = ['NES'];

// Commissioni per lato (apertura o chiusura), in $ per contratto.
const FEE_FUTURES_LATO = 1.205; // NES

// Moltiplicatori opzioni: un contratto eq. muove 100 azioni.
const MOLTIPLICATORI_OPZ = { MES: 5, ES: 50, AZIONI: 100 };
function moltOpz(opz) { return MOLTIPLICATORI_OPZ[(opz && opz.strumento) || 'MES']; }

// ============================================================
// COMMODITIES — mappa ticker → moltiplicatore (dati utente)
// ============================================================
// Usata dal selettore ticker in modalità "Futures su commodities":
// quando l'utente scrive un ticker presente qui, il moltiplicatore
// della casella si aggiorna automaticamente. Ticker sconosciuti →
// moltiplicatore da impostare a mano (default 1).
const MOLTIPLICATORI_COMMODITIES = {
  ZW: 50,      // Wheat (SRW)
  ZM: 100,     // Soybean Meal
  ZC: 50,      // Corn
  ZL: 600,     // Soybean Oil
  ZS: 50,      // Soybean
  KE: 50,      // KC Wheat
  LE: 400,     // Live Cattle
  GF: 500,     // Feeder Cattle
  HE: 400,     // Lean Hogs
  RB: 42000,   // RBOB Gasoline
  NG: 10000,   // Natural Gas
  HO: 42000,   // Heating Oil
  CL: 1000,    // Crude Oil WTI
  SI: 5000,    // Silver
  GC: 100,     // Gold
  PL: 50,      // Platinum
  HG: 25000,   // Copper
  CC: 10,      // Cocoa
  KC: 375,     // Coffee
  CT: 500,     // Cotton
  OJ: 150,     // Orange Juice
  SB: 1120     // Sugar
};

// v27 — Le commissioni non entrano più in nessun calcolo (P&L lordo).
// La funzione è mantenuta per retrocompatibilità: se in futuro si volesse
// riattivare il toggle, basterebbe cambiare questo valore di ritorno.
function commissioniAttive() {
  return false;
}

// Fee futures per lato: sempre 0 nei calcoli (P&L lordo).
// La stima informativa è calcolata separatamente in render-futures.js.
function feeLatoFuture(tipo) {
  if (!commissioniAttive()) return 0;
  if (!STRUMENTI_CON_COMMISSIONI.includes(tipo)) return 0;
  return FEE_FUTURES_LATO;
}
// Alias usato da futures.js per la whitelist (retrocompatibile).
function feeLatoFutureAttiva(tipo) {
  return feeLatoFuture(tipo);
}
// Fee opzioni per lato: sempre 0 (le opzioni sono commission-free).
function feeLatoOpzione() {
  return 0;
}

const STORAGE_KEY = 'mastering_v20';
const STORAGE_KEYS_LEGACY = ['mastering_v19', 'mastering_v18', 'mastering_v17', 'mastering_v16', 'mastering_v15', 'mastering_v14', 'mastering_v13', 'mastering_v12', 'mastering_v11'];

// --- Supabase Step 1: solo connessione (ancora nessun salvataggio cloud) ---
// Progetto Trading (essec76-oss). Publishable key = uso browser + RLS.
const SUPABASE_URL = 'https://twulifdttpamrmjvpwia.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_AlJOIOMpTdqBA43Ugcd1Lg_V70uVRXP';

// Colori delle curve sul grafico: Matrice = bianco, comparazioni = palette
// (mantenuta per usi futuri, non più usata nel disegno del payoff).
const PALETTE_COMP = ['#f97316', '#22d3e8', '#e879f9', '#a78bfa', '#fb7185', '#facc15'];
function coloreScheda(i) { return i === 0 ? '#ffffff' : PALETTE_COMP[(i - 1) % PALETTE_COMP.length]; }

// --- Colori del grafico di confronto (v25) ---
// Azzurro = scheda corrente (attiva); Ambra = scheda precedente (confronto).
// Ambra scelta più chiara di #f97316 (tema tab comparazione) per non confondere
// la curva "precedente" con la tab attiva quando la scheda è una comparazione.
const COLORE_CORRENTE   = '#22b8f0'; // azzurro
const COLORE_PRECEDENTE = '#fb923c'; // ambra

// Modalità globale della pagina (selettore padre in alto a sx)
// 'azioni' | 'futures-indici' | 'futures-commodities'
const MODALITA_DEFAULT = 'azioni';

// Una scheda = uno scenario completo (futures NES/MES + opzioni).
// La scheda 0 è la "Matrice": non può essere rimossa.
// Default = modalità Azioni (tipo X + strumentoOpzioni AZIONI).
function nuovaScheda(nome) {
  return {
    nome: nome || 'Matrice',
    tipoNES: 'X', tipoMES: 'X',
    NES: [], MES: [], opzioni: [],
    strumentoOpzioni: 'AZIONI'
  };
}

const stato = {
  schede: [nuovaScheda('Matrice')],
  attiva: 0,
  prezzoSpot: 7700,
  cash: 0,
  cashEscluso: false,
  modalita: MODALITA_DEFAULT,
  // Commodities: ticker + moltiplicatore scritti nelle caselle accanto al menu padre
  ticker: 'ZW',
  molt: 50
};

function schedaAttiva() { return stato.schede[stato.attiva] || stato.schede[0]; }

// Scheda precedente (per il confronto). Null se siamo sulla Matrice.
function schedaPrecedente() {
  if (stato.attiva <= 0) return null;
  return stato.schede[stato.attiva - 1] || null;
}

const el = id => document.getElementById(id);
