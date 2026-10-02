extends CharacterBody2D
## Rimuru Tempest: forma de slime ou humana, Predador e habilidades copiadas.

const Data := preload("res://scripts/data.gd")

var radius := 18.0
var max_hp := 100.0
var hp := 100.0
var max_mp := 100.0
var mp := 100.0
var mp_regen := 7.0
var dead := false
var human := false
var demon_lord := false
var skills := {}
var cooldowns := {}

var _main
var _invuln := 0.0
var _dash_t := 0.0
var _dash_dir := Vector2.ZERO
var _t := 0.0
var _squash := 0.0
var _hurt_t := 0.0
var _swing_t := 0.0
var _aim := Vector2.RIGHT
var _starved_t := 0.0


func _ready() -> void:
	_main = get_tree().current_scene
	add_to_group("player")
	add_to_group("friend")
	collision_layer = Data.L_PLAYER
	collision_mask = Data.L_WORLD | Data.L_ENEMY
	var shape := CollisionShape2D.new()
	var c := CircleShape2D.new()
	c.radius = radius
	shape.shape = c
	add_child(shape)
	z_index = 6
	for k in Data.SKILLS:
		cooldowns[k] = 0.0


func has_skill(id: String) -> bool:
	return skills.has(id)


func _unhandled_input(event: InputEvent) -> void:
	if dead:
		return
	if event.is_action_pressed("attack"):
		_cast("sword" if human else "water_blade")
	for id in ["poison_breath", "sticky_thread", "ultrasound", "black_lightning", "black_flame", "starved", "megiddo", "shadow_motion", "mimicry"]:
		if event.is_action_pressed(id):
			_cast(id)
	if event.is_action_pressed("devour"):
		_devour()
	elif event.is_action_pressed("interact"):
		_main.player_interact()


func _physics_process(delta: float) -> void:
	_t += delta
	_invuln = maxf(_invuln - delta, 0.0)
	_hurt_t = maxf(_hurt_t - delta, 0.0)
	_swing_t = maxf(_swing_t - delta, 0.0)
	for k in cooldowns:
		cooldowns[k] = maxf(cooldowns[k] - delta, 0.0)
	if not dead:
		mp = minf(mp + mp_regen * delta, max_mp)
		hp = minf(hp + (2.5 if demon_lord else 1.0) * delta, max_hp)
	_aim = (get_global_mouse_position() - global_position).normalized()
	if _aim == Vector2.ZERO:
		_aim = Vector2.RIGHT

	if _starved_t > 0.0:
		_starved_t -= delta
		# Faminto: corrói tudo ao redor e recupera vida
		for e in get_tree().get_nodes_in_group("enemy"):
			if e.global_position.distance_to(global_position) < 190.0:
				e.take_damage(40.0 * delta * (1.0 if e.is_boss else 1.5), "dark", global_position)
				hp = minf(hp + 6.0 * delta, max_hp)

	var input := Vector2.ZERO
	if not dead:
		input = Input.get_vector("move_left", "move_right", "move_up", "move_down")
	var speed := 230.0 if human else 200.0
	if _dash_t > 0.0:
		_dash_t -= delta
		velocity = _dash_dir * 900.0
	else:
		velocity = velocity.move_toward(input * speed, 2200.0 * delta)
	move_and_slide()
	_squash = lerpf(_squash, 0.0, minf(delta * 10.0, 1.0))
	queue_redraw()


func _cast(id: String) -> void:
	if not skills.has(id):
		if Data.SKILLS.has(id) and id != "sword" and id != "water_blade":
			_main.sage("Notificação: a habilidade [%s] ainda não foi adquirida." % Data.SKILLS[id].name)
		return
	var info: Dictionary = Data.SKILLS[id]
	if cooldowns[id] > 0.0:
		return
	if mp < info.mp:
		_main.sage("Notificação: magículas insuficientes.")
		return
	mp -= info.mp
	cooldowns[id] = info.cd
	_squash = 0.25
	var pos := global_position
	match id:
		"water_blade":
			_main.shoot("player", pos + _aim * 20.0, _aim * 620.0, 22.0 + (18.0 if demon_lord else 0.0),
				Color(0.35, 0.75, 1.0), {"element": "water", "style": "blade", "radius": 10.0, "pierce": true, "life": 0.8})
		"sword":
			_swing_t = 0.18
			_main.fx("slash", pos + _aim * 20.0, Color(0.8, 0.95, 1.0), 60.0, 0.18, _aim)
			for e in get_tree().get_nodes_in_group("enemy"):
				var to: Vector2 = e.global_position - pos
				if to.length() < 80.0 + e.data.r and _aim.dot(to.normalized()) > 0.2:
					e.take_damage(34.0 + (30.0 if demon_lord else 0.0), "", pos)
		"shadow_motion":
			var input := Input.get_vector("move_left", "move_right", "move_up", "move_down")
			_dash_dir = input.normalized() if input.length() > 0.1 else _aim
			_dash_t = 0.16
			_invuln = maxf(_invuln, 0.3)
			for i in 4:
				_main.fx("burst", pos + _dash_dir * i * 35.0, Color(0.15, 0.05, 0.3), 30.0, 0.35)
		"poison_breath":
			_main.fx("cone", pos, Color(0.5, 1.0, 0.25), 230.0, 0.5, _aim)
			for e in get_tree().get_nodes_in_group("enemy"):
				var to: Vector2 = e.global_position - pos
				if to.length() < 240.0 and _aim.dot(to.normalized()) > 0.8:
					e.take_damage(18.0, "poison", pos)
					e.apply_status("poison", 5.0)
		"sticky_thread":
			for i in 3:
				var dir := _aim.rotated((i - 1) * 0.15)
				_main.shoot("player", pos + dir * 20.0, dir * 520.0, 8.0, Color.WHITE,
					{"style": "thread", "status": "root", "status_time": 3.0, "radius": 6.0})
		"ultrasound":
			_main.fx("ring", pos, Color(0.85, 0.7, 1.0), 260.0, 0.5)
			_main.damage_area("player", pos, 230.0, 14.0, "", "stun", 3.0)
		"black_lightning":
			var targets := _enemies_sorted(pos, 520.0)
			for i in mini(targets.size(), 4):
				var e = targets[i]
				_main.fx("bolt", pos, Color(0.55, 0.3, 1.0), 0.0, 0.35, e.global_position - pos)
				e.take_damage(55.0, "dark", pos)
				e.apply_status("stun", 0.6)
			if targets.is_empty():
				_main.fx("bolt", pos, Color(0.55, 0.3, 1.0), 0.0, 0.35, _aim * 300.0)
		"black_flame":
			_main.shoot("player", pos + _aim * 24.0, _aim * 420.0, 45.0, Color(0.35, 0.1, 0.5),
				{"element": "fire", "style": "flame", "radius": 16.0, "pierce": true, "status": "burn", "status_time": 4.0, "life": 1.3})
		"starved":
			_starved_t = 3.0
			_main.fx("ring", pos, Color(0.6, 0.9, 0.1), 220.0, 0.8)
			_main.sage("Gula ativada: corroendo tudo ao redor!")
		"megiddo":
			var targets := _enemies_sorted(pos, 900.0)
			if targets.is_empty():
				_main.sage("Raphael: nenhum alvo para o Megiddo.")
				mp += info.mp
				cooldowns[id] = 0.0
				return
			for i in mini(targets.size(), 14):
				var e = targets[i]
				_main.fx("beam", e.global_position, Color(1, 1, 0.8), 0.0, 0.5)
				e.take_damage(110.0, "light", pos)
		"mimicry":
			human = not human
			radius = 18.0
			_main.fx("burst", pos, Color(0.5, 0.8, 1.0), 60.0, 0.4)
			_main.sage("Mimetismo: " + ("forma humana." if human else "forma de slime."))


func _enemies_sorted(pos: Vector2, max_d: float) -> Array:
	var list := []
	for e in get_tree().get_nodes_in_group("enemy"):
		if e.global_position.distance_to(pos) < max_d:
			list.append(e)
	list.sort_custom(func(a, b): return a.global_position.distance_to(pos) < b.global_position.distance_to(pos))
	return list


func _devour() -> void:
	if cooldowns["predator"] > 0.0:
		return
	cooldowns["predator"] = 0.4
	var reach := 130.0 if skills.has("beelzebub") else 80.0
	var best = null
	var best_d := INF
	for n in get_tree().get_nodes_in_group("absorbable"):
		var d: float = n.global_position.distance_to(global_position)
		var r = n.get("absorb_range")
		if d < (r if r != null else reach) and d < best_d:
			best = n
			best_d = d
	# Belzebu também devora inimigos comuns enfraquecidos
	if best == null and skills.has("beelzebub"):
		for e in get_tree().get_nodes_in_group("enemy"):
			var d: float = e.global_position.distance_to(global_position)
			if not e.is_boss and e.hp < e.max_hp * 0.35 and d < reach and d < best_d:
				best = e
				best_d = d
		if best != null:
			best.take_damage(99999.0)
	if best == null:
		_main.sage("Notificação: não há nada ao alcance do Predador.")
		return
	if not _main.can_devour(best):
		return
	best.remove_from_group("absorbable")
	_squash = -0.4
	_main.fx("ring", global_position, Color(0.4, 0.7, 1.0), 70.0, 0.35)
	var tw: Tween = best.create_tween()
	tw.set_parallel(true)
	tw.tween_property(best, "global_position", global_position, 0.3)
	tw.tween_property(best, "scale", Vector2.ONE * 0.05, 0.3)
	tw.chain().tween_callback(func():
		_main.on_devoured(best)
		if is_instance_valid(best):
			best.queue_free())


func take_damage(amount: float, _element := "", from := Vector2.ZERO) -> void:
	if dead or _invuln > 0.0:
		return
	if demon_lord:
		amount *= 0.6
	hp -= amount
	_invuln = 0.5
	_hurt_t = 0.15
	_main.fx("text", global_position + Vector2(0, -30), Color(1, 0.4, 0.4), 0, 0.6, Vector2.ZERO, str(int(amount)))
	var push := global_position - from
	if push.length() > 0.1:
		velocity += push.normalized() * 300.0
	if hp <= 0.0:
		hp = 0.0
		dead = true
		_main.on_player_died()


func heal(amount: float) -> void:
	hp = minf(hp + amount, max_hp)
	_main.fx("text", global_position + Vector2(0, -34), Color(0.4, 1, 0.5), 0, 0.8, Vector2.ZERO, "+" + str(int(amount)))


func _draw() -> void:
	var blink := _invuln > 0.0 and _dash_t <= 0.0 and int(_t * 20.0) % 2 == 0
	if blink:
		modulate.a = 0.5
	else:
		modulate.a = 1.0
	draw_circle(Vector2(0, 14), 16, Color(0, 0, 0, 0.25))
	if _starved_t > 0.0:
		draw_circle(Vector2.ZERO, 190.0, Color(0.5, 0.8, 0.1, 0.08 + sin(_t * 10) * 0.03))
		draw_arc(Vector2.ZERO, 190.0, 0, TAU, 64, Color(0.6, 0.9, 0.1, 0.5), 2.0)
	if demon_lord:
		draw_arc(Vector2.ZERO, 30.0 + sin(_t * 3.0) * 3.0, 0, TAU, 32, Color(0.4, 0.6, 1.0, 0.35), 3.0)
	if human:
		_draw_human()
	else:
		_draw_slime()


func _draw_slime() -> void:
	var wob := sin(_t * (14.0 if velocity.length() > 20.0 else 3.0)) * 0.06
	var sq := _squash + wob
	var body := Color(0.45, 0.78, 1.0) if _hurt_t <= 0.0 else Color(1, 0.5, 0.5)
	draw_set_transform(Vector2(0, 4), 0.0, Vector2(1.0 + sq, 1.0 - sq))
	var pts := PackedVector2Array()
	for i in 25:
		var a := PI + i * PI / 24.0
		pts.append(Vector2(cos(a) * 22.0, sin(a) * 20.0))
	pts.append(Vector2(22, 8))
	pts.append(Vector2(-22, 8))
	draw_colored_polygon(pts, Color(body, 0.9))
	draw_circle(Vector2(-8, -9), 5.0, Color(1, 1, 1, 0.55))  # brilho
	var look := _aim * 4.0
	draw_set_transform(Vector2(look.x, 4 + look.y * 0.5), 0.0, Vector2(1.0 + sq, 1.0 - sq))
	draw_rect(Rect2(-8, -6, 3, 8), Color(0.05, 0.08, 0.15))
	draw_rect(Rect2(5, -6, 3, 8), Color(0.05, 0.08, 0.15))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


func _draw_human() -> void:
	var face := 1.0 if _aim.x >= 0.0 else -1.0
	draw_set_transform(Vector2.ZERO, 0.0, Vector2(face, 1.0))
	var step := sin(_t * 12.0) * 4.0 if velocity.length() > 20.0 else 0.0
	var coat := Color(0.2, 0.2, 0.3) if not demon_lord else Color(0.08, 0.08, 0.12)
	draw_line(Vector2(-5, 8), Vector2(-5 + step, 20), Color(0.15, 0.15, 0.2), 5.0)
	draw_line(Vector2(5, 8), Vector2(5 - step, 20), Color(0.15, 0.15, 0.2), 5.0)
	draw_colored_polygon(PackedVector2Array([Vector2(-11, -6), Vector2(11, -6), Vector2(14, 12), Vector2(-14, 12)]),
		coat if _hurt_t <= 0.0 else Color(0.8, 0.3, 0.3))
	draw_rect(Rect2(-9, -6, 18, 4), Color(0.9, 0.9, 0.95))
	draw_circle(Vector2(0, -16), 10.0, Color(1.0, 0.88, 0.8))
	# cabelo azul-prateado comprido
	draw_arc(Vector2(0, -17), 10.5, PI * 0.85, TAU + 0.2, 16, Color(0.55, 0.75, 0.95), 6.0)
	draw_line(Vector2(-9, -16), Vector2(-11, 2), Color(0.55, 0.75, 0.95), 5.0)
	draw_circle(Vector2(5, -16), 2.2, Color(0.95, 0.75, 0.2))  # olho dourado
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	# espada
	var ang := _aim.angle()
	if _swing_t > 0.0:
		ang += (0.18 - _swing_t) * 12.0 - 1.0
	var hand := Vector2(10 * face, 2)
	draw_line(hand, hand + Vector2.from_angle(ang) * 34.0, Color(0.85, 0.9, 1.0), 3.0)
	draw_line(hand - Vector2.from_angle(ang + PI / 2) * 5, hand + Vector2.from_angle(ang + PI / 2) * 5, Color(0.4, 0.3, 0.2), 3.0)
