
import { jest } from "@jest/globals";

const mockConnect = jest.fn();
const mockListen = jest.fn();

jest.unstable_mockModule('../db.js', () => ({
    default: { connect: mockConnect },
    connect: mockConnect,
}));
jest.unstable_mockModule('../app.js', () => ({
    default: { listen: mockListen },
    listen: mockListen,
}));

describe('server.js', () => {
    let consoleLogSpy;
    let consoleErrorSpy;

    beforeEach(() => {
        jest.resetModules();
        process.env.PORT = '1234';
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        mockConnect.mockReset();
        mockListen.mockReset();
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    test('should log success on successful db connection and start server', async () => {
        const releaseMock = jest.fn();
        mockConnect.mockResolvedValue({ release: releaseMock });

        await import('../server.js');
        // Manually invoke the callback passed to listen
        if (mockListen.mock.calls.length > 0) {
            const listenCallback = mockListen.mock.calls[0][1];
            if (typeof listenCallback === 'function') {
                listenCallback();
            }
        }

        expect(mockConnect).toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalledWith('✅ Conectado a PostgreSQL en Render');
        expect(mockListen).toHaveBeenCalledWith('1234', expect.any(Function));
        expect(consoleLogSpy).toHaveBeenCalledWith('Servidor backend en http://localhost:1234');
    });

    test('should log error on failed db connection', async () => {
        const error = { stack: 'error stack' };
        mockConnect.mockRejectedValue(error);

        await import('../server.js');

        expect(mockConnect).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Error de conexión:', 'error stack');
    });
});
