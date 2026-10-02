shader_type spatial;
render_mode blend_add, unshaded, cull_disabled;
// Disco de portal: espiral animada.
uniform vec4 color : source_color = vec4(0.4, 0.7, 1.0, 1.0);

void fragment() {
	vec2 p = UV - 0.5;
	float r = length(p) * 2.0;
	float a = atan(p.y, p.x);
	float s = sin(a * 4.0 + r * 12.0 - TIME * 4.0) * 0.5 + 0.5;
	float m = smoothstep(1.0, 0.2, r);
	ALBEDO = color.rgb * (0.4 + s * 0.9) * m;
	ALPHA = m;
}
