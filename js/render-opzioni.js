// render-opzioni.js — render opzioni: greche, colonne extra e P&L combinato
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.
  // ============================================================
  // OPZIONI RENDER
  // ============================================================
  // formatGreek / formatGreekAuto / strumentoOpzSelezionato sono definite in matematica.js
  // Prezzo di carico effettivo: premio scritto, altrimenti teorico allo spot
  // corrente (fotografato). Coerente con premioCarico() in grafico.js.
  function premioEffettivo(opz) {
    if (opz.premio && opz.premio !== 0) return opz.premio;
    const spot = parseFloat(el('prezzoSpot').value) || 0;
    if (!(spot > 0)) return 0;
    const g = calcolaGrecheOpzione(opz);
    return isFinite(g.price) ? g.price : 0;
  }
  function aggiornaGiorniResidui(tr, opz) {
    const ggCell = tr.querySelector('[data-field="gg"]');
    if (!ggCell) return;
    const gg = giorniResiduiOpzione(opz);
    if (gg === null) {
      ggCell.textContent = '—';
      ggCell.style.color = '';
      return;
    }
    ggCell.textContent = String(gg);
    ggCell.style.color = gg < 0 ? 'var(--red)' : (gg <= 7 ? 'var(--yellow)' : 'var(--muted)');
  }
  function aggiornaExtraOpzione(tr, opz) {
    const setG = (f, val, dig) => {
      const cell = tr.querySelector(`[data-field="${f}"]`);
      if (cell) cell.textContent = formatGreek(val, dig);
    };
    const setPct = (f, p) => {
      const cell = tr.querySelector(`[data-field="${f}"]`);
      if (!cell) return;
      if (p === null || !isFinite(p)) { cell.textContent = '—'; return; }
      cell.textContent = (p * 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
    };
    if (opz.attivo === false || opz.stato === 'CHIUSA') {
      setG('intrinseco', NaN, 5);
      setG('temporale', NaN, 5);
      setPct('tocco', null);
      const sc = tr.querySelector('[data-field="pnlScad"]');
      if (sc) { sc.textContent = '—'; sc.classList.remove('green', 'red', 'muted'); sc.classList.add('muted'); }
      const dc = tr.querySelector('[data-field="debitcredit"]');
      if (dc) dc.textContent = '—';
      return;
    }
    const g = calcolaGrecheOpzione(opz);
    setG('intrinseco', g.intrinsic, 5);
    setG('temporale', (isFinite(g.price) && isFinite(g.intrinsic)) ? g.price - g.intrinsic : NaN, 5);
    const spot = parseFloat(el('prezzoSpot').value) || 0;
    const volFrac = (parseFloat(opz.vol) || 0) / 100;
    const T = (g && isFinite(g.T)) ? Math.max(0, g.T) : 0;
    setPct('tocco', touchProbability(spot, opz.strike, volFrac, T));
    const sc = tr.querySelector('[data-field="pnlScad"]');
    if (sc) {
      const pnlScad = pnlOpzioneAt(spot, opz, 'expiry', firstExpiryOpzioni(schedaAttiva()));
      sc.textContent = formatEuro(pnlScad);
      sc.classList.remove('green', 'red', 'muted');
      sc.classList.add(pnlScad >= 0 ? 'green' : 'red');
    }
    const dc = tr.querySelector('[data-field="debitcredit"]');
    if (dc) dc.textContent = formatEuro(premioEffettivo(opz) * (opz.qta || 0) * moltOpz(opz));
  }
  function aggiornaRigaOpzione(idx) {
    const tbody = el('bodyOpzioni');
    const tr = tbody.querySelector(`tr[data-idx="${idx}"]`);
    if (!tr) return;
    const opz = schedaAttiva().opzioni[idx];
    if (!opz) return;
    const tdPnl = tr.querySelector('.pnl-riga[data-label="P&L NOW ($)"]');
    if (tdPnl) {
      if (opz.attivo === false) {
        tdPnl.textContent = '—';
        tdPnl.classList.remove('green', 'red');
        tdPnl.classList.add('muted');
      } else {
        const pnl = calcolaPnlOpzione(opz);
        tdPnl.textContent = formatEuro(pnl);
        tdPnl.classList.remove('green', 'red', 'muted');
        tdPnl.classList.add(pnl >= 0 ? 'green' : 'red');
      }
    }
    aggiornaGiorniResidui(tr, opz);
    aggiornaMoneyness(tr, opz);
    const setG = (sel, val, dig) => {
      const cell = tr.querySelector(sel);
      if (cell) cell.textContent = formatGreek(val, dig);
    };
    if (opz.attivo === false || opz.stato === 'CHIUSA') {
      ['teorico','delta','gamma','vega','theta'].forEach(f => setG(`[data-field="${f}"]`, NaN, 5));
      aggiornaExtraOpzione(tr, opz);
      return;
    }
    const g = calcolaGrecheOpzione(opz);
    const segno = opz.pos === 'SELL' ? -1 : 1;
    const qta = opz.qta || 0;
    setG('[data-field="teorico"]', g.price, 5);
    const setPos = (f, v, minD, maxD) => {
      const cell = tr.querySelector(`[data-field="${f}"]`);
      if (cell) cell.textContent = formatGreekAuto(v, minD, maxD);
    };
    setPos('delta', segno * qta * g.delta, 5, 5);
    setPos('gamma', segno * qta * g.gamma, 5, 5);
    setPos('vega',  segno * qta * g.vega,  5, 5);
    setPos('theta', segno * qta * g.theta, 5, 5);
    aggiornaExtraOpzione(tr, opz);
  }
  // ============================================================
  // FOOTER TOTALI (come la versione di riferimento: riga viola
  // in fondo alla tabella con i totali per colonna)
  // ============================================================
  function buildFooterOpzioni() {
    const tfoot = el('footOpzioni');
    if (!tfoot) return;
    tfoot.innerHTML = '';
    const tr = document.createElement('tr');
    tr.className = 'footer-opzioni';
    // 10 colonne iniziali (☑, Stato, DEL, Pos, Tipo, Q.tà, Strike, Premio, Vol%, Scadenza)
    for (let i = 0; i < 10; i++) {
      const td = document.createElement('td');
      tr.appendChild(td);
    }
    const totCells = [
      { key: 'dte',    label: '' },
      { key: 'ms',     label: '' },
      { key: 'delta',  label: 'DELTA' },
      { key: 'gamma',  label: 'GAMMA' },
      { key: 'vega',   label: 'VEGA' },
      { key: 'theta',  label: 'THETA/gg' },
      { key: 'price',  label: 'PREZZO ATT.' },
      { key: 'temp',   label: 'VAL. TEMP.' },
      { key: 'intr',   label: 'VAL. INTR.' },
      { key: 'tocco',  label: '' },
      { key: 'pnlScad', label: 'P&L SCAD.' },
      { key: 'pnlNow',  label: 'P&L NOW' },
      { key: 'debcred', label: 'DEB/CRED' }
    ];
    totCells.forEach(c => {
      const td = document.createElement('td');
      td.dataset.tot = c.key;
      if (c.label) {
        const lbl = document.createElement('span');
        lbl.className = 'tot-label';
        lbl.textContent = c.label;
        td.appendChild(lbl);
      }
      const val = document.createElement('span');
      val.className = 'tot-val';
      val.textContent = '—';
      td.appendChild(val);
      tr.appendChild(td);
    });
    tfoot.appendChild(tr);
  }
  function aggiornaFooterOpzioni(tot) {
    const tfoot = el('footOpzioni');
    if (!tfoot) return;
    const set = (key, txt, cls) => {
      const cell = tfoot.querySelector(`td[data-tot="${key}"] .tot-val`);
      if (!cell) return;
      cell.textContent = txt;
      cell.classList.remove('green', 'red');
      if (cls) cell.classList.add(cls);
    };
    set('delta',  formatGreekAuto(tot.delta, 5, 5));
    set('gamma',  formatGreekAuto(tot.gamma, 5, 5));
    set('vega',   formatGreekAuto(tot.vega, 5, 5));
    set('theta',  formatGreekAuto(tot.theta, 5, 5));
    set('price',  formatGreekAuto(tot.price, 5, 5));
    set('temp',   formatGreekAuto(tot.temp, 5, 5));
    set('intr',   formatGreekAuto(tot.intr, 5, 5));
    set('tocco',  '');
    set('pnlScad', formatEuro(tot.pnlScad), tot.pnlScad >= 0 ? 'green' : 'red');
    set('pnlNow',  formatEuro(tot.pnlNow),  tot.pnlNow >= 0 ? 'green' : 'red');
    set('debcred', formatEuro(tot.debcred));
  }
  function renderOpzioni() {
    const tbody = el('bodyOpzioni');
    tbody.innerHTML = '';
    const strumentoSel = strumentoOpzSelezionato();
    const opzioniScheda = schedaAttiva().opzioni;
    opzioniScheda.forEach((opz, idx) => {
      if ((opz.strumento || 'MES') !== strumentoSel) return;
      const tr = document.createElement('tr');
      tr.dataset.idx = idx;
      if (opz.attivo === false) tr.classList.add('row-off');
      if (opz.stato === 'CHIUSA') tr.classList.add('row-chiusa');
      // A
      const tdA = document.createElement('td');
      tdA.dataset.label = '';
      const inA = document.createElement('input');
      inA.type = 'checkbox';
      inA.className = 'toggle-on';
      inA.checked = opz.attivo === false;
      inA.title = 'Spunta per escludere dai conteggi (riga oscurata)';
      inA.addEventListener('change', e => {
        opzioniScheda[idx].attivo = !e.target.checked;
        renderOpzioni();
        calcolaTutto();
      });
      tdA.appendChild(inA); tr.appendChild(tdA);
      // Stato
      const tdStato = document.createElement('td');
      tdStato.dataset.label = 'Stato';
      const btnStato = document.createElement('button');
      const isChiusa = opz.stato === 'CHIUSA';
      btnStato.className = 'btn-stato' + (isChiusa ? ' chiusa' : '');
      btnStato.textContent = isChiusa ? 'CHIUSA' : 'APERTA';
      btnStato.title = 'Clicca per aprire/chiudere la posizione: se CHIUSA il P&L = 0, il realizzato va annotato nel box Cash in alto';
      btnStato.addEventListener('click', () => {
        opzioniScheda[idx].stato = opzioniScheda[idx].stato === 'CHIUSA' ? 'APERTA' : 'CHIUSA';
        renderOpzioni();
        calcolaTutto();
      });
      tdStato.appendChild(btnStato); tr.appendChild(tdStato);
      // DEL
      const tdDel = document.createElement('td');
      tdDel.className = 'td-del';
      tdDel.dataset.label = 'DEL';
      const btnDel = document.createElement('button');
      btnDel.className = 'btn-del'; btnDel.textContent = 'DEL';
      btnDel.title = 'Elimina riga';
      btnDel.addEventListener('click', () => {
        if (!confirm('Eliminare questa riga di opzione?')) return;
        opzioniScheda.splice(idx, 1); renderOpzioni(); calcolaTutto();
      });
      tdDel.appendChild(btnDel); tr.appendChild(tdDel);
      // Pos
      const tdPos = document.createElement('td');
      tdPos.dataset.label = 'Pos';
      const selPos = document.createElement('select');
      selPos.innerHTML = '<option value="SELL">SELL</option><option value="BUY">BUY</option>';
      selPos.value = opz.pos || 'SELL';
      selPos.addEventListener('change', e => { opzioniScheda[idx].pos = e.target.value; aggiornaRigaOpzione(idx); calcolaTutto(); });
      tdPos.appendChild(selPos); tr.appendChild(tdPos);
      // Tipo
      const tdTipo = document.createElement('td');
      tdTipo.dataset.label = 'Tipo';
      const selTipo = document.createElement('select');
      selTipo.innerHTML = '<option value="PUT">PUT</option><option value="CALL">CALL</option>';
      selTipo.value = opz.tipo || 'PUT';
      selTipo.addEventListener('change', e => { opzioniScheda[idx].tipo = e.target.value; aggiornaRigaOpzione(idx); calcolaTutto(); });
      tdTipo.appendChild(selTipo); tr.appendChild(tdTipo);
      // Q.tà
      const tdQta = document.createElement('td');
      tdQta.dataset.label = 'Q.tà';
      const inQta = document.createElement('input');
      inQta.type = 'number'; inQta.step = '1'; inQta.min = '0'; inQta.value = (opz.qta != null ? opz.qta : 1);
      inQta.addEventListener('input', e => {
        const v = e.target.value;
        opzioniScheda[idx].qta = v === '' ? 0 : (parseFloat(v) || 0);
        aggiornaRigaOpzione(idx); calcolaTutto();
      });
      tdQta.appendChild(inQta); tr.appendChild(tdQta);
      // K
      const tdK = document.createElement('td');
      tdK.dataset.label = 'Strike';
      const inK = document.createElement('input');
      inK.type = 'number'; inK.step = '1'; inK.value = opz.strike || '';
      inK.addEventListener('input', e => {
        const v = e.target.value;
        opzioniScheda[idx].strike = v === '' ? 0 : (parseFloat(v) || 0);
        aggiornaRigaOpzione(idx); calcolaTutto();
      });
      tdK.appendChild(inK); tr.appendChild(tdK);
      // Premio
      const tdPremio = document.createElement('td');
      tdPremio.dataset.label = 'Premio';
      const inPremio = document.createElement('input');
      inPremio.type = 'number'; inPremio.step = '0.05'; inPremio.value = opz.premio || '';
      inPremio.addEventListener('input', e => {
        const v = e.target.value;
        opzioniScheda[idx].premio = v === '' ? 0 : (parseFloat(v) || 0);
        aggiornaRigaOpzione(idx); calcolaTutto();
      });
      tdPremio.appendChild(inPremio); tr.appendChild(tdPremio);
      // Vol%
      const tdVol = document.createElement('td');
      tdVol.dataset.label = 'Vol%';
      const inVol = document.createElement('input');
      inVol.type = 'number'; inVol.step = '0.1'; inVol.value = opz.vol || '';
      inVol.placeholder = '—';
      inVol.addEventListener('input', e => {
        const v = e.target.value;
        opzioniScheda[idx].vol = v === '' ? 0 : (parseFloat(v) || 0);
        aggiornaRigaOpzione(idx); calcolaTutto();
      });
      tdVol.appendChild(inVol); tr.appendChild(tdVol);
      // Scadenza
      const tdScad = document.createElement('td');
      tdScad.dataset.label = 'Scadenza';
      const inScad = document.createElement('input');
      inScad.type = 'date';
      inScad.value = opz.scadenza || '';
      inScad.addEventListener('change', e => {
        opzioniScheda[idx].scadenza = e.target.value;
        aggiornaRigaOpzione(idx); calcolaTutto();
      });
      tdScad.appendChild(inScad); tr.appendChild(tdScad);
      // DTE (ex GG)
      const tdGG = document.createElement('td');
      tdGG.dataset.label = 'DTE';
      const spanGG = document.createElement('span');
      spanGG.dataset.field = 'gg';
      spanGG.textContent = '—';
      spanGG.style.fontVariantNumeric = 'tabular-nums';
      tdGG.appendChild(spanGG); tr.appendChild(tdGG);
      aggiornaGiorniResidui(tr, opz);
      // M/S
      const tdMS = document.createElement('td');
      tdMS.dataset.label = 'M/S';
      const wrapMS = document.createElement('div');
      wrapMS.className = 'ms-wrap';
      const spanM = document.createElement('span');
      spanM.dataset.field = 'ms';
      spanM.textContent = '—';
      const spanMSigma = document.createElement('span');
      spanMSigma.dataset.field = 'msSigma';
      spanMSigma.className = 'ms-sub';
      wrapMS.appendChild(spanM); wrapMS.appendChild(spanMSigma);
      tdMS.appendChild(wrapMS); tr.appendChild(tdMS);
      aggiornaMoneyness(tr, opz);
      // DELTA
      const tdDelta = document.createElement('td');
      tdDelta.dataset.label = 'DELTA';
      const spanDelta = document.createElement('span');
      spanDelta.dataset.field = 'delta';
      spanDelta.textContent = '—';
      spanDelta.style.fontVariantNumeric = 'tabular-nums';
      tdDelta.appendChild(spanDelta); tr.appendChild(tdDelta);
      // GAMMA
      const tdGamma = document.createElement('td');
      tdGamma.dataset.label = 'GAMMA';
      const spanGamma = document.createElement('span');
      spanGamma.dataset.field = 'gamma';
      spanGamma.textContent = '—';
      spanGamma.style.fontVariantNumeric = 'tabular-nums';
      tdGamma.appendChild(spanGamma); tr.appendChild(tdGamma);
      // VEGA
      const tdVega = document.createElement('td');
      tdVega.dataset.label = 'VEGA';
      const spanVega = document.createElement('span');
      spanVega.dataset.field = 'vega';
      spanVega.textContent = '—';
      spanVega.style.fontVariantNumeric = 'tabular-nums';
      tdVega.appendChild(spanVega); tr.appendChild(tdVega);
      // THETA/gg
      const tdTheta = document.createElement('td');
      tdTheta.dataset.label = 'THETA/gg';
      const spanTheta = document.createElement('span');
      spanTheta.dataset.field = 'theta';
      spanTheta.textContent = '—';
      spanTheta.style.fontVariantNumeric = 'tabular-nums';
      tdTheta.appendChild(spanTheta); tr.appendChild(tdTheta);
      // PREZZO ATT. (ex Teorico)
      const tdTeorico = document.createElement('td');
      tdTeorico.dataset.label = 'PREZZO ATT.';
      const spanTeorico = document.createElement('span');
      spanTeorico.dataset.field = 'teorico';
      spanTeorico.textContent = '—';
      spanTeorico.style.fontVariantNumeric = 'tabular-nums';
      tdTeorico.appendChild(spanTeorico); tr.appendChild(tdTeorico);
      // VAL. TEMP.
      const tdVtemp = document.createElement('td');
      tdVtemp.dataset.label = 'VAL. TEMP.';
      const spanVtemp = document.createElement('span');
      spanVtemp.dataset.field = 'temporale';
      spanVtemp.textContent = '—';
      spanVtemp.style.fontVariantNumeric = 'tabular-nums';
      tdVtemp.appendChild(spanVtemp); tr.appendChild(tdVtemp);
      // VAL. INTR.
      const tdVintr = document.createElement('td');
      tdVintr.dataset.label = 'VAL. INTR.';
      const spanVintr = document.createElement('span');
      spanVintr.dataset.field = 'intrinseco';
      spanVintr.textContent = '—';
      spanVintr.style.fontVariantNumeric = 'tabular-nums';
      tdVintr.appendChild(spanVintr); tr.appendChild(tdVintr);
      // PROB. TOCCO
      const tdTocco = document.createElement('td');
      tdTocco.dataset.label = 'PROB. TOCCO';
      const spanTocco = document.createElement('span');
      spanTocco.dataset.field = 'tocco';
      spanTocco.textContent = '—';
      spanTocco.style.fontVariantNumeric = 'tabular-nums';
      tdTocco.appendChild(spanTocco); tr.appendChild(tdTocco);
      // P&L SCAD. ($)
      const tdPnlScad = document.createElement('td');
      tdPnlScad.className = 'pnl-riga td-pnl';
      tdPnlScad.dataset.label = 'P&L SCAD. ($)';
      const spanPnlScad = document.createElement('span');
      spanPnlScad.dataset.field = 'pnlScad';
      tdPnlScad.appendChild(spanPnlScad);
      tr.appendChild(tdPnlScad);
      // P&L NOW ($)
      const tdPnl = document.createElement('td');
      tdPnl.className = 'pnl-riga td-pnl';
      tdPnl.dataset.label = 'P&L NOW ($)';
      tr.appendChild(tdPnl);
      // DEBITO/CREDITO ($)
      const tdDebCred = document.createElement('td');
      tdDebCred.dataset.label = 'DEBITO/CREDITO ($)';
      const spanDebCred = document.createElement('span');
      spanDebCred.dataset.field = 'debitcredit';
      spanDebCred.style.fontVariantNumeric = 'tabular-nums';
      tdDebCred.appendChild(spanDebCred); tr.appendChild(tdDebCred);
      tbody.appendChild(tr);
    });
    buildFooterOpzioni();
    aggiornaPnlOpzioni();
  }
  function aggiornaPnlOpzioni() {
    const tbody = el('bodyOpzioni');
    let totDelta = 0, totGamma = 0, totVega = 0, totTheta = 0;
    let totPnlScad = 0, totPnlNow = 0, totDebCred = 0;
    let totPrice = 0, totTemp = 0, totIntr = 0;
    const spot = parseFloat(el('prezzoSpot').value) || 0;
    const firstExp = firstExpiryOpzioni(schedaAttiva());
    tbody.querySelectorAll('tr').forEach((tr) => {
      const idx = Number(tr.dataset.idx);
      const opz = schedaAttiva().opzioni[idx];
      if (!opz) return;
      const tdPnl = tr.querySelector('.pnl-riga[data-label="P&L NOW ($)"]');
      if (tdPnl) {
        if (opz.attivo === false) {
          tdPnl.textContent = '—';
          tdPnl.classList.remove('green', 'red');
          tdPnl.classList.add('muted');
        } else {
          const pnl = calcolaPnlOpzione(opz);
          tdPnl.textContent = formatEuro(pnl);
          tdPnl.classList.remove('green', 'red', 'muted');
          tdPnl.classList.add(pnl >= 0 ? 'green' : 'red');
        }
      }
      aggiornaGiorniResidui(tr, opz);
      aggiornaMoneyness(tr, opz);
      aggiornaExtraOpzione(tr, opz);
      const setG = (sel, val, dig) => {
        const cell = tr.querySelector(sel);
        if (cell) cell.textContent = formatGreek(val, dig);
      };
      if (opz.attivo !== false && opz.stato !== 'CHIUSA') {
        const g = calcolaGrecheOpzione(opz);
        const segno = opz.pos === 'SELL' ? -1 : 1;
        const qta = opz.qta || 0;
        if (isFinite(g.delta)) totDelta += segno * qta * g.delta;
        if (isFinite(g.gamma)) totGamma += segno * qta * g.gamma;
        if (isFinite(g.vega))  totVega  += segno * qta * g.vega;
        if (isFinite(g.theta)) totTheta += segno * qta * g.theta;
        // Totali footer: PREZZO ATT. / VAL. TEMP. / VAL. INTR. per singola gamba
        if (isFinite(g.price)) {
          totPrice += g.price;
          if (isFinite(g.intrinsic)) {
            totIntr += g.intrinsic;
            totTemp += g.price - g.intrinsic;
          }
        }
        const ps = pnlOpzioneAt(spot, opz, 'expiry', firstExp);
        if (isFinite(ps)) totPnlScad += ps;
        const pn = calcolaPnlOpzione(opz);
        if (isFinite(pn)) totPnlNow += pn;
        totDebCred += premioEffettivo(opz) * qta * moltOpz(opz);
        setG('[data-field="teorico"]', g.price, 5);
        const setPos = (f, v, minD, maxD) => {
          const cell = tr.querySelector(`[data-field="${f}"]`);
          if (cell) cell.textContent = formatGreekAuto(v, minD, maxD);
        };
        setPos('delta', segno * qta * g.delta, 5, 5);
        setPos('gamma', segno * qta * g.gamma, 5, 5);
        setPos('vega',  segno * qta * g.vega,  5, 5);
        setPos('theta', segno * qta * g.theta, 5, 5);
      } else {
        ['teorico','delta','gamma','vega','theta'].forEach(f => setG(`[data-field="${f}"]`, NaN, 5));
      }
    });
    el('greeksDelta').textContent = formatGreekAuto(totDelta, 5, 5);
    el('greeksGamma').textContent = formatGreekAuto(totGamma, 5, 5);
    el('greeksVega').textContent  = formatGreekAuto(totVega, 5, 5);
    el('greeksTheta').textContent = formatGreekAuto(totTheta, 5, 5);
    el('pnlOpzioni').textContent  = formatEuro(totPnlNow);
    el('pnlOpzScadTot').textContent = formatEuro(totPnlScad);
    el('pnlOpzDebCredTot').textContent = formatEuro(totDebCred);
    // Riga footer: totali per colonna
    aggiornaFooterOpzioni({
      delta: totDelta, gamma: totGamma, vega: totVega, theta: totTheta,
      price: totPrice, temp: totTemp, intr: totIntr,
      pnlScad: totPnlScad, pnlNow: totPnlNow, debcred: totDebCred
    });
  }
