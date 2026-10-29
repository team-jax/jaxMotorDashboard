"""Import the supplied URDF and its visual meshes, preserving joint frames."""
import json, shutil, sys
from pathlib import Path
import xml.etree.ElementTree as ET
source = Path(sys.argv[1])
out = Path(__file__).resolve().parents[1] / 'dist/models/jax'
out.mkdir(parents=True, exist_ok=True)
urdf = source / 'urdf/JAXV2_Assembly.urdf'
root = ET.parse(urdf).getroot()
def numbers(value): return [float(n) for n in value.split()]
def origin(element):
    node = element.find('origin')
    return {'xyz': numbers(node.get('xyz', '0 0 0')) if node is not None else [0,0,0], 'rpy': numbers(node.get('rpy','0 0 0')) if node is not None else [0,0,0]}
links=[]
for link in root.findall('link'):
    visuals=[]
    for visual in link.findall('visual'):
        mesh=visual.find('geometry/mesh')
        if mesh is None: continue
        rel=mesh.get('filename').split('package://'+source.name+'/')[-1]
        path=source/rel
        shutil.copy2(path,out/path.name)
        visuals.append({**origin(visual),'file':path.name,'scale':numbers(mesh.get('scale','1 1 1'))})
    links.append({'name':link.get('name'),'visuals':visuals})
joints=[]
for j in root.findall('joint'):
    limit=j.find('limit'); axis=j.find('axis')
    joints.append({'name':j.get('name'),'type':j.get('type'),'parent':j.find('parent').get('link'),'child':j.find('child').get('link'),**origin(j),'axis':numbers(axis.get('xyz','1 0 0')) if axis is not None else [1,0,0],'limit':{k:float(v) for k,v in limit.attrib.items()} if limit is not None else None})
(out/'model.json').write_text(json.dumps({'name':root.get('name'),'links':links,'joints':joints},indent=2)+'\n')
shutil.copy2(urdf,out/urdf.name)
print(f'Imported {len(links)} links, {len(joints)} joints and visual meshes to {out}')
