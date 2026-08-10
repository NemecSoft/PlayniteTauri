import glob, os, re
files = glob.glob("dist/assets/*.css")
for f in files:
    c = open(f, encoding="utf-8", errors="ignore").read()
    for key in ["--radius-md", "--radius-lg", ".rounded-md", "border-radius"]:
        idx = c.find(key)
        if idx >= 0:
            start = max(0, idx - 40)
            print(f"[{f}] ...{c[start:idx+60]}...")
            print("---")
