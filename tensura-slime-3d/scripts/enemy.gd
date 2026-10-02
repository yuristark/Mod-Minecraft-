extends CharacterBody3D
## Monstros da Caverna Selada. Ao morrer viram um "corpo" que o Rimuru
## pode devorar com o Predador para copiar a habilidade do monstro.

const Util := preload("res://scripts/util.gd")

const TYPES := {
	"serpent": {
		"name": "Serpente Tempestade", "hp": 120.0, "speed": 3.2, "damage": 14.0,
		"skill": "poison_breath", "color": Color(0.35, 0.2, 0.5), "aggro": 13.0, "range": 2.6,
	},
	"spider": {
		"name": "Aranha Negra", "hp": 70.0, "speed": 4.5, "damage": 9.0,
		"skill": "sticky_thread", "color": Color(0.1, 0.1, 0.12), "aggro": 14.0, "range": 2.0,
	},
	"bat": {
		"name": "Morcego Gigante", "hp": 50.0, "speed": 5.5, "damage": 7.0,
		"skill": "ultrasound", "color": Color(0.3, 0.22, 0.2), "aggro": 16.0, "range": 1.8,
	},
	"wolf": {
		"name": "Lobo Atroz", "hp": 140.0, "speed": 6.0, "damage": 16.0,
		"skill": "shadow_motion", "color": Color(0.35, 0.35, 0.4), "aggro": 18.0, "range": 2.4,
	},
	"lizard": {
		"name": "Lagarto Blindado", "hp": 90.0, "speed": 3.5, "damage": 11.0,
		"skill": "", "color": Color(0.45, 0.4, 0.25), "aggro": 12.0, "range": 2.2,
	},
}

const GRAVITY := 24.0

var type_id := "spider"
var data: Dictionary
var hp := 1.0
var max_hp := 1.0
var dead := false
var home := Vector3.ZERO

var _visual: Node3D
var _label: Label3D
var _attack_cd := 0.0
var _stun := 0.0
var _root := 0.0
var _poison := 0.0
var _flash := 0.0
var _wander_target := Vector3.ZERO
var _wander_timer := 0.0
var _anim_t := 0.0
var _materials: Array[StandardMaterial3D] = []


func _ready() -> void:
	data = TYPES[type_id]
	max_hp = data.hp
	hp = max_hp
	home = global_position
	_wander_target = home
	add_to_group("enemy")
	collision_layer = Util.LAYER_ENEMY
	collision_mask = Util.LAYER_WORLD | Util.LAYER_PLAYER | Util.LAYER_ENEMY

	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.7 if type_id != "serpent" else 0.9
	cap.height = 1.6
	shape.shape = cap
	shape.position.y = 0.8
	add_child(shape)

	_visual = Node3D.new()
	add_child(_visual)
	_build_model()

	_label = Label3D.new()
	_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_label.position.y = 2.6 if type_id != "bat" else 3.4
	_label.font_size = 40
	_label.pixel_size = 0.006
	_label.outline_size = 8
	_label.no_depth_test = true
	add_child(_label)
	_update_label()


func _m(c: Color, e := 0.0) -> StandardMaterial3D:
	var m := Util.mat(c, e)
	_materials.append(m)
	return m


func _build_model() -> void:
	var c: Color = data.color
	var body := _m(c)
	var eye := Util.mat(Color(1.0, 0.15, 0.1), 3.0)
	match type_id:
		"serpent":
			for i in 7:
				var r := 0.75 - i * 0.07
				_visual.add_child(Util.sphere(r, body, Vector3(0, r, i * 0.9)))
			_visual.add_child(Util.sphere(0.12, eye, Vector3(0.35, 0.95, -0.55)))
			_visual.add_child(Util.sphere(0.12, eye, Vector3(-0.35, 0.95, -0.55)))
			_visual.add_child(Util.cone(0.15, 0.6, _m(Color(0.6, 0.5, 0.8)), Vector3(0, 1.5, 0.2)))
		"spider":
			_visual.add_child(Util.sphere(0.6, body, Vector3(0, 0.7, 0.3)))
			_visual.add_child(Util.sphere(0.4, body, Vector3(0, 0.6, -0.5)))
			for i in 4:
				_visual.add_child(Util.sphere(0.07, eye, Vector3(-0.18 + i * 0.12, 0.75, -0.85)))
			for side in [-1, 1]:
				for i in 4:
					var leg := Util.box(Vector3(1.4, 0.08, 0.08), body, Vector3(side * 0.8, 0.5, -0.4 + i * 0.3))
					leg.rotation.z = side * -0.5
					leg.rotation.y = (i - 1.5) * 0.3 * side
					_visual.add_child(leg)
		"bat":
			_visual.position.y = 1.6
			_visual.add_child(Util.sphere(0.45, body))
			_visual.add_child(Util.sphere(0.08, eye, Vector3(0.15, 0.15, -0.4)))
			_visual.add_child(Util.sphere(0.08, eye, Vector3(-0.15, 0.15, -0.4)))
			for side in [-1, 1]:
				var wing := Util.box(Vector3(1.4, 0.05, 0.8), _m(c.darkened(0.3)), Vector3(side * 0.9, 0, 0))
				wing.name = "WingL" if side < 0 else "WingR"
				_visual.add_child(wing)
				_visual.add_child(Util.cone(0.1, 0.35, body, Vector3(side * 0.2, 0.5, 0)))
		"wolf":
			_visual.add_child(Util.box(Vector3(0.8, 0.8, 1.8), body, Vector3(0, 1.0, 0)))
			_visual.add_child(Util.box(Vector3(0.6, 0.6, 0.7), body, Vector3(0, 1.4, -1.1)))
			_visual.add_child(Util.box(Vector3(0.35, 0.3, 0.4), body, Vector3(0, 1.25, -1.6)))
			_visual.add_child(Util.sphere(0.08, Util.mat(Color(1.0, 0.8, 0.1), 3.0), Vector3(0.18, 1.55, -1.45)))
			_visual.add_child(Util.sphere(0.08, Util.mat(Color(1.0, 0.8, 0.1), 3.0), Vector3(-0.18, 1.55, -1.45)))
			# Estrela na testa, como o Ranga
			_visual.add_child(Util.sphere(0.1, Util.mat(Color(0.9, 0.9, 1.0), 4.0), Vector3(0, 1.75, -1.3)))
			for x in [-0.3, 0.3]:
				for z in [-0.6, 0.6]:
					_visual.add_child(Util.box(Vector3(0.2, 0.7, 0.2), body, Vector3(x, 0.35, z)))
			for x in [-0.2, 0.2]:
				_visual.add_child(Util.cone(0.1, 0.3, body, Vector3(x, 1.85, -1.0)))
			var tail := Util.box(Vector3(0.15, 0.15, 0.8), body, Vector3(0, 1.3, 1.2))
			tail.rotation.x = 0.6
			_visual.add_child(tail)
		"lizard":
			_visual.add_child(Util.box(Vector3(1.0, 0.7, 1.8), body, Vector3(0, 0.6, 0)))
			_visual.add_child(Util.box(Vector3(0.7, 0.5, 0.8), body, Vector3(0, 0.7, -1.2)))
			_visual.add_child(Util.sphere(0.08, eye, Vector3(0.25, 0.9, -1.4)))
			_visual.add_child(Util.sphere(0.08, eye, Vector3(-0.25, 0.9, -1.4)))
			var armor := _m(Color(0.6, 0.55, 0.4))
			for i in 4:
				_visual.add_child(Util.cone(0.18, 0.4, armor, Vector3(0, 1.1, -0.6 + i * 0.4)))
			var tail := Util.box(Vector3(0.3, 0.3, 1.2), body, Vector3(0, 0.5, 1.4))
			_visual.add_child(tail)


func _update_label() -> void:
	if dead:
		_label.text = "%s (derrotado)\n[E] Predador" % data.name
		_label.modulate = Color(0.7, 0.9, 1.0)
	else:
		_label.text = "%s\n%s" % [data.name, Util.text_bar(hp, max_hp)]
		_label.modulate = Color(1, 0.85, 0.85)


func _physics_process(delta: float) -> void:
	if dead:
		return
	_anim_t += delta
	_attack_cd = maxf(_attack_cd - delta, 0.0)
	_stun = maxf(_stun - delta, 0.0)
	_root = maxf(_root - delta, 0.0)

	if _poison > 0.0:
		_poison -= delta
		take_damage(8.0 * delta, false)
		if dead:
			return

	if _flash > 0.0:
		_flash -= delta
		for m in _materials:
			m.emission_enabled = _flash > 0.0
	if type_id == "bat":
		var flap := sin(_anim_t * 14.0) * 0.6
		var wl := _visual.get_node_or_null("WingL") as Node3D
		var wr := _visual.get_node_or_null("WingR") as Node3D
		if wl: wl.rotation.z = flap
		if wr: wr.rotation.z = -flap
		_visual.position.y = 1.6 + sin(_anim_t * 3.0) * 0.25

	if type_id != "bat":
		if not is_on_floor():
			velocity.y -= GRAVITY * delta
		else:
			velocity.y = -0.5

	var player = get_tree().get_first_node_in_group("player")
	var move := Vector3.ZERO
	var speed: float = data.speed
	if _stun > 0.0 or _root > 0.0:
		speed = 0.0
	if _poison > 0.0:
		speed *= 0.6

	if player and not player.get("dead"):
		var to_player: Vector3 = player.global_position - global_position
		to_player.y = 0.0
		var dist := to_player.length()
		if dist < data.aggro:
			if dist > data.range * 0.8:
				move = to_player.normalized()
			_face(to_player, delta)
			if dist <= data.range and _attack_cd <= 0.0 and _stun <= 0.0:
				_attack_cd = 1.3
				player.take_damage(data.damage, global_position)
				var tw := create_tween()
				tw.tween_property(_visual, "scale", Vector3(1.15, 0.85, 1.25), 0.08)
				tw.tween_property(_visual, "scale", Vector3.ONE, 0.15)
		else:
			move = _wander(delta)
	else:
		move = _wander(delta)

	velocity.x = move.x * speed
	velocity.z = move.z * speed
	move_and_slide()


func _wander(delta: float) -> Vector3:
	_wander_timer -= delta
	if _wander_timer <= 0.0:
		_wander_timer = randf_range(2.0, 4.5)
		_wander_target = home + Vector3(randf_range(-5, 5), 0, randf_range(-5, 5))
	var to := _wander_target - global_position
	to.y = 0
	if to.length() < 0.6:
		return Vector3.ZERO
	_face(to, delta)
	return to.normalized() * 0.45


func _face(dir: Vector3, delta: float) -> void:
	if dir.length() < 0.01:
		return
	var target := atan2(-dir.x, -dir.z)
	_visual.rotation.y = lerp_angle(_visual.rotation.y, target, minf(delta * 8.0, 1.0))


func take_damage(amount: float, flash := true) -> void:
	if dead:
		return
	hp -= amount
	if flash:
		_flash = 0.12
	if hp <= 0.0:
		_die()
	_update_label()


func apply_root(t: float) -> void:
	_root = maxf(_root, t)


func apply_stun(t: float) -> void:
	_stun = maxf(_stun, t)


func apply_poison(t: float) -> void:
	_poison = maxf(_poison, t)


func _die() -> void:
	dead = true
	hp = 0.0
	velocity = Vector3.ZERO
	remove_from_group("enemy")
	add_to_group("absorbable")
	collision_layer = 0
	collision_mask = Util.LAYER_WORLD
	for m in _materials:
		m.emission_enabled = false
		m.albedo_color = m.albedo_color.lerp(Color(0.4, 0.45, 0.6), 0.5)
	var tw := create_tween()
	tw.tween_property(_visual, "scale", Vector3(1.2, 0.35, 1.2), 0.3)
	if type_id == "bat":
		tw.parallel().tween_property(_visual, "position:y", 0.2, 0.4)
	var main := get_tree().current_scene
	if main and main.has_method("on_enemy_killed"):
		main.on_enemy_killed(self)


func get_absorb_name() -> String:
	return data.name
