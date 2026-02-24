from pathlib import Path
from PIL import Image, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "src-next" / "assets" / "maid-image" / "c625.jpg"
ICONS_DIR = ROOT / "src-tauri" / "icons"

PNG_SIZES = {
    "32x32.png": 32,
    "128x128.png": 128,
    "128x128@2x.png": 256,
    "icon.png": 512,
    "Square30x30Logo.png": 30,
    "Square44x44Logo.png": 44,
    "Square71x71Logo.png": 71,
    "Square89x89Logo.png": 89,
    "Square107x107Logo.png": 107,
    "Square142x142Logo.png": 142,
    "Square150x150Logo.png": 150,
    "Square284x284Logo.png": 284,
    "Square310x310Logo.png": 310,
    "StoreLogo.png": 50,
}

ICO_SIZES = [
    (16, 16),
    (20, 20),
    (24, 24),
    (32, 32),
    (40, 40),
    (48, 48),
    (64, 64),
    (128, 128),
    (256, 256),
]
ICNS_SIZES = [(16, 16), (32, 32), (64, 64), (128, 128), (256, 256), (512, 512)]


def make_icon_master(source_path: Path) -> Image.Image:
    image = Image.open(source_path).convert("RGBA")
    if image.width == image.height:
        return image

    # Preserve full image content: pad to square without cropping.
    side = max(image.width, image.height)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    offset_x = (side - image.width) // 2
    offset_y = (side - image.height) // 2
    canvas.paste(image, (offset_x, offset_y))
    return canvas


def render_icon_size(base_image: Image.Image, size: int) -> Image.Image:
    target = ImageOps.fit(base_image, (size, size), method=Image.Resampling.LANCZOS)
    if size <= 32:
        target = target.filter(ImageFilter.UnsharpMask(radius=1.1, percent=200, threshold=2))
    elif size <= 64:
        target = target.filter(ImageFilter.UnsharpMask(radius=1.0, percent=170, threshold=2))
    elif size <= 128:
        target = target.filter(ImageFilter.UnsharpMask(radius=0.8, percent=130, threshold=1))
    return target


def save_png_targets(base_image: Image.Image) -> None:
    for file_name, size in PNG_SIZES.items():
        target = render_icon_size(base_image, size)
        target.save(ICONS_DIR / file_name, format="PNG")


def save_ico(base_image: Image.Image) -> None:
    icon_path = ICONS_DIR / "icon.ico"
    # Use largest generated icon as source and let PIL embed multi-size variants.
    source = render_icon_size(base_image, 256)
    source.save(icon_path, format="ICO", sizes=ICO_SIZES)


def save_icns(base_image: Image.Image) -> None:
    icon_path = ICONS_DIR / "icon.icns"
    source = render_icon_size(base_image, 1024)
    source.save(icon_path, format="ICNS", sizes=ICNS_SIZES)


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(f"Source image not found: {SOURCE}")
    ICONS_DIR.mkdir(parents=True, exist_ok=True)

    base = make_icon_master(SOURCE)
    save_png_targets(base)
    save_ico(base)
    save_icns(base)

    print(f"Generated Tauri icons from: {SOURCE}")


if __name__ == "__main__":
    main()
