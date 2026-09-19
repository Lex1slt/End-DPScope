"""DPS-END 发布打包脚本：清理测试残留并生成发布 zip。

用法：python build_package.py

规则（发布包内绝不包含）：
- output/                 —— 用户自己的报告目录，发布时必须不存在（程序会自建）
- 测试轴（示例排轴.json 等轴文件）—— 不随包提供
- __pycache__、~$ 锁文件、.dpsend_ui.json 等临时产物
- .akedata_cache/sync_state.json —— 本机运行留下的同步时间戳

打包结束后会做「目录 ⇋ 压缩包」逐文件 CRC 校验：谁多谁少、内容不一致都直接报错。
这样交付时 DPS-END-v1.0-x64/ 文件夹和 zip 永远完全一致，方便直接查验。
"""

import hashlib
import shutil
import time
import zipfile
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PKG = ROOT / "End-DPScope-v1.0-x64"
OUT = ROOT / "End-DPScope-v1.0-x64.zip"

EXCLUDE_DIR_NAMES = {"output", "__pycache__"}
EXCLUDE_FILE_NAMES = {"示例排轴.json", "sync_state.json"}
EXCLUDE_PREFIXES = ("~$", ".dpsend_ui")


def clean():
    """把包目录恢复到可发布状态。"""
    for d in PKG.rglob("__pycache__"):
        shutil.rmtree(d, ignore_errors=True)
    out_dir = PKG / "output"
    if out_dir.exists():
        shutil.rmtree(out_dir, ignore_errors=True)
    for f in PKG.rglob("*"):
        if f.is_file() and f.name.startswith(EXCLUDE_PREFIXES):
            f.unlink(missing_ok=True)
    # 同步时间戳是本机运行留下的状态，不该随包发出去
    (PKG / ".akedata_cache" / "sync_state.json").unlink(missing_ok=True)
    test_axis = PKG / "示例排轴.json"
    if test_axis.exists():
        test_axis.unlink()


def folder_files():
    """按发布规则枚举包目录应包含的文件（相对路径，posix 分隔）。"""
    for p in sorted(PKG.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(PKG)
        if any(part in EXCLUDE_DIR_NAMES for part in rel.parts):
            continue
        if p.name in EXCLUDE_FILE_NAMES or p.name.startswith(EXCLUDE_PREFIXES):
            continue
        yield p, rel


def verify():
    """目录 ⇋ zip 逐文件校验；目录里多出来的运行时产物直接清掉。"""
    # 先清一遍：打包期间/打包后跑过程序都会再生成 output/、sync_state.json
    clean()

    with zipfile.ZipFile(OUT) as z:
        # 归档内路径带「DPS-END-v1.0-x64/」前缀，比较时必须剥掉，否则整个目录
        # 都会被误判成「多出来的文件」而被清掉
        prefix = PKG.name + "/"
        zipped = {
            i.filename[len(prefix):]: i.CRC
            for i in z.infolist() if not i.is_dir()
        }

    actual = {rel.as_posix(): p for p, rel in folder_files()}

    extra = sorted(set(actual) - set(zipped))
    missing = sorted(set(zipped) - set(actual))
    changed = sorted(
        name for name in set(zipped) & set(actual)
        if zlib.crc32(actual[name].read_bytes()) & 0xFFFFFFFF != zipped[name]
    )

    if extra:
        print("目录里多出的运行时产物（已清理）：")
        for name in extra:
            print(f"  - {name}")
            (PKG / name).unlink(missing_ok=True)
        # 清完重算一遍集合
        actual = {rel.as_posix(): p for p, rel in folder_files()}
        extra = sorted(set(actual) - set(zipped))

    problems = []
    if extra:
        problems.append(f"目录多出 {len(extra)} 个文件（清不掉）：{extra[:5]}")
    if missing:
        problems.append(f"目录缺少 {len(missing)} 个文件：{missing[:5]}")
    if changed:
        problems.append(f"{len(changed)} 个文件内容与 zip 不一致：{changed[:5]}")
    if problems:
        raise SystemExit("❌ 目录与压缩包不一致：\n  " + "\n  ".join(problems))

    digest = hashlib.sha256(OUT.read_bytes()).hexdigest()
    print(f"✅ 目录与压缩包完全一致：{len(zipped)} 个文件逐一比对通过（路径 + CRC）")
    print(f"   zip: {OUT.name}  {OUT.stat().st_size / 1048576:.1f} MB")
    print(f"   SHA256: {digest}")


def main():
    clean()
    t0 = time.time()
    n = 0
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for p, rel in folder_files():
            z.write(p, (PKG.name / rel).as_posix())
            n += 1
    print(f"files: {n}  zip: {OUT.stat().st_size / 1048576:.1f} MB  in {time.time() - t0:.0f}s")
    verify()


if __name__ == "__main__":
    main()
