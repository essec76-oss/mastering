// calcola-tutto.js — ricalcolo globale e header di riepilogo
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.

// ============================================================
// CALCOLA TUTTO
// ============================================================
function calcolaTutto() {
  const scheda = schedaAttiva();

  // v26 — Modello transazionale: ricalcola gli stati (APERTA/CHIUSA)
  if (typeof ricalcolaStatiSchedaAttiva === 'function') {
    ricalcolaStatiSchedaAttiva();
  }

  const resNES = calcolaColonna(scheda, 'NES');
  const resMES = calcolaColonna(scheda, 'MES');

  renderRigaTotale('NES', resNES);
  renderRigaTotale('MES', resMES);

  // Aggiorna greche e P&L di ogni riga opzione
  aggiornaPnlOpzioni();

  // PL AT NOW e PL A SCADENZA
  const spotVal = parseFloat(el('prezzoSpot').value) || 0;
  const pnlNowVal = spotVal > 0 ? pnlCombinatoAt(scheda, spotVal, 'now', resNES, resMES) : NaN;
  const pnlScad = spotVal > 0 ? pnlCombinatoAt(scheda, spotVal, 'expiry', resNES, resMES) : NaN;

  const pnlNowEl = el('pnlNowTot');
  pnlNowEl.textContent = formatEuro(pnlNowVal);
  pnlNowEl.className = 'rg-val big ' + (!isFinite(pnlNowVal) ? 'muted' : (pnlNowVal >= 0 ? 'green' : 'red'));

  const pnlScadEl = el('pnlScadenzaTot');
  pnlScadEl.textContent = formatEuro(pnlScad);
  pnlScadEl.className = 'rg-val big ' + (!isFinite(pnlScad) ? 'muted' : (pnlScad >= 0 ? 'green' : 'red'));

  // PmG
  aggiornaPmG();

  // ROI (dopo che pnlScad esiste)
  aggiornaROI(pnlScad);

  // Grafico e autosave
  aggiornaPayoffPreview(scheda, resNES, resMES);
  aggiornaLegendaGrafico();
  autosalva();
}

// ============================================================
// PmG — PROFITTO MEDIO GIORNALIERO
// ============================================================
function parMatrice(matrice) {
  return (matrice && matrice.par) ? matrice.par : null;
}

function dataAnalisiInizialeMatrice(matrice) {
  const p = parMatrice(matrice);
  if (p && p.dataAnalisiIniziale) return p.dataAnalisiIniziale;
  if (p && p.dataAnalisi) return p.dataAnalisi;
  return el('dataAnalisi') ? el('dataAnalisi').value : dataOggiIso();
}

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

function matriceHaOpzioniAttive() {
  const matrice = stato.schede[0];
  if (!matrice || !Array.isArray(matrice.opzioni)) return false;
  return matrice.opzioni.some(o =>
    o && o.attivo !== false && o.stato !== 'CHIUSA' && o.scadenza
  );
}

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
    const CAMPI_SWAP = ['prezzoSpot', 'volStorica', 'volAtm', 'riskFree',
                        'divYield', 'cash', 'dataAnalisi', 'strumentoOpzioni'];
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

// ============================================================
// ROI = (PL a scadenza / Margine) × 100
// ============================================================
function aggiornaROI(pnlScad) {
  const input = el('margineInput');
  const out = el('roiValue');
  if (!input || !out) return;

  const margine = parseFloat(input.value);
  if (!isFinite(margine) || margine <= 0 || !isFinite(pnlScad)) {
    out.textContent = '—';
    out.className = 'rg-val muted';
    return;
  }

  const roi = (pnlScad / margine) * 100;
  out.textContent = (roi >= 0 ? '+' : '') + roi.toFixed(1) + ' %';
  out.className = 'rg-val ' + (roi >= 0 ? 'green' : 'red');
}
