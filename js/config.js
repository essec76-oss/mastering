// config.js — costanti, moltiplicatori, stato iniziale e helper DOM
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.

// v23 — futures X (azioni): moltiplicatore ×1 (q.tà 1 = 1 singola azione).
  // Le OPZIONI AZIONI restano ×100 (MOLTIPLICATORI_OPZ): un contratto di opzione
  // muove sempre 100 azioni, quindi 100 azioni future coprono 1 contratto opzione.
  // Commissioni azioni rimosse (FEE_STOCK_LATO = 0).
  // v22 — breakeven sempre individuati + greche di posizione scalate + fix mobile.
  // BE: la vecchia scansione (griglia uniforme a 180 punti su spot±45% esteso
  // alla struttura±30%) perdeva gli attraversamenti quando la struttura occupava
  // una fetta minima del range (es. opzioni AZIONI con strike ~100 e spot ~7700:
  // step di scansione ~60 punti) oppure quando il BE cadeva fuori range (premi
  // pesanti). Ora la ricerca usa un campionamento DENSO con punti esatti sugli
  // strike/ingressi (buildPayoffPointsDense) e un'estensione ADATTIVA del range
  // (findBreakevensRobust): se le code del payoff puntano a uno zero fuori range
  // il range si estende finché non è intercettato. Il range include anche la
  // porzione di grafico visibile: un BE mostrato a video non può più sfuggire.
  // Gestiti anche tangenze (curva che tocca lo zero senza attraversarlo) e tratti
  // piatti a zero (ratio spread a credito pari: si segnala il bordo del tratto).
  // GRECHE: i totali Δ/Γ/Vega/Θ in header e le colonne per riga sommavano greche
  // PER UNITÀ mescolando strumenti con moltiplicatori diversi (MES ×5, ES ×50,
  // AZIONI ×100): un numero privo di unità, arbitrariamente grande o piccolo.
  // Ora sono greche di POSIZIONE in $ (q.tà × greca × moltiplicatore): Δ $/pt,
  // Γ $/pt², Vega $/1% IV, Θ $/gg — omogenee e sommabili tra strumenti.
  // MOBILE: font 16px sui campi input/select sotto gli 800px (iOS zooma la
  // pagina intera al focus dei campi < 16px: la causa dei dati "fuor
i schermo"),
  // nessuno scroll orizzontale a livello pagina, prime 3 colonne della tabella
  // opzioni sticky durante lo scorrimento, .table-scroll irrobustito.
  // Nessun cambiamento di storage: STORAGE_KEY resta mastering_v20.
  // v21 — riga opzioni portata in parità con la gamba opzioni del Calcolatore
  // Payoff: aggiunte 
le colonne V. Intr (valore intrinseco), V. Temp (valore
  // temporale = teorico − intrinseco), P. Tocco (probabilità che il
  // sottostante tocchi lo strike prima della scadenza della gamba, stessa
  // formula del Calcolatore), P&L Scad. (P&L della singola riga alla prima
  // scadenza della scheda, metodo calendar: gambe più lunghe al teorico col
  // tempo residuo) e Deb/Cred (premio × q.tà × moltiplicatore). Tutte le
  // colonne e i valori esistenti restano invariati; lo storage non cambia.
  // v20 — metodo "calendar" per le scadenze miste: la curva A SCADENZA (e i
  // totali/POP/BE collegati) è calcolata alla scadenza della gamba opzioni
  // più corta; le gambe con scadenza più lunga sono valutate al teorico
  // Black-76 col tempo residuo a quella data (picco tipico delle calendar
  // senza cambiare la data di analisi). POP e bande sigma usano lo stesso
  // orizzonte della prima scadenza. Moltiplicatore AZIONI corretto a ×100
  // (un'opzione eq. muove 100 azioni), in linea con MES ×5 ed ES ×50.
  // Vol ATM spostata dalla testata superiore all'header Opzioni (affianco al
  // selettore strumento), con stile dedicato coerente al pannello. Aggiunto
  // il modello Black-Scholes con tasso r e dividendo continuo q per le
  // opzioni su AZIONI (nuovo input "Div %" nell'header): teorico, greche,
  // curve Now e valutazione calendar usano BS per AZIONI e Black-76 per
  // MES/ES. Storage v20 con persistenza anche del dividendo.
  // v19 — schede multi-scenario: la scheda "Matrice" (non rimovibile) e le
  // comparazioni clonabili col pulsante "Crea comparazione"; i valori a video
  // (futures, opzioni, riepilogo, greche) sono 
della scheda attiva, il grafico
  // disegna e confronta le curve di TUTTE le schede. Etichetta "Escludi cash",
  // sfondo casella cash verde/rosso, spinner numerici rimossi, badge q.tà
  // rimosso (il totale aperti è già nella riga di intestazione), voce
  // "Realizzato" eliminata.
  // v18 — deviazioni standard verdi (prima azzu
rre come lo spot), box "Dev. std"
  // con logica invertita come il resto del file (spunta = nasconde), header
  // Opzioni selezionabile da menu a tendina (MES / ES / AZIONI) con
  // moltiplicatore dedicato (5 / 50 / 100), scheda opzioni non eliminabile
  // (dormiente se vuota), ROI e voci legate al margine rimosse.
  // v17 — strumenti ES (×50) e X (×100), logica box invertita (spunta = esclusa),
  // colonna M/S (ATM/OTM/ITM + distanza in σ), bande ±1σ/±2σ sul grafico,
  // totali AT NOW / A SCADENZA, POP a 4 decimali, colonna RLZD rimossa
  // (il realizzato va nel box Cash), cash compreso nei totali e nel grafico
  // con box di esclusione per simulazione, toggle BE e linee dev. standard
  // verticali (menu 1°–10° SD vicino al POP).
  // v16 — fix: persistenza riskFree/volAtm, chiusura opzioni da UI, P&L opzioni MTM,
  // scansione BE/POP adattiva al di fuori di spot±45%, perf (niente calcoli morti,
  // redraw throttled), touch pan/pinch, intrinseco a scadenza, autosave, robustezza margini.

  // Futures: X = azioni, q.tà 1 = 1 singola azione (molt. 1, non 100).
  // La coerenza con le opzioni AZIONI (×100) è salvaguardata da MOLTIPLICATORI_OPZ:
  // 1 contratto opzione = 100 azioni, quindi 100 q.tà di futures X = 1 contratto.
  const MOLTIPLICATORI = { NES: 0.5, MES: 5, ES: 50, X: 1 };
  // Commissioni per lato (apertura o chiusura), in $ per contratto/unità.
  // Futures NES/MES/ES: ~1,205 $ per contratto. Opzioni: ~1 $ per contratto.
  // X = azioni: NESSUNA commissione (fee 0).
  const FEE_STOCK_LATO   = 0;     // X (azioni): nessuna fee
ngola azione
  const FEE_OPTION_LATO  = 1.00;  // opzioni MES / ES / AZIONI
  // Retrocompatibilità alias
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
  const STORAGE_KEYS_LEGACY = ['mastering_v19'
, 'mastering_v18', 'mastering_v17', 'mastering_v16', 'mastering_v15', 'mastering_v14', 'mastering_v13', 'mastering_v12', 'mastering_v11'];

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
