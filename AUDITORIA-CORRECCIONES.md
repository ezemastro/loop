# Correcciones a `AUDITORIA-2026-09.md`

> Todo lo de acá salió de leer el código durante la sesión del 2026-09-02, antes de tocar nada.
> La auditoría sigue siendo buena; estos son los puntos donde **el código no dice lo que ella dice**.
> Cuando hay conflicto, gana el código.

---

## Cosas que, de haberlas hecho como decía la auditoría, rompían producción

### SEC-09 — el `REVOKE` propuesto rompe el registro por invitación
La auditoría pide revocarle a `loop_app` todo DML sobre `invitations`. Pero `loop_app` **sí escribe**
esa tabla en el camino scopeado: `UPDATE invitations SET used_by_user_id…`
(`server/api/src/services/queries.ts:726-731`), alcanzado desde `models/auth.ts:208` y `:472` (las dos
rutas de registro) y `models/self.ts:516` (borrado de cuenta).

Peor todavía: `lockInvitation` (`utils/invitations.ts:34` → `queries.ts:708-711`) usa
`SELECT … FOR UPDATE`, y Postgres **exige el privilegio UPDATE** para tomar ese lock de fila. O sea
que revocar UPDATE falla en el lock que hace que la invitación sea de un solo uso, antes siquiera de
llegar al consumo.

**Matriz corregida:** `REVOKE ALL` en `admins` y `admin_valid_emails`; solo `SELECT` en las dos tablas
de comunidad; **`SELECT` + `UPDATE`** en `invitations`. El comentario de `0007:106-110` que dice que
`invitations` es de solo lectura en el camino scopeado está desactualizado.

**Y nada lo habría detectado:** `assertDbHardening()` (`services/postgresClient.ts:208-258`) mira
`rolsuper`, `rolbypassrls` y `relrowsecurity` sobre `TENANT_TABLES`, pero **nunca inspecciona un
grant**, y ninguna de esas cinco tablas está en `TENANT_TABLES`. `rls.test.ts` tampoco las toca.
Un revoke mal hecho habría aparecido recién como un `42501` en el registro de un usuario real.

### SEC-10 — hashear el token de verificación rompe el e2e en silencio
`e2e/helpers/db.ts:49-53` y `e2e/helpers/api.ts:70-79` leen el token **en claro** desde Postgres para
armar el link de verificación. Con el token hasheado eso es irrecuperable por construcción.

### CLI-05 — no se puede resolver solo en el cliente
`services/expoNotifications.ts:20-27` manda únicamente `to`, `title`, `body`, `categoryId`.
**No hay campo `data`.** Todos los identificadores para rutear están en Postgres y nunca viajan por
el aire. El tap-para-abrir-una-publicación es imposible sin cambiar el servidor. Las tarjetas sí se
arreglan (su payload sale de la fila de la DB).

### CLI-06 — el fix propuesto borra una feature en producción
El módulo demo sí entra al bundle (Metro no hace tree-shaking). Pero el modo demo es una feature de
**producción**, accesible desde el link del Landing; `EXPO_PUBLIC_DEMO_MODE` no está en ningún perfil
de `eas.json`; y `Demo1234!` es pública a propósito (`buildCommunity.ts:135-138` y `DEMO.md`).
Sacarla del bundle apaga la demo. Además, un `import()` lazy reabre la carrera de hidratación que
`session.ts:13-18` existe justamente para cerrar.

**Lo que sí es una mejora real:** `demo/handlers/auth.ts:10-15` **ignora la contraseña**, así que
pasarla desde el código de la app es peso muerto.

---

## Cosas ya resueltas o que no existen

- **ADM-10 (lockfile del admin)** — ya está arreglado en esta sesión (`93e9015`).
- **ECO-11 (misiones inactivas)** — `progressMission` **sí** filtra templates inactivos
  (`utils/helpersDb.ts:653`). Lo que no filtra es la **asignación**.
- **ECO-04 (dueño del trueque)** — `acceptOffer` **sí** valida la pertenencia
  (`models/listings.ts:558-560`). Lo que falta son los chequeos de estado y `buyer_id`.
- **ECO-04 (`tradingListingIds` sin Zod)** — sí se validan como UUID individualmente. Lo que falta
  es esquema de array, cota máxima y deduplicación.
- **INF-12 (`create_categories.sql` suelto)** — **no borrar**: es input vivo del build
  (`e2e/Dockerfile.db-init:10`) y contrato por nombre de `shared/demo-data/catalog.ts:7` y `seed.ts:76`.
- **INF-01 (`migrate.ts` fuera de la imagen)** — `tsconfig.prod.json:20-26` **sí** lo compila y
  `Dockerfile.api:60-63` lo aplana a `dist/scripts/`. Falta solo el `COPY` de las migraciones y el
  servicio de compose. El bloqueo real que la auditoría **no** menciona: `tsx` es devDependency
  (`server/api/package.json:72`) y `--omit=dev` la borra, así que `npm run migrate` igual no corre en
  prod. El servicio tiene que invocar `node dist/scripts/migrate.js`.

---

## Cosas peores de lo que decía la auditoría

- **INF-06 — el test "de referencia" no sirve de referencia.** La auditoría manda replicar el patrón
  de `src/tests/auth.test.ts` en `self.test.ts`. Ese archivo (`:4-14`) **no tiene un solo `expect`**
  y pasa con cualquier status, incluido 500.
- **INF-06 — `self.test.ts` está más muerto de lo que se dice.** Cuatro tests ya son
  `it.skip`/`it.skip.each` (`:47, :54, :68, :84`).
- **INF-06 — la suite completa no es hermética.** Medido: **9 suites fallan, 4 pasan** (20 tests en
  rojo, 54 en verde). Dos causas: `UPLOAD_DIR` default `/uploads` (absoluto, no se puede crear fuera
  del contenedor) y el proyecto `unit` intentando conectarse a una base real.
- **ADM-02 — hay una segunda mitad no reportada.** Como nunca se manda `role`, un super admin
  tampoco puede crear otro super admin. Y el bug afecta **solo** a super admins: los admins de
  comunidad funcionan porque la comunidad sale del token.
- **CLI-03 — son 8 hooks, no 10**, la función se llama `parseErrorName` y no `parseApiError`, hay una
  **segunda clase de 8 hooks sin `catch`** que la auditoría no menciona, y "las mutaciones ya lo
  hacen bien" es 21 de 24, no todas.
- **ADM-05 — confirmado** (estaba como "a confirmar"): `models/upload.ts:35` inserta `url: filename`.
  Pero son **dos** sitios con `src`, no cuatro.
- **`makeOffer` no tiene esquema de body.** Ninguno. `offeredCredits: undefined` pasa las tres guardas.
- **`createListing` no es transaccional y acuña créditos de misión tres veces.**
- **`withClient` se traga los fallos de COMMIT.** Un movimiento de créditos puede parecer commiteado
  y haberse perdido. Es el follow-up de mayor valor que salió de la sesión.
- **`useNotifications` ignora `pageParam`**: pagina para siempre sobre la página 1.
- **`sw.js` no tiene listener de `push` ni de `notificationclick`.**

---

## Rutas mal citadas en la auditoría

| Dice | Es |
|---|---|
| `db/postgresClient.ts` | `services/postgresClient.ts` |
| `middleware/` | `middlewares/` |
| `helpersDb.ts` (raíz) | `utils/helpersDb.ts` |
| `controllers/admin.ts:140-153` | `controllers/admin.ts:135-160` |
| `ListingButtons.tsx:108-110` | `ListingButtons.tsx:114-116` |
| N+1 en `admin.ts:687-691` | `utils/helpersDb.ts:769-802` |
| `AGENTS.md:170` (admin sin `shared/types`) | `adminClient/tsconfig.app.json` **sí** incluye `shared/types` |
