"""Build the forest's humanoid tusked giant in an isolated Blender process.

Run: Blender --background --factory-startup --python tools/build-forest-skull.py
Optional: -- --palette-source /path/to/source.blend --palette-dir /path/to/atlases
Uses existing Material.004, packs its textures, exports only the landmark mesh.
Blender Z-up, face toward -Y; glTF exports Y-up with face toward +Z.
"""
import argparse
import json
import math
from pathlib import Path
import random
import sys

import bpy
from mathutils import Euler, Matrix, Vector
import bmesh

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--palette-source', default='/Users/leonardgoh/Desktop/blender/home-town.blend')
parser.add_argument('--palette-dir', default='/Users/leonardgoh/Desktop/blender/ImphenziaPalettes')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
rng = random.Random(24)
bpy.ops.wm.read_factory_settings(use_empty=True)
with bpy.data.libraries.load(args.palette_source, link=False) as (source, target):
    if 'Material.004' not in source.materials:
        raise RuntimeError('Source must contain the shared Material.004 palette material')
    target.materials = ['Material.004']
material = bpy.data.materials['Material.004']
images = {}
for node in material.node_tree.nodes:
    if node.type == 'TEX_IMAGE':
        filename = Path(node.image.filepath).name
        node.image.filepath = str(Path(args.palette_dir) / filename)
        node.image.reload()
        node.interpolation = 'Closest'
        images[filename] = node.image
    elif node.type == 'BSDF_PRINCIPLED':
        node.inputs['Emission Strength'].default_value = 5.0
        node.inputs['Roughness'].default_value = 0.92
albedo = images['ImphenziaPalette02-Albedo.png']
emission = images['ImphenziaPalette02-Emission.png']
a_pixels, e_pixels = list(albedo.pixels), list(emission.pixels)
w, h = albedo.size


def swatch(rgb):
    # Swatch centres keep collapsed UVs away from palette borders.
    best = None
    for y in range(8, h, 16):
        for x in range(8, w, 16):
            i = (y * w + x) * 4
            if sum(e_pixels[i:i + 3]) > 0.005:
                continue
            error = sum((a_pixels[i + k] - rgb[k]) ** 2 for k in range(3))
            if best is None or error < best[0]:
                best = (error, x, y)
    _, x, y = best
    assert sum(e_pixels[(y * w + x) * 4:(y * w + x) * 4 + 3]) < 0.005
    return ((x + 0.5) / w, (y + 0.5) / h)


SWATCHES = {name: swatch(rgb) for name, rgb in {
    'bone': (0.60, 0.55, 0.43), 'bone_light': (0.73, 0.67, 0.52),
    'bone_shade': (0.45, 0.39, 0.29), 'moss': (0.29, 0.39, 0.12),
    'moss_light': (0.40, 0.48, 0.17), 'root': (0.30, 0.23, 0.13),
    'earth': (0.32, 0.36, 0.24), 'crack': (0.38, 0.33, 0.23),
    'cavity': (0.20, 0.18, 0.13),
    'soil': (0.24, 0.22, 0.16), 'leaf_litter': (0.32, 0.27, 0.11),
}.items()}
print('MATTE SWATCHES', json.dumps(SWATCHES))
asset = bpy.data.collections.new('Forest skull — export')
bpy.context.scene.collection.children.link(asset)
studio = bpy.data.collections.new('Preview studio — not exported')
bpy.context.scene.collection.children.link(studio)


def move_to(obj, collection):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    collection.objects.link(obj)


def active(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def finish(obj, name, tone='bone', crown=False, fractures=()):
    obj.name = name
    move_to(obj, asset)
    obj.data.materials.clear()
    obj.data.materials.append(material)
    obj.data.update()
    for layer in list(obj.data.uv_layers):
        obj.data.uv_layers.remove(layer)
    uv = obj.data.uv_layers.new(name='Palette')
    uv.active_render = True
    for face in obj.data.polygons:
        face.use_smooth = False
        c = obj.matrix_world @ face.center
        n = obj.matrix_world.to_3x3() @ face.normal
        color = tone
        if tone == 'bone':
            if rng.random() < 0.025:
                color = 'bone_light'
            elif math.sin(c.x * 1.8 + c.z * .8) * math.cos(c.y * 1.1) > .15:
                color = 'bone_shade'
            if c.z < 1.15 and n.z < .6:
                color = 'soil'
        if crown and n.dot(c - Vector((0, .4, 5.5))) < -0.1:
            color = 'cavity'
        if crown and color != 'cavity' and n.z > 0.1 and c.z > 4.8:
            patch = math.sin(c.x * 1.6 + c.y * 0.9) + math.cos(c.y * 2.1 - c.x * 0.7)
            if patch > -0.65:
                color = 'moss_light' if rng.random() < 0.22 else 'moss'
        if color != 'cavity' and face.area < .4:
            for path in (CRACK_PATHS if crown else fractures):
                if any(segment_distance(c, a, b) < .18 for a, b in zip(path, path[1:])):
                    color = 'crack'
                    break
        face.material_index = 0
        for loop in face.loop_indices:
            uv.data[loop].uv = SWATCHES[color]
    return obj


def ellipsoid(name, center, scale, segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def subtract(obj, cutter):
    active(obj)
    mod = obj.modifiers.new('Real hollow — ' + cutter.name, 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def segment_distance(point, a, b):
    line = b - a
    t = max(0, min(1, (point - a).dot(line) / max(line.length_squared, 1e-8)))
    return (point - a - t * line).length


def prism(name, outline, y0=-4.5, y1=.0):
    """Angular socket cutter; closed and outward-facing, including mirrored outlines."""
    count = len(outline)
    verts = [(x, y, z) for y in (y0, y1) for x, z in outline]
    faces = [tuple(reversed(range(count))), tuple(count + i for i in range(count))]
    faces.extend((i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    asset.objects.link(obj)
    return obj


def tube(name, points, radii, tone='bone', sides=8):
    pts = [Vector(p) for p in points]
    verts, faces = [], []
    for i, p in enumerate(pts):
        tangent = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        ref = Vector((0, 1, 0)) if abs(tangent.y) < .85 else Vector((1, 0, 0))
        u = tangent.cross(ref).normalized()
        v = tangent.cross(u).normalized()
        for j in range(sides):
            angle = j * math.tau / sides
            verts.append(p + radii[i] * (math.cos(angle) * u + math.sin(angle) * v))
    faces.append(tuple(reversed(range(sides))))
    for i in range(len(pts) - 1):
        for j in range(sides):
            a, b = i * sides + j, i * sides + (j + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.append(tuple((len(pts) - 1) * sides + j for j in range(sides)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    asset.objects.link(obj)
    return finish(obj, name, tone)


# A broad, flattened forehead and angular temples, with an irregular collapsed crown.
CRACK_PATHS = []
profiles = [(2.6, 2.15, 1.8), (3.5, 2.7, 2.2), (4.7, 3.22, 2.6),
            (6.2, 3.35, 2.55), (7.5, 3.03, 2.35), (8.1, 2.4, 1.9),
            (8.4, 1.6, 1.4), (8.48, .50, .6)]
verts, faces, sides = [], [], 16
for k, (z, rx, ry) in enumerate(profiles):
    for j in range(sides):
        a = j * math.tau / sides
        cx, sy = math.cos(a), math.sin(a)
        x = rx * math.copysign(abs(cx) ** .70, cx)
        y = .4 + ry * math.copysign(abs(sy) ** .75, sy)
        irregular = .10 * math.sin(j * 3.7 + k * 1.8)
        verts.append((x, y, z + irregular - (max(0, x) * .09 if k > 4 else 0)))
faces.append(tuple(reversed(range(sides))))
for k in range(len(profiles) - 1):
    for j in range(sides):
        a, b = k * sides + j, k * sides + (j + 1) % sides
        faces.append((a, b, b + sides, a + sides))
faces.append(tuple((len(profiles) - 1) * sides + j for j in range(sides)))
mesh = bpy.data.meshes.new('Angular cranial shell')
mesh.from_pydata(verts, [], faces)
mesh.update()
cranium = bpy.data.objects.new('Cranium', mesh)
asset.objects.link(cranium)
subtract(cranium, ellipsoid('Inner cranial cavity', (0, .42, 5.35), (2.67, 2.08, 2.76), 20, 14))
for side in (-1, 1):
    shape = [(-1.02, -.55), (-1.12, .34), (-.70, .98), (.64, .86),
             (1.06, .22), (.90, -.71), (.10, -.96)]
    outline = [(side * (1.48 + x), 5.30 + z + (.12 if side < 0 else 0)) for x, z in shape]
    subtract(cranium, prism('Angular eye socket', outline))
# A triangular nasal aperture, tapering up between the forward-facing sockets.
mesh = bpy.data.meshes.new('Nasal aperture cutter')
verts = [(x, y, z) for y in (-4, -.3) for x, z in [(-.64, 3.1), (.64, 3.1), (0, 5.03)]]
mesh.from_pydata(verts, [], [(0, 1, 2), (3, 5, 4), (3, 4, 1, 0), (4, 5, 2, 1), (5, 3, 0, 2)])
cutter = bpy.data.objects.new('Nose', mesh)
bpy.context.scene.collection.objects.link(cutter)
subtract(cranium, cutter)
bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, -2.5))
cutter = bpy.context.object
cutter.scale = (6, 6, 5.1)  # Cut away the underside below Z=2.6.
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
subtract(cranium, cutter)
# A missing piece on the rear temple exposes the shell thickness.
subtract(cranium, ellipsoid('Old temple break', (2.98, .8, 4.0), (.9, 1.10, .95), 8, 6))
# Chips break the orbital rim, crown and cheek edge instead of perfect cutouts.
for center, scale in [((-2.05, -2.0, 6.2), (.25, .55, .24)),
                       ((2.28, -2.0, 4.65), (.30, .50, .20)),
                       ((-.75, -.5, 8.38), (.45, .65, .31)),
                       ((-2.92, -.15, 4.18), (.32, .45, .48))]:
    subtract(cranium, ellipsoid('Old chipped edge', center, scale, 6, 4))
# Deep branching cracks follow the actual surface, cut with narrow irregular wedges.
for outline in [[(-.6, 8.25), (-.78, 7.70), (-.40, 7.23), (-.65, 6.55)],
                [(-.42, 7.25), (.04, 6.98), (.12, 6.32)],
                [(1.15, 7.80), (1.43, 7.29), (1.10, 6.97), (1.44, 6.54)],
                [(-2.50, 5.86), (-2.80, 5.20), (-2.61, 4.89), (-2.83, 4.35)],
                [(.55, 4.24), (.80, 3.89), (.60, 3.45)]]:
    path = []
    for x, z in outline:
        hit, pos, normal, _ = cranium.ray_cast(Vector((x, -10, z)), Vector((0, 1, 0)))
        if hit:
            path.append(pos + normal * .035)
    if len(path) > 1:
        CRACK_PATHS.append(path)
        subtract(cranium, tube('Recessed fracture', path, [.11] * len(path), 'crack', 5))
finish(cranium, 'Hollow humanoid cranium', crown=True)

for side in (-1, 1):
    tube('Cheek arch', [(side * 2.80, -.45, 4.8), (side * 2.9, -1.5, 4.0),
                       (side * 2.25, -2.28, 3.28), (side * 1.45, -2.44, 3.12)], [.37, .42, .48, .38])
    tube('Upper dental arch', [(0, -2.50, 2.90), (side * .9, -2.45, 2.95),
                              (side * 1.85, -2.10, 3.0), (side * 2.16, -1.25, 3.25)], [.35, .39, .52, .36])
# Separate horseshoe mandible, sitting slightly crooked and partly in the soil.
jaw_points = [(-2.65, .65, 3.65), (-2.70, .45, 1.65), (-2.45, -1.25, .65),
              (-1.55, -2.65, .42), (0, -3.05, .42), (1.45, -2.7, .50),
              (2.43, -1.3, .78), (2.65, .40, 1.62), (2.52, .6, 3.6)]
tube('Weathered lower jaw', jaw_points, [.29, .37, .46, .48, .46, .47, .44, .36, .24])

for i, x in enumerate([-1.28, -.64, -.10, .50, 1.15]):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -2.60 + .09 * abs(x), 2.32 + .08 * (i % 2)))
    tooth = bpy.context.object
    tooth.scale = (.39, .52, .71 if i != 3 else .40)
    tooth.rotation_euler = (.05, .11 * math.sin(i), .07 * math.cos(i))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = tooth.modifiers.new('Worn tooth corners', 'BEVEL')
    bevel.width = .07
    bevel.segments = 1
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    finish(tooth, 'Upper tooth')
for i, x in enumerate([-1.6, -.7, .43, 1.55]):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -2.77 + .14 * abs(x), 1.00))
    tooth = bpy.context.object
    tooth.scale = (.42, .48, .57 if i != 2 else .34)
    tooth.rotation_euler = (0, -.12 * math.cos(i), .07)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(tooth, 'Remaining lower tooth', 'bone_shade')

# Sparse roots follow the rear temple and one cheek, leaving the face readable.
tube('Root over crown', [(1.3, 2.8, 0), (2.2, 2.1, 2.6), (2.6, 1.5, 5.1),
                        (1.95, .95, 7.75), (.70, .60, 8.70), (-.30, -.35, 8.57)], [.34, .28, .24, .18, .11, .04], 'root', 6)
tube('Root through temple', [(2.4, 2.0, 0), (3.2, 1.2, 1.2), (3.1, .9, 3.8),
                           (2.55, -.15, 4.2), (2.55, -1.45, 4.3), (1.90, -2.4, 4.65)], [.23, .2, .17, .13, .09, .035], 'root', 6)
tube('Thin hanging root', [(2.55, -1.3, 4.3), (2.15, -2.2, 3.5), (2.4, -2.5, 2.3), (2.20, -2.8, .4)], [.075, .068, .045, .018], 'root', 5)
# Tangled moss hangs over the rim; small angular clumps sit against the real shell.
for i in range(19):
    x, y = rng.uniform(-2.6, 2.6), rng.uniform(-1.8, 2.4)
    hit, pos, normal, _ = cranium.ray_cast(Vector((x, y, 12)), Vector((0, 0, -1)))
    if not hit:
        continue
    moss = ellipsoid('Thick crown moss', pos + normal * .04,
                     (rng.uniform(.38, .8), rng.uniform(.40, .8), rng.uniform(.15, .3)), 8, 4)
    moss.rotation_euler = normal.to_track_quat('Z', 'Y').to_euler()
    finish(moss, 'Thick crown moss', 'moss' if i % 3 else 'moss_light')

# Tip forward and sideways into the earth, rather than displaying an upright trophy.
rotation = Euler((math.radians(32), math.radians(-12), math.radians(-5)), 'XYZ').to_matrix()
pivot = Vector((0, 0, 1.3))
def pose(point):
    return rotation @ (Vector(point) - pivot) + pivot
for obj in list(asset.objects):
    for vertex in obj.data.vertices:
        vertex.co = pose(obj.matrix_world @ vertex.co)
    obj.matrix_world = Matrix.Identity(4)
    obj.data.update()

left = [pose((-1.88, -2.15, 3.13)), (-3.1, -3.6, 1.45), (-4.2, -4.2, 1.3),
        (-5.4, -4.6, 1.85), (-6.1, -4.7, 3.0), (-6.45, -4.4, 4.4), (-6.5, -4.1, 5.5)]
intact = tube('Left tusk — intact', left, [.64, .62, .53, .43, .30, .17, .018], sides=10)
right = [pose((1.88, -2.15, 3.13)), (2.9, -3.6, 1.50), (3.95, -4.7, .65),
         (4.65, -5.8, .55), (4.9, -6.8, .52), (4.75, -7.45, .62)]
path_tusk = tube('Right tusk — across walking path', right, [.64, .64, .55, .47, .37, .28], sides=10)
# Jagged, exposed broken end and a few larger worn notches along both tusks.
for obj, center, scale in [(path_tusk, (4.82, -7.45, .77), (.22, .3, .18)),
                            (intact, (-4.15, -4.55, 1.56), (.24, .22, .16))]:
    subtract(obj, ellipsoid('Tusk chip', center, scale, 6, 4))
    finish(obj, obj.name)
for obj, outlines in [(intact, [[(-3.2, 1.43), (-3.60, 1.34), (-3.84, 1.40)],
                              [(-5.96, 2.65), (-6.11, 2.93), (-6.24, 3.16)]]),
                       (path_tusk, [[(3.78, .70), (4.00, .63), (4.21, .69), (4.39, .64)]])]:
    fractures = []
    for outline in outlines:
        points = []
        for x, z in outline:
            hit, pos, normal, _ = obj.ray_cast(Vector((x, -12, z)), Vector((0, 1, 0)))
            if hit:
                points.append(pos + normal * .015)
        if len(points) > 1:
            fractures.append(points)
            subtract(obj, tube('Tusk fissure cutter', points, [.075] * len(points), 'crack', 5))
    finish(obj, obj.name, fractures=fractures)
# Strong seams wrap the visible tusk surface; jaw cracks split its front edge.
for name, points, radii in [
    ('Tusk fracture seam', [(4.30, -5.65, .94), (4.60, -5.83, .99), (4.84, -5.91, .82)], [.05, .06, .035]),
    ('Old jaw split', [pose((-.95, -3.48, .25)), pose((-.70, -3.45, .66)), pose((-.8, -3.40, .86))], [.045, .07, .035]),
]:
    tube(name, points, radii, 'crack', 4)

def leaf(name, center, angle, size, tone=None):
    # Folded, double-sided diamond: readable foliage without extra materials.
    c = Vector(center)
    up = Vector((math.sin(angle), .18, math.cos(angle))) * size
    side = Vector((math.cos(angle), 0, -math.sin(angle))) * size * .42
    verts = [c + up, c + side, c - up * .65, c - side,
             c + Vector((0, -.10, .02)), c + Vector((0, .025, 0))]
    faces = [(4, i, (i + 1) % 4) for i in range(4)]
    faces += [(5, (i + 1) % 4, i) for i in range(4)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new(name, mesh)
    asset.objects.link(obj)
    finish(obj, name, tone or ('moss_light' if rng.random() < .3 else 'moss'))

vines = [
    [pose((-1.7, -1.9, 7.6)), pose((-2.0, -2.3, 6.4)), pose((-2.65, -2.1, 5.4)), (-3.1, -3.4, .3)],
    [pose((1.2, -2.0, 7.4)), pose((1.6, -2.45, 6.15)), pose((2.35, -2.4, 5.15)), (2.95, -3.2, .12)],
    [pose((.7, .2, 8.4)), pose((2.1, -.15, 7.7)), pose((2.7, -.6, 6.7)), (3.1, -.8, 0)],
    [pose((-2.7, .3, 7.1)), pose((-3.2, -.1, 5.9)), (-3.45, -1.7, .15)],
]
for i, points in enumerate(vines):
    tube('Overgrown hanging vine', points, [.075] * len(points), 'root', 5)
    for a, b in zip(points, points[1:]):
        for j in range(5):
            t = (j + .35) / 5
            c = Vector(a).lerp(Vector(b), t)
            leaf('Ivy leaf', c + Vector(((-1 if j % 2 else 1) * .16, -.04, 0)),
                 (-1 if j % 2 else 1) * rng.uniform(.3, 1.2), rng.uniform(.21, .38))
# Fern fans and creeping roots at the buried base and along the low tusk.
for x, y in [(-2.9, -2.6), (2.6, -1.9), (1.8, .9), (-1.9, .5), (3.9, -4.5)]:
    for j in range(6):
        a = (j - 2.5) * .35
        leaf('Base fern', (x + math.sin(a) * .22, y, .18 + .28 * math.cos(a)), a, .55)
for points in [[(3.2, 1.8, 0), (3.45, -.2, .25), (2.7, -1.8, .6), (2.7, -2.8, .05)],
               [(-3.7, .8, -.1), (-3.2, -.9, .4), (-2.8, -2.25, .8), (-2.1, -3.6, .05)]]:
    tube('Grounding root', points, [.22, .20, .14, .05], 'root', 6)
# Low angular fragments nest the jaw into the ground rather than a pedestal.
for i in range(10):
    x, y = rng.uniform(-3.1, 3.1), rng.uniform(-2.5, 1.6)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=(x, y, .03))
    rubble = bpy.context.object
    rubble.scale = (rng.uniform(.25, .55), rng.uniform(.3, .65), rng.uniform(.12, .30))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(rubble, 'Buried fragment', 'earth' if i % 3 else 'bone_shade')

# Centuries of accumulated humus and stones bury the sides and most of the jaw.
# Keep all this growth behind the trail; only the existing tusk crosses it.
for i, (center, scale) in enumerate([
    ((-3.7, -.5, 1.1), (1.65, 2.20, 2.25)),
    ((-3.3, -2.2, 1.05), (1.40, 1.45, 1.85)),
    ((1.8, -.3, 1.25), (2.30, 2.10, 2.65)),
    ((1.25, -2.6, 1.55), (1.60, 1.30, 2.8)),
    ((.50, -3.3, .85), (1.25, .85, 1.75)),
    ((-.9, -3.05, .35), (1.70, .65, 1.05)),
    ((2.95, -2.1, .60), (1.35, 1.35, 1.35)),
]):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=center)
    mound = bpy.context.object
    for vertex in mound.data.vertices:
        vertex.co *= rng.uniform(.85, 1.13)
    mound.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(mound, 'Centuries of mossed humus', 'soil')
    uv = mound.data.uv_layers.active.data
    for face in mound.data.polygons:
        tone = 'soil'
        if face.normal.z > .12:
            tone = 'moss' if rng.random() < .85 else 'earth'
        elif rng.random() < .3:
            tone = 'earth'
        for loop in face.loop_indices:
            uv[loop].uv = SWATCHES[tone]

# Thick moss mats grow around the temples and cheeks, breaking the skull outline.
for side in (-1, 1):
    for i in range(23):
        y, z = rng.uniform(-3.8, 1.2), rng.uniform(2.0, 7.2)
        hit, pos, normal, _ = cranium.ray_cast(Vector((side * 12, y, z)), Vector((-side, 0, 0)))
        if not hit:
            continue
        mat = ellipsoid('Side moss mat', pos + normal * .08,
                        (rng.uniform(.45, .85), rng.uniform(.60, 1.15), rng.uniform(.18, .34)), 8, 4)
        mat.rotation_euler = normal.to_track_quat('Z', 'Y').to_euler()
        finish(mat, 'Side moss mat', 'moss' if i % 5 else 'moss_light')

# A draped mat partly fills one orbit and the nose; a dark broken arc remains.
for i, (point, scale) in enumerate([
    ((1.25, -2.15, 5.4), (.85, .45, 1.10)),
    ((.72, -2.45, 4.7), (.65, .40, .95)),
    ((-.95, -2.20, 6.15), (.70, .32, .58)),
    ((-2.25, -1.85, 4.8), (.62, .32, .84)),
]):
    center = pose(point)
    mat = ellipsoid('Overgrown facial remnant', center, scale, 8, 4)
    mat.rotation_euler = (rotation @ Vector((0, -1, .3))).to_track_quat('Z', 'Y').to_euler()
    finish(mat, 'Overgrown facial remnant', 'moss')

heavy_vines = [
    [pose((1.6, -.9, 7.65)), pose((1.2, -2.3, 6.5)), pose((1.5, -2.5, 5.3)), (.9, -3.8, 1.4)],
    [pose((2.5, .0, 7.0)), pose((2.6, -1.0, 6.0)), (2.8, -2.2, 2.6), (2.6, -3.3, .5)],
    [pose((-2.5, .0, 7.0)), pose((-2.9, -1.2, 5.9)), (-3.5, -2.1, 2.1), (-3.7, -3.3, .3)],
    [pose((.3, -.6, 8.2)), pose((.30, -2.4, 6.7)), pose((.65, -2.5, 5.1)), (.3, -3.8, 1.0)],
    [(-4.8, .2, .1), (-4.25, -1.9, 1.4), (-3.6, -2.6, 2.3)],
    [(3.5, 1.0, .1), (3.35, -.8, 1.8), (2.4, -2.0, 3.3)],
]
for i, points in enumerate(heavy_vines):
    tube('Entangled side vine', points, [.16 - j * .025 for j in range(len(points))], 'root', 6)
    for a, b in zip(points, points[1:]):
        for j in range(6):
            c = Vector(a).lerp(Vector(b), (j + .25) / 6)
            for direction in (-1, 1):
                leaf('Dense side ivy', c + Vector((direction * .17, -.04, .02)),
                     direction * rng.uniform(.3, 1.2), rng.uniform(.33, .50))

# Roots and fallen limbs weave through the built-up sides, with litter in pockets.
for points in [
    [(3.8, 1.2, -.15), (3.4, -.15, .55), (2.2, -1.5, 2.1), (1.7, -2.4, 3.4), pose((2.2, -.5, 6.8))],
    [(-4.5, .8, -.1), (-4.0, -.8, 1.0), (-3.6, -2.0, 2.5), pose((-2.9, -.9, 5.9))],
    [(2.8, -.2, .25), (2.6, -1.8, .65), (1.55, -2.6, .8), (.2, -3.8, .3)],
]:
    tube('Ancient root wrapping the remains', points, [.42 - j * .065 for j in range(len(points))], 'root', 7)
for i in range(45):
    side = -1 if i % 2 else 1
    x, y = side * rng.uniform(2.6, 4.5), rng.uniform(-3.3, .8)
    leaf('Accumulated fallen leaves', (x, y, rng.uniform(.08, .40)),
         rng.uniform(-1.5, 1.5), rng.uniform(.25, .5), 'leaf_litter')
for x, y, z in [(-3.6, -2.3, 1.8), (2.8, -2.1, 2.0), (.6, -3.5, 2.7), (-4.1, -.2, 2.0)]:
    for j in range(7):
        angle = (j - 3) * .30
        leaf('Fern growing in old sediment', (x + math.sin(angle) * .25, y, z + .25), angle, .70)

# The torso has collapsed sideways into the forest, rather than surviving as an
# intact skeleton. Only a few broken arcs and knuckles emerge from the sediment.
# These coordinates are already posed; keep them behind the trail (Y > -5.25).
rib_paths = [
    [(4.0, .65, .10), (4.65, -.35, 1.25), (5.05, -1.45, 2.30), (5.25, -2.40, 2.75), (5.65, -3.0, 2.25)],
    [(5.9, 1.25, -.15), (6.45, .25, 1.1), (6.8, -.9, 2.15), (7.25, -1.75, 2.55)],
    [(7.6, 1.5, -.2), (8.35, .75, .65), (8.95, -.15, 1.65), (9.10, -1.25, 2.05), (9.3, -2.0, 1.55)],
    [(9.35, 1.85, -.2), (10.0, 1.1, .55), (10.55, -.2, 1.40)],
    # Detached sections lie at different angles and depths, with missing links.
    [(6.0, -3.55, .08), (6.85, -3.6, .35), (7.6, -3.35, .72)],
    [(10.2, -2.9, .10), (10.8, -2.5, .45), (11.9, -1.95, .72)],
    [(7.0, 2.25, .05), (7.85, 2.9, .5), (8.2, 3.5, .85)],
]
for i, points in enumerate(rib_paths):
    radii = [.36 - j * .035 for j in range(len(points))]
    bone = tube('Broken buried rib', points, radii, sides=7)
    # A scalloped break and off-centre facets keep exposed tips irregular.
    tip = Vector(points[-1])
    subtract(bone, ellipsoid('Rib end erosion', tip + Vector((.10, -.15, .13)), (.23, .23, .20), 8, 4))
    finish(bone, 'Broken buried rib')
    # Moss follows the highest surviving sections, leaving patches of old bone.
    for j, point in enumerate(points[1:-1]):
        if (i + j) % 3 == 1:
            continue
        mat = ellipsoid('Moss on rib', Vector(point) + Vector((-.07, .08, .25)), (.43, .50, .15), 8, 4)
        finish(mat, 'Moss on rib', 'moss')

# Uneven vertebrae recede from the skull into a mostly buried spine; the gaps
# imply the body's scale without drawing an orderly row of identical objects.
for i, (x, y, z, size) in enumerate([
    (3.65, 1.0, .2, .65), (5.0, 1.35, .45, .62), (6.4, 1.65, .40, .58),
    (8.0, 1.9, .15, .53), (10.65, 2.15, .10, .47), (12.2, 2.5, .05, .40),
]):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=(x, y, z))
    vertebra = bpy.context.object
    vertebra.scale = (size, size * .85, size * .7)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(vertebra, 'Eroded vertebra')
    tube('Broken vertebral process', [(x, y, z + .12), (x + .15, y + .38, z + .60),
                                     (x + .10, y + .55, z + .76)], [.23, .19, .10], sides=6)

# Long limb fragments are sunken, displaced, and broken; no complete limbs.
for i, (points, radii) in enumerate([
    ([(11.4, -.85, .05), (12.1, -1.15, .38), (13.3, -1.65, .55), (15.1, -2.25, .30)], [.62, .39, .35, .54]),
    ([(15.65, -2.35, .20), (16.7, -2.8, .38), (18.65, -3.15, .10)], [.45, .30, .40]),
    ([(12.5, 2.8, -.05), (14.0, 3.25, .22), (16.3, 3.4, .15)], [.58, .31, .43]),
]):
    limb = tube('Partially buried limb fragment', points, radii, sides=8)
    mid = Vector(points[1])
    subtract(limb, ellipsoid('Deep limb chip', mid + Vector((.0, -.23, .30)), (.24, .32, .27), 8, 4))
    finish(limb, 'Partially buried limb fragment')

# Low, irregular humus shelves bury the rib roots and connect to the skull's
# existing mound. Smaller deposits taper out into the surrounding forest grass.
body_deposits = [
    ((4.6, .4, .30), (1.7, 1.6, .95)), ((5.35, -2.1, .65), (.8, 1.05, 1.1)),
    ((6.7, .45, .35), (1.4, 1.2, 1.00)), ((7.1, -1.5, .50), (.8, .85, .95)),
    ((8.6, 1.3, .25), (1.5, 1.55, .75)), ((9.25, -.70, .40), (.85, 1.1, .85)),
    ((11.1, .6, .15), (1.8, 1.6, .50)), ((12.8, -1.4, .05), (1.3, .65, .52)),
    ((14.4, -1.9, .05), (1.25, .8, .45)), ((16.6, -2.9, -.03), (1.25, .8, .40)),
    ((13.6, 3.1, -.02), (1.9, 1.1, .45)), ((17.8, -2.2, -.10), (1.7, 1.1, .35)),
]
for center, scale in body_deposits:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=center)
    mound = bpy.context.object
    for vertex in mound.data.vertices:
        vertex.co *= rng.uniform(.75, 1.2)
    mound.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(mound, 'Sediment swallowing the skeleton', 'soil')
    uv = mound.data.uv_layers.active.data
    for face in mound.data.polygons:
        tone = 'moss' if face.normal.z > .12 else 'soil'
        if rng.random() < .18:
            tone = 'earth'
        for loop in face.loop_indices:
            uv[loop].uv = SWATCHES[tone]

for points in [
    [(2.9, .1, .3), (4.3, -.1, .95), (5.15, -1.0, 1.9), (5.3, -2.4, 2.98), (5.85, -3.15, .2)],
    [(5.25, 2.55, .05), (6.35, 1.2, 1.0), (6.85, -.65, 2.15), (7.2, -1.6, 2.75), (7.75, -2.75, .05)],
    [(8.3, 2.8, -.1), (8.5, 1.15, .85), (9.0, -.4, 1.9), (9.5, -2.4, .2), (11.1, -3.8, -.1)],
    [(11.0, 2.4, -.15), (12.0, .7, .32), (12.85, -1.4, .88), (14.6, -2.65, .1)],
    [(16.0, 3.6, -.15), (15.0, 1.0, .10), (15.1, -1.85, .70), (16.0, -3.25, .0)],
]:
    tube('Root binding the buried body', points, [.23 - j * .035 for j in range(len(points))], 'root', 6)
    for a, b in zip(points, points[1:]):
        for j in range(4):
            c = Vector(a).lerp(Vector(b), (j + .25) / 4)
            leaf('Body ivy', c + Vector(((-1 if j % 2 else 1) * .17, -.08, .06)),
                 (-1 if j % 2 else 1) * rng.uniform(.4, 1.3), rng.uniform(.30, .48))
for x, y, z in [(4.4, -.5, .8), (5.7, -2.2, 1.25), (7.4, -1.2, 1.0),
                 (8.4, .5, .65), (9.5, -1.5, .65), (12.5, -1.2, .25), (15.3, -1.6, .15)]:
    for j in range(6):
        angle = (j - 2.5) * .35
        leaf('Fern among the ribs', (x + math.sin(angle) * .25, y, z + .2), angle, .64)
for i in range(60):
    x, y = rng.uniform(3.8, 18.5), rng.uniform(-3.9, 3.5)
    leaf('Body leaf litter', (x, y, rng.uniform(.0, .22)), rng.uniform(-1.5, 1.5),
         rng.uniform(.18, .38), 'leaf_litter')

# One mesh/material primitive in the GLB: the holes remain real geometry.
bpy.ops.object.select_all(action='DESELECT')
for obj in asset.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = cranium
bpy.ops.object.join()
skull = bpy.context.object
skull.name = 'ForestSkull'
bpy.context.scene.cursor.location = (0, 0, 0)
bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
tri = skull.modifiers.new('Export triangulation', 'TRIANGULATE')
bpy.ops.object.modifier_apply(modifier=tri.name)
skull.data.validate(verbose=True, clean_customdata=False)
skull.data.update()
for face in skull.data.polygons:
    face.use_smooth = False
    face.material_index = 0
# Join deduplicates slots inconsistently across Blender versions; retain one.
skull.data.materials.clear()
skull.data.materials.append(material)
# Generate the one jump obstacle from the actual tusk's path cross-section.
# Blender -Y becomes glTF +Z, with the landmark six metres behind the trail.
crossing = []
for face in skull.data.polygons:
    points = [skull.matrix_world @ skull.data.vertices[i].co for i in face.vertices]
    crossing.extend(v for v in points if -6.25 <= v.y <= -5.75)
    for a, b in zip(points, points[1:] + points[:1]):
        for y in (-6.25, -5.75):
            if (a.y - y) * (b.y - y) < 0:
                crossing.append(a + (b - a) * ((y - a.y) / (b.y - a.y)))
assert crossing, 'Tusk must intersect the walking path'
x0, x1 = min(v.x for v in crossing), max(v.x for v in crossing)
tusk_collision = {'x': round((x0 + x1) / 2, 4), 'hw': round((x1 - x0) / 2, 4),
                  'h': round(max(v.z for v in crossing), 4)}
(ROOT / 'src/config/forestSkull.json').write_text(json.dumps(tusk_collision, indent=2) + '\n')

for img in images.values():
    img.pack()
export_path = ROOT / 'public/models/forest-skull.glb'
export_path.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(export_path), export_format='GLB',
                         use_selection=True, export_yup=True, export_materials='EXPORT',
                         export_cameras=False, export_lights=False)
bounds = [skull.matrix_world @ Vector(c) for c in skull.bound_box]
report = {'triangles': len(skull.data.polygons), 'vertices': len(skull.data.vertices),
          'glb_bytes': export_path.stat().st_size, 'materials': [m.name for m in skull.data.materials],
          'dimensions': list(skull.dimensions), 'matte_swatches': SWATCHES,
          'path_tusk': tusk_collision, 'pose_degrees': [32, -12, -5]}
report_path = ROOT / 'assets/blender/forest-skull.stats.json'
report_path.write_text(json.dumps(report, indent=2) + '\n')
print('SKULL EXPORT', json.dumps(report))

# Authoring-only studio, not selected during export.
bpy.ops.mesh.primitive_plane_add(size=200)
ground = bpy.context.object
move_to(ground, studio)
ground.name = 'Preview ground — not exported'
ground.location.z = -.28
ground.data.materials.append(material)
uv = ground.data.uv_layers.active
for loop in uv.data:
    loop.uv = SWATCHES['earth']
world = bpy.data.worlds.new('Soft studio')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (.44, .49, .45, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = .5
bpy.context.scene.world = world
for name, location, energy, size in [('Key', (-7, -10, 14), 2400, 8), ('Fill', (7, -5, 9), 1100, 7), ('Rim', (1, 6, 12), 2300, 6)]:
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size = energy, 'DISK', size
    obj = bpy.data.objects.new(name, data)
    studio.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector((0, 0, 4.2)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
cam_data = bpy.data.cameras.new('Preview camera')
cam = bpy.data.objects.new('Preview camera', cam_data)
studio.objects.link(cam)
cam_data.type, cam_data.ortho_scale = 'ORTHO', 16.5
bpy.context.scene.camera = cam
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 900, 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'AgX'
scene.render.film_transparent = False
out = ROOT / 'output/forest-skull'
out.mkdir(parents=True, exist_ok=True)
for view, location in [('three-quarter', (-12, -19, 10)), ('front', (0, -23, 7)), ('side', (-23, -1, 7))]:
    cam.location = location
    cam.rotation_euler = (Vector((-.25, -1.5, 3.7)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(out / (view + '.png'))
    bpy.ops.render.render(write_still=True)
cam_data.ortho_scale = 30
cam.location = (-4, -28, 20)
cam.rotation_euler = (Vector((6.5, -.5, 2.3)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = str(out / 'remains.png')
bpy.ops.render.render(write_still=True)
cam_data.ortho_scale = 16.5
cam.location = (-12, -19, 10)
cam.rotation_euler = (Vector((-.25, -1.5, 3.7)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
active(skull)
# A new dedicated file with packed palettes. No writes to the source .blend.
blend_path = ROOT / 'assets/blender/forest-skull.blend'
blend_path.parent.mkdir(parents=True, exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
print('SAVED DEDICATED FILE', str(blend_path))
