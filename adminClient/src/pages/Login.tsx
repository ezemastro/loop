import { useState } from "react";
import Layout from "@/components/Layout";
import { adminLoginSchema } from "@/services/validations";
import { treeifyError } from "zod";
import adminApi from "@/api/adminApi";
import { useSessionStore } from "@/stores/session";
import { Link, useNavigate } from "react-router";
import GoogleLoginButton from "@/components/GoogleLoginButton";
import { Alert, Button, Field, Input } from "@/components/ui";
import { getErrorMessage } from "@/services/errors";

interface FormErrors {
  email?: string;
  password?: string;
  error?: string;
}

export default function Login() {
  const login = useSessionStore((state) => state.login);
  const navigate = useNavigate();
  const [formErrors, setFormErrors] = useState<FormErrors | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const email = form.email.value;
    const password = form.password.value;

    const errors: FormErrors = {};
    const result = await adminLoginSchema.safeParseAsync({ email, password });
    if (!result.success) {
      const tree = treeifyError(result.error);
      errors.email = tree.properties?.email?.errors?.[0];
      errors.password = tree.properties?.password?.errors?.[0];
      setFormErrors(errors);
      return;
    }
    setFormErrors(null);
    try {
      setLoading(true);
      const loginResponse = await adminApi.login(email, password);
      const admin = loginResponse.data?.admin;
      if (loginResponse.success && admin) {
        // La sesión guarda rol y comunidad: de ahí sale todo el alcance del panel.
        login(admin);
        navigate("/dashboard");
      }
    } catch (error) {
      setFormErrors({ error: getErrorMessage(error, "Ha ocurrido un error inesperado.") });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">Loop</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              Panel de administración
            </h1>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <form onSubmit={handleLogin} className="space-y-4">
              <Field label="Email" htmlFor="email" error={formErrors?.email} required>
                <Input id="email" name="email" type="email" autoComplete="email" required />
              </Field>
              <Field label="Contraseña" htmlFor="password" error={formErrors?.password} required>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </Field>
              {formErrors?.error && <Alert tone="error">{formErrors.error}</Alert>}
              <Button type="submit" size="lg" loading={loading} className="w-full">
                Iniciar sesión
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />o<span className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="flex justify-center">
              <GoogleLoginButton onError={(err) => setFormErrors({ error: err })} />
            </div>
          </div>

          <p className="mt-5 text-center text-sm text-slate-500">
            ¿Tenés un email autorizado?{" "}
            <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-700">
              Registrate
            </Link>
          </p>
        </div>
      </div>
    </Layout>
  );
}
