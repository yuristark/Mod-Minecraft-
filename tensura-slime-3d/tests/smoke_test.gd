extends SceneTree
## Teste automático: abre o jogo e joga a história inteira (todos os capítulos),
## depois testa áreas, skills, formas, menus, toque, save e morte.
##   godot --headless --path tensura-slime-3d --script tests/smoke_test.gd

func _initialize() -> void:
	var main = load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	current_scene = main
	var runner = load("res://tests/story_runner.gd").new()
	runner.process_mode = Node.PROCESS_MODE_ALWAYS
	runner.main = main
	root.add_child(runner)
