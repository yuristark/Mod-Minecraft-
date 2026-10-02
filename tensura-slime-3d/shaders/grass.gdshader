shader_type spatial;
render_mode cull_disabled;
// Tufos de grama com balanço de vento (UV.y = 0 na ponta, 1 na base).
uniform vec4 base_color : source_color = vec4(0.12, 0.3, 0.08, 1.0);
uniform vec4 tip_color : source_color = vec4(0.5, 0.75, 0.25, 1.0);
uniform float wind = 1.0;

void vertex() {
	vec3 w = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float k = 1.0 - UV.y;
	VERTEX.x += sin(TIME * 2.1 + w.x * 0.35 + w.z * 0.2) * 0.22 * k * wind;
	VERTEX.z += cos(TIME * 1.7 + w.z * 0.3) * 0.12 * k * wind;
}

void fragment() {
	ALBEDO = mix(tip_color.rgb, base_color.rgb, UV.y) * COLOR.rgb;
	ROUGHNESS = 0.8;
	BACKLIGHT = vec3(0.25, 0.35, 0.1);
}
