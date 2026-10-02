extends RefCounted
## História do jogo, dividida em capítulos que seguem os arcos do anime/mangá.
##
## Tipos de etapa (step):
##   talk        conversar com um NPC (F)
##   devour      devorar X monstros e Y minérios
##   devour_npc  devorar um NPC com o Predador (E)
##   waves       derrotar ondas de inimigos
##   boss        derrotar um chefe (devour = true exige devorar o corpo)
##   event       só diálogo + ações
## Ações: name, grant, revoke, ally, remove_ally, npc, remove_npc, rename_npc,
##        stats, demon_lord, mp_regen, sage, heal

const S1 := ["predator", "great_sage", "water_blade"]
const S2 := ["predator", "great_sage", "water_blade", "poison_breath", "sticky_thread", "ultrasound"]
const S3 := ["predator", "great_sage", "water_blade", "poison_breath", "sticky_thread", "ultrasound",
	"shadow_motion", "black_lightning"]
const S4 := ["predator", "great_sage", "water_blade", "poison_breath", "sticky_thread", "ultrasound",
	"shadow_motion", "black_lightning", "mimicry", "sword", "black_flame"]
const S5 := ["predator", "great_sage", "water_blade", "poison_breath", "sticky_thread", "ultrasound",
	"shadow_motion", "black_lightning", "mimicry", "sword", "black_flame", "starved"]
const S6 := ["beelzebub", "raphael", "water_blade", "poison_breath", "sticky_thread", "ultrasound",
	"shadow_motion", "black_lightning", "mimicry", "sword", "black_flame", "starved", "megiddo"]


static func all() -> Array:
	return [
		# ------------------------------------------------------------------ 1
		{
			"title": "Capítulo 1 — A Caverna Selada",
			"theme": "cave", "size": Vector2(2400, 1800), "seed": 11,
			"player_pos": Vector2(1200, 1550), "name": "Slime",
			"skills": S1, "hp": 100.0, "mp": 100.0, "allies": [],
			"npcs": [["veldora", Vector2(1200, 330)]],
			"spawns": [
				["spider", Vector2(400, 400), 3], ["spider", Vector2(2000, 1300), 2],
				["bat", Vector2(1900, 500), 3], ["serpent", Vector2(450, 1300), 1],
				["serpent", Vector2(2050, 900), 1], ["lizard", Vector2(800, 900), 2],
				["lizard", Vector2(1650, 1500), 1],
			],
			"pickups": [["ore", Vector2(300, 900)], ["ore", Vector2(700, 300)], ["ore", Vector2(1700, 300)],
				["ore", Vector2(2100, 650)], ["ore", Vector2(600, 1600)], ["ore", Vector2(1900, 1650)],
				["ore", Vector2(1000, 1100)], ["ore", Vector2(1450, 1000)]],
			"herbs": 5,
			"intro": [
				["Satoru Mikami", "...Fui esfaqueado protegendo um colega. Tudo está escuro... e eu não tenho mãos?!"],
				["Grande Sábio", "Confirmação: reencarnação concluída. Você é um Slime. Habilidades únicas [Predador] e [Grande Sábio] adquiridas."],
				["Grande Sábio", "Habilidade [Lâmina d'Água] adquirida ao analisar a água da caverna. Use o CLIQUE para atirar na direção do mouse."],
				["Grande Sábio", "Sugestão: derrote monstros e aperte E perto dos corpos para devorá-los e copiar suas habilidades."],
			],
			"steps": [
				{"type": "talk", "npc": "veldora", "obj": "Siga a aura gigantesca ao norte e fale com ela (F).",
				"lines": [
					["Veldora", "Consegue me ouvir, pequenino? KUAHAHAHA! Eu sou Veldora, o Dragão da Tempestade, um dos quatro Verdadeiros Dragões!"],
					["Slime", "(Um dragão gigante... e eu sou só uma gosma azul.)"],
					["Veldora", "A heroína me selou aqui com a Prisão Infinita há 300 anos. Estou morrendo de tédio! Seja meu amigo!"],
					["Slime", "Amigo? Tudo bem! Mas não reclame se eu não vier conversar todo dia."],
					["Veldora", "KUAHAHA! Então trocaremos nomes. Você será RIMURU TEMPEST e eu, VELDORA TEMPEST!"],
					["Grande Sábio", "Proposta: devorar o Veldora e analisar a Prisão Infinita por dentro. Porém, o Predador ainda é fraco."],
				],
				"actions": [["name", "Rimuru Tempest"], ["rename_npc", "veldora", "Veldora Tempest"], ["stats", 110.0, 130.0],
					["sage", "Você recebeu um nome! Suas magículas aumentaram."]]},
				{"type": "devour", "monsters": 4, "ore": 4,
				"obj": "Fortaleça o Predador:\n• Devore monstros: %d/%d\n• Devore Minérios Mágicos: %d/%d"},
				{"type": "devour_npc", "npc": "veldora", "obj": "Volte ao Veldora e devore-o com o Predador (E).",
				"lines": [
					["Veldora", "Confio meu corpo a você, Rimuru! Analise a Prisão Infinita e me tire daqui um dia!"],
					["Grande Sábio", "Veldora armazenado no Estômago. Análise da Prisão Infinita iniciada... tempo estimado: indefinido."],
					["Rimuru", "Agora é hora de sair desta caverna e ver o mundo!"],
				]},
			],
		},
		# ------------------------------------------------------------------ 2
		{
			"title": "Capítulo 2 — A Vila Goblin",
			"theme": "village", "size": Vector2(2600, 1800), "seed": 22,
			"player_pos": Vector2(1300, 1500), "name": "Rimuru Tempest",
			"skills": S2, "hp": 120.0, "mp": 140.0, "allies": [],
			"npcs": [["goblin_elder", Vector2(1300, 900)]],
			"spawns": [["spider", Vector2(400, 1500), 2], ["lizard", Vector2(2200, 1500), 2]],
			"pickups": [["ore", Vector2(500, 600)], ["ore", Vector2(2100, 700)]],
			"herbs": 6,
			"intro": [
				["Grande Sábio", "Saída da caverna confirmada. Há uma vila de goblins na Floresta de Jura."],
				["Grande Sábio", "Habilidades disponíveis: Sopro Venenoso [1], Fio Pegajoso [2], Ondas Ultrassônicas [3]."],
			],
			"steps": [
				{"type": "talk", "npc": "goblin_elder", "obj": "Converse com o Ancião Goblin no centro da vila (F).",
				"lines": [
					["Ancião Goblin", "Ó grande senhor! Sentimos sua aura poderosa... Os Lobos Atrozes vão atacar nossa vila esta noite!"],
					["Ancião Goblin", "Desde que o Dragão da Tempestade sumiu, os monstros invadem a Floresta de Jura. Por favor, nos proteja!"],
					["Rimuru", "Certo. Se eu ajudar, vocês me juram lealdade? ...Brincadeira. Vamos montar barricadas!"],
				]},
				{"type": "waves", "from": Vector2(1300, 120), "obj": "Defenda a vila dos Lobos Atrozes! Onda %d/%d",
				"waves": [[["direwolf", 6]], [["direwolf", 8]]]},
				{"type": "boss", "boss": "direwolf_boss", "pos": Vector2(1300, 250), "devour": true,
				"obj": "Derrote o Líder dos Lobos Atrozes e devore-o (E).",
				"start": [["Líder dos Lobos", "GRRR! Um slime? Ridículo! Esta floresta pertence à minha matilha!"],
					["Rimuru", "Último aviso: vão embora agora e eu deixo vocês em paz."]],
				"lines": [
					["Grande Sábio", "Análise do Líder dos Lobos concluída. Habilidade [Movimento Sombrio] adquirida (ESPAÇO)."],
					["Lobo Atroz", "...Nosso pai foi derrotado. A matilha agora segue você, mestre!"],
				],
				"actions": [["npc", "ranga", Vector2(1300, 600)]]},
				{"type": "talk", "npc": "ranga", "obj": "Dê nomes aos goblins e aos lobos: fale com o filho do líder (F).",
				"lines": [
					["Rimuru", "Já que agora somos todos aliados, vou dar nomes a vocês! O ancião será RIGURD, aquele ali é o GOBTA..."],
					["Rimuru", "E você, filho do líder, será RANGA! (Ugh... estou ficando sem magículas...)"],
					["Grande Sábio", "Aviso: magículas esgotadas por dar nomes demais. Entrando em modo de hibernação..."],
					["Rigurd", "Mestre Rimuru! Acordou! Veja, todos nós evoluímos! Agora sou um Hobgoblin!"],
					["Ranga", "Evoluí para Lobo da Tempestade! Sou sua sombra, mestre. AUUUUU!"],
					["Grande Sábio", "Habilidade [Relâmpago Negro] adquirida ao analisar o poder de Ranga (tecla 4)."],
				],
				"actions": [["remove_npc", "ranga"], ["ally", "ranga"], ["ally", "gobta"], ["grant", "black_lightning"],
					["grant", "shadow_motion"], ["rename_npc", "goblin_elder", "Rigurd"], ["stats", 140.0, 160.0]]},
			],
		},
		# ------------------------------------------------------------------ 3
		{
			"title": "Capítulo 3 — Shizu e o Espírito do Fogo",
			"theme": "forest", "size": Vector2(2400, 1800), "seed": 33,
			"player_pos": Vector2(1200, 1550), "name": "Rimuru Tempest",
			"skills": S3, "hp": 140.0, "mp": 160.0, "allies": ["ranga", "gobta"],
			"npcs": [["shizu", Vector2(1200, 800)], ["kabal", Vector2(1080, 860)]],
			"spawns": [["spider", Vector2(400, 400), 2], ["serpent", Vector2(2000, 400), 1], ["bat", Vector2(400, 1300), 3]],
			"pickups": [["ore", Vector2(300, 300)], ["ore", Vector2(2100, 1500)]],
			"herbs": 6,
			"intro": [
				["Grande Sábio", "Um grupo de aventureiros entrou na floresta. Uma delas emite uma aura de fogo muito estranha."],
			],
			"steps": [
				{"type": "talk", "npc": "shizu", "obj": "Encontre os aventureiros e fale com a mulher mascarada (F).",
				"lines": [
					["Kabal", "Um slime falante?! E um lobo gigante?! Calma, calma, somos aventureiros da Guilda!"],
					["Shizue Izawa", "Você... também veio do Japão, não é? Eu me chamo Shizue Izawa. Fui invocada para este mundo durante a guerra."],
					["Rimuru", "Satoru Mikami, ex-funcionário de construtora. Prazer! Por que você usa essa máscara?"],
					["Shizue Izawa", "Ela segura o espírito que vive dentro de mim... Ah... não... ele está... acordando!"],
					["Grande Sábio", "Alerta! Espírito Superior do Fogo [Ifrit] detectado! Elemento fogo: fraco contra ÁGUA."],
				],
				"actions": [["remove_npc", "shizu"], ["remove_npc", "kabal"]]},
				{"type": "boss", "boss": "ifrit", "pos": Vector2(1200, 700), "devour": true,
				"obj": "Derrote Ifrit! (Lâmina d'Água causa dano dobrado) Depois devore-o (E).",
				"start": [["Ifrit", "Queimem! Queimem todos! Este corpo é meu!"],
					["Rimuru", "Ranga, Gobta, cuidado com o fogo! Eu sou um slime de água, ele vai se arrepender!"]],
				"lines": [
					["Grande Sábio", "Ifrit devorado. Habilidade [Chamas Negras] adquirida (tecla 5). Resistência a fogo adquirida."],
				],
				"actions": [["npc", "shizu", Vector2(1200, 800)]]},
				{"type": "talk", "npc": "shizu", "obj": "Fale com Shizu (F).",
				"lines": [
					["Shizue Izawa", "Obrigada... Sem o Ifrit, meu corpo não vai durar muito. Meu tempo acabou."],
					["Shizue Izawa", "Tenho um último pedido... Deixe-me descansar dentro de você. Não quero ficar neste mundo que odiei..."],
					["Rimuru", "...Tudo bem, Shizu-san. Vou levar você comigo, e também os seus arrependimentos."],
				]},
				{"type": "devour_npc", "npc": "shizu", "obj": "Atenda ao último pedido de Shizu: use o Predador (E).",
				"lines": [
					["Grande Sábio", "Shizue Izawa armazenada. Habilidade [Mimetismo] adquirida: forma humana disponível (tecla Q)."],
					["Grande Sábio", "Na forma humana, o CLIQUE ataca com a espada. A máscara de Shizu agora é sua."],
					["Rimuru", "Prometo, Shizu-san. Vou cuidar das crianças que você deixou e criar um mundo onde todos possam rir."],
				],
				"actions": [["grant", "mimicry"], ["grant", "sword"], ["grant", "black_flame"], ["stats", 160.0, 190.0]]},
			],
		},
		# ------------------------------------------------------------------ 4
		{
			"title": "Capítulo 4 — Os Ogros e o Orc Lord",
			"theme": "wetland", "size": Vector2(2800, 2000), "seed": 44,
			"player_pos": Vector2(1400, 1750), "name": "Rimuru Tempest",
			"skills": S4, "hp": 160.0, "mp": 190.0, "allies": ["ranga", "gobta"],
			"npcs": [],
			"spawns": [],
			"pickups": [["ore", Vector2(400, 400)], ["ore", Vector2(2400, 400)], ["ore", Vector2(400, 1600)]],
			"herbs": 8,
			"intro": [
				["Grande Sábio", "Seis Ogros se aproximam com intenção hostil. Parece que confundem você com um inimigo, por causa da máscara."],
			],
			"steps": [
				{"type": "boss", "boss": "benimaru_boss", "pos": Vector2(1400, 600),
				"obj": "Os Ogros atacaram! Derrote o Ogro Vermelho sem matá-lo.",
				"start": [["Ogro Vermelho", "Esse mascarado... é aliado dos demônios que destruíram nossa vila! Vingança!"],
					["Rimuru", "Ei! Eu não tenho nada a ver com isso! Bom... vou ter que convencer vocês do jeito difícil."]],
				"lines": [["Ogro Vermelho", "Ugh... que poder... por que você não acaba comigo?"]],
				"actions": [["npc", "shuna", Vector2(1400, 700)]]},
				{"type": "talk", "npc": "shuna", "obj": "Fale com a Princesa Ogra (F).",
				"lines": [
					["Princesa Ogra", "Irmão, pare! Este não é um demônio. A aura dele é calma... ele não foi quem atacou a vila."],
					["Rimuru", "Foram os Orcs, não é? Sob o comando de um Orc Lord. Que tal vocês trabalharem para mim?"],
					["Rimuru", "Vou dar nomes a vocês! BENIMARU, SHUNA, SHION, SOUEI, HAKUROU e KUROBEE!"],
					["Benimaru", "Evoluímos para Kijin! Mestre Rimuru, nossas lâminas são suas!"],
					["Shion", "Vou proteger o Mestre Rimuru! E também cozinhar para ele! (Isso não é uma ameaça... ou é?)"],
				],
				"actions": [["remove_npc", "shuna"], ["remove_ally", "gobta"], ["ally", "benimaru"], ["ally", "shion"],
					["ally", "shuna"], ["npc", "gabiru", Vector2(1200, 900)]]},
				{"type": "talk", "npc": "gabiru", "obj": "Um homem-lagarto quer falar com você (F).",
				"lines": [
					["Gabiru", "Eu sou Gabiru, o grande guerreiro dos Homens-Lagarto! Ouvi dizer que um slime lidera esta gente. Que piada!"],
					["Gabiru", "Juntem-se a mim e eu os protegerei dos 200 mil orcs! Hohoho!"],
					["Ranga", "Mestre, posso morder ele?"],
					["Rimuru", "...Deixa pra lá. Os orcs estão chegando ao pântano! Todos em posição!"],
				],
				"actions": [["remove_npc", "gabiru"]]},
				{"type": "waves", "from": Vector2(1400, 150), "obj": "Pare o exército Orc no pântano! Onda %d/%d",
				"waves": [[["orc", 8]], [["orc", 9], ["orc_general", 1]], [["orc", 10], ["orc_general", 2]]]},
				{"type": "boss", "boss": "orc_lord", "pos": Vector2(1400, 300), "devour": true,
				"obj": "Derrote o Orc Lord Geld e devore-o (E).",
				"start": [["Geld", "Fome... Tenho FOME! Vou devorar tudo... meu povo está morrendo de fome!"],
					["Rimuru", "Eu entendo, Geld. Mas não posso deixar você comer a floresta inteira."],
					["Grande Sábio", "Aviso: Orc Lord possui Regeneração. Pressione o ataque!"]],
				"lines": [
					["Geld", "Devorador... você vai carregar... os pecados do meu povo?"],
					["Rimuru", "Vou. Seus pecados e os do seu povo. Pode descansar, Geld."],
					["Grande Sábio", "Habilidade [Gula: Faminto] adquirida (tecla 6). A Floresta de Jura forma uma aliança sob Rimuru!"],
				],
				"actions": [["stats", 200.0, 230.0]]},
			],
		},
		# ------------------------------------------------------------------ 5
		{
			"title": "Capítulo 5 — Tragédia e Festival da Colheita",
			"theme": "town", "size": Vector2(2600, 1900), "seed": 55,
			"player_pos": Vector2(1300, 1700), "name": "Rimuru Tempest",
			"skills": S5, "hp": 200.0, "mp": 230.0, "mp_regen": 2.5,
			"allies": ["ranga", "benimaru", "shuna"],
			"npcs": [],
			"spawns": [],
			"pickups": [["ore", Vector2(300, 300)], ["ore", Vector2(2300, 300)]],
			"herbs": 10,
			"intro": [
				["Rimuru", "Tempest se tornou uma cidade linda... mas enquanto eu estava fora, o Reino de Falmuth nos atacou."],
				["Shuna", "Rimuru-sama... a Shion... ela protegeu as crianças e... (soluços)"],
				["Grande Sábio", "Uma Grande Barreira Sagrada cobre a cidade: a recuperação de magículas está muito reduzida."],
				["Rimuru", "Eu queria ser amigo dos humanos... Mas agora, os que fizeram isso vão pagar."],
			],
			"steps": [
				{"type": "waves", "from": Vector2(1300, 150), "obj": "Expulse o exército de Falmuth de Tempest! Onda %d/%d",
				"waves": [[["knight", 6], ["mage", 2]], [["knight", 8], ["mage", 4]]]},
				{"type": "boss", "boss": "shogo", "pos": Vector2(1300, 300), "devour": true,
				"obj": "Derrote o otherworlder Shogo Taguchi.",
				"start": [["Shogo", "Hahaha! Monstros que fingem ser gente. Vou esmagar todos vocês, igual fiz com aquela mulher de cabelo roxo!"],
					["Rimuru", "...Você não vai sair daqui vivo."]],
				"lines": [["Grande Sábio", "Inimigo devorado. Almas reunidas: 9.999... faltam poucas para o Festival da Colheita."]]},
				{"type": "event", "obj": "",
				"lines": [
					["Grande Sábio", "Condição satisfeita: 10.000 almas. O Festival da Colheita começou."],
					["Grande Sábio", "Evolução para Lorde Demônio iniciada... Grande Sábio evoluindo para... [Raphael, Senhor da Sabedoria]."],
					["Raphael", "Predador e Faminto fundidos: [Belzebu, Senhor da Gula] adquirido. Magia [Megiddo] criada (tecla 7)."],
					["Raphael", "Com o Festival da Colheita, a ressurreição de Shion é possível. Executando..."],
					["Shion", "Mestre... Rimuru? Eu... voltei? Hehe... desculpe por fazer todos chorarem."],
					["Rimuru", "Bem-vinda de volta, Shion. Agora, vamos limpar o resto deles!"],
				],
				"actions": [["demon_lord"], ["ally", "shion"], ["mp_regen", 10.0], ["heal"]]},
				{"type": "waves", "from": Vector2(1300, 150), "obj": "Lorde Demônio Rimuru: use o MEGIDDO (7)! Onda %d/%d",
				"waves": [[["knight", 12], ["mage", 6]]],
				"lines": [["Rimuru", "Acabou. Agora... Raphael, é hora de libertar o Veldora."],
					["Veldora", "KUAHAHAHA! Finalmente estou livre! Rimuru, meu amigo, você ficou muito forte!"]]},
			],
		},
		# ------------------------------------------------------------------ 6
		{
			"title": "Capítulo 6 — Walpurgis, o Banquete dos Lordes Demônios",
			"theme": "castle", "size": Vector2(2200, 1700), "seed": 66,
			"player_pos": Vector2(1100, 1550), "name": "Rimuru Tempest (Lorde Demônio)",
			"skills": S6, "hp": 350.0, "mp": 450.0, "demon_lord": true,
			"allies": ["ranga", "benimaru", "shion", "shuna", "veldora"],
			"npcs": [["milim", Vector2(1500, 500)]],
			"spawns": [],
			"pickups": [],
			"herbs": 6,
			"intro": [
				["Raphael", "Walpurgis: o banquete dos Lordes Demônios. Clayman acusa você de traição e diz controlar Milim Nava."],
				["Rimuru", "Clayman está por trás do ataque de Falmuth. Ele vai responder por tudo."],
			],
			"steps": [
				{"type": "waves", "from": Vector2(1100, 200), "obj": "Destrua as marionetes de Clayman! Onda %d/%d",
				"waves": [[["puppet", 8]], [["puppet", 10], ["knight", 3]]]},
				{"type": "boss", "boss": "clayman", "pos": Vector2(1100, 350), "devour": true,
				"obj": "Derrote Clayman, o Lorde Demônio Marionetista!",
				"start": [["Clayman", "Um slime virou Lorde Demônio? Que piada! Milim é minha marionete, e você será a próxima!"],
					["Rimuru", "Fale menos, Clayman. Raphael, análise de combate!"],
					["Raphael", "Entendido. Probabilidade de vitória: 100%."]],
				"lines": [["Clayman", "Impossível... eu... era o mais esperto de todos..."]]},
				{"type": "talk", "npc": "milim", "obj": "Fale com Milim (F).",
				"lines": [
					["Milim", "Wahahaha! Eu só estava fingindo ser controlada, pra ver o que o Clayman tramava! Fui convincente?"],
					["Rimuru", "Você me deu um susto, Milim!"],
					["Milim", "Agora você é um Lorde Demônio de verdade! Vamos ser melhores amigos para sempre, Rimuru!"],
					["Veldora", "KUAHAHA! E não se esqueçam do grande Veldora!"],
					["Rimuru", "Os Lordes Demônios agora são o Octagrama. E Tempest... vai ser o lugar mais divertido deste mundo!"],
				]},
			],
		},
	]
