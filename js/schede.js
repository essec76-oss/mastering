// schede.js — schede multi-scenario: Matrice e comparazioni
// Parte di Mastering (già app.js): l ordine di caricamento è definito in index.html.
  // ============================================================
  // SCHEDE: MATRICE + COMPARAZIONI
  // ============================================================
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
        : 'Scheda comparazione: modifica la strategia e confrontala sul grafico';
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

  // Riporta la pagina sui dati della scheda attiva (valori solo della scheda)
  function renderScheda() {
    const scheda = schedaAttiva();
    // Tema arancione + pulsante "Promuovi" solo sulle schede comparazione
    document.body.classList.toggle('scheda-comp', stato.attiva > 0);
    const btnP = el('btnPromuovi');
    if (btnP) btnP.style.display = stato.attiva > 0 ? '' : 'none';
    el('tipoNES').value = scheda.tipoNES || 'NES';
    el('tipoMES').value = scheda.tipoMES || 'MES';
    if (el('strumentoOpzioni')) el('strumentoOpzioni').value = scheda.strumentoOpzioni || 'MES';
    renderMovimenti('NES');
    renderMovimenti('MES');
    renderOpzioni();
    calcolaTutto();
  }

  // Clona la scheda attuale in una nuova "Comparazione N"
  function creaComparazione() {
    const clone = JSON.parse(JSON.stringify(schedaAttiva()));
    clone.nome = 'Comparazione ' + stato.schede.length;
    stato.schede.push(clone);
    stato.attiva = stato.schede.length - 1;
    renderTabs();
    renderScheda();
    mostraStatus('✓ ' + clone.nome + ' creata');
  }

  // Le comparazioni si rimuovono, la Matrice mai
  function rimuoviScheda(i) {
    if (i <= 0) return;
    stato.schede.splice(i, 1);
    if (stato.attiva >= i) stato.attiva = Math.max(0, stato.attiva - 1);
    renderTabs();
    renderScheda();
  }

  // Passaggio inverso della comparazione: copia la strategia della
  // comparazione attiva SOPRA la Matrice, che torna la strategia primaria
  // (è la soluzione che hai trasmesso in reale sulla piattaforma).
  // La comparazione non viene cancellata: resta per riferimento.
  function promuoviSuMatrice() {
    if (stato.attiva <= 0) return;
    const comp = schedaAttiva();
    if (!confirm(`Promuovere "${comp.nome}" su Matrice?\n\nLa strategia attuale della Matrice verrà SOSTITUITA da quella di "${comp.nome}".\nLa scheda "${comp.nome}" resterà disponibile per riferimento.`)) return;
    const copia = JSON.parse(JSON.stringify(comp));
    copia.nome = 'Matrice';
    stato.schede[0] = copia;
    stato.attiva = 0;
    renderTabs();
    renderScheda();
    mostraStatus('✓ ' + comp.nome + ' promossa su Matrice');
  }

  // Legenda del grafico: nome e colore di ogni scheda
  function aggiornaLegendaGrafico() {
    const wrap = el('legendSchede');
    if (!wrap) return;
    wrap.innerHTML = stato.schede.map((s, i) =>
      `<span><i style="background:${coloreScheda(i)};"></i> ${s.nome}</span>`).join('');
  }
