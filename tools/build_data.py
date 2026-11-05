# -*- coding: utf-8 -*-
"""一键重建站点数据：解析名单 + 扫描图片目录。

只用 Python 标准库，不安装任何包，所有写入都在本仓库文件夹内。

运行：双击仓库根目录的 update.bat，或 python tools/build_data.py

名单格式（waifulist.txt）：
    原神：
    荧
    三月七（含存护，巡猎，长夜月）
新增 IP 请写成「新IP：」（带冒号），新增角色直接加一行。

图片摆放（脚本会自动把所有角色文件夹建好）：
    images/原神/01-荧/1.webp
    images/原神/01-荧/2.png
文件名任意、张数不限，按自然顺序排列；改完名单或放完图片后，再运行一次即可。
"""

import hashlib
import json
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "waifulist.txt"
OUT = ROOT / "data" / "site-data.js"
IMAGES = ROOT / "images"

IMAGE_EXT = {".webp", ".jpg", ".jpeg", ".png", ".gif", ".avif", ".bmp", ".svg"}
NO_COLON_IPS = {"9nine", "崩坏3rd"}  # 原名单里这两个 IP 名没带冒号


def safe_dir(name):
    return re.sub(r'[\\/:*?"<>|]', "_", name).strip() or "unnamed"


def stable_id(text, prefix, length=8):
    return prefix + hashlib.md5(text.encode("utf-8")).hexdigest()[:length]


def natural_key(name):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name)]


def url_path(*parts):
    return "/".join(quote(p, safe="") for p in parts)


def parse_list():
    lines = [x.strip() for x in SRC.read_text(encoding="utf-8").splitlines()]
    ip_lines = [
        i for i, s in enumerate(lines)
        if s and (s.endswith((":", "：")) or s in NO_COLON_IPS)
    ]
    if not ip_lines:
        raise ValueError("waifulist.txt 里没有找到任何 IP 行（IP 行请以 : 或 ： 结尾）")

    intro = [s for s in lines[: ip_lines[0]] if s]
    ips = []
    for j, start in enumerate(ip_lines):
        end = ip_lines[j + 1] if j + 1 < len(ip_lines) else len(lines)
        name = lines[start].rstrip(":：")
        note, characters, seen = "", [], set()

        for raw in lines[start + 1:end]:
            if not raw:
                continue
            if raw.startswith("（"):          # 分区备注，例如「（剪影还有两位，等待版本更新）」
                note = raw
                continue
            if "（" in raw and raw.endswith("）"):
                char_name, tag = raw.split("（", 1)
                tag = tag[:-1]                  # 标签保留括号内原文
            else:
                char_name, tag = raw, ""
            if char_name in seen:
                print("  跳过重复条目：" + raw)
                continue
            seen.add(char_name)
            no = len(characters) + 1
            characters.append({
                "id": stable_id(name + "/" + char_name, "c_"),
                "name": char_name,
                "tag": tag,
                "folder": f"{no:02d}-{safe_dir(char_name)}",
            })

        ips.append({
            "id": stable_id(name, "ip_"),
            "name": name,
            "dir": safe_dir(name),
            "note": note,
            "characters": characters,
        })
    return intro, ips


def build_images(ips):
    created = with_images = total_images = 0
    for ip in ips:
        ip_root = IMAGES / ip["dir"]
        for ch in ip["characters"]:
            folder = ip_root / ch["folder"]
            if not folder.exists():
                folder.mkdir(parents=True, exist_ok=True)
                created += 1
            keep = folder / ".gitkeep"
            if not keep.exists():
                keep.touch()

            files = [
                f for f in folder.iterdir()
                if f.is_file() and not f.name.startswith(".")
                and f.suffix.lower() in IMAGE_EXT
            ]
            files.sort(key=lambda f: natural_key(f.name))
            ch["images"] = [
                url_path("images", ip["dir"], ch["folder"], f.name) for f in files
            ]
            if files:
                with_images += 1
                total_images += len(files)
    return created, with_images, total_images


def orphan_dirs(ips):
    """名单里已删掉、但用户还留着图片的文件夹：只提示，绝不删除。"""
    if not IMAGES.exists():
        return []
    known = {(ip["dir"], ch["folder"]) for ip in ips for ch in ip["characters"]}
    out = []
    for ip_dir in IMAGES.iterdir():
        if not ip_dir.is_dir() or ip_dir.name.startswith("."):
            continue
        for folder in ip_dir.iterdir():
            if folder.is_dir() and (ip_dir.name, folder.name) not in known:
                out.append(ip_dir.name + "/" + folder.name)
    return out


def main():
    intro, ips = parse_list()
    created, with_images, total_images = build_images(ips)
    total_chars = sum(len(ip["characters"]) for ip in ips)

    payload = {
        "generated": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "stats": {
            "ips": len(ips),
            "characters": total_chars,
            "with_images": with_images,
            "images": total_images,
        },
        "intro": intro,
        "ips": ips,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        "window.SITE_DATA = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )

    print("已生成 " + str(OUT))
    print(f"  {len(ips)} 个 IP / {total_chars} 位角色 / {with_images} 位有图 / {total_images} 张图片")
    if created:
        print(f"  新建了 {created} 个角色文件夹；把图片放进去后再运行一次本脚本即可")
    orphans = orphan_dirs(ips)
    if orphans:
        print(f"  提示：{len(orphans)} 个文件夹不在名单中，已保留原样，不会显示在网页上")


if __name__ == "__main__":
    main()
