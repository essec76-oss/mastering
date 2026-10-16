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

  // ============================================================
  // SELETTORE MODALITÀ GLOBALE (menu padre)
  // ============================================================
  // Azioni (default) → colonne e opzioni bloccate su AZIONI (molt. 100)
  // Futures su indici → NES/MES/ES sbloccati
  // Futures su commodities → moltiplicatori TBD (per ora bloccato analogo)
  function applicaModalita(mod) {
    stato.modalita = mod || MODALITA_DEFAULT;
    const selNES = el('tipoNES');
    const selMES = el('tipoMES');
    const selOpz = el('strumentoOpzioni');
    const sub = el('subtitle');
    const scheda = schedaAttiva();

    if (stato.modalita === 'azioni') {
      // Unico asset: Azioni. Select bloccati su X / AZIONI.
      if (selNES) { selNES.value = 'X'; selNES.disabled = true; }
      if (selMES) { selMES.value = 'X'; selMES.disabled = true; }
      if (selOpz) { selOpz.value = 'AZIONI'; selOpz.disabled = true; }
      scheda.tipoNES = 'X';
      scheda.tipoMES = 'X';
      scheda.strumentoOpzioni = 'AZIONI';
      // Propaga a tutte le schede (Matrice + comparazioni)
      stato.schede.forEach(s => {
        s.tipoNES = 'X';
        s.tipoMES = 'X';
        s.strumentoOpzioni = 'AZIONI';
      });
      if (sub) sub.textContent = 'Azioni — simulatore azioni + opzioni su azioni — metodo prezzo medio (IBKR)';
    } else if (stato.modalita === 'futures-indici') {
      // Futures su indici: NES / MES / ES sbloccati
      if (selNES) {
        if (selNES.value === 'X' || selNES.value === '-') selNES.value = 'NES';
        selNES.disabled = false;
      }
      if (selMES) {
        if (selMES.value === 'X' || selMES.value === '-') selMES.value = 'MES';
        selMES.disabled = false;
      }
      if (selOpz) {
        if (selOpz.value === 'AZIONI') selOpz.value = 'MES';
        selOpz.disabled = false;
      }
      scheda.tipoNES = selNES ? selNES.value : 'NES';
      scheda.tipoMES = selMES ? selMES.value : 'MES';
      scheda.strumentoOpzioni = selOpz ? selOpz.value : 'MES';
      if (sub) sub.textContent = 'NES / MES / ES — Nano, Micro & E-mini futures ES500 — metodo prezzo medio (IBKR)';
    } else if (stato.modalita === 'futures-commodities') {
      // Commodities: moltiplicatori da definire. Per ora blocco generico.
      if (selNES) { selNES.value = 'X'; selNES.disabled = true; }
      if (selMES) { selMES.value = 'X'; selMES.disabled = true; }
      if (selOpz) { selOpz.value = 'AZIONI'; selOpz.disabled = true; }
      scheda.tipoNES = 'X';
      scheda.tipoMES = 'X';
      scheda.strumentoOpzioni = 'AZIONI';
      if (sub) sub.textContent = 'Futures su commodities — moltiplicatori da definire — metodo prezzo medio (IBKR)';
    }

    renderMovimenti('NES');
    renderMovimenti('MES');
    renderOpzioni();
    calcolaTutto();
  }

  if (el('modalitaGlobale')) {
    el('modalitaGlobale').addEventListener('change', e => {
      applicaModalita(e.target.value);
    });
    // Applica lo stato iniziale (Azioni di default)
    applicaModalita(el('modalitaGlobale').value || MODALITA_DEFAULT);
  }

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
