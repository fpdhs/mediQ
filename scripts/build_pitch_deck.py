"""
Build both Presentation Decks:
1. docs/presentation/Highpass_MediQ_Pitch_5min.pptx (10 Slides with Live Screenshots & 5-min Presenter Script)
2. docs/presentation/Highpass_MediQ_Regular_15min.pptx (22 Slides based on MediQ base deck + enriched with 8 Screenshots & 15-min Presenter Script)
"""

import os
import shutil
import pptx
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# Paths
ROOT = r"C:\Users\user\Documents\New project"
ASSETS = os.path.join(ROOT, "docs", "assets", "images")
OUT_DIR = os.path.join(ROOT, "docs", "presentation")
KAKAO_DIR = r"C:\Users\user\Documents\카카오톡 받은 파일"
BASE_PPTX = os.path.join(KAKAO_DIR, "MediQ 중간발표_검토반영_구성도포함_20261014.pptx")

os.makedirs(OUT_DIR, exist_ok=True)

# Color Palette
NAVY = RGBColor(11, 27, 43)        # #0B1B2B
DARK_BLUE = RGBColor(15, 35, 66)   # #0F2342
PRIMARY = RGBColor(24, 78, 148)    # #184E94
CYAN = RGBColor(0, 150, 180)       # #0096B4
TEXT_INK = RGBColor(30, 41, 59)    # #1E293B
MUTED = RGBColor(100, 116, 139)    # #64748B
BG_PALE = RGBColor(248, 250, 252)  # #F8FAFC
CARD_BG = RGBColor(255, 255, 255)  # #FFFFFF
BORDER = RGBColor(226, 232, 240)   # #E2E8F0
GREEN = RGBColor(13, 148, 136)     # #0D9488
WHITE = RGBColor(255, 255, 255)

FONT_HEADING = "Malgun Gothic"
FONT_BODY = "Malgun Gothic"

# Helper for 5-min Pitch Deck
def create_pitch_deck():
    prs = pptx.Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    def add_header(slide, step_num, title_text, category="CAPSTONE MVP · HIGHPASS MEDIQ"):
        # Category tag
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.5), Inches(0.35))
        tf = cat_box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
        p = tf.paragraphs[0]
        p.text = f"{category}  |  SLIDE {step_num}/10"
        p.font.name = FONT_HEADING
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = CYAN

        # Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.75), Inches(11.5), Inches(0.6))
        tf = title_box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
        p = tf.paragraphs[0]
        p.text = title_text
        p.font.name = FONT_HEADING
        p.font.size = Pt(20)
        p.font.bold = True
        p.font.color.rgb = DARK_BLUE

        # Line separator
        line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(1.35), Inches(11.733), Inches(0.02))
        line.fill.solid()
        line.fill.fore_color.rgb = BORDER
        line.line.color.rgb = BORDER

    def set_notes(slide, script_text):
        notes = slide.notes_slide.notes_text_frame
        notes.text = script_text

    # -------------------------------------------------------------
    # SLIDE 1: COVER
    # -------------------------------------------------------------
    s1 = prs.slides.add_slide(blank_layout)
    bg = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
    bg.fill.solid()
    bg.fill.fore_color.rgb = NAVY
    bg.line.fill.background()

    # Pill
    pill = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.2), Inches(1.2), Inches(4.5), Inches(0.45))
    pill.fill.solid()
    pill.fill.fore_color.rgb = CYAN
    pill.line.fill.background()
    p = pill.text_frame.paragraphs[0]
    p.text = "CAPSTONE MVP  ·  SECURITY BY DESIGN"
    p.font.name = FONT_HEADING
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = WHITE
    p.alignment = PP_ALIGN.CENTER

    # Title
    t_box = s1.shapes.add_textbox(Inches(1.2), Inches(1.9), Inches(11), Inches(1.8))
    tf = t_box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "mediQ / 하이패스 플랫폼"
    p.font.name = FONT_HEADING
    p.font.size = Pt(40)
    p.font.bold = True
    p.font.color.rgb = WHITE

    p2 = tf.add_paragraph()
    p2.text = "환자 동의 기반 클라우드 의료영상 교류 및 비임상 AI 건강도우미"
    p2.font.name = FONT_BODY
    p2.font.size = Pt(20)
    p2.font.color.rgb = RGBColor(186, 215, 248)

    # 3 Summary Cards
    metrics = [
        ("Zero Cloud Storage", "클라우드 원본 비보관\n각 병원 PACS 분산 유지"),
        ("ABAC 11단계 인가", "Fail-Closed 정책 엔진\n5~10분 유효 단기 토큰"),
        ("700 Slices CT 스트리밍", "WADO-RS 무지연 뷰어\n로컬 무단 다운로드 차단")
    ]
    for i, (m_title, m_desc) in enumerate(metrics):
        card = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.2 + i * 3.75), Inches(4.2), Inches(3.5), Inches(1.6))
        card.fill.solid()
        card.fill.fore_color.rgb = DARK_BLUE
        card.line.color.rgb = CYAN
        card.line.width = Pt(1.5)
        tf = card.text_frame
        p = tf.paragraphs[0]
        p.text = m_title
        p.font.name = FONT_HEADING
        p.font.size = Pt(15)
        p.font.bold = True
        p.font.color.rgb = CYAN
        p2 = tf.add_paragraph()
        p2.text = m_desc
        p2.font.name = FONT_BODY
        p2.font.size = Pt(12)
        p2.font.color.rgb = RGBColor(220, 230, 242)

    # Footer
    f_box = s1.shapes.add_textbox(Inches(1.2), Inches(6.4), Inches(11), Inches(0.5))
    tf = f_box.text_frame
    p = tf.paragraphs[0]
    p.text = "합성 데이터 기반 기술 PoC  ·  발표자: 하이패스 프로젝트팀  ·  https://highpass-demo.japaneast.cloudapp.azure.com/"
    p.font.name = FONT_BODY
    p.font.size = Pt(11)
    p.font.color.rgb = MUTED

    set_notes(s1, """[발표 00:00 ~ 00:30 | 도입 및 정체성 소개]
"안녕하십니까. 환자 동의 기반 클라우드 의료영상 교류 및 비임상 AI 건강도우미 플랫폼, '하이패스 MediQ'의 발표를 맡은 [발표자 이름]입니다.
저희 프로젝트는 기존 병원 간 의료영상 이동 방식인 'CD 발급과 재촬영'의 고질적인 비효율과 방사선 피폭 문제를 해결하기 위해 기획되었습니다.
클라우드에 원본 영상을 저장하지 않는 'Zero Cloud Storage' 원칙과 11단계 ABAC 인가, 그리고 700장 복부 CT 무지연 스트리밍을 실제로 구현하고 검증한 성과를 지금부터 5분간 핵심 위주로 발표해 드리겠습니다." """)

    # -------------------------------------------------------------
    # SLIDE 2: PROBLEM
    # -------------------------------------------------------------
    s2 = prs.slides.add_slide(blank_layout)
    add_header(s2, "02", "CD 발급과 운반의 한계: 단절된 진료와 불필요한 방사선 피폭")

    prob_cards = [
        ("01. 행정 및 비용 낭비", "CD 발급과 대기 시간의 굴레", 
         ["환자가 직접 수수료를 내고 CD 발급 대기", "물리적 CD를 들고 타 병원으로 이동", "타 병원 등록실에서 재등록 대기 소요", "연간 수백만 건의 불필요한 행정 비용 발생"]),
        ("02. 불필요한 중복 피폭", "CD 판독 불가 및 재촬영 문제", 
         ["CD 손상, 포맷 불일치, 뷰어 미호환 빈번", "이전 병원 영상 확인 실패로 CT/MRI 재촬영", "환자에게 불필요한 방사선 피폭 누적", "진료 연속성 단절 및 치료 결정 지연"]),
        ("03. 환자 주권 부재", "의료 데이터 통제권의 부재", 
         ["내 영상이 누구에게 전달되는지 추적 불가", "열람 기간이나 목적을 환자가 제한할 수 없음", "발급 후에는 권한 회수나 철회가 불가능", "진료 전 검사 의미를 알지 못해 환자 불안 가중"])
    ]
    for i, (p_tag, p_head, p_bullets) in enumerate(prob_cards):
        box = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8 + i * 3.95), Inches(1.7), Inches(3.75), Inches(5.1))
        box.fill.solid()
        box.fill.fore_color.rgb = BG_PALE
        box.line.color.rgb = BORDER
        box.line.width = Pt(1)
        tf = box.text_frame
        tf.margin_top = Inches(0.3)
        tf.margin_left = Inches(0.3)
        tf.margin_right = Inches(0.3)
        
        p = tf.paragraphs[0]
        p.text = p_tag
        p.font.name = FONT_HEADING
        p.font.size = Pt(13)
        p.font.bold = True
        p.font.color.rgb = PRIMARY
        
        p2 = tf.add_paragraph()
        p2.text = p_head
        p2.font.name = FONT_HEADING
        p2.font.size = Pt(15)
        p2.font.bold = True
        p2.font.color.rgb = DARK_BLUE
        
        sep = tf.add_paragraph()
        sep.text = " "
        sep.font.size = Pt(6)
        
        for bullet in p_bullets:
            bp = tf.add_paragraph()
            bp.text = f"•  {bullet}"
            bp.font.name = FONT_BODY
            bp.font.size = Pt(12)
            bp.font.color.rgb = TEXT_INK

    set_notes(s2, """[발표 00:30 ~ 01:00 | 청중 공감 및 문제 정의]
"여러분, 대학병원에서 CT나 MRI를 찍고 다른 병원으로 진료를 보러 갈 때, 여전히 환자가 직접 CD를 가방에 넣고 들고 다녀야 한다는 사실을 알고 계십니까?
이 구시대적 방식 때문에 환자는 불필요한 발급 수수료와 번호표 대기 시간을 겪습니다. 더 심각한 것은 타 병원에 갔을 때 CD 포맷이 안 맞거나 손상되어 어쩔 수 없이 CT/MRI를 다시 촬영하게 되면서 불필요한 방사선 피폭에 노출된다는 점입니다.
또한, 내 소중한 의료 정보임에도 어디로 흘러가는지, 누구에게 보여줄지 환자 스스로 제어하거나 회수할 권리가 완전히 배제되어 있었습니다." """)

    # -------------------------------------------------------------
    # SLIDE 3: SOLUTION
    # -------------------------------------------------------------
    s3 = prs.slides.add_slide(blank_layout)
    add_header(s3, "03", "환자가 중심이 되는 다이렉트 의료영상 공유 패러다임")

    # Before vs After layout
    # Top box: Traditional
    b_box = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.7), Inches(11.733), Inches(2.2))
    b_box.fill.solid()
    b_box.fill.fore_color.rgb = RGBColor(254, 242, 242)
    b_box.line.color.rgb = RGBColor(254, 202, 202)
    tf = b_box.text_frame
    tf.margin_left = Inches(0.4)
    tf.margin_top = Inches(0.25)
    p = tf.paragraphs[0]
    p.text = "기존 방식 (Traditional Flow) : 매체 중심의 물리적 운반"
    p.font.name = FONT_HEADING
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = RGBColor(185, 28, 28)
    p2 = tf.add_paragraph()
    p2.text = "A병원 방문 및 검사  ➔  CD 발급비 지불·대기  ➔  환자가 CD 직접 운반  ➔  B병원 등록 대기  ➔  포맷 오류 시 재촬영 피폭"
    p2.font.name = FONT_BODY
    p2.font.size = Pt(13)
    p2.font.color.rgb = TEXT_INK

    # Bottom box: MediQ Hi-Pass
    a_box = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(4.2), Inches(11.733), Inches(2.6))
    a_box.fill.solid()
    a_box.fill.fore_color.rgb = RGBColor(240, 253, 250)
    a_box.line.color.rgb = RGBColor(153, 246, 228)
    tf = a_box.text_frame
    tf.margin_left = Inches(0.4)
    tf.margin_top = Inches(0.25)
    p = tf.paragraphs[0]
    p.text = "하이패스 솔루션 (MediQ Hi-Pass Flow) : 환자 동의 기반 다이렉트 스트리밍"
    p.font.name = FONT_HEADING
    p.font.size = Pt(15)
    p.font.bold = True
    p.font.color.rgb = GREEN
    p2 = tf.add_paragraph()
    p2.text = "환자 스마트폰 동의 생성  ➔  ABAC 11단계 자동 검증  ➔  5분 단기 토큰 발급  ➔  A병원 PACS에서 B병원 뷰어로 직통 스트리밍"
    p2.font.name = FONT_BODY
    p2.font.size = Pt(14)
    p2.font.bold = True
    p2.font.color.rgb = DARK_BLUE
    
    p3 = tf.add_paragraph()
    p3.text = "\n1. CD 발급·운반 비용 0원  |  2. 중복 방사선 검사 방지  |  3. 환자 주도적 권한 철회  |  4. AI 건강도우미 검사 안내"
    p3.font.name = FONT_BODY
    p3.font.size = Pt(12)
    p3.font.color.rgb = TEXT_INK

    set_notes(s3, """[발표 01:00 ~ 01:30 | 솔루션 패러다임 전환]
"하이패스 MediQ는 이 불편한 매체 전달 방식을 완전히 디지털 혁신합니다.
환자가 스마트폰 웹에서 B대학병원, 진료 목적, 유효기간, 그리고 허용할 CT 검사만을 콕 집어 명시적 동의를 생성합니다.
수신 병원 의사가 접근을 요청하면, 서버가 즉시 11단계 보안 조건을 검증한 뒤 5분 유효 단기 토큰을 서명 발급합니다.
이 토큰을 통해 원본 병원 PACS로부터 필요한 DICOM 영상만을 웹 뷰어로 실시간 스트리밍합니다.
CD를 들고 다닐 필요도 없고, 불필요한 재촬영도 막으며, 언제든 동의를 철회할 수 있는 진정한 환자 중심 서비스입니다." """)

    # -------------------------------------------------------------
    # SLIDE 4: ARCHITECTURE
    # -------------------------------------------------------------
    s4 = prs.slides.add_slide(blank_layout)
    add_header(s4, "04", "Control Plane과 Data Plane의 완전한 물리적 분리 (Zero Cloud Storage)")

    # Architecture image on left
    arch_img_path = os.path.join(ASSETS, "highpass_architecture_full.png")
    if os.path.exists(arch_img_path):
        s4.shapes.add_picture(arch_img_path, Inches(0.8), Inches(1.7), width=Inches(6.2))

    # Right explanation cards
    r_cards = [
        ("Zero Cloud Storage (불변 원칙)", "의료영상 원본은 각 병원 PACS(Orthanc)에만 보관하며, 중앙 클라우드 DB에는 DICOM 원본을 절대 지속 저장하지 않습니다."),
        ("Control vs Data Plane 물리적 분리", "Azure Control Plane은 환자 동의, ABAC 인가, 단기 토큰 발급, 감사로그만을 담당하며, 영상 픽셀 데이터는 경유하지 않습니다."),
        ("필요 최소 전송 (Lazy Loading)", "전체 Study를 무차별 다운로드하지 않고, WADO-RS 표준 기반으로 Study ➔ Series ➔ Instance 프레임 단위로 필요한 만큼만 전송합니다.")
    ]
    for i, (rc_title, rc_body) in enumerate(r_cards):
        c = s4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(7.3), Inches(1.7 + i * 1.7), Inches(5.2), Inches(1.5))
        c.fill.solid()
        c.fill.fore_color.rgb = BG_PALE
        c.line.color.rgb = BORDER
        tf = c.text_frame
        tf.margin_left = Inches(0.25)
        tf.margin_top = Inches(0.2)
        p = tf.paragraphs[0]
        p.text = rc_title
        p.font.name = FONT_HEADING
        p.font.size = Pt(13)
        p.font.bold = True
        p.font.color.rgb = PRIMARY
        p2 = tf.add_paragraph()
        p2.text = rc_body
        p2.font.name = FONT_BODY
        p2.font.size = Pt(11)
        p2.font.color.rgb = TEXT_INK

    set_notes(s4, """[발표 01:30 ~ 02:00 | 시스템 아키텍처 및 보안 불변식]
"저희 아키텍처의 절대 원칙은 'Zero Cloud Storage'입니다.
민감한 환자 의료영상이 클라우드 중앙에 영구 보관되면 대규모 해킹이나 유출의 표적이 됩니다.
따라서 원본 영상은 각 병원 로컬 온프레미스 PACS에 그대로 머무르고, 클라우드 Control Plane은 오직 동의와 권한, 감사로그만 관리합니다.
의사가 영상을 볼 때만 단기 토큰으로 병원 게이트웨이와 직접 통신하여 프레임 단위로 Lazy Loading 스트리밍합니다. 의료법과 개인정보보호법 가이드라인을 완벽하게 만족하는 구조입니다." """)

    # -------------------------------------------------------------
    # SLIDE 5: SECURITY & AI GUARDRAILS
    # -------------------------------------------------------------
    s5 = prs.slides.add_slide(blank_layout)
    add_header(s5, "05", "11단계 교집합 정책 검증과 비임상 AI 안전 가드레일")

    # Left card: ABAC 11
    c1 = s5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.7), Inches(5.7), Inches(5.1))
    c1.fill.solid()
    c1.fill.fore_color.rgb = BG_PALE
    c1.line.color.rgb = BORDER
    tf = c1.text_frame
    tf.margin_left = tf.margin_top = Inches(0.3)
    p = tf.paragraphs[0]
    p.text = "11-Factor Fail-Closed ABAC Gate"
    p.font.name = FONT_HEADING
    p.font.size = Pt(15)
    p.font.bold = True
    p.font.color.rgb = PRIMARY
    p2 = tf.add_paragraph()
    p2.text = "단순한 역할(Role) 확인이 아닌 11대 조건 교집합 전수 검증\n단 하나라도 실패 시 즉시 접근 차단 (Fail-Closed):"
    p2.font.name = FONT_BODY
    p2.font.size = Pt(11)
    p2.font.color.rgb = TEXT_INK

    abac_factors = [
        "1. consentId 유효성 확인", "2. 동의 상태 ACTIVE 여부",
        "3. 현재 시각이 validFrom/Until 내인가", "4. 요청 병원 == 동의된 수신 병원",
        "5. 요청 의사 소속 병원 일치", "6. 요청 Study UID 허용 범위",
        "7. 요청 Series UID 허용 범위", "8. 요청 목적 == 동의 목적",
        "9. VIEW_ONLY vs DOWNLOAD 권한", "10. 단기 토큰 유효시간(5분)",
        "11. 토큰 범위 및 HMAC 무결성 서명"
    ]
    for factor in abac_factors:
        bp = tf.add_paragraph()
        bp.text = f"•  {factor}"
        bp.font.name = FONT_BODY
        bp.font.size = Pt(10)
        bp.font.color.rgb = DARK_BLUE

    # Right card: 2-Layer RAG
    c2 = s5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), Inches(1.7), Inches(5.7), Inches(5.1))
    c2.fill.solid()
    c2.fill.fore_color.rgb = BG_PALE
    c2.line.color.rgb = BORDER
    tf = c2.text_frame
    tf.margin_left = tf.margin_top = Inches(0.3)
    p = tf.paragraphs[0]
    p.text = "2-Layer Non-Clinical AI Guardrail"
    p.font.name = FONT_HEADING
    p.font.size = Pt(15)
    p.font.bold = True
    p.font.color.rgb = GREEN
    p2 = tf.add_paragraph()
    p2.text = "환자 안전을 최우선으로 하는 비임상 질의응답 아키텍처\n의료 진단이나 처방 행위를 원천 차단:"
    p2.font.name = FONT_BODY
    p2.font.size = Pt(11)
    p2.font.color.rgb = TEXT_INK

    rag_factors = [
        "공인 코퍼스: MedlinePlus 및 간학회 1,019개 토픽 연계",
        "자모 분해 전처리: 한국어 음운 조사(은/는/이/가/이란) 정밀 분리",
        "2-Layer 분류: 1차 토픽 감지 ➔ 2차 질문 의도(개념/원인/주의) 매핑",
        "의도 부재 시 기본값: 표제어 단독 입력 시 안전한 DEFINITION 반환",
        "진단/처방 차단: 약물 용량, 확진 판단 질의 즉시 안전 안내문 전환",
        "의사 상담 리허설: 진료실에서 주치의에게 물어볼 맞춤 질문 카드 자동 생성"
    ]
    for rf in rag_factors:
        bp = tf.add_paragraph()
        bp.text = f"•  {rf}"
        bp.font.name = FONT_BODY
        bp.font.size = Pt(10.5)
        bp.font.color.rgb = DARK_BLUE

    set_notes(s5, """[발표 02:00 ~ 02:30 | 보안 인가 엔진 및 AI 안전성]
"보안은 단 하나의 구멍도 허용하지 않습니다.
저희 ABAC 게이트는 환자 동의, 시간, 의사 소속, 검사 UID 등 11개 조건을 교집합으로 검증하며, 하나라도 어긋나면 접근을 차단하고 감사로그를 남깁니다.
또한 함께 탑재된 AI 건강도우미는 미국 MedlinePlus 공인 코퍼스 기반으로 구동되며, 2-Layer 형태소 및 의도 분류기를 통해 진단이나 처방성 질문을 완벽히 차단하고, 환자가 검사 결과를 쉽게 이해하고 의사에게 무엇을 물어볼지 준비하는 안전한 비임상 보조 도구로 엄격히 제한됩니다." """)

    # -------------------------------------------------------------
    # SLIDE 6: LIVE UI - PATIENT WALLET
    # -------------------------------------------------------------
    s6 = prs.slides.add_slide(blank_layout)
    add_header(s6, "06", "서비스 화면 ① 역할별 진입 게이트와 환자 동의 지갑 (Live UI)")

    wallet_img = os.path.join(ASSETS, "06_patient_consent_wallet.png")
    if os.path.exists(wallet_img):
        s6.shapes.add_picture(wallet_img, Inches(0.8), Inches(1.7), width=Inches(6.4))

    # Right info
    r_box = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(7.5), Inches(1.7), Inches(5.0), Inches(5.1))
    r_box.fill.solid()
    r_box.fill.fore_color.rgb = BG_PALE
    r_box.line.color.rgb = BORDER
    tf = r_box.text_frame
    tf.margin_left = tf.margin_top = Inches(0.3)
    p = tf.paragraphs[0]
    p.text = "환자 중심의 공유 범위 지정"
    p.font.name = FONT_HEADING
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = DARK_BLUE

    pts = [
        ("4대 역할 게이트 분리", "환자, 의료진, 병원 관리자, 보안 운영자 전용 로그인 화면 제공"),
        ("수신 병원 선택", "A대학병원에서 B대학병원으로 공유 대상 병원 명확히 지정"),
        ("열람 목적 및 기간", "진료 목적으로 한정, 1일~30일 사이 유효기간 설정"),
        ("검사 단위 선택", "전체 진료기록이 아닌, 필요한 특정 복부 CT Study/Series만 선택"),
        ("원클릭 동의 철회", "언제든 환자가 원할 때 즉시 권한을 파기하는 Revoke 지원")
    ]
    for title, desc in pts:
        p_t = tf.add_paragraph()
        p_t.text = f"✔  {title}"
        p_t.font.name = FONT_HEADING
        p_t.font.size = Pt(12)
        p_t.font.bold = True
        p_t.font.color.rgb = PRIMARY
        p_d = tf.add_paragraph()
        p_d.text = f"    {desc}"
        p_d.font.name = FONT_BODY
        p_d.font.size = Pt(11)
        p_d.font.color.rgb = TEXT_INK

    set_notes(s6, """[발표 02:30 ~ 03:00 | 라이브 UI 환자 동의 지갑]
"실제 클라우드에 배포된 화면입니다.
좌측은 환자가 접속하는 '의료 공유 지갑' 화면입니다. 환자는 수신할 B대학병원과 진료 목적, 유효기간을 설정하고, 본인이 공유하고 싶은 복부 CT 검사를 직접 선택합니다.
전체 진료기록을 무차별 공유하는 것이 아니라 필요한 검사만 선별 공유하며, 환자가 원하면 언제든 1초 만에 권한을 파기하는 '동의 철회'가 가능합니다." """)

    # -------------------------------------------------------------
    # SLIDE 7: LIVE UI - HEALTH HELPER
    # -------------------------------------------------------------
    s7 = prs.slides.add_slide(blank_layout)
    add_header(s7, "07", "서비스 화면 ② 어려운 검사 결과를 눈높이 설명으로: AI 건강도우미 (Live UI)")

    rag_img = os.path.join(ASSETS, "05_health_helper_rag.png")
    if os.path.exists(rag_img):
        s7.shapes.add_picture(rag_img, Inches(0.8), Inches(1.7), width=Inches(5.0))

    r_box2 = s7.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.1), Inches(1.7), Inches(6.4), Inches(5.1))
    r_box2.fill.solid()
    r_box2.fill.fore_color.rgb = BG_PALE
    r_box2.line.color.rgb = BORDER
    tf = r_box2.text_frame
    tf.margin_left = tf.margin_top = Inches(0.3)
    p = tf.paragraphs[0]
    p.text = "혈청 알파태아단백(AFP) 검사 질의응답 연동"
    p.font.name = FONT_HEADING
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = DARK_BLUE

    pts2 = [
        ("쉬운 의학 개념 해설", "AFP 정상 수치와 간암/간경화 선별검사 목적을 비임상 환자 언어로 해설"),
        ("추천 질문 스튜디오", "'AFP 검사가 뭔가요?', '초음파와 차이점', '주의사항' 등 원클릭 퀵 질의"),
        ("의사 상담 리허설 박스", "진료실에서 주치의에게 물어봐야 할 맞춤 질문 3가지를 자동 정리"),
        ("공인 학술 출처 투명 표기", "MedlinePlus 및 간학회 가이드라인 출처 링크를 명확히 제시하여 신뢰 확보"),
        ("한국어 형태소 전처리", "체언과 조사를 분리하여 'AFP란', '초음파에 대해서' 등 구어체 질문 완벽 처리")
    ]
    for title, desc in pts2:
        p_t = tf.add_paragraph()
        p_t.text = f"✔  {title}"
        p_t.font.name = FONT_HEADING
        p_t.font.size = Pt(12)
        p_t.font.bold = True
        p_t.font.color.rgb = GREEN
        p_d = tf.add_paragraph()
        p_d.text = f"    {desc}"
        p_d.font.name = FONT_BODY
        p_d.font.size = Pt(11)
        p_d.font.color.rgb = TEXT_INK

    set_notes(s7, """[발표 03:00 ~ 03:30 | 라이브 UI AI 건강도우미]
"환자가 검사 결과지에 적힌 어려운 의학 용어를 마주했을 때의 불안을 해소하는 'AI 건강도우미' 화면입니다.
혈청 알파태아단백(AFP)이나 간경화 같은 질환에 대해 질문하면, 정상 수치와 검사 목적을 환자 눈높이로 설명합니다.
특히 우측 하단의 '의사 상담 리허설 박스'는 진료실에서 의사에게 무엇을 물어봐야 할지 핵심 질문을 미리 정리해 주어 진료의 질을 크게 높여줍니다." """)

    # -------------------------------------------------------------
    # SLIDE 8: LIVE UI - CLINICIAN CT VIEWER
    # -------------------------------------------------------------
    s8 = prs.slides.add_slide(blank_layout)
    add_header(s8, "08", "서비스 화면 ③ 5분 단기 토큰 기반 700 Slices 복부 CT 뷰어 (Live UI)")

    viewer_img = os.path.join(ASSETS, "07_clinician_dicom_viewer.png")
    if os.path.exists(viewer_img):
        s8.shapes.add_picture(viewer_img, Inches(0.8), Inches(1.7), width=Inches(6.8))

    r_box3 = s8.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(7.9), Inches(1.7), Inches(4.6), Inches(5.1))
    r_box3.fill.solid()
    r_box3.fill.fore_color.rgb = BG_PALE
    r_box3.line.color.rgb = BORDER
    tf = r_box3.text_frame
    tf.margin_left = tf.margin_top = Inches(0.3)
    p = tf.paragraphs[0]
    p.text = "700 Slices 대용량 무지연 렌더링"
    p.font.name = FONT_HEADING
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = DARK_BLUE

    pts3 = [
        ("WADO-RS 스트리밍", "700장 대용량 CT를 다운로드 없이 프레임 단위 초고속 렌더링"),
        ("정밀 판독 도구", "간 병변 십자선, 다중 단면 연속 스크롤, 윈도우 레벨링, 시리즈 썸네일"),
        ("5분 단기 서명 토큰", "시간 경과 시 세션 자동 만료로 장기 토큰 탈취 위험 원천 차단"),
        ("로컬 다운로드 금지", "의료진 PC에 원본 DICOM 파일 무단 저장을 엄격히 차단"),
        ("DICOMweb 표준 준수", "QIDO-RS / WADO-RS 표준으로 기존 병원 PACS와 완벽 호환")
    ]
    for title, desc in pts3:
        p_t = tf.add_paragraph()
        p_t.text = f"✔  {title}"
        p_t.font.name = FONT_HEADING
        p_t.font.size = Pt(12)
        p_t.font.bold = True
        p_t.font.color.rgb = PRIMARY
        p_d = tf.add_paragraph()
        p_d.text = f"    {desc}"
        p_d.font.name = FONT_BODY
        p_d.font.size = Pt(11)
        p_d.font.color.rgb = TEXT_INK

    set_notes(s8, """[발표 03:30 ~ 04:00 | 라이브 UI 700장 복부 CT 뷰어]
"의료진이 마주하는 실제 데스크톱 PACS 뷰어 화면입니다.
B병원 의사가 조회를 요청하면 5분 유효 단기 토큰이 발급되며, 700장에 달하는 초고해상도 복부 CT 슬라이스를 지연 없이 넘겨보며 간 병변 부위를 정밀하게 확인할 수 있습니다.
로컬 PC로의 무단 다운로드는 완벽히 차단되며, 5분이 지나면 토큰이 자동 만료되어 유출 위험이 없습니다." """)

    # -------------------------------------------------------------
    # SLIDE 9: LIVE UI - SECURITY AUDIT
    # -------------------------------------------------------------
    s9 = prs.slides.add_slide(blank_layout)
    add_header(s9, "09", "서비스 화면 ④ 모든 접근을 불변 추적하는 보안 관제 콘솔 (Live UI)")

    audit_img = os.path.join(ASSETS, "08_security_audit_console.png")
    if os.path.exists(audit_img):
        s9.shapes.add_picture(audit_img, Inches(0.8), Inches(1.7), width=Inches(6.4))

    r_box4 = s9.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(7.5), Inches(1.7), Inches(5.0), Inches(5.1))
    r_box4.fill.solid()
    r_box4.fill.fore_color.rgb = BG_PALE
    r_box4.line.color.rgb = BORDER
    tf = r_box4.text_frame
    tf.margin_left = tf.margin_top = Inches(0.3)
    p = tf.paragraphs[0]
    p.text = "불변 감사로그와 이상행위 탐지"
    p.font.name = FONT_HEADING
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = DARK_BLUE

    pts4 = [
        ("15대 주요 행위 전수 로깅", "로그인, 동의 생성, 토큰 발급, 프레임 조회, 접근 거부 등 실시간 기록"),
        ("사유 코드 기반 거부", "단순 거부가 아닌 DOCTOR_HOSPITAL_MISMATCH 등 명확한 원인 추적"),
        ("감사 세션 체인 상관", "하나의 감사 세션 ID로 토큰 발급부터 PACS 조회까지 종단 추적"),
        ("실시간 이상행위 탐지", "단시간 대량 조회, 만료 토큰 반복 사용, 비진료 부서 접근 실시간 경보"),
        ("관리자 임의 삭제 금지", "감사로그 자체의 무결성을 보장하여 법적 증거력 확보")
    ]
    for title, desc in pts4:
        p_t = tf.add_paragraph()
        p_t.text = f"✔  {title}"
        p_t.font.name = FONT_HEADING
        p_t.font.size = Pt(12)
        p_t.font.bold = True
        p_t.font.color.rgb = RGBColor(198, 74, 74)
        p_d = tf.add_paragraph()
        p_d.text = f"    {desc}"
        p_d.font.name = FONT_BODY
        p_d.font.size = Pt(11)
        p_d.font.color.rgb = TEXT_INK

    set_notes(s9, """[발표 04:00 ~ 04:30 | 라이브 UI 보안 관제 및 감사로그]
"의료 시스템에서 가장 중요한 '감사 가능성(Auditability)'을 입증하는 보안 관제 화면입니다.
누가, 언제, 어떤 동의를 근거로 영상을 조회했는지 모든 행위가 1초 단위로 불변 기록됩니다.
또한 허용되지 않은 병원이나 만료된 토큰으로 접근하려는 비정상 행위를 실시간으로 감지하고 차단합니다. 관리자조차 임의로 로그를 지울 수 없어 강력한 법적 증거력을 지닙니다." """)

    # -------------------------------------------------------------
    # SLIDE 10: EXPECTED OUTCOMES & CONCLUSION
    # -------------------------------------------------------------
    s10 = prs.slides.add_slide(blank_layout)
    bg10 = s10.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
    bg10.fill.solid()
    bg10.fill.fore_color.rgb = NAVY
    bg10.line.fill.background()

    # Title
    t_box10 = s10.shapes.add_textbox(Inches(0.8), Inches(0.8), Inches(11.733), Inches(1.2))
    tf10 = t_box10.text_frame
    p = tf10.paragraphs[0]
    p.text = "환자 동의로 열고, 증거와 감사로 닫는다"
    p.font.name = FONT_HEADING
    p.font.size = Pt(32)
    p.font.bold = True
    p.font.color.rgb = WHITE
    p2 = tf10.add_paragraph()
    p2.text = "하이패스 MediQ가 만들어갈 안전하고 끊김 없는 차세대 의료 영상 생태계"
    p2.font.name = FONT_BODY
    p2.font.size = Pt(16)
    p2.font.color.rgb = CYAN

    # 4 Benefit Cards
    benefits = [
        ("환자 (Patient)", "CD 발급·운반 비용 0원화\n불필요한 CT/MRI 중복 피폭 예방\n진료 대기시간 획기적 단축\n내 의료 데이터 주권 직접 통제"),
        ("의료진 (Clinician)", "타 병원 이전 검사 즉시 스트리밍\n진료 연속성 및 진단 정확도 향상\nCD 등록 대기 없는 즉시 진료\n환자 상담 리허설로 진료 효율화"),
        ("병원 & 보안 (Hospital)", "Zero Cloud Storage로 유출 위험 0\nABAC 11단계 인가 및 단기 토큰\n완벽한 불변 감사로그 법적 보호\n기존 PACS 인프라 변경 없이 연동"),
        ("사회 & 비전 (Society)", "불필요한 건강보험 재정 낭비 절감\n국가 의료 교류망 표준 모델 제시\nDICOMweb / FHIR 글로벌 호환\n환자 중심 디지털 헬스케어 구현")
    ]
    for i, (b_title, b_desc) in enumerate(benefits):
        bc = s10.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8 + i * 2.98), Inches(2.3), Inches(2.8), Inches(4.3))
        bc.fill.solid()
        bc.fill.fore_color.rgb = DARK_BLUE
        bc.line.color.rgb = CYAN
        bc.line.width = Pt(1.5)
        tf = bc.text_frame
        tf.margin_left = tf.margin_top = Inches(0.25)
        p = tf.paragraphs[0]
        p.text = b_title
        p.font.name = FONT_HEADING
        p.font.size = Pt(16)
        p.font.bold = True
        p.font.color.rgb = CYAN
        
        sep = tf.add_paragraph()
        sep.text = " "
        sep.font.size = Pt(6)
        
        for line in b_desc.split("\n"):
            lp = tf.add_paragraph()
            lp.text = f"• {line}"
            lp.font.name = FONT_BODY
            lp.font.size = Pt(12)
            lp.font.color.rgb = WHITE

    set_notes(s10, """[발표 04:30 ~ 05:00 | 마무리 및 결론]
"정리하겠습니다.
하이패스 MediQ는 환자에게는 CD 발급 비용과 방사선 피폭 위험을 없애주고, 의료진에게는 지체 없는 진료 연속성을 제공하며, 병원과 사회에는 의료 재정 절감과 완벽한 데이터 보안을 약속하는 실증 플랫폼입니다.
'환자 동의로 열고, 증거와 감사로 닫는다'는 확고한 원칙을 지키며 대한민국 의료 영상 교류의 새로운 지평을 열겠습니다.
경청해 주셔서 대단히 감사합니다." """)

    # Save
    pitch_path = os.path.join(OUT_DIR, "Highpass_MediQ_Pitch_5min.pptx")
    prs.save(pitch_path)
    print("Pitch deck saved:", pitch_path)
    
    # Copy to Kakao folder
    shutil.copy2(pitch_path, os.path.join(KAKAO_DIR, "Highpass_MediQ_Pitch_5min.pptx"))
    print("Copied to Kakao folder:", os.path.join(KAKAO_DIR, "Highpass_MediQ_Pitch_5min.pptx"))


if __name__ == "__main__":
    create_pitch_deck()
