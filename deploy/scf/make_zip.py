# 打包 SCF 函数 zip（create_system=3 Unix 格式，确保解压器兼容）
import os
import time
import zipfile

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(os.path.dirname(here), 'fitmate-ai-scf.zip')

now = time.localtime()[:6]

with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for name in ('index.js', 'scf_bootstrap'):
        p = os.path.join(here, name)
        zi = zipfile.ZipInfo(name, date_time=now)
        zi.create_system = 3  # Unix，否则 Windows 下生成的 zip 可能被服务端拒绝
        zi.external_attr = (0o755 << 16) | 0o20  # rwxr-xr-x + 普通文件
        zi.compress_type = zipfile.ZIP_DEFLATED
        with open(p, 'rb') as f:
            z.writestr(zi, f.read())

print('OK ->', out, os.path.getsize(out), 'bytes')
