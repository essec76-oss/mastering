// schede.js — schede multi-scenario: Matrice e comparazioni
// Parte di Mastering (già app.js): l'ordine di caricamento è definito in index.html.
// v27 — P&L lordo, nessun riferimento a commissioni.

  function renderTabs() {
    const wrap = el('schedeTabs');
    if (!wrap) return;
    wrap.innerHTML = '';
    stato.schede.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'scheda-tab' + (i === stato.attiva ? ' active' : '');
      b.title = i === 0
        ? 'Scheda principale Matrice — non rimovibile'
        : 'Scheda comparazione: modifica la strategia e confrontala sul grafico con la scheda precedente';
      const nome = document.createElement('span');
      nome.textContent = s.nome;
      b.appendChild(nome);
      if (i > 0) {
        const x = document.createElement('span');
        x.className = 'tab-close';
        x.textContent = '×';
        x.title = 'Rimuovi "' + s.nome + '"';
        x.addEventListener('click', ev => {
          ev.stopPropagation();
          if (!confirm(`Rimuovere la scheda "${s.nome}"?\n\nTutte le sue righe (futures e opzioni) verranno eliminate.`)) return;
          rimuoviScheda(i);
        });
        b.appendChild(x);
      }
      b.addEventListener('click', () => selezionaScheda(i));
      wrap.appendChild(b);
    });
  }

  function selezionaScheda(i) {
    if (i < 0 || i >= stato.schede.length || i === stato.attiva) return;
    stato.attiva = i;
    renderTabs();
    renderScheda();
  }

  function renderScheda() {
    const scheda = schedaAttiva();
    document.body.classList.toggle('scheda-comp', stato.attiva > 0);
    if (typeof applicaModalita === 'function') {
      applicaModalita(stato.modalita || MODALITA_DEFAULT);
    } else {
      el('tipoNES').value = scheda.tipoNES || 'NES';
      el('tipoMES').value = scheda.tipoMES || 'MES';
      if (el('strumentoOpzioni')) el('strumentoOpzioni').value = scheda.strumentoOpzioni || 'MES';
      renderMovimenti('NES');
      renderMovimenti('MES');
      renderOpzioni();
      calcolaTutto();
    }
  }

  function creaComparazione() {
    const clone = JSON.parse(JSON.stringify(schedaAttiva()));
    clone.nome = 'Comparazione ' + stato.schede.length;
    stato.schede.push(clone);
    stato.attiva = stato.schede.length - 1;
    renderTabs();
    renderScheda();
    mostraStatus('✓ ' + clone.nome + ' creata');
  }

  function rimuoviScheda(i) {
    if (i <= 0) return;
    stato.schede.splice(i, 1);
    if (stato.attiva >= i) stato.attiva = Math.max(0, stato.attiva - 1);
    _rinominaComparazioni();
    renderTabs();
    renderScheda();
  }

  function _rinominaComparazioni() {
    for (let i = 1; i < stato.schede.length; i++) {
      stato.schede[i].nome = 'Comparazione ' + i;
    }
  }

  function aggiornaLegendaGrafico() {
    const wrap = el('legendSchede');
    if (!wrap) return;
    const corrente = schedaAttiva();
    const precedente = schedaPrecedente();
    const voci = [];
    voci.push(`<span><i style="background:${COLORE_CORRENTE};"></i> ${corrente ? corrente.nome : 'Corrente'} (corrente)</span>`);
    if (precedente) {
      voci.push(`<span><i style="background:${COLORE_PRECEDENTE};"></i> ${precedente.nome} (precedente)</span>`);
    }
    wrap.innerHTML = voci.join('');
  }
