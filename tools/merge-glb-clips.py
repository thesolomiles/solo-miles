"""Merge every animation in a .glb into ONE named clip.

Blender's glTF exporter (SCENE mode) splits a multi-object animation into one
clip per animated object — for cyclist.glb that's crank, two wheels and the
armature. three.js wants them as a single `cycle` clip, so this concatenates
the channels/samplers (re-pointing each channel's sampler index) and rewrites
the JSON chunk. Binary data is untouched, so Draco-compressed files are fine.

    python3 tools/merge-glb-clips.py in.glb out.glb [clip-name]
"""
import json
import struct
import sys

src, dst = sys.argv[1], sys.argv[2]
name = sys.argv[3] if len(sys.argv) > 3 else 'cycle'

data = open(src, 'rb').read()
magic, version, _ = struct.unpack('<III', data[:12])
json_len, json_type = struct.unpack('<II', data[12:20])
assert magic == 0x46546C67 and json_type == 0x4E4F534A, 'not a GLB'
gltf = json.loads(data[20:20 + json_len])
rest = data[20 + json_len:]  # BIN chunk (header included), unchanged

channels, samplers = [], []
for anim in gltf.get('animations', []):
    base = len(samplers)
    samplers += anim['samplers']
    for ch in anim['channels']:
        channels.append({**ch, 'sampler': ch['sampler'] + base})
gltf['animations'] = [{'name': name, 'channels': channels, 'samplers': samplers}]

js = json.dumps(gltf, separators=(',', ':')).encode()
js += b' ' * (-len(js) % 4)
body = struct.pack('<II', len(js), 0x4E4F534A) + js + rest
open(dst, 'wb').write(struct.pack('<III', magic, version, 12 + len(body)) + body)
print(f'{dst}: 1 clip "{name}", {len(channels)} channels')
