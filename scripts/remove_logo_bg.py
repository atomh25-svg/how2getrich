"""Remove the dark navy background from logo.png, preserving the cyan glow halo.

Treats the rocket as an additive (glow) layer over the background. For each
pixel, alpha is the max channel-wise excess above the detected background
color, normalized into [0, 1]. The result preserves anti-aliased edges and
the bloom around the rocket.

Usage:
    python3 scripts/remove_logo_bg.py [SRC] [DST]

Defaults: src/assets/logo-original.png -> src/assets/logo.png
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image


def main() -> None:
    repo = Path(__file__).resolve().parents[1]
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else repo / "src/assets/logo-original.png"
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else repo / "src/assets/logo.png"

    img = Image.open(src).convert("RGB")
    arr = np.asarray(img, dtype=np.float32) / 255.0  # H x W x 3 in [0, 1]

    # Sample background from a 5px-wide band around the entire edge.
    edges = np.concatenate(
        [
            arr[:5, :, :].reshape(-1, 3),
            arr[-5:, :, :].reshape(-1, 3),
            arr[:, :5, :].reshape(-1, 3),
            arr[:, -5:, :].reshape(-1, 3),
        ]
    )
    # 95th percentile so a vignette toward center doesn't leave residue
    bg = np.percentile(edges, 95, axis=0)
    print(f"detected background: {(bg * 255).astype(int).tolist()}", file=sys.stderr)

    # How far above the bg is each pixel per channel, normalized into [0, 1]
    above = np.clip((arr - bg) / np.maximum(1.0 - bg, 1e-6), 0.0, 1.0)
    alpha = above.max(axis=2)

    # Soft floor: anything below 2% additive light is fully transparent
    alpha = np.clip((alpha - 0.02) / 0.98, 0.0, 1.0)
    # Stronger gamma boost — pushes more of the halo into visible territory
    alpha = alpha ** 0.65

    rgba = np.concatenate([arr, alpha[..., None]], axis=2)
    out = (rgba * 255).clip(0, 255).astype(np.uint8)

    Image.fromarray(out, "RGBA").save(dst)
    print(f"wrote {dst}  ({out.shape[1]}x{out.shape[0]} RGBA)", file=sys.stderr)


if __name__ == "__main__":
    main()
