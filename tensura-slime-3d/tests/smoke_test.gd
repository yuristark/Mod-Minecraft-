extends SceneTree

var main
var frames := 0

func _initialize() -> void:
	main = load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	current_scene = main

func _process(_d: float) -> bool:
	frames += 1
	var hud = main.hud
	var p = main.player
	match frames:
		5:
			paused = false
			hud._mode = ""
			hud._overlay.visible = false
			print("enemies: ", get_nodes_in_group("enemy").size(), " absorbable: ", get_nodes_in_group("absorbable").size())
		10:
			p._cast("water_blade")
			p._cast("poison_breath")
			p.global_position = Vector3(0, 1, -6)  # perto do Veldora
		30:
			print("stage after approach: ", main.stage, " busy: ", hud.is_busy())
			for i in 7: hud._next_line()
			print("name: ", hud._name_label.text, " maxmp: ", p.max_mp)
		40:
			var es = get_nodes_in_group("enemy")
			for i in 5:
				es[i].take_damage(9999)
			for e in es.slice(0, 5):
				p.global_position = e.global_position + Vector3(1, 0.5, 0)
				p._predator()
				print(" after predator absorbable has e: ", e.is_in_group("absorbable"), " dist ", p.global_position.distance_to(e.global_position))
		45:
			for e in get_nodes_in_group("enemy"):
				if e.type_id in ["spider", "bat", "wolf"]:
					e.take_damage(9999)
		90:
			for pk in get_nodes_in_group("absorbable"):
				if pk.get("kind") == "ore" and main.ore_eaten < 6:
					main.on_absorbed(pk); pk.remove_from_group("absorbable"); pk.queue_free()
			print("monsters: ", main.monsters_eaten, " ore: ", main.ore_eaten, " stage: ", main.stage, " skills: ", p.skills.keys())
			p._cast("sticky_thread"); p._cast("ultrasound"); p._cast("shadow_motion")
		100:
			print("pre-veldora skills: ", p.skills.keys(), " monsters: ", main.monsters_eaten, " stage ", main.stage, " corpses: ", get_nodes_in_group("absorbable").filter(func(n): return n.get("type_id") != null).size())
			p.global_position = main.veldora.global_position + Vector3(0, 1, 6)
			p._predator()
		160:
			print("stage: ", main.stage, " busy: ", hud.is_busy(), " title: ", hud._overlay_title.text)
			for i in 3: hud._next_line()
			print("end: ", hud._overlay_title.text)
			paused = false
			p.take_damage(9999, Vector3.ZERO)
			print("dead: ", p.dead)
		170:
			print("OK frames done")
			return true
	return false
