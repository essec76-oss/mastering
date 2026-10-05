// config.js — costanti, moltiplicatori, stato iniziale e helper DOM
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.

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
  // Commissioni per lato (apertura o chiusura), in $ per contratto/unità.
  // X = azioni (molt. 100): ~1 $ per ordine. Opzioni: ~1 $ per contratto.
  const FEE_FUTURES_LATO = 1.205; // NES / MES / ES
  const FEE_STOCK_LATO   = 1.00;  // X (azioni)
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
