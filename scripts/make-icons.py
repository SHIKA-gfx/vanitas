"""
VANITAS 파비콘·앱 아이콘·공유 미리보기 이미지 만들기 (공개 준비 4번, 2026-10-03).

디자인 문서 4장 규칙 "로고 마스터를 고치면 파생물을 전부 다시 뽑는다"를 자동화한 것.
- 심볼: src/lib/components/VanitasSymbol.svelte 안의 <g>를 그대로 읽는다 (화면과 같은 모양)
- 글자: static/fonts의 웹폰트에서 글리프 윤곽을 꺼내 SVG 경로로 그린다 → 컴퓨터에 글꼴을 설치할 필요가 없다
- 배경: 홈의 삼각형 타일(TriangleBackground.svelte)과 같은 규칙

만드는 파일 (static/)
  favicon.svg            브라우저 탭 (파란 원 + 흰 심볼)
  favicon-32.png         SVG 파비콘을 못 쓰는 브라우저용
  apple-touch-icon.png   아이폰 홈 화면 (180×180, 꽉 찬 사각형 — 모서리는 기기가 둥글린다)
  icon-192.png, icon-512.png   안드로이드 홈 화면·앱 설치 (가장자리 여유를 둔 maskable)
  og-image.png           링크 미리보기 (1200×630)

만드는 파일 (.github/assets/ — 사이트에는 배포되지 않는다)
  readme-banner.png      GitHub README 맨 위 배너 (1280×400)

사용: python scripts/make-icons.py
필요: pip install fonttools brotli cairosvg
"""

import math
import re
from pathlib import Path

import cairosvg
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / "static"
FONTS = STATIC / "fonts"

# 디자인 토큰 (src/routes/layout.css와 같은 값)
BRAND = "#1288f8"
INK = "#2b2b2b"
NAVY = "#2a425b"
WASH = "#f2f9ff"
SKY = "#7cd0ff"
SKY_MUTED = "#a3c5d8"


# ---------------------------------------------------------------- 심볼


def symbol_group(color: str) -> str:
    """VanitasSymbol.svelte의 <g>…</g> (viewBox 0 0 64 64), currentColor를 색으로 바꿔서"""
    source = (ROOT / "src/lib/components/VanitasSymbol.svelte").read_text(encoding="utf-8")
    match = re.search(r"<g transform=.*?</g>", source, re.S)
    if not match:
        raise SystemExit("VanitasSymbol.svelte에서 <g>를 찾지 못했습니다")
    # 부품에서는 채움 색(fill)이 바깥 <svg>에 걸려 있으므로 여기서 다시 건다
    return f'<g fill="{color}">{match.group(0).replace("currentColor", color)}</g>'


def symbol_at(cx: float, cy: float, size: float, color: str) -> str:
    """심볼(64 단위)을 가운데가 (cx, cy), 한 변 size인 상자에"""
    s = size / 64
    return f'<g transform="translate({cx - size / 2} {cy - size / 2}) scale({s})">{symbol_group(color)}</g>'


# ---------------------------------------------------------------- 글자 → 경로


def text_path(text: str, font_file: str, size: float, x: float, baseline: float,
              color: str, tracking: float = 0.0, anchor: str = "start", weight: int | None = None) -> str:
    """웹폰트의 글리프 윤곽으로 글자를 그린다. tracking은 글자 크기에 대한 비율(0.025 = tracking-wide).
    weight: 가변 글꼴(Oxanium)의 굵기. 지정하지 않으면 글꼴의 기본값(Oxanium은 200, 가장 가늘다)"""
    font = TTFont(FONTS / font_file)
    if weight is not None and "fvar" in font:
        font = instantiateVariableFont(font, {"wght": weight})
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    upm = font["head"].unitsPerEm
    scale = size / upm
    advances = [glyphs[cmap[ord(ch)]].width * scale + tracking * size for ch in text]
    width = sum(advances) - tracking * size
    left = x - width / 2 if anchor == "middle" else x

    paths = []
    cursor = left
    for ch, adv in zip(text, advances):
        glyph = glyphs[cmap[ord(ch)]]
        pen = SVGPathPen(glyphs)
        # 글꼴 좌표는 위가 +y, SVG는 아래가 +y → 세로를 뒤집는다
        glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, cursor, baseline)))
        if pen.getCommands():
            paths.append(pen.getCommands())
        cursor += adv
    return f'<path fill="{color}" d="{" ".join(paths)}"/>'


# ---------------------------------------------------------------- 삼각형 배경 (TriangleBackground.svelte와 같은 규칙)


def triangles(width: int, height: int, size: float) -> str:
    cols, rows = 12, 4
    h = size * math.sqrt(3) / 2

    def tone(k: int, r: int):
        kk, rr = k % cols, r % rows
        n = abs((kk * 73856093) ^ (rr * 19349663)) % 100
        if n < 52:
            return None
        if n < 72:
            return SKY, 0.28
        if n < 90:
            return SKY_MUTED, 0.35
        return SKY, 0.5

    out = [f'<rect width="{width}" height="{height}" fill="{WASH}"/>']
    for r in range(int(height / h) + 2):
        for k in range(-2, int(width / (size / 2)) + 3):
            t = tone(k, r)
            if not t:
                continue
            x, y0 = k * size / 2, r * h
            y1 = y0 + h
            up = (k + r) % 2 == 0
            pts = [(x, y1), (x + size, y1), (x + size / 2, y0)] if up else [(x, y0), (x + size, y0), (x + size / 2, y1)]
            points = " ".join(f"{px:.1f},{py:.1f}" for px, py in pts)
            out.append(f'<polygon points="{points}" fill="{t[0]}" fill-opacity="{t[1]}"/>')
    return "".join(out)


# ---------------------------------------------------------------- 파일


def svg(width: int, height: int, body: str) -> str:
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">{body}</svg>'


def icon_round() -> str:
    """파란 원 + 흰 심볼 (홈 화면 원과 같은 모양). 파비콘"""
    return svg(64, 64, f'<circle cx="32" cy="32" r="32" fill="{BRAND}"/>{symbol_at(32, 33, 40, "#ffffff")}')


def icon_square(size: int, symbol_ratio: float) -> str:
    """꽉 찬 파란 사각형 + 흰 심볼. 모서리는 기기가 둥글린다"""
    return svg(size, size, f'<rect width="{size}" height="{size}" fill="{BRAND}"/>'
               f'{symbol_at(size / 2, size * 0.515, size * symbol_ratio, "#ffffff")}')


def og_image() -> str:
    w, h = 1200, 630
    cx, cy, r = 330, 315, 170
    body = [
        triangles(w, h, 120),
        # 원 둘레의 옅은 띠 — 홈의 원과 타일 사이 틈 느낌
        f'<circle cx="{cx}" cy="{cy}" r="{r + 18}" fill="#ffffff" fill-opacity="0.75"/>',
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{BRAND}"/>',
        symbol_at(cx, cy + 4, r * 1.25, "#ffffff"),
        text_path("VANITAS", "Oxanium.woff2", 132, 580, 330, INK, tracking=0.04, weight=700),
        text_path("블루 아카이브 재화·픽업 플래너", "GyeonggiTitle-Bold.woff2", 42, 584, 405, NAVY),
        text_path("비공식 팬 사이트", "GyeonggiTitle-Medium.woff2", 26, 586, 455, NAVY),
    ]
    return svg(w, h, "".join(body))


def readme_banner() -> str:
    """GitHub README 배너. 미리보기 이미지와 같은 구성을 가로로 넓게"""
    w, h = 1280, 400
    cx, cy, r = 250, 200, 118
    body = [
        triangles(w, h, 110),
        f'<circle cx="{cx}" cy="{cy}" r="{r + 14}" fill="#ffffff" fill-opacity="0.75"/>',
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{BRAND}"/>',
        symbol_at(cx, cy + 3, r * 1.25, "#ffffff"),
        text_path("VANITAS", "Oxanium.woff2", 112, 430, 215, INK, tracking=0.04, weight=700),
        text_path("블루 아카이브 재화·픽업 플래너", "GyeonggiTitle-Bold.woff2", 36, 434, 278, NAVY),
        text_path("내 청휘석으로 누구를 데려올 수 있는지 계산해요", "GyeonggiTitle-Medium.woff2", 24, 436, 322, NAVY),
    ]
    return svg(w, h, "".join(body))


def main() -> None:
    STATIC.mkdir(exist_ok=True)
    (STATIC / "favicon.svg").write_text(icon_round(), encoding="utf-8")
    cairosvg.svg2png(bytestring=icon_round().encode(), write_to=str(STATIC / "favicon-32.png"),
                     output_width=32, output_height=32)
    cairosvg.svg2png(bytestring=icon_square(180, 0.66).encode(), write_to=str(STATIC / "apple-touch-icon.png"))
    # maskable: 안드로이드가 원·물방울 등으로 잘라도 심볼이 남도록 가운데 60% 안에
    for size in (192, 512):
        cairosvg.svg2png(bytestring=icon_square(size, 0.56).encode(), write_to=str(STATIC / f"icon-{size}.png"))
    cairosvg.svg2png(bytestring=og_image().encode(), write_to=str(STATIC / "og-image.png"))
    assets = ROOT / ".github" / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    cairosvg.svg2png(bytestring=readme_banner().encode(), write_to=str(assets / "readme-banner.png"))
    print(f"readme-banner.png: {(assets / 'readme-banner.png').stat().st_size // 1024} KB")
    for name in ("favicon.svg", "favicon-32.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "og-image.png"):
        print(f"{name}: {(STATIC / name).stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
