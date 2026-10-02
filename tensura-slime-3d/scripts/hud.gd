extends CanvasLayer
## Interface: status (vida/magículas/EXP), objetivo, barra de chefe, mensagens do
## Grande Sábio, diálogos, escolhas, cartões de capítulo, menu completo
## (status, habilidades, formas, grupo, enciclopédia, opções, salvar) e telas de título/fim.
## Tudo com botões grandes para funcionar bem no celular.

const Data := preload("res://scripts/game_data.gd")

var player
var main

var _root: Control
var _name_label: Label
var _level_label: Label
var _hp_bar: ProgressBar
var _mp_bar: ProgressBar
var _exp_bar: ProgressBar
var _hp_text: Label
var _mp_text: Label
var _info_label: Label
var _skills_label: RichTextLabel
var _skills_panel: PanelContainer
var _obj_panel: PanelContainer
var _objective: Label
var _stats: Label
var _sage_box: VBoxContainer
var _prompt: Label
var _cross: Label
var _boss_panel: VBoxContainer
var _boss_name: Label
var _boss_bar: ProgressBar
var _card: Label
var _card_sub: Label

var _dialog_panel: PanelContainer
var _dialog_name: Label
var _dialog_text: Label
var _dialog_hint: Label

var _overlay: PanelContainer
var _overlay_title: Label
var _overlay_text: Label
var _overlay_buttons: HBoxContainer

var _menu: PanelContainer
var _menu_tabs: HBoxContainer
var _menu_body: VBoxContainer
var _menu_tab := "status"
var _pending_skill := ""

var _dialogue: Array = []
var _dialogue_done: Callable
var _mode := ""  # "", "title", "dialogue", "end", "menu", "choice"
var _touch_layout := false
var _typing := 0.0
var _full_text := ""

var _theme: Theme


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	layer = 5
	_theme = _make_theme()
	_root = Control.new()
	_root.theme = _theme
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)

	# --- Status (canto superior esquerdo)
	var status := _panel(_root)
	status.position = Vector2(14, 14)
	var sv := VBoxContainer.new()
	sv.add_theme_constant_override("separation", 3)
	status.add_child(sv)
	var top := HBoxContainer.new()
	sv.add_child(top)
	_name_label = _label("Slime", 22, Color(0.6, 0.85, 1.0))
	top.add_child(_name_label)
	_level_label = _label("  Nv. 1", 18, Color(1.0, 0.9, 0.5))
	top.add_child(_level_label)
	_hp_bar = _bar(Color(0.9, 0.3, 0.35))
	_hp_text = _label("", 14)
	sv.add_child(_row("Vida", _hp_bar, _hp_text))
	_mp_bar = _bar(Color(0.35, 0.6, 1.0))
	_mp_text = _label("", 14)
	sv.add_child(_row("Magículas", _mp_bar, _mp_text))
	_exp_bar = _bar(Color(1.0, 0.85, 0.35), 8)
	sv.add_child(_row("EXP", _exp_bar, _label("", 12)))
	_info_label = _label("", 14, Color(0.8, 0.9, 1.0))
	sv.add_child(_info_label)

	# --- Objetivo (canto superior direito)
	_obj_panel = _panel(_root)
	_place(_obj_panel, Vector2(1, 0), Vector2(-14, 14), Control.GROW_DIRECTION_BEGIN, Control.GROW_DIRECTION_END)
	_obj_panel.custom_minimum_size = Vector2(340, 0)
	var ov := VBoxContainer.new()
	_obj_panel.add_child(ov)
	ov.add_child(_label("OBJETIVO", 14, Color(1.0, 0.85, 0.4)))
	_objective = _label("", 17)
	_objective.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_objective.custom_minimum_size = Vector2(320, 0)
	ov.add_child(_objective)
	_stats = _label("", 13, Color(0.75, 0.8, 0.9))
	_stats.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_stats.custom_minimum_size = Vector2(320, 0)
	ov.add_child(_stats)

	# --- Barra de chefe
	_boss_panel = VBoxContainer.new()
	_place(_boss_panel, Vector2(0.5, 0), Vector2(0, 16), Control.GROW_DIRECTION_BOTH, Control.GROW_DIRECTION_END)
	_boss_panel.custom_minimum_size = Vector2(520, 0)
	_boss_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(_boss_panel)
	_boss_name = _label("", 20, Color(1.0, 0.7, 0.5))
	_boss_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_boss_panel.add_child(_boss_name)
	_boss_bar = _bar(Color(0.85, 0.15, 0.25), 18)
	_boss_bar.custom_minimum_size = Vector2(520, 18)
	_boss_panel.add_child(_boss_bar)
	_boss_panel.visible = false

	# --- Habilidades (canto inferior esquerdo, só no PC)
	_skills_panel = _panel(_root)
	_place(_skills_panel, Vector2(0, 1), Vector2(14, -14), Control.GROW_DIRECTION_END, Control.GROW_DIRECTION_BEGIN)
	_skills_label = RichTextLabel.new()
	_skills_label.bbcode_enabled = true
	_skills_label.fit_content = true
	_skills_label.scroll_active = false
	_skills_label.custom_minimum_size = Vector2(330, 0)
	_skills_label.add_theme_font_size_override("normal_font_size", 15)
	_skills_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_skills_panel.add_child(_skills_label)

	_cross = _label("+", 26, Color(1, 1, 1, 0.6))
	_place(_cross, Vector2(0.5, 0.5), Vector2(0, -6), Control.GROW_DIRECTION_BOTH, Control.GROW_DIRECTION_BOTH)
	_root.add_child(_cross)

	# --- Grande Sábio
	_sage_box = VBoxContainer.new()
	_place(_sage_box, Vector2(0.5, 1), Vector2(0, -20), Control.GROW_DIRECTION_BOTH, Control.GROW_DIRECTION_BEGIN)
	_sage_box.custom_minimum_size = Vector2(640, 0)
	_sage_box.alignment = BoxContainer.ALIGNMENT_END
	_sage_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(_sage_box)

	_prompt = _label("", 20, Color(1.0, 0.95, 0.6))
	_prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_place(_prompt, Vector2(0.5, 0.5), Vector2(0, 70), Control.GROW_DIRECTION_BOTH, Control.GROW_DIRECTION_BOTH)
	_prompt.custom_minimum_size = Vector2(600, 0)
	_root.add_child(_prompt)

	# --- Cartão de capítulo
	_card = _label("", 46, Color(0.75, 0.92, 1.0))
	_card.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_place(_card, Vector2(0.5, 0.33), Vector2.ZERO, Control.GROW_DIRECTION_BOTH, Control.GROW_DIRECTION_BOTH)
	_card.custom_minimum_size = Vector2(900, 0)
	_card.add_theme_constant_override("outline_size", 10)
	_root.add_child(_card)
	_card_sub = _label("", 24, Color(1.0, 0.85, 0.5))
	_card_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_place(_card_sub, Vector2(0.5, 0.33), Vector2(0, 52), Control.GROW_DIRECTION_BOTH, Control.GROW_DIRECTION_BOTH)
	_card_sub.custom_minimum_size = Vector2(900, 0)
	_root.add_child(_card_sub)
	_card.modulate.a = 0.0
	_card_sub.modulate.a = 0.0

	# --- Caixa de diálogo (parte de baixo; toque em qualquer lugar para continuar)
	_dialog_panel = PanelContainer.new()
	_dialog_panel.add_theme_stylebox_override("panel", _box(Color(0.03, 0.05, 0.12, 0.93), Color(0.4, 0.7, 1.0), 2, 12, 20))
	_dialog_panel.anchor_left = 0.08
	_dialog_panel.anchor_right = 0.92
	_dialog_panel.anchor_top = 1.0
	_dialog_panel.anchor_bottom = 1.0
	_dialog_panel.offset_top = -230
	_dialog_panel.offset_bottom = -24
	_dialog_panel.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_dialog_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(_dialog_panel)
	var dv := VBoxContainer.new()
	dv.add_theme_constant_override("separation", 8)
	_dialog_panel.add_child(dv)
	_dialog_name = _label("", 26, Color(1.0, 0.85, 0.45))
	dv.add_child(_dialog_name)
	_dialog_text = _label("", 22)
	_dialog_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_dialog_text.size_flags_vertical = Control.SIZE_EXPAND_FILL
	dv.add_child(_dialog_text)
	_dialog_hint = _label("Toque / Enter / F para continuar", 15, Color(0.7, 0.85, 1.0))
	_dialog_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	dv.add_child(_dialog_hint)
	_dialog_panel.visible = false

	# --- Sobreposição (título, fim de jogo, escolhas)
	_overlay = PanelContainer.new()
	_overlay.add_theme_stylebox_override("panel", _box(Color(0.03, 0.05, 0.12, 0.94), Color(0.4, 0.7, 1.0), 2, 12, 26))
	_overlay.custom_minimum_size = Vector2(800, 0)
	_place(_overlay, Vector2(0.5, 0.5), Vector2.ZERO, Control.GROW_DIRECTION_BOTH, Control.GROW_DIRECTION_BOTH)
	_root.add_child(_overlay)
	var ovb := VBoxContainer.new()
	ovb.add_theme_constant_override("separation", 16)
	_overlay.add_child(ovb)
	_overlay_title = _label("", 34, Color(0.6, 0.85, 1.0))
	_overlay_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ovb.add_child(_overlay_title)
	_overlay_text = _label("", 19)
	_overlay_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_overlay_text.custom_minimum_size = Vector2(740, 0)
	ovb.add_child(_overlay_text)
	_overlay_buttons = HBoxContainer.new()
	_overlay_buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	_overlay_buttons.add_theme_constant_override("separation", 14)
	ovb.add_child(_overlay_buttons)
	_overlay.visible = false

	_build_menu()


# ======================================================================= ESTILO
func _make_theme() -> Theme:
	var t := Theme.new()
	t.default_font_size = 20
	var normal := _box(Color(0.1, 0.2, 0.4, 0.92), Color(0.45, 0.7, 1.0), 2, 10, 12)
	var hover := _box(Color(0.15, 0.3, 0.55, 0.95), Color(0.6, 0.85, 1.0), 2, 10, 12)
	var pressed := _box(Color(0.25, 0.45, 0.75, 0.95), Color(0.8, 0.95, 1.0), 2, 10, 12)
	var disabled := _box(Color(0.12, 0.12, 0.16, 0.8), Color(0.3, 0.3, 0.35), 2, 10, 12)
	t.set_stylebox("normal", "Button", normal)
	t.set_stylebox("hover", "Button", hover)
	t.set_stylebox("pressed", "Button", pressed)
	t.set_stylebox("focus", "Button", hover)
	t.set_stylebox("disabled", "Button", disabled)
	t.set_font_size("font_size", "Button", 20)
	t.set_color("font_color", "Button", Color(0.92, 0.96, 1.0))
	t.set_color("font_disabled_color", "Button", Color(0.5, 0.5, 0.55))
	t.set_constant("outline_size", "Label", 4)
	t.set_color("font_outline_color", "Label", Color.BLACK)
	var grabber := _box(Color(0.5, 0.8, 1.0), Color(0.5, 0.8, 1.0), 0, 10, 0)
	t.set_stylebox("grabber_area", "HSlider", _box(Color(0.3, 0.55, 0.9), Color.TRANSPARENT, 0, 6, 4))
	t.set_stylebox("slider", "HSlider", _box(Color(0.15, 0.15, 0.2), Color.TRANSPARENT, 0, 6, 4))
	t.set_icon("grabber", "HSlider", _circle_icon(26, Color(0.7, 0.9, 1.0)))
	t.set_icon("grabber_highlight", "HSlider", _circle_icon(26, Color(1, 1, 1)))
	var _unused := grabber
	return t


func _circle_icon(sz: int, c: Color) -> Texture2D:
	var img := Image.create(sz, sz, false, Image.FORMAT_RGBA8)
	var r := sz / 2.0
	for y in sz:
		for x in sz:
			var d := Vector2(x + 0.5 - r, y + 0.5 - r).length()
			img.set_pixel(x, y, Color(c, clampf(r - d, 0.0, 1.0)))
	return ImageTexture.create_from_image(img)


func _box(bg: Color, border: Color, bw: int, radius: int, margin: int) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(bw)
	sb.set_corner_radius_all(radius)
	sb.set_content_margin_all(margin)
	return sb


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
	p.add_theme_stylebox_override("panel", _box(Color(0.02, 0.04, 0.1, 0.68), Color(0.3, 0.55, 0.9, 0.6), 1, 8, 10))
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


func _bar(color: Color, h := 16) -> ProgressBar:
	var b := ProgressBar.new()
	b.custom_minimum_size = Vector2(210, h)
	b.show_percentage = false
	b.mouse_filter = Control.MOUSE_FILTER_IGNORE
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
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var t := _label(title, 14)
	t.custom_minimum_size = Vector2(84, 0)
	h.add_child(t)
	h.add_child(bar)
	h.add_child(value)
	return h


func _button(text: String, cb: Callable, min_w := 180.0, min_h := 56.0) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(min_w, min_h)
	b.pressed.connect(cb)
	b.focus_mode = Control.FOCUS_NONE
	return b


# ======================================================================= LAYOUT TOQUE / PC
func set_touch_layout(on: bool) -> void:
	_touch_layout = on
	_skills_panel.visible = not on
	_cross.visible = not on
	# no celular o objetivo desce para não ficar embaixo dos botões MENU/FORMA/POÇÃO
	_obj_panel.offset_top = 100.0 if on else 14.0
	_obj_panel.offset_bottom = _obj_panel.offset_top
	_obj_panel.custom_minimum_size = Vector2(300 if on else 340, 0)
	_objective.custom_minimum_size = Vector2(280 if on else 320, 0)
	_stats.custom_minimum_size = _objective.custom_minimum_size
	_sage_box.custom_minimum_size = Vector2(520 if on else 640, 0)
	_sage_box.offset_top = -260.0 if on else -20.0
	_sage_box.offset_bottom = _sage_box.offset_top
	_dialog_hint.text = "Toque na tela para continuar" if on else "Clique / Enter / F para continuar"


# ======================================================================= ATUALIZAÇÃO
func _process(delta: float) -> void:
	if _mode == "dialogue" and _typing < 1.0:
		_typing = minf(_typing + delta * 60.0 / maxf(_full_text.length(), 1.0), 1.0)
		_dialog_text.visible_ratio = _typing
	if player == null:
		return
	_hp_bar.max_value = player.max_hp
	_hp_bar.value = player.hp
	_hp_text.text = " %d/%d" % [player.hp, player.max_hp]
	_mp_bar.max_value = player.max_mp
	_mp_bar.value = player.mp
	_mp_text.text = " %d/%d" % [player.mp, player.max_mp]
	_exp_bar.max_value = player.exp_to_next()
	_exp_bar.value = player.exp_points
	_level_label.text = "  Nv. %d" % player.level
	var extra := "  CIEL %.0fs" % player.ciel_time if player.ciel_time > 0.0 else ""
	_info_label.text = "Forma: %s   Poções: %d%s" % [Data.FORMS[player.form].name, player.potions, extra]

	if not _touch_layout:
		var t := "[color=#ffd966]HABILIDADES[/color]  [color=#888888](TAB = menu)[/color]\n"
		var keys := ["1/Q/Botão dir.", "2", "3", "4"]
		for i in 4:
			var sid: String = player.slots[i]
			if sid == "":
				t += "[color=#555566][%s] (vazio)[/color]\n" % keys[i]
				continue
			var cd: float = player.cooldowns.get(sid, 0.0)
			var state := "" if cd <= 0.0 else " [color=#888888](%.1fs)[/color]" % cd
			t += "[color=#aaaaaa][%s][/color] [color=#8fd3ff]%s[/color]%s\n" % [keys[i], Data.SKILLS[sid].name, state]
		t += "[color=#aaaaaa]J/Clique[/color] ataque  [color=#aaaaaa]Shift[/color] esquiva  [color=#aaaaaa]E[/color] Predador  [color=#aaaaaa]F[/color] falar\n"
		t += "[color=#aaaaaa]T[/color] forma  [color=#aaaaaa]H[/color] poção  [color=#aaaaaa]Espaço[/color] pulo/voar"
		_skills_label.text = t


func set_player_name(n: String) -> void:
	_name_label.text = n


func set_objective(text: String) -> void:
	_objective.text = text


func set_stats(text: String) -> void:
	_stats.text = text


func set_prompt(text: String) -> void:
	_prompt.text = "" if _touch_layout else text


func set_boss(enemy) -> void:
	if enemy == null or not is_instance_valid(enemy) or enemy.dead:
		_boss_panel.visible = false
		return
	_boss_panel.visible = true
	_boss_name.text = enemy.data.name
	_boss_bar.max_value = enemy.max_hp
	_boss_bar.value = enemy.hp


## Mensagem do Grande Sábio, que some depois de alguns segundos.
func sage(text: String) -> void:
	var who := "«Grande Sábio» "
	if player and player.skills.has("ciel_passive"):
		who = "«Ciel» "
	elif player and player.skills.has("raphael"):
		who = "«Raphael» "
	var l := _label(who + text, 17, Color(0.75, 0.95, 1.0))
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(_sage_box.custom_minimum_size.x, 0)
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


func chapter_card(title: String, sub: String) -> void:
	_card.text = title
	_card_sub.text = sub
	var tw := create_tween()
	tw.tween_property(_card, "modulate:a", 1.0, 0.6)
	tw.parallel().tween_property(_card_sub, "modulate:a", 1.0, 0.6)
	tw.tween_interval(2.6)
	tw.tween_property(_card, "modulate:a", 0.0, 0.8)
	tw.parallel().tween_property(_card_sub, "modulate:a", 0.0, 0.8)


func is_busy() -> bool:
	return _mode != ""


# ======================================================================= DIÁLOGOS
## lines: Array de [quem_fala, texto]
func show_dialogue(lines: Array, on_done: Callable) -> void:
	_dialogue = lines.duplicate()
	_dialogue_done = on_done
	_mode = "dialogue"
	get_tree().paused = true
	_dialog_panel.visible = true
	_next_line()


func _next_line() -> void:
	if _typing < 1.0 and _mode == "dialogue" and _full_text != "" and _dialog_panel.visible and _dialog_text.visible_ratio < 1.0:
		_typing = 1.0
		_dialog_text.visible_ratio = 1.0
		return
	if _dialogue.is_empty():
		_dialog_panel.visible = false
		_mode = ""
		_full_text = ""
		get_tree().paused = false
		if _dialogue_done.is_valid():
			_dialogue_done.call()
		return
	var line: Array = _dialogue.pop_front()
	_dialog_name.text = line[0]
	_dialog_name.add_theme_color_override("font_color", _speaker_color(line[0]))
	_full_text = line[1]
	_dialog_text.text = _full_text
	_typing = 0.0
	_dialog_text.visible_ratio = 0.0


func _speaker_color(who: String) -> Color:
	if who in ["Grande Sábio", "Raphael", "Ciel"]:
		return Color(0.6, 0.95, 1.0)
	if who.begins_with("Rimuru") or who == "Slime":
		return Color(0.55, 0.8, 1.0)
	if who.begins_with("Veldora"):
		return Color(1.0, 0.85, 0.3)
	return Color(1.0, 0.8, 0.5)


func show_choice(question: String, options: Array, on_pick: Callable) -> void:
	_mode = "choice"
	get_tree().paused = true
	_show_overlay("", question)
	for i in options.size():
		var idx := i
		_overlay_buttons.add_child(_button(options[i], func():
			_close_overlay()
			on_pick.call(idx)))


# ======================================================================= TELAS
func _show_overlay(title: String, text: String) -> void:
	_overlay_title.text = title
	_overlay_title.visible = title != ""
	_overlay_text.text = text
	for c in _overlay_buttons.get_children():
		c.queue_free()
	_overlay.visible = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func _close_overlay() -> void:
	_overlay.visible = false
	_mode = ""
	get_tree().paused = false
	if main and not main.touch_mode and _mode == "":
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func show_title(has_save: bool) -> void:
	_mode = "title"
	get_tree().paused = true
	_show_overlay("Tensura: Reencarnado como Slime 3D",
		"Você era Satoru Mikami, um homem comum de 37 anos... até ser esfaqueado e renascer como um slime numa caverna escura.\n\n" +
		"Viva TODA a história: a Caverna Selada, a Vila Goblin, Dwargon, Shizu e Ifrit, os Kijin, o Lorde Orc, Milim, " +
		"o Festival da Colheita, Walpurgis, Hinata e a guerra contra o Império!\n\n" +
		"PC: WASD mover, mouse câmera, J/clique atacar, 1-4 skills, E Predador, F falar, T forma, TAB menu.\n" +
		"Celular: joystick à esquerda, arraste à direita para a câmera e use os botões.")
	if has_save:
		_overlay_buttons.add_child(_button("Continuar", func():
			_close_overlay()
			main.continue_game()))
	_overlay_buttons.add_child(_button("Novo Jogo", func():
		_close_overlay()
		main.new_game()))
	_overlay_buttons.add_child(_button("Opções", func():
		_overlay.visible = false
		_mode = ""
		open_menu("options", true)))


func show_end(title: String, text: String, button: String, cb: Callable) -> void:
	_mode = "end"
	get_tree().paused = true
	_show_overlay(title, text)
	_overlay_buttons.add_child(_button(button, func():
		_close_overlay()
		cb.call()))


func _input(event: InputEvent) -> void:
	if _mode == "dialogue":
		var advance: bool = event.is_action_pressed("interact") or event.is_action_pressed("ui_accept") \
			or (event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT)
		if advance:
			get_viewport().set_input_as_handled()
			_next_line()
	elif _mode == "menu":
		if event.is_action_pressed("menu") or event.is_action_pressed("ui_cancel"):
			get_viewport().set_input_as_handled()
			close_menu()
	elif _mode == "":
		if event.is_action_pressed("menu"):
			get_viewport().set_input_as_handled()
			open_menu()


# ======================================================================= MENU
var _menu_from_title := false
var _menu_guard_until := 0

func _build_menu() -> void:
	_menu = PanelContainer.new()
	_menu.add_theme_stylebox_override("panel", _box(Color(0.02, 0.04, 0.1, 0.96), Color(0.4, 0.7, 1.0), 2, 12, 16))
	_menu.anchor_left = 0.04
	_menu.anchor_right = 0.96
	_menu.anchor_top = 0.05
	_menu.anchor_bottom = 0.95
	_root.add_child(_menu)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	_menu.add_child(v)
	var head := HBoxContainer.new()
	v.add_child(head)
	var tabs_scroll := ScrollContainer.new()
	tabs_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tabs_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	tabs_scroll.custom_minimum_size = Vector2(0, 64)
	head.add_child(tabs_scroll)
	_menu_tabs = HBoxContainer.new()
	_menu_tabs.add_theme_constant_override("separation", 8)
	tabs_scroll.add_child(_menu_tabs)
	for t in [["status", "Status"], ["skills", "Habilidades"], ["forms", "Formas"], ["party", "Grupo"], ["book", "Enciclopédia"], ["options", "Opções"], ["save", "Salvar"]]:
		var id: String = t[0]
		_menu_tabs.add_child(_button(t[1], func(): _show_tab(id), 120, 52))
	head.add_child(_button("Fechar X", close_menu, 130, 52))
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	v.add_child(scroll)
	_menu_body = VBoxContainer.new()
	_menu_body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_menu_body.add_theme_constant_override("separation", 8)
	scroll.add_child(_menu_body)
	_menu.visible = false


func open_menu(tab := "", from_title := false) -> void:
	if _mode != "" and not from_title:
		return
	_menu_from_title = from_title
	# evita que o mesmo toque que abriu o menu aperte "Fechar" (mesma região da tela)
	_menu_guard_until = Time.get_ticks_msec() + 400
	_mode = "menu"
	get_tree().paused = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_menu.visible = true
	_pending_skill = ""
	for c in _menu_tabs.get_children():
		c.visible = not from_title or c.text == "Opções"
	_show_tab(tab if tab != "" else _menu_tab)


func close_menu(force := false) -> void:
	if not force and Time.get_ticks_msec() < _menu_guard_until:
		return
	_menu.visible = false
	_mode = ""
	if _menu_from_title:
		_menu_from_title = false
		show_title(main.has_save())
		return
	get_tree().paused = false
	if main and not main.touch_mode:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _clear_body() -> void:
	for c in _menu_body.get_children():
		_menu_body.remove_child(c)
		c.queue_free()


func _heading(t: String) -> void:
	_menu_body.add_child(_label(t, 24, Color(1.0, 0.85, 0.45)))


func _para(t: String, color := Color(0.9, 0.93, 1.0), size := 18) -> Label:
	var l := _label(t, size, color)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_menu_body.add_child(l)
	return l


func _show_tab(tab: String) -> void:
	_menu_tab = tab
	_clear_body()
	match tab:
		"status": _tab_status()
		"skills": _tab_skills()
		"forms": _tab_forms()
		"party": _tab_party()
		"book": _tab_book()
		"options": _tab_options()
		"save": _tab_save()


func _tab_status() -> void:
	if player == null:
		return
	_heading(player.title)
	_para("Nível %d   EXP %d/%d" % [player.level, player.exp_points, player.exp_to_next()])
	_para("Vida %d/%d    Magículas %d/%d" % [player.hp, player.max_hp, player.mp, player.max_mp])
	_para("Forma atual: %s    Poções Completas: %d" % [Data.FORMS[player.form].name, player.potions])
	_para("Capítulo: %s" % main.chapter_name())
	_para("Área: %s" % Data.AREAS[main.area_id].name)
	_para("Monstros devorados: %d    Inimigos derrotados: %d" % [main.monsters_eaten, main.kills])
	_heading("Habilidades passivas")
	for sid in player.skills:
		var info: Dictionary = Data.SKILLS.get(sid, {})
		if info.get("kind", "") == "passive":
			_para("• %s — %s" % [info.name, info.desc], Color(0.75, 0.9, 1.0), 16)


func _tab_skills() -> void:
	_heading("Slots de habilidade (toque numa habilidade e depois num slot)")
	var slots_row := HBoxContainer.new()
	slots_row.add_theme_constant_override("separation", 8)
	_menu_body.add_child(slots_row)
	for i in 4:
		var idx := i
		var sid: String = player.slots[i]
		var txt := "Slot %d\n%s" % [i + 1, Data.SKILLS[sid].name if sid != "" else "(vazio)"]
		var b := _button(txt, func():
			if _pending_skill != "":
				for k in 4:
					if player.slots[k] == _pending_skill:
						player.slots[k] = ""
				player.slots[idx] = _pending_skill
				_pending_skill = ""
			else:
				player.slots[idx] = ""
			_show_tab("skills"), 200, 72)
		slots_row.add_child(b)
	if _pending_skill != "":
		_para("Escolha o slot para: %s" % Data.SKILLS[_pending_skill].name, Color(1.0, 0.9, 0.5))
	else:
		_para("Toque num slot ocupado para esvaziá-lo.", Color(0.7, 0.75, 0.85), 15)
	_heading("Habilidades ativas")
	for sid in Data.SKILLS:
		var info: Dictionary = Data.SKILLS[sid]
		if info.kind != "active":
			continue
		var has: bool = player.skills.has(sid)
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 10)
		_menu_body.add_child(row)
		var s: String = sid
		var b2 := _button(info.name if has else "??? (bloqueada)", func():
			_pending_skill = s
			_show_tab("skills"), 280, 52)
		b2.disabled = not has
		row.add_child(b2)
		var d := _label(("MP %d • recarga %.1fs\n%s" % [info.mp, info.cd, info.desc]) if has else "Devore monstros e avance na história para desbloquear.", 15, Color(0.8, 0.85, 0.95))
		d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		d.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(d)


func _tab_forms() -> void:
	_heading("Mimetismo — escolha uma forma")
	if not player.skills.has("mimicry"):
		_para("Você ainda não possui a habilidade Mimetismo.")
	for fid in Data.FORM_ORDER:
		var f: Dictionary = Data.FORMS[fid]
		var has: bool = player.forms.has(fid)
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 10)
		_menu_body.add_child(row)
		var id: String = fid
		var b := _button(("» " if player.form == fid else "") + (f.name if has else "???"), func():
			player.set_form(id)
			close_menu(true), 280, 56)
		b.disabled = not has or not player.skills.has("mimicry")
		row.add_child(b)
		var d := _label("Vel. %.1f  Pulo %.1f  Dano x%.1f  Defesa x%.1f\n%s" % [f.speed, f.jump, f.dmg, f.def, f.desc] if has else "Bloqueada", 15, Color(0.8, 0.85, 0.95))
		d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		d.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(d)


func _tab_party() -> void:
	_heading("Grupo ativo (até 3 aliados lutam ao seu lado)")
	if main.unlocked_allies.is_empty():
		_para("Ninguém se juntou a você ainda. Avance na história!")
	for aid in main.unlocked_allies:
		var ch: Dictionary = Data.CHARS[aid]
		var st: Dictionary = Data.ALLIES[aid]
		var on: bool = main.party.has(aid)
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 10)
		_menu_body.add_child(row)
		var id: String = aid
		row.add_child(_button(("» " if on else "+ ") + ch.name, func():
			main.toggle_party(id)
			_show_tab("party"), 260, 56))
		var d := _label("Vida %d  Dano %d  Especial: %s\n%s" % [st.hp, st.dmg, st.special.name, ch.info], 15, Color(0.8, 0.85, 0.95))
		d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		d.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(d)


func _tab_book() -> void:
	_heading("Enciclopédia de Tempest — Personagens")
	for cid in Data.CHARS:
		var ch: Dictionary = Data.CHARS[cid]
		_para("• %s — %s" % [ch.name, ch.info], Color(0.85, 0.9, 1.0), 16)
	_heading("Mundo e História")
	for l in Data.LORE:
		_para("• %s — %s" % [l[0], l[1]], Color(0.85, 0.95, 0.85), 16)
	_heading("Monstros")
	for eid in Data.ENEMIES:
		var e: Dictionary = Data.ENEMIES[eid]
		var extra := ""
		if e.has("absorb_skill"):
			extra += " Predador copia: %s." % Data.SKILLS[e.absorb_skill].name
		if e.has("absorb_form"):
			extra += " Forma: %s." % Data.FORMS[e.absorb_form].name
		_para("• %s%s%s" % [e.name, " (CHEFE)" if e.get("boss", false) else "", extra], Color(1.0, 0.85, 0.8), 16)


func _tab_options() -> void:
	_heading("Gráficos")
	var qrow := HBoxContainer.new()
	qrow.add_theme_constant_override("separation", 8)
	_menu_body.add_child(qrow)
	var qnames := ["Baixa (celular)", "Média", "Alta (PC)"]
	for q in 3:
		var qq := q
		qrow.add_child(_button(("» " if main.quality == q else "") + qnames[q], func():
			main.set_quality(qq)
			_show_tab("options"), 210, 56))
	_para("Alta liga SSAO, iluminação indireta, neblina volumétrica e mais grama. Baixa reduz a resolução 3D para rodar liso no celular.", Color(0.7, 0.75, 0.85), 15)
	_heading("Controles de toque")
	var trow := HBoxContainer.new()
	trow.add_theme_constant_override("separation", 8)
	_menu_body.add_child(trow)
	var tnames := ["Automático", "Sempre ligados", "Desligados"]
	for t in 3:
		var tt := t
		trow.add_child(_button(("» " if main.touch_setting == t else "") + tnames[t], func():
			main.set_touch_setting(tt)
			_show_tab("options"), 210, 56))
	_slider("Tamanho dos botões", 0.7, 1.5, main.button_scale, func(v): main.set_button_scale(v))
	_slider("Sensibilidade da câmera", 0.3, 2.5, main.sensitivity, func(v): main.set_sensitivity(v))
	var inv := _button(("» " if main.invert_y else "") + "Inverter eixo Y da câmera", func():
		main.set_invert_y(not main.invert_y)
		_show_tab("options"), 360, 56)
	_menu_body.add_child(inv)
	main.save_settings()


func _slider(title: String, mn: float, mx: float, value: float, cb: Callable) -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	_menu_body.add_child(row)
	var l := _label("%s: %.2f" % [title, value], 18)
	l.custom_minimum_size = Vector2(340, 0)
	row.add_child(l)
	var s := HSlider.new()
	s.min_value = mn
	s.max_value = mx
	s.step = 0.05
	s.value = value
	s.custom_minimum_size = Vector2(320, 48)
	s.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	s.value_changed.connect(func(v):
		l.text = "%s: %.2f" % [title, v]
		cb.call(v))
	row.add_child(s)


func _tab_save() -> void:
	_heading("Salvar e carregar")
	_para("O jogo também salva sozinho a cada capítulo e ao trocar de área.", Color(0.7, 0.75, 0.85), 15)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	_menu_body.add_child(row)
	row.add_child(_button("Salvar agora", func():
		main.save_game()
		_para("Jogo salvo!", Color(0.6, 1.0, 0.6)), 220, 60))
	row.add_child(_button("Carregar", func():
		close_menu(true)
		main.continue_game(), 220, 60))
	row.add_child(_button("Tela de título", func():
		_menu.visible = false
		_mode = ""
		main.save_game()
		show_title(true), 220, 60))
