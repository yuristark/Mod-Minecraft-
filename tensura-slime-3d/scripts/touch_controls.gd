extends Control
## Controles de toque para celular/tablet:
##  - joystick virtual (lado esquerdo, aparece onde o dedo toca)
##  - arrastar no lado direito gira a câmera
##  - botões: ATAQUE, PULO, ESQUIVA, PREDADOR, 4 skills, FALAR, FORMA, POÇÃO e MENU
## Multitoque: cada dedo é controlado separadamente.
## Os botões só "apertam" ações do InputMap, então o resto do jogo não muda.

const Data := preload("res://scripts/game_data.gd")

var main
var enabled := false
var ui_scale := 1.0
var cam_sens := 1.6

var _buttons: Array = []    # [{id, action, label, pos, r, color}]
var _touches := {}          # índice do dedo -> {"kind": "joy"/"cam"/"btn", "id": ...}
var _pressed := {}          # id do botão -> true
var _joy_index := -1
var _joy_center := Vector2.ZERO
var _joy_vec := Vector2.ZERO
var _font: Font

const JOY_RADIUS := 80.0


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_font = ThemeDB.fallback_font
	resized.connect(_layout)
	_layout()


func set_enabled(on: bool) -> void:
	enabled = on
	visible = on
	if not on:
		_release_all()


func _notification(what: int) -> void:
	if what == NOTIFICATION_PAUSED or what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		_release_all()


func _release_all() -> void:
	for id in _pressed.keys():
		var b = _find(id)
		if b and b.action != "":
			Input.action_release(b.action)
	_pressed.clear()
	_touches.clear()
	_joy_index = -1
	_set_joy(Vector2.ZERO)


func _layout() -> void:
	var s := _screen()
	var k := ui_scale
	var W := s.x
	var H := s.y
	_buttons = [
		{"id": "attack", "action": "attack", "label": "ATAQUE", "pos": Vector2(W - 130 * k, H - 130 * k), "r": 66.0 * k, "color": Color(0.95, 0.4, 0.35)},
		{"id": "jump", "action": "jump", "label": "PULO", "pos": Vector2(W - 270 * k, H - 72 * k), "r": 46.0 * k, "color": Color(0.4, 0.8, 1.0)},
		{"id": "dash", "action": "dash", "label": "ESQUIVA", "pos": Vector2(W - 108 * k, H - 275 * k), "r": 42.0 * k, "color": Color(0.7, 0.6, 1.0)},
		{"id": "predator", "action": "predator", "label": "PREDADOR", "pos": Vector2(W - 252 * k, H - 196 * k), "r": 46.0 * k, "color": Color(0.35, 0.6, 1.0)},
		{"id": "skill_1", "action": "skill_1", "label": "", "pos": Vector2(W - 395 * k, H - 66 * k), "r": 38.0 * k, "color": Color(0.5, 0.9, 0.9)},
		{"id": "skill_2", "action": "skill_2", "label": "", "pos": Vector2(W - 392 * k, H - 160 * k), "r": 38.0 * k, "color": Color(0.5, 0.9, 0.9)},
		{"id": "skill_3", "action": "skill_3", "label": "", "pos": Vector2(W - 340 * k, H - 262 * k), "r": 38.0 * k, "color": Color(0.5, 0.9, 0.9)},
		{"id": "skill_4", "action": "skill_4", "label": "", "pos": Vector2(W - 236 * k, H - 318 * k), "r": 38.0 * k, "color": Color(0.5, 0.9, 0.9)},
		{"id": "interact", "action": "interact", "label": "FALAR", "pos": Vector2(W - 520 * k, H - 120 * k), "r": 40.0 * k, "color": Color(1.0, 0.85, 0.35)},
		{"id": "menu", "action": "", "label": "MENU", "pos": Vector2(W - 52 * k, 52 * k), "r": 34.0 * k, "color": Color(0.85, 0.85, 0.9)},
		{"id": "mimic", "action": "mimic", "label": "FORMA", "pos": Vector2(W - 134 * k, 52 * k), "r": 34.0 * k, "color": Color(0.6, 1.0, 0.7)},
		{"id": "potion", "action": "potion", "label": "POÇÃO", "pos": Vector2(W - 216 * k, 52 * k), "r": 34.0 * k, "color": Color(0.5, 1.0, 0.5)},
	]
	queue_redraw()


func _screen() -> Vector2:
	var s := size
	if s.x < 10 or s.y < 10:
		s = get_viewport_rect().size
	return s


func _find(id: String):
	for b in _buttons:
		if b.id == id:
			return b
	return null


func _hit_button(p: Vector2):
	for b in _buttons:
		if b.id == "interact" and not _interact_available():
			continue
		if p.distance_to(b.pos) <= b.r * 1.15:
			return b
	return null


func _interact_available() -> bool:
	return main != null and main.has_method("can_interact") and main.can_interact()


func _input(event: InputEvent) -> void:
	if not enabled:
		if event is InputEventScreenTouch and main and main.touch_setting == 0:
			main.set_touch_mode(true)
		return
	if event is InputEventScreenTouch:
		if event.pressed:
			var b = _hit_button(event.position)
			if b != null:
				_touches[event.index] = {"kind": "btn", "id": b.id}
				_press(b)
			elif event.position.x < _screen().x * 0.42 and _joy_index == -1:
				_joy_index = event.index
				_joy_center = event.position
				_touches[event.index] = {"kind": "joy"}
				_set_joy(Vector2.ZERO)
			else:
				_touches[event.index] = {"kind": "cam"}
		else:
			var t = _touches.get(event.index)
			if t != null:
				if t.kind == "btn":
					_release(t.id)
				elif t.kind == "joy":
					_joy_index = -1
					_set_joy(Vector2.ZERO)
				_touches.erase(event.index)
		get_viewport().set_input_as_handled()
	elif event is InputEventScreenDrag:
		var t2 = _touches.get(event.index)
		if t2 == null:
			return
		if t2.kind == "joy":
			var off: Vector2 = event.position - _joy_center
			var r := JOY_RADIUS * ui_scale
			if off.length() > r:
				# a base acompanha o dedo, como nos jogos de celular
				_joy_center = event.position - off.normalized() * r
				off = off.normalized() * r
			_set_joy(off / r)
		elif t2.kind == "cam":
			if main and main.player:
				main.player.add_camera_input(event.relative * cam_sens)
		elif t2.kind == "btn" and t2.id == "attack":
			# arrastar a partir do ATAQUE também gira a câmera (mirar enquanto ataca)
			if main and main.player:
				main.player.add_camera_input(event.relative * cam_sens)
		get_viewport().set_input_as_handled()


func _press(b) -> void:
	_pressed[b.id] = true
	if b.id == "menu":
		if main and main.hud:
			main.hud.open_menu()
		return
	if b.action != "":
		Input.action_press(b.action)
	queue_redraw()


func _release(id: String) -> void:
	_pressed.erase(id)
	var b = _find(id)
	if b and b.action != "":
		Input.action_release(b.action)
	queue_redraw()


func _set_joy(v: Vector2) -> void:
	_joy_vec = v
	var dz := 0.12
	_axis("move_right", v.x if v.x > dz else 0.0)
	_axis("move_left", -v.x if v.x < -dz else 0.0)
	_axis("move_back", v.y if v.y > dz else 0.0)
	_axis("move_forward", -v.y if v.y < -dz else 0.0)


func _axis(action: String, strength: float) -> void:
	if strength > 0.0:
		Input.action_press(action, clampf(strength, 0.0, 1.0))
	else:
		Input.action_release(action)


func _process(_d: float) -> void:
	if enabled:
		queue_redraw()


func _draw() -> void:
	if not enabled:
		return
	var p = main.player if main else null
	# joystick
	if _joy_index != -1:
		var r := JOY_RADIUS * ui_scale
		draw_circle(_joy_center, r, Color(1, 1, 1, 0.12))
		draw_arc(_joy_center, r, 0, TAU, 48, Color(1, 1, 1, 0.45), 3.0)
		draw_circle(_joy_center + _joy_vec * r, r * 0.42, Color(0.6, 0.85, 1.0, 0.6))
	else:
		var hint := Vector2(160 * ui_scale, _screen().y - 160 * ui_scale)
		draw_arc(hint, JOY_RADIUS * ui_scale, 0, TAU, 48, Color(1, 1, 1, 0.18), 2.0)
		draw_circle(hint, JOY_RADIUS * ui_scale * 0.4, Color(1, 1, 1, 0.1))
		_text(hint, "MOVER", 16, Color(1, 1, 1, 0.35))
	for b in _buttons:
		var label: String = b.label
		var col: Color = b.color
		var ratio := 0.0
		var dim := false
		if b.id.begins_with("skill_") and p:
			var idx := int(b.id.substr(6)) - 1
			var sid: String = p.slots[idx]
			if sid == "":
				label = "—"
				dim = true
			else:
				var info: Dictionary = Data.SKILLS[sid]
				label = info.get("short", info.name)
				var cd: float = p.cooldowns.get(sid, 0.0)
				var full: float = float(info.get("cd", 1.0)) * (0.7 if p.skills.has("ciel_passive") else 1.0)
				ratio = clampf(cd / maxf(full, 0.01), 0.0, 1.0)
				dim = p.mp < float(info.get("mp", 0.0)) and p.ciel_time <= 0.0
		elif b.id == "interact":
			if not _interact_available():
				continue
			label = main.interact_label()
		elif b.id == "potion" and p:
			label = "POÇÃO %d" % p.potions
			dim = p.potions <= 0
		elif b.id == "predator" and main and main.has_method("absorb_available"):
			if main.absorb_available():
				col = Color(0.4, 0.9, 1.0)
				draw_arc(b.pos, b.r + 6, 0, TAU, 40, Color(0.5, 0.9, 1.0, 0.5 + 0.4 * sin(Time.get_ticks_msec() * 0.008)), 4.0)
		elif b.id == "mimic" and p and not p.skills.has("mimicry"):
			dim = true
		var pressed: bool = _pressed.has(b.id)
		var fill := Color(col.r, col.g, col.b, 0.38 if pressed else 0.2)
		if dim:
			fill = Color(0.3, 0.3, 0.3, 0.2)
		draw_circle(b.pos, b.r, fill)
		draw_arc(b.pos, b.r, 0, TAU, 40, Color(col, 0.35 if dim else 0.85), 3.0)
		if ratio > 0.0:
			draw_arc(b.pos, b.r - 5, -PI / 2, -PI / 2 + TAU * ratio, 40, Color(0, 0, 0, 0.6), 8.0)
		var fs := int(clampf(b.r * 0.34, 11.0, 22.0))
		if label.length() > 7:
			fs = int(fs * 0.85)
		_text(b.pos, label, fs, Color(1, 1, 1, 0.45 if dim else 0.95))


func _text(center: Vector2, t: String, fs: int, c: Color) -> void:
	var w := 200.0
	var asc := _font.get_ascent(fs)
	draw_string_outline(_font, center + Vector2(-w / 2, asc * 0.35), t, HORIZONTAL_ALIGNMENT_CENTER, w, fs, 4, Color(0, 0, 0, c.a * 0.8))
	draw_string(_font, center + Vector2(-w / 2, asc * 0.35), t, HORIZONTAL_ALIGNMENT_CENTER, w, fs, c)
