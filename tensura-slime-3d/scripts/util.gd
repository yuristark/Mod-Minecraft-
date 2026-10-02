extends RefCounted
## Funções auxiliares para criar malhas e materiais só com primitivas
## (o jogo não depende de nenhum modelo 3D externo).

const LAYER_WORLD := 1
const LAYER_PLAYER := 2
const LAYER_ENEMY := 4
const LAYER_ALLY := 8

static var _mat_cache := {}
static var _flash_mat: StandardMaterial3D


static func mat(color: Color, emission := 0.0, transparent := false, rough := 0.6) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = rough
	if emission > 0.0:
		m.emission_enabled = true
		m.emission = color
		m.emission_energy_multiplier = emission
	if transparent or color.a < 1.0:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	return m


## Material compartilhado (cache por cor/brilho) para economizar draw calls e memória.
static func cmat(color: Color, emission := 0.0, rough := 0.6, metal := 0.0) -> StandardMaterial3D:
	var key := "%s|%.2f|%.2f|%.2f" % [color.to_html(), emission, rough, metal]
	if _mat_cache.has(key):
		return _mat_cache[key]
	var m := mat(color, emission, false, rough)
	m.metallic = metal
	_mat_cache[key] = m
	return m


## Material branco usado como "overlay" quando algo leva dano.
static func flash_mat() -> StandardMaterial3D:
	if _flash_mat == null:
		_flash_mat = StandardMaterial3D.new()
		_flash_mat.albedo_color = Color(1, 1, 1, 0.55)
		_flash_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_flash_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	return _flash_mat


## Aplica (ou remove) o overlay de dano em todas as malhas de um nó.
static func set_flash(root: Node, on: bool) -> void:
	for c in root.get_children():
		if c is MeshInstance3D:
			(c as MeshInstance3D).material_overlay = flash_mat() if on else null
		set_flash(c, on)


static func capsule(radius: float, height: float, material: Material, pos := Vector3.ZERO) -> MeshInstance3D:
	var c := CapsuleMesh.new()
	c.radius = radius
	c.height = maxf(height, radius * 2.0)
	c.radial_segments = 12
	c.rings = 4
	return mesh_node(c, material, pos)


static func label3d(text: String, size := 40, color := Color.WHITE, y := 2.5) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.position.y = y
	l.font_size = size
	l.pixel_size = 0.006
	l.outline_size = 8
	l.modulate = color
	l.no_depth_test = true
	return l


static func mesh_node(mesh: Mesh, material: Material, pos := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = material
	mi.position = pos
	return mi


static func sphere(radius: float, material: Material, pos := Vector3.ZERO) -> MeshInstance3D:
	var s := SphereMesh.new()
	s.radius = radius
	s.height = radius * 2.0
	return mesh_node(s, material, pos)


static func box(size: Vector3, material: Material, pos := Vector3.ZERO) -> MeshInstance3D:
	var b := BoxMesh.new()
	b.size = size
	return mesh_node(b, material, pos)


static func cone(bottom: float, height: float, material: Material, pos := Vector3.ZERO) -> MeshInstance3D:
	var c := CylinderMesh.new()
	c.top_radius = 0.0
	c.bottom_radius = bottom
	c.height = height
	c.radial_segments = 8
	return mesh_node(c, material, pos)


static func cylinder(radius: float, height: float, material: Material, pos := Vector3.ZERO) -> MeshInstance3D:
	var c := CylinderMesh.new()
	c.top_radius = radius
	c.bottom_radius = radius
	c.height = height
	return mesh_node(c, material, pos)


## Cria um corpo estático com colisão de caixa e malha visível.
static func static_box(size: Vector3, material: Material, pos: Vector3, rot_y := 0.0) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.collision_layer = LAYER_WORLD
	body.position = pos
	body.rotation.y = rot_y
	var shape := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	shape.shape = bs
	body.add_child(shape)
	body.add_child(box(size, material))
	return body


## Barra de texto simples para Label3D (ex.: [||||||....]).
static func text_bar(value: float, max_value: float, length := 12) -> String:
	var filled := int(round(clampf(value / max_value, 0.0, 1.0) * length))
	return "[" + "|".repeat(filled) + ".".repeat(length - filled) + "]"
