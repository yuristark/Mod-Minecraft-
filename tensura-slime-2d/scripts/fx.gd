extends Node2D
## Efeitos visuais temporários (anéis, explosões, raios, números de dano).

var kind := "ring"     # ring, burst, beam, bolt, text, warn, slash, cone
var color := Color.WHITE
var size := 40.0
var duration := 0.4
var text := ""
var target := Vector2.ZERO  # usado por beam/bolt (ponto final, relativo) e cone/slash (direção)
var _t := 0.0
var _points := PackedVector2Array()


func _ready() -> void:
	z_index = 20
	if kind == "bolt":
		# Raio em zigue-zague
		var steps := 8
		for i in steps + 1:
			var p := target * (float(i) / steps)
			if i > 0 and i < steps:
				p += target.orthogonal().normalized() * randf_range(-18, 18)
			_points.append(p)


func _process(delta: float) -> void:
	_t += delta
	if kind == "text":
		position.y -= 40.0 * delta
	if _t >= duration:
		queue_free()
	queue_redraw()


func _draw() -> void:
	var k := clampf(_t / duration, 0.0, 1.0)
	var a := 1.0 - k
	match kind:
		"ring":
			draw_arc(Vector2.ZERO, size * (0.2 + k), 0, TAU, 48, Color(color, a), 6.0 * a + 1.0)
		"burst":
			draw_circle(Vector2.ZERO, size * (0.4 + k * 0.6), Color(color, a * 0.6))
			draw_circle(Vector2.ZERO, size * 0.4 * (1.0 - k), Color(1, 1, 1, a))
		"warn":
			draw_circle(Vector2.ZERO, size, Color(color, 0.12 + 0.18 * k))
			draw_arc(Vector2.ZERO, size, 0, TAU, 48, Color(color, 0.8), 3.0)
			draw_arc(Vector2.ZERO, size * k, 0, TAU, 48, Color(color, 0.8), 2.0)
		"beam":
			# Megiddo: raio de luz vindo do céu
			draw_line(Vector2(0, -900), Vector2.ZERO, Color(1, 1, 0.85, a), 14.0 * a + 2.0)
			draw_line(Vector2(0, -900), Vector2.ZERO, Color(1, 1, 1, a), 4.0)
			draw_circle(Vector2.ZERO, 30.0 * a, Color(1, 1, 0.7, a * 0.7))
		"bolt":
			draw_polyline(_points, Color(color, a), 6.0 * a + 1.0)
			draw_polyline(_points, Color(1, 1, 1, a), 2.0)
			draw_circle(target, 40.0 * a, Color(color, a * 0.5))
		"slash":
			var ang := target.angle()
			draw_arc(Vector2.ZERO, size, ang - 1.1, ang + 1.1, 16, Color(color, a), 10.0 * a + 2.0)
		"cone":
			var ang := target.angle()
			var pts := PackedVector2Array([Vector2.ZERO])
			for i in 9:
				pts.append(Vector2.from_angle(ang - 0.55 + i * 0.1375) * size * (0.5 + k * 0.5))
			draw_colored_polygon(pts, Color(color, a * 0.5))
		"text":
			draw_string(ThemeDB.fallback_font, Vector2(-20, 0), text, HORIZONTAL_ALIGNMENT_CENTER, 40, 18, Color(color, a))
