extends CharacterBody3D
## Rimuru, o slime. Movimento em terceira pessoa, pulo elástico,
## Predador (devorar) e as habilidades copiadas dos monstros.

const Util := preload("res://scripts/util.gd")
const Projectile := preload("res://scripts/projectile.gd")

const SPEED := 7.5
const JUMP := 9.5
const GRAVITY := 24.0
const MOUSE_SENS := 0.0025
const PREDATOR_RANGE := 3.8

## Custo de magículas (MP) e recarga de cada habilidade ativa.
const SKILL_INFO := {
	"water_blade": {"mp": 8.0, "cd": 0.35},
	"poison_breath": {"mp": 20.0, "cd": 2.0},
	"sticky_thread": {"mp": 12.0, "cd": 1.0},
	"ultrasound": {"mp": 25.0, "cd": 4.0},
	"shadow_motion": {"mp": 15.0, "cd": 1.2},
}

var max_hp := 100.0
var hp := 100.0
var max_mp := 100.0
var mp := 100.0
var dead := false
var skills := {"predator": true, "great_sage": true, "water_blade": true}
var cooldowns := {}

var _pivot: Node3D
var _arm: SpringArm3D
var _camera: Camera3D
var _visual: Node3D
var _body_mat: StandardMaterial3D
var _yaw := 0.0
var _pitch := -0.35
var _squash := 0.0
var _was_on_floor := true
var _air_jumps := 0
var _invuln := 0.0
var _dash_time := 0.0
var _dash_dir := Vector3.ZERO
var _anim_t := 0.0
var _hurt_flash := 0.0


func _ready() -> void:
	add_to_group("player")
	collision_layer = Util.LAYER_PLAYER
	collision_mask = Util.LAYER_WORLD | Util.LAYER_ENEMY

	var shape := CollisionShape3D.new()
	var s := SphereShape3D.new()
	s.radius = 0.7
	shape.shape = s
	shape.position.y = 0.7
	add_child(shape)

	_build_slime()

	_pivot = Node3D.new()
	_pivot.position.y = 1.0
	add_child(_pivot)
	_arm = SpringArm3D.new()
	_arm.spring_length = 6.5
	_arm.collision_mask = Util.LAYER_WORLD
	_arm.margin = 0.3
	_arm.add_excluded_object(get_rid())
	_pivot.add_child(_arm)
	_camera = Camera3D.new()
	_camera.fov = 70.0
	_camera.current = true
	_arm.add_child(_camera)

	for k in SKILL_INFO:
		cooldowns[k] = 0.0


func _build_slime() -> void:
	_visual = Node3D.new()
	add_child(_visual)
	# Corpo azul-celeste semi-transparente, como o Rimuru
	_body_mat = Util.mat(Color(0.35, 0.72, 1.0, 0.85), 0.25, true, 0.15)
	_body_mat.metallic_specular = 0.9
	_body_mat.rim_enabled = true
	_body_mat.rim = 0.6
	var body := Util.sphere(0.75, _body_mat, Vector3(0, 0.62, 0))
	body.scale = Vector3(1.0, 0.82, 1.0)
	_visual.add_child(body)
	var core := Util.sphere(0.3, Util.mat(Color(0.7, 0.9, 1.0), 1.0), Vector3(0, 0.55, 0.05))
	_visual.add_child(core)
	# Olhos ovais
	var eye_mat := Util.mat(Color(0.05, 0.08, 0.15))
	for x in [-0.22, 0.22]:
		var eye := Util.sphere(0.08, eye_mat, Vector3(x, 0.78, -0.66))
		eye.scale = Vector3(0.7, 1.6, 0.5)
		_visual.add_child(eye)
	# Luz suave que segue o slime pela caverna escura
	var light := OmniLight3D.new()
	light.light_color = Color(0.55, 0.8, 1.0)
	light.omni_range = 7.0
	light.light_energy = 0.9
	light.position.y = 1.2
	add_child(light)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_yaw -= event.relative.x * MOUSE_SENS
		_pitch = clampf(_pitch - event.relative.y * MOUSE_SENS, -1.2, 0.5)
	elif event is InputEventMouseButton and event.pressed and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
		get_viewport().set_input_as_handled()
		return
	if dead:
		return
	if event.is_action_pressed("pause_mouse"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	elif event.is_action_pressed("water_blade"):
		_cast("water_blade")
	elif event.is_action_pressed("poison_breath"):
		_cast("poison_breath")
	elif event.is_action_pressed("sticky_thread"):
		_cast("sticky_thread")
	elif event.is_action_pressed("ultrasound"):
		_cast("ultrasound")
	elif event.is_action_pressed("shadow_motion"):
		_cast("shadow_motion")
	elif event.is_action_pressed("predator"):
		_predator()
	elif event.is_action_pressed("interact"):
		_main().player_interact(self)


func _main():
	return get_tree().current_scene


func _physics_process(delta: float) -> void:
	_anim_t += delta
	_pivot.rotation = Vector3(_pitch, _yaw, 0)
	_invuln = maxf(_invuln - delta, 0.0)
	for k in cooldowns:
		cooldowns[k] = maxf(cooldowns[k] - delta, 0.0)
	if not dead:
		mp = minf(mp + 6.0 * delta, max_mp)
		hp = minf(hp + 0.8 * delta, max_hp)

	if not is_on_floor():
		velocity.y -= GRAVITY * delta

	var input := Vector2.ZERO
	if not dead:
		input = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var dir := (Basis(Vector3.UP, _yaw) * Vector3(input.x, 0, input.y)).normalized()

	if _dash_time > 0.0:
		_dash_time -= delta
		velocity.x = _dash_dir.x * 28.0
		velocity.z = _dash_dir.z * 28.0
	else:
		velocity.x = move_toward(velocity.x, dir.x * SPEED, SPEED * 8.0 * delta)
		velocity.z = move_toward(velocity.z, dir.z * SPEED, SPEED * 8.0 * delta)

	if not dead and Input.is_action_just_pressed("jump"):
		if is_on_floor():
			velocity.y = JUMP
			_squash = -0.35
		elif skills.has("hydraulic") and _air_jumps > 0:
			# Propulsão Hidráulica: um segundo pulo com jato d'água
			_air_jumps -= 1
			velocity.y = JUMP * 0.95
			_squash = -0.3
			_spawn_splash(global_position)

	move_and_slide()

	if is_on_floor():
		_air_jumps = 1
		if not _was_on_floor:
			_squash = 0.4  # amassa ao cair
	_was_on_floor = is_on_floor()

	if global_position.y < -20.0:
		take_damage(9999.0, global_position)

	_animate(delta, dir)


func _animate(delta: float, dir: Vector3) -> void:
	_squash = lerpf(_squash, 0.0, minf(delta * 8.0, 1.0))
	var moving := Vector2(velocity.x, velocity.z).length() > 0.5 and is_on_floor()
	var wobble := sin(_anim_t * (14.0 if moving else 3.0)) * (0.07 if moving else 0.03)
	var sq := _squash + wobble
	if dead:
		sq = 0.8
	_visual.scale = Vector3(1.0 + sq, maxf(1.0 - sq, 0.2), 1.0 + sq)
	if dir.length() > 0.1:
		_visual.rotation.y = lerp_angle(_visual.rotation.y, atan2(-dir.x, -dir.z), minf(delta * 12.0, 1.0))
	if _hurt_flash > 0.0:
		_hurt_flash -= delta
		_body_mat.albedo_color = Color(1.0, 0.4, 0.4, 0.85)
	else:
		_body_mat.albedo_color = Color(0.35, 0.72, 1.0, 0.85)
	_visual.visible = not (_invuln > 0.0 and _dash_time <= 0.0 and int(_anim_t * 20.0) % 2 == 0)


## Direção para onde a câmera olha (no plano horizontal).
func aim_dir() -> Vector3:
	var f := -_camera.global_transform.basis.z
	f.y = 0
	if f.length() < 0.01:
		return -_visual.global_transform.basis.z
	return f.normalized()


func _cast(skill: String) -> void:
	var main = _main()
	if not skills.has(skill):
		main.sage("Notificação: você ainda não possui essa habilidade. Devore o monstro certo com o Predador.")
		return
	var info: Dictionary = SKILL_INFO[skill]
	if cooldowns[skill] > 0.0:
		return
	if mp < info.mp:
		main.sage("Notificação: magículas insuficientes.")
		return
	mp -= info.mp
	cooldowns[skill] = info.cd
	var fwd := aim_dir()
	_visual.rotation.y = atan2(-fwd.x, -fwd.z)
	_squash = 0.2
	match skill:
		"water_blade":
			_shoot(fwd, 25.0, 0.0, Color(0.3, 0.75, 1.0))
		"sticky_thread":
			_shoot(fwd, 10.0, 3.5, Color(0.9, 0.9, 0.9))
		"poison_breath":
			_poison_breath(fwd)
		"ultrasound":
			_ultrasound()
		"shadow_motion":
			var d := Basis(Vector3.UP, _yaw) * Vector3(
				Input.get_axis("move_left", "move_right"), 0,
				Input.get_axis("move_forward", "move_back"))
			_dash_dir = d.normalized() if d.length() > 0.1 else fwd
			_dash_time = 0.22
			_invuln = maxf(_invuln, 0.35)
			_spawn_shadow_trail()


func _shoot(fwd: Vector3, dmg: float, root: float, c: Color) -> void:
	var p := Projectile.new()
	p.direction = fwd
	p.damage = dmg
	p.root_time = root
	p.color = c
	_main().add_child(p)
	p.global_position = global_position + Vector3(0, 0.7, 0) + fwd * 1.0


func _poison_breath(fwd: Vector3) -> void:
	# Névoa venenosa em cone à frente
	var fx := Node3D.new()
	_main().add_child(fx)
	fx.global_position = global_position + Vector3(0, 0.7, 0)
	var m := Util.mat(Color(0.45, 0.9, 0.2, 0.45), 1.5, true)
	for i in 6:
		var puff := Util.sphere(0.4 + i * 0.25, m, fwd * (1.2 + i * 1.0))
		fx.add_child(puff)
	var tw := fx.create_tween()
	tw.tween_property(fx, "scale", Vector3.ONE * 1.3, 0.6)
	tw.tween_callback(fx.queue_free)
	for e in get_tree().get_nodes_in_group("enemy"):
		var to: Vector3 = e.global_position - global_position
		to.y = 0
		if to.length() < 8.0 and fwd.dot(to.normalized()) > 0.6:
			e.take_damage(20.0)
			e.apply_poison(5.0)


func _ultrasound() -> void:
	var ring := Util.sphere(1.0, Util.mat(Color(0.9, 0.7, 1.0, 0.35), 2.0, true))
	_main().add_child(ring)
	ring.global_position = global_position + Vector3(0, 0.6, 0)
	ring.scale = Vector3(1, 0.3, 1)
	var tw := ring.create_tween()
	tw.tween_property(ring, "scale", Vector3(9, 1.5, 9), 0.4)
	tw.tween_callback(ring.queue_free)
	for e in get_tree().get_nodes_in_group("enemy"):
		if e.global_position.distance_to(global_position) < 9.0:
			e.take_damage(15.0)
			e.apply_stun(3.0)


func _spawn_shadow_trail() -> void:
	var m := Util.mat(Color(0.1, 0.05, 0.2, 0.6), 0.5, true)
	for i in 4:
		var ghost := Util.sphere(0.7, m)
		ghost.scale = Vector3(1, 0.8, 1)
		_main().add_child(ghost)
		ghost.global_position = global_position + Vector3(0, 0.6, 0) + _dash_dir * i * 1.2
		var tw := ghost.create_tween()
		tw.tween_property(ghost, "scale", Vector3.ZERO, 0.4 + i * 0.05)
		tw.tween_callback(ghost.queue_free)


func _spawn_splash(pos: Vector3) -> void:
	var s := Util.sphere(0.5, Util.mat(Color(0.3, 0.7, 1.0, 0.6), 1.5, true))
	_main().add_child(s)
	s.global_position = pos
	var tw := s.create_tween()
	tw.tween_property(s, "scale", Vector3(3, 0.2, 3), 0.3)
	tw.tween_callback(s.queue_free)


## Predador: devora o alvo devorável mais próximo.
func _predator() -> void:
	var main = _main()
	var best = null
	var best_d := INF
	for n in get_tree().get_nodes_in_group("absorbable"):
		var d: float = n.global_position.distance_to(global_position)
		var r = n.get("absorb_range")
		var reach: float = r if r != null else PREDATOR_RANGE
		if d < reach and d < best_d:
			best = n
			best_d = d
	if best == null:
		main.sage("Notificação: não há nada ao alcance do Predador.")
		return
	if not main.can_absorb(best):
		return
	best.remove_from_group("absorbable")
	_squash = -0.4
	# Efeito: o alvo é puxado para dentro do slime
	var tw: Tween = best.create_tween()
	tw.set_parallel(true)
	tw.tween_property(best, "global_position", global_position + Vector3(0, 0.6, 0), 0.35)
	tw.tween_property(best, "scale", Vector3.ONE * 0.05, 0.35)
	tw.chain().tween_callback(func():
		main.on_absorbed(best)
		best.queue_free())


func take_damage(amount: float, from: Vector3) -> void:
	if dead or _invuln > 0.0:
		return
	hp -= amount
	_invuln = 0.6
	_hurt_flash = 0.15
	var push := global_position - from
	push.y = 0
	if push.length() > 0.01:
		velocity += push.normalized() * 8.0
	velocity.y = 4.0
	if hp <= 0.0:
		hp = 0.0
		dead = true
		_main().on_player_died()


func grant_skill(id: String) -> void:
	skills[id] = true
