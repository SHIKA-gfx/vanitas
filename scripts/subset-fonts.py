"""
경기천년제목 웹폰트 부분집합 만들기.

원본(경기도 배포 WOFF, 한글 11,172자)에서 KS X 1001 한글 2,350자 + ASCII + 자주 쓰는 기호만 남겨
WOFF2로 저장한다. 굵기당 약 470KB → 약 150KB.

화면·데이터에 쓰는 한글이 2,350자를 벗어나면 src/lib/font-coverage.test.ts가 실패한다.
그때는 EXTRA에 글자를 더하고 이 스크립트를 다시 돌린다.

영문 워드마크 글꼴 Oxanium(가변, SIL OFL)도 ASCII만 남겨 Oxanium.woff2로 만든다 (약 8KB).
원본은 google/fonts 저장소의 ofl/oxanium/Oxanium[wght].ttf. 원본 폴더에 없으면 건너뛴다.

사용: python scripts/subset-fonts.py <원본 폴더>
  원본 폴더에 Title_Light.woff / Title_Medium.woff / Title_Bold.woff 가 있어야 한다.
  필요: pip install fonttools brotli

라이선스: 공공누리 제1유형(출처 표시). 수정·재배포 가능, 유료 판매 금지.
"""

import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

OUT = Path(__file__).resolve().parent.parent / "static" / "fonts"
WEIGHTS = ["Light", "Medium", "Bold"]
# KS X 1001 밖의 글자가 필요해지면 여기에 더한다
EXTRA = ""
SYMBOLS = "·…—–‘’“”→←↑↓×÷±%※○●■□★☆"


def ks_x_1001_hangul() -> str:
    chars = []
    for hi in range(0xB0, 0xC9):
        for lo in range(0xA1, 0xFF):
            try:
                c = bytes([hi, lo]).decode("euc-kr")
            except UnicodeDecodeError:
                continue
            if "\uac00" <= c <= "\ud7a3":
                chars.append(c)
    return "".join(chars)


def main(src: Path) -> None:
    text = "".join(chr(c) for c in range(0x20, 0x7F)) + ks_x_1001_hangul() + SYMBOLS + EXTRA
    OUT.mkdir(parents=True, exist_ok=True)
    for w in WEIGHTS:
        options = subset.Options()
        options.flavor = "woff2"
        options.layout_features = ["*"]
        options.name_IDs = ["*"]  # 저작권·라이선스 표기를 남긴다
        options.notdef_outline = True
        font = TTFont(src / f"Title_{w}.woff")
        sub = subset.Subsetter(options)
        sub.populate(text=text)
        sub.subset(font)
        font.flavor = "woff2"
        out = OUT / f"GyeonggiTitle-{w}.woff2"
        font.save(out)
        print(f"{out.name}: {out.stat().st_size // 1024} KB")

    oxanium = src / "Oxanium[wght].ttf"
    if oxanium.exists():
        options = subset.Options()
        options.flavor = "woff2"
        options.layout_features = ["*"]
        options.name_IDs = ["*"]
        options.notdef_outline = True
        font = TTFont(oxanium)
        sub = subset.Subsetter(options)
        sub.populate(text="".join(chr(c) for c in range(0x20, 0x7F)) + "·–—‘’“”")
        sub.subset(font)
        font.flavor = "woff2"
        out = OUT / "Oxanium.woff2"
        font.save(out)
        print(f"{out.name}: {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))
