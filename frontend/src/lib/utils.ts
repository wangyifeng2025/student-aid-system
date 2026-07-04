import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// 合并 Tailwind 类名，自动处理冲突（如 px-2 + px-4 取后者）。
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
