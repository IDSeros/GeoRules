import request from "supertest";
import { jest } from "@jest/globals";
import app from "../app";

describe("Nominatim routes", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/getLatLon -> devuelve resultado de Nominatim", async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => [{ lat: "25.0", lon: "-100.0", display_name: "Calle X" }]
    });
    const res = await request(app).get("/api/getLatLon").query({ q: "Calle X" }).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(global.fetch).toHaveBeenCalled();
  });

  test("GET /api/getAddress -> devuelve reverse", async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => ({ display_name: "Calle X", address: { city: "Monterrey" } })
    });
    const res = await request(app).get("/api/getAddress").query({ lat: "25.0", lon: "-100.0" }).expect(200);
    expect(res.body).toHaveProperty("display_name");
  });

  test("si fetch falla -> 500", async () => {
    global.fetch.mockRejectedValueOnce(new Error("network"));
    const res = await request(app).get("/api/getLatLon").query({ q: "ok" }).expect(500);
    expect(res.body).toHaveProperty("error");
  });
});