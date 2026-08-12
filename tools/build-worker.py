"""
Merge the construction worker's FBX pose clips (Mixamo) into ONE Draco GLB used
for the ambient workers on the two construction sites.

Run (no Blender window opens):
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python tools/build-worker.py

Same idea as tools/build-character.py: one WITH-SKIN file is the base (carries
the mesh + skeleton + bind pose); every other file's take is retargeted by WORLD
pose onto that base skeleton (rest-pose-independent, so arms don't collapse) and
becomes an animation named after the file. Unlike the player, the workers stand
still and just loop an ambient clip (idle / inspect / look), so all clips are
ambient — no locomotion/stride handling.

The base is auto-detected: the first file that imports with a mesh, preferring
"Warrior Idle.fbx". Output: public/models/worker.glb, one animation per clip.

Add a pose later: drop another Mixamo .fbx in assets/characters/worker/ and
re-run; it shows up as actions.<clean-name> for Worker to play.
"""
import bpy, os, sys, glob

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "assets/characters/worker")
OUT = os.path.join(ROOT, "public/models/worker.glb")
PREFER_BASE = "Warrior Idle.fbx"  # the standing idle makes the cleanest bind

# Filenames -> clean animation names the Worker component plays.
NAME_MAP = {
    "Warrior Idle": "idle",
    "Kneeling Inspecting": "inspect",
    "Look Around": "look",
    "Looking Around": "look2",
    "Standing Up": "standup",
    "Brutal To Happy Walking": "walk",
}

def log(*a): print("[build-worker]", *a)
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

def pick(acts, prefer=None):
    cands = sorted(acts, key=span, reverse=True)
    if prefer:
        named = [a for a in cands if prefer in a.name.lower()]
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
            pb.matrix = b2w @ (clip_arm.matrix_world @ cb.matrix)
            bpy.context.view_layer.update()
            pb.keyframe_insert("location", frame=f)
            pb.keyframe_insert("rotation_quaternion", frame=f)
            pb.keyframe_insert("scale", frame=f)
    return new

files = sorted(glob.glob(os.path.join(SRC, "*.fbx")))
if not files:
    log("ERROR: no fbx in", SRC); sys.exit(1)

# ---- pick the base: first import that yields a mesh, preferring Warrior Idle -
order = sorted(files, key=lambda p: 0 if os.path.basename(p) == PREFER_BASE else 1)
base_path = base_arm = mesh = base_acts = None
for p in order:
    objs, acts = import_fbx(p)
    arm = next((o for o in objs if o.type == 'ARMATURE'), None)
    msh = next((o for o in objs if o.type == 'MESH'), None)
    if arm and msh:
        base_path, base_arm, mesh, base_acts = p, arm, msh, acts
        break
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    for a in acts:
        bpy.data.actions.remove(a)

if not base_arm:
    log("ERROR: no fbx imported with a skinned mesh"); sys.exit(1)

base_name = clean(base_path)
idle_act = pick(base_acts)  # the longest take (T-pose is 1 frame)
idle_act.name = base_name
log("base file:", os.path.basename(base_path), "-> clip", base_name, "span", round(span(idle_act), 1))
for a in list(base_acts):
    if a is not idle_act:
        bpy.data.actions.remove(a)

final = {base_name}
base_arm.animation_data_create()
base_arm.animation_data.action = idle_act

# ---- every other fbx: retarget its take onto the base skeleton --------------
for path in files:
    if path == base_path:
        continue
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

for a in list(bpy.data.actions):
    a.use_fake_user = a.name in final
    if a.name not in final:
        bpy.data.actions.remove(a)
base_arm.animation_data.action = idle_act
bpy.context.scene.frame_set(int(idle_act.frame_range[0]))

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
