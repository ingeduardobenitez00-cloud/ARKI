
from PIL import Image
import os

def crop_grid(image_path, output_dir, rows, cols, header_h=75):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    img = Image.open(image_path).convert('RGB')
    width, height = img.size
    grid_w, grid_h = width, height - header_h
    cell_w, cell_h = grid_w / cols, grid_h / rows
    
    return img, cell_w, cell_h, header_h

def crop_and_save(img, x, y, w, h, path):
    crop = img.crop((x, y, x + w, y + h))
    crop.save(path, quality=95)

# 1. Junta candidates (already done, but re-run for consistency if needed)
# ... (keeping it simple and only adding the new ones)

# 2. Intendente candidates
inten_path = r"C:\Users\EDU DJ\.gemini\antigravity\brain\7155fed9-4245-4b99-9dd7-c84999827904\media__1777299744961.png"
dest_inten = "c:\\ARKI\\public\\candidates\\intendente"
if not os.path.exists(dest_inten): os.makedirs(dest_inten)

img, cw, ch, hh = crop_grid(inten_path, dest_inten, 2, 2, header_h=20) # Header is smaller here

# Camilo Perez (Row 0, Col 0)
crop_and_save(img, 0*cw + 20, hh + 0*ch + 40, cw * 0.4, ch * 0.6, os.path.join(dest_inten, "camilo-perez.jpg"))
# Arnaldo Samaniego (Row 0, Col 1)
crop_and_save(img, 1*cw + 20, hh + 0*ch + 40, cw * 0.4, ch * 0.6, os.path.join(dest_inten, "arnaldo-samaniego.jpg"))
# Danilo Gomez (Row 1, Col 0)
crop_and_save(img, 0*cw + 20, hh + 1*ch + 40, cw * 0.4, ch * 0.6, os.path.join(dest_inten, "danilo-gomez.jpg"))

print("Intendente photos cropped.")
