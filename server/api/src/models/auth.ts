import { INITIAL_CREDITS } from "../config.js";
import {
  ConflictError,
  InternalServerError,
  InvalidInputError,
} from "../services/errors.js";
import { comparePasswords, hashPassword } from "../services/hash.js";
import type {
  AuthLoginPayload,
  AuthModelQueries,
  DatabaseService,
  AuthRegisterPayload,
} from "../types/models.js";
import {
  parseSchoolFromDb,
  parseRoleFromDb,
  parseUserFromDb,
} from "../utils/parseDb.js";

export class AuthModel {
  database: DatabaseService;
  queries: AuthModelQueries;
  constructor({
    database,
    queries,
  }: {
    database: DatabaseService;
    queries: AuthModelQueries;
  }) {
    this.database = database;
    this.queries = queries;
  }
  registerUser = async ({
    firstName,
    lastName,
    password,
    schoolId,
    roleId,
    email,
  }: AuthRegisterPayload) => {
    // Iniciar conexión con la base de datos
    let client;
    try {
      client = await this.database.connect();
    } catch {
      throw new InternalServerError("Error al conectar a la base de datos");
    }
    try {
      // Guardar referencia a la conexión
      const db = this.database.bind(client);
      // Realizar la consulta para verificar si el usuario ya existe
      const isExistingUser = await db.exists(this.queries.userExists, [
        firstName,
        lastName,
      ]);
      if (isExistingUser) {
        throw new ConflictError("El usuario ya existe");
      }
      // Obtener rol y escuela
      const [schoolDb, roleDb] = await Promise.all([
        db.one(this.queries.schoolById, [schoolId]),
        db.one(this.queries.roleById, [roleId]),
      ]);

      if (!schoolDb || !roleDb) {
        throw new InvalidInputError("Rol o escuela no encontrados");
      }
      const school = parseSchoolFromDb(schoolDb);
      const role = parseRoleFromDb(roleDb);
      // Encriptar la contraseña
      const hashedPassword = await hashPassword(password);
      // Insertar el nuevo usuario en la base de datos
      const { id } = await db.one(this.queries.insertUser, [
        email,
        firstName,
        lastName,
        hashedPassword,
        schoolId,
        roleId,
      ]);
      // Devolver el usuario creado
      const user: User = {
        id,
        firstName,
        lastName,
        email: null,
        phone: null,
        schoolId,
        school,
        roleId,
        role,
        credits: {
          balance: INITIAL_CREDITS,
          locked: 0,
        },
        profileMediaId: null,
      };
      return { user };
    } catch (error) {
      // Deshacer cambios si ocurre un error
      this.database.rollback(client);
      if (
        error instanceof InvalidInputError ||
        error instanceof ConflictError
      ) {
        throw error;
      }
      throw new InternalServerError("Error al registrar el usuario");
    } finally {
      // Asegurarse de liberar el cliente en caso de error
      this.database.release(client);
    }
  };

  loginUser = async ({ email, password }: AuthLoginPayload) => {
    // Iniciar conexión con la base de datos
    let client;
    try {
      client = await this.database.connect();
    } catch {
      throw new InternalServerError("Error al conectar a la base de datos");
    }
    try {
      // Guardar referencia a la conexión
      const db = this.database.bind(client);
      // Realizar la consulta para verificar si el usuario existe
      const userDb = await db.one(this.queries.userByEmail, [email]);
      if (!userDb) {
        throw new InvalidInputError("Credenciales inválidas");
      }
      // Verificar la contraseña
      const isPasswordCorrect = await comparePasswords(
        password,
        userDb.password,
      );
      if (!isPasswordCorrect) {
        throw new InvalidInputError("Credenciales inválidas");
      }
      // Devolver el usuario autenticado
      return { user: parseUserFromDb(userDb) };
    } catch (error) {
      // Manejar errores
      if (
        error instanceof InvalidInputError ||
        error instanceof ConflictError
      ) {
        throw error;
      }
      throw new InternalServerError("Error al iniciar sesión");
    } finally {
      // Asegurarse de liberar el cliente en caso de error
      this.database.release(client);
    }
  };
}
