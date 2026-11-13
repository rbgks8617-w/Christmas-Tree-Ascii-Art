# ASCII Christmas Tree

A detailed 3D ASCII Christmas scene with snow-covered branches, gold garlands,
170 warm lights, red and gold ornaments, gifts, a woven rug, and a glowing star.

Open index.html in a browser. The scene starts at 13.4 seconds to show the completed
tree, then repeats a 20-second sequence with branches and decorations appearing
from the ground up. The two buttons pause playback and restart the sequence.
Reduced-motion preferences pause the initial scene.

For GitHub Pages, publish the main branch from / (root). No build step is required.

The Python terminal version uses the standard library. Run:

    python christmas_tree_3d.py

To watch the construction from the beginning:

    python christmas_tree_3d.py --time 0

The JavaScript model is generated from make_model() in christmas_tree_3d.py.
The reconstruction follows the supplied recording's scene and timing. Its point
geometry, ornament positions and snow particles are newly generated.
