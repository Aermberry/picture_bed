from PIL import Image, ImageDraw

size = 256
img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
margin = 16
d.rounded_rectangle(
    [margin, margin, size - margin, size - margin],
    radius=56,
    fill=(78, 134, 173, 255),  # #4E86AD morning fog
)
d.ellipse([96, 72, 176, 152], fill=(227, 154, 107, 255))  # #E39A6B sunset
d.polygon(
    [(64, 184), (112, 128), (148, 164), (176, 140), (192, 184)],
    fill=(243, 247, 250, 255),
)
out = "desktop/icon.png"
img.save(out)
print("icon ok", img.size, out)
