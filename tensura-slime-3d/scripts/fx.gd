extends RefCounted
## Efeitos visuais reutilizáveis (todos se apagam sozinhos).

const Util := preload("res://scripts/util.gd")
const TELEGRAPH_SHADER := preload("res://shaders/telegraph.gdshader")

static var _dot: GradientTexture2D


static func _dot_tex() -> GradientTexture2D:
	if _dot == null:
		_dot = GradientTexture2D.new()
		_dot.fill = GradientTexture2D.FILL_RADIAL
		_dot.fill_from = Vector2(0.5, 0.5)
		_dot.fill_to = Vector2(1.0, 0.5)
		var g := Gradient.new()
		g.set_color(0, Color.WHITE)
		g.set_color(1, Color(1, 1, 1, 0))
		_dot.gradient = g
		_dot.width = 32
		_dot.height = 32
	return _dot


## Explosão de partículas brilhantes.
static func burst(parent: Node, pos: Vector3, color: Color, amount := 24, speed := 6.0, size := 0.35, gravity := -4.0) -> void:
	if parent == null:
		return
	var p := GPUParticles3D.new()
	p.one_shot = true
	p.explosiveness = 0.95
	p.amount = amount
	p.lifetime = 0.8
	var pm := ParticleProcessMaterial.new()
	pm.direction = Vector3(0, 1, 0)
	pm.spread = 180.0
	pm.initial_velocity_min = speed * 0.4
	pm.initial_velocity_max = speed
	pm.gravity = Vector3(0, gravity, 0)
	pm.damping_min = 2.0
	pm.damping_max = 4.0
	pm.scale_min = 0.5
	pm.scale_max = 1.2
	var g := Gradient.new()
	g.set_color(0, Color(color.lightened(0.5), 1.0))
	g.set_color(1, Color(color, 0.0))
	var gt := GradientTexture1D.new()
	gt.gradient = g
	pm.color_ramp = gt
	p.process_material = pm
	var q := QuadMesh.new()
	q.size = Vector2(size, size)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.vertex_color_use_as_albedo = true
	m.albedo_texture = _dot_tex()
	q.material = m
	p.draw_pass_1 = q
	parent.add_child(p)
	p.global_position = pos
	p.emitting = true
	p.finished.connect(p.queue_free)


## Esfera translúcida que cresce e some (ondas, explosões, cúpulas).
static func ring(parent: Node, pos: Vector3, color: Color, radius: float, time := 0.4, flat := 0.3) -> void:
	if parent == null:
		return
	var s := Util.sphere(1.0, Util.mat(Color(color, 0.4), 2.0, true))
	s.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(s)
	s.global_position = pos
	s.scale = Vector3(0.5, 0.5 * flat, 0.5)
	var tw := s.create_tween()
	tw.tween_property(s, "scale", Vector3(radius, radius * flat, radius), time).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)
	tw.parallel().tween_property(s, "transparency", 1.0, time)
	tw.tween_callback(s.queue_free)


## Luz rápida (flash) num ponto.
static func flash(parent: Node, pos: Vector3, color: Color, energy := 4.0, rng := 10.0, time := 0.25) -> void:
	if parent == null:
		return
	var l := OmniLight3D.new()
	l.light_color = color
	l.light_energy = energy
	l.omni_range = rng
	parent.add_child(l)
	l.global_position = pos
	var tw := l.create_tween()
	tw.tween_property(l, "light_energy", 0.0, time)
	tw.tween_callback(l.queue_free)


## Coluna vertical de luz (Megiddo, raios, evolução).
static func pillar(parent: Node, pos: Vector3, color: Color, radius := 0.6, height := 40.0, time := 0.5) -> void:
	if parent == null:
		return
	var c := Util.cylinder(radius, height, Util.mat(Color(color, 0.85), 6.0, true))
	c.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(c)
	c.global_position = pos + Vector3(0, height / 2.0, 0)
	var tw := c.create_tween()
	tw.tween_property(c, "scale", Vector3(0.05, 1, 0.05), time).set_ease(Tween.EASE_IN)
	tw.tween_callback(c.queue_free)
	flash(parent, pos + Vector3(0, 1, 0), color, 6.0, radius * 12.0, time)


## Raio em zigue-zague do céu até o ponto.
static func lightning(parent: Node, pos: Vector3, color := Color(0.4, 0.3, 1.0)) -> void:
	if parent == null:
		return
	var m := Util.mat(color, 8.0)
	var top := pos + Vector3(randf_range(-2, 2), 22, randf_range(-2, 2))
	var prev := top
	for i in 6:
		var t := float(i + 1) / 6.0
		var nxt := top.lerp(pos, t) + (Vector3(randf_range(-1.2, 1.2), 0, randf_range(-1.2, 1.2)) if i < 5 else Vector3.ZERO)
		var seg := Util.box(Vector3(0.18, 0.18, prev.distance_to(nxt)), m)
		parent.add_child(seg)
		seg.global_position = (prev + nxt) / 2.0
		if prev.distance_to(nxt) > 0.01:
			seg.look_at(nxt, Vector3.UP if absf((nxt - prev).normalized().y) < 0.99 else Vector3.FORWARD)
		var tw := seg.create_tween()
		tw.tween_interval(0.12)
		tw.tween_property(seg, "scale", Vector3(0.1, 0.1, 1), 0.15)
		tw.tween_callback(seg.queue_free)
		prev = nxt
	flash(parent, pos + Vector3(0, 1, 0), color, 8.0, 14.0, 0.3)
	burst(parent, pos + Vector3(0, 0.5, 0), color, 20, 8.0)


## Aviso no chão: círculo que se enche; ao terminar chama on_done.
static func telegraph(parent: Node, pos: Vector3, radius: float, color: Color, delay: float, on_done: Callable) -> void:
	if parent == null:
		return
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(radius * 2.0, radius * 2.0)
	mi.mesh = pm
	var sm := ShaderMaterial.new()
	sm.shader = TELEGRAPH_SHADER
	sm.set_shader_parameter("color", color)
	sm.set_shader_parameter("progress", 0.0)
	mi.material_override = sm
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	mi.global_position = pos + Vector3(0, 0.15, 0)
	var tw := mi.create_tween()
	tw.tween_method(func(v): sm.set_shader_parameter("progress", v), 0.0, 1.0, delay)
	tw.tween_callback(func():
		if on_done.is_valid():
			on_done.call()
		mi.queue_free())


## Aviso em linha (feixes) do ponto 'from' na direção 'dir'.
static func beam_telegraph(parent: Node, from: Vector3, dir: Vector3, length: float, width: float, color: Color, delay: float, on_done: Callable) -> void:
	if parent == null:
		return
	var mi := Util.box(Vector3(width, 0.05, length), Util.mat(Color(color, 0.35), 2.0, true))
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	mi.global_position = from + dir * length / 2.0 + Vector3(0, 0.2, 0)
	mi.look_at(mi.global_position + dir, Vector3.UP)
	var tw := mi.create_tween()
	tw.tween_property(mi, "scale", Vector3(1, 1, 1), delay).from(Vector3(0.2, 1, 1))
	tw.tween_callback(func():
		if on_done.is_valid():
			on_done.call()
		mi.queue_free())


## Feixe sólido (Desintegração, Drago Nova...).
static func beam(parent: Node, from: Vector3, dir: Vector3, length: float, width: float, color: Color, time := 0.45) -> void:
	if parent == null:
		return
	var c := Util.cylinder(width * 0.5, length, Util.mat(Color(color, 0.9), 7.0, true))
	c.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(c)
	c.global_position = from + dir * length / 2.0
	c.look_at(c.global_position + dir, Vector3.UP if absf(dir.y) < 0.99 else Vector3.FORWARD)
	c.rotate_object_local(Vector3.RIGHT, PI / 2)
	var tw := c.create_tween()
	tw.tween_property(c, "scale", Vector3(0.05, 1, 0.05), time).set_ease(Tween.EASE_IN)
	tw.tween_callback(c.queue_free)
	flash(parent, from, color, 6.0, 16.0, time)


## Arco de corte (espada).
static func slash(parent: Node, pos: Vector3, dir: Vector3, color := Color(0.7, 0.9, 1.0), radius := 2.6) -> void:
	if parent == null:
		return
	var tm := TorusMesh.new()
	tm.inner_radius = radius - 0.15
	tm.outer_radius = radius
	tm.rings = 24
	tm.ring_segments = 4
	var mi := Util.mesh_node(tm, Util.mat(Color(color, 0.8), 4.0, true))
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	mi.global_position = pos
	mi.look_at(pos + dir, Vector3.UP)
	mi.scale = Vector3(1, 0.15, 1)
	var tw := mi.create_tween()
	tw.tween_property(mi, "rotation:y", mi.rotation.y + 1.2, 0.18)
	tw.parallel().tween_property(mi, "transparency", 1.0, 0.2)
	tw.tween_callback(mi.queue_free)


## Número de dano que sobe e some.
static func number(parent: Node, pos: Vector3, value: float, color := Color(1, 0.95, 0.6), big := false) -> void:
	if parent == null:
		return
	var l := Util.label3d(str(int(round(value))) if value >= 1.0 else "", 64 if big else 44, color, 0.0)
	l.outline_size = 10
	parent.add_child(l)
	l.global_position = pos + Vector3(randf_range(-0.4, 0.4), 0, randf_range(-0.4, 0.4))
	var tw := l.create_tween()
	tw.tween_property(l, "global_position:y", l.global_position.y + 1.6, 0.7).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(l, "modulate:a", 0.0, 0.7).set_delay(0.3)
	tw.tween_callback(l.queue_free)


## Texto flutuante (ex.: "Absorvido!", "NÍVEL!").
static func text(parent: Node, pos: Vector3, msg: String, color := Color(0.6, 0.9, 1.0)) -> void:
	if parent == null:
		return
	var l := Util.label3d(msg, 52, color, 0.0)
	parent.add_child(l)
	l.global_position = pos
	var tw := l.create_tween()
	tw.tween_property(l, "global_position:y", pos.y + 2.0, 1.2)
	tw.parallel().tween_property(l, "modulate:a", 0.0, 1.2).set_delay(0.5)
	tw.tween_callback(l.queue_free)
