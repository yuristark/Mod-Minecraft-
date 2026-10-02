shader_type spatial;
render_mode blend_mix, cull_disabled, depth_draw_always;
// Água estilizada: ondas no vértice, normal map animado e reflexo Fresnel.
uniform vec4 deep_color : source_color = vec4(0.03, 0.2, 0.4, 0.88);
uniform vec4 shallow_color : source_color = vec4(0.2, 0.65, 0.85, 0.7);
uniform sampler2D normal_tex : hint_normal, repeat_enable, filter_linear_mipmap;
uniform float uv_scale = 6.0;
uniform float glow = 0.0;

void vertex() {
	vec3 w = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	VERTEX.y += sin(w.x * 0.35 + TIME * 1.4) * 0.06 + cos(w.z * 0.3 + TIME * 1.1) * 0.06;
}

void fragment() {
	vec2 uv = UV * uv_scale;
	vec3 n1 = texture(normal_tex, uv + TIME * vec2(0.02, 0.012)).rgb;
	vec3 n2 = texture(normal_tex, uv * 1.6 - TIME * vec2(0.014, 0.022)).rgb;
	NORMAL_MAP = normalize(mix(n1, n2, 0.5));
	NORMAL_MAP_DEPTH = 0.6;
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	ALBEDO = mix(deep_color.rgb, shallow_color.rgb, fres);
	ALPHA = mix(deep_color.a, 0.97, fres);
	EMISSION = deep_color.rgb * glow;
	METALLIC = 0.15;
	ROUGHNESS = 0.04;
	SPECULAR = 0.9;
}
