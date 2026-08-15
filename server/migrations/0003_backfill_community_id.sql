-- Asigna toda la data existente a "Red Itinere", que hasta ahora era la única comunidad.
--
-- El orden importa: `schools` y `users` se fijan primero, y el resto deriva de ellos. Nunca se
-- toca una fila cuyo `community_id` ya esté seteado, así que la migración es re-ejecutable.
--
-- Al final hay una verificación que aborta si quedó algo sin asignar: es la puerta que impide que
-- 0004 intente poner NOT NULL sobre una columna con nulos.

DO $$
DECLARE
    itinere_id UUID;
BEGIN
    SELECT id INTO STRICT itinere_id FROM communities WHERE slug = 'red-itinere';

    -- Raíces
    UPDATE schools SET community_id = itinere_id WHERE community_id IS NULL;
    UPDATE users   SET community_id = itinere_id WHERE community_id IS NULL;

    -- Todo lo demás deriva del usuario dueño...
    UPDATE user_schools        t SET community_id = u.community_id FROM users u WHERE u.id = t.user_id   AND t.community_id IS NULL;
    UPDATE listings            t SET community_id = u.community_id FROM users u WHERE u.id = t.seller_id AND t.community_id IS NULL;
    UPDATE messages            t SET community_id = u.community_id FROM users u WHERE u.id = t.sender_id AND t.community_id IS NULL;
    UPDATE notifications       t SET community_id = u.community_id FROM users u WHERE u.id = t.user_id   AND t.community_id IS NULL;
    UPDATE user_missions       t SET community_id = u.community_id FROM users u WHERE u.id = t.user_id   AND t.community_id IS NULL;
    UPDATE wallet_transactions t SET community_id = u.community_id FROM users u WHERE u.id = t.user_id   AND t.community_id IS NULL;
    UPDATE users_wishes        t SET community_id = u.community_id FROM users u WHERE u.id = t.user_id   AND t.community_id IS NULL;

    -- ...o de la publicación a la que cuelgan.
    UPDATE listing_media  t SET community_id = l.community_id FROM listings l WHERE l.id = t.listing_id AND t.community_id IS NULL;
    UPDATE listing_trades t SET community_id = l.community_id FROM listings l WHERE l.id = t.listing_id AND t.community_id IS NULL;

    -- Stats ambientales: pasan de ser 3 filas globales a 3 filas por comunidad.
    UPDATE global_stats SET community_id = itinere_id WHERE community_id IS NULL;

    -- Media subida por un usuario hereda su comunidad. La media sin `uploaded_by` (logos de
    -- colegio, cargados desde el panel) queda deliberadamente en NULL = recurso compartido.
    UPDATE media t SET community_id = u.community_id
    FROM users u
    WHERE u.id = t.uploaded_by AND t.community_id IS NULL;
END $$;

-- Puerta de verificación: si algo quedó sin comunidad, la migración entera revierte.
DO $$
DECLARE
    tabla   TEXT;
    faltan  BIGINT;
    reporte TEXT := '';
BEGIN
    FOREACH tabla IN ARRAY ARRAY[
        'schools', 'users', 'user_schools', 'listings', 'listing_media', 'listing_trades',
        'messages', 'notifications', 'user_missions', 'wallet_transactions', 'users_wishes',
        'global_stats'
    ] LOOP
        EXECUTE format('SELECT count(*) FROM %I WHERE community_id IS NULL', tabla) INTO faltan;
        IF faltan > 0 THEN
            reporte := reporte || format('  %s: %s filas sin comunidad%s', tabla, faltan, chr(10));
        END IF;
    END LOOP;

    IF reporte <> '' THEN
        RAISE EXCEPTION 'El backfill dejó filas huérfanas:%s%s', chr(10), reporte;
    END IF;
END $$;
