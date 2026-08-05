"use client";

import * as React from "react";
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
 * 轻量手写板：基于 canvas，不依赖第三方签名库。
 * onChange 在笔画结束时输出 PNG data URL；清空时输出空串。
 */
export function SignaturePad({
  value,
  onChange,
  height = 160,
  placeholder,
  className,
  disabled,
}: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawing = React.useRef(false);
  const hasStroke = React.useRef(false);
  const [empty, setEmpty] = React.useState(!value);

  // 外部 value 变化时重绘（编辑回填 / 清空）。
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "#1d1d1f";

    ctx.clearRect(0, 0, rect.width, height);
    ctx.fillStyle = "#fafafa";
    ctx.fillRect(0, 0, rect.width, height);

    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, height);
        hasStroke.current = true;
        setEmpty(false);
      };
      img.src = value;
    } else {
      hasStroke.current = false;
      setEmpty(true);
    }
  }, [value, height]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    hasStroke.current = true;
    setEmpty(false);
  }

  function onPointerUp() {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke.current) return;
    onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    if (disabled) return;
    hasStroke.current = false;
    setEmpty(true);
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
          style={{ touchAction: "none" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onPointerCancel={onPointerUp}
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
