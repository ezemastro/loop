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
      {/* Login and register buttons */}
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <h1 className="text-3xl font-bold mb-6">Administración de Loop</h1>
        <div className="space-x-4">
          <Link
            to="/login"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Iniciar Sesión
          </Link>
          <Link
            to="/register"
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Registrarse
          </Link>
        </div>
        <div className="p-4">
          <GoogleLoginButton />
        </div>
      </div>
    </Layout>
  );
}
