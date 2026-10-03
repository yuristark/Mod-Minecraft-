extends CharacterBody3D
## Membro do grupo (Ranga, Benimaru, Shion, Diablo...). Segue o Rimuru,
## ataca inimigos próximos e usa sua técnica especial sozinho.
## Se a vida acaba, ele recua e volta depois de 15 s.

const Util := preload("res://scripts/util.gd")
const Data := preload("res://scripts/game_data.gd")
const Models := preload("res://scripts/models.gd")
const Fx := preload("res://scripts/fx.gd")
const Projectile := preload("res://scripts/projectile.gd")

const GRAVITY := 24.0

var ally_id := "ranga"
var slot := 0
var stats: Dictionary
var hp := 100.0
var max_hp := 100.0
var downed := false
var _down_timer := 0.0
var _visual: Node3D
var _model: Node3D
var _label: Label3D
var _attack_cd := 0.0
var _special_cd := 4.0
var _attack_anim := -1.0
var _anim_t := 0.0
var _invuln := 0.0


func _ready() -> void:
	stats = Data.ALLIES[ally_id]
	var main = _main()
	var lvl: int = main.player.level if main and main.get("player") else 1
	max_hp = stats.hp * (1.0 + 0.08 * (lvl - 1))
	hp = max_hp
	add_to_group("ally")
	collision_layer = Util.LAYER_ALLY
	collision_mask = Util.LAYER_WORLD
	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.45
	cap.height = 1.7
	shape.shape = cap
	shape.position.y = 0.85
	add_child(shape)
	_visual = Node3D.new()
	add_child(_visual)
	var ch: Dictionary = Data.CHARS[ally_id]
	_model = Models.build(Data.MODELS[ch.model], ch.model)
	_visual.add_child(_model)
	_label = Util.label3d(ch.name, 36, Color(0.6, 1.0, 0.7), 2.5)
	_label.no_depth_test = false
	add_child(_label)


func _main():
	return get_tree().current_scene


func _physics_process(delta: float) -> void:
	var main = _main()
	if main == null or main.player == null:
		return
	_anim_t += delta
	_invuln = maxf(_invuln - delta, 0.0)
	if downed:
		_down_timer -= delta
		if _down_timer <= 0.0:
			_revive(main)
		return
	_attack_cd = maxf(_attack_cd - delta, 0.0)
	_special_cd = maxf(_special_cd - delta, 0.0)
	hp = minf(hp + max_hp * 0.01 * delta, max_hp)

	if not is_on_floor():
		velocity.y -= GRAVITY * delta
	else:
		velocity.y = -0.5

	var player = main.player
	var target = _find_target(player)
	var move := Vector3.ZERO
	var speed: float = stats.speed
	var to_p: Vector3 = player.global_position - global_position
	to_p.y = 0
	if to_p.length() > 40.0:
		global_position = player.global_position + Vector3(randf_range(-2, 2), 1.0, randf_range(-2, 2))
		return
	if target != null:
		var to_t: Vector3 = target.global_position - global_position
		to_t.y = 0
		var dist := to_t.length()
		var ranged: bool = stats.get("ranged", false)
		var keep: float = float(stats.range) * (0.75 if ranged else 0.8)
		if dist > keep:
			move = to_t.normalized()
		_face(to_t, delta)
		if dist <= float(stats.range) + 0.6 and _attack_cd <= 0.0:
			_attack_cd = 1.0
			_attack_anim = 0.0
			var dmg: float = stats.dmg * _power(main)
			if ranged:
				_shoot(target, dmg)
			else:
				target.take_damage(dmg)
				Fx.burst(main.world, target.global_position + Vector3(0, 1, 0), Color(1, 0.9, 0.6), 6, 3.0, 0.2)
		if _special_cd <= 0.0:
			_special(main, target)
	else:
		# formação atrás do jogador
		var offset := Vector3((slot - 1) * 2.4, 0, 3.0).rotated(Vector3.UP, player.facing_yaw())
		var goal: Vector3 = player.global_position + offset
		var to_g := goal - global_position
		to_g.y = 0
		if to_g.length() > 1.2:
			move = to_g.normalized() * clampf(to_g.length() / 4.0, 0.3, 1.0)
			_face(to_g, delta)
		if stats.special.type == "heal" and _special_cd <= 0.0 and player.hp < player.max_hp * 0.6:
			_special(main, null)
	if move.length() > 0.0 and to_p.length() > 12.0:
		speed *= 1.4
	velocity.x = move.x * speed
	velocity.z = move.z * speed
	move_and_slide()
	if _attack_anim >= 0.0:
		_attack_anim += delta * 3.0
		if _attack_anim > 1.0:
			_attack_anim = -1.0
	Models.animate(_model, _anim_t, clampf(Vector2(velocity.x, velocity.z).length() / 6.0, 0.0, 1.0), _attack_anim)


func _power(main) -> float:
	return 1.0 + 0.1 * (main.player.level - 1)


func _find_target(player):
	var best = null
	var best_d := 20.0
	for e in get_tree().get_nodes_in_group("enemy"):
		if e.get("data") != null and e.data.get("invulnerable", false):
			continue
		var d: float = e.global_position.distance_to(player.global_position)
		if d < best_d:
			best = e
			best_d = d
	return best


func _face(dir: Vector3, delta: float) -> void:
	if dir.length() < 0.01:
		return
	_visual.rotation.y = lerp_angle(_visual.rotation.y, atan2(-dir.x, -dir.z), minf(delta * 10.0, 1.0))


func _shoot(target, dmg: float) -> void:
	var p := Projectile.new()
	var from := global_position + Vector3(0, 1.3, 0)
	p.direction = ((target.global_position + Vector3(0, 0.8, 0)) - from).normalized()
	p.damage = dmg
	p.color = stats.get("proj_color", Color(1, 0.8, 0.9))
	p.style = "orb"
	p.speed = 24.0
	_main().world.add_child(p)
	p.global_position = from + p.direction


func _special(main, target) -> void:
	var sp: Dictionary = stats.special
	_special_cd = float(sp.cd)
	var world: Node = main.world
	var dmg: float = float(sp.get("dmg", 0.0)) * _power(main)
	var tpos: Vector3 = target.global_position if target else global_position
	match sp.type:
		"lightning":
			for e in get_tree().get_nodes_in_group("enemy"):
				if e.global_position.distance_to(tpos) < 5.0:
					e.take_damage(dmg)
			Fx.lightning(world, tpos, Color(0.35, 0.25, 1.0))
		"flare":
			Fx.telegraph(world, tpos, 5.0, Color(0.3, 0.05, 0.1), 0.6, func():
				Fx.ring(world, tpos + Vector3(0, 1, 0), Color(0.15, 0.0, 0.05) if ally_id != "milim" else Color(1, 0.4, 0.7), 5.5, 0.5, 1.0)
				Fx.burst(world, tpos + Vector3(0, 1, 0), Color(1, 0.3, 0.1), 30, 8.0)
				for e in get_tree().get_nodes_in_group("enemy"):
					if e.global_position.distance_to(tpos) < 5.5:
						e.take_damage(dmg))
		"slam":
			Fx.ring(world, tpos + Vector3(0, 0.4, 0), Color(0.7, 0.5, 1.0), 5.0, 0.35, 0.3)
			main.shake(0.25)
			for e in get_tree().get_nodes_in_group("enemy"):
				if e.global_position.distance_to(tpos) < 5.0:
					e.take_damage(dmg)
					e.apply_stun(1.0)
		"dash":
			if target:
				global_position = target.global_position + (global_position - target.global_position).normalized() * 1.5
				target.take_damage(dmg)
				Fx.slash(world, target.global_position + Vector3(0, 1, 0), -_visual.global_transform.basis.z, Color(0.8, 0.9, 1.0), 2.2)
		"root":
			for e in get_tree().get_nodes_in_group("enemy"):
				if e.global_position.distance_to(tpos) < 6.0:
					e.take_damage(dmg)
					e.apply_root(3.0)
			Fx.ring(world, tpos + Vector3(0, 0.5, 0), Color(0.9, 0.9, 1.0), 6.0, 0.3, 0.1)
		"heal":
			var pl = main.player
			pl.hp = minf(pl.hp + pl.max_hp * float(sp.amount), pl.max_hp)
			for a in get_tree().get_nodes_in_group("ally"):
				a.hp = minf(a.hp + a.max_hp * float(sp.amount), a.max_hp)
			Fx.ring(world, pl.global_position + Vector3(0, 0.5, 0), Color(0.6, 1.0, 0.7), 6.0, 0.6, 0.2)
			Fx.burst(world, pl.global_position + Vector3(0, 1, 0), Color(0.6, 1.0, 0.6), 24, 3.0, 0.3, 2.0)
		"taunt", "stun_all":
			var r := 8.0 if sp.type == "taunt" else 14.0
			for e in get_tree().get_nodes_in_group("enemy"):
				if e.global_position.distance_to(global_position) < r:
					e.take_damage(dmg)
					e.apply_stun(2.5)
			Fx.ring(world, global_position + Vector3(0, 1, 0), Color(0.6, 0.1, 0.2) if sp.type == "stun_all" else Color(0.8, 0.7, 0.3), r, 0.5, 0.5)
	Fx.text(world, global_position + Vector3(0, 2.8, 0), sp.name, Color(1.0, 0.85, 0.4))


func take_damage(amount: float, _from := Vector3.ZERO) -> void:
	if downed or _invuln > 0.0:
		return
	hp -= amount
	_invuln = 0.3
	if hp <= 0.0:
		downed = true
		_down_timer = 15.0
		visible = false
		collision_layer = 0
		var main = _main()
		if main:
			Fx.burst(main.world, global_position + Vector3(0, 1, 0), Color(0.6, 0.6, 0.7), 20, 4.0)
			main.sage("%s recuou para se recuperar (volta em 15 s)." % Data.CHARS[ally_id].name)


func _revive(main) -> void:
	downed = false
	hp = max_hp
	visible = true
	collision_layer = Util.LAYER_ALLY
	global_position = main.player.global_position + Vector3(randf_range(-2, 2), 1.0, randf_range(-2, 2))
	Fx.burst(main.world, global_position + Vector3(0, 1, 0), Color(0.6, 1.0, 0.7), 20, 4.0)
