// scarico-posizione.js — Bottone «Scarica posizione» + modale di chiusura
// Metodo: Average Cost (prezzo medio di carico, IBKR) — NON FIFO.
// Al momento dello scarico il prezzo di carico di TUTTE le posizioni aperte
// viene normalizzato al prezzo medio corrente; le posizioni chiuse si
// interfacciano con quello vs lo spot, e le residue lo ereditano.
// L'ordine di caricamento è definito in index.html (dopo eventi.js).
(function () {
  'use strict';

  /* ============ BOTTONE sotto «+ Aggiungi movimento» ============ */
  document.querySelectorAll('.btn-add[data-col]').forEach(btnAdd => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-add btn-scarico';
    btn.dataset.col = btnAdd.dataset.col;
    btn.textContent = '↓ Scarica posizione';
    btn.title = 'Apre la finestra di chiusura: seleziona le operazioni da chiudere (dalla più anziana). Il P&L usa il prezzo medio di carico corrente vs lo spot; le posizioni residue ereditano il prezzo medio.';
    btn.addEventListener('click', () => apriModaleScarico(btnAdd.dataset.col));
    btnAdd.insertAdjacentElement('afterend', btn);
  });

  /* ==================== MODALE ==================== */
  let overlay = null;

  function chiudiModaleScarico() {
    if (overlay) { overlay.remove(); overlay = null; }
  }

  function apriModaleScarico(col) {
    chiudiModaleScarico();
    const scheda = schedaAttiva();
    const res = calcolaColonna(scheda, col);
    const media = res.mediaPulita;
    const spot = parseFloat(el('prezzoSpot').value) || 0;
    const molt = (typeof risolviMoltiplicatore === 'function')
      ? risolviMoltiplicatore(scheda, col) : 1;
    const tipoLabel = (typeof _tipoLabelCol === 'function')
      ? _tipoLabelCol(scheda['tipo' + col], col) : col;

    // Posizioni aperte in ordine di ANZIANITÀ: l'ordine di inserimento
    // (la più anziana — prima riga della tabella — in alto).
    const aperte = [];
    (scheda[col] || []).forEach((m, idx) => {
      if (m.attivo === false) return;
      const qAp = m.quantita || 0;
      const qCh = Math.min(m.quantitaChiusa || 0, qAp);
      const residuo = qAp - qCh;
      if (residuo > 0) aperte.push({ m, idx, residuo, segno: m.direzione === 'LONG' ? 1 : -1 });
    });

    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modalScaricoOverlay';

    const box = document.createElement('div');
    box.className = 'modal-strategie modal-scarico';
    overlay.appendChild(box);

    const h3 = document.createElement('h3');
    h3.textContent = 'Scarica posizione — ' + tipoLabel;
    box.appendChild(h3);

    if (!aperte.length || !isFinite(media)) {
      const vuoto = document.createElement('div');
      vuoto.className = 'scarico-empty';
      vuoto.textContent = '— nessuna posizione aperta in questa colonna —';
      box.appendChild(vuoto);
    } else {
      const spotOk = spot > 0;

      // Riga informativa: prezzo medio, spot, metodo
      const info = document.createElement('div');
      info.className = 'scarico-info';
      info.innerHTML =
        '<span>Prezzo medio di carico: <strong class="scarico-media">' + formatPrezzo(media) + '</strong></span>' +
        '<span>Spot attuale: <strong class="scarico-spot">' + formatPrezzo(spot) + '</strong></span>' +
        '<span class="scarico-nota">P&L = prezzo medio di carico vs spot (metodo prezzo medio IBKR). Le posizioni residue ereditano il prezzo medio.</span>';
      box.appendChild(info);

      if (!spotOk) {
        const warn = document.createElement('div');
        warn.className = 'scarico-warn';
        warn.textContent = '⚠ Imposta il Prezzo Spot prima di scaricare la posizione.';
        box.appendChild(warn);
      }

      // Tabella posizioni
      const lista = document.createElement('div');
      lista.className = 'scarico-lista';
      const tbl = document.createElement('table');
      tbl.className = 'scarico-tabella';
      tbl.innerHTML =
        '<thead><tr>' +
        '<th><input type="checkbox" id="scaricoSelTutte" title="Seleziona/deseleziona tutte"></th>' +
        '<th title="Ordine di anzianità: la più anziana in alto">#</th>' +
        '<th>Pos</th><th>Q.tà aperta</th><th>Q.tà da chiudere</th>' +
        '<th>Prezzo open</th><th>P&L stimato</th>' +
        '</tr></thead>';
      const tb = document.createElement('tbody');

      const updaters = [];   // refresh live di P&L riga, totale e bottone conferma
      let totPnlEl = null, btnConferma = null;

      aperte.forEach((p, i) => {
        const tr = document.createElement('tr');

        // Checkbox di selezione
        const tdC = document.createElement('td');
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'scarico-chk';
        chk.dataset.idx = p.idx;
        tdC.appendChild(chk); tr.appendChild(tdC);

        // # (anzianità)
        const tdN = document.createElement('td');
        tdN.textContent = i + 1;
        tr.appendChild(tdN);

        // Pos
        const tdP = document.createElement('td');
        tdP.textContent = p.m.direzione === 'LONG' ? 'BUY' : 'SELL';
        tdP.className = p.m.direzione === 'LONG' ? 'green' : 'red';
        tr.appendChild(tdP);

        // Q.tà aperta (residua)
        const tdQ = document.createElement('td');
        tdQ.textContent = p.residuo;
        tr.appendChild(tdQ);

        // Q.tà da chiudere: default = tutto il residuo, parziale consentita
        const tdQC = document.createElement('td');
        const inQ = document.createElement('input');
        inQ.type = 'number';
        inQ.min = '0';
        inQ.step = '1';
        inQ.max = String(p.residuo);
        inQ.value = p.residuo;
        inQ.className = 'scarico-qta';
        inQ.dataset.idx = p.idx;
        tdQC.appendChild(inQ); tr.appendChild(tdQC);

        // Prezzo open attuale
        const tdPr = document.createElement('td');
        tdPr.textContent = formatPrezzo(p.m.prezzoPulito);
        tr.appendChild(tdPr);

        // P&L stimato della riga (live)
        const tdPnl = document.createElement('td');
        tdPnl.className = 'scarico-pnl muted';
        tr.appendChild(tdPnl);
        tb.appendChild(tr);

        const upd = () => {
          const q = Math.max(0, Math.min(parseFloat(inQ.value) || 0, p.residuo));
          const pnl = (spot - media) * q * p.segno * (molt || 1);
          tdPnl.textContent = q > 0 ? formatEuro(pnl) : '—';
          tdPnl.className = 'scarico-pnl ' + (q > 0 ? (pnl >= 0 ? 'green' : 'red') : 'muted');
          aggiornaTotale();
        };
        chk.addEventListener('change', upd);
        inQ.addEventListener('input', upd);
        updaters.push(upd);
      });
      tbl.appendChild(tb);
      lista.appendChild(tbl);
      box.appendChild(lista);

      // Totale stimato della selezione
      const tot = document.createElement('div');
      tot.className = 'scarico-tot';
      tot.innerHTML = '<span>P&L totale stimato:</span> <strong>—</strong>';
      totPnlEl = tot.querySelector('strong');
      box.appendChild(tot);

      // Azioni
      const actions = document.createElement('div');
      actions.className = 'modal-actions';
      const btnAnnulla = document.createElement('button');
      btnAnnulla.type = 'button';
      btnAnnulla.className = 'btn';
      btnAnnulla.textContent = 'Annulla';
      btnAnnulla.addEventListener('click', chiudiModaleScarico);

      btnConferma = document.createElement('button');
      btnConferma.type = 'button';
      btnConferma.className = 'btn primary';
      btnConferma.textContent = 'Chiudi selezionate';
      btnConferma.disabled = true;
      btnConferma.addEventListener('click', () => {
        const selezione = [];
        overlay.querySelectorAll('.scarico-chk:checked').forEach(chk => {
          const idx = parseInt(chk.dataset.idx, 10);
          const inQ = overlay.querySelector('.scarico-qta[data-idx="' + chk.dataset.idx + '"]');
          const m = scheda[col][idx];
          const residuo = (m.quantita || 0) - Math.min(m.quantitaChiusa || 0, m.quantita || 0);
          const qty = Math.max(0, Math.min(parseFloat(inQ.value) || 0, residuo));
          if (qty > 0) selezione.push({ idx, qty });
        });
        if (!selezione.length) return;
        eseguiScarico(col, selezione, media, spot);
      });

      actions.appendChild(btnAnnulla);
      actions.appendChild(btnConferma);
      box.appendChild(actions);

      // primo calcolo: ora totPnlEl e btnConferma esistono
      updaters.forEach(u => u());

      function aggiornaTotale() {
        let totPnl = 0, nessuna = true;
        overlay.querySelectorAll('.scarico-chk').forEach(chk => {
          if (!chk.checked) return;
          const inQ = overlay.querySelector('.scarico-qta[data-idx="' + chk.dataset.idx + '"]');
          const idx = parseInt(chk.dataset.idx, 10);
          const p = aperte.find(a => a.idx === idx);
          if (!p) return;
          const q = Math.max(0, Math.min(parseFloat(inQ.value) || 0, p.residuo));
          if (q > 0) {
            nessuna = false;
            totPnl += (spot - media) * q * p.segno * (molt || 1);
          }
        });
        totPnlEl.textContent = nessuna ? '—' : formatEuro(totPnl);
        totPnlEl.className = nessuna ? '' : (totPnl >= 0 ? 'green' : 'red');
        btnConferma.disabled = nessuna || !spotOk;
      }

      // Seleziona/deseleziona tutte
      const selTutte = tbl.querySelector('#scaricoSelTutte');
      selTutte.addEventListener('change', () => {
        overlay.querySelectorAll('.scarico-chk').forEach(chk => { chk.checked = selTutte.checked; });
        updaters.forEach(u => u());
      });
    }

    overlay.addEventListener('click', e => {
      if (e.target === overlay) chiudiModaleScarico();
    });
    document.body.appendChild(overlay);
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') chiudiModaleScarico();
  });

  /* ============ ESECUZIONE SCARICO (Average Cost) ============ */
  function eseguiScarico(col, selezione, media, spot) {
    const scheda = schedaAttiva();
    if (!isFinite(media) || !(spot > 0)) return;

    // 1) NORMALIZZAZIONE: il prezzo di carico di TUTTE le posizioni ancora
    //    aperte diventa il prezzo medio corrente (metodo prezzo medio IBKR).
    //    È questo che fa sì che le posizioni residue ereditino il prezzo
    //    medio (es. D resta con la media di C+D) e che la chiusura si
    //    interfacci con la media, non con l'ingresso originario della riga.
    (scheda[col] || []).forEach(m => {
      if (m.attivo === false) return;
      const qAp = m.quantita || 0;
      const residuo = qAp - Math.min(m.quantitaChiusa || 0, qAp);
      if (residuo > 0) m.prezzoPulito = media;
    });

    // 2) CHIUSURA delle posizioni selezionate: q.tà indicata (parziale ok),
    //    prezzo di chiusura = spot attuale, direzione inversa automatica.
    selezione.forEach(s => {
      const m = scheda[col][s.idx];
      if (!m) return;
      const qAp = m.quantita || 0;
      const giaChiusa = Math.min(m.quantitaChiusa || 0, qAp);
      m.quantitaChiusa = Math.min(giaChiusa + s.qty, qAp);
      m.direzioneClose = direzioneInversa(m.direzione);
      m.prezzoClose = spot;
    });

    chiudiModaleScarico();
    renderMovimenti(col);
    calcolaTutto();   // ricalcola RLZD, totali, autosave
    mostraStatus('✓ Posizione scaricata');
  }
})();
