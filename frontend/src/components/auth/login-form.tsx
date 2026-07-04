"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login, ApiError } from "@/lib/api";
import { getHomePath } from "@/lib/access";
import { useAuthStore } from "@/store/auth";

const schema = z.object({
  username: z.string().trim().min(1, "请输入学号或工号"),
  password: z.string().min(1, "请输入密码"),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  const [showPassword, setShowPassword] = React.useState(false);
  const [remember, setRemember] = React.useState(true);
  const [serverError, setServerError] = React.useState<string | null>(null);

  // 会话恢复后若已登录则直接进入系统（effect 内只做跳转）。
  React.useEffect(() => {
    if (hydrated && isAuthenticated) {
      router.replace(getHomePath(user?.role));
    }
  }, [hydrated, isAuthenticated, user?.role, router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const tokens = await login(values);
      setSession(tokens, remember);
      router.replace(getHomePath(tokens.user.role));
    } catch (e) {
      setServerError(
        e instanceof ApiError ? e.message : "登录失败，请稍后重试",
      );
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      {serverError && (
        <div
          role="alert"
          className="rounded-md border px-3 py-2 text-sm"
          style={{
            color: "var(--state-error)",
            background: "var(--state-error-bg)",
            borderColor: "var(--state-error)",
          }}
        >
          {serverError}
        </div>
      )}

      {/* 学号 / 工号 */}
      <div>
        <label
          htmlFor="username"
          className="mb-1 block text-sm font-medium text-ink-soft"
        >
          学号 / 工号
        </label>
        <Input
          id="username"
          autoComplete="username"
          placeholder="请输入学号或工号"
          aria-invalid={!!errors.username}
          {...register("username")}
        />
        {errors.username && (
          <p className="mt-1 text-xs text-error">{errors.username.message}</p>
        )}
      </div>

      {/* 密码 */}
      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-sm font-medium text-ink-soft"
        >
          密码
        </label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="请输入密码"
            className="pr-10"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "隐藏密码" : "显示密码"}
            className="absolute top-1/2 right-2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-sm text-ink-mute transition-colors hover:text-ink-soft"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.password && (
          <p className="mt-1 text-xs text-error">{errors.password.message}</p>
        )}
      </div>

      {/* 记住我 */}
      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft select-none">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="h-4 w-4 cursor-pointer"
          style={{ accentColor: "var(--color-primary)" }}
        />
        记住我
      </label>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting && <Loader2 size={16} className="animate-spin" />}
        {isSubmitting ? "登录中…" : "登录"}
      </Button>
    </form>
  );
}
