extends Area2D
## Projétil usado por todos: Lâmina d'Água, fogo, veneno, fio, etc.

const Data := preload("res://scripts/data.gd")

var team := "player"          # "player" (acerta inimigos) ou "enemy" (acerta Rimuru e aliados)
var velocity := Vector2.ZERO
var damage := 10.0
var radius := 8.0
var color := Color(0.4, 0.8, 1.0)
var life := 1.5
var pierce := false
var element := ""             # water, fire, dark, poison, light
var status := ""              # root, stun, poison, burn
var status_time := 0.0
var style := "orb"            # orb, blade, thread, flame
var _hit := {}
var _t := 0.0


func _ready() -> void:
	collision_layer = 0
	if team == "player":
		collision_mask = Data.L_WORLD | Data.L_ENEMY
	else:
		collision_mask = Data.L_WORLD | Data.L_PLAYER | Data.L_ALLY
	var shape := CollisionShape2D.new()
	var c := CircleShape2D.new()
	c.radius = radius
	shape.shape = c
	add_child(shape)
	rotation = velocity.angle()
	body_entered.connect(_on_body)


func _physics_process(delta: float) -> void:
	_t += delta
	position += velocity * delta
	life -= delta
	if life <= 0.0:
		queue_free()
	queue_redraw()


func _on_body(body) -> void:
	if body is StaticBody2D:
		if style != "flame" or not pierce:
			queue_free()
		return
	if _hit.has(body.get_instance_id()):
		return
	var target_group := "enemy" if team == "player" else "friend"
	if not body.is_in_group(target_group):
		return
	_hit[body.get_instance_id()] = true
	body.take_damage(damage, element, global_position)
	if status != "" and body.has_method("apply_status"):
		body.apply_status(status, status_time)
	if not pierce:
		queue_free()


func _draw() -> void:
	match style:
		"blade":
			# meia-lua de água
			draw_arc(Vector2.ZERO, radius * 1.6, -1.2, 1.2, 12, Color(color, 0.9), radius * 0.7)
			draw_arc(Vector2.ZERO, radius * 1.6, -1.0, 1.0, 12, Color(1, 1, 1, 0.8), radius * 0.25)
		"thread":
			draw_line(Vector2(-radius * 3, 0), Vector2.ZERO, Color(1, 1, 1, 0.6), 2.0)
			draw_circle(Vector2.ZERO, radius, Color(0.95, 0.95, 0.95))
		"flame":
			var flick := 1.0 + sin(_t * 30.0) * 0.15
			draw_circle(Vector2.ZERO, radius * 1.3 * flick, Color(color, 0.35))
			draw_circle(Vector2.ZERO, radius * flick, color)
			draw_circle(Vector2(radius * 0.2, 0), radius * 0.5, Color(1, 1, 0.8, 0.9))
		_:
			draw_circle(Vector2.ZERO, radius * 1.4, Color(color, 0.3))
			draw_circle(Vector2.ZERO, radius, color)
			draw_circle(Vector2.ZERO, radius * 0.45, Color(1, 1, 1, 0.8))
