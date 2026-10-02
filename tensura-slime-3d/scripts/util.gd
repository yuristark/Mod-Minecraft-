extends RefCounted
## Funções auxiliares para criar malhas e materiais só com primitivas
## (o jogo não depende de nenhum modelo 3D externo).

const LAYER_WORLD := 1
const LAYER_PLAYER := 2
const LAYER_ENEMY := 4


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


## Barra de texto simples para Label3D (ex.: ■■■■□□).
static func text_bar(value: float, max_value: float, length := 10) -> String:
	var filled := int(round(clampf(value / max_value, 0.0, 1.0) * length))
	return "■".repeat(filled) + "□".repeat(length - filled)
