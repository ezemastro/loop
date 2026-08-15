-- Crea la entidad `communities`, que pasa a ser la raíz del grafo de datos:
--
--     communities → schools → user_schools → users → todo lo demás
--
-- Una comunidad agrupa colegios. Un usuario pertenece a exactamente una comunidad, determinada por
-- el dominio de su correo al registrarse, e inmutable después.
--
-- Toda la data existente queda bajo la comunidad "Red Itinere", que hasta ahora era la única.

CREATE TABLE "communities" (
    "id"         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "slug"       TEXT NOT NULL UNIQUE
                 CONSTRAINT communities_slug_format
                 CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$'),
    "name"       TEXT NOT NULL,
    -- Logo de la comunidad. Nullable: una comunidad recién creada todavía no subió su imagen.
    "media_id"   UUID REFERENCES "media"("id"),
    -- { "colors": { "primary": "#RRGGBB", ... } } — las 10 claves de COLORS en client/config.ts
    "theme"      JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Espacio para configuración por comunidad (initial_credits, etc.) sin migrar el esquema
    "meta"       JSONB NOT NULL DEFAULT '{}'::jsonb,
    "active"     BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP(0) DEFAULT NOW() NOT NULL,
    "updated_at" TIMESTAMP(0)
);

-- El dominio es único a nivel global: un dominio pertenece a una sola comunidad, y por eso
-- resolverla a partir del correo es determinístico.
CREATE TABLE "community_email_domains" (
    "id"           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "community_id" UUID NOT NULL REFERENCES "communities"("id") ON DELETE CASCADE,
    "domain"       TEXT NOT NULL UNIQUE
                   CONSTRAINT community_email_domains_lower CHECK (domain = lower(domain)),
    "created_at"   TIMESTAMP(0) DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_community_email_domains_community ON "community_email_domains"("community_id");

-- Comunidad inicial, con la paleta que la app tiene hoy hardcodeada en client/config.ts
INSERT INTO "communities" ("slug", "name", "theme", "active") VALUES (
    'red-itinere',
    'Red Itinere',
    '{"colors":{
        "primary":"#FF5900","secondary":"#4C9F38","tertiary":"#009E7C",
        "mainText":"#424242","secondaryText":"#9E9E9E",
        "credits":"#8436D1","creditsLight":"#8F4CD1",
        "stroke":"#E4E4E4","background":"#F0F0F0","alert":"#FF3B30"
    }}'::jsonb,
    TRUE
);

-- Los dominios que hasta ahora vivían en la constante VALID_EMAIL_DOMAINS, duplicada en
-- server/api/src/config.ts y client/config.ts. A partir de acá la fuente de verdad es la base.
INSERT INTO "community_email_domains" ("community_id", "domain")
SELECT c.id, d
FROM "communities" c,
     unnest(ARRAY[
        'northfield.edu.ar',
        'reditinere.com',
        'colegiodelfaro.edu.ar',
        'southcreekschool.com.ar',
        'northschools.uy',
        'theglobalschool.com.ar'
     ]) AS d
WHERE c.slug = 'red-itinere';
