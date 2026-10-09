# Forest skull

The revised art pass for the wisp's ancient-remains encounter: a humanoid cranial
shell with real orbital and nasal cavities, a partially buried mandible, oversized
upper-canine tusks (one broken), missing teeth, recessed cracks and chipped bone,
thick moss around the crown and sides, dense hanging ivy, wrapping roots, and
centuries of accumulated soil and leaf litter that obscure most of the face.
Broken rib arcs, uneven spine fragments and displaced limb bones trail into the
woods beside the skull. They sit at different depths beneath connected humus
shelves, moss, roots and ferns, leaving only scattered hints of the body's shape.
Exposed bone uses stained brown-grey swatches and muddy painted rain washes. Its flatter irregular crown
and angular sockets tip 32 degrees forward and 12 degrees sideways into the soil.

- Authoring file: `forest-skull.blend` (dedicated file, packed palette images).
- Runtime asset: `../../public/models/forest-skull.glb`.
- Preview renders: `../../output/forest-skull/{front,side,three-quarter,remains}.png`.
  The wider `remains.png` includes the body fragments.
- Export statistics: `forest-skull.stats.json`, generated with the model.
- The export contains one flat-shaded mesh and one `Material.004` palette
  material. All UVs collapse onto verified non-emissive swatches.
- The studio ground, lights and camera live in a separate collection and are
  excluded from the GLB. The mesh origin is at ground level.
- Blender coordinates: Z up, face toward -Y. GLB coordinates: Y up, face +Z.

The revised export is 13,545 triangles and 1.27 MiB, including
embedded palette textures. The forest loads it on entry, clones its material
for subtle painted weathering, and uses its existing desktop paint effect.
A fixed warm clearing light keeps the bone readable in both camera views.
The first camera reveal waits for the model to mount. The low broken tusk
crosses the walking trail as a jump obstacle. Its collision
is generated from the final mesh cross-section into `src/config/forestSkull.json`
and uses the existing movement and landing physics. Random obstacles remain off.
The tusk is below the automatic climbing threshold; one normal jump clears it.
All body fragments and their growth stay behind the walking trail, preserving
the tusk as the only authored collision obstacle.
After hand editing, update the collision to match the new trail crossing.

Open the `.blend` directly for hand editing. Select `ForestSkull` and export
selected objects as GLB with Y-up enabled to update the runtime asset.
The file's palette images are packed; opening it does not require the source
project or shared palette folder.

To reproduce the model from its generator (overwrites this asset and any hand edits):

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup --python tools/build-forest-skull.py
```

The generator appends the shared material from a read-only source file. For
another machine, provide its existing palette-bearing `.blend` and atlas folder:

```sh
blender --background --factory-startup --python tools/build-forest-skull.py -- \
  --palette-source /path/to/palette-source.blend \
  --palette-dir /path/to/ImphenziaPalettes
```

Use a separate background Blender process while another agent edits another
scene. Never open or overwrite that agent's working `.blend` through a shared
Blender UI session.
