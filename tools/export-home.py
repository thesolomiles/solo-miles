"""
Export the home interior (~/Desktop/blender/home.blend, collection `Home`) to
public/models/home.glb. Run inside Blender (Text editor, or the MCP:
exec(open('/Users/leonardgoh/Desktop/solo-miles/tools/export-home.py').read())).

Everything is baked into a few meshes so the room stays a handful of draw calls:
  HomeMerged  every opaque palette object
  HomeGlass   SW_glass*  (Blender `Glass` material → three's shared glass)
  HomeShadow  SW_shadow* (drawn invisibly; casts the window-bar shadows only)
  TT_Platter / TT_Arm / TT_Cone_L / TT_Cone_R
              the turntable's moving parts, one mesh per `*Pivot` empty, with the
              node's origin at the pivot so three/Turntable.tsx can spin / swing /
              pulse them.
"""
import bpy, bmesh
from mathutils import Matrix

OUT = '/Users/leonardgoh/Desktop/solo-miles/public/models/home.glb'
PIVOTS = {
    'TT_PlatterPivot': 'TT_Platter',
    'TT_ArmPivot': 'TT_Arm',
    'TT_ConePivot_L': 'TT_Cone_L',
    'TT_ConePivot_R': 'TT_Cone_R',
}

home = bpy.data.collections['Home']
meshes = [o for o in home.all_objects if o.type == 'MESH' and o.visible_get()]


def group_of(o):
    """(group name, pivot empty or None) for a mesh object."""
    p = o.parent
    while p:
        if p.name in PIVOTS:
            return PIVOTS[p.name], p
        p = p.parent
    if o.name.startswith('SW_glass'):
        return 'HomeGlass', None
    if o.name.startswith('SW_shadow'):
        return 'HomeShadow', None
    return 'HomeMerged', None


groups = {}
for o in meshes:
    name, pivot = group_of(o)
    groups.setdefault(name, (pivot, []))[1].append(o)

tmp = bpy.data.meshes.new('__export_tmp')
made = []
for name, (pivot, objs) in groups.items():
    base = pivot.matrix_world if pivot else Matrix.Identity(4)
    inv = base.inverted()
    bm = bmesh.new()
    for o in objs:
        part = bmesh.new()
        part.from_mesh(o.data)
        part.transform(inv @ o.matrix_world)
        part.to_mesh(tmp)
        part.free()
        bm.from_mesh(tmp)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.material_index = 0
        p.use_smooth = False
    me.materials.append(objs[0].data.materials[0])
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.matrix_world = base
    made.append(ob)
bpy.data.meshes.remove(tmp)

bpy.ops.object.select_all(action='DESELECT')
for ob in made:
    ob.select_set(True)
bpy.context.view_layer.objects.active = made[0]
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
)
for ob in made:
    me = ob.data
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.meshes.remove(me)
print('exported', {n: len(g[1]) for n, g in groups.items()})
