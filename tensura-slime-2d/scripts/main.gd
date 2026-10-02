extends Node2D
## Controla o jogo: menu, capítulos da história, Labirinto Infinito, níveis,
## salvamento e funções usadas por todos (efeitos, projéteis, dano em área).

const Data := preload("res://scripts/data.gd")
const Chapters := preload("res://scripts/chapters.gd")
const World := preload("res://scripts/world.gd")
const Player := preload("res://scripts/player.gd")
const Enemy := preload("res://scripts/enemy.gd")
const Ally := preload("res://scripts/ally.gd")
const Npc := preload("res://scripts/npc.gd")
const Pickup := preload("res://scripts/pickup.gd")
const Projectile := preload("res://scripts/projectile.gd")
const Fx := preload("res://scripts/fx.gd")
const Hud := preload("res://scripts/hud.gd")
const Touch := preload("res://scripts/touch.gd")

const SAVE_PATH := "user://tensura2d_save.cfg"
const THEMES := ["cave", "forest", "village", "wetland", "town", "castle"]

var chapters: Array = Chapters.all()
var chapter_index := 0
var chapter: Dictionary
var unlocked := 1

# Progresso permanente (salvo)
var level := 1
var xp := 0.0
var skills_ever: Array = ["predator", "great_sage", "water_blade"]
var allies_ever: Array = []
var best_floor := 0
var touch_setting := -1  # -1 automático, 0 desligado, 1 ligado

# Labirinto Infinito
var endless := false
var floor_n := 1
var run_bonus := {}
var enemy_hp_mult := 1.0
var enemy_dmg_mult := 1.0
var _endless_kills := 0
var _spawn_t := 0.0

var hud
var touch
var player
var level_node: Node2D
var world
var npcs := {}
var boss = null

var step_index := -1
var step: Dictionary = {}
var _step_ready := false   # etapa já iniciada (diálogo inicial terminou)
var _wave := 0
var _count_monsters := 0
var _count_ore := 0
var _time := 0.0
var _kills := 0
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	RenderingServer.set_default_clear_color(Color.BLACK)
	_setup_input()
	_load()
	hud = Hud.new()
	hud.main = self
	add_child(hud)
	touch = Touch.new()
	touch.main = self
	add_child(touch)
	set_touch(_touch_default(), false)
	show_menu()


func _setup_input() -> void:
	var keys := {
		"move_up": [KEY_W, KEY_UP], "move_down": [KEY_S, KEY_DOWN],
		"move_left": [KEY_A, KEY_LEFT], "move_right": [KEY_D, KEY_RIGHT],
		"devour": [KEY_E], "interact": [KEY_F], "shadow_motion": [KEY_SPACE], "mimicry": [KEY_Q],
		"poison_breath": [KEY_1], "sticky_thread": [KEY_2], "ultrasound": [KEY_3],
		"black_lightning": [KEY_4], "black_flame": [KEY_5], "starved": [KEY_6], "megiddo": [KEY_7],
		"dragon_storm": [KEY_8], "azathoth": [KEY_9],
		"pause": [KEY_ESCAPE, KEY_P], "attack": [], "touch_attack": [],
	}
	for action in keys:
		if InputMap.has_action(action):
			continue
		InputMap.add_action(action)
		for k in keys[action]:
			var ev := InputEventKey.new()
			ev.physical_keycode = k
			InputMap.action_add_event(action, ev)
		if action == "attack":
			var click := InputEventMouseButton.new()
			click.button_index = MOUSE_BUTTON_LEFT
			InputMap.action_add_event(action, click)


# ---------------------------------------------------------------- salvamento

func _load() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(SAVE_PATH) != OK:
		return
	unlocked = clampi(int(cfg.get_value("progress", "unlocked", 1)), 1, chapters.size())
	level = maxi(1, int(cfg.get_value("progress", "level", 1)))
	xp = float(cfg.get_value("progress", "xp", 0.0))
	skills_ever = cfg.get_value("progress", "skills", skills_ever)
	allies_ever = cfg.get_value("progress", "allies", allies_ever)
	best_floor = int(cfg.get_value("progress", "best_floor", 0))
	touch_setting = int(cfg.get_value("settings", "touch", -1))


func _save() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("progress", "unlocked", unlocked)
	cfg.set_value("progress", "level", level)
	cfg.set_value("progress", "xp", xp)
	cfg.set_value("progress", "skills", skills_ever)
	cfg.set_value("progress", "allies", allies_ever)
	cfg.set_value("progress", "best_floor", best_floor)
	cfg.set_value("settings", "touch", touch_setting)
	cfg.save(SAVE_PATH)


## Guarda habilidades e aliados conquistados para usar no Labirinto Infinito.
func _remember_progress() -> void:
	if player == null or not is_instance_valid(player):
		return
	for id in player.skills:
		if not skills_ever.has(id):
			skills_ever.append(id)
	for a in get_tree().get_nodes_in_group("ally"):
		if not allies_ever.has(a.type_id):
			allies_ever.append(a.type_id)
	_save()


# ---------------------------------------------------------------- níveis (sem limite)

func xp_needed() -> float:
	return floorf(40.0 * pow(level, 1.35)) + 20.0


func power_mult() -> float:
	return (1.0 + (level - 1) * 0.04) * run_bonus.get("power", 1.0)


func gain_xp(amount: float) -> void:
	xp += amount
	var leveled := false
	while xp >= xp_needed():
		xp -= xp_needed()
		level += 1
		leveled = true
		if player != null and is_instance_valid(player):
			player.max_hp += 8.0
			player.max_mp += 6.0
			player.hp = player.max_hp
			player.mp = player.max_mp
	if leveled:
		hud.banner("SUBIU DE NÍVEL!  Nv %d" % level)
		sage("Nível %d alcançado: vida, magículas e dano aumentaram." % level)
		if player != null and is_instance_valid(player):
			fx("ring", player.global_position, Color(1.0, 0.85, 0.3), 160.0, 0.8)
		if level % 10 == 0:
			sage("Marco de evolução! Nível %d. O poder do Rimuru não tem limites!" % level)
		_save()


# ---------------------------------------------------------------- controles de toque

func _touch_default() -> bool:
	if touch_setting >= 0:
		return touch_setting == 1
	return DisplayServer.is_touchscreen_available() or OS.has_feature("mobile") or OS.has_feature("web_android") or OS.has_feature("web_ios")


func set_touch(on: bool, save := true) -> void:
	touch.visible = on
	touch.set_process(on)
	touch.set_process_input(on)
	hud.touch_mode = on
	if player != null and is_instance_valid(player):
		player.touch_mode = on
	if save:
		touch_setting = 1 if on else 0
		_save()


# ---------------------------------------------------------------- menu

func show_menu() -> void:
	_clear_level()
	var buttons := []
	for i in chapters.size():
		var idx: int = i
		var t: String = chapters[i].title
		buttons.append([(t if i < unlocked else "[bloqueado] " + t.split(" — ")[0]), func(): start_chapter(idx), i < unlocked])
	buttons.append(["LABIRINTO INFINITO — andar 1", func(): start_endless(1), true])
	var checkpoint := _checkpoint()
	if checkpoint > 1:
		buttons.append(["LABIRINTO INFINITO — continuar do andar %d" % checkpoint, func(): start_endless(checkpoint), true])
	buttons.append(["Controles de toque: " + ("LIGADOS" if hud.touch_mode else "DESLIGADOS"), func():
		set_touch(not hud.touch_mode)
		show_menu(), true])
	hud.show_menu("Tensura: Reencarnado como Slime 2D",
		"Rimuru Nv %d   •   Recorde no Labirinto: andar %d\n" % [level, best_floor] +
		"PC: WASD mover, mouse mirar, clique atacar (segure), E devorar, F falar, Espaço dash, Q forma, 1–9 habilidades, Esc pausa.\n" +
		"Celular: joystick à esquerda e botões à direita (mira automática).",
		buttons, "Seu nível, habilidades e aliados ficam salvos para sempre.", 2)


func _checkpoint() -> int:
	# A cada 10 andares vencidos você pode recomeçar dali
	return (best_floor / 10) * 10 + 1 if best_floor >= 10 else 1


func in_game() -> bool:
	return level_node != null and player != null and is_instance_valid(player) and not player.dead


func restart_current() -> void:
	if endless:
		_load_floor()
	else:
		start_chapter(chapter_index)


func _clear_level() -> void:
	if level_node != null:
		remove_child(level_node)
		level_node.queue_free()
	level_node = null
	player = null
	hud.player = null
	touch.player = null
	boss = null
	npcs.clear()
	hud.set_boss(null)
	hud.set_prompt("")
	for a in ["move_left", "move_right", "move_up", "move_down", "touch_attack"]:
		Input.action_release(a)


# ---------------------------------------------------------------- montagem de fases

func start_chapter(i: int) -> void:
	endless = false
	run_bonus = {}
	enemy_hp_mult = 1.0
	enemy_dmg_mult = 1.0
	chapter_index = i
	_build_level(chapters[i])


func start_endless(start_floor: int) -> void:
	endless = true
	run_bonus = {}
	floor_n = start_floor
	_load_floor()


func _load_floor() -> void:
	var boss_floor := floor_n % 5 == 0
	enemy_hp_mult = 1.0 + 0.15 * (floor_n - 1)
	enemy_dmg_mult = 1.0 + 0.07 * (floor_n - 1)
	var base_hp := 150.0
	var base_mp := 180.0
	var pname := "Rimuru Tempest"
	if skills_ever.has("azathoth"):
		base_hp = 700.0
		base_mp = 850.0
		pname = "Rimuru Tempest (Verdadeiro Dragão)"
	elif skills_ever.has("beelzebub"):
		base_hp = 350.0
		base_mp = 450.0
		pname = "Rimuru Tempest (Lorde Demônio)"
	var rng := RandomNumberGenerator.new()
	rng.seed = floor_n * 7919
	var steps := []
	if boss_floor:
		var b: String = Data.ENDLESS_BOSSES[(floor_n / 5 - 1) % Data.ENDLESS_BOSSES.size()]
		steps.append({"type": "boss", "boss": b, "pos": Vector2(1100, 400), "devour": true,
			"obj": "Andar %d — CHEFE: derrote %s!" % [floor_n, Data.ENEMIES[b].name]})
	else:
		steps.append({"type": "endless", "quota": mini(10 + 3 * floor_n, 70),
			"obj": "Andar %d — derrote inimigos: %%d/%%d" % floor_n})
	var ch := {
		"title": "Labirinto Infinito — Andar %d" % floor_n,
		"theme": THEMES[rng.randi() % THEMES.size()], "size": Vector2(2200, 1700), "seed": floor_n * 31,
		"player_pos": Vector2(1100, 1450), "name": pname,
		"skills": skills_ever, "hp": base_hp, "mp": base_mp,
		"demon_lord": skills_ever.has("beelzebub"),
		"allies": allies_ever.slice(0, 6),
		"npcs": [], "spawns": [], "pickups": [["ore", Vector2(rng.randf_range(200, 2000), rng.randf_range(200, 1200))]],
		"herbs": 5, "steps": steps,
	}
	_build_level(ch)


func _build_level(ch: Dictionary) -> void:
	_clear_level()
	chapter = ch
	_rng.seed = int(chapter.seed) * 7 + 1
	_time = 0.0
	_kills = 0
	_endless_kills = 0
	level_node = Node2D.new()
	level_node.name = "Level"
	add_child(level_node)

	var clear_points: Array = [chapter.player_pos]
	for n in chapter.npcs:
		clear_points.append(n[1])
	for s in chapter.steps:
		if s.has("pos"):
			clear_points.append(s.pos)
		if s.has("from"):
			clear_points.append(s.from)
	world = World.new()
	level_node.add_child(world)
	world.build(chapter.size, chapter.theme, chapter.seed, clear_points)

	for n in chapter.npcs:
		_add_npc(n[0], n[1])
	for s in chapter.spawns:
		for k in s[2]:
			spawn_enemy(s[0], s[1] + Vector2(_rng.randf_range(-120, 120), _rng.randf_range(-120, 120)), "")
	for p in chapter.pickups:
		_add_pickup(p[0], p[1])
	for k in chapter.herbs:
		var tries := 0
		while tries < 50:
			tries += 1
			var pos := Vector2(_rng.randf_range(150, chapter.size.x - 150), _rng.randf_range(150, chapter.size.y - 150))
			if world._is_clear(pos, 50.0):
				_add_pickup("herb", pos)
				break

	player = Player.new()
	player.position = chapter.player_pos
	level_node.add_child(player)
	for id in chapter.skills:
		player.skills[id] = true
	var bonus_lv := level - 1
	player.max_hp = chapter.hp + bonus_lv * 8.0
	player.max_mp = chapter.mp + bonus_lv * 6.0
	if endless:
		player.max_hp *= run_bonus.get("vitality", 1.0)
		player.max_mp *= run_bonus.get("mana_max", 1.0)
		player.speed_mult = run_bonus.get("speed", 1.0)
		player.cd_mult = run_bonus.get("cooldown", 1.0)
		player.regen_bonus = run_bonus.get("regen", 0.0)
		player.devour_heal = 10.0 + run_bonus.get("glutton", 0.0)
	player.hp = player.max_hp
	player.mp = player.max_mp
	player.mp_regen = chapter.get("mp_regen", 7.0) * run_bonus.get("mana", 1.0)
	player.demon_lord = chapter.get("demon_lord", false)
	player.touch_mode = hud.touch_mode
	var cam := Camera2D.new()
	cam.limit_left = -40
	cam.limit_top = -40
	cam.limit_right = int(chapter.size.x) + 40
	cam.limit_bottom = int(chapter.size.y) + 40
	cam.position_smoothing_enabled = true
	cam.position_smoothing_speed = 8.0
	player.add_child(cam)
	for a in chapter.allies:
		_add_ally(a)
	for a in run_bonus.get("extra_allies", []):
		_add_ally(a)

	hud.player = player
	touch.player = player
	hud.set_player_name(chapter.name)
	hud.set_chapter(chapter.title)
	hud.banner(chapter.title)
	step_index = -1
	_next_step_after(chapter.get("intro", []))


func _add_npc(id: String, pos: Vector2) -> void:
	var n := Npc.new()
	n.id = id
	n.position = pos
	level_node.add_child(n)
	npcs[id] = n


func _add_pickup(kind: String, pos: Vector2) -> void:
	var p := Pickup.new()
	p.kind = kind
	p.position = pos
	level_node.add_child(p)


func _add_ally(id: String) -> void:
	for a in get_tree().get_nodes_in_group("ally"):
		if a.type_id == id:
			return
	var a := Ally.new()
	a.type_id = id
	a.follow_index = get_tree().get_nodes_in_group("ally").size()
	a.position = (player.global_position if player else chapter.player_pos) + Vector2(_rng.randf_range(-60, 60), 50)
	level_node.add_child(a)


func spawn_enemy(type_id: String, pos: Vector2, tag: String):
	var e := Enemy.new()
	e.type_id = type_id
	e.tag = tag
	e.hp_mult = enemy_hp_mult
	e.dmg_mult = enemy_dmg_mult
	var sz: Vector2 = chapter.size
	e.position = pos.clamp(Vector2(40, 40), sz - Vector2(40, 40))
	level_node.add_child(e)
	if tag == "wave":
		e.add_to_group("wave_enemy")
	return e


# ---------------------------------------------------------------- etapas da história

func _next_step_after(lines: Array) -> void:
	if lines.is_empty():
		_begin_next_step()
	else:
		hud.show_dialogue(lines, _begin_next_step)


func _begin_next_step() -> void:
	step_index += 1
	_step_ready = false
	if step_index >= chapter.steps.size():
		_chapter_complete()
		return
	step = chapter.steps[step_index]
	_count_monsters = 0
	_count_ore = 0
	_wave = 0
	_update_objective()
	var start: Array = step.get("start", [])
	if start.is_empty():
		_setup_step()
	else:
		hud.show_dialogue(start, _setup_step)


func _setup_step() -> void:
	_step_ready = true
	match step.type:
		"waves":
			_spawn_wave()
		"boss":
			boss = spawn_enemy(step.boss, step.pos, "boss")
			hud.banner(boss.data.name)
		"devour_npc":
			if npcs.has(step.npc):
				npcs[step.npc].add_to_group("absorbable")
		"event":
			_complete_step()


func _spawn_wave() -> void:
	var w: Array = step.waves[_wave]
	var from: Vector2 = step.from
	for group in w:
		for k in group[1]:
			spawn_enemy(group[0], from + Vector2(_rng.randf_range(-500, 500), _rng.randf_range(-80, 140)), "wave")
	sage("Alerta: onda %d de %d se aproximando!" % [_wave + 1, step.waves.size()])
	_update_objective()


func _update_objective() -> void:
	var text: String = step.get("obj", "")
	match step.get("type", ""):
		"devour":
			text = text % [mini(_count_monsters, step.monsters), step.monsters, mini(_count_ore, step.ore), step.ore]
		"waves":
			text = text % [_wave + 1, step.waves.size()]
		"endless":
			text = text % [mini(_endless_kills, step.quota), step.quota]
	hud.set_objective(text)


func _complete_step() -> void:
	var finished := step
	_step_ready = false
	hud.show_dialogue(finished.get("lines", []), func():
		for a in finished.get("actions", []):
			_do_action(a)
		_remember_progress()
		_begin_next_step())


func _do_action(a: Array) -> void:
	match a[0]:
		"name":
			hud.set_player_name(a[1])
		"grant":
			player.skills[a[1]] = true
		"revoke":
			player.skills.erase(a[1])
		"ally":
			_add_ally(a[1])
		"remove_ally":
			for al in get_tree().get_nodes_in_group("ally"):
				if al.type_id == a[1]:
					al.remove_from_group("ally")
					al.remove_from_group("friend")
					al.queue_free()
		"npc":
			if npcs.has(a[1]) and is_instance_valid(npcs[a[1]]):
				npcs[a[1]].position = a[2]
			else:
				_add_npc(a[1], a[2])
		"remove_npc":
			if npcs.has(a[1]):
				if is_instance_valid(npcs[a[1]]):
					npcs[a[1]].queue_free()
				npcs.erase(a[1])
		"rename_npc":
			if npcs.has(a[1]):
				npcs[a[1]].set_display_name(a[2])
		"stats":
			var bonus_lv := level - 1
			player.max_hp = maxf(player.max_hp, a[1] + bonus_lv * 8.0)
			player.max_mp = maxf(player.max_mp, a[2] + bonus_lv * 6.0)
			player.hp = player.max_hp
			player.mp = player.max_mp
		"mp_regen":
			player.mp_regen = a[1]
		"heal":
			player.hp = player.max_hp
			player.mp = player.max_mp
		"sage":
			sage(a[1])
		"demon_lord":
			player.demon_lord = true
			player.skills.erase("predator")
			player.skills.erase("great_sage")
			player.skills["beelzebub"] = true
			player.skills["raphael"] = true
			player.skills["megiddo"] = true
			var bonus_lv := level - 1
			player.max_hp = 350.0 + bonus_lv * 8.0
			player.max_mp = 450.0 + bonus_lv * 6.0
			player.hp = player.max_hp
			player.mp = player.max_mp
			hud.set_player_name("Rimuru Tempest (Lorde Demônio)")
			fx("ring", player.global_position, Color(0.5, 0.7, 1.0), 400.0, 1.2)
			hud.banner("Rimuru se tornou um LORDE DEMÔNIO!")


func _chapter_complete() -> void:
	hud.set_boss(null)
	_remember_progress()
	if endless:
		_floor_complete()
		return
	hud.set_objective("Capítulo concluído!")
	var last := chapter_index >= chapters.size() - 1
	if chapter_index + 2 > unlocked:
		unlocked = mini(chapter_index + 2, chapters.size())
	_save()
	var stats := "Tempo: %02d:%02d   Inimigos derrotados: %d   Nível: %d" % [int(_time) / 60, int(_time) % 60, _kills, level]
	var buttons := []
	if last:
		buttons.append(["Ir para o LABIRINTO INFINITO", func(): start_endless(_checkpoint()), true])
		buttons.append(["Menu principal", show_menu, true])
		hud.show_end("FIM DA HISTÓRIA — Rimuru Tempest, Verdadeiro Dragão",
			"Do slime solitário na caverna ao Verdadeiro Dragão que salvou o Veldora.\n" +
			"Tempest é a nação mais divertida do mundo... e a aventura continua no Labirinto Infinito da Ramiris!\n\n" +
			stats, buttons)
	else:
		var next: int = chapter_index + 1
		buttons.append(["Próximo: " + chapters[next].title, func(): start_chapter(next), true])
		buttons.append(["Jogar este capítulo de novo", func(): start_chapter(chapter_index), true])
		buttons.append(["Menu principal", show_menu, true])
		hud.show_end(chapter.title + " — concluído!", stats, buttons)


func _floor_complete() -> void:
	if floor_n > best_floor:
		best_floor = floor_n
	_save()
	# Três bênçãos aleatórias para escolher
	var options: Array = Data.BLESSINGS.duplicate()
	options.shuffle()
	var buttons := []
	for i in 3:
		var b: Array = options[i]
		buttons.append([b[1] + " — " + b[2], func():
			_apply_blessing(b[0])
			floor_n += 1
			_load_floor(), true])
	hud.show_choice("Andar %d concluído!" % floor_n,
		"Nível %d   •   Recorde: andar %d\nA Ramiris oferece uma bênção para o próximo andar. Escolha uma:" % [level, best_floor],
		buttons)


func _apply_blessing(id: String) -> void:
	match id:
		"power":
			run_bonus["power"] = run_bonus.get("power", 1.0) * 1.25
		"vitality":
			run_bonus["vitality"] = run_bonus.get("vitality", 1.0) * 1.3
		"mana":
			run_bonus["mana"] = run_bonus.get("mana", 1.0) * 1.5
			run_bonus["mana_max"] = run_bonus.get("mana_max", 1.0) * 1.2
		"speed":
			run_bonus["speed"] = run_bonus.get("speed", 1.0) * 1.15
		"cooldown":
			run_bonus["cooldown"] = run_bonus.get("cooldown", 1.0) * 0.85
		"regen":
			run_bonus["regen"] = run_bonus.get("regen", 0.0) + 3.0
		"glutton":
			run_bonus["glutton"] = run_bonus.get("glutton", 0.0) + 25.0
		"ally":
			var have: Array = allies_ever.slice(0, 6) + run_bonus.get("extra_allies", [])
			var avail := []
			for k in Data.ALLIES:
				if not have.has(k):
					avail.append(k)
			if avail.is_empty():
				run_bonus["power"] = run_bonus.get("power", 1.0) * 1.25
			else:
				var extra: Array = run_bonus.get("extra_allies", [])
				extra.append(avail[randi() % avail.size()])
				run_bonus["extra_allies"] = extra


func _process(delta: float) -> void:
	if not in_game():
		return
	_time += delta
	hud.set_boss(boss)
	_update_prompt()
	if not _step_ready or hud.is_busy():
		return
	match step.get("type", ""):
		"waves":
			var alive := 0
			for e in get_tree().get_nodes_in_group("wave_enemy"):
				if not e.dead:
					alive += 1
			if alive == 0:
				_wave += 1
				if _wave >= step.waves.size():
					_complete_step()
				else:
					_spawn_wave()
		"boss":
			if boss != null and is_instance_valid(boss) and boss.dead and not step.get("devour", false):
				_clear_minions()
				_complete_step()
		"endless":
			_endless_tick(delta)


func _endless_tick(delta: float) -> void:
	if _endless_kills >= step.quota:
		for e in get_tree().get_nodes_in_group("enemy"):
			e.take_damage(999999.0)
		_complete_step()
		return
	_spawn_t -= delta
	if _spawn_t > 0.0:
		return
	_spawn_t = maxf(0.25, 0.9 - floor_n * 0.02)
	var alive := 0
	for e in get_tree().get_nodes_in_group("wave_enemy"):
		if not e.dead:
			alive += 1
	var cap := mini(6 + floor_n, 30)
	if alive >= cap or alive + _endless_kills >= step.quota:
		return
	# Monstros mais fortes aparecem nos andares mais altos
	var pool_size := mini(Data.ENDLESS_POOL.size(), 4 + floor_n / 2)
	var type_id: String = Data.ENDLESS_POOL[_rng.randi() % pool_size]
	for i in 20:
		var pos := Vector2(_rng.randf_range(80, chapter.size.x - 80), _rng.randf_range(80, chapter.size.y - 80))
		if pos.distance_to(player.global_position) > 520.0:
			spawn_enemy(type_id, pos, "wave")
			return


func _clear_minions() -> void:
	for e in get_tree().get_nodes_in_group("enemy"):
		if e.tag == "minion":
			e.take_damage(999999.0)


func _update_prompt() -> void:
	var text := ""
	if _step_ready and step.get("type", "") == "talk" and npcs.has(step.npc):
		var n = npcs[step.npc]
		if n.global_position.distance_to(player.global_position) < n.talk_range:
			text = "[F] Conversar com " + n.display_name
	if text == "":
		var best = null
		var best_d := INF
		for a in get_tree().get_nodes_in_group("absorbable"):
			var d: float = a.global_position.distance_to(player.global_position)
			var r = a.get("absorb_range")
			if d < (r if r != null else 80.0) and d < best_d:
				best = a
				best_d = d
		if best != null:
			text = "[E] Devorar: " + best.get_absorb_name()
	if hud.touch_mode:
		text = text.replace("[F]", "[FALAR]").replace("[E]", "[DEVORAR]")
	hud.set_prompt(text)


# ---------------------------------------------------------------- eventos chamados pelos personagens

func player_interact() -> void:
	if hud.is_busy() or not _step_ready:
		return
	if step.get("type", "") == "talk" and npcs.has(step.npc):
		var n = npcs[step.npc]
		if n.global_position.distance_to(player.global_position) < n.talk_range:
			_complete_step()
			return
	for id in npcs:
		var n = npcs[id]
		if is_instance_valid(n) and n.global_position.distance_to(player.global_position) < n.talk_range:
			hud.show_dialogue([[n.display_name, "Boa sorte, Rimuru!"]], Callable())
			return


func can_devour(target) -> bool:
	if target is Npc:
		return _step_ready and step.get("type", "") == "devour_npc" and npcs.get(step.npc) == target
	return true


func on_devoured(target) -> void:
	if target is Npc:
		npcs.erase(step.npc)
		_complete_step()
		return
	if target is Enemy:
		_count_monsters += 1
		gain_xp(target.xp * 0.5)
		var skill: String = target.data.skill
		if skill != "" and not player.skills.has(skill):
			player.skills[skill] = true
			sage("Análise de [%s] concluída! Habilidade adquirida: %s (%s)." % [target.data.name, Data.SKILLS[skill].name, Data.SKILLS[skill].key])
			_remember_progress()
		else:
			sage("[%s] devorado e armazenado no Estômago." % target.data.name)
		if target == boss:
			boss = null
			_clear_minions()
			if _step_ready and step.get("type", "") == "boss":
				_complete_step()
				return
	elif target is Pickup:
		if target.kind == "ore":
			_count_ore += 1
			player.max_mp += 5.0
			player.mp = player.max_mp
			gain_xp(15.0)
			sage("Minério Mágico armazenado. Magículas máximas aumentaram.")
		else:
			player.heal(40.0)
			sage("Erva Hipokute analisada: poção de cura usada.")
	if step.get("type", "") == "devour":
		_update_objective()
		if _count_monsters >= step.monsters and _count_ore >= step.ore and _step_ready:
			_complete_step()


func on_enemy_died(e) -> void:
	_kills += 1
	gain_xp(e.xp)
	if endless and e.tag == "wave":
		_endless_kills += 1
		_update_objective()
	if e == boss and step.get("devour", false) and e.can_be_devoured():
		hud.set_objective("Devore o corpo de %s com o Predador (E)!" % e.data.name)
		sage("Inimigo derrotado. Recomendação: devore-o para analisar seu poder.")
		_clear_minions()


func on_player_died() -> void:
	_remember_progress()
	var t := get_tree().create_timer(0.8)
	t.timeout.connect(func():
		if endless:
			if floor_n - 1 > best_floor:
				best_floor = floor_n - 1
				_save()
			var cp := _checkpoint()
			var buttons := [["Tentar o andar %d de novo" % floor_n, _load_floor, true],
				["Recomeçar do andar %d" % cp, func(): start_endless(cp), true],
				["Menu principal", show_menu, true]]
			hud.show_end("Você caiu no andar %d!" % floor_n,
				"Recorde: andar %d   •   Nível %d (o nível e as habilidades continuam salvos)\n" % [best_floor, level] +
				"Ramiris: \"Relaxa, no meu labirinto ninguém morre de verdade! Hehe!\"", buttons)
		else:
			hud.show_end("Você foi derrotado...",
				"O slime se desfez... mas toda história de reencarnação merece outra chance!\nO nível que você ganhou continua salvo.",
				[["Tentar de novo", func(): start_chapter(chapter_index), true], ["Menu principal", show_menu, true]]))


func sage(text: String) -> void:
	hud.sage(text)


func fx(kind: String, pos: Vector2, color: Color, size: float, duration: float, target := Vector2.ZERO, text := "") -> void:
	if level_node == null:
		return
	var f := Fx.new()
	f.kind = kind
	f.position = pos
	f.color = color
	f.size = size
	f.duration = duration
	f.target = target
	f.text = text
	level_node.add_child(f)


func shoot(team: String, pos: Vector2, vel: Vector2, dmg: float, color: Color, opts := {}) -> void:
	if level_node == null:
		return
	var p := Projectile.new()
	p.team = team
	p.position = pos
	p.velocity = vel
	p.damage = dmg
	p.color = color
	p.element = opts.get("element", "")
	p.style = opts.get("style", "orb")
	p.radius = opts.get("radius", 8.0)
	p.pierce = opts.get("pierce", false)
	p.status = opts.get("status", "")
	p.status_time = opts.get("status_time", 0.0)
	p.life = opts.get("life", 2.0)
	level_node.add_child(p)


func damage_area(team: String, center: Vector2, radius: float, dmg: float, element: String, status: String, status_time: float) -> void:
	var group := "enemy" if team == "player" else "friend"
	for n in get_tree().get_nodes_in_group(group):
		if n.global_position.distance_to(center) < radius + n.radius:
			n.take_damage(dmg, element, center)
			if status != "" and n.has_method("apply_status"):
				n.apply_status(status, status_time)
