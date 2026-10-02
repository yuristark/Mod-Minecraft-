shader_type spatial;
render_mode blend_mix, cull_back, depth_draw_always;
// Corpo do Rimuru: gelatina azul com borda brilhante (Fresnel), núcleo luminoso e ondulação.
uniform vec4 body_color : source_color = vec4(0.35, 0.72, 1.0, 0.82);
uniform vec4 rim_color : source_color = vec4(0.75, 0.95, 1.0, 1.0);
uniform float wobble = 0.03;
uniform float hurt = 0.0;

void vertex() {
	VERTEX += NORMAL * sin(TIME * 4.0 + VERTEX.y * 9.0 + VERTEX.x * 6.0) * wobble;
}

void fragment() {
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.5);
	vec3 base = mix(body_color.rgb, vec3(1.0, 0.3, 0.3), hurt);
	ALBEDO = base;
	EMISSION = rim_color.rgb * fres * 1.2 + base * 0.12;
	ALPHA = clamp(body_color.a + fres * 0.3, 0.0, 1.0);
	ROUGHNESS = 0.08;
	SPECULAR = 0.9;
	CLEARCOAT = 1.0;
}
