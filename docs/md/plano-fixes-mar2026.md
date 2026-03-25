# Plano: Corrigir bug Heap Sort + animações Radix/Stalin desktop + levantamento geral

## Contexto

O projeto AlgoriUI tem 3 problemas:

1. **Heap Sort falha ao executar** — Erro `run@...Function:20:18` aponta para `const arr = [...input]`. O `input` chega como objeto não-iterável em vez de array. A validação em `page.tsx:1551` usa `typeof parsed.value !== "object"`, que aceita tanto arrays quanto objetos `{}`. O worker em `js-runner.js:70` usa `event.data?.input ?? []` que não valida se é array.
2. **Radix Sort e Stalin Sort ficam melhores no mobile** — containers `.heap-wrap`, `.radix-wrap`, `.bucket-wrap` não têm constraint de altura (`--viz-stage-height`), e `.bars-wrap` tem `gap: 8px` fixo (vs `clamp()` nos outros).
3. **Levantamento geral** — documentado no final.

---

## Arquivos a modificar

1. `app/page.tsx` — validação de input
2. `public/workers/js-runner.js` — normalização de input no worker
3. `app/globals.css` — constraints de altura e gap responsivo

---

## Parte 1: Bug de execução do Heap Sort

### 1A. Validação mais inteligente em `app/page.tsx` (linha 1551)

```typescript
// DE:
if (!parsed.ok || parsed.value == null || typeof parsed.value !== "object") {

// PARA:
if (!parsed.ok || parsed.value == null || typeof parsed.value !== "object") {
```

Na verdade, a validação genérica precisa aceitar objetos (BFS/DFS usam `{grid, start, end}`). A correção deve ser no **worker**, não na validação.

### 1B. Normalização de input no worker `public/workers/js-runner.js` (linha 70)

```javascript
// DE:
const input = event.data?.input ?? [];

// PARA:
const rawInput = event.data?.input;
const input = (rawInput != null && typeof rawInput === "object") ? rawInput : [];
```

Isso já resolve parcialmente, mas a proteção principal deve ser no template.

### 1C. Proteção no template Heap Sort em `lib/algorithms.ts` (linhas 890, 925, 960)

Adicionar validação no início de `run()` nos 3 templates:

**TypeScript (linha 890):**
```typescript
async function run(input: number[]) {
  const arr = Array.isArray(input) ? [...input] : [];
```

**JavaScript (linha 925):**
```javascript
async function run(input) {
  const arr = Array.isArray(input) ? [...input] : [];
```

**Python (linha 960):**
```python
def run(input_data):
    arr = list(input_data) if hasattr(input_data, '__iter__') else []
```

> Nota: O mesmo padrão `const arr = [...input]` existe em TODOS os sorting algorithms (bubble, stalin, selection, cocktail, bucket, radix). Para consistência, adicionar `Array.isArray` check em todos eles. Mas como prioridade, heap sort é o que o user reportou.

---

## Parte 2: Animações Radix/Stalin no desktop (CSS)

**Arquivo:** `app/globals.css`

### 2A. Adicionar wrappers ao seletor base de altura (linhas 479-486)

```css
/* DE: */
.bars-wrap,
.graph-stage,
.maze-stage,
.viz-empty {

/* PARA: */
.bars-wrap,
.graph-stage,
.maze-stage,
.viz-empty,
.heap-wrap,
.radix-wrap,
.bucket-wrap {
```

### 2B. Gap responsivo em `.bars-wrap` (linha 491)

```css
/* DE: */  gap: 8px;
/* PARA: */ gap: clamp(2px, 1vw, 8px);
```

### 2C. Adicionar wrappers ao seletor desktop `@media (min-width: 980px)` (linhas 1366-1371)

```css
/* Adicionar: */
  .heap-wrap,
  .radix-wrap,
  .bucket-wrap {
```

### 2D. Adicionar wrappers ao seletor mobile `@media (max-width: 640px)` (linhas 1470-1476)

```css
/* Adicionar: */
  .heap-wrap,
  .radix-wrap,
  .bucket-wrap {
```

### 2E. Limpar wrappers individuais

- `.heap-wrap` (1727-1728): remover `width: 100%; height: 100%;`, adicionar `overflow: hidden;`
- `.radix-wrap` (1824-1825): remover `width: 100%; height: 100%;`, adicionar `overflow: hidden;`
- `.bucket-wrap` (1752-1753): remover `width: 100%; height: 100%;`, adicionar `overflow: hidden;`

### 2F. Cap do SVG heap (1735-1738)

```css
.heap-svg {
  width: 100%;
  flex: 1;
  min-height: 0;
  max-height: 240px;
}
```

### 2G. Radix bars altura responsiva (linha 1836)

```css
/* DE: */  height: 90px;
/* PARA: */ height: clamp(50px, 25%, 90px);
```

---

## Levantamento geral do projeto

### Stack
- Next.js 15 + React 19 + TypeScript 5.9
- Monaco Editor, Framer Motion, Zustand, Pyodide (Python no browser)

### Algoritmos (10)
- **Sorting:** Bubble, Cocktail, Selection, Heap, Bucket, Radix, Stalin
- **Graphs:** BFS, DFS (pathfinding em maze)
- **Custom:** template editável

### Visualizadores (5 tipos)
- `sorting` — barras com compare/swap/done
- `heap` — árvore binária SVG + mini barras
- `bucket` — distribuição em buckets
- `radix` — barras + count array + output array por dígito
- `maze/graph` — grid 2D com visitados/caminho

### Rotas
- `/` — editor principal com visualizador, timeline, código Monaco
- `/aprenda` — página educacional com mini-visualizadores e conteúdo baseado no livro "Grokking Algorithms"

### Features notáveis
- 3 linguagens: TypeScript, JavaScript, Python
- i18n: PT/EN
- Sistema de som com 4 presets (Soft, Balanced, Punchy, Piano)
- Compartilhamento via URL comprimida (lz-string)
- Web Workers para execução sandboxed
- Timeline com scrubbing de eventos
- Editor multi-arquivo por algoritmo
- Responsivo com breakpoints 640px e 980px

---

## Parte 3: Organização de MDs

Criar `docs/md/` e mover:
- `CHANGELOG.md` → `docs/md/CHANGELOG.md`
- `doc_core.md` → `docs/md/doc_core.md`
- Salvar o plano como `docs/md/plano-fixes-mar2026.md`
- `README.md` permanece na raiz

## Parte 4: Fix bookRef duplicado na /aprenda (`app/aprenda/page.tsx`)

Bubble Sort (linha 29) e Selection Sort (linha 69) têm o mesmo `bookRef`:
```
"Entendendo Algoritmos — Cap. 2: Ordenação por seleção"
```

O Cap. 2 do livro é sobre Selection Sort. Bubble Sort não tem capítulo dedicado no livro.

**Fix:** Mudar o `bookRef` do Bubble Sort para algo como:
```typescript
bookRef: {
  pt: "Algoritmo clássico de ordenação por comparação",
  en: "Classic comparison-based sorting algorithm"
}
```

As descrições (`description`) e dicas (`keyIdea`, `editorTip`) já são distintas e corretas.

---

## Verificação

1. **Heap Sort**: executar com input default `[4, 10, 3, 5, 1, 7, 9, 2, 6, 8]` — deve completar sem erro
2. **Heap Sort com input inválido**: mudar input para `{}` — deve mostrar mensagem de erro ou array vazio, não crash
3. **Desktop (>980px)**: Heap Sort deve mostrar árvore SVG contida; Radix/Stalin com gaps proporcionais
4. **Mobile (<640px)**: comportamento deve permanecer idêntico ao atual
5. **Bucket Sort**: verificar que grid de buckets continua visível com 10+ buckets
