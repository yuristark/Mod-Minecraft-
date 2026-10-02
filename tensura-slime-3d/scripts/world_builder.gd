extends RefCounted
## Monta cada área do jogo só com código: iluminação, céu, terreno com relevo,
## água, árvores e grama (MultiMesh), construções e portais.
## quality: 0 = baixa (celular fraco), 1 = média, 2 = alta.

const Util := preload("res://scripts/util.gd")
const TERRAIN_SHADER := preload("res://shaders/terrain.gdshader")
const WATER_SHADER := preload("res://shaders/water.gdshader")
const GRASS_SHADER := preload("res://shaders/grass.gdshader")
const PORTAL_SHADER := preload("res://shaders/portal.gdshader")

var root: Node3D
var quality := 1
var town_level := 0
var area_id := ""
var portals: Array = []      # [{node, to, pos, min_ch, name}]
var ambient: Node3D          # partículas que seguem o jogador
var env: Environment
var sun: DirectionalLight3D

var _rng := RandomNumberGenerator.new()
var _noise := FastNoiseLite.new()
var _noise2 := FastNoiseLite.new()
var _hdata := PackedFloat32Array()
var _hres := 0
var _hcell := 2.0
var _hhalf := 0.0
var _flats: Array = []        # [Vector2 centro, raio, altura]
var _trees_body: StaticBody3D

# Pontos importantes da Floresta de Jura
const TEMPEST := Vector2(0, 0)
const LAKE := Vector2(-95, 35)
const MARSH := Vector2(-110, -95)


func build(id: String, parent: Node3D, q: int, town: int) -> void:
	area_id = id
	root = parent
	quality = q
	town_level = town
	portals.clear()
	_hdata = PackedFloat32Array()
	_flats.clear()
	_rng.seed = hash(id) + 1704
	_noise.seed = hash(id) % 10000
	_noise.frequency = 0.012
	_noise.fractal_octaves = 4
	_noise2.seed = _noise.seed + 7
	_noise2.frequency = 0.06
	match id:
		"cave": _build_cave()
		"forest": _build_forest()
		"dwargon": _build_dwargon()
		"falmuth": _build_falmuth()
		"walpurgis": _build_walpurgis()


## Altura do chão em (x, z). Áreas sem relevo devolvem 0.
func height_at(x: float, z: float) -> float:
	if _hdata.is_empty():
		return 0.0
	var fx := clampf((x + _hhalf) / _hcell, 0.0, _hres - 1.001)
	var fz := clampf((z + _hhalf) / _hcell, 0.0, _hres - 1.001)
	var ix := int(fx)
	var iz := int(fz)
	var tx := fx - ix
	var tz := fz - iz
	var w := _hres
	var h00 := _hdata[iz * w + ix]
	var h10 := _hdata[iz * w + ix + 1]
	var h01 := _hdata[(iz + 1) * w + ix]
	var h11 := _hdata[(iz + 1) * w + ix + 1]
	# Mesma triangulação da malha do terreno
	if tx + tz <= 1.0:
		return h00 + (h10 - h00) * tx + (h01 - h00) * tz
	return h11 + (h01 - h11) * (1.0 - tx) + (h10 - h11) * (1.0 - tz)


func ground(p: Vector3, up := 0.0) -> Vector3:
	return Vector3(p.x, height_at(p.x, p.z) + up, p.z)


# ======================================================================= AMBIENTE
func _environment(sky_top: Color, sky_hor: Color, ground_col: Color, fog: Color, fog_density: float,
		sun_dir: Vector3, sun_color: Color, sun_energy: float, ambient_energy: float, indoor := false) -> void:
	env = Environment.new()
	if indoor:
		env.background_mode = Environment.BG_COLOR
		env.background_color = sky_top
		env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
		env.ambient_light_color = sky_hor
	else:
		var sky_mat := ProceduralSkyMaterial.new()
		sky_mat.sky_top_color = sky_top
		sky_mat.sky_horizon_color = sky_hor
		sky_mat.ground_horizon_color = sky_hor.darkened(0.2)
		sky_mat.ground_bottom_color = ground_col
		sky_mat.sun_angle_max = 25.0
		sky_mat.sky_curve = 0.12
		var sky := Sky.new()
		sky.sky_material = sky_mat
		env.background_mode = Environment.BG_SKY
		env.sky = sky
		env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
		env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.ambient_light_energy = ambient_energy
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 1.0
	env.tonemap_white = 6.0
	env.glow_enabled = quality >= 1
	env.glow_intensity = 0.8
	env.glow_bloom = 0.08
	env.glow_hdr_threshold = 1.0
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	env.fog_enabled = true
	env.fog_light_color = fog
	env.fog_density = fog_density
	env.fog_sky_affect = 0.35
	env.fog_aerial_perspective = 0.4
	env.ssao_enabled = quality >= 2
	env.ssao_radius = 1.5
	env.ssao_intensity = 1.6
	env.ssil_enabled = quality >= 2
	env.volumetric_fog_enabled = quality >= 2
	env.volumetric_fog_density = fog_density * 1.6
	env.volumetric_fog_albedo = fog
	env.volumetric_fog_emission = fog * 0.05
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.15
	env.adjustment_contrast = 1.05
	var we := WorldEnvironment.new()
	we.environment = env
	root.add_child(we)

	sun = DirectionalLight3D.new()
	root.add_child(sun)
	sun.look_at_from_position(Vector3.ZERO, sun_dir.normalized(), Vector3.UP if absf(sun_dir.normalized().y) < 0.99 else Vector3.FORWARD)
	sun.light_color = sun_color
	sun.light_energy = sun_energy
	sun.shadow_enabled = quality >= 1
	sun.directional_shadow_max_distance = 60.0 if quality < 2 else 110.0
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS if quality < 2 else DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
	sun.shadow_blur = 1.5
	sun.light_angular_distance = 1.0


func _ambient_particles(color: Color, amount: int, size: float, rise: float, glow: float) -> void:
	var p := GPUParticles3D.new()
	p.amount = maxi(int(amount * [0.4, 0.7, 1.0][quality]), 8)
	p.lifetime = 6.0
	p.preprocess = 6.0
	p.visibility_aabb = AABB(Vector3(-30, -10, -30), Vector3(60, 30, 60))
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pm.emission_box_extents = Vector3(25, 6, 25)
	pm.gravity = Vector3(0, rise, 0)
	pm.direction = Vector3(0, 1, 0)
	pm.spread = 180.0
	pm.initial_velocity_min = 0.1
	pm.initial_velocity_max = 0.5
	pm.turbulence_enabled = true
	pm.turbulence_noise_strength = 0.6
	pm.scale_min = 0.5
	pm.scale_max = 1.2
	var grad := Gradient.new()
	grad.set_color(0, Color(color, 0.0))
	grad.add_point(0.2, color)
	grad.add_point(0.8, color)
	grad.set_color(grad.get_point_count() - 1, Color(color, 0.0))
	var gt := GradientTexture1D.new()
	gt.gradient = grad
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
	m.albedo_color = Color(glow, glow, glow)
	m.albedo_texture = _soft_dot()
	q.material = m
	p.draw_pass_1 = q
	root.add_child(p)
	ambient = p


static var _dot_tex: GradientTexture2D
static func _soft_dot() -> GradientTexture2D:
	if _dot_tex == null:
		_dot_tex = GradientTexture2D.new()
		_dot_tex.fill = GradientTexture2D.FILL_RADIAL
		_dot_tex.fill_from = Vector2(0.5, 0.5)
		_dot_tex.fill_to = Vector2(1.0, 0.5)
		var g := Gradient.new()
		g.set_color(0, Color.WHITE)
		g.set_color(1, Color(1, 1, 1, 0))
		_dot_tex.gradient = g
		_dot_tex.width = 32
		_dot_tex.height = 32
	return _dot_tex


func _portal(to: String, pos: Vector3, min_ch: int, label: String, color := Color(0.4, 0.75, 1.0)) -> void:
	var n := Node3D.new()
	n.position = ground(pos)
	root.add_child(n)
	var ring := MeshInstance3D.new()
	var t := TorusMesh.new()
	t.inner_radius = 2.2
	t.outer_radius = 2.6
	ring.mesh = t
	ring.material_override = Util.cmat(color, 3.0, 0.3)
	ring.rotation.x = PI / 2
	ring.position.y = 2.7
	n.add_child(ring)
	var disc := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(4.6, 4.6)
	disc.mesh = qm
	var sm := ShaderMaterial.new()
	sm.shader = PORTAL_SHADER
	sm.set_shader_parameter("color", color)
	disc.material_override = sm
	disc.position.y = 2.7
	n.add_child(disc)
	var disc2 := disc.duplicate()
	disc2.rotation.y = PI
	n.add_child(disc2)
	var l := OmniLight3D.new()
	l.light_color = color
	l.light_energy = 2.0
	l.omni_range = 9.0
	l.position.y = 2.5
	n.add_child(l)
	n.add_child(Util.label3d(label, 64, Color(0.85, 0.95, 1.0), 5.8))
	n.add_child(Util.cylinder(2.9, 0.3, Util.cmat(Color(0.35, 0.35, 0.4), 0.0, 0.8), Vector3(0, 0.1, 0)))
	portals.append({"node": n, "to": to, "pos": n.position, "min_ch": min_ch, "name": label})


# ======================================================================= TERRENO
func _make_terrain(half: float, cell: float, hfunc: Callable, cfunc: Callable) -> void:
	_hhalf = half
	_hcell = cell
	_hres = int(half * 2.0 / cell) + 1
	_hdata.resize(_hres * _hres)
	for iz in _hres:
		for ix in _hres:
			_hdata[iz * _hres + ix] = hfunc.call(-half + ix * cell, -half + iz * cell)

	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for iz in _hres:
		for ix in _hres:
			var x := -half + ix * cell
			var z := -half + iz * cell
			var h := _hdata[iz * _hres + ix]
			var hl := _hdata[iz * _hres + maxi(ix - 1, 0)]
			var hr := _hdata[iz * _hres + mini(ix + 1, _hres - 1)]
			var hd := _hdata[maxi(iz - 1, 0) * _hres + ix]
			var hu := _hdata[mini(iz + 1, _hres - 1) * _hres + ix]
			var nrm := Vector3(hl - hr, 2.0 * cell, hd - hu).normalized()
			st.set_normal(nrm)
			st.set_color(cfunc.call(x, z, h, nrm.y))
			st.set_uv(Vector2(ix, iz) / float(_hres))
			st.add_vertex(Vector3(x, h, z))
	for iz in _hres - 1:
		for ix in _hres - 1:
			var a := iz * _hres + ix
			var b := a + 1
			var c := a + _hres
			var d := c + 1
			st.add_index(a); st.add_index(b); st.add_index(c)
			st.add_index(b); st.add_index(d); st.add_index(c)
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	var sm := ShaderMaterial.new()
	sm.shader = TERRAIN_SHADER
	var nt := NoiseTexture2D.new()
	nt.seamless = true
	nt.width = 256
	nt.height = 256
	var fn := FastNoiseLite.new()
	fn.frequency = 0.03
	nt.noise = fn
	sm.set_shader_parameter("noise_tex", nt)
	sm.set_shader_parameter("detail", 1.0 if quality > 0 else 0.0)
	mi.material_override = sm
	root.add_child(mi)

	# Colisão: HeightMapShape3D com escala uniforme (altura dividida pela célula)
	var body := StaticBody3D.new()
	body.collision_layer = Util.LAYER_WORLD
	var cs := CollisionShape3D.new()
	var hs := HeightMapShape3D.new()
	hs.map_width = _hres
	hs.map_depth = _hres
	var scaled := PackedFloat32Array()
	scaled.resize(_hdata.size())
	for i in _hdata.size():
		scaled[i] = _hdata[i] / cell
	hs.map_data = scaled
	cs.shape = hs
	cs.scale = Vector3.ONE * cell
	body.add_child(cs)
	root.add_child(body)


func _flat_weight(x: float, z: float) -> Array:
	# devolve [peso, altura_alvo] do ponto plano mais forte
	var best_w := 0.0
	var best_h := 0.0
	for f in _flats:
		var d := Vector2(x, z).distance_to(f[0])
		var r: float = f[1]
		var w := 1.0 - smoothstep(r * 0.6, r, d)
		if w > best_w:
			best_w = w
			best_h = f[2]
	return [best_w, best_h]


func _water(pos: Vector3, size: Vector2, deep: Color, shallow: Color, glow := 0.0) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = size
	pm.subdivide_width = int(size.x / 3.0) if quality > 0 else 0
	pm.subdivide_depth = int(size.y / 3.0) if quality > 0 else 0
	mi.mesh = pm
	var sm := ShaderMaterial.new()
	sm.shader = WATER_SHADER
	var nt := NoiseTexture2D.new()
	nt.seamless = true
	nt.as_normal_map = true
	nt.bump_strength = 4.0
	nt.width = 256
	nt.height = 256
	var fn := FastNoiseLite.new()
	fn.frequency = 0.04
	nt.noise = fn
	sm.set_shader_parameter("normal_tex", nt)
	sm.set_shader_parameter("deep_color", deep)
	sm.set_shader_parameter("shallow_color", shallow)
	sm.set_shader_parameter("uv_scale", size.x / 12.0)
	sm.set_shader_parameter("glow", glow)
	mi.material_override = sm
	mi.position = pos
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(mi)
	return mi


# ======================================================================= VEGETAÇÃO
func _multimesh(mesh: Mesh, xforms: Array, colors: Array, mat: Material, shadows := true) -> MultiMeshInstance3D:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = not colors.is_empty()
	mm.mesh = mesh
	mm.instance_count = xforms.size()
	for i in xforms.size():
		mm.set_instance_transform(i, xforms[i])
		if mm.use_colors:
			mm.set_instance_color(i, colors[i])
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = mat
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if (shadows and quality >= 1) else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(mmi)
	return mmi


func _vc_mat(rough := 0.85, emission := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	m.roughness = rough
	if emission > 0.0:
		m.emission_enabled = true
		m.emission = Color.WHITE
		m.emission_energy_multiplier = emission
		m.emission_operator = BaseMaterial3D.EMISSION_OP_MULTIPLY
	return m


## Árvores: pinheiros e árvores de copa redonda, com colisão no tronco.
func _forest_trees(points: Array) -> void:
	var trunk_x := []
	var trunk_c := []
	var pine_x := []
	var pine_c := []
	var leaf_x := []
	var leaf_c := []
	_trees_body = StaticBody3D.new()
	_trees_body.collision_layer = Util.LAYER_WORLD
	root.add_child(_trees_body)
	for p in points:
		var s := _rng.randf_range(0.8, 1.6)
		var basis := Basis(Vector3.UP, _rng.randf() * TAU)
		var pos: Vector3 = p
		trunk_x.append(Transform3D(basis.scaled(Vector3(s, s, s)), pos + Vector3(0, 1.5 * s, 0)))
		trunk_c.append(Color(0.42, 0.3, 0.2).darkened(_rng.randf() * 0.3))
		if _rng.randf() < 0.55:
			for layer in 3:
				var ls := s * (1.0 - layer * 0.22)
				pine_x.append(Transform3D(basis.scaled(Vector3(ls, ls, ls)), pos + Vector3(0, (2.6 + layer * 1.5) * s, 0)))
				pine_c.append(Color(0.13, 0.36, 0.2).lightened(_rng.randf() * 0.12))
		else:
			leaf_x.append(Transform3D(basis.scaled(Vector3(s * 1.1, s * 0.95, s * 1.1)), pos + Vector3(0, 3.6 * s, 0)))
			leaf_c.append(Color(0.25, 0.5, 0.18).lightened(_rng.randf() * 0.15))
			leaf_x.append(Transform3D(basis.scaled(Vector3(s * 0.75, s * 0.7, s * 0.75)), pos + Vector3(0.6 * s, 4.6 * s, 0.3 * s)))
			leaf_c.append(Color(0.3, 0.56, 0.2).lightened(_rng.randf() * 0.15))
		var cs := CollisionShape3D.new()
		var cyl := CylinderShape3D.new()
		cyl.radius = 0.35 * s
		cyl.height = 4.0 * s
		cs.shape = cyl
		cs.position = pos + Vector3(0, 2.0 * s, 0)
		_trees_body.add_child(cs)
	var trunk := CylinderMesh.new()
	trunk.top_radius = 0.18
	trunk.bottom_radius = 0.32
	trunk.height = 3.0
	trunk.radial_segments = 6
	_multimesh(trunk, trunk_x, trunk_c, _vc_mat(0.95))
	var pine := CylinderMesh.new()
	pine.top_radius = 0.0
	pine.bottom_radius = 1.6
	pine.height = 2.2
	pine.radial_segments = 7
	_multimesh(pine, pine_x, pine_c, _vc_mat(0.9))
	var leaf := SphereMesh.new()
	leaf.radius = 1.7
	leaf.height = 3.0
	leaf.radial_segments = 8
	leaf.rings = 5
	_multimesh(leaf, leaf_x, leaf_c, _vc_mat(0.9))


func _grass_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in 5:
		var a := i * TAU / 5.0 + 0.3
		var off := Vector3(cos(a), 0, sin(a)) * 0.12
		var side := Vector3(-sin(a), 0, cos(a)) * 0.05
		var lean := Vector3(cos(a), 0, sin(a)) * 0.15
		var h := 0.5 + (i % 3) * 0.15
		var v := [off - side, off + side, off + lean + Vector3(0, h, 0)]
		var uv := [Vector2(0, 1), Vector2(1, 1), Vector2(0.5, 0)]
		for k in 3:
			st.set_normal(Vector3.UP)
			st.set_uv(uv[k])
			st.add_vertex(v[k])
	return st.commit()


func _grass(points: Array, base: Color, tip: Color) -> void:
	if points.is_empty():
		return
	var xs := []
	var cs := []
	for p in points:
		var s := _rng.randf_range(0.55, 1.1)
		xs.append(Transform3D(Basis(Vector3.UP, _rng.randf() * TAU).scaled(Vector3(s, s, s)), p))
		cs.append(Color.WHITE.darkened(_rng.randf() * 0.25))
	var sm := ShaderMaterial.new()
	sm.shader = GRASS_SHADER
	sm.set_shader_parameter("base_color", base)
	sm.set_shader_parameter("tip_color", tip)
	_multimesh(_grass_mesh(), xs, cs, sm, false)


func _flowers(points: Array) -> void:
	var xs := []
	var cs := []
	var palette := [Color(1, 0.85, 0.3), Color(1, 0.5, 0.7), Color(0.7, 0.6, 1.0), Color(1, 1, 1)]
	for p in points:
		xs.append(Transform3D(Basis.IDENTITY.scaled(Vector3.ONE * _rng.randf_range(0.8, 1.3)), p + Vector3(0, 0.35, 0)))
		cs.append(palette[_rng.randi() % palette.size()])
	var sm := SphereMesh.new()
	sm.radius = 0.09
	sm.height = 0.12
	sm.radial_segments = 6
	sm.rings = 3
	_multimesh(sm, xs, cs, _vc_mat(0.6, 0.6), false)


func _rocks(points: Array, color: Color, min_s: float, max_s: float, collide := true) -> void:
	var xs := []
	var cs := []
	var body := StaticBody3D.new()
	body.collision_layer = Util.LAYER_WORLD
	root.add_child(body)
	for p in points:
		var s := _rng.randf_range(min_s, max_s)
		var b := Basis.from_euler(Vector3(_rng.randf(), _rng.randf() * TAU, _rng.randf())).scaled(Vector3(s * _rng.randf_range(0.8, 1.4), s * _rng.randf_range(0.5, 0.9), s))
		xs.append(Transform3D(b, p))
		cs.append(color.lightened(_rng.randf() * 0.15).darkened(_rng.randf() * 0.15))
		if collide and s > 0.8:
			var c := CollisionShape3D.new()
			var sp := SphereShape3D.new()
			sp.radius = s * 0.75
			c.shape = sp
			c.position = p
			body.add_child(c)
	var mesh := SphereMesh.new()
	mesh.radius = 1.0
	mesh.height = 1.6
	mesh.radial_segments = 7
	mesh.rings = 4
	_multimesh(mesh, xs, cs, _vc_mat(0.95))


func _crystals(center: Vector3, count: int, color: Color, light := true) -> void:
	var cluster := Node3D.new()
	cluster.position = center
	root.add_child(cluster)
	var m := Util.cmat(color, 2.2, 0.15, 0.3)
	for j in count:
		var cr := Util.cone(0.32, _rng.randf_range(1.0, 2.8), m, Vector3(_rng.randf_range(-0.7, 0.7), 0.5, _rng.randf_range(-0.7, 0.7)))
		(cr.mesh as CylinderMesh).radial_segments = 5
		cr.rotation = Vector3(_rng.randf_range(-0.45, 0.45), 0, _rng.randf_range(-0.45, 0.45))
		cluster.add_child(cr)
	if light:
		var l := OmniLight3D.new()
		l.light_color = color
		l.omni_range = 11.0
		l.light_energy = 1.5
		l.position.y = 1.5
		l.shadow_enabled = false
		cluster.add_child(l)


# ======================================================================= CONSTRUÇÕES
func _sbox(size: Vector3, mat: Material, pos: Vector3, rot_y := 0.0) -> StaticBody3D:
	var b := Util.static_box(size, mat, pos, rot_y)
	root.add_child(b)
	return b


func _hut(pos: Vector3, scale := 1.0, shabby := false) -> void:
	var n := Node3D.new()
	n.position = ground(pos)
	n.rotation.y = _rng.randf() * TAU
	n.scale = Vector3.ONE * scale
	root.add_child(n)
	var wall := Util.cmat(Color(0.5, 0.38, 0.25) if not shabby else Color(0.4, 0.33, 0.25), 0.0, 0.95)
	var roof := Util.cmat(Color(0.72, 0.62, 0.35) if not shabby else Color(0.5, 0.45, 0.3), 0.0, 0.95)
	n.add_child(Util.cylinder(1.6, 2.0, wall, Vector3(0, 1.0, 0)))
	var r := Util.cone(2.3, 1.8, roof, Vector3(0, 2.9, 0))
	(r.mesh as CylinderMesh).radial_segments = 10
	n.add_child(r)
	n.add_child(Util.box(Vector3(0.8, 1.3, 0.1), Util.cmat(Color(0.15, 0.1, 0.07)), Vector3(0, 0.65, -1.58)))
	var body := StaticBody3D.new()
	body.collision_layer = Util.LAYER_WORLD
	var cs := CollisionShape3D.new()
	var cyl := CylinderShape3D.new()
	cyl.radius = 1.6
	cyl.height = 3.0
	cs.shape = cyl
	cs.position.y = 1.5
	body.add_child(cs)
	n.add_child(body)


func _house(pos: Vector3, size: Vector3, wall_c: Color, roof_c: Color, rot := 0.0, chimney := false) -> void:
	var n := Node3D.new()
	n.position = ground(pos)
	n.rotation.y = rot
	root.add_child(n)
	var body := Util.static_box(size, Util.cmat(wall_c, 0.0, 0.9), Vector3(0, size.y / 2.0, 0))
	n.add_child(body)
	# base de pedra
	n.add_child(Util.box(Vector3(size.x + 0.3, 0.5, size.z + 0.3), Util.cmat(Color(0.45, 0.43, 0.42)), Vector3(0, 0.25, 0)))
	# telhado em prisma
	var pm := PrismMesh.new()
	pm.size = Vector3(size.x + 0.8, size.y * 0.6, size.z + 0.8)
	var roof := Util.mesh_node(pm, Util.cmat(roof_c, 0.0, 0.8), Vector3(0, size.y + size.y * 0.3, 0))
	n.add_child(roof)
	# porta e janelas (as janelas brilham à noite/na caverna)
	n.add_child(Util.box(Vector3(1.0, 1.8, 0.1), Util.cmat(Color(0.3, 0.2, 0.12)), Vector3(0, 0.9, -size.z / 2.0 - 0.05)))
	var win := Util.cmat(Color(1.0, 0.8, 0.45), 1.2)
	for x in [-size.x * 0.3, size.x * 0.3]:
		n.add_child(Util.box(Vector3(0.7, 0.7, 0.1), win, Vector3(x, size.y * 0.6, -size.z / 2.0 - 0.05)))
	if chimney:
		n.add_child(Util.box(Vector3(0.6, 1.6, 0.6), Util.cmat(Color(0.5, 0.45, 0.42)), Vector3(size.x * 0.3, size.y * 1.3, size.z * 0.2)))


func _fence_ring(center: Vector3, radius: float, gaps: Array, post_c := Color(0.45, 0.32, 0.2)) -> void:
	var m := Util.cmat(post_c, 0.0, 0.95)
	var count := int(TAU * radius / 1.2)
	for i in count:
		var a := i * TAU / count
		var skip := false
		for g in gaps:
			if absf(wrapf(a - g, -PI, PI)) < 0.12:
				skip = true
		if skip:
			continue
		var p := center + Vector3(cos(a), 0, sin(a)) * radius
		var post := Util.cone(0.18, 2.2, m, ground(p, 1.1))
		(post.mesh as CylinderMesh).top_radius = 0.12
		root.add_child(post)


func _stone_wall_ring(center: Vector3, radius: float, gaps: Array) -> void:
	var m := Util.cmat(Color(0.62, 0.6, 0.56), 0.0, 0.9)
	var count := 28
	for i in count:
		var a := (i + 0.5) * TAU / count
		var skip := false
		for g in gaps:
			if absf(wrapf(a - g, -PI, PI)) < 0.2:
				skip = true
		var p := center + Vector3(cos(a), 0, sin(a)) * radius
		if not skip:
			var seg_len := TAU * radius / count + 0.4
			var w := _sbox(Vector3(seg_len, 4.5, 1.4), m, ground(p, 2.0), -a + PI / 2)
			w.rotation.y = -a + PI / 2
		if i % 4 == 0:
			var t := ground(p)
			_sbox(Vector3(3.0, 7.0, 3.0), m, t + Vector3(0, 3.5, 0))
			var roof := Util.cone(2.4, 2.0, Util.cmat(Color(0.25, 0.35, 0.6)), t + Vector3(0, 8.0, 0))
			root.add_child(roof)
			var lamp := OmniLight3D.new()
			lamp.light_color = Color(1.0, 0.75, 0.4)
			lamp.light_energy = 1.0
			lamp.omni_range = 8.0
			lamp.position = t + Vector3(0, 6.0, 0)
			if quality >= 1:
				root.add_child(lamp)


func _campfire(pos: Vector3) -> void:
	var p := ground(pos)
	var wood := Util.cmat(Color(0.3, 0.2, 0.12))
	for i in 4:
		var lg := Util.cylinder(0.1, 1.2, wood, p + Vector3(0, 0.12, 0))
		lg.rotation = Vector3(PI / 2, i * PI / 4, 0)
		root.add_child(lg)
	var fire := Util.cone(0.35, 0.9, Util.cmat(Color(1.0, 0.55, 0.15), 4.0), p + Vector3(0, 0.5, 0))
	root.add_child(fire)
	var l := OmniLight3D.new()
	l.light_color = Color(1.0, 0.6, 0.25)
	l.light_energy = 2.5
	l.omni_range = 10.0
	l.position = p + Vector3(0, 1.2, 0)
	root.add_child(l)
	_fire_particles(p + Vector3(0, 0.4, 0), 0.35, 24)


func _fire_particles(pos: Vector3, radius: float, amount: int, color := Color(1.0, 0.5, 0.15)) -> void:
	var p := GPUParticles3D.new()
	p.amount = amount
	p.lifetime = 1.0
	p.position = pos
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	pm.emission_sphere_radius = radius
	pm.gravity = Vector3(0, 3.0, 0)
	pm.initial_velocity_min = 0.2
	pm.initial_velocity_max = 0.8
	pm.scale_min = 0.6
	pm.scale_max = 1.2
	var g := Gradient.new()
	g.set_color(0, Color(color.lightened(0.4), 1.0))
	g.set_color(1, Color(color.darkened(0.4), 0.0))
	var gt := GradientTexture1D.new()
	gt.gradient = g
	pm.color_ramp = gt
	p.process_material = pm
	var q := QuadMesh.new()
	q.size = Vector2(0.5, 0.5)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.vertex_color_use_as_albedo = true
	m.albedo_texture = _soft_dot()
	q.material = m
	p.draw_pass_1 = q
	root.add_child(p)


func _lantern(pos: Vector3, color := Color(1.0, 0.75, 0.4), with_light := true) -> void:
	var p := ground(pos)
	root.add_child(Util.cylinder(0.07, 2.6, Util.cmat(Color(0.2, 0.15, 0.1)), p + Vector3(0, 1.3, 0)))
	root.add_child(Util.sphere(0.25, Util.cmat(color, 3.0), p + Vector3(0, 2.7, 0)))
	if with_light and quality >= 1:
		var l := OmniLight3D.new()
		l.light_color = color
		l.light_energy = 1.2
		l.omni_range = 7.0
		l.position = p + Vector3(0, 2.7, 0)
		root.add_child(l)


# ======================================================================= CAVERNA SELADA
const CAVE_HALF := 55.0

func _build_cave() -> void:
	_environment(Color(0.01, 0.015, 0.04), Color(0.35, 0.4, 0.6), Color.BLACK, Color(0.08, 0.1, 0.2), 0.012,
		Vector3(0.3, -1.0, 0.2), Color(0.5, 0.6, 0.9), 0.3, 0.75, true)
	var rock := Util.cmat(Color(0.22, 0.2, 0.24), 0.0, 0.95)
	var rock_dark := Util.cmat(Color(0.14, 0.13, 0.17), 0.0, 0.95)
	var size := CAVE_HALF * 2.0
	# chão com leve variação de cor (terreno plano com shader)
	_flats.clear()
	_make_terrain(CAVE_HALF + 2.0, 2.0, func(x, z): return 0.0,
		func(x, z, h, ny):
			var n := _noise2.get_noise_2d(x, z)
			return Color(0.2, 0.19, 0.24).lerp(Color(0.13, 0.15, 0.22), n * 0.5 + 0.5))
	_hdata = PackedFloat32Array()  # caverna é plana: altura 0
	_sbox(Vector3(size, 1, size), rock_dark, Vector3(0, 22, 0))
	for i in 4:
		var horizontal := i < 2
		var sgn := -1.0 if i % 2 == 0 else 1.0
		var wsize := Vector3(size + 2, 24, 2) if horizontal else Vector3(2, 24, size + 2)
		var wpos := Vector3(0, 11, sgn * CAVE_HALF) if horizontal else Vector3(sgn * CAVE_HALF, 11, 0)
		_sbox(wsize, rock, wpos)

	var keep_clear := [Vector3(0, 0, 14), Vector3(0, 0, -20), Vector3(-28, 0, 5), Vector3(0, 0, 48)]
	var placed := 0
	var boulders := []
	while placed < 38:
		var p := Vector3(_rng.randf_range(-50, 50), 0, _rng.randf_range(-50, 50))
		var ok := true
		for c in keep_clear:
			if p.distance_to(c) < 11.0:
				ok = false
		if not ok:
			continue
		placed += 1
		if _rng.randf() < 0.4:
			var h := _rng.randf_range(6, 22)
			var w := _rng.randf_range(1.5, 3.5)
			_sbox(Vector3(w, h, w), rock, p + Vector3(0, h / 2.0, 0), _rng.randf() * TAU)
			var tip := Util.cone(w * 0.8, 3.0, rock, p + Vector3(0, h + 1.5, 0))
			root.add_child(tip)
		else:
			boulders.append(p + Vector3(0, 0.6, 0))
	_rocks(boulders, Color(0.18, 0.17, 0.22), 1.2, 2.6)
	var pebbles := []
	for i in 160:
		pebbles.append(Vector3(_rng.randf_range(-52, 52), 0.1, _rng.randf_range(-52, 52)))
	_rocks(pebbles, Color(0.25, 0.23, 0.28), 0.15, 0.5, false)

	for i in 70:
		var h := _rng.randf_range(1.5, 6.0)
		var st := Util.cone(_rng.randf_range(0.4, 1.2), h, rock_dark,
			Vector3(_rng.randf_range(-52, 52), 21.5 - h / 2.0, _rng.randf_range(-52, 52)))
		st.rotation.x = PI
		root.add_child(st)

	var colors := [Color(0.3, 0.6, 1.0), Color(0.6, 0.35, 1.0), Color(0.2, 0.9, 0.8)]
	for i in 22:
		_crystals(Vector3(_rng.randf_range(-50, 50), 0, _rng.randf_range(-50, 50)), 4 + _rng.randi() % 3, colors[i % 3], i % 2 == 0 or quality >= 1)
	# cogumelos brilhantes
	var shrooms := []
	var sc := []
	for i in 120:
		shrooms.append(Transform3D(Basis.IDENTITY.scaled(Vector3.ONE * _rng.randf_range(0.6, 1.5)), Vector3(_rng.randf_range(-52, 52), 0.15, _rng.randf_range(-52, 52))))
		sc.append(colors[_rng.randi() % 3])
	var sm := SphereMesh.new()
	sm.radius = 0.2
	sm.height = 0.2
	sm.is_hemisphere = true
	_multimesh(sm, shrooms, sc, _vc_mat(0.4, 2.0), false)

	# Lago subterrâneo (Propulsão Hidráulica)
	_water(Vector3(-28, 0.05, 5), Vector2(19, 19), Color(0.05, 0.25, 0.6, 0.8), Color(0.3, 0.7, 1.0, 0.6), 0.6)
	# Passagem de saída (sul)
	_portal("forest", Vector3(0, 0, 50), 2, "Saída da Caverna", Color(1.0, 0.9, 0.6))
	_ambient_particles(Color(0.5, 0.75, 1.0), 120, 0.12, 0.15, 2.0)


# ======================================================================= FLORESTA DE JURA + TEMPEST
const FOREST_FEATURES := [
	# centro, raio, altura alvo
	[Vector2(0, 0), 48.0, 1.0],          # Tempest
	[Vector2(-95, 35), 34.0, -3.5],      # lago
	[Vector2(-55, -125), 16.0, 2.0],     # entrada da caverna
	[Vector2(-110, -95), 40.0, 0.2],     # pântano dos homens-lagarto
	[Vector2(105, 100), 26.0, 3.0],      # vila ogra destruída
	[Vector2(62, -66), 22.0, 1.5],       # clareira do Ifrit
	[Vector2(-25, 118), 22.0, 2.5],      # Grande Árvore da Treyni
	[Vector2(-20, 100), 12.0, 2.5],      # duelo do Gabiru
	[Vector2(122, -78), 24.0, 1.5],      # estrada da Hinata
	[Vector2(125, 12), 34.0, 1.5],       # front imperial
	[Vector2(-140, -10), 12.0, 2.0],     # portal Dwargon
	[Vector2(10, -140), 12.0, 1.5],      # portal Falmuth
	[Vector2(135, -135), 12.0, 1.5],     # portal Walpurgis
]
const ROAD_TARGETS := [Vector2(-55, -125), Vector2(-140, -10), Vector2(10, -140), Vector2(135, -135), Vector2(62, -66), Vector2(105, 100), Vector2(-25, 118), Vector2(125, 12), Vector2(-110, -95)]


func _forest_height(x: float, z: float) -> float:
	var h := _noise.get_noise_2d(x, z) * 9.0 + _noise2.get_noise_2d(x, z) * 0.8
	var d := maxf(absf(x), absf(z))
	if d > 128.0:
		h += pow(d - 128.0, 1.35) * 0.9
	var fw: Array = _flat_weight(x, z)
	return lerpf(h, fw[1], fw[0])


func _road_dist(x: float, z: float) -> float:
	var best := 999.0
	var p := Vector2(x, z)
	for t in ROAD_TARGETS:
		var seg: Vector2 = t
		var proj := clampf(p.dot(seg) / seg.length_squared(), 0.0, 1.0)
		best = minf(best, p.distance_to(seg * proj))
	return best


func _build_forest() -> void:
	_environment(Color(0.28, 0.52, 0.9), Color(0.72, 0.82, 0.92), Color(0.2, 0.25, 0.15), Color(0.7, 0.8, 0.9), 0.0035,
		Vector3(-0.5, -0.8, -0.35), Color(1.0, 0.95, 0.85), 1.25, 0.8)
	for f in FOREST_FEATURES:
		_flats.append(f)
	_make_terrain(160.0, 2.0, _forest_height, func(x, z, h, ny):
		var grass := Color(0.32, 0.52, 0.2).lerp(Color(0.42, 0.58, 0.24), _noise2.get_noise_2d(x * 0.5, z * 0.5) * 0.5 + 0.5)
		var c := grass
		if Vector2(x, z).distance_to(MARSH) < 40.0:
			c = Color(0.3, 0.36, 0.2)
		if h < -0.6:
			c = Color(0.55, 0.5, 0.38)  # areia do lago
		if _road_dist(x, z) < 2.6 and h > -0.5:
			c = Color(0.55, 0.45, 0.32)
		if ny < 0.8:
			c = c.lerp(Color(0.45, 0.42, 0.4), clampf((0.8 - ny) * 4.0, 0.0, 1.0))
		if h > 14.0:
			c = c.lerp(Color(0.5, 0.48, 0.47), clampf((h - 14.0) / 8.0, 0.0, 1.0))
		if h > 26.0:
			c = c.lerp(Color(0.95, 0.96, 1.0), clampf((h - 26.0) / 6.0, 0.0, 1.0))
		return c)
	_water(Vector3(LAKE.x, -0.4, LAKE.y), Vector2(70, 70), Color(0.04, 0.22, 0.38, 0.9), Color(0.3, 0.6, 0.75, 0.75))
	_water(Vector3(MARSH.x, 0.45, MARSH.y), Vector2(60, 60), Color(0.12, 0.2, 0.12, 0.85), Color(0.35, 0.45, 0.3, 0.7))

	# vegetação
	var tree_n: int = [320, 520, 800][quality]
	var trees := []
	var tries := 0
	while trees.size() < tree_n and tries < tree_n * 8:
		tries += 1
		var x := _rng.randf_range(-138, 138)
		var z := _rng.randf_range(-138, 138)
		if _too_close_feature(x, z, 6.0) or _road_dist(x, z) < 4.0:
			continue
		var h := height_at(x, z)
		if h < 0.3 or h > 22.0:
			continue
		trees.append(Vector3(x, h - 0.1, z))
	_forest_trees(trees)
	var grass_n: int = [1500, 6000, 14000][quality]
	var gp := []
	var fp := []
	tries = 0
	while gp.size() < grass_n and tries < grass_n * 4:
		tries += 1
		var gx := _rng.randf_range(-130, 130)
		var gz := _rng.randf_range(-130, 130)
		# mais grama perto de Tempest e das estradas
		if quality < 2 and Vector2(gx, gz).length() > 70.0 and _rng.randf() < 0.6:
			continue
		var gh := height_at(gx, gz)
		if gh < 0.2 or gh > 14.0 or _road_dist(gx, gz) < 2.5 or (Vector2(gx, gz).length() < 30.0 and town_level >= 3):
			continue
		gp.append(Vector3(gx, gh, gz))
		if _rng.randf() < 0.06:
			fp.append(Vector3(gx + 0.3, gh, gz))
	_grass(gp, Color(0.13, 0.3, 0.08), Color(0.55, 0.78, 0.3))
	_flowers(fp)
	var rocks := []
	for i in 140:
		var rx := _rng.randf_range(-140, 140)
		var rz := _rng.randf_range(-140, 140)
		if _too_close_feature(rx, rz, 2.0):
			continue
		rocks.append(ground(Vector3(rx, 0, rz), 0.2))
	_rocks(rocks, Color(0.48, 0.47, 0.45), 0.5, 2.2)

	_build_tempest()
	_build_landmarks()
	_portal("cave", Vector3(-55, 0, -125), 2, "Caverna Selada", Color(0.7, 0.6, 1.0))
	_portal("dwargon", Vector3(-140, 0, -10), 3, "Reino Anão Dwargon", Color(1.0, 0.7, 0.3))
	_portal("falmuth", Vector3(10, 0, -140), 8, "Planícies de Falmuth", Color(1.0, 0.4, 0.3))
	_portal("walpurgis", Vector3(135, 0, -135), 9, "Walpurgis", Color(0.8, 0.2, 0.4))
	_ambient_particles(Color(0.85, 1.0, 0.5), 60, 0.1, 0.05, 1.5)


func _too_close_feature(x: float, z: float, margin: float) -> bool:
	for f in FOREST_FEATURES:
		if Vector2(x, z).distance_to(f[0]) < float(f[1]) * 0.75 + margin:
			return true
	return false


func _build_tempest() -> void:
	var c := Vector3.ZERO
	_campfire(Vector3(0, 0, 0) if town_level < 5 else Vector3(0, 0, -30))
	if town_level <= 1:
		var huts := 6 if town_level == 0 else 11
		for i in huts:
			var a := i * TAU / huts + 0.3
			_hut(Vector3(cos(a), 0, sin(a)) * _rng.randf_range(11, 20), _rng.randf_range(0.8, 1.1), town_level == 0)
		_fence_ring(c, 26.0, [0.0, PI / 2, PI, -PI / 2] if town_level == 1 else [0.0, 1.0, 2.5, 4.0, 5.0])
		return
	# Cidade crescendo: casas de madeira dos anões
	var wall_cs := [Color(0.7, 0.58, 0.42), Color(0.78, 0.7, 0.55), Color(0.65, 0.55, 0.45)]
	var roof_cs := [Color(0.55, 0.25, 0.18), Color(0.3, 0.35, 0.5), Color(0.4, 0.3, 0.2)]
	var ring_counts := [8, 12, 16]
	var rings := 1 if town_level == 2 else (2 if town_level == 3 else 3)
	for r in rings:
		var radius := 14.0 + r * 10.0
		var n: int = ring_counts[r]
		for i in n:
			var a := (i + 0.5 * r) * TAU / n
			if absf(wrapf(a - (-PI / 2), -PI, PI)) < 0.25 or absf(wrapf(a - PI / 2, -PI, PI)) < 0.25:
				continue  # deixa ruas livres
			var p := Vector3(cos(a), 0, sin(a)) * radius
			var size := Vector3(_rng.randf_range(4, 6), _rng.randf_range(3, 4.5), _rng.randf_range(4, 5.5))
			_house(p, size, wall_cs[(i + r) % 3], roof_cs[(i * 2 + r) % 3], -a + PI / 2, i % 3 == 0)
	# ruas de pedra
	if town_level >= 3:
		var road := Util.cmat(Color(0.6, 0.58, 0.55), 0.0, 0.95)
		for rot in [0.0, PI / 2]:
			var strip := Util.box(Vector3(5, 0.12, 90), road, Vector3(0, height_at(0, 0) + 0.05, 0))
			strip.rotation.y = rot
			root.add_child(strip)
		# portal torii dos Kijin
		var red := Util.cmat(Color(0.8, 0.15, 0.1))
		var tp := ground(Vector3(0, 0, 40))
		_sbox(Vector3(0.6, 6, 0.6), red, tp + Vector3(-3.5, 3, 0))
		_sbox(Vector3(0.6, 6, 0.6), red, tp + Vector3(3.5, 3, 0))
		root.add_child(Util.box(Vector3(9.5, 0.6, 0.8), red, tp + Vector3(0, 6.1, 0)))
		root.add_child(Util.box(Vector3(8.5, 0.4, 0.6), red, tp + Vector3(0, 5.2, 0)))
		for i in 8:
			var a2 := i * TAU / 8.0
			_lantern(Vector3(cos(a2), 0, sin(a2)) * 9.0, Color(1.0, 0.7, 0.4), i % 2 == 0)
	if town_level >= 4:
		_stone_wall_ring(c, 46.0, [PI / 2, -PI / 2, 0.0, PI])
		# mercado
		for i in 6:
			var mp := Vector3(-8 + i * 3.2, 0, 34)
			var cloth := Util.cmat([Color(0.9, 0.3, 0.3), Color(0.3, 0.6, 0.9), Color(0.95, 0.8, 0.3)][i % 3])
			var g := ground(mp)
			root.add_child(Util.box(Vector3(2.6, 0.9, 1.4), Util.cmat(Color(0.5, 0.35, 0.2)), g + Vector3(0, 0.45, 0)))
			root.add_child(Util.box(Vector3(2.9, 0.1, 1.8), cloth, g + Vector3(0, 2.2, 0)))
	if town_level >= 5:
		# Palácio do Rimuru + estátua do slime + lanternas do festival
		var pp := ground(Vector3(0, 0, -30))
		_sbox(Vector3(18, 7, 10), Util.cmat(Color(0.92, 0.9, 0.86)), pp + Vector3(0, 3.5, 0))
		var pm := PrismMesh.new()
		pm.size = Vector3(20, 4, 12)
		root.add_child(Util.mesh_node(pm, Util.cmat(Color(0.25, 0.45, 0.85), 0.0, 0.5, 0.3), pp + Vector3(0, 9, 0)))
		_sbox(Vector3(6, 12, 6), Util.cmat(Color(0.92, 0.9, 0.86)), pp + Vector3(0, 6, 0))
		root.add_child(Util.cone(4.5, 4.0, Util.cmat(Color(0.25, 0.45, 0.85), 0.0, 0.5, 0.3), pp + Vector3(0, 14, 0)))
		var sp := ground(Vector3(0, 0, -12))
		root.add_child(Util.cylinder(3.0, 0.8, Util.cmat(Color(0.7, 0.7, 0.72)), sp + Vector3(0, 0.4, 0)))
		_water(sp + Vector3(0, 0.75, 0), Vector2(5.2, 5.2), Color(0.1, 0.4, 0.8, 0.8), Color(0.4, 0.8, 1.0, 0.7), 0.3)
		var statue := Util.sphere(1.3, Util.cmat(Color(0.4, 0.75, 1.0), 0.8, 0.1, 0.2), sp + Vector3(0, 2.2, 0))
		statue.scale = Vector3(1, 0.8, 1)
		root.add_child(statue)
		for i in 16:
			var a3 := i * TAU / 16.0
			var lp := Vector3(cos(a3), 0, sin(a3)) * 30.0
			var lcol: Color = [Color(1.0, 0.4, 0.3), Color(1.0, 0.85, 0.4), Color(0.5, 0.8, 1.0)][i % 3]
			_lantern(lp, lcol, i % 4 == 0)


func _build_landmarks() -> void:
	# Entrada da caverna: arco de rochas
	var cp := ground(Vector3(-55, 0, -130))
	var rock := Util.cmat(Color(0.4, 0.38, 0.4), 0.0, 0.95)
	_sbox(Vector3(3, 9, 4), rock, cp + Vector3(-5, 4.5, 0))
	_sbox(Vector3(3, 9, 4), rock, cp + Vector3(5, 4.5, 0))
	_sbox(Vector3(13, 3, 4), rock, cp + Vector3(0, 9.5, 0))
	# Grande Árvore da Treyni
	var tp := ground(Vector3(-25, 0, 125))
	var bark := Util.cmat(Color(0.4, 0.3, 0.22), 0.0, 0.95)
	_sbox(Vector3(4, 22, 4), bark, tp + Vector3(0, 11, 0))
	var leaf := Util.cmat(Color(0.35, 0.65, 0.3), 0.3, 0.8)
	for i in 6:
		var a := i * TAU / 6.0
		var s := Util.sphere(6.0, leaf, tp + Vector3(cos(a) * 6.0, 22 + (i % 2) * 3.0, sin(a) * 6.0))
		root.add_child(s)
	root.add_child(Util.sphere(8.0, leaf, tp + Vector3(0, 27, 0)))
	_fire_particles(tp + Vector3(0, 15, 0), 10.0, 40, Color(0.6, 1.0, 0.6))
	# Vila ogra destruída (casas queimadas)
	var burnt := Util.cmat(Color(0.12, 0.1, 0.09), 0.0, 1.0)
	for i in 6:
		var a := i * TAU / 6.0
		var bp := ground(Vector3(105, 0, 100) + Vector3(cos(a), 0, sin(a)) * 14.0)
		_sbox(Vector3(4, 1.6 + _rng.randf() * 1.5, 0.5), burnt, bp + Vector3(0, 1, 0), _rng.randf() * TAU)
		_sbox(Vector3(0.5, 2.5, 4), burnt, bp + Vector3(1.5, 1.2, 0), _rng.randf() * TAU)
	_fire_particles(ground(Vector3(105, 0, 100), 0.5), 10.0, 30, Color(0.4, 0.35, 0.3))
	# Pântano: juncos
	var reeds := []
	for i in 260:
		var a := _rng.randf() * TAU
		var r := _rng.randf_range(4, 36)
		reeds.append(ground(Vector3(MARSH.x + cos(a) * r, 0, MARSH.y + sin(a) * r)))
	_grass(reeds, Color(0.2, 0.25, 0.1), Color(0.5, 0.55, 0.25))
	# Acampamento imperial (tendas)
	if town_level >= 5:
		for i in 6:
			var tpos := ground(Vector3(145, 0, -5 + i * 6))
			var tent := Util.cone(2.5, 3.0, Util.cmat(Color(0.35, 0.38, 0.28)), tpos + Vector3(0, 1.5, 0))
			(tent.mesh as CylinderMesh).radial_segments = 4
			root.add_child(tent)


# ======================================================================= DWARGON
func _build_dwargon() -> void:
	_environment(Color(0.03, 0.02, 0.02), Color(0.6, 0.45, 0.35), Color.BLACK, Color(0.3, 0.18, 0.1), 0.008,
		Vector3(0.2, -1.0, 0.3), Color(1.0, 0.8, 0.6), 0.35, 0.7, true)
	var half := 60.0
	_make_terrain(half + 2.0, 2.0, func(x, z): return 0.0,
		func(x, z, h, ny):
			var tile := (int(floor(x / 4.0)) + int(floor(z / 4.0))) % 2 == 0
			var base := Color(0.42, 0.38, 0.35) if tile else Color(0.36, 0.33, 0.31)
			if absf(x) < 4.0 or absf(z - 10.0) < 3.0:
				base = Color(0.55, 0.5, 0.42)
			return base)
	_hdata = PackedFloat32Array()
	var stone := Util.cmat(Color(0.35, 0.3, 0.28), 0.0, 0.9)
	_sbox(Vector3(half * 2, 1, half * 2), Util.cmat(Color(0.12, 0.1, 0.1)), Vector3(0, 30, 0))
	for i in 4:
		var horizontal := i < 2
		var sgn := -1.0 if i % 2 == 0 else 1.0
		_sbox(Vector3(half * 2 + 2, 32, 2) if horizontal else Vector3(2, 32, half * 2 + 2), stone,
			Vector3(0, 15, sgn * half) if horizontal else Vector3(sgn * half, 15, 0))
	# Casas de pedra dos anões em fileiras
	var wall_c := Color(0.6, 0.55, 0.48)
	for row in [-1, 1]:
		for i in 6:
			_house(Vector3(row * 14, 0, 25 - i * 11), Vector3(7, 5, 7), wall_c, Color(0.45, 0.3, 0.2), PI / 2 * row, true)
	# Salão do trono do Rei Gazel
	var gold := Util.cmat(Color(0.95, 0.75, 0.25), 0.4, 0.3, 0.9)
	_sbox(Vector3(20, 1.2, 10), stone, Vector3(0, 0.6, -42))
	_sbox(Vector3(4, 4, 2), gold, Vector3(0, 3.2, -45))
	for x in [-8, 8]:
		_sbox(Vector3(2, 20, 2), Util.cmat(Color(0.55, 0.5, 0.45)), Vector3(x, 10, -38))
		var banner := Util.box(Vector3(2.5, 6, 0.1), Util.cmat(Color(0.75, 0.1, 0.1)), Vector3(x, 12, -36.9))
		root.add_child(banner)
	# Forjas com lava
	for p in [Vector3(-30, 0, 30), Vector3(30, 0, 30), Vector3(-35, 0, -10)]:
		_sbox(Vector3(5, 3, 5), stone, p + Vector3(0, 1.5, 0))
		var lava := Util.box(Vector3(3, 0.2, 3), Util.cmat(Color(1.0, 0.4, 0.05), 4.0), p + Vector3(0, 3.05, 0))
		root.add_child(lava)
		_fire_particles(p + Vector3(0, 3.4, 0), 1.2, 30)
		var l := OmniLight3D.new()
		l.light_color = Color(1.0, 0.5, 0.2)
		l.light_energy = 3.0
		l.omni_range = 14.0
		l.position = p + Vector3(0, 5, 0)
		root.add_child(l)
	# Canal de lava ao fundo
	root.add_child(Util.box(Vector3(100, 0.3, 4), Util.cmat(Color(1.0, 0.35, 0.05), 3.0), Vector3(0, 0.05, -55)))
	# Mina (leste) com cristais
	for i in 8:
		_crystals(Vector3(_rng.randf_range(30, 55), 0, _rng.randf_range(-55, -25)), 4, Color(0.6, 0.35, 1.0), i % 2 == 0)
	for i in 18:
		_lantern(Vector3(-4 if i % 2 == 0 else 4, 0, 40 - i * 5), Color(1.0, 0.75, 0.4), i % 3 == 0)
	_portal("forest", Vector3(0, 0, 52), 3, "Floresta de Jura", Color(0.5, 1.0, 0.5))
	_ambient_particles(Color(1.0, 0.6, 0.3), 80, 0.08, 0.6, 2.0)


# ======================================================================= FALMUTH
func _build_falmuth() -> void:
	_environment(Color(0.35, 0.3, 0.38), Color(0.95, 0.6, 0.4), Color(0.25, 0.2, 0.15), Color(0.8, 0.6, 0.5), 0.005,
		Vector3(0.6, -0.35, 0.5), Color(1.0, 0.7, 0.45), 1.2, 0.7)
	_make_terrain(120.0, 2.0, func(x, z):
		var h := _noise.get_noise_2d(x, z) * 3.0
		var d := maxf(absf(x), absf(z))
		if d > 100.0:
			h += pow(d - 100.0, 1.3) * 0.8
		return h,
		func(x, z, h, ny):
			var c := Color(0.55, 0.55, 0.3).lerp(Color(0.45, 0.5, 0.25), _noise2.get_noise_2d(x, z) * 0.5 + 0.5)
			if absf(x) < 3.0:
				c = Color(0.5, 0.42, 0.3)
			return c)
	# muralha do castelo de Falmuth ao norte
	var stone := Util.cmat(Color(0.65, 0.63, 0.6), 0.0, 0.9)
	for i in 9:
		var x := -80 + i * 20
		_sbox(Vector3(20, 12, 4), stone, ground(Vector3(x, 0, -92), 6))
		_sbox(Vector3(6, 20, 6), stone, ground(Vector3(x, 0, -92), 10))
		root.add_child(Util.cone(4.5, 6.0, Util.cmat(Color(0.2, 0.3, 0.65)), ground(Vector3(x, 0, -92), 23)))
	# acampamento do exército
	for i in 14:
		var tp := ground(Vector3(_rng.randf_range(-50, 50), 0, _rng.randf_range(-50, -15)))
		var tent := Util.cone(2.5, 3.0, Util.cmat(Color(0.85, 0.85, 0.8)), tp + Vector3(0, 1.5, 0))
		(tent.mesh as CylinderMesh).radial_segments = 6
		root.add_child(tent)
		root.add_child(Util.cylinder(0.05, 5.0, Util.cmat(Color(0.3, 0.2, 0.1)), tp + Vector3(1.5, 2.5, 1.5)))
		root.add_child(Util.box(Vector3(1.2, 0.8, 0.05), Util.cmat(Color(0.2, 0.3, 0.75)), tp + Vector3(2.1, 4.5, 1.5)))
	var tree_pts := []
	for i in 120:
		var x2 := _rng.randf_range(-100, 100)
		var z2 := _rng.randf_range(-80, 100)
		if absf(x2) < 12.0 or (z2 > -60 and z2 < 50 and absf(x2) < 60):
			continue
		tree_pts.append(ground(Vector3(x2, 0, z2), -0.1))
	_forest_trees(tree_pts)
	var gp := []
	for i in [800, 3000, 7000][quality]:
		var gx := _rng.randf_range(-95, 95)
		var gz := _rng.randf_range(-85, 95)
		gp.append(ground(Vector3(gx, 0, gz)))
	_grass(gp, Color(0.3, 0.32, 0.12), Color(0.7, 0.68, 0.35))
	_portal("forest", Vector3(0, 0, 105), 8, "Voltar a Tempest", Color(0.5, 1.0, 0.5))
	_ambient_particles(Color(1.0, 0.8, 0.5), 40, 0.08, 0.2, 1.2)


# ======================================================================= WALPURGIS
func _build_walpurgis() -> void:
	_environment(Color(0.02, 0.0, 0.05), Color(0.35, 0.08, 0.15), Color(0.02, 0.0, 0.02), Color(0.25, 0.05, 0.12), 0.006,
		Vector3(0.2, -0.6, 0.6), Color(0.9, 0.5, 0.6), 0.6, 0.5)
	_make_terrain(60.0, 2.0, func(x, z): return 0.0,
		func(x, z, h, ny):
			var r := Vector2(x, z).length()
			var ring := int(r / 6.0) % 2 == 0
			var c := Color(0.85, 0.83, 0.86) if ring else Color(0.2, 0.18, 0.22)
			if r > 48.0:
				c = Color(0.1, 0.08, 0.12)
			if absf(fmod(atan2(z, x) * 8.0 / TAU + 8.0, 1.0) - 0.5) < 0.03 and r < 48.0:
				c = Color(0.8, 0.65, 0.25)
			return c)
	_hdata = PackedFloat32Array()
	var marble := Util.cmat(Color(0.88, 0.86, 0.9), 0.0, 0.25)
	for i in 16:
		var a := i * TAU / 16.0
		var p := Vector3(cos(a), 0, sin(a)) * 50.0
		_sbox(Vector3(2.5, 18, 2.5), marble, p + Vector3(0, 9, 0))
		root.add_child(Util.sphere(0.6, Util.cmat(Color(1.0, 0.3, 0.4), 3.5), p + Vector3(0, 18.6, 0)))
	# barreira invisível
	for i in 4:
		var horizontal := i < 2
		var sgn := -1.0 if i % 2 == 0 else 1.0
		var b := StaticBody3D.new()
		b.collision_layer = Util.LAYER_WORLD
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = Vector3(120, 30, 2) if horizontal else Vector3(2, 30, 120)
		cs.shape = bs
		b.add_child(cs)
		b.position = Vector3(0, 15, sgn * 56) if horizontal else Vector3(sgn * 56, 15, 0)
		root.add_child(b)
	# mesa redonda dos Lordes Demônio
	var tp := Vector3(0, 0, -22)
	root.add_child(Util.cylinder(9.0, 0.4, Util.cmat(Color(0.25, 0.1, 0.12), 0.0, 0.3), tp + Vector3(0, 1.4, 0)))
	_sbox(Vector3(3, 1.4, 3), Util.cmat(Color(0.2, 0.1, 0.1)), tp + Vector3(0, 0.7, 0))
	root.add_child(Util.sphere(0.8, Util.cmat(Color(1.0, 0.85, 0.4), 3.0), tp + Vector3(0, 2.5, 0)))
	# lua vermelha e estrelas
	var moon := Util.sphere(25.0, Util.cmat(Color(1.0, 0.2, 0.25), 3.0), Vector3(-120, 140, -260))
	moon.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(moon)
	var stars := []
	var sc := []
	for i in 400:
		var dir := Vector3(_rng.randf_range(-1, 1), _rng.randf_range(0.15, 1), _rng.randf_range(-1, 1)).normalized()
		stars.append(Transform3D(Basis.IDENTITY.scaled(Vector3.ONE * _rng.randf_range(0.5, 1.6)), dir * 380.0))
		sc.append(Color(1, 1, 1).lerp(Color(1, 0.7, 0.8), _rng.randf()))
	var sm := SphereMesh.new()
	sm.radius = 0.6
	sm.height = 1.2
	sm.radial_segments = 4
	sm.rings = 2
	var stm := _vc_mat(1.0, 4.0)
	stm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_multimesh(sm, stars, sc, stm, false)
	for i in 8:
		var a2 := i * TAU / 8.0
		var fp := Vector3(cos(a2), 0, sin(a2)) * 42.0
		root.add_child(Util.cylinder(0.6, 1.6, marble, fp + Vector3(0, 0.8, 0)))
		_fire_particles(fp + Vector3(0, 1.8, 0), 0.4, 20, Color(0.6, 0.3, 1.0))
		var l := OmniLight3D.new()
		l.light_color = Color(0.7, 0.4, 1.0)
		l.light_energy = 2.0
		l.omni_range = 12.0
		l.position = fp + Vector3(0, 2.5, 0)
		if quality >= 1 or i % 2 == 0:
			root.add_child(l)
	_portal("forest", Vector3(0, 0, 50), 9, "Voltar a Tempest", Color(0.5, 1.0, 0.5))
	_ambient_particles(Color(1.0, 0.4, 0.6), 50, 0.1, 0.3, 2.0)
