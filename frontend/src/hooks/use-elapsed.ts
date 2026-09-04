import * as React from "react";

/** 任务进行中累计秒数；停止后归零。 */
export function useElapsed(active: boolean): number {
  const [seconds, setSeconds] = React.useState(0);

  React.useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const started = Date.now();
    setSeconds(0);
    const id = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - started) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [active]);

  return seconds;
}

export function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s} 秒`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m} 分 ${rest.toString().padStart(2, "0")} 秒`;
}

/** 无服务端进度时的近似百分比，接近 92% 后几乎不再涨，完成时由调用方拉到 100。 */
export function estimatedPercent(elapsed: number, tauSeconds: number): number {
  const tau = Math.max(4, tauSeconds);
  return Math.min(92, Math.round(92 * (1 - Math.exp(-elapsed / tau))));
}
