
from PIL import Image, ImageOps
import os

def crop_smart(img, box, output_path):
    """Crops an area and then attempts to find the actual content within it."""
    cell = img.crop(box)
    
    # Convert to grayscale and invert to find 'content' (dark on light)
    gray = ImageOps.grayscale(cell)
    # Simple thresholding: anything darker than 240 is 'content'
    bw = gray.point(lambda p: 255 if p < 240 else 0)
    bbox = bw.getbbox()
    
    if bbox:
        # Add some padding to the bbox
        padx, pady = 10, 10
        final_box = (
            max(0, bbox[0] - padx),
            max(0, bbox[1] - pady),
            min(cell.width, bbox[2] + padx),
            min(cell.height, bbox[3] + pady)
        )
        face = cell.crop(final_box)
        face.save(output_path, quality=95)
    else:
        cell.save(output_path, quality=95)

def process_image(src, dest_dir, rows, cols, header_h):
    if not os.path.exists(dest_dir): os.makedirs(dest_dir)
    img = Image.open(src).convert('RGB')
    w, h = img.size
    
    grid_w = w
    grid_h = h - header_h
    cw, ch = grid_w / cols, grid_h / rows
    
    count = 1
    for r in range(rows):
        for c in range(cols):
            # Target the area where the photo is likely to be (left half of cell)
            left = c * cw
            top = header_h + r * ch
            right = left + (cw * 0.5) 
            bottom = top + ch
            
            crop_smart(img, (left, top, right, bottom), os.path.join(dest_dir, f"{count}.jpg"))
            count += 1

# Process Intendentes (2x2 grid, but only 3 candidates)
inten_src = r"C:\Users\EDU DJ\.gemini\antigravity\brain\7155fed9-4245-4b99-9dd7-c84999827904\media__1777299744961.png"
inten_dest = "c:\\ARKI\\public\\candidates\\intendente"
img_inten = Image.open(inten_src).convert('RGB')
hh = 30 # Small header
cw, ch = img_inten.width / 2, (img_inten.height - hh) / 2

# Manually save the 3 intendentes using smart crop
crop_smart(img_inten, (0, hh, cw, hh + ch), os.path.join(inten_dest, "camilo-perez.jpg"))
crop_smart(img_inten, (cw, hh, 2*cw, hh + ch), os.path.join(inten_dest, "arnaldo-samaniego.jpg"))
crop_smart(img_inten, (0, hh + ch, cw, hh + 2*ch), os.path.join(inten_dest, "danilo-gomez.jpg"))

# Process Junta lists
junta_screens = [
    (r"C:\Users\EDU DJ\.gemini\antigravity\brain\7155fed9-4245-4b99-9dd7-c84999827904\media__1777298766399.png", "lista-2c"),
    (r"C:\Users\EDU DJ\.gemini\antigravity\brain\7155fed9-4245-4b99-9dd7-c84999827904\media__1777298781518.png", "lista-2p"),
    (r"C:\Users\EDU DJ\.gemini\antigravity\brain\7155fed9-4245-4b99-9dd7-c84999827904\media__1777298798974.png", "lista-6"),
    (r"C:\Users\EDU DJ\.gemini\antigravity\brain\7155fed9-4245-4b99-9dd7-c84999827904\media__1777298811984.png", "lista-7"),
    (r"C:\Users\EDU DJ\.gemini\antigravity\brain\7155fed9-4245-4b99-9dd7-c84999827904\media__1777298824209.png", "lista-20"),
]

for src, l_id in junta_screens:
    print(f"Processing {l_id}...")
    process_image(src, f"c:\\ARKI\\public\\candidates\\junta\\{l_id}", 4, 6, 75)

print("Smart cropping complete.")
