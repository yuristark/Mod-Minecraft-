"""
Gerador de modelos 3D do jogo Tensura (Blender 4.2+).

Cria TODOS os personagens e monstros do jogo com:
  - corpo orgânico (modificador Skin + Subdivision), rosto, olhos, cabelo em mechas,
    roupas (casaco, saia, capa, armadura), chifres, asas, caudas e armas
  - texturas de relevo procedurais (normal maps: pele, tecido, couro, metal, pelo, escamas)
  - esqueleto (Armature) com pesos e animações: idle, walk e attack
e exporta cada um como .glb para tensura-slime-3d/models/ (o Godot importa sozinho).

Os dados (cores, cabelo, chifres, armas...) vêm de tensura-slime-3d/scripts/game_data.gd (MODELS),
então dá para mudar um personagem lá e gerar de novo.

Como usar:
  Dentro do Blender:  blender -b -P blender/gerar_modelos.py
  Com o módulo bpy:   python blender/gerar_modelos.py
  Só alguns modelos:  python blender/gerar_modelos.py benimaru shion
  Salvar também .blend: adicione --blend
"""
import bpy
import math
import os
import re
import sys
import random
import zlib

import numpy as np
from mathutils import Vector, Matrix, Quaternion

ROOT = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.normpath(os.path.join(ROOT, "..", "tensura-slime-3d"))
OUT = os.path.join(GAME, "models")
BLEND_OUT = os.path.join(ROOT, "modelos_blend")
TEX_DIR = os.path.join(OUT, "texturas")
FPS = 30

FEMALE = {"shuna", "shion", "milim", "treyni", "shizu", "eren", "hinata", "luminous", "ramiris",
          "frey", "elmesia", "chloe"}
SLEEVELESS = {"orc", "geld", "geld_new", "ogre", "ogre_prince", "carillon", "dagruel", "kurobe", "goblin", "ifrit"}
ARMORED = {"soldier", "knight", "orc_knight", "gazel", "imperial"}

# Monstros que no jogo não tinham model_id + formas do jogador
EXTRA = {
    "serpent": {"kind": "serpent", "color": (0.35, 0.2, 0.5, 1)},
    "spider": {"kind": "spider", "color": (0.1, 0.1, 0.12, 1)},
    "bat": {"kind": "bat", "color": (0.3, 0.22, 0.2, 1)},
    "wolf": {"kind": "quadruped", "color": (0.35, 0.35, 0.4, 1), "star": True},
    "lizard": {"kind": "quadruped", "color": (0.45, 0.4, 0.25, 1), "armored": True},
    "centipede": {"kind": "centipede", "color": (0.45, 0.12, 0.2, 1)},
    "player_bat": {"kind": "bat", "color": (0.3, 0.5, 0.85, 1)},
    "player_wolf": {"kind": "quadruped", "color": (0.22, 0.28, 0.42, 1), "horn": True, "star": True, "eye": (1, 0.8, 0.2, 1)},
}


# =============================================================================== DADOS
def load_specs():
    txt = open(os.path.join(GAME, "scripts", "game_data.gd"), encoding="utf-8").read()
    i = txt.index("{", txt.index("const MODELS := {"))
    depth = 0
    end = i
    for j in range(i, len(txt)):
        if txt[j] == "{":
            depth += 1
        elif txt[j] == "}":
            depth -= 1
            if depth == 0:
                end = j
                break
    body = re.sub(r"#[^\n]*", "", txt[i:end + 1]).replace("true", "True").replace("false", "False")

    def Color(r, g, b, a=1.0):
        return (r, g, b, a)

    specs = eval(body, {"Color": Color, "C_SKIN": Color(0.98, 0.86, 0.76)})
    specs.update(EXTRA)
    return specs


def lin(c):
    """sRGB -> linear (o Godot converte de volta ao importar)."""
    out = []
    for v in c[:3]:
        out.append(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4)
    return (*out, c[3] if len(c) > 3 else 1.0)


def dark(c, k):
    return (c[0] * (1 - k), c[1] * (1 - k), c[2] * (1 - k), 1.0)


def light(c, k):
    return (c[0] + (1 - c[0]) * k, c[1] + (1 - c[1]) * k, c[2] + (1 - c[2]) * k, 1.0)


# =============================================================================== TEXTURAS (normal maps)
_tex_cache = {}


def _tile_noise(n, scale, rng, aniso=(1.0, 1.0)):
    f = rng.standard_normal((n, n))
    F = np.fft.fft2(f)
    ky = np.fft.fftfreq(n)[:, None] * aniso[1]
    kx = np.fft.fftfreq(n)[None, :] * aniso[0]
    k = np.sqrt(kx ** 2 + ky ** 2)
    F *= np.exp(-(k * n / scale) ** 2)
    h = np.real(np.fft.ifft2(F))
    h -= h.min()
    return h / (h.max() + 1e-9)


def _voronoi(n, cells, rng):
    pts = rng.random((cells, 2)) * n
    yy, xx = np.mgrid[0:n, 0:n]
    d1 = np.full((n, n), 1e9)
    d2 = np.full((n, n), 1e9)
    for px, py in pts:
        dx = np.abs(xx - px)
        dy = np.abs(yy - py)
        dx = np.minimum(dx, n - dx)
        dy = np.minimum(dy, n - dy)
        d = np.sqrt(dx * dx + dy * dy)
        d2 = np.where(d < d1, d1, np.minimum(d2, d))
        d1 = np.minimum(d1, d)
    e = np.clip((d2 - d1) / 6.0, 0, 1)
    return e


def normal_texture(kind):
    if kind in _tex_cache:
        return _tex_cache[kind]
    path = os.path.join(TEX_DIR, "N_%s.png" % kind)
    if os.path.exists(path):
        img = bpy.data.images.load(path, check_existing=True)
        img.colorspace_settings.name = "Non-Color"
        _tex_cache[kind] = img
        return img
    n = 128
    rng = np.random.default_rng(zlib.crc32(kind.encode()))  # determinístico
    yy, xx = np.mgrid[0:n, 0:n] / n
    strength = 2.0
    if kind == "cloth":
        h = 0.5 * (np.sin(xx * 2 * np.pi * 32) * np.sin(yy * 2 * np.pi * 32)) + 0.3 * _tile_noise(n, 30, rng)
        strength = 1.5
    elif kind == "leather":
        h = _tile_noise(n, 20, rng) * 0.7 + _tile_noise(n, 60, rng) * 0.3
        strength = 2.5
    elif kind == "metal":
        h = _tile_noise(n, 50, rng, (0.05, 1.0)) * 0.6 + _tile_noise(n, 8, rng) * 0.4
        strength = 1.2
    elif kind == "fur":
        h = _tile_noise(n, 70, rng, (1.0, 0.08))
        strength = 4.0
    elif kind == "hair":
        h = _tile_noise(n, 60, rng, (1.0, 0.05))
        strength = 3.0
    elif kind == "scale":
        h = _voronoi(n, 60, rng) + 0.2 * _tile_noise(n, 40, rng)
        strength = 3.5
    elif kind == "stone":
        h = _tile_noise(n, 12, rng) * 0.6 + _tile_noise(n, 50, rng) * 0.4
        strength = 3.0
    else:  # pele
        h = _tile_noise(n, 70, rng) * 0.6 + _tile_noise(n, 15, rng) * 0.4
        strength = 0.8
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    nz = np.ones_like(h)
    ln = np.sqrt(dx * dx + dy * dy + nz)
    rgb = np.stack([-dx / ln, -dy / ln, nz / ln], -1) * 0.5 + 0.5
    rgba = np.concatenate([rgb, np.ones((n, n, 1))], -1).astype(np.float32)
    tmp = bpy.data.images.new("N_" + kind, n, n, alpha=False)
    tmp.pixels.foreach_set(rgba[::-1].ravel())
    tmp.update()
    os.makedirs(TEX_DIR, exist_ok=True)
    tmp.filepath_raw = path
    tmp.file_format = "PNG"
    tmp.save()
    bpy.data.images.remove(tmp)
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = "Non-Color"
    _tex_cache[kind] = img
    return img


# =============================================================================== MATERIAIS
def make_mat(name, color, rough=0.6, metal=0.0, emit=0.0, alpha=1.0, tex=None, tex_strength=0.6,
             coat=0.0, sheen=0.0, double=False, sss=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nodes = m.node_tree.nodes
    b = nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = lin(color)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit > 0:
        b.inputs["Emission Color"].default_value = lin(color)
        b.inputs["Emission Strength"].default_value = emit
    if coat > 0:
        b.inputs["Coat Weight"].default_value = coat
    if sheen > 0:
        b.inputs["Sheen Weight"].default_value = sheen
    if alpha < 1.0:
        b.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND"
        try:
            m.surface_render_method = "BLENDED"
        except Exception:
            pass
    m.use_backface_culling = not double
    if tex:
        t = nodes.new("ShaderNodeTexImage")
        t.image = normal_texture(tex)
        nm = nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = tex_strength
        m.node_tree.links.new(t.outputs["Color"], nm.inputs["Color"])
        m.node_tree.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    return m


# =============================================================================== GEOMETRIA
class Builder:
    """Acumula partes (vértices, faces, material por face, osso/regra de peso por vértice)."""

    def __init__(self):
        self.v = []
        self.f = []
        self.fm = []
        self.fs = []
        self.vg = []
        self.mats = {}
        self.bones = {}   # nome -> (head, tail, parent, deform)

    def mat(self, key, *args, **kw):
        if key not in self.mats:
            self.mats[key] = make_mat(key, *args, **kw)
        return key

    def add(self, verts, faces, mat, group, smooth=True, xform=None):
        base = len(self.v)
        for p in verts:
            p = Vector(p)
            if xform is not None:
                p = xform @ p
            self.v.append(p)
            self.vg.append(group)
        for fc in faces:
            self.f.append(tuple(base + i for i in fc))
            self.fm.append(mat)
            self.fs.append(smooth)

    def bone(self, name, head, tail, parent=None, deform=True):
        self.bones[name] = (Vector(head), Vector(tail), parent, deform)


def sphere_geo(c, r, seg=16, rings=10, deform=None):
    verts = []
    faces = []
    for i in range(rings + 1):
        th = math.pi * i / rings
        for j in range(seg):
            ph = 2 * math.pi * j / seg
            u = Vector((math.sin(th) * math.cos(ph), math.sin(th) * math.sin(ph), math.cos(th)))
            if deform:
                u = deform(u)
            verts.append(Vector((c[0] + u.x * r[0], c[1] + u.y * r[1], c[2] + u.z * r[2])))
    for i in range(rings):
        for j in range(seg):
            a = i * seg + j
            b = i * seg + (j + 1) % seg
            faces.append((a, b, b + seg, a + seg))
    return verts, faces


def tube_geo(points, radii, sides=8, cap_start=True, cap_end=True):
    pts = [Vector(p) for p in points]
    n = len(pts)
    if not isinstance(radii, (list, tuple)) or not isinstance(radii[0], (list, tuple)):
        radii = [r if isinstance(r, (list, tuple)) else (r, r) for r in (radii if isinstance(radii, (list, tuple)) else [radii] * n)]
    tangents = []
    for i in range(n):
        if i == 0:
            t = pts[1] - pts[0]
        elif i == n - 1:
            t = pts[-1] - pts[-2]
        else:
            t = pts[i + 1] - pts[i - 1]
        tangents.append(t.normalized() if t.length > 1e-9 else Vector((0, 0, 1)))
    ref = Vector((0, 0, 1)) if abs(tangents[0].z) < 0.9 else Vector((1, 0, 0))
    nrm = tangents[0].cross(ref).normalized()
    verts = []
    faces = []
    for i in range(n):
        t = tangents[i]
        nrm = (nrm - t * nrm.dot(t))
        if nrm.length < 1e-6:
            nrm = t.orthogonal()
        nrm.normalize()
        bi = t.cross(nrm).normalized()
        rx, ry = radii[i]
        for s in range(sides):
            a = 2 * math.pi * s / sides
            verts.append(pts[i] + nrm * math.cos(a) * rx + bi * math.sin(a) * ry)
    for i in range(n - 1):
        for s in range(sides):
            a = i * sides + s
            b = i * sides + (s + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    if cap_start:
        verts.append(pts[0])
        c = len(verts) - 1
        for s in range(sides):
            faces.append(((s + 1) % sides, s, c))
    if cap_end:
        verts.append(pts[-1])
        c = len(verts) - 1
        o = (n - 1) * sides
        for s in range(sides):
            faces.append((o + s, o + (s + 1) % sides, c))
    return verts, faces


def box_geo(c, size):
    hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
    v = [Vector((c[0] + x * hx, c[1] + y * hy, c[2] + z * hz)) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
    f = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    return v, f


def lathe_geo(profile, sides=20, center=(0, 0, 0), yscale=1.0, gap=0.0, front_flat=1.0):
    """profile: [(raio, z)]. gap: abertura frontal em radianos (casaco aberto)."""
    verts = []
    faces = []
    cols = sides + (1 if gap > 0 else 0)
    for (r, z) in profile:
        for s in range(cols):
            if gap > 0:
                a = math.pi / 2 + gap / 2 + (2 * math.pi - gap) * s / sides
            else:
                a = 2 * math.pi * s / sides
            y = math.sin(a) * r * yscale
            if y > 0:
                y *= front_flat
            verts.append(Vector((center[0] + math.cos(a) * r, center[1] + y, center[2] + z)))
    for i in range(len(profile) - 1):
        for s in range(sides):
            a = i * cols + s
            b = i * cols + (s + 1) % cols
            if gap > 0 and s == sides:
                continue
            faces.append((a, b, b + cols, a + cols))
    return verts, faces


def skin_geo(nodes, edges, radii, subdiv=2):
    me = bpy.data.meshes.new("skin_tmp")
    me.from_pydata([tuple(p) for p in nodes], edges, [])
    ob = bpy.data.objects.new("skin_tmp", me)
    bpy.context.scene.collection.objects.link(ob)
    sk = ob.modifiers.new("skin", "SKIN")
    sk.use_smooth_shade = True
    sk.branch_smoothing = 0.6
    for i, d in enumerate(me.skin_vertices[0].data):
        d.radius = (radii[i][0] * 1.08, radii[i][1] * 1.08)
        d.use_root = (i == 0)
    sub = ob.modifiers.new("sub", "SUBSURF")
    sub.levels = subdiv
    dg = bpy.context.evaluated_depsgraph_get()
    em = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    verts = [v.co.copy() for v in em.vertices]
    faces = [tuple(p.vertices) for p in em.polygons]
    bpy.data.objects.remove(ob)
    bpy.data.meshes.remove(me)
    bpy.data.meshes.remove(em)
    return verts, faces


def rot_to(direction):
    """Matriz que leva +Z para 'direction'."""
    d = Vector(direction).normalized()
    return Vector((0, 0, 1)).rotation_difference(d).to_matrix().to_4x4()


# =============================================================================== CABELO / MECHAS
def strand_path(origin, direction, length, segs=6, gravity=0.6, curl=0.0, head_c=None, head_r=None, back_limit=None, face_guard=False):
    pts = [Vector(origin)]
    d = Vector(direction).normalized()
    step = length / segs
    for k in range(segs):
        g = Vector((0, 0, -1)) * gravity * (k + 1) / segs
        d = (d + g + Vector((curl * math.sin(k), 0, 0))).normalized()
        p = pts[-1] + d * step
        if head_c is not None:
            q = Vector(((p.x - head_c.x) / head_r.x, (p.y - head_c.y) / head_r.y, (p.z - head_c.z) / head_r.z))
            if q.length < 1.12:
                q = q.normalized() * 1.12
                p = Vector((head_c.x + q.x * head_r.x, head_c.y + q.y * head_r.y, head_c.z + q.z * head_r.z))
        if face_guard and head_c is not None:
            # deixa o rosto livre: mechas da frente vão para os lados
            if (p.y - head_c.y) > -head_r.y * 0.1 and head_c.z - head_r.z * 1.4 < p.z < head_c.z + head_r.z * 0.55 \
                    and abs(p.x - head_c.x) < head_r.x * 1.15:
                sgn = 1.0 if p.x >= head_c.x else -1.0
                p.x = head_c.x + sgn * head_r.x * 1.15
                p.y = min(p.y, head_c.y + head_r.y * 0.35)
        if back_limit is not None and p.z < back_limit[0] and p.y > back_limit[1]:
            p.y = back_limit[1]
        pts.append(p)
    return pts


def add_strand(B, pts, r0, mat, group="head", sides=4, flat=0.6):
    radii = []
    n = len(pts)
    for i in range(n):
        t = i / (n - 1)
        r = r0 * (1 - t) ** 0.8 + 0.002
        radii.append((r, r * flat))
    v, f = tube_geo(pts, radii, sides, cap_start=False, cap_end=True)
    B.add(v, f, mat, group)


def fib_sphere(n):
    pts = []
    ga = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        z = 1 - 2 * (i + 0.5) / n
        r = math.sqrt(1 - z * z)
        pts.append(Vector((math.cos(ga * i) * r, math.sin(ga * i) * r, z)))
    return pts


def build_hair(B, style, hair, hc, hr, rnd):
    if style == "bald":
        return
    # touca do couro cabeludo
    v, f = sphere_geo(hc + Vector((0, -0.006, 0.006)), (hr.x * 1.07, hr.y * 1.07, hr.z * 1.06), 24, 16)
    faces = []
    for fc in f:
        cen = sum((v[i] for i in fc), Vector()) / 4
        u = Vector(((cen.x - hc.x) / hr.x, (cen.y - hc.y) / hr.y, (cen.z - hc.z) / hr.z))
        if u.y > 0.3 and u.z < 0.42:
            continue  # rosto
        if u.z < -0.35 and u.y > -0.45:
            continue  # orelhas/pescoço
        if u.z < -0.75:
            continue
        faces.append(fc)
    B.add(v, faces, hair, "head")

    pts = fib_sphere(96)
    origins = [p for p in pts if p.z > -0.25 and not (p.y > 0.35 and p.z < 0.45)]
    lengths = {"short": (0.07, 0.12), "spiky": (0.12, 0.22), "long": (0.35, 0.72), "pony": (0.06, 0.1),
               "twin": (0.07, 0.11), "bob": (0.14, 0.2)}
    lo, hi = lengths.get(style, (0.07, 0.12))
    for u in origins:
        o = Vector((hc.x + u.x * hr.x * 1.05, hc.y + u.y * hr.y * 1.05, hc.z + u.z * hr.z * 1.05))
        if style == "spiky":
            d = (u + Vector((0, -0.2, 0.5))).normalized()
            pth = strand_path(o, d, rnd.uniform(lo, hi), 4, 0.15, 0, hc, hr)
            add_strand(B, pth, 0.036, hair)
            continue
        L = rnd.uniform(lo, hi)
        grav = 2.2
        if style == "long":
            if u.y > 0.1:  # laterais e frente mais curtas
                L *= 0.55 if u.y > 0.3 else 0.8
        if style == "bob":
            L = 0.12 + max(0.0, u.z) * 0.06
        # mechas saem quase tangentes ao crânio e caem com a gravidade
        tang = Vector((0, 0, -1)) - u * u.z
        if tang.length < 0.1:
            tang = Vector((0, -1, 0))
        d = (u * 0.25 + tang.normalized() + Vector((0, -0.25, 0))).normalized()
        segs = 7 if L > 0.3 else 5
        if u.y > 0.15:
            d = (d + Vector((math.copysign(0.7, u.x if abs(u.x) > 1e-3 else 1.0), -0.6, 0))).normalized()
        pth = strand_path(o, d, L, segs, grav, 0, hc, hr, back_limit=(hc.z - 0.12, -0.1), face_guard=True)
        # mechas longas grudam no corpo (não abrem em leque)
        if L > 0.3:
            for q in pth[2:]:
                q.x *= 0.85
        add_strand(B, pth, 0.032 if L < 0.3 else 0.038, hair)
    # franja
    for i in range(9):
        x = -0.07 + i * 0.0175
        o = Vector((hc.x + x, hc.y + hr.y * 0.66, hc.z + hr.z * 0.74))
        d = Vector((x * 3, 1.0, -0.35)).normalized()
        pth = strand_path(o, d, rnd.uniform(0.035, 0.05), 3, 0.9, 0, hc, hr)
        add_strand(B, pth, 0.016, hair)
    if style == "pony":
        tie = Vector((hc.x, hc.y - hr.y * 1.0, hc.z + hr.z * 0.35))
        for i in range(14):
            o = tie + Vector((rnd.uniform(-0.02, 0.02), 0, rnd.uniform(-0.02, 0.02)))
            pth = strand_path(o, Vector((rnd.uniform(-0.2, 0.2), -1, 0.2)), rnd.uniform(0.4, 0.55), 7, 2.6, 0)
            add_strand(B, pth, 0.03, hair)
    if style == "twin":
        for sx in (-1, 1):
            tie = Vector((hc.x + sx * hr.x * 1.05, hc.y - 0.03, hc.z + hr.z * 0.45))
            for i in range(12):
                o = tie + Vector((0, rnd.uniform(-0.02, 0.02), rnd.uniform(-0.02, 0.02)))
                pth = strand_path(o, Vector((sx * 0.6, -0.3, 0.1)), rnd.uniform(0.5, 0.62), 7, 3.2, 0)
                add_strand(B, pth, 0.03, hair)


# =============================================================================== HUMANOIDE
def humanoid(B, spec, mid, rnd):
    fem = mid in FEMALE
    H = spec.get("height", 1.0)
    bulk = spec.get("bulk", 1.0)
    glow = spec.get("glow", 0.0)
    skin_c = spec.get("skin", (0.98, 0.85, 0.75, 1))
    hair_c = spec.get("hair", (0.15, 0.12, 0.1, 1))
    out_c = spec.get("outfit", (0.2, 0.2, 0.3, 1))
    out2_c = spec.get("outfit2", (0.85, 0.85, 0.9, 1))
    boots_c = spec.get("boots", (0.12, 0.1, 0.1, 1))
    eye_c = spec.get("eye", (0.15, 0.15, 0.2, 1))
    armored = mid in ARMORED

    skin = B.mat("skin", skin_c, 0.55, emit=glow, tex="skin", tex_strength=0.4, sss=0.2)
    hair = B.mat("hair", hair_c, 0.45, emit=spec.get("hair_glow", 0.0), tex="hair", tex_strength=0.8, sheen=0.3)
    outfit = B.mat("outfit", out_c, 0.75, emit=glow * 0.5, tex="cloth", tex_strength=0.6, sheen=0.2)
    outfit2 = B.mat("outfit2", out2_c, 0.6, tex="cloth", tex_strength=0.4)
    pants = B.mat("pants", dark(out_c, 0.3), 0.8, tex="cloth", tex_strength=0.6)
    boots = B.mat("boots", boots_c, 0.45, tex="leather", tex_strength=0.8, coat=0.3)
    eyew = B.mat("eye_white", (0.95, 0.95, 0.95, 1), 0.2)
    iris = B.mat("iris", eye_c, 0.15, emit=0.6)
    pupil = B.mat("pupil", (0.02, 0.02, 0.03, 1), 0.1)
    lips = B.mat("lips", dark(skin_c, 0.3) if glow == 0 else skin_c, 0.4)
    metal = B.mat("metal", spec.get("helmet_color", (0.75, 0.77, 0.8, 1)), 0.3, metal=0.6, tex="metal", tex_strength=0.5)

    shW = (0.86 if fem else 1.08) * bulk
    hipW = (1.1 if fem else 1.0) * bulk
    waW = (0.82 if fem else 1.0) * bulk
    limb = (0.9 if fem else 1.0) * (bulk ** 0.7) * 1.3
    tor = 1.15

    # ---------------- corpo (Skin modifier)
    N = []
    R = []

    def node(p, r):
        N.append(Vector(p))
        R.append(r)
        return len(N) - 1

    pelvis = node((0, 0, 0.95), (0.15 * hipW * tor, 0.1 * hipW * tor))
    waist = node((0, 0, 1.08), (0.12 * waW * tor, 0.085 * waW * tor))
    chest = node((0, 0.005, 1.26), (0.15 * shW * tor, 0.1 * shW * tor))
    upch = node((0, 0, 1.38), (0.155 * shW * tor, 0.09 * shW * tor))
    neck0 = node((0, 0, 1.47), (0.052, 0.05))
    neck1 = node((0, 0.005, 1.57), (0.045, 0.045))
    E = [(pelvis, waist), (waist, chest), (chest, upch), (upch, neck0), (neck0, neck1)]
    hands = {}
    for sx in (1, -1):
        sh = node((sx * 0.2 * shW, 0, 1.41), (0.056 * limb, 0.05 * limb))
        ua = node((sx * (0.22 * shW + 0.02), 0, 1.28), (0.046 * limb, 0.044 * limb))
        el = node((sx * (0.235 * shW + 0.02), -0.01, 1.14), (0.036 * limb, 0.036 * limb))
        fa = node((sx * (0.245 * shW + 0.02), 0.0, 1.02), (0.035 * limb, 0.032 * limb))
        wr = node((sx * (0.255 * shW + 0.02), 0.01, 0.89), (0.031, 0.025))
        hd = node((sx * (0.26 * shW + 0.02), 0.02, 0.78), (0.04, 0.018))
        E += [(upch, sh), (sh, ua), (ua, el), (el, fa), (fa, wr), (wr, hd)]
        hands[sx] = (N[wr], N[hd])
        hp = node((sx * 0.092 * hipW, 0, 0.91), (0.088 * limb * hipW, 0.088 * limb))
        th = node((sx * 0.1 * hipW, 0.01, 0.72), (0.077 * limb * hipW, 0.077 * limb))
        kn = node((sx * 0.1 * hipW, 0.012, 0.5), (0.052 * limb, 0.054 * limb))
        cf = node((sx * 0.1 * hipW, -0.018, 0.33), (0.053 * limb, 0.055 * limb))
        an = node((sx * 0.1 * hipW, -0.01, 0.09), (0.037, 0.04))
        to = node((sx * 0.1 * hipW, 0.14, 0.035), (0.042, 0.026))
        E += [(pelvis, hp), (hp, th), (th, kn), (kn, cf), (cf, an), (an, to)]
    bv, bf = skin_geo(N, E, R, 2)
    auto_body = ("auto", ["hips", "spine", "chest", "neck", "upper_arm.L", "forearm.L", "hand.L", "upper_arm.R",
                          "forearm.R", "hand.R", "thigh.L", "shin.L", "foot.L", "thigh.R", "shin.R", "foot.R"])
    sleeveless = mid in SLEEVELESS
    # (adicionar de uma vez para manter vértices compartilhados)
    mats = []
    for fc in bf:
        c = sum((bv[i] for i in fc), Vector()) / len(fc)
        ax = abs(c.x)
        if c.z > 1.47:
            m = skin
        elif ax > 0.19 * shW + 0.05 and c.z < 0.905:
            m = skin if not armored else boots
        elif c.z < 0.3:
            m = boots
        elif 0.91 < c.z < 0.985 and ax < 0.17 * hipW:
            m = outfit2
        elif c.z < 0.93:
            m = pants
        elif ax > 0.165 * shW * tor and c.z < 1.42:
            m = skin if (sleeveless and c.z < 1.36) else outfit
        elif c.y > 0.04 and ax < 0.022 and 1.0 < c.z < 1.44:
            m = outfit2
        elif sleeveless and c.y > 0.02 and c.z > 1.12:
            m = skin
        else:
            m = outfit
        mats.append(m)
    base = len(B.v)
    for p in bv:
        B.v.append(p)
        B.vg.append(auto_body)
    for fc, m in zip(bf, mats):
        B.f.append(tuple(base + i for i in fc))
        B.fm.append(m)
        B.fs.append(True)

    if fem and not armored:
        for sx in (1, -1):
            v, f = sphere_geo((sx * 0.052 * shW, 0.07, 1.3), (0.06 * shW, 0.05, 0.055), 12, 8)
            B.add(v, f, outfit, ("auto", ["chest"]))

    # ---------------- cabeça
    hc = Vector((0, 0.0, 1.668))
    hr = Vector((0.088, 0.1, 0.116))
    snout = spec.get("snout", False)
    tusks = spec.get("tusks", False)
    lizard = snout and not tusks

    def head_deform(u):
        x, y, z = u.x, u.y, u.z
        if z < 0:
            x *= 1 - 0.3 * (-z) ** 1.2 * (0.6 if tusks else 1.0)
            if z < -0.5 and y > 0:
                y *= 1.05
        if y > 0.6:
            y = 0.6 + (y - 0.6) * 0.8
        if y < 0 and z > -0.3:
            y *= 1.08
        return Vector((x, y, z))

    v, f = sphere_geo(hc, hr, 26, 16, head_deform)
    B.add(v, f, skin, "head")
    if not spec.get("no_eyes", False):
        if lizard:
            eye_pts = [(sx * 0.07, 0.05, 1.69) for sx in (1, -1)]
        else:
            eye_pts = [(sx * 0.034, 0.079, 1.675) for sx in (1, -1)]
        for (x, y, z) in eye_pts:
            v, f = sphere_geo((x, y, z), (0.017, 0.009, 0.0115), 12, 8)
            B.add(v, f, eyew, "head")
            v, f = sphere_geo((x, y + 0.0065, z), (0.0095, 0.0045, 0.0098), 10, 6)
            B.add(v, f, iris, "head")
            v, f = sphere_geo((x, y + 0.0098, z), (0.0042, 0.002, 0.0045), 8, 5)
            B.add(v, f, pupil, "head")
            if not lizard:
                v, f = box_geo((x, y + 0.008, z + 0.022), (0.03, 0.006, 0.006))
                B.add(v, f, hair, "head", smooth=False)
    if lizard:
        v, f = tube_geo([(0, 0.05, 1.645), (0, 0.15, 1.63), (0, 0.24, 1.615)], [(0.065, 0.055), (0.05, 0.04), (0.028, 0.022)], 10)
        B.add(v, f, skin, "head")
        for sx in (1, -1):
            v, f = sphere_geo((sx * 0.012, 0.245, 1.625), (0.005, 0.004, 0.004), 6, 4)
            B.add(v, f, pupil, "head")
    elif not spec.get("no_eyes", False):
        if snout:  # nariz de porco (orc)
            v, f = tube_geo([(0, 0.075, 1.635), (0, 0.118, 1.635)], [(0.03, 0.024), (0.032, 0.026)], 10)
            B.add(v, f, skin, "head")
            for sx in (1, -1):
                v, f = sphere_geo((sx * 0.011, 0.119, 1.635), (0.007, 0.003, 0.009), 6, 4)
                B.add(v, f, pupil, "head")
        else:
            v, f = tube_geo([(0, 0.09, 1.672), (0, 0.103, 1.638)], [(0.009, 0.007), (0.014, 0.011)], 8)
            B.add(v, f, skin, "head")
        v, f = sphere_geo((0, 0.082, 1.603), (0.019, 0.0045, 0.0045), 10, 6)
        B.add(v, f, lips, "head")
        if spec.get("ears", "") != "elf":
            for sx in (1, -1):
                v, f = sphere_geo((sx * 0.087, -0.005, 1.655), (0.011, 0.024, 0.032), 10, 6)
                B.add(v, f, skin, "head")
    if tusks:
        for sx in (1, -1):
            pth = [Vector((sx * 0.03, 0.07, 1.59)), Vector((sx * 0.036, 0.085, 1.62)), Vector((sx * 0.04, 0.088, 1.645))]
            v, f = tube_geo(pth, [0.007, 0.005, 0.001], 6)
            B.add(v, f, B.mat("tusk", (0.95, 0.92, 0.8, 1), 0.35), "head")
    ears = spec.get("ears", "")
    if ears == "elf":
        for sx in (1, -1):
            v, f = tube_geo([(sx * 0.085, -0.005, 1.66), (sx * 0.12, -0.02, 1.69), (sx * 0.15, -0.03, 1.72)], [(0.012, 0.022), (0.008, 0.014), (0.001, 0.002)], 8)
            B.add(v, f, skin, "head")
    elif ears == "beast":
        for sx in (1, -1):
            v, f = tube_geo([(sx * 0.06, -0.01, 1.76), (sx * 0.075, -0.01, 1.82), (sx * 0.085, -0.01, 1.87)], [(0.03, 0.012), (0.02, 0.009), (0.001, 0.001)], 8)
            B.add(v, f, hair, "head")
    if spec.get("beard", False):
        for i in range(30):
            a = -1.2 + 2.4 * i / 29
            o = Vector((math.sin(a) * 0.07, math.cos(a) * 0.075 - 0.005, 1.6 + rnd.uniform(-0.02, 0.02)))
            pth = strand_path(o, Vector((math.sin(a) * 0.3, 0.6, -1)), rnd.uniform(0.08, 0.14), 4, 0.8)
            add_strand(B, pth, 0.018, hair)
    if spec.get("mask", False):
        v, f = sphere_geo((0.085, 0.03, 1.72), (0.012, 0.05, 0.06), 12, 8)
        B.add(v, f, B.mat("mask", (0.96, 0.95, 0.93, 1), 0.3, coat=0.6), "head")
    if spec.get("helmet", False):
        v, f = sphere_geo(hc + Vector((0, -0.004, 0.018)), (hr.x * 1.18, hr.y * 1.16, hr.z * 1.12), 24, 14)
        faces = []
        for fc in f:
            cen = sum((v[i] for i in fc), Vector()) / 4
            u = Vector(((cen.x - hc.x) / hr.x, (cen.y - hc.y) / hr.y, (cen.z - hc.z) / hr.z))
            if (u.y > 0.5 and -0.45 < u.z < 0.3) or u.z < -0.7:
                continue
            faces.append(fc)
        B.add(v, faces, metal, "head")
        v, f = box_geo((0, -0.01, hc.z + 0.135), (0.02, 0.2, 0.05))
        B.add(v, f, metal, "head", smooth=False)
    else:
        build_hair(B, spec.get("hair_style", "short"), hair, hc, hr, rnd)

    horns = int(spec.get("horns", 0))
    if horns:
        hm = B.mat("horn", spec.get("horn_color", (0.1, 0.1, 0.12, 1)), 0.3, coat=0.5)
        if horns == 1:
            roots = [(Vector((0, 0.07, 1.775)), Vector((0, 0.35, 1.0)), 0.11)]
        elif horns == 2:
            roots = [(Vector((sx * 0.045, 0.05, 1.772)), Vector((sx * 0.25, 0.3, 1.0)), 0.1) for sx in (1, -1)]
        else:
            roots = [(Vector((sx * 0.065, 0.0, 1.77)), Vector((sx * 1.0, -0.3, 0.6)), 0.24) for sx in (1, -1)]
        for o, d, L in roots:
            pth = strand_path(o, d, L, 5, -0.3 if horns < 3 else 0.5)
            v, f = tube_geo(pth, [(0.016 if horns < 3 else 0.026) * (1 - i / 5) + 0.001 for i in range(6)], 8)
            B.add(v, f, hm, "head")

    # ---------------- roupas
    if spec.get("coat", False):
        prof = [(0.155 * shW, 1.43), (0.17 * shW, 1.3), (0.15 * waW + 0.02, 1.08), (0.17 * hipW + 0.03, 0.95), (0.22 * hipW, 0.7), (0.27 * hipW, 0.46)]
        v, f = lathe_geo(prof, 22, yscale=0.72, gap=0.55)
        B.add(v, f, B.mat("coat", out_c, 0.7, tex="cloth", tex_strength=0.7, sheen=0.3, double=True), ("auto", ["chest", "spine", "hips", "thigh.L", "thigh.R"]))
        v, f = lathe_geo([(0.06, 1.46), (0.085, 1.52)], 16, yscale=0.9, gap=0.9)
        B.add(v, f, B.mat("collar", out2_c, 0.6, double=True), ("auto", ["chest", "neck"]))
    if spec.get("skirt", False):
        prof = [(0.13 * hipW, 1.0), (0.17 * hipW, 0.9), (0.24 * hipW, 0.68)]
        v, f = lathe_geo(prof, 22, yscale=0.8)
        B.add(v, f, B.mat("skirt", out2_c, 0.7, tex="cloth", tex_strength=0.6, double=True), ("auto", ["hips", "thigh.L", "thigh.R"]))
    if "cape" in spec:
        verts = []
        faces = []
        rows, cols = 8, 7
        for i in range(rows):
            t = i / (rows - 1)
            z = 1.44 - t * 1.0
            w = 0.2 + t * 0.12
            for j in range(cols):
                s = j / (cols - 1) * 2 - 1
                y = -0.12 * shW - 0.02 - t * 0.12 - (1 - s * s) * 0.03
                verts.append(Vector((s * w * shW, y, z)))
        for i in range(rows - 1):
            for j in range(cols - 1):
                a = i * cols + j
                faces.append((a, a + cols, a + cols + 1, a + 1))
        B.add(verts, faces, B.mat("cape", spec["cape"], 0.75, tex="cloth", tex_strength=0.7, sheen=0.4, double=True), ("auto", ["chest", "spine", "hips"]))
    if armored:
        for sx in (1, -1):
            v, f = sphere_geo((sx * 0.2 * shW, 0, 1.42), (0.08, 0.075, 0.06), 14, 8, lambda u: u if u.z > -0.2 else Vector((u.x, u.y, -0.2)))
            B.add(v, f, metal, "upper_arm.%s" % ("R" if sx > 0 else "L"))
        v, f = sphere_geo((0, 0.03, 1.27), (0.16 * shW, 0.1, 0.16), 18, 10)
        B.add(v, f, metal, ("auto", ["chest", "spine"]))
    v, f = box_geo((0, 0.095 * hipW + 0.005, 0.95), (0.05, 0.012, 0.04))
    B.add(v, f, B.mat("buckle", (0.85, 0.7, 0.3, 1), 0.3, metal=0.9), "hips", smooth=False)

    # ---------------- asas, cauda
    if "wings" in spec:
        wing_kind = "feather" if mid in ("deeno", "frey") else "membrane"
        wings(B, spec["wings"], spec.get("wing_glow", 0.0), wing_kind, Vector((0, -0.12, 1.36)), 1.0)
    if "tail" in spec:
        tm = B.mat("tail", spec["tail"], 0.5, tex="scale", tex_strength=0.8)
        pth = [Vector((0, -0.09, 0.95)), Vector((0, -0.3, 0.82)), Vector((0, -0.55, 0.55)), Vector((0, -0.8, 0.3)), Vector((0, -1.0, 0.12))]
        v, f = tube_geo(pth, [0.085, 0.07, 0.05, 0.03, 0.005], 10)
        B.add(v, f, tm, ("auto", ["tail1", "tail2"]))
        B.bone("tail1", (0, -0.09, 0.95), (0, -0.55, 0.55), "hips")
        B.bone("tail2", (0, -0.55, 0.55), (0, -1.0, 0.12), "tail1")

    # ---------------- arma
    wr, hd = hands[1]
    weapon(B, spec.get("weapon", "none"), hd + Vector((0, 0.005, 0.02)))

    # ---------------- esqueleto
    B.bone("hips", (0, 0, 0.93), (0, 0, 1.08))
    B.bone("spine", (0, 0, 1.08), (0, 0, 1.25), "hips")
    B.bone("chest", (0, 0, 1.25), (0, 0, 1.46), "spine")
    B.bone("neck", (0, 0, 1.46), (0, 0, 1.56), "chest")
    B.bone("head", (0, 0, 1.56), (0, 0, 1.86), "neck")
    for sx, s in ((1, "R"), (-1, "L")):
        B.bone("upper_arm." + s, (sx * 0.2 * shW, 0, 1.41), (sx * (0.235 * shW + 0.02), -0.01, 1.14), "chest")
        B.bone("forearm." + s, (sx * (0.235 * shW + 0.02), -0.01, 1.14), (sx * (0.255 * shW + 0.02), 0.01, 0.89), "upper_arm." + s)
        B.bone("hand." + s, (sx * (0.255 * shW + 0.02), 0.01, 0.89), (sx * (0.26 * shW + 0.02), 0.02, 0.76), "forearm." + s)
        B.bone("thigh." + s, (sx * 0.092 * hipW, 0, 0.91), (sx * 0.1 * hipW, 0.012, 0.5), "hips")
        B.bone("shin." + s, (sx * 0.1 * hipW, 0.012, 0.5), (sx * 0.1 * hipW, -0.01, 0.09), "thigh." + s)
        B.bone("foot." + s, (sx * 0.1 * hipW, -0.01, 0.09), (sx * 0.1 * hipW, 0.15, 0.03), "shin." + s)

    # escala final (altura)
    if H != 1.0:
        S = Matrix.Scale(H, 4)
        B.v = [S @ p for p in B.v]
        B.bones = {k: (S @ h, S @ t, p, d) for k, (h, t, p, d) in B.bones.items()}


def weapon(B, w, grip):
    if w == "none":
        return
    metal = B.mat("blade", (0.88, 0.9, 0.95, 1), 0.22, metal=0.55, tex="metal", tex_strength=0.3)
    dark_m = B.mat("handle", (0.12, 0.08, 0.06, 1), 0.6, tex="leather")
    gold = B.mat("guard", (0.8, 0.65, 0.25, 1), 0.3, metal=0.9)
    d = Vector((0, 1, -0.45)).normalized()
    g = "hand.R"
    if w in ("sword", "katana", "greatsword"):
        L = 0.8 if w == "sword" else (0.78 if w == "katana" else 1.25)
        W = 0.045 if w == "sword" else (0.032 if w == "katana" else 0.13)
        v, f = tube_geo([grip - d * 0.1, grip + d * 0.06], [0.016, 0.016], 8)
        B.add(v, f, dark_m, g)
        start = grip + d * 0.07
        if w == "katana":
            v, f = tube_geo([start - d * 0.006, start + d * 0.006], [(0.045, 0.04), (0.045, 0.04)], 12)
        else:
            v, f = box_geo(start, (0.2 if w != "greatsword" else 0.3, 0.025, 0.03))
        B.add(v, f, gold, g, smooth=False)
        pts = []
        side = Vector((1, 0, 0))
        up = d.cross(side).normalized()
        segs = 6
        for i in range(segs + 1):
            t = i / segs
            p = start + d * (0.01 + L * t)
            if w == "katana":
                p += up * (t * t) * 0.06
            pts.append(p)
        verts = []
        faces = []
        for i, p in enumerate(pts):
            t = i / segs
            wi = W * (1 - 0.85 * t ** 6) if w != "katana" else W * (1 - 0.6 * t ** 4)
            for (a, b) in ((0, 1), (0.006, 0), (0, -1), (-0.006, 0)):
                verts.append(p + side * a + up * b * wi / 2)
        for i in range(segs):
            for k in range(4):
                a = i * 4 + k
                b = i * 4 + (k + 1) % 4
                faces.append((a, b, b + 4, a + 4))
        verts.append(pts[-1] + d * W * 0.6)
        tip = len(verts) - 1
        for k in range(4):
            faces.append((segs * 4 + k, segs * 4 + (k + 1) % 4, tip))
        B.add(verts, faces, metal, g, smooth=False)
    elif w == "spear":
        v, f = tube_geo([grip + Vector((0, 0, -0.7)), grip + Vector((0, 0, 1.2))], [0.014, 0.014], 8)
        B.add(v, f, dark_m, g)
        v, f = tube_geo([grip + Vector((0, 0, 1.2)), grip + Vector((0, 0, 1.28)), grip + Vector((0, 0, 1.5))], [(0.035, 0.008), (0.04, 0.009), (0.001, 0.001)], 4)
        B.add(v, f, metal, g, smooth=False)
    elif w == "staff":
        v, f = tube_geo([grip + Vector((0, 0, -0.7)), grip + Vector((0, 0, 0.75))], [0.016, 0.02], 8)
        B.add(v, f, B.mat("wood", (0.45, 0.3, 0.18, 1), 0.7, tex="leather"), g)
        v, f = sphere_geo(grip + Vector((0, 0, 0.84)), (0.06, 0.06, 0.06), 14, 10)
        B.add(v, f, B.mat("orb", (0.5, 0.8, 1.0, 1), 0.05, emit=3.0), g)
    elif w == "gun":
        v, f = box_geo(grip + d * 0.1, (0.04, 0.4, 0.07))
        B.add(v, f, B.mat("gun", (0.15, 0.15, 0.15, 1), 0.4, metal=0.7), g, smooth=False)
        v, f = tube_geo([grip + d * 0.3, grip + d * 0.62], [0.012, 0.012], 8)
        B.add(v, f, metal, g)
    elif w == "club":
        v, f = tube_geo([grip - d * 0.08, grip + d * 0.3, grip + d * 0.75], [0.025, 0.05, 0.07], 10)
        B.add(v, f, B.mat("wood", (0.4, 0.28, 0.15, 1), 0.8, tex="leather"), g)
    elif w == "hammer":
        v, f = tube_geo([grip + Vector((0, 0, -0.1)), grip + Vector((0, 0, 0.55))], [0.015, 0.015], 8)
        B.add(v, f, dark_m, g)
        v, f = box_geo(grip + Vector((0, 0, 0.6)), (0.1, 0.24, 0.1))
        B.add(v, f, metal, g, smooth=False)
    elif w == "claws":
        for i in range(3):
            o = grip + Vector((-0.02 + i * 0.02, 0.0, -0.01))
            v, f = tube_geo([o, o + Vector((0, 0.06, -0.08))], [0.008, 0.001], 6)
            B.add(v, f, metal, g)


def wings(B, color, glow, kind, root, scale):
    wm = B.mat("wing", color, 0.5, emit=glow, double=True, tex="leather" if kind == "membrane" else "fur")
    bonem = B.mat("wingbone", dark(color, 0.4), 0.5)
    for sx, s in ((1, "R"), (-1, "L")):
        sh = root + Vector((sx * 0.06, 0, 0))
        elbow = root + Vector((sx * 0.42, -0.12, 0.28)) * scale
        tips = [root + Vector((sx * 0.95, -0.2, 0.42)) * scale, root + Vector((sx * 0.9, -0.25, 0.05)) * scale,
                root + Vector((sx * 0.7, -0.22, -0.3)) * scale, root + Vector((sx * 0.35, -0.16, -0.45)) * scale]
        grp = ("auto", ["wing." + s, "wing_tip." + s])
        if kind == "membrane":
            v, f = tube_geo([sh, elbow], [0.02 * scale, 0.015 * scale], 6)
            B.add(v, f, bonem, grp)
            for i in range(len(tips)):
                v2, f2 = tube_geo([elbow, tips[i]], [0.012 * scale, 0.003 * scale], 5)
                B.add(v2, f2, bonem, grp)
            # membrana em leque entre os "dedos" (com bordas recortadas)
            mid = [(tips[i] + tips[i + 1]) / 2 + Vector((0, 0, -0.06 * scale)) for i in range(3)]
            verts = [sh, elbow] + tips + mid
            faces = [(1, 2, 6), (1, 6, 3), (1, 3, 7), (1, 7, 4), (1, 4, 8), (1, 8, 5), (0, 1, 5)]
            B.add(verts, faces, wm, grp, smooth=False)
        else:
            for i in range(14):
                t = i / 13
                base = sh.lerp(elbow, min(t * 2, 1)) if t < 0.5 else elbow.lerp(tips[0], (t - 0.5) * 2)
                tip = base + Vector((sx * 0.1, -0.05, -0.35 - 0.2 * (1 - abs(t - 0.5) * 2))) * scale
                v, f = tube_geo([base, base.lerp(tip, 0.5) + Vector((0, -0.02, 0)), tip], [(0.05 * scale, 0.008), (0.045 * scale, 0.007), (0.001, 0.001)], 6)
                B.add(v, f, wm, grp)
        B.bone("wing." + s, sh, elbow, "chest")
        B.bone("wing_tip." + s, elbow, tips[1], "wing." + s)


# =============================================================================== QUADRÚPEDE
def quadruped(B, spec, mid, rnd):
    c = spec.get("color", (0.3, 0.3, 0.35, 1))
    armored = spec.get("armored", False)
    tusks = spec.get("tusks", False)
    reptile = armored
    furm = B.mat("fur", c, 0.75 if not reptile else 0.45, tex="scale" if reptile else "fur", tex_strength=1.2, sheen=0.0 if reptile else 0.5)
    belly = B.mat("belly", light(c, 0.15) if not reptile else light(c, 0.3), 0.8, tex="fur" if not reptile else "leather")
    eye = B.mat("eye", spec.get("eye", (1.0, 0.8, 0.1, 1)), 0.1, emit=1.6)
    black = B.mat("nose", (0.03, 0.03, 0.03, 1), 0.3, coat=0.8)
    white = B.mat("teeth", (0.95, 0.93, 0.85, 1), 0.3)
    leg_len = 1.0 if not reptile else 0.62
    zb = 0.85 if not reptile else 0.62
    bodyr = 1.18 if not tusks else 1.45
    if reptile:
        bodyr = 1.15
    N = []
    R = []

    def node(p, r):
        N.append(Vector(p))
        R.append(r)
        return len(N) - 1

    hips = node((0, -0.55, zb), (0.2 * bodyr, 0.2 * bodyr))
    midb = node((0, 0, zb - 0.02), (0.22 * bodyr, 0.24 * bodyr))
    chest = node((0, 0.45, zb + 0.05), (0.24 * bodyr, 0.28 * bodyr))
    hz = zb + 0.42 if not reptile else zb + 0.12
    neck = node((0, 0.76, zb + 0.24 if not reptile else zb + 0.08), (0.14 * bodyr, 0.16 * bodyr))
    neck2 = node((0, 0.93, hz - 0.03), (0.1, 0.11))
    E = [(hips, midb), (midb, chest), (chest, neck), (neck, neck2)]
    t1 = node((0, -0.75, zb + 0.02), (0.09 * bodyr, 0.09 * bodyr))
    t2 = node((0, -1.05, zb - 0.1), (0.1 if not reptile else 0.09, 0.1 if not reptile else 0.08))
    t3 = node((0, -1.3, zb - 0.3 if not reptile else zb - 0.4), (0.07, 0.07))
    t4 = node((0, -1.5 if not reptile else -1.75, zb - 0.45 if not reptile else zb - 0.6), (0.02, 0.02))
    E += [(hips, t1), (t1, t2), (t2, t3), (t3, t4)]
    legs = {}
    for sx, s in ((1, "R"), (-1, "L")):
        sp = 0.17 * bodyr + (0.08 if reptile else 0)
        a = node((sx * sp, 0.5, zb - 0.05), (0.12, 0.13))
        b = node((sx * (sp + (0.06 if reptile else 0)), 0.55, zb - 0.42 * leg_len), (0.085, 0.09))
        cc = node((sx * (sp + (0.08 if reptile else 0)), 0.5, 0.14), (0.062, 0.062))
        d = node((sx * (sp + (0.08 if reptile else 0)), 0.63, 0.045), (0.075, 0.05))
        E += [(chest, a), (a, b), (b, cc), (cc, d)]
        legs["f" + s] = [N[a], N[b], N[cc], N[d]]
        a2 = node((sx * (sp - 0.01), -0.55, zb - 0.05), (0.15, 0.17))
        b2 = node((sx * (sp + (0.06 if reptile else 0)), -0.42, zb - 0.38 * leg_len), (0.105, 0.11))
        c2 = node((sx * (sp + (0.08 if reptile else 0)), -0.64, 0.3 * leg_len), (0.068, 0.068))
        d2 = node((sx * (sp + (0.08 if reptile else 0)), -0.55, 0.045), (0.075, 0.05))
        E += [(hips, a2), (a2, b2), (b2, c2), (c2, d2)]
        legs["b" + s] = [N[a2], N[b2], N[c2], N[d2]]
    bv, bf = skin_geo(N, E, R, 2)
    auto = ("auto", ["hips", "spine", "neck", "tail1", "tail2"] + ["%s_%s.%s" % (l, k, s) for l in ("fl", "bl") for k in ("up", "mid", "low") for s in ("L", "R")])
    base = len(B.v)
    for p in bv:
        B.v.append(p)
        B.vg.append(auto)
    for fc in bf:
        cc = sum((bv[i] for i in fc), Vector()) / len(fc)
        B.f.append(tuple(base + i for i in fc))
        B.fm.append(belly if (cc.z < zb - 0.12 and abs(cc.y) < 0.6 and abs(cc.x) < 0.15) else furm)
        B.fs.append(True)

    # cabeça
    hcen = Vector((0, 0.97, hz))
    v, f = sphere_geo(hcen, (0.155, 0.17, 0.145), 20, 12)
    B.add(v, f, furm, "head")
    mz = hz - 0.05
    if reptile:
        v, f = tube_geo([(0, 1.0, mz), (0, 1.2, mz - 0.02), (0, 1.36, mz - 0.03)], [(0.12, 0.07), (0.1, 0.055), (0.06, 0.035)], 12)
    elif tusks:
        v, f = tube_geo([(0, 1.02, mz), (0, 1.2, mz - 0.04), (0, 1.3, mz - 0.06)], [(0.1, 0.09), (0.08, 0.07), (0.07, 0.06)], 12)
    else:
        v, f = tube_geo([(0, 1.0, mz), (0, 1.16, mz - 0.03), (0, 1.3, mz - 0.06)], [(0.09, 0.08), (0.065, 0.06), (0.045, 0.04)], 12)
    B.add(v, f, furm, "head")
    tipy = 1.36 if reptile else 1.3
    v, f = sphere_geo((0, tipy + 0.005, mz - 0.04), (0.035, 0.025, 0.028), 10, 6)
    B.add(v, f, black, "head")
    for sx in (1, -1):
        v, f = sphere_geo((sx * 0.085, 1.06, hz + 0.04), (0.022, 0.016, 0.018), 10, 6)
        B.add(v, f, eye, "head")
        if not reptile:
            v, f = tube_geo([(sx * 0.08, 0.92, hz + 0.1), (sx * 0.09, 0.92, hz + 0.2), (sx * 0.1, 0.93, hz + 0.28)], [(0.05, 0.02), (0.035, 0.014), (0.002, 0.001)], 8)
            B.add(v, f, furm, "head")
        # presas
        v, f = tube_geo([(sx * 0.03, tipy - 0.05, mz - 0.07), (sx * 0.03, tipy - 0.05, mz - 0.12)], [0.008, 0.001], 6)
        B.add(v, f, white, "head")
        if tusks:
            pth = [Vector((sx * 0.07, 1.22, mz - 0.07)), Vector((sx * 0.1, 1.3, mz)), Vector((sx * 0.1, 1.33, mz + 0.08))]
            v, f = tube_geo(pth, [0.02, 0.014, 0.002], 8)
            B.add(v, f, white, "head")
    if spec.get("horn", False):
        hm = B.mat("horn", (0.95, 0.85, 0.4, 1), 0.3, emit=1.0, coat=0.6)
        pth = strand_path(Vector((0, 1.02, hz + 0.12)), Vector((0, 0.5, 1)), 0.3, 5, -0.3)
        v, f = tube_geo(pth, [0.035 * (1 - i / 5) + 0.002 for i in range(6)], 8)
        B.add(v, f, hm, "head")
    if spec.get("star", False):
        v, f = sphere_geo((0, 1.08, hz + 0.09), (0.02, 0.01, 0.02), 8, 5)
        B.add(v, f, B.mat("star", (0.9, 0.9, 1.0, 1), 0.1, emit=5.0), "head")
    # pelo: tufos no pescoço/peito, ou placas de armadura
    if reptile:
        pm = B.mat("plates", (0.55, 0.52, 0.45, 1), 0.4, metal=0.3, tex="stone")
        for i in range(9):
            y = 0.6 - i * 0.22
            z = zb + 0.2 * bodyr - abs(y) * 0.05
            pth = [Vector((0, y, z)), Vector((0, y - 0.04, z + 0.16))]
            v, f = tube_geo(pth, [(0.07, 0.05), (0.002, 0.002)], 6)
            B.add(v, f, pm, auto)
    else:
        mane = spec.get("mane", None)
        mm = B.mat("mane", mane, 0.8, tex="fur", tex_strength=1.5) if mane else furm
        for i in range(45):
            a = rnd.uniform(-math.pi * 0.9, math.pi * 0.9)
            y = rnd.uniform(0.3, 0.8)
            r = 0.26 * bodyr
            o = Vector((math.sin(a) * r * 0.78, y, zb + 0.1 + (y - 0.3) * 0.25 + math.cos(a) * r * 0.78))
            d = Vector((math.sin(a) * 0.4, -1, math.cos(a) * 0.3))
            pth = strand_path(o, d, rnd.uniform(0.1, 0.18), 3, 0.3)
            add_strand(B, pth, 0.03, mm, auto, 5, 0.5)
        for i in range(25):
            y = rnd.uniform(-1.3, -0.8)
            o = Vector((rnd.uniform(-0.06, 0.06), y, zb - 0.15 + (y + 1.3) * 0.3))
            pth = strand_path(o, Vector((rnd.uniform(-0.5, 0.5), -0.6, rnd.uniform(-0.3, 0.6))), 0.12, 3, 0.2)
            add_strand(B, pth, 0.03, furm, auto, 5, 0.5)

    B.bone("hips", (0, -0.55, zb), (0, -0.05, zb))
    B.bone("spine", (0, -0.05, zb), (0, 0.45, zb + 0.05), "hips")
    B.bone("neck", (0, 0.45, zb + 0.05), (0, 0.85, hz - 0.05), "spine")
    B.bone("head", (0, 0.85, hz - 0.05), (0, 1.3, hz - 0.05), "neck")
    B.bone("tail1", (0, -0.6, zb), (0, -1.05, zb - 0.1), "hips")
    B.bone("tail2", (0, -1.05, zb - 0.1), tuple(N[t4]), "tail1")
    for s in ("L", "R"):
        for l, key, par in (("fl", "f" + s, "spine"), ("bl", "b" + s, "hips")):
            p = legs[key]
            B.bone("%s_up.%s" % (l, s), p[0], p[1], par)
            B.bone("%s_mid.%s" % (l, s), p[1], p[2], "%s_up.%s" % (l, s))
            B.bone("%s_low.%s" % (l, s), p[2], p[3], "%s_mid.%s" % (l, s))


# =============================================================================== OUTROS MONSTROS
def dragon(B, spec, mid, rnd):
    c = spec.get("color", (0.12, 0.12, 0.18, 1))
    S = 3.0
    sc = B.mat("scales", c, 0.35, tex="scale", tex_strength=1.5, coat=0.4)
    belly = B.mat("belly", light(c, 0.25), 0.5, tex="leather")
    eye = B.mat("eye", spec.get("eye", (1.0, 0.8, 0.2, 1)), 0.1, emit=2.0)
    horn = B.mat("horn", (0.85, 0.78, 0.6, 1), 0.35, coat=0.5)
    N = []
    R = []

    def node(p, r):
        N.append(Vector(p) * S)
        R.append((r[0] * S, r[1] * S))
        return len(N) - 1

    spine_pts = [(0, -0.5, 0.62), (0, 0.05, 0.68), (0, 0.5, 0.78)]
    hips = node(spine_pts[0], (0.34, 0.32))
    midb = node(spine_pts[1], (0.4, 0.38))
    chest = node(spine_pts[2], (0.38, 0.4))
    n1 = node((0, 0.8, 0.95), (0.28, 0.3))
    n2 = node((0, 1.0, 1.17), (0.24, 0.25))
    n3 = node((0, 1.15, 1.34), (0.2, 0.21))
    n4 = node((0, 1.28, 1.45), (0.16, 0.16))
    E = [(hips, midb), (midb, chest), (chest, n1), (n1, n2), (n2, n3), (n3, n4)]
    tails = [hips]
    for (y, z, r) in [(-0.95, 0.55, 0.23), (-1.4, 0.45, 0.17), (-1.85, 0.35, 0.12), (-2.35, 0.27, 0.07), (-2.85, 0.22, 0.03)]:
        tails.append(node((0, y, z), (r, r)))
        E.append((tails[-2], tails[-1]))
    legs = {}
    for sx, s in ((1, "R"), (-1, "L")):
        a = node((sx * 0.32, 0.5, 0.6), (0.15, 0.16))
        b = node((sx * 0.42, 0.62, 0.3), (0.11, 0.11))
        cc = node((sx * 0.42, 0.74, 0.06), (0.1, 0.07))
        a2 = node((sx * 0.32, -0.5, 0.55), (0.18, 0.2))
        b2 = node((sx * 0.44, -0.33, 0.3), (0.13, 0.13))
        c2 = node((sx * 0.44, -0.45, 0.06), (0.11, 0.07))
        E += [(chest, a), (a, b), (b, cc), (hips, a2), (a2, b2), (b2, c2)]
        legs[s] = (N[a], N[b], N[cc], N[a2], N[b2], N[c2])
        for k in range(3):  # garras
            for base_p in (N[cc], N[c2]):
                o = base_p + Vector((sx * (k - 1) * 0.06, 0.12, -0.04)) * S
                v, f = tube_geo([o, o + Vector((0, 0.1, -0.05)) * S], [0.025 * S, 0.002], 6)
                B.add(v, f, horn, ("auto", ["fl_low." + s, "bl_low." + s]))
    bv, bf = skin_geo(N, E, R, 2)
    auto = ("auto", ["hips", "spine", "neck1", "neck2", "tail1", "tail2", "tail3"] + ["%s.%s" % (k, s) for k in ("fl_up", "fl_low", "bl_up", "bl_low") for s in ("L", "R")])
    base = len(B.v)
    for p in bv:
        B.v.append(p)
        B.vg.append(auto)
    for fc in bf:
        cc = sum((bv[i] for i in fc), Vector()) / len(fc)
        B.f.append(tuple(base + i for i in fc))
        B.fm.append(belly if (cc.z < 0.6 * S and abs(cc.x) < 0.2 * S and -0.6 * S < cc.y < 0.9 * S) else sc)
        B.fs.append(True)
    hc = Vector((0, 1.4, 1.5)) * S
    v, f = sphere_geo(hc, (0.17 * S, 0.22 * S, 0.15 * S), 20, 12)
    B.add(v, f, sc, "head")
    v, f = tube_geo([hc + Vector((0, 0.12, -0.03)) * S, hc + Vector((0, 0.3, -0.07)) * S, hc + Vector((0, 0.45, -0.1)) * S],
                    [(0.13 * S, 0.09 * S), (0.1 * S, 0.065 * S), (0.065 * S, 0.045 * S)], 12)
    B.add(v, f, sc, "head")
    v, f = tube_geo([hc + Vector((0, 0.05, -0.1)) * S, hc + Vector((0, 0.38, -0.15)) * S], [(0.1 * S, 0.03 * S), (0.05 * S, 0.02 * S)], 10)
    B.add(v, f, belly, "head")
    for sx in (1, -1):
        v, f = sphere_geo(hc + Vector((sx * 0.11, 0.13, 0.05)) * S, (0.032 * S, 0.026 * S, 0.02 * S), 10, 6)
        B.add(v, f, eye, "head")
        v, f = box_geo(hc + Vector((sx * 0.1, 0.12, 0.085)) * S, (0.08 * S, 0.06 * S, 0.015 * S))
        B.add(v, f, sc, "head", smooth=False)
        pth = strand_path(hc + Vector((sx * 0.09, -0.08, 0.08)) * S, Vector((sx * 0.35, -1, 0.55)), 0.55 * S, 6, -0.25)
        v, f = tube_geo(pth, [0.05 * S * (1 - i / 6) + 0.01 for i in range(7)], 8)
        B.add(v, f, horn, "head")
        for k in range(4):
            o = hc + Vector((sx * 0.05, 0.42 - k * 0.07, -0.13)) * S
            v, f = tube_geo([o, o + Vector((0, 0, -0.06)) * S], [0.012 * S, 0.001], 5)
            B.add(v, f, horn, "head")
        # barbatanas/bigodes de dragão
        pth = strand_path(hc + Vector((sx * 0.06, 0.4, -0.06)) * S, Vector((sx * 1, 0.3, -0.1)), 0.32 * S, 6, 0.4)
        add_strand(B, pth, 0.015 * S, horn, "head", 5, 1.0)
    # espinhos ao longo da coluna e da cauda
    path = [Vector((0, 1.3, 1.62)), Vector((0, 1.08, 1.43)), Vector((0, 0.85, 1.22)), Vector((0, 0.5, 1.13)), Vector((0, 0.05, 1.04)),
            Vector((0, -0.5, 0.94)), Vector((0, -0.95, 0.76)), Vector((0, -1.4, 0.61)), Vector((0, -1.85, 0.47)), Vector((0, -2.35, 0.34))]
    for i in range(len(path) - 1):
        for k in range(2):
            p0 = path[i].lerp(path[i + 1], k / 2) * S
            hgt = (0.22 if i < 6 else 0.14) * S
            v, f = tube_geo([p0, p0 + Vector((0, -0.07 * S, hgt))], [(0.05 * S, 0.018 * S), (0.002, 0.002)], 6)
            B.add(v, f, horn, auto)
    wings(B, spec.get("wing", (0.18, 0.15, 0.3, 1)), spec.get("glow", 0.0), "membrane", Vector((0, 0.35, 1.05)) * S, 4.2)
    B.bone("hips", Vector(spine_pts[0]) * S, Vector(spine_pts[1]) * S)
    B.bone("spine", Vector(spine_pts[1]) * S, Vector(spine_pts[2]) * S, "hips")
    B.bone("chest", Vector(spine_pts[2]) * S, Vector((0, 0.6, 0.98)) * S, "spine", False)
    B.bone("neck1", Vector(spine_pts[2]) * S, Vector((0, 1.0, 1.17)) * S, "spine")
    B.bone("neck2", Vector((0, 1.0, 1.17)) * S, Vector((0, 1.28, 1.45)) * S, "neck1")
    B.bone("head", Vector((0, 1.28, 1.45)) * S, Vector((0, 1.85, 1.42)) * S, "neck2")
    B.bone("tail1", N[tails[0]], N[tails[2]], "hips")
    B.bone("tail2", N[tails[2]], N[tails[4]], "tail1")
    B.bone("tail3", N[tails[4]], N[tails[5]], "tail2")
    for s in ("L", "R"):
        a, b, cc, a2, b2, c2 = legs[s]
        B.bone("fl_up." + s, a, b, "spine")
        B.bone("fl_low." + s, b, cc, "fl_up." + s)
        B.bone("bl_up." + s, a2, b2, "hips")
        B.bone("bl_low." + s, b2, c2, "bl_up." + s)


def spider(B, spec, mid, rnd):
    c = spec.get("color", (0.1, 0.1, 0.12, 1))
    body = B.mat("chitin", c, 0.3, tex="scale", tex_strength=0.6, coat=0.7)
    red = B.mat("mark", (0.7, 0.08, 0.08, 1), 0.3, emit=0.6)
    eye = B.mat("eye", (1.0, 0.15, 0.1, 1), 0.1, emit=1.6)
    v, f = sphere_geo((0, 0.25, 0.6), (0.32, 0.36, 0.25), 20, 12)
    B.add(v, f, body, "body")
    v, f = sphere_geo((0, -0.45, 0.75), (0.48, 0.58, 0.42), 24, 14)
    B.add(v, f, body, "abdomen")
    v, f = sphere_geo((0, -0.4, 1.15), (0.14, 0.24, 0.05), 12, 6)
    B.add(v, f, red, "abdomen")
    for i in range(8):
        x = (-0.12 + (i % 4) * 0.08)
        v, f = sphere_geo((x, 0.58, 0.7 + (0.04 if i < 4 else -0.02)), (0.028, 0.02, 0.028), 8, 5)
        B.add(v, f, eye, "body")
    for sx in (1, -1):
        v, f = tube_geo([(sx * 0.07, 0.55, 0.5), (sx * 0.08, 0.68, 0.4), (sx * 0.05, 0.7, 0.28)], [0.05, 0.035, 0.005], 8)
        B.add(v, f, body, "body")
    for sx, s in ((1, "R"), (-1, "L")):
        for i in range(4):
            y = 0.45 - i * 0.18
            root = Vector((sx * 0.25, y, 0.62))
            knee = Vector((sx * 0.75, y + (0.35 - i * 0.23), 1.05))
            foot = Vector((sx * 1.2, y + (0.5 - i * 0.33), 0.0))
            v, f = tube_geo([root, knee], [0.05, 0.04], 8)
            B.add(v, f, body, "leg%d_a.%s" % (i, s))
            v, f = tube_geo([knee, foot], [0.04, 0.012], 8)
            B.add(v, f, body, "leg%d_b.%s" % (i, s))
            B.bone("leg%d_a.%s" % (i, s), root, knee, "body")
            B.bone("leg%d_b.%s" % (i, s), knee, foot, "leg%d_a.%s" % (i, s))
    B.bone("body", (0, -0.05, 0.6), (0, 0.5, 0.6))
    B.bone("abdomen", (0, -0.05, 0.65), (0, -0.95, 0.75), "body")


def bat(B, spec, mid, rnd):
    c = spec.get("color", (0.3, 0.22, 0.2, 1))
    fur = B.mat("fur", c, 0.8, tex="fur", tex_strength=1.5, sheen=0.4)
    eye = B.mat("eye", (1.0, 0.15, 0.1, 1), 0.1, emit=1.6)
    white = B.mat("teeth", (0.95, 0.93, 0.85, 1), 0.3)
    v, f = sphere_geo((0, 0, 0), (0.28, 0.35, 0.3), 18, 12)
    B.add(v, f, fur, "body")
    hc = Vector((0, 0.38, 0.12))
    v, f = sphere_geo(hc, (0.17, 0.17, 0.16), 16, 10)
    B.add(v, f, fur, "head")
    v, f = tube_geo([hc + Vector((0, 0.1, -0.03)), hc + Vector((0, 0.2, -0.05))], [(0.08, 0.06), (0.04, 0.03)], 10)
    B.add(v, f, fur, "head")
    for sx in (1, -1):
        v, f = tube_geo([hc + Vector((sx * 0.08, -0.02, 0.1)), hc + Vector((sx * 0.13, -0.04, 0.3)), hc + Vector((sx * 0.15, -0.05, 0.42))], [(0.07, 0.02), (0.05, 0.015), (0.002, 0.002)], 8)
        B.add(v, f, fur, "head")
        v, f = sphere_geo(hc + Vector((sx * 0.07, 0.13, 0.04)), (0.03, 0.02, 0.025), 8, 5)
        B.add(v, f, eye, "head")
        v, f = tube_geo([hc + Vector((sx * 0.025, 0.19, -0.07)), hc + Vector((sx * 0.025, 0.19, -0.14))], [0.012, 0.001], 6)
        B.add(v, f, white, "head")
        v, f = tube_geo([(sx * 0.1, -0.15, -0.25), (sx * 0.12, -0.2, -0.45)], [0.03, 0.01], 6)
        B.add(v, f, fur, "body")
    wings(B, dark(c, 0.3), 0.0, "membrane", Vector((0, 0.05, 0.12)), 1.8)
    B.bone("body", (0, -0.3, 0), (0, 0.3, 0))
    B.bone("head", (0, 0.3, 0.1), (0, 0.6, 0.1), "body")
    B.bone("chest", (0, 0.0, 0.0), (0, 0.1, 0.2), "body", False)
    for s in ("L", "R"):
        h, t, p, d = B.bones["wing." + s]
        B.bones["wing." + s] = (h, t, "body", d)


def serpent(B, spec, mid, rnd):
    c = spec.get("color", (0.35, 0.2, 0.5, 1))
    glow = spec.get("glow", 0.0)
    sc = B.mat("scales", c, 0.35, emit=glow, tex="scale", tex_strength=1.5, coat=0.5)
    belly = B.mat("belly", light(c, 0.35), 0.5, emit=glow * 0.5, tex="leather")
    eye = B.mat("eye", (1.0, 0.15, 0.1, 1) if glow == 0 else (1, 1, 0.5, 1), 0.1, emit=1.6)
    white = B.mat("teeth", (0.95, 0.93, 0.85, 1), 0.3)
    pts = []
    rad = []
    n = 14
    for i in range(n):
        t = i / (n - 1)
        y = 0.3 - t * 6.2
        r = 0.42 * (1 - t) ** 0.6 + 0.04 if t > 0.08 else 0.36
        pts.append(Vector((math.sin(t * 6) * 0.35 * t, y, r)))
        rad.append((r, r * 0.85))
    v, f = tube_geo(pts, rad, 14)
    segs = ["seg%d" % i for i in range(7)]
    grp = ("auto", segs)
    B.add(v, f, sc, grp)
    hc = Vector((0, 0.65, 0.42))
    v, f = sphere_geo(hc, (0.3, 0.42, 0.24), 18, 10)
    B.add(v, f, sc, "head")
    v, f = sphere_geo(hc + Vector((0, 0.05, -0.12)), (0.26, 0.36, 0.1), 14, 8)
    B.add(v, f, belly, "head")
    for sx in (1, -1):
        v, f = sphere_geo(hc + Vector((sx * 0.2, 0.2, 0.1)), (0.06, 0.05, 0.05), 10, 6)
        B.add(v, f, eye, "head")
        v, f = tube_geo([hc + Vector((sx * 0.08, 0.35, -0.08)), hc + Vector((sx * 0.08, 0.36, -0.25))], [0.025, 0.002], 6)
        B.add(v, f, white, "head")
    v, f = tube_geo([hc + Vector((0, -0.1, 0.2)), hc + Vector((0, -0.25, 0.55))], [0.06, 0.002], 8)
    B.add(v, f, B.mat("horn", (0.6, 0.5, 0.8, 1), 0.3), "head")
    prev = "head"
    B.bone("head", (0, 0.35, 0.4), (0, 1.0, 0.4))
    for i in range(7):
        a = pts[i * 2]
        b = pts[min(i * 2 + 2, n - 1)]
        B.bone(segs[i], a, b, "head" if i == 0 else segs[i - 1])


def centipede(B, spec, mid, rnd):
    c = spec.get("color", (0.45, 0.12, 0.2, 1))
    body = B.mat("chitin", c, 0.3, tex="scale", tex_strength=0.8, coat=0.7)
    legm = B.mat("legs", (0.9, 0.7, 0.3, 1), 0.4)
    eye = B.mat("eye", (1.0, 0.9, 0.2, 1), 0.1, emit=1.6)
    n = 10
    for i in range(n):
        y = 0.3 - i * 0.55
        bn = "seg%d" % (i // 2)
        v, f = sphere_geo((0, y, 0.45), (0.45 - i * 0.015, 0.34, 0.3), 16, 10)
        B.add(v, f, body, bn)
        for sx in (1, -1):
            v, f = tube_geo([(sx * 0.35, y, 0.4), (sx * 0.65, y + 0.05, 0.35), (sx * 0.8, y + 0.1, 0.0)], [0.04, 0.03, 0.008], 6)
            B.add(v, f, legm, bn)
    for sx in (1, -1):
        v, f = sphere_geo((sx * 0.15, 0.6, 0.6), (0.06, 0.05, 0.05), 8, 5)
        B.add(v, f, eye, "seg0")
        v, f = tube_geo([(sx * 0.12, 0.6, 0.35), (sx * 0.2, 0.9, 0.3), (sx * 0.05, 1.05, 0.28)], [0.04, 0.03, 0.004], 6)
        B.add(v, f, legm, "seg0")
        v, f = tube_geo([(sx * 0.1, 0.55, 0.7), (sx * 0.3, 1.0, 1.0), (sx * 0.4, 1.3, 1.1)], [0.02, 0.012, 0.002], 6)
        B.add(v, f, legm, "seg0")
    for i in range(5):
        B.bone("seg%d" % i, (0, 0.6 - i * 1.1, 0.45), (0, 0.6 - (i + 1) * 1.1, 0.45), None if i == 0 else "seg%d" % (i - 1))


def machine(B, spec, mid, rnd):
    c = spec.get("color", (0.35, 0.38, 0.3, 1))
    hull = B.mat("hull", c, 0.45, metal=0.6, tex="metal", tex_strength=0.8)
    dark_m = B.mat("dark", (0.12, 0.12, 0.12, 1), 0.5, metal=0.5, tex="metal")
    glow = B.mat("light", (1, 0.3, 0.2, 1), 0.2, emit=4.0)
    v, f = box_geo((0, 0, 0.85), (2.1, 3.0, 0.8))
    B.add(v, f, hull, "hull", smooth=False)
    v, f = box_geo((0, 1.3, 0.75), (1.9, 0.6, 0.5))
    B.add(v, f, hull, "hull", smooth=False)
    for sx in (1, -1):
        v, f = box_geo((sx * 1.1, 0, 0.45), (0.5, 3.3, 0.7))
        B.add(v, f, dark_m, "hull", smooth=False)
        for i in range(6):
            v, f = tube_geo([(sx * 0.85, -1.3 + i * 0.52, 0.35), (sx * 1.38, -1.3 + i * 0.52, 0.35)], [0.28, 0.28], 12)
            B.add(v, f, dark_m, "hull")
    v, f = lathe_geo([(0.7, 1.25), (0.72, 1.6), (0.55, 1.9), (0.0, 1.95)], 16)
    B.add(v, f, hull, "turret")
    v, f = tube_geo([(0, 0.4, 1.65), (0, 2.6, 1.65)], [0.13, 0.11], 12)
    B.add(v, f, dark_m, "barrel")
    v, f = sphere_geo((0, 0.68, 1.75), (0.1, 0.06, 0.08), 8, 5)
    B.add(v, f, glow, "turret")
    B.bone("hull", (0, -1, 0.85), (0, 1, 0.85))
    B.bone("turret", (0, 0, 1.25), (0, 0, 1.95), "hull")
    B.bone("barrel", (0, 0.4, 1.65), (0, 2.6, 1.65), "turret")


def fairy(B, spec, mid, rnd):
    humanoid(B, spec, mid, rnd)
    H = spec.get("height", 1.0)
    wm = B.mat("fwing", (0.7, 0.9, 1.0, 1), 0.1, emit=1.5, alpha=0.5, double=True)
    root = Vector((0, -0.12, 1.32)) * H
    for sx, s in ((1, "R"), (-1, "L")):
        for (dx, dz, rx, rz) in ((0.32, 0.22, 0.28, 0.2), (0.25, -0.15, 0.2, 0.15)):
            c = root + Vector((sx * dx, -0.05, dz)) * H
            v, f = sphere_geo(c, (rx * H, 0.01, rz * H), 14, 8)
            B.add(v, f, wm, "wing." + s)
        B.bone("wing." + s, root, root + Vector((sx * 0.5, -0.05, 0.1)) * H, "chest")


BUILDERS = {"humanoid": humanoid, "quadruped": quadruped, "dragon": dragon, "spider": spider, "bat": bat,
            "serpent": serpent, "centipede": centipede, "machine": machine, "fairy": fairy, "lizard": quadruped,
            "slime": None}


# =============================================================================== MONTAGEM, PESOS E EXPORTAÇÃO
def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (a + ab * t - p).length


def finalize(B, mid):
    sc = bpy.context.scene
    # malha
    me = bpy.data.meshes.new(mid)
    me.from_pydata([tuple(p) for p in B.v], [], B.f)
    keys = list(B.mats.keys())
    for k in keys:
        me.materials.append(B.mats[k])
    idx = {k: i for i, k in enumerate(keys)}
    me.polygons.foreach_set("material_index", [idx[m] for m in B.fm])
    me.polygons.foreach_set("use_smooth", B.fs)
    # UV por projeção em caixa
    uv = me.uv_layers.new(name="UVMap")
    me.calc_loop_triangles()
    for poly in me.polygons:
        n = poly.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if ax == 0:
                u, v = co.y, co.z
            elif ax == 1:
                u, v = co.x, co.z
            else:
                u, v = co.x, co.y
            uv.data[li].uv = (u * 3.0, v * 3.0)
    me.validate()
    me.update()
    ob = bpy.data.objects.new(mid, me)
    sc.collection.objects.link(ob)

    # armadura
    ad = bpy.data.armatures.new(mid + "_rig")
    ao = bpy.data.objects.new(mid + "_rig", ad)
    sc.collection.objects.link(ao)
    bpy.context.view_layer.objects.active = ao
    bpy.ops.object.mode_set(mode="EDIT")
    for name, (h, t, p, d) in B.bones.items():
        eb = ad.edit_bones.new(name)
        eb.head = h
        eb.tail = t if (t - h).length > 1e-4 else h + Vector((0, 0, 0.05))
        eb.use_deform = d
    for name, (h, t, p, d) in B.bones.items():
        if p and p in ad.edit_bones:
            ad.edit_bones[name].parent = ad.edit_bones[p]
    bpy.ops.object.mode_set(mode="OBJECT")

    # pesos
    groups = {}
    for name, (h, t, p, d) in B.bones.items():
        if d:
            groups[name] = ob.vertex_groups.new(name=name)
    segs = {n: (B.bones[n][0], B.bones[n][1]) for n in groups}
    assign = {n: [] for n in groups}
    for vi, (p, g) in enumerate(zip(B.v, B.vg)):
        if isinstance(g, str):
            if g in groups:
                assign[g].append((vi, 1.0))
            continue
        cands = [n for n in g[1] if n in groups]
        ds = sorted(((seg_dist(p, *segs[n]), n) for n in cands))[:2]
        if not ds:
            continue
        if len(ds) == 1:
            assign[ds[0][1]].append((vi, 1.0))
            continue
        w0 = 1.0 / (ds[0][0] ** 4 + 1e-7)
        w1 = 1.0 / (ds[1][0] ** 4 + 1e-7)
        s = w0 + w1
        assign[ds[0][1]].append((vi, w0 / s))
        if w1 / s > 0.02:
            assign[ds[1][1]].append((vi, w1 / s))
    for n, lst in assign.items():
        by_w = {}
        for vi, w in lst:
            by_w.setdefault(round(w, 3), []).append(vi)
        for w, vis in by_w.items():
            groups[n].add(vis, w, "REPLACE")
    ob.parent = ao
    mod = ob.modifiers.new("Armature", "ARMATURE")
    mod.object = ao
    return ao, ob


def world_rot(bone, axis, angle):
    M = bone.matrix_local.to_3x3()
    q = Quaternion(Vector(axis), angle).to_matrix()
    return (M.inverted() @ q @ M).to_quaternion()


def make_action(ao, name, frames, pose_fn):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    ao.animation_data.action = act
    bones = ao.data.bones
    for fr in frames:
        pose = pose_fn(fr)
        for pb in ao.pose.bones:
            pb.rotation_mode = "QUATERNION"
            q = Quaternion()
            for (axis, ang) in pose.get(pb.name, {}).get("rot", []):
                q = world_rot(bones[pb.name], axis, ang) @ q
            pb.rotation_quaternion = q
            loc = pose.get(pb.name, {}).get("loc", None)
            pb.location = (bones[pb.name].matrix_local.to_3x3().inverted() @ Vector(loc)) if loc else Vector()
            pb.keyframe_insert("rotation_quaternion", frame=fr)
            pb.keyframe_insert("location", frame=fr)
    return act


X = (1, 0, 0)
Y = (0, 1, 0)
Z = (0, 0, 1)


def anims_humanoid(ao, bones):
    has = lambda n: n in bones
    wing = has("wing.L")

    def idle(fr):
        t = fr / 60 * 2 * math.pi
        b = math.sin(t)
        p = {"chest": {"rot": [(X, -0.03 * b)]}, "head": {"rot": [(Z, 0.06 * math.sin(t * 0.5))]},
             "upper_arm.L": {"rot": [(Y, 0.12 + 0.02 * b)]}, "upper_arm.R": {"rot": [(Y, -0.12 - 0.02 * b), (X, 0.1)]},
             "forearm.R": {"rot": [(X, 0.25)]}, "forearm.L": {"rot": [(X, 0.15)]},
             "hips": {"loc": (0, 0, 0.005 * b)}}
        if wing:
            p["wing.L"] = {"rot": [(Y, -0.15 * b)]}
            p["wing.R"] = {"rot": [(Y, 0.15 * b)]}
        if has("tail1"):
            p["tail1"] = {"rot": [(Z, 0.15 * b)]}
        return p

    def walk(fr):
        t = fr / 30 * 2 * math.pi
        s = math.sin(t)
        c = math.cos(t)
        p = {"thigh.L": {"rot": [(X, 0.55 * s)]}, "thigh.R": {"rot": [(X, -0.55 * s)]},
             "shin.L": {"rot": [(X, -0.6 * max(0, -c))]}, "shin.R": {"rot": [(X, -0.6 * max(0, c))]},
             "foot.L": {"rot": [(X, 0.2 * s)]}, "foot.R": {"rot": [(X, -0.2 * s)]},
             "upper_arm.L": {"rot": [(X, -0.45 * s), (Y, 0.1)]}, "upper_arm.R": {"rot": [(X, 0.45 * s), (Y, -0.1)]},
             "forearm.L": {"rot": [(X, 0.3)]}, "forearm.R": {"rot": [(X, 0.35)]},
             "chest": {"rot": [(Z, 0.12 * s), (X, 0.05)]}, "hips": {"rot": [(Z, -0.08 * s)], "loc": (0, 0, 0.03 * abs(math.cos(t)) - 0.015)}}
        if wing:
            p["wing.L"] = {"rot": [(Y, -0.3 * s)]}
            p["wing.R"] = {"rot": [(Y, 0.3 * s)]}
        if has("tail1"):
            p["tail1"] = {"rot": [(Z, 0.3 * s)]}
        return p

    def attack(fr):
        k = [(0, 0), (6, 1), (11, 2), (18, 3)]
        poses = [
            {"upper_arm.R": [(X, 0.1)], "chest": [], "forearm.R": [(X, 0.2)]},
            {"upper_arm.R": [(X, 2.7), (Y, -0.3)], "chest": [(Z, 0.35)], "forearm.R": [(X, 0.4)], "upper_arm.L": [(X, 0.5)]},
            {"upper_arm.R": [(X, 1.0), (Y, -0.2)], "chest": [(Z, -0.4), (X, 0.15)], "forearm.R": [(X, 0.1)], "upper_arm.L": [(X, -0.4)], "thigh.R": [(X, 0.4)], "thigh.L": [(X, -0.3)]},
            {"upper_arm.R": [(X, 0.1)], "chest": [], "forearm.R": [(X, 0.2)]},
        ]
        for i in range(len(k) - 1):
            if k[i][0] <= fr <= k[i + 1][0]:
                a = (fr - k[i][0]) / (k[i + 1][0] - k[i][0])
                a = a * a * (3 - 2 * a)
                p0, p1 = poses[i], poses[i + 1]
                out = {}
                for bn in set(p0) | set(p1):
                    rots = [(ax, ang * (1 - a)) for ax, ang in p0.get(bn, [])] + [(ax, ang * a) for ax, ang in p1.get(bn, [])]
                    out[bn] = {"rot": rots}
                return out
        return {}

    return [("idle", range(0, 61, 5), idle), ("walk", range(0, 31, 3), walk), ("attack", range(0, 19, 1), attack)]


def anims_quad(ao, bones):
    def idle(fr):
        t = fr / 60 * 2 * math.pi
        return {"spine": {"rot": [(X, 0.02 * math.sin(t))]}, "head": {"rot": [(Z, 0.15 * math.sin(t * 0.5))]},
                "tail1": {"rot": [(Z, 0.3 * math.sin(t))]}, "tail2": {"rot": [(Z, 0.3 * math.sin(t + 1))]}}

    def walk(fr):
        t = fr / 24 * 2 * math.pi
        s = math.sin(t)
        p = {"hips": {"loc": (0, 0, 0.03 * abs(math.cos(t)))}, "tail1": {"rot": [(Z, 0.3 * s)]},
             "head": {"rot": [(X, 0.05 * s)]}}
        for name, ph in (("fl_up.L", 0), ("bl_up.R", 0), ("fl_up.R", math.pi), ("bl_up.L", math.pi)):
            if name in bones:
                p[name] = {"rot": [(X, 0.5 * math.sin(t + ph))]}
                low = name.replace("_up", "_mid" if name.startswith("bl") else "_low") if name.startswith("bl") else name.replace("_up", "_mid")
                if low in bones:
                    p[low] = {"rot": [(X, -0.4 * max(0.0, math.cos(t + ph)))]}
        return p

    def attack(fr):
        a = math.sin(min(fr / 16, 1) * math.pi)
        return {"neck": {"rot": [(X, 0.35 * a)]}, "head": {"rot": [(X, 0.3 * a)]}, "spine": {"rot": [(X, 0.1 * a)]},
                "hips": {"loc": (0, 0.25 * a, 0)}, "fl_up.L": {"rot": [(X, -0.5 * a)]}, "fl_up.R": {"rot": [(X, -0.5 * a)]}}

    return [("idle", range(0, 61, 5), idle), ("walk", range(0, 25, 2), walk), ("attack", range(0, 17, 1), attack)]


def anims_dragon(ao, bones):
    def idle(fr):
        t = fr / 60 * 2 * math.pi
        s = math.sin(t)
        return {"spine": {"rot": [(X, 0.02 * s)]}, "neck1": {"rot": [(X, 0.05 * s)]}, "head": {"rot": [(Z, 0.1 * math.sin(t * 0.5))]},
                "wing.L": {"rot": [(Y, -0.2 * s)]}, "wing.R": {"rot": [(Y, 0.2 * s)]},
                "tail1": {"rot": [(Z, 0.15 * s)]}, "tail2": {"rot": [(Z, 0.2 * s)]}, "tail3": {"rot": [(Z, 0.25 * s)]}}

    def walk(fr):
        t = fr / 30 * 2 * math.pi
        s = math.sin(t)
        p = idle(fr * 2)
        for name, ph in (("fl_up.L", 0), ("bl_up.R", 0), ("fl_up.R", math.pi), ("bl_up.L", math.pi)):
            p[name] = {"rot": [(X, 0.35 * math.sin(t + ph))]}
        return p

    def attack(fr):
        a = math.sin(min(fr / 24, 1) * math.pi)
        return {"neck1": {"rot": [(X, -0.3 * a)]}, "neck2": {"rot": [(X, 0.5 * a)]}, "head": {"rot": [(X, 0.3 * a)]},
                "wing.L": {"rot": [(Y, 0.6 * a)]}, "wing.R": {"rot": [(Y, -0.6 * a)]}}

    return [("idle", range(0, 61, 5), idle), ("walk", range(0, 31, 3), walk), ("attack", range(0, 25, 2), attack)]


def anims_spider(ao, bones):
    def legs(fr, period, amp):
        t = fr / period * 2 * math.pi
        p = {"abdomen": {"rot": [(X, 0.04 * math.sin(t))]}}
        for s in ("L", "R"):
            for i in range(4):
                ph = (i % 2) * math.pi + (math.pi if s == "R" else 0)
                p["leg%d_a.%s" % (i, s)] = {"rot": [(Z, amp * math.sin(t + ph))]}
                p["leg%d_b.%s" % (i, s)] = {"rot": [(Y, (0.15 if s == "R" else -0.15) * max(0, math.cos(t + ph)) * (amp / 0.3))]}
        return p

    def attack(fr):
        a = math.sin(min(fr / 14, 1) * math.pi)
        p = legs(0, 20, 0.0)
        p["body"] = {"rot": [(X, -0.35 * a)], "loc": (0, 0.2 * a, 0.1 * a)}
        for s in ("L", "R"):
            p["leg0_a.%s" % s] = {"rot": [(X, -0.8 * a)]}
        return p

    return [("idle", range(0, 61, 5), lambda f: legs(f, 60, 0.05)), ("walk", range(0, 21, 2), lambda f: legs(f, 20, 0.3)), ("attack", range(0, 15, 1), attack)]


def anims_bat(ao, bones):
    def flap(fr, period, amp):
        t = fr / period * 2 * math.pi
        s = math.sin(t)
        return {"wing.L": {"rot": [(Y, amp * s)]}, "wing.R": {"rot": [(Y, -amp * s)]},
                "wing_tip.L": {"rot": [(Y, amp * 0.6 * math.sin(t - 0.6))]}, "wing_tip.R": {"rot": [(Y, -amp * 0.6 * math.sin(t - 0.6))]},
                "body": {"loc": (0, 0, -0.05 * s)}}

    def attack(fr):
        p = flap(fr, 8, 0.9)
        a = math.sin(min(fr / 14, 1) * math.pi)
        p["body"] = {"rot": [(X, -0.4 * a)], "loc": (0, 0.4 * a, -0.2 * a)}
        return p

    return [("idle", range(0, 21, 2), lambda f: flap(f, 20, 0.7)), ("walk", range(0, 13, 1), lambda f: flap(f, 12, 0.9)), ("attack", range(0, 15, 1), attack)]


def anims_chain(ao, bones):
    segs = [b.name for b in bones if b.name.startswith("seg")]

    def wave(fr, period, amp):
        t = fr / period * 2 * math.pi
        p = {}
        for i, n in enumerate(segs):
            p[n] = {"rot": [(Z, amp * math.sin(t - i * 0.9))]}
        if "head" in bones:
            p["head"] = {"rot": [(Z, amp * 0.5 * math.sin(t + 0.9))]}
        return p

    def attack(fr):
        a = math.sin(min(fr / 16, 1) * math.pi)
        p = wave(0, 30, 0)
        top = "head" if "head" in bones else segs[0]
        p[top] = {"rot": [(X, -0.5 * a)], "loc": (0, 0.4 * a, 0.3 * a)}
        return p

    return [("idle", range(0, 61, 5), lambda f: wave(f, 60, 0.12)), ("walk", range(0, 31, 3), lambda f: wave(f, 30, 0.3)), ("attack", range(0, 17, 1), attack)]


def anims_machine(ao, bones):
    def idle(fr):
        return {"turret": {"rot": [(Z, 0.2 * math.sin(fr / 60 * 2 * math.pi))]}}

    def attack(fr):
        a = math.sin(min(fr / 12, 1) * math.pi)
        return {"barrel": {"loc": (0, -0.4 * a, 0)}, "hull": {"rot": [(X, 0.03 * a)]}}

    return [("idle", range(0, 61, 5), idle), ("walk", range(0, 61, 5), idle), ("attack", range(0, 13, 1), attack)]


ANIMS = {"humanoid": anims_humanoid, "fairy": anims_humanoid, "quadruped": anims_quad, "lizard": anims_quad,
         "dragon": anims_dragon, "spider": anims_spider, "bat": anims_bat, "serpent": anims_chain,
         "centipede": anims_chain, "machine": anims_machine}


def build_one(mid, spec, save_blend=False):
    kind = spec.get("kind", "humanoid")
    if BUILDERS.get(kind) is None:
        return None
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _tex_cache.clear()
    bpy.context.scene.render.fps = FPS
    rnd = random.Random(zlib.crc32(mid.encode()))
    B = Builder()
    BUILDERS[kind](B, spec, mid, rnd)
    ao, ob = finalize(B, mid)
    ao.animation_data_create()
    for name, frames, fn in ANIMS[kind](ao, ao.data.bones):
        make_action(ao, name, frames, fn)
    ao.animation_data.action = None
    for pb in ao.pose.bones:
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector()
    os.makedirs(OUT, exist_ok=True)
    for old in (mid + ".glb", mid + ".gltf", mid + ".bin"):
        if os.path.exists(os.path.join(OUT, old)):
            os.remove(os.path.join(OUT, old))
    path = os.path.join(OUT, mid + ".gltf")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLTF_SEPARATE", export_texture_dir="texturas",
                              export_animation_mode="ACTIONS",
                              export_skins=True, export_def_bones=True, export_image_format="AUTO",
                              export_yup=True, export_apply=False, export_force_sampling=True,
                              export_optimize_animation_size=True)
    if save_blend:
        os.makedirs(BLEND_OUT, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BLEND_OUT, mid + ".blend"), compress=True)
    return path, len(B.v), len(B.f)


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    args = [a for a in args if not a.endswith(".py")]
    save_blend = "--blend" in args
    only = [a for a in args if not a.startswith("--")]
    specs = load_specs()
    for mid, spec in specs.items():
        if only and mid not in only:
            continue
        r = build_one(mid, spec, save_blend)
        if r:
            print("OK %-16s %6d vértices %6d faces -> %s" % (mid, r[1], r[2], os.path.relpath(r[0], ROOT)))


if __name__ == "__main__":
    main()
