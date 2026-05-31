"""Convert hero-rocket.jpg to a transparent-bg PNG.

The source is the LaunchFly hero rocket image (1280x1280) with a deep navy
background. We treat the rocket+rings+contrail as additive light over the
background and compute alpha as the channel-wise excess above the detected
background color. This preserves the soft glow halos, the gradient contrail,
and the bright neon edges naturally — no hard-edged matte.

Output is the same dimensions, just with the dark background fully transparent
so the rocket/rings/trail float free against whatever's underneath.

Usage:
    python3 scripts/process_hero_rocket.py
"""

from pathlib import Path

import numpy as np
from PIL import Image


def main() -> None:
    repo = Path(__file__).resolve().parents[1]
    # Source: PNG with pure-black background (current rocket image)
    src = repo / "src/assets/hero-rocket-source.png"
    dst = repo / "src/assets/hero-rocket.png"

    img = Image.open(src).convert("RGB")
    arr = np.asarray(img, dtype=np.float32) / 255.0

    # Sample background from the TOP-LEFT and TOP-RIGHT corners only.
    # The contrail extends into the bottom-left so sampling the full edge would
    # misdetect bright pink as the background. The top corners are pure navy.
    h, w = arr.shape[:2]
    corner_size = max(60, h // 20)
    bg_samples = np.concatenate(
        [
            arr[:corner_size, :corner_size, :].reshape(-1, 3),
            arr[:corner_size, -corner_size:, :].reshape(-1, 3),
            arr[:5, :, :].reshape(-1, 3),  # full top strip
        ]
    )
    bg = np.median(bg_samples, axis=0)
    print(f"detected background: rgb({(bg * 255).astype(int).tolist()})")

    # Channel-wise excess above background, normalized
    above = np.clip((arr - bg) / np.maximum(1.0 - bg, 1e-6), 0.0, 1.0)
    brightness = above.max(axis=2)

    # Wider anti-aliasing band + un-premultiplied colors to kill the dark fringe.
    # The "black outline" was caused by dark RGB values having partial alpha; we
    # normalize each fringe pixel back to its full saturated color so it reads
    # as "smoke fading" rather than "darkness fading."
    #   brightness < 0.03 → fully transparent
    #   brightness > 0.13 → fully opaque
    #   in between        → 10%-wide soft ramp for smooth edges
    alpha = np.clip((brightness - 0.03) / 0.10, 0.0, 1.0)

    # Un-premultiply: divide each channel by its brightness so dark fringe
    # pixels become saturated versions of the same hue. Floor to avoid div-by-0.
    brightness_safe = np.maximum(brightness[..., None], 1e-3)
    rgb_out = np.clip(arr / brightness_safe, 0.0, 1.0)
    # Where the pixel is fully opaque, prefer the original (un-normalized) RGB
    # so we don't over-saturate already-bright pixels. Mix based on alpha.
    blend = alpha[..., None]
    rgb_final = arr * blend + rgb_out * (1 - blend) * blend  # only mix in fringe
    # Simpler: just blend toward saturated near edges, original in opaque areas
    rgb_final = np.where(blend > 0.95, arr, rgb_out)

    rgba = np.concatenate([rgb_final, alpha[..., None]], axis=2)
    rgba_uint8 = (rgba * 255).clip(0, 255).astype(np.uint8)

    Image.fromarray(rgba_uint8, mode="RGBA").save(dst)
    print(f"wrote {dst}  ({rgba_uint8.shape[1]}x{rgba_uint8.shape[0]} RGBA)")


if __name__ == "__main__":
    main()
