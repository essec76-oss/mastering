// main.js — avvio: valori di default e primo render
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.
  // ============================================================
  // OVERLAY DELTA — DUE MONDI DISTINTI (futures / azioni)
  // ============================================================
  // Mondo FUTURES: delta in unità MES (1 MES = 1.0; 1 ES = 10; 1 NES = 0.1;
  //   opzioni MES/ES contribuiscono col proprio delta × moltiplicatore/5).
  // Mondo AZIONI: convenzione TWS (100 azioni = 1.00; 50 azioni = 0.50;
  //   1 contratto di opzione = 100 azioni, quindi un opzione con delta 0.50
  //   conta 0.50). Mai sommato al delta futures: metriche diverse.
  // Nota CI: gli id del display dinamico sono letti con
  // document.getElementById (creati via innerHTML nel wrapper, non in
  // index.html): el() è riservato agli id statici tracciati dal lint.

  // Versione visibile (verifica deploy): titolo del tab del browser
  function _appVersion() { return 'v24.1'; }
  document.title = 'Mastering — ' + _appVersion();

  // Etichetta leggibile del tipo colonna: X → AZIONI, - → nome colonna
  function _tipoLabel(tipo, col) {
    if (tipo === 'X') return 'AZIONI';
    if (!tipo || tipo === '-') return col;
    return tipo;
  }

  // Riepilogo: le etichette NES/MES riflettono il tipo impostato nella
  // colonna (es. colonna NES impostata su AZIONI → "AZIONI", non "NES")
  function _aggiornaLabelsRiepilogo() {
    const scheda = schedaAttiva();
    if (!scheda) return;
    const set = (id, prefix) => {
      const v = el(id);
      const lbl = v && v.previousElementSibling;
      if (lbl) lbl.textContent = prefix;
    };
    set('rpmNES', 'Prezzo medio carico ' + _tipoLabel(scheda.tipoNES, 'NES'));
    set('rpnlNES', 'P&L ' + _tipoLabel(scheda.tipoNES, 'NES'));
    set('rpmMES', 'Prezzo medio carico ' + _tipoLabel(scheda.tipoMES, 'MES'));
    set('rpnlMES', 'P&L ' + _tipoLabel(scheda.tipoMES, 'MES'));
  }

  // Crea (una sola volta) il display "Delta azioni" accanto a "Delta netto".
  // Sempre visibile: 0,00 quando il mondo azioni è piatto, mai nascosto.
  function _ensureDeltaAzioniUI() {
    var wrap = document.getElementById('deltaAzioniWrap');
    if (wrap) return wrap;
    var dn = el('payoffDeltaNetto');
    if (!dn || !dn.parentElement) return null;
    wrap = document.createElement('span');
    wrap.id = 'deltaAzioniWrap';
    wrap.style.marginLeft = '8px';
    wrap.innerHTML = 'Delta azioni: <strong id="payoffDeltaAzioni" style="color:var(--text);">—</strong>';
    // insertBefore con nextSibling del parent è invalido (non è figlio del parent).
    // Usare Element.after() che inserisce correttamente dopo l'elemento.
    dn.parentElement.after(wrap);
    return wrap;
  }

  function _renderDeltaAzioni(dAz) {
    var wrap = _ensureDeltaAzioniUI();
    if (!wrap) return;
    var e = document.getElementById('payoffDeltaAzioni');
    if (!e) return;
    wrap.style.display = '';
    e.textContent = formatGreek(dAz, 2);
    e.style.color = dAz >= 0 ? 'var(--green)' : 'var(--red)';
  }

  // Delta del mondo AZIONI in convenzione TWS (100 azioni = 1.00):
  // - futures X (azioni): q.tà netta / 100 (segno incluso: SHORT = negativo)
  // - opzioni AZIONI: 1 contratto muove 100 azioni → delta del contratto
  //   già in unità eq. (opzione delta 0.50 = 0.50)
  function deltaAzioniTotale(scheda, resNES, resMES) {
    let d = 0;
    [resNES, resMES].forEach(res => {
      if (res && res.qtaNetta !== 0 && res.tipo === 'X') d += res.qtaNetta / 100;
    });
    (scheda.opzioni || []).forEach(opz => {
      if (opz.attivo === false || opz.stato === 'CHIUSA') return;
      if ((opz.strumento || 'MES') !== 'AZIONI') return;
      const g = calcolaGrecheOpzione(opz);
      if (!isFinite(g.delta)) return;
      const segno = opz.pos === 'SELL' ? -1 : 1;
      d += segno * (opz.qta || 0) * g.delta;
    });
    return d;
  }

  // Delta netto del SOLO mondo futures, in unità MES (1 MES = 1.0).
  // Le azioni (futures X e opzioni AZIONI) sono escluse: mondo separato.
  function deltaNettoTotale(scheda, resNES, resMES) {
    let d = 0;
    if (resNES && resNES.qtaNetta !== 0 && resNES.tipo !== 'X') {
      const molt = MOLTIPLICATORI[resNES.tipo] || 0.5;
      d += resNES.qtaNetta * (molt / 5); // es. 10 NES long → +1.0 delta MES-eq
    }
    if (resMES && resMES.qtaNetta !== 0 && resMES.tipo !== 'X') {
      const molt = MOLTIPLICATORI[resMES.tipo] || 5;
      d += resMES.qtaNetta * (molt / 5);
    }
    (scheda.opzioni || []).forEach(opz => {
      if (opz.attivo === false || opz.stato === 'CHIUSA') return;
      if ((opz.strumento || 'MES') === 'AZIONI') return; // mondo azioni separato
      const g = calcolaGrecheOpzione(opz);
      if (!isFinite(g.delta)) return; // input incompleti: nessun contributo
      const segno = opz.pos === 'SELL' ? -1 : 1;
      d += segno * (opz.qta || 0) * g.delta * (moltOpz(opz) / 5); // MES-equivalenti
    });
    // Aggiorna anche il display separato del delta azioni (stesso punto)
    _renderDeltaAzioni(deltaAzioniTotale(scheda, resNES, resMES));
    return d;
  }

  // Wrapper di aggiornaPayoffPreview: etichette riepilogo + reset spot <= 0
  var _origAggiornaPayoffPreview = aggiornaPayoffPreview;
  aggiornaPayoffPreview = function (scheda, resNES, resMES) {
    _aggiornaLabelsRiepilogo();
    const spot = parseFloat(el('prezzoSpot').value) || 0;
    if (!(spot > 0)) _renderDeltaAzioni(0); // mondo azioni a zero
    _origAggiornaPayoffPreview(scheda, resNES, resMES);
  };

  // Nella vista opzioni AZIONI: delta in eq. 100 azioni (0.50, non 50 $/pt),
  // coerente con la convenzione TWS usata per le coperture azionarie.
  var _origAggiornaPnlOpzioni = aggiornaPnlOpzioni;
  aggiornaPnlOpzioni = function () {
    _origAggiornaPnlOpzioni();
    if (strumentoOpzSelezionato() !== 'AZIONI') return;
    let totDelta = 0;
    el('bodyOpzioni').querySelectorAll('tr').forEach(tr => {
      const idx = Number(tr.dataset.idx);
      const opz = schedaAttiva().opzioni[idx];
      if (!opz || opz.attivo === false || opz.stato === 'CHIUSA') return;
      const g = calcolaGrecheOpzione(opz);
      if (!isFinite(g.delta)) return;
      const segno = opz.pos === 'SELL' ? -1 : 1;
      const v = segno * (opz.qta || 0) * g.delta; // eq. 100 azioni, senza ×100
      totDelta += v;
      const cell = tr.querySelector('[data-field="delta"]');
      if (cell) cell.textContent = formatGreekAuto(v, 2, 3);
    });
    el('greeksDelta').textContent = formatGreekAuto(totDelta, 2, 3);
  };

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
