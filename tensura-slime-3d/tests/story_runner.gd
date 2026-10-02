extends Node
## Joga a história inteira automaticamente (usado por tests/smoke_test.gd).

const Data := preload("res://scripts/game_data.gd")

var main
var errors := 0


func _ready() -> void:
	run()


func wait(n := 1) -> void:
	for i in n:
		await get_tree().process_frame


func secs(t: float) -> void:
	await get_tree().create_timer(t, true, false, true).timeout


func press_overlay_button(idx := 0) -> void:
	var live := []
	for b in main.hud._overlay_buttons.get_children():
		if not b.is_queued_for_deletion():
			live.append(b)
	if live.size() > idx:
		live[idx].pressed.emit()


func clear_ui() -> void:
	var hud = main.hud
	for guard in 300:
		match hud._mode:
			"dialogue":
				hud._typing = 1.0
				hud._dialog_text.visible_ratio = 1.0
				hud._next_line()
			"end", "choice", "title":
				press_overlay_button(0)
			"menu":
				hud.close_menu(true)
			_:
				return
		await wait(1)


func check(cond: bool, msg: String) -> void:
	if not cond:
		errors += 1
		print("FALHA: ", msg)


func run() -> void:
	await wait(5)
	check(main.hud._mode == "title", "tela de título")
	main.hud._close_overlay()
	main.new_game()
	await wait(3)
	var guard := 0
	var last_step := -1
	var same := 0
	while main.step < Data.STORY.size() and guard < 600:
		guard += 1
		main.player._invuln = 999.0
		main.player.hp = main.player.max_hp
		await clear_ui()
		var s = main.current_obj()
		if s == null:
			await wait(1)
			continue
		if main.step == last_step:
			same += 1
			if same > 40:
				check(false, "travado no passo %d (%s)" % [main.step, s.text])
				break
		else:
			same = 0
			last_step = main.step
			print("PASSO %d cap %d [%s] %s" % [main.step, main.chapter, s.kind, s.text.substr(0, 60)])
		if s.kind == "free":
			break
		if s.has("area") and s.area != main.area_id and s.kind != "area":
			main.travel(s.area)
			await wait(3)
			continue
		var p = main.player
		match s.kind:
			"reach":
				p.global_position = main.builder.ground(s.pos, 1.0)
			"area":
				main.travel(s.area)
			"talk":
				for n in get_tree().get_nodes_in_group("npc"):
					if n.npc_id == s.npc:
						p.global_position = n.global_position + Vector3(1.5, 1, 0)
				await wait(2)
				main.player_interact(p)
			"kill", "boss":
				for e in get_tree().get_nodes_in_group("enemy"):
					if e.type_id == s.get("enemy", "") or e.story_tag == main._obj_tag():
						p.global_position = e.global_position + Vector3(2, 1, 0)
						p._melee()
						e.take_damage(1e7)
						break
			"survive":
				main.survive_timer = -1.0
			"absorb":
				var target = null
				if s.what == "veldora":
					target = main.veldora
				else:
					for n in get_tree().get_nodes_in_group("absorbable"):
						if n.get("type_id") == s.what:
							target = n
				if target:
					p.global_position = target.global_position + Vector3(1.2, 0.5, 0)
					await wait(2)
					p._predator()
					await secs(0.6)
			"absorb_counts":
				var es = get_tree().get_nodes_in_group("enemy")
				for i in mini(6, es.size()):
					es[i].take_damage(1e7)
				await wait(2)
				for n in get_tree().get_nodes_in_group("absorbable"):
					if n == main.veldora or not is_instance_valid(n):
						continue
					if main.current_obj() == null or main.current_obj().kind != "absorb_counts":
						break
					p.global_position = n.global_position + Vector3(0.8, 0.5, 0)
					await wait(2)
					p._predator()
					await secs(0.5)
		await wait(2)
	print("História: passo final %d de %d, capítulo %d, nível %d" % [main.step, Data.STORY.size(), main.chapter, main.player.level])
	check(main.step >= Data.STORY.size() - 1, "história completa")
	check(main.player.forms.has("demon_lord"), "forma Lorde Demônio")
	check(main.party.size() == 3, "grupo com 3 aliados")
	await extras()
	print("TESTE TERMINOU. falhas: ", errors)
	get_tree().quit(1 if errors > 0 else 0)


func extras() -> void:
	var p = main.player
	await clear_ui()
	main.travel("forest")
	await wait(5)
	await clear_ui()
	print("Áreas e qualidade...")
	for q in [0, 2, 1]:
		main.set_quality(q)
		await wait(3)
	for a in ["cave", "dwargon", "falmuth", "walpurgis", "forest"]:
		main.travel(a)
		await wait(4)
		await clear_ui()
		check(main.area_id == a, "viajar para " + a)
	print("Skills...")
	for sid in Data.SKILLS:
		p.skills[sid] = true
	for i in 6:
		main.spawn_enemy("orc", p.global_position + Vector3(4 + i, 0, -6))
	await wait(3)
	for sid in Data.SKILLS:
		if Data.SKILLS[sid].kind == "active":
			p.mp = p.max_mp
			p.cooldowns[sid] = 0.0
			p._cast(sid)
			await wait(2)
	await secs(1.5)
	print("Formas...")
	for f in Data.FORM_ORDER:
		p.set_form(f)
		p._melee()
		await wait(3)
		check(p.form == f, "forma " + f)
	p.use_potion()
	p._dash()
	print("Menus...")
	for t in ["status", "skills", "forms", "party", "book", "options", "save"]:
		main.hud.open_menu(t)
		await wait(2)
		main.hud.close_menu(true)
		await wait(1)
	main.toggle_party("diablo")
	main.toggle_party("milim")
	await wait(3)
	print("Toque...")
	main.set_touch_setting(1)
	await wait(2)
	var tc = main.touch
	check(tc.enabled, "controles de toque ligados")
	var atk = tc._find("attack")
	var ev := InputEventScreenTouch.new()
	ev.index = 0
	ev.position = atk.pos
	ev.pressed = true
	tc._input(ev)
	await wait(2)
	var ev2 := InputEventScreenTouch.new()
	ev2.index = 1
	ev2.position = Vector2(150, tc._screen().y - 150)
	ev2.pressed = true
	tc._input(ev2)
	var drag := InputEventScreenDrag.new()
	drag.index = 1
	drag.position = Vector2(220, tc._screen().y - 150)
	drag.relative = Vector2(70, 0)
	tc._input(drag)
	await wait(5)
	check(tc._touches.get(0, {}).get("kind", "") == "btn", "toque no botão ATAQUE")
	check(Input.get_action_strength("move_right") > 0.5, "joystick move_right")
	ev.pressed = false
	ev2.pressed = false
	tc._input(ev)
	tc._input(ev2)
	await wait(2)
	check(Input.get_action_strength("move_right") == 0.0, "joystick solto")
	main.set_touch_setting(2)
	print("Treino com Veldora...")
	main._start_spar()
	await wait(3)
	for e in get_tree().get_nodes_in_group("enemy"):
		if e.type_id == "veldora_spar":
			e.take_damage(1e8)
	await wait(3)
	print("Save / load...")
	main.save_game()
	var lvl: int = p.level
	main.continue_game()
	await wait(5)
	await clear_ui()
	check(main.player.level == lvl, "nível após carregar")
	print("Morte e renascer...")
	p._invuln = 0.0
	p.take_damage(1e9, Vector3.ZERO)
	await wait(2)
	check(main.hud._mode == "end", "tela de derrota")
	press_overlay_button(0)
	await wait(2)
	check(not p.dead, "renasceu")
