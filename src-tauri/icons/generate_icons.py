import struct, zlib, os

def chunk(ct, data):
    c = ct + data
    return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

def make_rgba_png(w, r, g, b, a):
    """Generate a solid-color RGBA PNG"""
    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', w, w, 8, 6, 0, 0, 0))
    raw = b''
    for _ in range(w):
        raw += b'\x00' + bytes([r, g, b, a]) * w
    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')
    return header + ihdr + idat + iend

def make_icon_png(w, bg, fg):
    """Generate icon PNG with circle"""
    cx = cy = w // 2
    rr = int(w * 0.35)
    raw = b''
    for y in range(w):
        raw += b'\x00'
        for x in range(w):
            dx, dy = x - cx, y - cy
            if dx*dx + dy*dy <= rr*rr:
                raw += fg
            else:
                raw += bg
    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', w, w, 8, 6, 0, 0, 0))
    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')
    return header + ihdr + idat + iend

def make_ico(png_data_32, png_data_256=None):
    """
    Create a proper ICO file containing PNG images.
    Windows requires ICO format with valid directory structure.
    """
    images = [(32, png_data_32)]
    if png_data_256:
        images.append((256, png_data_256))
    
    # ICO header: reserved(2)=0, type(2)=1, count(2)
    header = struct.pack('<HHH', 0, 1, len(images))
    
    # Image directory entries + data
    entries = b''
    img_data = b''
    offset = 6 + 16 * len(images)  # header + entries
    
    for size, png in images:
        w = size if size < 256 else 0  # 0 means 256
        h = size if size < 256 else 0
        # Directory entry: w(1) h(1) colors(1) reserved(1) planes(2) bpp(2) size(4) offset(4)
        entries += struct.pack('<BBBBHHII', w, h, 0, 0, 1, 32, len(png), offset)
        img_data += png
        offset += len(png)
    
    return header + entries + img_data

base_path = os.path.dirname(os.path.abspath(__file__))
dark = bytes([44, 36, 22, 255])
gold = bytes([212, 160, 23, 255])

# Generate PNG icons
sizes = {32: "32x32.png", 128: "128x128.png", 256: "128x128@2x.png"}
png32 = None
for size, fname in sizes.items():
    png = make_icon_png(size, dark, gold)
    if size == 32:
        png32 = png
    path = os.path.join(base_path, fname)
    with open(path, 'wb') as f:
        f.write(png)
    print(f"Created {fname} ({size}x{size} RGBA)")

# .icns — just use 256x256 RGBA PNG (works for macOS)
with open(os.path.join(base_path, "icon.icns"), 'wb') as f:
    f.write(make_icon_png(256, dark, gold))
print("Created icon.icns")

# .ico — proper ICO format with PNG data
ico = make_ico(png32)
with open(os.path.join(base_path, "icon.ico"), 'wb') as f:
    f.write(ico)
print("Created icon.ico (valid ICO format)")
