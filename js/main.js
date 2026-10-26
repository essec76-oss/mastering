// main.js — avvio: valori di default e primo render
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.
  // ============================================================
  // DELTA — DUE MONDI DISTINTI (futures / azioni)
  // ============================================================
  // Mondo FUTURES: delta in unità MES (1 MES = 1.0; 1 ES = 10; 1 NES = 0.1).
  // Mondo AZIONI: convenzione TWS (100 azioni = 1.00; opzione delta 0.50 = 0.50).
  // v27 — i display separati "Delta netto" / "Delta azioni" accanto al grafico
  // sono stati rimossi: il delta totale è mostrato nel riepilogo (#deltaTot,
  // con sensibilità per punto in #deltaSens). In grafico.js, deltaNettoTotale()
  // è l'unica fonte di verità (mondo AZIONI: qta/100 + delta opzioni = TWS).
  // Il wrapper di aggiornaPnlOpzioni che riscriveva #greeksDelta è stato
  // eliminato: i totali vivono solo nel footer della tabella opzioni.

  // Versione visibile (verifica deploy): titolo del tab del browser
  function _appVersion() { return 'v24.3'; }
  document.title = 'Mastering — ' + _appVersion();

  // ============================================================
  // AVVIO
  // ============================================================
  // Data analisi di default: oggi (sovrascritta dal salvataggio se presente)
  el('dataAnalisi').value = dataOggiIso();

  const caricato = carica();
  if (!caricato) {
    const spotIniziale = parseFloat(el('prezzoSpot').value) || 7700;
    stato.schede[0].NES.push({ direzione: 'LONG', quantita: 1, prezzoPulito: spotIniziale, attivo: true, stato: 'APERTA' });
    stato.schede[0].MES.push({ direzione: 'LONG', quantita: 1, prezzoPulito: spotIniziale, attivo: true, stato: 'APERTA' });
  }

  applicaModalita(stato.modalita || MODALITA_DEFAULT);
  if (el('modalitaGlobale')) el('modalitaGlobale').value = stato.modalita || MODALITA_DEFAULT;
  renderTabs();
  renderScheda();

  // Fix: garanzia che la modale di scelta strategie non sia MAI visibile
  // all'apertura della pagina (si apre solo su click di "Carica da cloud"
  // o "Elimina", tramite apriModaleStrategie in eventi.js).
  const _ovStartup = el('modalStrategieOverlay');
  if (_ovStartup) _ovStartup.style.display = 'none';

  // Step 1 Supabase: se URL/chiave sono configurati, verifica la connessione
  if (typeof testaConnessioneSupabase === 'function') {
    testaConnessioneSupabase();
  }
