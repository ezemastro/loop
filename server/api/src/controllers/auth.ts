import { type Request, type Response } from "express";
import { validateRegister } from "../services/validations.js";
import { InvalidInputError } from "../services/errors.js";
import type { AuthModel } from "../types/models.js";

export class AuthController {
  // Inyectar el modelo de autenticación
  authModel: AuthModel;
  constructor({ authModel }: { authModel: AuthModel }) {
    this.authModel = authModel;
  }

  register = async (req: Request, res: Response) => {
    // Validar los datos de la solicitud
    try {
      await validateRegister(req.body);
    } catch {
      throw new InvalidInputError("Datos de registro inválidos");
    }
    // Registrar el usuario
    const { password, firstName, lastName, schoolId, roleId, email } = req.body;
    const { user } = await this.authModel.registerUser({
      firstName,
      lastName,
      password,
      schoolId,
      roleId,
      email,
    });
    // Devolver la respuesta
    return res.status(201).json({ user });
  };
}
