extends CanvasLayer
## Controles para celular/tablet: joystick virtual (esquerda) e botões (direita).
## Os botões são TouchScreenButton, que aceitam vários dedos ao mesmo tempo
## e disparam as mesmas ações do teclado.

const Data := preload("res://scripts/data.gd")

const STICK_RADIUS := 80.0
const DEAD_ZONE := 0.15

var main
var player

var _stick_index := -1
var _stick_center := Vector2.ZERO
var _stick_vec := Vector2.ZERO
var _stick_base := Vector2.ZERO
var _drawer: Node2D
var _buttons := {}   # action -> [TouchScreenButton, raio, rótulo, cor]


func _ready() -> void:
	layer = 5
	process_mode = Node.PROCESS_MODE_ALWAYS
	_drawer = Node2D.new()
	_drawer.draw.connect(_draw_controls)
	add_child(_drawer)
	_add_button("touch_attack", 56.0, "ATACAR", Color(0.35, 0.7, 1.0))
	_add_button("devour", 38.0, "DEVORAR", Color(0.4, 0.55, 1.0))
	_add_button("interact", 32.0, "FALAR", Color(1.0, 0.85, 0.4))
	_add_button("shadow_motion", 36.0, "DASH", Color(0.6, 0.4, 0.9))
	_add_button("mimicry", 30.0, "FORMA", Color(0.5, 0.85, 0.9))
	for i in Data.ACTIVE_SKILLS.size():
		_add_button(Data.ACTIVE_SKILLS[i], 28.0, str(i + 1), Color(0.9, 0.5, 0.5))
	_add_button("pause", 24.0, "II", Color(0.8, 0.8, 0.8))


func _add_button(action: String, radius: float, label: String, color: Color) -> void:
	var b := TouchScreenButton.new()
	var shape := CircleShape2D.new()
	shape.radius = radius
	b.shape = shape
	b.shape_centered = true
	b.action = action
	b.visibility_mode = TouchScreenButton.VISIBILITY_ALWAYS
	add_child(b)
	_buttons[action] = [b, radius, label, color]


func _short_name(action: String) -> String:
	match action:
		"poison_breath": return "Veneno"
		"sticky_thread": return "Fio"
		"ultrasound": return "Ultrass."
		"black_lightning": return "Relâmp."
		"black_flame": return "Chamas"
		"starved": return "Gula"
		"megiddo": return "Megiddo"
		"dragon_storm": return "Tempest."
		"azathoth": return "Vazio"
	return ""


func _process(_delta: float) -> void:
	var size := get_viewport().get_visible_rect().size
	var in_game: bool = player != null and is_instance_valid(player) and not get_tree().paused
	_stick_base = Vector2(150, size.y - 150)
	# Layout dos botões no canto inferior direito
	var base := Vector2(size.x - 110, size.y - 110)
	_place("touch_attack", base, in_game)
	_place("devour", base + Vector2(-120, 20), in_game)
	_place("shadow_motion", base + Vector2(-20, -115), in_game)
	_place("interact", base + Vector2(-125, -80), in_game)
	_place("mimicry", base + Vector2(-210, 40), in_game and player.skills.has("mimicry"))
	# Habilidades: duas fileiras acima dos botões principais (só as que o Rimuru tem)
	var owned := []
	if in_game:
		for id in Data.ACTIVE_SKILLS:
			if player.skills.has(id):
				owned.append(id)
	for id in Data.ACTIVE_SKILLS:
		var idx := owned.find(id)
		if idx < 0:
			_place(id, Vector2(-999, -999), false)
		else:
			var row := idx / 5
			var col := idx % 5
			_place(id, Vector2(size.x - 50 - col * 66, size.y - 290 - row * 66), true)
	_place("pause", Vector2(size.x / 2 + 250, 40), in_game)
	if not in_game:
		_release_stick()
	_drawer.queue_redraw()


func _place(action: String, pos: Vector2, show: bool) -> void:
	var b: TouchScreenButton = _buttons[action][0]
	b.visible = show
	b.position = pos


func _input(event: InputEvent) -> void:
	if player == null or not is_instance_valid(player) or get_tree().paused:
		return
	var size := get_viewport().get_visible_rect().size
	if event is InputEventScreenTouch:
		if event.pressed and _stick_index < 0 and event.position.x < size.x * 0.4 and event.position.y > size.y * 0.35:
			_stick_index = event.index
			_stick_center = event.position
			_update_stick(event.position)
		elif not event.pressed and event.index == _stick_index:
			_release_stick()
	elif event is InputEventScreenDrag and event.index == _stick_index:
		_update_stick(event.position)


func _update_stick(pos: Vector2) -> void:
	var v := (pos - _stick_center) / STICK_RADIUS
	if v.length() > 1.0:
		v = v.normalized()
	_stick_vec = v
	_set_axis("move_left", "move_right", v.x)
	_set_axis("move_up", "move_down", v.y)


func _set_axis(neg: String, pos: String, value: float) -> void:
	if value < -DEAD_ZONE:
		Input.action_press(neg, -value)
		Input.action_release(pos)
	elif value > DEAD_ZONE:
		Input.action_press(pos, value)
		Input.action_release(neg)
	else:
		Input.action_release(neg)
		Input.action_release(pos)


func _release_stick() -> void:
	if _stick_index < 0 and _stick_vec == Vector2.ZERO:
		return
	_stick_index = -1
	_stick_vec = Vector2.ZERO
	for a in ["move_left", "move_right", "move_up", "move_down"]:
		Input.action_release(a)


func _draw_controls() -> void:
	if player == null or not is_instance_valid(player) or get_tree().paused:
		return
	var font := ThemeDB.fallback_font
	# Joystick
	var center := _stick_center if _stick_index >= 0 else _stick_base
	_drawer.draw_circle(center, STICK_RADIUS, Color(1, 1, 1, 0.08))
	_drawer.draw_arc(center, STICK_RADIUS, 0, TAU, 48, Color(1, 1, 1, 0.35), 3.0)
	_drawer.draw_circle(center + _stick_vec * STICK_RADIUS, 34, Color(0.45, 0.78, 1.0, 0.55))
	# Botões
	for action in _buttons:
		var info: Array = _buttons[action]
		var b: TouchScreenButton = info[0]
		if not b.visible:
			continue
		var r: float = info[1]
		var col: Color = info[3]
		var pressed := b.is_pressed()
		_drawer.draw_circle(b.position, r, Color(col, 0.45 if pressed else 0.25))
		_drawer.draw_arc(b.position, r, 0, TAU, 32, Color(col, 0.9), 2.5)
		# Recarga
		var cd_id: String = action
		if action == "touch_attack":
			cd_id = "sword" if player.human else "water_blade"
		if action == "devour":
			cd_id = "predator"
		if player.cooldowns.has(cd_id) and Data.SKILLS.has(cd_id):
			var cd: float = player.cooldowns[cd_id]
			var total: float = Data.SKILLS[cd_id].cd * player.cd_mult
			if cd > 0.0 and total > 0.0:
				_drawer.draw_arc(b.position, r - 4, -PI / 2, -PI / 2 + TAU * (cd / total), 24, Color(0, 0, 0, 0.6), 6.0)
		var label: String = info[2]
		var fs := 13 if label.length() > 2 else 18
		_drawer.draw_string(font, b.position + Vector2(-r, fs * 0.35), label, HORIZONTAL_ALIGNMENT_CENTER, r * 2, fs, Color(1, 1, 1, 0.95))
		var sub := _short_name(action)
		if sub != "":
			_drawer.draw_string(font, b.position + Vector2(-r - 10, r + 13), sub, HORIZONTAL_ALIGNMENT_CENTER, r * 2 + 20, 11, Color(1, 1, 1, 0.8))
