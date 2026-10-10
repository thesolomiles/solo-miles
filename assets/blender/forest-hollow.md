# Eroded forest trail hollow

A shallow dry gully interrupts the opening trail. Its soil banks have irregular
mossy turf lips, dark topsoil, exposed branching roots and a compacted lower bed
with loose stones and leaf litter. The far bank curves and slopes back into the
forest. It is authored around a clear walking line, rather than assembled from
rectangular greybox walls.

The five named meshes share the existing `Material.004` and closest-sampled,
packed Imphenzia palettes. All face UVs are collapsed to verified matte swatches.
The export contains 4,034 triangles and is about 502 KiB. Mesh transforms are
identity; the renderer places the origin at the configured gap centre.

- Source: `forest-hollow.blend`
- Runtime asset: `../../public/models/forest-hollow.glb`
- Generator: `../../tools/build-forest-hollow.py`
- Asset check: `../../output/forest-hollow/check-asset.py`
- Renderer: `../../src/three/forest/ForestHollow.tsx`
- Collision/lesson configuration: `../../src/config/forestOpening.ts`

The walking edges remain 6.8 units apart at X=52 and X=58.8, with a flat bed
2.4 units below the trail. The art extends toward the camera to form the existing
side-view cutaway; its foreground cut and crisp mask share the same rough edge.
A curved ground cut meets the sloped far bank. Root, stone and turf decoration
leaves the central walking line clear. Soft diffuse daylight makes the exposed
soil readable, and the existing forest brush/haze shaders apply to the palette.
No extra render pass is added. The model loads only on forest entry; its cached
geometry and textures are reused while owned painted materials are disposed.

Regenerate (overwrites manual source changes):

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup --python tools/build-forest-hollow.py
```

Then run `python3 output/forest-hollow/check-asset.py` and
`node output/forest-opening/check-opening.cjs` from the repository root.
