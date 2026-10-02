extends Area3D
## Projétil genérico: Lâmina d'Água e Fio Pegajoso.

const Util := preload("res://scripts/util.gd")

var direction := Vector3.FORWARD
var speed := 26.0
var damage := 25.0
var lifetime := 1.6
var root_time := 0.0  # > 0 prende o inimigo (Fio Pegajoso)
var color := Color(0.3, 0.7, 1.0)


func _ready() -> void:
	collision_layer = 0
	collision_mask = Util.LAYER_WORLD | Util.LAYER_ENEMY
	monitoring = true
	var shape := CollisionShape3D.new()
	var s := SphereShape3D.new()
	s.radius = 0.45
	shape.shape = s
	add_child(shape)

	var visual: MeshInstance3D
	if root_time > 0.0:
		visual = Util.sphere(0.25, Util.mat(Color(0.95, 0.95, 0.95), 1.5))
	else:
		# Lâmina d'água: disco achatado e brilhante
		visual = Util.sphere(0.5, Util.mat(Color(color, 0.75), 2.5, true))
		visual.scale = Vector3(1.4, 0.15, 0.6)
	add_child(visual)
	var light := OmniLight3D.new()
	light.light_color = color
	light.omni_range = 4.0
	light.light_energy = 1.5
	add_child(light)

	look_at(global_position + direction, Vector3.UP)
	body_entered.connect(_on_body_entered)


func _physics_process(delta: float) -> void:
	global_position += direction * speed * delta
	lifetime -= delta
	if lifetime <= 0.0:
		queue_free()


func _on_body_entered(body) -> void:
	if body.is_in_group("enemy"):
		if body.has_method("take_damage"):
			body.take_damage(damage)
		if root_time > 0.0 and body.has_method("apply_root"):
			body.apply_root(root_time)
	queue_free()
