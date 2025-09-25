/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let mod;

beforeEach(async () => {
  // Asegurarnos de partir limpio y que no haya módulos importados antes
  jest.resetModules();

  // DOM mínimo (ids usados en map.js)
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

  // mock navigator.geolocation
  global.navigator = {
    geolocation: {
      watchPosition: jest.fn(),
      getCurrentPosition: jest.fn()
    }
  };

  // fetch por defecto: loadAndCacheLocations -> /api/locations -> devolver []
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => []
  });

  // stub correcto de Leaflet (L): layerGroup.addTo devuelve el layer con clearLayers
  global.L = {
    Icon: class {},
    map: jest.fn(() => ({ addLayer: jest.fn(), panTo: jest.fn(), setView: jest.fn() })),
    tileLayer: jest.fn(() => ({ addTo: jest.fn() })),
    layerGroup: jest.fn(() => {
      const layer = {
        addTo: jest.fn(function () { return layer; }),
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

  // Import dinámico después de preparar DOM/mocks
  mod = await import('../public/map.js');

  // Inicializar markersLayer llamando a initApp (usa nuestro stub de L)
  // Como fetch devuelve [], loadAndCacheLocations no añadirá locations que compliquen el init
  await mod.initApp(0, 0, 'init');
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

test('updateMarkersForPosition crea marcadores para ubicaciones dentro de 5km', async () => {
  // preparar locationsCache con una ubicación cercana a (0,0)
  // en vez de reasignar mod.locationsCache = [...], mutamos el array exportado
  if (!Array.isArray(mod.locationsCache)) {
    // si por alguna razón no existe o no es array, intentar inicializar vía push (si es posible)
    try {
      // intentar crear property interna (solo si el módulo lo permite)
      // pero lo habitual es que locationsCache exista como array exportado; si no, fallará aquí y deberás añadir un setter en el módulo
      mod.locationsCache = [];
    } catch (e) {
      // fallback: lanzar para que quede claro qué hay que cambiar en el módulo
      throw new Error('locationsCache no es un array exportado; añade `export let locationsCache = []` en el módulo para testear correctamente.');
    }
  } else {
    // vaciar sin reasignar
    mod.locationsCache.length = 0;
  }

  // ahora pushear la location
  mod.locationsCache.push({
    id: '1',
    name: 'X',
    address: 'a',
    establishment: 'e',
    numExtinguisher: 1,
    firstAid: true,
    sprinklers: false,
    emergncyExits: 1,
    lastInspection: '2020',
    accessibility: 'OK',
    coords: { lat: 0.001, lon: 0.001 }
  });

  // asegurar favorites como array mutándolo
  if (!Array.isArray(mod.favorites)) {
    try { mod.favorites = []; } catch (e) {
      // si favorites no es mutable, intentar empujar si existe
      if (mod.favorites && typeof mod.favorites.push === 'function') {
        mod.favorites.length = 0;
      } else {
        throw new Error('favorites no es un array exportado; añade `export let favorites = []` en el módulo para testear correctamente.');
      }
    }
  } else {
    mod.favorites.length = 0;
  }

  // Ejecutar la función bajo prueba
  await mod.updateMarkersForPosition(0, 0);

  // markersLayer fue creado por initApp: comprobamos que clearLayers se llamó
  expect(mod.markersLayer).toBeTruthy();
  expect(typeof mod.markersLayer.clearLayers === 'function').toBe(true);
  expect(mod.markersLayer.clearLayers).toHaveBeenCalled();

  // y L.marker se debió haber invocado al menos una vez para la location cercana
  expect(L.marker).toHaveBeenCalled();
});
