// ==========================================================================
// HiPass Platform - 3-Minute Interactive Video Showcase Engine
// Automated Guided Demonstration with Real-time UI Driving & TTS Narration
// ==========================================================================

export const showcaseScenes = [
  {
    id: 1,
    duration: 12000,
    title: "01. 문제 제기 : 왜 CD 없는 의료영상 교류인가?",
    badge: "기존 CD 발급의 한계",
    tags: ["#CD발급비효율", "#개인정보분실위험", "#진료단절해소"],
    narration: "현재 환자들은 병원을 옮길 때마다 CD를 발급받아 직접 들고 이동해야 합니다. CD 분실 시 민감한 영상 정보가 유출되며, 병원 간 진료 연속성이 단절됩니다. 하이패스는 이를 클라우드로 혁신합니다.",
    action: (app) => {
      app.switchPersona?.("PATIENT");
      app.navigatePatientPage?.("home");
    },
  },
  {
    id: 2,
    duration: 15000,
    title: "02. 환자 안심 열람 : 내 영상 직접 확인 & 포렌식 워터마크",
    badge: "환자 중심 권리 보장",
    tags: ["#MultiSlice단면탐색", "#Cine연속재생", "#포렌식워터마크", "#VIEW_ONLY"],
    narration: "하이패스에서는 환자가 병원 방문 전 스마트폰이나 PC에서 뇌 MRI와 흉부 CT를 직접 단면 슬라이스로 탐색하고 Cine 동영상으로 확인할 수 있습니다. 캡처 유출 방지 워터마크가 기본 각인됩니다.",
    action: (app) => {
      app.switchPersona?.("PATIENT");
      app.navigatePatientPage?.("images");
      const firstStudyUid = "1.2.410.100.1.20260620.001";
      setTimeout(() => {
        app.openPatientStudyViewer?.(firstStudyUid);
      }, 600);
    },
  },
  {
    id: 3,
    duration: 14000,
    title: "03. 환자 주도적 통제 : 1회용 안심 QR 티켓 발급",
    badge: "세분화된 ABAC 동의",
    tags: ["#환자주도동의", "#1회용QR티켓", "#FailClosed", "#ZeroPlaintext"],
    narration: "환자가 수신 병원(B대학병원), 진료 목적, 유효기간, 열람 권한을 직접 선택하여 동의하면, 영상 원본이나 개인정보가 전혀 들어있지 않은 1회용 참조 QR 티켓이 발급됩니다.",
    action: (app) => {
      document.querySelector("#btn-close-patient-viewer")?.click();
      app.switchPersona?.("PATIENT");
      app.navigatePatientPage?.("activity");
    },
  },
  {
    id: 4,
    duration: 14000,
    title: "04. 병원 SaaS 콘솔 : 1초 QR 현장 접수 & 11단계 정책 검증",
    badge: "초고속 인가 & 파이프라인",
    tags: ["#11단계ABAC", "#DPoP단기토큰", "#FailClosed", "#ZeroWAF자립"],
    narration: "B대학병원 진료실에서 웹캠으로 환자의 QR을 스캔하는 즉시, 서버가 동의 유효성, 유효시간, 의사 소속, 병원 일치 등 11단계 정책을 Fail-Closed로 검증하고 5분 단기 DPoP 토큰을 발급합니다.",
    action: (app) => {
      document.querySelector("#btn-close-patient-viewer")?.click();
      app.switchPersona?.("DOCTOR");
      app.navigateHospitalScreen?.("qr");
      setTimeout(() => {
        document.querySelector("#btn-simulate-qr-scan")?.click();
      }, 700);
    },
  },
  {
    id: 5,
    duration: 15000,
    title: "05. 전문 Cloud DICOM 뷰어 : WADO-RS 온디맨드 스트리밍",
    badge: "온디맨드 최소 전송",
    tags: ["#DICOMweb", "#WADO_RS", "#WindowLevel프리셋", "#5분타이머"],
    narration: "전체 수백 메가바이트를 다운로드하지 않고, 필요한 슬라이스만 WADO-RS로 즉시 스트리밍합니다. 폐, 뼈, 뇌 연조직 프리셋과 Cine 연속 재생이 지원되며, 5분 유효시간 타이머가 안전을 지킵니다.",
    action: (app) => {
      app.switchPersona?.("DOCTOR");
      app.navigateHospitalScreen?.("viewer");
      setTimeout(() => {
        document.querySelector("#tool-ww-wl")?.click();
      }, 800);
    },
  },
  {
    id: 6,
    duration: 15000,
    title: "06. 원내 PACS 암호화 & SHA-256 불변 감사로그",
    badge: "Security by Design",
    tags: ["#AES256GCM", "#Envelope암호화", "#불변감사체인", "#능동위협격리"],
    narration: "전송된 영상은 B병원 원내 PACS에 AES-256-GCM 봉투 암호화로 안전하게 보관되며, 모든 접근 행위는 블록체인형 SHA-256 해시 체인 감사로그에 영구 보존됩니다. 이상행위 탐지 시 능동 격리가 가동됩니다.",
    action: (app) => {
      app.switchPersona?.("DOCTOR");
      app.navigateHospitalScreen?.("audit");
    },
  },
  {
    id: 7,
    duration: 12000,
    title: "07. 결론 : 228개 보안 테스트 100% 통과, 안전한 의료영상 교류의 표준",
    badge: "검증 완료 완료보고",
    tags: ["#228TestsPass", "#환자알권리", "#의료컴플라이언스", "#HiPassPlatform"],
    narration: "228개 보안 테스트 100% 통과. 환자의 알 권리와 병원의 보안을 완벽히 양립시킨 대한민국 표준 의료영상 교류 플랫폼, 하이패스입니다.",
    action: (app) => {
      app.switchPersona?.("DOCTOR");
      app.navigateHospitalScreen?.("exchange");
    },
  },
];

class VideoShowcaseController {
  constructor() {
    this.currentSceneIdx = 0;
    this.isPlaying = false;
    this.timer = null;
    this.progressInterval = null;
    this.speechEnabled = true;
    this.speechSynthesis = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
    this.elapsedInScene = 0;
  }

  init() {
    this.injectOverlayMarkup();
    this.bindEvents();
  }

  injectOverlayMarkup() {
    if (document.querySelector("#video-showcase-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "video-showcase-overlay";
    overlay.className = "video-showcase-backdrop";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="video-showcase-cinema" role="dialog" aria-modal="true" aria-label="3분 인터랙티브 비디오 쇼케이스">
        <!-- Top Video Bar -->
        <header class="vshow-header">
          <div class="vshow-brand">
            <span class="vshow-live-dot">● REC</span>
            <strong style="color:#38bdf8;">HiPass Platform</strong>
            <span class="vshow-sub">· 3분 인터랙티브 시연 쇼케이스</span>
          </div>

          <div class="vshow-scene-indicator">
            <span id="vshow-scene-counter">Scene 1 / 7</span>
            <span class="vshow-badge" id="vshow-scene-badge">기존 방식의 한계</span>
          </div>

          <div class="vshow-header-actions">
            <button id="vshow-btn-tts" class="vshow-btn vshow-btn-icon active" type="button" title="나레이션 음성 켜기/끄기">
              <span id="vshow-tts-icon">🔊</span>
              <span id="vshow-tts-text">음성 ON</span>
            </button>
            <button id="vshow-btn-close" class="vshow-btn vshow-btn-close" type="button" title="쇼케이스 닫기">✕ 닫기</button>
          </div>
        </header>

        <!-- Progress Track -->
        <div class="vshow-progress-track">
          <div id="vshow-progress-fill" class="vshow-progress-fill"></div>
        </div>

        <!-- Cinema Floating HUD Overlay (Live Controls) -->
        <div class="vshow-bottom-hud">
          <div class="vshow-meta-row">
            <h3 id="vshow-scene-title" class="vshow-title">01. 문제 제기 : 왜 CD 없는 의료영상 교류인가?</h3>
            <div id="vshow-tags" class="vshow-tags">
              <span class="vshow-tag">#기존CD한계</span>
            </div>
          </div>

          <!-- Subtitle Box -->
          <div class="vshow-subtitle-box">
            <p id="vshow-subtitle-text" class="vshow-subtitle-text">
              현재 병원을 옮길 때마다 CD를 발급받아 직접 들고 이동해야 합니다...
            </p>
          </div>

          <!-- Video Controls Row -->
          <div class="vshow-playback-row">
            <button id="vshow-btn-prev" class="vshow-control-btn" type="button" title="이전 씬">⏮ 이전</button>
            <button id="vshow-btn-play" class="vshow-control-btn vshow-play-main" type="button" title="재생 / 일시정지">⏸ 일시정지</button>
            <button id="vshow-btn-next" class="vshow-control-btn" type="button" title="다음 씬">다음 ⏭</button>
            <div class="vshow-timeline-dots" id="vshow-timeline-dots"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Floating Launch Button on bottom-right of page
    const launcher = document.createElement("button");
    launcher.id = "btn-launch-video-showcase";
    launcher.className = "video-showcase-launcher";
    launcher.type = "button";
    launcher.innerHTML = `
      <span class="vshow-launcher-icon">🎬</span>
      <span class="vshow-launcher-label"><strong>3분 영상 시연</strong><small>자동 쇼케이스</small></span>
    `;
    document.body.appendChild(launcher);
  }

  bindEvents() {
    document.querySelector("#btn-launch-video-showcase")?.addEventListener("click", () => this.start());
    document.querySelectorAll("[data-launch-showcase]").forEach((btn) => {
      btn.addEventListener("click", () => this.start());
    });

    document.querySelector("#vshow-btn-close")?.addEventListener("click", () => this.stop());
    document.querySelector("#vshow-btn-play")?.addEventListener("click", () => this.togglePlay());
    document.querySelector("#vshow-btn-prev")?.addEventListener("click", () => this.prevScene());
    document.querySelector("#vshow-btn-next")?.addEventListener("click", () => this.nextScene());

    document.querySelector("#vshow-btn-tts")?.addEventListener("click", () => {
      this.speechEnabled = !this.speechEnabled;
      const icon = document.querySelector("#vshow-tts-icon");
      const text = document.querySelector("#vshow-tts-text");
      const btn = document.querySelector("#vshow-btn-tts");
      if (this.speechEnabled) {
        if (icon) icon.textContent = "🔊";
        if (text) text.textContent = "음성 ON";
        btn?.classList.add("active");
        this.speakCurrentSubtitle();
      } else {
        if (icon) icon.textContent = "🔇";
        if (text) text.textContent = "음성 OFF";
        btn?.classList.remove("active");
        this.cancelSpeech();
      }
    });

    // Render timeline dots
    const dotsContainer = document.querySelector("#vshow-timeline-dots");
    if (dotsContainer) {
      dotsContainer.innerHTML = showcaseScenes
        .map((_, i) => `<button class="vshow-dot ${i === 0 ? "active" : ""}" data-scene-dot="${i}" type="button" title="Scene ${i + 1}"></button>`)
        .join("");

      dotsContainer.querySelectorAll("[data-scene-dot]").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.jumpToScene(Number(btn.dataset.sceneDot));
        });
      });
    }
  }

  start() {
    const overlay = document.querySelector("#video-showcase-overlay");
    if (!overlay) return;
    overlay.hidden = false;
    overlay.classList.add("active");
    this.currentSceneIdx = 0;
    this.isPlaying = true;
    this.renderCurrentScene();
  }

  stop() {
    const overlay = document.querySelector("#video-showcase-overlay");
    if (overlay) {
      overlay.hidden = true;
      overlay.classList.remove("active");
    }
    this.isPlaying = false;
    if (this.timer) clearTimeout(this.timer);
    if (this.progressInterval) clearInterval(this.progressInterval);
    this.cancelSpeech();
  }

  togglePlay() {
    const playBtn = document.querySelector("#vshow-btn-play");
    if (this.isPlaying) {
      this.isPlaying = false;
      if (this.timer) clearTimeout(this.timer);
      if (this.progressInterval) clearInterval(this.progressInterval);
      this.cancelSpeech();
      if (playBtn) playBtn.textContent = "▶ 재생";
    } else {
      this.isPlaying = true;
      if (playBtn) playBtn.textContent = "⏸ 일시정지";
      this.scheduleNextScene(showcaseScenes[this.currentSceneIdx].duration - this.elapsedInScene);
      this.speakCurrentSubtitle();
    }
  }

  jumpToScene(idx) {
    if (idx < 0 || idx >= showcaseScenes.length) return;
    this.currentSceneIdx = idx;
    this.renderCurrentScene();
  }

  prevScene() {
    if (this.currentSceneIdx > 0) {
      this.currentSceneIdx--;
      this.renderCurrentScene();
    }
  }

  nextScene() {
    if (this.currentSceneIdx < showcaseScenes.length - 1) {
      this.currentSceneIdx++;
      this.renderCurrentScene();
    } else {
      this.stop();
    }
  }

  renderCurrentScene() {
    if (this.timer) clearTimeout(this.timer);
    if (this.progressInterval) clearInterval(this.progressInterval);
    this.elapsedInScene = 0;

    const scene = showcaseScenes[this.currentSceneIdx];
    if (!scene) return;

    // 1. Update UI Elements
    const counter = document.querySelector("#vshow-scene-counter");
    const badge = document.querySelector("#vshow-scene-badge");
    const title = document.querySelector("#vshow-scene-title");
    const tags = document.querySelector("#vshow-tags");
    const sub = document.querySelector("#vshow-subtitle-text");
    const playBtn = document.querySelector("#vshow-btn-play");

    if (counter) counter.textContent = `Scene ${scene.id} / ${showcaseScenes.length}`;
    if (badge) badge.textContent = scene.badge;
    if (title) title.textContent = scene.title;
    if (tags) {
      tags.innerHTML = scene.tags.map((t) => `<span class="vshow-tag">${t}</span>`).join(" ");
    }
    if (sub) sub.textContent = scene.narration;
    if (playBtn) playBtn.textContent = "⏸ 일시정지";

    // Update dots
    document.querySelectorAll(".vshow-dot").forEach((d, i) => {
      d.classList.toggle("active", i === this.currentSceneIdx);
    });

    // 2. Trigger application live action
    try {
      const appRef = window.app || window;
      scene.action(appRef);
    } catch (err) {
      console.warn("Scene action trigger failed:", err);
    }

    // 3. Audio Narration (TTS)
    this.speakCurrentSubtitle();

    // 4. Progress bar and next scene timer
    const progressFill = document.querySelector("#vshow-progress-fill");
    const totalDuration = scene.duration;
    const intervalMs = 100;

    this.progressInterval = setInterval(() => {
      if (!this.isPlaying) return;
      this.elapsedInScene += intervalMs;
      const pct = Math.min(100, (this.elapsedInScene / totalDuration) * 100);
      if (progressFill) progressFill.style.width = `${pct}%`;
    }, intervalMs);

    this.scheduleNextScene(totalDuration);
  }

  scheduleNextScene(duration) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (this.isPlaying) {
        this.nextScene();
      }
    }, Math.max(1000, duration));
  }

  speakCurrentSubtitle() {
    if (!this.speechEnabled || !this.speechSynthesis) return;
    this.cancelSpeech();
    const scene = showcaseScenes[this.currentSceneIdx];
    if (!scene?.narration) return;

    try {
      const utterance = new SpeechSynthesisUtterance(scene.narration);
      utterance.lang = "ko-KR";
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      this.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("TTS narration playback not supported or interrupted:", e);
    }
  }

  cancelSpeech() {
    if (this.speechSynthesis) {
      try {
        this.speechSynthesis.cancel();
      } catch {}
    }
  }
}

// Auto-initialize on DOM ready
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    window.videoShowcase = new VideoShowcaseController();
    window.videoShowcase.init();
  });
}
