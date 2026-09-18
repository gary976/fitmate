# 打包 SCF 函数 zip，并给 scf_bootstrap 设置 0755 可执行权限
import os
import zipfile

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(os.path.dirname(here), 'fitmate-ai-scf.zip')

with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for name in ('index.js', 'scf_bootstrap'):
        p = os.path.join(here, name)
        zi = zipfile.ZipInfo(name)
        zi.external_attr = (0o755 << 16) | 0o20  # rwxr-xr-x + 普通文件
        zi.compress_type = zipfile.ZIP_DEFLATED
        with open(p, 'rb') as f:
            z.writestr(zi, f.read())

print('OK ->', out, os.path.getsize(out), 'bytes')
