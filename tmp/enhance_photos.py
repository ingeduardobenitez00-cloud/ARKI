
from PIL import Image, ImageOps, ImageFilter
import os

def crop_enhanced(img, box, output_path):
    cell = img.crop(box)
    gray = ImageOps.grayscale(cell)
    bw = gray.point(lambda p: 255 if p < 240 else 0)
    bbox = bw.getbbox()
    
    if bbox:
        padx, pady = 10, 10
        final_box = (
            max(0, bbox[0] - padx),
            max(0, bbox[1] - pady),
            min(cell.width, bbox[2] + padx),
            min(cell.height, bbox[3] + pady)
        )
        face = cell.crop(final_box)
        
        # --- ENHANCEMENT ---
        # 1. Upscale using Lanczos (High quality resampling)
        # Target size 300x300 for crisp display
        target_size = (300, 300)
        face = face.resize(target_size, Image.Resampling.LANCZOS)
        
        # 2. Sharpening filter
        face = face.filter(ImageFilter.SHARPEN)
        face = face.filter(ImageFilter.DETAIL)
        
        # 3. Simple contrast boost
        face = ImageOps.autocontrast(face, cutoff=1)
        
        face.save(output_path, quality=95)
    else:
        # Fallback for empty/error cells
        cell.save(output_path, quality=95)

def process_enhanced_grid(src, dest_dir, rows, cols, header_h):
    if not os.path.exists(dest_dir): os.makedirs(dest_dir)
    img = Image.open(src).convert('RGB')
    w, h = img.size
    cw, ch = w / cols, (h - header_h) / rows
    
    count = 1
    for r in range(rows):
        for c in range(cols):
            left, top = c * cw, header_h + r * ch
            box = (left, top, left + (cw * 0.5), top + ch)
            crop_enhanced(img, box, os.path.join(dest_dir, f"{count}.jpg"))
            count += 1

# List of all screenshots
junta_screens = [
    (r"C:\Users\EDU DJ\.gemini\antigravity\brain\7155fed9-4245-4b99-9dd7-c84999827904\media__1777298766399.png", "lista-2c"),
    (r"C:\Users\EDU DJ\.gemini\antigravity\brain\7155fed9-4245-4b99-9dd7-c84999827904\media__1777298781518.png", "lista-2p"),
    (r"C:\Users\EDU DJ\.gemini\antigravity\brain\7155fed9-4245-4b99-9dd7-c84999827904\media__1777298798974.png", "lista-6"),
    (r"C:\Users\EDU DJ\.gemini\antigravity\brain\7155fed9-4245-4b99-9dd7-c84999827904\media__1777298811984.png", "lista-7"),
    (r"C:\Users\EDU DJ\.gemini\antigravity\brain\7155fed9-4245-4b99-9dd7-c84999827904\media__1777298824209.png", "lista-20"),
]

for src, l_id in junta_screens:
    print(f"Enhancing {l_id}...")
    process_enhanced_grid(src, f"c:\\ARKI\\public\\candidates\\junta\\{l_id}", 4, 6, 75)

# Enhance Intendentes (using the correct mayor screenshot found earlier)
inten_src = r"C:\Users\EDU DJ\.gemini\antigravity\brain\7155fed9-4245-4b99-9dd7-c84999827904\media__1777302820933.png"
inten_dest = "c:\\ARKI\\public\\candidates\\intendente"
img_inten = Image.open(inten_src).convert('RGB')
hh, cw, ch = 10, img_inten.width / 2, (img_inten.height - 10) / 2

crop_enhanced(img_inten, (0, hh, cw, hh + ch), os.path.join(inten_dest, "camilo-perez.jpg"))
crop_enhanced(img_inten, (cw, hh, 2*cw, hh + ch), os.path.join(inten_dest, "arnaldo-samaniego.jpg"))
crop_enhanced(img_inten, (0, hh + ch, cw, hh + 2*ch), os.path.join(inten_dest, "danilo-gomez.jpg"))

print("All photos enhanced with upscaling and sharpening.")
