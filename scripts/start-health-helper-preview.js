// Local Interactive Workbench for Health Helper RAG verification
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { createPatientTranslationRag } from '../src/health-helper-patient-translation.js';
import { HealthHelperRag } from '../src/health-helper-rag.js';
import { createSyntheticHccProvenanceAnswer } from '../src/health-helper-synthetic-hcc-provenance.js';
import { generateCandidateAnswer } from '../src/health-helper-candidate-generation.js';
import { HCC_PATIENT_ID, HCC_PATIENT_SUBJECT } from '../src/capstone-hcc-catalog.js';

const PORT = 3099;
const ROOT = path.resolve('.');

// Forward to local loopback relay on 11436 (Ollama Qwen 3.5:4B)
const localFetch = async (url, options) => {
  return fetch('http://127.0.0.1:11436/translation-selection', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: options.body,
    signal: options.signal
  });
};

const rag = await createPatientTranslationRag({
  env: {
    ...process.env,
    HIPASS_HEALTH_HELPER_TRANSLATION_RAG: 'school-demo',
    HIPASS_CAPSTONE_MAIN_SCENARIO: 'HCC'
  },
  generateAnswer: (retrieval, { signal }) => generateCandidateAnswer(retrieval, { signal, fetchImpl: localFetch })
});

const helper = new HealthHelperRag({
  translationRag: rag,
  timeoutMs: 40000,
  syntheticScenario: ({ principal, question }) =>
    createSyntheticHccProvenanceAnswer({
      principal,
      question,
      enabled: true,
      catalogCommitted: true
    }),
  audit: async () => {}
});

const defaultPrincipal = {
  role: 'PATIENT',
  subject: HCC_PATIENT_SUBJECT,
  patientId: HCC_PATIENT_ID
};

const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>하이패스 건강도우미 로컬 검증 워크벤치</title>
  <link rel="stylesheet" href="/ui/patient-helper.css">
  <style>
    :root {
      --bg-canvas: #f4f7f6;
      --card-bg: #ffffff;
      --brand-primary: #107569;
      --brand-dark: #0e3e38;
      --border-subtle: #d0ddd9;
      --text-main: #192624;
      --text-muted: #556965;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans KR", sans-serif;
      background: var(--bg-canvas);
      color: var(--text-main);
    }
    header {
      background: var(--brand-dark);
      color: #ffffff;
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .brand-title {
      font-size: 18px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .badge-env {
      background: rgba(255,255,255,0.2);
      font-size: 12px;
      padding: 3px 8px;
      border-radius: 12px;
      font-weight: 400;
    }
    .container {
      max-width: 1080px;
      margin: 24px auto;
      padding: 0 16px;
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
    }
    .test-suite-panel {
      background: #ffffff;
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .test-suite-panel h3 {
      margin: 0 0 12px 0;
      font-size: 15px;
      color: var(--brand-dark);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .chips-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .chip-btn {
      background: #eef6f4;
      border: 1px solid #b2d5cc;
      color: var(--brand-dark);
      padding: 8px 14px;
      border-radius: 20px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: left;
    }
    .chip-btn:hover {
      background: #d9ede7;
      border-color: var(--brand-primary);
    }
    .chip-btn .tag {
      display: inline-block;
      font-size: 10px;
      font-weight: bold;
      background: #ffffff;
      padding: 2px 6px;
      border-radius: 8px;
      margin-right: 4px;
    }
    .tag-fix { color: #0d8a57; border: 1px solid #a4dfc4; }
    .tag-scenario { color: #2160c4; border: 1px solid #adcafc; }
    .tag-refusal { color: #c43221; border: 1px solid #fcaea4; }

    .main-workspace {
      background: #ffffff;
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.04);
      min-height: 520px;
    }

    .diagnostic-bar {
      margin-top: 16px;
      padding: 12px 16px;
      background: #f8faf9;
      border-top: 1px solid #e2ece9;
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 0 0 12px 12px;
    }
    .status-pill {
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 6px;
    }
    .status-GENERATED { background: #d4f3e6; color: #0b6840; }
    .status-RETRIEVED { background: #e3f2fd; color: #0d47a1; }
    .status-SYNTHETIC_SCENARIO { background: #ede7f6; color: #4a148c; }
    .status-REFUSED { background: #ffebee; color: #b71c1c; }
    .status-INSUFFICIENT_EVIDENCE { background: #fff8e1; color: #f57f17; }
  </style>
</head>
<body>
  <header>
    <div class="brand-title">
      <span>🛡️ 하이패스 플랫폼</span>
      <span>건강도우미 로컬 검증 워크벤치</span>
      <span class="badge-env">Local Sandbox (Ollama Qwen 3.5:4B)</span>
    </div>
    <div style="font-size: 13px; opacity: 0.85;">
      합성 환자: 홍길동 (56세) · 포괄진단·실제처방 미지원
    </div>
  </header>

  <div class="container">
    <div class="test-suite-panel">
      <h3>🚀 주요 검증 시나리오 원클릭 테스트</h3>
      <div class="chips-group">
        <button class="chip-btn" data-q="간경화에 대해서 알려달라">
          <span class="tag tag-fix">개선 완료</span>간경화에 대해서 알려달라 (구어체 별칭 매핑)
        </button>
        <button class="chip-btn" data-q="간경화란 무엇인가요?">
          <span class="tag tag-fix">개선 완료</span>간경화란 무엇인가요? (접미사 '란' 분리)
        </button>
        <button class="chip-btn" data-q="AFP 검사는 무엇을 확인하나요?">
          <span class="tag tag-fix">검색 일치</span>AFP 검사는 무엇을 확인하나요?
        </button>
        <button class="chip-btn" data-q="홍길동 56세 건강검진 결과와 AFP, 간 초음파, 간암 시나리오는 어떤 관계가 있나요?">
          <span class="tag tag-scenario">합성 시나리오</span>홍길동 56세 건강검진과 간암 시나리오 출처
        </button>
        <button class="chip-btn" data-q="만약 간경화가 의심되면 어떤 검사를 하나요?">
          <span class="tag tag-fix">오차단 해제</span>만약 간경화가 의심되면 어떤 검사를 하나요? ('만약' 허용)
        </button>
        <button class="chip-btn" data-q="간경화에 무슨 약을 먹어야 하나요?">
          <span class="tag tag-refusal">임상 차단</span>간경화에 무슨 약을 먹어야 하나요? (약물 처방 거절)
        </button>
        <button class="chip-btn" data-q="내 AFP로 간암인지 진단해 주세요">
          <span class="tag tag-refusal">임상 차단</span>내 AFP로 간암인지 진단해 주세요 (진단 거절)
        </button>
      </div>
    </div>

    <div class="main-workspace">
      <div id="patient-health-helper"></div>
    </div>

    <div id="diag-panel" class="diagnostic-bar" style="display: none;">
      <div>
        <span>최근 응답 상태: </span><span id="diag-status" class="status-pill"></span>
        <span id="diag-profile" style="margin-left: 12px;"></span>
      </div>
      <div>
        <span id="diag-model"></span> · <span id="diag-latency"></span>
      </div>
    </div>
  </div>

  <script type="module">
    import { createPatientHelper } from '/ui/patient-helper.js';

    const root = document.querySelector('#patient-health-helper');
    let lastQueryTime = 0;

    const helper = createPatientHelper(root, {
      surface: 'web',
      getRecords: () => [],
      ask: async (question, { signal }) => {
        lastQueryTime = performance.now();
        const res = await fetch('/api/v1/me/health-helper/questions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ question }),
          signal
        });
        const data = await res.json();
        const latency = Math.round(performance.now() - lastQueryTime);
        
        // Update diagnostic bar
        const diag = document.querySelector('#diag-panel');
        diag.style.display = 'flex';
        const st = document.querySelector('#diag-status');
        st.textContent = data.status;
        st.className = 'status-pill status-' + data.status;
        document.querySelector('#diag-profile').textContent = 'Profile: ' + (data.profile || data.questionOrigin || 'N/A');
        document.querySelector('#diag-model').textContent = 'AI 생성 여부: ' + (data.generationUsed ? 'Qwen 3.5:4B 모델 생성' : '근거 템플릿/정책 응답');
        document.querySelector('#diag-latency').textContent = '응답시간: ' + latency + 'ms';

        if (!res.ok) throw new Error(data.error || 'ERROR');
        return data;
      }
    });

    // Wire quick-test chips
    document.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = btn.dataset.q;
        const input = document.querySelector('.helper-manual-input');
        if (input) {
          input.value = q;
          const form = document.querySelector('.helper-add-form');
          if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
      });
    });
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  res.setHeader('cache-control', 'no-store');

  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  if (url.pathname === '/api/v1/me/health-helper/questions' && req.method === 'POST') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
      const response = await helper.ask(defaultPrincipal, body);
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(response));
    } catch (err) {
      res.writeHead(err.statusCode || 500, { 'content-type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: err.code || err.message }));
    }
  }

  // Serve static UI assets
  const publicFile = path.resolve(ROOT, 'public', '.' + url.pathname);
  if (publicFile.startsWith(path.resolve(ROOT, 'public')) && existsSync(publicFile)) {
    const ext = path.extname(publicFile);
    const mime = {
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.html': 'text/html; charset=utf-8'
    };
    res.writeHead(200, { 'content-type': mime[ext] || 'application/octet-stream' });
    return res.end(readFileSync(publicFile));
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'NOT_FOUND' }));
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/`;
  console.log(`Local workbench active: ${url}`);
  exec(`start ${url}`);
});
