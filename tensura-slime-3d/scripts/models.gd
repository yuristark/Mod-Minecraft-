extends RefCounted
## Modelos procedurais (só primitivas) de todos os personagens e monstros.
## Todos olham para -Z. Use build(spec) para criar e animate(...) para animar.

const Util := preload("res://scripts/util.gd")


static func build(spec: Dictionary) -> Node3D:
	var kind: String = spec.get("kind", "humanoid")
	var root := Node3D.new()
	root.set_meta("kind", kind)
	match kind:
		"humanoid": _humanoid(root, spec)
		"quadruped": _quadruped(root, spec)
		"serpent": _serpent(root, spec)
		"spider": _spider(root, spec)
		"bat": _bat(root, spec)
		"lizard": _lizard(root, spec)
		"centipede": _centipede(root, spec)
		"dragon": _dragon(root, spec)
		"slime": _slime(root, spec)
		"machine": _machine(root, spec)
		"fairy": _fairy(root, spec)
		_: _humanoid(root, spec)
	var s: float = spec.get("scale", 1.0)
	if s != 1.0:
		root.scale = Vector3.ONE * s
	return root


## move: 0..1 (velocidade relativa), attack: 0..1 durante o golpe, -1 parado.
static func animate(root: Node3D, t: float, move: float, attack := -1.0) -> void:
	var kind: String = root.get_meta("kind", "humanoid")
	match kind:
		"humanoid":
			var sw := sin(t * 11.0) * 0.7 * move
			_rot(root, "Rig/LegL", Vector3(sw, 0, 0))
			_rot(root, "Rig/LegR", Vector3(-sw, 0, 0))
			_rot(root, "Rig/ArmL", Vector3(-sw * 0.8, 0, 0.12))
			if attack >= 0.0:
				_rot(root, "Rig/ArmR", Vector3(-2.6 + attack * 3.2, 0, -0.15))
			else:
				_rot(root, "Rig/ArmR", Vector3(sw * 0.8 + sin(t * 2.0) * 0.04, 0, -0.12))
			var rig := root.get_node_or_null("Rig") as Node3D
			if rig:
				rig.position.y = absf(sin(t * 11.0)) * 0.06 * move + sin(t * 2.2) * 0.012
			var wings := root.get_node_or_null("Rig/Wings") as Node3D
			if wings:
				wings.rotation.y = sin(t * 3.0) * 0.15
		"quadruped":
			var sw2 := sin(t * 13.0) * 0.8 * move
			_rot(root, "L0", Vector3(sw2, 0, 0))
			_rot(root, "L1", Vector3(-sw2, 0, 0))
			_rot(root, "L2", Vector3(-sw2, 0, 0))
			_rot(root, "L3", Vector3(sw2, 0, 0))
			_rot(root, "Tail", Vector3(0.6, sin(t * 6.0) * 0.4, 0))
			_rot(root, "Head", Vector3(-0.4 * maxf(attack, 0.0), 0, 0))
		"bat":
			var flap := sin(t * 14.0) * 0.6
			_rot(root, "WingL", Vector3(0, 0, flap))
			_rot(root, "WingR", Vector3(0, 0, -flap))
		"dragon":
			var f := sin(t * 1.6) * 0.25
			_rot(root, "WingL", Vector3(0, 0, 0.5 + f))
			_rot(root, "WingR", Vector3(0, 0, -0.5 - f))
		"serpent", "centipede":
			var i := 0
			for c in root.get_children():
				if c.name.begins_with("Seg"):
					(c as Node3D).position.x = sin(t * 6.0 + i * 0.8) * 0.25 * (0.3 + move)
					i += 1
		"fairy":
			_rot(root, "WingL", Vector3(0, sin(t * 20.0) * 0.5, 0))
			_rot(root, "WingR", Vector3(0, -sin(t * 20.0) * 0.5, 0))


static func _rot(root: Node, path: String, r: Vector3) -> void:
	var n := root.get_node_or_null(path) as Node3D
	if n:
		n.rotation = r


static func _pivot(parent: Node3D, n: String, pos: Vector3) -> Node3D:
	var p := Node3D.new()
	p.name = n
	p.position = pos
	parent.add_child(p)
	return p


# ---------------------------------------------------------------- humanoide
static func _humanoid(root: Node3D, s: Dictionary) -> void:
	var skin := Util.cmat(s.get("skin", Color(0.98, 0.85, 0.75)), s.get("glow", 0.0), 0.7)
	var hair := Util.cmat(s.get("hair", Color(0.15, 0.12, 0.1)), s.get("hair_glow", 0.0), 0.55)
	var cloth := Util.cmat(s.get("outfit", Color(0.2, 0.2, 0.3)), s.get("glow", 0.0) * 0.5, 0.75)
	var cloth2 := Util.cmat(s.get("outfit2", Color(0.85, 0.85, 0.9)), 0.0, 0.7)
	var boots := Util.cmat(s.get("boots", Color(0.12, 0.1, 0.1)), 0.0, 0.6)
	var eye := Util.cmat(s.get("eye", Color(0.15, 0.15, 0.2)), 1.2, 0.3)
	var bulk: float = s.get("bulk", 1.0)
	var rig := _pivot(root, "Rig", Vector3.ZERO)
	rig.scale = Vector3(bulk, 1.0, bulk) * s.get("height", 1.0)

	for side in [-1, 1]:
		var leg := _pivot(rig, "LegL" if side < 0 else "LegR", Vector3(side * 0.13, 0.92, 0))
		leg.add_child(Util.capsule(0.095, 0.62, cloth, Vector3(0, -0.3, 0)))
		leg.add_child(Util.capsule(0.1, 0.36, boots, Vector3(0, -0.72, -0.02)))
	# tronco e cintura
	rig.add_child(Util.capsule(0.22, 0.72, cloth, Vector3(0, 1.24, 0)))
	rig.add_child(Util.cylinder(0.215, 0.1, cloth2, Vector3(0, 0.98, 0)))
	if s.get("coat", false):
		var coat := Util.cone(0.38, 0.75, cloth, Vector3(0, 0.72, 0))
		(coat.mesh as CylinderMesh).top_radius = 0.22
		(coat.mesh as CylinderMesh).radial_segments = 12
		rig.add_child(coat)
	if s.get("skirt", false):
		var sk := Util.cone(0.36, 0.45, cloth2, Vector3(0, 0.82, 0))
		(sk.mesh as CylinderMesh).top_radius = 0.2
		rig.add_child(sk)
	rig.add_child(Util.box(Vector3(0.36, 0.06, 0.05), cloth2, Vector3(0, 1.4, -0.2)))  # gola/detalhe
	if s.has("cape"):
		var cape := Util.box(Vector3(0.55, 1.1, 0.04), Util.cmat(s.cape, 0.0, 0.8), Vector3(0, 1.0, 0.24))
		cape.rotation.x = 0.12
		rig.add_child(cape)

	for side in [-1, 1]:
		var arm := _pivot(rig, "ArmL" if side < 0 else "ArmR", Vector3(side * 0.31, 1.5, 0))
		arm.add_child(Util.capsule(0.07, 0.55, cloth, Vector3(0, -0.26, 0)))
		arm.add_child(Util.sphere(0.075, skin, Vector3(0, -0.58, 0)))
		if side > 0:
			_weapon(arm, s.get("weapon", "none"))

	var head := _pivot(rig, "Head", Vector3(0, 1.66, 0))
	head.add_child(Util.sphere(0.24, skin))
	if not s.get("no_eyes", false):
		for x in [-0.085, 0.085]:
			var e := Util.sphere(0.042, eye, Vector3(x, -0.01, -0.215))
			e.scale = Vector3(0.9, 1.35, 0.5)
			head.add_child(e)
	if s.get("snout", false):
		head.add_child(Util.box(Vector3(0.2, 0.14, 0.18), skin, Vector3(0, -0.07, -0.25)))
		if s.get("tusks", false):
			for x in [-0.07, 0.07]:
				head.add_child(Util.cone(0.025, 0.12, Util.cmat(Color(0.95, 0.92, 0.8)), Vector3(x, -0.02, -0.33)))
	if s.get("beard", false):
		head.add_child(Util.box(Vector3(0.3, 0.26, 0.14), hair, Vector3(0, -0.2, -0.13)))
	if s.get("mask", false):
		var m := Util.sphere(0.12, Util.cmat(Color(0.95, 0.95, 0.95)), Vector3(0.2, 0.1, -0.12))
		m.scale = Vector3(0.4, 1, 0.9)
		head.add_child(m)

	if s.get("helmet", false):
		var h := Util.sphere(0.27, Util.cmat(s.get("helmet_color", Color(0.65, 0.67, 0.72)), 0.0, 0.3, 0.8), Vector3(0, 0.05, 0.02))
		h.scale = Vector3(1, 0.85, 1)
		head.add_child(h)
		head.add_child(Util.box(Vector3(0.05, 0.2, 0.05), h.material_override, Vector3(0, 0.3, 0)))
	else:
		_hair(head, s.get("hair_style", "short"), hair)

	var horn_mat := Util.cmat(s.get("horn_color", Color(0.1, 0.1, 0.12)), 0.3, 0.4)
	match int(s.get("horns", 0)):
		1:
			var hn := Util.cone(0.04, 0.22, horn_mat, Vector3(0, 0.3, -0.1))
			hn.rotation.x = -0.4
			head.add_child(hn)
		2:
			for x in [-0.11, 0.11]:
				var hn2 := Util.cone(0.04, 0.22, horn_mat, Vector3(x, 0.27, -0.08))
				hn2.rotation = Vector3(-0.35, 0, -x * 2.5)
				head.add_child(hn2)
		3:  # chifres grandes (Lordes Demônio)
			for x in [-0.14, 0.14]:
				var hn3 := Util.cone(0.06, 0.4, horn_mat, Vector3(x, 0.3, 0))
				hn3.rotation = Vector3(0.4, 0, -x * 4.0)
				head.add_child(hn3)
	match s.get("ears", ""):
		"beast":
			for x in [-0.14, 0.14]:
				head.add_child(Util.cone(0.07, 0.18, hair, Vector3(x, 0.25, 0.02)))
		"elf":
			for x in [-1, 1]:
				var ear := Util.cone(0.04, 0.2, skin, Vector3(x * 0.25, 0.02, 0.02))
				ear.rotation.z = -x * 1.3
				head.add_child(ear)

	if s.has("wings"):
		var wings := _pivot(rig, "Wings", Vector3(0, 1.35, 0.22))
		var wm := Util.cmat(s.wings, s.get("wing_glow", 0.2), 0.5)
		for side in [-1, 1]:
			var w := Util.box(Vector3(0.9, 0.55, 0.03), wm, Vector3(side * 0.5, 0.15, 0.05))
			w.rotation = Vector3(0, -side * 0.35, side * 0.35)
			wings.add_child(w)
			var w2 := Util.box(Vector3(0.6, 0.35, 0.03), wm, Vector3(side * 0.75, -0.2, 0.08))
			w2.rotation = Vector3(0, -side * 0.35, -side * 0.3)
			wings.add_child(w2)
	if s.has("tail"):
		var tail := Util.capsule(0.07, 0.8, Util.cmat(s.tail), Vector3(0, 0.75, 0.38))
		tail.rotation.x = 1.0
		rig.add_child(tail)
	if s.has("aura"):
		var light := OmniLight3D.new()
		light.light_color = s.aura
		light.light_energy = 1.4
		light.omni_range = 5.0
		light.position.y = 1.3
		root.add_child(light)


static func _hair(head: Node3D, style: String, hair: Material) -> void:
	if style == "bald":
		return
	var cap := Util.sphere(0.265, hair, Vector3(0, 0.06, 0.05))
	cap.scale = Vector3(1.02, 0.92, 1.0)
	head.add_child(cap)
	head.add_child(Util.box(Vector3(0.4, 0.1, 0.1), hair, Vector3(0, 0.15, -0.19)))  # franja
	match style:
		"long":
			head.add_child(Util.box(Vector3(0.46, 0.75, 0.12), hair, Vector3(0, -0.28, 0.17)))
			for x in [-0.2, 0.2]:
				head.add_child(Util.box(Vector3(0.08, 0.4, 0.1), hair, Vector3(x, -0.15, -0.1)))
		"spiky":
			for i in 7:
				var a := -1.2 + i * 0.4
				var sp := Util.cone(0.07, 0.24, hair, Vector3(sin(a) * 0.2, 0.2 + cos(a) * 0.06, 0.08))
				sp.rotation = Vector3(0.6, 0, -a * 0.8)
				head.add_child(sp)
		"pony":
			var p := Util.capsule(0.08, 0.7, hair, Vector3(0, -0.12, 0.33))
			p.rotation.x = 0.3
			head.add_child(p)
		"twin":
			for x in [-0.3, 0.3]:
				var tw := Util.capsule(0.08, 0.75, hair, Vector3(x, -0.25, 0.08))
				tw.rotation.z = signf(x) * 0.25
				head.add_child(tw)
		"bob":
			head.add_child(Util.box(Vector3(0.52, 0.3, 0.4), hair, Vector3(0, -0.08, 0.08)))


static func _weapon(arm: Node3D, w: String) -> void:
	var metal := Util.cmat(Color(0.85, 0.88, 0.95), 0.2, 0.2, 0.9)
	var dark := Util.cmat(Color(0.12, 0.1, 0.1))
	var hand := Vector3(0, -0.6, 0)
	match w:
		"sword", "katana":
			arm.add_child(Util.box(Vector3(0.04, 0.04, 0.22), dark, hand + Vector3(0, 0, -0.05)))
			arm.add_child(Util.box(Vector3(0.03, 0.08 if w == "katana" else 0.1, 1.0), metal, hand + Vector3(0, 0, -0.66)))
		"greatsword":
			arm.add_child(Util.box(Vector3(0.05, 0.05, 0.3), dark, hand + Vector3(0, 0, -0.08)))
			arm.add_child(Util.box(Vector3(0.05, 0.22, 1.5), Util.cmat(Color(0.3, 0.3, 0.35), 0.0, 0.3, 0.8), hand + Vector3(0, 0, -0.95)))
		"spear":
			arm.add_child(Util.cylinder(0.025, 2.0, dark, hand + Vector3(0, 0.2, -0.4)))
			var tip := Util.cone(0.06, 0.3, metal, hand + Vector3(0, 1.3, -0.4))
			arm.add_child(tip)
		"staff":
			arm.add_child(Util.cylinder(0.03, 1.6, Util.cmat(Color(0.5, 0.35, 0.2)), hand + Vector3(0, 0.3, -0.1)))
			arm.add_child(Util.sphere(0.1, Util.cmat(Color(0.5, 0.8, 1.0), 3.0), hand + Vector3(0, 1.15, -0.1)))
		"gun":
			arm.add_child(Util.box(Vector3(0.06, 0.12, 0.4), dark, hand + Vector3(0, 0, -0.2)))
		"club":
			arm.add_child(Util.capsule(0.09, 1.0, Util.cmat(Color(0.4, 0.28, 0.15)), hand + Vector3(0, 0, -0.45)))
			arm.get_child(arm.get_child_count() - 1).rotation.x = PI / 2
		"hammer":
			arm.add_child(Util.cylinder(0.03, 0.8, dark, hand + Vector3(0, 0.15, 0)))
			arm.add_child(Util.box(Vector3(0.18, 0.18, 0.32), metal, hand + Vector3(0, 0.55, 0)))
		"claws":
			for i in 3:
				arm.add_child(Util.cone(0.02, 0.18, metal, hand + Vector3(-0.04 + i * 0.04, -0.12, -0.03)))


# ---------------------------------------------------------------- quadrúpede
static func _quadruped(root: Node3D, s: Dictionary) -> void:
	var c: Color = s.get("color", Color(0.3, 0.3, 0.35))
	var body := Util.cmat(c, 0.0, 0.8)
	var belly := Util.cmat(c.lightened(0.15), 0.0, 0.8)
	var eye := Util.cmat(s.get("eye", Color(1.0, 0.8, 0.1)), 3.0)
	var b := Util.capsule(0.45, 1.9, body, Vector3(0, 1.0, 0))
	b.rotation.x = PI / 2
	root.add_child(b)
	root.add_child(Util.sphere(0.38, belly, Vector3(0, 0.85, -0.2)))
	var head := _pivot(root, "Head", Vector3(0, 1.45, -1.0))
	head.add_child(Util.sphere(0.38, body))
	head.add_child(Util.box(Vector3(0.32, 0.26, 0.5), body, Vector3(0, -0.1, -0.42)))
	head.add_child(Util.sphere(0.06, Util.cmat(Color(0.05, 0.05, 0.05)), Vector3(0, -0.02, -0.68)))
	for x in [-0.16, 0.16]:
		head.add_child(Util.sphere(0.06, eye, Vector3(x, 0.08, -0.3)))
		if not s.get("tusks", false):
			head.add_child(Util.cone(0.1, 0.3, body, Vector3(x * 1.2, 0.38, -0.02)))
		else:
			var t := Util.cone(0.04, 0.25, Util.cmat(Color(0.95, 0.9, 0.8)), Vector3(x, -0.15, -0.6))
			t.rotation.x = -0.8
			head.add_child(t)
	if s.get("horn", false):
		var hn := Util.cone(0.07, 0.45, Util.cmat(Color(0.95, 0.85, 0.4), 1.5), Vector3(0, 0.38, -0.2))
		hn.rotation.x = -0.4
		head.add_child(hn)
	if s.get("star", false):
		head.add_child(Util.sphere(0.07, Util.cmat(Color(0.9, 0.9, 1.0), 4.0), Vector3(0, 0.22, -0.34)))
	var legs := [Vector3(-0.28, 0.8, -0.6), Vector3(0.28, 0.8, -0.6), Vector3(-0.28, 0.8, 0.6), Vector3(0.28, 0.8, 0.6)]
	for i in 4:
		var l := _pivot(root, "L%d" % i, legs[i])
		l.add_child(Util.capsule(0.11, 0.85, body, Vector3(0, -0.4, 0)))
	var tail := _pivot(root, "Tail", Vector3(0, 1.2, 0.95))
	tail.add_child(Util.capsule(0.09, 0.8, body, Vector3(0, 0, 0.4)))
	tail.get_child(0).rotation.x = PI / 2
	if s.get("armored", false):
		var armor := Util.cmat(Color(0.55, 0.52, 0.45), 0.0, 0.4, 0.4)
		for i in 5:
			root.add_child(Util.cone(0.2, 0.45, armor, Vector3(0, 1.5, -0.7 + i * 0.35)))
	if s.has("mane"):
		var mane := Util.sphere(0.5, Util.cmat(s.mane), Vector3(0, 1.4, -0.75))
		mane.scale = Vector3(1, 1, 0.7)
		root.add_child(mane)


# ---------------------------------------------------------------- monstros da caverna
static func _serpent(root: Node3D, s: Dictionary) -> void:
	var body := Util.cmat(s.get("color", Color(0.35, 0.2, 0.5)), s.get("glow", 0.0))
	var eye := Util.cmat(Color(1.0, 0.15, 0.1), 3.0)
	for i in 7:
		var r := 0.75 - i * 0.07
		var seg := Util.sphere(r, body, Vector3(0, r, i * 0.9))
		seg.name = "Seg%d" % i
		root.add_child(seg)
	root.add_child(Util.sphere(0.12, eye, Vector3(0.35, 0.95, -0.55)))
	root.add_child(Util.sphere(0.12, eye, Vector3(-0.35, 0.95, -0.55)))
	root.add_child(Util.cone(0.15, 0.6, Util.cmat(Color(0.6, 0.5, 0.8)), Vector3(0, 1.5, 0.2)))


static func _centipede(root: Node3D, s: Dictionary) -> void:
	var body := Util.cmat(s.get("color", Color(0.45, 0.12, 0.2)))
	var legm := Util.cmat(Color(0.9, 0.7, 0.3))
	var eye := Util.cmat(Color(1.0, 0.9, 0.2), 3.0)
	for i in 9:
		var seg := Util.sphere(0.42, body, Vector3(0, 0.45, i * 0.6))
		seg.name = "Seg%d" % i
		seg.scale = Vector3(1.2, 0.8, 1)
		for side in [-1, 1]:
			var leg := Util.box(Vector3(0.7, 0.05, 0.05), legm, Vector3(side * 0.45, -0.2, 0))
			leg.rotation.z = side * -0.6
			seg.add_child(leg)
		root.add_child(seg)
	for x in [-0.15, 0.15]:
		root.add_child(Util.sphere(0.08, eye, Vector3(x, 0.6, -0.35)))
		var m := Util.cone(0.05, 0.5, legm, Vector3(x * 2, 0.4, -0.5))
		m.rotation.x = -1.6
		root.add_child(m)


static func _spider(root: Node3D, s: Dictionary) -> void:
	var body := Util.cmat(s.get("color", Color(0.1, 0.1, 0.12)), 0.0, 0.4)
	var eye := Util.cmat(Color(1.0, 0.15, 0.1), 3.0)
	root.add_child(Util.sphere(0.6, body, Vector3(0, 0.7, 0.3)))
	root.add_child(Util.sphere(0.4, body, Vector3(0, 0.6, -0.5)))
	root.add_child(Util.sphere(0.3, Util.cmat(Color(0.7, 0.1, 0.1)), Vector3(0, 1.0, 0.5)))
	for i in 4:
		root.add_child(Util.sphere(0.07, eye, Vector3(-0.18 + i * 0.12, 0.75, -0.85)))
	for side in [-1, 1]:
		for i in 4:
			var leg := Util.box(Vector3(1.4, 0.08, 0.08), body, Vector3(side * 0.8, 0.5, -0.4 + i * 0.3))
			leg.rotation.z = side * -0.5
			leg.rotation.y = (i - 1.5) * 0.3 * side
			root.add_child(leg)


static func _bat(root: Node3D, s: Dictionary) -> void:
	var c: Color = s.get("color", Color(0.3, 0.22, 0.2))
	var body := Util.cmat(c)
	var eye := Util.cmat(Color(1.0, 0.15, 0.1), 3.0)
	root.add_child(Util.sphere(0.45, body))
	root.add_child(Util.sphere(0.08, eye, Vector3(0.15, 0.15, -0.4)))
	root.add_child(Util.sphere(0.08, eye, Vector3(-0.15, 0.15, -0.4)))
	for side in [-1, 1]:
		var piv := _pivot(root, "WingL" if side < 0 else "WingR", Vector3(side * 0.3, 0, 0))
		piv.add_child(Util.box(Vector3(1.4, 0.05, 0.8), Util.cmat(c.darkened(0.3)), Vector3(side * 0.7, 0, 0)))
		root.add_child(Util.cone(0.1, 0.35, body, Vector3(side * 0.2, 0.5, 0)))


static func _lizard(root: Node3D, s: Dictionary) -> void:
	var body := Util.cmat(s.get("color", Color(0.45, 0.4, 0.25)))
	var eye := Util.cmat(Color(1.0, 0.15, 0.1), 3.0)
	root.add_child(Util.box(Vector3(1.0, 0.7, 1.8), body, Vector3(0, 0.6, 0)))
	root.add_child(Util.box(Vector3(0.7, 0.5, 0.8), body, Vector3(0, 0.7, -1.2)))
	root.add_child(Util.sphere(0.08, eye, Vector3(0.25, 0.9, -1.4)))
	root.add_child(Util.sphere(0.08, eye, Vector3(-0.25, 0.9, -1.4)))
	var armor := Util.cmat(Color(0.6, 0.55, 0.4), 0.0, 0.4, 0.3)
	for i in 4:
		root.add_child(Util.cone(0.18, 0.4, armor, Vector3(0, 1.1, -0.6 + i * 0.4)))
	root.add_child(Util.box(Vector3(0.3, 0.3, 1.2), body, Vector3(0, 0.5, 1.4)))


# ---------------------------------------------------------------- dragão
static func _dragon(root: Node3D, s: Dictionary) -> void:
	var c: Color = s.get("color", Color(0.12, 0.12, 0.18))
	var scale_mat := Util.cmat(c, s.get("glow", 0.0), 0.3, 0.2)
	var belly := Util.cmat(c.lightened(0.2))
	var gold := Util.cmat(s.get("eye", Color(1.0, 0.8, 0.2)), 4.0)
	root.add_child(Util.sphere(2.2, scale_mat, Vector3(0, 2.4, 0)))
	root.add_child(Util.sphere(1.6, belly, Vector3(0, 2.2, -1.0)))
	var neck := Util.cylinder(0.8, 3.0, scale_mat, Vector3(0, 4.6, -1.6))
	neck.rotation.x = -0.6
	root.add_child(neck)
	root.add_child(Util.box(Vector3(1.6, 1.3, 2.4), scale_mat, Vector3(0, 6.0, -2.8)))
	root.add_child(Util.box(Vector3(1.1, 0.7, 1.4), scale_mat, Vector3(0, 5.7, -4.3)))
	for x in [-0.5, 0.5]:
		root.add_child(Util.sphere(0.2, gold, Vector3(x, 6.3, -3.9)))
		var horn := Util.cone(0.25, 1.6, Util.cmat(Color(0.8, 0.75, 0.6)), Vector3(x * 1.2, 7.2, -2.3))
		horn.rotation.x = 0.7
		horn.rotation.z = -x * 0.6
		root.add_child(horn)
	for side in [-1, 1]:
		var piv := _pivot(root, "WingL" if side < 0 else "WingR", Vector3(side * 1.5, 4.0, 0.6))
		var wm := Util.cmat(s.get("wing", Color(0.18, 0.15, 0.3)), s.get("glow", 0.0))
		piv.add_child(Util.box(Vector3(5.0, 0.15, 3.0), wm, Vector3(side * 2.5, 0, 0)))
		piv.add_child(Util.box(Vector3(3.0, 0.12, 2.0), wm, Vector3(side * 4.5, 0, 1.2)))
		for z in [-1.0, 1.0]:
			root.add_child(Util.box(Vector3(0.7, 1.4, 0.7), scale_mat, Vector3(side * 1.3, 0.7, z)))
	for i in 6:
		root.add_child(Util.sphere(0.9 - i * 0.13, scale_mat, Vector3(0, 1.0 + i * 0.05, 2.2 + i * 1.0)))


static func _slime(root: Node3D, s: Dictionary) -> void:
	var c: Color = s.get("color", Color(0.35, 0.72, 1.0, 0.85))
	var m := Util.mat(c, 0.3, true, 0.15)
	m.rim_enabled = true
	var body := Util.sphere(0.75, m, Vector3(0, 0.62, 0))
	body.scale = Vector3(1.0, 0.82, 1.0)
	root.add_child(body)
	var eye := Util.cmat(Color(0.05, 0.08, 0.15))
	for x in [-0.22, 0.22]:
		var e := Util.sphere(0.08, eye, Vector3(x, 0.78, -0.66))
		e.scale = Vector3(0.7, 1.6, 0.5)
		root.add_child(e)


static func _machine(root: Node3D, s: Dictionary) -> void:
	var c := Util.cmat(s.get("color", Color(0.35, 0.38, 0.3)), 0.0, 0.4, 0.6)
	var dark := Util.cmat(Color(0.15, 0.15, 0.15), 0.0, 0.5, 0.5)
	root.add_child(Util.box(Vector3(2.2, 1.0, 3.0), c, Vector3(0, 0.9, 0)))
	root.add_child(Util.box(Vector3(1.4, 0.7, 1.4), c, Vector3(0, 1.75, 0.2)))
	var gun := Util.cylinder(0.15, 2.2, dark, Vector3(0, 1.8, -1.3))
	gun.rotation.x = PI / 2
	root.add_child(gun)
	for x in [-1.1, 1.1]:
		root.add_child(Util.box(Vector3(0.5, 0.6, 3.2), dark, Vector3(x, 0.35, 0)))
	root.add_child(Util.sphere(0.12, Util.cmat(Color(1, 0.3, 0.2), 3.0), Vector3(0, 1.9, -0.55)))


static func _fairy(root: Node3D, s: Dictionary) -> void:
	var holder := _pivot(root, "Body", Vector3(0, 0.0, 0))
	_humanoid(holder, s)
	var wm := Util.mat(Color(0.7, 0.9, 1.0, 0.5), 1.5, true)
	for side in [-1, 1]:
		var piv := _pivot(root, "WingL" if side < 0 else "WingR", Vector3(side * 0.08, 1.3 * s.get("height", 1.0), 0.15))
		var w := Util.sphere(0.35, wm, Vector3(side * 0.3, 0.1, 0.1))
		w.scale = Vector3(1, 1.5, 0.1)
		piv.add_child(w)
