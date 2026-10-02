# Tensura: Reencarnado como Slime 2D (Godot 4)

Jogo 2D de ação e aventura com visão de cima, feito por fã e inspirado em *Tensei Shitara Slime Datta Ken*.
Você joga a história de Rimuru Tempest em **10 capítulos**, do slime na caverna até virar Verdadeiro Dragão.
Depois dá para continuar para sempre no **Labirinto Infinito**, subindo de nível sem limite.
Tudo é desenhado por código, então não precisa de imagens nem de modelos.

## Como abrir
1. Instale o [Godot 4.3 ou mais novo](https://godotengine.org/download) (versão padrão, não a .NET).
2. Extraia o `.zip`, abra o Godot, clique em **Importar** e escolha `tensura-slime-2d/project.godot`.
3. Aperte **F5** para jogar.

## Controles

### PC
| Tecla | Ação |
|---|---|
| WASD / setas | Mover |
| Mouse | Mirar |
| Clique esquerdo (segure) | Lâmina d'Água (slime) / Espada (forma humana) |
| E | Predador / Belzebu: devorar corpos, minérios e ervas |
| F | Conversar |
| Espaço | Movimento Sombrio (avanço rápido) |
| Q | Mimetismo: trocar entre slime e humano |
| 1 a 9 | Sopro Venenoso, Fio Pegajoso, Ondas Ultrassônicas, Relâmpago Negro, Chamas Negras, Gula, Megiddo, Tempestade do Verdadeiro Dragão, Azathoth |
| Esc / P | Pausa |

### Celular / tablet
Os controles de toque ligam sozinhos em telas de toque. Também dá para ligar ou desligar no menu e na pausa.
- **Joystick** no canto esquerdo para andar (aparece onde você encostar o dedo).
- **ATACAR** (segure), **DEVORAR**, **FALAR**, **DASH** e **FORMA** no canto direito.
- **Botões de habilidade numerados**: aparecem só as habilidades que o Rimuru já tem, e cada um mostra a recarga.
- **Pausa** no botão II do topo.
- **Mira automática** no inimigo mais próximo. Tocar na tela avança os diálogos.

Para jogar no celular é preciso exportar o projeto como APK (Android) pelo Godot:
*Projeto → Exportar → Android* (o Godot pede o Android SDK e uma keystore de debug na primeira vez).

## Progresso infinito
- **Nível sem limite**: todo inimigo dá experiência. Cada nível aumenta vida, magículas e dano (+4%).
  O nível fica salvo para sempre e vale na história e no labirinto.
- **Labirinto Infinito da Ramiris**: andares que nunca acabam, com inimigos cada vez mais fortes e um
  **chefe a cada 5 andares** (Líder dos Lobos, Ifrit, Geld, Shogo, Clayman, Hinata, Masayuki, Kondo, Yuuki...).
  Depois de cada andar você escolhe **1 de 3 bênçãos** (dano, vida, MP, velocidade, recarga, regeneração,
  cura ao devorar ou um aliado novo).
- A cada 10 andares vencidos fica salvo um **ponto de retorno**.
- No labirinto você usa todas as habilidades e aliados que já conquistou na história.

## Capítulos da história
1. **A Caverna Selada**: conhece o Veldora, ganha o nome Rimuru e devora o Veldora.
2. **A Vila Goblin**: enfrenta os Lobos Atrozes e dá nomes a Rigurd, Gobta e **Ranga**.
3. **Shizu e o Espírito do Fogo**: chefe **Ifrit**; ganha a forma humana.
4. **Os Ogros e o Orc Lord**: Benimaru, Shion, Shuna, Gabiru e o chefe **Geld**.
5. **Tragédia e Festival da Colheita**: Falmuth, o chefe **Shogo**, a evolução para Lorde Demônio e o Megiddo.
6. **Walpurgis**: o chefe **Clayman** e a Milim.
7. **Hinata e os Cavaleiros Sagrados**: duelo com **Hinata Sakaguchi** e a paz com a Igreja Ocidental.
8. **O Festival da Fundação**: o labirinto da **Ramiris**, o torneio e o "herói" **Masayuki**.
9. **A Invasão do Império Oriental**: **Diablo** entra no grupo, chefe **Kondo** e Raphael vira **Ciel**.
10. **O Despertar do Verdadeiro Dragão**: anjos de Feldway, Rimuru vira Verdadeiro Dragão
    (Azathoth, Tempestade do Dragão) e enfrenta **Yuuki Kagurazaka** para salvar o Veldora.

### Aliados
Ranga, Gobta, Benimaru, Shion, Shuna, Souei, Gabiru, Diablo e Veldora. Cada um tem um ataque especial.

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
scripts/touch.gd     controles de toque (joystick e botões)
tests/smoke_test.gd  teste automático que joga todos os capítulos
```

Para adicionar capítulos, edite `scripts/chapters.gd`. Os tipos de etapa estão explicados no topo do arquivo.

Teste automático: `godot --headless --path tensura-slime-2d --script tests/smoke_test.gd`

*Projeto de fã sem fins lucrativos. Tensura pertence a Fuse, Mitz Vah e Kodansha.*
