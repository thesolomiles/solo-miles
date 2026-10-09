# Mossy forest stones

Five low-poly wayside forms inspired by Leonard's moss-covered stone stack reference:
`LowCairn`, `SquatLantern`, `LayeredPagoda`, `TallStack`, `BrokenLantern`.
They have uneven slabs, real circular apertures, open supports, connected moss caps,
hanging growth and half-buried loose fragments. All five reuse `Material.004`
from the existing skull source, with closest-sampled packed palettes and verified
matte, collapsed UVs. No new colour materials or glowing swatches.

- Authoring source: `forest-stones.blend` (five named meshes in a studio lineup).
- Runtime: `../../public/models/forest-stones.glb` (five meshes at local ground origins,
  one material; 8,628 triangles total, about 925 KiB including the packed palettes).
- Preview: `../../output/forest-stones/lineup.png`.
- Reference: `../../journal-assets/forest-stones-reference.png`.
- Generator: `../../tools/build-forest-stones.py`.
- Placement and size ranges: `../../src/config/forestStones.ts`.
- Renderer: `../../src/three/forest/ForestStones.tsx`.

The forest loads the model on entry in its own Suspense boundary. Five instanced
meshes reuse the silhouettes over an endless deterministic scatter. All pieces
stay behind the walk, and their footprints skip the remains clearing. Painted
stone weathering and the existing haze apply on desktop and phones; the desktop
paint post-effect remains unchanged. There are no new interactions or collisions.
Dev preview: `?forest&stones` starts at x=34 beside early stone forms.

Reproduce from the generator (overwrites source edits):

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup --python tools/build-forest-stones.py
```

For hand editing, keep the named variant meshes separate and retain their ground
origins. Before exporting the selected five meshes, reset each object's location
to `(0, 0, 0)` to remove the authoring lineup offsets. Apply rotation and scale,
export GLB with Y-up, and exclude the studio lights and camera. Runtime instancing
uses each mesh's geometry directly, so exports must have identity node transforms.
The generator performs these steps before arranging its authoring preview.
