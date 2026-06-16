import { expect, test } from "@playwright/test";

async function setRange(page, device, value) {
  const slider = page.locator(`[data-level-device="${device}"]`);
  await slider.focus();
  await slider.evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
  return slider;
}

async function getRootVariable(page, name) {
  return page.evaluate(
    (variableName) => getComputedStyle(document.documentElement).getPropertyValue(variableName).trim(),
    name,
  );
}

test.describe("Layered realistic control room", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/voice/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          service: "degraded",
          modelReady: false,
          asrConfigured: false,
          ffmpegReady: false,
          enrolled: false,
          threshold: 0.55,
          samplePhrase: "打开客厅灯并关闭风扇",
          message: "测试环境未启动真实语音模型",
        }),
      });
    });
    await page.goto("/app/");
  });

  test("loads the fixed-ratio stage and independent device layers", async ({ page }) => {
    await expect(page.locator(".scene-light-layer .scene-frame")).toHaveCount(2);
    await expect(page.locator(".curtain-system .scene-frame")).toHaveCount(2);
    await expect(page.locator(".ac-body")).toHaveCount(2);
    await expect(page.locator(".photo-fan-body")).toBeVisible();
    await expect(page.locator(".photo-fan-rotor-window")).toBeVisible();
    await expect(page.locator(".photo-fan-rotor")).toBeVisible();
    await expect(page.locator(".photo-fan-grille")).toBeVisible();
    await expect(page.locator(".device-callout")).toHaveCount(4);
    await expect(page.locator("#startVoiceButton")).toBeDisabled();
    await expect(page.locator("#enrollVoiceprintButton")).toBeDisabled();

    const geometry = await page.evaluate(() => {
      const room = document.querySelector(".room-scene").getBoundingClientRect();
      const simulation = document.querySelector(".simulation-wrap").getBoundingClientRect();
      const imagesReady = [...document.querySelectorAll(".room-scene img")]
        .every((image) => image.complete && image.naturalWidth > 0);
      return {
        imagesReady,
        roomHeight: room.height,
        roomWidth: room.width,
        simulationHeight: simulation.height,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    expect(geometry.imagesReady).toBe(true);
    expect(geometry.roomHeight).toBeGreaterThan(350);
    expect(geometry.roomWidth / geometry.roomHeight).toBeCloseTo(1672 / 941, 2);
    expect(geometry.simulationHeight).toBeLessThan(760);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
  });

  test("keeps the light slider focused while real lighting frames interpolate", async ({ page }) => {
    const slider = page.locator('[data-level-device="light"]');
    await slider.evaluate((element) => {
      element.dataset.identityProbe = "stable";
    });

    for (const value of [0, 50, 100]) {
      await setRange(page, "light", value);
      await expect(page.locator("#lightLevel")).toHaveText(`${value}%`);
      await expect(slider).toBeFocused();
      await expect(slider).toHaveAttribute("data-identity-probe", "stable");
      await expect(page.locator("#sceneLightFrameA")).toHaveAttribute(
        "data-frame-source",
        new RegExp(`room-night-${String(value).padStart(3, "0")}`),
      );
      await expect(page.locator("#sceneLightFrameB")).toHaveCSS("opacity", "0");
    }

    await setRange(page, "light", 37);
    await expect(page.locator("#sceneLightFrameA")).toHaveAttribute("data-frame-source", /room-night-025/);
    await expect(page.locator("#sceneLightFrameB")).toHaveAttribute("data-frame-source", /room-night-050/);
    expect(Number(await getRootVariable(page, "--light-frame-mix"))).toBeCloseTo(0.48, 2);
  });

  test("maps curtains, fan, and air conditioner to physical visual layers", async ({ page }) => {
    for (const value of [0, 50, 100]) {
      await setRange(page, "curtain", value);
      await expect(page.locator("#curtainFrameA")).toHaveAttribute(
        "data-frame-source",
        new RegExp(`curtain-${String(value).padStart(3, "0")}`),
      );
      await expect(page.locator("#curtainFrameA")).toHaveCSS("transform", "none");
    }

    await setRange(page, "fan", 0);
    await expect(page.locator(".fan-callout")).toHaveAttribute("aria-pressed", "false");
    await setRange(page, "fan", 5);
    expect(await getRootVariable(page, "--fan-spin-duration")).toBe("0.83s");
    await setRange(page, "fan", 10);
    expect(await getRootVariable(page, "--fan-spin-duration")).toBe("0.30s");

    const fanGeometry = await page.evaluate(() => {
      const body = document.querySelector(".photo-fan-body");
      const rotor = document.querySelector(".photo-fan-rotor");
      const rotorWindow = document.querySelector(".photo-fan-rotor-window");
      const grille = document.querySelector(".photo-fan-grille");
      const rotorStyle = getComputedStyle(rotor);
      const windowStyle = getComputedStyle(rotorWindow);
      const windowRect = rotorWindow.getBoundingClientRect();
      const rotations = [0, 90, 180, 270].map((angle) => {
        rotor.style.animation = "none";
        rotor.style.transform = `rotate(${angle}deg)`;
        const rect = rotor.getBoundingClientRect();
        return {
          angle,
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2,
          windowCenterX: windowRect.left + windowRect.width / 2,
          windowCenterY: windowRect.top + windowRect.height / 2,
        };
      });
      rotor.style.animation = "";
      rotor.style.transform = "";

      return {
        bodyTransform: getComputedStyle(body).transform,
        grilleTransform: getComputedStyle(grille).transform,
        naturalHeight: rotor.naturalHeight,
        naturalWidth: rotor.naturalWidth,
        rotorHeight: rotor.getBoundingClientRect().height,
        rotorWidth: rotor.getBoundingClientRect().width,
        overflow: windowStyle.overflow,
        borderRadius: windowStyle.borderRadius,
        transformOrigin: rotorStyle.transformOrigin,
        rotations,
      };
    });

    expect(fanGeometry.overflow).toBe("hidden");
    expect(fanGeometry.borderRadius).toBe("50%");
    expect(fanGeometry.naturalWidth).toBe(292);
    expect(fanGeometry.naturalHeight).toBe(292);
    expect(fanGeometry.bodyTransform).toBe("none");
    expect(fanGeometry.grilleTransform).toBe("none");
    const [originX, originY] = fanGeometry.transformOrigin.split(" ").map(Number.parseFloat);
    expect(originX).toBeCloseTo(fanGeometry.rotorWidth / 2, 1);
    expect(originY).toBeCloseTo(fanGeometry.rotorHeight / 2, 1);
    for (const rotation of fanGeometry.rotations) {
      expect(rotation.centerX).toBeCloseTo(rotation.windowCenterX, 1);
      expect(rotation.centerY).toBeCloseTo(rotation.windowCenterY, 1);
    }

    const acButton = page.locator(".ac-callout");
    await setRange(page, "airConditioner", 30);
    await expect(page.locator("#acTemperatureDisplay")).toHaveText("30");
    await expect(page.locator(".ac-body-on")).toHaveCSS("opacity", "1");
    expect(Number(await getRootVariable(page, "--ac-airflow-opacity"))).toBeCloseTo(0.26, 2);
    await setRange(page, "airConditioner", 16);
    await expect(page.locator("#acTemperatureDisplay")).toHaveText("16");
    expect(Number(await getRootVariable(page, "--ac-airflow-opacity"))).toBeCloseTo(0.92, 2);
    await acButton.click();
    await expect(acButton).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".ac-body-off")).toHaveCSS("opacity", "1");
    expect(await getRootVariable(page, "--ac-airflow-opacity")).toBe("0");
  });

  test("keeps the last valid frame when a replacement image fails", async ({ page }) => {
    await setRange(page, "light", 37);
    const frame = page.locator("#sceneLightFrameB");
    await expect(frame).toHaveAttribute("data-frame-source", /room-night-050/);
    await frame.dispatchEvent("error");
    await expect(frame).toHaveAttribute("data-frame-source", /room-night-100/);
  });

  test("crossfades ambiance without losing device state and applies scene presets", async ({ page }) => {
    await setRange(page, "light", 47);
    await page.locator("#ambianceToggleButton").click();
    await expect(page.locator("body")).toHaveAttribute("data-ambiance", "day");
    await expect(page.locator("#lightLevel")).toHaveText("47%");
    await expect(page.locator("#sceneLightFrameA")).toHaveAttribute("data-frame-source", /room-day-025/);

    await page.locator('[data-scene="sleep"]').click();
    await expect(page.locator("#lightLevel")).toHaveText("18%");
    await expect(page.locator("#curtainLevel")).toHaveText("0%");
    await expect(page.locator("#fanLevel")).toHaveText(/2档/);

    await page.locator('[data-scene="ventilate"]').click();
    await expect(page.locator("#curtainLevel")).toHaveText("100%");
    await expect(page.locator("#fanLevel")).toHaveText(/6档/);
    await expect(page.locator(".ac-callout")).toHaveAttribute("aria-pressed", "false");
  });

  test("keeps fixed coordinates at desktop, tablet, and mobile breakpoints", async ({ page }) => {
    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/app/");

      const geometry = await page.evaluate(() => {
        const room = document.querySelector(".room-scene").getBoundingClientRect();
        const viewportElement = document.querySelector(".room-viewport");
        return {
          documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          roomWidth: room.width,
          roomHeight: room.height,
          viewportClientWidth: viewportElement.clientWidth,
          viewportScrollWidth: viewportElement.scrollWidth,
        };
      });

      expect(geometry.documentOverflow).toBeLessThanOrEqual(1);
      expect(geometry.roomWidth / geometry.roomHeight).toBeCloseTo(1672 / 941, 2);
      if (viewport.width > 900) {
        expect(geometry.roomWidth).toBeLessThanOrEqual(geometry.viewportClientWidth + 1);
      } else {
        expect(geometry.roomWidth).toBeCloseTo(740, 0);
        expect(geometry.viewportScrollWidth).toBeGreaterThanOrEqual(740);
      }
    }
  });

  test("requires a fresh verified request for every voice command", async ({ page }) => {
    const result = await page.evaluate(() => {
      const demo = window.__voiceControlDemo;
      demo.appState.voiceprint.enrolled = true;
      const firstVerification = {
        verified: true,
        similarity: 0.91,
        threshold: 0.55,
        transcript: "关闭风扇",
        requestId: "e2e-voice-1",
        errorCode: null,
        message: "声纹验证通过",
      };
      demo.applyVoiceVerification(firstVerification);
      const first = demo.executeTextCommand("关闭风扇", "voice", {
        voiceVerification: firstVerification,
      });
      const replay = demo.executeTextCommand("打开风扇", "voice", {
        voiceVerification: firstVerification,
      });
      const afterReplay = demo.appState.devices.fan.status;

      const secondVerification = {
        ...firstVerification,
        transcript: "打开风扇",
        requestId: "e2e-voice-2",
      };
      demo.applyVoiceVerification(secondVerification);
      const second = demo.executeTextCommand("打开风扇", "voice", {
        voiceVerification: secondVerification,
      });
      return {
        first,
        replay,
        afterReplay,
        second,
        finalStatus: demo.appState.devices.fan.status,
      };
    });

    expect(result).toEqual({
      first: true,
      replay: false,
      afterReplay: false,
      second: true,
      finalStatus: true,
    });
  });

  test("keeps devices unchanged when the speaker is rejected", async ({ page }) => {
    const result = await page.evaluate(() => {
      const demo = window.__voiceControlDemo;
      demo.appState.voiceprint.enrolled = true;
      const before = demo.appState.devices.curtain.levelValue;
      const verification = {
        verified: false,
        similarity: 0.28,
        threshold: 0.55,
        transcript: "关闭窗帘",
        requestId: "e2e-rejected",
        errorCode: "speaker_rejected",
        message: "非授权用户，指令未执行",
      };
      demo.applyVoiceVerification(verification);
      const executed = demo.executeTextCommand("关闭窗帘", "voice", {
        voiceVerification: verification,
      });
      return {
        before,
        after: demo.appState.devices.curtain.levelValue,
        executed,
      };
    });

    expect(result.executed).toBe(false);
    expect(result.after).toBe(result.before);
    await expect(page.locator("#verificationTitle")).toHaveText("声纹验证失败");
  });
});
