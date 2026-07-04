import { GraduationCap } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main
      className="flex min-h-screen items-center justify-center p-6"
      style={{
        background:
          "linear-gradient(135deg, #e0e7f1 0%, #f1f5f9 40%, #ffffff 100%)",
      }}
    >
      <div className="w-full max-w-100 rounded-lg border border-line bg-surface px-8 py-10">
        {/* 图标 + 系统名 */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-md bg-brand-subtle text-brand">
            <GraduationCap size={28} strokeWidth={1.5} />
          </div>
          <h1 className="mb-1 text-xl font-semibold tracking-tight text-ink">
            学工资助管理系统
          </h1>
          <p className="text-sm text-ink-mute">请使用学号或工号登录</p>
        </div>

        <LoginForm />

        {/* 帮助链接 */}
        <div className="mt-5 text-center text-sm">
          <a href="#" className="text-link transition-opacity hover:opacity-80">
            忘记密码？
          </a>
        </div>

        {/* 页脚 */}
        <div className="mt-8 border-t border-line-soft pt-4 text-center text-xs text-ink-mute">
          如需帮助，请联系管理员
        </div>
      </div>
    </main>
  );
}
