#!/usr/bin/env python3
"""Generate a style library from the ui-ux-pro-max styles.csv.

Reads styles.csv (67 style categories) and emits src/utils/styleLibrary.ts.
Each style contributes non-color design variables (border radius, glow,
shadow, font, etc.) that can be injected onto :root at runtime — independent
from the 96 color palettes. A "theme" = a palette + a style.

Usage:
    python3 scripts/gen-styles.py
"""
import csv
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from labels import style_label

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STYLES_CSV = r"C:\Users\Administrator\.codebuddy\skills\ui-ux-pro-max\data\styles.csv"
OUT = os.path.join(ROOT, "src", "utils", "styleLibrary.ts")

# Radius by top-level category (from labels.py) so every style is distinct.
CATEGORY_RADIUS = {
    "方正": "0px",
    "极简": "0px",
    "复古": "2px",
    "未来": "8px",
    "数据": "6px",
    "商务": "8px",
    "创意": "12px",
    "圆润": "16px",
    "3D": "14px",
    "自然": "14px",
    "其他": "8px",
}

# Styles that get a glowing accent (name-based).
GLOW_STYLES = [
    "Cyberpunk UI", "Vaporwave", "Retro-Futurism", "HUD / Sci-Fi FUI",
    "Dark Mode (OLED)", "Aurora UI", "Liquid Glass", "Gradient Mesh",
    "Chromatic Aberration", "RGB Split", "Vintage Analog", "Retro Film",
]

# Styles that use a monospace/retro font.
MONO_STYLES = [
    "Brutalism", "Pixel Art", "Retro-Futurism", "HUD / Sci-Fi FUI",
    "Cyberpunk UI", "Vaporwave", "Neubrutalism", "Chromatic Aberration",
]

# Shadow by name keyword (none unless a style suggests a distinct one).
SHADOW_STYLES = {
    "Neumorphism": "soft",
    "Glassmorphism": "glass",
    "Liquid Glass": "glass",
    "Brutalism": "hard",
    "3D & Hyperrealism": "deep",
    "Skeuomorphism": "deep",
    "Claymorphism": "soft",
    "Retro-Futurism": "neon",
}

# Styles that cannot be realised with CSS variables (they require 3D/WebGL,
# voice/AI, cursor tracking or a motion engine). Kept out of the library so the
# picker only offers effects we actually implement (radius/glow/font/shadow).
REMOVE_STYLES = {
    "3D & Hyperrealism",
    "Spatial UI (VisionOS)",
    "3D Product Preview",
    "Voice-First Multimodal",
    "AI-Native UI",
    "Dimensional Layering",
    "Tactile Digital / Deformable UI",
    "Interactive Cursor Design",
    "Kinetic Typography",
    "Motion-Driven",
    "Interactive Product Demo",
    "Micro-interactions",
    "Zero Interface",
    "Liquid Glass",
}


# Effect feature tag by style name — drives strong style-specific CSS in
# globals.css via `:root[data-fx="..."]`. Kept stable so re-running the
# generator preserves the curated visual identity for signature styles.
FX_STYLES = {
    "Neumorphism": "soft",
    "Glassmorphism": "glass",
    "Brutalism": "brutal",
    "Cyberpunk UI": "cyber",
    "HUD / Sci-Fi FUI": "hud",
    "Pixel Art": "pixel",
    "Retro-Futurism": "retro",
    "Vaporwave": "retro",
}

def infer_style_vars(name: str, category: str) -> dict:
    """Derive distinct non-color vars for every style (no uniform fallback)."""
    radius = CATEGORY_RADIUS.get(category, "8px")
    glow = "neon" if any(g in name for g in GLOW_STYLES) else "none"
    font = "monospace" if any(m in name for m in MONO_STYLES) else "inherit"
    shadow = SHADOW_STYLES.get(name, "none")
    blur = "12px" if name == "Glassmorphism" or name == "Liquid Glass" else "0px"
    return {
        "radius": radius,
        "glow": glow,
        "shadow": shadow,
        "font": font,
        "blur": blur,
        "fx": FX_STYLES.get(name, ""),
    }


def parse_design_vars(raw: str) -> dict:
    """Extract --key: value pairs from the Design System Variables column."""
    out = {}
    if not raw:
        return out
    # Find --var: value fragments (value may contain spaces until next --).
    pairs = re.findall(r"--([a-z0-9-]+):\s*([^,]*?)(?=--[a-z0-9-]+:|$)", raw)
    for k, v in pairs:
        key = k.strip().replace("-", "")
        val = v.strip().strip(",")
        if key and val:
            out[key] = val
    return out


def main():
    styles = []
    seen = set()
    with open(STYLES_CSV, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            category = (row.get("Style Category") or "").strip()
            if not category or category in seen:
                continue
            seen.add(category)
            if category in REMOVE_STYLES:
                print(f"skipped (not CSS-realizable): {category}")
                continue
            zh, cat = style_label(category)
            vars_map = infer_style_vars(category, cat)
            # Prefer the CSV's own radius if it parsed a usable --border-radius.
            design_vars = parse_design_vars(row.get("Design System Variables") or "")
            if design_vars.get("borderradius") and design_vars["borderradius"].rstrip("px").isdigit():
                vars_map["radius"] = design_vars["borderradius"]
            styles.append(
                {
                    "id": f"s{len(styles) + 1}",
                    "name": category,
                    "zh": zh,
                    "category": cat,
                    "vars": vars_map,
                }
            )

    lines = [
        "// Auto-generated by scripts/gen-styles.py — do not edit by hand.",
        "// Sourced from the ui-ux-pro-max design system (67 style categories).",
        "// Each style contributes non-color design variables (radius/glow/",
        "// shadow/font); combining a palette + a style yields a full theme.",
        "",
        "export interface StyleVars {",
        "  radius: string;",
        "  glow: string;",
        "  shadow: string;",
        "  font: string;",
        "  blur: string;",
        "  fx?: string;",
        "}",
        "",
        "export interface StyleEntry {",
        "  id: string;",
        "  name: string;",
        "  zh: string;",
        "  category: string;",
        "  vars: StyleVars;",
        "}",
        "",
        "export const styleLibrary: StyleEntry[] = [",
    ]
    for s in styles:
        lines.append(f"  {{")
        lines.append(f'    id: "{s["id"]}",')
        lines.append(f'    name: "{s["name"].replace(chr(34), chr(92) + chr(34))}",')
        lines.append(f'    zh: "{s["zh"].replace(chr(34), chr(92) + chr(34))}",')
        lines.append(f'    category: "{s["category"]}",')
        lines.append("    vars: {")
        for k, v in s["vars"].items():
            lines.append(f'      {k}: "{v}",')
        lines.append("    },")
        lines.append("  },")

    # Apple "liquid glass" style (hand-authored; large radius, frosted glass
    # blur, soft shadow, system font).
    lines.append("  {")
    lines.append('    id: "apple",')
    lines.append('    name: "Apple",')
    lines.append('    zh: "苹果",')
    lines.append('    category: "设计",')
    lines.append("    vars: {")
    lines.append('      radius: "16px",')
    lines.append('      glow: "none",')
    lines.append('      shadow: "glass",')
    lines.append('      font: "inherit",')
    lines.append('      blur: "16px",')
    lines.append('      fx: "apple",')
    lines.append("    },")
    lines.append("  },")

    lines.append("];")
    lines.append("")

    # Guard: styleLibrary.ts is now a hand-curated set of 7 signature styles
    # (Apple / Neumorphism / Glassmorphism / Brutalism / Cyberpunk / Pixel /
    # Retro-Futurism). Refuse to overwrite it with the 67 CSV-derived styles so
    # the curated set survives accidental re-runs of this generator.
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            cur = f.read()
        if "id: \"apple\"" in cur and "复古未来 / 蒸汽波" in cur and len(cur.split("id:")) < 12:
            print(
                "SKIP: styleLibrary.ts is the hand-curated 7-style set. "
                "This generator is retired — refusing to overwrite it."
            )
            return

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"Wrote {len(styles)} styles -> {OUT}")


if __name__ == "__main__":
    main()
