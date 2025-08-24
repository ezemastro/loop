import supertest from "supertest";
import { app, server } from "../app";

console.log("setupAfterEnv");
global.api = supertest(app);
global.__SERVER__ = server;
