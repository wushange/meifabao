import struct, zlib, os

def create_rgba_png(width, height, r=212, g=160, b=23, a=255):
    """Create minimal valid RGBA PNG"""
    def chunk(ct, data):
        c = ct + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    
    header = b'\x89PNG\r\n\x1a\n'
    # Color type 6 = RGBA
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
    
    raw = b''
    for y in range(height):
        raw += b'\x00'  # filter none
        for x in range(width):
            raw += bytes([r, g, b, a])
    
    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')
    
    return header + ihdr + idat + iend

base_path = os.path.dirname(os.path.abspath(__file__))

gold = (212, 160, 23, 255)
dark = (44, 36, 22, 255)
white = (255, 255, 255, 255)

# Simple icon: gold circle on dark background
def create_icon(w, bg_color, fg_color):
    data = bytearray()
    cx = w // 2
    cy = w // 2
    r = int(w * 0.35)
    
    for y in range(w):
        data.append(0)  # filter none
        for x in range(w):
            dx = x - cx
            dy = y - cy
            if dx*dx + dy*dy <= r*r:
                data.extend(fg_color)
            else:
                data.extend(bg_color)
    return bytes(data)

def chunk(ct, bdata):
    c = ct + bdata
    return struct.pack('>I', len(bdata)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

def make_icon_png(w, bg, fg):
    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', w, w, 8, 6, 0, 0, 0))
    raw = create_icon(w, bg, fg)
    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')
    return header + ihdr + idat + iend

# Generate icons
sizes = {32: "32x32.png", 128: "128x128.png", 256: "128x128@2x.png"}

for size, fname in sizes.items():
    path = os.path.join(base_path, fname)
    with open(path, 'wb') as f:
        f.write(make_icon_png(size, dark, gold))
    print(f"Created {fname} ({size}x{size} RGBA)")

# .icns (256x256 RGBA)
with open(os.path.join(base_path, "icon.icns"), 'wb') as f:
    f.write(make_icon_png(256, dark, gold))
print("Created icon.icns (256x256 RGBA)")

# .ico (32x32 RGBA)
with open(os.path.join(base_path, "icon.ico"), 'wb') as f:
    f.write(make_icon_png(32, dark, gold))
print("Created icon.ico (32x32 RGBA)")
