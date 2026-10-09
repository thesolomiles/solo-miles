"""Build five moss-covered stone forms in a dedicated, packed-palette Blender file.

Blender --background --factory-startup --python tools/build-forest-stones.py
Reuses Material.004 from forest-skull.blend; never edits that source.
"""
import json
import math
from pathlib import Path
import random

import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
with bpy.data.libraries.load(str(ROOT / 'assets/blender/forest-skull.blend'), link=False) as (source, target):
    target.materials = ['Material.004']
material = bpy.data.materials['Material.004']
images = {}
for node in material.node_tree.nodes:
    if node.type == 'TEX_IMAGE':
        node.interpolation = 'Closest'
        images[Path(node.image.filepath).name] = node.image
albedo = images['ImphenziaPalette02-Albedo.png']
emission = images['ImphenziaPalette02-Emission.png']
apx, epx = list(albedo.pixels), list(emission.pixels)
w, h = albedo.size


def swatch(rgb):
    candidates = []
    for y in range(8, h, 16):
        for x in range(8, w, 16):
            i = (y * w + x) * 4
            if sum(epx[i:i+3]) < .005:
                candidates.append((sum((apx[i+k] - rgb[k]) ** 2 for k in range(3)), x, y))
    _, x, y = min(candidates)
    return ((x + .5) / w, (y + .5) / h)


SWATCHES = {name: swatch(rgb) for name, rgb in {
    'stone': (.36, .40, .35), 'stone_light': (.46, .48, .40),
    'stone_dark': (.25, .29, .26), 'moss': (.26, .39, .10),
    'moss_light': (.40, .50, .16), 'moss_dark': (.16, .26, .09),
    'root': (.25, .22, .14), 'soil': (.22, .25, .14),
}.items()}
asset = bpy.data.collections.new('Forest stones — export')
bpy.context.scene.collection.children.link(asset)
rng = random.Random(739)
parts = []


def active(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def finish(obj, name, tone='stone'):
    obj.name = name
    for coll in list(obj.users_collection):
        coll.objects.unlink(obj)
    asset.objects.link(obj)
    obj.data.materials.clear()
    obj.data.materials.append(material)
    obj.data.update()
    for layer in list(obj.data.uv_layers):
        obj.data.uv_layers.remove(layer)
    uv = obj.data.uv_layers.new(name='Palette')
    for face in obj.data.polygons:
        face.use_smooth = False
        color = tone
        if tone == 'stone':
            r = rng.random()
            color = 'stone_dark' if r < .18 else 'stone_light' if r > .88 else 'stone'
        elif tone == 'moss':
            color = rng.choices(['moss', 'moss_light', 'moss_dark'], [6, 2, 2])[0]
        for loop in face.loop_indices:
            uv.data[loop].uv = SWATCHES[color]
    parts.append(obj)
    return obj


def rock(name, p, scale, tone='stone', twist=0):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=p)
    obj = bpy.context.object
    # Distort shared vertices before flat shading: no cracks between facets.
    for vert in obj.data.vertices:
        vert.co *= rng.uniform(.89, 1.10)
    obj.scale = scale
    obj.rotation_euler = (rng.uniform(-.12, .12), rng.uniform(-.12, .12), twist)
    return finish(obj, name, tone)


def moss(p, sx, sy, amount=12):
    # Connected cushions with a ragged fringe rather than an even green stripe.
    rock('Continuous moss bed', (p[0], p[1], p[2]+.025), (sx*.72, sy*.70, .10), 'moss')
    for k in range(amount):
        angle = k * math.tau / amount + rng.uniform(-.35, .35)
        radius = rng.uniform(.40, .90)
        x, y = sx * math.cos(angle) * radius, sy * math.sin(angle) * radius
        rock('Moss cushion', (p[0]+x, p[1]+y, p[2]+rng.uniform(.01, .09)),
             (sx * rng.uniform(.23, .35), sy * rng.uniform(.24, .36), rng.uniform(.065, .13)), 'moss')
    for k in range(5):
        a = rng.uniform(0, math.tau)
        rock('Hanging moss', (p[0]+sx*.85*math.cos(a), p[1]+sy*.85*math.sin(a), p[2]-.08),
             (.08, .075, rng.uniform(.13, .23)), 'moss')


def slab(p, sx, sy, thick=.22, roof=False, rotation=0):
    n = 8
    radii = [rng.uniform(.9, 1.1) for _ in range(n)]
    levels = [(-thick*.5, .94), (0, 1), (thick*.5, .58 if roof else .86)]
    vertices = []
    for z, r in levels:
        for k in range(n):
            a = k * math.tau / n
            vertices.append((sx*math.cos(a)*r*radii[k], sy*math.sin(a)*r*radii[k], z))
    faces = [tuple(reversed(range(n))), tuple(2*n+k for k in range(n))]
    for j in range(2):
        for k in range(n):
            a, b = j*n+k, j*n+(k+1)%n
            faces.append((a, b, b+n, a+n))
    mesh = bpy.data.meshes.new('Worn slab')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new('Worn slab', mesh)
    asset.objects.link(obj)
    obj.location = p
    obj.rotation_euler.z = rotation
    finish(obj, 'Moss-capped roof' if roof else 'Uneven stone slab')
    moss((p[0], p[1], p[2]+thick*.36), sx*.91, sy*.9, 15 if roof else 9)
    return obj


def block(p, scale, hole=False, rotation=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=p)
    obj = bpy.context.object
    obj.scale = scale
    active(obj)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = obj.modifiers.new('Eroded edges', 'BEVEL')
    bevel.width, bevel.segments = .045, 1
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    if hole:
        bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=min(scale[0], scale[2])*.24,
                                           depth=scale[1]+.4, location=p, rotation=(math.pi/2, 0, 0))
        cut = bpy.context.object
        active(obj)
        boolean = obj.modifiers.new('Open circular aperture', 'BOOLEAN')
        boolean.operation, boolean.solver, boolean.object = 'DIFFERENCE', 'EXACT', cut
        bpy.ops.object.modifier_apply(modifier=boolean.name)
        bpy.data.objects.remove(cut, do_unlink=True)
    obj.rotation_euler.z = rotation
    return finish(obj, 'Pierced lantern chamber' if hole else 'Weathered support')


def base():
    rock('Half-buried foundation', (0, 0, .10), (.80, .61, .23))
    moss((0, 0, .03), .89, .65, 9)
    for k in range(3):
        a = rng.uniform(0, math.tau)
        rock('Settled loose stone', (.8*math.cos(a), .6*math.sin(a), .08), (.22, .18, .13))


names = ['LowCairn', 'SquatLantern', 'LayeredPagoda', 'TallStack', 'BrokenLantern']
meshes = []
for v, name in enumerate(names):
    parts = []
    base()
    if v == 0:
        for k, (z, sx, sy, sz) in enumerate([(.36, .64, .48, .21), (.66, .50, .39, .18), (.93, .35, .31, .16)]):
            x, y = rng.uniform(-.1, .1), rng.uniform(-.08, .08)
            rock('Balanced cairn stone', (x, y, z), (sx, sy, sz), twist=k*.64)
            moss((x, y, z+sz*.66), sx*.85, sy*.85, 6)
    elif v == 1:
        slab((0, 0, .37), .64, .50)
        block((.03, 0, .88), (.67, .55, .76), hole=True, rotation=-.05)
        slab((.03, 0, 1.37), .90, .70, .35, roof=True)
        rock('Roof finial', (.04, 0, 1.67), (.14, .13, .16))
    elif v == 2:
        for k in range(3):
            z = .50 + k*.77
            width = .74 - k*.14
            block((k*.04, 0, z+.19), (width*.78, width*.62, .50), hole=True)
            slab((k*.04, 0, z+.54), width, width*.83, .30, roof=True, rotation=k*.13)
        rock('Worn finial', (.08, 0, 2.74), (.13, .13, .19))
    elif v == 3:
        rock('Heavy lower stone', (-.06, .05, .47), (.67, .50, .31), twist=.3)
        slab((.06, -.04, .83), .78, .54, .17, rotation=.3)
        rock('Crooked middle boulder', (.13, .04, 1.17), (.49, .39, .30), twist=.8)
        moss((.16, .02, 1.36), .48, .37, 10)
        # Open arch supports between loose rock strata, like the reference.
        block((-.25, -.06, 1.69), (.23, .46, .43), rotation=.09)
        block((.30, -.02, 1.67), (.23, .46, .39), rotation=-.1)
        slab((.04, -.04, 1.96), .73, .53, .20, roof=True, rotation=-.08)
        rock('Upper uneven stone', (-.06, 0, 2.28), (.48, .35, .26), twist=-.3)
        moss((-.06, 0, 2.44), .45, .34, 7)
        block((-.10, 0, 2.73), (.44, .38, .46), hole=True, rotation=.12)
        slab((-.1, 0, 3.06), .59, .47, .25, roof=True, rotation=.12)
    else:
        slab((-.10, 0, .35), .56, .45, .19)
        chamber = block((-.16, .03, .79), (.54, .46, .67), hole=True, rotation=.12)
        chamber.rotation_euler.y = .18
        slab((-.19, .06, 1.16), .65, .54, .21, roof=True, rotation=.30)
        fallen = slab((.77, -.06, .21), .47, .38, .19, rotation=-.5)
        fallen.rotation_euler.y = -.28
        rock('Broken cap fragment', (.56, .2, .58), (.17, .13, .14))
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    tri = obj.modifiers.new('Export triangles', 'TRIANGULATE')
    bpy.ops.object.modifier_apply(modifier=tri.name)
    obj.data.materials.clear()
    obj.data.materials.append(material)
    for face in obj.data.polygons:
        face.material_index = 0
    # Check the exported palette coordinates, including faces from booleans.
    uv = obj.data.uv_layers.active.data
    for face in obj.data.polygons:
        values = [tuple(uv[i].uv) for i in face.loop_indices]
        assert all(abs(u-values[0][0])+abs(vv-values[0][1]) < 1e-6 for u, vv in values)
        u, vv = values[0]
        idx = (int(vv*h)*w+int(u*w))*4
        assert sum(epx[idx:idx+3]) < .005
    meshes.append(obj)

for img in images.values():
    img.pack()
bpy.ops.object.select_all(action='DESELECT')
for obj in meshes:
    obj.select_set(True)
export = ROOT / 'public/models/forest-stones.glb'
bpy.ops.export_scene.gltf(filepath=str(export), export_format='GLB', use_selection=True,
                         export_yup=True, export_materials='EXPORT', export_cameras=False, export_lights=False)
report = {'glb_bytes': export.stat().st_size, 'materials': [material.name], 'matte_swatches': SWATCHES,
          'variants': [{'name': o.name, 'triangles': len(o.data.polygons),
                        'dimensions': list(o.dimensions)} for o in meshes]}
(ROOT / 'assets/blender/forest-stones.stats.json').write_text(json.dumps(report, indent=2)+'\n')
print('STONE EXPORT', json.dumps(report))

# Authoring lineup and preview only, after the runtime export at local origins.
for i, obj in enumerate(meshes):
    obj.location.x = (i-2)*2.7
studio = bpy.data.collections.new('Preview studio — not exported')
bpy.context.scene.collection.children.link(studio)
world = bpy.data.worlds.new('Forest stone studio')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (.24, .29, .24, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = .5
bpy.context.scene.world = world
for name, p, energy, size in [('Key', (-3,-5,9), 1400, 7), ('Fill', (5,-2,6), 800, 6)]:
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size = energy, 'DISK', size
    obj = bpy.data.objects.new(name, data)
    studio.objects.link(obj)
    obj.location = p
    obj.rotation_euler = (Vector((0,0,1))-obj.location).to_track_quat('-Z','Y').to_euler()
cam_data = bpy.data.cameras.new('Lineup camera')
cam = bpy.data.objects.new('Lineup camera', cam_data)
studio.objects.link(cam)
cam_data.type, cam_data.ortho_scale = 'ORTHO', 15.5
cam.location = (5,-15,9)
cam.rotation_euler = (Vector((0,0,1.1))-cam.location).to_track_quat('-Z','Y').to_euler()
scene = bpy.context.scene
scene.camera = cam
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 1400, 650
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'AgX'
out = ROOT / 'output/forest-stones'
out.mkdir(parents=True, exist_ok=True)
scene.render.filepath = str(out / 'lineup.png')
bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = meshes[1]
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/blender/forest-stones.blend'))
