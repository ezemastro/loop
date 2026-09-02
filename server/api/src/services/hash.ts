import bcrypt from "bcrypt";

const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || "10", 10);

export const hashPassword = async (password: string) => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
};

/**
 * Hash "señuelo" con el mismo costo que los hashes reales (mismo `SALT_ROUNDS`), generado una
 * sola vez al cargar el módulo. Es lo que permite que un login contra una cuenta sin password
 * (Google) o inexistente pague el mismo trabajo de bcrypt que uno contra una cuenta real (SEC-03,
 * SEC-16, D5): sin esto, el tiempo de respuesta sería el oráculo aunque el código y el body ya
 * fueran uniformes.
 *
 * `hashPassword` es async (usa `bcrypt.genSalt`), así que el hash se resuelve una única vez de
 * forma perezosa y se cachea — nada bloquea el arranque del módulo.
 */
let dummyHashPromise: Promise<string> | null = null;
const getDummyHash = (): Promise<string> => {
  dummyHashPromise ??= hashPassword("dummy-password-for-constant-time-compare");
  return dummyHashPromise;
};

/**
 * Compara una password contra un hash que puede no existir (cuenta creada por Google, SEC-16).
 * Cuando `hash` es `null` compara igual, contra un señuelo del mismo costo, en vez de devolver
 * `false` de inmediato: así el tiempo no distingue "no hay password" de "la password es
 * incorrecta", que es justo el oráculo que D5 cierra.
 */
export const comparePasswords = async (password: string, hash: string | null): Promise<boolean> => {
  if (hash === null) {
    await bcrypt.compare(password, await getDummyHash());
    return false;
  }
  return bcrypt.compare(password, hash);
};

/** Solo para pruebas: expone el hash señuelo para verificar que su costo coincide con el real. */
export const __getDummyHashForTesting = getDummyHash;
