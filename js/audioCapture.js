let activeSession = null;

export function isAudioCaptureSupported() {
  return Boolean(globalThis.navigator?.mediaDevices?.getUserMedia && globalThis.MediaRecorder);
}

export function isInterimTranscriptionSupported() {
  return Boolean(globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition);
}

export function isAudioCaptureActive() {
  return Boolean(activeSession);
}

export async function startAudioCapture({
  maxDurationMs = 8000,
  onInterim = () => {},
  onAutoStop = () => {},
} = {}) {
  if (activeSession) {
    throw new Error("已有录音任务正在进行");
  }
  if (!isAudioCaptureSupported()) {
    throw new Error("当前浏览器不支持 MediaRecorder 录音");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
  const mimeType = chooseMimeType();
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  const chunks = [];
  const startedAt = performance.now();
  let settled = false;
  let timer = null;
  const interimRecognition = createInterimRecognition(onInterim);

  const done = new Promise((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };
    recorder.onerror = (event) => {
      settled = true;
      cleanup();
      reject(event.error || new Error("录音过程中发生错误"));
    };
    recorder.onstop = () => {
      if (settled) return;
      settled = true;
      const durationMs = Math.round(performance.now() - startedAt);
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
      cleanup();
      resolve({ blob, durationMs });
    };
  });

  const stop = () => {
    if (recorder.state !== "inactive") recorder.stop();
  };

  const cleanup = () => {
    if (timer) clearTimeout(timer);
    try {
      interimRecognition?.stop();
    } catch {
      // Interim captions are optional.
    }
    stream.getTracks().forEach((track) => track.stop());
    activeSession = null;
  };

  recorder.start(250);
  try {
    interimRecognition?.start();
  } catch {
    // Final transcription still comes from the server.
  }

  timer = setTimeout(() => {
    onAutoStop();
    stop();
  }, maxDurationMs);

  activeSession = { stop, done, recorder };
  return activeSession;
}

function chooseMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
}

function createInterimRecognition(onInterim) {
  const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (!Recognition) return null;

  const recognition = new Recognition();
  recognition.lang = "zh-CN";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    let text = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      text += event.results[index]?.[0]?.transcript || "";
    }
    onInterim(text.trim());
  };
  recognition.onerror = () => {};
  return recognition;
}
