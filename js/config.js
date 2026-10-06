// config.js — costanti, moltiplicatori, stato iniziale e helper DOM
// Parte di Mastering: l'ordine di caricamento dei moduli è definito in index.html.

// v23 — futures X (azioni): moltiplicatore ×1 (q.tà 1 = 1 singola azione).
//   Le OPZIONI AZIONI restano ×100 (MOLTIPLICATORI_OPZ): un contratto di
//   opzione muove sempre 100 azioni, quindi 100 q.tà di futures X coprono
//   1 contratto di opzione. Commissioni su azioni rimosse (fee 0).
//   Il file è stato ricostruito: il canale di download precedente introduceva
//   interruzioni di riga spurie nel testo (vedi commit che rompevano il CI).
// Changelog precedente (v22 e precedenti): consultare la cronologia git.

// Moltiplicatori futures: X = azioni, q.tà 1 = 1 singola azione (molt. 1).
const MOLTIPLICATORI = { NES: 0.5, MES: 5, ES: 50, X: 1 };

// Commissioni per lato (apertura o chiusura), in $ per contratto.
const FEE_FUTURES_LATO = 1.205; // NES / MES / ES
const FEE_STOCK_LATO   = 0;     // X (azioni): nessuna fee
const FEE_OPTION_LATO  = 1.00;  // opzioni MES / ES / AZIONI

// Moltiplicatori opzioni (retrocompatibilità): un contratto eq. muove 100 azioni.
const MOLTIPLICATORI_OPZ = { MES: 5, ES: 50, AZIONI: 100 };
function moltOpz(opz) { return MOLTIPLICATORI_OPZ[(opz && opz.strumento) || 'MES']; }

function commissioniAttive() {
  return !!(el('commissioniOn') && el('commissioniOn').checked);
}
function feeLatoFuture(tipo) {
  if (!commissioniAttive()) return 0;
  if (tipo === 'X') return FEE_STOCK_LATO;
  return FEE_FUTURES_LATO;
}
function feeLatoOpzione() {
  return commissioniAttive() ? FEE_OPTION_LATO : 0;
}

const STORAGE_KEY = 'mastering_v20';
const STORAGE_KEYS_LEGACY = ['mastering_v19', 'mastering_v18', 'mastering_v17', 'mastering_v16', 'mastering_v15', 'mastering_v14', 'mastering_v13', 'mastering_v12', 'mastering_v11'];

// --- Supabase Step 1: solo connessione (ancora nessun salvataggio cloud) ---
// Dopo aver creato il progetto e eseguito supabase/schema.sql,
// sostituisci questi due valori (Settings → API nel dashboard Supabase).
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

// Colori delle curve sul grafico: Matrice = bianco, comparazioni = palette
const PALETTE_COMP = ['#f97316', '#22d3ee', '#e879f9', '#a78bfa', '#fb7185', '#facc15'];
function coloreScheda(i) { return i === 0 ? '#ffffff' : PALETTE_COMP[(i - 1) % PALETTE_COMP.length]; }

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

const el = id => document.getElementById(id);
