extends Node2D
## Monta o mapa de cada capítulo: chão, paredes, árvores, rochas, casas e água.

const Data := preload("res://scripts/data.gd")

const THEMES := {
	"cave": {"ground": Color(0.13, 0.12, 0.17), "detail": Color(0.18, 0.17, 0.23), "obstacle": "rock", "count": 40},
	"forest": {"ground": Color(0.2, 0.35, 0.18), "detail": Color(0.24, 0.42, 0.2), "obstacle": "tree", "count": 70},
	"village": {"ground": Color(0.32, 0.42, 0.22), "detail": Color(0.4, 0.36, 0.25), "obstacle": "tree", "count": 45},
	"wetland": {"ground": Color(0.25, 0.32, 0.22), "detail": Color(0.2, 0.3, 0.35), "obstacle": "reed", "count": 50},
	"town": {"ground": Color(0.38, 0.36, 0.3), "detail": Color(0.45, 0.42, 0.35), "obstacle": "house", "count": 22},
	"castle": {"ground": Color(0.22, 0.18, 0.25), "detail": Color(0.3, 0.22, 0.32), "obstacle": "pillar", "count": 26},
}

var size := Vector2(2400, 1800)
var theme := "cave"
var keep_clear: Array = []   # pontos onde não se coloca obstáculo
var _decor: Array = []       # [tipo, posição, tamanho]
var _patches: Array = []
var _rng := RandomNumberGenerator.new()


func build(p_size: Vector2, p_theme: String, seed_value: int, clear_points: Array) -> void:
	size = p_size
	theme = p_theme
	keep_clear = clear_points
	_rng.seed = seed_value
	z_index = -10
	var t: Dictionary = THEMES[theme]
	# Bordas
	var w := 60.0
	_wall(Rect2(-w, -w, size.x + w * 2, w))
	_wall(Rect2(-w, size.y, size.x + w * 2, w))
	_wall(Rect2(-w, 0, w, size.y))
	_wall(Rect2(size.x, 0, w, size.y))
	for i in 120:
		_patches.append([Vector2(_rng.randf() * size.x, _rng.randf() * size.y), _rng.randf_range(12, 45)])
	# Água / lagos
	var pools := 2 if theme in ["cave", "forest", "wetland"] else 0
	if theme == "wetland":
		pools = 7
	for i in pools:
		var p := _free_point(180.0)
		_decor.append(["water", p, _rng.randf_range(80, 170)])
	# Obstáculos
	var placed := 0
	var tries := 0
	while placed < t.count and tries < 2000:
		tries += 1
		var p := Vector2(_rng.randf_range(60, size.x - 60), _rng.randf_range(60, size.y - 60))
		if not _is_clear(p, 170.0):
			continue
		placed += 1
		var kind: String = t.obstacle
		if theme == "cave" and _rng.randf() < 0.35:
			kind = "crystal"
		if theme == "village" and _rng.randf() < 0.3:
			kind = "hut"
		if theme == "town" and _rng.randf() < 0.3:
			kind = "tree"
		var s := _rng.randf_range(22, 40)
		match kind:
			"house", "hut":
				s = _rng.randf_range(50, 75)
				_block(Rect2(p - Vector2(s, s * 0.7), Vector2(s * 2, s * 1.4)))
			"pillar":
				s = 26
				_circle(p, s)
			"crystal":
				_circle(p, s * 0.6)
			"reed":
				s = _rng.randf_range(16, 26)
				_circle(p, s * 0.6)
			_:
				_circle(p, s * 0.55)
		_decor.append([kind, p, s])
	queue_redraw()


func _free_point(margin: float) -> Vector2:
	for i in 200:
		var p := Vector2(_rng.randf_range(200, size.x - 200), _rng.randf_range(200, size.y - 200))
		if _is_clear(p, margin):
			return p
	return size / 2


func _is_clear(p: Vector2, margin: float) -> bool:
	for c in keep_clear:
		if p.distance_to(c) < margin:
			return false
	for d in _decor:
		if p.distance_to(d[1]) < d[2] + 40.0:
			return false
	return true


func _wall(r: Rect2) -> void:
	_block(r)


func _block(r: Rect2) -> void:
	var body := StaticBody2D.new()
	body.collision_layer = Data.L_WORLD
	var shape := CollisionShape2D.new()
	var rs := RectangleShape2D.new()
	rs.size = r.size
	shape.shape = rs
	shape.position = r.position + r.size / 2
	body.add_child(shape)
	add_child(body)


func _circle(p: Vector2, r: float) -> void:
	var body := StaticBody2D.new()
	body.collision_layer = Data.L_WORLD
	var shape := CollisionShape2D.new()
	var cs := CircleShape2D.new()
	cs.radius = r
	shape.shape = cs
	shape.position = p
	body.add_child(shape)
	add_child(body)


func _draw() -> void:
	var t: Dictionary = THEMES[theme]
	draw_rect(Rect2(-400, -400, size.x + 800, size.y + 800), t.ground.darkened(0.5))
	draw_rect(Rect2(Vector2.ZERO, size), t.ground)
	for p in _patches:
		draw_circle(p[0], p[1], Color(t.detail, 0.35))
	if theme == "village" or theme == "town":
		# estradas de terra
		draw_line(Vector2(0, size.y / 2), Vector2(size.x, size.y / 2), Color(0.5, 0.42, 0.3), 70.0)
		draw_line(Vector2(size.x / 2, 0), Vector2(size.x / 2, size.y), Color(0.5, 0.42, 0.3), 70.0)
	if theme == "castle":
		# tapete do salão do Walpurgis
		draw_rect(Rect2(size.x / 2 - 120, 0, 240, size.y), Color(0.45, 0.08, 0.12))
	# borda escura
	draw_rect(Rect2(Vector2.ZERO, size), Color(0, 0, 0, 0.5), false, 30.0)
	for d in _decor:
		_draw_decor(d[0], d[1], d[2])


func _draw_decor(kind: String, p: Vector2, s: float) -> void:
	match kind:
		"water":
			draw_circle(p, s, Color(0.15, 0.35, 0.65, 0.85))
			draw_circle(p, s * 0.75, Color(0.2, 0.45, 0.75, 0.7))
		"rock":
			draw_circle(p + Vector2(4, 6), s * 0.6, Color(0, 0, 0, 0.3))
			draw_circle(p, s * 0.6, Color(0.3, 0.28, 0.33))
			draw_circle(p - Vector2(s * 0.15, s * 0.2), s * 0.35, Color(0.38, 0.36, 0.42))
		"crystal":
			draw_circle(p, s * 1.2, Color(0.4, 0.6, 1.0, 0.12))
			for i in 3:
				var x := (i - 1) * s * 0.35
				draw_colored_polygon(PackedVector2Array([p + Vector2(x - 7, 8), p + Vector2(x, -s + absf(i - 1) * 8), p + Vector2(x + 7, 8)]),
					Color(0.45, 0.7, 1.0) if i != 1 else Color(0.7, 0.85, 1.0))
		"tree":
			draw_circle(p + Vector2(6, 10), s * 0.8, Color(0, 0, 0, 0.3))
			draw_rect(Rect2(p + Vector2(-5, 0), Vector2(10, s * 0.6)), Color(0.4, 0.28, 0.15))
			draw_circle(p + Vector2(0, -s * 0.3), s * 0.8, Color(0.12, 0.35, 0.15))
			draw_circle(p + Vector2(-s * 0.2, -s * 0.5), s * 0.5, Color(0.18, 0.45, 0.2))
		"reed":
			for i in 5:
				draw_line(p + Vector2((i - 2) * 4, 8), p + Vector2((i - 2) * 6, -s), Color(0.45, 0.55, 0.25), 3.0)
		"house", "hut":
			var w := s * 2.0
			var h := s * 1.4
			var r := Rect2(p - Vector2(s, s * 0.7), Vector2(w, h))
			draw_rect(Rect2(r.position + Vector2(8, 8), r.size), Color(0, 0, 0, 0.3))
			draw_rect(r, Color(0.55, 0.42, 0.3) if kind == "house" else Color(0.45, 0.38, 0.25))
			draw_colored_polygon(PackedVector2Array([r.position + Vector2(-10, 0), r.position + Vector2(w / 2, -h * 0.6), r.position + Vector2(w + 10, 0)]),
				Color(0.6, 0.25, 0.2) if kind == "house" else Color(0.6, 0.55, 0.3))
			draw_rect(Rect2(p + Vector2(-10, h * 0.7 - 30), Vector2(20, 30)), Color(0.3, 0.2, 0.12))
		"pillar":
			draw_circle(p + Vector2(5, 8), s, Color(0, 0, 0, 0.35))
			draw_circle(p, s, Color(0.55, 0.5, 0.6))
			draw_circle(p, s * 0.7, Color(0.65, 0.6, 0.7))
