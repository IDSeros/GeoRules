import request from "supertest";
import { jest } from "@jest/globals";
import app from "../app.js";
import db from "../db.js";

// mock db
jest.mock("../db.js");
db.query = jest.fn();

describe("GET /api/locations", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("devuelve locations en formato esperado", async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          nombre: "Tienda A",
          direccion: "Calle 1",
          tipoestablecimiento: "Tienda",
          numextintores: 2,
          haybotiquin: true,
          hayrociadores: false,
          numemergenexits: 1,
          ultimainspeccion: "2025-09-01"
        }
      ]
    });

    const res = await request(app).get("/api/locations").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({
      name: "Tienda A",
      address: "Calle 1",
      establishment: "Tienda",
      numExtinguisher: 2,
      firstAid: true,
      sprinklers: false,
      emergncyExits: 1,
      lastInspection: "2025-09-01"
    });
    expect(db.query).toHaveBeenCalledWith("SELECT * FROM Ubicacion");
  });

  test("si db falla devuelve 500", async () => {
    db.query.mockRejectedValueOnce(new Error("DB error"));
    const res = await request(app).get("/api/locations").expect(500);
    expect(res.text).toContain("Error en la base de datos");
  });
});
