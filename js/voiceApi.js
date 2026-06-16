const VOICE_API_BASE = "/api/voice";

export async function fetchVoiceServiceStatus({ fetchImpl = globalThis.fetch } = {}) {
  return requestJson(`${VOICE_API_BASE}/status`, { fetchImpl });
}

export async function enrollVoiceprintSamples(samples, { fetchImpl = globalThis.fetch } = {}) {
  const form = new FormData();
  samples.forEach((sample, index) => {
    form.append("samples", sample.blob, `voiceprint-${index + 1}.${extensionFor(sample.blob.type)}`);
  });
  return requestJson(`${VOICE_API_BASE}/enroll`, {
    fetchImpl,
    method: "POST",
    body: form,
  });
}

export async function verifyVoiceCommand(sample, { fetchImpl = globalThis.fetch } = {}) {
  const form = new FormData();
  form.append("audio", sample.blob, `command.${extensionFor(sample.blob.type)}`);
  return requestJson(`${VOICE_API_BASE}/verify-command`, {
    fetchImpl,
    method: "POST",
    body: form,
  });
}

export async function deleteVoiceprintEnrollment({ fetchImpl = globalThis.fetch } = {}) {
  return requestJson(`${VOICE_API_BASE}/enrollment`, {
    fetchImpl,
    method: "DELETE",
  });
}

async function requestJson(url, { fetchImpl, ...options }) {
  if (typeof fetchImpl !== "function") {
    throw createVoiceApiError("network_error", "当前环境不支持网络请求");
  }

  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: "application/json", ...(options.headers || {}) },
      ...options,
    });
  } catch (error) {
    throw createVoiceApiError("network_error", "无法连接语音服务", error);
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw createVoiceApiError(
      payload.errorCode || "service_error",
      payload.message || `语音服务请求失败（${response.status}）`,
    );
  }
  return payload;
}

function extensionFor(mimeType = "") {
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "m4a";
  return "webm";
}

function createVoiceApiError(code, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

