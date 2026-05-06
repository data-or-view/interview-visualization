#!/usr/bin/env python3
"""
generate-manifest.py — Auto-generate manifest.json from trace files with embedded metadata.

Usage:
    cd public/demos/
    python3 generate-manifest.py

Convention:
    Each .jsonl file MUST have a metadata event as its FIRST line:
        {"cat":"meta", "_title":"SELECT 回表演示", "_type":"select_back_to_table", ...}

    The script scans all .jsonl files, reads the first line of each, and
    writes manifest.json with the aggregated metadata.

Adding a new demo:
    1. Run your SQL with --trace-file, get the .jsonl output
    2. Copy it to public/demos/<name>.jsonl
    3. Prepend a meta event as the first line (see existing files for format)
    4. Run this script → done! No frontend code changes needed.
"""

import json
import os
import sys
import re

DEMOS_DIR = os.path.dirname(os.path.abspath(__file__))

def generate_manifest():
    manifest = []

    for fname in sorted(os.listdir(DEMOS_DIR)):
        if not fname.endswith('.jsonl') or fname == 'manifest.json':
            continue

        filepath = os.path.join(DEMOS_DIR, fname)
        try:
            with open(filepath) as f:
                first_line = f.readline().strip()
                meta = json.loads(first_line)

            if meta.get('cat') != 'meta':
                print(f"  ⚠  {fname}: 第一行不是 meta 事件，跳过")
                continue

            meta['file'] = fname
            manifest.append(meta)
            print(f"  ✅ {fname:30s}  {meta.get('_title','?')}")

        except (json.JSONDecodeError, IOError) as e:
            print(f"  ❌ {fname}: {e}")

    manifest_path = os.path.join(DEMOS_DIR, 'manifest.json')
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(f"\n📋 manifest.json 生成完毕，共 {len(manifest)} 个演示")
    return manifest

if __name__ == '__main__':
    print("🔍 扫描演示文件...\n")
    generate_manifest()
