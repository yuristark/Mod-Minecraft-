extends SceneTree
## Teste automático: joga todos os capítulos e alguns andares do Labirinto
## Infinito "trapaceando" (mata inimigos, teletransporta o Rimuru) e confere
## se tudo funciona sem erros. Também testa os controles de toque.
## godot --headless --path tensura-slime-2d --script tests/smoke_test.gd

const ENDLESS_FLOORS := 6

var main
var frame := 0
var chapter := 0
var chapter_frames := 0
var failed := false
var in_endless := false
var floors_done := 0


func _initialize() -> void:
	main = load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	current_scene = main


func _flush_dialogue() -> void:
	var hud = main.hud
	var guard := 0
	while hud._mode == "dialogue" and guard < 100:
		hud._next_line()
		guard += 1


func _process(_d: float) -> bool:
	frame += 1
	if frame == 3:
		main.unlocked = main.chapters.size()
		main.set_touch(true, false)  # testa com os controles de toque ligados
		main.hud._close()
		main.start_chapter(0)
		return false
	if frame < 3:
		return false
	chapter_frames += 1
	var hud = main.hud
	_flush_dialogue()
	if hud._mode == "end" or (in_endless and hud._mode == "menu"):
		var title: String = hud._overlay_title.text
		if title.begins_with("Você"):
			print("MORREU: ", title)
			failed = true
		if not in_endless:
			print("Capítulo %d terminou: %s (%d frames)" % [chapter + 1, title, chapter_frames])
			chapter += 1
			chapter_frames = 0
			hud._close()
			if chapter >= main.chapters.size():
				in_endless = true
				main.start_endless(1)
			else:
				main.start_chapter(chapter)
		else:
			floors_done += 1
			print("Labirinto: %s  (nível %d)" % [title, main.level])
			chapter_frames = 0
			if floors_done >= ENDLESS_FLOORS:
				print("Bênçãos escolhidas: ", main.run_bonus.keys())
				print("RESULTADO: ", "FALHOU" if failed else "OK — história e Labirinto Infinito funcionando")
				return true
			hud._buttons.get_child(floors_done % 3).pressed.emit()  # escolhe uma bênção
		return false
	if chapter_frames > 5000:
		print("TRAVOU: capítulo %d andar %d etapa %d (%s)" % [chapter + 1, main.floor_n, main.step_index, main.step.get("type", "")])
		return true
	var p = main.player
	if p == null or not is_instance_valid(p):
		return false
	p.hp = p.max_hp  # o teste não quer morrer
	p.mp = p.max_mp
	# controles de toque: joystick e botão de ataque
	if chapter_frames % 60 == 10:
		main.touch._update_stick(main.touch._stick_center + Vector2(60, -20))
		Input.action_press("touch_attack")
	if chapter_frames % 60 == 30:
		main.touch._release_stick()
		Input.action_release("touch_attack")
	if chapter_frames % 40 == 5:
		for id in p.skills:
			p.cooldowns[id] = 0.0
			p._cast(id)
		p._cast("mimicry")
	if not main._step_ready:
		return false
	var step: Dictionary = main.step
	match step.type:
		"talk":
			var n = main.npcs[step.npc]
			p.global_position = n.global_position + Vector2(0, 60)
			main.player_interact()
		"devour":
			for e in get_nodes_in_group("enemy"):
				e.take_damage(999999.0)
				break
			for a in get_nodes_in_group("absorbable"):
				p.global_position = a.global_position + Vector2(10, 0)
				p.cooldowns["predator"] = 0.0
				p._devour()
				break
		"devour_npc":
			var n = main.npcs.get(step.npc)
			if n:
				p.global_position = n.global_position + Vector2(0, 40)
				p.cooldowns["predator"] = 0.0
				p._devour()
		"waves", "endless":
			for e in get_nodes_in_group("wave_enemy"):
				if not e.dead:
					e.take_damage(999999.0)
					break
		"boss":
			var b = main.boss
			if b and is_instance_valid(b):
				if not b.dead:
					if chapter_frames % 30 == 0:
						b.take_damage(b.max_hp * 0.2 / main.power_mult())
				elif chapter_frames % 20 == 0:
					p.global_position = b.global_position + Vector2(20, 0)
					p.cooldowns["predator"] = 0.0
					p._devour()
	return false
