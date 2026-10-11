import { LoginForm } from "./login-form";

export const metadata = { title: "Đăng nhập · Running Planner" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Running Planner</h1>
        <p className="mt-1 text-sm text-muted">Đăng nhập để tạo map chạy.</p>
        <LoginForm />
      </div>
    </main>
  );
}
