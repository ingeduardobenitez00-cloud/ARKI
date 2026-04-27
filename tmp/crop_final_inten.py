
from PIL import Image, ImageOps
import os

def crop_smart(img, box, output_path):
    cell = img.crop(box)
    gray = ImageOps.grayscale(cell)
    bw = gray.point(lambda p: 255 if p < 240 else 0)
    bbox = bw.getbbox()
    if bbox:
        padx, pady = 15, 15
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

# THE CORRECT SCREENSHOT FOR MAYORS
inten_src = r"C:\Users\EDU DJ\.gemini\antigravity\brain\7155fed9-4245-4b99-9dd7-c84999827904\media__1777302820933.png"
inten_dest = "c:\\ARKI\\public\\candidates\\intendente"
if not os.path.exists(inten_dest): os.makedirs(inten_dest)

img_inten = Image.open(inten_src).convert('RGB')
hh = 10 # Very small header in this crop
cw, ch = img_inten.width / 2, (img_inten.height - hh) / 2

# Camilo Perez
crop_smart(img_inten, (0, hh, cw, hh + ch), os.path.join(inten_dest, "camilo-perez.jpg"))
# Arnaldo Samaniego 
crop_smart(img_inten, (cw, hh, 2*cw, hh + ch), os.path.join(inten_dest, "arnaldo-samaniego.jpg"))
# Danilo Gomez
crop_smart(img_inten, (0, hh + ch, cw, hh + 2*ch), os.path.join(inten_dest, "danilo-gomez.jpg"))

print("Intendente photos corrected successfully.")
