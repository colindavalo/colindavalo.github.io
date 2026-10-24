#!/usr/bin/env python3
"""Render the moving-pencil illustration as a small 3D scene.

The picture is schematic but follows the construction in the paper:
the curved disk is the image of the universal cover in the symmetric
space, the translucent parallelograms are the moving pencils, and each
circle carrying spheres represents S^2 x S^1.
"""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LightSource
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PICTURES = ROOT / "pictures"
BACKGROUND = "#edf3f0"
GREEN = "#126b56"
BLUE = "#3f6e85"
GOLD = "#a46d21"


BALL_RADIUS = 1.30


def surface_coordinates(u: np.ndarray, v: np.ndarray) -> tuple[np.ndarray, ...]:
    """Map the unit disk to a curved disk whose boundary lies on the ball."""
    r = np.sqrt(u * u + v * v)
    theta = np.arctan2(v, u)
    boundary_z = 0.28 * np.sin(2 * theta) + 0.12 * np.cos(theta)
    boundary_radius = np.sqrt(BALL_RADIUS**2 - boundary_z**2)
    x = boundary_radius * u
    y = boundary_radius * v
    z = r * boundary_z + (1 - r * r) * (
        0.32 * (u * u - 0.72 * v * v) + 0.11 * u
    )
    return x, y, z


def add_small_sphere(ax, center, radius, color, alpha=1.0) -> None:
    u = np.linspace(0, 2 * np.pi, 18)
    v = np.linspace(0, np.pi, 10)
    x = center[0] + radius * np.outer(np.cos(u), np.sin(v))
    y = center[1] + radius * np.outer(np.sin(u), np.sin(v))
    z = center[2] + radius * np.outer(np.ones_like(u), np.cos(v))
    ax.plot_surface(x, y, z, color=color, alpha=alpha, linewidth=0, shade=True)


def add_ball(ax) -> None:
    u = np.linspace(0, 2 * np.pi, 72)
    v = np.linspace(0, np.pi, 38)
    radius = BALL_RADIUS
    x = radius * np.outer(np.cos(u), np.sin(v))
    y = radius * np.outer(np.sin(u), np.sin(v))
    z = radius * np.outer(np.ones_like(u), np.cos(v))
    light = LightSource(azdeg=310, altdeg=42)
    rgb = light.shade(z, cmap=plt.get_cmap("Greens"), blend_mode="soft")
    rgb[..., :3] = 0.84 * rgb[..., :3] + 0.16
    rgb[..., 3] = 0.085
    ax.plot_surface(x, y, z, facecolors=rgb, linewidth=0, shade=False, zorder=0)


def add_curved_disk(ax) -> None:
    theta = np.linspace(0, 2 * np.pi, 90)
    radii = np.linspace(0, 1, 30)
    rr, tt = np.meshgrid(radii, theta)
    u = rr * np.cos(tt)
    v = rr * np.sin(tt)
    x, y, z = surface_coordinates(u, v)
    ax.plot_surface(x, y, z, color="#a9cbc0", alpha=0.88,
                    linewidth=0, shade=True, zorder=3)

    for radius in (0.32, 0.62, 0.94):
        ug = radius * np.cos(theta)
        vg = radius * np.sin(theta)
        xg, yg, zg = surface_coordinates(ug, vg)
        zg = zg + 0.008
        ax.plot(xg, yg, zg, color="#4d8575", linewidth=0.48, alpha=0.54, zorder=4)
    for angle in np.linspace(0, 2 * np.pi, 9, endpoint=False):
        radial = np.linspace(0, 1, 42)
        ug = radial * np.cos(angle)
        vg = radial * np.sin(angle)
        xg, yg, zg = surface_coordinates(ug, vg)
        zg = zg + 0.009
        ax.plot(xg, yg, zg, color="#4d8575", linewidth=0.43, alpha=0.48, zorder=4)


def pencil_center(u: float) -> np.ndarray:
    v = 0.13 * np.sin(2.2 * u)
    x, y, z = surface_coordinates(np.array(u), np.array(v))
    return np.array([float(x), float(y), float(z) + 0.075])


def add_pencil(ax, u: float, phase: float) -> np.ndarray:
    center = pencil_center(u)
    # A small ambient plane, transported with only a slight coherent tilt.
    angle = 0.09 * u + 0.025 * np.sin(phase)
    ca, sa = np.cos(angle), np.sin(angle)
    e1 = np.array([0.23 * ca, 0.23 * sa, 0.038])
    e2 = np.array([-0.13 * sa, 0.13 * ca, 0.095])
    vertices = [center - e1 - e2, center + e1 - e2,
                center + e1 + e2, center - e1 + e2]
    face = Poly3DCollection([vertices], facecolor=BLUE,
                            edgecolor="none", linewidth=0,
                            alpha=0.68, zorder=8)
    ax.add_collection3d(face)
    ax.scatter(*center, s=24, color=GOLD,
               edgecolors="white", linewidths=0.65, depthshade=False, zorder=10)
    return center


def add_product_fiber(ax, center) -> np.ndarray:
    fiber_center = np.array([1.12 * center[0], 0.02, 1.82])
    t = np.linspace(0, 2 * np.pi, 140)
    # The S1 parameter circle is vertical; the small spheres are its S2 fibres.
    rail_x = fiber_center[0] + 0.34 * np.cos(t)
    rail_y = np.full_like(t, fiber_center[1])
    rail_z = fiber_center[2] + 0.34 * np.sin(t)
    ax.plot(rail_x, rail_y, rail_z, color=GREEN, linewidth=1.25,
            alpha=0.90, zorder=12)

    for angle in np.linspace(0, 2 * np.pi, 6, endpoint=False):
        sphere_center = np.array([
            fiber_center[0] + 0.34 * np.cos(angle),
            fiber_center[1],
            fiber_center[2] + 0.34 * np.sin(angle),
        ])
        add_small_sphere(ax, sphere_center, 0.092, BLUE, alpha=0.94)

    ax.plot([center[0], fiber_center[0]],
            [center[1], fiber_center[1]],
            [center[2] + 0.09, fiber_center[2] - 0.38],
            color="#688c81", linewidth=0.72, linestyle=(0, (3, 3)),
            alpha=0.68, zorder=5)
    return fiber_center


def render_frame(frame: int, frame_count: int, size=(720, 450)) -> Image.Image:
    progress = frame / frame_count
    phase = 2 * np.pi * progress
    fig = plt.figure(figsize=(size[0] / 120, size[1] / 120), dpi=120,
                     facecolor=BACKGROUND)
    ax = fig.add_subplot(111, projection="3d", facecolor=BACKGROUND)
    add_ball(ax)
    add_curved_disk(ax)

    moving_u = 0.72 * np.sin(phase - np.pi / 2)
    center = add_pencil(ax, moving_u, phase)
    add_product_fiber(ax, center)

    ax.set_xlim(-1.86, 1.86)
    ax.set_ylim(-1.20, 1.20)
    ax.set_zlim(-1.17, 2.18)
    ax.set_box_aspect((3.72, 2.40, 3.35))
    ax.view_init(elev=22, azim=-62, roll=0)
    ax.set_axis_off()
    fig.subplots_adjust(left=0, right=1, bottom=0, top=1)

    buffer = BytesIO()
    fig.savefig(buffer, format="png", dpi=120, facecolor=BACKGROUND,
                bbox_inches=None, pad_inches=0)
    plt.close(fig)
    buffer.seek(0)
    return Image.open(buffer).convert("RGB")


def main() -> None:
    PICTURES.mkdir(exist_ok=True)
    frame_count = 32
    frames = [render_frame(i, frame_count) for i in range(frame_count)]
    frames[8].save(PICTURES / "g2-slodowy-3d-static.png", optimize=True)
    frames[0].save(
        PICTURES / "g2-slodowy-3d.webp",
        save_all=True,
        append_images=frames[1:],
        duration=115,
        loop=0,
        quality=88,
        method=6,
    )


if __name__ == "__main__":
    main()
