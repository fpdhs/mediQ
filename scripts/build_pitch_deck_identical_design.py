"""
Build 5-minute Pitch Deck with 100% Identical Design System to MediQ 중간발표.pptx:
- Canvas: 20.00" x 11.25" (1920x1080 scaled, 1 inch = 96 px)
- Typography: 프리텐다드 (Pretendard Bold, Semi-Bold, Regular)
- Colors: Exact palette from MediQ 중간발표 (Navy #0B2342, Blue #2F68B5, Cyan #55C2D8, etc.)
- Layout: Signature vertical accent bar, section label, bold 42pt title, round cards (radius 22, border 1.5pt #D8E0E9), bottom footer rule & slide counter
- High-res cropped live screenshots placed with pixel precision
- Complete spoken Korean presenter scripts in all 10 slide notes
"""

import os
import shutil
import pptx
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

ROOT = r"C:\Users\user\Documents\New project"
ASSETS = os.path.join(ROOT, "docs", "assets", "images")
OUT_DIR = os.path.join(ROOT, "docs", "presentation")
KAKAO_DIR = r"C:\Users\user\Documents\카카오톡 받은 파일"

os.makedirs(OUT_DIR, exist_ok=True)

# -------------------------------------------------------------
# Exact Design Constants from MediQ 중간발표
# -------------------------------------------------------------
FONT = "프리텐다드"

# Exact 16-color palette
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
C_BLACK    = RGBColor(10, 22, 37)    # #0A1625

def px(val):
    """Convert 1920x1080 CSS pixels to 20x11.25 inch PowerPoint Inches (1 inch = 96 px)"""
    return Inches(val / 96.0)

def pt(px_val):
    """Convert pixel font size to PowerPoint Pt (1 px = 0.75 pt)"""
    return Pt(px_val * 0.75)


def build_identical_deck():
    prs = pptx.Presentation()
    prs.slide_width = Inches(20.0)
    prs.slide_height = Inches(11.25)
    blank_layout = prs.slide_layouts[6]

    # Helper: Base content slide header and footer
    def setup_content_slide(slide, slide_num, label, title, subtitle=None):
        # Background white
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, px(1920), px(1080))
        bg.fill.solid()
        bg.fill.fore_color.rgb = C_WHITE
        bg.line.fill.background()

        # Header background banner
        hdr_bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, px(1920), px(258))
        hdr_bg.fill.solid()
        hdr_bg.fill.fore_color.rgb = C_PALE
        hdr_bg.line.fill.background()

        # Vertical Blue Accent Line
        bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, px(108), px(76), px(8), px(132))
        bar.fill.solid()
        bar.fill.fore_color.rgb = C_BLUE
        bar.line.fill.background()

        # Section Label (e.g., "01. PROBLEM STATEMENT")
        lbl_box = slide.shapes.add_textbox(px(150), px(62), px(1600), px(38))
        tf = lbl_box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
        p = tf.paragraphs[0]
        p.text = label
        p.font.name = FONT
        p.font.size = pt(21)
        p.font.bold = True
        p.font.color.rgb = C_BLUE

        # Slide Main Title
        t_box = slide.shapes.add_textbox(px(150), px(101), px(1650), px(138))
        tf = t_box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
        p = tf.paragraphs[0]
        p.text = title
        p.font.name = FONT
        p.font.size = pt(52)
        p.font.bold = True
        p.font.color.rgb = C_INK

        # Subtitle
        if subtitle:
            sub_box = slide.shapes.add_textbox(px(108), px(282), px(1704), px(48))
            tf = sub_box.text_frame
            tf.word_wrap = True
            tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
            p = tf.paragraphs[0]
            p.text = subtitle
            p.font.name = FONT
            p.font.size = pt(25)
            p.font.color.rgb = C_SLATE

        # Footer Rule & Text
        rule = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, px(108), px(1006), px(1704), px(2))
        rule.fill.solid()
        rule.fill.fore_color.rgb = C_LINE
        rule.line.fill.background()

        f_left = slide.shapes.add_textbox(px(108), px(1014), px(1200), px(31))
        tf = f_left.text_frame
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
        p = tf.paragraphs[0]
        p.text = "Medi Q  /  합성 데이터 · 비임상 기술 PoC  ·  5분 핵심 피칭"
        p.font.name = FONT
        p.font.size = pt(17)
        p.font.color.rgb = C_MUTED

        f_right = slide.shapes.add_textbox(px(1600), px(1014), px(212), px(31))
        tf = f_right.text_frame
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
        p = tf.paragraphs[0]
        p.text = f"{slide_num:02d}  /  10"
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
        tf.word_wrap = False
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
        p = tf.paragraphs[0]
        p.text = text
        p.font.name = FONT
        p.font.size = pt(font_size)
        p.font.bold = True
        p.font.color.rgb = color
        p.alignment = PP_ALIGN.CENTER
        return p_shape

    def set_notes(slide, text):
        notes = slide.notes_slide.notes_text_frame
        notes.text = text

    # =============================================================
    # SLIDE 1: COVER (Exact MediQ Layout)
    # =============================================================
    s1 = prs.slides.add_slide(blank_layout)
    bg1 = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, px(1920), px(1080))
    bg1.fill.solid()
    bg1.fill.fore_color.rgb = C_WHITE
    bg1.line.fill.background()

    # Top Kicker
    k_box = s1.shapes.add_textbox(px(108), px(140), px(1100), px(45))
    tf = k_box.text_frame
    p = tf.paragraphs[0]
    p.text = "CAPSTONE MVP  ·  SECURITY BY DESIGN"
    p.font.name = FONT
    p.font.size = pt(26)
    p.font.bold = True
    p.font.color.rgb = C_SLATE

    # Wordmark "mediQ"
    w_box = s1.shapes.add_textbox(px(108), px(200), px(800), px(110))
    tf = w_box.text_frame
    p = tf.paragraphs[0]
    p.text = "mediQ"
    p.font.name = FONT
    p.font.size = pt(90)
    p.font.bold = True
    p.font.color.rgb = C_BLUE

    # Title "환자 동의 기반\n영상 교류 및 AI 도우미"
    t_box1 = s1.shapes.add_textbox(px(108), px(330), px(1100), px(220))
    tf = t_box1.text_frame
    p = tf.paragraphs[0]
    p.text = "환자 동의 기반\n영상 교류 및 AI 도우미"
    p.font.name = FONT
    p.font.size = pt(74)
    p.font.bold = True
    p.font.color.rgb = C_INK

    # Subtitle
    sub_box1 = s1.shapes.add_textbox(px(108), px(575), px(1100), px(58))
    tf = sub_box1.text_frame
    p = tf.paragraphs[0]
    p.text = "Zero Cloud Storage · ABAC 11단계 인가 · 700 Slices CT 스트리밍"
    p.font.name = FONT
    p.font.size = pt(27)
    p.font.color.rgb = C_SLATE

    # Right side: 3 Signature Navy Accent Cards
    metrics = [
        ("01", "Zero Cloud Storage", "의료영상 원본은 병원 PACS 분산 보관\n클라우드 중앙 DB에 DICOM 원본 비보관"),
        ("02", "ABAC 11단계 인가", "Fail-Closed 조건 교집합 전수 검증\n5~10분 유효 단기 HMAC 서명 토큰"),
        ("03", "700 Slices CT 스트리밍", "WADO-RS 표준 기반 무지연 Lazy Loading\n의료진 PC 로컬 무단 다운로드 원천 차단")
    ]
    for i, (num, m_title, m_desc) in enumerate(metrics):
        card_y = 200 + i * 185
        c = add_card(s1, 1140, card_y, 672, 160, fill=C_NAVY, stroke=C_BLUE, line_width=2.0)
        add_pill(s1, 1165, card_y + 25, 65, 42, num, fill=C_BLUE, color=C_WHITE, font_size=20)
        
        tb = s1.shapes.add_textbox(px(1250), px(card_y + 20), px(540), px(45))
        tf = tb.text_frame
        p = tf.paragraphs[0]
        p.text = m_title
        p.font.name = FONT
        p.font.size = pt(26)
        p.font.bold = True
        p.font.color.rgb = C_WHITE
        
        tb2 = s1.shapes.add_textbox(px(1250), px(card_y + 70), px(540), px(70))
        tf = tb2.text_frame
        p = tf.paragraphs[0]
        p.text = m_desc
        p.font.name = FONT
        p.font.size = pt(18)
        p.font.color.rgb = RGBColor(216, 231, 248)

    # Dark Leather Footer Banner (Original MediQ style)
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
        tf = vb.text_frame
        p = tf.paragraphs[0]
        p.text = v
        p.font.name = FONT
        p.font.size = pt(24)
        p.font.bold = (i == 0)
        p.font.color.rgb = C_WHITE

    set_notes(s1, """[발표 00:00 ~ 00:30 | 도입 및 정체성 소개]
"안녕하십니까. 환자 동의 기반 클라우드 의료영상 교류 및 비임상 AI 건강도우미 플랫폼, '하이패스 MediQ'의 발표를 맡은 [발표자 이름]입니다.
저희 프로젝트는 기존 병원 간 의료영상 이동 방식인 'CD 발급과 재촬영'의 고질적인 비효율과 방사선 피폭 문제를 해결하기 위해 기획되었습니다.
클라우드에 원본 영상을 저장하지 않는 'Zero Cloud Storage' 원칙과 11단계 ABAC 인가, 그리고 700장 복부 CT 무지연 스트리밍을 실제로 구현하고 검증한 성과를 지금부터 5분간 핵심 위주로 발표해 드리겠습니다." """)

    # =============================================================
    # SLIDE 2: PROBLEM STATEMENT (01)
    # =============================================================
    s2 = prs.slides.add_slide(blank_layout)
    setup_content_slide(s2, 2, "01. PROBLEM STATEMENT", "영상보다 전달 과정에서 맥락이 끊긴다",
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
        tf = tb.text_frame
        p = tf.paragraphs[0]
        p.text = kicker
        p.font.name = FONT
        p.font.size = pt(18)
        p.font.bold = True
        p.font.color.rgb = C_SLATE
        
        tb2 = s2.shapes.add_textbox(px(cx + 30), px(440), px(460), px(60))
        tf = tb2.text_frame
        p = tf.paragraphs[0]
        p.text = title
        p.font.name = FONT
        p.font.size = pt(30)
        p.font.bold = True
        p.font.color.rgb = C_INK
        
        # Rule inside card
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

    set_notes(s2, """[발표 00:30 ~ 01:00 | 청중 공감 및 문제 정의]
"여러분, 대학병원에서 CT나 MRI를 찍고 다른 병원으로 진료를 보러 갈 때, 여전히 환자가 직접 CD를 가방에 넣고 들고 다녀야 한다는 사실을 알고 계십니까?
이 구시대적 방식 때문에 환자는 불필요한 발급 수수료와 번호표 대기 시간을 겪습니다. 더 심각한 것은 타 병원에 갔을 때 CD 포맷이 안 맞거나 손상되어 어쩔 수 없이 CT/MRI를 다시 촬영하게 되면서 불필요한 방사선 피폭에 노출된다는 점입니다.
또한, 내 소중한 의료 정보임에도 어디로 흘러가는지, 누구에게 보여줄지 환자 스스로 제어하거나 회수할 권리가 완전히 배제되어 있었습니다." """)

    # =============================================================
    # SLIDE 3: SOLUTION PROPOSAL (02)
    # =============================================================
    s3 = prs.slides.add_slide(blank_layout)
    setup_content_slide(s3, 3, "02. SOLUTION PROPOSAL", "환자가 중심이 되는 다이렉트 의료영상 공유",
                        "기존 매체 운반 방식에서 환자 동의 기반 클라우드 스트리밍으로의 패러다임 전환")

    # Before Card (Top)
    c_b = add_card(s3, 108, 350, 1704, 260, fill=C_PALEGOLD, stroke=C_GOLD, line_width=1.5)
    add_pill(s3, 138, 375, 170, 42, "기존 방식 (CD)", fill=C_GOLD, color=C_WHITE, font_size=19)
    
    tb = s3.shapes.add_textbox(px(330), px(375), px(1440), px(45))
    tf = tb.text_frame
    p = tf.paragraphs[0]
    p.text = "Traditional Flow : 매체 중심의 물리적 운반 절차"
    p.font.name = FONT
    p.font.size = pt(26)
    p.font.bold = True
    p.font.color.rgb = RGBColor(161, 98, 7)

    # 5 steps in traditional
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
        if i < 4:
            arr = s3.shapes.add_textbox(px(sx + 295), px(475), px(45), px(50))
            tf_a = arr.text_frame
            p = tf_a.paragraphs[0]
            p.text = "➔"
            p.font.size = pt(22)
            p.font.color.rgb = C_GOLD

    # After Card (Bottom)
    c_a = add_card(s3, 108, 640, 1704, 320, fill=C_PALETEAL, stroke=C_TEAL, line_width=2.0)
    add_pill(s3, 138, 665, 200, 42, "하이패스 (MediQ)", fill=C_TEAL, color=C_WHITE, font_size=19)
    
    tb = s3.shapes.add_textbox(px(360), px(665), px(1410), px(45))
    tf = tb.text_frame
    p = tf.paragraphs[0]
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
        if i < 3:
            arr = s3.shapes.add_textbox(px(sx + 375), px(770), px(45), px(50))
            tf_a = arr.text_frame
            p = tf_a.paragraphs[0]
            p.text = "➔"
            p.font.size = pt(26)
            p.font.bold = True
            p.font.color.rgb = C_TEAL

    # Bottom benefit line
    bf_box = s3.shapes.add_textbox(px(138), px(890), px(1640), px(45))
    tf = bf_box.text_frame
    p = tf.paragraphs[0]
    p.text = "✔ CD 발급비 0원  |  ✔ 불필요한 방사선 피폭 원천 차단  |  ✔ 언제든 권한 철회  |  ✔ AI 건강도우미 검사 안내"
    p.font.name = FONT
    p.font.size = pt(20)
    p.font.bold = True
    p.font.color.rgb = C_INK
    p.alignment = PP_ALIGN.CENTER

    set_notes(s3, """[발표 01:00 ~ 01:30 | 솔루션 패러다임 전환]
"하이패스 MediQ는 이 불편한 매체 전달 방식을 완전히 디지털 혁신합니다.
환자가 스마트폰 웹에서 B대학병원, 진료 목적, 유효기간, 그리고 허용할 CT 검사만을 콕 집어 명시적 동의를 생성합니다.
수신 병원 의사가 접근을 요청하면, 서버가 즉시 11단계 보안 조건을 검증한 뒤 5분 유효 단기 토큰을 서명 발급합니다.
이 토큰을 통해 원본 병원 PACS로부터 필요한 DICOM 영상만을 웹 뷰어로 실시간 스트리밍합니다.
CD를 들고 다닐 필요도 없고, 불필요한 재촬영도 막으며, 언제든 동의를 철회할 수 있는 진정한 환자 중심 서비스입니다." """)

    # =============================================================
    # SLIDE 4: SYSTEM ARCHITECTURE (03)
    # =============================================================
    s4 = prs.slides.add_slide(blank_layout)
    setup_content_slide(s4, 4, "03. SYSTEM ARCHITECTURE", "Control Plane과 Data Plane의 완전한 물리적 분리",
                        "의료영상 원본을 클라우드 DB에 영구 보관하지 않는 Zero Cloud Storage 원칙 준수")

    # Left: Architecture Diagram Image in Card
    add_card(s4, 108, 350, 960, 610, fill=C_WHITE, stroke=C_LINE, line_width=1.5)
    arch_img = os.path.join(ASSETS, "highpass_architecture_full.png")
    if os.path.exists(arch_img):
        s4.shapes.add_picture(arch_img, px(128), px(370), width=px(920))

    # Right: 3 Pillars
    pillars = [
        ("Zero Cloud Storage (불변 원칙)", "의료영상 원본은 각 병원 PACS(Orthanc)에만 분산 보관하며, 중앙 클라우드 DB에는 DICOM 원본을 절대 지속 저장하지 않습니다."),
        ("Control vs Data Plane 물리적 분리", "Azure Control Plane은 환자 동의, ABAC 인가, 단기 토큰 발급, 감사로그만을 담당하며, 영상 픽셀 데이터는 경유하지 않습니다."),
        ("필요 최소 전송 (Lazy Loading)", "전체 Study를 무차별 다운로드하지 않고, WADO-RS 표준 기반으로 Study ➔ Series ➔ Instance 프레임 단위로 필요한 만큼만 직접 전송합니다.")
    ]
    for i, (title, desc) in enumerate(pillars):
        cy = 350 + i * 205
        add_card(s4, 1100, cy, 712, 190, fill=C_PALE, stroke=C_LINE, line_width=1.5)
        add_pill(s4, 1130, cy + 25, 60, 36, f"0{i+1}", fill=C_BLUE, color=C_WHITE, font_size=18)
        
        tb = s4.shapes.add_textbox(px(1210), px(cy + 22), px(580), px(45))
        tf = tb.text_frame
        p = tf.paragraphs[0]
        p.text = title
        p.font.name = FONT
        p.font.size = pt(24)
        p.font.bold = True
        p.font.color.rgb = C_BLUE
        
        tb2 = s4.shapes.add_textbox(px(1130), px(cy + 75), px(650), px(100))
        tf = tb2.text_frame
        p = tf.paragraphs[0]
        p.text = desc
        p.font.name = FONT
        p.font.size = pt(20)
        p.font.color.rgb = C_INK

    set_notes(s4, """[발표 01:30 ~ 02:00 | 시스템 아키텍처 및 보안 불변식]
"저희 아키텍처의 절대 원칙은 'Zero Cloud Storage'입니다.
민감한 환자 의료영상이 클라우드 중앙에 영구 보관되면 대규모 해킹이나 유출의 표적이 됩니다.
따라서 원본 영상은 각 병원 로컬 온프레미스 PACS에 그대로 머무르고, 클라우드 Control Plane은 오직 동의와 권한, 감사로그만 관리합니다.
의사가 영상을 볼 때만 단기 토큰으로 병원 게이트웨이와 직접 통신하여 프레임 단위로 Lazy Loading 스트리밍합니다. 의료법과 개인정보보호법 가이드라인을 완벽하게 만족하는 구조입니다." """)

    # =============================================================
    # SLIDE 5: SECURITY & AI GUARDRAILS (04)
    # =============================================================
    s5 = prs.slides.add_slide(blank_layout)
    setup_content_slide(s5, 5, "04. SECURITY & AI GOVERNANCE", "11단계 교집합 정책 검증과 비임상 AI 안전 가드레일",
                        "단 하나의 조건이라도 불충족 시 즉시 차단(Fail-Closed) 및 공인 코퍼스 기반 비임상 RAG")

    # Card 1: ABAC 11
    add_card(s5, 108, 350, 832, 610, fill=C_PALE, stroke=C_LINE, line_width=1.5)
    add_pill(s5, 138, 380, 200, 42, "접근통제 엔진", fill=C_BLUE, color=C_WHITE, font_size=19)
    tb = s5.shapes.add_textbox(px(360), px(378), px(550), px(45))
    tf = tb.text_frame
    p = tf.paragraphs[0]
    p.text = "11-Factor Fail-Closed ABAC Gate"
    p.font.name = FONT
    p.font.size = pt(26)
    p.font.bold = True
    p.font.color.rgb = C_INK

    abac_factors = [
        "1. consentId 고유 식별자 유효성", "2. 동의 상태 ACTIVE 여부",
        "3. 현재 시각이 validFrom/Until 내인가", "4. 요청 병원 == 동의된 수신 병원",
        "5. 요청 의사 소속 병원 일치", "6. 요청 Study UID 허용 범위",
        "7. 요청 Series UID 허용 범위", "8. 요청 목적 == 동의 목적",
        "9. VIEW_ONLY vs DOWNLOAD 권한", "10. 단기 토큰 유효시간 (5~10분)",
        "11. 토큰 범위 및 HMAC 무결성 서명"
    ]
    tb_abac = s5.shapes.add_textbox(px(138), px(440), px(770), px(500))
    tf = tb_abac.text_frame
    for f in abac_factors:
        p = tf.add_paragraph()
        p.text = f"•  {f}"
        p.font.name = FONT
        p.font.size = pt(20)
        p.font.color.rgb = C_INK
        p.space_after = Pt(4)

    # Card 2: 2-Layer RAG
    add_card(s5, 980, 350, 832, 610, fill=C_PALETEAL, stroke=C_TEAL, line_width=1.5)
    add_pill(s5, 1010, 380, 200, 42, "AI 가드레일", fill=C_TEAL, color=C_WHITE, font_size=19)
    tb = s5.shapes.add_textbox(px(1230), px(378), px(550), px(45))
    tf = tb.text_frame
    p = tf.paragraphs[0]
    p.text = "2-Layer Non-Clinical AI RAG"
    p.font.name = FONT
    p.font.size = pt(26)
    p.font.bold = True
    p.font.color.rgb = C_INK

    rag_factors = [
        "공인 코퍼스: MedlinePlus 및 간학회 1,019개 검사 토픽 연계",
        "한국어 자모 분해 전처리: 조사(은/는/이/가/이란) 정밀 분리",
        "2-Layer 분류: 1차 토픽 감지 ➔ 2차 질문 의도(개념/원인/주의) 매핑",
        "표제어 단독 입력 시 안전한 기본값(DEFINITION) 자동 반환",
        "의료 진단/처방 차단: 약물 용량, 확진 판단 질의 안전 안내 전환",
        "의사 상담 리허설: 진료실에서 주치의에게 물어볼 질문 자동 생성"
    ]
    tb_rag = s5.shapes.add_textbox(px(1010), px(440), px(770), px(500))
    tf = tb_rag.text_frame
    for rf in rag_factors:
        p = tf.add_paragraph()
        p.text = f"•  {rf}"
        p.font.name = FONT
        p.font.size = pt(20)
        p.font.color.rgb = C_INK
        p.space_after = Pt(14)

    set_notes(s5, """[발표 02:00 ~ 02:30 | 보안 인가 엔진 및 AI 안전성]
"보안은 단 하나의 구멍도 허용하지 않습니다.
저희 ABAC 게이트는 환자 동의, 시간, 의사 소속, 검사 UID 등 11개 조건을 교집합으로 검증하며, 하나라도 어긋나면 접근을 차단하고 감사로그를 남깁니다.
또한 함께 탑재된 AI 건강도우미는 미국 MedlinePlus 공인 코퍼스 기반으로 구동되며, 2-Layer 형태소 및 의도 분류기를 통해 진단이나 처방성 질문을 완벽히 차단하고, 환자가 검사 결과를 쉽게 이해하고 의사에게 무엇을 물어볼지 준비하는 안전한 비임상 보조 도구로 엄격히 제한됩니다." """)

    # =============================================================
    # SLIDE 6: LIVE UI - PATIENT WALLET (05)
    # =============================================================
    s6 = prs.slides.add_slide(blank_layout)
    setup_content_slide(s6, 6, "05. LIVE SERVICE · PATIENT PORTAL", "직관적인 4대 역할 게이트와 환자 맞춤형 동의 지갑",
                        "환자가 직접 수신 병원, 진료 목적, 유효기간, 허용할 복부 CT 검사 범위를 지정하고 언제든 철회")

    # Left: Wallet Screenshot in Card
    add_card(s6, 108, 350, 960, 610, fill=C_WHITE, stroke=C_LINE, line_width=1.5)
    wallet_img = os.path.join(ASSETS, "06_patient_consent_wallet.png")
    if os.path.exists(wallet_img):
        s6.shapes.add_picture(wallet_img, px(128), px(370), width=px(920))

    # Right: Feature Details
    add_card(s6, 1100, 350, 712, 610, fill=C_PALE, stroke=C_LINE, line_width=1.5)
    add_pill(s6, 1130, 380, 220, 42, "환자 동의 지갑", fill=C_BLUE, color=C_WHITE, font_size=19)
    tb = s6.shapes.add_textbox(px(1370), px(378), px(420), px(45))
    tf = tb.text_frame
    p = tf.paragraphs[0]
    p.text = "환자 중심의 공유 통제"
    p.font.name = FONT
    p.font.size = pt(26)
    p.font.bold = True
    p.font.color.rgb = C_INK

    pts_wallet = [
        ("4대 역할 게이트 분리", "환자, 의료진, 병원 관리자, 보안 운영자 전용 로그인 화면 제공"),
        ("수신 병원 선택", "A대학병원에서 B대학병원으로 공유 대상 병원 명확히 지정"),
        ("열람 목적 및 기간", "진료 목적으로 한정, 1일~30일 사이 유효기간 설정"),
        ("검사 단위 선택", "전체 진료기록이 아닌, 필요한 특정 복부 CT Study/Series만 선택"),
        ("원클릭 동의 철회", "언제든 환자가 원할 때 즉시 권한을 파기하는 Revoke 지원")
    ]
    tb_pts = s6.shapes.add_textbox(px(1130), px(445), px(650), px(500))
    tf = tb_pts.text_frame
    for title, desc in pts_wallet:
        p = tf.add_paragraph()
        p.text = f"✔  {title}"
        p.font.name = FONT
        p.font.size = pt(21)
        p.font.bold = True
        p.font.color.rgb = C_BLUE
        p2 = tf.add_paragraph()
        p2.text = f"     {desc}"
        p2.font.name = FONT
        p2.font.size = pt(18)
        p2.font.color.rgb = C_INK
        p2.space_after = Pt(10)

    set_notes(s6, """[발표 02:30 ~ 03:00 | 라이브 UI 환자 동의 지갑]
"실제 클라우드에 배포된 화면입니다.
좌측은 환자가 접속하는 '의료 공유 지갑' 화면입니다. 환자는 수신할 B대학병원과 진료 목적, 유효기간을 설정하고, 본인이 공유하고 싶은 복부 CT 검사를 직접 선택합니다.
전체 진료기록을 무차별 공유하는 것이 아니라 필요한 검사만 선별 공유하며, 환자가 원하면 언제든 1초 만에 권한을 파기하는 '동의 철회'가 가능합니다." """)

    # =============================================================
    # SLIDE 7: LIVE UI - HEALTH HELPER (06)
    # =============================================================
    s7 = prs.slides.add_slide(blank_layout)
    setup_content_slide(s7, 7, "06. LIVE SERVICE · HEALTH HELPER", "어려운 검사 결과를 눈높이 설명으로: AI 건강도우미",
                        "혈청 알파태아단백(AFP) 검사 결과 연동, 쉬운 개념 해설 및 진료실 의사 상담 리허설")

    # Left: Health Helper Screenshot in Card
    add_card(s7, 108, 350, 750, 610, fill=C_WHITE, stroke=C_LINE, line_width=1.5)
    rag_img = os.path.join(ASSETS, "05_health_helper_rag.png")
    if os.path.exists(rag_img):
        s7.shapes.add_picture(rag_img, px(128), px(365), width=px(710))

    # Right: Features
    add_card(s7, 890, 350, 922, 610, fill=C_PALETEAL, stroke=C_TEAL, line_width=1.5)
    add_pill(s7, 920, 380, 220, 42, "AI 건강도우미", fill=C_TEAL, color=C_WHITE, font_size=19)
    tb = s7.shapes.add_textbox(px(1160), px(378), px(630), px(45))
    tf = tb.text_frame
    p = tf.paragraphs[0]
    p.text = "혈청 알파태아단백(AFP) 검사 질의응답 연동"
    p.font.name = FONT
    p.font.size = pt(26)
    p.font.bold = True
    p.font.color.rgb = C_INK

    pts_rag = [
        ("쉬운 의학 개념 해설", "AFP 정상 수치와 간암/간경화 선별검사 목적을 비임상 환자 언어로 해설"),
        ("추천 질문 스튜디오", "'AFP 검사가 뭔가요?', '초음파와 차이점', '주의사항' 등 원클릭 퀵 질의"),
        ("의사 상담 리허설 박스", "진료실에서 주치의에게 물어봐야 할 맞춤 질문 3가지를 자동 정리"),
        ("공인 학술 출처 투명 표기", "MedlinePlus 및 간학회 가이드라인 출처 링크를 명확히 제시하여 신뢰 확보"),
        ("한국어 형태소 전처리", "체언과 조사를 분리하여 'AFP란', '초음파에 대해서' 등 구어체 질문 완벽 처리")
    ]
    tb_pts7 = s7.shapes.add_textbox(px(920), px(445), px(860), px(500))
    tf = tb_pts7.text_frame
    for title, desc in pts_rag:
        p = tf.add_paragraph()
        p.text = f"✔  {title}"
        p.font.name = FONT
        p.font.size = pt(21)
        p.font.bold = True
        p.font.color.rgb = C_TEAL
        p2 = tf.add_paragraph()
        p2.text = f"     {desc}"
        p2.font.name = FONT
        p2.font.size = pt(18)
        p2.font.color.rgb = C_INK
        p2.space_after = Pt(10)

    set_notes(s7, """[발표 03:00 ~ 03:30 | 라이브 UI AI 건강도우미]
"환자가 검사 결과지에 적힌 어려운 의학 용어를 마주했을 때의 불안을 해소하는 'AI 건강도우미' 화면입니다.
혈청 알파태아단백(AFP)이나 간경화 같은 질환에 대해 질문하면, 정상 수치와 검사 목적을 환자 눈높이로 설명합니다.
특히 우측 하단의 '의사 상담 리허설 박스'는 진료실에서 의사에게 무엇을 물어봐야 할지 핵심 질문을 미리 정리해 주어 진료의 질을 크게 높여줍니다." """)

    # =============================================================
    # SLIDE 8: LIVE UI - CLINICIAN CT VIEWER (07)
    # =============================================================
    s8 = prs.slides.add_slide(blank_layout)
    setup_content_slide(s8, 8, "07. LIVE SERVICE · CLINICIAN VIEWER", "5분 단기 토큰 기반 700 Slices 복부 CT 뷰어",
                        "로컬 PC 무단 다운로드 차단, 5분 유효 단기 토큰 기반 WADO-RS 프레임 지연 스트리밍")

    # Left: Viewer Screenshot in Card
    add_card(s8, 108, 350, 1040, 610, fill=C_WHITE, stroke=C_LINE, line_width=1.5)
    viewer_img = os.path.join(ASSETS, "07_clinician_dicom_viewer.png")
    if os.path.exists(viewer_img):
        s8.shapes.add_picture(viewer_img, px(128), px(370), width=px(1000))

    # Right: Features
    add_card(s8, 1180, 350, 632, 610, fill=C_PALE, stroke=C_LINE, line_width=1.5)
    add_pill(s8, 1210, 380, 200, 42, "의료진 뷰어", fill=C_BLUE, color=C_WHITE, font_size=19)
    tb = s8.shapes.add_textbox(px(1430), px(378), px(360), px(45))
    tf = tb.text_frame
    p = tf.paragraphs[0]
    p.text = "700 Slices 무지연 렌더링"
    p.font.name = FONT
    p.font.size = pt(25)
    p.font.bold = True
    p.font.color.rgb = C_INK

    pts_viewer = [
        ("WADO-RS 스트리밍", "700장 대용량 CT를 다운로드 없이 프레임 단위 초고속 렌더링"),
        ("정밀 판독 도구", "간 병변 십자선, 다중 단면 연속 스크롤, 윈도우 레벨링, 시리즈 썸네일"),
        ("5분 단기 서명 토큰", "시간 경과 시 세션 자동 만료로 장기 토큰 탈취 위험 원천 차단"),
        ("로컬 다운로드 금지", "의료진 PC에 원본 DICOM 파일 무단 저장을 엄격히 차단"),
        ("DICOMweb 표준 준수", "QIDO-RS / WADO-RS 표준으로 기존 병원 PACS와 완벽 호환")
    ]
    tb_pts8 = s8.shapes.add_textbox(px(1210), px(445), px(570), px(500))
    tf = tb_pts8.text_frame
    for title, desc in pts_viewer:
        p = tf.add_paragraph()
        p.text = f"✔  {title}"
        p.font.name = FONT
        p.font.size = pt(21)
        p.font.bold = True
        p.font.color.rgb = C_BLUE
        p2 = tf.add_paragraph()
        p2.text = f"     {desc}"
        p2.font.name = FONT
        p2.font.size = pt(18)
        p2.font.color.rgb = C_INK
        p2.space_after = Pt(10)

    set_notes(s8, """[발표 03:30 ~ 04:00 | 라이브 UI 700장 복부 CT 뷰어]
"의료진이 마주하는 실제 데스크톱 PACS 뷰어 화면입니다.
B병원 의사가 조회를 요청하면 5분 유효 단기 토큰이 발급되며, 700장에 달하는 초고해상도 복부 CT 슬라이스를 지연 없이 넘겨보며 간 병변 부위를 정밀하게 확인할 수 있습니다.
로컬 PC로의 무단 다운로드는 완벽히 차단되며, 5분이 지나면 토큰이 자동 만료되어 유출 위험이 없습니다." """)

    # =============================================================
    # SLIDE 9: LIVE UI - SECURITY AUDIT (08)
    # =============================================================
    s9 = prs.slides.add_slide(blank_layout)
    setup_content_slide(s9, 9, "08. LIVE SERVICE · SECURITY CONSOLE", "모든 접근을 불변 추적하는 통합 보안 관제 콘솔",
                        "토큰 발급, WAF 규칙 이벤트, Key Vault 서명, 비정상 접근 시도 실시간 모니터링")

    # Left: Audit Screenshot in Card
    add_card(s9, 108, 350, 960, 610, fill=C_WHITE, stroke=C_LINE, line_width=1.5)
    audit_img = os.path.join(ASSETS, "08_security_audit_console.png")
    if os.path.exists(audit_img):
        s9.shapes.add_picture(audit_img, px(128), px(370), width=px(920))

    # Right: Features
    add_card(s9, 1100, 350, 712, 610, fill=C_PALE, stroke=C_LINE, line_width=1.5)
    add_pill(s9, 1130, 380, 200, 42, "보안 관제실", fill=C_RED, color=C_WHITE, font_size=19)
    tb = s9.shapes.add_textbox(px(1350), px(378), px(440), px(45))
    tf = tb.text_frame
    p = tf.paragraphs[0]
    p.text = "불변 감사로그와 이상행위 탐지"
    p.font.name = FONT
    p.font.size = pt(25)
    p.font.bold = True
    p.font.color.rgb = C_INK

    pts_audit = [
        ("15대 주요 행위 전수 로깅", "로그인, 동의 생성, 토큰 발급, 프레임 조회, 접근 거부 등 실시간 기록"),
        ("사유 코드 기반 거부", "DOCTOR_HOSPITAL_MISMATCH 등 명확한 원인 추적"),
        ("감사 세션 체인 상관", "하나의 감사 세션 ID로 토큰 발급부터 PACS 조회까지 종단 추적"),
        ("실시간 이상행위 탐지", "단시간 대량 조회, 만료 토큰 반복 사용, 비진료 부서 접근 실시간 경보"),
        ("관리자 임의 삭제 금지", "감사로그 자체의 무결성을 보장하여 법적 증거력 확보")
    ]
    tb_pts9 = s9.shapes.add_textbox(px(1130), px(445), px(650), px(500))
    tf = tb_pts9.text_frame
    for title, desc in pts_audit:
        p = tf.add_paragraph()
        p.text = f"✔  {title}"
        p.font.name = FONT
        p.font.size = pt(21)
        p.font.bold = True
        p.font.color.rgb = C_RED
        p2 = tf.add_paragraph()
        p2.text = f"     {desc}"
        p2.font.name = FONT
        p2.font.size = pt(18)
        p2.font.color.rgb = C_INK
        p2.space_after = Pt(10)

    set_notes(s9, """[발표 04:00 ~ 04:30 | 라이브 UI 보안 관제 및 감사로그]
"의료 시스템에서 가장 중요한 '감사 가능성(Auditability)'을 입증하는 보안 관제 화면입니다.
누가, 언제, 어떤 동의를 근거로 영상을 조회했는지 모든 행위가 1초 단위로 불변 기록됩니다.
또한 허용되지 않은 병원이나 만료된 토큰으로 접근하려는 비정상 행위를 실시간으로 감지하고 차단합니다. 관리자조차 임의로 로그를 지울 수 없어 강력한 법적 증거력을 지닙니다." """)

    # =============================================================
    # SLIDE 10: EXPECTED OUTCOMES & CONCLUSION (09)
    # =============================================================
    s10 = prs.slides.add_slide(blank_layout)
    bg10 = s10.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, px(1920), px(1080))
    bg10.fill.solid()
    bg10.fill.fore_color.rgb = C_NAVY
    bg10.line.fill.background()

    # Title & Subtitle
    t_box10 = s10.shapes.add_textbox(px(108), px(120), px(1704), px(130))
    tf = t_box10.text_frame
    p = tf.paragraphs[0]
    p.text = "환자 동의로 열고, 증거와 감사로 닫는다"
    p.font.name = FONT
    p.font.size = pt(56)
    p.font.bold = True
    p.font.color.rgb = C_WHITE

    p2 = tf.add_paragraph()
    p2.text = "하이패스 MediQ가 만들어갈 안전하고 끊김 없는 차세대 의료 영상 생태계"
    p2.font.name = FONT
    p2.font.size = pt(28)
    p2.font.color.rgb = C_CYAN

    # 4 Cards
    benefits = [
        ("환자 (Patient)", ["CD 발급·운반 비용 0원화", "중복 CT/MRI 피폭 예방", "진료 대기시간 획기적 단축", "내 의료 데이터 주권 통제"]),
        ("의료진 (Clinician)", ["타 병원 검사 즉시 스트리밍", "진료 연속성 및 정확도 향상", "CD 등록 대기 없는 즉시 진료", "환자 상담 리허설로 효율화"]),
        ("병원·보안 (Hospital)", ["Zero Cloud Storage 유출 0", "ABAC 11단계 인가·단기토큰", "불변 감사로그 완벽한 증거력", "기존 PACS 인프라 유지 연동"]),
        ("사회·비전 (Society)", ["건강보험 재정 낭비 절감", "국가 의료정보 교류망 모델", "DICOMweb / FHIR 표준 선도", "환자 중심 디지털 헬스케어"])
    ]
    for i, (b_title, b_bullets) in enumerate(benefits):
        bx = 108 + i * 436
        c = add_card(s10, bx, 320, 396, 610, fill=C_INK, stroke=C_BLUE, line_width=2.0)
        add_pill(s10, bx + 25, 350, 160, 42, b_title.split(" ")[0], fill=C_BLUE, color=C_WHITE, font_size=20)
        
        tb = s10.shapes.add_textbox(px(bx + 25), px(415), px(346), px(50))
        tf = tb.text_frame
        p = tf.paragraphs[0]
        p.text = b_title
        p.font.name = FONT
        p.font.size = pt(25)
        p.font.bold = True
        p.font.color.rgb = C_WHITE

        # Rule
        r = s10.shapes.add_shape(MSO_SHAPE.RECTANGLE, px(bx + 25), px(480), px(346), px(2))
        r.fill.solid()
        r.fill.fore_color.rgb = C_BLUE
        r.line.fill.background()

        tb2 = s10.shapes.add_textbox(px(bx + 25), px(505), px(346), px(400))
        tf = tb2.text_frame
        for line in b_bullets:
            lp = tf.add_paragraph()
            lp.text = f"•  {line}"
            lp.font.name = FONT
            lp.font.size = pt(19)
            lp.font.color.rgb = RGBColor(220, 235, 252)
            lp.space_after = Pt(14)

    # Bottom footer rule & text
    r_ftr = s10.shapes.add_shape(MSO_SHAPE.RECTANGLE, px(108), px(1006), px(1704), px(2))
    r_ftr.fill.solid()
    r_ftr.fill.fore_color.rgb = C_BLUE
    r_ftr.line.fill.background()

    f_box = s10.shapes.add_textbox(px(108), px(1014), px(1704), px(31))
    tf = f_box.text_frame
    p = tf.paragraphs[0]
    p.text = "Medi Q  /  합성 데이터 · 비임상 기술 PoC  ·  10  /  10  ·  Q&A"
    p.font.name = FONT
    p.font.size = pt(17)
    p.font.color.rgb = C_MUTED
    p.alignment = PP_ALIGN.CENTER

    set_notes(s10, """[발표 04:30 ~ 05:00 | 마무리 및 결론]
"정리하겠습니다.
하이패스 MediQ는 환자에게는 CD 발급 비용과 방사선 피폭 위험을 없애주고, 의료진에게는 지체 없는 진료 연속성을 제공하며, 병원과 사회에는 의료 재정 절감과 완벽한 데이터 보안을 약속하는 실증 플랫폼입니다.
'환자 동의로 열고, 증거와 감사로 닫는다'는 확고한 원칙을 지키며 대한민국 의료 영상 교류의 새로운 지평을 열겠습니다.
경청해 주셔서 대단히 감사합니다." """)

    # Save identical pitch deck
    pitch_path = os.path.join(OUT_DIR, "Highpass_MediQ_Pitch_5min.pptx")
    prs.save(pitch_path)
    print("Identical design 5-min pitch deck saved to:", pitch_path)

    kakao_pitch = os.path.join(KAKAO_DIR, "Highpass_MediQ_Pitch_5min.pptx")
    shutil.copy2(pitch_path, kakao_pitch)
    print("Copied to Kakao folder:", kakao_pitch)


if __name__ == "__main__":
    build_identical_deck()
