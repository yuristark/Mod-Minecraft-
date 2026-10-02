shader_type spatial;
render_mode blend_add, unshaded, cull_disabled, depth_draw_never;
// Aviso de área de ataque no chão (círculo que se enche).
uniform vec4 color : source_color = vec4(1.0, 0.2, 0.1, 1.0);
uniform float progress = 0.0;

void fragment() {
	float r = length(UV - 0.5) * 2.0;
	float ring = smoothstep(0.9, 0.97, r) * smoothstep(1.0, 0.97, r);
	float fill = step(r, progress) * 0.35;
	float a = (ring + fill) * step(r, 1.0);
	ALBEDO = color.rgb * a * 1.5;
	ALPHA = a;
}
