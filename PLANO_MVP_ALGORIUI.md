# AlgoriUI V1 - Editor + Visualização de Algoritmos (Vercel)

## Resumo
- MVP mobile-first inspirado no vídeo (estilo, sem cópia 1:1).
- Suporte V1 a TypeScript, JavaScript e Python.
- Execução browser-only (sem API complexa no backend): TS/JS em Web Worker e Python com Pyodide.
- Visualizações V1: Sorting + Busca Binária + Grafos (BFS/DFS).
- Sem login no V1: localStorage + URL compartilhável + export/import JSON.
- UI bilíngue: PT-BR e EN.

## Stack Recomendada
- Next.js 15 + React + TypeScript
- Tailwind CSS + Framer Motion
- Monaco Editor
- Pyodide (Python no browser)
- Web Workers (isolamento de execução)
- Zustand (estado)
- Zod (validação de contratos)
- next-intl (i18n PT/EN)

### Alternativas
1. Vite + React + TypeScript (mais simples, menos integrado ao ecossistema Vercel).
2. SvelteKit + TypeScript (boa performance, maior curva para equipes React).

## Arquitetura (Decision Complete)
- Estrutura sugerida:
  - `apps/web` -> UI, runners, páginas
  - `packages/execution-core` -> contratos e normalização de traces
  - `packages/viz-kit` -> componentes de animação
- Contrato de execução:
  - `ExecutionRequest { language: "ts" | "js" | "python", source, input?, timeoutMs }`
  - `ExecutionResult { ok, events, stdout?, stderr?, durationMs }`
- Contrato de animação por eventos via `emitStep(event)` em todas as linguagens.

### Runners
1. TS/JS:
   - Executa em Web Worker.
   - Timeout e cancelamento.
2. Python:
   - Pyodide em Worker dedicado.
   - Bridge `emitStep` Python -> JS.

## UI/UX
- Layout vertical mobile-first:
  - Header com nome/descrição/complexidade.
  - Palco central de animação.
  - Editor inferior com Monaco e abas de linguagem.
  - Controles de playback (run, pause, step, scrub timeline, reset).
- Estética:
  - Tema escuro com grid/neon.
  - Animações suaves de entrada e transições de estados.
- Templates iniciais por algoritmo e por linguagem.

## Persistência e Compartilhamento
- Autosave local por projeto.
- Export/import de projeto em JSON.
- Compartilhamento por URL com payload compactado.

## Internacionalização
- Interface bilíngue PT-BR/EN com dicionários.
- Textos de UI e templates localizados.

## Testes e Critérios de Aceite
- Unit:
  - Validação dos `TraceEvent`.
  - Serializer/parser de URL e JSON.
- Integração:
  - Execução TS/JS com timeout/cancel.
  - Execução Python via Pyodide com bridge de eventos.
- E2E (Playwright):
  - Fluxo mobile: editar, rodar, pausar, scrub, reset.
  - Fluxo desktop responsivo.
  - Troca de idioma PT/EN.
  - Share URL + import/export.

### Aceite funcional
1. Usuário roda e visualiza pelo menos 1 algoritmo de cada módulo (sorting, busca, grafo).
2. Experiência fluida no mobile e funcional no desktop.
3. Deploy funcional na Vercel sem infraestrutura extra.

## Roadmap Fase 2
- Expandir para mais linguagens (ex.: C++ e Java) com executor server-side isolado.
- Avaliar migração para arquitetura híbrida quando volume e requisitos de isolamento crescerem.

## Assumptions
- Prioridade da V1: velocidade de entrega + UX forte.
- Sem autenticação nesta fase.
- "Diversas linguagens" no sentido amplo será ampliado na Fase 2.
