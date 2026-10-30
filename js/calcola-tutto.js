// calcola-tutto.js — ricalcolo globale e header di riepilogo
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.

// ============================================================
// CALCOLA TUTTO
// ============================================================
function calcolaTutto() {
  const scheda = schedaAttiva();

  // v26 — Modello transazionale: ricalcola gli stati (APERTA/CHIUSA)
  // di NES e MES in base alla direzione rispetto alla posizione netta.
  // Il campo `stato` resta nel dato per compatibilità salvataggi, ma
  // non è più editabile dall'utente (niente pulsante sulla riga).
  if (typeof ricalcolaStatiSchedaAttiva === 'function') {
    ricalcolaStatiSchedaAttiva();
  }

  const resNES = calcolaColonna(scheda, 'NES');
  const resMES = calcolaColonna(scheda, 'MES');

  renderRigaTotale('NES', resNES);
  renderRigaTotale('MES', resMES);

  // v27 — il riquadro "P&L Opzioni" dell'header è stato rimosso:
  // il totale P&L NOW delle opzioni vive solo nel footer della tabella.
  // Aggiorna greche e P&L di ogni riga opzione (popola anche il footer).
  aggiornaPnlOpzioni();

  // Riepilogo minimale: PL AT NOW e PL A SCADENZA
  // AT NOW  = teorico Black-76 allo spot attuale (profitto se chiudessi ora)
  // A SCADENZA = intrinseco alle scadenze + teorico residuale (calendar)
  // Entrambi includono futures + opzioni + cash
  const spotVal = parseFloat(el('prezzoSpot').value) || 0;
  const pnlNowVal = spotVal > 0 ? pnlCombinatoAt(scheda, spotVal, 'now', resNES, resMES) : NaN;
  const pnlScad = spotVal > 0 ? pnlCombinatoAt(scheda, spotVal, 'expiry', resNES, resMES) : NaN;
  const pnlNowEl = el('pnlNowTot');
  pnlNowEl.textContent = formatEuro(pnlNowVal);
  pnlNowEl.className = 'big-value value ' + (!isFinite(pnlNowVal) ? 'muted' : (pnlNowVal >= 0 ? 'green' : 'red'));
  const pnlScadEl = el('pnlScadenzaTot');
  pnlScadEl.textContent = formatEuro(pnlScad);
  pnlScadEl.className = 'big-value value ' + (!isFinite(pnlScad) ? 'muted' : (pnlScad >= 0 ? 'green' : 'red'));

  // v29 — PmG (Profitto medio giornaliero): esteso a TUTTE le modalità
  // (azioni, futures su indici, futures su commodities). Visibile ogni
  // volta che la Matrice ha almeno un'opzione attiva con scadenza.
  // Riferimento SEMPRE la Matrice (stato.schede[0]): sia i giorni totali
  // (data analisi iniziale → prima scadenza opzioni attive) sia il PL a
  // scadenza di TUTTI i totali combinati (azioni/futures + opzioni + cash),
  // con come tempo di riferimento la scadenza delle opzioni. In qualunque
  // scheda ti trovi il PmG resta quello dell'operazione della Matrice.
  aggiornaPmG();

  // Aggiorna anteprima payoff (tutte le schede), breakeven,
  // delta totale nel riepilogo e legenda colori
  aggiornaPayoffPreview(scheda, resNES, resMES);
  aggiornaLegendaGrafico();

  // Autosave (debounce): ogni modifica viene comunque persistita
  autosalva();
}

// ============================================================
// PmG — PROFITTO MEDIO GIORNALIERO
// ============================================================
// I parametri sono per-scheda (parametri-scheda.js li salva in scheda.par).
// Quando sei in una comparazione gli input della pagina contengono i parametri
// di QUELLA scheda: per la Matrice si legge sempre da matrice.par.
function parMatrice(matrice) {
  return (matrice && matrice.par) ? matrice.par : null;
}

// Data analisi INIZIALE della Matrice (immutabile): è il punto di partenza
// dell'operazione e determina la durata completa per il PmG.
function dataAnalisiInizialeMatrice(matrice) {
  const p = parMatrice(matrice);
  if (p && p.dataAnalisiIniziale) return p.dataAnalisiIniziale;
  if (p && p.dataAnalisi) return p.dataAnalisi;
  return el('dataAnalisi') ? el('dataAnalisi').value : dataOggiIso();
}

// Giorni totali dell'operazione: dalla data analisi INIZIALE della MATRICE
// alla PRIMA scadenza tra le opzioni attive della Matrice.
// Il risultato è la durata COMPLETA originaria (es. 180 gg), a prescindere
// dal tempo trascorso, dalla data attuale e dalla scheda in cui ti trovi.
function giorniTotaliMatrice() {
  const matrice = stato.schede[0];
  if (!matrice || !Array.isArray(matrice.opzioni)) return 0;
  const scadenze = matrice.opzioni
    .filter(o => o && o.attivo !== false && o.scadenza)
    .map(o => new Date(o.scadenza + 'T00:00:00'))
    .filter(d => !isNaN(d.getTime()));
  if (!scadenze.length) return 0;
  const prima = new Date(Math.min(...scadenze));
  const iniziale = new Date(dataAnalisiInizialeMatrice(matrice) + 'T00:00:00');
  return Math.max(0, Math.round((prima - iniziale) / 86400000));
}

// v29 — La Matrice ha almeno un'opzione attiva (non nascosta, non chiusa)
// con una scadenza valida? È la condizione di visibilità del PmG in
// QUALSIASI modalità (azioni, futures indici, futures commodities):
// il PmG si innesca solo quando esiste almeno un'opzione, perché è la
// scadenza delle opzioni a fare da riferimento temporale.
function matriceHaOpzioniAttive() {
  const matrice = stato.schede[0];
  if (!matrice || !Array.isArray(matrice.opzioni)) return false;
  return matrice.opzioni.some(o =>
    o && o.attivo !== false && o.stato !== 'CHIUSA' && o.scadenza
  );
}

// PmG = PL a scadenza della MATRICE
//        / giorni totali dell'operazione della MATRICE.
// Tutto è calcolato sulla Matrice (stato.schede[0]): in qualunque
// scheda ti trovi il valore resta quello dell'operazione della Matrice.
// Il PL a scadenza combina TUTTI i totali della scheda: colonne
// azioni/futures (P&L realizzato + aperto al prezzo medio), opzioni
// (intrinseco alla prima scadenza + teorico residuo per le calendar)
// e cash. Mostra «—» se la Matrice non ha opzioni attive con scadenza.
function aggiornaPmG() {
  const label = el('pmgLabel');
  const val = el('pmgValue');
  if (!label || !val) return;
  
  const visibile = matriceHaOpzioniAttive();
  label.style.display = visibile ? '' : 'none';
  val.style.display = visibile ? '' : 'none';
  if (!visibile) return;

  const matrice = stato.schede[0];
  const giorni = giorniTotaliMatrice();

  let pnlScadMatrice = NaN;
  const parM = parMatrice(matrice);
  
  if (matrice && parM) {
    // FIX: Aggiunti i campi specifici per i futures (commodities e indici)
    // IMPORTANTE: Verifica che 'prezzoFutures', 'moltiplicatore' e 'prezzoMedio' 
    // siano i nomi esatti delle chiavi che usi in parametri-scheda.js
    const CAMPI_SWAP = [
      'prezzoSpot', 'volStorica', 'volAtm', 'riskFree',
      'divYield', 'cash', 'dataAnalisi', 'strumentoOpzioni',
      'prezzoFutures', 'moltiplicatore', 'prezzoMedio'
    ];
    
    const precedenti = {};
    CAMPI_SWAP.forEach(id => {
      const e = el(id);
      if (e) precedenti[id] = e.value;
    });
    
    const cashPrecedente = stato.cash;
    
    try {
      CAMPI_SWAP.forEach(id => {
        const e = el(id);
        if (!e || e === document.activeElement) return;
        
        // Mappatura: 'prezzoSpot' legge dalla chiave 'spot', gli altri usano il proprio nome
        const key = id === 'prezzoSpot' ? 'spot' : id;
        const v = parM[key];
        
        if (v !== undefined && v !== null && v !== '') {
          e.value = v;
        }
      });
      
      // FIX: Fallback su prezzoFutures se prezzoSpot è vuoto (tipico dei futures commodities)
      const spotVal = parseFloat(el('prezzoSpot').value) || parseFloat(el('prezzoFutures').value) || 0;
      stato.cash = parseFloat(parM.cash) || 0;
      
      if (spotVal > 0) {
        const resM_NES = calcolaColonna(matrice, 'NES');
        const resM_MES = calcolaColonna(matrice, 'MES');
        pnlScadMatrice = pnlCombinatoAt(matrice, spotVal, 'expiry', resM_NES, resM_MES);
      }
    } catch (e) {
      console.warn("Errore nel calcolo del PmG della Matrice:", e);
      pnlScadMatrice = NaN;
    } finally {
      // Ripristino dei valori originali nel DOM senza interrompere il focus
      CAMPI_SWAP.forEach(id => {
        const e = el(id);
        if (e && e !== document.activeElement && precedenti[id] !== undefined) {
          e.value = precedenti[id];
        }
      });
      stato.cash = cashPrecedente;
    }
  }

  const pmg = (giorni > 0 && isFinite(pnlScadMatrice)) ? pnlScadMatrice / giorni : NaN;
  val.textContent = isFinite(pmg) ? formatEuro(pmg) + ' /gg' : '—';
  val.className = 'rg-val ' + (!isFinite(pmg) ? 'muted' : (pmg >= 0 ? 'green' : 'red'));
}
const cashPrecedente = stato.cash;
    try {
      CAMPI_SWAP.forEach(id => {
        const e = el(id);
        if (!e || e === document.activeElement) return;
        const v = parM[id === 'prezzoSpot' ? 'spot' : id];
        if (v !== undefined && v !== null && v !== '') e.value = v;
      });
      const spotVal = parseFloat(el('prezzoSpot').value) || 0;
      stato.cash = parseFloat(parM.cash) || 0;
      if (spotVal > 0) {
        const resM_NES = calcolaColonna(matrice, 'NES');
        const resM_MES = calcolaColonna(matrice, 'MES');
        pnlScadMatrice = pnlCombinatoAt(matrice, spotVal, 'expiry', resM_NES, resM_MES);
      }
    } catch (e) {
      pnlScadMatrice = NaN;
    } finally {
      CAMPI_SWAP.forEach(id => {
        const e = el(id);
        if (e && e !== document.activeElement && precedenti[id] !== undefined) e.value = precedenti[id];
      });
      stato.cash = cashPrecedente;
    }
  }

  const pmg = (giorni > 0 && isFinite(pnlScadMatrice)) ? pnlScadMatrice / giorni : NaN;
  val.textContent = isFinite(pmg) ? formatEuro(pmg) + ' /gg' : '—';
  val.className = 'rg-val ' + (!isFinite(pmg) ? 'muted' : (pmg >= 0 ? 'green' : 'red'));
}
