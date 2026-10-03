extends Node3D
## Personagem com quem dá para conversar (botão FALAR / F).

const Util := preload("res://scripts/util.gd")
const Data := preload("res://scripts/game_data.gd")
const Models := preload("res://scripts/models.gd")

var npc_id := "rigurd"
var talk_range := 4.5
var _visual: Node3D
var _model: Node3D
var _label: Label3D
var _t := 0.0
var _line := 0


func _ready() -> void:
	add_to_group("npc")
	var ch: Dictionary = Data.CHARS[npc_id]
	_visual = Node3D.new()
	add_child(_visual)
	_model = Models.build(Data.MODELS[ch.model], ch.model)
	_visual.add_child(_model)
	_t = randf() * 5.0
	var y := 2.6
	if npc_id == "ramiris":
		y = 1.6
		_visual.position.y = 0.8
	_label = Util.label3d(ch.name, 40, Color(1.0, 0.95, 0.6), y)
	_label.no_depth_test = false
	add_child(_label)
	# bloqueia passagem sem atrapalhar a câmera
	var body := StaticBody3D.new()
	body.collision_layer = Util.LAYER_WORLD
	body.collision_mask = 0
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.4
	cap.height = 1.8
	cs.shape = cap
	cs.position.y = 0.9
	body.add_child(cs)
	add_child(body)


func display_name() -> String:
	return Data.CHARS[npc_id].name


func next_line() -> String:
	var lines: Array = Data.CHARS[npc_id].get("lines", ["..."])
	var l: String = lines[_line % lines.size()]
	_line += 1
	return l


func set_marker(on: bool) -> void:
	_label.text = ("(!) " if on else "") + display_name() + ("\n[FALAR]" if on else "")
	_label.modulate = Color(1.0, 0.85, 0.3) if on else Color(1.0, 0.95, 0.6)


func _process(delta: float) -> void:
	_t += delta
	Models.animate(_model, _t, 0.0)
	if npc_id == "ramiris":
		_visual.position.y = 0.8 + sin(_t * 2.0) * 0.15
	var main = get_tree().current_scene
	if main and main.get("player") and main.player:
		var to: Vector3 = main.player.global_position - global_position
		to.y = 0
		if to.length() < 10.0 and to.length() > 0.1:
			_visual.rotation.y = lerp_angle(_visual.rotation.y, atan2(-to.x, -to.z), minf(delta * 5.0, 1.0))
