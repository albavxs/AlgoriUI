# Contrato de UI Core

## Intencao visual

AlgoriUI deve parecer um produto editorial e uma creative tool, nao um dashboard tecnico agressivo. A base visual precisa ser dark neutral, puxando para grafite e cinza profundo, com luz difusa e materiais suaves.

As cores dos algoritmos existem como acento e feedback contextual. Elas nao devem dominar o background global nem transformar a UI core em um mosaico saturado.

## Regras obrigatorias

- O background global deve ser uma mistura escura neutra, sem preto puro dominante.
- O background core nao pode usar grid, quadradinhos, matrix, blueprint ou qualquer overlay tecnico semelhante.
- Home e `/aprenda` devem compartilhar a mesma fundacao visual: background, superfices, bordas, sombras e blur.
- Topbar de desktop deve ficar transparente na home e no `/aprenda`.
- Topbar mobile pode usar glass/translucidez para contraste, toque e safe areas.
- Cards, paines e shells devem parecer camadas suaves sobre o fundo, nunca blocos chapados muito pretos.
- Acentos dinamicos de algoritmo devem funcionar como glow ou detalhe local, nao como base da pagina inteira.

## Sistema de superfices

- `body` define a base global do produto.
- `app-shell` e `learn-shell` adicionam atmosfera local e refinam a leitura do contexto, mas nao substituem a fundacao global.
- `panel-card`, `code-window`, `learn-card`, `learn-nav` e `learn-image-slot` usam a mesma familia visual de material.
- Bordas devem ser finas e frias, com contraste baixo.
- Sombras devem ser largas e macias, sem cara de card elevado de dashboard.

## Topbars e breakpoints

- Desktop:
  - `.site-topbar` e `.learn-topbar` sem background visivel.
  - O layout continua com o mesmo alinhamento e spacing, mas sem placa escura atras.
- Mobile:
  - `.site-topbar` e `.learn-topbar` voltam a usar glass/translucidez.
  - Safe areas devem ser respeitadas.
  - A topbar nao pode colidir com hero, titulo ou navegacao.

## Mobile e safe area

- Nao pode existir overflow horizontal na home nem no `/aprenda`.
- Hero, badges e topbar precisam caber em viewport estreita sem cortes laterais.
- Nav pills do `/aprenda` devem permanecer visiveis e tocaveis no mobile.
- A rota `/aprenda` precisa continuar facil de acessar pela home em tela pequena.

## Comportamentos que contam como regressao

- Fundo preto com quadradinhos, grid ou overlay tecnico.
- Topbar desktop com placa pesada, escura ou glass quando deveria estar transparente.
- Hero colado demais na topbar.
- Badge, pill, titulo ou CTA cortado no mobile.
- Overflow horizontal em qualquer pagina core.
- Home e `/aprenda` com materiais visuais desconectados.
- `MiniVisualizer` do `/aprenda` avancando apenas um frame por clique.
- Audio soft local do `/aprenda` deixando de ser o comportamento padrao.

## Checklist antes de merge

- Home desktop com topbar transparente e hero respirando.
- `/aprenda` desktop com topbar transparente e consistencia visual com a home.
- Home mobile com topbar glass, sem overflow lateral.
- `/aprenda` mobile com topbar glass, badges completos e sem corte lateral.
- Background geral lido como grafite/cinza escuro, sem grid.
- Cards e paines ainda legiveis com contraste suficiente.
- `MiniVisualizer` com `play`, `pause`, `replay` e speed por card funcionando.
- `npm run build` e `npm run typecheck` passando.

## Como usar este documento

Toda mudanca em UI core deve ser comparada contra este contrato. Se a mudanca quebrar qualquer item acima, ela deve ser tratada como regressao visual ou ergonomica, nao como preferencia subjetiva.
