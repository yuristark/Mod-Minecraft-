extends Node3D
## Item que pode ser devorado com o Predador (minério mágico, erva, água do lago).

const Util := preload("res://scripts/util.gd")

## "ore", "herb" ou "water"
var kind := "ore"
var display_name := ""
var _t := 0.0
var _visual: Node3D


func _ready() -> void:
	add_to_group("absorbable")
	_visual = Node3D.new()
	add_child(_visual)
	match kind:
		"ore":
			display_name = "Minério Mágico"
			var m := Util.mat(Color(0.65, 0.35, 1.0), 2.0)
			for i in 3:
				var c := Util.cone(0.18, 0.9 - i * 0.2, m, Vector3((i - 1) * 0.22, 0.4, (i % 2) * 0.15))
				c.rotation.z = (i - 1) * 0.35
				_visual.add_child(c)
			_add_light(Color(0.65, 0.35, 1.0))
		"herb":
			display_name = "Erva Hipokute"
			var g := Util.mat(Color(0.3, 0.95, 0.4), 1.2)
			for i in 5:
				var leaf := Util.box(Vector3(0.12, 0.5, 0.04), g, Vector3(0, 0.25, 0))
				leaf.rotation = Vector3(0.5, i * TAU / 5.0, 0)
				_visual.add_child(leaf)
			_add_light(Color(0.3, 0.95, 0.4))
		"water":
			display_name = "Água Mágica do Lago"
			var w := Util.mat(Color(0.2, 0.6, 1.0, 0.7), 1.5, true)
			var pool := Util.cylinder(1.6, 0.08, w, Vector3(0, 0.05, 0))
			_visual.add_child(pool)
			_add_light(Color(0.2, 0.6, 1.0))


func _add_light(c: Color) -> void:
	var l := OmniLight3D.new()
	l.light_color = c
	l.omni_range = 5.0
	l.light_energy = 1.2
	l.position.y = 0.8
	add_child(l)


func _process(delta: float) -> void:
	_t += delta
	if kind != "water":
		_visual.rotation.y += delta * 0.8
		_visual.position.y = sin(_t * 2.0) * 0.08


func get_absorb_name() -> String:
	return display_name
