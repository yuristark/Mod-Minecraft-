# Tensura: Reencarnado como Slime 2D (Godot 4)

Jogo 2D de ação e aventura com visão de cima, feito por fã e inspirado em *Tensei Shitara Slime Datta Ken*.
Você joga a história de Rimuru Tempest em **6 capítulos**, do slime na caverna até virar Lorde Demônio.
Tudo é desenhado por código, então não precisa de imagens nem de modelos.

## Como abrir
1. Instale o [Godot 4.3 ou mais novo](https://godotengine.org/download) (versão padrão, não a .NET).
2. Extraia o `.zip`, abra o Godot, clique em **Importar** e escolha `tensura-slime-2d/project.godot`.
3. Aperte **F5** para jogar.

## Controles
| Tecla | Ação |
|---|---|
| WASD / setas | Mover |
| Mouse | Mirar |
| Clique esquerdo | Lâmina d'Água (slime) / Espada (forma humana) |
| E | Predador / Belzebu: devorar corpos, minérios e ervas |
| F | Conversar |
| Espaço | Movimento Sombrio (avanço rápido) |
| Q | Mimetismo: trocar entre slime e humano |
| 1 a 7 | Sopro Venenoso, Fio Pegajoso, Ondas Ultrassônicas, Relâmpago Negro, Chamas Negras, Gula: Faminto, Megiddo |
| Esc / P | Pausa |

## Capítulos
1. **A Caverna Selada**: conhece o Veldora, ganha o nome Rimuru, devora monstros e devora o Veldora.
2. **A Vila Goblin**: defende os goblins dos Lobos Atrozes, derrota o líder e dá nomes (Rigurd, Gobta, **Ranga**).
3. **Shizu e o Espírito do Fogo**: encontra Shizu e os aventureiros, enfrenta o **Ifrit** (fraco contra água) e ganha a forma humana.
4. **Os Ogros e o Orc Lord**: luta contra os Ogros, dá nomes a **Benimaru, Shion e Shuna**, encontra o Gabiru, segura o exército Orc e derrota **Geld**.
5. **Tragédia e Festival da Colheita**: o ataque de Falmuth, o chefe **Shogo**, a evolução para Lorde Demônio (Raphael, Belzebu, **Megiddo**) e a volta da Shion.
6. **Walpurgis**: as marionetes de **Clayman**, a batalha final e a Milim.

O progresso é salvo: cada capítulo vencido libera o próximo no menu.

### Sistemas
- **Predador**: monstros derrotados viram corpos azulados. Devore-os com E para copiar habilidades
  (Aranha → Fio Pegajoso, Morcego → Ondas Ultrassônicas, Serpente → Sopro Venenoso, Líder dos Lobos →
  Movimento Sombrio, Ifrit → Chamas Negras, Geld → Gula).
- **Aliados** seguem e lutam com você, cada um com seu especial: Ranga (Relâmpago Negro),
  Benimaru (Hell Flare), Shion (golpe poderoso), Shuna (cura) e Veldora (tempestade).
- **Elementos**: água causa dano dobrado em criaturas de fogo.
- **Grande Sábio / Raphael** comentam tudo na parte de baixo da tela.

## Estrutura
```
scripts/chapters.gd  história: capítulos, diálogos, etapas e recompensas
scripts/data.gd      habilidades, monstros e aliados (números e cores)
scripts/main.gd      menu, carregamento dos capítulos, objetivos e salvamento
scripts/player.gd    Rimuru (slime e humano) e todas as habilidades
scripts/enemy.gd     monstros, chefes e seus padrões de ataque
scripts/ally.gd      companheiros
scripts/npc.gd       personagens para conversar
scripts/world.gd     mapas (caverna, floresta, vila, pântano, cidade, castelo)
scripts/hud.gd       interface, diálogos e menus
tests/smoke_test.gd  teste automático que joga todos os capítulos
```

Para adicionar capítulos, edite `scripts/chapters.gd`. Os tipos de etapa estão explicados no topo do arquivo.

Teste automático: `godot --headless --path tensura-slime-2d --script tests/smoke_test.gd`

*Projeto de fã sem fins lucrativos. Tensura pertence a Fuse, Mitz Vah e Kodansha.*
