extends Node2D
## Personagens com quem o Rimuru conversa (Veldora, Shizu, Rigurd, Milim...).

const LOOKS := {
	"veldora": {"name": "Veldora", "kind": "dragon"},
	"goblin_elder": {"name": "Ancião Goblin", "kind": "goblin", "skin": Color(0.5, 0.7, 0.4), "hair": Color(0.85, 0.85, 0.85), "cloth": Color(0.5, 0.4, 0.3)},
	"ranga": {"name": "Lobo Atroz (filho do líder)", "kind": "wolf"},
	"shizu": {"name": "Shizue Izawa", "kind": "human", "skin": Color(1, 0.88, 0.8), "hair": Color(0.15, 0.12, 0.12), "cloth": Color(0.85, 0.85, 0.9), "mask": true},
	"kabal": {"name": "Kabal", "kind": "human", "skin": Color(1, 0.85, 0.75), "hair": Color(0.5, 0.3, 0.15), "cloth": Color(0.5, 0.5, 0.55)},
	"shuna": {"name": "Princesa Ogra", "kind": "human", "skin": Color(1, 0.9, 0.85), "hair": Color(1, 0.72, 0.82), "cloth": Color(0.95, 0.95, 1.0), "horn": true},
	"gabiru": {"name": "Gabiru", "kind": "human", "skin": Color(0.4, 0.6, 0.45), "hair": Color(0.3, 0.45, 0.3), "cloth": Color(0.6, 0.5, 0.2)},
	"rigurd": {"name": "Rigurd", "kind": "goblin", "skin": Color(0.55, 0.72, 0.42), "hair": Color(0.3, 0.3, 0.3), "cloth": Color(0.4, 0.4, 0.55)},
	"milim": {"name": "Milim Nava", "kind": "human", "skin": Color(1, 0.9, 0.85), "hair": Color(1, 0.6, 0.8), "cloth": Color(0.15, 0.15, 0.2)},
	"diablo": {"name": "Diablo", "kind": "human", "skin": Color(0.95, 0.9, 0.9), "hair": Color(0.1, 0.1, 0.12), "cloth": Color(0.1, 0.1, 0.12)},
}

var id := "veldora"
var display_name := ""
var absorb_range := 90.0
var talk_range := 110.0
var _t := 0.0


func _ready() -> void:
	display_name = LOOKS[id].name
	z_index = 4
	if id == "veldora":
		talk_range = 300.0
		absorb_range = 260.0


func _process(delta: float) -> void:
	_t += delta
	queue_redraw()


func set_display_name(n: String) -> void:
	display_name = n


func get_absorb_name() -> String:
	return display_name


func _draw() -> void:
	var look: Dictionary = LOOKS[id]
	match look.kind:
		"dragon":
			_draw_dragon()
		"wolf":
			var c := Color(0.2, 0.2, 0.28)
			draw_rect(Rect2(-22, -10, 40, 22), c)
			draw_circle(Vector2(20, -10), 12, c)
			draw_circle(Vector2(23, -13), 3, Color(1, 0.85, 0.1))
			for x in [-18, -8, 6, 14]:
				draw_line(Vector2(x, 10), Vector2(x, 22), c, 5.0)
		_:
			var r := 16.0 if look.kind == "human" else 13.0
			var bob := sin(_t * 2.0) * 1.5
			draw_circle(Vector2(0, r), r * 0.8, Color(0, 0, 0, 0.25))
			var cloth: Color = look.cloth
			draw_colored_polygon(PackedVector2Array([Vector2(-r * 0.6, -r * 0.4 + bob), Vector2(r * 0.6, -r * 0.4 + bob), Vector2(r * 0.85, r), Vector2(-r * 0.85, r)]), cloth)
			draw_circle(Vector2(0, -r * 0.95 + bob), r * 0.55, look.skin)
			draw_arc(Vector2(0, -r * 1.0 + bob), r * 0.58, PI * 0.9, TAU + 0.1, 14, look.hair, r * 0.3)
			if look.get("mask", false):
				draw_rect(Rect2(-r * 0.45, -r * 1.15 + bob, r * 0.9, r * 0.4), Color(0.95, 0.95, 0.95))
			else:
				draw_circle(Vector2(r * 0.2, -r * 0.95 + bob), 2.0, Color(0.1, 0.1, 0.1))
			if look.get("horn", false):
				draw_colored_polygon(PackedVector2Array([Vector2(-3, -r * 1.45 + bob), Vector2(0, -r * 2.0 + bob), Vector2(3, -r * 1.45 + bob)]), Color(0.95, 0.95, 0.9))
			if id == "milim":
				draw_line(Vector2(-r * 0.5, -r * 1.2), Vector2(-r * 1.2, -r * 0.2), look.hair, 4.0)
				draw_line(Vector2(r * 0.5, -r * 1.2), Vector2(r * 1.2, -r * 0.2), look.hair, 4.0)
	var y := -150.0 if look.kind == "dragon" else -44.0
	draw_string(ThemeDB.fallback_font, Vector2(-100, y), display_name, HORIZONTAL_ALIGNMENT_CENTER, 200, 14, Color(1, 0.9, 0.5))


func _draw_dragon() -> void:
	# Veldora selado na Prisão Infinita
	var c := Color(0.12, 0.12, 0.2)
	var pulse := sin(_t * 2.0) * 4.0
	draw_circle(Vector2(0, 10), 140.0 + pulse, Color(1.0, 0.85, 0.4, 0.12))
	draw_arc(Vector2(0, 10), 140.0 + pulse, 0, TAU, 64, Color(1.0, 0.85, 0.4, 0.6), 3.0)
	for s in [-1, 1]:
		draw_colored_polygon(PackedVector2Array([Vector2(s * 20, -20), Vector2(s * 120, -90), Vector2(s * 110, 10), Vector2(s * 40, 20)]), Color(0.2, 0.15, 0.32))
	draw_circle(Vector2(0, 20), 55, c)
	draw_line(Vector2(0, 0), Vector2(0, -70), c, 30.0)
	draw_circle(Vector2(0, -80), 30, c)
	draw_rect(Rect2(-18, -78, 36, 40), c)
	for s in [-1, 1]:
		draw_circle(Vector2(s * 12, -84), 5, Color(1, 0.8, 0.2))
		draw_line(Vector2(s * 15, -100), Vector2(s * 30, -130), Color(0.8, 0.75, 0.6), 6.0)
	draw_line(Vector2(40, 50), Vector2(110, 80 + sin(_t) * 8), c, 16.0)
