"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { algorithms } from "@/lib/algorithms";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import type { AlgorithmId, Locale } from "@/lib/types";
import { MiniVisualizer } from "@/components/MiniVisualizer";

import "./aprenda.css";

// ── Educational content data ─────────────────────────────────────────────────

type LearnSection = {
  algorithmId: AlgorithmId;
  bookRef: Record<Locale, string>;
  description: Record<Locale, string>;
  keyIdea: Record<Locale, string>;
  editorTip: Record<Locale, string>;
  imageSrc?: string;
};

const learnData: LearnSection[] = [
  {
    algorithmId: "bubble-sort",
    bookRef: {
      pt: "Entendendo Algoritmos — Cap. 2: Ordenação por seleção",
      en: "Grokking Algorithms — Ch. 2: Selection Sort"
    },
    description: {
      pt: "Bubble Sort compara pares adjacentes e troca aqueles fora de ordem. A cada passagem, o maior elemento não ordenado 'flutua' para seu lugar correto no final do array.",
      en: "Bubble Sort compares adjacent pairs and swaps those out of order. After each pass, the largest unsorted element 'bubbles' to its correct position at the end of the array."
    },
    keyIdea: {
      pt: "💡 Cada passagem garante que pelo menos um elemento extra esteja em sua posição final.",
      en: "💡 Each pass guarantees at least one more element is in its final position."
    },
    editorTip: {
      pt: "Experimente: mude arr[j] > arr[j+1] para < para ordenar em ordem decrescente.",
      en: "Try: change arr[j] > arr[j+1] to < to sort in descending order."
    },
    imageSrc: "/learn/bubble-sort.png"
  },
  {
    algorithmId: "cocktail-sort",
    bookRef: {
      pt: "Variante bidirecional do Bubble Sort",
      en: "Bidirectional variant of Bubble Sort"
    },
    description: {
      pt: "Cocktail Sort (ou Shaker Sort) é um Bubble Sort que alterna a direção a cada passagem: esquerda→direita, depois direita→esquerda. Isso move grandes e pequenos elementos para suas posições mais rapidamente.",
      en: "Cocktail Sort (Shaker Sort) is a Bubble Sort that alternates direction each pass: left→right, then right→left. This moves both large and small elements toward their positions faster."
    },
    keyIdea: {
      pt: "💡 A varredura bidirecional elimina o problema das 'tartarugas' — elementos pequenos no final que o Bubble Sort arrasta lentamente.",
      en: "💡 Bidirectional scanning eliminates the 'turtle' problem — small elements near the end that Bubble Sort drags slowly."
    },
    editorTip: {
      pt: "Experimente: adicione um contador de trocas para comparar com o Bubble Sort no mesmo input.",
      en: "Try: add a swap counter to compare against Bubble Sort on the same input."
    },
    imageSrc: "/learn/cocktail-sort.png"
  },
  {
    algorithmId: "selection-sort",
    bookRef: {
      pt: "Entendendo Algoritmos — Cap. 2: Ordenação por seleção",
      en: "Grokking Algorithms — Ch. 2: Selection Sort"
    },
    description: {
      pt: "Selection Sort encontra o menor elemento na parte não ordenada e o move para o início. Repete isso até o array estar ordenado. Usa poucas trocas — apenas n-1 — mas muitas comparações.",
      en: "Selection Sort finds the minimum in the unsorted portion and moves it to the front. Repeats until sorted. Uses very few swaps — just n-1 — but many comparisons."
    },
    keyIdea: {
      pt: "💡 Minimiza o número de escritas na memória — útil quando escrever é caro (ex: flash storage).",
      en: "💡 Minimizes memory writes — useful when writes are expensive (e.g., flash storage)."
    },
    editorTip: {
      pt: "Experimente: troque arr[j] < arr[minIndex] por > para ordenar em ordem decrescente.",
      en: "Try: swap arr[j] < arr[minIndex] with > to sort in descending order."
    },
    imageSrc: "/learn/selection-sort.png"
  },
  {
    algorithmId: "heap-sort",
    bookRef: {
      pt: "Baseado em estrutura de dados: Max-Heap (árvore binária)",
      en: "Based on data structure: Max-Heap (binary tree)"
    },
    description: {
      pt: "Heap Sort constrói um Max-Heap a partir do array — uma árvore binária onde cada nó é maior que seus filhos. Em seguida, extrai o máximo repetidamente, construindo o array ordenado de trás para frente.",
      en: "Heap Sort builds a Max-Heap from the array — a binary tree where each node is larger than its children. Then repeatedly extracts the maximum, building the sorted array from back to front."
    },
    keyIdea: {
      pt: "💡 A árvore binária é implícita no próprio array: filho esquerdo de i está em 2i+1, filho direito em 2i+2.",
      en: "💡 The binary tree lives implicitly in the array: left child of i is at 2i+1, right child at 2i+2."
    },
    editorTip: {
      pt: "Experimente: modifique heapify para usar < em vez de > e observe o que acontece.",
      en: "Try: modify heapify to use < instead of > and observe what happens."
    },
    imageSrc: "/learn/heap-sort.png"
  },
  {
    algorithmId: "bucket-sort",
    bookRef: {
      pt: "Algoritmo de distribuição — divide para conquistar",
      en: "Distribution algorithm — divide and conquer"
    },
    description: {
      pt: "Bucket Sort distribui os elementos em baldes com base em seu valor, ordena cada balde individualmente e concatena tudo. Funciona excepcionalmente bem quando os valores estão distribuídos uniformemente.",
      en: "Bucket Sort distributes elements into buckets based on value, sorts each bucket individually, then concatenates. Works exceptionally well when values are uniformly distributed."
    },
    keyIdea: {
      pt: "💡 Ao invés de comparar elementos entre si, o algoritmo usa o valor diretamente para decidir onde cada elemento vai.",
      en: "💡 Instead of comparing elements, the algorithm uses the value directly to decide where each element goes."
    },
    editorTip: {
      pt: "Experimente: mude bucketCount para 3 ou 10 e veja como o tamanho dos baldes muda.",
      en: "Try: change bucketCount to 3 or 10 and watch how bucket sizes change."
    },
    imageSrc: "/learn/bucket-sort.png"
  },
  {
    algorithmId: "radix-sort",
    bookRef: {
      pt: "Algoritmo linear — ordena sem comparações diretas",
      en: "Linear algorithm — sorts without direct comparisons"
    },
    description: {
      pt: "Radix Sort ordena os números dígito por dígito, do menos significativo (unidades) ao mais significativo (milhares). Usa uma ordenação estável interna (Counting Sort) em cada passagem.",
      en: "Radix Sort processes numbers digit by digit, from least significant (units) to most significant (thousands). Uses a stable internal sort (Counting Sort) on each pass."
    },
    keyIdea: {
      pt: "💡 Nunca compara dois elementos diretamente — apenas conta e redistribui por dígito. Isso quebra o limite inferior O(n log n) de algoritmos baseados em comparação.",
      en: "💡 Never directly compares two elements — just counts and redistributes by digit. This breaks the O(n log n) lower bound of comparison-based algorithms."
    },
    editorTip: {
      pt: "Experimente: use um array com números de 3 dígitos para ver as 3 passagens do algoritmo.",
      en: "Try: use an array with 3-digit numbers to watch all 3 passes of the algorithm."
    },
    imageSrc: "/learn/radix-sort.png"
  },
  {
    algorithmId: "stalin-sort",
    bookRef: {
      pt: "Algoritmo humorístico da internet — O(n)",
      en: "Humorous internet algorithm — O(n)"
    },
    description: {
      pt: "Stalin Sort percorre o array uma única vez, mantendo apenas os elementos que são maiores ou iguais ao máximo visto até o momento. Os demais são 'eliminados'. Resulta sempre num array ordenado em O(n).",
      en: "Stalin Sort traverses the array once, keeping only elements greater than or equal to the running maximum. The rest are 'eliminated'. Always produces a sorted array in O(n)."
    },
    keyIdea: {
      pt: "💡 Tecnicamente correto, mas destrói dados. Útil para entender o conceito de 'máximo corrente' e comparar com Selection Sort.",
      en: "💡 Technically correct, but destroys data. Useful for understanding 'running maximum' and contrasting with Selection Sort."
    },
    editorTip: {
      pt: "Experimente: adicione lógica para rejeitar elementos negativos em vez de não-crescentes.",
      en: "Try: add logic to reject negative elements instead of non-increasing ones."
    },
    imageSrc: "/learn/stalin-sort.png"
  },
  {
    algorithmId: "bfs",
    bookRef: {
      pt: "Entendendo Algoritmos — Cap. 6: Pesquisa em largura",
      en: "Grokking Algorithms — Ch. 6: Breadth-First Search"
    },
    description: {
      pt: "BFS explora um grafo nível por nível. Começa no nó inicial, visita todos os vizinhos, depois os vizinhos dos vizinhos. Usa uma fila (FIFO) para controlar a ordem de exploração.",
      en: "BFS explores a graph level by level. Starting from the source node, it visits all neighbors, then their neighbors. Uses a queue (FIFO) to control exploration order."
    },
    keyIdea: {
      pt: "💡 BFS garante o caminho mais curto em grafos não ponderados — encontra a solução com o menor número de arestas.",
      en: "💡 BFS guarantees the shortest path in unweighted graphs — finds the solution with the fewest edges."
    },
    editorTip: {
      pt: "Experimente: adicione pesos às arestas e veja por que BFS não garante mais o caminho ótimo.",
      en: "Try: add edge weights and see why BFS no longer guarantees the optimal path."
    },
    imageSrc: "/learn/bfs.png"
  },
  {
    algorithmId: "dfs",
    bookRef: {
      pt: "Baseado no Cap. 6 de Entendendo Algoritmos — variante em profundidade",
      en: "Based on Grokking Algorithms Ch. 6 — depth-first variant"
    },
    description: {
      pt: "DFS explora um grafo o mais fundo possível antes de retroceder. Usa uma pilha (LIFO) — explícita ou via recursão. Bom para detecção de ciclos, ordenação topológica e componentes conexos.",
      en: "DFS explores as deep as possible before backtracking. Uses a stack (LIFO) — explicit or via recursion. Great for cycle detection, topological sort, and connected components."
    },
    keyIdea: {
      pt: "💡 DFS não garante o caminho mais curto, mas usa menos memória que BFS em grafos largos e rasos.",
      en: "💡 DFS doesn't guarantee shortest path, but uses less memory than BFS on wide, shallow graphs."
    },
    editorTip: {
      pt: "Experimente: conte os componentes conexos executando DFS repetidamente de nós não visitados.",
      en: "Try: count connected components by running DFS repeatedly from unvisited nodes."
    },
    imageSrc: "/learn/dfs.png"
  }
];

// ── Component ────────────────────────────────────────────────────────────────

export default function AprendaPage() {
  const { locale, setLocale } = useAppStore();

  const categoryLabel = (algorithmId: AlgorithmId): string => {
    const alg = algorithms.find((a) => a.id === algorithmId);
    if (!alg) return "";
    if (alg.category === "graph") return t(locale, "learnCategoryGraph");
    return t(locale, "learnCategorySort");
  };

  return (
    <main className="learn-shell">
      {/* Topbar */}
      <header className="learn-topbar">
        <Link href="/" className="learn-back-btn">
          ← {t(locale, "learnBack")}
        </Link>
        <div className="learn-locale-toggle">
          {(["pt", "en"] as const).map((loc) => (
            <button
              key={loc}
              type="button"
              className={`learn-locale-btn ${locale === loc ? "active" : ""}`}
              onClick={() => setLocale(loc)}
            >
              {loc.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      {/* Hero */}
      <section className="learn-hero">
        <h1>{t(locale, "learnPageTitle")}</h1>
        <p>{t(locale, "learnPageSubtitle")}</p>
      </section>

      {/* Sticky nav pills */}
      <nav className="learn-nav" aria-label="Seções">
        {learnData.map((section) => {
          const alg = algorithms.find((a) => a.id === section.algorithmId);
          return (
            <a key={section.algorithmId} href={`#${section.algorithmId}`} className="learn-nav-pill">
              {alg?.title[locale] ?? section.algorithmId}
            </a>
          );
        })}
        <a href="#como-usar" className="learn-nav-pill">
          {t(locale, "learnHowToUse")}
        </a>
      </nav>

      {/* Algorithm sections */}
      {learnData.map((section) => {
        const alg = algorithms.find((a) => a.id === section.algorithmId);
        if (!alg) return null;

        return (
          <motion.section
            key={section.algorithmId}
            id={section.algorithmId}
            className="learn-card"
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.36, ease: "easeOut" }}
          >
            <div className="learn-card-header">
              <span className="learn-category-badge">{categoryLabel(section.algorithmId)}</span>
              <div className="learn-complexity-row">
                <span className="learn-complexity-pill">T: {alg.complexity.time}</span>
                <span className="learn-complexity-pill">S: {alg.complexity.space}</span>
              </div>
            </div>

            <h2>{alg.title[locale]}</h2>
            <p className="learn-book-ref">{section.bookRef[locale]}</p>

            <div className="learn-card-body">
              <div className="learn-text-col">
                <p className="learn-description">{section.description[locale]}</p>
                <p className="learn-key-idea">{section.keyIdea[locale]}</p>
                <p className="learn-editor-tip">{section.editorTip[locale]}</p>
                <Link href={`/?algorithm=${section.algorithmId}`} className="learn-try-btn">
                  {t(locale, "learnTryInEditor")} →
                </Link>
              </div>

              <div className="learn-image-slot">
                <MiniVisualizer algorithmId={section.algorithmId} locale={locale} />
              </div>
            </div>
          </motion.section>
        );
      })}

      {/* How to use the editor */}
      <motion.section
        id="como-usar"
        className="learn-card learn-how-to"
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.36, ease: "easeOut" }}
      >
        <h2>{t(locale, "learnHowToUse")}</h2>
        <p className="learn-description" style={{ marginBottom: "16px" }}>
          {t(locale, "learnHowToUseBody")}
        </p>
        <pre className="learn-code-snippet">{`async function run(input) {
  const arr = [...input];

  // Emita o estado inicial
  emitStep({ t: "array", arr: [...arr] });

  for (let i = 0; i < arr.length - 1; i++) {
    // Emita cada comparação
    emitStep({ t: "compare", arr: [...arr], i, j: i + 1 });

    if (arr[i] > arr[i + 1]) {
      [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
      // Emita cada troca
      emitStep({ t: "swap", arr: [...arr], i, j: i + 1 });
    }
  }

  // Emita o estado final
  emitStep({ t: "done", arr: [...arr] });
  return arr;
}`}</pre>
        <div style={{ marginTop: "18px" }}>
          <Link href="/" className="learn-try-btn">
            ← {t(locale, "learnBack")}
          </Link>
        </div>
      </motion.section>

      <footer className="learn-footer">AlgorUI</footer>
    </main>
  );
}
