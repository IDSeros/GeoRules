import db from '../db.js';
import app from '../app.js';
import { jest } from "@jest/globals";

// Mocks
jest.mock('../db.js');
db.connect = jest.fn();

jest.mock('../app.js');
app.listen = jest.fn();

describe('server startup', () => {
  beforeEach(() => {
    jest.resetModules();         // forzar re-evaluación de módulos
    jest.clearAllMocks();
    process.env.PORT = '3000';
  });

  test('debe conectarse a la DB correctamente', async () => {
    // opcional: mockear el módulo antes de importarlo (no siempre necesario)
    jest.doMock('../db.js', () => ({
      __esModule: true,
      default: {} // lo llenaremos después
    }));
    jest.doMock('../app.js', () => ({
      __esModule: true,
      default: {} // lo llenaremos después
    }));

    // Importa los módulos (ahora vacíos) y luego sobrescribe métodos con jest.fn()
    const dbModule = await import('../db.js');
    const appModule = await import('../app.js');

    const db = dbModule.default;
    const app = appModule.default;

    // Asegurarnos de que connect y listen sean funciones mock
    db.connect = jest.fn();
    app.listen = jest.fn();

    // Preparar comportamiento: connect resuelve con un "client" que tiene release()
    const mockClient = { release: jest.fn() };
    db.connect.mockResolvedValueOnce(mockClient);

    // Silenciar console.log
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Importa el archivo que ejecuta la lógica de inicio (server.js)
    await import('../server.js');

    expect(db.connect).toHaveBeenCalled();
    expect(mockClient.release).toHaveBeenCalled();
    expect(app.listen).toHaveBeenCalledWith('3000', expect.any(Function));

    consoleSpy.mockRestore();
  });

  test('debe manejar error de conexión a la DB', async () => {
    jest.doMock('../db.js', () => ({
      __esModule: true,
      default: {}
    }));
    jest.doMock('../app.js', () => ({
      __esModule: true,
      default: {}
    }));

    const dbModule = await import('../db.js');
    const db = dbModule.default;

    // Asegurar mock
    db.connect = jest.fn();

    const error = new Error('DB falla');
    db.connect.mockRejectedValueOnce(error);

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await import('../server.js');

    expect(db.connect).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith("❌ Error de conexión:", error.stack);

    consoleErrorSpy.mockRestore();
  });

  test('debe iniciar el servidor en el puerto correcto', async () => {
    jest.doMock('../db.js', () => ({
      __esModule: true,
      default: {}
    }));
    jest.doMock('../app.js', () => ({
      __esModule: true,
      default: {}
    }));

    const dbModule = await import('../db.js');
    const appModule = await import('../app.js');

    const db = dbModule.default;
    const app = appModule.default;

    // Asegurar mocks
    db.connect = jest.fn();
    app.listen = jest.fn();

    db.connect.mockResolvedValueOnce({ release: jest.fn() });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await import('../server.js');

    expect(app.listen).toHaveBeenCalledWith('3000', expect.any(Function));

    consoleSpy.mockRestore();
  });
});