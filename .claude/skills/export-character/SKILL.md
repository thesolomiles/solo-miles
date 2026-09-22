---
name: export-character
description: >-
  Export a character — or any collection — from Blender to FBX for the
  solo-miles project, using the project's fixed FBX export settings. Use this
  whenever the user wants a .fbx out of Blender: "export this character",
  "export the george collection", "export as fbx", "export <name> from
  blender", or after finishing edits on a character and it needs to leave
  Blender. The file is named after the collection and always written to
  /Users/leonardgoh/Desktop/blender/. Do NOT hand-pick FBX options each time or
  use the generic export_scene MCP tool for characters — those miss these exact
  settings (rig, animation, axis, unit scaling) the project depends on.
---

# Blender character → FBX export

Exports one collection's objects to
`/Users/leonardgoh/Desktop/blender/<collection>.fbx` with the project's fixed
FBX settings. Driven through the Blender MCP (`execute_blender_code`).

## Rules

- **Filename = collection name.** Export the `george` collection →
  `/Users/leonardgoh/Desktop/blender/george.fbx`. Spaces in the collection name
  are kept as-is unless the user says otherwise.
- **Output dir is always** `/Users/leonardgoh/Desktop/blender/` (created if
  missing). Never write the FBX into the project repo.
- **Selection-based, and the ARMATURE must be selected too.** The exporter runs
  with `use_selection=True`. Select the character mesh **and its armature (the
  rig)** — if only the mesh is selected, the rig (bones + skin weights) does not
  export. Use `collection.all_objects` for the collection's own objects, and
  also add each mesh's `ARMATURE` modifier target in case the rig lives in a
  different collection.
- **The collection must be visible in the view layer.** If the target
  collection is *excluded* or *hidden in viewport* (the checkbox / eye toggle in
  the outliner), the exporter writes an essentially empty ~4 KB file with **no
  rig and no textures**, even though the objects report as selected. Always
  un-exclude and un-hide the collection first, and clear each object's
  `hide_get`/`hide_select`. Sanity-check the output size afterward.
- If the user doesn't name a collection, use the one just being worked on;
  if ambiguous, ask which collection.

## The settings (match exactly)

These mirror the FBX export panel the project uses. Enum ids are for Blender
5.2; `object_types` includes every type (the panel's "Lamp" is the `LIGHT` id).

| Panel field | Value | Operator arg |
|---|---|---|
| Path Mode | Copy | `path_mode='COPY'` |
| Embed Textures | ✓ | `embed_textures=True` |
| Batch Mode | Off | `batch_mode='OFF'` |
| Limit to → Selected Objects | ✓ | `use_selection=True` |
| Limit to → Visible Objects | ✗ | `use_visible=False` |
| Limit to → Active Collection | ✗ | `use_active_collection=False` |
| Object Types | all | `object_types={'EMPTY','CAMERA','LIGHT','ARMATURE','MESH','OTHER'}` |
| Custom Properties | ✗ | `use_custom_props=False` |
| Scale | 1.00 | `global_scale=1.0` |
| Apply Scalings | FBX Units Scale | `apply_scale_options='FBX_SCALE_UNITS'` |
| Forward | Y Forward | `axis_forward='Y'` |
| Up | Z Up | `axis_up='Z'` |
| Apply Unit | ✓ | `apply_unit_scale=True` |
| Use Space Transform | ✓ | `use_space_transform=True` |
| Apply Transform | ✗ | `bake_space_transform=False` |
| Animation | ✗ | `bake_anim=False` |

## Run it

Set `COLLECTION` and run via `execute_blender_code`:

```python
import bpy, os

COLLECTION = "george"                       # <-- collection to export
OUT_DIR    = "/Users/leonardgoh/Desktop/blender"

# resolve collection (exact, then case-insensitive)
coll = bpy.data.collections.get(COLLECTION) or next(
    (c for c in bpy.data.collections if c.name.lower() == COLLECTION.lower()), None)
if coll is None:
    raise ValueError(f"No collection named {COLLECTION!r}. "
                     f"Have: {[c.name for c in bpy.data.collections]}")

vl = bpy.context.view_layer

# 1) A hidden/excluded collection exports NOTHING (empty ~4 KB fbx, no rig, no
#    textures). Make this collection visible in the active view layer first.
def _find_lc(lc):
    if lc.collection == coll:
        return lc
    for c in lc.children:
        r = _find_lc(c)
        if r:
            return r
    return None
lc = _find_lc(vl.layer_collection)
if lc:
    lc.exclude = False
    lc.hide_viewport = False

# 2) Object Mode, then select the character mesh(es) AND their armature(s).
if bpy.context.object and bpy.context.object.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT')

objs = list(coll.all_objects)               # collection's own objects
for o in list(objs):                        # pull in a rig that lives elsewhere
    if o.type == 'MESH':
        for m in o.modifiers:
            if m.type == 'ARMATURE' and m.object and m.object not in objs:
                objs.append(m.object)

armature = None
for o in objs:
    o.hide_set(False); o.hide_select = False
    o.select_set(True)
    if o.type == 'ARMATURE':
        armature = o
# rig export is happiest with the armature active
bpy.context.view_layer.objects.active = armature or (objs[0] if objs else None)
print("exporting:", [o.name for o in objs])

os.makedirs(OUT_DIR, exist_ok=True)
filepath = os.path.join(OUT_DIR, f"{coll.name}.fbx")

bpy.ops.export_scene.fbx(
    filepath=filepath,
    path_mode='COPY',
    embed_textures=True,
    batch_mode='OFF',
    use_selection=True,
    use_visible=False,
    use_active_collection=False,
    object_types={'EMPTY', 'CAMERA', 'LIGHT', 'ARMATURE', 'MESH', 'OTHER'},
    use_custom_props=False,
    global_scale=1.0,
    apply_unit_scale=True,
    apply_scale_options='FBX_SCALE_UNITS',
    axis_forward='Y',
    axis_up='Z',
    use_space_transform=True,
    bake_space_transform=False,
    bake_anim=False,
)
size = os.path.getsize(filepath)
print("exported", filepath, size, "bytes")
assert size > 20000, "fbx too small — rig/textures missing (was the collection hidden?)"
```

A real character exports to a few hundred KB or more (rig + embedded palette).
If it comes out ~4 KB, the collection was hidden/excluded or the armature wasn't
selected — the assert above catches that. Report the path and byte size.

## Notes / gotchas

- **`LIGHT` vs `LAMP`:** the panel labels it "Lamp" but the enum id is `LIGHT`
  in current Blender. If a version errors on `object_types`, introspect the
  operator's `object_types` enum items and use those ids.
- The exporter runs against the **current selection**, not a collection arg
  (that's why `use_active_collection=False` and we select manually). Anything
  left selected in the scene would leak into the file — always `DESELECT` first.
- Selecting the objects changes the scene selection as a side effect; that's
  expected. If the user was mid-task, restore their prior selection afterward.
- `bake_space_transform` (Apply Transform) stays **off** — turning it on rewrites
  vertex coords and breaks the rig/animation the project relies on.
