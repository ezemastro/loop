/**
 * Seed de desarrollo: escribe el dataset de `shared/demo-data` en Postgres.
 *
 *     npm run seed              siembra las tres comunidades de desarrollo
 *     npm run seed -- --demo    siembra solo la comunidad demo (la misma que ve producción)
 *     npm run seed -- --force   permite correrlo con NODE_ENV=production (no lo hagas)
 *
 * Es **idempotente por comunidad**: antes de insertar borra todo lo que esa comunidad tenía. Como
 * cada ID se deriva del dataset, correrlo dos veces deja la base exactamente igual, y quitar una
 * publicación del dataset la quita de la base en la corrida siguiente.
 *
 * Se conecta con el rol **dueño** (POSTGRES_USER), igual que el runner de migraciones. No es por
 * comodidad: el dataset atraviesa varias comunidades y los roles de la aplicación son, por diseño,
 * incapaces de eso — `loop_app` está sujeto a RLS y solo ve una comunidad por conexión.
 *
 * Nunca corre contra producción sin `--force`, y el dataset trae contraseñas en texto plano
 * documentadas en `DEMO.md`: sembrarlo en una base con usuarios reales sería regalar cuentas.
 */
import { Client } from "pg";
import {
  DEMO_DATASET,
  DEV_DATASET,
  demoAdminCredentials,
  demoCredentials,
  unregisteredAdminEmails,
  type DemoCategory,
  type DemoCommunity,
  type DemoDataset,
  type DemoMedia,
} from "../../../../shared/demo-data";
import { DB_HOST, DB_NAME, DB_PASSWORD, DB_USER, NODE_ENV } from "../config.js";
import { hashPassword } from "../services/hash.js";

const args = process.argv.slice(2);
const ONLY_DEMO = args.includes("--demo");
const FORCE = args.includes("--force");

/**
 * Tablas con `community_id`, en orden de borrado seguro: hijas antes que padres.
 *
 * El orden no es estético. `account_deletion_requests` va antes que `users` porque su `user_id` no
 * tiene ON DELETE. `invitations` va después, porque `users.invitation_id` la referencia. Y `admins`
 * va al final de todo, porque las invitaciones apuntan a quien las creó.
 */
const SCOPED_TABLES_IN_DELETE_ORDER = [
  "account_deletion_requests",
  "notifications",
  "user_missions",
  "messages",
  "listing_trades",
  "listing_media",
  "users_wishes",
  "wallet_transactions",
  "listings",
  "user_schools",
  "users",
  "schools",
  "global_stats",
  "invitations",
  "admins",
  "admin_valid_emails",
] as const;

const assertSafeEnvironment = () => {
  if (NODE_ENV === "production" && !FORCE) {
    throw new Error(
      "Este seed escribe usuarios con contraseñas públicas y borra datos por comunidad. " +
        "Se niega a correr con NODE_ENV=production. Si de verdad es lo que querés, pasá --force.",
    );
  }
};

/**
 * Inserta las categorías que falten y devuelve el mapa `id del dataset → id real en la base`.
 *
 * La resolución es **por nombre**, no por ID: `server/create_categories.sql` las inserta con
 * `gen_random_uuid()`, así que una base que ya lo corrió tiene las mismas categorías con otros
 * IDs. Sin este mapa el seed las duplicaría.
 */
const upsertCategories = async (client: Client, categories: DemoCategory[]) => {
  const idByName = new Map<string, UUID>();
  const existing = await client.query<{ id: UUID; name: string }>(
    `SELECT id, name FROM categories`,
  );
  for (const row of existing.rows) idByName.set(row.name, row.id);

  // Dos pasadas: las raíces primero, porque las hijas necesitan el `parent_id` ya resuelto.
  const roots = categories.filter((category) => category.parentName === null);
  const children = categories.filter((category) => category.parentName !== null);

  for (const category of [...roots, ...children]) {
    if (idByName.has(category.name)) continue;
    const parentId = category.parentName ? (idByName.get(category.parentName) ?? null) : null;
    const inserted = await client.query<{ id: UUID }>(
      `INSERT INTO categories
         (id, name, parent_id, description, min_price_credits, max_price_credits, icon,
          stat_kg_waste, stat_kg_co2, stat_l_h2o)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        category.id,
        category.name,
        parentId,
        category.description,
        category.minPriceCredits,
        category.maxPriceCredits,
        category.icon,
        category.stats.kgWaste,
        category.stats.kgCo2,
        category.stats.lH2o,
      ],
    );
    const row = inserted.rows[0];
    if (row) idByName.set(category.name, row.id);
  }

  const idByDatasetId = new Map<UUID, UUID>();
  for (const category of categories) {
    const realId = idByName.get(category.name);
    if (!realId) throw new Error(`No se pudo resolver la categoría "${category.name}"`);
    idByDatasetId.set(category.id, realId);
  }
  return idByDatasetId;
};

const upsertMissionTemplates = async (client: Client, dataset: DemoDataset) => {
  for (const mission of dataset.missionTemplates) {
    await client.query(
      `INSERT INTO mission_templates (id, key, title, description, reward_credits, active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         key = EXCLUDED.key,
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         reward_credits = EXCLUDED.reward_credits,
         active = EXCLUDED.active`,
      [
        mission.id,
        mission.key,
        mission.title,
        mission.description,
        mission.rewardCredits,
        mission.active,
      ],
    );
  }
};

/** Todos los medios de una comunidad, incluidos los compartidos (logos) que no llevan community_id. */
const communityMedia = (community: DemoCommunity): DemoMedia[] => [
  community.media,
  ...community.schools.map((school) => school.media),
  ...community.users.flatMap((user) => (user.avatar ? [user.avatar] : [])),
  ...community.listings.flatMap((listing) => listing.media),
];

const purgeCommunity = async (client: Client, community: DemoCommunity) => {
  for (const table of SCOPED_TABLES_IN_DELETE_ORDER) {
    // El nombre de tabla viene de una lista literal de este archivo, nunca de datos.
    await client.query(`DELETE FROM ${table} WHERE community_id = $1`, [community.id]);
  }
  // `communities.media_id` apunta al logo: hay que soltarlo antes de borrar el medio.
  await client.query(`UPDATE communities SET media_id = NULL WHERE id = $1`, [community.id]);
  // Las dos condiciones cubren cosas distintas: `community_id` barre lo que quedó de corridas
  // anteriores (una imagen cuya clave cambió ya no está en la lista de abajo y quedaría huérfana),
  // y la lista de IDs alcanza los logos compartidos, que no llevan comunidad.
  await client.query(`DELETE FROM media WHERE community_id = $1 OR id = ANY($2::uuid[])`, [
    community.id,
    communityMedia(community).map((media) => media.id),
  ]);
  await client.query(`DELETE FROM community_email_domains WHERE community_id = $1`, [community.id]);
  await client.query(`DELETE FROM communities WHERE id = $1`, [community.id]);
};

/**
 * Inserta un medio. `communityId` en `null` significa recurso compartido: los logos de comunidad y
 * de colegio se ven desde la pantalla de registro, o sea antes de que exista una comunidad activa.
 */
const insertMedia = async (client: Client, media: DemoMedia, communityId: UUID | null) => {
  await client.query(
    `INSERT INTO media (id, url, mime, media_type, community_id) VALUES ($1, $2, $3, $4, $5)`,
    [media.id, media.url, media.mime, media.mediaType, communityId],
  );
};

const insertCommunity = async (
  client: Client,
  community: DemoCommunity,
  categoryIdMap: Map<UUID, UUID>,
  passwordHash: string,
) => {
  // La comunidad va primero y sin logo: `media.community_id` apunta de vuelta acá, así que el
  // logo se enlaza recién después de existir la fila.
  await client.query(
    `INSERT INTO communities (id, slug, name, theme, meta, active)
     VALUES ($1, $2, $3, $4::jsonb, '{}'::jsonb, TRUE)`,
    [community.id, community.slug, community.name, JSON.stringify(community.theme)],
  );

  for (const domain of community.emailDomains) {
    await client.query(
      `INSERT INTO community_email_domains (community_id, domain) VALUES ($1, $2)`,
      [community.id, domain.toLowerCase()],
    );
  }

  await insertMedia(client, community.media, null);
  await client.query(`UPDATE communities SET media_id = $2 WHERE id = $1`, [
    community.id,
    community.media.id,
  ]);

  for (const school of community.schools) {
    await insertMedia(client, school.media, null);
    await client.query(
      `INSERT INTO schools (id, name, media_id, community_id, stat_kg_waste, stat_kg_co2, stat_l_h2o)
       VALUES ($1, $2, $3, $4, 0, 0, 0)`,
      [school.id, school.name, school.media.id, community.id],
    );
  }

  for (const user of community.users) {
    if (user.avatar) await insertMedia(client, user.avatar, community.id);
    await client.query(
      `INSERT INTO users
         (id, password, first_name, last_name, email, phone, profile_media_id,
          credits_balance, credits_locked, stat_kg_waste, stat_kg_co2, stat_l_h2o,
          community_id, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE)`,
      [
        user.id,
        passwordHash,
        user.firstName,
        user.lastName,
        user.email,
        user.phone,
        user.avatar?.id ?? null,
        user.creditsBalance,
        user.creditsLocked,
        user.stats.kgWaste,
        user.stats.kgCo2,
        user.stats.lH2o,
        community.id,
      ],
    );
    for (const schoolId of user.schoolIds) {
      await client.query(
        `INSERT INTO user_schools (user_id, school_id, community_id) VALUES ($1, $2, $3)`,
        [user.id, schoolId, community.id],
      );
    }
  }

  for (const listing of community.listings) {
    const categoryId = categoryIdMap.get(listing.categoryId);
    if (!categoryId) {
      throw new Error(`La publicación "${listing.title}" apunta a una categoría sin resolver`);
    }
    await client.query(
      `INSERT INTO listings
         (id, seller_id, title, description, category_id, price_credits, listing_status,
          product_status, disabled, buyer_id, offered_credits, community_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::listing_status, $8::product_status, $9, $10, $11, $12,
               NOW() - make_interval(hours => $13::int))`,
      [
        listing.id,
        listing.sellerId,
        listing.title,
        listing.description,
        categoryId,
        listing.priceCredits,
        listing.listingStatus,
        listing.productStatus,
        listing.disabled,
        listing.buyerId,
        listing.offeredCredits,
        community.id,
        listing.createdHoursAgo,
      ],
    );
    for (const [position, media] of listing.media.entries()) {
      await insertMedia(client, media, community.id);
      await client.query(
        `INSERT INTO listing_media (listing_id, media_id, position, community_id)
         VALUES ($1, $2, $3, $4)`,
        [listing.id, media.id, position, community.id],
      );
    }
  }

  for (const mission of community.userMissions) {
    await client.query(
      `INSERT INTO user_missions
         (id, user_id, mission_template_id, completed, completed_at, progress, community_id)
       VALUES ($1, $2, $3, $4,
               CASE WHEN $5::int IS NULL THEN NULL ELSE NOW() - make_interval(hours => $5::int) END,
               $6::jsonb, $7)`,
      [
        mission.id,
        mission.userId,
        mission.missionTemplateId,
        mission.completed,
        mission.completedHoursAgo,
        JSON.stringify(mission.progress),
        community.id,
      ],
    );
  }

  for (const message of community.messages) {
    await client.query(
      `INSERT INTO messages
         (id, sender_id, recipient_id, text, attached_listing_id, is_read, community_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - make_interval(hours => $8::int))`,
      [
        message.id,
        message.senderId,
        message.recipientId,
        message.text,
        message.attachedListingId,
        message.isRead,
        community.id,
        message.createdHoursAgo,
      ],
    );
  }

  for (const wish of community.wishes) {
    const categoryId = categoryIdMap.get(wish.categoryId);
    if (!categoryId) throw new Error(`El deseo ${wish.id} apunta a una categoría sin resolver`);
    await client.query(
      `INSERT INTO users_wishes (id, user_id, category_id, comment, community_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [wish.id, wish.userId, categoryId, wish.comment, community.id],
    );
  }

  for (const notification of community.notifications) {
    // `kind` es andamiaje del constructor del dataset: la API espera el payload sin él.
    const { kind: _kind, ...payload } = notification.payload;
    await client.query(
      `INSERT INTO notifications
         (id, user_id, type, payload, is_read, read_at, community_id, created_at)
       VALUES ($1, $2, $3::notification_type, $4::jsonb, $5,
               CASE WHEN $6::int IS NULL THEN NULL ELSE NOW() - make_interval(hours => $6::int) END,
               $7, NOW() - make_interval(hours => $8::int))`,
      [
        notification.id,
        notification.userId,
        notification.type,
        JSON.stringify(payload),
        notification.isRead,
        notification.readHoursAgo,
        community.id,
        notification.createdHoursAgo,
      ],
    );
  }

  // Panel: el admin de esta comunidad. Su fila en la allowlist va aparte, con el resto del panel.
  await client.query(
    `INSERT INTO admins (id, email, full_name, password, role, community_id)
     VALUES ($1, $2, $3, $4, $5::admin_role, $6)`,
    [
      community.admin.id,
      community.admin.email,
      community.admin.fullName,
      passwordHash,
      community.admin.role,
      community.id,
    ],
  );

  for (const request of community.deletionRequests) {
    await client.query(
      `INSERT INTO account_deletion_requests
         (id, user_id, community_id, email, status, created_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW() - make_interval(hours => $5::int))`,
      [request.id, request.userId, community.id, request.email, request.createdHoursAgo],
    );
  }

  const stats: [string, number][] = [
    ["total_kg_waste", community.globalStats.kgWaste],
    ["total_kg_co2", community.globalStats.kgCo2],
    ["total_l_h2o", community.globalStats.lH2o],
  ];
  for (const [name, value] of stats) {
    await client.query(
      `INSERT INTO global_stats (stat_name, stat_value, community_id) VALUES ($1, $2, $3)`,
      [name, value, community.id],
    );
  }
};

/**
 * Lo del panel que no cuelga de ninguna comunidad: el super admin y las filas de la allowlist que
 * no son de comunidad. `purgeCommunity` no las alcanza —borra por `community_id` y estas lo tienen
 * en NULL— así que se limpian por identidad.
 *
 * Se borra por email y por id, nunca por `community_id IS NULL`: con esa condición se llevaría
 * puesto al super admin real del entorno, que la migración 0006 deja exactamente así.
 */
const purgePanel = async (client: Client, dataset: DemoDataset) => {
  // Las invitaciones que haya creado el super admin quedan colgadas de su fila: primero ellas.
  await client.query(`DELETE FROM invitations WHERE created_by_admin_id = $1`, [
    dataset.superAdmin.id,
  ]);
  await client.query(`DELETE FROM admins WHERE id = $1`, [dataset.superAdmin.id]);
  await client.query(`DELETE FROM admin_valid_emails WHERE email = ANY($1::text[])`, [
    dataset.authorizedAdminEmails.map((entry) => entry.email),
  ]);
};

const insertPanel = async (client: Client, dataset: DemoDataset, passwordHash: string) => {
  await client.query(
    `INSERT INTO admins (id, email, full_name, password, role, community_id)
     VALUES ($1, $2, $3, $4, $5::admin_role, NULL)`,
    [
      dataset.superAdmin.id,
      dataset.superAdmin.email,
      dataset.superAdmin.fullName,
      passwordHash,
      dataset.superAdmin.role,
    ],
  );

  // La allowlist entera de una: los admins ya sembrados (para que todo admin existente esté
  // autorizado) y el email que queda a propósito sin registrar.
  for (const entry of dataset.authorizedAdminEmails) {
    await client.query(
      `INSERT INTO admin_valid_emails (email, role, community_id)
       VALUES ($1, $2::admin_role, $3)
       ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, community_id = EXCLUDED.community_id`,
      [entry.email, entry.role, entry.communityId],
    );
  }
};

const printCredentials = (dataset: DemoDataset) => {
  const rows = demoCredentials(dataset);
  const pad = (value: string, width: number) => value.padEnd(width);
  const emailWidth = Math.max(...rows.map((row) => row.email.length));
  const nameWidth = Math.max(...rows.map((row) => row.fullName.length));

  console.log("\nCuentas sembradas (todas con la misma contraseña):\n");
  let currentCommunity = "";
  for (const row of rows) {
    if (row.community !== currentCommunity) {
      currentCommunity = row.community;
      console.log(`  ${row.community}  (slug: ${row.communitySlug})`);
    }
    const marker = row.showcase ? " ← con esta entra el modo demo" : "";
    console.log(
      `    ${pad(row.email, emailWidth)}  ${pad(row.fullName, nameWidth)}  ` +
        `${String(row.credits).padStart(5)} créditos${marker}`,
    );
  }
  const admins = demoAdminCredentials(dataset);
  const adminEmailWidth = Math.max(...admins.map((row) => row.email.length));
  console.log("\n  Panel de administración:");
  for (const admin of admins) {
    const alcance = admin.community ? `admin de ${admin.community}` : "SUPER ADMIN (ve todo)";
    console.log(`    ${pad(admin.email, adminEmailWidth)}  ${alcance}`);
  }
  for (const pendiente of unregisteredAdminEmails(dataset)) {
    console.log(
      `    ${pad(pendiente.email, adminEmailWidth)}  autorizado pero SIN registrar ` +
        `(para probar el alta en /register)`,
    );
  }

  console.log(`\n  Contraseña (usuarios y admins): ${rows[0]?.password ?? "(sin usuarios)"}\n`);
  console.log("  El detalle completo está en DEMO.md\n");
};

const main = async () => {
  assertSafeEnvironment();

  const dataset = ONLY_DEMO ? DEMO_DATASET : DEV_DATASET;
  const client = new Client({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  await client.connect();
  try {
    // bcrypt es caro a propósito; el dataset comparte contraseña, así que se hashea una sola vez.
    const passwordHash = await hashPassword(dataset.communities[0]?.users[0]?.password ?? "");

    await client.query("BEGIN");
    const categoryIdMap = await upsertCategories(client, dataset.categories);
    await upsertMissionTemplates(client, dataset);
    // Primero se purga todo y después se inserta todo, en vez de comunidad por comunidad: el
    // super admin puede tener invitaciones en cualquiera de ellas, así que mezclar las dos fases
    // dejaría filas apuntando a un admin ya borrado.
    for (const community of dataset.communities) await purgeCommunity(client, community);
    await purgePanel(client, dataset);

    for (const community of dataset.communities) {
      await insertCommunity(client, community, categoryIdMap, passwordHash);
      console.log(
        `✔ ${community.name}: ${community.users.length} usuarios, ` +
          `${community.listings.length} publicaciones, ${community.schools.length} colegios, ` +
          `1 admin`,
      );
    }
    await insertPanel(client, dataset, passwordHash);
    console.log(
      `✔ Panel: 1 super admin y ${dataset.authorizedAdminEmails.length} emails autorizados`,
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }

  printCredentials(dataset);
};

main().catch((error: unknown) => {
  console.error("\nEl seed falló y no dejó nada a medias (la transacción se revirtió).\n");
  console.error(error);
  process.exit(1);
});
