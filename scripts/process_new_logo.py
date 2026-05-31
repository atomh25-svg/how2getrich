"""Process Logo2.jpg into src/assets/logo.png:
1. Remove the dark navy background (additive-light alpha mask)
2. Apply a radial mask centered on the rocket body to clip the flame trail
3. Rotate 10° counter-clockwise so the nose sits closer to vertical
4. Crop to the non-zero bounding box

Usage:
    python3 scripts/process_new_logo.py
"""

from pathlib import Path

import numpy as np
from PIL import Image


def main() -> None:
    repo = Path(__file__).resolve().parents[1]
    src = repo / "Logo2.jpg"
    dst = repo / "src/assets/logo.png"

    img = Image.open(src).convert("RGB")
    arr = np.asarray(img, dtype=np.float32) / 255.0
    h, w = arr.shape[:2]

    # === 1. Background removal (additive-light un-composite) ===
    edges = np.concatenate(
        [
            arr[:5, :, :].reshape(-1, 3),
            arr[-5:, :, :].reshape(-1, 3),
            arr[:, :5, :].reshape(-1, 3),
            arr[:, -5:, :].reshape(-1, 3),
        ]
    )
    bg = np.percentile(edges, 95, axis=0)
    print(f"detected background: rgb({(bg * 255).astype(int).tolist()})")

    above = np.clip((arr - bg) / np.maximum(1.0 - bg, 1e-6), 0.0, 1.0)
    alpha = above.max(axis=2)
    alpha = np.clip((alpha - 0.02) / 0.98, 0.0, 1.0)
    alpha = alpha ** 0.65

    # === 2. Combined radial + directional mask to clip the flame trail ===
    # Rocket body center estimated from visual inspection of the source.
    cx, cy = 550, 475
    ys, xs = np.mgrid[0:h, 0:w]

    # 2a. Radial mask catches dust/sparks far from the rocket (anywhere)
    inner_r, outer_r = 320, 370
    dist = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
    radial_mask = np.clip((outer_r - dist) / (outer_r - inner_r), 0.0, 1.0)

    # 2b. Directional mask clips the flame plume under the rocket.
    # Rocket axis points from tail (430, 670) toward nose (810, 235).
    # Trail direction (away from nose, into image lower-left):
    trail_unit = np.array([-0.659, 0.752])  # unit vector toward trail
    # Project each pixel onto the trail direction, measured from rocket center.
    proj = (xs - cx) * trail_unit[0] + (ys - cy) * trail_unit[1]
    # Pixels with proj > ~240 are past the tail in the trail direction.
    # Linear fade: keep if proj < 240, clip fully if proj > 300.
    trail_clip = np.clip((300.0 - proj) / 60.0, 0.0, 1.0)

    alpha = alpha * radial_mask * trail_clip

    # === 2c. Apply purple→pink→purple horizontal tint (matching wordmark) ===
    # Find rocket bounding box in x (where alpha is non-trivial), so the
    # gradient is centered on the rocket itself, not the image.
    visible_cols = np.any(alpha > 0.08, axis=0)
    if visible_cols.any():
        xmin, xmax = np.where(visible_cols)[0][[0, -1]]
    else:
        xmin, xmax = 0, w - 1
    rocket_cx = (xmin + xmax) / 2.0
    rocket_half_w = max((xmax - xmin) / 2.0, 1.0)

    # Per-column normalized distance from rocket center: 0 at center, 1 at edges
    x_rel = np.clip(np.abs((np.arange(w) - rocket_cx) / rocket_half_w), 0.0, 1.0)

    # Rocket tint colors — deep green family centered on #24c809
    violet = np.array([0x24, 0xc8, 0x09], dtype=np.float32) / 255.0  # #24c809 (brand green)
    fuchsia = np.array([0x18, 0x90, 0x05], dtype=np.float32) / 255.0  # #189005 (slightly darker for subtle depth)

    # Per-column target color: fuchsia at center, violet at edges
    col_target = fuchsia[None, :] * (1 - x_rel[:, None]) + violet[None, :] * x_rel[:, None]
    target_2d = np.broadcast_to(col_target[None, :, :], (h, w, 3))

    # Color-multiply blend: preserves brightness, shifts hue toward target.
    # White highlights take on the target's hue at full saturation;
    # darker pixels become darker shades of the target.
    tinted = arr * target_2d

    # Neon brightness boost — bump output ~18% and clip
    tinted = np.clip(tinted * 1.18, 0.0, 1.0)

    rgba = np.concatenate([tinted, alpha[..., None]], axis=2)
    rgba_uint8 = (rgba * 255).clip(0, 255).astype(np.uint8)
    result = Image.fromarray(rgba_uint8, "RGBA")

    # === 3. Rotate 20° counter-clockwise (nose tilts further toward vertical) ===
    result = result.rotate(20, resample=Image.BICUBIC, expand=True)

    # === 4. Crop to non-zero bounding box (with small padding) ===
    result_arr = np.asarray(result)
    visible = result_arr[..., 3] > 4  # ignore <2% alpha noise
    if visible.any():
        rows = np.any(visible, axis=1)
        cols = np.any(visible, axis=0)
        rmin, rmax = np.where(rows)[0][[0, -1]]
        cmin, cmax = np.where(cols)[0][[0, -1]]
        pad = 24
        rmin = max(0, rmin - pad)
        cmin = max(0, cmin - pad)
        rmax = min(result_arr.shape[0] - 1, rmax + pad)
        cmax = min(result_arr.shape[1] - 1, cmax + pad)
        result = result.crop((cmin, rmin, cmax + 1, rmax + 1))

    result.save(dst)
    print(f"wrote {dst}  ({result.size[0]}x{result.size[1]} RGBA)")


if __name__ == "__main__":
    main()
