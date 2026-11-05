import math
import random
from PIL import Image, ImageDraw, ImageFilter
from app.database.database import SessionLocal
from app.models.patient import Patient
from app.models.screening import Screening
from app.services.ml_service import predict_with_gradcam

def generate_synthetic_fundus(severity=0, seed=42):
    random.seed(seed)
    w, h = 512, 512
    img = Image.new("RGB", (w, h), color=(10, 10, 15))
    draw = ImageDraw.Draw(img)

    # Retinal circle
    cx, cy, r = w // 2, h // 2, 230
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(168, 50, 25))

    # Gradient texture
    for rad in range(r, 0, -4):
        ratio = rad / r
        red = int(140 + 60 * ratio)
        green = int(35 + 30 * ratio)
        blue = int(15 + 15 * ratio)
        draw.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=(red, green, blue))

    # Optic disc (nasal side)
    od_x, od_y = cx - 110, cy
    od_r = 38
    draw.ellipse([od_x - od_r, od_y - od_r, od_x + od_r, od_y + od_r], fill=(245, 215, 120))
    draw.ellipse([od_x - od_r//2, od_y - od_r//2, od_x + od_r//2, od_y + od_r//2], fill=(255, 240, 170))

    # Macula (temporal side)
    mac_x, mac_y = cx + 80, cy + 10
    draw.ellipse([mac_x - 30, mac_y - 30, mac_x + 30, mac_y + 30], fill=(130, 30, 15))
    draw.ellipse([mac_x - 10, mac_y - 10, mac_x + 10, mac_y + 10], fill=(95, 20, 10))

    # Blood vessels from optic disc
    vessel_color = (110, 20, 15)
    for angle in [-60, -30, 0, 30, 60, 120, 150, 180, 210, 240]:
        rad = math.radians(angle)
        start_x, start_y = od_x, od_y
        for step in range(1, 15):
            end_x = start_x + math.cos(rad) * 16 + random.randint(-4, 4)
            end_y = start_y + math.sin(rad) * 16 + random.randint(-4, 4)
            width = max(1, 4 - step // 4)
            draw.line([start_x, start_y, end_x, end_y], fill=vessel_color, width=width)
            start_x, end_y = end_x, end_y

    # Add lesions based on severity
    if severity >= 1:
        # Microaneurysms (tiny red dots)
        for _ in range(10 * severity):
            lx = cx + random.randint(-150, 150)
            ly = cy + random.randint(-150, 150)
            if (lx - cx)**2 + (ly - cy)**2 < (r - 20)**2:
                draw.ellipse([lx - 2, ly - 2, lx + 2, ly + 2], fill=(70, 5, 5))

    if severity >= 2:
        # Hard exudates (bright yellow specks)
        for _ in range(8 * severity):
            lx = cx + random.randint(-120, 140)
            ly = cy + random.randint(-120, 140)
            if (lx - cx)**2 + (ly - cy)**2 < (r - 30)**2:
                draw.ellipse([lx - 3, ly - 3, lx + 3, ly + 3], fill=(250, 245, 140))

    if severity >= 3:
        # Hemorrhages (larger dark red patches)
        for _ in range(6):
            lx = cx + random.randint(-130, 130)
            ly = cy + random.randint(-130, 130)
            hr = random.randint(5, 12)
            draw.ellipse([lx - hr, ly - hr, lx + hr, ly + hr], fill=(80, 10, 10))

    if severity >= 4:
        # Neovascularization (frond of irregular new vessels)
        nv_x, nv_y = od_x + 30, od_y - 20
        for _ in range(15):
            nx2 = nv_x + random.randint(-25, 25)
            ny2 = nv_y + random.randint(-25, 25)
            draw.line([nv_x, nv_y, nx2, ny2], fill=(130, 15, 15), width=2)

    # Smooth blur slightly for photographic feel
    img = img.filter(ImageFilter.GaussianBlur(radius=0.7))
    return img

def populate():
    db = SessionLocal()
    try:
        screenings = db.query(Screening).all()
        print(f"Updating {len(screenings)} screenings with Grad-CAM & sample images...")
        for i, s in enumerate(screenings):
            if not s.image_path or not s.gradcam_path:
                fundus_img = generate_synthetic_fundus(severity=s.severity_level, seed=100 + i)
                res = predict_with_gradcam(fundus_img, save_files=True)
                s.image_path = res["image_path"]
                s.gradcam_path = res["gradcam_path"]
                print(f"Screening #{s.id} updated with {s.image_path} and {s.gradcam_path}")
        db.commit()
        print("Sample data populated successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    populate()
