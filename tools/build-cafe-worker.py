"""
Merge the café worker's FBX exports into ONE Draco GLB for the two ambient
baristas behind the café counter.

Run (no Blender window opens):
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python tools/build-cafe-worker.py

This is the build-character.py pipeline (not build-worker.py): the café worker is
the pink-dress IK-rig character (Base.001 family), so its clips carry Mixamo
forward root motion that MUST be removed — the controller (CafeWorker.tsx) owns
the barista's position, so a clip that also travels makes the mesh glide/drift.
retarget() bakes each clip onto the base skeleton by WORLD pose (rest-pose
independent) AND subtracts the per-frame Pelvis drift so the walk cycles IN
PLACE. (build-worker.py did neither and additionally mislabelled a bundled Idle
take as "walk" — hence the earlier drifting-not-walking bug.)

The skinned mesh lives in "Female Walk.fbx" (auto-detected as the base: the first
file that imports with a mesh). Every file's REAL motion take is the Mixamo
`...|mixamo.com|Layer0` one — the same file also bundles junk Idle/T-pose/Walk.0*
takes, so pick() prefers the "mixamo" take, else the longest. The base file is
also re-imported as a throwaway clip source so its walk becomes a normal
retargeted, in-place, exported action like the rest.

Output: public/models/cafe-worker.glb, one animation per clip
(walk/idle/bartend/talk/look/react). Add a pose later: drop another Mixamo .fbx
in assets/characters/cafe-worker/ and re-run.
"""
import bpy, os, sys, glob
from mathutils import Vector

# One of these Mixamo FBX carries a stray light node, and Blender 5.2's FBX
# importer crashes reading it (`CyclesLightSettings` has no `cast_shadow`).
# We throw all non-mesh/armature objects away anyway, so stub the light reader
# to hand back a plain point light and skip the buggy path.
import io_scene_fbx.import_fbx as _imp_fbx
def _safe_read_light(fbx_tmpl, fbx_obj, settings):
    return bpy.data.lights.new(name="fbx_light", type='POINT')
_imp_fbx.blen_read_light = _safe_read_light

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "assets/characters/cafe-worker")
OUT = os.path.join(ROOT, "public/models/cafe-worker.glb")

# Filenames -> clean animation names the CafeWorker component plays.
NAME_MAP = {
    "Female Walk": "walk",
    "idle": "idle",
    "Bartending": "bartend",     # loop: making a drink behind the counter
    "Talking": "talk",           # loop: chatting to a customer
    "Looking Around": "look",    # loop: glancing around the room
    "Reacting": "react",         # loop: a little reaction beat
}

def log(*a): print("[build-cafe-worker]", *a)
def span(act): r = act.frame_range; return r[1] - r[0]
def clean(path):
    base = os.path.splitext(os.path.basename(path))[0]
    return NAME_MAP.get(base, base.lower().replace(" ", "-"))

bpy.ops.wm.read_factory_settings(use_empty=True)

def import_fbx(path):
    before = set(bpy.data.objects)
    acts_before = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False)
    objs = [o for o in bpy.data.objects if o not in before]
    acts = [a for a in bpy.data.actions if a not in acts_before]
    return objs, acts

def pick(acts, prefer="mixamo"):
    """The real motion take: prefer the Mixamo take (files bundle junk
    Idle/T-pose/Walk.0* takes alongside it), else the longest."""
    cands = sorted(acts, key=span, reverse=True)
    if prefer:
        named = [a for a in cands if prefer in a.name.lower() and span(a) > 0]
        if named:
            return named[0]
    return cands[0] if cands else None

def hierarchy(arm):
    order = []
    def visit(b):
        order.append(b.name)
        for c in b.children:
            visit(c)
    for pb in arm.pose.bones:
        if pb.parent is None:
            visit(pb)
    return order

def retarget(base_arm, clip_arm, clip_action, name):
    """Bake clip_arm's world pose onto base_arm as a new action `name`, with the
    Pelvis horizontal drift removed each frame so the clip plays IN PLACE (the
    controller owns position). Same method as build-character.py — see its
    docstring for why we shift the whole skeleton rather than pin a bone."""
    clip_arm.animation_data_create()
    clip_arm.animation_data.action = clip_action
    fs, fe = int(clip_action.frame_range[0]), int(clip_action.frame_range[1])

    new = bpy.data.actions.new(name)
    base_arm.animation_data_create()
    base_arm.animation_data.action = new

    order = hierarchy(base_arm)
    clip_pb = clip_arm.pose.bones
    base_pb = base_arm.pose.bones

    hips = next((clip_pb.get(n) for n in ("Hips", "Pelvis") if clip_pb.get(n)), None)
    anchor = None
    if hips is not None:
        bpy.context.scene.frame_set(fs)
        w = (clip_arm.matrix_world @ hips.matrix).translation
        anchor = (w.x, w.y)

    for f in range(fs, fe + 1):
        bpy.context.scene.frame_set(f)
        dx = dy = 0.0
        if anchor is not None:
            w = (clip_arm.matrix_world @ hips.matrix).translation
            dx, dy = w.x - anchor[0], w.y - anchor[1]
        b2w = base_arm.matrix_world.inverted()
        for bname in order:
            cb = clip_pb.get(bname)
            if cb is None:
                continue
            pb = base_pb[bname]
            world = (clip_arm.matrix_world @ cb.matrix).copy()
            t = world.translation
            world.translation = Vector((t.x - dx, t.y - dy, t.z))  # de-drift, keep vertical
            pb.matrix = b2w @ world
            bpy.context.view_layer.update()
            pb.keyframe_insert("location", frame=f)
            pb.keyframe_insert("rotation_quaternion", frame=f)
            pb.keyframe_insert("scale", frame=f)
    return new

files = sorted(glob.glob(os.path.join(SRC, "*.fbx")))
if not files:
    log("ERROR: no fbx in", SRC); sys.exit(1)

# ---- base: the first file that imports with a skinned mesh (Female Walk) -----
base_path = base_arm = mesh = None
for p in files:
    objs, acts = import_fbx(p)
    arm = next((o for o in objs if o.type == 'ARMATURE'), None)
    msh = next((o for o in objs if o.type == 'MESH'), None)
    if arm and msh:
        base_path, base_arm, mesh = p, arm, msh
        for a in list(acts):  # drop the base file's bundled takes; its walk is
            bpy.data.actions.remove(a)  # retargeted fresh in the clip loop below
        break
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    for a in acts:
        bpy.data.actions.remove(a)

if not base_arm:
    log("ERROR: no fbx imported with a skinned mesh"); sys.exit(1)
log("base file:", os.path.basename(base_path))

# ---- every file (incl. the base): retarget its real take, in place ----------
final = set()
for path in files:
    name = clean(path)
    objs, acts = import_fbx(path)
    clip_arm = next((o for o in objs if o.type == 'ARMATURE'), None)
    chosen = pick(acts)
    if clip_arm and chosen:
        baked = retarget(base_arm, clip_arm, chosen, name)
        final.add(baked.name)
        log("clip", name, "<- retargeted from", chosen.name, "span", round(span(chosen), 1))
    else:
        log("skip", name, "(no armature/take)")
    for a in list(acts):
        bpy.data.actions.remove(a)
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)

# keep every final action alive on export; rest on idle (or the first clip)
rest = "idle" if "idle" in final else sorted(final)[0]
for a in list(bpy.data.actions):
    a.use_fake_user = a.name in final
    if a.name not in final:
        bpy.data.actions.remove(a)
base_arm.animation_data.action = bpy.data.actions[rest]
bpy.context.scene.frame_set(int(bpy.data.actions[rest].frame_range[0]))

log("final actions:", sorted(a.name for a in bpy.data.actions))
log("height(bu):", round(mesh.dimensions.z, 3))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB',
    export_animation_mode='ACTIONS', export_animations=True,
    export_nla_strips=False, export_skins=True, export_yup=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
)
log("WROTE", OUT, round(os.path.getsize(OUT) / 1024, 1), "KB")
