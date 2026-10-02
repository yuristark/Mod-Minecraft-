extends Node2D
## Controla o jogo: menu, capítulos, etapas da história, salvamento
## e funções usadas por todos (efeitos, projéteis, dano em área).

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

const SAVE_PATH := "user://tensura2d_save.cfg"

var chapters: Array = Chapters.all()
var chapter_index := 0
var chapter: Dictionary
var unlocked := 1

var hud
var player
var level: Node2D
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
	show_menu()


func _setup_input() -> void:
	var keys := {
		"move_up": [KEY_W, KEY_UP], "move_down": [KEY_S, KEY_DOWN],
		"move_left": [KEY_A, KEY_LEFT], "move_right": [KEY_D, KEY_RIGHT],
		"devour": [KEY_E], "interact": [KEY_F], "shadow_motion": [KEY_SPACE], "mimicry": [KEY_Q],
		"poison_breath": [KEY_1], "sticky_thread": [KEY_2], "ultrasound": [KEY_3],
		"black_lightning": [KEY_4], "black_flame": [KEY_5], "starved": [KEY_6], "megiddo": [KEY_7],
		"pause": [KEY_ESCAPE, KEY_P], "attack": [],
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
	if cfg.load(SAVE_PATH) == OK:
		unlocked = clampi(int(cfg.get_value("progress", "unlocked", 1)), 1, chapters.size())


func _save() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("progress", "unlocked", unlocked)
	cfg.save(SAVE_PATH)


# ---------------------------------------------------------------- menu / capítulos

func show_menu() -> void:
	_clear_level()
	var titles := []
	for c in chapters:
		titles.append(c.title)
	hud.show_menu(titles, unlocked)


func in_game() -> bool:
	return level != null and player != null and not player.dead


func _clear_level() -> void:
	if level != null:
		remove_child(level)
		level.queue_free()
	level = null
	player = null
	hud.player = null
	boss = null
	npcs.clear()
	hud.set_boss(null)
	hud.set_prompt("")


func start_chapter(i: int) -> void:
	_clear_level()
	chapter_index = i
	chapter = chapters[i]
	_rng.seed = int(chapter.seed) * 7 + 1
	_time = 0.0
	_kills = 0
	level = Node2D.new()
	level.name = "Level"
	add_child(level)

	var clear_points: Array = [chapter.player_pos]
	for n in chapter.npcs:
		clear_points.append(n[1])
	for s in chapter.steps:
		if s.has("pos"):
			clear_points.append(s.pos)
		if s.has("from"):
			clear_points.append(s.from)
	world = World.new()
	level.add_child(world)
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
	level.add_child(player)
	for id in chapter.skills:
		player.skills[id] = true
	player.max_hp = chapter.hp
	player.hp = chapter.hp
	player.max_mp = chapter.mp
	player.mp = chapter.mp
	player.mp_regen = chapter.get("mp_regen", 7.0)
	player.demon_lord = chapter.get("demon_lord", false)
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

	hud.player = player
	hud.set_player_name(chapter.name)
	hud.set_chapter(chapter.title)
	hud.banner(chapter.title)
	step_index = -1
	_next_step_after(chapter.get("intro", []))


func _add_npc(id: String, pos: Vector2) -> void:
	var n := Npc.new()
	n.id = id
	n.position = pos
	level.add_child(n)
	npcs[id] = n


func _add_pickup(kind: String, pos: Vector2) -> void:
	var p := Pickup.new()
	p.kind = kind
	p.position = pos
	level.add_child(p)


func _add_ally(id: String) -> void:
	for a in get_tree().get_nodes_in_group("ally"):
		if a.type_id == id:
			return
	var a := Ally.new()
	a.type_id = id
	a.follow_index = get_tree().get_nodes_in_group("ally").size()
	a.position = (player.global_position if player else chapter.player_pos) + Vector2(_rng.randf_range(-60, 60), 50)
	level.add_child(a)


func spawn_enemy(type_id: String, pos: Vector2, tag: String):
	var e := Enemy.new()
	e.type_id = type_id
	e.tag = tag
	var sz: Vector2 = chapter.size
	e.position = pos.clamp(Vector2(40, 40), sz - Vector2(40, 40))
	level.add_child(e)
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
	hud.sage("Alerta: onda %d de %d se aproximando!" % [_wave + 1, step.waves.size()])
	_update_objective()


func _update_objective() -> void:
	var text: String = step.get("obj", "")
	match step.get("type", ""):
		"devour":
			text = text % [mini(_count_monsters, step.monsters), step.monsters, mini(_count_ore, step.ore), step.ore]
		"waves":
			text = text % [_wave + 1, step.waves.size()]
	hud.set_objective(text)


func _complete_step() -> void:
	var finished := step
	_step_ready = false
	hud.show_dialogue(finished.get("lines", []), func():
		for a in finished.get("actions", []):
			_do_action(a)
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
			player.max_hp = maxf(player.max_hp, a[1])
			player.max_mp = maxf(player.max_mp, a[2])
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
			player.max_hp = 350.0
			player.max_mp = 450.0
			player.hp = player.max_hp
			player.mp = player.max_mp
			hud.set_player_name("Rimuru Tempest (Lorde Demônio)")
			fx("ring", player.global_position, Color(0.5, 0.7, 1.0), 400.0, 1.2)
			hud.banner("Rimuru se tornou um LORDE DEMÔNIO!")


func _chapter_complete() -> void:
	hud.set_boss(null)
	hud.set_objective("Capítulo concluído!")
	var last := chapter_index >= chapters.size() - 1
	if chapter_index + 2 > unlocked:
		unlocked = mini(chapter_index + 2, chapters.size())
		_save()
	var stats := "Tempo: %02d:%02d   Inimigos derrotados: %d" % [int(_time) / 60, int(_time) % 60, _kills]
	if last:
		hud.show_end("FIM — Rimuru Tempest, Lorde Demônio",
			"Do slime solitário na caverna ao Lorde Demônio que fundou a Federação de Tempest.\n" +
			"Veldora, Milim, os Kijin, Ranga e todos os monstros vivem juntos em paz... por enquanto!\n\n" +
			stats + "\n\nObrigado por jogar!", false)
	else:
		hud.show_end(chapter.title + " — concluído!", stats + "\n\nPróximo: " + chapters[chapter_index + 1].title, true)


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


func _clear_minions() -> void:
	for e in get_tree().get_nodes_in_group("enemy"):
		if e.tag == "minion":
			e.take_damage(99999.0)


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
		if _step_ready and step.get("type", "") == "devour_npc" and npcs.get(step.npc) == target:
			return true
		return false
	return true


func on_devoured(target) -> void:
	if target is Npc:
		npcs.erase(step.npc)
		_complete_step()
		return
	if target is Enemy:
		_count_monsters += 1
		player.max_hp += 2.0
		player.heal(10.0)
		var skill: String = target.data.skill
		if skill != "" and not player.skills.has(skill):
			player.skills[skill] = true
			sage("Análise de [%s] concluída! Habilidade adquirida: %s (%s)." % [target.data.name, Data.SKILLS[skill].name, Data.SKILLS[skill].key])
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
	if e == boss and step.get("devour", false) and e.can_be_devoured():
		hud.set_objective("Devore o corpo de %s com o Predador (E)!" % e.data.name)
		sage("Inimigo derrotado. Recomendação: devore-o para analisar seu poder.")
		_clear_minions()


func on_player_died() -> void:
	var t := get_tree().create_timer(0.8)
	t.timeout.connect(func():
		hud.show_end("Você foi derrotado...",
			"O slime se desfez... mas toda história de reencarnação merece outra chance!", false))


func sage(text: String) -> void:
	hud.sage(text)


func fx(kind: String, pos: Vector2, color: Color, size: float, duration: float, target := Vector2.ZERO, text := "") -> void:
	if level == null:
		return
	var f := Fx.new()
	f.kind = kind
	f.position = pos
	f.color = color
	f.size = size
	f.duration = duration
	f.target = target
	f.text = text
	level.add_child(f)


func shoot(team: String, pos: Vector2, vel: Vector2, dmg: float, color: Color, opts := {}) -> void:
	if level == null:
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
	level.add_child(p)


func damage_area(team: String, center: Vector2, radius: float, dmg: float, element: String, status: String, status_time: float) -> void:
	var group := "enemy" if team == "player" else "friend"
	for n in get_tree().get_nodes_in_group(group):
		if n.global_position.distance_to(center) < radius + n.radius:
			n.take_damage(dmg, element, center)
			if status != "" and n.has_method("apply_status"):
				n.apply_status(status, status_time)
