"""无 CUA 时的屏幕截图兜底：把桌面抓成 PNG，便于人工/模型核对界面。"""
from __future__ import annotations

import ctypes
import sys
from ctypes import wintypes
from pathlib import Path

from PIL import Image

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32
user32.SetProcessDPIAware()


def grab(out: str, box: tuple[int, int, int, int] | None = None) -> str:
    w = user32.GetSystemMetrics(0)
    h = user32.GetSystemMetrics(1)
    x, y, cw, ch = box or (0, 0, w, h)

    hdc = user32.GetDC(0)
    mem = gdi32.CreateCompatibleDC(hdc)
    bmp = gdi32.CreateCompatibleBitmap(hdc, cw, ch)
    gdi32.SelectObject(mem, bmp)

    SRCCOPY = 0x00CC0020
    gdi32.BitBlt(mem, 0, 0, cw, ch, hdc, x, y, SRCCOPY)

    class BITMAPINFOHEADER(ctypes.Structure):
        _fields_ = [("biSize", wintypes.DWORD), ("biWidth", wintypes.LONG),
                    ("biHeight", wintypes.LONG), ("biPlanes", wintypes.WORD),
                    ("biBitCount", wintypes.WORD), ("biCompression", wintypes.DWORD),
                    ("biSizeImage", wintypes.DWORD), ("biXPelsPerMeter", wintypes.LONG),
                    ("biYPelsPerMeter", wintypes.LONG), ("biClrUsed", wintypes.DWORD),
                    ("biClrImportant", wintypes.DWORD)]

    bi = BITMAPINFOHEADER()
    bi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    bi.biWidth = cw
    bi.biHeight = -ch          # 顶-down
    bi.biPlanes = 1
    bi.biBitCount = 32
    bi.biCompression = 0

    buf = ctypes.create_string_buffer(cw * ch * 4)
    gdi32.GetDIBits(mem, bmp, 0, ch, buf, ctypes.byref(bi), 0)
    img = Image.frombuffer("RGBA", (cw, ch), buf, "raw", "BGRA", 0, 1).convert("RGB")
    img.save(out)

    gdi32.DeleteObject(bmp)
    gdi32.DeleteDC(mem)
    user32.ReleaseDC(0, hdc)
    return out


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "tools/_screen.png"
    box = tuple(int(v) for v in sys.argv[2:6]) if len(sys.argv) >= 6 else None
    Path(target).parent.mkdir(parents=True, exist_ok=True)
    print(grab(target, box))
