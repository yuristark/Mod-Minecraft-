extends SceneTree
## Tira screenshots de várias áreas (precisa de tela; ex.: xvfb-run).
##   xvfb-run godot --path tensura-slime-3d --rendering-driver opengl3 --script tests/screenshots.gd

var main
var out := "user://shots"

func _initialize() -> void:
	main = load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	current_scene = main
	_run.call_deferred()


func _frames(n: int) -> void:
	for i in n:
		await process_frame


func _shot(name: String) -> void:
	await _frames(12)
	await RenderingServer.frame_post_draw
	var img := root.get_viewport().get_texture().get_image()
	var dir := OS.get_environment("SHOT_DIR")
	img.save_png(dir.path_join(name + ".png"))
	print("shot ", name)


func _cam(yaw: float, pitch: float) -> void:
	main.player._yaw = yaw
	main.player._pitch = pitch


func _run() -> void:
	await _frames(5)
	await _shot("00_titulo")
	main.hud._close_overlay()
	main.new_game()
	await _frames(5)
	while main.hud._mode == "dialogue":
		main.hud._next_line()
	main.player.global_position = Vector3(0, 1, 8)
	_cam(0.0, -0.25)
	await _shot("01_caverna_veldora")
	# Floresta com Tempest em vários níveis
	main.chapter = 9
	main.town = 5
	main.player.forms["demon_lord"] = true
	main.player.forms["human"] = true
	main.player.skills["mimicry"] = true
	main.unlocked_allies = ["benimaru", "shion", "ranga"]
	main.party = ["benimaru", "shion", "ranga"]
	main.load_area("forest", Vector3(0, 0, 55), true)
	main.player.set_form("human", true)
	_cam(0.0, -0.3)
	await _shot("02_tempest_capital")
	main.player.global_position = main.builder.ground(Vector3(-60, 0, 30), 1.0)
	_cam(1.6, -0.2)
	await _shot("03_floresta_lago")
	main.town = 1
	main.load_area("forest", Vector3(0, 0, 32), true)
	_cam(0.0, -0.35)
	await _shot("04_vila_goblin")
	main.town = 5
	main.load_area("forest", Vector3(55, 0, -50), true)
	main.player.set_form("demon_lord", true)
	main.spawn_enemy("ifrit", Vector3(62, 0, -62))
	main.spawn_enemy("salamander", Vector3(58, 0, -60))
	_cam(0.6, -0.3)
	await _frames(40)
	main.player._cast_slot(0)
	await _shot("05_chefe_ifrit")
	main.load_area("dwargon", Vector3(0, 0, 20), true)
	_cam(0.0, -0.15)
	await _shot("06_dwargon")
	main.load_area("falmuth", Vector3(0, 0, 60), true)
	for i in 6:
		main.spawn_enemy("falmuth_soldier", Vector3(-6 + i * 2.5, 0, 45))
	_cam(0.0, -0.2)
	await _shot("07_falmuth")
	main.load_area("walpurgis", Vector3(0, 0, 25), true)
	main.spawn_enemy("clayman", Vector3(0, 0, 10))
	_cam(0.0, -0.2)
	await _shot("08_walpurgis")
	main.set_touch_setting(1)
	main.load_area("forest", Vector3(20, 0, 20), true)
	main.player.set_form("slime", true)
	_cam(-0.8, -0.35)
	await _shot("09_controles_celular")
	main.hud.open_menu("skills")
	await _shot("10_menu_habilidades")
	main.hud.close_menu(true)
	main.set_touch_setting(2)
	quit()
