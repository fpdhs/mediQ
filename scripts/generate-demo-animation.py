import os
from PIL import Image, ImageDraw, ImageFont

OUTPUT_PATH = 'public/mediq_demo_3roles.gif'
WIDTH = 1280
HEIGHT = 720

FONT_PATH_BD = r'C:\Windows\Fonts\malgunbd.ttf'
FONT_PATH_RG = r'C:\Windows\Fonts\malgun.ttf'

font_title = ImageFont.truetype(FONT_PATH_BD, 26)
font_role = ImageFont.truetype(FONT_PATH_BD, 18)
font_desc = ImageFont.truetype(FONT_PATH_RG, 16)
font_badge = ImageFont.truetype(FONT_PATH_BD, 15)

SCENES = [
    {
        "act": "ACT 1: 환자 포털 (Patient Portal)",
        "act_color": (56, 189, 248),
        "title": "❶ 환자 본인인증 & Microsoft 로그인",
        "desc": "Microsoft Entra ID를 통한 신원 인증. 인증(Who)과 의료 인가(What)의 물리적 격리",
        "invariant": "IdP 분리 원칙",
        "img_path": "public/demo-assets/01_patient_login.png",
        "crop_box": (300, 200, 1860, 1150)
    },
    {
        "act": "ACT 1: 환자 포털 (Patient Portal)",
        "act_color": (56, 189, 248),
        "title": "❷ 특정 CT 검사 선택 및 세밀한 동의(ABAC Scope) 생성",
        "desc": "환자가 서울성모병원 복부 CT 700장을 선택하고 수신병원 및 VIEW_ONLY 권한 지정",
        "invariant": "Patient Least Privilege",
        "img_path": "public/demo-assets/02_patient_consent.png",
        "crop_box": (0, 0, 1020, 566)
    },
    {
        "act": "ACT 1: 환자 포털 (Patient Portal)",
        "act_color": (56, 189, 248),
        "title": "❸ HMAC-SHA256 암호화 일회용 QR 접수증 발급",
        "desc": "위변조 불가능한 일회용 QR 티켓 발급 ➔ 환자 스마트폰 지참 후 수신병원 진료실 방문",
        "invariant": "Tamper-Proof Ephemeral Token",
        "img_path": "public/demo-assets/03_patient_qr.png",
        "crop_box": (100, 50, 1436, 950)
    },
    {
        "act": "ACT 2: 의료진 진료실 (Clinician Studio)",
        "act_color": (16, 185, 129),
        "title": "❹ B병원 호흡기내과 의료진 로그인 및 QR 현장 접수",
        "desc": "수신병원 전문의가 환자 제시 일회용 QR 코드를 스캔하여 진료 접수 및 영상 조회 요청",
        "invariant": "Doctor Identity & Hospital Binding",
        "img_path": "public/demo-assets/04_doctor_login.png",
        "crop_box": (300, 200, 1860, 1150)
    },
    {
        "act": "ACT 2: 정책 검증 (ABAC Engine)",
        "act_color": (16, 185, 129),
        "title": "❺ Control Plane 11단계 ABAC Fail-Closed 전수 검증",
        "desc": "동의 유효성, 의료진 소속, Study UID 등 11개 교집합 조건 통과 시에만 5분 단기 토큰 발급",
        "invariant": "Fail-Closed ABAC Enforcement",
        "img_path": "public/demo-assets/04_doctor_login.png",
        "crop_box": (350, 150, 1810, 1100)
    },
    {
        "act": "ACT 2: 의료진 뷰어 (Clinician Studio)",
        "act_color": (16, 185, 129),
        "title": "❻ 로컬 PACS 직통 700장 CT 무지연 스트리밍 렌더링",
        "desc": "클라우드 무저장(Zero Storage), WireGuard 사설망 직통 WADO-RS 스트리밍 (다운로드 차단)",
        "invariant": "Zero Cloud Storage & WADO-RS",
        "img_path": "public/demo-assets/05_doctor_viewer.png",
        "crop_box": (0, 0, 1280, 911)
    },
    {
        "act": "ACT 3: 보안관제 센터 (Security Console)",
        "act_color": (245, 158, 11),
        "title": "❼ 전 주기 SHA-256 해시 체인 불변 감사로그 적재",
        "desc": "환자 동의 생성부터 의료진 CT 조회까지 모든 행위가 블록체인형 해시 체인으로 기록",
        "invariant": "Tamper-Proof Audit Logging",
        "img_path": "public/demo-assets/07_admin_audit.png",
        "crop_box": (50, 100, 1215, 850)
    },
    {
        "act": "ACT 3: 보안관제 센터 (Security Console)",
        "act_color": (244, 63, 94),
        "title": "❽ 비정상 대량 다운로드 및 만료 토큰 실시간 탐지·차단",
        "desc": "비인가 대량 반출 시도(MASS_DOWNLOAD_ATTEMPT) 실시간 탐지 ➔ 즉시 Fail-Closed 차단",
        "invariant": "Real-time Anomaly Detection",
        "img_path": "public/demo-assets/08_admin_anomaly.png",
        "crop_box": (50, 600, 1215, 1350)
    }
]

def make_frame(scene, scene_num, total_scenes):
    canvas = Image.new('RGB', (WIDTH, HEIGHT), color=(6, 9, 19))

    # Base image crop and resize
    if os.path.exists(scene['img_path']):
        raw_img = Image.open(scene['img_path']).convert('RGB')
        cb = scene.get('crop_box')
        if cb:
            raw_img = raw_img.crop(cb)
        
        # Fit inside width x height preserving aspect
        raw_w, raw_h = raw_img.size
        scale = min(WIDTH / raw_w, (HEIGHT - 120) / raw_h)
        new_w = int(raw_w * scale)
        new_h = int(raw_h * scale)
        scaled_img = raw_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        # Paste centered
        paste_x = (WIDTH - new_w) // 2
        paste_y = (HEIGHT - 110 - new_h) // 2 + 10
        canvas.paste(scaled_img, (paste_x, paste_y))

    # Dark overlay gradient / backdrop
    draw = ImageDraw.Draw(canvas)

    # Top Act Watermark Badge
    badge_text = f"{scene['act']}  |  SCENE {scene_num:02d} / {total_scenes:02d}"
    draw.rounded_rectangle([24, 20, 520, 56], radius=8, fill=(15, 23, 42), outline=scene['act_color'], width=2)
    draw.text((40, 26), badge_text, font=font_badge, fill=scene['act_color'])

    # Top Invariant Tag
    inv_text = f"🛡️ {scene['invariant']}"
    draw.rounded_rectangle([WIDTH - 340, 20, WIDTH - 24, 56], radius=8, fill=(15, 23, 42), outline=(16, 185, 129), width=1)
    draw.text((WIDTH - 324, 26), inv_text, font=font_badge, fill=(52, 211, 153))

    # Bottom Lower-Third Chyron Banner
    banner_y = HEIGHT - 116
    draw.rectangle([0, banner_y, WIDTH, HEIGHT], fill=(10, 15, 30))
    draw.line([(0, banner_y), (WIDTH, banner_y)], fill=(56, 189, 248), width=3)

    # Accent color left vertical block
    draw.rectangle([24, banner_y + 16, 30, banner_y + 86], fill=scene['act_color'])

    # Title & Subtitle
    draw.text((44, banner_y + 14), scene['title'], font=font_title, fill=(255, 255, 255))
    draw.text((44, banner_y + 54), scene['desc'], font=font_desc, fill=(203, 213, 225))

    return canvas

import sys
sys.stdout.reconfigure(encoding='utf-8')

def main():
    frames = []
    total = len(SCENES)
    print("Generating demo frames...")

    for idx, scene in enumerate(SCENES):
        frame = make_frame(scene, idx + 1, total)
        # Each scene holds for 2 frames (each 1800ms = ~3.6 seconds)
        frames.append(frame)
        frames.append(frame)
        print(f"Rendered Scene {idx + 1} / {total}")

    print(f"Saving animated GIF to {OUTPUT_PATH}...")
    frames[0].save(
        OUTPUT_PATH,
        save_all=True,
        append_images=frames[1:],
        duration=1800, # 1.8s per frame -> 3.6s per scene
        loop=0,
        optimize=True
    )
    print("Done! File size:", os.path.getsize(OUTPUT_PATH), "bytes")

if __name__ == '__main__':
    main()
