extends CharacterBody3D
## Rimuru Tempest. Movimento em terceira pessoa, formas do Mimetismo, combo corpo a corpo,
## Predador (devorar), skills copiadas, nível/experiência e câmera por mouse ou toque.

const Util := preload("res://scripts/util.gd")
const Data := preload("res://scripts/game_data.gd")
const Models := preload("res://scripts/models.gd")
const Fx := preload("res://scripts/fx.gd")
const Projectile := preload("res://scripts/projectile.gd")
const SLIME_SHADER := preload("res://shaders/slime.gdshader")

const GRAVITY := 24.0
const MOUSE_SENS := 0.0025
const PREDATOR_RANGE := 3.8

var max_hp := 100.0
var hp := 100.0
var max_mp := 100.0
var mp := 100.0
var dead := false
var level := 1
var exp_points := 0
var title := "Slime"
var skills := {"predator": true, "great_sage": true, "water_blade": true}
var forms := {"slime": true}
var form := "slime"
var slots := ["water_blade", "", "", ""]
var cooldowns := {}
var potions := 0
var sensitivity := 1.0
var invert_y := false
var touch_mode := false
var ciel_time := 0.0
var shake_amount := 0.0

var _pivot: Node3D
var _arm: SpringArm3D
var _camera: Camera3D
var _visual: Node3D
var _form_nodes := {}
var _slime_mat: ShaderMaterial
var _lamp: OmniLight3D
var _shape: CollisionShape3D
var _yaw := 0.0
var _pitch := -0.35
var _squash := 0.0
var _was_on_floor := true
var _air_jumps := 0
var _invuln := 0.0
var _dash_time := 0.0
var _dash_speed := 28.0
var _dash_dir := Vector3.ZERO
var _dash_cd := 0.0
var _anim_t := 0.0
var _hurt_flash := 0.0
var _melee_cd := 0.0
var _combo := 0
var _combo_timer := 0.0
var _attack_anim := -1.0


func _ready() -> void:
	add_to_group("player")
	collision_layer = Util.LAYER_PLAYER
	collision_mask = Util.LAYER_WORLD | Util.LAYER_ENEMY

	_shape = CollisionShape3D.new()
	add_child(_shape)
	_visual = Node3D.new()
	add_child(_visual)
	_build_slime()

	_lamp = OmniLight3D.new()
	_lamp.light_color = Color(0.55, 0.8, 1.0)
	_lamp.omni_range = 7.0
	_lamp.light_energy = 0.9
	_lamp.position.y = 1.2
	add_child(_lamp)

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
	_camera.far = 900.0
	_arm.add_child(_camera)

	for k in Data.SKILLS:
		cooldowns[k] = 0.0
	set_form("slime", true)


func _build_slime() -> void:
	var n := Node3D.new()
	_slime_mat = ShaderMaterial.new()
	_slime_mat.shader = SLIME_SHADER
	var sm := SphereMesh.new()
	sm.radius = 0.75
	sm.height = 1.5
	sm.radial_segments = 32
	sm.rings = 16
	var body := Util.mesh_node(sm, _slime_mat, Vector3(0, 0.62, 0))
	body.scale = Vector3(1.0, 0.82, 1.0)
	n.add_child(body)
	n.add_child(Util.sphere(0.3, Util.mat(Color(0.7, 0.9, 1.0), 1.0), Vector3(0, 0.55, 0.05)))
	var eye_mat := Util.cmat(Color(0.05, 0.08, 0.15))
	for x in [-0.22, 0.22]:
		var eye := Util.sphere(0.08, eye_mat, Vector3(x, 0.78, -0.66))
		eye.scale = Vector3(0.7, 1.6, 0.5)
		n.add_child(eye)
	_visual.add_child(n)
	_form_nodes["slime"] = n


func _form_node(id: String) -> Node3D:
	if _form_nodes.has(id):
		return _form_nodes[id]
	var spec := {}
	match id:
		"bat": spec = {"kind": "bat", "color": Color(0.3, 0.5, 0.85), "scale": 1.3}
		"wolf": spec = {"kind": "quadruped", "color": Color(0.22, 0.28, 0.42), "horn": true, "star": true, "eye": Color(1.0, 0.8, 0.2)}
		"human": spec = Data.MODELS["rimuru_human"]
		"demon_lord": spec = Data.MODELS["rimuru_demon"]
	var n := Models.build(spec)
	_visual.add_child(n)
	_form_nodes[id] = n
	return n


func set_form(id: String, silent := false) -> void:
	if not forms.has(id):
		return
	form = id
	for k in _form_nodes:
		_form_nodes[k].visible = false
	var n := _form_node(id)
	n.visible = true
	n.position.y = 1.0 if id == "bat" else 0.0
	var s: Shape3D
	if id in ["human", "demon_lord"]:
		var cap := CapsuleShape3D.new()
		cap.radius = 0.4
		cap.height = 1.7
		s = cap
		_shape.position.y = 0.85
	else:
		var sp := SphereShape3D.new()
		sp.radius = 0.7
		s = sp
		_shape.position.y = 0.7
	_shape.shape = s
	if _arm:
		_arm.spring_length = 6.5 if id in ["slime", "bat"] else 7.5
	if not silent and is_inside_tree():
		var main = _main()
		Fx.burst(main.world, global_position + Vector3(0, 1, 0), Color(0.5, 0.8, 1.0), 30, 5.0)
		Fx.text(main.world, global_position + Vector3(0, 2.5, 0), Data.FORMS[id].name)


func cycle_form() -> void:
	if not skills.has("mimicry"):
		_main().sage("Notificação: você ainda não possui [Mimetismo].")
		return
	var order: Array = Data.FORM_ORDER
	var i := order.find(form)
	for k in range(1, order.size() + 1):
		var cand: String = order[(i + k) % order.size()]
		if forms.has(cand):
			if cand != form:
				set_form(cand)
			return


func set_lamp(on: bool) -> void:
	_lamp.visible = on


func _main():
	return get_tree().current_scene


# ======================================================================= ENTRADA
func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		add_camera_input(event.relative)
	elif event is InputEventMouseButton and event.pressed and not touch_mode:
		if Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
			if event.button_index == MOUSE_BUTTON_LEFT and not _main().hud.is_busy():
				Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
				get_viewport().set_input_as_handled()
			return
		if dead:
			return
		if event.button_index == MOUSE_BUTTON_LEFT:
			_melee()
		elif event.button_index == MOUSE_BUTTON_RIGHT:
			_cast_slot(0)
	if event.is_action_pressed("pause_mouse"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


## Usado pelo mouse e pelo arrasto na tela de toque.
func add_camera_input(rel: Vector2) -> void:
	_yaw -= rel.x * MOUSE_SENS * sensitivity
	_pitch = clampf(_pitch - rel.y * MOUSE_SENS * sensitivity * (-1.0 if invert_y else 1.0), -1.2, 0.5)


func _poll_actions() -> void:
	if Input.is_action_just_pressed("attack"):
		_melee()
	for i in 4:
		if Input.is_action_just_pressed("skill_%d" % (i + 1)):
			_cast_slot(i)
	if Input.is_action_just_pressed("dash"):
		_dash()
	if Input.is_action_just_pressed("predator"):
		_predator()
	if Input.is_action_just_pressed("interact"):
		_main().player_interact(self)
	if Input.is_action_just_pressed("mimic"):
		cycle_form()
	if Input.is_action_just_pressed("potion"):
		use_potion()


# ======================================================================= FÍSICA
func _physics_process(delta: float) -> void:
	_anim_t += delta
	_pivot.rotation = Vector3(_pitch, _yaw, 0)
	_invuln = maxf(_invuln - delta, 0.0)
	_melee_cd = maxf(_melee_cd - delta, 0.0)
	_dash_cd = maxf(_dash_cd - delta, 0.0)
	_combo_timer = maxf(_combo_timer - delta, 0.0)
	ciel_time = maxf(ciel_time - delta, 0.0)
	for k in cooldowns:
		cooldowns[k] = maxf(cooldowns[k] - delta, 0.0)
	if not dead:
		mp = minf(mp + (6.0 + level * 0.6) * delta, max_mp)
		var regen := 0.8 + (level * 0.3 if skills.has("self_regen") else 0.0)
		hp = minf(hp + regen * delta, max_hp)
		if ciel_time > 0.0:
			mp = max_mp
		_poll_actions()

	var fdata: Dictionary = Data.FORMS[form]
	var flying: bool = fdata.get("fly", false) and Input.is_action_pressed("jump") and not dead and not is_on_floor()
	if not is_on_floor():
		velocity.y -= GRAVITY * delta * (0.3 if flying else 1.0)
	if flying:
		velocity.y = move_toward(velocity.y, 6.0, 40.0 * delta)

	var input := Vector2.ZERO
	if not dead:
		input = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var dir := (Basis(Vector3.UP, _yaw) * Vector3(input.x, 0, input.y))
	if dir.length() > 1.0:
		dir = dir.normalized()
	var speed: float = fdata.speed

	if _dash_time > 0.0:
		_dash_time -= delta
		velocity.x = _dash_dir.x * _dash_speed
		velocity.z = _dash_dir.z * _dash_speed
	else:
		velocity.x = move_toward(velocity.x, dir.x * speed, speed * 8.0 * delta)
		velocity.z = move_toward(velocity.z, dir.z * speed, speed * 8.0 * delta)

	if not dead and Input.is_action_just_pressed("jump"):
		if is_on_floor():
			velocity.y = fdata.jump
			_squash = -0.35
		elif skills.has("hydraulic") and _air_jumps > 0 and not fdata.get("fly", false):
			# Propulsão Hidráulica: um segundo pulo com jato d'água
			_air_jumps -= 1
			velocity.y = float(fdata.jump) * 0.95
			_squash = -0.3
			_spawn_splash(global_position)

	move_and_slide()

	if is_on_floor():
		_air_jumps = 1
		if not _was_on_floor:
			_squash = 0.4
	_was_on_floor = is_on_floor()

	if global_position.y < -30.0:
		var main = _main()
		global_position = main.safe_spawn()
		velocity = Vector3.ZERO
		take_damage(20.0, global_position)

	_animate(delta, dir)
	_update_shake(delta)


func _update_shake(delta: float) -> void:
	shake_amount = maxf(shake_amount - delta * 1.5, 0.0)
	if shake_amount > 0.0:
		_camera.h_offset = randf_range(-1, 1) * shake_amount * 0.4
		_camera.v_offset = randf_range(-1, 1) * shake_amount * 0.4
	else:
		_camera.h_offset = 0.0
		_camera.v_offset = 0.0


func _animate(delta: float, dir: Vector3) -> void:
	_squash = lerpf(_squash, 0.0, minf(delta * 8.0, 1.0))
	var moving := Vector2(velocity.x, velocity.z).length() > 0.5 and is_on_floor()
	if dir.length() > 0.1 and _attack_anim < 0.0:
		_visual.rotation.y = lerp_angle(_visual.rotation.y, atan2(-dir.x, -dir.z), minf(delta * 12.0, 1.0))
	if _attack_anim >= 0.0:
		_attack_anim += delta * 4.0
		if _attack_anim > 1.0:
			_attack_anim = -1.0
	var node: Node3D = _form_nodes[form]
	if form == "slime":
		var wobble := sin(_anim_t * (14.0 if moving else 3.0)) * (0.07 if moving else 0.03)
		var sq := _squash + wobble
		if dead:
			sq = 0.8
		node.scale = Vector3(1.0 + sq, maxf(1.0 - sq, 0.2), 1.0 + sq)
		_slime_mat.set_shader_parameter("hurt", 1.0 if _hurt_flash > 0.0 else 0.0)
	else:
		var mv := clampf(Vector2(velocity.x, velocity.z).length() / 8.0, 0.0, 1.0) if is_on_floor() else 0.2
		Models.animate(node, _anim_t, mv, _attack_anim)
		if form == "bat":
			node.position.y = 1.0 + sin(_anim_t * 3.0) * 0.15
		Util.set_flash(node, _hurt_flash > 0.0)
	if _hurt_flash > 0.0:
		_hurt_flash -= delta
	_visual.visible = not (_invuln > 0.0 and _dash_time <= 0.0 and _hurt_flash <= 0.0 and int(_anim_t * 20.0) % 2 == 0 and _invuln < 0.5)


func facing_yaw() -> float:
	return _visual.rotation.y


# ======================================================================= MIRA
## Inimigo mais próximo na direção da câmera (mira suave, essencial no celular).
func aim_target():
	var cam_f := -_camera.global_transform.basis.z
	cam_f.y = 0
	cam_f = cam_f.normalized()
	var best = null
	var best_score := INF
	var max_d := 30.0 if (touch_mode or ciel_time > 0.0) else 24.0
	for e in get_tree().get_nodes_in_group("enemy"):
		var to: Vector3 = e.global_position - global_position
		to.y = 0
		var d := to.length()
		if d > max_d or d < 0.01:
			continue
		var dot := cam_f.dot(to / d)
		var need := 0.2 if (touch_mode or ciel_time > 0.0) else 0.75
		if dot < need:
			continue
		var score := d * (2.0 - dot)
		if score < best_score:
			best = e
			best_score = score
	return best


## Direção do ataque (no plano horizontal).
func aim_dir() -> Vector3:
	var t = aim_target()
	if t != null:
		var to: Vector3 = t.global_position - global_position
		to.y = 0
		if to.length() > 0.1:
			return to.normalized()
	var f := -_camera.global_transform.basis.z
	f.y = 0
	if f.length() < 0.01:
		return -_visual.global_transform.basis.z
	return f.normalized()


func aim_point(default_dist := 14.0) -> Vector3:
	var t = aim_target()
	if t != null:
		return t.global_position
	var p := global_position + aim_dir() * default_dist
	p.y = _main().ground_height(p.x, p.z)
	return p


func _face(d: Vector3) -> void:
	_visual.rotation.y = atan2(-d.x, -d.z)


# ======================================================================= COMBATE
func power() -> float:
	var p: float = Data.FORMS[form].dmg * (1.0 + 0.1 * (level - 1))
	if skills.has("raphael"):
		p *= 1.25
	if ciel_time > 0.0:
		p *= 2.0
	return p


func _melee() -> void:
	if dead or _melee_cd > 0.0:
		return
	var main = _main()
	_combo = (_combo + 1) % 3 if _combo_timer > 0.0 else 0
	_combo_timer = 0.9
	_melee_cd = 0.3
	var style: String = Data.FORMS[form].melee
	var fwd := aim_dir()
	_face(fwd)
	_attack_anim = 0.0
	var reach := 2.4
	var arc := 0.3
	var dmg := 12.0
	var color := Color(0.6, 0.85, 1.0)
	match style:
		"tackle":
			velocity += fwd * 9.0
			_squash = 0.3
			dmg = 12.0
		"bite":
			reach = 2.9
			dmg = 16.0
			color = Color(1.0, 0.9, 0.7)
		"sword":
			reach = 3.4
			arc = 0.1
			dmg = 18.0
			Fx.slash(main.world, global_position + Vector3(0, 1.0, 0) + fwd * 0.8, fwd, Color(0.6, 0.85, 1.0) if form == "human" else Color(0.6, 0.4, 1.0), 2.4 + _combo * 0.3)
	dmg *= power() * (1.0 + _combo * 0.3)
	var hit := false
	for e in get_tree().get_nodes_in_group("enemy"):
		var to: Vector3 = e.global_position - global_position
		to.y = 0
		var d := to.length()
		var extra := 1.0 if e.get("boss") else 0.0
		if d <= reach + extra and (d < 0.8 or fwd.dot(to / d) > arc):
			e.take_damage(dmg)
			hit = true
			Fx.burst(main.world, e.global_position + Vector3(0, 1, 0), color, 8, 4.0, 0.25)
	if hit and _combo == 2:
		main.shake(0.15)


func _cast_slot(i: int) -> void:
	if i < slots.size() and slots[i] != "":
		_cast(slots[i])


func _cast(skill: String) -> void:
	if dead:
		return
	var main = _main()
	if not skills.has(skill):
		main.sage("Notificação: você ainda não possui essa habilidade. Devore o monstro certo com o Predador.")
		return
	var info: Dictionary = Data.SKILLS[skill]
	if info.kind != "active":
		return
	if cooldowns[skill] > 0.0:
		return
	var cost: float = 0.0 if ciel_time > 0.0 else float(info.mp)
	if mp < cost:
		main.sage("Notificação: magículas insuficientes.")
		return
	mp -= cost
	cooldowns[skill] = float(info.cd) * (0.7 if skills.has("ciel_passive") else 1.0)
	var fwd := aim_dir()
	_face(fwd)
	_squash = 0.2
	_attack_anim = 0.0
	var pw := power()
	var w: Node = main.world
	match skill:
		"water_blade":
			_shoot(fwd, 25.0 * pw, Color(0.3, 0.75, 1.0))
		"sticky_thread":
			var p := _shoot(fwd, 10.0 * pw, Color(0.9, 0.9, 0.9))
			p.root_time = 3.5
		"poison_breath":
			_breath(fwd, Color(0.45, 0.9, 0.2), 20.0 * pw, "poison")
		"paralyze_breath":
			_breath(fwd, Color(1.0, 0.9, 0.3), 15.0 * pw, "stun")
		"ultrasound":
			Fx.ring(w, global_position + Vector3(0, 0.6, 0), Color(0.9, 0.7, 1.0), 9.0, 0.4, 0.3)
			for e in _enemies_near(global_position, 9.0):
				e.take_damage(15.0 * pw)
				e.apply_stun(3.0)
		"black_lightning":
			var tp := aim_point(12.0)
			for k in 3:
				var off := Vector3(randf_range(-1.5, 1.5), 0, randf_range(-1.5, 1.5)) if k > 0 else Vector3.ZERO
				Fx.lightning(w, tp + off, Color(0.35, 0.25, 1.0))
			main.shake(0.3)
			for e in _enemies_near(tp, 4.5):
				e.take_damage(60.0 * pw)
				e.apply_stun(0.8)
		"flame_control":
			var fp := _shoot(fwd, 35.0 * pw, Color(1.0, 0.45, 0.1))
			fp.style = "orb"
			fp.explode_radius = 3.5
			fp.speed = 22.0
		"hell_flare":
			var hp_pos := aim_point(14.0)
			Fx.telegraph(w, hp_pos, 7.0, Color(0.6, 0.1, 0.2), 0.6, func():
				Fx.ring(w, hp_pos + Vector3(0, 1, 0), Color(0.12, 0.0, 0.05), 7.5, 0.7, 1.0)
				Fx.burst(w, hp_pos + Vector3(0, 2, 0), Color(0.9, 0.2, 0.1), 50, 12.0, 0.6)
				Fx.flash(w, hp_pos + Vector3(0, 2, 0), Color(1.0, 0.3, 0.1), 10.0, 25.0, 0.6)
				main.shake(0.5)
				for e in _enemies_near(hp_pos, 7.5):
					e.take_damage(140.0 * pw)
					e.apply_poison(4.0))
		"thought_accel":
			main.slow_enemies(8.0)
			Fx.ring(w, global_position + Vector3(0, 1, 0), Color(0.6, 0.9, 1.0), 14.0, 0.6, 1.0)
		"starved":
			var total := 0.0
			Fx.ring(w, global_position + Vector3(0, 0.5, 0), Color(0.6, 0.5, 0.1), 8.0, 0.5, 0.25)
			Fx.burst(w, global_position + Vector3(0, 1, 0), Color(0.8, 0.7, 0.2), 40, -6.0, 0.4, 0.0)
			for e in _enemies_near(global_position, 8.0):
				var d := 50.0 * pw
				e.take_damage(d)
				total += d
			hp = minf(hp + total * 0.5, max_hp)
		"megiddo":
			var targets := _enemies_near(global_position, 40.0)
			targets.sort_custom(func(a, b): return a.global_position.distance_to(global_position) < b.global_position.distance_to(global_position))
			targets = targets.slice(0, 10)
			main.sage("Megiddo: %d alvos travados." % targets.size())
			var k2 := 0
			for e in targets:
				var eid: int = e.get_instance_id()
				var tw := create_tween()
				tw.tween_interval(0.5 + k2 * 0.12)
				tw.tween_callback(func():
					var en = instance_from_id(eid)
					if en != null and is_instance_valid(en) and not en.dead:
						Fx.pillar(w, en.global_position, Color(1.0, 0.95, 0.7), 0.35, 60.0, 0.4)
						en.take_damage(300.0 * pw))
				k2 += 1
		"beelzebuth":
			Fx.ring(w, global_position + Vector3(0, 1, 0), Color(0.15, 0.05, 0.25), 16.0, 0.8, 0.6)
			Fx.burst(w, global_position + Vector3(0, 1, 0), Color(0.6, 0.3, 1.0), 80, -14.0, 0.5, 0.0)
			main.shake(0.6)
			for e in _enemies_near(global_position, 16.0):
				if not e.boss and e.hp < 500.0 * pw:
					e.take_damage(e.hp + 1.0)
					if e.dead and e.is_in_group("absorbable"):
						e.remove_from_group("absorbable")
						main.on_absorbed(e)
						e.queue_free()
				else:
					e.take_damage(400.0 * pw)
			hp = minf(hp + max_hp * 0.3, max_hp)
		"storm_dragon":
			main.spawn_storm(global_position + fwd * 3.0, fwd, 60.0 * pw)
			main.sage("KUAHAHAHA! Deixa comigo, Rimuru! — Veldora")
		"disintegration":
			var from := global_position + Vector3(0, 1.0, 0)
			Fx.beam(w, from, fwd, 40.0, 2.5, Color(0.95, 0.97, 1.0), 0.6)
			main.shake(0.6)
			for e in get_tree().get_nodes_in_group("enemy"):
				var rel: Vector3 = e.global_position - global_position
				rel.y = 0
				var along := rel.dot(fwd)
				if along > 0.0 and along < 40.0 and (rel - fwd * along).length() < 2.2:
					e.take_damage(1200.0 * pw)
		"demon_aura":
			Fx.ring(w, global_position + Vector3(0, 1, 0), Color(0.4, 0.3, 1.0), 18.0, 0.7, 0.6)
			main.shake(0.4)
			for e in _enemies_near(global_position, 18.0):
				e.take_damage(80.0 * pw)
				e.apply_stun(4.0)
			hp = minf(hp + max_hp * 0.2, max_hp)
			for a in get_tree().get_nodes_in_group("ally"):
				a.hp = minf(a.hp + a.max_hp * 0.3, a.max_hp)
		"ciel_mode":
			ciel_time = 15.0
			Fx.pillar(w, global_position, Color(0.5, 0.9, 1.0), 1.5, 30.0, 0.8)
			main.sage("Ciel: Modo de Batalha Automática ativado. Deixe comigo, Mestre.")


func _enemies_near(pos: Vector3, r: float) -> Array:
	var out := []
	for e in get_tree().get_nodes_in_group("enemy"):
		var d: Vector3 = e.global_position - pos
		d.y = 0
		if d.length() <= r:
			out.append(e)
	return out


func _shoot(fwd: Vector3, dmg: float, c: Color) -> Projectile:
	var p := Projectile.new()
	var from := global_position + Vector3(0, 0.7 if form == "slime" else 1.2, 0)
	var t = aim_target()
	var dir := fwd
	if t != null:
		dir = ((t.global_position + Vector3(0, 0.8, 0)) - from).normalized()
	p.direction = dir
	p.damage = dmg
	p.color = c
	_main().world.add_child(p)
	p.global_position = from + dir * 1.0
	return p


func _breath(fwd: Vector3, c: Color, dmg: float, effect: String) -> void:
	var main = _main()
	var fx := Node3D.new()
	main.world.add_child(fx)
	fx.global_position = global_position + Vector3(0, 0.7, 0)
	var m := Util.mat(Color(c, 0.45), 1.5, true)
	for i in 6:
		var puff := Util.sphere(0.4 + i * 0.25, m, fwd * (1.2 + i * 1.0))
		puff.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		fx.add_child(puff)
	var tw := fx.create_tween()
	tw.tween_property(fx, "scale", Vector3.ONE * 1.3, 0.6)
	tw.tween_callback(fx.queue_free)
	for e in get_tree().get_nodes_in_group("enemy"):
		var to: Vector3 = e.global_position - global_position
		to.y = 0
		if to.length() < 8.0 and fwd.dot(to.normalized()) > 0.55:
			e.take_damage(dmg)
			if effect == "poison":
				e.apply_poison(5.0)
			else:
				e.apply_stun(3.5)


func _dash() -> void:
	if dead or _dash_cd > 0.0:
		return
	var shadow := skills.has("shadow_motion")
	var d := Basis(Vector3.UP, _yaw) * Vector3(
		Input.get_axis("move_left", "move_right"), 0,
		Input.get_axis("move_forward", "move_back"))
	_dash_dir = d.normalized() if d.length() > 0.1 else -_visual.global_transform.basis.z
	_dash_dir.y = 0
	_dash_dir = _dash_dir.normalized()
	_dash_time = 0.22 if shadow else 0.16
	_dash_speed = 28.0 if shadow else 20.0
	_dash_cd = 0.5
	_invuln = maxf(_invuln, 0.35 if shadow else 0.2)
	_spawn_shadow_trail(shadow)


func _spawn_shadow_trail(shadow: bool) -> void:
	var m := Util.mat(Color(0.1, 0.05, 0.2, 0.6) if shadow else Color(0.5, 0.8, 1.0, 0.4), 0.5, true)
	for i in 4:
		var ghost := Util.sphere(0.7, m)
		ghost.scale = Vector3(1, 0.8, 1)
		_main().world.add_child(ghost)
		ghost.global_position = global_position + Vector3(0, 0.6, 0) + _dash_dir * i * 1.2
		var tw := ghost.create_tween()
		tw.tween_property(ghost, "scale", Vector3.ZERO, 0.4 + i * 0.05)
		tw.tween_callback(ghost.queue_free)


func _spawn_splash(pos: Vector3) -> void:
	var s := Util.sphere(0.5, Util.mat(Color(0.3, 0.7, 1.0, 0.6), 1.5, true))
	_main().world.add_child(s)
	s.global_position = pos
	var tw := s.create_tween()
	tw.tween_property(s, "scale", Vector3(3, 0.2, 3), 0.3)
	tw.tween_callback(s.queue_free)


func use_potion() -> void:
	var main = _main()
	if potions <= 0:
		main.sage("Notificação: nenhuma Poção Completa. Devore Ervas Hipokute para produzir.")
		return
	if hp >= max_hp:
		return
	potions -= 1
	hp = minf(hp + max_hp * 0.6, max_hp)
	Fx.burst(main.world, global_position + Vector3(0, 1, 0), Color(0.4, 1.0, 0.5), 24, 3.0, 0.3, 2.0)
	main.sage("Poção Completa usada (+60% de vida). Restam %d." % potions)


# ======================================================================= PREDADOR
func nearest_absorbable():
	var best = null
	var best_d := INF
	for n in get_tree().get_nodes_in_group("absorbable"):
		var d: float = n.global_position.distance_to(global_position)
		var r = n.get("absorb_range")
		var reach: float = r if r != null else PREDATOR_RANGE
		if form != "slime":
			reach += 0.8
		if d < reach and d < best_d:
			best = n
			best_d = d
	return best


func _predator() -> void:
	var main = _main()
	if dead:
		return
	var best = nearest_absorbable()
	if best == null:
		main.sage("Notificação: não há nada ao alcance do Predador.")
		return
	if not main.can_absorb(best):
		return
	best.remove_from_group("absorbable")
	_squash = -0.4
	Fx.burst(main.world, best.global_position + Vector3(0, 0.8, 0), Color(0.4, 0.6, 1.0), 24, -5.0, 0.3, 0.0)
	var tw: Tween = best.create_tween()
	tw.set_parallel(true)
	tw.tween_property(best, "global_position", global_position + Vector3(0, 0.6, 0), 0.35)
	tw.tween_property(best, "scale", Vector3.ONE * 0.05, 0.35)
	tw.chain().tween_callback(func():
		main.on_absorbed(best)
		best.queue_free())


# ======================================================================= DANO / NÍVEL
func take_damage(amount: float, from: Vector3) -> void:
	if dead or _invuln > 0.0:
		return
	var main = _main()
	var dmg: float = amount / float(Data.FORMS[form].def)
	if skills.has("body_armor"):
		dmg *= 0.8
	dmg /= (1.0 + 0.05 * (level - 1))
	hp -= dmg
	_invuln = 0.6
	_hurt_flash = 0.15
	if main and main.get("world") != null:
		Fx.number(main.world, global_position + Vector3(0, 1.8, 0), dmg, Color(1.0, 0.35, 0.35))
		main.shake(0.2)
	var push := global_position - from
	push.y = 0
	if push.length() > 0.01:
		velocity += push.normalized() * 8.0
	velocity.y = 4.0
	if hp <= 0.0:
		hp = 0.0
		dead = true
		main.on_player_died()


func exp_to_next() -> int:
	return int(40.0 * pow(level, 1.6))


func gain_exp(amount: int) -> void:
	exp_points += amount
	var leveled := false
	while exp_points >= exp_to_next():
		exp_points -= exp_to_next()
		level += 1
		max_hp += 15.0
		max_mp += 10.0
		leveled = true
	if leveled:
		hp = max_hp
		mp = max_mp
		var main = _main()
		if main and main.get("world") != null:
			Fx.pillar(main.world, global_position, Color(1.0, 0.9, 0.4), 1.0, 12.0, 0.6)
			Fx.text(main.world, global_position + Vector3(0, 2.5, 0), "NÍVEL %d!" % level, Color(1.0, 0.9, 0.4))
			main.sage("Informe: nível aumentou para %d. Vida e magículas restauradas." % level)


func grant_skill(id: String) -> void:
	if skills.has(id):
		return
	skills[id] = true
	var info: Dictionary = Data.SKILLS.get(id, {})
	if info.get("kind", "") == "active":
		for i in slots.size():
			if slots[i] == "":
				slots[i] = id
				return


func revive(pos: Vector3) -> void:
	dead = false
	hp = max_hp
	mp = max_mp
	global_position = pos
	velocity = Vector3.ZERO
	_invuln = 2.0


func to_save() -> Dictionary:
	return {"max_hp": max_hp, "max_mp": max_mp, "level": level, "exp": exp_points, "title": title,
		"skills": skills.keys(), "forms": forms.keys(), "form": form, "slots": slots, "potions": potions}


func from_save(d: Dictionary) -> void:
	max_hp = d.get("max_hp", 100.0)
	max_mp = d.get("max_mp", 100.0)
	hp = max_hp
	mp = max_mp
	level = int(d.get("level", 1))
	exp_points = int(d.get("exp", 0))
	title = d.get("title", "Slime")
	skills = {}
	for s in d.get("skills", ["predator", "great_sage", "water_blade"]):
		skills[s] = true
	forms = {}
	for f in d.get("forms", ["slime"]):
		forms[f] = true
	slots = d.get("slots", ["water_blade", "", "", ""])
	while slots.size() < 4:
		slots.append("")
	potions = int(d.get("potions", 0))
	set_form(d.get("form", "slime"), true)
