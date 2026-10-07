// render-futures.js — render righe futures/azioni con stato APERTA/CHIUSA
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.

  function _tipoLabelCol(tipo, col) {
    if (tipo === 'X') return 'AZIONI';
    if (!tipo || tipo === '-') return col;
    return tipo;
  }

  function deltaRiga(info, tipo) {
    if (!info || !(info.qAperta > 0)) return NaN;
    if (tipo === 'X') return NaN;
    const molt = MOLTIPLICATORI[tipo] || 0;
    if (!molt) return NaN;
    const segno = info.direzione === 'LONG' ? 1 : -1;
    return segno * info.qAperta * (molt / MOLTIPLICATORI.MES);
  }

  function renderRigaTotale(col, res) {
    const prezzoEl = el('csPrezzo' + col);
    if (prezzoEl) {
      prezzoEl.textContent = isNaN(res.mediaPulita) ? '—' : formatPrezzo(res.mediaPulita);
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

  function aggiornaCalcolati(col) {
    const scheda = schedaAttiva();
    const res = calcolaColonna(scheda, col);
    renderRigaTotale(col, res);

    const tbody = el('body' + col);
    tbody.querySelectorAll('tr').forEach((tr, idx) => {
      const info = res.righe[idx];
      if (!info) return;
      const isOff = scheda[col][idx].attivo === false;

      const tdDelta = tr.querySelector('.delta-riga');
      if (tdDelta) {
        if (isOff) {
          tdDelta.textContent = '—';
          tdDelta.className = 'delta-riga muted';
        } else {
          const d = deltaRiga(info, res.tipo);
          if (!isFinite(d) || d === 0) {
            tdDelta.textContent = '—';
            tdDelta.className = 'delta-riga muted';
          } else {
            tdDelta.textContent = formatGreekAuto(d, 2, 3);
            tdDelta.className = 'delta-riga ' + (d >= 0 ? 'green' : 'red');
          }
        }
      }

      const tdPnl = tr.querySelector('.pnl-riga');
      if (tdPnl) {
        if (isOff) {
          tdPnl.textContent = '—';
          tdPnl.className = 'pnl-riga muted';
        } else {
          const pnlVal = info.pnlTotale || 0;
          tdPnl.textContent = formatEuro(pnlVal);
          if (pnlVal === 0 && info.tipo === 'vuota') tdPnl.className = 'pnl-riga muted';
          else tdPnl.className = 'pnl-riga ' + (pnlVal >= 0 ? 'green' : 'red');
        }
      }
    });
  }

  function renderMovimenti(col) {
    const scheda = schedaAttiva();
    const res = calcolaColonna(scheda, col);
    renderRigaTotale(col, res);

    const tbody = el('body' + col);
    tbody.innerHTML = '';

    scheda[col].forEach((mov, idx) => {
      const info = res.righe[idx] || { tipo: 'vuota', qAperta: 0, qChiusa: 0, pnlTotale: 0 };
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

      // Stato: bottone APERTA / CHIUSA
      const tdStato = document.createElement('td');
      tdStato.dataset.label = 'Stato';
      const btnStato = document.createElement('button');
      btnStato.className = 'btn-stato' + (isChiusa ? ' chiusa' : '');
      btnStato.textContent = isChiusa ? 'CHIUSA' : 'APERTA';
      btnStato.title = 'Clicca per aprire/chiudere: se CHIUSA il P&L realizzato viene congelato e la riga non partecipa più al delta';
      btnStato.addEventListener('click', () => {
        scheda[col][idx].stato = scheda[col][idx].stato === 'CHIUSA' ? 'APERTA' : 'CHIUSA';
        renderMovimenti(col);
        calcolaTutto();
      });
      tdStato.appendChild(btnStato); tr.appendChild(tdStato);

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

      // Delta
      const tdDelta = document.createElement('td');
      tdDelta.className = 'delta-riga td-delta';
      tdDelta.dataset.label = 'Delta';
      tdDelta.title = 'Delta di posizione (futures: MES-equivalenti; azioni: TWS)';
      if (!isOn) {
        tdDelta.textContent = '—';
        tdDelta.classList.add('muted');
      } else {
        const d = deltaRiga(info, res.tipo);
        if (!isFinite(d) || d === 0) {
          tdDelta.textContent = '—';
          tdDelta.classList.add('muted');
        } else {
          tdDelta.textContent = formatGreekAuto(d, 2, 3);
          tdDelta.classList.add(d >= 0 ? 'green' : 'red');
        }
      }
      tr.appendChild(tdDelta);

      // P&L
      const tdPnl = document.createElement('td');
      tdPnl.className = 'pnl-riga td-pnl';
      tdPnl.dataset.label = 'P&L';
      tdPnl.title = 'P&L della riga: aperto + realizzato';
      if (!isOn) {
        tdPnl.textContent = '—';
        tdPnl.classList.add('muted');
      } else {
        const pnlVal = info.pnlTotale || 0;
        tdPnl.textContent = formatEuro(pnlVal);
        if (pnlVal === 0 && info.tipo === 'vuota') tdPnl.classList.add('muted');
        else tdPnl.classList.add(pnlVal >= 0 ? 'green' : 'red');
      }
      tr.appendChild(tdPnl);

      tbody.appendChild(tr);
    });
  }
