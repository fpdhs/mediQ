"""Render real v3 mesh layers; never synthesize leather in CSS."""
import bpy
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parents[1]
out = root / 'assets/wallet-3d/ui-v1'
out.mkdir(parents=True, exist_ok=True)
if any(out.iterdir()):
    raise RuntimeError('Output exists; select a new version instead of overwriting')
bpy.ops.wm.open_mainfile(filepath=str(root / 'assets/wallet-3d/v3/mediq-wallet.blend'))
scene = bpy.context.scene
scene.cycles.samples = 48
scene.render.film_transparent = True
scene.render.resolution_x = 1800
scene.render.resolution_y = 1100
camera = scene.camera
camera.location = (0, 0, 20)
camera.rotation_euler = (Vector((0, 0, 0)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.ortho_scale = 12.5
for obj in bpy.data.objects:
    if obj.name == 'Studio ground' or 'removable' in obj.name:
        obj.hide_render = True
foreground = [o for o in bpy.data.objects if any(s in o.name for s in
    ['front pocket', 'pocket binding', 'pocket seam', 'pocket stitches', 'pocket lip',
     'snap strap', 'Strap ', 'nickel snap', 'leather stamp'])]
for obj in foreground:
    obj.hide_render = True
scene.render.filepath = str(out / 'back.png')
bpy.ops.render.render(write_still=True)
for obj in bpy.data.objects:
    if obj.type in {'MESH', 'CURVE', 'FONT'}:
        obj.hide_render = obj not in foreground
scene.render.filepath = str(out / 'front.png')
bpy.ops.render.render(write_still=True)
print('UI_LAYERS_RENDERED', out)
