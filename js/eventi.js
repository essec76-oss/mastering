// eventi.js — binding degli eventi interfaccia
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.
// v27 — P&L lordo, mappa MOLTIPLICATORI_COMMODITIES, toggle visibilità colonne futures.

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
  // Futures su indici → NES/MES/ES sbloccati (scelta libera)
  // Futures su commodities → ticker libero, opzioni visibili, futures nascosti
  function _riempiSelectTipo(sel, opzioni, valore) {
    if (!sel) return;
    sel.innerHTML = '';
    opzioni.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      sel.appendChild(opt);
    });
    // Imposta valore se presente tra le opzioni, altrimenti il primo
    const esiste = opzioni.some(o => o.value === valore);
    sel.value = esiste ? valore : (opzioni[0] ? opzioni[0].value : '');
  }

  // --- Commodities: ticker e moltiplicatore liberi (caselle accanto al menu padre) ---
  // Ticker riservati: non si possono usare perché sovrascriverebbero i moltiplicatori
  // di indici/azioni.
  const TICKER_RISERVATI = ['-', 'NES', 'MES', 'ES', 'X', 'AZIONI'];
  function _tickerValido(t) {
    return typeof t === 'string' && /^[A-Z0-9]{1,8}$/.test(t) && TICKER_RISERVATI.indexOf(t) === -1;
  }
  // Registra il moltiplicatore del ticker corrente nelle tabelle usate dai calcoli
  function _registraMoltCommodity() {
    if (!_tickerValido(stato.ticker)) return;
    const m = stato.molt > 0 ? stato.molt : 0;
    MOLTIPLICATORI[stato.ticker] = m;
    MOLTIPLICATORI_OPZ[stato.ticker] = m;
  }

  function applicaModalita(mod) {
    stato.modalita = mod || MODALITA_DEFAULT;
    const selNES = el('tipoNES');
    const selMES = el('tipoMES');
    const selOpz = el('strumentoOpzioni');
    const sub = el('subtitle');
    const scheda = schedaAttiva();
    // Caselle ticker + moltiplicatore: visibili solo in modalità commodities
    const wrapTk = el('tickerWrap');
    if (wrapTk) wrapTk.style.display = (stato.modalita === 'futures-commodities') ? 'inline-block' : 'none';

    if (stato.modalita === 'azioni') {
      // Unico asset: Azioni. Select bloccati su X / AZIONI.
      _riempiSelectTipo(selNES, [{ value: 'X', label: 'AZIONI' }], 'X');
      _riempiSelectTipo(selMES, [{ value: 'X', label: 'AZIONI' }], 'X');
      if (selNES) selNES.disabled = true;
      if (selMES) selMES.disabled = true;
      if (selOpz) {
        selOpz.innerHTML = '<option value="AZIONI">AZIONI</option>';
        selOpz.value = 'AZIONI';
        selOpz.disabled = true;
      }
      scheda.tipoNES = 'X';
      scheda.tipoMES = 'X';
      scheda.strumentoOpzioni = 'AZIONI';
      stato.schede.forEach(s => {
        s.tipoNES = 'X';
        s.tipoMES = 'X';
        s.strumentoOpzioni = 'AZIONI';
      });
      if (sub) sub.textContent = 'Azioni — simulatore azioni + opzioni su azioni — metodo prezzo medio (IBKR)';

    } else if (stato.modalita === 'futures-indici') {
      // Futures su indici: NES / MES / ES — sbloccati, scelta libera
      const optsIndici = [
        { value: '-', label: '-' },
        { value: 'NES', label: 'NES' },
        { value: 'MES', label: 'MES' },
        { value: 'ES', label: 'ES' }
      ];
      const curNES = (scheda.tipoNES === 'X' || scheda.tipoNES === 'ZW') ? 'NES' : (scheda.tipoNES || 'NES');
      const curMES = (scheda.tipoMES === 'X' || scheda.tipoMES === 'ZW') ? 'MES' : (scheda.tipoMES || 'MES');
      _riempiSelectTipo(selNES, optsIndici, curNES);
      _riempiSelectTipo(selMES, optsIndici, curMES);
      if (selNES) selNES.disabled = false;
      if (selMES) selMES.disabled = false;
      if (selOpz) {
        selOpz.innerHTML = '<option value="MES">MES</option><option value="ES">ES</option>';
        const curOpz = (scheda.strumentoOpzioni === 'AZIONI') ? 'MES' : (scheda.strumentoOpzioni || 'MES');
        selOpz.value = (curOpz === 'ES') ? 'ES' : 'MES';
        selOpz.disabled = false;
      }
      scheda.tipoNES = selNES ? selNES.value : 'NES';
      scheda.tipoMES = selMES ? selMES.value : 'MES';
      scheda.strumentoOpzioni = selOpz ? selOpz.value : 'MES';
      if (sub) sub.textContent = 'NES / MES / ES — Nano, Micro & E-mini futures ES500 — metodo prezzo medio (IBKR)';

    } else if (stato.modalita === 'futures-commodities') {
      // Commodities: il ticker scritto nella casella in alto (es. ZW) comanda
      // menu delle colonne e menu opzioni: sotto non va più indicato.
      if (!_tickerValido(stato.ticker)) stato.ticker = 'ZW';
      // Se il ticker è nella mappa pre-registrata, aggiorna il moltiplicatore
      if (MOLTIPLICATORI_COMMODITIES[stato.ticker] !== undefined) {
        stato.molt = MOLTIPLICATORI_COMMODITIES[stato.ticker];
      }
      if (!(stato.molt > 0) && stato.ticker === 'ZW') stato.molt = 50;
      _registraMoltCommodity();
      const tk = stato.ticker;
      const inTk = el('tickerCommodity');
      const inMt = el('moltiplicatoreCommodity');
      if (inTk) inTk.value = tk;
      if (inMt) inMt.value = stato.molt > 0 ? stato.molt : '';
      stato.schede.forEach(s => {
        s.tipoNES = (s.tipoNES === '-') ? '-' : tk;
        s.tipoMES = (s.tipoMES === '-') ? '-' : tk;
        s.strumentoOpzioni = tk;
      });
      const optsComm = [
        { value: '-', label: '-' },
        { value: tk, label: tk }
      ];
      _riempiSelectTipo(selNES, optsComm, scheda.tipoNES);
      _riempiSelectTipo(selMES, optsComm, scheda.tipoMES);
      if (selNES) selNES.disabled = false;
      if (selMES) selMES.disabled = false;
      // Menu opzioni: bloccato sul ticker
      if (selOpz) {
        selOpz.innerHTML = '<option value="' + tk + '">' + tk + '</option>';
        selOpz.value = tk;
        selOpz.disabled = true;
      }
      if (sub) sub.textContent = tk + ' — futures su commodity (×' + (stato.molt > 0 ? stato.molt : '?') + ') — metodo prezzo medio (IBKR)';

      // Mostra il toggle "Futures" e nascondi di default le colonne.
      // In modalità commodities l'utente vuole vedere di default le opzioni
      // (che occupano la parte più interessante del foglio).
      const toggleWrapC = el('columnsToggleWrap');
      const columnsWrapC = el('columnsWrap');
      if (toggleWrapC) toggleWrapC.style.display = 'block';
      if (columnsWrapC) columnsWrapC.style.display = 'none';
      const btnTkC = el('btnToggleFutures');
      const lblTkC = el('btnToggleFuturesLabel');
      const icoTkC = el('btnToggleFuturesIcon');
      if (btnTkC) btnTkC.classList.remove('open');
      if (lblTkC) lblTkC.textContent = 'Mostra Futures';
      if (icoTkC) icoTkC.textContent = '▼';
    }

    // In modalità NON-commodities, nascondi il toggle e mostra sempre le colonne.
    if (stato.modalita !== 'futures-commodities') {
      const toggleWrapN = el('columnsToggleWrap');
      const columnsWrapN = el('columnsWrap');
      if (toggleWrapN) toggleWrapN.style.display = 'none';
      if (columnsWrapN) columnsWrapN.style.display = 'grid';
      const btnTkN = el('btnToggleFutures');
      if (btnTkN) btnTkN.classList.remove('open');
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

  // Casella ticker (commodities): a fine digitazione le righe opzioni del vecchio
  // ticker passano al nuovo, poi si ricostruiscono menu e calcoli.
  // Inoltre, se il ticker è nella mappa pre-registrata, aggiorna il moltiplicatore.
  if (el('tickerCommodity')) el('tickerCommodity').addEventListener('change', () => {
    const inTk = el('tickerCommodity');
    const nuovo = inTk.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!_tickerValido(nuovo)) {
      inTk.value = stato.ticker;
      mostraStatus('Ticker non valido o riservato (NES, MES, ES, X)', true);
      return;
    }
    const vecchio = stato.ticker;
    if (nuovo !== vecchio) {
      stato.ticker = nuovo;
      stato.schede.forEach(s => {
        (s.opzioni || []).forEach(o => { if (o.strumento === vecchio) o.strumento = nuovo; });
      });
    }
    // Se il nuovo ticker è nella mappa pre-registrata, aggiorna il moltiplicatore
    if (MOLTIPLICATORI_COMMODITIES[nuovo] !== undefined) {
      stato.molt = MOLTIPLICATORI_COMMODITIES[nuovo];
      const inMt = el('moltiplicatoreCommodity');
      if (inMt) inMt.value = stato.molt;
    }
    applicaModalita('futures-commodities');
  });

  // Suggerimento: aggiorna il placeholder del campo moltiplicatore mentre
  // l'utente digita il ticker (mostra il valore consigliato dalla mappa).
  if (el('tickerCommodity')) el('tickerCommodity').addEventListener('input', () => {
    const inTk = el('tickerCommodity');
    const inMt = el('moltiplicatoreCommodity');
    if (!inTk || !inMt) return;
    const tk = inTk.value.trim().toUpperCase();
    const consigliato = MOLTIPLICATORI_COMMODITIES[tk];
    if (consigliato !== undefined) {
      inMt.placeholder = 'consigliato: ' + consigliato;
    } else {
      inMt.placeholder = '50';
    }
  });

  // Casella moltiplicatore (es. 50): aggiorna subito P&L e opzioni
  if (el('moltiplicatoreCommodity')) el('moltiplicatoreCommodity').addEventListener('input', () => {
    const v = parseFloat(el('moltiplicatoreCommodity').value);
    stato.molt = v > 0 ? v : 0;
    _registraMoltCommodity();
    const sub = el('subtitle');
    if (sub) sub.textContent = stato.ticker + ' — futures su commodity (×' + (stato.molt > 0 ? stato.molt : '?') + ') — metodo prezzo medio (IBKR)';
    renderMovimenti('NES');
    renderMovimenti('MES');
    renderOpzioni();
    calcolaTutto();
  });

  // Toggle visibilità colonne futures (modalità commodities)
  if (el('btnToggleFutures')) el('btnToggleFutures').addEventListener('click', () => {
    const columnsWrap = el('columnsWrap');
    const btnTk = el('btnToggleFutures');
    const lblTk = el('btnToggleFuturesLabel');
    const icoTk = el('btnToggleFuturesIcon');
    if (!columnsWrap) return;
    const isHidden = columnsWrap.style.display === 'none';
    if (isHidden) {
      columnsWrap.style.display = 'grid';
      if (btnTk) btnTk.classList.add('open');
      if (lblTk) lblTk.textContent = 'Nascondi Futures';
      if (icoTk) icoTk.textContent = '▲';
    } else {
      columnsWrap.style.display = 'none';
      if (btnTk) btnTk.classList.remove('open');
      if (lblTk) lblTk.textContent = 'Mostra Futures';
      if (icoTk) icoTk.textContent = '▼';
    }
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
