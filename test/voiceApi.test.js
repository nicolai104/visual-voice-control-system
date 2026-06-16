import { test } from "node:test";
import assert from "node:assert/strict";

import {
  deleteVoiceprintEnrollment,
  enrollVoiceprintSamples,
  fetchVoiceServiceStatus,
  verifyVoiceCommand,
} from "../js/voiceApi.js";

function response(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return payload;
    },
  };
}

test("voice API reads backend enrollment status", async () => {
  const status = await fetchVoiceServiceStatus({
    fetchImpl: async (url) => {
      assert.equal(url, "/api/voice/status");
      return response({ enrolled: true, service: "ready" });
    },
  });
  assert.equal(status.enrolled, true);
});

test("enrollment uploads exactly three audio samples", async () => {
  const samples = [1, 2, 3].map(() => ({
    blob: new Blob(["audio"], { type: "audio/webm" }),
  }));
  const result = await enrollVoiceprintSamples(samples, {
    fetchImpl: async (url, options) => {
      assert.equal(url, "/api/voice/enroll");
      assert.equal(options.method, "POST");
      assert.equal(options.body.getAll("samples").length, 3);
      return response({ enrolled: true });
    },
  });
  assert.equal(result.enrolled, true);
});

test("verify command preserves the structured voice result", async () => {
  const expected = {
    verified: true,
    similarity: 0.9,
    threshold: 0.55,
    transcript: "打开风扇",
    requestId: "voice-1",
  };
  const result = await verifyVoiceCommand(
    { blob: new Blob(["audio"], { type: "audio/webm" }) },
    { fetchImpl: async () => response(expected) },
  );
  assert.deepEqual(result, expected);
});

test("backend errors expose stable error codes", async () => {
  await assert.rejects(
    () =>
      verifyVoiceCommand(
        { blob: new Blob(["audio"], { type: "audio/webm" }) },
        {
          fetchImpl: async () =>
            response(
              { errorCode: "speaker_rejected", message: "非授权用户" },
              { ok: false, status: 403 },
            ),
        },
      ),
    (error) => error.code === "speaker_rejected" && error.message === "非授权用户",
  );
});

test("delete enrollment uses the server as the source of truth", async () => {
  const result = await deleteVoiceprintEnrollment({
    fetchImpl: async (url, options) => {
      assert.equal(url, "/api/voice/enrollment");
      assert.equal(options.method, "DELETE");
      return response({ deleted: true, enrolled: false });
    },
  });
  assert.equal(result.enrolled, false);
});

