extends CharacterBody3D
## Monstros e chefes. Os dados vêm de game_data.gd (ENEMIES).
## Ao morrer viram um "corpo" que o Rimuru pode devorar com o Predador.
## Chefes usam padrões extras: volley, slam, rain, dash, summon e beam.

const Util := preload("res://scripts/util.gd")
const Data := preload("res://scripts/game_data.gd")
const Models := preload("res://scripts/models.gd")
const Fx := preload("res://scripts/fx.gd")
const Projectile := preload("res://scripts/projectile.gd")

const GRAVITY := 24.0

var type_id := "spider"
var data: Dictionary
var hp := 1.0
var max_hp := 1.0
var dead := false
var boss := false
var home := Vector3.ZERO
var story_tag := ""        # usado pela história para saber quem foi gerado por um objetivo

var _visual: Node3D
var _model: Node3D
var _label: Label3D
var _attack_cd := 0.0
var _windup := 0.0
var _attack_anim := -1.0
var _stun := 0.0
var _root := 0.0
var _poison := 0.0
var _flash := 0.0
var _wander_target := Vector3.ZERO
var _wander_timer := 0.0
var _anim_t := 0.0
var _boss_cds: Array = []
var _busy := 0.0
var _dash_time := 0.0
var _dash_dir := Vector3.ZERO
var _dash_hit := false
var _phase2 := false
var _corpse_timer := 0.0
var _fly_height := 0.0


func _ready() -> void:
	data = Data.ENEMIES[type_id]
	max_hp = data.hp
	hp = max_hp
	boss = data.get("boss", false)
	home = global_position
	_wander_target = home
	_anim_t = randf() * 10.0
	add_to_group("enemy")
	collision_layer = Util.LAYER_ENEMY
	collision_mask = Util.LAYER_WORLD | Util.LAYER_PLAYER | Util.LAYER_ENEMY | Util.LAYER_ALLY

	var big: bool = data.get("big", false)
	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.7 if type_id != "serpent" else 0.9
	cap.height = 1.6
	if big:
		cap.radius = 2.0
		cap.height = 4.0
	elif boss:
		cap.radius = 0.8
		cap.height = 2.2
	shape.shape = cap
	shape.position.y = cap.height / 2.0
	add_child(shape)

	_visual = Node3D.new()
	add_child(_visual)
	var spec: Dictionary = data.get("model", {})
	if data.has("model_id"):
		spec = Data.MODELS[data.model_id]
	_model = Models.build(spec)
	_visual.add_child(_model)
	if data.get("flying", false):
		_fly_height = 1.6
	if boss:
		_visual.scale = Vector3.ONE * 1.15

	_label = Util.label3d("", 40, Color(1, 0.85, 0.85), 2.6 if not boss else 3.4)
	if type_id == "bat":
		_label.position.y = 3.4
	if big:
		_label.position.y = 8.0
	add_child(_label)
	_update_label()

	for a in data.get("attacks", []):
		_boss_cds.append(randf_range(1.0, float(a.cd)))
	var main = _main()
	if main and main.get("world") != null:
		Fx.burst(main.world, global_position + Vector3(0, 1, 0), Color(0.6, 0.3, 0.9) if boss else Color(0.5, 0.5, 0.6), 16 if not boss else 40, 5.0)


func _main():
	return get_tree().current_scene


func _update_label() -> void:
	if dead:
		_label.text = "%s (derrotado)\n[PREDADOR]" % data.name
		_label.modulate = Color(0.7, 0.9, 1.0)
	elif boss:
		_label.text = data.name
		_label.modulate = Color(1.0, 0.75, 0.5)
	elif data.get("invulnerable", false):
		_label.text = "%s\n???" % data.name
	else:
		_label.text = "%s\n%s" % [data.name, Util.text_bar(hp, max_hp)]
		_label.modulate = Color(1, 0.85, 0.85)


func _physics_process(delta: float) -> void:
	var main = _main()
	if dead:
		_corpse_timer += delta
		if not boss and _corpse_timer > 45.0:
			queue_free()
		return
	var ts: float = main.enemy_time_scale if main and main.get("enemy_time_scale") != null else 1.0
	var dt := delta * ts
	_anim_t += dt
	_attack_cd = maxf(_attack_cd - dt, 0.0)
	_stun = maxf(_stun - dt, 0.0)
	_root = maxf(_root - dt, 0.0)
	_busy = maxf(_busy - dt, 0.0)
	for i in _boss_cds.size():
		_boss_cds[i] = maxf(_boss_cds[i] - dt, 0.0)

	if data.has("regen") and hp < max_hp:
		hp = minf(hp + float(data.regen) * dt, max_hp)

	if _poison > 0.0:
		_poison -= dt
		take_damage(8.0 * dt * (1.0 + max_hp / 400.0), false)
		if dead:
			return

	if _flash > 0.0:
		_flash -= delta
		if _flash <= 0.0:
			Util.set_flash(_visual, false)

	if not data.get("flying", false):
		if not is_on_floor():
			velocity.y -= GRAVITY * dt
		else:
			velocity.y = -0.5
	else:
		_visual.position.y = _fly_height + sin(_anim_t * 3.0) * 0.25
		velocity.y = 0.0

	var target = _pick_target(main)
	var move := Vector3.ZERO
	var speed: float = data.speed * (1.15 if _phase2 else 1.0)
	if _stun > 0.0 or _root > 0.0:
		speed = 0.0
	if _poison > 0.0:
		speed *= 0.6

	if _dash_time > 0.0:
		_dash_time -= dt
		velocity.x = _dash_dir.x * 26.0 * ts
		velocity.z = _dash_dir.z * 26.0 * ts
		if not _dash_hit and target and global_position.distance_to(target.global_position) < 2.8:
			_dash_hit = true
			target.take_damage(_dash_dmg, global_position)
		move_and_slide()
		Models.animate(_model, _anim_t, 1.0, 0.5)
		return

	if _windup > 0.0:
		_windup -= dt
		_attack_anim = 1.0 - _windup / 0.35
		if _windup <= 0.0:
			_attack_anim = -1.0
			if target and _stun <= 0.0 and global_position.distance_to(target.global_position) <= float(data.range) * 1.35 + 0.5:
				target.take_damage(data.damage * (1.2 if _phase2 else 1.0), global_position)
				Fx.burst(main.world, target.global_position + Vector3(0, 0.8, 0), Color(1, 0.4, 0.3), 8, 4.0, 0.25)

	if target != null:
		var to_t: Vector3 = target.global_position - global_position
		to_t.y = 0.0
		var dist := to_t.length()
		if dist < data.aggro:
			if boss and _busy <= 0.0 and _stun <= 0.0:
				_boss_think(target, dist, main)
			var ranged: bool = data.get("ranged", false)
			var keep: float = float(data.range) * (0.7 if ranged else 0.8)
			if dist > keep and _busy <= 0.0:
				move = to_t.normalized()
			_face(to_t, dt)
			if dist <= data.range and _attack_cd <= 0.0 and _stun <= 0.0 and _windup <= 0.0 and _busy <= 0.0:
				if ranged:
					_attack_cd = 1.8 if not boss else 1.2
					_shoot_at(target, data.damage, data.get("proj_color", Color(0.8, 0.3, 1.0)), 22.0, 0, 0.0)
					_attack_anim = 0.2
				else:
					_attack_cd = 1.3 if not boss else 1.0
					_windup = 0.35
		else:
			move = _wander(dt)
	else:
		move = _wander(dt)

	velocity.x = move.x * speed * ts
	velocity.z = move.z * speed * ts
	move_and_slide()
	Models.animate(_model, _anim_t, clampf(Vector2(velocity.x, velocity.z).length() / 6.0, 0.0, 1.0), _attack_anim)
	if _attack_anim >= 0.0 and _windup <= 0.0:
		_attack_anim = maxf(_attack_anim - dt * 3.0, -1.0) if _attack_anim > 0.01 else -1.0


func _pick_target(main):
	if main == null or main.get("player") == null:
		return null
	var p = main.player
	var best = null
	var best_d := INF
	if p and not p.dead:
		best = p
		best_d = p.global_position.distance_to(global_position) * 0.9  # prefere o jogador
	for a in get_tree().get_nodes_in_group("ally"):
		if a.get("downed"):
			continue
		var d: float = a.global_position.distance_to(global_position)
		if d < best_d:
			best = a
			best_d = d
	return best


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


# ---------------------------------------------------------------- chefes
var _dash_dmg := 0.0

func _boss_think(target, dist: float, main) -> void:
	var attacks: Array = data.get("attacks", [])
	var ready := []
	for i in attacks.size():
		if _boss_cds[i] <= 0.0:
			ready.append(i)
	if ready.is_empty():
		return
	var i: int = ready[randi() % ready.size()]
	var a: Dictionary = attacks[i]
	if a.type == "dash" and dist < 4.0:
		return
	_boss_cds[i] = float(a.cd) * (0.7 if _phase2 else 1.0)
	var world: Node = main.world
	var tpos: Vector3 = target.global_position
	match a.type:
		"volley":
			_busy = 0.5
			_attack_anim = 0.3
			var n: int = a.n
			for k in n:
				var off := 0.0 if n == 1 else lerpf(-float(a.spread), float(a.spread), float(k) / (n - 1))
				_shoot_at(target, a.dmg, a.get("color", Color(1, 0.4, 0.2)), a.get("speed", 18.0), 0, off)
		"slam":
			_busy = float(a.delay) + 0.3
			var r: float = a.r
			var c: Color = a.get("color", Color(1, 0.2, 0.1))
			var center := global_position
			Fx.telegraph(world, center, r, c, a.delay, func():
				if not is_instance_valid(self) or dead:
					return
				Fx.ring(world, center + Vector3(0, 0.5, 0), c, r, 0.35, 0.35)
				Fx.burst(world, center + Vector3(0, 0.5, 0), c, 30, 10.0, 0.5)
				main.shake(0.4)
				_hurt_circle(center, r, a.dmg))
		"rain":
			_busy = 0.6
			var c2: Color = a.get("color", Color(1, 0.3, 0.1))
			for k in int(a.n):
				var p := tpos + Vector3(randf_range(-6, 6), 0, randf_range(-6, 6)) if k > 0 else tpos
				p.y = main.ground_height(p.x, p.z)
				var rr: float = a.r
				Fx.telegraph(world, p, rr, c2, float(a.delay) + k * 0.08, func():
					if not is_instance_valid(self):
						return
					Fx.pillar(world, p, c2, rr * 0.5, 25.0, 0.35)
					_hurt_circle(p, rr, a.dmg))
		"dash":
			_busy = 0.9
			var dir: Vector3 = (tpos - global_position)
			dir.y = 0
			_dash_dir = dir.normalized()
			_dash_dmg = a.dmg
			_dash_hit = false
			var tw := create_tween()
			tw.tween_interval(0.35)
			tw.tween_callback(func():
				_dash_time = 0.4
				Fx.burst(world, global_position + Vector3(0, 1, 0), Color(1, 1, 1), 14, 6.0))
		"summon":
			if get_tree().get_nodes_in_group("enemy").size() < 22:
				_busy = 0.8
				for k in int(a.n):
					var sp := global_position + Vector3(randf_range(-6, 6), 0, randf_range(-6, 6))
					main.spawn_enemy(a.enemy, sp, story_tag + "_add")
		"beam":
			_busy = float(a.delay) + 0.5
			var bdir: Vector3 = tpos - global_position
			bdir.y = 0
			bdir = bdir.normalized()
			var from := global_position + Vector3(0, 0.1, 0)
			var c3: Color = a.get("color", Color(1, 0.4, 0.7))
			Fx.beam_telegraph(world, from, bdir, a.len, a.w, c3, a.delay, func():
				if not is_instance_valid(self):
					return
				Fx.beam(world, from + Vector3(0, 1.2, 0), bdir, a.len, a.w, c3)
				main.shake(0.5)
				_hurt_line(from, bdir, a.len, a.w, a.dmg))


func _shoot_at(target, dmg: float, color: Color, spd: float, _n: int, angle_off: float) -> void:
	var p := Projectile.new()
	var from := global_position + Vector3(0, 1.3 + _fly_height, 0)
	var dir: Vector3 = (target.global_position + Vector3(0, 0.7, 0)) - from
	dir = dir.normalized().rotated(Vector3.UP, angle_off)
	p.direction = dir
	p.speed = spd
	p.damage = dmg
	p.color = color
	p.faction = "enemy"
	p.style = "orb" if not data.get("ranged", false) or boss else "bullet"
	p.lifetime = 2.5
	p.size = 1.2 if boss else 1.0
	_main().world.add_child(p)
	p.global_position = from + dir * 1.2


func _targets() -> Array:
	var list := []
	var main = _main()
	if main and main.player and not main.player.dead:
		list.append(main.player)
	for a in get_tree().get_nodes_in_group("ally"):
		if not a.get("downed"):
			list.append(a)
	return list


func _hurt_circle(center: Vector3, r: float, dmg: float) -> void:
	for t in _targets():
		var d: Vector3 = t.global_position - center
		d.y = 0
		if d.length() <= r + 0.5:
			t.take_damage(dmg, center)


func _hurt_line(from: Vector3, dir: Vector3, length: float, width: float, dmg: float) -> void:
	for t in _targets():
		var rel: Vector3 = t.global_position - from
		rel.y = 0
		var along := rel.dot(dir)
		if along < 0.0 or along > length:
			continue
		if (rel - dir * along).length() <= width * 0.5 + 0.6:
			t.take_damage(dmg, from)


# ---------------------------------------------------------------- dano e estados
func take_damage(amount: float, flash := true) -> void:
	if dead:
		return
	var main = _main()
	if data.get("invulnerable", false):
		hp = maxf(hp - amount, max_hp * 0.5)
	else:
		hp -= amount
	if flash:
		_flash = 0.1
		Util.set_flash(_visual, true)
		if main and main.get("world") != null and amount >= 1.0:
			Fx.number(main.world, global_position + Vector3(0, 2.2 + _fly_height, 0), amount, Color(1, 0.95, 0.6) if amount < 150 else Color(1, 0.5, 0.3), amount >= 150)
	if boss and not _phase2 and hp < max_hp * 0.5 and not data.get("invulnerable", false):
		_phase2 = true
		if main and main.has_method("sage"):
			main.sage("Aviso: %s ficou furioso! Os ataques ficaram mais rápidos." % data.name)
	if hp <= 0.0:
		_die()
	_update_label()


func apply_root(t: float) -> void:
	_root = maxf(_root, t * (0.4 if boss else 1.0))


func apply_stun(t: float) -> void:
	_stun = maxf(_stun, t * (0.3 if boss else 1.0))


func apply_poison(t: float) -> void:
	_poison = maxf(_poison, t)


func is_boss() -> bool:
	return boss


func _die() -> void:
	dead = true
	hp = 0.0
	velocity = Vector3.ZERO
	_attack_anim = -1.0
	Util.set_flash(_visual, false)
	remove_from_group("enemy")
	add_to_group("absorbable")
	collision_layer = 0
	collision_mask = Util.LAYER_WORLD
	var tw := create_tween()
	tw.tween_property(_visual, "scale", _visual.scale * Vector3(1.2, 0.35, 1.2), 0.3)
	if data.get("flying", false):
		tw.parallel().tween_property(_visual, "position:y", 0.2, 0.4)
	# corpo fica azulado (pronto para o Predador)
	var ghost := Util.mat(Color(0.5, 0.75, 1.0, 0.35), 1.0, true)
	for c in _all_meshes(_visual):
		c.material_overlay = ghost
	var main = _main()
	if main and main.has_method("on_enemy_killed"):
		main.on_enemy_killed(self)


func _all_meshes(n: Node) -> Array:
	var out := []
	for c in n.get_children():
		if c is MeshInstance3D:
			out.append(c)
		out.append_array(_all_meshes(c))
	return out


func get_absorb_name() -> String:
	return data.name
