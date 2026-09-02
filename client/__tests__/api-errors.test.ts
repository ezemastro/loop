import { ERROR_NAMES, parseApiError } from "../services/errors";
import { walkTsFiles } from "./helpers/sourceFiles";
import fs from "fs";
import path from "path";

/**
 * `parseApiError` is the contract `useSelf.ts:37` depends on for the logout trigger: it compares
 * `query.error?.name === ERROR_NAMES.UNAUTHORIZED`. If this contract ever changes shape, that
 * comparison silently stops firing.
 */
describe("parseApiError", () => {
  it("a 401 Axios error yields UnauthorizedError", () => {
    const error = {
      isAxiosError: true,
      message: "Request failed with status code 401",
      response: { status: 401, data: { error: "No autorizado" } },
    };
    expect(parseApiError(error).name).toBe(ERROR_NAMES.UNAUTHORIZED);
  });

  it("a plain thrown object becomes a generic Error, not UnauthorizedError", () => {
    expect(parseApiError({ message: "boom" }).name).toBe("Error");
  });

  it("a thrown string becomes a generic Error", () => {
    expect(parseApiError("boom").name).toBe("Error");
  });

  it("an undefined throwable falls back to the internal-server default, not undefined", () => {
    const result = parseApiError(undefined);
    expect(result.name).toBe(ERROR_NAMES.INTERNAL_SERVER);
    expect(result.message).toBeTruthy();
  });

  it("recovers the server message and errorCode from an Axios error", () => {
    const error = {
      isAxiosError: true,
      message: "Request failed with status code 409",
      response: {
        status: 409,
        data: { error: "El correo ya existe", errorCode: "USER_ALREADY_EXISTS" },
      },
    };
    const result = parseApiError(error);
    expect(result.message).toBe("El correo ya existe");
    expect(result.errorCode).toBe("USER_ALREADY_EXISTS");
  });
});

/**
 * The guard that stops the two error shapes (`parseErrorName` hand-builds vs. total
 * `parseApiError`) from reappearing across `client/hooks/`.
 */
describe("hooks error-contract uniformity", () => {
  const hooksDir = path.join(__dirname, "..", "hooks");
  const hookFiles = walkTsFiles(hooksDir);

  it("no hook file branches on instanceof AxiosError", () => {
    const offenders = hookFiles.filter((file) =>
      fs.readFileSync(file, "utf8").includes("instanceof AxiosError"),
    );
    expect(offenders).toEqual([]);
  });

  it("every catch block in a hook's request functions is followed by throw parseApiError", () => {
    const offenders: string[] = [];
    for (const file of hookFiles) {
      const content = fs.readFileSync(file, "utf8");
      const catchBlocks = content.match(/catch\s*\([^)]*\)\s*\{[^}]*\}/g) ?? [];
      for (const block of catchBlocks) {
        if (!block.includes("throw parseApiError")) {
          offenders.push(`${file}: ${block}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
