export const LIGHT_FRAME_STEPS = [0, 25, 50, 75, 100];
export const CURTAIN_FRAME_STEPS = Array.from({ length: 11 }, (_, index) => index * 10);

export function getFrameBlend(value, steps, reducedMotion = false) {
  const minimum = steps[0];
  const maximum = steps[steps.length - 1];
  const bounded = Math.min(maximum, Math.max(minimum, Number(value) || 0));

  if (reducedMotion) {
    const nearest = steps.reduce((best, step) =>
      Math.abs(step - bounded) < Math.abs(best - bounded) ? step : best
    );
    return { current: nearest, next: nearest, mix: 0 };
  }

  const current = [...steps].reverse().find((step) => step <= bounded) ?? minimum;
  const next = steps.find((step) => step >= bounded) ?? maximum;
  const mix = current === next ? 0 : (bounded - current) / (next - current);
  return { current, next, mix };
}

export function formatFrameStep(step) {
  return String(step).padStart(3, "0");
}

export function roomFramePath(ambience, step, width = 1440) {
  return `/assets/control-room-v2/room-${ambience}-${formatFrameStep(step)}-${width}.webp`;
}

export function curtainFramePath(step) {
  return `/assets/control-room-v2/curtain-${formatFrameStep(step)}.webp`;
}
