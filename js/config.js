// config.js — costanti, moltiplicatori, stato iniziale e helper DOM
// Parte di Mastering: ordine di caricamento definito in index.html.
// v22 — BE robusti, greche di posizione in $, fix mobile, commissioni toggle.

  const MOLTIPLICATORI = { NES: 0.5, MES: 5, ES: 50, X: 100 };
  // Commissioni per lato (apertura o chiusura), in $ per contratto/unità.
  // X = azioni (molt. 100): ~1 $ per ordine. Opzioni: ~1 $ per contratto.
  const FEE_FUTURES_LATO = 1.205; // NES / MES / ES
  const FEE_STOCK_LATO   = 1.00;  // X (azioni)
  const FEE_OPTION_LATO  = 1.00;  // opzioni MES / ES / AZIONI
  // Retrocompatibilità alias
  const FEE_LATO = FEE_FUTURES_LATO;
  const FEE_ROUND_TRIP = FEE_LATO * 2;
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
