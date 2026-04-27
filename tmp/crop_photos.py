
from PIL import Image
import os

def crop_candidates(image_path, output_dir, list_id):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    img = Image.open(image_path)
    # Convert to RGB to avoid "cannot write mode RGBA as JPEG"
    img = img.convert('RGB')
    width, height = img.size
    
    header_h = 75 
    rows = 4
    cols = 6
    
    grid_w = width
    grid_h = height - header_h
    
    cell_w = grid_w / cols
    cell_h = grid_h / rows
    
    count = 1
    for r in range(rows):
        for c in range(cols):
            # Photo is roughly the left 40% of the cell
            left = c * cell_w + 5
            top = header_h + r * cell_h + 5
            right = left + (cell_w * 0.4)
            bottom = top + (cell_h * 0.70)
            
            crop = img.crop((left, top, right, bottom))
            crop.save(os.path.join(output_dir, f"{count}.jpg"), quality=90)
            count += 1

screenshots = [
    (r"C:\Users\EDU DJ\.gemini\antigravity\brain\7155fed9-4245-4b99-9dd7-c84999827904\media__1777298766399.png", "lista-2c"),
    (r"C:\Users\EDU DJ\.gemini\antigravity\brain\7155fed9-4245-4b99-9dd7-c84999827904\media__1777298781518.png", "lista-2p"),
    (r"C:\Users\EDU DJ\.gemini\antigravity\brain\7155fed9-4245-4b99-9dd7-c84999827904\media__1777298798974.png", "lista-6"),
    (r"C:\Users\EDU DJ\.gemini\antigravity\brain\7155fed9-4245-4b99-9dd7-c84999827904\media__1777298811984.png", "lista-7"),
    (r"C:\Users\EDU DJ\.gemini\antigravity\brain\7155fed9-4245-4b99-9dd7-c84999827904\media__1777298824209.png", "lista-20"),
]

for s_path, l_id in screenshots:
    print(f"Processing {l_id}...")
    dest = f"c:\\ARKI\\public\\candidates\\junta\\{l_id}"
    try:
        crop_candidates(s_path, dest, l_id)
        print(f"Done {l_id}")
    except Exception as e:
        print(f"Error {l_id}: {e}")
