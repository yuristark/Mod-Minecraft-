# Tensura: Reencarnado como Slime 3D (Godot 4)

Jogo 3D de fã inspirado em *Tensei Shitara Slime Datta Ken* (Tensura). Você começa como o
slime que vira **Rimuru Tempest** na **Caverna Selada** e vive **toda a história do anime e do
mangá**: Veldora, Vila Goblin, Dwargon, Shizu e Ifrit, os Kijin, o Lorde Orc, Milim, o Festival da
Colheita, Walpurgis, Hinata e a guerra contra o Império Oriental.

Tudo é feito com formas primitivas, shaders e GDScript: não precisa baixar modelos nem texturas.
Funciona no **PC** (teclado/mouse ou controle) e no **celular/tablet** (controles de toque).

## Como abrir
1. Instale o [Godot 4.3 ou mais novo](https://godotengine.org/download) (versão padrão, não a .NET).
2. No Godot, clique em **Importar** e escolha `tensura-slime-3d/project.godot`.
3. Aperte **F5** (ou ▶) para jogar.

> PC fraco? Em **Opções** do jogo escolha qualidade **Baixa**, ou troque o renderizador em
> *Projeto → Configurações do Projeto → Renderização → Renderer* para **Compatibility**.

### Exportar para Android (celular)
1. No Godot: *Editor → Gerenciar Modelos de Exportação* → baixar.
2. *Projeto → Exportar → Adicionar… → Android*. Configure o SDK Android e uma keystore de debug
   (*Editor → Configurações do Editor → Exportar → Android*).
3. Exporte o `.apk`. O projeto já vem em **paisagem**, com o renderizador **Mobile** para celular,
   compressão de texturas ETC2/ASTC e os controles de toque ligando sozinhos.

## Controles
| Ação | PC | Celular | Controle |
|---|---|---|---|
| Mover | WASD / setas | Joystick (lado esquerdo, aparece onde tocar) | Analógico esq. |
| Câmera | Mouse | Arrastar no lado direito (ou arrastar a partir do ATAQUE) | Analógico dir. |
| Ataque (combo de 3) | J / clique esquerdo | ATAQUE | X |
| Pular / voar (segurar) | Espaço | PULO | A |
| Esquiva | Shift | ESQUIVA | B |
| **Predador** (devorar) | E | PREDADOR (brilha quando há algo perto) | Y |
| Skills dos 4 slots | 1 2 3 4 (Q = slot 1, botão direito = slot 1) | 4 botões de skill (mostram recarga) | LB RB ◀ ▶ |
| Falar | F | FALAR (aparece perto de alguém) | ▲ |
| Mudar de forma (Mimetismo) | T | FORMA | ▼ |
| Poção Completa | H | POÇÃO | Back |
| Menu | TAB / M | MENU | Start |

A **mira é automática** no inimigo mais perto na direção da câmera (no celular ela é mais generosa).
Em **Opções** dá para mudar tamanho dos botões, sensibilidade, inverter Y, ligar/desligar o toque
e a qualidade gráfica.

## História (12 capítulos)
1. **Reencarnado como Slime** – conheça Veldora, troque nomes, fortaleça o Predador e devore o dragão.
2. **A Vila Goblin** – defenda os goblins dos Lobos Atrozes, devore o líder e nomeie Ranga, Rigurd e Gobta.
3. **O Reino Anão** – Dwargon, Kaijin, a mina dos Armadurossauros e o julgamento do Rei Gazel.
4. **Shizu, a Chama Eterna** – derrote Ifrit, devore-o e herde a forma humana de Shizu.
5. **Os Ogros** – lute com o Jovem Mestre Ogro e nomeie Benimaru, Shuna, Shion, Souei, Hakurou e Kurobe.
6. **O Lorde Orc** – Treyni, o duelo com Gabiru, a batalha do pântano e Geld, o Orc Disaster.
7. **Milim Nava** – sobreviva à Destruidora... e ofereça mel.
8. **Tragédia e o Festival da Colheita** – Falmuth, Shogo, Megiddo, evolução para Lorde Demônio, Raphael, Veldora livre e Diablo.
9. **Walpurgis** – Guy Crimson, Clayman e o nascimento do Octagrama.
10. **Hinata Sakaguchi** – o duelo com a Capitã dos Cavaleiros Sagrados.
11. **Festival e Guerra Imperial** – o Império Oriental, Kondo e o chefe final Yuuki Kagurazaka; Raphael vira **Ciel**.
12. **Epílogo** – jogo livre e treino opcional contra o **Veldora**.

## O que tem no jogo
- **5 áreas**: Caverna Selada, Grande Floresta de Jura (com Tempest crescendo de vila goblin a
  capital com palácio, muralhas e festival), Reino Anão Dwargon, Planícies de Falmuth e o salão da Walpurgis.
- **Formas (Mimetismo)**: Slime, Morcego (voa), Lobo Estelar Tempest (muito rápido), Humano (Shizu)
  e Lorde Demônio (asas, voa).
- **20+ skills**: Lâmina d'Água, Sopro Venenoso/Paralisante, Fio Pegajoso, Ultrassom, Raio Negro,
  Manipulação de Chamas, Hell Flare, Aceleração de Pensamento, Faminto, **Megiddo**, **Belzebu**,
  **Tempestade de Veldora**, **Desintegração**, Aura de Lorde Demônio e **Ciel: Batalha Automática**
  — copiadas devorando monstros com o Predador ou ganhas na história.
- **Grupo de até 3 aliados** com técnicas próprias: Ranga, Gobta, Benimaru, Shion, Shuna (cura),
  Souei, Hakurou, Gabiru, Geld, Diablo e Milim.
- **Chefes** com ataques telegrafados (círculos no chão, feixes, chuva de ataques, investidas,
  invocações e fase de fúria): Líder dos Lobos, Ifrit, Jovem Mestre Ogro, Gabiru, Geld, Milim,
  Shogo, Clayman, Hinata, Kondo, Yuuki e Veldora (treino).
- Nível/EXP, poções feitas de Ervas Hipokute, **Enciclopédia** com personagens e lore do
  anime/mangá, salvamento automático e manual.

### Gráficos
Terreno com relevo e colisão (HeightMap), céu procedural, neblina, água com ondas e reflexo
Fresnel, grama com vento e árvores em MultiMesh, corpo do Rimuru com shader de gelatina,
partículas (fogo, vaga-lumes, magículas), brilho (glow), sombras e, na qualidade Alta, SSAO,
iluminação indireta (SSIL) e neblina volumétrica.

## Estrutura
```
project.godot            configuração (paisagem, renderizador Mobile no celular)
scenes/main.tscn         cena principal (só carrega o main.gd)
scripts/game_data.gd     TODOS os dados: skills, formas, inimigos, aliados, personagens, áreas e a história
scripts/main.gd          carrega áreas, roda a história, recompensas, grupo, save e opções
scripts/world_builder.gd monta cada área (terreno, céu, água, vegetação, Tempest, Dwargon...)
scripts/player.gd        Rimuru: movimento, formas, combo, skills, Predador, nível, câmera
scripts/enemy.gd         monstros e chefes (padrões de ataque)
scripts/ally.gd          aliados do grupo
scripts/npc.gd           personagens para conversar
scripts/models.gd        modelos procedurais (humanoides, lobos, dragão, aranha...)
scripts/fx.gd            efeitos (partículas, raios, feixes, avisos no chão, números de dano)
scripts/hud.gd           interface, diálogos, menu completo e telas
scripts/touch_controls.gd joystick e botões de toque (multitoque)
scripts/veldora.gd       o dragão selado
scripts/pickup.gd        minério, erva e água
scripts/projectile.gd    projéteis do jogador e dos inimigos
scripts/util.gd          funções para criar malhas e materiais
shaders/                 terreno, água, grama, slime, portal e aviso de ataque
tests/smoke_test.gd      teste automático que joga a história inteira
tests/screenshots.gd     tira screenshots das áreas (precisa de tela)
```

Para adicionar conteúdo (novo chefe, skill, fala ou capítulo) basta editar `scripts/game_data.gd`.

Teste automático (sem abrir janela) — joga os 12 capítulos, testa áreas, skills, formas, menus,
toque, save e morte:
```
godot --headless --path tensura-slime-3d --script tests/smoke_test.gd
```

*Projeto de fã sem fins lucrativos. Tensura pertence a Fuse, Mitz Vah, Taiki Kawakami e Kodansha.*
