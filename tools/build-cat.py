"""
Bake the town's pet cat (a single skinned Meshy FBX + its PBR texture set) into
ONE Draco-compressed GLB with its walk clip and materials wired up.

Run (no Blender window opens):
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python tools/build-cat.py

Convention in assets/characters/pet cat/:
  - one *.fbx  -> the WITH-SKIN model; carries mesh + skeleton + a walk take.
  - *_texture_0.png            -> base colour (sRGB)
  - *_texture_0_normal.png     -> tangent-space normal map
  - *_texture_0_roughness.png  -> roughness
  - *_texture_0_metallic.png   -> metallic

Meshy exports the FBX with its material nodes stripped, so we rebuild a
Principled BSDF from the four PNGs and re-hook it. The maps come in at 4K; the
cat is a thumbnail on screen, so we cap each at 1024 to keep the GLB small.
The single animation take is renamed "walk" to match the component's clip name.

Output: public/models/cat.glb — one animation ("walk"), embedded textures,
normalised to ~TARGET_H units tall so the Cat component needs no magic scale.
"""
import bpy, os, sys, glob, mathutils

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "assets/characters/pet cat")
OUT = os.path.join(ROOT, "public/models/cat.glb")
TEX_MAX = 1024  # longest edge for any baked texture
TARGET_H = 0.6  # town-units tall to normalise the cat to (Meshy imports tiny)

def log(*a): print("[build-cat]", *a)
def span(act): r = act.frame_range; return r[1] - r[0]

bpy.ops.wm.read_factory_settings(use_empty=True)

# ---- locate source files ---------------------------------------------------
fbxs = glob.glob(os.path.join(SRC, "*.fbx"))
if not fbxs:
    log("ERROR: no .fbx in", SRC); sys.exit(1)
fbx = sorted(fbxs)[0]
log("fbx:", os.path.basename(fbx))

def find_tex(*suffixes):
    """First PNG whose name ends with one of `suffixes` (before .png)."""
    for p in sorted(glob.glob(os.path.join(SRC, "*.png"))):
        stem = os.path.splitext(os.path.basename(p))[0]
        if any(stem.endswith(s) for s in suffixes):
            return p
    return None

# base colour is the _texture_0 that is NOT one of the suffixed maps
base_tex = None
for p in sorted(glob.glob(os.path.join(SRC, "*_texture_0.png"))):
    base_tex = p; break
tex = {
    "base": base_tex,
    "roughness": find_tex("_roughness"),
    "metallic": find_tex("_metallic"),
    "normal": find_tex("_normal"),
}
log("textures:", {k: os.path.basename(v) if v else None for k, v in tex.items()})

# ---- import ----------------------------------------------------------------
before = set(bpy.data.objects)
bpy.ops.import_scene.fbx(filepath=fbx, automatic_bone_orientation=False)
objs = [o for o in bpy.data.objects if o not in before]
arm = next((o for o in objs if o.type == 'ARMATURE'), None)
mesh = next((o for o in objs if o.type == 'MESH'), None)
if not mesh:
    log("ERROR: fbx has no mesh"); sys.exit(1)

# Meshy exports at cm scale (~0.004u tall). Normalise to TARGET_H by uniformly
# scaling the rig's root object — object-level uniform scale rides through to the
# skinned mesh and the pose animation, so the walk clip stays intact (no apply).
bpy.context.view_layer.update()
def world_height(o):
    bb = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
    return max(v.z for v in bb) - min(v.z for v in bb)
h = world_height(mesh)
# The glTF exporter renders a skinned mesh in its armature's space and ignores
# the armature object's own scale, so scaling the armature is lost on export.
# Instead parent the whole rig under an Empty and scale THAT — a plain node whose
# transform the exporter honours, leaving the skeleton + walk clip untouched.
pivot = bpy.data.objects.new("cat_root", None)
bpy.context.scene.collection.objects.link(pivot)
for o in objs:
    if o.parent is None:
        o.parent = pivot
        o.matrix_parent_inverse = pivot.matrix_world.inverted()
if h > 0:
    pivot.scale = (TARGET_H / h,) * 3
bpy.context.view_layer.update()
log("normalised via cat_root -> mesh height now", round(world_height(mesh), 4))

# ---- material from the PNG maps --------------------------------------------
def load_img(path, non_color):
    img = bpy.data.images.load(path)
    if non_color:
        img.colorspace_settings.name = 'Non-Color'
    w, h = img.size
    if max(w, h) > TEX_MAX:
        s = TEX_MAX / max(w, h)
        img.scale(max(1, int(w * s)), max(1, int(h * s)))
    return img

mat = bpy.data.materials.new("cat")
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes.get("Principled BSDF")

def tex_node(path, non_color, y):
    n = nt.nodes.new("ShaderNodeTexImage")
    n.image = load_img(path, non_color)
    n.location = (-700, y)
    return n

if tex["base"]:
    nt.links.new(tex_node(tex["base"], False, 300).outputs["Color"], bsdf.inputs["Base Color"])
if tex["roughness"]:
    nt.links.new(tex_node(tex["roughness"], True, 0).outputs["Color"], bsdf.inputs["Roughness"])
if tex["metallic"]:
    nt.links.new(tex_node(tex["metallic"], True, -300).outputs["Color"], bsdf.inputs["Metallic"])
if tex["normal"]:
    nmap = nt.nodes.new("ShaderNodeNormalMap")
    nmap.location = (-400, -600)
    nt.links.new(tex_node(tex["normal"], True, -600).outputs["Color"], nmap.inputs["Color"])
    nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])

mesh.data.materials.clear()
mesh.data.materials.append(mat)

# ---- animation: keep the longest take, name it "walk" ----------------------
acts = sorted(bpy.data.actions, key=span, reverse=True)
if acts:
    walk = acts[0]
    walk.name = "walk"
    walk.use_fake_user = True
    for a in acts[1:]:
        bpy.data.actions.remove(a)
    if arm:
        arm.animation_data_create()
        arm.animation_data.action = walk
        bpy.context.scene.frame_set(int(walk.frame_range[0]))
    log("walk span:", round(span(walk), 1))
else:
    log("WARNING: no animation take found")

log("dims(bu):", tuple(round(d, 3) for d in mesh.dimensions))

# ---- export ----------------------------------------------------------------
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB',
    export_animation_mode='ACTIONS', export_animations=True,
    export_nla_strips=False, export_skins=True, export_yup=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
)
log("wrote", OUT)
