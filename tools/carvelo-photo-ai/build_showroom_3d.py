#!/usr/bin/env python3
"""Build the CARVELO 180-degree showroom as a real Blender scene.

Usage:
  blender -b -t 2 --python tools/carvelo-photo-ai/build_showroom_3d.py -- \
    --output-dir /tmp/carvelo-3d --samples 24 --step 15

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
        ob.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
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
    floor = material("Warm pearl stone floor", (.47, .46, .43), .08, .28)
    grout = material("Floor joints", (.23, .23, .22), 0, .85)
    wall = material("Graphite walls", (.055, .064, .071), .04, .7)
    ceiling = material("Ceiling charcoal", (.085, .092, .097), 0, .75)
    wood = material("Warm walnut slats", (.24, .12, .065), 0, .52)
    led = material("Warm LED diffuser", (1, .77, .44), 0, .3)
    glass = material("Blue-gray glazing", (.14, .20, .24), .2, .16)
    white = material("CARVELO white letters", (.88, .9, .89), .1, .3)
    red = material("CARVELO red V", (.76, .055, .075), .05, .3)

    cube("Floor slab", (0, 0, -.13), (19, 17, .26), floor)
    # Tile seams are physical geometry, so perspective is rendered correctly.
    for i in range(-9, 10):
        cube("Tile seam X %s" % i, (i, 0, .002), (.009, 17, .003), grout)
    for j in range(-8, 9):
        cube("Tile seam Y %s" % j, (0, j, .002), (19, .009, .003), grout)
    cube("Back wall", (0, 7.7, 2.8), (19, .2, 5.6), wall)
    # The 180-degree camera orbit passes the side elevations.
    # Open camera-facing sides: side-on orbit views must not look through walls.\n    # Side glazing is deliberately omitted until visibility-safe 3D architecture is validated.
    cube("Ceiling", (0, 0, 5.65), (19, 17, .22), ceiling)

    # Architectural vertical wood slats on the rear wall.
    for k in range(23):
        x = -8.6 + k*.24
        cube("Walnut slat %02d" % k, (x, 7.54, 2.9),
             (.10, .09, 5.1), wood, .012)
    cube("Brand fascia", (4.3, 7.48, 3.3), (7.3, .16, 2.2), wall, .04)
    text_object("CAR", "Brand CAR", (2.35, 7.32, 3.13), .84, white)
    text_object("V", "Brand V", (4.18, 7.30, 3.13), .86, red)
    text_object("ELO", "Brand ELO", (6.05, 7.32, 3.13), .84, white)

    for x in (-6.9, -3.5, 0, 3.5, 6.9):
        for y in (-5.8, -.8, 4.2):
            cube("Recessed light", (x, y, 5.525), (2.25, .11, .015), led)
            area_light("Ceiling softbox", (x, y, 5.45), 900, (2.2, .8),
                       (x, y, 0))
    area_light("Front fill", (0, -6.5, 4.4), 1300, (8, 3), (0, 0, 1))
    area_light("Right fill", (7.8, -1, 3.8), 850, (3, 5), (0, 0, 1))
    area_light("Left fill", (-7.8, -1, 3.8), 850, (3, 5), (0, 0, 1))

    world = bpy.context.scene.world
    world.color = (.2, .2, .2)
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = .45
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.name = "CARVELO calibrated orbit camera"
    bpy.context.scene.camera = camera
    camera.data.type = "PERSP"
    camera.data.lens = 40
    camera.data.sensor_width = 36
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = args.samples
    scene.render.resolution_x = args.width
    scene.render.resolution_y = args.height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    scene.render.image_settings.color_mode = "RGB"

    args.output_dir.mkdir(parents=True, exist_ok=True)
    target = Vector((0, 0, 1.0))
    metadata = []
    # Camera orbit: each render comes from a new 3D camera position.
    for angle in range(-90, 91, args.step):
        rad = math.radians(angle)
        camera.location = (5.6*math.sin(rad), -5.6*math.cos(rad), 1.20)
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
            "camera_orbit_radius_m": 5.6,
            "composition_note": "Camera is framed for a foreground vehicle; empty background renders alone cannot verify actual vehicle occupancy.",
            "target_m": list(target),
            "empty": True,
        })
    # Persist the actual calibrated camera pose, not the unpositioned camera.\n    camera.location = (0, -5.6, 1.20)\n    camera.rotation_euler = (target-camera.location).to_track_quat("-Z", "Y").to_euler()\n    bpy.ops.wm.save_as_mainfile(filepath=str(args.output_dir/"carvelo_showroom_180.blend"))\n    (args.output_dir/"camera_manifest.json").write_text(
        json.dumps({"scene": "CARVELO 180 3D v1",
                    "camera_views": metadata}, indent=2), encoding="utf-8")
    print("CARVELO 3D scene and %d camera views generated" % len(metadata))


parser = argparse.ArgumentParser()
parser.add_argument("--output-dir", type=Path, required=True)
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
