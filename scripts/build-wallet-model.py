"""Build an original, editable leather wallet in Blender. No web/CSS rendering.
Run: blender --background --factory-startup --python scripts/build-wallet-model.py -- --output assets/wallet-3d/v1
"""
import argparse
import hashlib
import json
import math
import pathlib
import sys
import bpy
from mathutils import Vector

args = argparse.ArgumentParser()
args.add_argument('--output', required=True)
args.add_argument('--samples', type=int, default=48)
opts = args.parse_args(sys.argv[sys.argv.index('--') + 1:])
out = pathlib.Path(opts.output).resolve()
out.mkdir(parents=True, exist_ok=False)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, roughness=.5, metal=0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Roughness'].default_value = roughness
    bs.inputs['Metallic'].default_value = metal
    return m

leather = material('Cobalt / pebbled calf leather', (.008, .034, .15), .56)
nodes, links = leather.node_tree.nodes, leather.node_tree.links
bs = nodes.get('Principled BSDF')
bs.inputs['Coat Weight'].default_value = .08
bs.inputs['Coat Roughness'].default_value = .4
tex = nodes.new('ShaderNodeTexCoord')
grain = nodes.new('ShaderNodeTexVoronoi'); grain.feature = 'DISTANCE_TO_EDGE'
grain.inputs['Scale'].default_value = 36
links.new(tex.outputs['Object'], grain.inputs['Vector'])
ramp = nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position = .018
ramp.color_ramp.elements[0].color = (.08, .08, .08, 1)
ramp.color_ramp.elements[1].position = .14
ramp.color_ramp.elements[1].color = (.75, .75, .75, 1)
links.new(grain.outputs['Distance'], ramp.inputs[0])
bump = nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .45; bump.inputs['Distance'].default_value = .014
links.new(ramp.outputs[0], bump.inputs['Height'])
fine = nodes.new('ShaderNodeTexNoise'); fine.inputs['Scale'].default_value = 180; fine.inputs['Detail'].default_value = 2
links.new(tex.outputs['Object'], fine.inputs['Vector'])
micro = nodes.new('ShaderNodeBump'); micro.inputs['Strength'].default_value = .23; micro.inputs['Distance'].default_value = .007
links.new(fine.outputs['Fac'], micro.inputs['Height']); links.new(bump.outputs['Normal'], micro.inputs['Normal']); links.new(micro.outputs['Normal'], bs.inputs['Normal'])
variation = nodes.new('ShaderNodeTexNoise'); variation.inputs['Scale'].default_value = 3.5; variation.inputs['Detail'].default_value = 3
links.new(tex.outputs['Object'], variation.inputs['Vector'])
blue = nodes.new('ShaderNodeValToRGB'); blue.color_ramp.elements[0].color = (.006,.029,.13,1); blue.color_ramp.elements[1].color = (.010,.049,.20,1)
links.new(variation.outputs['Fac'], blue.inputs[0]); links.new(blue.outputs[0], bs.inputs['Base Color'])
edge = material('Hand-painted navy leather edges', (.010,.035,.080), .60)
thread = material('Blue grey saddle thread', (.24,.38,.57), .72)
seam = material('Pressed stitching channel', (.009,.027,.065), .6)
paper = material('Warm white cotton card', (.87,.87,.83), .78)
ice = material('Blue grey sharing card', (.69,.77,.87), .7)
silver = material('Brushed nickel snap', (.57,.62,.68), .26, .88)
ink = material('Subtle navy deboss', (.011,.029,.065), .65)
floor = material('Studio ice', (.78,.84,.91), .87)

def mesh(name, verts, faces, mat):
    data = bpy.data.meshes.new(name); data.from_pydata(verts, [], faces); data.update()
    obj = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(obj); obj.data.materials.append(mat)
    for p in data.polygons: p.use_smooth = True
    return obj

def rounded(w,h,r,n=18):
    points=[]
    for cx,cy,start in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
        for i in range(n):
            a=math.radians(start+i*90/(n-1)); points.append((cx+r*math.sin(a),cy+r*math.cos(a)))
    return points

# Explicit rounded perimeter in counter-clockwise order.
def contour(w,h,r,n=18):
    points=[]
    for cx,cy,start in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
        for i in range(n):
            a=math.radians(start+i*90/(n-1));points.append((cx+r*math.cos(a),cy+r*math.sin(a)))
    return points

def cord(name, points, radius, mat):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=2;curve.bevel_depth=radius;curve.bevel_resolution=3
    spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
    for p,v in zip(spline.points,points):p.co=(*v,1)
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj);obj.data.materials.append(mat)
    return obj

def saddle(name, points, spacing=.105):
    # Each stitch is real curved geometry, not a drawn texture.
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=.009;curve.bevel_resolution=2
    distances=[0.0]
    for a,b in zip(points,points[1:]):distances.append(distances[-1]+(Vector(b)-Vector(a)).length)
    def at(t):
        for i in range(len(distances)-1):
            if distances[i+1]>=t:
                k=(t-distances[i])/(distances[i+1]-distances[i]);return Vector(points[i]).lerp(Vector(points[i+1]),k)
        return Vector(points[-1])
    t=.02
    while t+spacing*.60<distances[-1]:
        a,b=at(t),at(t+spacing*.60);mid=(a+b)/2;mid.z+=.008
        sp=curve.splines.new('POLY');sp.points.add(2)
        for p,v in zip(sp.points,[a,mid,b]):p.co=(*v,1)
        t+=spacing
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj);obj.data.materials.append(thread)
    return obj

def panel(name,x,y,w,h,z,thickness,mat,r=.28,puff=.035,warp=None):
    bound=contour(w,h,r);count=len(bound);verts=[(x,y,z+puff+(warp(0,0) if warp else 0))]
    for ring in range(1,13):
        scale=ring/12
        for px,py in bound:
            xx,yy=px*scale,py*scale
            zz=z+puff*(1-scale*scale)+(warp(xx,yy) if warp else 0)
            verts.append((x+xx,y+yy,zz))
    faces=[]
    for j in range(count):faces.append((0,1+j,1+(j+1)%count))
    for ring in range(11):
        a=1+ring*count;b=a+count
        for j in range(count):faces.append((a+j,b+j,b+(j+1)%count,a+(j+1)%count))
    obj=mesh(name,verts,faces,mat)
    sol=obj.modifiers.new('Actual material thickness','SOLIDIFY');sol.thickness=thickness;sol.offset=-1
    bevel=obj.modifiers.new('Soft rolled leather edge','BEVEL');bevel.width=min(thickness*.3,.025);bevel.segments=3
    return obj

def boundary(x,y,w,h,z,r=.28,warp=None):
    p=[(x+px,y+py,z+(warp(px,py) if warp else 0)) for px,py in contour(w,h,r)]
    return p+[p[0]]

# Both leaves open sideways; the outer edges lift slightly from the center fold.
def lift(px,py):return .028*(px/2.7)**2+.017*math.cos(py*.7)
for side,x in [('Left',-2.81),('Right',2.81)]:
    panel(side+' outer leather',x,0,5.64,6.22,.17,.15,leather,.36,.06,lift)
    cord(side+' painted edge',boundary(x,0,5.55,6.13,.165,.33,lift),.033,edge)
    panel(side+' suede lined inner leaf',x,0,5.38,5.97,.205,.06,leather,.30,.035,lift)
    path=boundary(x,0,5.35,5.93,.248,.29,lift)
    cord(side+' recessed seam',path,.016,seam);saddle(side+' perimeter stitching',path)

# Flexible continuous central gusset with two creases and an actual valley.
verts=[];faces=[]
for iy in range(41):
    yy=-2.96+5.92*iy/40
    for ix in range(33):
        xx=-.27+.54*ix/32;zz=.115+.11*(abs(xx)/.27)**1.7+.009*math.sin(yy*2)
        verts.append((xx,yy,zz))
for iy in range(40):
    for ix in range(32):
        a=iy*33+ix;faces.append((a,a+1,a+34,a+33))
gusset=mesh('Supple center hinge',verts,faces,leather)
gusset.modifiers.new('Fold thickness','SOLIDIFY').thickness=.085
for x in [-.19,.19]:cord('Fold crease',[(x,-2.95+i*5.9/80,.17+.009*math.sin((-2.95+i*5.9/80)*2)) for i in range(81)],.012,seam)

# Cards are separate thick meshes, seated behind the front pockets.
cards=[]
cards.append(panel('Left removable health card',-2.81,.19,4.95,5.60,.37,.055,paper,.22,.013))
cards.append(panel('Right removable sharing card',2.81,.26,4.95,5.46,.38,.055,ice,.22,.013))
for side,x in [('Left',-2.81),('Right',2.81)]:
    def pocket_warp(px,py):return .055*(1-(px/2.55)**2)+.025*(py+1)
    panel(side+' front pocket',x,-1.86,5.18,2.16,.52,.075,leather,.24,.02,pocket_warp)
    cord(side+' pocket binding',boundary(x,-1.86,5.13,2.11,.524,.22,pocket_warp),.022,edge)
    stitch=boundary(x,-1.86,4.96,1.95,.551,.16,pocket_warp)
    cord(side+' pocket seam groove',stitch,.013,seam);saddle(side+' pocket stitches',stitch,.10)
    # A raised curved lip casts its own contact shadow on the card.
    cord(side+' rounded pocket lip',[(x-2.39+i*4.78/100,-.81-.05*math.sin(math.pi*i/100),.604+.02*math.sin(math.pi*i/100)) for i in range(101)],.026,leather)

# Retain the recognizable rounded leather strap and metal snap.
panel('Original snap strap',5.25,-.40,1.43,.86,.72,.095,leather,.31,.035)
strap_path=boundary(5.25,-.40,1.22,.65,.757,.23)
cord('Strap seam channel',strap_path,.014,seam);saddle('Strap stitching',strap_path,.085)
bpy.ops.mesh.primitive_uv_sphere_add(segments=64,ring_count=24,location=(5.38,-.40,.80))
snap=bpy.context.object;snap.name='Domed brushed nickel snap';snap.scale=(.225,.225,.065);snap.data.materials.append(silver)
for p in snap.data.polygons:p.use_smooth=True

def label(name,text,location,size,mat):
    curve=bpy.data.curves.new(name,'FONT');curve.body=text;curve.size=size;curve.extrude=.0008;curve.bevel_depth=.0004
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj);obj.location=location;obj.data.materials.append(mat);return obj
label('Understated leather stamp','Medi Q',(-4.94,-2.57,.593),.21,ink)

# Studio rendering: soft grazing key reveals leather grain, broad fill keeps UI-facing paper quiet.
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.16));ground=bpy.context.object;ground.name='Studio ground';ground.data.materials.append(floor)
def aim(obj,point):obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()
def light(name,loc,power,size,color):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=loc;aim(obj,(0,0,0))
light('Large silk key',(-4,-2,10),1250,7,(.87,.93,1))
light('Soft warm fill',(6,3,7),900,6,(1,.96,.89))
light('Leather grazing strip',(-7,3,3),450,4,(.70,.82,1))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=opts.samples;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=8
scene.world.color=(.22,.22,.22);scene.view_settings.view_transform='AgX';scene.view_settings.exposure=.55
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.render.resolution_percentage=100
camdata=bpy.data.cameras.new('Product camera');cam=bpy.data.objects.new('Product camera',camdata);bpy.context.collection.objects.link(cam);scene.camera=cam
camdata.type='ORTHO';camdata.ortho_scale=13.5;cam.location=(.4,-8.7,17);aim(cam,(0,0,.2))
scene.render.resolution_x=1600;scene.render.resolution_y=1050
bpy.ops.wm.save_as_mainfile(filepath=str(out/'mediq-wallet.blend'))
scene.render.filepath=str(out/'wallet-hero.png');bpy.ops.render.render(write_still=True)
cam.location=(5,-7,10);aim(cam,(2.7,-1.5,.35));camdata.ortho_scale=6.1
scene.render.resolution_x=1200;scene.render.resolution_y=1000
scene.render.filepath=str(out/'wallet-material-detail.png');bpy.ops.render.render(write_still=True)
cam.location=(0,-2,20);aim(cam,(0,0,.2));camdata.ortho_scale=13.1
ground.hide_render=True;scene.render.film_transparent=True
scene.render.resolution_x=1800;scene.render.resolution_y=1100
scene.render.filepath=str(out/'wallet-front-transparent.png');bpy.ops.render.render(write_still=True)
manifest={'status':'DRAFT / UNASSIGNED','generator':'scripts/build-wallet-model.py','blender':bpy.app.version_string,'renderer':'Cycles CPU','samples':opts.samples,'method':'Original 3D mesh + procedural leather material + geometry stitching','not_css_or_svg':True,'objects':len(bpy.data.objects),'mesh_objects':sum(o.type=='MESH' for o in bpy.data.objects),'curve_objects':sum(o.type=='CURVE' for o in bpy.data.objects),'web_deployed':False,'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in out.iterdir() if p.is_file()}}
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
print('WALLET_MODEL_COMPLETE '+str(out))
