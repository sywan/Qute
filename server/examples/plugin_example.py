"""Example Qute server plugin: two small engines without any machine-learning model.

Run:   QUTE_PLUGINS=examples/plugin_example.py uvicorn qute_server.app:app --port 8765
The engines appear in Qute → Advanced → Algorithm under "Your server", with the sliders and
menus declared in `params`. Copy this file to wrap your own model: implement infer().
"""
from PIL import Image, ImageFilter, ImageOps

from qute_server.engines.base import Engine


class SepiaEngine(Engine):
    label = {"en": "Sepia photo (example plugin)", "zh-TW": "懷舊棕褐色（範例外掛）"}
    description = {
        "en": "Warm old-photo toning. A minimal example of a custom server engine.",
        "zh-TW": "溫暖的老照片色調。自訂伺服器引擎的最小範例。",
    }
    citation = "Example plugin"
    license = "MIT"
    params = [
        {"name": "strength", "type": "number", "min": 0, "max": 1, "step": 0.05, "default": 0.8,
         "label": {"en": "Strength", "zh-TW": "強度"}},
        {"name": "tone", "type": "select", "default": "warm",
         "options": [{"value": "warm", "label": {"en": "Warm", "zh-TW": "暖色"}},
                     {"value": "cool", "label": {"en": "Cool", "zh-TW": "冷色"}}],
         "label": {"en": "Tone", "zh-TW": "色調"}},
    ]

    def __init__(self):
        super().__init__(id="example-sepia")

    def infer(self, _model, image, reference, params):
        strength = min(1.0, max(0.0, float(params.get("strength", 0.8))))
        black, white = ("#2b1a0e", "#f3e2c4") if params.get("tone", "warm") == "warm" else ("#0e1a2b", "#d6e4f3")
        toned = ImageOps.colorize(ImageOps.grayscale(image), black=black, white=white)
        return Image.blend(image.convert("RGB"), toned, strength)


class PencilEngine(Engine):
    label = {"en": "Pencil sketch (example plugin)", "zh-TW": "鉛筆素描（範例外掛）"}
    description = {"en": "Edge-based sketch effect.", "zh-TW": "以邊緣偵測產生素描效果。"}
    variants = ["soft", "bold"]

    def __init__(self):
        super().__init__(id="example-pencil", variants=["soft", "bold"])

    def infer(self, _model, image, reference, params):
        gray = ImageOps.grayscale(image)
        edges = ImageOps.invert(gray.filter(ImageFilter.FIND_EDGES))
        if params.get("variant") == "bold":
            edges = ImageOps.autocontrast(edges.filter(ImageFilter.MinFilter(3)), cutoff=2)
        return edges.convert("RGB")


ENGINES = [SepiaEngine(), PencilEngine()]
