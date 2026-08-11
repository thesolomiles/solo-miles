"""
Merge a character's FBX exports (Mixamo, Meshy, Blender — doesn't matter) into
ONE Draco-compressed GLB for the town's player.

Run (no Blender window opens):
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python tools/build-character.py

Convention in assets/characters/playable character/:
  - idle.fbx   -> the WITH-SKIN base (carries the mesh + skeleton + bind pose).
                  Mixamo often bundles several takes here (T-pose, Idle, a long
                  Layer0); we pick the multi-frame take whose name says "idle".
  - *.fbx      -> every other file is a WITHOUT-SKIN clip; its longest take
                  becomes an animation named after the file (walk.fbx -> "walk").

Why retargeting (not just "copy the action"): the without-skin exports can have
a DIFFERENT rest pose than idle.fbx (e.g. straight T-pose arms vs the bind's
bent elbows). Pasting such an action straight onto the bind skeleton mis-poses
the arms and collapses the shoulders. So for every non-base clip we bake it onto
the base skeleton by WORLD pose (per frame, base bone matrix := clip bone
matrix), which is rest-pose-independent. The base's own take (idle) is authored
against the bind and is copied directly.

Output: public/models/character.glb, one animation per clip. No scale baked in
(Mixamo imports at ~2u here, already ~human) — RiggedFigure scales it.

Add a clip later (e.g. a cycling loop): drop cycle.fbx (Without Skin) in the
folder and re-run. It appears as actions.cycle in useAnimations.
"""
import bpy, os, sys, glob

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "assets/characters/playable character")
OUT = os.path.join(ROOT, "public/models/character.glb")
BASE = "idle.fbx"  # the one exported "With Skin"

def log(*a): print("[build-character]", *a)
def span(act): r = act.frame_range; return r[1] - r[0]

bpy.ops.wm.read_factory_settings(use_empty=True)

def import_fbx(path):
    before = set(bpy.data.objects)
    acts_before = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False)
    objs = [o for o in bpy.data.objects if o not in before]
    acts = [a for a in bpy.data.actions if a not in acts_before]
    return objs, acts

def pick(acts, prefer=None):
    """The real motion take: prefer a name match, else the longest."""
    cands = sorted(acts, key=span, reverse=True)
    if prefer:
        named = [a for a in cands if prefer in a.name.lower()]
        if named:
            return named[0]
    return cands[0] if cands else None

def hierarchy(arm):
    """Pose-bone names, parents before children (needed for matrix copy)."""
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
    """Bake clip_arm's world pose onto base_arm as a new action `name`."""
    clip_arm.animation_data_create()
    clip_arm.animation_data.action = clip_action
    fs, fe = int(clip_action.frame_range[0]), int(clip_action.frame_range[1])

    new = bpy.data.actions.new(name)
    base_arm.animation_data_create()
    base_arm.animation_data.action = new

    order = hierarchy(base_arm)
    clip_pb = clip_arm.pose.bones
    base_pb = base_arm.pose.bones
    for f in range(fs, fe + 1):
        bpy.context.scene.frame_set(f)
        b2w = base_arm.matrix_world.inverted()
        for bname in order:
            cb = clip_pb.get(bname)
            if cb is None:
                continue
            pb = base_pb[bname]
            # match world pose, expressed in base armature space
            pb.matrix = b2w @ (clip_arm.matrix_world @ cb.matrix)
            bpy.context.view_layer.update()  # so children see the new parent
            pb.keyframe_insert("location", frame=f)
            pb.keyframe_insert("rotation_quaternion", frame=f)
            pb.keyframe_insert("scale", frame=f)
    return new

# ---- base (with skin) ------------------------------------------------------
base_path = os.path.join(SRC, BASE)
if not os.path.exists(base_path):
    log("ERROR: missing base", base_path); sys.exit(1)

base_objs, base_acts = import_fbx(base_path)
base_arm = next((o for o in base_objs if o.type == 'ARMATURE'), None)
mesh = next((o for o in base_objs if o.type == 'MESH'), None)
if not base_arm or not mesh:
    log("ERROR: base has no armature/mesh"); sys.exit(1)

base_name = os.path.splitext(BASE)[0]
idle_act = pick(base_acts, prefer=base_name)
idle_act.name = base_name
log("base take:", idle_act.name, "span", round(span(idle_act), 1))
for a in base_acts:            # drop the bundled T-pose / junk takes
    if a is not idle_act:
        bpy.data.actions.remove(a)

final = {base_name}
base_arm.animation_data_create()
base_arm.animation_data.action = idle_act

# ---- every other fbx: retarget onto the base skeleton ----------------------
for path in sorted(glob.glob(os.path.join(SRC, "*.fbx"))):
    if os.path.basename(path) == BASE:
        continue
    name = os.path.splitext(os.path.basename(path))[0]
    objs, acts = import_fbx(path)
    clip_arm = next((o for o in objs if o.type == 'ARMATURE'), None)
    chosen = pick(acts)
    baked = retarget(base_arm, clip_arm, chosen, name)
    final.add(baked.name)
    log("clip", name, "<- retargeted from", chosen.name, "span", round(span(chosen), 1))
    for a in acts:             # drop the raw (un-retargeted) takes
        bpy.data.actions.remove(a)
    for o in objs:             # discard the throwaway armature/mesh
        bpy.data.objects.remove(o, do_unlink=True)

# keep every final action alive on export; rest on idle
for a in list(bpy.data.actions):
    a.use_fake_user = a.name in final
    if a.name not in final:
        bpy.data.actions.remove(a)
base_arm.animation_data.action = idle_act
bpy.context.scene.frame_set(int(idle_act.frame_range[0]))

log("final actions:", sorted(a.name for a in bpy.data.actions))
log("height(bu):", round(mesh.dimensions.z, 3))

# ---- export ----------------------------------------------------------------
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB',
    export_animation_mode='ACTIONS', export_animations=True,
    export_nla_strips=False, export_skins=True, export_yup=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
)
log("WROTE", OUT, round(os.path.getsize(OUT) / 1024, 1), "KB")
