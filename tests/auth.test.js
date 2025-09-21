import request from "supertest";
import { jest } from "@jest/globals";
import app from "../app.js";
import db from "../db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// mock modules (estilo parecido a tu test que funciona)
jest.mock("../db.js");
db.query = jest.fn();

jest.mock("bcrypt");
bcrypt.hash = jest.fn();
bcrypt.compare = jest.fn();

jest.mock("jsonwebtoken");
jwt.sign = jest.fn();

describe("Auth routes", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "testsecret";
    process.env.ADMIN_CODE = "ADMIN123";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/signup", () => {
    test("400 si faltan campos", async () => {
      const res = await request(app).post("/api/signup").send({ correo: "a@b.com" }).expect(400);
      expect(res.body.error).toMatch(/Todos los campos/);
    });

    test("409 si correo existe", async () => {
      // Primera llamada a db.query en signup: SELECT 1 FROM Usuario WHERE correo = $1
      db.query.mockResolvedValueOnce({ rows: [ { exists: 1 } ] });
      const res = await request(app)
        .post("/api/signup")
        .send({ nombre: "A", correo: "a@b.com", contrasena: "123" })
        .expect(409);
      expect(res.body.error).toMatch(/Correo ya registrado/);
    });

    test("201 registro exitoso (user)", async () => {
      // 1) check exists -> vacío
      db.query.mockResolvedValueOnce({ rows: [] });
      // bcrypt.hash
      bcrypt.hash.mockResolvedValueOnce("hashed-pass");
      // 2) insert returning -> devolver el usuario
      db.query.mockResolvedValueOnce({
        rows: [{ id: 42, correo: "a@b.com", nombre: "A", rol: "user" }]
      });
      // jwt.sign
      jwt.sign.mockReturnValueOnce("token-123");

      const res = await request(app)
        .post("/api/signup")
        .send({ nombre: "A", correo: "a@b.com", contrasena: "123" })
        .expect(201);

      expect(res.body).toHaveProperty("token", "token-123");
      expect(res.body).toHaveProperty("id", 42);
      expect(db.query).toHaveBeenCalled();
      expect(bcrypt.hash).toHaveBeenCalledWith("123", 10);
      expect(jwt.sign).toHaveBeenCalled();
    });

    test("201 registro con adminCode => admin rol", async () => {
      // 1) check exists -> vacío
      db.query.mockResolvedValueOnce({ rows: [] });
      bcrypt.hash.mockResolvedValueOnce("h");
      // 2) insert returning -> rol admin
      db.query.mockResolvedValueOnce({
        rows: [{ id: 7, correo: "admin@x.com", nombre: "Admin", rol: "admin" }]
      });
      jwt.sign.mockReturnValueOnce("tkn");

      const res = await request(app)
        .post("/api/signup")
        .send({ nombre: "Admin", correo: "admin@x.com", contrasena: "pw", adminCode: "ADMIN123" })
        .expect(201);

      expect(res.body.rol).toBe("admin");
    });
  });

  describe("POST /api/login", () => {
    test("400 si faltan campos", async () => {
      const res = await request(app).post("/api/login").send({ correo: "a@b.com" }).expect(400);
      expect(res.body.error).toMatch(/Todos los campos/);
    });

    test("401 si usuario no encontrado", async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post("/api/login").send({ correo: "no@x.com", contrasena: "x" }).expect(401);
      expect(res.body.error).toMatch(/Usuario no encontrado/);
    });

    test("401 si contraseña incorrecta", async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, contrasena: "hashed" }] });
      bcrypt.compare.mockResolvedValueOnce(false);
      const res = await request(app).post("/api/login").send({ correo: "a@x.com", contrasena: "bad" }).expect(401);
      expect(res.body.error).toMatch(/Contraseña incorrecta/);
    });

    test("200 login exitoso", async () => {
      const usuario = { id: 5, nombre: "Name", correo: "a@x.com", contrasena: "hashedpw", rol: "user" };
      db.query.mockResolvedValueOnce({ rows: [usuario] });
      bcrypt.compare.mockResolvedValueOnce(true);
      jwt.sign.mockReturnValueOnce("jwt-token");
      const res = await request(app).post("/api/login").send({ correo: "a@x.com", contrasena: "pw" }).expect(200);
      expect(res.body).toHaveProperty("token", "jwt-token");
      expect(res.body.usuario).toMatchObject({ id: 5, nombre: "Name", correo: "a@x.com", rol: "user" });
    });
  });
});