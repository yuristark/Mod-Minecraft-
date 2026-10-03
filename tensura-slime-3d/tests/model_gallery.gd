extends SceneTree
## Galeria dos modelos .glb (precisa de tela; ex.: xvfb-run).
##   xvfb-run godot --path tensura-slime-3d --rendering-driver opengl3 --script tests/model_gallery.gd -- ids...
## Variáveis: SHOT_DIR (pasta das imagens), ANIM (idle/walk/attack), ANIM_T (tempo).

func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var ids: Array = []
	for a in OS.get_cmdline_user_args():
		ids.append(a)
	if ids.is_empty():
		for f in DirAccess.get_files_at("res://models"):
			if f.ends_with(".gltf"):
				ids.append(f.get_basename())
	var anim := OS.get_environment("ANIM")
	var anim_t := float(OS.get_environment("ANIM_T")) if OS.get_environment("ANIM_T") != "" else 0.3
	var per := int(OS.get_environment("PER")) if OS.get_environment("PER") != "" else 1
	var scene := Node3D.new()
	root.add_child(scene)
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.32, 0.38, 0.48)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.6, 0.65, 0.75)
	env.ambient_light_energy = 0.6
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	var we := WorldEnvironment.new()
	we.environment = env
	scene.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-40, 30, 0)
	sun.light_energy = 1.4
	sun.shadow_enabled = true
	scene.add_child(sun)
	var fill := DirectionalLight3D.new()
	fill.rotation_degrees = Vector3(-20, 200, 0)
	fill.light_energy = 0.5
	scene.add_child(fill)
	var floor_m := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(200, 200)
	floor_m.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.35, 0.4, 0.33)
	floor_m.material_override = fm
	scene.add_child(floor_m)
	var cam := Camera3D.new()
	scene.add_child(cam)
	var batch := 0
	var i := 0
	while i < ids.size():
		var group: Array = ids.slice(i, i + per)
		var nodes := []
		var x := 0.0
		var max_h := 0.0
		var widths := []
		for id in group:
			var ps = load("res://models/%s.gltf" % id)
			if ps == null:
				print("FALTA ", id)
				continue
			var inst: Node3D = ps.instantiate()
			scene.add_child(inst)
			var aabb := _aabb(inst)
			var w := maxf(aabb.size.x, 1.0)
			inst.position = Vector3(x + w / 2.0 - aabb.get_center().x, 0, 0)
			inst.rotation.y = 0.0  # modelo olha para -Z; câmera fica em -Z
			x += w + 0.6
			max_h = maxf(max_h, aabb.size.y)
			nodes.append(inst)
			var ap: AnimationPlayer = inst.find_child("AnimationPlayer", true, false)
			if ap and anim != "" and ap.has_animation(anim):
				ap.play(anim)
				ap.seek(anim_t, true)
				ap.pause()
			var l := Label3D.new()
			l.text = id
			l.font_size = 48
			l.pixel_size = 0.0025 * maxf(aabb.size.y, 0.6)
			l.position = Vector3(inst.position.x + aabb.get_center().x, -0.15, -aabb.size.z / 2.0 - 0.3)
			l.rotation.y = PI
			scene.add_child(l)
			nodes.append(l)
		var cx := x / 2.0
		var dist := maxf(x * 0.75, max_h * 1.25) + 0.4
		cam.position = Vector3(cx - dist * 0.55, max_h * 0.6, -dist * 0.85)
		cam.look_at(Vector3(cx, max_h * 0.5, 0), Vector3.UP)
		if OS.get_environment("CLOSE") != "":
			cam.position = Vector3(cx - max_h * 0.1, max_h * 0.88, -max_h * 0.45)
			cam.look_at(Vector3(cx, max_h * 0.86, 0), Vector3.UP)
		for f in 8:
			await process_frame
		await RenderingServer.frame_post_draw
		var img := root.get_viewport().get_texture().get_image()
		var path := OS.get_environment("SHOT_DIR").path_join("%s.png" % "_".join(group))
		img.save_png(path)
		print("galeria ", path, " ", group)
		for n in nodes:
			n.queue_free()
		await process_frame
		batch += 1
		i += per
	quit()


func _aabb(n: Node) -> AABB:
	var out := AABB()
	var first := true
	for c in n.find_children("*", "VisualInstance3D", true, false):
		var vi := c as VisualInstance3D
		var b := vi.global_transform * vi.get_aabb()
		if first:
			out = b
			first = false
		else:
			out = out.merge(b)
	return out
