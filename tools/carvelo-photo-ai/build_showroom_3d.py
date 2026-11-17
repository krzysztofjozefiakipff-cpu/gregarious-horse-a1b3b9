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
    floor = material("CARVAMO mirror graphite floor", (.012, .022, .027), .72, .075) if args.studio_style == "mirror-premium" else material("CARVAMO matte graphite floor", (.17, .18, .19), .02, .84)
    grout = material("Floor joints", (.19, .20, .21), 0, .88)
    wall = material("CARVAMO neutral graphite walls", (.008, .045, .055) if args.studio_style == "mirror-premium" else (.245, .255, .265), 0, .72)
    ceiling = material("CARVAMO marine ceiling", (.018, .052, .061), 0, .78)
    wood = material("Warm walnut slats", (.17, .11, .075), 0, .78)
    led = material("Neutral white LED diffuser", (.85, .96, .97), 0, .3)
    glass = material("Blue-gray glazing", (.14, .20, .24), .2, .16)
    white = material("CARVAMO white letters", (.88, .9, .89), .1, .3)
    mint = material("CARVAMO mint #31E7D0", (.031, .80, .68), 0, .3)

    cube("Floor slab", (0, 0, -.13), (19, 17, .26), floor)
    # Seamless photo-studio floor avoids high-contrast grout lines under vehicles.
    cube("Back wall", (0, 7.7, 2.8), (19, .2, 5.6), wall)
    # The 180-degree camera orbit passes the side elevations.
    # Actual side walls eliminate black voids at the +/-90 degree views.
    cube("Left studio wall", (-9.4, 0, 2.8), (.2, 17, 5.6), wall)
    cube("Right studio wall", (9.4, 0, 2.8), (.2, 17, 5.6), wall)
    cube("Ceiling", (0, 0, 5.65), (19, 17, .22), ceiling)

    # Approved CARVAMO Premium Studio: architectural wall columns and long
    # front-to-back ceiling strips. These are actual 3D emissive objects,
    # not a single oversized ceiling panel or a postprocessing overlay.
    if args.studio_style == "mirror-premium":
        teal = material("CARVAMO teal #008F83", (.0, .56, .51), 0, .45)
        strip = material("Continuous neutral LED", (.91, .97, 1.0), 0, .3)
        for light_mat, strength in ((strip, 8.0), (teal, 3.0)):
            nodes = light_mat.node_tree.nodes
            links = light_mat.node_tree.links
            bsdf = nodes.get("Principled BSDF")
            bsdf.inputs["Emission Color"].default_value = (*light_mat.diffuse_color[:3], 1)
            bsdf.inputs["Emission Strength"].default_value = strength
        # Vertical strips in the rear wall, matching the approved rhythm.
        for x in (-8.4, -6.6, -4.8, -3.0, 3.0, 4.8, 6.6, 8.4):
            cube("Back wall architectural LED %.1f" % x,
                 (x, 7.48, 2.85), (.035, .09, 5.35), strip)
        # Side wall strips continue the visual grid into depth.
        for x in (-9.27, 9.27):
            for y in (-6.0, -2.8, .4, 3.6, 6.8):
                cube("Side wall architectural LED %.1f %.1f" % (x,y),
                     (x, y, 2.85), (.045, .045, 5.35), strip)
        # The approved reference uses parallel, uninterrupted light rails
        # running towards the back wall (along Y), not a broad glowing slab.
        for x in (-7.8, -5.2, -2.6, 0, 2.6, 5.2, 7.8):
            cube("Longitudinal ceiling LED %.1f" % x,
                 (x, -.1, 5.515), (.065, 15.4, .024), strip)
            area_light("Ceiling LED soft illumination %.1f" % x,
                       (x, -.1, 5.39), 125, (.38, 12.5), (x, 0, 0))
        # Teal cove accents along the bottom of all three walls.
        cube("Rear turquoise wall wash", (0, 7.46, .16), (18.2, .07, .055), teal)
        for x in (-9.25, 9.25):
            cube("Side turquoise wall wash %.1f" % x,
                 (x, 0, .16), (.07, 15.2, .055), teal)
    else:
        for k in range(23):
            x = -8.6 + k*.24
            cube("Walnut slat %02d" % k, (x, 7.54, 2.9),
                 (.10, .09, 5.1), wood, .012)
    # Continuous architectural recess: a single, repeatable studio for all brands.
    cube("Rear shadow band", (0, 7.47, .16), (18.5, .10, .32), ceiling)
    cube("Rear upper shadow band", (0, 7.47, 5.37), (18.5, .10, .18), ceiling)
    if args.logo_png:
        # Brand Book 2.0: canonical logo on a light protective field.
        brand_field = material("CARVAMO protective light field #F1F6F5", (.88, .94, .93), 0, .72)
        cube("Brand Book 2.0 logo panel", (0, 7.44, 4.05), (7.2, .16, 1.65), brand_field, .04)
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
        bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 7.34, 4.05),
                                         rotation=(math.pi / 2, 0, 0))
        sign = bpy.context.object
        sign.name = "Official CARVAMO SVG wall sign"
        sign.dimensions = (5.7, 1.18, 1)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        sign.data.materials.append(logo_material)

        text_object("Dobra cena. Prosto od dealera.", "CARVAMO brand slogan",
                    (0, 7.28, 2.98), .34, white)
    else:
        print("CARVAMO Brand Book 2.0 logo absent: unbranded QA only, not final studio")

    # Cinematic vehicle lighting: soft sources remain invisible in the room
    # geometry; only the seven architectural rails are visible on the ceiling.
    area_light("Long soft key", (0, -2.0, 5.25), 350, (11, 5), (0, 0, .7))
    area_light("Left studio key", (-6.8, -.5, 4.6), 140, (4, 5), (0, 0, 1))
    area_light("Right studio key", (6.8, -.5, 4.6), 140, (4, 5), (0, 0, 1))
    area_light("Front fill", (0, -6.5, 4.4), 140, (8, 4), (0, 0, 1))
    area_light("Right fill", (7.8, -1, 3.8), 100, (4, 5), (0, 0, 1))
    area_light("Left fill", (-7.8, -1, 3.8), 100, (4, 5), (0, 0, 1))

    world = bpy.context.scene.world
    world.color = (.2, .2, .2)
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = .15
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.name = "CARVAMO calibrated orbit camera"
    bpy.context.scene.camera = camera
    camera.data.type = "PERSP"
    camera.data.lens = 25
    camera.data.sensor_width = 36
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    if args.studio_style == "mirror-premium":
        scene.cycles.max_bounces = 8
        scene.cycles.diffuse_bounces = 3
        scene.cycles.glossy_bounces = 4
    scene.cycles.samples = args.samples
    scene.render.image_settings.color_depth = "8"
    # OVH Blender build lacks OpenImageDenoiser; do not enable it here.
    bpy.context.view_layer.cycles.use_denoising = False
    scene.render.resolution_x = args.width
    scene.render.resolution_y = args.height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = -0.65
    scene.render.image_settings.color_mode = "RGB"

    args.output_dir.mkdir(parents=True, exist_ok=True)
    target = Vector((0, 2.8, 2.45))
    metadata = []
    # Camera orbit: each render comes from a new 3D camera position.
    for angle in range(-90, 91, args.step):
        rad = math.radians(angle)
        # Keep every camera in front of the back wall, even at +/-90 degrees.
        # A pure semicircle placed cameras sideways into empty black space.
        camera.location = (3.0*math.sin(rad), -8.0 - .5*math.cos(rad), 2.55)
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
    camera.location = (0, -8.5, 2.55)
    camera.rotation_euler = (target-camera.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output_dir/"carvamo_showroom_180.blend"))
    (args.output_dir/"camera_manifest.json").write_text(
        json.dumps({"scene": "CARVAMO 180 3D studio", "studio_style": args.studio_style, "reflection_requires_vehicle_for_validation": True,
                    "camera_views": metadata}, indent=2), encoding="utf-8")
    (args.output_dir/"scene_qa.json").write_text(json.dumps({
        "brand": "CARVAMO", "scene_profile": "approved-architectural-led-studio-v2",
        "status": "background_ready_for_visual_review",
        "vehicle_compositing_approved": False,
        "reason": "Physical tire contact, geometric floor reflection and official logo require separate validation",
        "angles_rendered": len(metadata),
        "official_logo_included": bool(args.logo_png),
        "brand_book": "CARVAMO Brand Book 2.0",
        "slogan": "Dobra cena. Prosto od dealera.",
        "palette": {"navy": "#102A34", "teal": "#008F83", "mint": "#31E7D0", "light": "#F1F6F5"},
        "scene_file": "carvamo_showroom_180.blend"
    }, indent=2), encoding="utf-8")
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
