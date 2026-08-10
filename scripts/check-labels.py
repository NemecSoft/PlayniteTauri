from labels import STYLE_LABELS, PALETTE_LABELS
import re
styles = re.findall(r'name: "([^"]+)"', open('src/utils/styleLibrary.ts', encoding='utf-8').read())
palettes = re.findall(r'name: "([^"]+)"', open('src/utils/themeLibrary.ts', encoding='utf-8').read())
miss_s = [n for n in styles if n not in STYLE_LABELS]
miss_p = [n for n in palettes if n not in PALETTE_LABELS]
print(f'styles total={len(styles)} missing={len(miss_s)} {miss_s}')
print(f'palettes total={len(palettes)} missing={len(miss_p)} {miss_p}')
