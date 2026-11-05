// scarico-posizione.js — Bottone «Scarica posizione» + modale di chiusura
// Metodo: Average Cost (prezzo medio di carico, IBKR) — NON FIFO.
// Al momento dello scarico il prezzo medio di carico corrente viene salvato
// sulla riga chiusa (prezzoMedioChiusura): il P&L realizzato resta fisso e
// non cambia quando si scaricano altre posizioni. Il prezzo di carico
// originale (prezzoPulito) non viene mai modificato dallo scarico.
//
// v-edit: Spot e Prezzo di carico sono editabili direttamente nel modale.
//         Se «Prezzo di carico» è vuoto → usa la media automatica.
//         Se è compilato → P&L = Spot_modale − Prezzo_di_carico_digitato.
// L'ordine di caricamento è definito in index.html (dopo eventi.js).
(function () {
  'use strict';

  // Inietta lo stile per le righe bloccate (non cliccabili)
  if (!document.getElementById('style-scarico-blocco')) {
    const style = document.createElement('style');
    style.id = 'style-scarico-blocco';
    style.innerHTML = `
      .tr-bloccata {
        opacity: 0.35;
        pointer-events: none;
        filter: grayscale(100%);
      }
      .tr-bloccata input, .tr-bloccata td {
        cursor: not-allowed !important;
      }
      .scarico-edit-row {
        display: flex;
        flex-wrap: wrap;
        gap: 12px 18px;
        align-items: center;
        margin: 10px 0 6px;
      }
      .scarico-edit-row label {
        display: flex;
        flex-direction: column;
        gap: 3px;
        font-size: 0.85em;
      }
      .scarico-edit-row input[type="number"] {
        width: 110px;
        padding: 4px 6px;
      }
      .scarico-hint {
        font-size: 0.8em;
        opacity: 0.75;
        margin-top: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  /* ============ BOTTONE sotto «+ Aggiungi movimento» ============ */
  document.querySelectorAll('.btn-add[data-col]').forEach(btnAdd => {
    // Evita di creare duplicati se lo script viene eseguito due volte
    if (btnAdd.nextElementSibling && btnAdd.nextElementSibling.classList.contains('btn-scarico')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-add btn-scarico';
    btn.dataset.col = btnAdd.dataset.col;

    btn.style.color = '#ff4d4d';
    btn.style.borderColor = '#ff4d4d';

    btn.textContent = '↓ Scarica posizione';
    btn.title = 'Apre la finestra di chiusura. Puoi editare Spot e Prezzo di carico solo nel modale.';
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
    const mediaAuto = res.mediaPulita;          // media automatica di riferimento
    const spotPagina = parseFloat(el('prezzoSpot').value) || 0;
    const molt = (typeof risolviMoltiplicatore === 'function')
      ? risolviMoltiplicatore(scheda, col) : 1;
    const tipoLabel = (typeof _tipoLabelCol === 'function')
      ? _tipoLabelCol(scheda['tipo' + col], col) : col;

    // Posizioni aperte in ordine di ANZIANITÀ
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

    if (!aperte.length || !isFinite(mediaAuto)) {
      const vuoto = document.createElement('div');
      vuoto.className = 'scarico-empty';
      vuoto.textContent = '— nessuna posizione aperta in questa colonna —';
      box.appendChild(vuoto);
    } else {

      // ---------- Campi editabili: Spot + Prezzo di carico ----------
      const editRow = document.createElement('div');
      editRow.className = 'scarico-edit-row';

      // Spot locale
      const labSpot = document.createElement('label');
      labSpot.innerHTML = 'Spot <span class="scarico-hint">(solo nel modale)</span>';
      const inSpot = document.createElement('input');
      inSpot.type = 'number';
      inSpot.step = '0.25';
      inSpot.id = 'scaricoSpot';
      inSpot.value = spotPagina > 0 ? spotPagina : '';
      inSpot.placeholder = '—';
      labSpot.appendChild(inSpot);
      editRow.appendChild(labSpot);

      // Prezzo di carico (inizialmente vuoto)
      const labCarico = document.createElement('label');
      labCarico.innerHTML = 'Prezzo di carico <span class="scarico-hint">(vuoto = media automatica)</span>';
      const inCarico = document.createElement('input');
      inCarico.type = 'number';
      inCarico.step = '0.25';
      inCarico.id = 'scaricoCarico';
      inCarico.value = '';                 // ← inizialmente vuoto
      inCarico.placeholder = formatPrezzo(mediaAuto);
      labCarico.appendChild(inCarico);
      editRow.appendChild(labCarico);

      box.appendChild(editRow);

      // Nota
      const nota = document.createElement('div');
      nota.className = 'scarico-nota';
      nota.style.marginBottom = '8px';
      nota.textContent = 'P&L = Spot (modale) − Prezzo di carico. Se il campo Prezzo di carico è vuoto viene usata la media automatica (' + formatPrezzo(mediaAuto) + ').';
      box.appendChild(nota);

      // Helper: valori effettivi in questo momento
      function getSpotEff() {
        const v = parseFloat(inSpot.value);
        return (isFinite(v) && v > 0) ? v : 0;
      }
      function getMediaEff() {
        const v = parseFloat(inCarico.value);
        // se il campo è pieno e valido → usa quello, altrimenti media automatica
        return (isFinite(v) && v > 0) ? v : mediaAuto;
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

      const updaters = [];
      const checkboxes = [];
      const trs = [];
      let totPnlEl = null, btnConferma = null;

      aperte.forEach((p, i) => {
        const tr = document.createElement('tr');

        // Checkbox
        const tdC = document.createElement('td');
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'scarico-chk';
        chk.dataset.idx = p.idx;
        checkboxes.push(chk);
        tdC.appendChild(chk); tr.appendChild(tdC);

        // #
        const tdN = document.createElement('td');
        tdN.textContent = i + 1;
        tr.appendChild(tdN);

        // Pos
        const tdP = document.createElement('td');
        tdP.textContent = p.m.direzione === 'LONG' ? 'BUY' : 'SELL';
        tdP.className = p.m.direzione === 'LONG' ? 'green' : 'red';
        tr.appendChild(tdP);

        // Q.tà aperta
        const tdQ = document.createElement('td');
        tdQ.textContent = p.residuo;
        tr.appendChild(tdQ);

        // Q.tà da chiudere
        const tdQC = document.createElement('td');
        const inQ = document.createElement('input');
        inQ.type = 'number';
        inQ.min = '0';
        inQ.step = '1';
        inQ.max = String(p.residuo);
        inQ.value = p.residuo;
        inQ.className = 'scarico-qta';
        inQ.dataset.idx = p.idx;
        inQ.disabled = true;
        tdQC.appendChild(inQ); tr.appendChild(tdQC);

        // Prezzo open
        const tdPr = document.createElement('td');
        tdPr.textContent = formatPrezzo(p.m.prezzoPulito);
        tr.appendChild(tdPr);

        // P&L stimato
        const tdPnl = document.createElement('td');
        tdPnl.className = 'scarico-pnl muted';
        tr.appendChild(tdPnl);
        tb.appendChild(tr);
        trs.push(tr);

        const upd = () => {
          const q = Math.max(0, Math.min(parseFloat(inQ.value) || 0, p.residuo));
          const spotEff = getSpotEff();
          const mediaEff = getMediaEff();
          const pnl = (spotEff > 0 && isFinite(mediaEff))
            ? (spotEff - mediaEff) * q * p.segno * (molt || 1)
            : 0;
          tdPnl.textContent = (q > 0 && spotEff > 0) ? formatEuro(pnl) : '—';
          tdPnl.className = 'scarico-pnl ' + ((q > 0 && spotEff > 0)
            ? (pnl >= 0 ? 'green' : 'red')
            : 'muted');
          aggiornaTotale();
        };
        chk.addEventListener('change', upd);
        inQ.addEventListener('input', upd);
        updaters.push(upd);
      });
      tbl.appendChild(tb);
      lista.appendChild(tbl);
      box.appendChild(lista);

      // --- LOGICA FIFO A CASCATA ---
      function aggiornaStatoCheckbox() {
        for (let i = 0; i < checkboxes.length; i++) {
          const chk = checkboxes[i];
          const inQ = overlay.querySelector('.scarico-qta[data-idx="' + chk.dataset.idx + '"]');
          const tr = trs[i];

          if (i === 0) {
            chk.disabled = false;
            tr.classList.remove('tr-bloccata');
          } else {
            const prevChk = checkboxes[i - 1];
            chk.disabled = !prevChk.checked;
            if (!prevChk.checked && chk.checked) chk.checked = false;
            if (chk.disabled) tr.classList.add('tr-bloccata');
            else tr.classList.remove('tr-bloccata');
          }

          inQ.disabled = !chk.checked;
          if (!chk.checked) inQ.value = inQ.max;
        }
      }

      checkboxes.forEach(chk => {
        chk.addEventListener('change', () => {
          aggiornaStatoCheckbox();
          updaters.forEach(u => u());
        });
      });

      // Totale
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

        const spotEff = getSpotEff();
        const mediaEff = getMediaEff();
        if (!(spotEff > 0) || !isFinite(mediaEff)) return;

        eseguiScarico(col, selezione, mediaEff, spotEff);
      });

      actions.appendChild(btnAnnulla);
      actions.appendChild(btnConferma);
      box.appendChild(actions);

      function aggiornaTotale() {
        let totPnl = 0, nessuna = true;
        const spotEff = getSpotEff();
        const mediaEff = getMediaEff();

        overlay.querySelectorAll('.scarico-chk').forEach(chk => {
          if (!chk.checked) return;
          const inQ = overlay.querySelector('.scarico-qta[data-idx="' + chk.dataset.idx + '"]');
          const idx = parseInt(chk.dataset.idx, 10);
          const p = aperte.find(a => a.idx === idx);
          if (!p) return;
          const q = Math.max(0, Math.min(parseFloat(inQ.value) || 0, p.residuo));
          if (q > 0 && spotEff > 0 && isFinite(mediaEff)) {
            nessuna = false;
            totPnl += (spotEff - mediaEff) * q * p.segno * (molt || 1);
          }
        });
        totPnlEl.textContent = nessuna ? '—' : formatEuro(totPnl);
        totPnlEl.className = nessuna ? '' : (totPnl >= 0 ? 'green' : 'red');
        btnConferma.disabled = nessuna || !(spotEff > 0);
      }

      // Aggiorna P&L quando cambiano Spot o Prezzo di carico
      inSpot.addEventListener('input', () => updaters.forEach(u => u()));
      inCarico.addEventListener('input', () => updaters.forEach(u => u()));

      // Seleziona/deseleziona tutte
      const selTutte = tbl.querySelector('#scaricoSelTutte');
      selTutte.addEventListener('change', () => {
        checkboxes.forEach(chk => { chk.checked = selTutte.checked; });
        aggiornaStatoCheckbox();
        updaters.forEach(u => u());
      });

      // Inizializza
      aggiornaStatoCheckbox();
      updaters.forEach(u => u());
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

    selezione.forEach(s => {
      const m = scheda[col][s.idx];
      if (!m) return;
      const qAp = m.quantita || 0;
      const giaChiusa = Math.min(m.quantitaChiusa || 0, qAp);
      const nuovaChiusa = Math.min(giaChiusa + s.qty, qAp);
      const qDaChiudere = nuovaChiusa - giaChiusa;

      // Salva il prezzo medio di carico usato per questa chiusura
      if (qDaChiudere > 0) {
        const pm = m.prezzoMedioChiusura || { q: 0, prezzo: 0 };
        const qTot = pm.q + qDaChiudere;
        m.prezzoMedioChiusura = {
          q: qTot,
          prezzo: (pm.prezzo * pm.q + media * qDaChiudere) / qTot
        };
      }

      m.quantitaChiusa = nuovaChiusa;
      m.direzioneClose = direzioneInversa(m.direzione);
      m.prezzoClose = spot;   // usa lo spot del modale
    });

    chiudiModaleScarico();
    renderMovimenti(col);
    calcolaTutto();
    const st = el('saveStatus');
    if (st) {
      st.textContent = '✓ Posizione scaricata';
      st.classList.add('show');
      setTimeout(() => st.classList.remove('show'), 2000);
    }
  }
})();
