/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let mod;

beforeAll(async () => {
  // Asegurarnos de partir limpio y que no haya módulos importados antes
  jest.resetModules();

  // DOM completo mínimo (incluye ids usados en top-level de public/map.js)
  document.body.innerHTML = `
    <div id="status"></div>
    <div id="statusPanel"></div>

    <button id="favButton"></button>
    <div id="favoritesPanel"></div>
    <button id="toggleFavorite"></button>
    <div id="favoritesList"></div>

    <div id="panelTitle"></div>
    <div id="addressPanel"></div>
    <div id="establishmentPanel"></div>
    <div id="extinguishPanel"></div>
    <div id="firstAidPanel"></div>
    <div id="sprinklerPanel"></div>
    <div id="emergenExitPanel"></div>
    <div id="inspectionPanel"></div>
    <div id="accessPanel"></div>

    <div id="infoPanel"></div>

    <div id="map"></div>
    <div id="dragHandle"></div>
  `;

  // mocks globales necesarios antes de importar el módulo
  global.navigator = {
    geolocation: {
      watchPosition: jest.fn(),
      getCurrentPosition: jest.fn()
    }
  };

  // fetch por defecto (puedes sobrescribir en tests individuales)
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => []
  });

  // stub mínimo de Leaflet (L) — debe existir antes de evaluar public/map.js
  global.L = {
    Icon: class {},
    map: jest.fn(() => ({
      addLayer: jest.fn(),
      panTo: jest.fn(),
      setView: jest.fn()
    })),
    tileLayer: jest.fn(() => ({ addTo: jest.fn() })),
    layerGroup: jest.fn(() => ({ addTo: () => ({}), clearLayers: jest.fn() })),
    marker: jest.fn((coords, opts) => ({
      on: jest.fn((evt, cb) => { /* no-op */ }),
      addTo: jest.fn()
    })),
    circleMarker: jest.fn(() => ({ addTo: jest.fn(), setLatLng: jest.fn() })),
  };

  // Import dinámico después de tener todo preparado
  mod = await import('../public/map.js');
});

beforeEach(() => {
  // reset fetch mock por test (y limpiar localStorage)
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => []
  });
  localStorage.clear();
  // si quieres empezar favorites vacío:
  mod.favorites.length = 0;
});

afterEach(() => {
  jest.resetAllMocks();
});

afterAll(() => {
  // limpieza global
  delete global.L;
  delete global.fetch;
  delete global.navigator;
  document.body.innerHTML = '';
});

test('loadFavorites obtiene favoritos y los asigna', async () => {
  localStorage.setItem('token', 'tok123');
  const fakeFavs = [{ nombre: 'LugarA', idubicacion: '1', id: '1', direccion: 'd' }];
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => fakeFavs
  });

  await mod.loadFavorites();
  expect(mod.favorites).toEqual(fakeFavs);
});

test('isFavorite reconoce favorito', async () => {
  // vaciar y luego insertar el objeto como mutación
  mod.favorites.length = 0;
  mod.favorites.push({ nombre: 'LugarA' });
  expect(await mod.isFavorite('LugarA')).toBe(true);
  expect(await mod.isFavorite('Otro')).toBe(false);
});

test('updateFavButton actualiza texto del boton según favorito', async () => {
  mod.favorites.length = 0;
  mod.favorites.push({ nombre: 'LugarX' });
  await mod.updateFavButton('LugarX');
  const btn = document.getElementById('toggleFavorite');
  expect(
    btn.textContent.includes('Quitar') || btn.textContent.includes('Añadir')
  ).toBe(true);
});

