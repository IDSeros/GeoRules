import { verificarToken, soloAdmin } from '../auth.js';
import jwt from 'jsonwebtoken';
import { jest } from "@jest/globals";

// Mock de jsonwebtoken
jest.mock('jsonwebtoken');

describe('verificarToken', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    process.env.JWT_SECRET = 'testsecret';
  });

  test('devuelve 401 si no hay token', () => {
    req.headers = {}; // sin Authorization
    verificarToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Token requerido" });
    expect(next).not.toHaveBeenCalled();
  });

  test('devuelve 403 si el token es inválido', () => {
    req.headers = { authorization: 'Bearer invalidtoken' };
    jwt.verify.mockImplementation((token, secret, cb) => cb(new Error('fail')));
    verificarToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Token inválido o expirado" });
    expect(next).not.toHaveBeenCalled();
  });

  test('pasa al next si el token es válido', () => {
    const payload = { id: 1, rol: 'user' };
    req.headers = { authorization: 'Bearer validtoken' };
    jwt.verify.mockImplementation((token, secret, cb) => cb(null, payload));

    verificarToken(req, res, next);
    expect(req.user).toEqual(payload);
    expect(next).toHaveBeenCalled();
  });
});

describe('soloAdmin', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  test('bloquea acceso si no hay usuario', () => {
    soloAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Acceso denegado: solo administradores" });
    expect(next).not.toHaveBeenCalled();
  });

  test('bloquea acceso si el rol no es admin', () => {
    req.user = { rol: 'user' };
    soloAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Acceso denegado: solo administradores" });
    expect(next).not.toHaveBeenCalled();
  });

  test('pasa al next si el usuario es admin', () => {
    req.user = { rol: 'admin' };
    soloAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
