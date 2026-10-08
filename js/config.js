// config.js — costanti, moltiplicatori, stato iniziale e helper DOM
// Parte di Mastering: l'ordine di caricamento dei moduli è definito in index.html.

// v24 — Commissioni: attive SOLO su NES. Tutti gli altri strumenti
//   (MES, ES, X e opzioni MES/ES/AZIONI) sono simulati commission-free:
//   P&L lordo. Obiettivo: isolare il costo commissionale sul Nano E-mini.
// v23 — futures X (azioni): moltiplicatore ×1 (q.tà 1 = 1 singola azione).
//   Le OPZIONI AZIONI restano ×100 (MOLTIPLICATORI_OPZ): un contratto di
//   opzione muove sempre 100 azioni, quindi 100 q.tà di futures X coprono
//   1 contratto di opzione.
// Changelog precedente (v22 e precedenti): consultare la cronologia git.

// Moltiplicatori futures: X = azioni, q.tà 1 = 1 singola azione (molt. 1).
const MOLTIPLICATORI = { NES: 0.5, MES: 5, ES: 50, X: 1 };

// Whitelist commissioni futures: solo NES paga fee in questa simulazione.
const STRUMENTI_CON_COMMISSIONI = ['NES'];

// Commissioni per lato (apertura o chiusura), in $ per contratto.
const FEE_FUTURES_LATO = 1.205; // NES
// FEE_OPTION_LATO non più usata: le opzioni sono commission-free in questa sim.
// const FEE_OPTION_LATO = 1.00;

// Moltiplicatori opzioni: un contratto eq. muove 100 azioni.
const MOLTIPLICATORI_OPZ = { MES: 5, ES: 50, AZIONI: 100 };
function moltOpz(opz) { return MOLTIPLICATORI_OPZ[(opz && opz.strumento) || 'MES']; }

function commissioniAttive() {
  return !!(el('commissioniOn') && el('commissioniOn').checked);
}
// Fee futures per lato: 0 se il toggle è spento, 0 se lo strumento non
// è in whitelist (MES / ES / X), altrimenti FEE_FUTURES_LATO (NES).
function feeLatoFuture(tipo) {
  if (!commissioniAttive()) return 0;
  if (!STRUMENTI_CON_COMMISSIONI.includes(tipo)) return 0;
  return FEE_FUTURES_LATO;
}
// Alias usato da futures.js per la whitelist (retrocompatibile).
function feeLatoFutureAttiva(tipo) {
  return feeLatoFuture(tipo);
}
// Fee opzioni per lato: sempre 0 (le opzioni del tool sono MES/ES/AZIONI,
// mai NES: nessuno strumento opzionabile paga commissioni in questa sim).
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

// Una scheda = uno scenario completo (futures NES/MES + opzioni).
// La scheda 0 è la "Matrice": non può essere rimossa.
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

// Scheda precedente (per il confronto). Null se siamo sulla Matrice.
function schedaPrecedente() {
  if (stato.attiva <= 0) return null;
  return stato.schede[stato.attiva - 1] || null;
}

const el = id => document.getElementById(id);
