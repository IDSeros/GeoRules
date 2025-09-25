/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let mod;

beforeEach(async () => {
  jest.resetModules();

  // DOM mínimo requerido por public/map.js en top-level
  document.body.innerHTML = `
    <div id="status"></div>
    <div id="statusPanel"></div>
    <button id="favButton"></button>
    <div id="favoritesPanel"></div>
    <button id="toggleFavorite"></button>
    <div id="favoritesList"></div>
    <div id="panelTitle"></div>
    <div id="addressPanel"></div>
    <div id="infoPanel"></div>
    <div id="map"></div>
    <div id="dragHandle"></div>
  `;

  // mocks globales
  global.navigator = {
    geolocation: {
      watchPosition: jest.fn(),
      getCurrentPosition: jest.fn()
    }
  };

  // default fetch mock (se sobrescribe dentro de tests según necesidad)
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => []
  });

    // stub mínimo y correcto de Leaflet (L) — debe existir antes de evaluar public/map.js
    global.L = {
    Icon: class {},
    map: jest.fn(() => ({
        addLayer: jest.fn(),
        panTo: jest.fn(),
        setView: jest.fn()
    })),
    tileLayer: jest.fn(() => ({ addTo: jest.fn() })),
    // layerGroup devuelve un objeto 'layer' cuya addTo() devuelve el mismo objeto (con clearLayers)
    layerGroup: jest.fn(() => {
        const layer = {
        addTo: jest.fn(function () { return layer; }), // addTo devuelve layer (permite markersLayer = layer)
        clearLayers: jest.fn()
        };
        return layer;
    }),
    marker: jest.fn((coords, opts) => ({
        on: jest.fn(),
        addTo: jest.fn()
    })),
    circleMarker: jest.fn(() => ({ addTo: jest.fn(), setLatLng: jest.fn() })),
    };


  // import dinámico *después* de preparar DOM y mocks
  mod = await import('../public/map.js');
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.resetAllMocks();
});

afterAll(() => {
  delete global.L;
  delete global.fetch;
  delete global.navigator;
  document.body.innerHTML = '';
});

test('getLatLon retorna coords cuando el backend responde OK con data', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => [{ lat: '12.34', lon: '-56.78' }]
  });

  const res = await mod.getLatLon('mi direccion');
  expect(res).toEqual({ lat: 12.34, lon: -56.78 });
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/getLatLon?q='));
});

test('getLatLon retorna null cuando backend devuelve array vacío', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => []
  });
  const res = await mod.getLatLon('direccion inexistente');
  expect(res).toBeNull();
});

test('getLatLon lanza error si res.ok es false', async () => {
  global.fetch.mockResolvedValueOnce({ ok: false });
  await expect(mod.getLatLon('x')).rejects.toThrow();
});

test('getAddress crea map (initApp) si map es null — verificando efectos secundarios', async () => {
  // 1) Primera llamada (getAddress): devolver display_name
  // 2) Segunda llamada (loadAndCacheLocations -> /api/locations): devolver []
  // (si loadAndCacheLocations llama getLatLon también, nuestro mock default devuelve [] para json)
  global.fetch
    .mockResolvedValueOnce({ ok: true, json: async () => ({ display_name: 'Mi lugar' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => [] });

  // estado inicial: map debería ser null/undefined
  // ejecutar getAddress; como map era null, la rama debe ejecutar initApp (real)
  await mod.getAddress(1.23, 4.56);

  // efecto observable: initApp crea un map interno y setea lastUserPos
  expect(mod.map).toBeTruthy();
  // verificar lastUserPos si está exportado
  if (mod.lastUserPos) {
    expect(mod.lastUserPos.lat).toBeCloseTo(1.23);
    expect(mod.lastUserPos.lon).toBeCloseTo(4.56);
  }
});

test('getAddress actualiza usando updateUserLocation cuando map ya existe (verificando efectos)', async () => {
  // Preparar fetch para initApp: loadAndCacheLocations -> devolver []
  global.fetch.mockResolvedValue({ ok: true, json: async () => [] });

  // Llamar a initApp real para que cree mod.map (usa L stub)
  await mod.initApp(0.1, 0.1, 'display');

  // confirmar que map existe
  expect(mod.map).toBeTruthy();

  // preparar fetch para la llamada getAddress (nueva)
  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ display_name: 'abc' }) });

  // guardar prev lastUserPos para comparar
  const prev = mod.lastUserPos ? { ...mod.lastUserPos } : null;

  // ejecutar getAddress; como map existe, la rama interna debe llamar updateUserLocation
  await mod.getAddress(9.87, 6.54);

  if (mod.lastUserPos && prev) {
    expect(mod.lastUserPos.lat).toBeCloseTo(9.87);
    expect(mod.lastUserPos.lon).toBeCloseTo(6.54);
  } else {
    expect(mod.lastUserPos).toBeTruthy();
  }
});
