"""Add English labels to the G'_2-Slodowy slices illustration.

Reads pictures/g2-slodowy-parker-evans.png (unchanged) and writes
pictures/g2-slodowy-parker-evans-labeled.png, with labels in the style of
einstein-structures-parker-evans.png. Requires Pillow and matplotlib.
Run from the site root: python3 scripts/label_g2_slodowy.py
"""
from io import BytesIO
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "pictures" / "g2-slodowy-parker-evans.png"
TARGET = ROOT / "pictures" / "g2-slodowy-parker-evans-labeled.png"
INK = "#1b2150"
TOP = 230
FONT_SIZE = 82

plt.rcParams.update({"mathtext.fontset": "cm", "font.family": "serif",
                     "font.serif": ["cmr10"], "axes.formatter.use_mathtext": True})


def render(text, size=FONT_SIZE):
    fig = plt.figure(figsize=(1, 1), dpi=100)
    fig.text(0, 0, text, fontsize=size, color=INK, multialignment="center")
    buf = BytesIO()
    fig.savefig(buf, format="png", dpi=100, transparent=True, bbox_inches="tight", pad_inches=0.05)
    plt.close(fig)
    buf.seek(0)
    return Image.open(buf).convert("RGBA")


def place(canvas, label, x, y, anchor="center"):
    """Paste label with its centre (or left edge, if anchor='left') at x and vertical centre at y."""
    left = x if anchor == "left" else x - label.width // 2
    canvas.alpha_composite(label, (int(left), int(y - label.height // 2)))


source = Image.open(SOURCE).convert("RGBA")
canvas = Image.new("RGBA", (source.width, source.height + TOP), "white")
canvas.alpha_composite(source, (0, TOP))

place(canvas, render(r"$\mathrm{Ein}^{2{,}1}$"), 626, 150)
place(canvas, render(r"$\mathrm{G}_2'$ root system", 66), 2516, 150)
place(canvas, render(r"$M_\rho \overset{\pi}{\longrightarrow} S$"), 90, TOP + 1500, anchor="left")
place(canvas, render("$J$-holomorphic\ncurve", 66), 2516, TOP + 1450)

canvas.convert("RGB").save(TARGET, optimize=True)
print(TARGET.relative_to(ROOT), canvas.size)
