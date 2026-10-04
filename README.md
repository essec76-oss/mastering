# Mastering

Gestione simultanea di futures NES / MES / ES / X e opzioni (MES, ES, AZIONI) — metodo prezzo medio (IBKR):
payoff combinato a scadenza e Now, breakeven, POP, bande sigma, greche di posizione e schede multi-scenario (Matrice + comparazioni).

## Struttura

- `index.html` — interfaccia e ordine di caricamento degli script
- `css/style.css` — stili
- `js/` — moduli JavaScript (nessun bundler: script classici caricati in ordine da `index.html`)

## Moduli (ordine di caricamento)

1. `config.js` — costanti, moltiplicatori, stato iniziale e helper DOM
2. `matematica.js` — modelli Black-76 / Black-Scholes, probabilità e helper data
3. `futures.js` — calcolo colonna futures: prezzo medio e P&L
4. `opzioni.js` — P&L opzioni: valore nominale, singola riga, totale
5. `render-futures.js` — render tabelle futures e righe totali
6. `render-opzioni.js` — render opzioni: greche, colonne extra e P&L combinato
7. `grafico.js` — grafico payoff: range, breakeven, POP, zoom e touch
8. `calcola-tutto.js` — ricalcolo globale e header di riepilogo
9. `schede.js` — schede multi-scenario: Matrice e comparazioni
10. `storage.js` — persistenza localStorage, migrazioni e stato di salvataggio
11. `eventi.js` — binding degli eventi interfaccia
12. `main.js` — avvio: valori di default e primo render

## Nota tecnica

I moduli derivano dalla suddivisione del vecchio `js/app.js` lungo le sezioni originali del file.
La concatenazione dei moduli nell'ordine 1–12 riproduce **esattamente** il codice precedente
(ricostruzione byte-identica e `node --check` su ogni modulo verificati in CI al momento dello split).
Si usano script classici (non ES module) e nessun bundler: la pagina funziona anche aprendo
`index.html` direttamente da disco (`file://`).
