-- Aceptación de términos versionada (auditoría 2026-09, ADM-01 / `legal-public-routes`).
--
-- Reemplaza al flag local `hasAcceptedTerms` de `client/stores/session.ts`, que no sobrevivía un
-- logout y nunca llegaba al servidor: no había forma de saber quién aceptó qué versión ni cuándo.
--
-- `terms_version` es la columna que decide si hay que volver a preguntar: el cliente compara este
-- valor contra la constante `TERMS_VERSION` (`client/content/legal/termsDocument.ts`). Un
-- `terms_version` NULL significa "nunca aceptó bajo el régimen versionado" y se trata igual que
-- una versión distinta — vuelve a preguntar una vez.
--
-- Ambas columnas nacen NULL, sin backfill: no hay forma honesta de reconstruir cuándo un usuario
-- ya existente aceptó los términos hardcodeados de antes. Cada uno los ve una vez la próxima vez
-- que entra, que es exactamente lo que corresponde dado que el texto y la comunidad ahora se
-- muestran dinámicamente y nunca se le mostró este documento en concreto.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_version TEXT;

-- ── ROLLBACK ───────────────────────────────────────────────────────────────────────────────────
-- Aditiva y sin dependencias: las columnas quedan sin uso, sin efecto en el resto del esquema.
--
-- ALTER TABLE users
--   DROP COLUMN IF EXISTS terms_accepted_at,
--   DROP COLUMN IF EXISTS terms_version;
