# AlgoriUI

Visualizador interativo de algoritmos — escreva código em **TypeScript, JavaScript ou Python** e assista à animação em tempo real.

## Stack

- Next.js 15 (App Router)
- React + TypeScript
- Monaco Editor
- Framer Motion
- Zustand
- Pyodide (runner Python no browser)

## Funcionalidades

- Editor com troca de linguagem (TS/JS/Python)
- Algoritmos prontos: Bubble Sort, Cocktail Sort, Selection Sort, Heap Sort, Bucket Sort, Radix Sort, Stalin Sort, BFS, DFS
- Visualizações: barras, heap tree, grid de labirinto
- Timeline de eventos com play/pause/step/scrub
- Efeitos sonoros reativos com toggle e volume
- Página `/aprenda` com mini-visualizadores e explicações
- i18n PT/EN
- Persistência local
- Compartilhamento por URL comprimida

## Rodar local

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Build de produção

```bash
npm run build
npm run start
```

## Créditos

Alguns algoritmos apresentados neste projeto são baseados no livro:

> **Entendendo Algoritmos: Um guia ilustrado para programadores e outros curiosos**
> Aditya Y. Bhargava — Novatec Editora

## Licença

MIT — veja [LICENSE](./LICENSE).
