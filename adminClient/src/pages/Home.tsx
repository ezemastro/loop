import GoogleLoginButton from "@/components/GoogleLoginButton";
import Layout from "@/components/Layout";
import { useSessionStore } from "@/stores/session";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router";

export default function Home() {
  const isLoggedIn = useSessionStore((state) => state.isLoggedIn);
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoggedIn) {
      navigate("/dashboard");
    }
  }, [isLoggedIn, navigate]);

  return (
    <Layout>
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">Loop</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Administración de Loop
          </h1>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3">
              <Link
                to="/login"
                className="bg-brand-primary inline-flex w-full items-center justify-center rounded-lg px-5 py-2.5 text-base font-medium text-white shadow-sm transition hover:opacity-90"
              >
                Iniciar Sesión
              </Link>
              <Link
                to="/register"
                className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-base font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Registrarse
              </Link>
            </div>

            <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />o
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="flex justify-center">
              <GoogleLoginButton />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
