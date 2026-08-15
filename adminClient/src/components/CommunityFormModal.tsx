import { useEffect, useState } from "react";
import adminApi, { type AdminCommunity } from "@/api/adminApi";
import { commonApi } from "@/api/commonApi";
import { getErrorMessage } from "@/services/errors";
import { Alert, Button, Field, Input, Modal, Toggle } from "@/components/ui";

/**
 * Paleta por defecto de una comunidad nueva. Son los colores históricos de Loop, que es lo que
 * conviene mostrar como punto de partida en vez de una pantalla en blanco.
 */
const DEFAULT_THEME: CommunityTheme = {
  colors: {
    primary: "#FF5900",
    secondary: "#4C9F38",
    tertiary: "#009E7C",
    mainText: "#424242",
    secondaryText: "#9E9E9E",
    credits: "#8436D1",
    creditsLight: "#8F4CD1",
    stroke: "#E4E4E4",
    background: "#F0F0F0",
    alert: "#FF3B30",
  },
};

/** Orden y etiquetas de los 10 colores. El orden agrupa por función, no alfabético. */
const COLOR_FIELDS: { key: keyof CommunityThemeColors; label: string; hint?: string }[] = [
  { key: "primary", label: "Primario", hint: "Botones y acentos" },
  { key: "secondary", label: "Secundario" },
  { key: "tertiary", label: "Terciario" },
  { key: "background", label: "Fondo" },
  { key: "stroke", label: "Bordes" },
  { key: "mainText", label: "Texto principal" },
  { key: "secondaryText", label: "Texto secundario" },
  { key: "credits", label: "Loopies" },
  { key: "creditsLight", label: "Loopies claro" },
  { key: "alert", label: "Alerta" },
];

const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/** Sugiere un slug a partir del nombre, para no hacérselo escribir a mano. */
const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

interface CommunityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** `null` ⇒ alta. Con comunidad ⇒ edición (el slug pasa a ser de solo lectura). */
  community: AdminCommunity | null;
}

export default function CommunityFormModal({
  isOpen,
  onClose,
  onSaved,
  community,
}: CommunityFormModalProps) {
  const isEditing = community !== null;

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [theme, setTheme] = useState<CommunityTheme>(DEFAULT_THEME);
  const [active, setActive] = useState(true);
  const [mediaId, setMediaId] = useState<UUID | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [domains, setDomains] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al abrir se recarga el formulario desde la comunidad, para que reabrirlo no arrastre lo de antes.
  useEffect(() => {
    if (!isOpen) return;
    setName(community?.name ?? "");
    setSlug(community?.slug ?? "");
    setSlugTouched(isEditing);
    setTheme(community?.theme?.colors ? community.theme : DEFAULT_THEME);
    setActive(community?.active ?? true);
    setMediaId(community?.mediaId ?? null);
    setLogoUrl(community?.media?.url ?? null);
    setDomains("");
    setError(null);
  }, [isOpen, community, isEditing]);

  const setColor = (key: keyof CommunityThemeColors, value: string) =>
    setTheme((prev) => ({ colors: { ...prev.colors, [key]: value } }));

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const handleUploadLogo = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const response = await commonApi.uploadFile(file);
      if (response.data?.media) {
        setMediaId(response.data.media.id);
        setLogoUrl(response.data.media.url);
      }
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo subir el logo"));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (name.trim().length < 2) return setError("El nombre es obligatorio");
    if (!isEditing && !SLUG_PATTERN.test(slug)) {
      return setError("El identificador solo admite minúsculas, números y guiones");
    }

    setSaving(true);
    setError(null);
    try {
      if (isEditing) {
        await adminApi.updateCommunity(community.id, { name: name.trim(), mediaId, theme, active });
      } else {
        await adminApi.createCommunity({
          slug,
          name: name.trim(),
          mediaId,
          theme,
          domains: domains
            .split(/[\s,]+/)
            .map((d) => d.trim().toLowerCase())
            .filter(Boolean),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo guardar la comunidad"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={isEditing ? `Editar ${community.name}` : "Nueva comunidad"}
      description={
        isEditing
          ? "El identificador no se puede cambiar: se usa en URLs."
          : "Una comunidad agrupa colegios. Sus usuarios no ven nada de las otras."
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEditing ? "Guardar cambios" : "Crear comunidad"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" required>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Red Itinere"
            />
          </Field>
          <Field
            label="Identificador"
            required
            hint={isEditing ? "No se puede cambiar" : "Minúsculas, números y guiones"}
          >
            <Input
              value={slug}
              disabled={isEditing}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase());
              }}
              placeholder="red-itinere"
            />
          </Field>
        </div>

        {!isEditing && (
          <Field
            label="Dominios de correo"
            hint="Separados por coma o espacio. Quien se registre con uno de estos dominios entra a esta comunidad. Se pueden agregar después."
          >
            <Input
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              placeholder="colegio.edu.ar, otrocolegio.com.ar"
            />
          </Field>
        )}

        <Field label="Logo" hint="Se muestra en la pantalla de registro y dentro de la app.">
          <div className="flex items-center gap-4">
            {logoUrl && (
              <img
                src={logoUrl}
                alt=""
                className="h-14 w-14 rounded-lg border border-slate-200 object-contain"
              />
            )}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUploadLogo(file);
              }}
              className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
            />
            {uploading && <span className="text-sm text-slate-500">Subiendo…</span>}
          </div>
        </Field>

        {isEditing && (
          <Toggle
            checked={active}
            onChange={setActive}
            label="Comunidad activa"
            hint="Si se desactiva, nadie más puede registrarse con sus dominios."
          />
        )}

        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-800">Colores de la app</h3>
          <p className="mb-3 text-xs text-slate-500">
            Con estos colores se pinta la app para los usuarios de esta comunidad.
          </p>

          <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
            <div className="grid gap-3 sm:grid-cols-2">
              {COLOR_FIELDS.map(({ key, label, hint }) => (
                <div key={key} className="flex items-center gap-3">
                  <input
                    type="color"
                    aria-label={label}
                    value={theme.colors[key]}
                    onChange={(e) => setColor(key, e.target.value)}
                    className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-slate-300 bg-white p-0.5"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700">{label}</p>
                    <p className="font-mono text-xs text-slate-400 uppercase">
                      {theme.colors[key]}
                      {hint && <span className="ml-1 font-sans normal-case">· {hint}</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Vista previa: vale más que diez selectores sueltos para entender cómo va a quedar. */}
            <div
              className="rounded-xl border p-4"
              style={{ background: theme.colors.background, borderColor: theme.colors.stroke }}
            >
              <p
                className="text-xs font-semibold tracking-wide uppercase"
                style={{ color: theme.colors.secondaryText }}
              >
                Vista previa
              </p>
              <p className="mt-1 text-base font-bold" style={{ color: theme.colors.mainText }}>
                {name || "Nombre de la comunidad"}
              </p>
              <div
                className="mt-3 rounded-lg border bg-white p-3"
                style={{ borderColor: theme.colors.stroke }}
              >
                <p className="text-sm font-semibold" style={{ color: theme.colors.mainText }}>
                  Cuaderno usado
                </p>
                <p className="text-xs" style={{ color: theme.colors.secondaryText }}>
                  Como nuevo
                </p>
                <p className="mt-1 text-sm font-bold" style={{ color: theme.colors.credits }}>
                  1.500 loopies
                </p>
              </div>
              <div
                className="mt-3 rounded-lg py-2 text-center text-sm font-semibold text-white"
                style={{ background: theme.colors.primary }}
              >
                Hacer oferta
              </div>
              <div
                className="mt-2 rounded-lg py-2 text-center text-sm font-semibold text-white"
                style={{ background: theme.colors.secondary }}
              >
                Publicar
              </div>
              <p className="mt-2 text-xs font-medium" style={{ color: theme.colors.alert }}>
                Mensaje de error
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
