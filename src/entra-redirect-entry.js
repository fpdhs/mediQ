import { broadcastResponseToMainFrame } from "@azure/msal-browser/redirect-bridge";

void broadcastResponseToMainFrame().catch(() => {
  document.body.textContent = "로그인 응답을 확인하지 못했습니다. 창을 닫고 다시 시도해 주세요.";
});
