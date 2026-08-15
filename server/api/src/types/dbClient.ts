import type { QueryResultRow } from "pg";
import type { queries } from "../services/queries";

export type Queries = typeof queries;

type QueryKey = string;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface NamedQuery<T> {
  key: QueryKey;
  text: string;
}

/**
 * Motivos válidos para trabajar sin scope de comunidad. Es una unión cerrada a propósito: cada vez
 * que aparece uno nuevo hay que agregarlo acá, y eso obliga a justificarlo en el diff.
 */
export type UnscopedReason =
  /** Resolver a qué comunidad pertenece un dominio de correo. */
  | "auth:resolve-community"
  /** Buscar al usuario por email/google_id: todavía no sabemos su comunidad. */
  | "auth:lookup-user"
  /** Alta de usuario, antes de tener su comunidad confirmada. */
  | "auth:register"
  /** Panel de administración (el scope real lo pone el rol del admin). */
  | "admin"
  /** Catálogo público de comunidades (pantalla de registro). */
  | "public:communities"
  /** Invitaciones y borrado de cuenta: se leen por token, antes de conocer la comunidad. */
  | "token-lookup"
  /** Arranque del proceso (bootstrap del admin autorizado, chequeos de salud). */
  | "bootstrap";

/**
 * Con qué alcance se abre una conexión.
 *
 * - `community`: usa el rol sujeto a RLS y fija `app.community_id`. Solo ve esa comunidad.
 * - `unscoped`: usa el rol con BYPASSRLS. Ve todo, así que cada uso tiene que estar justificado.
 */
export type DbScope =
  | { mode: "community"; communityId: UUID }
  | { mode: "unscoped"; reason: UnscopedReason };

export interface WithClientOptions {
  scope: DbScope;
  transaction?: boolean;
}

export interface DatabaseClient {
  readonly scope: DbScope;
  /**
   * La comunidad activa, o `null` si la conexión es unscoped.
   *
   * Es el valor que se le pasa como último parámetro a las queries con filtro de comunidad:
   * cuando es `null` el predicado `($n::uuid IS NULL OR community_id = $n::uuid)` se desactiva,
   * que es justo lo que necesitan los caminos de auth y del panel de admin.
   */
  readonly communityId: UUID | null;

  query<T extends QueryResultRow>(q: NamedQuery<T>, params?: unknown[]): Promise<T[]>;

  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): Promise<void>;
}

export interface DatabaseConnection {
  connect(scope: DbScope): Promise<DatabaseClient>;
}
