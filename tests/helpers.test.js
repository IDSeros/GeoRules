/** @jest-environment jsdom */
import { jest } from '@jest/globals';

let mod;

beforeAll(async () => {
  // asegurarnos de partir limpio y que no haya importaciones previas
  jest.resetModules();

  // DOM completo con los ids que usa map.js en top-level y en handlers/clicks
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

  // mocks globales
  global.navigator = {
    geolocation: {
      watchPosition: jest.fn(),
      getCurrentPosition: jest.fn()
    }
  };

  // mock fetch básico (puedes sobrescribir en tests individuales)
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => []
  });

  // stub mínimo de Leaflet (L) — debe existir antes de la evaluación del módulo
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

  // import dinámico sólo después de preparar DOM y mocks
  mod = await import('../public/map.js');
});

afterAll(() => {
  // limpieza opcional
  delete global.L;
  delete global.fetch;
  delete global.navigator;
  // limpiar DOM si quieres
  document.body.innerHTML = '';
});

test('deg2rad convierte grados a radianes', () => {
  expect(mod.deg2rad(180)).toBeCloseTo(Math.PI);
  expect(mod.deg2rad(90)).toBeCloseTo(Math.PI / 2);
});

test('distancia entre el mismo punto es 0', () => {
  expect(mod.getDistanceFromLatLonInKm(10, 20, 10, 20)).toBeCloseTo(0, 6);
});
