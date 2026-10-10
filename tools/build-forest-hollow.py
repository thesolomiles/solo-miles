"""Authored eroded trail hollow, using the existing packed Imphenzia material.
Blender --background --factory-startup --python tools/build-forest-hollow.py
Coordinates in helpers are glTF/world (X along trail, Y up, Z toward camera).
The exported centre is placed at the configured gap centre, with identity nodes.
"""
import json
import math
from pathlib import Path
import random
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
with bpy.data.libraries.load(str(ROOT/'assets/blender/forest-skull.blend'), link=False) as (src, dst):
    dst.materials = ['Material.004']
mat = bpy.data.materials['Material.004']
images = {}
for node in mat.node_tree.nodes:
    if node.type == 'TEX_IMAGE':
        node.interpolation = 'Closest'
        images[Path(node.image.filepath).name] = node.image
ap, ep = images['ImphenziaPalette02-Albedo.png'], images['ImphenziaPalette02-Emission.png']
a, e = list(ap.pixels), list(ep.pixels)
w, h = ap.size
rng = random.Random(5210)

def swatch(rgb):
    best = min((sum((a[(y*w+x)*4+k]-rgb[k])**2 for k in range(3)), x, y)
        for y in range(8,h,16) for x in range(8,w,16) if sum(e[(y*w+x)*4:(y*w+x)*4+3]) < .005)
    _, x, y = best
    return ((x+.5)/w, (y+.5)/h)

UV = {k:swatch(v) for k,v in {
    'earth':(.40,.30,.18), 'earth_light':(.49,.37,.23), 'earth_dark':(.29,.23,.15),
    'loam':(.23,.21,.13), 'dust':(.51,.40,.25), 'dust_dark':(.41,.34,.22),
    'stone':(.38,.43,.35), 'stone_dark':(.28,.32,.27), 'stone_light':(.48,.50,.40),
    'root':(.31,.23,.14), 'root_light':(.39,.29,.17),
    'moss':(.29,.41,.12), 'moss_light':(.39,.48,.16), 'moss_dark':(.18,.29,.09),
    'leaf':(.36,.29,.13), 'leaf_dark':(.25,.28,.10),
}.items()}
coll = bpy.data.collections.new('Forest hollow — export')
bpy.context.scene.collection.children.link(coll)
parts = {k:[] for k in ['HollowEarth','HollowFloor','HollowRoots','HollowMoss','HollowStones']}

def coord(p): return (p[0], -p[2], p[1])
def finish(obj, group, tones):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    coll.objects.link(obj)
    obj.data.materials.clear(); obj.data.materials.append(mat)
    obj.data.update()
    for layer in list(obj.data.uv_layers): obj.data.uv_layers.remove(layer)
    uv = obj.data.uv_layers.new(name='Palette')
    for face in obj.data.polygons:
        face.use_smooth = False
        tone = rng.choice(tones)
        if group == 'HollowEarth':
            height = (obj.matrix_world @ face.center).z
            tone = 'loam' if height > -.18 else 'earth_dark' if height < -1.9 else 'earth'

        for i in face.loop_indices: uv.data[i].uv = UV[tone]
    parts[group].append(obj)
    return obj

def mesh(name, verts, faces, group, tones):
    data=bpy.data.meshes.new(name); data.from_pydata([coord(v) for v in verts], [], faces); data.update()
    obj=bpy.data.objects.new(name,data);coll.objects.link(obj)
    return finish(obj,group,tones)

def grid(name, rows, group, tones):
    n=len(rows[0]); vertices=[v for row in rows for v in row]; faces=[]
    for j in range(len(rows)-1):
        for i in range(n-1):
            p=j*n+i
            if (i+j)%2: faces += [(p,p+1,p+n),(p+1,p+n+1,p+n)]
            else: faces += [(p,p+1,p+n+1),(p,p+n+1,p+n)]
    return mesh(name,vertices,faces,group,tones)

def rock(p, scale, group='HollowStones', tones=('stone','stone','stone_dark','stone_light')):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=coord(p))
    obj=bpy.context.object
    for v in obj.data.vertices: v.co *= rng.uniform(.84,1.12)
    obj.scale=(scale[0],scale[2],scale[1]);obj.rotation_euler.z=rng.uniform(0,math.tau)
    return finish(obj,group,tones)

def root(points, radius):
    # Tapered, bent roots with continuous polygonal rings and split tips.
    pts=[Vector(coord(p)) for p in points];verts=[];faces=[];sides=6
    for i,p in enumerate(pts):
        tangent=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized()
        axis=tangent.cross(Vector((0,0,1)))
        if axis.length < .01: axis=tangent.cross(Vector((1,0,0)))
        axis.normalize();other=tangent.cross(axis).normalized()
        r=radius*(1-.87*i/(len(pts)-1))
        for k in range(sides):
            theta=k*math.tau/sides;verts.append(tuple(p+r*(axis*math.cos(theta)+other*math.sin(theta))))
    for i in range(len(pts)-1):
        for k in range(sides):
            p=i*sides+k;q=i*sides+(k+1)%sides;faces.append((p,q,q+sides,p+sides))
    data=bpy.data.meshes.new('Tapered root');data.from_pydata(verts,[],faces);data.update()
    obj=bpy.data.objects.new('Exposed branching root',data);coll.objects.link(obj)
    return finish(obj,'HollowRoots',('root','root','root_light'))

# The walking edges are x = +/-3.4, floor Y=-2.4. Decorations stay outside
# the path's clear central strip; the rim's roughness is chiefly off the walk.
zrows=[-4.65,-4.15,-3.55,-2.85,-2.1,-1.3,-.6,0,.6,1.3,2.2,3.3,4.6,6,8,11,16,25,45]
for side in [-1,1]:
    profiles=[]
    for level,y in enumerate([.04,-.18,-.55,-1.05,-1.62,-2.4]):
        row=[]
        for i,z in enumerate(zrows):
            off=.10*math.sin(z*2.3+side)+.08*math.sin(z*4.2)
            # Almost straight where feet take off, visibly ragged away from z=0.
            fade=min(1,abs(z)/1.5)
            lip=3.4+off*fade
            extension=[0,-.04,-.07,-.10,-.12,-.14][level]
            extension *= min(1, abs(z)/1.3) if abs(z) > .8 else .13
            x=side*(lip+extension)
            yy=y+(rng.uniform(-.035,.035) if level not in [0,5] else .07*math.sin(z*2.1) if level == 0 else 0)
            row.append((x,yy,z))
        profiles.append(row)
    # Faces point inward; Blender will recalculate normals after joining.
    grid('Crumbly layered bank',profiles,'HollowEarth',('earth','earth','earth_light','earth_dark'))
    # Ragged turf overhang and dark organic topsoil beneath it.
    top=[[(side*(3.4+1.2),-.02,z) for z in zrows],profiles[0]]
    grid('Broken turf lip',top,'HollowEarth',('loam','earth_dark'))
    for i,z in enumerate(zrows[:14]):
        x=side*(3.65+.08*math.sin(z*2.3))
        rock((x,.03,z),(.44+rng.random()*.18,.10+rng.random()*.07,.30+rng.random()*.25),
             'HollowMoss',('moss','moss','moss_dark','moss_light'))
        if i%2==0:
            points=[(side*4.0,.04,z-.2),(side*3.38,-.08,z),(side*3.31,-.44,z+.13),
                    (side*3.21,-.90,z+.08),(side*3.10,-1.25,z+.28)]
            root(points,.07+rng.random()*.035)
            root([points[2],(side*3.24,-.62,z+.44),(side*3.13,-.87,z+.69)],.034)

# Scooped far bank: a slope of exposed soil, not a rectangular retaining wall.
xs=[-4.6,-4.0,-3.4,-2.9,-2.3,-1.7,-1.1,-.5,.1,.7,1.3,1.9,2.5,3.1,3.7,4.6]
rows=[]
for j,(y,z) in enumerate([(.03,-4.7),(-.24,-4.05),(-.75,-3.45),(-1.36,-2.94),(-1.92,-2.4),(-2.4,-1.75)]):
    row=[]
    for i,x in enumerate(xs):
        wav=.14*math.sin(x*2.8)+.09*math.cos(x*4.7)
        row.append((x,y+(rng.uniform(-.035,.035) if j not in [0,5] else .075*math.sin(x*3.2) if j == 0 else 0),z+wav+1.2*min(1.35,(x/3.4)**2)*(1-j/5)))
    rows.append(row)
grid('Eroded far bank',rows,'HollowEarth',('earth','earth','earth_light','earth_dark'))
for i in range(16):
    x=-4.3+i*.56
    rock((x,.03,-4.6+.15*math.sin(x*2.8)+1.2*min(1.35,(x/3.4)**2)),(.40,.12,.34),'HollowMoss',('moss','moss_dark','moss_light'))
for x in [-2.7,-1.3,.8,2.5]:
    bend=1.2*(x/3.4)**2
    pts=[(x,.03,-4.8+bend),(x+.14,-.18,-4.15+bend*.8),(x-.05,-.65,-3.52+bend*.6),
         (x+.22,-1.05,-3.15),(x+.40,-1.38,-2.90)]
    root(pts,.105)
    root([pts[2],(x-.32,-.94,-3.18),(x-.63,-1.1,-3.02)],.035)

# Quiet, dry bed. Keep feet on one clean plane along the actual walking line.
floorxs=[-3.7,-3.1,-2.5,-1.9,-1.3,-.7,0,.7,1.3,1.9,2.5,3.1,3.7]
floorz=[-2.15,-1.3,-.7,0,.7,1.3,2.2,3.2,4.8,7,11,18,30,45]
rows=[]
for z in floorz:
    row=[]
    for x in floorxs:
        y=-2.4 if abs(z)<.71 else -2.42+rng.uniform(-.10,.015)
        row.append((x,y,z))
    rows.append(row)
grid('Dry compacted hollow bed',rows,'HollowFloor',('dust','dust','dust','dust_dark'))
for i in range(45):
    side=-1 if i%2 else 1
    x=side*rng.uniform(2.55,3.5);z=rng.uniform(-1.5,7.5)
    s=rng.uniform(.07,.24)
    rock((x,-2.4+s*.32,z),(s*1.4,s*.7,s),tones=('stone','earth_dark','stone_dark'))
for i in range(32):
    x=rng.uniform(-3.2,3.2);z=rng.choice([-1,1])*rng.uniform(.8,2.1)
    s=rng.uniform(.055,.11)
    mesh('Fallen leaf',[(x-s,-2.38,z),(x,-2.36,z-s*.5),(x+s,-2.38,z),(x,-2.36,z+s*.5)],
         [(0,1,2),(0,2,3)],'HollowFloor',('leaf','leaf_dark'))

meshes=[]
for name, objects in parts.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join();obj=bpy.context.object;obj.name=name
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    # Recalculate normals and triangulate; all palette islands stay collapsed.
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
    tri=obj.modifiers.new('Export triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
    obj.data.materials.clear();obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.material_index=0
        vals=[tuple(obj.data.uv_layers.active.data[i].uv) for i in face.loop_indices]
        assert all(abs(u-vals[0][0])+abs(v-vals[0][1])<1e-6 for u,v in vals)
        u,v=vals[0];idx=(int(v*h)*w+int(u*w))*4
        assert sum(e[idx:idx+3])<.005
    meshes.append(obj)
for image in images.values():image.pack()
bpy.ops.object.select_all(action='DESELECT')
for obj in meshes:obj.select_set(True)
export=ROOT/'public/models/forest-hollow.glb'
bpy.ops.export_scene.gltf(filepath=str(export),export_format='GLB',use_selection=True,export_yup=True,
                         export_materials='EXPORT',export_cameras=False,export_lights=False)
report={'glb_bytes':export.stat().st_size,'material':mat.name,'matte_swatches':UV,
        'meshes':[{'name':obj.name,'triangles':len(obj.data.polygons)} for obj in meshes]}
(ROOT/'assets/blender/forest-hollow.stats.json').write_text(json.dumps(report,indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/forest-hollow.blend'))
print('HOLLOW EXPORT',json.dumps(report))
