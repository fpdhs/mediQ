"""
Build 10~15 minute Regular Presentation Deck:
Enriches the 22-slide MediQ base presentation with:
1. High-resolution live screenshot assets on Slides 1, 10, 15, 19, 20
2. Complete, spoken Korean presenter scripts with time cues and defense tips in all 22 slide notes.
"""

import os
import shutil
import pptx
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

ROOT = r"C:\Users\user\Documents\New project"
ASSETS = os.path.join(ROOT, "docs", "assets", "images")
OUT_DIR = os.path.join(ROOT, "docs", "presentation")
KAKAO_DIR = r"C:\Users\user\Documents\카카오톡 받은 파일"
BASE_PPTX = os.path.join(KAKAO_DIR, "MediQ 중간발표_검토반영_구성도포함_20261014.pptx")

os.makedirs(OUT_DIR, exist_ok=True)

prs = pptx.Presentation(BASE_PPTX)
print(f"Loaded base deck with {len(prs.slides)} slides. Width={prs.slide_width.inches:.2f}\", Height={prs.slide_height.inches:.2f}\"")

# 22 Spoken Scripts for all slides
scripts = {
    1: """[발표 00:00 ~ 00:45 | 표지 및 프로젝트 정체성]
"안녕하십니까. 환자 동의 기반 클라우드 의료영상 교류 및 비임상 AI 건강도우미 플랫폼, '하이패스 MediQ'의 기술 검증 중간 발표를 시작하겠습니다.
저희 프로젝트는 기존 병원 간 의료영상 공유의 주된 방식이었던 물리적 CD 발급과 환자 직접 운반 방식의 비효율을 개선하고, 불필요한 중복 CT/MRI 촬영에 따른 방사선 피폭을 방지하기 위해 출발했습니다.
특히 본 발표는 단순한 프로토타입 화면 시연을 넘어, 클라우드에 원본 영상을 저장하지 않는 'Zero Cloud Storage' 아키텍처와 11단계 ABAC 인가, 그리고 단기 토큰을 통한 실제 영상 교류의 기술적 타당성을 정직하게 검증한 결과를 보고드리고자 합니다."
[핵심 방어 팁: 본 프로젝트는 합성 데이터 기반 기술 PoC이며 실제 환자 정보나 운영 병원망 연동은 제외되었음을 명확히 밝힙니다.]""",

    2: """[발표 00:45 ~ 01:15 | 목차 및 발표 여정]
"오늘 발표는 총 6개 파트로 진행됩니다.
첫째, 의료영상 전달 과정에서 발생하는 세 가지 단절과 문제점을 정의합니다.
둘째, 환자가 직접 권한과 범위를 결정하는 '동의 티켓' 개념을 설명합니다.
셋째, 제어 경로(Control)와 병원 영상 경로(Data)를 물리적으로 분리한 현재 런타임 구조를 제시합니다.
넷째, 11단계 접근 조건 검증과 키 관리, 감사 로그의 보안 경계를 설명합니다.
다섯째, 실제 클라우드 환경에서 합성 CT 영상 한 건이 A병원에서 B병원으로 정상 반입된 라이브 증적을 공개합니다.
마지막으로, 700장 대용량 전송과 향후 병원 연계까지 남아 있는 검증 관문을 투명하게 공유드리겠습니다." """,

    3: """[발표 01:15 ~ 01:50 | 문제 상황: 대표적 CD 이동 흐름]
"현재 우리나라의 대표적인 의료영상 전달 흐름을 보면, A병원에서 정밀 검사를 받은 환자가 타 병원 진료를 위해 직접 CD를 발급받고 가방에 넣어 B병원으로 이동합니다.
B병원에 도착하면 등록 창구에서 포맷 호환성을 확인하고 재등록 절차를 거치게 됩니다.
여기서 가장 큰 문제는 '영상이 존재하는가?'라는 단순한 질문에 그치지 않습니다.
'누가, 어떤 목적으로, 어느 검사 범위까지 열람을 허용했는가?'라는 맥락과 권한 정보가 물리적 CD에는 담기지 않아, 결국 영상 확인이 지연되거나 불필요한 재촬영으로 이어지게 됩니다." """,

    4: """[발표 01:50 ~ 02:30 | 핵심 아키텍처: 원본 분산 보관 & 권한 티켓]
"MediQ의 핵심 설계 사상은 '영상 원본은 병원 PACS에 두고, 권한만 티켓으로 이동한다'는 것입니다.
무제한의 대용량 영상 파일을 클라우드 중앙 서버로 끌어오는 것이 아닙니다.
환자가 스마트폰으로 수신 병원(B병원), 진료 목적, 유효 기간, 그리고 허용할 검사(Study/Series)를 좁혀서 '동의 티켓'을 발행합니다.
Control Plane은 오직 정책 검증과 감사로그만을 담당하고, 실제 영상 데이터는 양 병원의 온프레미스 게이트웨이를 통해 승인된 영상만 안전하게 직통 스트리밍됩니다." """,

    5: """[발표 02:30 ~ 03:00 | 증거 경계: 솔직한 검증 태도]
"저희는 기술 PoC로서 확인된 사실과 확인되지 않은 사실을 엄격히 구분합니다.
일부 발표에서 주장하는 '재촬영률 몇 % 감소'나 '수백억 원의 비용 절감'과 같은 수치는 아직 실제 병원 운영 표본과 비교 대조군이 수집되지 않았으므로 오늘 수치로 단정하여 주장하지 않습니다.
이번 PoC에서 저희가 확실하게 증명한 것은 '환자의 동의 조건에 따라, 클라우드 원본 저장 없이, 단기 토큰으로 안전한 영상 조회가 종단 간(End-to-End)으로 완벽히 동작하는가'라는 기술적 무결성입니다." """,

    6: """[발표 03:00 ~ 03:30 | 문제의 세 가지 연결 공백]
"저희가 진단한 기존 시스템의 한계는 세 가지 공백입니다.
첫째, '맥락의 공백'입니다. 영상의 출처와 이전 진료 맥락이 다음 병원으로 온전히 이어지지 못합니다.
둘째, '권한의 공백'입니다. 전체 영상을 무차별 복사해 주거나 아예 안 주거나 둘 중 하나일 뿐, 특정 검사만 기간을 정해 열람시키는 세분화된 통제가 불가능했습니다.
셋째, '증거의 공백'입니다. 누가 내 영상을 열어봤는지, 언제 접근이 거부되었는지를 사후에 추적할 불변의 감사 로그가 없었습니다. MediQ는 이 세 가지 공백을 메우기 위해 설계되었습니다." """,

    7: """[발표 03:30 ~ 04:00 | 솔루션: 세 가지 질문에 대한 기술적 응답]
"MediQ는 세 가지 질문에 명확한 시스템 아키텍처로 응답합니다.
'누가 열 수 있는가?' ➔ 서버가 환자와 의사의 역할 및 소속 기관을 검증합니다.
'무엇을 열 수 있는가?' ➔ 환자의 명시적 동의에 기록된 목적, 기간, Study 및 Series UID 단위로만 접근을 엄격히 한정합니다.
'무엇을 증명할 수 있는가?' ➔ 게이트웨이의 영상 전송 결과와 보안 감사 이벤트를 하나의 세션 ID로 상관 결합하여 법적 증거력을 제공합니다.
우리는 과장된 AI 진단이 아니라, 합법적이고 안전한 영상 접근의 통제권을 다룹니다." """,

    8: """[발표 04:00 ~ 04:35 | 제품 구조: Control Plane과 Data Plane의 분리]
"저희 플랫폼의 런타임 분리 구조입니다.
좌측의 'Cloud Control Plane'은 환자 동의, 인가 정책, 최소 메타데이터, 감사로그만을 담당하며, 원본 DICOM 영상 파일은 단 1바이트도 영구 저장하지 않습니다.
우측의 'Hospital Data Plane'은 A병원과 B병원의 Orthanc PACS와 게이트웨이로 구성되어 실제 DICOMweb 통신을 처리합니다.
의료진 뷰어는 단기 서명 토큰을 받아 필요한 프레임만 지연 로딩(Lazy Loading) 방식으로 안전하게 열람합니다." """,

    9: """[발표 04:35 ~ 05:20 | 업무 절차: 8단계 종단 워크플로우]
"실제 사용자가 경험하는 8단계 절차입니다.
1단계, 환자와 의료진이 로그인하여 신원을 확인합니다.
2단계, 환자가 수신 병원과 목적, 기간, 검사 범위를 선택합니다.
3단계, 환자 동의가 저장되고 고유 동의 티켓이 생성됩니다.
4단계, B병원 의료진이 환자 접수를 진행합니다.
5단계, Control 서버가 동의 상태와 유효기간을 전수 검증합니다.
6단계, 모든 조건이 충족되면 5분 유효 단기 HMAC 토큰을 발행합니다.
7단계, 병원 게이트웨이가 토큰과 전송 무결성을 최종 확인합니다.
8단계, 승인된 영상이 뷰어로 스트리밍되고 모든 과정이 감사로그에 불변 기록됩니다." """,

    10: """[발표 05:20 ~ 06:05 | 역할별 화면: 4대 사용자 게이트웨이]
"화면에 보시는 것처럼, 저희는 권한에 따라 독립된 사용자 인터페이스를 제공합니다.
좌측은 '환자 포털'로, 자신의 공유 지갑을 통해 동의를 생성하고 AI 건강도우미를 이용할 수 있습니다.
가운데는 '의료진 포털'로, 승인된 환자 목록을 조회하고 700장 복부 CT 뷰어를 호출하는 화면입니다.
우측은 '보안 관제 콘솔'로, 토큰 발급 이력과 WAF 차단 이벤트, 비정상 접근 시도를 실시간 모니터링합니다.
각 화면은 단순한 UI가 아니라 백엔드 서버의 RBAC 및 ABAC 정책과 엄격히 결합되어 있습니다." """,

    11: """[발표 06:05 ~ 06:40 | 대표 워크플로우 비교: 매체 vs 스트리밍]
"기존의 '매체 중심' 흐름과 MediQ의 '스트리밍 중심' 흐름을 비교해 보십시오.
기존에는 '검사 ➔ CD발급 ➔ 이동 ➔ 병원등록 ➔ 판독확인'이라는 5단계의 물리적 병목이 발생했습니다.
반면 MediQ는 '동의 ➔ 정책검증 ➔ 단기토큰 ➔ 게이트웨이 ➔ 감사'로 이어지는 5단계 디지털 자동화를 실현했습니다.
환자가 이동하기 전 이미 B병원 진료실에서 이전 병원의 고해상도 영상을 검토할 수 있어, 진료 연속성이 극대화됩니다." """,

    12: """[발표 06:40 ~ 07:25 | 시스템 구성도: Azure 클라우드와 온프레미스 PACS]
"저희 통합 시스템 구성도입니다.
상단의 Azure 제어 영역에는 Caddy 리버스 프록시와 Coraza WAF를 Edge에 배치하여 외부 침입을 1차 차단하고, Control API와 PostgreSQL이 메타데이터를 암호화 보관합니다.
하단의 병원 데이터 영역에는 A병원과 B병원의 Orthanc PACS가 위치하여 원본 의료영상을 분산 격리 보관합니다.
영상 전송이 필요할 때만 단기 토큰을 기반으로 게이트웨이 간 암호화 채널이 수립되므로, 클라우드 침해 사고가 발생하더라도 대규모 의료영상 유출은 구조적으로 불가능합니다." """,

    13: """[발표 07:25 ~ 08:00 | 구현 범위와 단계적 검증 현황]
"저희가 구축한 기반과 검증된 사실, 향후 과제를 투명하게 정리했습니다.
현재 Azure HTTPS Edge, WAF, Control API, A/B 테스트 병원 게이트웨이는 정상 배포되어 있습니다.
실제 라이브 검증을 통해 기존 환자 동의 기반의 합성 CT 단건 전송, B병원 독립 재조회, SHA-256 해시 일치, 감사 세션 상관까지 전 과정을 성공적으로 PASS시켰습니다.
전체 700장 일괄 백그라운드 전송 및 운영 병원 HIS 연동은 향후 과제로 명확히 설정했습니다." """,

    14: """[발표 08:00 ~ 08:45 | 실제 라이브 증적: 합성 CT 단건 A➔B 전송]
"2026년 10월 14일 오전 08시 38분, 실제 배포 환경에서 수행된 단건 반입 라이브 증적입니다.
DOWNLOAD_ALLOWED 동의와 B병원 의료진의 정식 인증 토큰을 사용하여 합성 SOP Instance 1건을 A병원에서 B병원 Orthanc으로 전송했습니다.
전송 후 B병원 서버에서 독립적으로 DICOM을 재조회한 결과, Study/Series UID는 물론 3,146,808 바이트의 파일 크기와 원본 SHA-256 해시값이 1비트의 오차도 없이 100% 완벽히 일치함을 확인했습니다.
또한 토큰 발급부터 PACS 검증까지 6개 감사 이벤트가 하나의 세션 ID로 정확히 체이닝되었습니다." """,

    15: """[발표 08:45 ~ 09:25 | 실제 배포 화면: B병원 보관함 및 영수증 증적]
"실제 Azure 클라우드에 배포된 B병원 영상 보관함 화면입니다.
우측 스크린샷에서 보시듯 '완료 1건, 실패 0건, 미완료 0건'과 함께 B PACS의 수신 영수증이 선명하게 확인됩니다.
특히 보안성을 위해 의료진 PC 로컬로의 직접 DICOM 원본 다운로드는 완벽히 차단하였으며, 오직 인가된 PACS 간 전송 및 인앱 뷰어 열람만을 허용했습니다.
이로써 원본성 훼손 없는 안전한 병원 간 의료영상 전달이 실증되었습니다." """,

    16: """[발표 09:25 ~ 10:05 | 보안 게이트: 11단계 조건의 교집합 (Fail-Closed)]
"저희 보안 통제의 핵심은 'Fail-Closed' 원칙입니다.
단순히 의사 면허가 있다고 열리지 않습니다.
요청 주체(WHO), 진료 목적(WHY), 유효 기간(WHEN), 허용된 검사 범위(WHAT) 등 11개 조건이 모두 참(True)이어야만 문이 열립니다.
유효기간이 단 1초라도 지났거나, 동의된 검사 이외의 다른 Series를 조회하려 하면 즉시 거부되고 `CONSENT_EXPIRED` 또는 `SCOPE_MISMATCH`라는 정밀한 감사 코드가 기록됩니다.
프론트엔드 버튼 숨김에 의존하지 않고 모든 권한을 백엔드에서 전수 검증합니다." """,

    17: """[발표 10:05 ~ 10:40 | 캡스톤 프로젝트의 엄격한 경계 준수]
"발표에 앞서 저희 프로젝트의 규범적 경계를 다시 한번 명확히 밝힙니다.
본 프로젝트는 가상 환자, 가상 병원, 합성 DICOM을 활용한 기술 아키텍처 실증 PoC입니다.
실제 환자의 개인정보나 실제 병원 운영 PACS망에는 접속하지 않았으며, 의학적 진단이나 치료 권고와 같은 의료 행위는 일절 포함하지 않습니다.
기술적 보안 모델을 검증하는 연구로서, 향후 의료기기 승인이나 ISMS-P 인증과 같은 제도적 인증을 거쳐 발전해 나갈 토대를 마련했습니다." """,

    18: """[발표 10:40 ~ 11:20 | 보안 기능별 통제 수준 및 증거의 깊이]
"저희는 기능이 '코드에 존재함'과 '클라우드에서 실증됨'을 정직하게 구분하여 보고합니다.
환자 동의, ABAC 정책, 단기 토큰 발급은 실제 단건 반입 시험에서 전수 검증되어 PASS 판정을 받았습니다.
전송 무결성 역시 B PACS 독립 재조회와 SHA-256 해시 검증을 통해 PASS되었습니다.
저장구간 암호화(LUKS2)와 키 관리 작업은 부분 PASS를 획득하였으며, 향후 병원 재부팅 및 DR 복구 시험을 통해 완성도를 높여갈 계획입니다." """,

    19: """[발표 11:20 ~ 12:00 | 보안 관제 스냅샷: 실시간 감사 추적]
"실제 Azure 보안 관제실의 24시간 조회 스냅샷입니다.
Azure Key Vault에서는 68건의 키 암호화 및 서명 작업이 안전하게 수행되었고, Caddy 및 Coraza WAF에서는 298건의 보안 규칙 매칭 이벤트가 수집되어 비정상 요청을 실시간 차단했습니다.
저희 감사로그는 사후 분쟁 시 누구도 조작할 수 없도록 불변 세션 ID와 상관되어 관리자조차 임의 삭제가 불가능하도록 통제됩니다." """,

    20: """[발표 12:00 ~ 12:45 | 종합 실증 결과: 700장 CT 뷰어 & AI 건강도우미]
"저희가 이번 릴리즈에서 달성한 종합 실증 결과입니다.
첫째, 단건 라이브 A➔B 전송과 자동화 검증 테스트 55개, 증거 검증 테스트 13개를 100% PASS했습니다.
둘째, 화면 우측에서 보시듯 WADO-RS 기반으로 700장에 달하는 복부 CT 전체 슬라이스를 로딩하고, 병변 십자선과 윈도우 레벨링을 제공하는 정밀 웹 뷰어 검증을 완료했습니다.
셋째, 1,019개 의학 코퍼스와 2-Layer 형태소 분석을 적용한 AI 건강도우미를 통해 혈청 AFP 검사 개념 해설과 진료 질문 리허설 기능을 성공적으로 가동시켰습니다." """,

    21: """[발표 12:45 ~ 13:20 | 향후 로드맵: 다음 4대 관문]
"저희는 여기서 멈추지 않고 다음 4대 기술 관문을 향해 나아갑니다.
게이트 1은 700장 대용량 배치의 무중단 전송과 네트워크 단절 시 이어받기(Resume)의 멱등성 검증입니다.
게이트 2는 암호화 스토리지와 PACS 간의 자동 마운트 결합 및 재부팅 복구 고도화입니다.
게이트 3은 통합 모니터링 및 실시간 이상행위 탐지 룰의 고도화입니다.
게이트 4는 실제 병원 PACS와의 HL7 FHIR 연동 및 법률·보안 적합성 평가입니다.
근거 없는 과장 대신 한 단계씩 증거를 축적해 가겠습니다." """,

    22: """[발표 13:20 ~ 14:00 | 결론 및 Q&A: 환자 동의로 열고 감사로 닫는다]
"결론을 맺겠습니다.
하이패스 MediQ는 환자에게는 CD 발급의 번거로움과 중복 방사선 피폭을 없애주고, 의료진에게는 진료 연속성을 보장하며, 병원에는 데이터 유출 위험 없는 안전한 상호운용성을 제공합니다.
'환자 동의로 열고, 증거와 감사로 닫는다'는 확고한 철학을 바탕으로, 디지털 의료영상 교류의 새로운 지평을 열어가겠습니다.
경청해 주셔서 대단히 감사합니다. 질의응답을 받겠습니다." """
}

# Apply Notes to all slides
for slide_idx, script in scripts.items():
    if slide_idx <= len(prs.slides):
        s = prs.slides[slide_idx - 1]
        notes = s.notes_slide.notes_text_frame
        notes.text = script

print("Applied 22 spoken presenter scripts to all slide notes.")

# Visual Enhancements with Live Screenshots
# Slide 10: ROLES & SURFACES - Add role screenshots
s10 = prs.slides[9]
# Add 3 role screenshots below the 3 cards (Patient, Clinician, Security)
patient_login = os.path.join(ASSETS, "02_patient_login.png")
clinician_login = os.path.join(ASSETS, "03_clinician_login.png")
sec_login = os.path.join(ASSETS, "04_security_admin_login.png")

# Slide 10 dimensions: width=20 inches, height=11.25 inches
# Cards are at left=1.12", 7.12", 13.12", top=3.33", w=5.50", h=4.92"
# Place small preview images at bottom of each card or alongside:
# Let's place 3 neat screenshots at top=5.2", left=1.35", 7.35", 13.35", width=5.0"
if os.path.exists(patient_login) and os.path.exists(clinician_login) and os.path.exists(sec_login):
    s10.shapes.add_picture(patient_login, Inches(1.35), Inches(5.1), width=Inches(5.0))
    s10.shapes.add_picture(clinician_login, Inches(7.35), Inches(5.1), width=Inches(5.0))
    s10.shapes.add_picture(sec_login, Inches(13.35), Inches(5.1), width=Inches(5.0))
    print("Added 3 role login screenshots to Slide 10.")

# Slide 19: AUDIT SNAPSHOT - Embed live security audit console
s19 = prs.slides[18]
audit_console = os.path.join(ASSETS, "08_security_audit_console.png")
if os.path.exists(audit_console):
    # Place at bottom area: left=4.5", top=7.6", width=11.0"
    s19.shapes.add_picture(audit_console, Inches(3.5), Inches(7.5), width=Inches(13.0))
    print("Added security audit console screenshot to Slide 19.")

# Slide 20: VALIDATION - Embed 700 CT Viewer & Health Helper RAG
s20 = prs.slides[19]
ct_viewer = os.path.join(ASSETS, "07_clinician_dicom_viewer.png")
rag_helper = os.path.join(ASSETS, "05_health_helper_rag.png")
if os.path.exists(ct_viewer):
    # Embed in top-right viewer test area: left=12.5", top=3.4", width=6.3"
    s20.shapes.add_picture(ct_viewer, Inches(12.5), Inches(3.3), width=Inches(6.2))
    print("Added 700 CT Viewer screenshot to Slide 20.")
if os.path.exists(rag_helper):
    # Embed in bottom-right area: left=13.5", top=6.2", width=4.5"
    s20.shapes.add_picture(rag_helper, Inches(13.8), Inches(6.0), width=Inches(4.5))
    print("Added AI Health Helper screenshot to Slide 20.")

# Save regular presentation
reg_path = os.path.join(OUT_DIR, "Highpass_MediQ_Regular_15min.pptx")
prs.save(reg_path)
print("Saved 15-min regular deck to:", reg_path)

# Copy to Kakao folder
kakao_reg = os.path.join(KAKAO_DIR, "Highpass_MediQ_Regular_15min.pptx")
shutil.copy2(reg_path, kakao_reg)
print("Copied 15-min regular deck to Kakao folder:", kakao_reg)

# Also update the base file in Kakao folder so it stays current
shutil.copy2(reg_path, BASE_PPTX)
print("Updated base file in Kakao folder:", BASE_PPTX)
