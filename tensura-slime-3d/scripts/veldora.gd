extends Node3D
## Veldora, o Dragão da Tempestade, preso pela "Prisão Infinita".

const Util := preload("res://scripts/util.gd")
const Models := preload("res://scripts/models.gd")

var absorb_range := 9.0
var talk_range := 10.0
var _dragon: Node3D
var _seal: MeshInstance3D
var _t := 0.0


func _ready() -> void:
	add_to_group("absorbable")
	_dragon = Node3D.new()
	add_child(_dragon)
	if Models.has_blender_model("veldora_dragon"):
		# modelo do Blender (com animação de respiração e asas)
		_dragon.add_child(Models.build({"scale": 1.15}, "veldora_dragon"))
	else:
		var scale_mat := Util.mat(Color(0.12, 0.12, 0.18), 0.0, false, 0.3)
		var belly := Util.mat(Color(0.3, 0.3, 0.38))
		var gold := Util.mat(Color(1.0, 0.8, 0.2), 4.0)

		_dragon.add_child(Util.sphere(2.2, scale_mat, Vector3(0, 2.4, 0)))           # corpo
		_dragon.add_child(Util.sphere(1.6, belly, Vector3(0, 2.2, -1.0)))            # barriga
		var neck := Util.cylinder(0.8, 3.0, scale_mat, Vector3(0, 4.6, -1.6))
		neck.rotation.x = -0.6
		_dragon.add_child(neck)
		var head := Util.box(Vector3(1.6, 1.3, 2.4), scale_mat, Vector3(0, 6.0, -2.8))
		_dragon.add_child(head)
		_dragon.add_child(Util.box(Vector3(1.1, 0.7, 1.4), scale_mat, Vector3(0, 5.7, -4.3)))  # focinho
		for x in [-0.5, 0.5]:
			_dragon.add_child(Util.sphere(0.2, gold, Vector3(x, 6.3, -3.9)))          # olhos
			var horn := Util.cone(0.25, 1.6, Util.mat(Color(0.8, 0.75, 0.6)), Vector3(x * 1.2, 7.2, -2.3))
			horn.rotation.x = 0.7
			horn.rotation.z = -x * 0.6
			_dragon.add_child(horn)
		for side in [-1, 1]:
			var wing := Util.box(Vector3(5.0, 0.15, 3.0), Util.mat(Color(0.18, 0.15, 0.3)), Vector3(side * 3.8, 4.2, 0.6))
			wing.rotation.z = side * 0.5
			_dragon.add_child(wing)
			for z in [-1.0, 1.0]:
				_dragon.add_child(Util.box(Vector3(0.7, 1.4, 0.7), scale_mat, Vector3(side * 1.3, 0.7, z)))
		for i in 5:
			_dragon.add_child(Util.sphere(0.9 - i * 0.15, scale_mat, Vector3(0, 1.0 + i * 0.05, 2.2 + i * 1.0)))

	# Selo da Prisão Infinita: esfera translúcida brilhante
	_seal = Util.sphere(5.6, Util.mat(Color(0.95, 0.85, 0.4, 0.18), 1.2, true), Vector3(0, 3.6, -0.6))
	add_child(_seal)

	var light := OmniLight3D.new()
	light.light_color = Color(1.0, 0.85, 0.5)
	light.omni_range = 16.0
	light.light_energy = 2.0
	light.position = Vector3(0, 5, 0)
	add_child(light)

	var label := Label3D.new()
	label.text = "Veldora, o Dragão da Tempestade"
	label.name = "Label"
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.position.y = 10.0
	label.font_size = 56
	label.pixel_size = 0.01
	label.outline_size = 10
	label.modulate = Color(1.0, 0.9, 0.5)
	add_child(label)


func set_label(text: String) -> void:
	($Label as Label3D).text = text


func _process(delta: float) -> void:
	_t += delta
	_seal.rotation.y += delta * 0.3
	var pulse := 1.0 + sin(_t * 2.0) * 0.02
	_seal.scale = Vector3.ONE * pulse
	_dragon.position.y = sin(_t * 0.8) * 0.1


func get_absorb_name() -> String:
	return "Veldora"
