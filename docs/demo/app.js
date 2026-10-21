import {
  createState,
  act,
  studies,
  reasons,
  status,
  consentProblem,
  totals,
} from "./model.js";
const s = createState(),
  main = document.querySelector("main"),
  header = document.querySelector("header"),
  dialog = document.querySelector("dialog");
const routes = new Set([
  "welcome",
  "patient",
  "records",
  "share",
  "ticket",
  "helper",
  "patient-viewer",
  "doctor",
  "doctor-records",
  "doctor-viewer",
  "security",
  "events",
]);
let route = "welcome",
  noticeTimer,
  viewerWasAllowed = false;
const questions = [
  "이전 검사와 비교할 때 어떤 점을 확인해야 하나요?",
  "이번 영상검사 결과에서 의료진에게 물어볼 내용은 무엇인가요?",
  "다음 진료에 어떤 기록을 가져가면 좋을까요?",
];
const time = (ms) =>
  new Date(ms).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
function el(tag, props = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null)
      n.setAttribute(k, v === true ? "" : String(v));
  }
  for (const child of children.flat(Infinity)) {
    if (child != null && child !== false)
      n.append(
        child instanceof Node ? child : document.createTextNode(String(child)),
      );
  }
  return n;
}
const button = (text, fn, style = "") =>
  el("button", { type: "button", class: `btn ${style}`, onclick: fn }, text);
const p = (text, cls = "muted") => el("p", { class: cls }, text);
const pill = (text, color = "") => el("span", { class: `pill ${color}` }, text);
const link = (text, href, cls = "") => el("a", { href, class: cls }, text);
function notify(text) {
  clearTimeout(noticeTimer);
  document.querySelector("#notice").textContent = text;
  noticeTimer = setTimeout(
    () => (document.querySelector("#notice").textContent = ""),
    5500,
  );
}
function go(next) {
  if (route === next) render();
  else location.hash = next;
}
function action(type, input = {}) {
  const result = act(s, type, input);
  if (!result.ok)
    notify(
      reasons[result.code]?.[0] ??
        "기존 공유를 중단한 뒤 새 티켓을 만들어 주세요.",
    );
  return result;
}
function heading(title, description, badge) {
  return el(
    "div",
    { class: "page-heading" },
    el("div", {}, el("h1", {}, title), p(description)),
    badge,
  );
}
function panel(title, ...content) {
  return el("section", { class: "panel" }, el("h2", {}, title), ...content);
}
function empty(title, description, cta) {
  return el(
    "section",
    { class: "empty" },
    el("h2", {}, title),
    p(description),
    el("div", { class: "actions" }, cta),
  );
}
function details(items) {
  return el(
    "dl",
    { class: "details" },
    Object.entries(items).map(([key, value]) => [
      el("dt", {}, key),
      el("dd", {}, value),
    ]),
  );
}
function modal(title, body) {
  dialog.replaceChildren(
    el(
      "div",
      { class: "dialog-top" },
      el("h2", { id: "dialog-title" }, title),
      button("닫기", () => dialog.close()),
    ),
    body,
  );
  dialog.showModal();
}
function role() {
  return ["security", "events"].includes(route)
    ? "security"
    : route.startsWith("doctor")
      ? "doctor"
      : route === "welcome"
        ? "welcome"
        : "patient";
}
function nav(items) {
  return el(
    "nav",
    { class: "subnav", "aria-label": "화면 메뉴" },
    items.map(([key, title]) =>
      el(
        "button",
        {
          type: "button",
          "aria-current": route === key ? "page" : null,
          onclick: () => go(key),
        },
        title,
      ),
    ),
  );
}
function flow() {
  return el(
    "div",
    { class: "flow", "aria-label": "체험 진행" },
    [
      ["환자 공유", !!s.consent],
      ["QR 접수", s.consent?.used],
      ["검사 열람", s.events.some((e) => e.code === "STUDY_VIEWED")],
      ["관제 확인", role() === "security"],
    ].map(([name, done], i) =>
      el(
        "span",
        { class: done ? "done" : "" },
        el("b", {}, done ? "✓" : `0${i + 1}`),
        name,
      ),
    ),
  );
}
function renderHeader() {
  header.replaceChildren(link("Medi", "../", "brand"));
  header.firstChild.append(el("b", {}, "Q"));
  header.append(
    el(
      "nav",
      { class: "role-nav", "aria-label": "체험 역할" },
      [
        ["patient", "환자"],
        ["doctor", "의료진"],
        ["security", "보안관리자"],
      ].map(([key, title]) =>
        el(
          "button",
          {
            type: "button",
            "aria-current": role() === key ? "page" : null,
            onclick: () => go(key),
          },
          title,
        ),
      ),
    ),
    el(
      "div",
      { class: "header-end" },
      link("역할 선택", "#welcome"),
      el(
        "button",
        {
          type: "button",
          class: "text-btn",
          onclick: () =>
            modal(
              "체험을 처음부터 시작할까요?",
              el(
                "div",
                {},
                p(
                  "현재 탭의 가상 티켓·이벤트·질문 카드만 지워집니다. 실제 서버 기록과는 관계없습니다.",
                ),
                el(
                  "div",
                  { class: "actions" },
                  button(
                    "처음부터 시작",
                    () => {
                      Object.assign(s, createState());
                      dialog.close();
                      go("welcome");
                      notify("체험 기록을 초기화했습니다.");
                    },
                    "danger",
                  ),
                ),
              ),
            ),
        },
        "체험 초기화",
      ),
    ),
  );
}
function welcome() {
  return [
    el(
      "section",
      { class: "role-hero" },
      el("h1", {}, "하나의 검사,", el("br"), "세 가지 시선."),
      p(
        "환자는 공유하고, 의료진은 확인하고, 관리자는 접근 기록을 살펴봅니다. 로그인 없이 직접 이어가 보세요.",
      ),
    ),
    el(
      "div",
      { class: "role-cards" },
      [
        [
          "patient",
          "환자의 건강지갑",
          "내 기록에서 공유할 검사를 고르고, 병원에 보여줄 QR 티켓을 만듭니다.",
          "patient-wallet.png",
          "환자로 체험하기",
        ],
        [
          "doctor",
          "의료진의 접수데스크",
          "공유받은 티켓으로 접수하고, 허용된 기록과 영상만 확인합니다.",
          "reception.png",
          "의료진으로 체험하기",
        ],
        [
          "security",
          "관리자의 보안관제실",
          "방금 한 행동이 어떤 기록으로 남는지, 접근은 왜 차단되는지 살펴봅니다.",
          "security-operations.png",
          "보안관리자로 체험하기",
        ],
      ].map(([key, title, description, img, cta]) =>
        el(
          "article",
          { class: "role-card" },
          el("img", {
            src: `../assets/portfolio-20261017/${img}`,
            alt: `구축 당시 ${title} 화면`,
            loading: "lazy",
          }),
          el(
            "div",
            {},
            el("h2", {}, title),
            p(description),
            button(cta, () => go(key), "primary"),
          ),
        ),
      ),
    ),
    flow(),
    el(
      "div",
      { class: "hint" },
      "먼저 환자로 시작하면 하나의 티켓이 세 화면을 연결합니다. 의료진·관리자부터 시작할 때는 ‘샘플 티켓 준비’로 이어갈 수 있습니다.",
    ),
    p(
      "Azure 시연 서비스는 종료되었습니다. 위 미리보기는 구축 당시 화면이며, 아래 체험은 별도의 브라우저 시뮬레이션입니다.",
      "small muted",
    ),
  ];
}
function patientHome() {
  const cards = [
    ["ticket", "▦", "공유 QR", "병원에 보여줄 티켓"],
    ["records", "▤", "내 건강기록", "검사와 기록 확인"],
    ["share", "↗", "영상 공유", "공유 조건 선택"],
    ["helper", "✦", "건강도우미", "진료 질문 챙기기"],
  ];
  return [
    heading(
      "홍길동님의 건강지갑",
      "가상 환자의 기록으로 다음 진료를 준비해 보세요.",
      pill("합성 환자 · 체험 중"),
    ),
    el(
      "div",
      { class: "overview" },
      el(
        "div",
        {},
        el("h2", {}, "내 기록은 내가 챙길게요."),
        p("지갑에서 카드를 꺼내 보세요. 공유할 범위와 기간은 내가 선택합니다."),
      ),
      el(
        "div",
        {},
        el("h3", {}, "최근 검사"),
        p("복부 CT · A병원"),
        p("2026.10.10 / 합성 예시"),
      ),
      el(
        "div",
        {},
        el("h3", {}, "최근 공유"),
        p(status(s)),
        p(
          s.consent
            ? `${s.consent.hospital} · ${studies[s.consent.study]}`
            : "아직 공유한 검사가 없어요.",
        ),
      ),
    ),
    el(
      "div",
      { class: "wallet" },
      el("img", {
        class: "leather back",
        src: "assets/wallet-back.webp",
        alt: "",
      }),
      el(
        "div",
        { class: "wallet-cards" },
        cards.map(([key, icon, title, description]) =>
          el(
            "button",
            { type: "button", class: "wallet-card", onclick: () => go(key) },
            el("span", { class: "card-icon", "aria-hidden": "true" }, icon),
            el("strong", {}, title),
            el("small", {}, description),
          ),
        ),
      ),
      el("img", {
        class: "leather front",
        src: "assets/wallet-front.webp",
        alt: "",
      }),
    ),
    p("카드를 누르면 해당 화면이 열립니다.", "wallet-hint"),
    flow(),
  ];
}
function records() {
  return [
    heading("내 건강기록", "가상의 검사 기록입니다. 실제 건강정보가 아닙니다."),
    panel(
      "A병원에서 받은 검사",
      el(
        "div",
        { class: "record-row" },
        el("img", {
          class: "mini-ct",
          src: "assets/synthetic-ct.png",
          alt: "합성 복부 CT 예시",
        }),
        el(
          "div",
          { class: "record-main" },
          el("h3", {}, "복부 CT"),
          p("2026.10.10 · 합성 시연 이미지 1장"),
        ),
        button("내 영상 보기", () => go("patient-viewer"), "primary"),
      ),
      el(
        "div",
        { class: "record-row" },
        el(
          "div",
          { class: "record-main" },
          el("h3", {}, "2026 건강검진"),
          p("가상 검진 기록 · 2025년과 비교"),
        ),
        button("검진 기록 보기", () =>
          modal(
            "건강검진 기록 · 합성 예시",
            el(
              "div",
              {},
              details({
                "2025 체중": "72 kg",
                "2026 체중": "70 kg",
                변화: "−2 kg",
                "기록의 용도": "화면 비교 기능 설명용",
              }),
              p(
                "수치 판정·진단은 제공하지 않습니다. 실제 기록의 비교 조건은 의료진과 확인해야 합니다.",
              ),
            ),
          ),
        ),
      ),
      el(
        "div",
        { class: "actions" },
        button("이 기록 공유하기", () => go("share"), "primary"),
      ),
    ),
  ];
}
function select(name, choices) {
  return el(
    "select",
    { name },
    choices.map(([v, t]) => el("option", { value: v }, t)),
  );
}
function share() {
  if (s.consent && !consentProblem(s, Date.now(), s.consent.hospital))
    return [
      heading("영상 공유", "기존 공유를 먼저 확인하세요."),
      empty(
        "사용 중인 공유 티켓이 있어요",
        "중복 발급하지 않고 기존 티켓으로 이어갑니다. 조건을 바꾸려면 기존 공유를 중단해 주세요.",
        button("내 QR 티켓 보기", () => go("ticket"), "primary"),
      ),
    ];
  const study = select("study", [
      ["ct", "복부 CT · 2026.10.10"],
      ["checkup", "2026 건강검진 · 가상 기록"],
    ]),
    hospital = select("hospital", [
      ["B병원", "B병원"],
      ["C병원", "C병원"],
    ]),
    days = select("days", [
      [1, "1일"],
      [3, "3일"],
      [7, "7일"],
    ]),
    check = el("input", { type: "checkbox", required: true });
  const form = el(
    "form",
    {
      onsubmit: (e) => {
        e.preventDefault();
        if (!check.checked) return;
        if (
          action("create", {
            study: study.value,
            hospital: hospital.value,
            days: Number(days.value),
          }).ok
        ) {
          go("ticket");
          notify("체험용 QR 티켓이 만들어졌습니다.");
        }
      },
    },
    el("h2", {}, "공유 조건 선택"),
    el(
      "div",
      { class: "form-grid" },
      el("label", {}, "공유할 검사", study),
      el("label", {}, "받는 병원", hospital),
      el("label", {}, "공유 기간", days),
      el(
        "label",
        {},
        "이용 범위",
        el("input", { value: "진료 목적 · 열람만 허용", readonly: true }),
      ),
    ),
    el(
      "label",
      { class: "check" },
      check,
      el(
        "span",
        {},
        "선택한 검사·병원·기간을 확인했습니다. 실제 공유가 아닌 체험용 동의입니다.",
      ),
    ),
    el(
      "div",
      { class: "actions" },
      el(
        "button",
        { class: "btn primary", type: "submit" },
        "조건 확인하고 QR 만들기",
      ),
    ),
  );
  return [
    heading(
      "필요한 기록만, 필요한 병원에.",
      "공유 조건을 선택하면 QR 티켓에 그대로 담깁니다.",
      pill("열람 전용"),
    ),
    el(
      "div",
      { class: "two-col" },
      el("section", { class: "panel" }, form),
      panel(
        "공유 전 알아두세요",
        details({
          "제공 병원": "A병원",
          "공유 대상": "선택한 검사 1개",
          다운로드: "허용하지 않음",
          "공유 중단": "티켓 화면에서 언제든 체험 가능",
        }),
        p(
          "실제 서비스에서는 서버가 동의와 접근 범위를 검증합니다. 이 화면은 그 절차를 설명하는 목업입니다.",
          "small muted",
        ),
      ),
    ),
  ];
}
function ticket() {
  if (!s.consent)
    return [
      heading("나의 공유 QR", "병원에 보여줄 공유 티켓을 확인하세요."),
      empty(
        "먼저 공유할 검사를 골라주세요",
        "티켓은 공유 조건을 확인한 뒤 만들어집니다.",
        button("공유 조건 선택", () => go("share"), "primary"),
      ),
    ];
  const c = s.consent,
    valid = !consentProblem(s, Date.now(), c.hospital);
  let qr;
  if (valid) {
    qr = el("canvas", {
      width: 232,
      height: 232,
      class: "qr",
      role: "img",
      "aria-label": "인증정보 없는 체험용 QR",
    });
    const q = window.qrcode(0, "M");
    q.addData(`MEDIQ-PORTFOLIO-ONLY:${c.id}`);
    q.make();
    const ctx = qr.getContext("2d"),
      count = q.getModuleCount(),
      cell = 232 / (count + 8);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 232, 232);
    ctx.fillStyle = "#193454";
    for (let r = 0; r < count; r++)
      for (let col = 0; col < count; col++)
        if (q.isDark(r, col))
          ctx.fillRect(
            Math.floor((col + 4) * cell),
            Math.floor((r + 4) * cell),
            Math.ceil(cell),
            Math.ceil(cell),
          );
  } else
    qr = el(
      "div",
      { class: "empty" },
      el("h3", {}, "사용할 수 없는 티켓"),
      p(status(s)),
    );
  return [
    heading(
      "병원에 보여줄 나의 QR",
      "이 QR은 체험 식별자만 담습니다. 실제 병원에서 접수할 수 없습니다.",
    ),
    el(
      "article",
      { class: "ticket" },
      el(
        "div",
        { class: "ticket-head" },
        el("div", {}, pill("가상 환자 홍길동"), el("h2", {}, studies[c.study])),
        pill(status(s), valid ? "green" : "red"),
      ),
      el(
        "div",
        { class: "ticket-body" },
        el("div", {}, qr, p("인증·접근 권한이 없는 체험 QR", "small muted")),
        el(
          "div",
          {},
          details({
            티켓: c.id,
            "제공 → 수신": `A병원 → ${c.hospital}`,
            기간: `${time(c.since)} ~ ${time(c.until)}`,
            "허용 범위": "진료 · 선택 검사 · 열람만",
            접수: c.used ? "사용 완료" : "대기 중",
          }),
          el(
            "div",
            { class: "actions" },
            button("의료진은 어떻게 받을까요?", () => go("doctor"), "primary"),
            valid
              ? button("공유 중단", () =>
                  modal(
                    "이 공유를 중단할까요?",
                    el(
                      "div",
                      {},
                      p(
                        "체험 의료진의 새 열람이 차단되고, 관제 화면에 철회 기록이 남습니다.",
                      ),
                      el(
                        "div",
                        { class: "actions" },
                        button(
                          "공유 중단 확인",
                          () => {
                            action("revoke");
                            dialog.close();
                            render();
                            notify(
                              "공유를 중단했습니다. 의료진 화면에서 접근 차단을 확인해 보세요.",
                            );
                          },
                          "danger",
                        ),
                      ),
                    ),
                  ),
                )
              : button("새 공유 만들기", () => go("share")),
          ),
        ),
      ),
    ),
    flow(),
  ];
}
function helper() {
  return [
    heading(
      "다음 진료에, 이 질문 어때요?",
      "실시간 RAG가 아닌 미리 준비한 질문 카드 체험입니다.",
      pill("예시 답변 · AI 호출 없음"),
    ),
    el(
      "div",
      { class: "two-col" },
      el(
        "section",
        { class: "panel helper" },
        el("h2", {}, "먼저 챙길 질문"),
        questions
          .filter((q) => !s.questions.includes(q))
          .map((q) =>
            el(
              "article",
              { class: "question" },
              el("h3", {}, q),
              el(
                "div",
                { class: "actions" },
                button("예시 안내 보기", () =>
                  modal(
                    "진료 준비 안내 · 고정 예시",
                    el(
                      "div",
                      {},
                      p(
                        "이전 검사일과 결과지를 함께 준비하고, 이번 결과와 어떤 조건에서 비교할 수 있는지 의료진에게 물어보세요.",
                      ),
                      p(
                        "이 문구는 화면 사용법을 설명하는 예시입니다. 검색된 의학 근거나 모델 생성 답변으로 표시하지 않습니다.",
                        "small muted",
                      ),
                    ),
                  ),
                ),
                button(
                  "질문 담기",
                  () => {
                    s.questions.push(q);
                    render();
                    notify("진료 질문 카드에 담았습니다.");
                  },
                  "primary",
                ),
              ),
            ),
          ),
        s.questions.length === questions.length
          ? p("추천 질문을 모두 담았어요. 오른쪽 보관함에서 확인해 보세요.")
          : null,
      ),
      el(
        "section",
        { class: "panel question-shelf" },
        el("h2", {}, "다음 진료에 가져갈 질문"),
        s.questions.length
          ? s.questions.map((q) =>
              el(
                "article",
                { class: "shelf-card" },
                p(q, ""),
                button("담기 취소", () => {
                  s.questions = s.questions.filter((v) => v !== q);
                  render();
                }),
              ),
            )
          : p("담은 질문이 여기에 모입니다."),
      ),
    ),
  ];
}
function sample() {
  if (!s.consent || consentProblem(s, Date.now(), s.consent.hospital)) {
    act(s, "create", { study: "ct", hospital: "B병원", days: 3 });
    notify("샘플 동의와 티켓을 만들었습니다. 실제 환자 요청이 아닙니다.");
  } else notify("환자가 만든 기존 티켓을 그대로 사용합니다.");
  render();
}
function doctor() {
  const c = s.consent;
  return [
    heading(
      "접수는 QR 한 장으로.",
      "환자가 고른 기록을 확인하고, 다음 진료를 준비하세요.",
      pill("가상 B병원 · 의료진 역할"),
    ),
    el(
      "div",
      { class: "two-col" },
      panel(
        "환자의 공유 티켓 받기",
        el(
          "div",
          { class: "scanner" },
          el("span", { class: "scan-mark", "aria-hidden": "true" }, "▦"),
          el("h3", {}, "QR 티켓을 기다리고 있어요"),
          p("카메라를 켜지 않는 포트폴리오 체험입니다."),
        ),
        el(
          "div",
          { class: "actions" },
          button(
            "체험 티켓 불러오기",
            () => {
              if (action("receive").ok) {
                notify("접수했습니다. 공유된 기록을 확인하세요.");
                go("doctor-records");
              }
            },
            "primary",
          ),
          button("샘플 티켓 준비", sample),
        ),
      ),
      el(
        "aside",
        { class: "desk-id" },
        el("h2", {}, "이번에 받을 기록"),
        c
          ? details({
              환자: "홍길동 · 가상 환자",
              검사: studies[c.study],
              "받는 병원": c.hospital,
              "티켓 상태": status(s),
            })
          : p(
              "아직 티켓이 없습니다. 환자 역할에서 공유하거나 샘플 티켓을 준비하세요.",
            ),
        el(
          "div",
          { class: "actions" },
          button("접수된 기록 확인", () => go("doctor-records")),
        ),
        p(
          "QR 접수와 영상 열람 허가는 별개입니다. 열람할 때 공유 기간과 범위를 다시 확인합니다.",
          "small",
        ),
      ),
    ),
    flow(),
  ];
}
function doctorRecords() {
  const issue =
    consentProblem(s) || (!s.consent?.used ? "RECEPTION_REQUIRED" : null);
  if (issue)
    return [
      heading("공유받은 환자기록", "환자가 허용한 범위만 표시합니다."),
      empty(
        reasons[issue][0],
        reasons[issue][1],
        button("접수데스크로", () => go("doctor"), "primary"),
      ),
    ];
  const c = s.consent;
  return [
    heading(
      "홍길동님의 공유 기록",
      "A병원에서 B병원으로 · 합성 시연 데이터",
      pill("접수 완료", "green"),
    ),
    panel(
      "허용된 검사 1개",
      el(
        "div",
        { class: "record-row" },
        el(
          "div",
          { class: "record-main" },
          el("h2", {}, studies[c.study]),
          p(`열람 전용 · ${time(c.until)}까지`),
        ),
        button(
          c.study === "ct" ? "환자영상 열기" : "공유 검진기록 열기",
          () => {
            if (c.study === "ct") {
              action("view", { study: "ct" });
              go("doctor-viewer");
            } else {
              const r = action("renew", { study: "checkup" });
              if (r.ok && action("view", { study: "checkup" }).ok)
                modal(
                  "공유된 건강검진 · 합성 예시",
                  details({
                    "2025 체중": "72 kg",
                    "2026 체중": "70 kg",
                    "제공 병원": "A병원",
                    용도: "기록 공유 UI 체험 · 진단 아님",
                  }),
                );
            }
          },
          "primary",
        ),
      ),
      p("공유하지 않은 기록은 목록에 나타나지 않습니다.", "small muted"),
      el(
        "div",
        { class: "actions" },
        button("이 접근은 어떻게 기록될까요?", () => go("security")),
      ),
    ),
  ];
}
function viewer(patient = false) {
  const issue = patient
    ? null
    : consentProblem(s) ||
      (!s.consent.used
        ? "RECEPTION_REQUIRED"
        : s.consent.study !== "ct"
          ? "SCOPE_MISMATCH"
          : Date.now() >= s.tokenUntil
            ? "TOKEN_EXPIRED"
            : null);
  viewerWasAllowed = !issue;
  const image = el("img", {
      src: "assets/synthetic-ct.png",
      alt: "비임상 합성 복부 CT 예시 이미지 1장",
    }),
    zoom = el("input", {
      type: "range",
      min: 100,
      max: 180,
      value: 100,
      "aria-label": "영상 확대",
      oninput: (e) =>
        (image.style.transform = `scale(${Number(e.target.value) / 100})`),
    }),
    brightness = el("input", {
      type: "range",
      min: 60,
      max: 140,
      value: 100,
      "aria-label": "영상 밝기",
      oninput: (e) =>
        (image.style.filter = `brightness(${Number(e.target.value) / 100})`),
    });
  return [
    heading(
      patient ? "내 영상 보기" : "환자영상",
      "합성 예시 이미지 1장으로 뷰어 동작을 체험합니다. DICOM 원본이나 실제 판독 도구가 아닙니다.",
    ),
    el(
      "section",
      { class: "viewer" },
      el(
        "div",
        { class: "viewer-head" },
        el(
          "div",
          {},
          el("h2", {}, "복부 CT"),
          el("small", {}, "가상 환자 홍길동 · A병원 · 2026.10.10"),
        ),
        pill(
          patient
            ? "본인 화면 체험"
            : issue
              ? "열람 조건 확인 필요"
              : "체험 열람권한 5분",
          issue ? "red" : "green",
        ),
      ),
      el(
        "div",
        { class: "viewer-image" },
        issue
          ? el(
              "div",
              { class: "viewer-block" },
              el("h2", {}, reasons[issue][0]),
              p(reasons[issue][1]),
              el(
                "div",
                { class: "actions" },
                button("열람권한 다시 확인", () => {
                  if (action("renew", { study: "ct" }).ok) {
                    action("view", { study: "ct" });
                    render();
                    notify(
                      "조건을 다시 확인했습니다. 5분 동안 열람 체험을 이어갑니다.",
                    );
                  }
                }),
              ),
            )
          : image,
      ),
      el(
        "div",
        { class: "viewer-tools" },
        !issue
          ? [el("label", {}, "확대", zoom), el("label", {}, "밝기", brightness)]
          : null,
        !patient
          ? [
              button("단기권한 만료 체험", () => {
                action("expireToken");
                render();
              }),
              button("다운로드 시도", () => {
                action("download", { study: "ct" });
                render();
              }),
            ]
          : null,
        button("돌아가기", () => go(patient ? "records" : "doctor-records")),
      ),
      el(
        "div",
        { class: "viewer-note" },
        "공개된 합성 예시 이미지입니다. 체험판의 화면 차단은 실제 데이터 보안 통제를 대신하지 않습니다.",
      ),
    ),
    el(
      "div",
      { class: "actions" },
      button(
        patient ? "공유할 범위 선택" : "관제에서 접근 기록 보기",
        () => go(patient ? "share" : "security"),
        "primary",
      ),
    ),
  ];
}
function countsChart(events) {
  const t = totals(events),
    total = events.length;
  const donut = el(
    "div",
    {
      class: "donut",
      role: "img",
      "aria-label": `체험 이벤트 ${total}건: 허용 ${t.allowed}, 거부 ${t.denied}, 안내 ${t.info}`,
    },
    el(
      "div",
      { class: "donut-center" },
      el("strong", {}, total),
      el("small", {}, "체험 이벤트"),
    ),
  );
  const a = total ? (t.allowed / total) * 100 : 0,
    b = total ? ((t.allowed + t.denied) / total) * 100 : 0;
  donut.style.background = total
    ? `conic-gradient(#3264bd 0% ${a}%, #ce7569 ${a}% ${b}%, #aebed0 ${b}% 100%)`
    : "#e2e9f2";
  return el(
    "div",
    {},
    donut,
    el(
      "div",
      { class: "legend" },
      el("span", {}, `허용 ${t.allowed}`),
      el("span", {}, `거부 ${t.denied}`),
      el("span", {}, `안내 ${t.info}`),
    ),
  );
}
function bars(events) {
  const map = new Map();
  for (const e of events.filter((e) => e.result === "DENIED"))
    map.set(e.code, (map.get(e.code) || 0) + 1);
  const total = events.filter((e) => e.result === "DENIED").length;
  return [...map]
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => {
      const fill = el("div", { class: "bar-fill" });
      fill.style.width = `${(count / total) * 100}%`;
      return el(
        "div",
        { class: "bar-row" },
        el(
          "div",
          { class: "bar-label" },
          el("span", {}, reasons[code]?.[0] ?? code),
          el("b", {}, `${count}건`),
        ),
        el("div", { class: "bar-track" }, fill),
        el("small", { class: "muted" }, code),
      );
    });
}
function experiments() {
  return el(
    "div",
    { class: "experiments" },
    button("같은 QR 다시 사용", () => {
      action("receive");
      render();
    }),
    button("다른 병원이 요청", () => {
      action("receive", { hospital: "다른 병원" });
      render();
    }),
    button("요청 서명 누락", () => {
      action("proof");
      render();
    }),
    button("공유기간 종료", () => {
      action("expireConsent");
      action("renew", { study: s.consent?.study ?? "ct" });
      render();
    }),
  );
}
function security() {
  const t = totals(s.events);
  const metrics = el(
    "div",
    { class: "metrics" },
    [
      ["허용 이벤트", t.allowed],
      ["거부 이벤트", t.denied],
      ["상황 안내", t.info],
    ].map(([title, n]) =>
      el(
        "div",
        { class: "metric" },
        el("span", {}, title),
        el("strong", {}, n),
      ),
    ),
  );
  return [
    heading(
      "공유 뒤에 남는 기록.",
      "현재 탭에서 직접 만든 체험 이벤트만 집계합니다. 실제 운영 로그가 아닙니다.",
    ),
    el(
      "section",
      { class: "security-shell" },
      el("h2", {}, "체험 상황판"),
      p(
        "범위: 체험 시작부터 지금까지 · 집계 단위: 이벤트 · 요청 건수와 다릅니다.",
      ),
      metrics,
    ),
    el(
      "div",
      { class: "chart-grid" },
      panel("접근 결과", countsChart(s.events)),
      panel(
        "접근이 멈춘 이유",
        s.events.some((e) => e.result === "DENIED")
          ? bars(s.events)
          : p("아직 거부 이벤트가 없습니다. 아래 상황을 직접 만들어 보세요."),
      ),
    ),
    panel(
      "조건이 달라지면 어떻게 될까요?",
      p(
        "아래 버튼은 실패 상황을 만드는 체험 도구입니다. 실제 공격이나 서버 장애를 발생시키지 않습니다.",
        "small muted",
      ),
      experiments(),
      el(
        "div",
        { class: "actions" },
        button("샘플 티켓 준비", sample),
        button("이벤트 탐색기", () => go("events"), "primary"),
        button("기간 보고서 미리보기", () => report(s.events)),
        button("환자가 공유를 중단하면?", () => go("ticket")),
      ),
    ),
    el(
      "div",
      { class: "evidence" },
      el("h3", {}, "실제 구축 기록은 별도로 확인하세요"),
      p(
        "TLS·AES·WireGuard·Key Vault는 여기서 실행되지 않습니다. 실시간 연결 상태를 표시하지 않고, 포트폴리오에 보존한 구축 당시 자료로 설명합니다.",
      ),
      link("구축 당시 구성과 검증 범위 보기", "../#evidence"),
    ),
  ];
}
function eventList(events) {
  if (!events.length)
    return empty(
      "표시할 이벤트가 없어요",
      "기간·검색 조건을 바꾸거나 환자 공유부터 체험해 보세요.",
      button("환자 지갑 열기", () => go("patient")),
    );
  return el(
    "div",
    { class: "events" },
    [...events].reverse().map((e) =>
      el(
        "details",
        { class: "event" },
        el(
          "summary",
          {},
          pill(
            e.result === "DENIED"
              ? "거부"
              : e.result === "ALLOWED"
                ? "허용"
                : "안내",
            e.result === "DENIED"
              ? "red"
              : e.result === "ALLOWED"
                ? "green"
                : "",
          ),
          el("strong", {}, e.action),
          el("small", {}, time(e.at)),
          el("code", {}, e.id),
        ),
        el(
          "div",
          { class: "event-detail" },
          el("h3", {}, reasons[e.code]?.[0] ?? e.action),
          p(
            reasons[e.code]?.[1] ??
              "현재 탭의 시나리오 동작에 따라 생성된 체험 이벤트입니다.",
          ),
          details({
            "이벤트 코드": e.code,
            "연결 티켓": e.ticket,
            "기록 출처": "브라우저 체험 · 서버 로그 아님",
          }),
          button("이 이벤트 보고서 보기", () => report([e])),
        ),
      ),
    ),
  );
}
function events() {
  const search = el("input", {
      type: "search",
      placeholder: "예: QR, TOKEN_EXPIRED, DEMO-1",
      "aria-label": "이벤트 검색",
    }),
    filter = select("result", [
      ["ALL", "전체 결과"],
      ["ALLOWED", "허용"],
      ["DENIED", "거부"],
      ["INFO", "안내"],
    ]),
    period = select("period", [
      ["all", "체험 시작부터"],
      ["5", "최근 5분"],
      ["1", "최근 1분"],
    ]),
    list = el("div"),
    summary = el("p", { class: "small muted" });
  let filtered = [];
  function update() {
    filtered = s.events.filter(
      (e) =>
        (filter.value === "ALL" || e.result === filter.value) &&
        (period.value === "all" ||
          Date.now() - e.at <= Number(period.value) * 60000) &&
        `${e.action} ${e.code} ${e.ticket} ${reasons[e.code]?.[0] ?? ""}`
          .toLowerCase()
          .includes(search.value.trim().toLowerCase()),
    );
    list.replaceChildren(eventList(filtered));
    summary.textContent = `검색 결과 ${filtered.length}건 / 전체 체험 이벤트 ${s.events.length}건`;
  }
  search.addEventListener("input", update);
  filter.addEventListener("change", update);
  period.addEventListener("change", update);
  update();
  return [
    heading(
      "사건을 하나씩 살펴보세요.",
      "코드 옆에 쉬운 설명과 연결된 체험 티켓을 함께 표시합니다.",
    ),
    el(
      "div",
      { class: "event-tools" },
      el("label", {}, "검색", search),
      el("label", {}, "결과", filter),
      el("label", {}, "기간", period),
      button("검색 결과 보고서", () =>
        report(
          filtered,
          `${period.selectedOptions[0].text} / ${filter.selectedOptions[0].text} / 검색어: ${search.value || "없음"}`,
        ),
      ),
    ),
    summary,
    list,
  ];
}
function report(events, scope = "선택한 체험 이벤트 전체") {
  const copy = events.map((e) => ({ ...e }));
  modal(
    "Medi Q 체험 기록 보고서",
    el(
      "div",
      { class: "report" },
      el(
        "div",
        { class: "report-meta" },
        p("포트폴리오 시뮬레이션 · 실제 보안사건 보고서 아님"),
        p(`작성: ${time(Date.now())}`),
        p(`조회 조건: ${scope}`),
        p(
          copy.length
            ? `이벤트 시각: ${time(copy[0].at)} ~ ${time(copy.at(-1).at)}`
            : "조회된 이벤트 없음",
        ),
      ),
      countsChart(copy),
      el("div", { class: "report-bars" }, bars(copy)),
      el(
        "ol",
        { class: "report-events" },
        copy.map((e) =>
          el(
            "li",
            {},
            `${time(e.at)} · ${e.id} · ${e.action} · ${e.code} · ${e.ticket}`,
          ),
        ),
      ),
      el(
        "div",
        { class: "actions" },
        button("인쇄 / PDF로 저장", () => window.print(), "primary"),
      ),
    ),
  );
}
function render() {
  route = location.hash.slice(1);
  if (!routes.has(route)) route = "welcome";
  renderHeader();
  document.title = `Medi Q · ${role() === "welcome" ? "직접 체험하기" : role() === "patient" ? "환자 체험" : role() === "doctor" ? "의료진 체험" : "보안관제 체험"}`;
  main.replaceChildren();
  if (role() === "patient")
    main.append(
      nav([
        ["patient", "내 지갑"],
        ["records", "내 건강기록"],
        ["share", "영상 공유"],
        ["ticket", "공유 QR"],
        ["helper", "건강도우미"],
      ]),
    );
  if (role() === "doctor")
    main.append(
      nav([
        ["doctor", "접수데스크"],
        ["doctor-records", "환자기록"],
        ["doctor-viewer", "환자영상"],
      ]),
    );
  if (role() === "security")
    main.append(
      nav([
        ["security", "상황판"],
        ["events", "이벤트 탐색기"],
      ]),
    );
  const pages = {
    welcome,
    patient: patientHome,
    records,
    share,
    ticket,
    helper,
    doctor,
    "doctor-records": doctorRecords,
    "doctor-viewer": () => viewer(false),
    "patient-viewer": () => viewer(true),
    security,
    events,
  };
  main.append(...pages[route]());
}
document.querySelector(".skip").addEventListener("click", (e) => {
  e.preventDefault();
  main.focus();
});
window.addEventListener("hashchange", () => {
  if (dialog.open) dialog.close();
  render();
  main.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
});
setInterval(() => {
  if (
    route === "doctor-viewer" &&
    viewerWasAllowed &&
    (consentProblem(s) || Date.now() >= s.tokenUntil)
  ) {
    render();
    notify("열람 조건이 만료되었습니다. 다시 확인해 주세요.");
  }
}, 1000);
render();
