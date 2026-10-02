extends Node3D
## Cena principal: carrega as áreas, roda a história (game_data.gd > STORY),
## dá recompensas, controla o grupo de aliados, salva/carrega e guarda as opções.

const Util := preload("res://scripts/util.gd")
const Data := preload("res://scripts/game_data.gd")
const Player := preload("res://scripts/player.gd")
const Enemy := preload("res://scripts/enemy.gd")
const Pickup := preload("res://scripts/pickup.gd")
const Veldora := preload("res://scripts/veldora.gd")
const Hud := preload("res://scripts/hud.gd")
const Npc := preload("res://scripts/npc.gd")
const Ally := preload("res://scripts/ally.gd")
const WorldBuilder := preload("res://scripts/world_builder.gd")
const Fx := preload("res://scripts/fx.gd")
const Touch := preload("res://scripts/touch_controls.gd")

const SAVE_PATH := "user://tensura_save.json"
const SETTINGS_PATH := "user://tensura_settings.cfg"

var player
var hud
var touch
var world: Node3D
var builder
var veldora

var area_id := "cave"
var step := 0
var chapter := 1
var town := 0
var unlocked_allies: Array = []
var party: Array = []
var monsters_eaten := 0
var ore_eaten := 0
var kills := 0
var elapsed := 0.0
var obj_progress := 0
var survive_timer := 0.0
var veldora_absorbed := false
var enemy_time_scale := 1.0
var game_started := false

# opções
var quality := 1
var touch_setting := 0   # 0 automático, 1 sempre, 2 nunca
var touch_mode := false
var button_scale := 1.0
var sensitivity := 1.0
var invert_y := false

var _slow_timer := 0.0
var _marker: Node3D
var _portal_cd := 0.0
var _storms: Array = []
var _suppress_reward := false
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.randomize()
	_setup_input()
	_load_settings()
	_apply_quality()

	world = Node3D.new()
	world.name = "World"
	add_child(world)

	player = Player.new()
	player.position = Vector3(0, 1, 14)
	add_child(player)
	player.sensitivity = sensitivity
	player.invert_y = invert_y

	hud = Hud.new()
	hud.player = player
	hud.main = self
	add_child(hud)

	var touch_layer := CanvasLayer.new()
	touch_layer.layer = 4
	add_child(touch_layer)
	touch = Touch.new()
	touch.main = self
	touch.ui_scale = button_scale
	touch_layer.add_child(touch)
	set_touch_setting(touch_setting)

	load_area("cave")
	hud.show_title(has_save())


# ======================================================================= ENTRADA
func _setup_input() -> void:
	var keys := {
		"move_forward": [KEY_W, KEY_UP], "move_back": [KEY_S, KEY_DOWN],
		"move_left": [KEY_A, KEY_LEFT], "move_right": [KEY_D, KEY_RIGHT],
		"jump": [KEY_SPACE], "attack": [KEY_J], "predator": [KEY_E], "interact": [KEY_F],
		"skill_1": [KEY_1, KEY_Q], "skill_2": [KEY_2], "skill_3": [KEY_3], "skill_4": [KEY_4],
		"dash": [KEY_SHIFT], "mimic": [KEY_T], "potion": [KEY_H], "menu": [KEY_TAB, KEY_M],
		"restart": [KEY_R], "pause_mouse": [KEY_ESCAPE],
	}
	var pads := {
		"jump": [JOY_BUTTON_A], "attack": [JOY_BUTTON_X], "dash": [JOY_BUTTON_B], "predator": [JOY_BUTTON_Y],
		"skill_1": [JOY_BUTTON_LEFT_SHOULDER], "skill_2": [JOY_BUTTON_RIGHT_SHOULDER], "skill_3": [JOY_BUTTON_DPAD_LEFT],
		"skill_4": [JOY_BUTTON_DPAD_RIGHT], "interact": [JOY_BUTTON_DPAD_UP], "mimic": [JOY_BUTTON_DPAD_DOWN],
		"menu": [JOY_BUTTON_START], "potion": [JOY_BUTTON_BACK],
	}
	var axes := {"move_left": [JOY_AXIS_LEFT_X, -1.0], "move_right": [JOY_AXIS_LEFT_X, 1.0],
		"move_forward": [JOY_AXIS_LEFT_Y, -1.0], "move_back": [JOY_AXIS_LEFT_Y, 1.0],
		"cam_left": [JOY_AXIS_RIGHT_X, -1.0], "cam_right": [JOY_AXIS_RIGHT_X, 1.0],
		"cam_up": [JOY_AXIS_RIGHT_Y, -1.0], "cam_down": [JOY_AXIS_RIGHT_Y, 1.0]}
	for action in keys.keys() + ["cam_left", "cam_right", "cam_up", "cam_down"]:
		if InputMap.has_action(action):
			continue
		InputMap.add_action(action, 0.2)
		for k in keys.get(action, []):
			var ev := InputEventKey.new()
			ev.physical_keycode = k
			InputMap.action_add_event(action, ev)
		for b in pads.get(action, []):
			var jb := InputEventJoypadButton.new()
			jb.button_index = b
			InputMap.action_add_event(action, jb)
		if axes.has(action):
			var jm := InputEventJoypadMotion.new()
			jm.axis = axes[action][0]
			jm.axis_value = axes[action][1]
			InputMap.action_add_event(action, jm)


# ======================================================================= OPÇÕES
func _load_settings() -> void:
	var cfg := ConfigFile.new()
	var default_q := 0 if (OS.has_feature("mobile") or OS.has_feature("web")) else 1
	if cfg.load(SETTINGS_PATH) != OK:
		quality = default_q
		return
	quality = int(cfg.get_value("video", "quality", default_q))
	touch_setting = int(cfg.get_value("input", "touch", 0))
	button_scale = float(cfg.get_value("input", "button_scale", 1.0))
	sensitivity = float(cfg.get_value("input", "sensitivity", 1.0))
	invert_y = bool(cfg.get_value("input", "invert_y", false))


func save_settings() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("video", "quality", quality)
	cfg.set_value("input", "touch", touch_setting)
	cfg.set_value("input", "button_scale", button_scale)
	cfg.set_value("input", "sensitivity", sensitivity)
	cfg.set_value("input", "invert_y", invert_y)
	cfg.save(SETTINGS_PATH)


func _apply_quality() -> void:
	var vp := get_viewport()
	vp.msaa_3d = [Viewport.MSAA_DISABLED, Viewport.MSAA_2X, Viewport.MSAA_4X][quality]
	vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_DISABLED if quality == 0 else Viewport.SCREEN_SPACE_AA_FXAA
	vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_FSR if quality == 0 else Viewport.SCALING_3D_MODE_BILINEAR
	vp.scaling_3d_scale = 0.75 if quality == 0 else 1.0


func set_quality(q: int) -> void:
	quality = q
	_apply_quality()
	save_settings()
	if game_started:
		load_area(area_id, player.global_position)
	else:
		load_area(area_id)


func _detect_touch() -> bool:
	return DisplayServer.is_touchscreen_available() or OS.has_feature("mobile") \
		or OS.has_feature("web_android") or OS.has_feature("web_ios")


func set_touch_setting(t: int) -> void:
	touch_setting = t
	match t:
		0: set_touch_mode(_detect_touch())
		1: set_touch_mode(true)
		2: set_touch_mode(false)
	save_settings()


func set_touch_mode(on: bool) -> void:
	touch_mode = on
	touch.set_enabled(on)
	player.touch_mode = on
	hud.set_touch_layout(on)
	if on:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func set_button_scale(v: float) -> void:
	button_scale = v
	touch.ui_scale = v
	touch._layout()


func set_sensitivity(v: float) -> void:
	sensitivity = v
	player.sensitivity = v


func set_invert_y(v: bool) -> void:
	invert_y = v
	player.invert_y = v
	save_settings()


# ======================================================================= JOGO NOVO / SAVE
func new_game() -> void:
	step = 0
	chapter = 1
	town = 0
	unlocked_allies = []
	party = []
	monsters_eaten = 0
	ore_eaten = 0
	kills = 0
	elapsed = 0.0
	obj_progress = 0
	veldora_absorbed = false
	player.from_save({})
	hud.set_player_name(player.title)
	game_started = true
	load_area("cave")
	if not touch_mode:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	_run_story()


func has_save() -> bool:
	return FileAccess.file_exists(SAVE_PATH)


func save_game() -> void:
	if not game_started:
		return
	var p: Vector3 = player.global_position
	var d := {
		"version": 2, "step": step, "chapter": chapter, "area": area_id, "pos": [p.x, p.y, p.z],
		"town": town, "allies": unlocked_allies, "party": party, "monsters": monsters_eaten,
		"ore": ore_eaten, "kills": kills, "veldora_absorbed": veldora_absorbed, "elapsed": elapsed,
		"obj_progress": obj_progress, "player": player.to_save(),
	}
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(d))


func continue_game() -> void:
	var f := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if f == null:
		new_game()
		return
	var d = JSON.parse_string(f.get_as_text())
	if typeof(d) != TYPE_DICTIONARY:
		new_game()
		return
	step = int(d.get("step", 0))
	chapter = int(d.get("chapter", 1))
	town = int(d.get("town", 0))
	unlocked_allies = d.get("allies", [])
	party = d.get("party", [])
	monsters_eaten = int(d.get("monsters", 0))
	ore_eaten = int(d.get("ore", 0))
	kills = int(d.get("kills", 0))
	elapsed = float(d.get("elapsed", 0.0))
	veldora_absorbed = bool(d.get("veldora_absorbed", false))
	player.from_save(d.get("player", {}))
	hud.set_player_name(player.title)
	game_started = true
	var pos = d.get("pos", null)
	var at = null
	if pos is Array and pos.size() == 3:
		at = Vector3(pos[0], pos[1], pos[2])
	load_area(d.get("area", "cave"), at, true)
	obj_progress = int(d.get("obj_progress", 0))
	if not touch_mode:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	_run_story()


# ======================================================================= ÁREAS
func load_area(id: String, at = null, skip_objective := false) -> void:
	var old := world
	world = Node3D.new()
	world.name = "World"
	add_child(world)
	if old:
		remove_child(old)
		old.queue_free()
	_storms.clear()
	_marker = null
	area_id = id
	builder = WorldBuilder.new()
	builder.build(id, world, quality, town)
	player.set_lamp(id in ["cave", "dwargon"])

	if id == "cave":
		_spawn_cave_items()
		veldora = null
		if not veldora_absorbed:
			veldora = Veldora.new()
			veldora.position = Vector3(0, 0, -20)
			world.add_child(veldora)
			if chapter >= 1 and step > 6:
				veldora.set_label("Veldora Tempest\n[FALAR]")
	elif id == "forest":
		for i in 14:
			var p := Vector3(_rng.randf_range(-120, 120), 0, _rng.randf_range(-120, 120))
			if p.length() < 40.0:
				continue
			_pickup("herb", builder.ground(p))

	for g in Data.AREAS[id].spawns:
		if chapter < int(g[4]) or chapter > int(g[5]):
			continue
		for i in int(g[1]):
			var c: Vector3 = g[2]
			var spread: float = g[3]
			spawn_enemy(g[0], c + Vector3(_rng.randf_range(-spread, spread), 0, _rng.randf_range(-spread, spread)))
	_refresh_npcs()

	var spawn_pos: Vector3 = Data.AREAS[id].spawn
	if at != null:
		spawn_pos = at
	player.global_position = builder.ground(spawn_pos, 1.0)
	player.velocity = Vector3.ZERO
	_spawn_party()
	_portal_cd = 1.5
	if game_started and not skip_objective:
		_on_area_entered()
	elif game_started:
		_setup_objective_in_area()
	if game_started:
		save_game()


func ground_height(x: float, z: float) -> float:
	return builder.height_at(x, z) if builder else 0.0


func safe_spawn() -> Vector3:
	return builder.ground(Data.AREAS[area_id].spawn, 1.0)


func _spawn_cave_items() -> void:
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
	if not player.skills.has("hydraulic"):
		_pickup("water", Vector3(-28, 0, 5))


func _pickup(kind: String, pos: Vector3) -> void:
	var p := Pickup.new()
	p.kind = kind
	p.position = pos
	world.add_child(p)


func spawn_enemy(type: String, pos: Vector3, tag := ""):
	var e := Enemy.new()
	e.type_id = type
	e.story_tag = tag
	e.position = builder.ground(pos, 0.3)
	world.add_child(e)
	return e


func _refresh_npcs() -> void:
	for n in get_tree().get_nodes_in_group("npc"):
		n.remove_from_group("npc")
		n.queue_free()
	for entry in Data.AREAS[area_id].npcs:
		var id: String = entry[0]
		if chapter < int(entry[2]) or chapter > int(entry[3]):
			continue
		if party.has(id):
			continue
		if id in ["shizu", "kabal", "eren", "gido"] and player.forms.has("human"):
			continue
		var n := Npc.new()
		n.npc_id = id
		n.position = builder.ground(entry[1])
		world.add_child(n)
	_update_npc_markers()


func _spawn_party() -> void:
	for a in get_tree().get_nodes_in_group("ally"):
		a.remove_from_group("ally")
		a.queue_free()
	for i in party.size():
		var a := Ally.new()
		a.ally_id = party[i]
		a.slot = i
		a.position = player.global_position + Vector3((i - 1) * 2.0, 0.5, 3.0)
		world.add_child(a)


func toggle_party(id: String) -> void:
	if party.has(id):
		party.erase(id)
	else:
		if party.size() >= 3:
			party.pop_front()
		party.append(id)
	_spawn_party()
	_refresh_npcs()


# ======================================================================= HISTÓRIA
func _run_story() -> void:
	while step < Data.STORY.size():
		var s: Dictionary = Data.STORY[step]
		match s.t:
			"chapter":
				chapter = int(s.n)
				hud.chapter_card("Capítulo %d — %s" % [s.n, s.title], s.sub)
				step += 1
				_refresh_npcs()
				_update_portals()
				save_game()
			"sage":
				hud.sage(s.text)
				step += 1
			"dialog":
				step += 1
				hud.show_dialogue(s.lines, _run_story)
				return
			"reward":
				step += 1
				_apply_reward(s)
			"evolve":
				step += 1
				_evolution_fx()
			"end":
				step += 1
				hud.show_end("FIM — Obrigado por jogar!", _credits(), "Continuar (jogo livre)", _run_story)
				return
			"obj":
				_begin_objective(s)
				return
	hud.set_objective("Jogo livre!")


func current_obj():
	if step < Data.STORY.size() and Data.STORY[step].t == "obj":
		return Data.STORY[step]
	return null


func _obj_tag() -> String:
	return "obj%d" % step


func _begin_objective(s: Dictionary) -> void:
	obj_progress = 0
	if s.kind == "survive":
		survive_timer = float(s.time)
	_setup_objective_in_area()
	_update_objective_text()
	if s.kind == "area" and area_id == s.area:
		call_deferred("_complete_objective")


## Gera inimigos/corpos do objetivo atual quando o jogador está na área certa.
func _setup_objective_in_area() -> void:
	var s = current_obj()
	if s == null:
		return
	if s.kind == "survive":
		survive_timer = float(s.time)
	if s.get("area", "") != area_id:
		_update_marker()
		return
	var tag := _obj_tag()
	for e in get_tree().get_nodes_in_group("enemy"):
		if e.story_tag == tag:
			_update_marker()
			return
	for sp in s.get("spawn", []):
		for i in int(sp[1]):
			var c: Vector3 = sp[2]
			var spread: float = sp[3]
			spawn_enemy(sp[0], c + Vector3(_rng.randf_range(-spread, spread), 0, _rng.randf_range(-spread, spread)), tag)
	# corpo de chefe que precisa ser devorado (se o jogador saiu da área antes)
	if s.kind == "absorb" and s.what != "veldora":
		var found := false
		for n in get_tree().get_nodes_in_group("absorbable"):
			if n.get("type_id") == s.what:
				found = true
		if not found:
			_suppress_reward = true
			var corpse = spawn_enemy(s.what, player.global_position + Vector3(0, 0, -5), tag)
			corpse.take_damage(corpse.max_hp * 10.0, false)
			_suppress_reward = false
	_update_marker()


func _on_area_entered() -> void:
	var s = current_obj()
	if s == null:
		return
	if s.kind == "area" and s.area == area_id:
		_complete_objective()
		return
	_setup_objective_in_area()


func _complete_objective() -> void:
	var s = current_obj()
	if s == null:
		return
	step += 1
	obj_progress = 0
	if _marker:
		_marker.queue_free()
		_marker = null
	_update_npc_markers()
	_run_story()


func _update_objective_text() -> void:
	var s = current_obj()
	if s == null:
		return
	var t: String = s.text
	match s.kind:
		"kill":
			t += "\n(%d/%d)" % [mini(obj_progress, s.count), s.count]
		"absorb_counts":
			t += "\n• Monstros devorados: %d/%d\n• Minérios Mágicos: %d/%d" % [mini(monsters_eaten, s.counts.monster), s.counts.monster, mini(ore_eaten, s.counts.ore), s.counts.ore]
		"survive":
			t += "\n(%d s)" % ceili(survive_timer)
	if s.get("area", area_id) != area_id and s.kind != "free":
		t += "\n[Vá para: %s]" % Data.AREAS[s.area].name
	hud.set_objective(t)


func _apply_reward(s: Dictionary) -> void:
	if s.has("title"):
		player.title = s.title
		hud.set_player_name(s.title)
	if s.has("hp"):
		player.max_hp += float(s.hp)
	if s.has("mp"):
		player.max_mp += float(s.mp)
	player.hp = player.max_hp
	player.mp = player.max_mp
	for sk in s.get("skills", []):
		player.grant_skill(sk)
	var new_form := ""
	for f in s.get("forms", []):
		if not player.forms.has(f):
			player.forms[f] = true
			new_form = f
	if new_form != "" and player.skills.has("mimicry"):
		player.set_form(new_form)
	var party_changed := false
	for a in s.get("allies", []):
		if not unlocked_allies.has(a):
			unlocked_allies.append(a)
			if party.size() < 3:
				party.append(a)
				party_changed = true
	for i in int(s.get("level", 0)):
		player.gain_exp(player.exp_to_next() - player.exp_points)
	if s.has("msg"):
		hud.sage(s.msg)
	if party_changed:
		_spawn_party()
	if s.has("town") and int(s.town) != town:
		town = int(s.town)
		if area_id == "forest":
			call_deferred("load_area", "forest", player.global_position, true)
	_refresh_npcs()


func _evolution_fx() -> void:
	var p: Vector3 = player.global_position
	Fx.pillar(world, p, Color(0.6, 0.5, 1.0), 4.0, 80.0, 2.5)
	Fx.burst(world, p + Vector3(0, 1, 0), Color(0.7, 0.6, 1.0), 120, 18.0, 0.6, 0.0)
	Fx.ring(world, p + Vector3(0, 1, 0), Color(0.4, 0.3, 0.9), 30.0, 1.5, 0.5)
	shake(1.0)
	hud.sage("Festival da Colheita... concluído.")


func _credits() -> String:
	return "Rimuru Tempest venceu o Império, derrotou Yuuki e despertou Ciel.\n" + \
		"Tempest virou o país onde monstros e humanos vivem juntos.\n\n" + \
		"Nível: %d   Monstros devorados: %d   Inimigos derrotados: %d   Tempo: %s\n\n" % [player.level, monsters_eaten, kills, _fmt_time(elapsed)] + \
		"Você pode continuar jogando: treine com o Veldora em Tempest, devore monstros e complete a Enciclopédia.\n\n" + \
		"Projeto de fã sem fins lucrativos. Tensei Shitara Slime Datta Ken pertence a Fuse, Mitz Vah, Taiki Kawakami e Kodansha."


func chapter_name() -> String:
	for i in range(mini(step, Data.STORY.size() - 1), -1, -1):
		var s: Dictionary = Data.STORY[i]
		if s.t == "chapter":
			return "%d — %s" % [s.n, s.title]
	return "1"


# ======================================================================= LOOP
func _process(delta: float) -> void:
	if hud == null or player == null or not game_started:
		return
	elapsed += delta
	_portal_cd = maxf(_portal_cd - delta, 0.0)
	if _slow_timer > 0.0:
		_slow_timer -= delta
		if _slow_timer <= 0.0:
			enemy_time_scale = 1.0
	if builder and builder.ambient:
		builder.ambient.global_position = player.global_position + Vector3(0, 2, 0)
	_update_storms(delta)
	_check_reach_and_survive(delta)
	_check_portals()
	_update_boss_bar()
	_update_marker_pos()

	var cam := Vector2(Input.get_axis("cam_left", "cam_right"), Input.get_axis("cam_up", "cam_down"))
	if cam.length() > 0.1:
		player.add_camera_input(cam * 900.0 * delta)

	var prompt := ""
	var npc = _nearest_npc()
	if npc != null:
		prompt = "[F] Falar com " + npc.display_name()
	elif _veldora_near() and current_obj() != null and current_obj().kind != "absorb":
		prompt = "[F] Conversar com Veldora"
	else:
		var near = player.nearest_absorbable()
		if near != null:
			prompt = "[E] Devorar: " + near.get_absorb_name()
	hud.set_prompt(prompt)
	hud.set_stats("Devorados: %d   Minérios: %d   Tempo: %s" % [monsters_eaten, ore_eaten, _fmt_time(elapsed)])


func _check_reach_and_survive(delta: float) -> void:
	var s = current_obj()
	if s == null or s.get("area", "") != area_id:
		return
	if s.kind == "reach":
		if player.global_position.distance_to(builder.ground(s.pos)) < float(s.r):
			_complete_objective()
	elif s.kind == "survive":
		var boss_alive := false
		for e in get_tree().get_nodes_in_group("enemy"):
			if e.type_id == s.enemy:
				boss_alive = true
		if boss_alive:
			survive_timer -= delta
			_update_objective_text()
			if survive_timer <= 0.0:
				for e in get_tree().get_nodes_in_group("enemy"):
					if e.type_id == s.enemy:
						Fx.burst(world, e.global_position + Vector3(0, 1, 0), Color(1, 0.5, 0.8), 40, 8.0)
						e.queue_free()
				_complete_objective()


func _check_portals() -> void:
	if builder == null or _portal_cd > 0.0 or hud.is_busy():
		return
	for p in builder.portals:
		var open: bool = chapter >= int(p.min_ch)
		p.node.visible = open
		if open and player.global_position.distance_to(p.pos) < 3.0:
			travel(p.to)
			return


func _update_portals() -> void:
	if builder == null:
		return
	for p in builder.portals:
		p.node.visible = chapter >= int(p.min_ch)


func travel(to: String) -> void:
	var from := area_id
	# posição de chegada: perto do portal que volta para a área de origem
	var arrive = null
	for entry in Data.AREAS[to].portals:
		if entry[0] == from:
			var pp: Vector3 = entry[1]
			var inward := (-pp).normalized() if pp.length() > 0.1 else Vector3.BACK
			arrive = pp + inward * 7.0
	hud.sage("Entrando em: %s" % Data.AREAS[to].name)
	load_area(to, arrive)


func _update_boss_bar() -> void:
	var boss = null
	for e in get_tree().get_nodes_in_group("enemy"):
		if e.boss and e.global_position.distance_to(player.global_position) < 70.0:
			boss = e
			break
	hud.set_boss(boss)


# ======================================================================= MARCADOR DE OBJETIVO
func _marker_target():
	var s = current_obj()
	if s == null or s.get("area", "") != area_id:
		return null
	match s.kind:
		"talk":
			for n in get_tree().get_nodes_in_group("npc"):
				if n.npc_id == s.npc:
					return n.global_position
		"boss", "kill", "survive":
			for e in get_tree().get_nodes_in_group("enemy"):
				if e.story_tag == _obj_tag() or e.type_id == s.get("enemy", ""):
					return e.global_position
			if s.has("pos"):
				return builder.ground(s.pos)
		"absorb":
			if s.what == "veldora" and veldora:
				return veldora.global_position
			for n in get_tree().get_nodes_in_group("absorbable"):
				if n.get("type_id") == s.what:
					return n.global_position
		_:
			if s.has("pos"):
				return builder.ground(s.pos)
	return null


func _update_marker() -> void:
	if _marker == null:
		_marker = Node3D.new()
		var beam := Util.cylinder(0.35, 60.0, Util.mat(Color(1.0, 0.85, 0.3, 0.25), 3.0, true), Vector3(0, 30, 0))
		beam.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		_marker.add_child(beam)
		var gem := Util.sphere(0.6, Util.cmat(Color(1.0, 0.85, 0.3), 4.0), Vector3(0, 4, 0))
		gem.name = "Gem"
		_marker.add_child(gem)
		world.add_child(_marker)
	_update_marker_pos()
	_update_npc_markers()


func _update_marker_pos() -> void:
	if _marker == null or not is_instance_valid(_marker):
		return
	var t = _marker_target()
	_marker.visible = t != null and (t as Vector3).distance_to(player.global_position) > 6.0
	if t != null:
		_marker.global_position = t
		var gem := _marker.get_node("Gem") as Node3D
		gem.position.y = 4.0 + sin(elapsed * 3.0) * 0.4


func _update_npc_markers() -> void:
	var s = current_obj()
	for n in get_tree().get_nodes_in_group("npc"):
		n.set_marker(s != null and s.kind == "talk" and s.npc == n.npc_id)


# ======================================================================= INTERAÇÃO
func _nearest_npc():
	var best = null
	var best_d := INF
	for n in get_tree().get_nodes_in_group("npc"):
		var d: float = n.global_position.distance_to(player.global_position)
		if d < n.talk_range and d < best_d:
			best = n
			best_d = d
	return best


func _veldora_near() -> bool:
	return veldora != null and is_instance_valid(veldora) and player.global_position.distance_to(veldora.global_position) < veldora.talk_range


func can_interact() -> bool:
	return _nearest_npc() != null or (_veldora_near() and step > 6)


func interact_label() -> String:
	return "FALAR"


func absorb_available() -> bool:
	return player.nearest_absorbable() != null


func player_interact(_p) -> void:
	if hud.is_busy():
		return
	var npc = _nearest_npc()
	var s = current_obj()
	if npc != null:
		if s != null and s.kind == "talk" and s.npc == npc.npc_id:
			_complete_objective()
			return
		if npc.npc_id == "veldora" and chapter >= 9:
			hud.show_dialogue([["Veldora", npc.next_line()]], func():
				hud.show_choice("Treinar com o Veldora? (chefe opcional muito forte, dá muita EXP)", ["Lutar!", "Agora não"], func(i):
					if i == 0:
						_start_spar()))
			return
		hud.show_dialogue([[npc.display_name(), npc.next_line()]], Callable())
		return
	if _veldora_near():
		if s != null and s.kind == "absorb" and s.what == "veldora":
			hud.show_dialogue([["Veldora", "Então chegou a hora! Pode me devorar, amigo. Confio em você!"]], Callable())
		else:
			hud.show_dialogue([["Veldora", "Ainda não está pronto? Ande logo, Rimuru! Devore monstros e Minérios Mágicos. Eu espero... não tenho outra escolha mesmo. KUAHAHA!"]], Callable())


func _start_spar() -> void:
	for e in get_tree().get_nodes_in_group("enemy"):
		if e.type_id == "veldora_spar":
			return
	for n in get_tree().get_nodes_in_group("npc"):
		if n.npc_id == "veldora":
			n.visible = false
	spawn_enemy("veldora_spar", player.global_position + Vector3(0, 0, -18), "spar")
	hud.sage("KUAHAHAHA! Mostre o que aprendeu, Rimuru!")


func can_absorb(target) -> bool:
	if target == veldora:
		var s = current_obj()
		if s == null or s.kind != "absorb" or s.what != "veldora":
			if step <= 6:
				hud.sage("Notificação: converse com o Veldora primeiro.")
			else:
				hud.sage("Análise falhou: capacidade do Predador insuficiente. Devore 5 monstros e 6 minérios.")
			return false
	return true


func on_absorbed(target) -> void:
	var s = current_obj()
	if target == veldora:
		veldora_absorbed = true
		veldora = null
		if s != null and s.kind == "absorb" and s.what == "veldora":
			_complete_objective()
		return
	if target.get("type_id") != null:
		monsters_eaten += 1
		var d: Dictionary = target.data
		player.max_hp += 2.0
		player.hp = minf(player.hp + 20.0, player.max_hp)
		player.gain_exp(int(d.exp) / 2 + 2)
		var learned := []
		if d.has("absorb_skill") and not player.skills.has(d.absorb_skill):
			player.grant_skill(d.absorb_skill)
			learned.append(Data.SKILLS[d.absorb_skill].name)
		if d.has("absorb_form") and not player.forms.has(d.absorb_form):
			player.forms[d.absorb_form] = true
			learned.append("forma " + Data.FORMS[d.absorb_form].name)
		if learned.is_empty():
			hud.sage("Informe: [%s] devorado e armazenado no Estômago." % d.name)
		else:
			hud.sage("Informe: análise de [%s] concluída. Adquirido: %s!" % [d.name, ", ".join(learned)])
		Fx.text(world, player.global_position + Vector3(0, 2.4, 0), "Devorado!", Color(0.5, 0.85, 1.0))
		if s != null and s.kind == "absorb" and s.what == target.type_id:
			_complete_objective()
			return
	else:
		match target.kind:
			"ore":
				ore_eaten += 1
				player.max_mp += 5.0
				player.mp = player.max_mp
				hud.sage("Informe: Minério Mágico armazenado. Magículas máximas aumentaram.")
			"herb":
				player.potions += 1
				player.hp = minf(player.hp + 40.0, player.max_hp)
				hud.sage("Informe: Erva Hipokute analisada. Poção Completa produzida (+1) e vida recuperada.")
			"water":
				player.grant_skill("hydraulic")
				hud.sage("Informe: água absorvida. Habilidade adquirida: Propulsão Hidráulica! Pule de novo no ar.")
	if s != null and s.kind == "absorb_counts":
		_update_objective_text()
		if monsters_eaten >= int(s.counts.monster) and ore_eaten >= int(s.counts.ore):
			if veldora:
				veldora.set_label("Veldora Tempest\n[PREDADOR]")
			_complete_objective()


func on_enemy_killed(e) -> void:
	kills += 1
	if _suppress_reward:
		return
	player.gain_exp(int(e.data.exp))
	if e.type_id == "veldora_spar":
		hud.sage("Veldora: KUAHAHA! Você ficou forte, Rimuru! Vamos ler mangá agora.")
		for n in get_tree().get_nodes_in_group("npc"):
			n.visible = true
	var s = current_obj()
	if s == null or s.get("area", "") != area_id:
		return
	if s.kind == "kill" and (e.type_id == s.enemy or e.story_tag == _obj_tag()):
		obj_progress += 1
		_update_objective_text()
		if obj_progress >= int(s.count):
			for o in get_tree().get_nodes_in_group("enemy"):
				if o.story_tag == _obj_tag():
					o.take_damage(o.hp + 1.0, false)
			_complete_objective()
	elif s.kind == "boss" and e.type_id == s.enemy:
		# limpa os capangas do chefe
		for o in get_tree().get_nodes_in_group("enemy"):
			if o.story_tag.begins_with(_obj_tag()) and not o.boss:
				o.take_damage(o.hp + 1.0, false)
		_complete_objective()


func on_player_died() -> void:
	hud.show_end("Você foi derrotado...",
		"O corpo do slime se desfez... mas um slime sempre se regenera!\n\nNível: %d   Devorados: %d   Tempo: %s" % [player.level, monsters_eaten, _fmt_time(elapsed)],
		"Renascer", func():
			player.revive(safe_spawn())
			for e in get_tree().get_nodes_in_group("enemy"):
				e.hp = e.max_hp
				e._update_label())


# ======================================================================= EFEITOS GLOBAIS
func sage(text: String) -> void:
	hud.sage(text)


func shake(amount: float) -> void:
	player.shake_amount = maxf(player.shake_amount, amount)


func slow_enemies(t: float) -> void:
	enemy_time_scale = 0.35
	_slow_timer = t
	hud.sage("Aceleração de Pensamento: percepção x1000. O mundo ficou lento.")


## Tempestade do Veldora: tornado negro que avança causando dano contínuo.
func spawn_storm(pos: Vector3, dir: Vector3, dmg: float) -> void:
	var n := Node3D.new()
	world.add_child(n)
	n.global_position = pos
	var m := Util.mat(Color(0.2, 0.15, 0.45, 0.45), 2.5, true)
	for i in 6:
		var c := Util.cone(1.0 + i * 0.7, 2.2, m, Vector3(0, 1.0 + i * 1.8, 0))
		c.rotation.x = PI
		c.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		n.add_child(c)
	var l := OmniLight3D.new()
	l.light_color = Color(0.5, 0.4, 1.0)
	l.light_energy = 4.0
	l.omni_range = 16.0
	l.position.y = 4.0
	n.add_child(l)
	_storms.append({"node": n, "dir": dir, "time": 5.0, "tick": 0.0, "dmg": dmg})
	shake(0.6)


func _update_storms(delta: float) -> void:
	for s in _storms.duplicate():
		var n: Node3D = s.node
		if not is_instance_valid(n):
			_storms.erase(s)
			continue
		s.time -= delta
		n.global_position += s.dir * 12.0 * delta
		n.global_position.y = ground_height(n.global_position.x, n.global_position.z)
		n.rotation.y += delta * 8.0
		s.tick -= delta
		if s.tick <= 0.0:
			s.tick = 0.25
			Fx.lightning(world, n.global_position + Vector3(randf_range(-3, 3), 0, randf_range(-3, 3)), Color(0.4, 0.3, 1.0))
			for e in get_tree().get_nodes_in_group("enemy"):
				if e.global_position.distance_to(n.global_position) < 6.0:
					e.take_damage(s.dmg)
		if s.time <= 0.0:
			n.queue_free()
			_storms.erase(s)


func _fmt_time(t: float) -> String:
	return "%02d:%02d" % [int(t) / 60, int(t) % 60]
