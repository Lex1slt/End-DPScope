# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['DPS-END.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('dps_end/data/names.json', 'dps_end/data'),
        ('dps_end/data/catalog.json', 'dps_end/data'),
        ('assets/dps-end.ico', 'assets'),
        ('web/dist', 'web/dist'),
    ],
    hiddenimports=[
        'openpyxl',
        'dps_end', 'dps_end.akedata', 'dps_end.parser', 'dps_end.report',
        'dps_end.simnode', 'dps_end.server', 'dps_end.desktop', 'dps_end.updates',
        'dps_end.official_names', 'dps_end.engine_sync',
        'webview', 'webview.platforms.winforms', 'webview.platforms.edgechromium',
        'clr_loader', 'pythonnet',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='End-DPScope',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='assets/dps-end.ico',
)
