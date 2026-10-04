#!/usr/bin/env node
// scripts/modularizza.mjs — divide js/app.js in moduli indipendenti.
// Garanzie: (1) la concatenazione dei moduli nell'ordine di caricamento è
// byte-identica al vecchio js/app.js; (2) ogni modulo supera node --check.
// Se una qualunque verifica fallisce lo script esce con errore e NON committa.

import { readFileSync, writeFileSync, unlinkSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';

const run = (cmd) => execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();

const HEADER_LINES = 2;
const HEADER_NOTE = "// Parte di Mastering (già app.js): l'ordine di caricamento è definito in index.html.";

const MODULES = [
  { file: 'config.js',         banner: null, desc: 'costanti, moltiplicatori, stato iniziale e helper DOM' },
  { file: 'matematica.js',     banner: 'MATEMATICA BLACK-76 (per opzioni su futures)', desc: 'modelli Black-76 / Black-Scholes, probabilità e helper data' },
  { file: 'futures.js',        banner: 'CALCOLO COLONNA', desc: 'calcolo colonna futures: prezzo medio e P&L' },
  { file: 'opzioni.js',        banner: 'OPZIONI', desc: 'P&L opzioni: valore nominale, singola riga, totale' },
  { file: 'render-futures.js', banner: 'RENDER', desc: 'render tabelle futures e righe totali' },
  { file: 'render-opzioni.js', banner: 'OPZIONI RENDER', desc: 'render opzioni: greche, colonne extra e P&L combinato' },
  { file: 'grafico.js',        banner: 'PAYOFF COMBINATO', desc: 'grafico payoff: range, breakeven, POP, zoom e touch' },
  { file: 'calcola-tutto.js',  banner: 'CALCOLA TUTTO', desc: 'ricalcolo globale e header di riepilogo' },
  { file: 'schede.js',         banner: 'SCHEDE: MATRICE + COMPARAZIONI', desc: 'schede multi-scenario: Matrice e comparazioni' },
  { file: 'storage.js',        banner: 'UTILITY', desc: 'persistenza localStorage, migrazioni e stato di salvataggio' },
  { file: 'eventi.js',         banner: 'EVENTI', desc: 'binding degli eventi interfaccia' },
  { file: 'main.js',           banner: 'AVVIO', desc: 'avvio: valori di default e primo render' },
];

const fail = (msg) => { console.error('ERRORE: ' + msg); process.exit(1); };

const src = readFileSync('js/app.js', 'utf8');
const lines = src.split('
');

// --- individua i banner di sezione (commento ====== / titolo / ======) ---
const banners = [];
for (let i = 0; i < lines.length - 2; i++) {
  const isBar = (l) => /^ {2}//\s*=+\s*$/.test(l || '');
  if (isBar(lines[i]) && isBar(lines[i + 2])) {
    const m = (lines[i + 1] || '').match(/^ {2}\/\/\s*(\S.*?)\s*$/);
    if (m) banners.push({ line: i, title: m[1] });
  }
}
console.log('Banner trovati: ' + banners.length);
if (banners.length !== MODULES.length - 1) fail('attesi ' + (MODULES.length - 1) + ' banner, trovati ' + banners.length);

// --- assegna gli intervalli di righe a ogni modulo ---
let cursor = 0;
for (const mod of MODULES) {
  if (mod.banner === null) { mod.start = 0; continue; }
  const b = banners.filter(x => x.title === mod.banner);
  if (b.length !== 1) fail('banner non univoco: "' + mod.banner + '"');
  mod.start = b[0].line;
}
for (let k = 0; k < MODULES.length; k++) {
  MODULES[k].end = (k + 1 < MODULES.length ? MODULES[k + 1].start - 1 : lines.length - 1);
  if (MODULES[k].end < MODULES[k].start) fail('intervallo vuoto per ' + MODULES[k].file);
}

// --- scrive i moduli (header di 2 righe + contenuto originale) ---
for (const mod of MODULES) {
  const content = lines.slice(mod.start, mod.end + 1).join('
');
  const header = '// ' + mod.file + ' — ' + mod.desc + '
' + HEADER_NOTE + '
';
  writeFileSync('js/' + mod.file, header + content);
}

// --- verifica 1: ricostruzione byte-identica (senza gli header) ---
const recon = MODULES
  .map(m => readFileSync('js/' + m.file, 'utf8').split('
').slice(HEADER_LINES).join('
'))
  .join('
');
if (recon !== src) fail('ricostruzione non identica al vecchio js/app.js');
console.log('OK ricostruzione byte-identica (' + src.length + ' caratteri)');

// --- verifica 2: sintassi di ogni modulo ---
for (const mod of MODULES) run('node --check js/' + mod.file);
console.log('OK node --check su tutti i ' + MODULES.length + ' moduli');

// --- aggiorna index.html con i tag script in ordine ---
const tag = '<script src="js/app.js"></script>';
const html = readFileSync('index.html', 'utf8');
if (html.split(tag).length !== 2) fail('tag script app.js non trovato (o presente più volte) in index.html');
const tags = MODULES.map(m => '<script src="js/' + m.file + '"></script>').join('
');
writeFileSync('index.html', html.replace(tag, tags));

// --- pulizia: file monolitico, file di supporto e workflow di appoggio ---
unlinkSync('js/app.js');
rmSync('.split', { recursive: true, force: true });
rmSync('scripts', { recursive: true, force: true });
rmSync('.github/workflows', { recursive: true, force: true });
console.log('MODULARIZZAZIONE COMPLETATA');
