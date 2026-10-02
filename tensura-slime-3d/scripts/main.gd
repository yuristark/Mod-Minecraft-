extends Node3D
## Cena principal: monta a Caverna Selada, o Rimuru, os monstros e o Veldora,
## e controla a história/objetivos do jogo.

const Util := preload("res://scripts/util.gd")
const Player := preload("res://scripts/player.gd")
const Enemy := preload("res://scripts/enemy.gd")
const Pickup := preload("res://scripts/pickup.gd")
const Veldora := preload("res://scripts/veldora.gd")
const Hud := preload("res://scripts/hud.gd")

const CAVE_HALF := 55.0
const NEED_MONSTERS := 5
const NEED_ORE := 6

const SKILL_LABELS := {
	"poison_breath": "Sopro Venenoso [1]",
	"sticky_thread": "Fio Pegajoso [2]",
	"ultrasound": "Ondas Ultrassônicas [3]",
	"shadow_motion": "Movimento Sombrio [Shift]",
	"hydraulic": "Propulsão Hidráulica (pulo duplo)",
}

var player
var hud
var veldora

## 0 = explorando, 1 = conheceu o Veldora, 2 = pronto para devorá-lo, 3 = vitória
var stage := 0
var monsters_eaten := 0
var ore_eaten := 0
var kills := 0
var elapsed := 0.0
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.seed = 1704  # caverna sempre igual
	_setup_input()
	_build_environment()
	_build_cave()

	veldora = Veldora.new()
	veldora.position = Vector3(0, 0, -20)
	add_child(veldora)

	player = Player.new()
	player.position = Vector3(0, 1, 14)
	add_child(player)

	_spawn_monsters()
	_spawn_pickups()

	hud = Hud.new()
	hud.player = player
	add_child(hud)
	_update_objective()
	hud.show_title("Tensura: Reencarnado como Slime 3D",
		"Você era Satoru Mikami, um homem comum de 37 anos... até ser esfaqueado e renascer " +
		"como um slime numa caverna escura.\n\n" +
		"CONTROLES\n" +
		"WASD: mover    Mouse: câmera    Espaço: pular\n" +
		"Clique esquerdo / Q: Lâmina d'Água    E: Predador (devorar)\n" +
		"F: conversar    1 / 2 / 3 / Shift: habilidades copiadas    Esc: soltar o mouse\n\n" +
		"Devore monstros derrotados para copiar suas habilidades!")
	hud.sage("Confirmação: reencarnação concluída. Habilidades únicas [Predador] e [Grande Sábio] adquiridas.")
	hud.sage("Notificação: uma aura gigantesca foi detectada ao norte.")


func _setup_input() -> void:
	var keys := {
		"move_forward": [KEY_W, KEY_UP], "move_back": [KEY_S, KEY_DOWN],
		"move_left": [KEY_A, KEY_LEFT], "move_right": [KEY_D, KEY_RIGHT],
		"jump": [KEY_SPACE], "predator": [KEY_E], "interact": [KEY_F],
		"water_blade": [KEY_Q], "poison_breath": [KEY_1], "sticky_thread": [KEY_2],
		"ultrasound": [KEY_3], "shadow_motion": [KEY_SHIFT], "restart": [KEY_R],
		"pause_mouse": [KEY_ESCAPE],
	}
	for action in keys:
		if InputMap.has_action(action):
			continue
		InputMap.add_action(action)
		for k in keys[action]:
			var ev := InputEventKey.new()
			ev.physical_keycode = k
			InputMap.action_add_event(action, ev)
		if action == "water_blade":
			var click := InputEventMouseButton.new()
			click.button_index = MOUSE_BUTTON_LEFT
			InputMap.action_add_event(action, click)


func _build_environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.01, 0.015, 0.04)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.35, 0.4, 0.6)
	env.ambient_light_energy = 0.55
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.glow_enabled = true
	env.glow_intensity = 0.9
	env.glow_bloom = 0.15
	env.fog_enabled = true
	env.fog_light_color = Color(0.08, 0.1, 0.2)
	env.fog_density = 0.012
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	# Luz fraca vinda de cima (frestas na rocha)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-70, 30, 0)
	sun.light_color = Color(0.5, 0.6, 0.9)
	sun.light_energy = 0.25
	sun.shadow_enabled = true
	add_child(sun)


func _build_cave() -> void:
	var rock := Util.mat(Color(0.22, 0.2, 0.24), 0.0, false, 0.95)
	var rock_dark := Util.mat(Color(0.14, 0.13, 0.17), 0.0, false, 0.95)
	var size := CAVE_HALF * 2.0

	add_child(Util.static_box(Vector3(size, 1, size), Util.mat(Color(0.17, 0.16, 0.2), 0.0, false, 1.0), Vector3(0, -0.5, 0)))
	add_child(Util.static_box(Vector3(size, 1, size), rock_dark, Vector3(0, 22, 0)))
	for i in 4:
		var horizontal := i < 2
		var sgn := -1.0 if i % 2 == 0 else 1.0
		var wsize := Vector3(size + 2, 24, 2) if horizontal else Vector3(2, 24, size + 2)
		var wpos := Vector3(0, 11, sgn * CAVE_HALF) if horizontal else Vector3(sgn * CAVE_HALF, 11, 0)
		add_child(Util.static_box(wsize, rock, wpos))

	# Pilares e rochas espalhados (evitando as áreas importantes)
	var keep_clear := [Vector3(0, 0, 14), Vector3(0, 0, -20), Vector3(-28, 0, 5)]
	var placed := 0
	while placed < 38:
		var p := Vector3(_rng.randf_range(-50, 50), 0, _rng.randf_range(-50, 50))
		var ok := true
		for c in keep_clear:
			if p.distance_to(c) < 11.0:
				ok = false
		if not ok:
			continue
		placed += 1
		if _rng.randf() < 0.4:
			var h := _rng.randf_range(6, 22)
			var w := _rng.randf_range(1.5, 3.5)
			add_child(Util.static_box(Vector3(w, h, w), rock, p + Vector3(0, h / 2.0, 0), _rng.randf() * TAU))
		else:
			var s := Vector3(_rng.randf_range(1.5, 4), _rng.randf_range(0.8, 2.5), _rng.randf_range(1.5, 4))
			add_child(Util.static_box(s, rock_dark, p + Vector3(0, s.y / 2.0, 0), _rng.randf() * TAU))

	# Estalactites (só visual)
	for i in 70:
		var h := _rng.randf_range(1.5, 6.0)
		var st := Util.cone(_rng.randf_range(0.4, 1.2), h, rock_dark,
			Vector3(_rng.randf_range(-52, 52), 21.5 - h / 2.0, _rng.randf_range(-52, 52)))
		st.rotation.x = PI
		add_child(st)

	# Cristais brilhantes que iluminam a caverna
	var colors := [Color(0.3, 0.6, 1.0), Color(0.6, 0.35, 1.0), Color(0.2, 0.9, 0.8)]
	for i in 22:
		var c: Color = colors[i % colors.size()]
		var pos := Vector3(_rng.randf_range(-50, 50), 0, _rng.randf_range(-50, 50))
		var cluster := Node3D.new()
		cluster.position = pos
		add_child(cluster)
		var m := Util.mat(c, 1.3)
		for j in 4:
			var cr := Util.cone(0.35, _rng.randf_range(1.0, 2.6), m, Vector3(_rng.randf_range(-0.6, 0.6), 0.6, _rng.randf_range(-0.6, 0.6)))
			cr.rotation = Vector3(_rng.randf_range(-0.4, 0.4), 0, _rng.randf_range(-0.4, 0.4))
			cluster.add_child(cr)
		var l := OmniLight3D.new()
		l.light_color = c
		l.omni_range = 11.0
		l.light_energy = 1.4
		l.position.y = 1.5
		cluster.add_child(l)

	# Lago subterrâneo (onde o Rimuru aprende a Propulsão Hidráulica)
	var lake := Util.cylinder(9.0, 0.06, Util.mat(Color(0.1, 0.35, 0.7, 0.6), 0.6, true, 0.05), Vector3(-28, 0.04, 5))
	add_child(lake)


func _spawn_monsters() -> void:
	var groups := [
		["spider", Vector3(-26, 0, -28), 4],
		["bat", Vector3(30, 0, -18), 4],
		["serpent", Vector3(26, 0, 28), 2],
		["wolf", Vector3(-26, 0, 32), 3],
		["lizard", Vector3(18, 0, -2), 2],
		["lizard", Vector3(-12, 0, -40), 2],
	]
	for g in groups:
		for i in g[2]:
			var e := Enemy.new()
			e.type_id = g[0]
			e.position = g[1] + Vector3(_rng.randf_range(-5, 5), 0.2, _rng.randf_range(-5, 5))
			add_child(e)


func _spawn_pickups() -> void:
	var ore_spots := [
		Vector3(8, 0, 22), Vector3(-10, 0, 20), Vector3(18, 0, -6), Vector3(-18, 0, -12),
		Vector3(40, 0, 5), Vector3(-40, 0, -5), Vector3(5, 0, -40), Vector3(35, 0, 40),
		Vector3(-38, 0, 42), Vector3(44, 0, -40),
	]
	for p in ore_spots:
		_pickup("ore", p)
	for p in [Vector3(-22, 0, 10), Vector3(-34, 0, 0), Vector3(15, 0, 15),
			Vector3(-5, 0, 38), Vector3(38, 0, -30), Vector3(20, 0, 40)]:
		_pickup("herb", p)
	_pickup("water", Vector3(-28, 0, 5))


func _pickup(kind: String, pos: Vector3) -> void:
	var p := Pickup.new()
	p.kind = kind
	p.position = pos
	add_child(p)


func _process(delta: float) -> void:
	if hud == null or player == null:
		return
	if stage < 3:
		elapsed += delta
	var d: float = player.global_position.distance_to(veldora.global_position) if is_instance_valid(veldora) else INF

	if stage == 0 and d < 15.0 and not hud.is_busy():
		_meet_veldora()

	# Dica de interação
	var prompt := ""
	if is_instance_valid(veldora) and d < veldora.talk_range and stage in [1, 2]:
		prompt = "[F] Conversar com Veldora" if stage == 1 else "[E] Devorar Veldora com o Predador"
	else:
		var near = _nearest_absorbable()
		if near != null and near != veldora:
			prompt = "[E] Devorar: " + near.get_absorb_name()
	hud.set_prompt(prompt)
	hud.set_stats("Monstros devorados: %d   Minérios: %d   Tempo: %s" % [monsters_eaten, ore_eaten, _fmt_time(elapsed)])


func _nearest_absorbable():
	var best = null
	var best_d := INF
	for n in get_tree().get_nodes_in_group("absorbable"):
		var d: float = n.global_position.distance_to(player.global_position)
		if d < Player.PREDATOR_RANGE and d < best_d:
			best = n
			best_d = d
	return best


func _fmt_time(t: float) -> String:
	return "%02d:%02d" % [int(t) / 60, int(t) % 60]


func _update_objective() -> void:
	match stage:
		0:
			hud.set_objective("Explore a Caverna Selada e encontre a origem da aura gigantesca (norte).")
		1:
			hud.set_objective("Fortaleça o Predador para analisar a Prisão Infinita:\n• Devore monstros: %d/%d\n• Devore Minérios Mágicos: %d/%d"
				% [mini(monsters_eaten, NEED_MONSTERS), NEED_MONSTERS, mini(ore_eaten, NEED_ORE), NEED_ORE])
		2:
			hud.set_objective("Volte até o Veldora e use o Predador [E] para devorá-lo junto com a Prisão Infinita.")
		3:
			hud.set_objective("Vitória!")


func _meet_veldora() -> void:
	stage = 1
	hud.show_dialogue([
		["Veldora", "Consegue me ouvir, pequenino? KUAHAHAHA! Eu sou Veldora, o Dragão da Tempestade, um dos quatro Verdadeiros Dragões!"],
		["Slime", "(Um dragão gigante?! E eu sou só um slime...)"],
		["Veldora", "Fui selado aqui pela heroína com a Prisão Infinita há 300 anos. Estou entediado até a alma! Que tal sermos amigos?"],
		["Slime", "Amigos? ...Tá bom! Mas só se você não ficar com raiva se eu não voltar pra conversar."],
		["Veldora", "KUAHAHA! Então vamos trocar nomes! A partir de hoje você é RIMURU TEMPEST, e eu serei VELDORA TEMPEST!"],
		["Grande Sábio", "Proposta: devorar o Veldora com o Predador e analisar a Prisão Infinita por dentro. Porém, o Predador ainda é fraco demais."],
		["Grande Sábio", "Sugestão: devore %d monstros e %d Minérios Mágicos para aumentar a capacidade." % [NEED_MONSTERS, NEED_ORE]],
	], func():
		hud.set_player_name("Rimuru Tempest")
		veldora.set_label("Veldora Tempest\n[F] Conversar")
		hud.sage("Notificação: você recebeu o nome \"Rimuru Tempest\". A quantidade de magículas aumentou!")
		player.max_mp += 30.0
		player.mp = player.max_mp
		_update_objective())


func player_interact(_p) -> void:
	if hud.is_busy() or not is_instance_valid(veldora):
		return
	if player.global_position.distance_to(veldora.global_position) > veldora.talk_range:
		return
	if stage == 1:
		hud.show_dialogue([
			["Veldora", "Ainda não está pronto? Ande logo, Rimuru! Devore monstros e Minérios Mágicos. Eu espero... não tenho outra escolha mesmo. KUAHAHA!"],
		], Callable())
	elif stage == 2:
		hud.show_dialogue([
			["Veldora", "Então chegou a hora! Pode me devorar, amigo. Confio em você!"],
		], Callable())


func can_absorb(target) -> bool:
	if target == veldora:
		if stage < 1:
			return false
		if stage == 1:
			hud.sage("Análise falhou: capacidade do Predador insuficiente. Devore %d monstros e %d minérios." % [NEED_MONSTERS, NEED_ORE])
			return false
	return true


func on_absorbed(target) -> void:
	if target == veldora:
		_victory()
		return
	if target.is_in_group("enemy") or target.get("type_id") != null:
		monsters_eaten += 1
		player.max_hp += 5.0
		player.hp = minf(player.hp + 20.0, player.max_hp)
		var skill: String = target.data.skill
		if skill != "" and not player.skills.has(skill):
			player.grant_skill(skill)
			hud.sage("Informe: análise de [%s] concluída. Habilidade adquirida: %s!" % [target.data.name, SKILL_LABELS[skill]])
		else:
			hud.sage("Informe: [%s] devorado e armazenado no Estômago." % target.data.name)
	else:
		match target.kind:
			"ore":
				ore_eaten += 1
				player.max_mp += 5.0
				player.mp = player.max_mp
				hud.sage("Informe: Minério Mágico armazenado. Magículas máximas aumentaram.")
			"herb":
				player.hp = minf(player.hp + 40.0, player.max_hp)
				hud.sage("Informe: Erva Hipokute analisada. Poção de cura produzida e usada (+40 vida).")
			"water":
				player.grant_skill("hydraulic")
				hud.sage("Informe: água absorvida. Habilidade adquirida: %s! Aperte Espaço no ar." % SKILL_LABELS["hydraulic"])
	_check_progress()
	_update_objective()


func _check_progress() -> void:
	if stage == 1 and monsters_eaten >= NEED_MONSTERS and ore_eaten >= NEED_ORE:
		stage = 2
		veldora.set_label("Veldora Tempest\n[E] Predador")
		hud.sage("Informe: condições satisfeitas! O Predador agora pode conter a Prisão Infinita. Volte ao Veldora.")


func on_enemy_killed(_e) -> void:
	kills += 1


func on_player_died() -> void:
	hud.show_end("Você foi derrotado...",
		"O pequeno slime se desfez na escuridão da caverna.\n\nMonstros devorados: %d\nMinérios: %d\nTempo: %s"
		% [monsters_eaten, ore_eaten, _fmt_time(elapsed)])


func _victory() -> void:
	stage = 3
	_update_objective()
	hud.show_dialogue([
		["Grande Sábio", "Informe: Veldora e a Prisão Infinita foram armazenados no Estômago. Análise da Prisão Infinita iniciada em paralelo."],
		["Veldora", "(Da barriga do slime) KUAHAHAHA! Que lugar confortável! Conto com você, Rimuru!"],
		["Rimuru", "Agora é hora de sair desta caverna e conhecer o mundo... Quem sabe até fundar uma nação para monstros!"],
	], func():
		hud.show_end("FIM — Vitória!",
			"Rimuru Tempest devorou o Dragão da Tempestade e saiu da Caverna Selada.\n\n" +
			"Monstros derrotados: %d\nMonstros devorados: %d\nMinérios: %d\nTempo: %s\n\nObrigado por jogar!"
			% [kills, monsters_eaten, ore_eaten, _fmt_time(elapsed)]))


func sage(text: String) -> void:
	hud.sage(text)
