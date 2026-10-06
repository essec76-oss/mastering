// render-futures.js — render righe futures/azioni: come le opzioni
// Ogni riga: nascondi, DEL, BUY/SELL, Q.tà, Prezzo, Delta, P&L.
// Header compatto: tipo + q.tà netta @ media + P&L.
// Footer sotto le righe: Q.tà netta residua + Delta azioni (TWS, solo se AZIONI).
// Parte di Mastering (già app.js): l'ordine di caricamento è definito in index.html.

  // ============================================================
  // RENDER
  // ============================================================
  // Delta di posizione della singola riga ($/pt): segno × q.tà aperta × molt.
  function deltaRiga(info, tipo) {
    if (!info || !(info.qAperta > 0)) return NaN;
    const molt = MOLTIPLICATORI[tipo] || 0;
    if (!molt) return NaN;
    const segno = info.direzione === 'LONG' ? 1 : -1;
    return segno * info.qAperta * molt;
  }

  // Piccolo riepilogo in header + footer (q.tà netta + Delta azioni TWS).
  // Manteniamo la firma renderRigaTotale(col, res) usata da calcola-tutto.js.
  function renderRigaTotale(col, res) {
    // --- Header compatto ---
    const qtaEl = el('csQta' + col);
    const prezzoEl = el('csPrezzo' + col);
    const pnlEl = el('csPnl' + col);
    if (qtaEl) {
      if (!res.qtaNetta) {
        qtaEl.innerHTML = '<span class="dir-flat">—</span>';
      } else {
        const dir = res.qtaNetta > 0 ? 'LONG' : 'SHORT';
        const cls = res.qtaNetta > 0 ? 'dir-long' : 'dir-short';
        qtaEl.innerHTML = Math.abs(res.qtaNetta) + ' <span class="' + cls + '">' + dir + '</span>';
      }
    }
    if (prezzoEl) {
      prezzoEl.textContent = isNaN(res.mediaPulita) ? '—' : formatPrezzo(res.mediaPulita);
    }
    if (pnlEl) {
      const p = res.pnlTotale || 0;
      pnlEl.textContent = formatEuro(p);
      pnlEl.className = 'cs-pnl ' + (!isFinite(p) || p === 0 ? 'muted' : (p >= 0 ? 'green' : 'red'));
    }

    // --- Footer: Q.tà netta residua ---
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

    // --- Footer: Delta azioni (convenzione TWS: 100 azioni = 1,00) ---
    // Valorizzato solo se la colonna è impostata su AZIONI (tipo X).
    // Per NES/MES/ES mostra "—" (mondo futures separato).
    const dAzEl = el('deltaAzCol' + col);
    if (dAzEl) {
      if (res.tipo === 'X' && res.qtaNetta !== 0) {
        const dAz = res.qtaNetta / 100; // TWS: 100 azioni = 1,00
        dAzEl.textContent = formatGreek(dAz, 2);
        dAzEl.className = 'value ' + (dAz >= 0 ? 'green' : 'red');
      } else {
        dAzEl.textContent = '—';
        dAzEl.className = 'value muted';
      }
    }
  }

  // Aggiorna le celle Delta e P&L delle righe e il riepilogo (senza
  // re-render, per non perdere il focus sugli input mentre si digita)
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
      if (info.tipo === 'chiusura') tr.classList.add('row-chiusura');
      const isOn = mov.attivo !== false;
      if (!isOn) tr.classList.add('row-off');

      // Nascondi (toggle): esclude la riga dai conteggi
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

      // Pos (BUY / SELL) — internamente resta LONG/SHORT
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

      // Prezzo nominale
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

      // Delta ($/pt)
      const tdDelta = document.createElement('td');
      tdDelta.className = 'delta-riga td-delta';
      tdDelta.dataset.label = 'Delta';
      tdDelta.title = 'Delta di posizione: $ per punto (q.tà × moltiplicatore)';
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

      // P&L di riga (aperto + realizzato, commissioni incluse)
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
