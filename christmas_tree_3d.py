"""Reference-style 3D ASCII Christmas tree, using only the Python standard library."""

import argparse
import math
import os
import random
import shutil
import sys
import time
from dataclasses import dataclass

FPS = 30
TURN_SECONDS = 20
START_TIME = 0
RESET = "\x1b[0m"
TILT = math.radians(18)
SIN_TILT, COS_TILT = math.sin(TILT), math.cos(TILT)
TREE_BOTTOM, TREE_TOP = 0.32, 3.02


@dataclass(frozen=True, slots=True)
class Point:
    x: float
    y: float
    z: float
    char: str
    red: int
    green: int
    blue: int
    reveal: float = 0
    kind: int = 0


def envelope(y):
    fraction = max(0, min(1, (y - TREE_BOTTOM) / (TREE_TOP - TREE_BOTTOM)))
    return 0.025 + 0.86 * (1 - fraction) ** 1.08


def make_model(detail=1):
    rng = random.Random(7)
    points = []

    def add(x, y, z, char, color, reveal=0, kind=0):
        points.append(Point(x, y, z, char, *color, reveal, kind))

    # Twenty-four whorls with individual drooping, irregular branches.
    for tier in range(24):
        fraction = tier / 23
        y = TREE_BOTTOM + fraction * (TREE_TOP - TREE_BOTTOM)
        length = envelope(y)
        branches = 8
        for branch in range(branches):
            angle = math.tau * branch / branches + tier * 2.39996
            dx, dz = math.cos(angle), math.sin(angle)
            count = max(30, int((55 + 220 * length) * detail))
            for _ in range(count):
                s = rng.random() ** 0.65
                sideways = rng.gauss(0, 0.018 + 0.075 * s) * (1 - fraction * 0.72)
                x = dx * s * length - dz * sideways
                z = dz * s * length + dx * sideways
                yy = y + 0.07 * s * length - 0.13 * s * s * length + rng.gauss(0, 0.024)
                tone = rng.uniform(0.65, 1.45) * (0.60 + 0.40 * s)
                color = (int(66 * tone), int(139 * tone), int(99 * tone))
                char = rng.choice(".,:;==++x*0134")
                kind = 0
                if s > 0.50 and rng.random() < 0.14:
                    color = (204, 221, 213)
                    char, kind = rng.choice(".:+*"), 1
                add(x, yy, z, char, color, 1.2 + 5.1 * fraction + 0.32 * s, kind)

    # Tapered, slightly crooked trunk with bark grooves, roots and bare boughs.
    for row in range(180):
        y = 0.04 + row / 179 * (TREE_TOP - 0.04)
        radius = 0.012 + 0.085 * (1 - y / TREE_TOP) ** 1.3 + 0.025 * math.exp(-y * 9)
        bend = 0.018 * math.sin(y * 2.4)
        for col in range(32):
            angle = math.tau * col / 32
            groove = 0.85 + 0.15 * math.sin(angle * 9 + y * 3)
            tone = (0.72 + 0.28 * math.cos(angle - 0.7)) * groove
            add(bend + radius * groove * math.cos(angle), y, radius * groove * math.sin(angle),
                ":|;|"[(col + row // 13) % 4], tuple(int(c * tone) for c in (157, 111, 69)), 0, 8)
    for branch in range(42):
        y = 0.35 + branch / 42 * 2.5
        angle = branch * 2.39996
        length = envelope(y) * 0.52
        for step in range(45):
            u = step / 44
            for side in (-1, 0, 1):
                radius = length * u
                add(radius * math.cos(angle) + side * 0.008 * (1 - u),
                    y + 0.12 * u - 0.08 * u * u, radius * math.sin(angle),
                    ":" if u > 0.8 else "=", (108, 77, 49), 0, 8)
    for root in range(7):
        angle = root * math.tau / 7
        for step in range(36):
            u = step / 35
            add((0.07 + 0.2 * u) * math.cos(angle), 0.09 * (1 - u) + 0.015,
                (0.07 + 0.2 * u) * math.sin(angle), "=", (121, 86, 55), 0, 8)

    # A gold garland with sagging loops and 170 separate bulbs.
    for index in range(round(2600 * detail)):
        u = index / max(1, round(2600 * detail) - 1)
        angle = math.tau * 3.6 * u + 0.9
        y = TREE_BOTTOM + 0.09 + (TREE_TOP - TREE_BOTTOM - 0.18) * u
        y -= 0.055 * abs(math.sin(angle * 2.5))
        radius = envelope(y) + 0.035
        tone = rng.uniform(0.8, 1.2)
        add(radius * math.cos(angle), y, radius * math.sin(angle), rng.choice(".:-=+"),
            (int(199 * tone), int(166 * tone), int(79 * tone)), 4.4 + 4.2 * u, 2)
    for index in range(170):
        u = index / 169
        angle = math.tau * 3.6 * u + 0.9
        y = TREE_BOTTOM + 0.09 + (TREE_TOP - TREE_BOTTOM - 0.18) * u
        y -= 0.055 * abs(math.sin(angle * 2.5))
        radius = envelope(y) + 0.05
        add(radius * math.cos(angle), y, radius * math.sin(angle), "*",
            (244, 211, 116), 8.0 + u * 0.8, 4)

    # Small spherical ornaments. Color and point shading make their volume visible.
    for ornament in range(30):
        fraction = 0.08 + 0.85 * (ornament / 30)
        y = TREE_BOTTOM + fraction * (TREE_TOP - TREE_BOTTOM)
        angle = ornament * 2.39996 + 0.6
        radius = envelope(y) + 0.04
        ball = (0.055 + rng.random() * 0.020) * (1 - fraction * 0.3)
        color = ((225, 43, 55), (234, 191, 72), (214, 225, 218))[ornament % 3]
        count = max(40, int(150 * detail))
        for index in range(count):
            ny = 1 - 2 * (index + 0.5) / count
            rr = math.sqrt(1 - ny * ny)
            theta = index * 2.39996
            nx, nz = rr * math.cos(theta), rr * math.sin(theta)
            tone = 0.65 + 0.35 * max(0, ny * 0.45 + nx * 0.55 + nz * 0.7)
            add(radius * math.cos(angle) + ball * nx, y + ball * ny,
                radius * math.sin(angle) + ball * nz, ".:-=+*#%@"[min(8, int(tone * 9))],
                tuple(int(c * tone) for c in color), 6.3 + 1.5 * fraction, 3)

    # A broad dotted ground plane and pale concentric woven rug.
    spacing = 0.039 / math.sqrt(detail)
    steps = math.ceil(2.0 / spacing)
    for ix in range(-steps, steps + 1):
        x = ix * spacing
        for iz in range(-steps, steps + 1):
            z = iz * spacing
            radius = math.hypot(x, z)
            if radius > 2:
                continue
            tone = rng.uniform(0.65, 1.1)
            color = (int(88 * tone), int(94 * tone), int(103 * tone))
            char = "."
            if radius < 1.24 and abs(math.sin(radius * 56)) > 0.80:
                color = (162, 171, 172)
                char = "-"
            add(x, 0.005, z, char, color, 0, 7)

    for index, (cx, cz, width, height, depth, color) in enumerate((
        (-0.74, 0.73, 0.36, 0.28, 0.33, (155, 31, 42)),
        (0.73, 0.60, 0.37, 0.34, 0.32, (38, 50, 135)),
        (0.12, 1.04, 0.26, 0.34, 0.25, (143, 32, 40)),
        (-0.96, -0.16, 0.34, 0.30, 0.30, (30, 88, 58)),
        (0.77, -0.61, 0.29, 0.24, 0.28, (177, 138, 58)),
    )):
        ribbon = (214, 187, 100) if index % 2 == 0 else (196, 202, 194)
        for face in range(5):
            for u in range(19):
                for v in range(17):
                    a, b = u / 18 - 0.5, v / 16
                    if face == 0:
                        x, y, z = a * width, height, (b - 0.5) * depth
                    elif face < 3:
                        x, y, z = a * width, b * height, (face * 2 - 3) * depth / 2
                    else:
                        x, y, z = (face * 2 - 7) * width / 2, b * height, a * depth
                    band = abs(a) < 0.07 or (face == 0 and abs(b - 0.5) < 0.07)
                    tone = (1.1, 0.9, 0.55, 0.7, 0.85)[face]
                    tint = ribbon if band else tuple(int(c * tone) for c in color)
                    add(cx + x, y + 0.02, cz + z, "+" if band else rng.choice(":;=#@"),
                        tint, 8.3 + index * 0.12, 5)
        for side in (-1, 1):
            for j in range(36):
                angle = math.tau * j / 36
                add(cx + side * 0.07 * (1 - math.cos(angle)),
                    height + 0.045 + 0.055 * abs(math.sin(angle)),
                    cz + 0.025 * math.sin(angle), "*" if j % 3 == 0 else "+",
                    ribbon, 8.3 + index * 0.12, 5)

    # A filled five-point star. Its light comes from the glyphs themselves.
    vertices = []
    for i in range(10):
        a = i * math.tau / 10
        radius = 0.12 if i % 2 == 0 else 0.052
        vertices.append((radius * math.sin(a), radius * math.cos(a)))
    for i, (ax, ay) in enumerate(vertices):
        bx, by = vertices[(i + 1) % 10]
        for step in range(12):
            u = step / 12
            for ring in range(1, 9):
                r = ring / 8
                add((ax + (bx - ax) * u) * r, 3.13 + (ay + (by - ay) * u) * r,
                    0, "*", (247, 217, 104), 10.5, 6)
    return points


def smoothstep(value):
    value = max(0, min(1, value))
    return value * value * (3 - 2 * value)


def animate_point(point, index, elapsed):
    """Return the current point position, glyph and opacity, or None before birth."""
    x, y, z, char = point.x, point.y, point.z, point.char
    if point.kind >= 7:
        return x, y, z, char, 1.0
    age = elapsed - point.reveal
    if age >= 3.6:
        return x, y, z, char, 1.0
    if point.kind == 2:
        if age <= 0:
            return None
        return x, y, z, "*" if age < 0.12 else char, smoothstep(age / 0.22)
    if point.kind == 6:
        if age <= 0:
            return None
        progress = smoothstep(age / 3.2)
        x += 0.16 * math.sin(math.pi * progress) * (1 - progress)
        y += 1.35 * (1 - progress)
        return x, y, z, char, smoothstep(age / 0.45)

    seed = (index * 0.61803398875) % 1
    foliage = point.kind <= 1
    age -= seed * (0.4 if foliage else 0.9)
    if age <= 0:
        return None
    progress = min(1, age / (1.0 if foliage else 1.6))
    ease = smoothstep(progress)
    remaining = 1 - ease
    if foliage:
        x *= ease
        z *= ease
        y += 0.10 * math.sin(seed * math.tau + progress * 8) * remaining
    if progress < 0.55:
        char = "."
    elif progress < 0.85:
        char = ":"
    return x, y, z, char, ease


class Scene:
    def __init__(self, width, height):
        self.width, self.height = width, height
        detail = min(1, max(0.32, width * height / 26000))
        self.points = make_model(detail)
        rng = random.Random(31)
        self.snow = [(rng.random(), rng.random(), rng.uniform(.025, .08), rng.random())
                     for _ in range(max(50, min(450, width * height // 50)))]

    def render(self, elapsed, color=True):
        width, height = self.width, self.height
        cells = [(" ", (0, 0, 0))] * (width * height)
        depth = [-math.inf] * len(cells)
        phase = max(0, elapsed)
        angle = (elapsed % TURN_SECONDS) * math.tau / TURN_SECONDS
        cosine, sine = math.cos(angle), math.sin(angle)
        scale = min(width / 8.2, (height - 3) / 4.1)
        center_x, floor_y = (width - 1) / 2, (height - 1) * 0.79

        for x, y, speed, seed in self.snow:
            col = int((x + 0.007 * math.sin(elapsed + seed * 20)) % 1 * width)
            row = int((y + elapsed * speed) % 1 * height)
            index = row * width + col
            brightness = int(100 + 130 * seed)
            cells[index] = ("*" if seed > .95 else ".", (brightness,) * 3)
            depth[index] = 6 if seed > .95 else -math.inf

        for index, p in enumerate(self.points):
            state = animate_point(p, index, phase)
            if state is None:
                continue
            x, y, z, char, opacity = state
            if p.kind != 6:
                x, z = x * cosine - z * sine, x * sine + z * cosine
            col = round(center_x + x * 2 * scale)
            row = round(floor_y + (-y * COS_TILT + z * SIN_TILT) * scale)
            if not (0 <= col < width and 0 <= row < height):
                continue
            cell = row * width + col
            distance = z * COS_TILT + y * SIN_TILT
            if distance < depth[cell]:
                continue
            shade = 1.0
            if p.kind in (0, 1, 2, 3):
                shade = max(.38, .80 + .40 * (z + .35 * x) / (math.hypot(x, z) or 1))
            if p.kind == 4:
                shade = .8 + .2 * math.sin(elapsed * 4 + index * .3)
            if p.kind == 6:
                shade = .95 + .35 * math.sin(elapsed * 3.3) ** 8 + .15 * math.sin(elapsed * 2)
                shade += .12 * math.sin(elapsed * 8 + index * .731) ** 16
            rgb = tuple(min(255, int(c * shade * opacity)) for c in (p.red, p.green, p.blue))
            cells[cell] = char, rgb
            depth[cell] = distance

        lines = []
        for offset in range(0, len(cells), width):
            parts, previous = [], None
            for char, rgb in cells[offset:offset + width]:
                if color and rgb != previous and char != " ":
                    parts.append("\x1b[38;2;%d;%d;%dm" % rgb)
                    previous = rgb
                parts.append(char)
            lines.append("".join(parts) + (RESET if color else ""))
        return "\n".join(lines)


def enable_windows_terminal():
    if os.name != "nt":
        return lambda: None
    import ctypes
    from ctypes import wintypes

    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.GetStdHandle.argtypes = (wintypes.DWORD,)
    kernel.GetStdHandle.restype = wintypes.HANDLE
    kernel.GetConsoleMode.argtypes = (wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD))
    kernel.SetConsoleMode.argtypes = (wintypes.HANDLE, wintypes.DWORD)
    output = kernel.GetStdHandle(-11)
    mode = wintypes.DWORD()
    if not kernel.GetConsoleMode(output, ctypes.byref(mode)):
        return None
    if not kernel.SetConsoleMode(output, mode.value | 0x0004):
        return None
    return lambda: kernel.SetConsoleMode(output, mode.value)


def frame_size(size, args):
    return min(args.width or 240, size.columns - 1), min(args.height or 100, size.lines - 1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--still", action="store_true", help="print one frame and exit")
    parser.add_argument("--no-color", action="store_true", help="disable ANSI colors")
    parser.add_argument("--width", type=int, help="maximum width in columns (64-320)")
    parser.add_argument("--height", type=int, help="maximum height in rows (28-160)")
    parser.add_argument("--fps", type=int, default=FPS, help="animation target FPS (1-60)")
    parser.add_argument("--time", type=float, default=START_TIME, help="seconds since the construction began")
    args = parser.parse_args()
    if args.width is not None and not 64 <= args.width <= 320:
        parser.error("--width must be between 64 and 320")
    if args.height is not None and not 28 <= args.height <= 160:
        parser.error("--height must be between 28 and 160")
    if not 1 <= args.fps <= 60:
        parser.error("--fps must be between 1 and 60")
    if not math.isfinite(args.time):
        parser.error("--time must be finite")

    restore_mode = enable_windows_terminal() if sys.stdout.isatty() else None
    if restore_mode is None:
        print(Scene(args.width or 100, args.height or 42).render(args.time, False))
        return
    try:
        if args.still:
            width, height = frame_size(shutil.get_terminal_size((100, 42)), args)
            if width < 40 or height < 18:
                parser.exit(1, "Resize terminal to at least 41 x 19.\n")
            print(Scene(width, height).render(args.time, not args.no_color))
            return
        start = time.perf_counter()
        scene, previous_size = None, None
        sys.stdout.write("\x1b[?1049h\x1b[?25l")
        try:
            while True:
                now = time.perf_counter()
                width, height = frame_size(shutil.get_terminal_size((100, 42)), args)
                if (width, height) != previous_size:
                    previous_size = width, height
                    scene = Scene(width, height) if width >= 40 and height >= 18 else None
                    sys.stdout.write("\x1b[2J")
                frame = ("Resize terminal to at least 41 x 19."[:max(0, width)] if scene is None
                         else scene.render(now - start + args.time, not args.no_color))
                sys.stdout.write("\x1b[H" + frame)
                sys.stdout.flush()
                time.sleep(max(0, 1 / args.fps - (time.perf_counter() - now)))
        except KeyboardInterrupt:
            pass
        finally:
            sys.stdout.write(RESET + "\x1b[?25h\x1b[?1049l")
            sys.stdout.flush()
    finally:
        restore_mode()


if __name__ == "__main__":
    main()
