import { redirect } from "next/navigation";

// 入口直接进入登录页；登录后客户端会跳转到 /dashboard。
export default function Home() {
  redirect("/login");
}
