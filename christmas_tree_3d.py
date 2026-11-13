"""A full-screen 3D ASCII Christmas scene. Run with Python 3 in a terminal."""

import argparse
import math
import os
import random
import shutil
import sys
import time
from dataclasses import dataclass

FPS = 30
TURN_SECONDS = 8
RESET = "\x1b[0m"
GREENS = (22, 28, 34, 35, 42, 78)
GOLDS = (172, 178, 220, 226, 229, 230)
BAUBLES = (203, 215, 81, 213, 229)
TILT = math.radians(18)
SIN_TILT, COS_TILT = math.sin(TILT), math.cos(TILT)


@dataclass(frozen=True, slots=True)
class Point:
    x: float
    y: float
    z: float
    char: str
    color: int


def make_tree(detail):
    rng = random.Random(41)
    needles, decorations = [], []
    tiers = ((10.0, 4.0, 5.6), (7.5, -1.5, 8.3), (4.0, -7.4, 11.5))
    for tier, (top, bottom, width) in enumerate(tiers):
        rings = round((top - bottom) / detail)
        for ring in range(rings + 1):
            fraction = ring / rings
            radius = width * fraction
            count = max(1, round(math.tau * radius / detail))
            for index in range(count):
                angle = math.tau * (index + ring * 0.38) / count
                r = radius * (1 + 0.07 * math.cos(9 * angle))
                y = top + (bottom - top) * fraction
                y += 0.23 * fraction * math.cos(9 * angle)
                needles.append(Point(r * math.cos(angle), y, r * math.sin(angle),
                                     rng.choice("::++**##"), -1))

        for index in range(round(math.tau * width / detail)):
            angle = index * detail / width
            fraction = 0.78 + 0.09 * math.sin(4 * angle + tier)
            r = width * fraction * (1 + 0.07 * math.cos(9 * angle)) + 0.32
            y = top + (bottom - top) * fraction
            bulb = index % 8 == 0
            decorations.append(Point(r * math.cos(angle), y, r * math.sin(angle),
                                     "*" if bulb else ".", 220 if bulb else 178))
        for index in range(15 + tier * 8):
            angle = index * 2.39996 + tier * 0.74
            fraction = rng.uniform(0.37, 0.94)
            r = width * fraction * (1 + 0.07 * math.cos(9 * angle)) + 0.55
            y = top + (bottom - top) * fraction
            decorations.append(Point(r * math.cos(angle), y, r * math.sin(angle),
                                     rng.choice("oO@"), rng.choice(BAUBLES)))

    for row in range(round(6 / detail) + 1):
        y = -11.8 + row * detail
        for index in range(24):
            angle = math.tau * index / 24
            needles.append(Point(1.15 * math.cos(angle), y, 1.15 * math.sin(angle),
                                 "|" if index % 3 else "#", (94, 130, 136)[index % 3]))
    return needles, decorations


def make_rug(detail):
    points = []
    for iz in range(-math.ceil(13 / detail), math.ceil(13 / detail) + 1):
        z = iz * detail
        for ix in range(-math.ceil(17 / detail), math.ceil(17 / detail) + 1):
            x = ix * detail
            radius = math.hypot(x / 17, z / 12.2)
            if radius > 1:
                continue
            angle = math.atan2(z / 12.2, x / 17)
            if radius > 0.97:
                char, color = "=", 215
            elif radius > 0.91:
                char, color = ("o", 203) if math.cos(32 * angle) > 0.3 else ("-", 124)
            elif radius > 0.86:
                char, color = "=", 173
            elif abs(radius - 0.67 - 0.12 * math.cos(6 * angle)) < 0.027:
                char, color = "+", 167
            else:
                char, color = (".:+:"[(ix + iz) % 4], 89 + (ix - iz) % 2)
            points.append(Point(x, -12, z, char, color))

    for index in range(96):
        angle = math.tau * index / 96
        for extension in (1.01, 1.035):
            x = 17 * extension * math.cos(angle)
            z = 12.2 * extension * math.sin(angle)
            points.append(Point(x, -12, z, "~", 179))
    return points


def make_gift(cx, cz, width, height, length, colors, ribbon, detail):
    points = []
    nx, ny, nz = (max(2, math.ceil(size / detail)) for size in (width, height, length))
    for iy in range(ny + 1):
        y = -11.93 + height * iy / ny
        for ix in range(nx + 1):
            x = width * (ix / nx - 0.5)
            for iz in range(nz + 1):
                edge_x, edge_z = ix in (0, nx), iz in (0, nz)
                top, bottom = iy == ny, iy == 0
                if not (edge_x or edge_z or top or bottom):
                    continue
                z = length * (iz / nz - 0.5)
                is_ribbon = ((abs(x) < width * 0.13 and (top or edge_z)) or
                             (abs(z) < length * 0.13 and (top or edge_x)))
                if is_ribbon:
                    char, color = ("+" if top else "|", ribbon)
                elif edge_x and edge_z:
                    char, color = "|", colors[2]
                elif top or bottom or iy == ny - 1:
                    char, color = "-", colors[2]
                else:
                    char, color = ("#" if (ix + iz + iy) % 3 else ":", colors[0 if edge_x else 1])
                points.append(Point(cx + x, y, cz + z, char, color))

    for side in (-1, 1):
        for index in range(28):
            angle = math.tau * index / 28
            dx = side * width * 0.17 * (1 - math.cos(angle))
            y = -11.93 + height + 0.10 + 0.67 * abs(math.sin(angle))
            points.append(Point(cx + dx, y, cz + 0.23 * math.sin(angle),
                                "/" if side < 0 else "\\", ribbon))
    points.append(Point(cx, -11.70 + height, cz, "*", ribbon))
    return points


def make_star():
    points = []
    vertices = []
    for index in range(10):
        angle = math.tau * index / 10
        radius = 2.65 if index % 2 == 0 else 1.14
        vertices.append((radius * math.sin(angle), radius * math.cos(angle)))
    for index, (ax, ay) in enumerate(vertices):
        bx, by = vertices[(index + 1) % len(vertices)]
        for step in range(14):
            edge = step / 14
            x, y = ax + (bx - ax) * edge, ay + (by - ay) * edge
            for ring in range(1, 11):
                radius = ring / 10
                for z in (-0.29, 0.29):
                    points.append(Point(x * radius, y * radius, z, "*" if ring == 10 else "+", 220))
            points.append(Point(x, y, 0, "*", 226))
    return points


class Scene:
    def __init__(self, width, height):
        self.width, self.height = width, height
        self.scale = min((width - 4) / 72, (height - 3) / 35)
        detail = max(0.24, 0.62 / self.scale)
        self.tree, self.decorations = make_tree(detail)
        self.stage = make_rug(detail)
        for args in (
            (-10, 1, 4.7, 3.4, 3.9, (88, 124, 203), 229),
            (9.5, 2, 5.1, 4.0, 4.1, (24, 31, 81), 231),
            (-4.9, 8.3, 4.3, 2.6, 3.1, (90, 127, 213), 229),
            (5.8, 7.1, 4.5, 2.9, 3.3, (130, 172, 215), 231),
        ):
            self.stage.extend(make_gift(*args, detail))
        self.star = make_star()
        rng = random.Random(73)
        self.snow = [(rng.random(), rng.random(), rng.uniform(0.035, 0.09), rng.random())
                     for _ in range(min(420, max(30, width * height // 28)))]

    def render(self, elapsed, color=True):
        width, height = self.width, self.height
        canvas = [(" ", 0)] * (width * height)
        depth = [-math.inf] * len(canvas)

        for x, y, speed, seed in self.snow:
            col = int(((x + 0.018 * math.sin(elapsed * 0.85 + seed * 21)) % 1) * width)
            row = int(((y + elapsed * speed) % 1) * height)
            char, fg = ("*", 253) if seed > 0.92 else (("." if seed > 0.32 else "'"), 244)
            idx = row * width + col
            canvas[idx] = char, fg
            if seed > 0.92:
                depth[idx] = 30

        angle = math.tau * elapsed / TURN_SECONDS
        cosine, sine = math.cos(angle), math.sin(angle)
        star_angle = 2 * angle + 0.25
        star_cosine, star_sine = math.cos(star_angle), math.sin(star_angle)
        scale = self.scale
        center_x, center_y = (width - 1) / 2, (height - 1) / 2 - 0.8 * scale

        def plot(x, y, z, char, fg, bias=0):
            col = round(center_x + x * 2 * scale)
            row = round(center_y + (-y * COS_TILT + z * SIN_TILT) * scale)
            if 0 <= col < width and 0 <= row < height:
                idx = row * width + col
                distance = z * COS_TILT + y * SIN_TILT + bias
                if distance >= depth[idx]:
                    canvas[idx] = char, fg
                    depth[idx] = distance

        for point in self.stage:
            x = point.x * cosine - point.z * sine
            z = point.x * sine + point.z * cosine
            plot(x, point.y, z, point.char, point.color)

        for point in self.tree:
            x = point.x * cosine - point.z * sine
            z = point.x * sine + point.z * cosine
            fg = point.color
            if fg == -1:
                radius = math.hypot(x, z) or 1
                shade = max(0, min(5, int(2.4 + (z + 0.63 * x) * 2.4 / radius)))
                fg = GREENS[shade]
            plot(x, point.y, z, point.char, fg)

        for index, point in enumerate(self.decorations):
            x = point.x * cosine - point.z * sine
            z = point.x * sine + point.z * cosine
            flash = point.char == "*" and math.sin(elapsed * 5.6 + index * 0.61) > 0.52
            plot(x, point.y, z, "+" if flash else point.char, 230 if flash else point.color, 0.55)

        pulse = (1 + math.sin(elapsed * math.tau / 1.6)) / 2
        star_height = 12.15
        for point in self.star:
            x = point.x * star_cosine - point.z * star_sine
            z = point.x * star_sine + point.z * star_cosine
            edge = 1 if point.char == "*" else 0
            fg = GOLDS[min(5, 1 + int(pulse * 3) + edge)]
            plot(x, point.y + star_height, z, point.char, fg, 0.2)

        for index in range(8):
            orbit = elapsed * 1.2 + index * math.tau / 8
            glow = math.sin(elapsed * 4 + index)
            if glow > 0.25:
                radius = 3.0 + index % 3 * 0.65
                plot(radius * math.cos(orbit), star_height + 2.6 * math.sin(orbit),
                     1.4 * math.sin(orbit * 2), "+" if glow > 0.75 else ".", 229)

        return encode_frame(canvas, width, color)


def encode_frame(canvas, width, color):
    lines = []
    for offset in range(0, len(canvas), width):
        pieces, previous = [], 0
        for char, fg in canvas[offset:offset + width]:
            if color and fg != previous:
                pieces.append(f"\x1b[38;5;{fg}m" if fg else "\x1b[39m")
                previous = fg
            pieces.append(char)
        if color:
            pieces.append(RESET)
        lines.append("".join(pieces))
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
    parser.add_argument("--width", type=int, help="maximum width in columns (64-240)")
    parser.add_argument("--height", type=int, help="maximum height in rows (28-100)")
    parser.add_argument("--fps", type=int, default=FPS, help="animation target FPS (1-60)")
    args = parser.parse_args()
    if args.width is not None and not 64 <= args.width <= 240:
        parser.error("--width must be between 64 and 240")
    if args.height is not None and not 28 <= args.height <= 100:
        parser.error("--height must be between 28 and 100")
    if not 1 <= args.fps <= 60:
        parser.error("--fps must be between 1 and 60")

    restore_mode = enable_windows_terminal() if sys.stdout.isatty() else None
    if restore_mode is None:
        print(Scene(args.width or 100, args.height or 42).render(0, False))
        return

    try:
        if args.still:
            width, height = frame_size(shutil.get_terminal_size((100, 42)), args)
            if width < 40 or height < 18:
                parser.exit(1, "Resize terminal to at least 41 x 19.\n")
            print(Scene(width, height).render(0, not args.no_color))
            return

        start = time.perf_counter()
        scene, previous_size = None, None
        sys.stdout.write("\x1b[?1049h\x1b[?25l")
        try:
            while True:
                frame_start = time.perf_counter()
                width, height = frame_size(shutil.get_terminal_size((100, 42)), args)
                if (width, height) != previous_size:
                    previous_size = width, height
                    scene = Scene(width, height) if width >= 40 and height >= 18 else None
                    sys.stdout.write("\x1b[2J")
                if scene is None:
                    frame = "Resize terminal to at least 41 x 19."[:max(0, width)]
                else:
                    frame = scene.render(frame_start - start, not args.no_color)
                sys.stdout.write("\x1b[H" + frame)
                sys.stdout.flush()
                time.sleep(max(0, 1 / args.fps - (time.perf_counter() - frame_start)))
        except KeyboardInterrupt:
            pass
        finally:
            sys.stdout.write(RESET + "\x1b[?25h\x1b[?1049l")
            sys.stdout.flush()
    finally:
        restore_mode()


if __name__ == "__main__":
    main()
