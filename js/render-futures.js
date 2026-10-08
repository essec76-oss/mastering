// render-futures.js — render righe futures/azioni (modello transazionale)
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.
//
// v26 — Modello transazionale:
//   - Niente più pulsante APERTA/CHIUSA sulla riga: lo stato è calcolato
//     automaticamente da ricalcolaStatiScheda() in base alla direzione
//     rispetto alla posizione netta corrente.
//   - Rimossa la colonna Delta dalla riga (resta nel footer).
//   - Colonna P&L rinominata RLZD (P&L realizzato della riga).
//     - Riga di apertura → "—"
//     - Riga di chiusura → valore realizzato
//     - Riga esclusa    → "—"
//
// v27 — Fee stimate nell'header di colonna:
//   - Le commissioni NON entrano più nei calcoli (P&L lordo).
//   - Le fee stimate (N aperture × 2 lati × 1,205 $/lato, solo NES)
//     sono mostrate nell'header della colonna come promemoria.
//   - Il toggle "Commissioni (solo NES)" è stato rimosso.

  function _tipoLabelCol(tipo, col) {
    if (tipo === 'X') return 'AZIONI';
    if (!tipo || tipo === '-') return col;
    return tipo;
  }

  // Delta di riga (usato solo per il calcolo interno, non più mostrato).
  function deltaRiga(info, tipo) {
    if (!info || !(info.qAperta > 0)) return NaN;
    if (tipo === 'X') return NaN;
    const molt = MOLTIPLICATORI[tipo] || 0;
    if (!molt) return NaN;
    const segno = info.direzione === 'LONG' ? 1 : -1;
    return segno * info.qAperta * (molt / MOLTIPLICATORI.MES);
  }

  // ============================================================
  // RICALCOLO STATI (modello transazionale)
  // ============================================================
  // Assegna automaticamente `stato` a ogni movimento in base alla
  // direzione rispetto alla posizione netta corrente:
  //   - direzione d'accordo con la posizione → APERTA (apertura/aggiunta)
  //   - direzione opposta                    → CHIUSA (chiusura)
  //   - riga mista (una parte chiude e una apre) → CHIUSA
  //     (la parte che apre è gestita internamente da aggiungiPool)
  // Il campo `stato` resta nel dato (compatibilità salvataggi), ma
  // non è più editabile dall'utente.
  function ricalcolaStatiScheda(scheda, col) {
    const movimenti = scheda[col] || [];
    let posizioneNetta = 0;
    movimenti.forEach(m => {
      if (m.attivo === false) return;
      const q = m.quantita || 0;
      if (q === 0) { m.stato = 'APERTA'; return; }
      const segno = m.direzione === 'LONG' ? 1 : -1;
      const segnoAttuale = Math.sign(posizioneNetta);
      if (segnoAttuale === 0 || segnoAttuale === segno) {
        m.stato = 'APERTA';
      } else {
        m.stato = 'CHIUSA';
      }
      posizioneNetta += segno * q;
    });
  }

  // Ricalcola gli stati di NES e MES della scheda attiva.
  function ricalcolaStatiSchedaAttiva() {
    const scheda = schedaAttiva();
    if (!scheda) return;
    ricalcolaStatiScheda(scheda, 'NES');
    ricalcolaStatiScheda(scheda, 'MES');
  }

  // ============================================================
  // FEE STIMATE (v27)
  // ============================================================
  // Fee stimate per la colonna: N aperture × 2 lati × 1,205 $/lato.
  // Solo NES (whitelist STRUMENTI_CON_COMMISSIONI). Per gli altri
  // strumenti ritorna 0 (in futuro potranno avere fee proprie).
  // N.B.: le fee NON entrano nei calcoli (P&L lordo).
  function calcolaFeeStimate(col) {
    const scheda = schedaAttiva();
    const tipo = scheda['tipo' + col];
    if (!tipo || tipo === '-') return 0;
    if (!STRUMENTI_CON_COMMISSIONI.includes(tipo)) return 0;
    let nAperture = 0;
    (scheda[col] || []).forEach(m => {
      if (m.attivo === false) return;
      const stato = m.stato || 'APERTA';
      if (stato !== 'CHIUSA') {
        nAperture += (m.quantita || 0);
      }
    });
    return nAperture * 2 * FEE_FUTURES_LATO;
  }

  function renderRigaTotale(col, res) {
    const prezzoEl = el('csPrezzo' + col);
    if (prezzoEl) {
      prezzoEl.textContent = isNaN(res.mediaPulita) ? '—' : formatPrezzo(res.mediaPulita);
    }

    // Fee stimate (v27)
    const feeEl = el('fee' + col);
    if (feeEl) {
      const fee = calcolaFeeStimate(col);
      if (fee > 0) {
        feeEl.textContent = '-' + formatEuro(fee);
        feeEl.className = 'cs-fee-val red';
      } else {
        feeEl.textContent = '-0,00';
        feeEl.className = 'cs-fee-val muted';
      }
    }

    const qnEl = el('qtaNetta' + col);
    if (qnEl) {
      if (!res.qtaNetta) {
        qnEl.textContent = '—';
        qnEl.className = 'value muted';
      } else {
        const dir = res.qtaNetta > 0 ? 'LONG' : 'SHORT';
        qnEl.textContent = Math.abs(res.qtaNetta) + ' ' + dir;
        qnEl.className = 'value ' + (res.qtaNetta > 0 ? 'green' : 'red');
      }
    }

    const dEl = el('deltaAzCol' + col);
    const dLabelEl = el('deltaLabel' + col);
    if (dEl) {
      const tipoLabel = _tipoLabelCol(res.tipo, col);
      if (res.tipo === 'X') {
        if (dLabelEl) dLabelEl.textContent = 'Delta azioni';
        if (res.qtaNetta !== 0) {
          const dAz = res.qtaNetta / 100;
          dEl.textContent = formatGreek(dAz, 2);
          dEl.className = 'value ' + (dAz >= 0 ? 'green' : 'red');
        } else {
          dEl.textContent = '—';
          dEl.className = 'value muted';
        }
      } else {
        if (dLabelEl) dLabelEl.textContent = 'Delta ' + tipoLabel;
        if (res.qtaNetta !== 0) {
          const molt = MOLTIPLICATORI[res.tipo] || 0;
          const dMES = res.qtaNetta * (molt / MOLTIPLICATORI.MES);
          dEl.textContent = formatGreek(dMES, 2);
          dEl.className = 'value ' + (dMES >= 0 ? 'green' : 'red');
        } else {
          dEl.textContent = '—';
          dEl.className = 'value muted';
        }
      }
    }

    const pnlEl = el('csPnl' + col);
    if (pnlEl) {
      const p = res.pnlTotale || 0;
      pnlEl.textContent = formatEuro(p);
      pnlEl.className = 'value ' + (!isFinite(p) || p === 0 ? 'muted' : (p >= 0 ? 'green' : 'red'));
    }
  }

  // Restituisce il valore da mostrare nella colonna RLZD per una riga.
  // - off → "—"
  // - apertura → "—"
  // - chiusura → valore realizzato formattato
  function _valoreRlzdRiga(info, isOff) {
    if (isOff) return { testo: '—', classe: 'muted' };
    if (!info) return { testo: '—', classe: 'muted' };
    if (info.tipo === 'apertura' || info.tipo === 'vuota' || info.tipo === 'off') {
      return { testo: '—', classe: 'muted' };
    }
    if (info.tipo === 'chiusura' || info.tipo === 'mista') {
      const v = info.pnlRealizzato || 0;
      if (v === 0) return { testo: formatEuro(0), classe: 'muted' };
      return { testo: formatEuro(v), classe: v >= 0 ? 'green' : 'red' };
    }
    return { testo: '—', classe: 'muted' };
  }

  function aggiornaCalcolati(col) {
    const scheda = schedaAttiva();
    const res = calcolaColonna(scheda, col);
    renderRigaTotale(col, res);

    const tbody = el('body' + col);
    tbody.querySelectorAll('tr').forEach((tr, idx) => {
      const info = res.righe[idx];
      if (!info) return;
      const isOff = scheda[col][idx].attivo === false;

      const tdPnl = tr.querySelector('.pnl-riga');
      if (tdPnl) {
        const { testo, classe } = _valoreRlzdRiga(info, isOff);
        tdPnl.textContent = testo;
        tdPnl.className = 'pnl-riga ' + classe;
      }
    });
  }

  function renderMovimenti(col) {
    // Modello transazionale: ricalcola gli stati in base alla direzione
    // rispetto alla posizione netta, prima di calcolare i P&L.
    ricalcolaStatiScheda(schedaAttiva(), col);

    const scheda = schedaAttiva();
    const res = calcolaColonna(scheda, col);
    renderRigaTotale(col, res);

    const tbody = el('body' + col);
    tbody.innerHTML = '';

    scheda[col].forEach((mov, idx) => {
      const info = res.righe[idx] || { tipo: 'vuota', qAperta: 0, qChiusa: 0, pnlRealizzato: 0, pnlTotale: 0 };
      const tr = document.createElement('tr');
      const isChiusa = (mov.stato || 'APERTA') === 'CHIUSA';
      if (isChiusa) tr.classList.add('row-chiusa');
      const isOn = mov.attivo !== false;
      if (!isOn) tr.classList.add('row-off');

      // Nascondi (toggle)
      const tdAtt = document.createElement('td');
      tdAtt.dataset.label = 'Nascondi';
      const inAtt = document.createElement('input');
      inAtt.type = 'checkbox';
      inAtt.className = 'toggle-on';
      inAtt.checked = !isOn;
      inAtt.title = 'Spunta per escludere dai conteggi (riga oscurata)';
      inAtt.addEventListener('change', e => {
        scheda[col][idx].attivo = !e.target.checked;
        renderMovimenti(col);
        calcolaTutto();
      });
      tdAtt.appendChild(inAtt); tr.appendChild(tdAtt);

      // DEL
      const tdDel = document.createElement('td');
      tdDel.className = 'td-del';
      tdDel.dataset.label = 'DEL';
      const btnDel = document.createElement('button');
      btnDel.className = 'btn-del'; btnDel.textContent = 'DEL';
      btnDel.title = 'Elimina riga';
      btnDel.addEventListener('click', () => {
        if (!confirm('Eliminare questa riga di movimento?')) return;
        scheda[col].splice(idx, 1);
        renderMovimenti(col); calcolaTutto();
      });
      tdDel.appendChild(btnDel); tr.appendChild(tdDel);

      // Pos
      const tdPos = document.createElement('td');
      tdPos.dataset.label = 'Pos';
      const selPos = document.createElement('select');
      selPos.innerHTML = '<option value="LONG">BUY</option><option value="SHORT">SELL</option>';
      selPos.value = mov.direzione;
      selPos.addEventListener('change', e => {
        scheda[col][idx].direzione = e.target.value;
        renderMovimenti(col); calcolaTutto();
      });
      tdPos.appendChild(selPos); tr.appendChild(tdPos);

      // Q.tà
      const tdQta = document.createElement('td');
      tdQta.dataset.label = 'Q.tà';
      const inQta = document.createElement('input');
      inQta.type = 'number'; inQta.step = '1'; inQta.min = '0';
      inQta.value = mov.quantita;
      inQta.addEventListener('input', e => {
        const v = e.target.value;
        scheda[col][idx].quantita = v === '' ? 0 : (parseFloat(v) || 0);
        // La quantità cambia la posizione netta → ricalcola gli stati
        ricalcolaStatiScheda(scheda, col);
        aggiornaCalcolati(col); calcolaTutto();
      });
      tdQta.appendChild(inQta); tr.appendChild(tdQta);

      // Prezzo
      const tdPrezzo = document.createElement('td');
      tdPrezzo.dataset.label = 'Prezzo';
      const inPrezzo = document.createElement('input');
      inPrezzo.type = 'number'; inPrezzo.step = '0.25';
      inPrezzo.className = 'prezzo-nominale';
      inPrezzo.value = (mov.prezzoPulito === 0 || mov.prezzoPulito === undefined) ? '' : mov.prezzoPulito;
      inPrezzo.placeholder = '—';
      inPrezzo.addEventListener('input', e => {
        const v = e.target.value;
        scheda[col][idx].prezzoPulito = v === '' ? 0 : (parseFloat(v) || 0);
        aggiornaCalcolati(col); calcolaTutto();
      });
      tdPrezzo.appendChild(inPrezzo); tr.appendChild(tdPrezzo);

      // RLZD (ex P&L)
      const tdRlzd = document.createElement('td');
      tdRlzd.className = 'pnl-riga td-pnl';
      tdRlzd.dataset.label = 'RLZD';
      tdRlzd.title = 'P&L realizzato della riga (solo per righe di chiusura)';
      const { testo, classe } = _valoreRlzdRiga(info, !isOn);
      tdRlzd.textContent = testo;
      tdRlzd.classList.add(classe);
      tr.appendChild(tdRlzd);

      tbody.appendChild(tr);
    });
  }
