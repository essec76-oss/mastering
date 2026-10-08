// eventi.js — binding degli eventi interfaccia
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.
  // ============================================================
  // EVENTI
  // ============================================================
  el('prezzoSpot').addEventListener('input', () => {
    aggiornaCalcolati('NES');
    aggiornaCalcolati('MES');
    calcolaTutto();
  });
  el('riskFree').addEventListener('input', () => {
    calcolaTutto();
  });
  if (el('volAtm')) el('volAtm').addEventListener('input', () => {
    calcolaTutto();
  });
  if (el('divYield')) el('divYield').addEventListener('input', () => {
    calcolaTutto();
  });
  if (el('cash')) el('cash').addEventListener('input', () => {
    stato.cash = parseFloat(el('cash').value) || 0;
    aggiornaStileCash();
    calcolaTutto();
  });
  if (el('cashEscludi')) el('cashEscludi').addEventListener('change', () => {
    stato.cashEscluso = el('cashEscludi').checked;
    calcolaTutto();
  });
  // v27 — il toggle "Commissioni (solo NES)" è stato rimosso: le fee non
  // entrano più nei calcoli (P&L lordo). Le fee stimate sono mostrate
  // nell'header di colonna e calcolate in render-futures.js.
  if (el('dataAnalisi')) el('dataAnalisi').addEventListener('change', () => {
    // Ricalcola greche, teorico, GG residui e POP rispetto alla nuova data
    calcolaTutto();
  });

  // Toggle curve del grafico (v25): 4 checkbox indipendenti (corrente/precedente).
  // Corrente e precedente non richiedono ricalcolo completo: basta ridisegnare.
  if (el('showExpiryCorrente'))   el('showExpiryCorrente').addEventListener('change',   () => redrawChartFromView());
  if (el('showNowCorrente'))      el('showNowCorrente').addEventListener('change',      () => redrawChartFromView());
  if (el('showExpiryPrecedente')) el('showExpiryPrecedente').addEventListener('change', () => redrawChartFromView());
  if (el('showNowPrecedente'))    el('showNowPrecedente').addEventListener('change',    () => redrawChartFromView());
  if (el('showBE'))     el('showBE').addEventListener('change', () => redrawChartFromView());
  if (el('showSigma'))  el('showSigma').addEventListener('change', () => redrawChartFromView());
  if (el('nSD'))        el('nSD').addEventListener('change', () => redrawChartFromView());

  el('tipoNES').addEventListener('change', e => {
    schedaAttiva().tipoNES = e.target.value;
    renderMovimenti('NES'); calcolaTutto();
  });
  el('tipoMES').addEventListener('change', e => {
    schedaAttiva().tipoMES = e.target.value;
    renderMovimenti('MES'); calcolaTutto();
  });

  document.querySelectorAll('.btn-add[data-col]').forEach(btn => {
    btn.addEventListener('click', () => {
      const col = btn.dataset.col;
      const spot = parseFloat(el('prezzoSpot').value) || 0;
      schedaAttiva()[col].push({ direzione: 'LONG', quantita: 1, prezzoPulito: spot, attivo: true });
      renderMovimenti(col); calcolaTutto();
    });
  });

  el('btnAddOpzione').addEventListener('click', () => {
    // Scadenza di default: data analisi + 30 giorni
    const defaultScad = dataAnalisiDate();
    defaultScad.setDate(defaultScad.getDate() + 30);
    const yyyy = defaultScad.getFullYear();
    const mm = String(defaultScad.getMonth() + 1).padStart(2, '0');
    const dd = String(defaultScad.getDate()).padStart(2, '0');
    schedaAttiva().opzioni.push({
      attivo: true, strumento: strumentoOpzSelezionato(),
      pos: 'SELL', tipo: 'PUT', qta: 1, assgn: false,
      strike: 0, rlzd: '', premio: 0, vol: 15, scadenza: `${yyyy}-${mm}-${dd}`,
      stato: 'APERTA'
    });
    renderOpzioni(); calcolaTutto();
  });

  el('strumentoOpzioni').addEventListener('change', () => {
    // Il menu a tendina dell'header cambia lo strumento della scheda
    // (MES / ES / AZIONI): le righe degli altri strumenti restano dormienti
    schedaAttiva().strumentoOpzioni = el('strumentoOpzioni').value;
    renderOpzioni();
    calcolaTutto();
  });
  el('btnCreaComp').addEventListener('click', creaComparazione);
  el('btnReset').addEventListener('click', reset);

  // Strategie salvate: salvataggio multiplo con nome + export/import file
  if (el('btnSalvaCome')) el('btnSalvaCome').addEventListener('click', () => salvaConNome(el('nomeStrategia').value));

  // Nome strategia forzato in MAIUSCOLO mentre si digita (cursore preservato)
  if (el('nomeStrategia')) el('nomeStrategia').addEventListener('input', e => {
    const inp = e.target;
    const pos = inp.selectionStart;
    inp.value = inp.value.toUpperCase();
    inp.setSelectionRange(pos, pos);
  });

  if (el('btnCaricaSalvato')) el('btnCaricaSalvato').addEventListener('click', () => {
    const v = el('listaSalvate').value;
    if (v) caricaSalvato(v);
  });
  if (el('btnEliminaSalvato')) el('btnEliminaSalvato').addEventListener('click', () => {
    const v = el('listaSalvate').value;
    if (v) eliminaSalvato(v);
  });
  if (el('btnEsporta')) el('btnEsporta').addEventListener('click', esportaFile);
  if (el('btnImporta')) el('btnImporta').addEventListener('click', () => el('fileImporta').click());
  if (el('fileImporta')) el('fileImporta').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (f) importaDaInputFile(f);
    e.target.value = '';
  });
  renderListaSalvate();
