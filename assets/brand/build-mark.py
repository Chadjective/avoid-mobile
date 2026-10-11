"""Regenerate the AVOID.NET Android app icon, adaptive icon, splash mark and
favicon.

The mark is rebuilt from geometry and palette sampled off
`assets/brand/avatar-source.jpg` rather than upscaled from it: the source is
378px, its corona is clipped by the avatar's square frame (which shows as a
hard rectangular edge the moment the background goes transparent) and its sky
is navy rather than #0a0a0a.

    pip install pillow
    cd mobile && python3 assets/brand/build-mark.py
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
MOBILE = os.path.dirname(os.path.dirname(HERE))
FONT = os.path.join(
    MOBILE, "node_modules/@expo-google-fonts/geist-mono/400Regular/GeistMono_400Regular.ttf"
)
OUT = 1024
SS = 4                      # supersample for disc / ring / glyph
CS = 768                    # corona field resolution (smooth, upscales fine)

# --- proportions, in fractions of canvas width (matched to the source) ---
RD    = 0.265               # black disc radius -> 52% of width diameter
RMAX  = 0.470               # corona reaches zero here, inside the canvas
GLYPH = 0.40                # Ø ink height as a fraction of disc height
RING  = 2.5                 # pale ring, px at 1024

SKY      = (10, 10, 10)     # #0a0a0a
DISC     = (5, 5, 6)
RIM_COL  = (236, 231, 216)  # warm white, sampled (227,224,203) at the rim
FAR_COL  = (198, 212, 224)  # cool pale blue far out, matches source cast
GLYPH_COL= (242, 238, 229)


def smoothstep(t):
    t = 0.0 if t < 0 else (1.0 if t > 1 else t)
    return t * t * (3 - 2 * t)


def corona(scale=1.0):
    """RGBA corona field: warm-white near the disc, cooling and breaking into
    rays outward, hard zero at RMAX so it never touches the canvas edge."""
    rd, rmax = RD * scale, RMAX * scale
    span = rmax - rd

    # angular ray field, precomputed: broad spokes plus a finer spiky octave
    NA = 4096
    harm = [(5, 1.00, 0.62), (7, 0.85, 0.31), (11, 0.70, 1.72), (17, 0.52, 2.93),
            (23, 0.38, 0.94), (31, 0.28, 2.11), (43, 0.20, 4.42), (61, 0.13, 1.05)]
    tot = sum(a for _, a, _ in harm)
    rays = []
    for i in range(NA):
        th = 2 * math.pi * i / NA
        s = sum(a * math.cos(n * th + p) for n, a, p in harm)
        rays.append(0.18 + 0.82 * (0.5 + 0.5 * s / tot) ** 1.2)
    # slow asymmetry on the hot rim, as in the source
    asym = [0.86 + 0.14 * (0.5 + 0.5 * math.cos(2 * (2 * math.pi * i / NA) + 1.3))
            + 0.10 * (0.5 + 0.5 * math.cos(3 * (2 * math.pi * i / NA) - 0.4))
            for i in range(NA)]

    img = Image.new("RGBA", (CS, CS), (0, 0, 0, 0))
    px = img.load()
    c = (CS - 1) / 2.0
    for y in range(CS):
        dy = (y - c) / CS
        for x in range(CS):
            dx = (x - c) / CS
            u = math.hypot(dx, dy)
            if u >= rmax:
                continue
            d = u - rd
            if d < 0:
                d = 0.0
            t = d / span
            ai = int((math.atan2(dy, dx) % (2 * math.pi)) / (2 * math.pi) * NA) % NA
            hot = math.exp(-d / (0.030 * scale)) * asym[ai]
            halo = 0.58 * (1 - t) ** 3.0               # smooth glow on the rim
            w = smoothstep(d / (0.040 * scale))        # streaks engage close in
            streak = 0.62 * (1 - t) ** 1.5 * rays[ai] ** 2.2 * w
            a = 0.55 * hot + halo + streak
            if a <= 0.002:
                continue
            if a > 1:
                a = 1.0
            k = smoothstep(t * 1.3)                    # warm -> cool outward
            col = tuple(int(RIM_COL[i] + (FAR_COL[i] - RIM_COL[i]) * k) for i in range(3))
            px[x, y] = col + (int(a * 255 + 0.5),)
    img = img.filter(ImageFilter.GaussianBlur(0.8))
    return img.resize((OUT, OUT), Image.LANCZOS)


def glyph_layer(px_h):
    """Ø rendered from Geist Mono, ink-bbox centred, at exactly px_h tall."""
    size = int(px_h / 0.745)
    for _ in range(12):
        f = ImageFont.truetype(FONT, size)
        b = f.getbbox("Ø")
        h = b[3] - b[1]
        if h == 0:
            break
        if abs(h - px_h) <= 1:
            break
        size = max(1, int(round(size * px_h / h)))
    f = ImageFont.truetype(FONT, size)
    b = f.getbbox("Ø")
    pad = 40
    tmp = Image.new("L", (b[2] - b[0] + 2 * pad, b[3] - b[1] + 2 * pad), 0)
    ImageDraw.Draw(tmp).text((pad - b[0], pad - b[1]), "Ø", fill=255, font=f)
    return tmp.crop(tmp.getbbox())


def mark(scale=1.0, background=None):
    """The full mark on `background` (RGB tuple) or on transparency."""
    S = OUT * SS
    c = (S - 1) / 2.0
    rd = RD * scale * S

    top = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(top)
    d.ellipse([c - rd, c - rd, c + rd, c + rd], fill=DISC + (255,))
    rw = RING * SS
    d.ellipse([c - rd, c - rd, c + rd, c + rd],
              outline=RIM_COL + (150,), width=int(rw))

    g = glyph_layer(GLYPH * 2 * rd)
    gl = Image.new("RGBA", (S, S), GLYPH_COL + (0,))
    ga = Image.new("L", (S, S), 0)
    ga.paste(g, (int(c - g.width / 2), int(c - g.height / 2)))
    gl.putalpha(ga)
    top = Image.alpha_composite(top, gl)
    top = top.resize((OUT, OUT), Image.LANCZOS)

    out = Image.new("RGBA", (OUT, OUT), (background + (255,)) if background else (0, 0, 0, 0))
    out = Image.alpha_composite(out, corona(scale))
    return Image.alpha_composite(out, top)


if __name__ == "__main__":
    base = os.path.join(MOBILE, "assets")
    icon = mark(1.0, SKY).convert("RGB")
    icon.save(f"{base}/icon.png")
    mark(1.0).save(f"{base}/splash-icon.png")
    # Android safe zone: mark diameter (2*RMAX) must fit the central 66% circle
    mark((0.66 / (2 * RMAX)) ).save(f"{base}/adaptive-icon.png")
    icon.resize((48, 48), Image.LANCZOS).save(f"{base}/favicon.png")

    # 256px previews for review; the transparent assets are shown composited on
    # the background they are actually configured against.
    for n in ("icon", "adaptive-icon", "splash-icon"):
        im = Image.open(f"{base}/{n}.png")
        if im.mode == "RGBA":
            im = Image.alpha_composite(Image.new("RGBA", im.size, SKY + (255,)), im)
        im.convert("RGB").resize((256, 256), Image.LANCZOS).save(
            f"{base}/brand/preview-{n}.png")
    # the favicon is 48px: show its real pixels, not a soft upscale
    Image.open(f"{base}/favicon.png").convert("RGB").resize(
        (240, 240), Image.NEAREST).crop((-8, -8, 248, 248)).save(
        f"{base}/brand/preview-favicon.png")
    print("wrote icon / adaptive-icon / splash-icon / favicon + previews")
