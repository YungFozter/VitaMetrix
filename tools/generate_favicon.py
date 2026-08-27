import os
import base64
from PIL import Image, ImageDraw

def generate_favicons():
    img_path = r"C:\Users\iOs\.gemini\antigravity-ide\brain\e0490037-6d6b-4f4f-954a-317ad33e55ad\.user_uploaded\media_1787789709170.png"
    im = Image.open(img_path).convert("RGBA")

    # Crop the exact 128px card from the asset sheet
    card = im.crop((42, 674, 270, 902))
    cw, ch = card.size

    # Create smooth rounded squircle mask
    mask = Image.new("L", (cw, ch), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([(0, 0), (cw - 1, ch - 1)], radius=42, fill=255)
    card.putalpha(mask)

    static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "static")
    os.makedirs(static_dir, exist_ok=True)

    # Master high-res
    master_path = os.path.join(static_dir, "favicon-master.png")
    card.save(master_path)

    # Standard browser favicon PNGs
    card.resize((16, 16), Image.Resampling.LANCZOS).save(os.path.join(static_dir, "favicon-16x16.png"))
    card.resize((32, 32), Image.Resampling.LANCZOS).save(os.path.join(static_dir, "favicon-32x32.png"))
    card.resize((48, 48), Image.Resampling.LANCZOS).save(os.path.join(static_dir, "favicon-48x48.png"))
    card.resize((64, 64), Image.Resampling.LANCZOS).save(os.path.join(static_dir, "favicon-64x64.png"))
    card.resize((128, 128), Image.Resampling.LANCZOS).save(os.path.join(static_dir, "favicon-128x128.png"))
    card.resize((180, 180), Image.Resampling.LANCZOS).save(os.path.join(static_dir, "apple-touch-icon.png"))
    card.resize((192, 192), Image.Resampling.LANCZOS).save(os.path.join(static_dir, "favicon-192x192.png"))
    card.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(static_dir, "favicon-512x512.png"))

    # Multi-size ICO file for maximum legacy and modern browser compatibility
    ico_path = os.path.join(static_dir, "favicon.ico")
    card.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128)])

    # SVG Favicon with embedded vector squircle & base64
    with open(master_path, "rb") as f:
        b64_data = base64.b64encode(f.read()).decode("utf-8")

    svg_path = os.path.join(static_dir, "favicon.svg")
    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 228 228" width="32" height="32">
  <defs>
    <clipPath id="squircleClip">
      <rect x="0" y="0" width="228" height="228" rx="42" ry="42" />
    </clipPath>
  </defs>
  <image width="228" height="228" href="data:image/png;base64,{b64_data}" clip-path="url(#squircleClip)" />
</svg>'''

    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(svg_content)

    print("All favicons (16x16, 32x32, 64x64, 180x180, 192x192, 512x512, .ico, .svg) generated successfully!")

if __name__ == "__main__":
    generate_favicons()
