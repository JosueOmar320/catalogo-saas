import type { Catalog } from '../translate';
import admin from './admin';
import assistant from './assistant';
import builder from './builder';
import catalog from './catalog';
import core from './core';
import labels from './labels';
import landing from './landing';
import pdf from './pdf';

/** Catálogo inglés de la app (panel, admin, login, landing). El sitio público usa `./site`. */
export const APP_EN: Catalog = { ...core, ...landing, ...labels, ...catalog, ...builder, ...pdf, ...assistant, ...admin };
