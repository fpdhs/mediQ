// Pass this function to playwright-cli run-code while the standalone /demo/ is open.
// No Azure, credentials, camera, or server APIs are involved.
async (page) => {
  const errors = [],
    requests = [],
    results = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => requests.push(r.url()));
  const base = page.url().split("#")[0];
  const btn = (name) => page.getByRole("button", { name, exact: true });
  const ensure = (ok, message) => {
    if (!ok) throw Error(message);
    results.push(message);
  };
  // Hide transient toast only in layout captures so it does not obscure the UI.
  const shot = (name) =>
    page.screenshot({
      path: `output/playwright/portfolio-demo-${name}.png`,
      fullPage: true,
      style: "#notice { visibility: hidden !important; }",
    });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base);
  await btn("환자로 체험하기").click();
  await page.getByRole("heading", { name: "홍길동님의 건강지갑" }).waitFor();
  ensure(
    (await page.locator(".wallet .leather").getAttribute("src")) ===
      "assets/wallet-home-front.webp",
    "LATEST_HOME_WALLET_ASSET",
  );
  for (const width of [1440, 768, 521, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [index, target] of [
      "ticket",
      "records",
      "share",
      "helper",
    ].entries()) {
      await page.goto(`${base}#patient`);
      const card = page.locator(".wallet-card").nth(index);
      // Click the visible title, not the part tucked under the leather front.
      await card.locator("strong").click();
      await page.waitForURL(`${base}#${target}`);
      ensure(true, `WALLET_CARD_${target}_${width}`);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}#patient`);
  await shot("patient");
  await btn("영상 공유").click();
  await page.getByRole("checkbox").check();
  await btn("조건 확인하고 QR 만들기").click();
  await page.getByRole("heading", { name: "병원에 보여줄 나의 QR" }).waitFor();
  ensure((await page.locator("canvas").count()) === 1, "QR_CANVAS");
  await shot("ticket");
  await btn("의료진은 어떻게 받을까요?").click();
  await shot("doctor");
  await btn("체험 티켓 불러오기").click();
  await btn("환자영상 열기").click();
  await btn("열람권한 다시 확인").click();
  await page.getByAltText("비임상 합성 복부 CT 예시 이미지 1장").waitFor();
  ensure(
    (await page.getByRole("slider", { name: "영상 확대" }).count()) === 1,
    "AUTHORIZED_VIEW",
  );
  await shot("viewer");
  await btn("단기권한 만료 체험").click();
  ensure(
    (await page.getByAltText("비임상 합성 복부 CT 예시 이미지 1장").count()) ===
      0,
    "TOKEN_EXPIRED_HIDES_IMAGE",
  );
  await btn("열람권한 다시 확인").click();
  await page.getByAltText("비임상 합성 복부 CT 예시 이미지 1장").waitFor();
  await btn("다운로드 시도").click();
  await btn("관제에서 접근 기록 보기").click();
  await page.getByRole("heading", { name: "공유 뒤에 남는 기록." }).waitFor();
  await btn("같은 QR 다시 사용").click();
  await btn("다른 병원이 요청").click();
  await btn("요청 서명 누락").click();
  await shot("security");
  await page
    .getByRole("navigation", { name: "화면 메뉴" })
    .getByRole("button", { name: "이벤트 탐색기", exact: true })
    .click();
  await page
    .getByRole("searchbox", { name: "이벤트 검색" })
    .fill("TICKET_ALREADY_USED");
  ensure((await page.locator(".event").count()) === 1, "SEARCH_EXACT_EVENT");
  await page.locator(".event summary").click();
  await shot("event");
  await btn("검색 결과 보고서").click();
  ensure(
    (await page.locator("dialog[open] .report-events li").count()) === 1,
    "REPORT_FILTER_SNAPSHOT",
  );
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: "output/playwright/portfolio-demo-report.pdf",
    format: "A4",
    printBackground: true,
  });
  await page.emulateMedia({ media: "screen" });
  await btn("닫기").click();
  await btn("환자").click();
  await btn("공유 QR").click();
  await btn("공유 중단").click();
  await btn("공유 중단 확인").click();
  ensure((await page.locator("canvas").count()) === 0, "REVOKED_QR_REMOVED");
  await btn("의료진").click();
  await btn("환자영상").click();
  await btn("열람권한 다시 확인").click();
  ensure(
    (await page.getByAltText("비임상 합성 복부 CT 예시 이미지 1장").count()) ===
      0,
    "REVOKED_RENEWAL_DENIED",
  );
  await btn("환자").click();
  await btn("건강도우미").click();
  await btn("질문 담기").first().click();
  ensure(
    (await page.locator(".question").count()) === 2,
    "SAVED_QUESTION_REMOVED",
  );
  ensure(
    (await page.locator(".shelf-card").count()) === 1,
    "SAVED_QUESTION_SHELF",
  );
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const target of [
      "patient",
      "share",
      "ticket",
      "doctor",
      "doctor-records",
      "doctor-viewer",
      "security",
      "events",
      "helper",
      "welcome",
    ]) {
      await page.evaluate((hash) => {
        location.hash = hash;
      }, target);
      await page.waitForFunction(
        (hash) => location.hash === "#" + hash,
        target,
      );
      // Browser hashchange rendering is synchronous; wait for two animation frames.
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      ensure(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `NO_OVERFLOW_${target}_${width}`,
      );
      if (
        width === 390 &&
        ["patient", "doctor", "security", "welcome"].includes(target)
      )
        await shot(`${target}-mobile`);
      if (target === "patient") {
        ensure(
          (await page.locator(".wallet-card").count()) === 4,
          `FOUR_WALLET_CARDS_${width}`,
        );
        await page.locator(".wallet-card").first().click();
        await page
          .getByRole("heading", { name: "병원에 보여줄 나의 QR" })
          .waitFor();
      }
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await btn("환자로 체험하기").click();
  ensure(
    (await page
      .locator(".wallet-card")
      .first()
      .evaluate((n) => getComputedStyle(n).transitionDuration)) === "0s",
    "REDUCED_MOTION",
  );
  ensure(errors.length === 0, "NO_PAGE_ERRORS");
  ensure(
    requests.every(
      (url) =>
        new URL(url).origin === new URL(base).origin || url.startsWith("data:"),
    ),
    "NO_EXTERNAL_REQUESTS",
  );
  return { status: "PASS", checks: results.length, results, errors, base };
};
