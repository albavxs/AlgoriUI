# AlgoriUI

Projeto MVP para escrever algoritmos em **TypeScript, JavaScript e Python** e visualizar animações em tempo real.

## Stack
- Next.js 15 (App Router)
- React + TypeScript
- Monaco Editor
- Framer Motion
- Zustand
- Pyodide (runner Python no browser)

## Funcionalidades
- Editor com troca de linguagem (TS/JS/Python)
- Algoritmos prontos:
  - Bubble Sort
  - Stalin Sort
  - Binary Search
  - BFS
  - DFS
- Timeline de eventos com play/pause/step/scrub
- Efeitos sonoros reativos por evento com toggle e volume
- Visualizações:
  - Barras (sorting/search)
  - Grafo (BFS/DFS)
- i18n PT/EN
- Persistência local
- Compartilhamento por URL comprimida
- Export/import JSON

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

## Deploy na Vercel
- Framework preset: `Next.js`
- Build command: `npm run build`
- Output: automático do Next.js
- Variáveis de ambiente: nenhuma obrigatória no V1

## Observações
- Runner Python usa Pyodide via CDN e pode demorar mais no primeiro run.
- O contrato de animação é baseado em `emitStep({ t: "...", ... })`.
