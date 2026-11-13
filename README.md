# ASCII Christmas Tree

A detailed 3D ASCII Christmas scene with snow-covered branches, gold garlands,
170 warm lights, red and gold ornaments, gifts, a woven rug, and a glowing star.

The scene starts with the full trunk already standing. Leaves grow outward from
it, then particles gradually gather into garlands, ornaments and presents. The
star descends from the sky and settles with a soft, pulsing glow. Construction
plays once, after which the completed tree keeps rotating every 20 seconds.
The controls pause the animation or replay construction. Reduced-motion
preferences show the completed tree paused.

For local viewing, run this command in the project directory and open
http://localhost:8000:

    python -m http.server 8000

The music button loads the official YouTube player for KRtvCCDbLgQ and repeats
that song. A click is required to start sound; some browsers may require another
click after loading. The player stays visible with its own playback controls.
Playback requires internet access and permission from YouTube and the uploader
to embed the track. If playback is unavailable, the panel shows a message and a
YouTube Music link. Opening index.html directly still runs the animation, but
music requires an HTTP(S) address.

For GitHub Pages, publish the main branch from / (root). No build step is required.

The Python terminal version uses the standard library. Run:

    python christmas_tree_3d.py

To preview the completed tree:

    python christmas_tree_3d.py --time 15

The JavaScript model is generated from make_model() in christmas_tree_3d.py.
The scene is based on the supplied recording with customized construction and
star animation. Its geometry, ornament positions and snow particles are newly
generated. Music is available in the browser version only.
