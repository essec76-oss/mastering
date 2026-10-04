// main.js — avvio: valori di default e primo render
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.
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
