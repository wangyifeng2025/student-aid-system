"use client";

import * as React from "react";
import SignaturePadLib from "signature_pad";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  /** 受控预览：data URL 或远程图片 URL；空字符串表示空白。 */
  value?: string;
  onChange: (dataUrl: string) => void;
  /** 画板高度 */
  height?: number;
  /** 占位提示（画板空白时显示） */
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

/**
 * 手写板：基于 signature_pad，笔迹平滑；笔画结束时输出 PNG data URL。
 */
export function SignaturePad({
  value = "",
  onChange,
  height = 160,
  placeholder,
  className,
  disabled,
}: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const padRef = React.useRef<SignaturePadLib | null>(null);
  const onChangeRef = React.useRef(onChange);
  const syncingRef = React.useRef(false);
  const lastEmittedRef = React.useRef(value);
  const [empty, setEmpty] = React.useState(!value);

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const resizeCanvas = React.useCallback(() => {
    const canvas = canvasRef.current;
    const pad = padRef.current;
    if (!canvas || !pad) return;

    const data = pad.toData();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(height * ratio));
    canvas.getContext("2d")?.setTransform(ratio, 0, 0, ratio, 0, 0);
    pad.clear();
    if (data.length > 0) {
      pad.fromData(data);
    }
  }, [height]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pad = new SignaturePadLib(canvas, {
      penColor: "#1d1d1f",
      backgroundColor: "#fafafa",
      minWidth: 0.8,
      maxWidth: 2.8,
      throttle: 8,
    });
    padRef.current = pad;

    const onBegin = () => {
      if (syncingRef.current) return;
      setEmpty(false);
    };

    const emit = () => {
      if (syncingRef.current) return;
      if (pad.isEmpty()) {
        setEmpty(true);
        lastEmittedRef.current = "";
        onChangeRef.current("");
        return;
      }
      const dataUrl = pad.toDataURL("image/png");
      setEmpty(false);
      lastEmittedRef.current = dataUrl;
      onChangeRef.current(dataUrl);
    };

    pad.addEventListener("beginStroke", onBegin);
    pad.addEventListener("endStroke", emit);
    resizeCanvas();

    const onResize = () => resizeCanvas();
    window.addEventListener("resize", onResize);

    return () => {
      pad.removeEventListener("beginStroke", onBegin);
      pad.removeEventListener("endStroke", emit);
      window.removeEventListener("resize", onResize);
      pad.off();
      padRef.current = null;
    };
  }, [resizeCanvas]);

  // 外部 value 变化时回填 / 清空（编辑草稿、点重写）。
  React.useEffect(() => {
    const pad = padRef.current;
    const canvas = canvasRef.current;
    if (!pad || !canvas) return;
    if (value === lastEmittedRef.current) {
      setEmpty(!value);
      return;
    }

    syncingRef.current = true;
    const finish = () => {
      lastEmittedRef.current = value;
      syncingRef.current = false;
    };

    if (!value) {
      pad.clear();
      setEmpty(true);
      finish();
      return;
    }

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    void pad
      .fromDataURL(value, {
        ratio,
        width: rect.width,
        height,
      })
      .then(() => {
        setEmpty(false);
        finish();
      })
      .catch(() => {
        setEmpty(false);
        finish();
      });
  }, [value, height]);

  React.useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    if (disabled) pad.off();
    else pad.on();
  }, [disabled]);

  function clear() {
    if (disabled) return;
    const pad = padRef.current;
    if (!pad) return;
    pad.clear();
    setEmpty(true);
    lastEmittedRef.current = "";
    onChange("");
  }

  return (
    <div className={className}>
      <div
        className="relative overflow-hidden rounded-md border border-line"
        style={{ height, background: "#fafafa", touchAction: "none" }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full cursor-crosshair"
          style={{ touchAction: "none", width: "100%", height: "100%" }}
        />
        {empty && placeholder ? (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center px-3 text-center text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            {placeholder}
          </div>
        ) : null}
      </div>
      <div className="mt-2 flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={disabled || empty}>
          <Eraser size={14} />
          重写
        </Button>
      </div>
    </div>
  );
}
