"""DPS-END 桌面应用：选择排轴文件 → 配置敌人 → 生成Excel报告。

界面为 DeepSeek 风格（圆角卡片 + 白天/黑夜双主题）。
主题选择会记住，下次启动沿用。双击「DPS-END.bat」启动。
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import threading
import traceback
from pathlib import Path

# PyInstaller 打包后，资源在 exe 同级目录；开发时在脚本同级目录
if getattr(sys, "_MEIPASS", None):
    APP_DIR = Path(sys.executable).resolve().parent
else:
    APP_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(APP_DIR))

import tkinter as tk
import tkinter.font as tkfont
from tkinter import filedialog, messagebox

from dps_end.akedata import load_names
from dps_end.simnode import bundled_node, run_simulation

VENDOR = APP_DIR / "vendor" / "endaxis"
ELEMENTS = [("physical", "物理"), ("heat", "灼热"), ("cryo", "寒冷"),
            ("electric", "电磁"), ("nature", "自然")]

FONT = "微软雅黑"
FONT_NUM = "Consolas"

try:
    UI_STATE = Path(os.environ.get("APPDATA") or Path.home()) / "DPS-END" / "ui.json"
except Exception:  # pragma: no cover - 极端环境下退回脚本目录
    UI_STATE = APP_DIR / ".dpsend_ui.json"

# ── 双主题色板 ─────────────────────────────────────────────
THEMES = {
    "light": {
        "bg": "#ffffff", "surface": "#f7f8fa", "surface2": "#edeff3",
        "border": "#e4e6eb", "text": "#1b1c1e", "sub": "#8b909a",
        "accent": "#4d6bfe", "accent_hover": "#3d5bf0",
        "accent_soft": "#e9edff", "on_accent": "#ffffff",
        "ok": "#0fa968", "danger": "#e5484d",
    },
    "dark": {
        "bg": "#1a1b1e", "surface": "#24262b", "surface2": "#2f3238",
        "border": "#3a3d44", "text": "#e9eaec", "sub": "#9aa0a8",
        "accent": "#5b78ff", "accent_hover": "#7089ff",
        "accent_soft": "#2b3357", "on_accent": "#ffffff",
        "ok": "#3ddc97", "danger": "#ff6b6b",
    },
}


def _rr(cv: tk.Canvas, x1, y1, x2, y2, r, **kw):
    """在 canvas 上画一个圆角矩形，返回 item id。"""
    r = max(0, min(r, (x2 - x1) / 2, (y2 - y1) / 2))
    pts = [x1 + r, y1, x2 - r, y1, x2, y1, x2, y1 + r,
           x2, y2 - r, x2, y2, x2 - r, y2, x1 + r, y2,
           x1, y2, x1, y2 - r, x1, y1 + r, x1, y1]
    return cv.create_polygon(pts, smooth=True, splinesteps=20, **kw)


def _font(spec):
    family, size = spec[0], spec[1]
    weight = spec[2] if len(spec) > 2 else "normal"
    return tkfont.Font(family=family, size=size, weight=weight)


# ══════════════════════ 基础控件 ══════════════════════

class Card(tk.Frame):
    """圆角卡片：Canvas 画背景，body 里放内容。"""

    def __init__(self, master, t, radius=14, padx=16, pady=13, fill=None):
        super().__init__(master, bg=t["bg"])
        self.t, self.radius = t, radius
        self.fill = fill or t["surface"]
        self.canvas = tk.Canvas(self, highlightthickness=0, bd=0, bg=t["bg"])
        self.canvas.place(x=0, y=0, relwidth=1, relheight=1)
        self.body = tk.Frame(self, bg=self.fill)
        self.body.pack(fill="both", expand=True, padx=padx, pady=pady)
        self.bind("<Configure>", self._draw)

    def _draw(self, _=None):
        w, h = self.winfo_width(), self.winfo_height()
        if w < 4 or h < 4:
            return
        self.canvas.delete("all")
        _rr(self.canvas, 0.5, 0.5, w - 0.5, h - 0.5, self.radius,
            fill=self.fill, outline=self.t["border"])


class RButton(tk.Canvas):
    """圆角按钮。kind: primary / secondary / ghost。"""

    def __init__(self, master, t, text, command=None, kind="primary",
                 height=38, radius=10, padx=18, font=None, width=None, bg=None):
        self.t, self.kind, self.command = t, kind, command
        self.radius, self._enabled, self._hover = radius, True, False
        self._spec = font or (FONT, 10, "bold")
        self._f = _font(self._spec)
        self._cw = width or (self._f.measure(text) + padx * 2)
        self._ch = height
        super().__init__(master, width=self._cw, height=self._ch, highlightthickness=0,
                         bd=0, bg=bg or t["bg"], cursor="hand2")
        self._text = text
        self._render()
        self.bind("<Enter>", lambda e: self._set_hover(True))
        self.bind("<Leave>", lambda e: self._set_hover(False))
        self.bind("<Button-1>", lambda e: self._render(press=True))
        self.bind("<ButtonRelease-1>", self._release)

    def _palette(self, press=False):
        t = self.t
        if not self._enabled:
            return t["surface2"], t["sub"], t["surface2"]
        if self.kind == "primary":
            c = t["accent_hover"] if (self._hover or press) else t["accent"]
            return c, t["on_accent"], c
        if self.kind == "secondary":
            return t["surface2"], t["text"], t["border"]
        return t["accent_soft"], t["accent"], t["accent_soft"]

    def _render(self, press=False):
        fill, fg, outline = self._palette(press)
        self.delete("all")
        _rr(self, 0.5, 0.5, self._cw - 0.5, self._ch - 0.5, self.radius,
            fill=fill, outline=outline)
        self.create_text(self._cw / 2, self._ch / 2, text=self._text,
                         fill=fg, font=self._spec)

    def _set_hover(self, on):
        self._hover = on
        self._render()

    def _release(self, e):
        self._render()
        if self._enabled and self.command and 0 <= e.x <= self._cw and 0 <= e.y <= self._ch:
            self.command()

    def set_text(self, text):
        self._text = text
        self._cw = max(self._cw, self._f.measure(text) + 36)
        self.configure(width=self._cw)
        self._render()

    def set_enabled(self, ok):
        self._enabled = bool(ok)
        self.configure(cursor="hand2" if ok else "arrow")
        self._render()


class REntry(tk.Canvas):
    """圆角输入框（内嵌原生 Entry）。支持占位文字与横向拉伸。"""

    def __init__(self, master, t, width=140, height=36, radius=9,
                 font=None, bg=None, placeholder=None):
        self.t, self.radius = t, radius
        self._cw, self._ch = width, height
        self._ph, self._showing_ph, self._focused = placeholder, False, False
        super().__init__(master, width=width, height=height, highlightthickness=0,
                         bd=0, bg=bg or t["surface"])
        self.entry = tk.Entry(self, bd=0, highlightthickness=0, relief="flat",
                              bg=t["surface2"], fg=t["text"],
                              insertbackground=t["accent"],
                              font=font or (FONT_NUM, 10), justify="left")
        self._win = self.create_window(11, height / 2, window=self.entry, anchor="w",
                                       width=width - 22, height=height - 14)
        self._draw()
        self.entry.bind("<FocusIn>", self._focus_in)
        self.entry.bind("<FocusOut>", self._focus_out)
        self.bind("<Button-1>", lambda e: self.entry.focus_set())
        if placeholder:
            self._apply_ph()

    def _draw(self):
        self.delete("rect")
        _rr(self, 0.5, 0.5, self._cw - 0.5, self._ch - 0.5, self.radius,
            fill=self.t["surface2"],
            outline=self.t["accent"] if self._focused else self.t["border"],
            tags="rect")
        self.tag_lower("rect")

    def _apply_ph(self):
        self._showing_ph = True
        self.entry.delete(0, tk.END)
        self.entry.insert(0, self._ph)
        self.entry.config(fg=self.t["sub"])

    def _focus_in(self, _=None):
        self._focused = True
        self._draw()
        if self._showing_ph:
            self.entry.delete(0, tk.END)
            self.entry.config(fg=self.t["text"])
            self._showing_ph = False

    def _focus_out(self, _=None):
        self._focused = False
        self._draw()
        if self._ph and not self.entry.get():
            self._apply_ph()

    def stretch_to(self, container, pad=0):
        """让输入框跟随容器宽度自适应。"""
        def on_cfg(e):
            w = e.width - pad
            if w < 80 or abs(w - self._cw) < 2:
                return
            self._cw = w
            self.configure(width=w)
            self.itemconfigure(self._win, width=w - 22)
            self._draw()
        container.bind("<Configure>", on_cfg)

    def get(self) -> str:
        return "" if self._showing_ph else self.entry.get()

    def set(self, text):
        self.entry.delete(0, tk.END)
        self._showing_ph = False
        self.entry.config(fg=self.t["text"])
        if text:
            self.entry.insert(0, str(text))
        elif self._ph:
            self._apply_ph()


class Segmented(tk.Canvas):
    """分段选择器（胶囊滑块）。options: [(value, label), ...]"""

    def __init__(self, master, t, options, value=None, command=None,
                 height=34, radius=9, pad=4, segpad=20, font=None, bg=None):
        self.t, self.command = t, command
        self.options = list(options)
        self.value = value if value is not None else self.options[0][0]
        self.radius, self.pad, self.segpad = radius, pad, segpad
        self._spec = font or (FONT, 9, "bold")
        self._f = _font(self._spec)
        self._segw = [self._f.measure(lbl) + segpad * 2 for _, lbl in self.options]
        w = sum(self._segw) + pad * 2
        super().__init__(master, width=w, height=height, highlightthickness=0,
                         bd=0, bg=bg or t["bg"], cursor="hand2")
        self._cw, self._ch = w, height
        self._render()
        self.bind("<Button-1>", self._click)

    def _render(self):
        t = self.t
        self.delete("all")
        _rr(self, 0.5, 0.5, self._cw - 0.5, self._ch - 0.5, self.radius,
            fill=t["surface2"], outline=t["border"])
        x = self.pad
        for (val, lbl), sw in zip(self.options, self._segw):
            active = val == self.value
            if active:
                _rr(self, x, self.pad, x + sw, self._ch - self.pad,
                    max(3, self.radius - 2), fill=t["accent"], outline=t["accent"])
            self.create_text(x + sw / 2, self._ch / 2, text=lbl,
                             fill=t["on_accent"] if active else t["sub"],
                             font=self._spec)
            x += sw

    def _click(self, e):
        x = self.pad
        for (val, _lbl), sw in zip(self.options, self._segw):
            if x <= e.x <= x + sw:
                if val != self.value:
                    self.value = val
                    self._render()
                    if self.command:
                        self.command(val)
                return
            x += sw

    def set_value(self, val):
        self.value = val
        self._render()


# ══════════════════════ 主程序 ══════════════════════

class App:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("DPS-END · 终末地排轴伤害计算器")
        self.root.minsize(700, 560)
        self._set_window_icon()
        self.theme_key = self._load_theme()
        self.t = THEMES[self.theme_key]
        self.root.geometry("760x700")
        self.root.configure(bg=self.t["bg"])

        # 跨主题重建时需要保住的状态
        self.file_path = ""
        self.project_enemy_id = ""
        self._status_text = "就绪 — 选择排轴文件后点击「开始计算」"
        self._status_kind = "info"
        self._result = None
        self._busy = False
        self._cal_unknown: list[str] = []

        self._build_all()

    # ---------- 主题持久化 ----------

    def _set_window_icon(self):
        ico = APP_DIR / "assets" / "dps-end.ico"
        try:
            if ico.exists():
                self.root.iconbitmap(default=str(ico))
        except Exception:
            pass

    def _load_theme(self) -> str:
        try:
            k = json.loads(UI_STATE.read_text(encoding="utf-8")).get("theme")
            if k in THEMES:
                return k
        except Exception:
            pass
        return "light"

    def _store_theme(self):
        try:
            UI_STATE.parent.mkdir(parents=True, exist_ok=True)
            UI_STATE.write_text(json.dumps({"theme": self.theme_key}), encoding="utf-8")
        except Exception:
            pass

    def _set_theme(self, key):
        if key == self.theme_key:
            return
        if self._busy:  # 计算中不重建界面，把选择器拨回去
            self.theme_seg.set_value(self.theme_key)
            return
        self.theme_key = key
        self._store_theme()
        self._rebuild()

    def _rebuild(self):
        state = self._snapshot()
        for w in self.root.winfo_children():
            w.destroy()
        self.t = THEMES[self.theme_key]
        self.root.configure(bg=self.t["bg"])
        self._build_all()
        self._restore(state)

    def _snapshot(self) -> dict:
        st = {"file": self.file_path, "preset": "timeline", "enemy": {}, "cal": {},
              "template": {}, "summary": getattr(self, "_timeline_summary", "")}
        try:
            st["preset"] = self.enemy_seg.value
            st["enemy"] = {k: e.get() for k, e in self.enemy_entries.items()}
            st["cal"] = {k: e.get() for k, e in self.cal_entries.items()}
            st["template"] = {k: e.get() for k, e in self.template_entries.items()}
        except Exception:
            pass
        return st

    def _restore(self, st: dict):
        try:
            self.file_entry.set(st.get("file", ""))
            self.enemy_seg.set_value(st.get("preset", "timeline"))
            for k, v in st.get("enemy", {}).items():
                if k in self.enemy_entries and v:
                    self.enemy_entries[k].set(v)
            for k, v in st.get("cal", {}).items():
                if k in self.cal_entries:
                    self.cal_entries[k].set(v)
            for k, v in st.get("template", {}).items():
                if k in self.template_entries and v:
                    self.template_entries[k].set(v)
            self._timeline_summary = st.get("summary", "")
            self._set_timeline_summary(self._timeline_summary or None)
        except Exception:
            pass
        self._apply_preset()
        self._render_status()
        self._render_result()

    # ---------- 构建 ----------

    def _build_all(self):
        self._build_header()
        self._build_scroll()
        self._build_file_card()
        self._build_enemy_card()
        self._build_cal_card()
        self._build_action()
        self._build_footer()
        self._apply_preset()
        self._render_status()
        self._render_result()

    def _build_header(self):
        t = self.t
        head = tk.Frame(self.root, bg=t["bg"])
        head.pack(fill="x", padx=22, pady=(18, 12))

        left = tk.Frame(head, bg=t["bg"])
        left.pack(side="left")
        mark = tk.Canvas(left, width=34, height=34, bg=t["bg"], highlightthickness=0)
        _rr(mark, 0, 0, 34, 34, 10, fill=t["accent"], outline=t["accent"])
        mark.create_text(17, 18, text="D", fill=t["on_accent"],
                         font=("Segoe UI", 16, "bold"))
        mark.pack(side="left")
        titles = tk.Frame(left, bg=t["bg"])
        titles.pack(side="left", padx=(10, 0))
        tk.Label(titles, text="DPS-END", font=("Segoe UI", 16, "bold"),
                 fg=t["text"], bg=t["bg"]).pack(anchor="w")
        tk.Label(titles, text="明日方舟：终末地 · 排轴伤害计算器", font=(FONT, 9),
                 fg=t["sub"], bg=t["bg"]).pack(anchor="w")

        right = tk.Frame(head, bg=t["bg"])
        right.pack(side="right")
        self.theme_seg = Segmented(right, t, [("light", "白天"), ("dark", "黑夜")],
                                   value=self.theme_key, command=self._set_theme,
                                   bg=t["bg"])
        self.theme_seg.pack(side="right")
        RButton(right, t, "功能说明", command=self._open_guide, kind="ghost",
                height=34, radius=9, font=(FONT, 9, "bold"), bg=t["bg"]
                ).pack(side="right", padx=(0, 10))

    def _build_scroll(self):
        t = self.t
        self.canvas = tk.Canvas(self.root, bg=t["bg"], highlightthickness=0, bd=0)
        self.canvas.pack(fill="both", expand=True)
        self.page = tk.Frame(self.canvas, bg=t["bg"])
        self._win = self.canvas.create_window((0, 0), window=self.page, anchor="nw")
        self.page.bind("<Configure>", lambda e: self.canvas.configure(
            scrollregion=self.canvas.bbox("all")))
        self.canvas.bind("<Configure>", lambda e: self.canvas.itemconfigure(
            self._win, width=e.width))
        self.canvas.bind_all("<MouseWheel>", self._on_wheel)

    def _on_wheel(self, e):
        try:
            self.canvas.yview_scroll(-1 * (e.delta // 120), "units")
        except Exception:
            pass

    def _section_title(self, parent, num, text, hint=None):
        t = self.t
        row = tk.Frame(parent, bg=t["surface"])
        row.pack(fill="x", pady=(0, 10))
        badge = tk.Canvas(row, width=20, height=20, bg=t["surface"], highlightthickness=0)
        _rr(badge, 0, 0, 20, 20, 6, fill=t["accent_soft"], outline=t["accent_soft"])
        badge.create_text(10, 10, text=num, fill=t["accent"], font=(FONT, 9, "bold"))
        badge.pack(side="left")
        tk.Label(row, text=text, font=(FONT, 10, "bold"), fg=t["text"],
                 bg=t["surface"]).pack(side="left", padx=(8, 0))
        if hint:
            tk.Label(row, text=hint, font=(FONT, 8), fg=t["sub"],
                     bg=t["surface"]).pack(side="right")

    def _hint(self, parent, text):
        tk.Label(parent, text=text, font=(FONT, 8), fg=self.t["sub"],
                 bg=self.t["surface"], justify="left", anchor="w",
                 wraplength=640).pack(fill="x", pady=(6, 0))

    # ---------- ① 排轴文件 ----------

    def _build_file_card(self):
        t = self.t
        card = Card(self.page, t)
        card.pack(fill="x", padx=22, pady=(0, 10))
        self._section_title(card.body, "1", "排轴文件")

        row = tk.Frame(card.body, bg=t["surface"])
        row.pack(fill="x")
        holder = tk.Frame(row, bg=t["surface"])
        holder.pack(side="left", fill="x", expand=True)
        self.file_entry = REntry(holder, t, width=420, height=38,
                                 placeholder="尚未选择文件…")
        self.file_entry.pack(side="left", fill="x", expand=True)
        self.file_entry.stretch_to(holder)
        self.file_entry.set(self.file_path)
        RButton(row, t, "浏览…", command=self._browse, kind="secondary",
                height=38, width=92, bg=t["surface"]).pack(side="left", padx=(10, 0))
        self._hint(card.body, "支持 Endaxis 导出的排轴 JSON，也支持本项目的「原生配置 JSON」"
                              "（examples/样例配置.json）。")

    def _browse(self):
        path = filedialog.askopenfilename(
            title="选择排轴 JSON 文件",
            filetypes=[("JSON 文件", "*.json"), ("所有文件", "*.*")])
        if path:
            self.file_path = path
            self.file_entry.set(path)
            self._load_enemy_defaults(path)

    # ---------- ② 敌人配置 ----------

    def _build_enemy_card(self):
        t = self.t
        card = Card(self.page, t)
        card.pack(fill="x", padx=22, pady=(0, 10))
        self._section_title(card.body, "2", "敌人配置")

        self.enemy_seg = Segmented(
            card.body, t,
            [("timeline", "排轴内敌人"), ("dummy", "训练木桩"),
             ("template", "敌人模板"), ("custom", "自定义")],
            value="timeline", command=lambda _v: self._apply_preset(),
            bg=t["surface"])
        self.enemy_seg.pack(anchor="w")

        # 排轴内实际值摘要（选文件后刷新）
        self.timeline_enemy_label = tk.Label(card.body, text="", font=(FONT, 8),
                                             fg=t["sub"], bg=t["surface"],
                                             justify="left", anchor="w")
        self.timeline_enemy_label.pack(fill="x", pady=(6, 0))

        # 敌人模板区：直接读 AKEData 真实模板
        self.enemy_template = tk.Frame(card.body, bg=t["surface"])
        self.template_entries: dict[str, REntry] = {}
        trow = tk.Frame(self.enemy_template, bg=t["surface"])
        trow.pack(fill="x", pady=(8, 0))
        tk.Label(trow, text="模板ID", font=(FONT, 9), fg=t["sub"],
                 bg=t["surface"]).pack(side="left", padx=(0, 6))
        tid = REntry(trow, t, width=200, height=34, bg=t["surface"],
                     placeholder="如 eny_0082_hsbear")
        tid.pack(side="left", padx=(0, 12))
        self.template_entries["id"] = tid
        tk.Label(trow, text="等级", font=(FONT, 9), fg=t["sub"],
                 bg=t["surface"]).pack(side="left", padx=(0, 6))
        tlv = REntry(trow, t, width=56, height=34, bg=t["surface"])
        tlv.set("90")
        tlv.pack(side="left", padx=(0, 12))
        self.template_entries["level"] = tlv
        tk.Label(trow, text="血量倍率", font=(FONT, 9), fg=t["sub"],
                 bg=t["surface"]).pack(side="left", padx=(0, 6))
        tmul = REntry(trow, t, width=56, height=34, bg=t["surface"])
        tmul.set("1.0")
        tmul.pack(side="left")
        self.template_entries["hpmult"] = tmul

        # 自定义区
        self.enemy_custom = tk.Frame(card.body, bg=t["surface"])
        self.enemy_entries: dict[str, REntry] = {}

        def row_frame(parent):
            f = tk.Frame(parent, bg=t["surface"])
            f.pack(fill="x", pady=(8, 0))
            return f

        def lab(parent, text, pad=(0, 6)):
            tk.Label(parent, text=text, font=(FONT, 9), fg=t["sub"],
                     bg=parent["bg"]).pack(side="left", padx=pad)

        def num_field(parent, key, width, default, pad=(0, 16)):
            e = REntry(parent, t, width=width, height=34, bg=t["surface"])
            e.set(default)
            e.pack(side="left", padx=pad)
            self.enemy_entries[key] = e
            return e

        r1 = row_frame(self.enemy_custom)
        lab(r1, "血量")
        num_field(r1, "hp", 170, "100000000")
        lab(r1, "防御")
        num_field(r1, "def", 70, "100", pad=(0, 0))

        r2 = row_frame(self.enemy_custom)
        lab(r2, "元素抗性", pad=(0, 10))
        for key, label in ELEMENTS:
            lab(r2, label, pad=(8, 4))
            num_field(r2, key, 52, "20", pad=(0, 2))

        r3 = row_frame(self.enemy_custom)
        lab(r3, "失衡上限")
        num_field(r3, "stagger", 80, "320")
        lab(r3, "失衡时长(s)")
        num_field(r3, "break", 52, "9")
        lab(r3, "处决回技")
        num_field(r3, "exec", 52, "50", pad=(0, 0))

        self._hint(card.body, "排轴内敌人＝完全沿用排轴作者的设置（见上方摘要）；"
                              "训练木桩＝0 抗性/极大血量，测纯输出上限；"
                              "敌人模板＝AKEData 解包的真实数值，不含任何副本难度改动；"
                              "自定义＝手动填写。注意：排轴内的抗性/血量是排轴作者设的，"
                              "可能与真实模板不同（例如战争回响天鼓为全抗 50、血量×3.6）。")

    def _apply_preset(self):
        mode = self.enemy_seg.value
        for f in (self.enemy_custom, self.enemy_template):
            f.pack_forget()
        if mode == "custom":
            self.enemy_custom.pack(fill="x")
        elif mode == "template":
            self.enemy_template.pack(fill="x")

    @staticmethod
    def _active_scenario(project: dict) -> dict:
        """排轴可能含多个方案，所有读写必须落在激活方案上，而不是第一个。"""
        scs = project.get("scenarioList") or []
        active = project.get("activeScenarioId")
        for sc in scs:
            if sc.get("id") == active:
                return sc
        return scs[0] if scs else {}

    def _load_enemy_defaults(self, path: str):
        try:
            project = json.loads(Path(path).read_text(encoding="utf-8"))
            names = {}
            try:
                names = load_names().get("enemies", {})
            except Exception:
                pass
            if project.get("__native"):
                self.project_enemy_id = project["__native"].get("enemy", {}).get("id") or ""
                en = project["__native"].get("enemy", {})
                if en:
                    self._fill_enemy(en.get("hp"), en.get("resistance", {}),
                                     en.get("maxStagger"), en.get("staggerBreakDuration"),
                                     en.get("finisherRecovery"), en.get("defense"))
                self._set_timeline_summary(None)
                return
            sc = self._active_scenario(project)
            sysc = (sc.get("data") or {}).get("systemConstants", {})
            self.project_enemy_id = project.get("activeEnemyId") or ""
            if sysc.get("enemyHp"):
                sbd = sysc.get("staggerBreakDuration", 9)
                self._fill_enemy(sysc["enemyHp"], sysc.get("resistance") or {},
                                 sysc.get("maxStagger"), sbd / 60 if sbd > 60 else sbd,
                                 sysc.get("executionRecovery"), sysc.get("defense", 100))
                res = sysc.get("resistance") or {}
                self._set_timeline_summary(
                    f"排轴内实际值：HP {sysc['enemyHp']:,.0f} · 全抗 "
                    f"{'/'.join(str(res.get(k, 0)) for k, _ in ELEMENTS)} · "
                    f"防御 {sysc.get('defense', 100):g} · 失衡上限 {sysc.get('maxStagger', '—')} · "
                    f"敌人 {names.get(self.project_enemy_id, self.project_enemy_id or '未指定')}")
            else:
                self._set_timeline_summary(None)
            if self.project_enemy_id:
                self.template_entries["id"].set(self.project_enemy_id)
        except Exception:
            pass

    def _set_timeline_summary(self, text: str | None):
        self._timeline_summary = text or ""
        try:
            self.timeline_enemy_label.config(
                text=text or "排轴内未携带敌人配置（将按模拟器默认：防御 100）")
        except Exception:
            pass

    def _fill_enemy(self, hp, res, stagger, break_dur, exec_sp, defense=None):
        e = self.enemy_entries
        if hp is not None:
            e["hp"].set(hp)
        if stagger is not None:
            e["stagger"].set(stagger)
        if break_dur is not None:
            e["break"].set(break_dur)
        if exec_sp is not None:
            e["exec"].set(exec_sp)
        if defense is not None:
            e["def"].set(defense)
        if res:
            for k, _label in ELEMENTS:
                if k in res:
                    e[k].set(res[k])

    # ---------- ③ 面板修正 ----------

    def _build_cal_card(self):
        t = self.t
        card = Card(self.page, t)
        card.pack(fill="x", padx=22, pady=(0, 10))
        self._section_title(card.body, "3", "面板修正（可选）")

        self._hint(card.body, "条件型暴击机制（如「对寒冷附着敌人暴伤+20%、冻结加倍」「强化普攻"
                              "叠暴击率」）由引擎按每一段命中时的敌人状态自动结算，无需在此填写。"
                              "此栏仅补偿恒定的面板缺口（如某件装备的固定暴击词条未被计入）："
                              "填在已算面板之上额外增加的百分点。写法：all=3 全队每人 +3，"
                              "或 角色ID=8，逗号分隔；留空＝不修正。")

        row = tk.Frame(card.body, bg=t["surface"])
        row.pack(fill="x", pady=(10, 0))
        self.cal_entries: dict[str, REntry] = {}

        def field(label, key, placeholder):
            tk.Label(row, text=label, font=(FONT, 9), fg=t["sub"],
                     bg=t["surface"]).pack(side="left", padx=(0, 6))
            e = REntry(row, t, width=196, height=34, bg=t["surface"],
                       placeholder=placeholder)
            e.pack(side="left", padx=(0, 16))
            self.cal_entries[key] = e

        field("暴击率 +", "crit", "如 all=3")
        field("暴伤 +", "cdmg", "如 all=20")

    # ---------- 计算 & 状态 ----------

    def _build_action(self):
        t = self.t
        wrap = tk.Frame(self.page, bg=t["bg"])
        wrap.pack(fill="x", padx=22, pady=(6, 0))
        self.go_btn = RButton(wrap, t, "开始计算并生成 Excel 报告",
                             command=self._run, kind="primary",
                             height=46, radius=12, font=(FONT, 11, "bold"),
                             width=716)
        self.go_btn.pack()

    def _build_footer(self):
        t = self.t
        self.status_slot = tk.Frame(self.page, bg=t["bg"])
        self.status_slot.pack(fill="x", padx=22, pady=(12, 0))
        self.result_slot = tk.Frame(self.page, bg=t["bg"])
        self.result_slot.pack(fill="x", padx=22, pady=(10, 0))
        tk.Label(self.page, text="计算核心 Endaxis · 数据来源 AKEData (akedata.wiki) · DPS-END v1.0",
                 font=(FONT, 8), fg=t["sub"], bg=t["bg"]).pack(pady=(14, 18))

    def _set_status(self, text, kind="info"):
        self._status_text, self._status_kind = text, kind
        self._render_status()

    def _render_status(self):
        if not hasattr(self, "status_slot"):
            return
        for w in self.status_slot.winfo_children():
            w.destroy()
        t = self.t
        fill = t["accent_soft"] if self._status_kind == "ok" else t["surface2"]
        card = Card(self.status_slot, t, radius=12, padx=14, pady=11, fill=fill)
        card.pack(fill="x")
        row = tk.Frame(card.body, bg=fill)
        row.pack(fill="x")
        dot = tk.Canvas(row, width=14, height=14, bg=fill, highlightthickness=0)
        color = {"info": t["sub"], "ok": t["ok"], "err": t["danger"],
                 "warn": t["danger"]}[self._status_kind]
        dot.create_oval(3, 3, 11, 11, fill=color, outline=color)
        dot.pack(side="left")
        tk.Label(row, text=self._status_text, font=(FONT, 9), fg=t["text"],
                 bg=fill, anchor="w", justify="left").pack(side="left", padx=(8, 0))

    def _render_result(self):
        if not hasattr(self, "result_slot"):
            return
        for w in self.result_slot.winfo_children():
            w.destroy()
        if not self._result:
            return
        t = self.t
        r = self._result
        card = Card(self.result_slot, t)
        card.pack(fill="x")
        tk.Label(card.body, text="计算结果", font=(FONT, 10, "bold"),
                 fg=t["text"], bg=t["surface"]).pack(anchor="w")

        tiles = tk.Frame(card.body, bg=t["surface"])
        tiles.pack(fill="x", pady=(10, 4))
        for i in range(4):
            tiles.columnconfigure(i, weight=1, uniform="tile")

        left = r.get("left")
        left_txt = "已击杀" if (left is not None and left <= 0) else (
            f"{left:,.0f}" if left is not None else "—")
        left_color = t["ok"] if (left is not None and left <= 0) else t["text"]
        items = [("总伤害", f"{r['total']:,.0f}", t["accent"]),
                 ("DPS", f"{r['dps']:,.1f}", t["text"]),
                 ("战斗时长", f"{r['span']:.1f}s", t["text"]),
                 ("敌人剩余血量", left_txt, left_color)]
        for i, (label, value, color) in enumerate(items):
            tile = Card(tiles, t, radius=10, padx=12, pady=9, fill=t["surface2"])
            tile.grid(row=0, column=i, sticky="nsew",
                      padx=(0 if i == 0 else 5, 5 if i == 3 else 0))
            tk.Label(tile.body, text=value, font=("Segoe UI", 15, "bold"), fg=color,
                     bg=t["surface2"]).pack(anchor="w")
            tk.Label(tile.body, text=label, font=(FONT, 8), fg=t["sub"],
                     bg=t["surface2"]).pack(anchor="w")

        meta = tk.Label(card.body, text=r.get("meta", ""), font=(FONT, 8),
                        fg=t["sub"], bg=t["surface"], anchor="w", justify="left")
        meta.pack(fill="x", pady=(8, 0))
        if r.get("supports"):
            tk.Label(card.body, text=r["supports"], font=(FONT, 9, "bold"),
                     fg=t["accent"], bg=t["surface"], anchor="w",
                     justify="left").pack(fill="x", pady=(3, 0))
        if r.get("enemy_cfg"):
            tk.Label(card.body, text=r["enemy_cfg"], font=(FONT, 8),
                     fg=t["text"], bg=t["surface"], anchor="w",
                     justify="left", wraplength=660).pack(fill="x", pady=(2, 0))
        tk.Frame(card.body, bg=t["surface"], height=8).pack(fill="x")
        RButton(card.body, t, "打开 Excel 报告", command=lambda: os.startfile(r["out"]),
                kind="primary", height=38, radius=10, bg=t["surface"]).pack(anchor="w")

    def _run(self):
        if self._busy:
            return
        path = self.file_entry.get().strip()
        if not path or not Path(path).exists():
            messagebox.showwarning("提示", "请先选择排轴 JSON 文件")
            return
        self.file_path = path
        self._busy = True
        self.go_btn.set_enabled(False)
        self.go_btn.set_text("计算中，请稍候…")
        self._result = None
        self._render_result()
        self._set_status("正在调用模拟器计算（约 10 秒）…")
        threading.Thread(target=self._worker, args=(path,), daemon=True).start()

    def _panel_overrides(self, project: dict) -> list[dict]:
        """把「面板修正」输入解析成增量覆盖列表，并记录未匹配的角色 ID。"""
        tracks = []
        if project.get("__native"):
            tracks = [tr.get("id") for tr in (project["__native"].get("tracks") or [])
                      if isinstance(tr, dict) and tr.get("id")]
        else:
            sc = (project.get("scenarioList") or [{}])[0]
            tracks = [tr.get("id") for tr in ((sc.get("data") or {}).get("tracks") or [])
                      if isinstance(tr, dict) and tr.get("id")]
        known = set(tracks)

        out, unknown = [], []
        for key, stat in (("crit", "critRate"), ("cdmg", "critDmg")):
            spec = self.cal_entries[key].get().strip()
            if not spec:
                continue
            for part in spec.replace("，", ",").split(","):
                if "=" not in part:
                    continue
                slug, val = part.split("=", 1)
                slug, val = slug.strip(), val.strip()
                if not val:
                    continue
                try:
                    num = float(val)
                except ValueError:
                    unknown.append(f"{slug}=?")
                    continue
                if slug == "all":
                    out.extend({"track": tid, "stat": stat, "value": num} for tid in tracks)
                elif slug in known:
                    out.append({"track": slug, "stat": stat, "value": num})
                else:
                    unknown.append(slug)
        self._cal_unknown = unknown
        return out

    def _apply_overrides(self, project: dict) -> dict:
        import copy
        proj = copy.deepcopy(project)
        mode = self.enemy_seg.value

        def num(entry, default):
            try:
                return float(entry.get() or default)
            except ValueError:
                return float(default)

        if proj.get("__native"):
            en = proj["__native"].setdefault("enemy", {})
            if mode == "custom":
                en["hp"] = num(self.enemy_entries["hp"], 1e9)
                en["defense"] = num(self.enemy_entries["def"], 100)
                en["resistance"] = {k: num(self.enemy_entries[k], 0) for k, _ in ELEMENTS}
                en["maxStagger"] = num(self.enemy_entries["stagger"], 1e9)
                en["staggerBreakDuration"] = num(self.enemy_entries["break"], 9)
                en["finisherRecovery"] = num(self.enemy_entries["exec"], 50)
            elif mode == "dummy":
                en["hp"] = 1e9
                en["defense"] = num(self.enemy_entries["def"], 100)
                en["resistance"] = {k: 0 for k, _ in ELEMENTS}
                en["maxStagger"] = 1e9
            elif mode == "template":
                # 原生模式：让构建器自己按 模板ID+等级+血量倍率 取真实数值
                en["id"] = self.template_entries["id"].get().strip() or en.get("id")
                en["level"] = int(num(self.template_entries["level"], 90))
                en["hpMultiplier"] = num(self.template_entries["hpmult"], 1.0)
                for key in ("hp", "defense", "resistance", "maxStagger"):
                    en.pop(key, None)
        else:
            sc = self._active_scenario(proj)
            sysc = (sc.setdefault("data", {})).setdefault("systemConstants", {})
            if mode == "dummy":
                sysc["enemyHp"] = 1e9
                sysc["resistance"] = {k: 0 for k, _ in ELEMENTS}
                sysc["maxStagger"] = 1e9
            elif mode == "custom":
                sysc["enemyHp"] = num(self.enemy_entries["hp"], 1e9)
                sysc["defense"] = num(self.enemy_entries["def"], 100)
                sysc["resistance"] = {k: num(self.enemy_entries[k], 0) for k, _ in ELEMENTS}
                sysc["maxStagger"] = num(self.enemy_entries["stagger"], 1e9)
                sysc["staggerBreakDuration"] = num(self.enemy_entries["break"], 9) * 60
                sysc["executionRecovery"] = num(self.enemy_entries["exec"], 50)
            elif mode == "template":
                self._apply_template_enemy(sysc, proj)

        ov = self._panel_overrides(proj)
        if ov:
            proj["__panelOverrides"] = ov
        return proj

    def _apply_template_enemy(self, sysc: dict, proj: dict):
        """把 AKEData 敌人模板的真实数值写入 systemConstants。"""
        from dps_end.akedata import fetch_enemy
        enemy_id = self.template_entries["id"].get().strip()
        if not enemy_id:
            raise ValueError("请填写敌人模板 ID（如 eny_0082_hsbear）")
        level = int(float(self.template_entries["level"].get() or 90))
        hpmult = float(self.template_entries["hpmult"].get() or 1.0)
        cache = str(APP_DIR / ".akedata_cache")
        tpl = fetch_enemy(enemy_id, level, cache)
        sysc["enemyHp"] = float(tpl["hp"]) * hpmult
        sysc["defense"] = float(tpl.get("defense") or 100)
        sysc["resistance"] = {k: float(tpl["resistance"].get(k, 0)) for k, _ in ELEMENTS}
        if tpl.get("max_stagger"):
            sysc["maxStagger"] = float(tpl["max_stagger"])
        if enemy_id != (getattr(self, "project_enemy_id", None) or ""):
            # 模板与排轴自带敌人不同时，同步 activeEnemyId 让报告显示正确名字
            self.project_enemy_id = enemy_id
            proj["activeEnemyId"] = enemy_id

    def _worker(self, path: str):
        try:
            project = json.loads(Path(path).read_text(encoding="utf-8"))
            project = self._apply_overrides(project)
            sim = run_simulation(project, source_path=path)
            self.root.after(0, lambda: self._set_status("正在生成 Excel 报告…"))
            out_path = str(Path(path).parent / (Path(path).stem + "_DPS报告.xlsx"))
            from dps_end.report import write_report
            names = load_names()
            write_report(sim, project, out_path, names)
            self.root.after(0, lambda: self._done(sim, out_path, names))
        except Exception as e:  # noqa: BLE001
            err = traceback.format_exc()
            self.root.after(0, lambda: self._error(str(e), err))

    def _done(self, sim: dict, out_path: str, names: dict | None = None):
        s = sim.get("summary", {})
        meta = sim.get("meta", {})
        enemy = ((names or {}).get("enemies") or {}).get(meta.get("activeEnemyId") or "")
        enemy_name = enemy or meta.get("enemyName") or "—"
        total = s.get("totalDamage", 0)
        span = s.get("rotationTime") or s.get("spanTime") or 0
        ec = s.get("enemyConfig") or {}
        enemy_cfg = ""
        if ec:
            res = ec.get("resistance") or {}
            res_txt = "/".join(str(res.get(k, 0)) for k, _ in ELEMENTS)
            enemy_cfg = (f"本次实际使用的敌人配置：HP {ec.get('hp') or 0:,.0f} · 全抗 {res_txt} · "
                         f"防御 {ec.get('defense', '—')} · 失衡上限 {ec.get('maxStagger') or '—'} · "
                         f"失衡时长 {ec.get('staggerBreakDuration') or '—'}s")
            if ec.get("panelOverrides"):
                enemy_cfg += f" · 面板修正 {ec['panelOverrides']} 条"
        op_names = (names or {}).get("operators") or {}
        lmdi_rows = sorted(s.get("lmdi") or [], key=lambda r: -r.get("buff", 0))
        tops = [f"{op_names.get(r.get('track'), r.get('track'))} "
                f"{r.get('buff', 0):,.0f}（{r.get('buff', 0) / total:.0%}）"
                for r in lmdi_rows if total and r.get("buff", 0) > 1]
        support_line = "拐力榜（增益贡献）：" + "　".join(tops[:3]) if tops else ""
        self._result = {
            "total": total,
            "dps": s.get("dps", 0),
            "span": span,
            "left": s.get("enemyHpLeft"),
            "out": out_path,
            "meta": (f"排轴：{meta.get('scenario') or '—'}　|　"
                     f"敌人：{enemy_name}　|　"
                     f"命中段数：{s.get('hitCount', 0)}"),
            "enemy_cfg": enemy_cfg,
            "supports": support_line,
        }
        self._busy = False
        self.go_btn.set_enabled(True)
        self.go_btn.set_text("开始计算并生成 Excel 报告")
        if self._cal_unknown:
            bad = "、".join(dict.fromkeys(self._cal_unknown))
            self._set_status(f"计算完成，报告已生成。但面板修正里的「{bad}」"
                             f"没有匹配到干员，已忽略。", "warn")
        else:
            self._set_status("计算完成，报告已生成。", "ok")
        self._render_result()

    def _error(self, msg: str, detail: str):
        self._busy = False
        self.go_btn.set_enabled(True)
        self.go_btn.set_text("开始计算并生成 Excel 报告")
        self._set_status(f"出错：{msg[:90]}", "err")
        messagebox.showerror("计算出错", f"{msg}\n\n{detail[-700:]}")

    def _open_guide(self):
        for name in ("功能说明.md", "README.md", "使用指南.md"):
            for base in (APP_DIR, APP_DIR.parent):
                p = base / name
                if p.exists():
                    try:
                        os.startfile(str(p))
                        return
                    except Exception:
                        pass
        messagebox.showinfo("功能说明", "未找到说明文档，请查看程序目录下的 README.md")

    def run(self):
        self.root.mainloop()


def main():
    try:
        import openpyxl  # noqa: F401
    except ImportError:
        tk.Tk().withdraw()
        messagebox.showerror("缺少依赖", "请先运行「安装环境.bat」")
        sys.exit(1)

    problems = []
    if not (VENDOR / "dpsend-harness.ts").exists():
        problems.append("缺少计算核心 vendor\\endaxis\\dpsend-harness.ts")
    if not (VENDOR / "node_modules" / "vite-node").exists():
        problems.append("缺少计算核心依赖 vendor\\endaxis\\node_modules\n"
                        "（请双击「环境自检与修复.bat」）")
    if bundled_node() is None and shutil.which("node") is None:
        problems.append("缺少 Node 运行环境 runtime\\node.exe\n"
                        "（请重新解压完整安装包，或自行安装 Node.js 20+）")
    if problems:
        tk.Tk().withdraw()
        messagebox.showerror("环境不完整", "\n\n".join(problems))
        sys.exit(1)

    App().run()


if __name__ == "__main__":
    main()
