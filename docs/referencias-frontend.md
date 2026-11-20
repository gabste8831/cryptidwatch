# Referências para o frontend

## Formato: blog / central de relatos

O CryptidWatch funciona como um blog comunitário: cada avistamento é um "post" com
título, descrição, fotos, local e data, e outras pessoas comentam. O fluxo de
moderação lembra os bancos de relatos reais citados abaixo.

## Plataformas de referência

| Plataforma | O que aproveitar |
|---|---|
| [BFRO](https://www.bfro.net) (Bigfoot Field Researchers Organization) | Banco de relatos enviados pelo público, com mapa por região e **classificação de credibilidade** (Classe A/B/C). Ideia: selo de credibilidade dado pelo moderador. |
| [NUFORC](https://nuforc.org/) (relatos de OVNI) | Mais de 150 mil relatos; navegação por data, estado e formato; triagem antes de publicar e destaque dos casos mais interessantes. Ideia: "casos em destaque" na home. |
| [iNaturalist](https://www.inaturalist.org) | Página da observação com a **evidência (foto) primeiro**, depois o táxon, mapa e comentários/identificações da comunidade. Layout responsivo. Ideia: estrutura da página do avistamento. |
| [Atlas Obscura](https://www.atlasobscura.com) | Lugares estranhos enviados por usuários, com tom editorial e mapa. Ideia: cards com foto grande + título forte. |
| Mapas de fãs do BFRO ([Bigfoot Map](https://north-ross.github.io/BigfootMap), [Geography Realm](https://www.geographyrealm.com/mapping-92-years-bigfoot-sightings/)) | Mapa de calor/pontos dos avistamentos. Ideia: mapa do Brasil com os relatos aprovados. |

## Referências de estética

- **Arquivo confidencial / dossiê:** padrão recorrente de fundo escuro, tipografia de máquina
  de escrever, tarjas de censura, carimbos e pastas
  ([tema Dossier do Obsidian](https://community.obsidian.md/themes/dossier),
  [Mosby's Files – Tubik](https://tubikstudio.com/works/mosbyfiles),
  [Anomaly Agency](https://weblog-3xw.pages.dev/blog/posts/2024-01-08_AnomalyAgency-WebDev-Project),
  ["Do You Still Believe?" – Awwwards](https://awwwards.com/sites/do-you-still-believe)).
- **Guia de campo:** revista de naturalista, serifas, papel envelhecido (iNaturalist, Atlas Obscura).
- **Câmera de trilha:** visão noturna, HUD com hora e coordenadas.

## Skills / plugins do Claude para o frontend

| Plugin | Para quê |
|---|---|
| **frontend-design** (Anthropic) | Direção visual e implementação de UI com cara própria, sem visual genérico. |
| **UI Design Review** (UXKIN) | Revisão de tela como um designer sênior, no celular e no desktop, comparando com produtos reais. |
| **Design** (Anthropic) | Design system, acessibilidade, textos de interface (UX writing). |

## Funcionalidades novas que surgiram

- **Comentários** nos avistamentos. Precisa de backend e spec de segurança nova
  (`specs/08-comentarios.md`): XSS armazenado, spam/rate limit, moderação e
  denúncia, autor edita/apaga só o próprio comentário.
- Mapa dos avistamentos e "casos em destaque" na home (opcionais).
