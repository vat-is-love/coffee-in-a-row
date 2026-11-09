"""Reproduce the game's ellipse, split and highlight as install icons (Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw
out = Path(__file__).resolve().parents[1] / 'public/icons'
out.mkdir(parents=True, exist_ok=True)
for name, size, maskable in [('icon-192.png',192,False),('icon-512.png',512,False),('icon-maskable-512.png',512,True),('apple-touch-icon.png',180,False)]:
    scale=4
    im=Image.new('RGB',(512*scale,512*scale),'#1a1a2e')
    d=ImageDraw.Draw(im)
    def coords(values): return tuple(round(v*scale) for v in values)
    # Body stays within the central mask-safe circle, including on Huawei launchers.
    d.ellipse(coords((114,161,398,351)), fill='#e8a87c')
    d.line(coords((161,199,351,313)),fill='#1a1a2e',width=24*scale)
    d.ellipse(coords((190,194,238,242)),fill='#edb997')
    im.resize((size,size),Image.Resampling.LANCZOS).save(out/name)
