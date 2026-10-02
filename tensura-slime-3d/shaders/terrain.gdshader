shader_type spatial;
// Terreno: cor por vértice (grama/terra/rocha) + detalhe de ruído em duas escalas.
uniform sampler2D noise_tex : repeat_enable, filter_linear_mipmap;
uniform float detail = 1.0;
varying vec3 wpos;

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	float n = texture(noise_tex, wpos.xz * 0.025).r;
	float n2 = texture(noise_tex, wpos.xz * 0.35).r;
	vec3 c = COLOR.rgb * (0.78 + 0.4 * n) * mix(1.0, 0.85 + 0.3 * n2, detail);
	ALBEDO = c;
	ROUGHNESS = 0.92;
	SPECULAR = 0.2;
}
