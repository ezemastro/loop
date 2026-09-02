import { FILE_BASE_URL } from "@/config";

export const getUrl = (path: string) => {
  // Las URLs absolutas (p. ej. datos de demo) se usan tal cual; el prefijo solo aplica a rutas
  // relativas servidas por la API. Sin este chequeo, resolver dos veces rompería esos casos.
  if (/^https?:\/\//i.test(path)) return path;
  return `${FILE_BASE_URL}${path}`;
};
