"""
Build 5-minute Pitch Deck with Native PowerPoint Morph Transitions (8-step Architecture Walkthrough):
- Slide 1: Cover (MediQ signature navy cover)
- Slide 2: Problem Statement (CD 발급과 재촬영 피폭의 한계)
- Slide 3: Solution Proposal (환자 동의 기반 다이렉트 스트리밍)
- Slide 4: System Architecture Overview (전체 구성도 맵 조망)
- Slide 5: ❶ Microsoft Entra ID (신원 인증) [Morph Transition]
- Slide 6: ❷ 환자 공유 범위·병원·기간·검사 선택 (동의 생성) [Morph Transition]
- Slide 7: ❸ 동의 저장 및 QR 티켓 발급 (Zero Cloud Storage) [Morph Transition]
- Slide 8: ❹ 의료진 QR 접수 (B병원 TCP L4 중계) [Morph Transition]
- Slide 9: ❺ ❻ 동의 조회 & ABAC 11단계 인가 (단기 토큰) [Morph Transition]
- Slide 10: ❼ B Gateway L2 · DPoP · 환자 동의 재검증 [Morph Transition]
- Slide 11: ❽ 승인된 영상만 WireGuard 직통 스트리밍 & LUKS2 암호화 [Morph Transition]
- Slide 12: Live UI ① 환자 동의 지갑
- Slide 13: Live UI ② AI 건강도우미 RAG
- Slide 14: Live UI ③ 700장 CT DICOM 뷰어
- Slide 15: Live UI ④ 실시간 보안 관제 콘솔
- Slide 16: 기대 효과 & 결론 ("환자 동의로 열고, 증거와 감사로 닫는다")

Key Requirements:
- Typography: 프리텐다드 (Pretendard)
- Palette: Exact MediQ palette (Navy #0B2342, Blue #2F68B5, Cyan #55C2D8, etc.)
- Canvas: 20.00" x 11.25" (1920x1080 CSS px mapping, 1 inch = 96 px)
- User Constraint: "발표자 용 나레이션은 안보이게 제작한다" -> Narration is strictly in PowerPoint Speaker Notes!
- Morph Transition applied between all sequential architecture steps.
"""

import os
import shutil
import pptx
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml import parse_xml

ROOT = r"C:\Users\user\Documents\New project"
ASSETS = os.path.join(ROOT, "docs", "assets", "images")
OUT_DIR = os.path.join(ROOT, "docs", "presentation")
KAKAO_DIR = r"C:\Users\user\Documents\카카오톡 받은 파일"
ARCH_IMG_PATH = os.path.join(ROOT, "public", "mediq_architecture_flow.png")

os.makedirs(OUT_DIR, exist_ok=True)

FONT = "프리텐다드"

# MediQ Palette
C_NAVY     = RGBColor(11, 35, 66)    # #0B2342
C_BLUE     = RGBColor(47, 104, 181)  # #2F68B5
C_BLUE2    = RGBColor(77, 134, 207)  # #4D86CF
C_CYAN     = RGBColor(85, 194, 216)  # #55C2D8
C_TEAL     = RGBColor(22, 139, 130)  # #168B82
C_GOLD     = RGBColor(220, 168, 61)  # #DCA83D
C_RED      = RGBColor(198, 74, 74)   # #C64A4A
C_INK      = RGBColor(23, 38, 58)    # #17263A
C_SLATE    = RGBColor(83, 101, 123)  # #53657B
C_MUTED    = RGBColor(123, 138, 155) # #7B8A9B
C_LINE     = RGBColor(216, 224, 233) # #D8E0E9
C_PALE     = RGBColor(243, 246, 250) # #F3F6FA
C_PALEBLUE = RGBColor(233, 241, 252) # #E9F1FC
C_PALETEAL = RGBColor(231, 244, 241) # #E7F4F1
C_PALEGOLD = RGBColor(251, 244, 229) # #FBF4E5
C_WHITE    = RGBColor(255, 255, 255) # #FFFFFF

def px(val):
    return Inches(val / 96.0)

def pt(px_val):
    return Pt(px_val * 0.75)

def apply_morph_transition(slide):
    morph_xml = parse_xml(
        '<p:transition xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
        'xmlns:p15="http://schemas.microsoft.com/office/powerpoint/2012/main">'
        '  <p:extLst>'
        '    <p:ext uri="{EFA19261-F742-4948-AE17-10779776E6A2}">'
        '      <p15:morph option="byObject"/>'
        '    </p:ext>'
        '  </p:extLst>'
        '</p:transition>'
    )
    slide._element.append(morph_xml)

def build_presentation():
    prs = pptx.Presentation()
    prs.slide_width = Inches(20.0)
    prs.slide_height = Inches(11.25)
    blank_layout = prs.slide_layouts[6]

    TOTAL_SLIDES = 16

    def setup_header_footer(slide, slide_num, label, title, subtitle=None):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, px(1920), px(1080))
        bg.fill.solid()
        bg.fill.fore_color.rgb = C_WHITE
        bg.line.fill.background()

        hdr_bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, px(1920), px(258))
        hdr_bg.fill.solid()
        hdr_bg.fill.fore_color.rgb = C_PALE
        hdr_bg.line.fill.background()

        bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, px(108), px(76), px(8), px(132))
        bar.fill.solid()
        bar.fill.fore_color.rgb = C_BLUE
        bar.line.fill.background()

        lbl_box = slide.shapes.add_textbox(px(150), px(62), px(1600), px(38))
        tf = lbl_box.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = label
        p.font.name = FONT
        p.font.size = pt(21)
        p.font.bold = True
        p.font.color.rgb = C_BLUE

        t_box = slide.shapes.add_textbox(px(150), px(101), px(1650), px(138))
        tf = t_box.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = title
        p.font.name = FONT
        p.font.size = pt(50)
        p.font.bold = True
        p.font.color.rgb = C_INK

        if subtitle:
            sub_box = slide.shapes.add_textbox(px(108), px(282), px(1704), px(48))
            tf = sub_box.text_frame
            tf.word_wrap = True
            p = tf.paragraphs[0]
            p.text = subtitle
            p.font.name = FONT
            p.font.size = pt(25)
            p.font.color.rgb = C_SLATE

        rule = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, px(108), px(1006), px(1704), px(2))
        rule.fill.solid()
        rule.fill.fore_color.rgb = C_LINE
        rule.line.fill.background()

        f_left = slide.shapes.add_textbox(px(108), px(1014), px(1200), px(31))
        tf = f_left.text_frame
        p = tf.paragraphs[0]
        p.text = "Medi Q  /  합성 데이터 · 비임상 기술 PoC  ·  아키텍처 모션 워크스루"
        p.font.name = FONT
        p.font.size = pt(17)
        p.font.color.rgb = C_MUTED

        f_right = slide.shapes.add_textbox(px(1600), px(1014), px(212), px(31))
        tf = f_right.text_frame
        p = tf.paragraphs[0]
        p.text = f"{slide_num:02d}  /  {TOTAL_SLIDES}"
        p.font.name = FONT
        p.font.size = pt(17)
        p.font.bold = True
        p.font.color.rgb = C_MUTED
        p.alignment = PP_ALIGN.RIGHT

    def add_card(slide, x, y, w, h, fill=C_WHITE, stroke=C_LINE, line_width=1.5):
        c = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, px(x), px(y), px(w), px(h))
        c.fill.solid()
        c.fill.fore_color.rgb = fill
        if stroke:
            c.line.color.rgb = stroke
            c.line.width = Pt(line_width)
        else:
            c.line.fill.background()
        return c

    def add_pill(slide, x, y, w, h, text, fill=C_PALEBLUE, color=C_BLUE, font_size=20):
        p_shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, px(x), px(y), px(w), px(h))
        p_shape.fill.solid()
        p_shape.fill.fore_color.rgb = fill
        p_shape.line.fill.background()
        tf = p_shape.text_frame
        p = tf.paragraphs[0]
        p.text = text
        p.font.name = FONT
        p.font.size = pt(font_size)
        p.font.bold = True
        p.font.color.rgb = color
        p.alignment = PP_ALIGN.CENTER
        return p_shape

    def set_notes(slide, script_text):
        # Place presenter script exclusively in speaker notes (hidden from slide screen)
        notes = slide.notes_slide.notes_text_frame
        notes.text = script_text

    # -------------------------------------------------------------
    # SLIDE 1: COVER
    # -------------------------------------------------------------
    s1 = prs.slides.add_slide(blank_layout)
    bg1 = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, px(1920), px(1080))
    bg1.fill.solid()
    bg1.fill.fore_color.rgb = C_WHITE
    bg1.line.fill.background()

    k_box = s1.shapes.add_textbox(px(108), px(140), px(1100), px(45))
    k_box.text_frame.paragraphs[0].text = "CAPSTONE MVP  ·  SECURITY BY DESIGN"
    k_box.text_frame.paragraphs[0].font.name = FONT
    k_box.text_frame.paragraphs[0].font.size = pt(26)
    k_box.text_frame.paragraphs[0].font.bold = True
    k_box.text_frame.paragraphs[0].font.color.rgb = C_SLATE

    w_box = s1.shapes.add_textbox(px(108), px(200), px(800), px(110))
    w_box.text_frame.paragraphs[0].text = "mediQ"
    w_box.text_frame.paragraphs[0].font.name = FONT
    w_box.text_frame.paragraphs[0].font.size = pt(90)
    w_box.text_frame.paragraphs[0].font.bold = True
    w_box.text_frame.paragraphs[0].font.color.rgb = C_BLUE

    t_box1 = s1.shapes.add_textbox(px(108), px(330), px(1100), px(220))
    t_box1.text_frame.paragraphs[0].text = "환자 동의 기반\n영상 교류 및 AI 도우미"
    t_box1.text_frame.paragraphs[0].font.name = FONT
    t_box1.text_frame.paragraphs[0].font.size = pt(74)
    t_box1.text_frame.paragraphs[0].font.bold = True
    t_box1.text_frame.paragraphs[0].font.color.rgb = C_INK

    sub_box1 = s1.shapes.add_textbox(px(108), px(575), px(1100), px(58))
    sub_box1.text_frame.paragraphs[0].text = "Zero Cloud Storage · ABAC 11단계 인가 · 700 Slices CT 스트리밍"
    sub_box1.text_frame.paragraphs[0].font.name = FONT
    sub_box1.text_frame.paragraphs[0].font.size = pt(27)
    sub_box1.text_frame.paragraphs[0].font.color.rgb = C_SLATE

    metrics = [
        ("01", "Zero Cloud Storage", "의료영상 원본은 병원 PACS 분산 보관\n클라우드 중앙 DB에 DICOM 원본 비보관"),
        ("02", "ABAC 11단계 인가", "Fail-Closed 조건 교집합 전수 검증\n5~10분 유효 단기 HMAC 서명 토큰"),
        ("03", "700 Slices CT 스트리밍", "WADO-RS 표준 기반 무지연 Lazy Loading\n의료진 PC 로컬 무단 다운로드 원천 차단")
    ]
    for i, (num, m_title, m_desc) in enumerate(metrics):
        card_y = 200 + i * 185
        add_card(s1, 1140, card_y, 672, 160, fill=C_NAVY, stroke=C_BLUE, line_width=2.0)
        add_pill(s1, 1165, card_y + 25, 65, 42, num, fill=C_BLUE, color=C_WHITE, font_size=20)
        
        tb = s1.shapes.add_textbox(px(1250), px(card_y + 20), px(540), px(45))
        p = tb.text_frame.paragraphs[0]
        p.text = m_title
        p.font.name = FONT
        p.font.size = pt(26)
        p.font.bold = True
        p.font.color.rgb = C_WHITE
        
        tb2 = s1.shapes.add_textbox(px(1250), px(card_y + 70), px(540), px(70))
        p = tb2.text_frame.paragraphs[0]
        p.text = m_desc
        p.font.name = FONT
        p.font.size = pt(18)
        p.font.color.rgb = RGBColor(216, 231, 248)

    ftr_bg = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, px(780), px(1920), px(300))
    ftr_bg.fill.solid()
    ftr_bg.fill.fore_color.rgb = C_INK
    ftr_bg.line.fill.background()

    meta_items = [
        ("시연 웹", "https://highpass-demo.japaneast.cloudapp.azure.com/"),
        ("발표자", "하이패스 프로젝트팀 (이재석, 김범희)"),
        ("데이터", "합성 데이터 기반 기술 PoC · 비임상 시연")
    ]
    for i, (k, v) in enumerate(meta_items):
        my = 820 + i * 70
        add_pill(s1, 108, my, 130, 44, k, fill=C_BLUE, color=C_WHITE, font_size=20)
        vb = s1.shapes.add_textbox(px(260), px(my + 4), px(1500), px(40))
        p = vb.text_frame.paragraphs[0]
        p.text = v
        p.font.name = FONT
        p.font.size = pt(24)
        p.font.color.rgb = C_WHITE

    set_notes(s1, """[발표 00:00 ~ 00:30 | 도입 및 정체성 소개]
"안녕하십니까. 환자 동의 기반 클라우드 의료영상 교류 및 비임상 AI 건강도우미 플랫폼, '하이패스 MediQ'의 발표를 맡은 [발표자 이름]입니다.
저희 프로젝트는 물리적 CD 발급과 재촬영의 비효율 및 방사선 피폭 문제를 해결하기 위해, Zero Cloud Storage 원칙과 엄격한 11단계 인가, 그리고 700장 복부 CT 무지연 스트리밍을 구현했습니다.
지금부터 핵심 문제와 솔루션, 그리고 8단계 시스템 아키텍처 워크스루를 생생하게 보여드리겠습니다." """)

    # -------------------------------------------------------------
    # SLIDE 2: PROBLEM STATEMENT
    # -------------------------------------------------------------
    s2 = prs.slides.add_slide(blank_layout)
    setup_header_footer(s2, 2, "01. PROBLEM STATEMENT", "영상보다 전달 과정에서 맥락이 끊긴다",
                        "대표적인 CD 이동 흐름의 3대 한계 · 행정 비용, 불필요한 재촬영, 환자 통제권 부재")

    prob_cards = [
        ("01", "행정 및 비용 낭비", "CD 발급과 대기 시간의 굴레", 
         ["환자가 직접 수수료를 내고 CD 발급 대기", "물리적 CD를 들고 타 병원으로 이동", "타 병원 등록실에서 재등록 대기 소요", "연간 수백만 건의 불필요한 행정 비용 발생"]),
        ("02", "불필요한 중복 피폭", "CD 판독 불가 및 재촬영 문제", 
         ["CD 손상, 포맷 불일치, 뷰어 미호환 빈번", "이전 병원 영상 확인 실패로 CT/MRI 재촬영", "환자에게 불필요한 방사선 피폭 누적", "진료 연속성 단절 및 치료 결정 지연"]),
        ("03", "환자 주권 부재", "의료 데이터 통제권의 부재", 
         ["내 영상이 누구에게 전달되는지 추적 불가", "열람 기간이나 목적을 환자가 제한할 수 없음", "발급 후에는 권한 회수나 철회가 불가능", "진료 전 검사 의미를 알지 못해 환자 불안 가중"])
    ]
    for i, (chip, title, kicker, bullets) in enumerate(prob_cards):
        cx = 108 + i * 592
        add_card(s2, cx, 350, 520, 610, fill=C_PALE, stroke=C_LINE, line_width=1.5)
        add_pill(s2, cx + 30, 380, 75, 42, chip, fill=C_BLUE, color=C_WHITE, font_size=20)
        
        tb = s2.shapes.add_textbox(px(cx + 120), px(375), px(370), px(45))
        p = tb.text_frame.paragraphs[0]
        p.text = kicker
        p.font.name = FONT
        p.font.size = pt(18)
        p.font.bold = True
        p.font.color.rgb = C_SLATE
        
        tb2 = s2.shapes.add_textbox(px(cx + 30), px(440), px(460), px(60))
        p = tb2.text_frame.paragraphs[0]
        p.text = title
        p.font.name = FONT
        p.font.size = pt(30)
        p.font.bold = True
        p.font.color.rgb = C_INK
        
        r = s2.shapes.add_shape(MSO_SHAPE.RECTANGLE, px(cx + 30), px(515), px(460), px(2))
        r.fill.solid()
        r.fill.fore_color.rgb = C_LINE
        r.line.fill.background()

        tb3 = s2.shapes.add_textbox(px(cx + 30), px(535), px(460), px(380))
        tf = tb3.text_frame
        for bullet in bullets:
            bp = tf.add_paragraph()
            bp.text = f"•  {bullet}"
            bp.font.name = FONT
            bp.font.size = pt(20)
            bp.font.color.rgb = C_INK
            bp.space_after = Pt(12)

    set_notes(s2, """[발표 00:30 ~ 01:00 | 문제 정의]
"대학병원에서 CT나 MRI를 찍고 다른 병원으로 진료를 보러 갈 때, 여전히 환자가 직접 CD를 가방에 넣고 들고 다녀야 합니다.
이로 인해 발급비와 대기 시간이 발생하고, CD 포맷 불일치나 손상으로 인한 불필요한 재촬영으로 방사선 피폭 위험에 노출됩니다. 또한 내 의료 정보임에도 환자가 열람 권한을 직접 제어하거나 철회할 권리가 없었습니다." """)

    # -------------------------------------------------------------
    # SLIDE 3: SOLUTION PROPOSAL
    # -------------------------------------------------------------
    s3 = prs.slides.add_slide(blank_layout)
    setup_header_footer(s3, 3, "02. SOLUTION PROPOSAL", "환자가 중심이 되는 다이렉트 의료영상 공유",
                        "기존 매체 운반 방식에서 환자 동의 기반 클라우드 스트리밍으로의 패러다임 전환")

    add_card(s3, 108, 350, 1704, 260, fill=C_PALEGOLD, stroke=C_GOLD, line_width=1.5)
    add_pill(s3, 138, 375, 170, 42, "기존 방식 (CD)", fill=C_GOLD, color=C_WHITE, font_size=19)
    
    tb = s3.shapes.add_textbox(px(330), px(375), px(1440), px(45))
    p = tb.text_frame.paragraphs[0]
    p.text = "Traditional Flow : 매체 중심의 물리적 운반 절차"
    p.font.name = FONT
    p.font.size = pt(26)
    p.font.bold = True
    p.font.color.rgb = RGBColor(161, 98, 7)

    t_steps = ["A병원 검사", "CD 발급비·대기", "환자 직접 운반", "B병원 등록 대기", "포맷 오류 재촬영"]
    for i, st in enumerate(t_steps):
        sx = 138 + i * 338
        add_card(s3, sx, 445, 300, 125, fill=C_WHITE, stroke=C_LINE, line_width=1.0)
        tb_st = s3.shapes.add_textbox(px(sx), px(465), px(300), px(80))
        tf_st = tb_st.text_frame
        p = tf_st.paragraphs[0]
        p.text = f"0{i+1}"
        p.font.name = FONT
        p.font.size = pt(18)
        p.font.bold = True
        p.font.color.rgb = C_GOLD
        p.alignment = PP_ALIGN.CENTER
        p2 = tf_st.add_paragraph()
        p2.text = st
        p2.font.name = FONT
        p2.font.size = pt(22)
        p2.font.bold = True
        p2.font.color.rgb = C_INK
        p2.alignment = PP_ALIGN.CENTER

    add_card(s3, 108, 640, 1704, 320, fill=C_PALETEAL, stroke=C_TEAL, line_width=2.0)
    add_pill(s3, 138, 665, 200, 42, "하이패스 (MediQ)", fill=C_TEAL, color=C_WHITE, font_size=19)
    
    tb = s3.shapes.add_textbox(px(360), px(665), px(1410), px(45))
    p = tb.text_frame.paragraphs[0]
    p.text = "Hi-Pass Flow : 환자 동의 기반 클라우드 다이렉트 스트리밍"
    p.font.name = FONT
    p.font.size = pt(26)
    p.font.bold = True
    p.font.color.rgb = C_TEAL

    h_steps = [("환자 스마트폰", "동의 생성"), ("Control 서버", "ABAC 11 검증"), ("단기 토큰 서명", "5분 유효 토큰"), ("A병원 PACS", "B병원 직통 스트리밍")]
    for i, (st_top, st_main) in enumerate(h_steps):
        sx = 138 + i * 420
        add_card(s3, sx, 735, 380, 125, fill=C_WHITE, stroke=C_TEAL, line_width=1.5)
        tb_st = s3.shapes.add_textbox(px(sx), px(750), px(380), px(90))
        tf_st = tb_st.text_frame
        p = tf_st.paragraphs[0]
        p.text = st_top
        p.font.name = FONT
        p.font.size = pt(17)
        p.font.bold = True
        p.font.color.rgb = C_TEAL
        p.alignment = PP_ALIGN.CENTER
        p2 = tf_st.add_paragraph()
        p2.text = st_main
        p2.font.name = FONT
        p2.font.size = pt(24)
        p2.font.bold = True
        p2.font.color.rgb = C_INK
        p2.alignment = PP_ALIGN.CENTER

    bf_box = s3.shapes.add_textbox(px(138), px(890), px(1640), px(45))
    p = bf_box.text_frame.paragraphs[0]
    p.text = "✔ CD 발급비 0원  |  ✔ 불필요한 방사선 피폭 원천 차단  |  ✔ 언제든 권한 철회  |  ✔ AI 건강도우미 검사 안내"
    p.font.name = FONT
    p.font.size = pt(20)
    p.font.bold = True
    p.font.color.rgb = C_INK
    p.alignment = PP_ALIGN.CENTER

    set_notes(s3, """[발표 01:00 ~ 01:30 | 솔루션 제안]
"하이패스 MediQ는 환자가 스마트폰으로 수신 병원과 검사를 지정해 동의 티켓을 발행하면, 서버가 11단계 인가를 거쳐 5분 단기 토큰을 발행하고 원본 병원 PACS로부터 필요한 영상만 웹 뷰어로 실시간 스트리밍합니다." """)

    # -------------------------------------------------------------
    # SLIDE 4: ARCHITECTURE OVERVIEW (MAP)
    # -------------------------------------------------------------
    s4 = prs.slides.add_slide(blank_layout)
    setup_header_footer(s4, 4, "03. SYSTEM ARCHITECTURE", "Control Plane과 Data Plane의 완전한 물리적 분리",
                        "Azure Control Plane (신원·동의·인가·감사) + 병원 분산 Data Plane (원본 보관·스트리밍)")

    add_card(s4, 108, 350, 1100, 620, fill=C_WHITE, stroke=C_LINE, line_width=1.5)
    if os.path.exists(ARCH_IMG_PATH):
        s4.shapes.add_picture(ARCH_IMG_PATH, px(118), px(360), width=px(1080))

    # Right Card: Architecture Overview Info
    add_card(s4, 1240, 350, 572, 620, fill=C_PALE, stroke=C_LINE, line_width=1.5)
    add_pill(s4, 1270, 380, 200, 42, "아키텍처 조망", fill=C_BLUE, color=C_WHITE, font_size=19)
    
    tb = s4.shapes.add_textbox(px(1270), px(440), px(512), px(50))
    p = tb.text_frame.paragraphs[0]
    p.text = "8단계 종단 워크플로우"
    p.font.name = FONT
    p.font.size = pt(28)
    p.font.bold = True
    p.font.color.rgb = C_INK

    arch_bullets = [
        ("Zero Cloud Storage", "클라우드 중앙 DB에 DICOM 원본 영구 비보관"),
        ("인증과 인가의 분리", "Entra ID 로그인과 의료영상 접근권한은 별도 단계"),
        ("Fail-Closed ABAC", "11단계 교집합 전수 검증 통과 시 단기 토큰 발급"),
        ("병원 간 직통 스트리밍", "WireGuard 사설망 기반 700 Slices CT Lazy Loading"),
        ("불변 감사로그 체인", "모든 열람 및 거부 이력 1초 단위 감사 세션 기록")
    ]
    tb2 = s4.shapes.add_textbox(px(1270), px(505), px(512), px(440))
    tf2 = tb2.text_frame
    for title, desc in arch_bullets:
        p = tf2.add_paragraph()
        p.text = f"✔  {title}"
        p.font.name = FONT
        p.font.size = pt(21)
        p.font.bold = True
        p.font.color.rgb = C_BLUE
        p2 = tf2.add_paragraph()
        p2.text = f"     {desc}"
        p2.font.name = FONT
        p2.font.size = pt(18)
        p2.font.color.rgb = C_INK
        p2.space_after = Pt(10)

    set_notes(s4, """[발표 01:30 ~ 01:50 | 전체 아키텍처 조망]
"지금 보시는 구성도는 하이패스 MediQ의 전체 아키텍처입니다.
좌측의 인터넷 사용자부터 Microsoft Entra ID, Azure Control Plane, 그리고 가상 병원 A와 B의 PACS까지 연결되는 8단계 흐름을 한 단계씩 살펴보겠습니다." """)

    # -------------------------------------------------------------
    # SLIDES 5 ~ 11: 8-STEP ARCHITECTURE MORPH WALKTHROUGH
    # -------------------------------------------------------------
    # Helper to calculate overlay box on diagram
    # Base diagram on slide: x=118, y=360, w=1080, h=607.7 (scale = 1080 / 1672 = 0.64593)
    S_X = 118
    S_Y = 360
    SCALE = 1080.0 / 1672.0

    morph_steps = [
        {
            "step_num": 5,
            "badge": "STEP 01 / 08",
            "title": "❶ 환자·의료진 Microsoft 로그인 : 신원 인증",
            "subtitle": "Microsoft Entra ID 기반의 신원 확인과 접근 권한의 물리적 분리",
            "box": (345, 85, 735, 120),
            "box_color": C_BLUE,
            "system_name": "Microsoft Entra ID (IdP)",
            "role_desc": "환자 및 의료진의 디지털 신원(Identity)을 검증하고 사내 연합 계정으로 안전하게 매핑합니다.",
            "rule_title": "[보안 원칙] 인증 ≠ 인가 분리",
            "rule_desc": "'누구인가?(로그인 인증)'와 '무엇을 볼 수 있는가?(접근 권한)'를 엄격히 분리하여 계정이 탈취되더라도 영상이 무단 노출되지 않습니다.",
            "bullets": [
                "Microsoft 계정 연동 및 사내 연합형 계정 매핑",
                "로그인 성공 시에도 의료영상 접근 권한은 자동 부여되지 않음",
                "환자 동의와 진료 목적 검증은 완전히 별개 단계로 격리"
            ],
            "script": "1단계는 신원 인증입니다. 환자와 의료진은 Microsoft Entra ID를 통해 신원을 확인합니다. 그러나 로그인에 성공했다고 영상이 열리는 것이 아니라, 권한 검증이라는 별도의 문을 통과해야 합니다."
        },
        {
            "step_num": 6,
            "badge": "STEP 02 / 08",
            "title": "❷ 환자 공유 범위·병원·기간·검사 선택",
            "subtitle": "환자 웹·모바일 PWA에서 필요한 검사 단위만 좁혀서 명시적 동의 생성",
            "box": (440, 340, 260, 170),
            "box_color": C_BLUE,
            "system_name": "환자 PWA & HTTPS Edge",
            "role_desc": "환자가 스마트폰 의료지갑에서 수신 병원(B병원), 진료 목적, 유효기간, 복부 CT 검사를 직접 선택합니다.",
            "rule_title": "[보안 통제] 포괄적 동의 금지",
            "rule_desc": "전체 진료기록을 무차별 개방하지 않고, 이번 진료에 필요한 특정 Study 및 Series UID 단위로만 공유 범위를 한정합니다.",
            "bullets": [
                "A대학병원에서 B대학병원으로 수신 기관 명확히 지정",
                "진료 목적으로 한정, 1일~30일 사이 유효기간 설정",
                "NSG 443 포트만 개방 및 OWASP CRS Caddy/Coraza WAF 보호"
            ],
            "script": "2단계에서 환자는 스마트폰을 통해 자신의 의료 지갑에서 공유할 병원과 유효기간, 그리고 필요한 복부 CT 검사만을 콕 집어 명시적 동의 범위를 설정합니다."
        },
        {
            "step_num": 7,
            "badge": "STEP 03 / 08",
            "title": "❸ 동의 저장 및 QR 티켓 발급",
            "subtitle": "동의 조건을 암호화 저장하고 영상 원본은 보관하지 않는 Zero Cloud Storage",
            "box": (530, 350, 550, 440),
            "box_color": C_TEAL,
            "system_name": "Control Plane & Key Vault",
            "role_desc": "환자의 동의 조건(Study/Series 범위, 기간)을 PostgreSQL에 기록하고 Azure Key Vault로 암호화 티켓을 생성합니다.",
            "rule_title": "[아키텍처 불변식] Zero Storage",
            "rule_desc": "'별도 DICOM 지속 저장 없음!' 원본 영상 파일은 클라우드로 올라오지 않으며 오직 동의 메타데이터와 감사로그만 보관됩니다.",
            "bullets": [
                "PostgreSQL에 최소 메타데이터(동의 상태, Study UID)만 기록",
                "Azure Key Vault의 wrap/unwrap 키 보호로 데이터 무결성 보장",
                "환자에게 접수용 고유 QR 공유 티켓 발급"
            ],
            "script": "3단계에서 서버는 환자의 동의 조건을 암호화하여 저장하고 QR 공유 티켓을 발행합니다. 이때 클라우드 중앙 서버에는 대용량 영상 파일이 전혀 저장되지 않습니다."
        },
        {
            "step_num": 8,
            "badge": "STEP 04 / 08",
            "title": "❹ 의료진 QR 접수 및 요청 시작",
            "subtitle": "의료진 전용 웹에서 환자 QR 접수 후 안전한 L4 중계 터널링 통신",
            "box": (550, 520, 260, 100),
            "box_color": C_GOLD,
            "system_name": "의료진 웹 & TCP L4 중계",
            "role_desc": "B병원 진료실 의사가 환자의 QR 티켓을 스캔하여 영상 조회 요청을 시작하며, L4 중계로 안전하게 전송됩니다.",
            "rule_title": "[보안 원칙] QR은 단순 접수 수단",
            "rule_desc": "QR 코드 자체에 영상이나 무제한 권한이 포함되어 있지 않으며, 반드시 백엔드 인가 엔진의 재검증을 거쳐야 합니다.",
            "bullets": [
                "의료진 업무망과 외부 인터넷 간 L4 중계 및 TLS 터널링 보호",
                "Control Plane API 권한 위임 없이 접수 요청만 안전 전달",
                "의사 면허 및 소속 병원 일치 여부 1차 확인"
            ],
            "script": "4단계로, B병원 진료실 의사가 환자의 QR 티켓을 접수합니다. 이 요청은 안전한 TLS 터널링을 통해 Control 서버로 전달되어 의사의 소속과 권한 검증에 들어갑니다."
        },
        {
            "step_num": 9,
            "badge": "STEP 05 & 06 / 08",
            "title": "❺ ❻ 동의 조회 & ABAC 11단계 인가",
            "subtitle": "11개 조건 교집합 전수 검증 통과 시 5분 유효 단기 HMAC 서명 토큰 발급",
            "box": (800, 340, 170, 190),
            "box_color": C_GOLD,
            "system_name": "Control Plane API (ABAC 인가)",
            "role_desc": "환자 동의 상태, 유효기간, 의사 소속병원, 요청 Study/Series UID 등 11개 조건을 교집합 전수 검증합니다.",
            "rule_title": "[보안 원칙] Fail-Closed 인가",
            "rule_desc": "11개 조건 중 단 하나라도 불일치하면 즉시 접근을 차단하고 상세 사유를 기록하며, 통과 시에만 5분 단기 토큰을 서명 발행합니다.",
            "bullets": [
                "ACTIVE 상태, 유효기간, 요청병원, 의사소속, UID 전수 일치 확인",
                "영구 고정 URL 금지 ➔ 5~10분 유효 단기 HMAC-SHA256 토큰 발급",
                "모든 거부 사유(DOCTOR_MISMATCH 등) 실시간 감사로그 기록"
            ],
            "script": "5단계와 6단계는 핵심 보안 관문입니다. 서버가 11가지 인가 조건을 전수 검증하여, 모두 통과했을 때만 5분간 유효한 단기 서명 토큰을 발급합니다."
        },
        {
            "step_num": 10,
            "badge": "STEP 07 / 08",
            "title": "❼ Gateway L2 · DPoP · 환자 동의 재검증",
            "subtitle": "가상 병원 B 게이트웨이 경계에서 토큰 서명 및 DPoP 바인딩 키 최종 확인",
            "box": (1460, 490, 190, 85),
            "box_color": C_BLUE,
            "system_name": "가상 병원 B (Portal / Gateway)",
            "role_desc": "수신 병원 내부망 진입 전, 발급된 단기 토큰과 DPoP 암호화 증명, 환자 동의 범위를 게이트웨이가 최종 재확인합니다.",
            "rule_title": "[심층 방어] 게이트웨이 독립 검증",
            "rule_desc": "클라우드 신뢰에만 의존하지 않고 병원 데이터 진입 게이트웨이에서 다중 보안 검증을 수행하여 위조를 원천 차단합니다.",
            "bullets": [
                "B 전용 HTTPS TLS 터널링 및 복호화 검증",
                "DPoP-bound 단기 토큰과 요청 스코프 일치 확인",
                "승인된 영상에 한해서만 수신 및 휘발성 열람 허용"
            ],
            "script": "7단계로, B병원 게이트웨이가 수신된 단기 토큰의 서명과 유효기간을 다시 한번 철저히 검증하여 안전성을 확증합니다."
        },
        {
            "step_num": 11,
            "badge": "STEP 08 / 08",
            "title": "❽ 승인된 영상만 WireGuard 직통 스트리밍",
            "subtitle": "A병원 Orthanc PACS에서 B병원으로 700장 복부 CT 무지연 스트리밍 & LUKS2 암호화",
            "box": (1180, 85, 480, 690),
            "box_color": C_RED,
            "system_name": "A/B 병원 PACS & WireGuard",
            "role_desc": "A병원 Orthanc PACS에서 B병원 수신 PACS로 700장 대용량 CT 영상이 암호화 사설망을 통해 직접 스트리밍됩니다.",
            "rule_title": "[Lazy Loading & LUKS2 암호화]",
            "rule_desc": "Study 전체 무차별 다운로드가 아닌 프레임 단위 필요 최소 전송이며, B병원 8GiB LUKS2 암호화 볼륨에 안전하게 임시 보관됩니다.",
            "bullets": [
                "WireGuard 사설 Overlay 터널링으로 병원 간 통신 보호",
                "WADO-RS 프레임 단위 스트리밍으로 700 Slices CT 무지연 판독",
                "의료진 PC 로컬 다운로드 차단 및 진료 완료 후 안전한 파기"
            ],
            "script": "마지막 8단계입니다. A병원 PACS에 안전하게 보관되어 있던 700장의 복부 CT 영상이 WireGuard 사설망을 타고 B병원 진료실 뷰어로 무지연 스트리밍되어 의사가 즉시 정밀 판독을 진행합니다."
        }
    ]

    for step in morph_steps:
        s = prs.slides.add_slide(blank_layout)
        apply_morph_transition(s)
        setup_header_footer(s, step["step_num"], step["title"].split(" : ")[0], step["title"], step["subtitle"])

        # Base Diagram Card (Left)
        add_card(s, 108, 350, 1100, 620, fill=C_WHITE, stroke=C_LINE, line_width=1.5)
        if os.path.exists(ARCH_IMG_PATH):
            s.shapes.add_picture(ARCH_IMG_PATH, px(118), px(360), width=px(1080))

        # Add Animated Glowing Highlight Overlay on Diagram
        bx, by, bw, bh = step["box"]
        hl_x = S_X + bx * SCALE
        hl_y = S_Y + by * SCALE
        hl_w = bw * SCALE
        hl_h = bh * SCALE

        hl_rect = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, px(hl_x), px(hl_y), px(hl_w), px(hl_h))
        hl_rect.fill.background()
        hl_rect.line.color.rgb = step["box_color"]
        hl_rect.line.width = Pt(3.5)

        # Right: System Role Card (NO PRESENTER NARRATION ON SLIDE!)
        add_card(s, 1240, 350, 572, 620, fill=C_PALE, stroke=C_LINE, line_width=1.5)
        add_pill(s, 1270, 380, 180, 42, step["badge"], fill=step["box_color"], color=C_WHITE, font_size=19)

        tb_sys = s.shapes.add_textbox(px(1270), px(440), px(512), px(50))
        p = tb_sys.text_frame.paragraphs[0]
        p.text = step["system_name"]
        p.font.name = FONT
        p.font.size = pt(27)
        p.font.bold = True
        p.font.color.rgb = C_INK

        tb_desc = s.shapes.add_textbox(px(1270), px(495), px(512), px(75))
        p = tb_desc.text_frame.paragraphs[0]
        p.text = step["role_desc"]
        p.font.name = FONT
        p.font.size = pt(19)
        p.font.color.rgb = C_SLATE

        # Rule Box
        rule_box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, px(1270), px(580), px(512), px(120))
        rule_box.fill.solid()
        rule_box.fill.fore_color.rgb = C_WHITE
        rule_box.line.color.rgb = step["box_color"]
        rule_box.line.width = Pt(1.5)
        tf_r = rule_box.text_frame
        tf_r.margin_left = tf_r.margin_top = px(16)
        p = tf_r.paragraphs[0]
        p.text = step["rule_title"]
        p.font.name = FONT
        p.font.size = pt(18)
        p.font.bold = True
        p.font.color.rgb = step["box_color"]
        p2 = tf_r.add_paragraph()
        p2.text = step["rule_desc"]
        p2.font.name = FONT
        p2.font.size = pt(16)
        p2.font.color.rgb = C_INK

        # Bullets
        tb_blt = s.shapes.add_textbox(px(1270), px(715), px(512), px(230))
        tf_blt = tb_blt.text_frame
        for b in step["bullets"]:
            p = tf_blt.add_paragraph()
            p.text = f"•  {b}"
            p.font.name = FONT
            p.font.size = pt(18.5)
            p.font.color.rgb = C_INK
            p.space_after = Pt(8)

        # Place narration strictly in speaker notes!
        set_notes(s, f"[{step['badge']} 발표 대본]\n\"{step['script']}\"")

    # -------------------------------------------------------------
    # SLIDES 12 ~ 15: LIVE UI EVIDENCE SHOWCASE
    # -------------------------------------------------------------
    # Slide 12: Patient Wallet
    s12 = prs.slides.add_slide(blank_layout)
    setup_header_footer(s12, 12, "04. LIVE SERVICE · PATIENT PORTAL", "직관적인 4대 역할 게이트와 환자 맞춤형 동의 지갑",
                        "환자가 직접 수신 병원, 진료 목적, 유효기간, 허용할 복부 CT 검사 범위를 지정하고 언제든 철회")
    add_card(s12, 108, 350, 960, 610, fill=C_WHITE, stroke=C_LINE, line_width=1.5)
    wallet_img = os.path.join(ASSETS, "06_patient_consent_wallet.png")
    if os.path.exists(wallet_img):
        s12.shapes.add_picture(wallet_img, px(128), px(370), width=px(920))
    add_card(s12, 1100, 350, 712, 610, fill=C_PALE, stroke=C_LINE, line_width=1.5)
    add_pill(s12, 1130, 380, 220, 42, "환자 동의 지갑", fill=C_BLUE, color=C_WHITE, font_size=19)
    tb = s12.shapes.add_textbox(px(1370), px(378), px(420), px(45))
    tb.text_frame.paragraphs[0].text = "환자 중심의 공유 통제"
    tb.text_frame.paragraphs[0].font.name = FONT
    tb.text_frame.paragraphs[0].font.size = pt(26)
    tb.text_frame.paragraphs[0].font.bold = True
    tb.text_frame.paragraphs[0].font.color.rgb = C_INK
    pts_w = [
        ("4대 역할 게이트 분리", "환자, 의료진, 병원 관리자, 보안 운영자 전용 로그인 분리"),
        ("수신 병원 선택", "A대학병원에서 B대학병원으로 공유 대상 병원 명확히 지정"),
        ("열람 목적 및 기간", "진료 목적으로 한정, 1일~30일 사이 유효기간 설정"),
        ("검사 단위 선택", "전체 진료기록이 아닌, 필요한 특정 복부 CT Study/Series만 선택"),
        ("원클릭 동의 철회", "언제든 환자가 원할 때 즉시 권한을 파기하는 Revoke 지원")
    ]
    tb_pts = s12.shapes.add_textbox(px(1130), px(445), px(650), px(500))
    for title, desc in pts_w:
        p = tb_pts.text_frame.add_paragraph()
        p.text = f"✔  {title}"
        p.font.name = FONT
        p.font.size = pt(21)
        p.font.bold = True
        p.font.color.rgb = C_BLUE
        p2 = tb_pts.text_frame.add_paragraph()
        p2.text = f"     {desc}"
        p2.font.name = FONT
        p2.font.size = pt(18)
        p2.font.color.rgb = C_INK
        p2.space_after = Pt(10)
    set_notes(s12, "[환자 포털 대본]\n\"실제 클라우드에 배포된 환자의 의료 공유 지갑 화면입니다. 환자가 직접 수신할 B대학병원과 유효기간, 복부 CT를 선택하며 언제든 1초 만에 권한을 철회할 수 있습니다.\"")

    # Slide 13: Health Helper RAG
    s13 = prs.slides.add_slide(blank_layout)
    setup_header_footer(s13, 13, "05. LIVE SERVICE · HEALTH HELPER", "어려운 검사 결과를 눈높이 설명으로: AI 건강도우미",
                        "혈청 알파태아단백(AFP) 검사 결과 연동, 쉬운 개념 해설 및 진료실 의사 상담 리허설")
    add_card(s13, 108, 350, 750, 610, fill=C_WHITE, stroke=C_LINE, line_width=1.5)
    rag_img = os.path.join(ASSETS, "05_health_helper_rag.png")
    if os.path.exists(rag_img):
        s13.shapes.add_picture(rag_img, px(128), px(365), width=px(710))
    add_card(s13, 890, 350, 922, 610, fill=C_PALETEAL, stroke=C_TEAL, line_width=1.5)
    add_pill(s13, 920, 380, 220, 42, "AI 건강도우미", fill=C_TEAL, color=C_WHITE, font_size=19)
    tb = s13.shapes.add_textbox(px(1160), px(378), px(630), px(45))
    tb.text_frame.paragraphs[0].text = "혈청 알파태아단백(AFP) 검사 질의응답 연동"
    tb.text_frame.paragraphs[0].font.name = FONT
    tb.text_frame.paragraphs[0].font.size = pt(26)
    tb.text_frame.paragraphs[0].font.bold = True
    tb.text_frame.paragraphs[0].font.color.rgb = C_INK
    pts_rag = [
        ("쉬운 의학 개념 해설", "AFP 정상 수치와 간암/간경화 선별검사 목적을 비임상 환자 언어로 해설"),
        ("추천 질문 스튜디오", "'AFP 검사가 뭔가요?', '초음파와 차이점', '주의사항' 등 원클릭 퀵 질의"),
        ("의사 상담 리허설 박스", "진료실에서 주치의에게 물어봐야 할 맞춤 질문 3가지를 자동 정리"),
        ("공인 학술 출처 투명 표기", "MedlinePlus 및 간학회 가이드라인 출처 링크를 명확히 제시하여 신뢰 확보"),
        ("한국어 형태소 전처리", "체언과 조사를 분리하여 'AFP란', '초음파에 대해서' 등 구어체 질문 완벽 처리")
    ]
    tb_pts7 = s13.shapes.add_textbox(px(920), px(445), px(860), px(500))
    for title, desc in pts_rag:
        p = tb_pts7.text_frame.add_paragraph()
        p.text = f"✔  {title}"
        p.font.name = FONT
        p.font.size = pt(21)
        p.font.bold = True
        p.font.color.rgb = C_TEAL
        p2 = tb_pts7.text_frame.add_paragraph()
        p2.text = f"     {desc}"
        p2.font.name = FONT
        p2.font.size = pt(18)
        p2.font.color.rgb = C_INK
        p2.space_after = Pt(10)
    set_notes(s13, "[AI 건강도우미 대본]\n\"환자가 결과지에 적힌 어려운 용어에 불안해하지 않도록, AI가 알파태아단백(AFP)을 알기 쉽게 설명하고 진료실에서 물어볼 질문 카드를 만들어줍니다.\"")

    # Slide 14: Clinician CT Viewer
    s14 = prs.slides.add_slide(blank_layout)
    setup_header_footer(s14, 14, "06. LIVE SERVICE · CLINICIAN VIEWER", "5분 단기 토큰 기반 700 Slices 복부 CT 뷰어",
                        "로컬 PC 무단 다운로드 차단, 5분 유효 단기 토큰 기반 WADO-RS 프레임 지연 스트리밍")
    add_card(s14, 108, 350, 1040, 610, fill=C_WHITE, stroke=C_LINE, line_width=1.5)
    viewer_img = os.path.join(ASSETS, "07_clinician_dicom_viewer.png")
    if os.path.exists(viewer_img):
        s14.shapes.add_picture(viewer_img, px(128), px(370), width=px(1000))
    add_card(s14, 1180, 350, 632, 610, fill=C_PALE, stroke=C_LINE, line_width=1.5)
    add_pill(s14, 1210, 380, 200, 42, "의료진 뷰어", fill=C_BLUE, color=C_WHITE, font_size=19)
    tb = s14.shapes.add_textbox(px(1430), px(378), px(360), px(45))
    tb.text_frame.paragraphs[0].text = "700 Slices 대용량 무지연 렌더링"
    tb.text_frame.paragraphs[0].font.name = FONT
    tb.text_frame.paragraphs[0].font.size = pt(25)
    tb.text_frame.paragraphs[0].font.bold = True
    tb.text_frame.paragraphs[0].font.color.rgb = C_INK
    pts_v = [
        ("WADO-RS 스트리밍", "700장 대용량 CT를 다운로드 없이 프레임 단위 초고속 렌더링"),
        ("정밀 판독 도구", "간 병변 십자선, 다중 단면 연속 스크롤, 윈도우 레벨링, 시리즈 썸네일"),
        ("5분 단기 서명 토큰", "시간 경과 시 세션 자동 만료로 장기 토큰 탈취 위험 원천 차단"),
        ("로컬 다운로드 금지", "의료진 PC에 원본 DICOM 파일 무단 저장을 엄격히 차단"),
        ("DICOMweb 표준 준수", "QIDO-RS / WADO-RS 표준으로 기존 병원 PACS와 완벽 호환")
    ]
    tb_pts8 = s14.shapes.add_textbox(px(1210), px(445), px(570), px(500))
    for title, desc in pts_v:
        p = tb_pts8.text_frame.add_paragraph()
        p.text = f"✔  {title}"
        p.font.name = FONT
        p.font.size = pt(21)
        p.font.bold = True
        p.font.color.rgb = C_BLUE
        p2 = tb_pts8.text_frame.add_paragraph()
        p2.text = f"     {desc}"
        p2.font.name = FONT
        p2.font.size = pt(18)
        p2.font.color.rgb = C_INK
        p2.space_after = Pt(10)
    set_notes(s14, "[의료진 뷰어 대본]\n\"B병원 의사가 5분 단기 토큰으로 700장에 달하는 복부 CT 슬라이스를 초고속으로 스크롤하며 간 병변을 정밀 판독하는 실제 데스크톱 PACS 뷰어 화면입니다.\"")

    # Slide 15: Security Console
    s15 = prs.slides.add_slide(blank_layout)
    setup_header_footer(s15, 15, "07. LIVE SERVICE · SECURITY CONSOLE", "모든 접근을 불변 추적하는 통합 보안 관제 콘솔",
                        "토큰 발급, WAF 규칙 이벤트, Key Vault 서명, 비정상 접근 시도 실시간 모니터링")
    add_card(s15, 108, 350, 960, 610, fill=C_WHITE, stroke=C_LINE, line_width=1.5)
    audit_img = os.path.join(ASSETS, "08_security_audit_console.png")
    if os.path.exists(audit_img):
        s15.shapes.add_picture(audit_img, px(128), px(370), width=px(920))
    add_card(s15, 1100, 350, 712, 610, fill=C_PALE, stroke=C_LINE, line_width=1.5)
    add_pill(s15, 1130, 380, 200, 42, "보안 관제실", fill=C_RED, color=C_WHITE, font_size=19)
    tb = s15.shapes.add_textbox(px(1350), px(378), px(440), px(45))
    tb.text_frame.paragraphs[0].text = "불변 감사로그와 이상행위 탐지"
    tb.text_frame.paragraphs[0].font.name = FONT
    tb.text_frame.paragraphs[0].font.size = pt(25)
    tb.text_frame.paragraphs[0].font.bold = True
    tb.text_frame.paragraphs[0].font.color.rgb = C_INK
    pts_a = [
        ("15대 주요 행위 전수 로깅", "로그인, 동의 생성, 토큰 발급, 프레임 조회, 접근 거부 등 실시간 기록"),
        ("사유 코드 기반 거부", "DOCTOR_HOSPITAL_MISMATCH 등 명확한 원인 추적"),
        ("감사 세션 체인 상관", "하나의 감사 세션 ID로 토큰 발급부터 PACS 조회까지 종단 추적"),
        ("실시간 이상행위 탐지", "단시간 대량 조회, 만료 토큰 반복 사용, 비진료 부서 접근 실시간 경보"),
        ("관리자 임의 삭제 금지", "감사로그 자체의 무결성을 보장하여 법적 증거력 확보")
    ]
    tb_pts9 = s15.shapes.add_textbox(px(1130), px(445), px(650), px(500))
    for title, desc in pts_a:
        p = tb_pts9.text_frame.add_paragraph()
        p.text = f"✔  {title}"
        p.font.name = FONT
        p.font.size = pt(21)
        p.font.bold = True
        p.font.color.rgb = C_RED
        p2 = tb_pts9.text_frame.add_paragraph()
        p2.text = f"     {desc}"
        p2.font.name = FONT
        p2.font.size = pt(18)
        p2.font.color.rgb = C_INK
        p2.space_after = Pt(10)
    set_notes(s15, "[보안 관제 대본]\n\"모든 열람 행위와 접근 거부 사유가 1초 단위로 불변 감사로그에 기록되며 관리자조차 삭제할 수 없어 완전한 법적 증거력을 지닙니다.\"")

    # -------------------------------------------------------------
    # SLIDE 16: CONCLUSION
    # -------------------------------------------------------------
    s16 = prs.slides.add_slide(blank_layout)
    bg16 = s16.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, px(1920), px(1080))
    bg16.fill.solid()
    bg16.fill.fore_color.rgb = C_NAVY
    bg16.line.fill.background()

    t_box16 = s16.shapes.add_textbox(px(108), px(120), px(1704), px(130))
    p = t_box16.text_frame.paragraphs[0]
    p.text = "환자 동의로 열고, 증거와 감사로 닫는다"
    p.font.name = FONT
    p.font.size = pt(56)
    p.font.bold = True
    p.font.color.rgb = C_WHITE
    p2 = t_box16.text_frame.add_paragraph()
    p2.text = "하이패스 MediQ가 만들어갈 안전하고 끊김 없는 차세대 의료 영상 생태계"
    p2.font.name = FONT
    p2.font.size = pt(28)
    p2.font.color.rgb = C_CYAN

    benefits = [
        ("환자 (Patient)", ["CD 발급·운반 비용 0원화", "중복 CT/MRI 피폭 예방", "진료 대기시간 획기적 단축", "내 의료 데이터 주권 통제"]),
        ("의료진 (Clinician)", ["타 병원 검사 즉시 스트리밍", "진료 연속성 및 정확도 향상", "CD 등록 대기 없는 즉시 진료", "환자 상담 리허설로 효율화"]),
        ("병원·보안 (Hospital)", ["Zero Cloud Storage 유출 0", "ABAC 11단계 인가·단기토큰", "불변 감사로그 완벽한 증거력", "기존 PACS 인프라 유지 연동"]),
        ("사회·비전 (Society)", ["건강보험 재정 낭비 절감", "국가 의료정보 교류망 모델", "DICOMweb / FHIR 표준 선도", "환자 중심 디지털 헬스케어"])
    ]
    for i, (b_title, b_bullets) in enumerate(benefits):
        bx = 108 + i * 436
        add_card(s16, bx, 320, 396, 610, fill=C_INK, stroke=C_BLUE, line_width=2.0)
        add_pill(s16, bx + 25, 350, 160, 42, b_title.split(" ")[0], fill=C_BLUE, color=C_WHITE, font_size=20)
        
        tb = s16.shapes.add_textbox(px(bx + 25), px(415), px(346), px(50))
        p = tb.text_frame.paragraphs[0]
        p.text = b_title
        p.font.name = FONT
        p.font.size = pt(25)
        p.font.bold = True
        p.font.color.rgb = C_WHITE

        r = s16.shapes.add_shape(MSO_SHAPE.RECTANGLE, px(bx + 25), px(480), px(346), px(2))
        r.fill.solid()
        r.fill.fore_color.rgb = C_BLUE
        r.line.fill.background()

        tb2 = s16.shapes.add_textbox(px(bx + 25), px(505), px(346), px(400))
        for line in b_bullets:
            lp = tb2.text_frame.add_paragraph()
            lp.text = f"•  {line}"
            lp.font.name = FONT
            lp.font.size = pt(19)
            lp.font.color.rgb = RGBColor(220, 235, 252)
            lp.space_after = Pt(14)

    r_ftr = s16.shapes.add_shape(MSO_SHAPE.RECTANGLE, px(108), px(1006), px(1704), px(2))
    r_ftr.fill.solid()
    r_ftr.fill.fore_color.rgb = C_BLUE
    r_ftr.line.fill.background()

    f_box = s16.shapes.add_textbox(px(108), px(1014), px(1704), px(31))
    p = f_box.text_frame.paragraphs[0]
    p.text = "Medi Q  /  합성 데이터 · 비임상 기술 PoC  ·  16  /  16  ·  Q&A"
    p.font.name = FONT
    p.font.size = pt(17)
    p.font.color.rgb = C_MUTED
    p.alignment = PP_ALIGN.CENTER

    set_notes(s16, """[마무리 및 Q&A 대본]
"정리하겠습니다. 하이패스 MediQ는 환자에게는 CD 발급 비용과 방사선 피폭 위험을 없애주고, 의료진에게는 진료 연속성을, 병원에는 유출 위험 없는 보안을 보장합니다. 경청해 주셔서 대단히 감사합니다. 질의응답을 받겠습니다." """)

    # Save presentation
    pitch_path = os.path.join(OUT_DIR, "Highpass_MediQ_Pitch_5min.pptx")
    prs.save(pitch_path)
    print("Saved Morph-enabled 5-min pitch deck to:", pitch_path)

    # Copy to Kakao folder
    kakao_pitch = os.path.join(KAKAO_DIR, "Highpass_MediQ_Pitch_5min.pptx")
    shutil.copy2(pitch_path, kakao_pitch)
    print("Copied to Kakao folder:", kakao_pitch)

    # Also save standalone 8-step Morph deck
    morph_standalone = os.path.join(OUT_DIR, "Highpass_MediQ_Architecture_Morph_8steps.pptx")
    shutil.copy2(pitch_path, morph_standalone)
    shutil.copy2(pitch_path, os.path.join(KAKAO_DIR, "Highpass_MediQ_Architecture_Morph_8steps.pptx"))
    print("Saved standalone 8-step Morph deck to:", morph_standalone)

if __name__ == "__main__":
    build_presentation()
