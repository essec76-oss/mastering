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
  if (el('dataAnalisi')) el('dataAnalisi').addEventListener('change', () => {
    calcolaTutto();
  });
  if (el('showExpiryCorrente'))   el('showExpiryCorrente').addEventListener('change',   () => redrawChartFromView());
  if (el('showNowCorrente'))      el('showNowCorrente').addEventListener('change',      () => redrawChartFromView());
  if (el('showExpiryPrecedente')) el('showExpiryPrecedente').addEventListener('change', () => redrawChartFromView());
  if (el('showNowPrecedente'))    el('showNowPrecedente').addEventListener('change',    () => redrawChartFromView());
  if (el('showBE'))     el('showBE').addEventListener('change', () => redrawChartFromView());
  if (el('showSigma'))  el('showSigma').addEventListener('change', () => redrawChartFromView());
  if (el('nSD'))        el('nSD').addEventListener('change', () => redrawChartFromView());

  // ============================================================
  // NOMI COMMODITIES (solo per il sottotitolo)
  // ============================================================
  const NOMI_COMMODITY = {
    ZW: 'Wheat futures', NG: 'Natural Gas futures', CL: 'Crude Oil futures',
    GC: 'Gold futures', SI: 'Silver futures', HG: 'Copper futures',
    ZC: 'Corn futures', ZS: 'Soybean futures', ZL: 'Soybean Oil futures',
    ZM: 'Soybean Meal futures', KC: 'Coffee futures', SB: 'Sugar futures',
    CC: 'Cocoa futures', CT: 'Cotton futures', LE: 'Live Cattle futures',
    HE: 'Lean Hogs futures', ES: 'E-mini S&P 500', NQ: 'E-mini Nasdaq',
    YM: 'E-mini Dow'
  };

  function descriviCommodity(scheda) {
    const isCustom = scheda.tipoNES === 'custom' || scheda.tipoMES === 'custom';
    let ticker, molt;
    if (isCustom) {
      ticker = (scheda.tickerCommodity || '').toUpperCase();
      const v = parseFloat(scheda.moltiplicatoreCommodity);
      molt = (isFinite(v) && v > 0) ? v : (MOLTIPLICATORI[ticker] || MOLTIPLICATORI.ZW || 50);
    } else {
      ticker = scheda.tipoNES || scheda.tipoMES || 'ZW';
      molt = MOLTIPLICATORI[ticker] || MOLTIPLICATORI.ZW || 50;
    }
    const nome = NOMI_COMMODITY[ticker] || (ticker ? ticker + ' futures' : 'Commodity');
    return ticker + ' — ' + nome + ' (×' + molt + ') — metodo prezzo medio (IBKR)';
  }

  function aggiornaCampiCommodity(col) {
    const scheda = schedaAttiva();
    const isCustom = stato.modalita === 'futures-commodities' && scheda['tipo' + col] === 'custom';
    const tInp = el('ticker' + col);
    const mInp = el('moltiplicatore' + col);
    if (tInp) {
      tInp.style.display = isCustom ? '' : 'none';
      if (isCustom) tInp.value = scheda.tickerCommodity || '';
    }
    if (mInp) {
      mInp.style.display = isCustom ? '' : 'none';
      if (isCustom) mInp.value = (scheda.moltiplicatoreCommodity !== null && scheda.moltiplicatoreCommodity !== undefined)
        ? scheda.moltiplicatoreCommodity
        : (MOLTIPLICATORI[scheda.tickerCommodity] || MOLTIPLICATORI.ZW || 50);
    }
  }

  el('tipoNES').addEventListener('change', e => {
    schedaAttiva().tipoNES = e.target.value;
    aggiornaCampiCommodity('NES');
    if (stato.modalita === 'futures-commodities') {
      const sub = el('subtitle');
      if (sub) sub.textContent = descriviCommodity(schedaAttiva());
    }
    renderMovimenti('NES'); calcolaTutto();
  });
  el('tipoMES').addEventListener('change', e => {
    schedaAttiva().tipoMES = e.target.value;
    aggiornaCampiCommodity('MES');
    if (stato.modalita === 'futures-commodities') {
      const sub = el('subtitle');
      if (sub) sub.textContent = descriviCommodity(schedaAttiva());
    }
    renderMovimenti('MES'); calcolaTutto();
  });

  // Ticker / moltiplicatore personalizzati (visibili solo in commodities+custom)
  ['NES','MES'].forEach(col => {
    const tInp = el('ticker' + col);
    const mInp = el('moltiplicatore' + col);
    if (tInp) tInp.addEventListener('input', () => {
      if (stato.modalita !== 'futures-commodities') return;
      schedaAttiva().tickerCommodity = tInp.value.trim().toUpperCase();
      const sub = el('subtitle');
      if (sub) sub.textContent = descriviCommodity(schedaAttiva());
      renderMovimenti(col); calcolaTutto();
    });
    if (mInp) mInp.addEventListener('input', () => {
      if (stato.modalita !== 'futures-commodities') return;
      const v = parseFloat(mInp.value);
      schedaAttiva().moltiplicatoreCommodity = (isFinite(v) && v > 0) ? v : null;
      const sub = el('subtitle');
      if (sub) sub.textContent = descriviCommodity(schedaAttiva());
      renderMovimenti(col); calcolaTutto();
    });
  });

  // ============================================================
  // SELETTORE MODALITÀ GLOBALE (menu padre)
  // ============================================================
  function _riempiSelectTipo(sel, opzioni, valore) {
    if (!sel) return;
    sel.innerHTML = '';
    opzioni.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      sel.appendChild(opt);
    });
    const esiste = opzioni.some(o => o.value === valore);
    sel.value = esiste ? valore : (opzioni[0] ? opzioni[0].value : '');
  }

  function applicaModalita(mod) {
    stato.modalita = mod || MODALITA_DEFAULT;
    const selNES = el('tipoNES');
    const selMES = el('tipoMES');
    const selOpz = el('strumentoOpzioni');
    const sub = el('subtitle');
    const scheda = schedaAttiva();

    if (stato.modalita === 'azioni') {
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
      const optsIndici = [
        { value: '-', label: '-' },
        { value: 'NES', label: 'NES' },
        { value: 'MES', label: 'MES' },
        { value: 'ES', label: 'ES' }
      ];
      const curNES = (scheda.tipoNES === 'X' || scheda.tipoNES === 'ZW' || scheda.tipoNES === 'custom') ? 'NES' : (scheda.tipoNES || 'NES');
      const curMES = (scheda.tipoMES === 'X' || scheda.tipoMES === 'ZW' || scheda.tipoMES === 'custom') ? 'MES' : (scheda.tipoMES || 'MES');
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
      // v29 — Commodities libere: l'utente può scegliere ZW oppure "Personalizzato"
      const optsComm = [
        { value: '-', label: '-' },
        { value: 'ZW', label: 'ZW' },
        { value: 'custom', label: 'Personalizzato' }
      ];
      const curNES = (scheda.tipoNES && scheda.tipoNES !== 'X') ? scheda.tipoNES : 'ZW';
      const curMES = (scheda.tipoMES && scheda.tipoMES !== 'X') ? scheda.tipoMES : 'ZW';
      _riempiSelectTipo(selNES, optsComm, curNES);
      _riempiSelectTipo(selMES, optsComm, curMES);
      if (selNES) selNES.disabled = false;
      if (selMES) selMES.disabled = false;
      if (selOpz) {
        selOpz.innerHTML = '<option value="ZW">ZW</option><option value="custom">Personalizzato</option>';
        selOpz.value = scheda.strumentoOpzioni === 'custom' ? 'custom' : 'ZW';
        selOpz.disabled = false;
      }
      scheda.tipoNES = selNES ? selNES.value : 'ZW';
      scheda.tipoMES = selMES ? selMES.value : 'ZW';
      scheda.strumentoOpzioni = selOpz ? selOpz.value : 'ZW';
      if (sub) sub.textContent = descriviCommodity(scheda);
    }

    aggiornaCampiCommodity('NES');
    aggiornaCampiCommodity('MES');
    renderMovimenti('NES');
    renderMovimenti('MES');
    renderOpzioni();
    calcolaTutto();
  }

  if (el('modalitaGlobale')) {
    el('modalitaGlobale').addEventListener('change', e => {
      applicaModalita(e.target.value);
    });
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
    schedaAttiva().strumentoOpzioni = el('strumentoOpzioni').value;
    if (stato.modalita === 'futures-commodities') {
      const sub = el('subtitle');
      if (sub) sub.textContent = descriviCommodity(schedaAttiva());
    }
    renderOpzioni();
    calcolaTutto();
  });
  el('btnCreaComp').addEventListener('click', creaComparazione);
  el('btnReset').addEventListener('click', reset);
  if (el('btnSalvaCome')) el('btnSalvaCome').addEventListener('click', () => salvaConNome(el('nomeStrategia').value));
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
