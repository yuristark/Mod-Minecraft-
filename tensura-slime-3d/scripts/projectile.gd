extends Area3D
## Projétil genérico do jogador (Lâmina d'Água, Fio Pegajoso, Chamas...) e dos inimigos.

const Util := preload("res://scripts/util.gd")
const Fx := preload("res://scripts/fx.gd")

var direction := Vector3.FORWARD
var speed := 26.0
var damage := 25.0
var lifetime := 1.6
var root_time := 0.0      # > 0 prende o inimigo (Fio Pegajoso)
var stun_time := 0.0
var poison_time := 0.0
var explode_radius := 0.0 # > 0 explode em área (Manipulação de Chamas)
var color := Color(0.3, 0.7, 1.0)
var faction := "player"   # "player" acerta inimigos; "enemy" acerta jogador e aliados
var style := "blade"      # blade | thread | orb | bullet
var size := 1.0
var _done := false


func _ready() -> void:
	collision_layer = 0
	if faction == "player":
		collision_mask = Util.LAYER_WORLD | Util.LAYER_ENEMY
	else:
		collision_mask = Util.LAYER_WORLD | Util.LAYER_PLAYER | Util.LAYER_ALLY
	monitoring = true
	var shape := CollisionShape3D.new()
	var s := SphereShape3D.new()
	s.radius = 0.45 * size
	shape.shape = s
	add_child(shape)

	if root_time > 0.0 and style == "blade":
		style = "thread"
	var visual: MeshInstance3D
	match style:
		"thread":
			visual = Util.sphere(0.25, Util.cmat(Color(0.95, 0.95, 0.95), 1.5))
		"orb":
			visual = Util.sphere(0.4 * size, Util.cmat(color, 4.0))
		"bullet":
			visual = Util.sphere(0.18 * size, Util.cmat(color, 5.0))
			visual.scale = Vector3(0.6, 0.6, 2.2)
		_:
			# Lâmina d'água: disco achatado e brilhante
			visual = Util.sphere(0.5, Util.mat(Color(color, 0.75), 2.5, true))
			visual.scale = Vector3(1.4, 0.15, 0.6)
	visual.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(visual)
	var light := OmniLight3D.new()
	light.light_color = color
	light.omni_range = 4.0
	light.light_energy = 1.5
	add_child(light)

	if direction.length() > 0.01:
		look_at(global_position + direction, Vector3.UP if absf(direction.normalized().y) < 0.99 else Vector3.FORWARD)
	body_entered.connect(_on_body_entered)


func _physics_process(delta: float) -> void:
	var scale_t := 1.0
	var main = get_tree().current_scene
	if faction == "enemy" and main and main.get("enemy_time_scale") != null:
		scale_t = main.enemy_time_scale
	global_position += direction * speed * delta * scale_t
	lifetime -= delta * scale_t
	if lifetime <= 0.0:
		queue_free()


func _on_body_entered(body) -> void:
	if _done:
		return
	if faction == "player":
		if body.is_in_group("enemy"):
			_hit_enemy(body)
	else:
		if body.is_in_group("player") or body.is_in_group("ally"):
			if body.has_method("take_damage"):
				body.take_damage(damage, global_position)
	if explode_radius > 0.0:
		_explode()
	_done = true
	Fx.burst(get_parent(), global_position, color, 12, 4.0, 0.25)
	queue_free()


func _hit_enemy(body) -> void:
	if body.has_method("take_damage"):
		body.take_damage(damage)
	if root_time > 0.0 and body.has_method("apply_root"):
		body.apply_root(root_time)
	if stun_time > 0.0 and body.has_method("apply_stun"):
		body.apply_stun(stun_time)
	if poison_time > 0.0 and body.has_method("apply_poison"):
		body.apply_poison(poison_time)


func _explode() -> void:
	var parent := get_parent()
	Fx.ring(parent, global_position, color, explode_radius, 0.35, 0.8)
	Fx.flash(parent, global_position, color, 6.0, explode_radius * 3.0)
	for e in get_tree().get_nodes_in_group("enemy"):
		if e.global_position.distance_to(global_position) < explode_radius + 0.5:
			e.take_damage(damage * 0.6)
