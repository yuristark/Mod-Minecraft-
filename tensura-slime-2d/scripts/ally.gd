extends CharacterBody2D
## Companheiros nomeados pelo Rimuru: seguem e lutam junto.
## Quando a vida acaba ficam "caídos" e se recuperam depois de alguns segundos.

const Data := preload("res://scripts/data.gd")

var type_id := "ranga"
var data: Dictionary
var radius := 18.0
var hp := 1.0
var max_hp := 1.0
var downed := false
var follow_index := 0

var _main
var _attack_cd := 0.0
var _special_cd := 3.0
var _down_t := 0.0
var _t := 0.0
var _facing := 1.0
var _swing := 0.0


func _ready() -> void:
	_main = get_tree().current_scene
	data = Data.ALLIES[type_id]
	radius = data.r
	max_hp = data.hp
	hp = max_hp
	_t = randf() * 5.0
	add_to_group("friend")
	add_to_group("ally")
	collision_layer = Data.L_ALLY
	collision_mask = Data.L_WORLD
	var shape := CollisionShape2D.new()
	var c := CircleShape2D.new()
	c.radius = radius
	shape.shape = c
	add_child(shape)
	z_index = 5


func _physics_process(delta: float) -> void:
	_t += delta
	_swing = maxf(_swing - delta, 0.0)
	queue_redraw()
	var player = _main.player
	if player == null:
		return
	if downed:
		_down_t -= delta
		if _down_t <= 0.0:
			downed = false
			hp = max_hp * 0.6
			_main.fx("ring", global_position, data.color, 50.0, 0.4)
		velocity = Vector2.ZERO
		return
	hp = minf(hp + 3.0 * delta, max_hp)
	_attack_cd = maxf(_attack_cd - delta, 0.0)
	_special_cd = maxf(_special_cd - delta, 0.0)

	var slot := Vector2.from_angle(PI * 0.75 + follow_index * 0.9) * (60.0 + follow_index * 12.0)
	var home: Vector2 = player.global_position + slot
	var target = _find_enemy(player.global_position)
	var goal := home
	var range_d := 260.0 if data.ranged else radius + 30.0
	if target != null:
		var d: float = target.global_position.distance_to(global_position)
		if d > range_d * 0.8:
			goal = target.global_position
		else:
			goal = global_position
		_facing = signf(target.global_position.x - global_position.x)
		if d <= range_d and _attack_cd <= 0.0:
			_attack(target)
		if _special_cd <= 0.0 and d < 420.0:
			_special(target)
	if global_position.distance_to(player.global_position) > 900.0:
		global_position = home  # alcança o Rimuru se ficar muito longe
	var to := goal - global_position
	if to.length() > 8.0:
		velocity = to.normalized() * data.speed * (1.0 if to.length() > 40.0 else 0.4)
		if target == null:
			_facing = signf(to.x) if absf(to.x) > 2.0 else _facing
	else:
		velocity = Vector2.ZERO
	move_and_slide()


func _find_enemy(center: Vector2):
	var best = null
	var best_d := 480.0
	for e in get_tree().get_nodes_in_group("enemy"):
		var d: float = e.global_position.distance_to(center)
		if d < best_d:
			best = e
			best_d = d
	return best


func _attack(target) -> void:
	_attack_cd = 0.9
	_swing = 0.2
	if data.ranged:
		var dir: Vector2 = (target.global_position - global_position).normalized()
		var col: Color = data.color.lightened(0.3)
		var el := "fire" if type_id == "benimaru" else ""
		_main.shoot("player", global_position, dir * 480.0, data.dmg, col, {"element": el})
	else:
		target.take_damage(data.dmg, "", global_position)
		_main.fx("slash", global_position, data.color.lightened(0.4), 40.0, 0.15, target.global_position - global_position)


func _special(target) -> void:
	match data.special:
		"black_lightning":
			_special_cd = data.cd
			for e in get_tree().get_nodes_in_group("enemy"):
				if e.global_position.distance_to(target.global_position) < 140.0:
					_main.fx("bolt", e.global_position + Vector2(0, -500), Color(0.5, 0.3, 1.0), 0.0, 0.35, Vector2(0, 500))
					e.take_damage(45.0, "dark", global_position)
		"hell_flare":
			_special_cd = data.cd
			var c: Vector2 = target.global_position
			_main.fx("warn", c, Color(1, 0.3, 0.1), 120.0, 0.5)
			var tw := create_tween()
			tw.tween_interval(0.5)
			tw.tween_callback(func():
				_main.fx("burst", c, Color(0.9, 0.2, 0.05), 150.0, 0.6)
				_main.damage_area("player", c, 130.0, 70.0, "fire", "burn", 3.0))
		"big_slash":
			_special_cd = data.cd
			_main.fx("slash", global_position, Color(0.75, 0.5, 1.0), 110.0, 0.25, target.global_position - global_position)
			_main.damage_area("player", global_position, 120.0, 60.0, "", "stun", 0.8)
		"heal":
			_special_cd = data.cd
			var p = _main.player
			if p.hp < p.max_hp * 0.85:
				p.heal(30.0)
				_main.fx("ring", p.global_position, Color(0.5, 1.0, 0.6), 60.0, 0.5)
			for a in get_tree().get_nodes_in_group("ally"):
				a.hp = minf(a.hp + 40.0, a.max_hp)
		"storm":
			_special_cd = data.cd
			_main.fx("ring", global_position, Color(1.0, 0.85, 0.3), 320.0, 0.6)
			_main.damage_area("player", global_position, 300.0, 90.0, "", "stun", 1.0)
			_main.fx("text", global_position + Vector2(0, -40), Color(1, 0.9, 0.4), 0, 1.0, Vector2.ZERO, "KUAHAHAHA!")


func take_damage(amount: float, _element := "", _from := Vector2.ZERO) -> void:
	if downed:
		return
	hp -= amount
	if hp <= 0.0:
		downed = true
		_down_t = 8.0
		_main.fx("text", global_position + Vector2(0, -30), Color(1, 0.6, 0.6), 0, 1.0, Vector2.ZERO, data.name + " caiu!")


func _draw() -> void:
	var c: Color = data.color
	modulate.a = 0.4 if downed else 1.0
	draw_circle(Vector2(0, radius * 0.8), radius * 0.8, Color(0, 0, 0, 0.25))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2(_facing, 1.0))
	var r := radius
	match type_id:
		"ranga":
			# Lobo da Tempestade negro com chifre
			draw_rect(Rect2(-r, -r * 0.5, r * 1.8, r), c)
			draw_circle(Vector2(r * 0.9, -r * 0.5), r * 0.55, c)
			draw_rect(Rect2(r * 1.2, -r * 0.55, r * 0.5, r * 0.3), c)
			draw_line(Vector2(r * 0.9, -r), Vector2(r * 1.1, -r * 1.6), Color(0.8, 0.85, 1.0), 4.0)
			draw_circle(Vector2(r * 1.05, -r * 0.65), 3.0, Color(1, 0.85, 0.1))
			var leg := sin(_t * 14.0) * r * 0.25 if velocity.length() > 10.0 else 0.0
			for x in [-r * 0.8, -r * 0.4, r * 0.3, r * 0.7]:
				draw_line(Vector2(x, r * 0.4), Vector2(x + leg, r * 0.95), c, 5.0)
			draw_line(Vector2(-r, -r * 0.3), Vector2(-r * 1.7, -r * 0.9 + sin(_t * 8) * 4), c, 5.0)
		"veldora":
			_humanoid(r, Color(1.0, 0.88, 0.8), Color(0.95, 0.8, 0.3), Color(0.15, 0.15, 0.2))
			draw_circle(Vector2.ZERO, r * 1.6 + sin(_t * 3) * 3, Color(1, 0.85, 0.3, 0.12))
		"benimaru":
			_humanoid(r, Color(1.0, 0.88, 0.8), Color(0.85, 0.1, 0.1), Color(0.15, 0.12, 0.12))
			_horn(r, Color(0.2, 0.15, 0.15))
		"shion":
			_humanoid(r, Color(1.0, 0.88, 0.8), Color(0.5, 0.3, 0.7), Color(0.25, 0.25, 0.3))
			_horn(r, Color(0.2, 0.15, 0.2))
			draw_line(Vector2(r * 0.6, 0), Vector2(r * 1.8, -r * 1.4) if _swing <= 0.0 else Vector2(r * 2.2, r * 0.2), Color(0.6, 0.6, 0.7), 5.0)
		"shuna":
			_humanoid(r, Color(1.0, 0.9, 0.85), Color(1.0, 0.72, 0.82), Color(0.95, 0.95, 1.0))
			_horn(r, Color(0.95, 0.95, 0.9))
		"gobta":
			_humanoid(r, Color(0.5, 0.75, 0.4), Color(0.3, 0.3, 0.3), Color(0.5, 0.4, 0.3))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	draw_string(ThemeDB.fallback_font, Vector2(-50, -r * 2.0 - 6), data.name, HORIZONTAL_ALIGNMENT_CENTER, 100, 11, Color(0.8, 0.95, 1.0, 0.85))
	if hp < max_hp and not downed:
		draw_rect(Rect2(-r, -r * 2.0, r * 2, 3), Color(0, 0, 0, 0.6))
		draw_rect(Rect2(-r, -r * 2.0, r * 2 * hp / max_hp, 3), Color(0.4, 1, 0.5))


func _humanoid(r: float, skin: Color, hair: Color, cloth: Color) -> void:
	var step := sin(_t * 12.0) * r * 0.25 if velocity.length() > 10.0 else 0.0
	draw_line(Vector2(-r * 0.3, r * 0.4), Vector2(-r * 0.3 + step, r * 1.1), cloth.darkened(0.3), 4.0)
	draw_line(Vector2(r * 0.3, r * 0.4), Vector2(r * 0.3 - step, r * 1.1), cloth.darkened(0.3), 4.0)
	draw_colored_polygon(PackedVector2Array([Vector2(-r * 0.6, -r * 0.4), Vector2(r * 0.6, -r * 0.4), Vector2(r * 0.8, r * 0.6), Vector2(-r * 0.8, r * 0.6)]), cloth)
	draw_circle(Vector2(0, -r * 0.95), r * 0.55, skin)
	draw_arc(Vector2(0, -r * 1.0), r * 0.58, PI * 0.9, TAU + 0.1, 14, hair, r * 0.3)
	draw_line(Vector2(-r * 0.5, -r), Vector2(-r * 0.7, r * 0.2), hair, r * 0.25)
	draw_circle(Vector2(r * 0.25, -r * 0.95), 2.2, Color(0.15, 0.1, 0.1))


func _horn(r: float, c: Color) -> void:
	draw_colored_polygon(PackedVector2Array([Vector2(-r * 0.15, -r * 1.45), Vector2(0, -r * 2.0), Vector2(r * 0.15, -r * 1.45)]), c)
