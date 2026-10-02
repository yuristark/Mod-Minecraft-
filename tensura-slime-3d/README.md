# Tensura: Reencarnado como Slime 3D (Godot 4)

Jogo 3D de fã inspirado em *Tensei Shitara Slime Datta Ken* (Tensura). Você é o slime
que logo vira **Rimuru Tempest**, preso na **Caverna Selada** junto com o
**Veldora, o Dragão da Tempestade**.

Tudo é feito com formas primitivas e GDScript: não precisa baixar modelos nem texturas.

## Como abrir
1. Instale o [Godot 4.3 ou mais novo](https://godotengine.org/download) (versão padrão, não a .NET).
2. No Godot, clique em **Importar** e escolha o arquivo `tensura-slime-3d/project.godot`.
3. Aperte **F5** (ou o botão ▶) para jogar.

> Se o seu PC for mais fraco, troque o renderizador em *Projeto → Configurações do Projeto →
> Renderização → Renderer* para **Compatibility**.

## Controles
| Tecla | Ação |
|---|---|
| WASD / setas | Mover |
| Mouse | Girar a câmera |
| Espaço | Pular (pulo duplo depois da Propulsão Hidráulica) |
| Clique esquerdo / Q | Lâmina d'Água |
| E | **Predador**: devorar monstros derrotados, minérios, ervas e água |
| F | Conversar com o Veldora |
| 1 | Sopro Venenoso (copiado da Serpente Tempestade) |
| 2 | Fio Pegajoso (copiado da Aranha Negra) |
| 3 | Ondas Ultrassônicas (copiado do Morcego Gigante) |
| Shift | Movimento Sombrio (copiado do Lobo Atroz) |
| Esc | Soltar o mouse |
| R | Jogar de novo (na tela de fim) |

## História e objetivos
1. Explore a caverna e encontre a aura gigantesca ao norte: é o Veldora.
2. Vocês viram amigos e trocam nomes: você vira **Rimuru Tempest**.
3. O **Grande Sábio** sugere devorar o Veldora para analisar a Prisão Infinita, mas antes
   o Predador precisa ficar mais forte: devore **5 monstros** e **6 Minérios Mágicos**.
4. Volte ao Veldora e use o Predador para vencer.

Dicas:
- Monstros derrotados viram corpos azulados: aperte **E** perto deles para copiar a habilidade.
- Erva Hipokute cura 40 de vida. A água do lago (oeste) dá a **Propulsão Hidráulica**.
- Cada monstro devorado aumenta a vida máxima; cada minério aumenta as magículas (MP).

## Estrutura
```
project.godot          configuração do projeto
scenes/main.tscn       cena principal (só carrega o main.gd)
scripts/main.gd        monta a caverna, gera monstros/itens e controla a história
scripts/player.gd      o slime: movimento, câmera, Predador e habilidades
scripts/enemy.gd       monstros (aranha, morcego, serpente, lobo, lagarto) e IA
scripts/veldora.gd     o dragão selado
scripts/hud.gd         interface, Grande Sábio, diálogos e telas de título/fim
scripts/pickup.gd      minério, erva e água
scripts/projectile.gd  Lâmina d'Água e Fio Pegajoso
scripts/util.gd        funções para criar malhas e materiais
tests/smoke_test.gd    teste automático da partida inteira
```

Teste automático (sem abrir janela):
```
godot --headless --path tensura-slime-3d --script tests/smoke_test.gd
```

*Projeto de fã sem fins lucrativos. Tensura pertence a Fuse, Mitz Vah e Kodansha.*
