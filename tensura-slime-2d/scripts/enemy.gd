extends CharacterBody2D
## Monstros e chefes. Ao morrer, os que podem ser devorados viram corpos
## que o Rimuru come com o Predador para copiar habilidades.

const Data := preload("res://scripts/data.gd")

var type_id := "spider"
var data: Dictionary
var hp := 1.0
var max_hp := 1.0
var dead := false
var is_boss := false
var tag := ""  # "wave" para inimigos de ondas
var hp_mult := 1.0   # escala do Labirinto Infinito
var dmg_mult := 1.0
var xp := 0.0
var _dmg := 10.0
var radius := 18.0

var _main
var _attack_cd := 0.0
var _pattern_cd := 2.0
var _pattern_i := 0
var _stun := 0.0
var _root := 0.0
var _poison := 0.0
var _burn := 0.0
var _flash := 0.0
var _charge_time := 0.0
var _charge_dir := Vector2.ZERO
var _wander := Vector2.ZERO
var _wander_t := 0.0
var _t := 0.0
var _home := Vector2.ZERO
var _corpse_t := 0.0
var _facing := 1.0


func _ready() -> void:
	_main = get_tree().current_scene
	data = Data.ENEMIES[type_id]
	max_hp = data.hp * hp_mult
	_dmg = data.dmg * dmg_mult
	xp = (data.hp / 8.0) * (3.0 if data.ai == "boss" else 1.0) * sqrt(hp_mult)
	hp = max_hp
	radius = data.r
	is_boss = data.ai == "boss"
	_home = global_position
	_t = randf() * 10.0
	add_to_group("enemy")
	collision_layer = Data.L_ENEMY
	collision_mask = Data.L_WORLD | Data.L_ENEMY
	if data.ai == "flyer":
		collision_mask = 0
	var shape := CollisionShape2D.new()
	var c := CircleShape2D.new()
	c.radius = data.r
	shape.shape = c
	add_child(shape)
	z_index = 5


func _physics_process(delta: float) -> void:
	_t += delta
	queue_redraw()
	if dead:
		_corpse_t += delta
		if _corpse_t > 40.0 and not is_boss:
			queue_free()
		return
	_attack_cd = maxf(_attack_cd - delta, 0.0)
	_stun = maxf(_stun - delta, 0.0)
	_root = maxf(_root - delta, 0.0)
	_flash = maxf(_flash - delta, 0.0)
	if _poison > 0.0:
		_poison -= delta
		_hurt(10.0 * delta)
	if _burn > 0.0:
		_burn -= delta
		_hurt(14.0 * delta)
	if dead:
		return

	var target = _find_target()
	var speed: float = data.speed
	if _stun > 0.0 or _root > 0.0:
		speed = 0.0
	elif _poison > 0.0:
		speed *= 0.6

	var move := Vector2.ZERO
	if _charge_time > 0.0:
		_charge_time -= delta
		move = _charge_dir * 3.2
		if _stun > 0.0 or _root > 0.0:
			_charge_time = 0.0
	elif target != null:
		var to: Vector2 = target.global_position - global_position
		var dist := to.length()
		_facing = signf(to.x) if absf(to.x) > 2.0 else _facing
		match data.ai:
			"ranged":
				if dist > 320.0:
					move = to.normalized()
				elif dist < 200.0:
					move = -to.normalized() * 0.7
				if _attack_cd <= 0.0 and dist < 480.0 and speed > 0.0:
					_attack_cd = 1.8
					_main.shoot("enemy", global_position, to.normalized() * 260.0, _dmg,
						data.get("shot", Color(1, 0.5, 0.2)), {"element": data.get("element", "")})
			"charger":
				move = to.normalized()
				if _attack_cd <= 0.0 and dist < 220.0 and dist > 60.0 and speed > 0.0:
					_attack_cd = 2.5
					_charge_dir = to.normalized()
					_charge_time = 0.35
			"boss":
				move = to.normalized() * (0.6 if dist > 90.0 else 0.0)
				_boss_patterns(delta, target, to)
			_:
				move = to.normalized() if dist > data.r + 18.0 else Vector2.ZERO
		# dano de contato
		if dist < data.r + target.get("radius") + 8.0 and _attack_cd <= 0.0 and speed > 0.0 and data.ai != "ranged":
			_attack_cd = 1.1
			target.take_damage(_dmg, data.get("element", ""), global_position)
	else:
		_wander_t -= delta
		if _wander_t <= 0.0:
			_wander_t = randf_range(1.5, 3.5)
			_wander = _home + Vector2(randf_range(-120, 120), randf_range(-120, 120))
		var tw := _wander - global_position
		if tw.length() > 10.0:
			move = tw.normalized() * 0.4

	velocity = move * speed
	move_and_slide()


func _find_target():
	var aggro := 2000.0 if (is_boss or tag == "wave") else 340.0
	var best = null
	var best_d := aggro
	for f in get_tree().get_nodes_in_group("friend"):
		if f.get("downed") or f.get("dead"):
			continue
		var d: float = f.global_position.distance_to(global_position)
		if f.is_in_group("player"):
			d *= 0.8  # preferem o Rimuru
		if d < best_d:
			best = f
			best_d = d
	return best


func _boss_patterns(delta: float, target, to: Vector2) -> void:
	_pattern_cd -= delta
	if _pattern_cd > 0.0 or _stun > 0.0:
		return
	var enraged := hp < max_hp * 0.5
	_pattern_cd = 1.6 if enraged else 2.4
	var patterns: Array = data.patterns
	var p: String = patterns[_pattern_i % patterns.size()]
	_pattern_i += 1
	var shot: Color = data.get("shot", Color(1, 0.5, 0.2))
	var el: String = data.get("element", "")
	match p:
		"radial":
			var n := 16 if enraged else 12
			var off := randf() * TAU
			for i in n:
				var dir := Vector2.from_angle(off + i * TAU / n)
				_main.shoot("enemy", global_position, dir * 220.0, _dmg * 0.7, shot, {"element": el, "radius": 10.0})
		"volley":
			var base := to.angle()
			for i in 5:
				var dir := Vector2.from_angle(base + (i - 2) * 0.18)
				_main.shoot("enemy", global_position, dir * 320.0, _dmg * 0.8, shot, {"element": el})
		"charge":
			_charge_dir = to.normalized()
			_charge_time = 0.6
			_main.fx("ring", global_position, Color(1, 0.3, 0.3), data.r * 2.0, 0.3)
		"summon":
			if get_tree().get_nodes_in_group("enemy").size() < 14:
				for i in (3 if enraged else 2):
					var pos: Vector2 = global_position + Vector2.from_angle(randf() * TAU) * (data.r + 50.0)
					_main.spawn_enemy(data.minion, pos, "minion")
				_main.fx("ring", global_position, shot, 120.0, 0.5)
		"nova":
			# Aviso no chão e explosão depois de 0.9s
			var center: Vector2 = target.global_position
			_main.fx("warn", center, Color(1, 0.2, 0.2), 110.0, 0.9)
			var tw := create_tween()
			tw.tween_interval(0.9)
			tw.tween_callback(func():
				if not dead:
					_main.fx("burst", center, shot, 130.0, 0.4)
					_main.damage_area("enemy", center, 110.0, _dmg * 1.6, el, "", 0.0))
		"regen":
			hp = minf(hp + max_hp * 0.05, max_hp)
			_main.fx("ring", global_position, Color(0.4, 1.0, 0.4), 90.0, 0.6)
			_main.fx("text", global_position + Vector2(0, -50), Color(0.4, 1, 0.4), 0, 0.9, Vector2.ZERO, "Regeneração!")


func take_damage(amount: float, element := "", _from := Vector2.ZERO) -> void:
	if dead:
		return
	amount *= _main.power_mult()
	if element != "" and data.get("weak", "") == element:
		amount *= 2.0
	if element == "fire" and data.get("element", "") == "fire":
		amount *= 0.3
	_flash = 0.1
	_main.fx("text", global_position + Vector2(randf_range(-10, 10), -data.r - 10), Color(1, 1, 0.6), 0, 0.6, Vector2.ZERO, str(int(amount)))
	_hurt(amount)


func _hurt(amount: float) -> void:
	if dead:
		return
	hp -= amount
	if hp <= 0.0:
		_die()


func apply_status(kind: String, t: float) -> void:
	match kind:
		"root": _root = maxf(_root, t * (0.4 if is_boss else 1.0))
		"stun": _stun = maxf(_stun, t * (0.4 if is_boss else 1.0))
		"poison": _poison = maxf(_poison, t)
		"burn": _burn = maxf(_burn, t)


func can_be_devoured() -> bool:
	return dead and not data.get("spare", false)


func _die() -> void:
	dead = true
	hp = 0.0
	velocity = Vector2.ZERO
	remove_from_group("enemy")
	collision_layer = 0
	collision_mask = 0
	if can_be_devoured():
		add_to_group("absorbable")
	else:
		var tw := create_tween()
		tw.tween_property(self, "modulate:a", 0.0, 0.6)
		tw.tween_callback(queue_free)
	_main.on_enemy_died(self)


func get_absorb_name() -> String:
	return data.name


## Desenho de cada monstro só com formas simples.
func _draw() -> void:
	var r: float = data.r
	var c: Color = data.color
	if dead:
		c = c.lerp(Color(0.4, 0.45, 0.6), 0.6)
	elif _flash > 0.0:
		c = Color(1, 1, 1)
	var bob := sin(_t * 8.0) * 2.0 if not dead else 0.0
	draw_set_transform(Vector2(0, bob), 0.0, Vector2(_facing, 0.55 if dead else 1.0))
	draw_circle(Vector2(0, r * 0.8), r * 0.9, Color(0, 0, 0, 0.25))  # sombra
	var eye := Color(1, 0.2, 0.1)
	match type_id:
		"spider":
			for i in 4:
				var a := 0.5 + i * 0.25
				for s in [-1, 1]:
					draw_line(Vector2.ZERO, Vector2(s * r * 1.6, r * (a - 0.4) + sin(_t * 12 + i) * 3), c.darkened(0.2), 3.0)
			draw_circle(Vector2(-r * 0.3, 0), r * 0.75, c)
			draw_circle(Vector2(r * 0.55, -r * 0.1), r * 0.45, c)
			for i in 3:
				draw_circle(Vector2(r * 0.75, -r * 0.25 + i * 0.12 * r), 2.5, eye)
		"bat":
			var flap := sin(_t * 18.0) * r * 0.6
			draw_colored_polygon(PackedVector2Array([Vector2(0, 0), Vector2(-r * 2.2, -r * 0.4 - flap), Vector2(-r * 1.2, r * 0.4)]), c.darkened(0.3))
			draw_colored_polygon(PackedVector2Array([Vector2(0, 0), Vector2(r * 2.2, -r * 0.4 - flap), Vector2(r * 1.2, r * 0.4)]), c.darkened(0.3))
			draw_circle(Vector2.ZERO, r * 0.7, c)
			draw_circle(Vector2(r * 0.25, -r * 0.15), 2.5, eye)
			draw_circle(Vector2(-r * 0.05, -r * 0.15), 2.5, eye)
		"serpent", "salamander":
			for i in 5:
				var off := Vector2(-i * r * 0.55, sin(_t * 5.0 + i) * r * 0.3)
				draw_circle(off, r * (0.8 - i * 0.1), c if i % 2 == 0 else c.darkened(0.15))
			draw_circle(Vector2(r * 0.4, -r * 0.2), 3.0, eye if type_id == "serpent" else Color(1, 1, 0.3))
			if type_id == "salamander":
				draw_circle(Vector2(-r * 2.2, 0), r * 0.5 + sin(_t * 20) * 2, Color(1, 0.8, 0.2, 0.7))
		"lizard", "orc", "orc_general", "ogre", "knight", "puppet", "holy_knight", "challenger", "imperial":
			_draw_humanoid(r, c)
		"imperial_tank":
			draw_rect(Rect2(-r, -r * 0.5, r * 2, r), c)
			draw_rect(Rect2(-r * 0.5, -r * 0.9, r, r * 0.5), c.lightened(0.1))
			draw_line(Vector2(0, -r * 0.65), Vector2(r * 1.5, -r * 0.65), c.darkened(0.3), 6.0)
			for i in 4:
				draw_circle(Vector2(-r * 0.75 + i * r * 0.5, r * 0.5), r * 0.2, Color(0.15, 0.15, 0.15))
		"angel":
			var flap2 := sin(_t * 10.0) * 6.0
			for s2 in [-1, 1]:
				draw_colored_polygon(PackedVector2Array([Vector2(0, -r * 0.3), Vector2(s2 * r * 1.8, -r * 1.2 - flap2), Vector2(s2 * r * 1.2, r * 0.3)]), Color(1, 1, 1, 0.85))
			_draw_humanoid(r, Color(1.0, 0.92, 0.85), Color(1.0, 0.9, 0.5), Color(0.95, 0.95, 1.0))
			draw_arc(Vector2(0, -r * 1.6), r * 0.4, 0, TAU, 16, Color(1, 0.9, 0.4), 2.0)
		"hinata":
			_draw_humanoid(r, Color(1.0, 0.9, 0.85), Color(0.12, 0.1, 0.12), Color(0.9, 0.92, 1.0))
			draw_line(Vector2(r * 0.6, 0), Vector2(r * 1.8, -r * 0.6), Color(0.7, 0.9, 1.0), 3.0)
		"masayuki":
			_draw_humanoid(r, Color(1.0, 0.9, 0.82), Color(0.98, 0.85, 0.35), Color(0.3, 0.4, 0.8))
			draw_circle(Vector2.ZERO, r * 1.5 + sin(_t * 5) * 3, Color(1, 0.9, 0.4, 0.1))  # aura de herói
		"kondo":
			_draw_humanoid(r, Color(0.95, 0.85, 0.75), Color(0.1, 0.1, 0.1), Color(0.25, 0.3, 0.22))
			draw_line(Vector2(r * 0.6, -r * 0.1), Vector2(r * 1.6, -r * 0.1), Color(0.2, 0.2, 0.2), 4.0)
		"yuuki":
			_draw_humanoid(r, Color(1.0, 0.9, 0.85), Color(0.12, 0.12, 0.15), Color(0.15, 0.15, 0.25))
			draw_circle(Vector2.ZERO, r * 1.6 + sin(_t * 6) * 4, Color(0.8, 0.1, 0.25, 0.12))
		"direwolf", "direwolf_boss":
			draw_rect(Rect2(-r, -r * 0.5, r * 1.8, r), c)
			draw_circle(Vector2(r * 0.9, -r * 0.5), r * 0.5, c)
			draw_colored_polygon(PackedVector2Array([Vector2(r * 0.7, -r * 0.9), Vector2(r * 0.85, -r * 1.3), Vector2(r, -r * 0.9)]), c)
			draw_rect(Rect2(r * 1.2, -r * 0.55, r * 0.5, r * 0.3), c)
			draw_circle(Vector2(r * 1.05, -r * 0.6), 3.0, Color(1, 0.85, 0.1))
			var leg := sin(_t * 14.0) * r * 0.2
			for x in [-r * 0.8, -r * 0.4, r * 0.3, r * 0.7]:
				draw_line(Vector2(x, r * 0.4), Vector2(x + leg, r * 0.95), c, 4.0)
			draw_line(Vector2(-r, -r * 0.3), Vector2(-r * 1.6, -r * 0.8), c, 4.0)
			if type_id == "direwolf_boss":
				draw_circle(Vector2(r * 0.95, -r * 0.85), 4.0, Color(0.9, 0.9, 1.0))  # estrela na testa
		"ifrit":
			var fl := sin(_t * 10.0) * 4.0
			draw_circle(Vector2(0, 0), r * 1.3 + fl, Color(1, 0.3, 0.05, 0.3))
			draw_colored_polygon(PackedVector2Array([Vector2(-r * 0.8, r), Vector2(0, -r * 1.6 - fl), Vector2(r * 0.8, r)]), Color(1, 0.5, 0.1))
			draw_circle(Vector2(0, -r * 0.4), r * 0.55, Color(1, 0.8, 0.3))
			draw_circle(Vector2(r * 0.2, -r * 0.5), 4.0, Color(1, 1, 1))
			draw_circle(Vector2(-r * 0.15, -r * 0.5), 4.0, Color(1, 1, 1))
			for s in [-1, 1]:
				draw_line(Vector2(s * r * 0.6, -r * 0.1), Vector2(s * r * 1.4, -r * 0.6 + fl), Color(1, 0.6, 0.1), 6.0)
		"benimaru_boss":
			_draw_humanoid(r, Color(0.9, 0.85, 0.8), Color(0.85, 0.1, 0.1), Color(0.25, 0.25, 0.3))
			draw_colored_polygon(PackedVector2Array([Vector2(-r * 0.3, -r * 1.5), Vector2(-r * 0.15, -r * 2.0), Vector2(0, -r * 1.5)]), Color(0.95, 0.9, 0.8))
		"orc_lord":
			_draw_humanoid(r, c, Color(0.15, 0.1, 0.1), Color(0.5, 0.15, 0.15))
			draw_circle(Vector2.ZERO, r * 1.4 + sin(_t * 4.0) * 4.0, Color(0.6, 0.9, 0.1, 0.12))  # aura de fome
			draw_line(Vector2(r * 0.8, -r * 0.2), Vector2(r * 1.6, -r * 1.4), Color(0.6, 0.6, 0.6), 7.0)
		"mage":
			draw_colored_polygon(PackedVector2Array([Vector2(-r * 0.8, r), Vector2(0, -r * 0.4), Vector2(r * 0.8, r)]), c)
			draw_circle(Vector2(0, -r * 0.6), r * 0.45, Color(0.95, 0.8, 0.7))
			draw_colored_polygon(PackedVector2Array([Vector2(-r * 0.6, -r * 0.8), Vector2(0, -r * 1.8), Vector2(r * 0.6, -r * 0.8)]), c.darkened(0.3))
			draw_line(Vector2(r * 0.7, r), Vector2(r * 0.9, -r * 1.2), Color(0.5, 0.35, 0.2), 3.0)
			draw_circle(Vector2(r * 0.9, -r * 1.3), 5.0, Color(1, 1, 0.6))
		"shogo":
			_draw_humanoid(r, Color(0.95, 0.8, 0.65), Color(0.2, 0.15, 0.1), Color(0.3, 0.3, 0.45))
		"clayman":
			_draw_humanoid(r, Color(0.95, 0.9, 0.95), Color(0.85, 0.7, 0.95), Color(0.4, 0.2, 0.5))
			draw_rect(Rect2(-r * 0.25, -r * 1.3, r * 0.5, r * 0.15), Color(0.2, 0.0, 0.3))  # máscara
			for i in 3:
				var a := _t * 1.5 + i * TAU / 3.0
				draw_line(Vector2(0, -r), Vector2.from_angle(a) * r * 2.0, Color(0.9, 0.5, 1.0, 0.4), 1.0)  # fios de marionete
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	if dead:
		if can_be_devoured():
			draw_string(ThemeDB.fallback_font, Vector2(-60, -r - 14), "[E] devorar", HORIZONTAL_ALIGNMENT_CENTER, 120, 12, Color(0.7, 0.9, 1.0))
		return
	# barra de vida
	if not is_boss and hp < max_hp:
		draw_rect(Rect2(-r, -r * 1.6 - 10, r * 2, 4), Color(0, 0, 0, 0.6))
		draw_rect(Rect2(-r, -r * 1.6 - 10, r * 2 * hp / max_hp, 4), Color(1, 0.3, 0.3))
	if _stun > 0.0:
		draw_string(ThemeDB.fallback_font, Vector2(-20, -r * 1.6 - 14), "zZ", HORIZONTAL_ALIGNMENT_CENTER, 40, 14, Color(1, 1, 0.4))
	if _root > 0.0:
		draw_arc(Vector2.ZERO, r + 4, 0, TAU, 16, Color(1, 1, 1, 0.8), 2.0)
	if _poison > 0.0:
		draw_circle(Vector2(0, -r - 4), 4, Color(0.5, 1, 0.3, 0.8))
	if _burn > 0.0:
		draw_circle(Vector2(4, -r - 4), 4, Color(1, 0.5, 0.1, 0.8))


func _draw_humanoid(r: float, skin: Color, hair := Color(-1, 0, 0), cloth := Color(-1, 0, 0)) -> void:
	if hair.r < 0.0:
		hair = skin.darkened(0.4)
	if cloth.r < 0.0:
		cloth = skin.darkened(0.25)
	var step := sin(_t * 10.0) * r * 0.2
	draw_line(Vector2(-r * 0.3, r * 0.4), Vector2(-r * 0.3 + step, r), cloth.darkened(0.3), 5.0)
	draw_line(Vector2(r * 0.3, r * 0.4), Vector2(r * 0.3 - step, r), cloth.darkened(0.3), 5.0)
	draw_rect(Rect2(-r * 0.6, -r * 0.5, r * 1.2, r), cloth)
	draw_circle(Vector2(0, -r * 0.85), r * 0.5, skin)
	draw_arc(Vector2(0, -r * 0.9), r * 0.5, PI, TAU, 12, hair, r * 0.25)
	draw_circle(Vector2(r * 0.22, -r * 0.88), 2.5, Color(0.1, 0.1, 0.1) if type_id != "puppet" else Color(0.9, 0.3, 1))
	if type_id == "imperial":
		draw_line(Vector2(r * 0.4, -r * 0.1), Vector2(r * 1.4, -r * 0.2), Color(0.15, 0.15, 0.15), 4.0)
	elif type_id == "knight" or type_id == "holy_knight":
		draw_line(Vector2(r * 0.6, 0), Vector2(r * 1.4, -r * 0.8), Color(0.85, 0.85, 0.9), 3.0)
	elif type_id == "ogre" or type_id == "orc_general":
		draw_line(Vector2(r * 0.6, 0), Vector2(r * 1.3, -r * 1.0), Color(0.5, 0.4, 0.3), 5.0)
		if type_id == "ogre":
			draw_colored_polygon(PackedVector2Array([Vector2(-r * 0.1, -r * 1.3), Vector2(0, -r * 1.7), Vector2(r * 0.1, -r * 1.3)]), Color(0.95, 0.9, 0.8))
	elif type_id == "orc":
		draw_circle(Vector2(r * 0.35, -r * 0.7), 2.0, Color(1, 1, 0.9))  # presas
