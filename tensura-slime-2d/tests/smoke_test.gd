extends SceneTree
## Teste automático: joga todos os capítulos "trapaceando" (mata inimigos,
## teletransporta o Rimuru) e confere se a história chega ao fim sem erros.
## godot --headless --path tensura-slime-2d --script tests/smoke_test.gd

var main
var frame := 0
var chapter := 0
var chapter_frames := 0
var failed := false


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
		main.hud._close()
		main.start_chapter(0)
		return false
	if frame < 3:
		return false
	chapter_frames += 1
	var hud = main.hud
	_flush_dialogue()
	if hud._mode == "end":
		var title: String = hud._overlay_title.text
		print("Capítulo %d terminou: %s (%d frames)" % [chapter + 1, title, chapter_frames])
		if title.begins_with("Você foi"):
			failed = true
		chapter += 1
		chapter_frames = 0
		if chapter >= main.chapters.size():
			print("RESULTADO: ", "FALHOU" if failed else "OK — todos os capítulos concluídos")
			return true
		hud._close()
		main.start_chapter(chapter)
		return false
	if chapter_frames > 4000:
		print("TRAVOU no capítulo %d, etapa %d (%s)" % [chapter + 1, main.step_index, main.step.get("type", "")])
		return true
	var p = main.player
	if p == null:
		return false
	p.hp = p.max_hp  # o teste não quer morrer
	p.mp = p.max_mp
	# usa todas as habilidades de vez em quando
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
				e.take_damage(99999.0)
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
		"waves":
			for e in get_nodes_in_group("wave_enemy"):
				if not e.dead:
					e.take_damage(99999.0)
					break
		"boss":
			var b = main.boss
			if b and is_instance_valid(b):
				if not b.dead:
					if chapter_frames % 30 == 0:
						b.take_damage(b.max_hp * 0.2)
				elif chapter_frames % 20 == 0:
					p.global_position = b.global_position + Vector2(20, 0)
					p.cooldowns["predator"] = 0.0
					p.cooldowns["beelzebub"] = 0.0
					p._devour()
	return false
