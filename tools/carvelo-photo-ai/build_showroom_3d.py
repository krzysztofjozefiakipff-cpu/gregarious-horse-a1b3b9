#!/usr/bin/env python3
"""Build the CARVAMO 180-degree showroom as a real Blender scene.

Usage:
  blender -b -t 2 --python tools/carvamo-photo-ai/build_showroom_3d.py -- \
    --output-dir /tmp/carvamo-3d --samples 24 --step 15

Creates an editable .blend, empty camera-angle renders and camera metadata.
The room, lights, floor, camera and branded wall are genuine 3D geometry.
Requires Blender 3.6+; no image-generation or fake panorama is used.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def material(name, color, metallic=0, roughness=.6):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return m


def cube(name, location, scale, mat, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    ob = bpy.context.object
    ob.name = name
    ob.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(mat)
    if bevel:
        mod = ob.modifiers.new("Soft edges", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        # Bevel geometry is sufficient; Blender 4.x warns when weighted normals
        # are used without legacy Auto Smooth.
    return ob


def area_light(name, location, power, size, target=(0, 0, 0)):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = power
    data.shape = "RECTANGLE"
    data.size = size[0]
    data.size_y = size[1]
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    ob.location = location
    ob.rotation_euler = (Vector(target)-ob.location).to_track_quat("-Z", "Y").to_euler()


def text_object(body, name, location, size, mat):
    curve = bpy.data.curves.new(name, "FONT")
    curve.body = body
    curve.size = size
    curve.extrude = .012
    curve.align_x = "CENTER"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (math.pi/2, 0, 0)
    obj.data.materials.append(mat)
    return obj


def build():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    floor = material("CARVAMO mirror graphite floor", (.095, .105, .125), .42, .16) if args.studio_style == "mirror-premium" else material("CARVAMO matte graphite floor", (.17, .18, .19), .02, .84)
    grout = material("Floor joints", (.19, .20, .21), 0, .88)
    wall = material("CARVAMO neutral graphite walls", (.145, .16, .19) if args.studio_style == "mirror-premium" else (.245, .255, .265), 0, .72)
    ceiling = material("Ceiling charcoal", (.17, .18, .19), 0, .88)
    wood = material("Warm walnut slats", (.17, .11, .075), 0, .78)
    led = material("Warm LED diffuser", (1, .77, .44), 0, .3)
    glass = material("Blue-gray glazing", (.14, .20, .24), .2, .16)
    white = material("CARVAMO white letters", (.88, .9, .89), .1, .3)
    red = material("CARVAMO red V", (.76, .055, .075), .05, .3)

    cube("Floor slab", (0, 0, -.13), (19, 17, .26), floor)
    # Seamless photo-studio floor avoids high-contrast grout lines under vehicles.
    cube("Back wall", (0, 7.7, 2.8), (19, .2, 5.6), wall)
    # The 180-degree camera orbit passes the side elevations.
    # Actual side walls eliminate black voids at the +/-90 degree views.
    cube("Left studio wall", (-9.4, 0, 2.8), (.2, 17, 5.6), wall)
    cube("Right studio wall", (9.4, 0, 2.8), (.2, 17, 5.6), wall)
    cube("Ceiling", (0, 0, 5.65), (19, 17, .22), ceiling)

    # Reference 1: minimalist graphite architecture with vertical LED strips.
    # Legacy layout remains selectable for before/after QA.
    if args.studio_style == "mirror-premium":
        cool_led = material("CARVAMO cool white LED", (.82, .9, 1.0), 0, .28)
        for x in (-7.6, -4.8, -2.0, 1.0, 7.7):
            cube("Rear vertical LED %.1f" % x, (x, 7.52, 2.85), (.035, .06, 4.85), cool_led)
            area_light("Rear LED glow %.1f" % x, (x, 7.1, 3.0), 75, (.22, 4.4), (x, 0, 2.0))
        for x in (-9.25, 9.25):
            for y in (-4.5, .0, 4.5):
                cube("Side wall LED", (x, y, 2.8), (.04, .035, 4.7), cool_led)
    else:
        for k in range(23):
            x = -8.6 + k*.24
            cube("Walnut slat %02d" % k, (x, 7.54, 2.9),
                 (.10, .09, 5.1), wood, .012)
    cube("Brand fascia", (4.3, 7.48, 3.3), (7.3, .16, 2.2), wall, .04)
    # Use the approved SVG rasterized externally; Blender font substitutes are forbidden.
    logo_png = Path(args.logo_png) if args.logo_png else None
    if args.logo_png and not logo_png.is_file():
        raise FileNotFoundError("official_carvamo_logo_png_missing: " + str(logo_png))
    if args.logo_png:
        logo_image = bpy.data.images.load(str(logo_png), check_existing=True)
        logo_material = bpy.data.materials.new("Official CARVAMO logo PNG")
        logo_material.use_nodes = True
        nodes = logo_material.node_tree.nodes
        bsdf = nodes.get("Principled BSDF")
        texture = nodes.new("ShaderNodeTexImage")
        texture.image = logo_image
        logo_material.node_tree.links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])
        logo_material.node_tree.links.new(texture.outputs["Alpha"], bsdf.inputs["Alpha"])
        logo_material.blend_method = "BLEND"
        bpy.ops.mesh.primitive_plane_add(size=1, location=(4.3, 7.37, 3.35),
                                         rotation=(math.pi / 2, 0, 0))
        sign = bpy.context.object
        sign.name = "Official CARVAMO SVG wall sign"
        sign.dimensions = (5.7, 1.45, 1)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        sign.data.materials.append(logo_material)

    else:
        print("CARVAMO logo PNG absent: rendering unbranded QA scene; no substitute logo")

    # Reference 2: broad softboxes and cinematic side fills; reflected by mirror floor.
    # A reflection is not evidence of correct tire contact: physical QA remains separate.
    if args.studio_style == "mirror-premium":
        luminous = material("CARVAMO ceiling luminous panel", (.82, .87, .94), 0, .35)
        cube("Large luminous ceiling panel", (0, -1.1, 5.515), (10.5, 6.0, .018), luminous)
        area_light("Large ceiling softbox", (0, -1.1, 5.42), 650, (10.0, 5.8), (0, 0, 0))
    # Fewer broad, lower-energy softboxes reduce floor blowout and hard contrast.
    for x in (-5.0, 0, 5.0):
        for y in (-3.0, 3.0):
            cube("Recessed light", (x, y, 5.525), (2.5, .11, .015), led)
            area_light("Ceiling softbox", (x, y, 5.45), 260, (3.6, 2.0),
                       (x, y, 0))
    area_light("Front fill", (0, -6.5, 4.4), 380, (8, 4), (0, 0, 1))
    area_light("Right fill", (7.8, -1, 3.8), 250, (4, 5), (0, 0, 1))
    area_light("Left fill", (-7.8, -1, 3.8), 250, (4, 5), (0, 0, 1))

    world = bpy.context.scene.world
    world.color = (.2, .2, .2)
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = .40
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.name = "CARVAMO calibrated orbit camera"
    bpy.context.scene.camera = camera
    camera.data.type = "PERSP"
    camera.data.lens = 40
    camera.data.sensor_width = 36
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    if args.studio_style == "mirror-premium":
        scene.cycles.max_bounces = 8
        scene.cycles.diffuse_bounces = 3
        scene.cycles.glossy_bounces = 4
    scene.cycles.samples = args.samples
    # OVH Blender build lacks OpenImageDenoiser; do not enable it here.
    bpy.context.view_layer.cycles.use_denoising = False
    scene.render.resolution_x = args.width
    scene.render.resolution_y = args.height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = -0.20
    scene.render.image_settings.color_mode = "RGB"

    args.output_dir.mkdir(parents=True, exist_ok=True)
    target = Vector((0, 0, 1.25))
    metadata = []
    # Camera orbit: each render comes from a new 3D camera position.
    for angle in range(-90, 91, args.step):
        rad = math.radians(angle)
        # Keep every camera in front of the back wall, even at +/-90 degrees.
        # A pure semicircle placed cameras sideways into empty black space.
        camera.location = (4.6*math.sin(rad), -6.3 - 1.0*math.cos(rad), 1.35)
        direction = target-camera.location
        camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        path = args.output_dir/("empty_%+04d.png" % angle)
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        metadata.append({
            "image": path.name,
            "azimuth_deg": angle,
            "camera_location_m": list(camera.location),
            "camera_rotation_euler_rad": list(camera.rotation_euler),
            "lens_mm": camera.data.lens,
            "sensor_width_mm": camera.data.sensor_width,
            "resolution": [args.width, args.height],
            "floor_z_m": 0.0,
            "hero_vehicle_target_frame_width_fraction": 0.85,
            "camera_orbit_radius_m": round(math.hypot(camera.location.x, camera.location.y), 4),
            "composition_note": "Camera is framed for a foreground vehicle; empty background renders alone cannot verify actual vehicle occupancy.",
            "target_m": list(target),
            "empty": True,
        })
    # Persist the actual calibrated camera pose, not the unpositioned camera.
    camera.location = (0, -7.3, 1.35)
    camera.rotation_euler = (target-camera.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output_dir/"carvelo_showroom_180.blend"))
    (args.output_dir/"camera_manifest.json").write_text(
        json.dumps({"scene": "CARVAMO 180 3D studio", "studio_style": args.studio_style, "reflection_requires_vehicle_for_validation": True,
                    "camera_views": metadata}, indent=2), encoding="utf-8")
    print("CARVAMO 3D scene and %d camera views generated" % len(metadata))


parser = argparse.ArgumentParser()
parser.add_argument("--output-dir", type=Path, required=True)
parser.add_argument("--studio-style", choices=("legacy", "mirror-premium"), default="mirror-premium", help="Premium graphite mirror floor + architectural LED + softbox; legacy for QA comparison")
parser.add_argument("--logo-png", default=None, help="Optional official CARVAMO logo PNG; omitted for unbranded QA render")
parser.add_argument("--step", type=int, default=15)
parser.add_argument("--samples", type=int, default=24)
parser.add_argument("--width", type=int, default=1280)
parser.add_argument("--height", type=int, default=720)
args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
if args.step <= 0 or 180 % args.step:
    parser.error("--step must be a positive divisor of 180")
if args.samples <= 0 or args.width <= 0 or args.height <= 0:
    parser.error("invalid render settings")
build()
