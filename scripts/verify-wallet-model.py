"""Run in Blender after opening the generated .blend; inspect actual mesh geometry."""
import json
import pathlib
import bpy
from mathutils import Vector

checks = []
def check(name, condition):
    checks.append({'test': name, 'status': 'PASS' if condition else 'FAIL'})

for name in ['Left outer leather', 'Right outer leather', 'Supple center hinge',
             'Left front pocket', 'Right front pocket', 'Original snap strap',
             'Left removable health card', 'Right removable sharing card']:
    obj = bpy.data.objects.get(name)
    check(name + ' is a thick editable mesh', obj is not None and obj.type == 'MESH'
          and len(obj.data.vertices) > 100
          and any(m.type == 'SOLIDIFY' and m.thickness > 0 for m in obj.modifiers))
for name in ['Left pocket stitches', 'Right pocket stitches', 'Strap stitching']:
    obj = bpy.data.objects.get(name)
    check(name + ' is physical thread geometry', obj is not None and obj.type == 'CURVE'
          and len(obj.data.splines) > 20 and obj.data.bevel_depth > 0)
mat = bpy.data.materials['Cobalt / pebbled calf leather']
check('Procedural leather normal network exists',
      sum(n.type == 'BUMP' for n in mat.node_tree.nodes) == 2
      and any(n.type == 'TEX_VORONOI' for n in mat.node_tree.nodes))
graph = bpy.context.evaluated_depsgraph_get()
for side, x in [('Left', -2.81), ('Right', 2.81)]:
    for y, expected in [(-1.7, side + ' front pocket'),
                        (1.3, side + ' removable ' + ('health' if side == 'Left' else 'sharing') + ' card')]:
        hit, _, _, _, obj, _ = bpy.context.scene.ray_cast(graph, Vector((x, y, 5)), Vector((0, 0, -1)))
        check(side + ' card occlusion at y=' + str(y), hit and obj.name == expected)
check('No external textures required', not any(i.source == 'FILE' and not i.packed_file for i in bpy.data.images))
result = {'scope': 'BLENDER_MODEL_GEOMETRY_ONLY', 'review': 'DRAFT / UNASSIGNED',
          'status': 'PASS' if all(c['status'] == 'PASS' for c in checks) else 'FAIL', 'checks': checks}
target = pathlib.Path(bpy.data.filepath).parent / 'geometry-check.json'
with target.open('x', encoding='utf8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)
print(json.dumps(result))
if result['status'] != 'PASS':
    raise RuntimeError('Wallet geometry verification failed')
