import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createState,
  act,
  consentProblem,
  totals,
  status,
} from "../docs/demo/model.js";
const t = 1000000;
function ready(study = "ct") {
  const s = createState();
  act(s, "create", { study, hospital: "B병원", days: 1 }, t);
  return s;
}
test("portfolio happy path links consent, ticket, reception, token and view", () => {
  const s = ready();
  assert.equal(act(s, "receive", {}, t).ok, true);
  assert.equal(act(s, "renew", { study: "ct" }, t).ok, true);
  assert.equal(act(s, "view", { study: "ct" }, t + 1).ok, true);
  assert.equal(s.events.length, 5);
  assert.equal(new Set(s.events.map((e) => e.ticket)).size, 1);
});
test("ticket reuse and other hospital deny without altering reception", () => {
  const s = ready();
  assert.equal(
    act(s, "receive", { hospital: "C병원" }, t).code,
    "HOSPITAL_MISMATCH",
  );
  assert.equal(s.consent.used, false);
  act(s, "receive", {}, t);
  assert.equal(act(s, "receive", {}, t).code, "TICKET_ALREADY_USED");
});
test("expired token can renew only while consent remains active", () => {
  const s = ready();
  act(s, "receive", {}, t);
  act(s, "renew", { study: "ct" }, t);
  assert.equal(
    act(s, "view", { study: "ct" }, t + 300000).code,
    "TOKEN_EXPIRED",
  );
  assert.equal(act(s, "renew", { study: "ct" }, t + 300000).ok, true);
  act(s, "revoke", {}, t + 300001);
  assert.equal(
    act(s, "view", { study: "ct" }, t + 300002).code,
    "CONSENT_REVOKED",
  );
  assert.equal(
    act(s, "renew", { study: "ct" }, t + 300002).code,
    "CONSENT_REVOKED",
  );
});
test("expiry, no consent, no reception, scope and downloads fail closed in simulation", () => {
  assert.equal(
    act(createState(), "view", { study: "ct" }, t).code,
    "NO_CONSENT",
  );
  const s = ready();
  assert.equal(act(s, "renew", { study: "ct" }, t).code, "RECEPTION_REQUIRED");
  act(s, "receive", {}, t);
  assert.equal(act(s, "renew", { study: "checkup" }, t).code, "SCOPE_MISMATCH");
  assert.equal(
    act(s, "download", { study: "ct" }, t).code,
    "DOWNLOAD_NOT_ALLOWED",
  );
  assert.equal(
    act(s, "renew", { study: "ct" }, t + 86400000).code,
    "CONSENT_EXPIRED",
  );
});
test("checkup is a separate scope and cannot open CT", () => {
  const s = ready("checkup");
  act(s, "receive", {}, t);
  assert.equal(act(s, "renew", { study: "ct" }, t).code, "SCOPE_MISMATCH");
  assert.equal(act(s, "renew", { study: "checkup" }, t).ok, true);
});
test("replacement ticket invalidates old token and preserves event history", () => {
  const s = ready();
  act(s, "receive", {}, t);
  act(s, "renew", { study: "ct" }, t);
  assert.equal(
    act(s, "create", { study: "ct", hospital: "B병원", days: 3 }, t).code,
    "ACTIVE_TICKET_EXISTS",
  );
  act(s, "revoke", {}, t);
  const old = s.consent.id;
  act(s, "create", { study: "ct", hospital: "B병원", days: 3 }, t + 1);
  assert.notEqual(s.consent.id, old);
  assert.equal(s.tokenUntil, 0);
  assert.equal(s.consent.used, false);
  assert.ok(s.events.some((e) => e.ticket === old));
});
test("only fixed synthetic selections accepted and all count denominators explicit", () => {
  const s = createState();
  assert.throws(() =>
    act(s, "create", { study: "<script>", hospital: "B병원", days: 1 }, t),
  );
  act(s, "proof", {}, t);
  assert.deepEqual(totals(s.events), { allowed: 0, denied: 1, info: 0 });
  assert.equal(consentProblem(s, t), "NO_CONSENT");
  assert.equal(status(s, t), "아직 공유하지 않음");
});
test("standalone static demo has no API transports, HTML injection or browser credentials", async () => {
  const app = await readFile(
      new URL("../docs/demo/app.js", import.meta.url),
      "utf8",
    ),
    html = await readFile(
      new URL("../docs/demo/index.html", import.meta.url),
      "utf8",
    );
  assert.doesNotMatch(
    app,
    /innerHTML|fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document\.cookie|login\.microsoftonline|cloudapp\.azure/,
  );
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /실제 로그인·병원 전송·AI 호출 없음/);
});
