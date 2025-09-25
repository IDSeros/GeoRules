// server.test.js
import db from '../db.js';
import app from '../app.js';

// Mocks
jest.mock('../db.js', () => ({
  connect: jest.fn()
}));

jest.mock('../app.js', () => ({
  listen: jest.fn()
}));

describe('server startup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PORT = '3000';
  });

  test('debe conectarse a la DB correctamente', async () => {
    const mockClient = { release: jest.fn() };
    db.connect.mockResolvedValueOnce(mockClient);

    // Importar el archivo que levanta el servidor
    await import('../server.js');

    expect(db.connect).toHaveBeenCalled();
    expect(mockClient.release).toHaveBeenCalled();
  });

  test('debe manejar error de conexión a la DB', async () => {
    const error = new Error('DB falla');
    db.connect.mockRejectedValueOnce(error);

    // Capturar console.error
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await import('../server.js');

    expect(db.connect).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      "❌ Error de conexión:",
      error.stack
    );

    consoleSpy.mockRestore();
  });

  test('debe iniciar el servidor en el puerto correcto', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    db.connect.mockResolvedValueOnce({ release: jest.fn() });

    await import('../server.js');

    expect(app.listen).toHaveBeenCalledWith('3000', expect.any(Function));

    consoleSpy.mockRestore();
  });
});
