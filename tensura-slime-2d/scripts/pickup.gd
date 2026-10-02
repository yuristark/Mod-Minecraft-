extends Node2D
## Itens para devorar: Minério Mágico (+MP máx.) e Erva Hipokute (cura).

var kind := "ore"
var _t := 0.0


func _ready() -> void:
	add_to_group("absorbable")
	_t = randf() * 5.0
	z_index = 2


func _process(delta: float) -> void:
	_t += delta
	queue_redraw()


func get_absorb_name() -> String:
	return "Minério Mágico" if kind == "ore" else "Erva Hipokute"


func _draw() -> void:
	var glow := 0.5 + sin(_t * 3.0) * 0.2
	if kind == "ore":
		draw_circle(Vector2.ZERO, 22, Color(0.7, 0.4, 1.0, glow * 0.3))
		for i in 3:
			var x := (i - 1) * 8.0
			draw_colored_polygon(PackedVector2Array([Vector2(x - 5, 6), Vector2(x, -14 + absf(i - 1) * 6), Vector2(x + 5, 6)]), Color(0.7, 0.45, 1.0))
	else:
		draw_circle(Vector2.ZERO, 18, Color(0.4, 1.0, 0.5, glow * 0.25))
		for i in 5:
			var a := -PI / 2 + (i - 2) * 0.45
			draw_line(Vector2(0, 6), Vector2(0, 6) + Vector2.from_angle(a) * 14, Color(0.35, 0.9, 0.4), 4.0)
