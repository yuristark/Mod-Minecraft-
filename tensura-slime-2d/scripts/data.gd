extends RefCounted
## Dados do jogo: habilidades, monstros e aliados.

const L_WORLD := 1
const L_PLAYER := 2
const L_ENEMY := 4
const L_ALLY := 8

## Habilidades do Rimuru. "key" é só o texto mostrado na interface.
const SKILLS := {
	"predator": {"name": "Predador", "key": "E", "mp": 0.0, "cd": 0.4},
	"beelzebub": {"name": "Belzebu, Senhor da Gula", "key": "E", "mp": 0.0, "cd": 0.4},
	"great_sage": {"name": "Grande Sábio", "key": "passiva", "mp": 0.0, "cd": 0.0},
	"raphael": {"name": "Raphael, Senhor da Sabedoria", "key": "passiva", "mp": 0.0, "cd": 0.0},
	"water_blade": {"name": "Lâmina d'Água", "key": "Clique", "mp": 5.0, "cd": 0.28},
	"sword": {"name": "Espada (forma humana)", "key": "Clique", "mp": 0.0, "cd": 0.32},
	"mimicry": {"name": "Mimetismo (trocar forma)", "key": "Q", "mp": 0.0, "cd": 0.6},
	"shadow_motion": {"name": "Movimento Sombrio", "key": "Espaço", "mp": 10.0, "cd": 0.7},
	"poison_breath": {"name": "Sopro Venenoso", "key": "1", "mp": 16.0, "cd": 1.8},
	"sticky_thread": {"name": "Fio Pegajoso", "key": "2", "mp": 10.0, "cd": 1.0},
	"ultrasound": {"name": "Ondas Ultrassônicas", "key": "3", "mp": 20.0, "cd": 4.0},
	"black_lightning": {"name": "Relâmpago Negro", "key": "4", "mp": 26.0, "cd": 2.5},
	"black_flame": {"name": "Chamas Negras", "key": "5", "mp": 24.0, "cd": 2.5},
	"starved": {"name": "Gula: Faminto", "key": "6", "mp": 35.0, "cd": 8.0},
	"megiddo": {"name": "Megiddo", "key": "7", "mp": 60.0, "cd": 9.0},
}

## Ordem em que as habilidades aparecem na interface.
const SKILL_ORDER := [
	"predator", "beelzebub", "great_sage", "raphael", "water_blade", "sword", "mimicry",
	"shadow_motion", "poison_breath", "sticky_thread", "ultrasound", "black_lightning",
	"black_flame", "starved", "megiddo",
]

## ai: melee, charger, flyer, ranged, boss
## skill: habilidade que o Rimuru copia ao devorar o corpo
## weak: elemento que causa dano dobrado
const ENEMIES := {
	"spider": {"name": "Aranha Negra", "hp": 60.0, "speed": 110.0, "dmg": 8.0, "r": 18.0,
		"ai": "melee", "skill": "sticky_thread", "color": Color(0.15, 0.13, 0.18)},
	"bat": {"name": "Morcego Gigante", "hp": 40.0, "speed": 150.0, "dmg": 6.0, "r": 15.0,
		"ai": "flyer", "skill": "ultrasound", "color": Color(0.4, 0.28, 0.25)},
	"serpent": {"name": "Serpente Tempestade", "hp": 140.0, "speed": 70.0, "dmg": 12.0, "r": 24.0,
		"ai": "ranged", "skill": "poison_breath", "color": Color(0.42, 0.25, 0.6), "shot": Color(0.5, 1.0, 0.3)},
	"lizard": {"name": "Lagarto Blindado", "hp": 90.0, "speed": 80.0, "dmg": 10.0, "r": 20.0,
		"ai": "melee", "skill": "", "color": Color(0.55, 0.5, 0.3)},
	"direwolf": {"name": "Lobo Atroz", "hp": 70.0, "speed": 165.0, "dmg": 9.0, "r": 18.0,
		"ai": "charger", "skill": "", "color": Color(0.38, 0.38, 0.44)},
	"direwolf_boss": {"name": "Líder dos Lobos Atrozes", "hp": 650.0, "speed": 175.0, "dmg": 14.0, "r": 30.0,
		"ai": "boss", "skill": "shadow_motion", "color": Color(0.25, 0.25, 0.32),
		"patterns": ["charge", "summon", "nova", "charge"], "minion": "direwolf", "shot": Color(0.6, 0.6, 1.0)},
	"salamander": {"name": "Salamandra", "hp": 60.0, "speed": 95.0, "dmg": 10.0, "r": 16.0,
		"ai": "ranged", "skill": "", "color": Color(1.0, 0.4, 0.1), "element": "fire", "weak": "water",
		"shot": Color(1.0, 0.5, 0.1)},
	"ifrit": {"name": "Ifrit, Espírito do Fogo", "hp": 1300.0, "speed": 110.0, "dmg": 16.0, "r": 34.0,
		"ai": "boss", "skill": "black_flame", "color": Color(1.0, 0.45, 0.1), "element": "fire", "weak": "water",
		"patterns": ["radial", "volley", "summon", "nova", "radial"], "minion": "salamander", "shot": Color(1.0, 0.55, 0.1)},
	"ogre": {"name": "Ogro", "hp": 160.0, "speed": 110.0, "dmg": 14.0, "r": 22.0,
		"ai": "melee", "skill": "", "color": Color(0.7, 0.35, 0.3)},
	"benimaru_boss": {"name": "Ogro Vermelho (futuro Benimaru)", "hp": 800.0, "speed": 160.0, "dmg": 15.0, "r": 24.0,
		"ai": "boss", "skill": "", "color": Color(0.8, 0.15, 0.15), "spare": true,
		"patterns": ["volley", "charge", "nova", "radial"], "minion": "ogre", "shot": Color(1.0, 0.35, 0.1)},
	"orc": {"name": "Orc", "hp": 80.0, "speed": 75.0, "dmg": 10.0, "r": 20.0,
		"ai": "melee", "skill": "", "color": Color(0.45, 0.55, 0.3)},
	"orc_general": {"name": "General Orc", "hp": 320.0, "speed": 95.0, "dmg": 16.0, "r": 26.0,
		"ai": "charger", "skill": "", "color": Color(0.35, 0.45, 0.25)},
	"orc_lord": {"name": "Orc Lord Geld", "hp": 2800.0, "speed": 85.0, "dmg": 20.0, "r": 46.0,
		"ai": "boss", "skill": "starved", "color": Color(0.4, 0.5, 0.25),
		"patterns": ["charge", "summon", "nova", "regen", "volley"], "minion": "orc", "shot": Color(0.7, 0.9, 0.2)},
	"knight": {"name": "Cavaleiro de Falmuth", "hp": 120.0, "speed": 90.0, "dmg": 12.0, "r": 20.0,
		"ai": "melee", "skill": "", "color": Color(0.75, 0.75, 0.82)},
	"mage": {"name": "Mago de Falmuth", "hp": 70.0, "speed": 75.0, "dmg": 11.0, "r": 18.0,
		"ai": "ranged", "skill": "", "color": Color(0.35, 0.4, 0.8), "shot": Color(1.0, 1.0, 0.6)},
	"shogo": {"name": "Shogo Taguchi", "hp": 2000.0, "speed": 150.0, "dmg": 18.0, "r": 24.0,
		"ai": "boss", "skill": "", "color": Color(0.85, 0.65, 0.4),
		"patterns": ["charge", "volley", "radial", "summon", "charge"], "minion": "knight", "shot": Color(1.0, 0.9, 0.5)},
	"puppet": {"name": "Marionete de Clayman", "hp": 110.0, "speed": 125.0, "dmg": 12.0, "r": 18.0,
		"ai": "melee", "skill": "", "color": Color(0.7, 0.55, 0.75)},
	"clayman": {"name": "Clayman, Lorde Demônio", "hp": 3800.0, "speed": 130.0, "dmg": 20.0, "r": 28.0,
		"ai": "boss", "skill": "", "color": Color(0.85, 0.75, 0.95),
		"patterns": ["radial", "volley", "summon", "nova", "charge", "radial"], "minion": "puppet", "shot": Color(0.9, 0.4, 1.0)},
}

## special: habilidade especial usada de tempos em tempos
const ALLIES := {
	"ranga": {"name": "Ranga", "hp": 320.0, "speed": 230.0, "dmg": 16.0, "r": 22.0, "ranged": false,
		"special": "black_lightning", "cd": 6.0, "color": Color(0.2, 0.2, 0.28)},
	"gobta": {"name": "Gobta", "hp": 140.0, "speed": 170.0, "dmg": 8.0, "r": 14.0, "ranged": false,
		"special": "", "cd": 0.0, "color": Color(0.45, 0.7, 0.35)},
	"benimaru": {"name": "Benimaru", "hp": 420.0, "speed": 190.0, "dmg": 14.0, "r": 17.0, "ranged": true,
		"special": "hell_flare", "cd": 9.0, "color": Color(0.85, 0.15, 0.15)},
	"shion": {"name": "Shion", "hp": 480.0, "speed": 180.0, "dmg": 28.0, "r": 17.0, "ranged": false,
		"special": "big_slash", "cd": 5.0, "color": Color(0.55, 0.35, 0.75)},
	"shuna": {"name": "Shuna", "hp": 220.0, "speed": 170.0, "dmg": 7.0, "r": 15.0, "ranged": true,
		"special": "heal", "cd": 7.0, "color": Color(1.0, 0.7, 0.8)},
	"veldora": {"name": "Veldora", "hp": 2000.0, "speed": 210.0, "dmg": 35.0, "r": 20.0, "ranged": true,
		"special": "storm", "cd": 8.0, "color": Color(0.95, 0.8, 0.3)},
}
