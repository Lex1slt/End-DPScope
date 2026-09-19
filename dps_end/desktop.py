"""End-DPScope 桌面窗口：pywebview 原生窗口 + 本地 API 服务。

用系统 WebView（Windows 上是 Edge WebView2）渲染 web/dist 前端，
形态是独立桌面程序——没有浏览器地址栏和页签。
若 pywebview 不可用，自动退回浏览器模式。
"""

from __future__ import annotations

import os
import shutil
import socket
import threading
import webbrowser
from http.server import ThreadingHTTPServer
from pathlib import Path

from .server import Handler, report_path, start_background_sync


def _free_port(preferred: int) -> int:
    for port in range(preferred, preferred + 20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError("8686~8705 端口均被占用，无法启动")


class Api:
    """暴露给前端的原生能力。

    注意：这里**不能挂任何实例属性**（比如把 Window 存成 self.window）。
    pywebview 暴露 js_api 时会递归遍历对象的所有非可调用属性（util.get_functions），
    递归进 Window 会一路走到原生 WinForms 控件——在工作线程上 getattr 原生属性
    会和 UI 线程死锁，整个窗口直接「未响应」。需要窗口时用 webview.windows[0]。
    """

    def is_desktop(self) -> bool:
        return True

    def save_report(self, token: str) -> dict:
        """「另存为」：用系统保存对话框把报告复制到用户选定的位置。

        不走浏览器下载：pywebview 的下载对话框把过滤器写死成「所有文件 (*.*)」，
        保存出来的文件会丢掉 .xlsx 后缀，用户双击时 Windows 不知道该用什么打开。
        """
        import webview

        window = webview.windows[0] if webview.windows else None
        if window is None:
            return {"error": "窗口未就绪，请重试"}
        src = report_path(token)
        if not src:
            return {"error": "报告不存在或已过期，请重新计算"}
        picked = window.create_file_dialog(
            webview.FileDialog.SAVE,
            save_filename=src.name,
            file_types=("Excel 报告 (*.xlsx)", "所有文件 (*.*)"),
        )
        if not picked:
            return {"cancelled": True}
        dest = Path(picked if isinstance(picked, str) else picked[0])
        if dest.suffix.lower() != ".xlsx":
            dest = dest.with_suffix(".xlsx")
        try:
            shutil.copyfile(src, dest)
        except OSError as exc:
            return {"error": f"保存失败：{exc}"}
        return {"saved": str(dest)}


def main():
    port = _free_port(int(os.environ.get("DPSEND_PORT", "8686")))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    start_background_sync()
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{port}"
    try:
        import webview

        # 浏览器式下载保留可用（网页版/兜底），桌面端另有原生「另存为」。
        webview.settings["ALLOW_DOWNLOADS"] = True
        webview.create_window(
            "End-DPScope · 伤害观测台",
            url,
            js_api=Api(),
            width=1024,
            height=880,
            min_size=(760, 620),
        )
        print(f"End-DPScope 桌面窗口已启动（{url}），关闭窗口即退出。")
        webview.start()
    except Exception as exc:  # noqa: BLE001
        print(f"原生窗口不可用（{exc}），已退回浏览器模式：{url}")
        webbrowser.open(url)
        try:
            while True:
                threading.Event().wait(3600)
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
