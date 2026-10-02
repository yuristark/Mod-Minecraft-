extends CanvasLayer
## Interface: barras de vida/magículas, habilidades, objetivo,
## mensagens do Grande Sábio, diálogos e telas de título/fim.

const SKILL_NAMES := [
	["predator", "Predador", "E"],
	["great_sage", "Grande Sábio", "passiva"],
	["water_blade", "Lâmina d'Água", "Clique / Q"],
	["poison_breath", "Sopro Venenoso", "1"],
	["sticky_thread", "Fio Pegajoso", "2"],
	["ultrasound", "Ondas Ultrassônicas", "3"],
	["shadow_motion", "Movimento Sombrio", "Shift"],
	["hydraulic", "Propulsão Hidráulica", "pulo duplo"],
]

var player

var _name_label: Label
var _hp_bar: ProgressBar
var _mp_bar: ProgressBar
var _hp_text: Label
var _mp_text: Label
var _skills_label: RichTextLabel
var _objective: Label
var _stats: Label
var _sage_box: VBoxContainer
var _prompt: Label
var _overlay: PanelContainer
var _overlay_title: Label
var _overlay_text: Label
var _overlay_hint: Label

var _dialogue: Array = []
var _dialogue_done: Callable
var _mode := ""  # "", "title", "dialogue", "end"


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	# --- Status (canto superior esquerdo)
	var status := _panel(root)
	status.position = Vector2(16, 16)
	var sv := VBoxContainer.new()
	status.add_child(sv)
	_name_label = _label("Slime", 22, Color(0.6, 0.85, 1.0))
	sv.add_child(_name_label)
	_hp_bar = _bar(Color(0.9, 0.3, 0.35))
	_hp_text = _label("", 13)
	sv.add_child(_row("Vida", _hp_bar, _hp_text))
	_mp_bar = _bar(Color(0.35, 0.6, 1.0))
	_mp_text = _label("", 13)
	sv.add_child(_row("Magículas", _mp_bar, _mp_text))

	# --- Objetivo (canto superior direito)
	var obj := _panel(root)
	_place(obj, Vector2(1, 0), Vector2(-16, 16), Control.GROW_DIRECTION_BEGIN, Control.GROW_DIRECTION_END)
	obj.custom_minimum_size = Vector2(360, 0)
	var ov := VBoxContainer.new()
	obj.add_child(ov)
	ov.add_child(_label("OBJETIVO", 14, Color(1.0, 0.85, 0.4)))
	_objective = _label("", 16)
	_objective.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_objective.custom_minimum_size = Vector2(340, 0)
	ov.add_child(_objective)
	_stats = _label("", 13, Color(0.75, 0.8, 0.9))
	ov.add_child(_stats)

	# --- Habilidades (canto inferior esquerdo)
	var sk := _panel(root)
	_place(sk, Vector2(0, 1), Vector2(16, -16), Control.GROW_DIRECTION_END, Control.GROW_DIRECTION_BEGIN)
	_skills_label = RichTextLabel.new()
	_skills_label.bbcode_enabled = true
	_skills_label.fit_content = true
	_skills_label.scroll_active = false
	_skills_label.custom_minimum_size = Vector2(300, 0)
	_skills_label.add_theme_font_size_override("normal_font_size", 14)
	_skills_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	sk.add_child(_skills_label)

	# --- Mira
	var cross := _label("+", 26, Color(1, 1, 1, 0.7))
	_place(cross, Vector2(0.5, 0.5), Vector2(0, -6), Control.GROW_DIRECTION_BOTH, Control.GROW_DIRECTION_BOTH)
	root.add_child(cross)

	# --- Grande Sábio (parte inferior central)
	_sage_box = VBoxContainer.new()
	_place(_sage_box, Vector2(0.5, 1), Vector2(0, -24), Control.GROW_DIRECTION_BOTH, Control.GROW_DIRECTION_BEGIN)
	_sage_box.custom_minimum_size = Vector2(660, 0)
	_sage_box.alignment = BoxContainer.ALIGNMENT_END
	_sage_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(_sage_box)

	_prompt = _label("", 18, Color(1.0, 0.95, 0.6))
	_prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_place(_prompt, Vector2(0.5, 0.5), Vector2(0, 60), Control.GROW_DIRECTION_BOTH, Control.GROW_DIRECTION_BOTH)
	_prompt.custom_minimum_size = Vector2(600, 0)
	root.add_child(_prompt)

	# --- Sobreposição (título, diálogo, fim de jogo)
	_overlay = PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.03, 0.05, 0.12, 0.88)
	sb.border_color = Color(0.4, 0.7, 1.0)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(10)
	sb.set_content_margin_all(24)
	_overlay.add_theme_stylebox_override("panel", sb)
	_overlay.custom_minimum_size = Vector2(760, 0)
	_place(_overlay, Vector2(0.5, 0.5), Vector2.ZERO, Control.GROW_DIRECTION_BOTH, Control.GROW_DIRECTION_BOTH)
	root.add_child(_overlay)
	var ovb := VBoxContainer.new()
	ovb.add_theme_constant_override("separation", 14)
	_overlay.add_child(ovb)
	_overlay_title = _label("", 30, Color(0.6, 0.85, 1.0))
	_overlay_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ovb.add_child(_overlay_title)
	_overlay_text = _label("", 18)
	_overlay_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_overlay_text.custom_minimum_size = Vector2(700, 0)
	ovb.add_child(_overlay_text)
	_overlay_hint = _label("", 14, Color(1.0, 0.85, 0.4))
	_overlay_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	ovb.add_child(_overlay_hint)
	_overlay.visible = false


## Ancora um controle num ponto da tela (0..1) e define para que lado ele cresce.
func _place(c: Control, anchor: Vector2, offset: Vector2, grow_h: int, grow_v: int) -> void:
	c.anchor_left = anchor.x
	c.anchor_right = anchor.x
	c.anchor_top = anchor.y
	c.anchor_bottom = anchor.y
	c.offset_left = offset.x
	c.offset_right = offset.x
	c.offset_top = offset.y
	c.offset_bottom = offset.y
	c.grow_horizontal = grow_h
	c.grow_vertical = grow_v


func _panel(parent: Control) -> PanelContainer:
	var p := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.02, 0.04, 0.1, 0.7)
	sb.border_color = Color(0.3, 0.55, 0.9, 0.6)
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(6)
	sb.set_content_margin_all(10)
	p.add_theme_stylebox_override("panel", sb)
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(p)
	return p


func _label(text: String, size := 16, color := Color.WHITE) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color.BLACK)
	l.add_theme_constant_override("outline_size", 4)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


func _bar(color: Color) -> ProgressBar:
	var b := ProgressBar.new()
	b.custom_minimum_size = Vector2(220, 16)
	b.show_percentage = false
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0.1, 0.1, 0.15)
	bg.set_corner_radius_all(4)
	var fg := StyleBoxFlat.new()
	fg.bg_color = color
	fg.set_corner_radius_all(4)
	b.add_theme_stylebox_override("background", bg)
	b.add_theme_stylebox_override("fill", fg)
	return b


func _row(title: String, bar: ProgressBar, value: Label) -> HBoxContainer:
	var h := HBoxContainer.new()
	var t := _label(title, 13)
	t.custom_minimum_size = Vector2(80, 0)
	h.add_child(t)
	h.add_child(bar)
	h.add_child(value)
	return h


func _process(_delta: float) -> void:
	if player == null:
		return
	_hp_bar.max_value = player.max_hp
	_hp_bar.value = player.hp
	_hp_text.text = " %d/%d" % [player.hp, player.max_hp]
	_mp_bar.max_value = player.max_mp
	_mp_bar.value = player.mp
	_mp_text.text = " %d/%d" % [player.mp, player.max_mp]

	var t := "[color=#ffd966]HABILIDADES[/color]\n"
	for s in SKILL_NAMES:
		if player.skills.has(s[0]):
			var cd: float = player.cooldowns.get(s[0], 0.0)
			var state := "" if cd <= 0.0 else " [color=#888888](%.1fs)[/color]" % cd
			t += "[color=#8fd3ff]%s[/color] [color=#aaaaaa][%s][/color]%s\n" % [s[1], s[2], state]
		else:
			t += "[color=#555566]??? (bloqueada)[/color]\n"
	_skills_label.text = t


func set_player_name(n: String) -> void:
	_name_label.text = n


func set_objective(text: String) -> void:
	_objective.text = text


func set_stats(text: String) -> void:
	_stats.text = text


func set_prompt(text: String) -> void:
	_prompt.text = text


## Mensagem do Grande Sábio, que some depois de alguns segundos.
func sage(text: String) -> void:
	var l := _label("《Grande Sábio》 " + text, 16, Color(0.75, 0.95, 1.0))
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(660, 0)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_sage_box.add_child(l)
	while _sage_box.get_child_count() > 4:
		var old := _sage_box.get_child(0)
		_sage_box.remove_child(old)
		old.queue_free()
	var tw := l.create_tween()
	tw.tween_interval(5.0)
	tw.tween_property(l, "modulate:a", 0.0, 1.0)
	tw.tween_callback(l.queue_free)


func show_title(title: String, text: String) -> void:
	_mode = "title"
	_show_overlay(title, text, "Clique ou aperte Enter para começar")
	get_tree().paused = true


## lines: Array de [quem_fala, texto]
func show_dialogue(lines: Array, on_done: Callable) -> void:
	_dialogue = lines.duplicate()
	_dialogue_done = on_done
	_mode = "dialogue"
	get_tree().paused = true
	_next_line()


func _next_line() -> void:
	if _dialogue.is_empty():
		_overlay.visible = false
		_mode = ""
		get_tree().paused = false
		if _dialogue_done.is_valid():
			_dialogue_done.call()
		return
	var line: Array = _dialogue.pop_front()
	_show_overlay(line[0], line[1], "[F / Enter / Clique] continuar")


func show_end(title: String, text: String) -> void:
	_mode = "end"
	_show_overlay(title, text, "[R] jogar de novo")
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	get_tree().paused = true


func _show_overlay(title: String, text: String, hint: String) -> void:
	_overlay_title.text = title
	_overlay_text.text = text
	_overlay_hint.text = hint
	_overlay.visible = true


func is_busy() -> bool:
	return _mode != ""


func _input(event: InputEvent) -> void:
	if _mode == "":
		return
	var advance: bool = event.is_action_pressed("interact") or event.is_action_pressed("ui_accept") \
		or (event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT)
	match _mode:
		"title":
			if advance:
				_overlay.visible = false
				_mode = ""
				get_tree().paused = false
				Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
				get_viewport().set_input_as_handled()
		"dialogue":
			if advance:
				get_viewport().set_input_as_handled()
				_next_line()
		"end":
			if event.is_action_pressed("restart"):
				get_tree().paused = false
				get_tree().reload_current_scene()
