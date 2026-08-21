---
name: imphenzia-assets
description: >-
  Build and edit low-poly 3D assets for the solo-miles town in Blender using
  Imphenzia's single-palette-texture method: ONE shared material for everything,
  color chosen by collapsing each face's UVs onto a swatch of a shared palette
  atlas, and lit windows/lamps driven by a matching emission-mask texture.
  Use this whenever creating, texturing, coloring, or fixing any Blender asset
  for this project — new buildings, props, characters, terrain, or when the user
  says "make an asset", "color this", "add a window/light", "match the palette",
  or notices materials/brightness looking inconsistent between objects. Do NOT
  hand-make one-off colored or emissive materials; that drift is exactly what
  this method exists to prevent.
---

# Imphenzia single-palette asset method

This is the pipeline the solo-miles town is built on (learned from Imphenzia's
low-poly tutorials). The whole point is that **every object shares one material
and one pair of texture files**, so the town reads as a single coherent set and
there is never per-object color/brightness drift to chase down.

Color is not stored in materials. Color is chosen **geometrically**, by moving a
face's UVs onto a colored square (a "swatch") of a shared palette image. A second
image, aligned to the same layout, marks which swatches glow.

## The one material

Every asset in the town uses a single Principled BSDF material (in the current
files it's `Material.004` — reuse that exact datablock, don't clone it):

| BSDF input | Source |
|---|---|
| Base Color | image texture → `//ImphenziaPalettes/ImphenziaPalette02-Albedo.png` |
| Emission Color | image texture → `//ImphenziaPalettes/ImphenziaPalette02-Emission.png` |
| Emission Strength | `5.0` (a single global value shared by the whole town) |

Both textures are 512×512 and must be sampled with **Closest** interpolation
(flat swatches, no bleeding between neighbors). The albedo atlas holds the color
swatches; the emission atlas is black everywhere except the swatches that should
glow, where it carries the lit color. Because emission = `emissionMap × 5.0`, a
face glows **only** if its UVs sit on a lit swatch — otherwise the black region
gives zero emission and it's a normal matte surface.

## The core move: color a face by placing its UVs

To give a face a color, collapse its entire UV island to a **single point** over
the desired swatch. All four corners of a quad land on the same pixel, so the
face reads as one flat color. This is why the town needs no per-object materials.

Concrete, from the real files — the lit-window swatch lives at UV `(0.508, 0.492)`
(a white albedo swatch that is also white in the emission map). A window face is
just four loops all set to `(0.508, 0.492)`.

```python
# collapse selected faces onto a swatch (Object Mode!)
SWATCH = (0.508, 0.492)
uvl = obj.data.uv_layers[0].data
for poly in obj.data.polygons:
    if poly.select:                     # or filter by material_index, etc.
        for li in poly.loop_indices:
            uvl[li].uv = SWATCH
```

Workflow for a new asset:
1. Model it low-poly, flat shading, keep the geometry clean and blocky.
2. Assign the shared `Material.004` to the whole mesh (one slot, no others).
3. For each color region, select those faces and collapse their UVs onto the
   matching albedo swatch. Emissive parts (windows, signs, lamps) go onto swatches
   that are lit in the emission atlas; everything else onto matte swatches.
4. Verify with a viewport screenshot.

**Before using any swatch for a surface that should NOT glow, verify it's matte** —
sample the *emission* atlas at that UV and confirm it's black. The palette has
several swatches whose albedo color also has a lit (emissive) twin, and they can
sit right next to each other. Picking one by albedo color alone will make the
surface bloom out white even though you never asked for glow. (This bit a whole
river: a shallow-blue swatch turned out to be emissive; the water blew out until
it was remapped to the matte blue of the same color.) Find a matte match by
scanning the albedo for the target color while skipping any pixel where the
emission atlas is non-black:

```python
def matte_swatch(target_rgb):  # returns UV of nearest MATTE swatch
    best=None
    for y in range(0,H,2):
        for x in range(0,W,2):
            i=(y*W+x)*4
            if EPX[i]+EPX[i+1]+EPX[i+2] > 0.05:  # skip emissive swatches
                continue
            d=sum((APX[i+k]-target_rgb[k])**2 for k in range(3))
            if best is None or d<best[0]: best=(d,x,y)
    _,x,y=best; return ((x+1)/W,(y+1)/H)
```

## Rules that keep the town consistent

- **Never create a bespoke colored or emissive material** (e.g. a hand-made
  `HouseWindowsLit` with a hardcoded orange base + its own emission). It looks
  fine in isolation but silently drifts from the shared look and has to be
  re-tuned by hand forever. If you find one, unify it: reassign its faces to
  `Material.004` and collapse their UVs onto the correct swatch, then delete the
  orphan material.
- **The one allowed exception: transmissive/reflective surfaces (water, glass).**
  These need real PBR — transmission (translucency), low roughness (reflection),
  IOR — which a flat matte swatch simply cannot express. So water/glass get their
  own dedicated material (e.g. a `Water` material: blue base, roughness ~0.05,
  transmission ~0.6, IOR 1.33), NOT a palette swatch. This is not "drift" — the
  single-palette rule is about matte *color*, and these surfaces are a *shader*
  need. Keep such exceptions to genuinely transmissive/reflective materials only;
  everything opaque still lives on the shared palette. Note the real reflection/
  refraction is a three.js runtime job — Blender only previews it (enable EEVEE
  raytracing to see it); the geometry is what exports, the water shader is tuned
  in three.js. A low-poly water surface with slight per-vertex height (rippled
  facets, flat-shaded) reads far better than a dead-flat plane, since each facet
  catches the light differently.
- **Emissive brightness scales with face AREA, not just strength.** The strength
  (5.0) is global, so a big glowing face pours out far more light than a small
  one and blooms out. Keep emissive faces to the size of an actual window pane or
  lamp — don't make a whole wall section emissive. (This was the real cause of
  the house window looking "so much brighter than the cafe's": identical material,
  but ~62× the emissive area.)
- **One material, one texture pair, for the entire town.** New swatches are added
  to the shared atlas, not by branching into new materials.
- Keep it flat-shaded and low-poly; that's the look the palette method is for.

## Blender-MCP gotchas (this project)

- **Switch to Object Mode before reading or writing UV loop data.** In Edit Mode,
  `mesh.uv_layers[0].data` reports length 0 and indexing it raises
  `bpy_prop_collection[index]: index 0 out of range, size 0`. Always
  `bpy.ops.object.mode_set(mode='OBJECT')` first.
- **Removing a material slot** needs the modern override, not the old dict arg:
  ```python
  bpy.ops.object.select_all(action='DESELECT')
  obj.select_set(True); bpy.context.view_layer.objects.active = obj
  obj.active_material_index = SLOT
  with bpy.context.temp_override(object=obj, selected_objects=[obj]):
      bpy.ops.object.material_slot_remove()
  ```
- Cafe/House live in their own collections; objects and mesh datablocks can share
  names (e.g. two "Cube" meshes). Resolve objects via their collection, not by a
  global name lookup.
- To find which swatch a face uses, sample the palette image at the face's
  centroid UV: `x=int(u*512)%512; y=int(v*512)%512; i=(y*512+x)*4; pixels[i:i+3]`.
  A face is emissive when the emission image's sample there is non-black.

## Quick reference — key coordinates in this project

- Palette albedo: `//ImphenziaPalettes/ImphenziaPalette02-Albedo.png` (512²)
- Palette emission: `//ImphenziaPalettes/ImphenziaPalette02-Emission.png` (512²)
- Shared material: `Material.004`, Emission Strength `5.0`
- Lit-window swatch: UV `(0.508, 0.492)` (white albedo, white emission)
