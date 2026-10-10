"""Verify the actual GLB's palette, transforms, bounds and walking bed."""
import io
import json
from pathlib import Path
import struct
from PIL import Image

root = Path(__file__).resolve().parents[2]
data = (root/'public/models/forest-hollow.glb').read_bytes()
assert struct.unpack_from('<III', data) == (0x46546c67, 2, len(data))
n, kind = struct.unpack_from('<II', data, 12)
assert kind == 0x4e4f534a
j = json.loads(data[20:20+n])
pos = 20+n
n, kind = struct.unpack_from('<II', data, pos)
assert kind == 0x004e4942
binary = data[pos+8:pos+8+n]

def values(idx):
    acc=j['accessors'][idx];view=j['bufferViews'][acc['bufferView']]
    fmt={5126:'f',5123:'H',5125:'I',5121:'B'}[acc['componentType']]
    width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[acc['type']]
    size=struct.calcsize('<'+fmt*width)
    offset=view.get('byteOffset',0)+acc.get('byteOffset',0)
    stride=view.get('byteStride',size)
    return [struct.unpack_from('<'+fmt*width,binary,offset+i*stride) for i in range(acc['count'])]

def texture_image(info):
    tex=j['textures'][info['index']];image=j['images'][tex['source']];view=j['bufferViews'][image['bufferView']]
    offset=view.get('byteOffset',0)
    return Image.open(io.BytesIO(binary[offset:offset+view['byteLength']])).convert('RGB')

assert len(j['materials']) == 1
mat=j['materials'][0]
assert mat['name']=='Material.004'
emission=texture_image(mat['emissiveTexture'])
for node in j['nodes']:
    assert node.get('translation',[0,0,0]) == [0,0,0],node
    assert node.get('scale',[1,1,1]) == [1,1,1],node
    assert node.get('rotation',[0,0,0,1]) == [0,0,0,1],node
names=set();triangles=0
for mesh in j['meshes']:
    names.add(mesh['name'])
    for p in mesh['primitives']:
        assert p['material']==0
        assert p.get('mode',4)==4
        xyz=values(p['attributes']['POSITION']);uv=values(p['attributes']['TEXCOORD_0'])
        indices=[v[0] for v in values(p['indices'])]
        triangles+=len(indices)//3
        for i in range(0,len(indices),3):
            pts=[uv[idx] for idx in indices[i:i+3]]
            assert max(abs(u-pts[0][0])+abs(v-pts[0][1]) for u,v in pts) < 1e-6
            u,v=pts[0];pixel=emission.getpixel((int(u*emission.width)%emission.width,int(v*emission.height)%emission.height))
            assert sum(pixel)==0,pixel
        if mesh['name']=='Dry compacted hollow bed':
            central=[v for v in xyz if abs(v[2]) < .71]
            assert central
            assert all(abs(v[1]+2.4)<1e-5 for v in central)
        if mesh['name']=='Crumbly layered bank':
            centre=[v for v in xyz if abs(v[2])<.61 and abs(v[0])<3.5]
            assert max(v[1] for v in centre)<.12
assert len(names)==5,names
assert triangles==4034,triangles
assert len(data)<600_000
print(f'PASS: {triangles} triangles, five identity meshes, one shared matte palette, collapsed UVs, exact walking-bed height; {len(data):,} bytes')
