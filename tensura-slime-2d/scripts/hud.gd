extends CanvasLayer
## Interface: vida/magículas, habilidades, objetivo, chefe, Grande Sábio,
## diálogos, menu de capítulos, pausa e telas de fim.

const Data := preload("res://scripts/data.gd")

## Cores dos nomes nos diálogos
const SPEAKER_COLORS := {
	"Grande Sábio": Color(0.6, 0.95, 1.0), "Raphael": Color(0.75, 0.85, 1.0),
	"Veldora": Color(1.0, 0.85, 0.4), "Rimuru": Color(0.55, 0.8, 1.0), "Slime": Color(0.55, 0.8, 1.0),
	"Shion": Color(0.8, 0.6, 1.0), "Shuna": Color(1.0, 0.7, 0.85), "Benimaru": Color(1.0, 0.45, 0.4),
	"Milim": Color(1.0, 0.6, 0.85), "Clayman": Color(0.85, 0.6, 1.0), "Geld": Color(0.7, 0.9, 0.4),
}

var main
var player

var _root: Control
var _name_label: Label
var _hp_bar: ProgressBar
var _mp_bar: ProgressBar
var _hp_text: Label
var _mp_text: Label
var _skills_label: RichTextLabel
var _chapter_label: Label
var _objective: Label
var _sage_box: VBoxContainer
var _prompt: Label
var _boss_panel: PanelContainer
var _boss_name: Label
var _boss_bar: ProgressBar
var _banner: Label
var _overlay: PanelContainer
var _overlay_title: Label
var _overlay_text: Label
var _overlay_hint: Label
var _buttons: VBoxContainer
var _game_panels: Array = []

var _dialogue: Array = []
var _dialogue_done: Callable
var _mode := ""  # "", "menu", "dialogue", "end", "pause"


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)

	var status := _panel(_root)
	_place(status, Vector2(0, 0), Vector2(12, 12), Control.GROW_DIRECTION_END, Control.GROW_DIRECTION_END)
	var sv := VBoxContainer.new()
	status.add_child(sv)
	_name_label = _label("Slime", 20, Color(0.6, 0.85, 1.0))
	sv.add_child(_name_label)
	_hp_bar = _bar(Color(0.9, 0.3, 0.35), 200)
	_hp_text = _label("", 12)
	sv.add_child(_row("Vida", _hp_bar, _hp_text))
	_mp_bar = _bar(Color(0.35, 0.6, 1.0), 200)
	_mp_text = _label("", 12)
	sv.add_child(_row("Magículas", _mp_bar, _mp_text))

	var obj := _panel(_root)
	_place(obj, Vector2(1, 0), Vector2(-12, 12), Control.GROW_DIRECTION_BEGIN, Control.GROW_DIRECTION_END)
	var ov := VBoxContainer.new()
	obj.add_child(ov)
	_chapter_label = _label("", 13, Color(1.0, 0.85, 0.4))
	ov.add_child(_chapter_label)
	_objective = _label("", 15)
	_objective.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_objective.custom_minimum_size = Vector2(330, 0)
	ov.add_child(_objective)

	var sk := _panel(_root)
	_place(sk, Vector2(0, 1), Vector2(12, -12), Control.GROW_DIRECTION_END, Control.GROW_DIRECTION_BEGIN)
	_skills_label = RichTextLabel.new()
	_skills_label.bbcode_enabled = true
	_skills_label.fit_content = true
	_skills_label.scroll_active = false
	_skills_label.custom_minimum_size = Vector2(290, 0)
	_skills_label.add_theme_font_size_override("normal_font_size", 13)
	_skills_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	sk.add_child(_skills_label)
	_game_panels = [status, obj, sk]

	_boss_panel = _panel(_root)
	_place(_boss_panel, Vector2(0.5, 0), Vector2(0, 12), Control.GROW_DIRECTION_BOTH, Control.GROW_DIRECTION_END)
	var bv := VBoxContainer.new()
	_boss_panel.add_child(bv)
	_boss_name = _label("", 16, Color(1.0, 0.5, 0.5))
	_boss_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	bv.add_child(_boss_name)
	_boss_bar = _bar(Color(0.85, 0.15, 0.2), 380)
	bv.add_child(_boss_bar)
	_boss_panel.visible = false

	_sage_box = VBoxContainer.new()
	_sage_box.custom_minimum_size = Vector2(620, 0)
	_sage_box.alignment = BoxContainer.ALIGNMENT_END
	_sage_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(_sage_box)
	_place(_sage_box, Vector2(0.5, 1), Vector2(0, -16), Control.GROW_DIRECTION_BOTH, Control.GROW_DIRECTION_BEGIN)

	_prompt = _label("", 17, Color(1.0, 0.95, 0.6))
	_prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_root.add_child(_prompt)
	_place(_prompt, Vector2(0.5, 0.5), Vector2(0, 70), Control.GROW_DIRECTION_BOTH, Control.GROW_DIRECTION_BOTH)

	_banner = _label("", 34, Color(1.0, 0.9, 0.55))
	_banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_banner.add_theme_constant_override("outline_size", 8)
	_root.add_child(_banner)
	_place(_banner, Vector2(0.5, 0.3), Vector2.ZERO, Control.GROW_DIRECTION_BOTH, Control.GROW_DIRECTION_BOTH)
	_banner.modulate.a = 0.0

	_overlay = PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.03, 0.05, 0.12, 0.92)
	sb.border_color = Color(0.4, 0.7, 1.0)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(10)
	sb.set_content_margin_all(22)
	_overlay.add_theme_stylebox_override("panel", sb)
	_overlay.custom_minimum_size = Vector2(760, 0)
	_root.add_child(_overlay)
	_place(_overlay, Vector2(0.5, 0.5), Vector2.ZERO, Control.GROW_DIRECTION_BOTH, Control.GROW_DIRECTION_BOTH)
	var ovb := VBoxContainer.new()
	ovb.add_theme_constant_override("separation", 12)
	_overlay.add_child(ovb)
	_overlay_title = _label("", 28, Color(0.6, 0.85, 1.0))
	_overlay_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ovb.add_child(_overlay_title)
	_overlay_text = _label("", 18)
	_overlay_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_overlay_text.custom_minimum_size = Vector2(710, 0)
	ovb.add_child(_overlay_text)
	_buttons = VBoxContainer.new()
	_buttons.add_theme_constant_override("separation", 6)
	ovb.add_child(_buttons)
	_overlay_hint = _label("", 13, Color(1.0, 0.85, 0.4))
	_overlay_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	ovb.add_child(_overlay_hint)
	_overlay.visible = false


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
	sb.bg_color = Color(0.02, 0.04, 0.1, 0.72)
	sb.border_color = Color(0.3, 0.55, 0.9, 0.6)
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(6)
	sb.set_content_margin_all(9)
	p.add_theme_stylebox_override("panel", sb)
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(p)
	return p


func _label(text: String, font_size := 16, color := Color.WHITE) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", font_size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color.BLACK)
	l.add_theme_constant_override("outline_size", 4)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


func _bar(color: Color, width: float) -> ProgressBar:
	var b := ProgressBar.new()
	b.custom_minimum_size = Vector2(width, 14)
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
	var t := _label(title, 12)
	t.custom_minimum_size = Vector2(72, 0)
	h.add_child(t)
	h.add_child(bar)
	h.add_child(value)
	return h


func _process(_delta: float) -> void:
	var playing: bool = player != null and is_instance_valid(player)
	for p in _game_panels:
		p.visible = playing
	if not playing:
		return
	_hp_bar.max_value = player.max_hp
	_hp_bar.value = player.hp
	_hp_text.text = " %d/%d" % [player.hp, player.max_hp]
	_mp_bar.max_value = player.max_mp
	_mp_bar.value = player.mp
	_mp_text.text = " %d/%d" % [player.mp, player.max_mp]
	var t := "[color=#ffd966]HABILIDADES[/color]  [color=#888888](%s)[/color]\n" % ("humano" if player.human else "slime")
	for id in Data.SKILL_ORDER:
		if not player.skills.has(id):
			continue
		var info: Dictionary = Data.SKILLS[id]
		var cd: float = player.cooldowns.get(id, 0.0)
		var state := "" if cd <= 0.0 else " [color=#888888](%.1fs)[/color]" % cd
		t += "[color=#8fd3ff]%s[/color] [color=#aaaaaa][%s][/color]%s\n" % [info.name, info.key, state]
	_skills_label.text = t.strip_edges()


func set_player_name(n: String) -> void:
	_name_label.text = n


func set_chapter(text: String) -> void:
	_chapter_label.text = text


func set_objective(text: String) -> void:
	_objective.text = text


func set_prompt(text: String) -> void:
	_prompt.text = text


func set_boss(boss) -> void:
	if boss == null or not is_instance_valid(boss) or boss.dead:
		_boss_panel.visible = false
		return
	_boss_panel.visible = true
	_boss_name.text = boss.data.name
	_boss_bar.max_value = boss.max_hp
	_boss_bar.value = boss.hp


func banner(text: String) -> void:
	_banner.text = text
	var tw := _banner.create_tween()
	tw.tween_property(_banner, "modulate:a", 1.0, 0.4)
	tw.tween_interval(2.2)
	tw.tween_property(_banner, "modulate:a", 0.0, 0.8)


func sage(text: String) -> void:
	var who := "Grande Sábio"
	if player != null and is_instance_valid(player) and player.skills.has("raphael"):
		who = "Raphael"
	var l := _label("《%s》 %s" % [who, text.trim_prefix("Raphael: ")], 15, Color(0.75, 0.95, 1.0))
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(620, 0)
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


func is_busy() -> bool:
	return _mode != ""


func _clear_buttons() -> void:
	for b in _buttons.get_children():
		b.queue_free()


func _button(text: String, cb: Callable, enabled := true) -> void:
	var b := Button.new()
	b.text = text
	b.disabled = not enabled
	b.add_theme_font_size_override("font_size", 17)
	b.pressed.connect(cb)
	_buttons.add_child(b)


## Menu inicial com seleção de capítulos.
func show_menu(titles: Array, unlocked: int) -> void:
	_mode = "menu"
	get_tree().paused = true
	_clear_buttons()
	_show_overlay("Tensura: Reencarnado como Slime 2D",
		"A história de Rimuru Tempest: da caverna do Veldora até virar Lorde Demônio.\n\n" +
		"WASD: mover   Mouse: mirar   Clique: atacar   E: Predador (devorar)   F: conversar\n" +
		"Espaço: Movimento Sombrio   Q: forma humana/slime   1–7: habilidades   Esc: pausa",
		"Capítulos novos são liberados ao vencer o anterior.")
	for i in titles.size():
		var idx: int = i
		_button(("" if i < unlocked else "[bloqueado] ") + titles[i], func(): _menu_pick(idx), i < unlocked)


func _menu_pick(i: int) -> void:
	_close()
	main.start_chapter(i)


func show_pause() -> void:
	_mode = "pause"
	get_tree().paused = true
	_clear_buttons()
	_show_overlay("Pausa", "", "")
	_button("Continuar", func(): _close())
	_button("Reiniciar capítulo", func():
		_close()
		main.start_chapter(main.chapter_index))
	_button("Menu de capítulos", func():
		_close()
		main.show_menu())


## lines: Array de [quem_fala, texto]
func show_dialogue(lines: Array, on_done: Callable) -> void:
	_dialogue = lines.duplicate()
	_dialogue_done = on_done
	_mode = "dialogue"
	get_tree().paused = true
	_clear_buttons()
	_next_line()


func _next_line() -> void:
	if _dialogue.is_empty():
		_close()
		if _dialogue_done.is_valid():
			_dialogue_done.call()
		return
	var line: Array = _dialogue.pop_front()
	_show_overlay(line[0], line[1], "[F / Enter / Clique] continuar")
	_overlay_title.add_theme_color_override("font_color", SPEAKER_COLORS.get(line[0], Color(0.95, 0.9, 0.75)))


func show_end(title: String, text: String, next_chapter: bool) -> void:
	_mode = "end"
	get_tree().paused = true
	_clear_buttons()
	_show_overlay(title, text, "")
	if next_chapter:
		_button("Próximo capítulo", func():
			_close()
			main.start_chapter(main.chapter_index + 1))
	_button("Tentar de novo" if not next_chapter else "Jogar este capítulo de novo", func():
		_close()
		main.start_chapter(main.chapter_index))
	_button("Menu de capítulos", func():
		_close()
		main.show_menu())


func _show_overlay(title: String, text: String, hint: String) -> void:
	_overlay_title.add_theme_color_override("font_color", Color(0.6, 0.85, 1.0))
	_overlay_title.text = title
	_overlay_text.text = text
	_overlay_text.visible = text != ""
	_overlay_hint.text = hint
	_overlay.visible = true


func _close() -> void:
	_overlay.visible = false
	_mode = ""
	get_tree().paused = false


func _input(event: InputEvent) -> void:
	if _mode == "dialogue":
		var advance: bool = event.is_action_pressed("interact") or event.is_action_pressed("ui_accept") \
			or (event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT)
		if advance:
			get_viewport().set_input_as_handled()
			_next_line()
	elif _mode == "pause" and event.is_action_pressed("pause"):
		get_viewport().set_input_as_handled()
		_close()
	elif _mode == "" and event.is_action_pressed("pause") and main.in_game():
		get_viewport().set_input_as_handled()
		show_pause()
