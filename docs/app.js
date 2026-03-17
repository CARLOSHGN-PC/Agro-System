// FIREBASE: Importe os módulos necessários do Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, query, where, getDocs, enableIndexedDbPersistence, Timestamp, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, setPersistence, browserSessionPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";
// Importa a biblioteca para facilitar o uso do IndexedDB (cache offline)
import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@7.1.1/build/index.js';
import FleetModule from './js/fleet.js';
import CalculationService from './js/lib/CalculationService.js';
import { perfLogger } from './js/lib/PerfLogger.js';
import VirtualList from './js/lib/VirtualList.js';
import { appDiagnostics } from './js/lib/AppDiagnostics.js';
import { createAerialMapProvider } from './js/mapProviders/MapProviderFactory.js';

document.addEventListener('DOMContentLoaded', () => {
    perfLogger.start('App Boot');
    appDiagnostics.start();

    // Lógica da Tela de Abertura
    const splashScreen = document.getElementById('splash-screen');
    if (splashScreen) {
        // Esconde a tela de abertura após a animação e um pequeno atraso
        setTimeout(() => {
            splashScreen.classList.add('hidden');
        }, 1500); // Reduzido de 2500ms para carregamento mais rapido
    }

    const firebaseConfig = {
        apiKey: "AIzaSyBFXgXKDIBo9JD9vuGik5VDYZFDb_tbCrY",
        authDomain: "agrovetor-v2.firebaseapp.com",
        projectId: "agrovetor-v2",
        storageBucket: "agrovetor-v2.firebasestorage.app",
        messagingSenderId: "782518751171",
        appId: "1:782518751171:web:d501ee31c1db33da4eb776",
        measurementId: "G-JN4MSW63JR"
    };

    const firebaseApp = initializeApp(firebaseConfig);
    const db = getFirestore(firebaseApp);
    const auth = getAuth(firebaseApp);
    const storage = getStorage(firebaseApp);
    
    const secondaryApp = initializeApp(firebaseConfig, "secondary");
    const secondaryAuth = getAuth(secondaryApp);

    // Adiciona as definições de projeção para o Proj4js
    console.log(`[SHP] proj4 loaded = ${typeof window.proj4 === 'function'}`);
    if (window.proj4) {
        // Definição para SIRGAS 2000 geográfico (graus)
        proj4.defs("EPSG:4674", "+proj=longlat +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +no_defs");
        // Definição para SIRGAS 2000 / UTM zone 22S (metros) - a mais provável para o SHP
        proj4.defs("EPSG:31982", "+proj=utm +zone=22 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
        // Definição padrão para WGS84 (usado pelo Mapbox)
        proj4.defs("WGS84", "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs");
    } else {
        console.error("Proj4js não foi carregado. A reprojeção de coordenadas não funcionará.");
    }


    enableIndexedDbPersistence(db)
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                console.warn("A persistência offline falhou. Múltiplas abas abertas?");
            } else if (err.code == 'unimplemented') {
                console.warn("O navegador atual não suporta a persistência offline.");
            }
        });

    // Defer Chart.js initialization until libraries are loaded (defer scripts)
    const _initChartJS = () => {
        if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
            Chart.defaults.font.family = "'Poppins', sans-serif";
            return true;
        }
        return false;
    };
    if (!_initChartJS()) {
        const _chartInitInterval = setInterval(() => {
            if (_initChartJS()) clearInterval(_chartInitInterval);
        }, 100);
        setTimeout(() => clearInterval(_chartInitInterval), 15000);
    }

    // --- Performance Utilities ---

    // Debounce: groups rapid calls into a single execution
    const _debounceTimers = {};
    const _perfDebounce = (key, fn, delay = 120) => {
        clearTimeout(_debounceTimers[key]);
        _debounceTimers[key] = setTimeout(fn, delay);
    };

    // Batch DOM updates via requestAnimationFrame
    const _scheduleRender = (fn) => {
        requestAnimationFrame(fn);
    };

    // Build select options with DocumentFragment for better performance
    const _buildSelectOptions = (select, firstOptionHTML, items, mapFn) => {
        if (!select) return;
        const saved = select.value;
        const frag = document.createDocumentFragment();
        const tmp = document.createElement('select');
        tmp.innerHTML = firstOptionHTML;
        while (tmp.firstChild) frag.appendChild(tmp.firstChild);
        items.forEach(item => {
            const opt = document.createElement('option');
            const mapped = mapFn(item);
            opt.value = mapped.value;
            opt.textContent = mapped.text;
            frag.appendChild(opt);
        });
        select.innerHTML = '';
        select.appendChild(frag);
        select.value = saved;
    };

    const runOfflineOptimization = async () => {
        const essentialUrls = ['./', './index.html', './app.js', './manifest.json', './icons/icon-192x192.png'];
        const cache = await caches.open('agrovetor-manual-offline-v1');
        let completed = 0;
        for (const url of essentialUrls) {
            try {
                await cache.add(url);
                completed += 1;
            } catch (error) {
                console.warn('[offline-opt] falha ao aquecer cache:', url, error?.message || error);
            }
        }
        const payload = {
            timestamp: new Date().toISOString(),
            companyId: window.App?.state?.currentUser?.companyId || null,
            usersCount: window.App?.state?.users?.length || 0,
            farmsCount: window.App?.state?.fazendas?.length || 0
        };
        try {
            const db = await openDB('agrovetor-offline-storage', OFFLINE_DB_VERSION);
            await db.put('data_cache', {
                id: `offline-opt-${Date.now()}`,
                collection: 'offline-opt',
                data: payload,
                updatedAt: payload.timestamp,
                syncStatus: 'synced'
            });
        } catch (error) {
            console.warn('[offline-opt] não foi possível gravar resumo no IndexedDB:', error);
        }
        return {
            completed,
            total: essentialUrls.length,
            approxSizeKb: Math.round((essentialUrls.length * 150))
        };
    };

    const runShapefileWorker = (arrayBuffer) => new Promise((resolve, reject) => {
        const worker = new Worker('./js/workers/shpWorker.js');
        worker.onmessage = (event) => {
            worker.terminate();
            if (event.data?.ok) {
                resolve({ geojson: event.data.geojson, debug: event.data.debug || null });
            } else {
                reject(new Error(event.data?.error || 'Falha ao processar mapa no worker.'));
            }
        };
        worker.onerror = (error) => {
            worker.terminate();
            reject(error);
        };
        worker.postMessage({ type: 'PARSE_SHP_BUFFER', payload: arrayBuffer });
    });

    const OFFLINE_DB_VERSION = 11;
    const MASTER_DATA_COLLECTIONS = [
        'fazendas',
        'personnel',
        'frentesDePlantio',
        'tipos_servico',
        'operacoes',
        'produtos',
        'operacao_produtos',
        'ordens_servico',
        'frota',
        'armadilhas'
    ];

    const isCapacitorNative = () => Boolean(window.Capacitor && Capacitor.isNativePlatform?.());
    const isAereoOfflineDebugEnabled = () => Boolean(window.DEBUG_AEREO_OFFLINE || localStorage.getItem('DEBUG_AEREO_OFFLINE') === '1');

    const logAereoOffline = (stage, payload = {}) => {
        if (!isAereoOfflineDebugEnabled()) return;
        const entry = {
            stage,
            at: nowIso(),
            isOnline: navigator.onLine,
            ...payload,
        };
        console.info('[AEREO_OFFLINE]', entry);
    };

    const logAereoOfflineError = (stage, error, payload = {}) => {
        const entry = {
            stage,
            at: nowIso(),
            isOnline: navigator.onLine,
            ...payload,
            name: error?.name || null,
            message: error?.message || String(error),
            stack: error?.stack || null,
        };
        console.error('[AEREO_OFFLINE]', entry);
    };

    const logShpSource = (source, detail = '') => {
        const suffix = detail ? ` ${detail}` : '';
        console.info(`[SHP] source=${source}${suffix}`);
    };

    const normalizeToArrayBuffer = async (input) => {
        if (input instanceof ArrayBuffer) return input;
        if (input instanceof Blob) return input.arrayBuffer();
        if (input instanceof Uint8Array) {
            return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
        }
        if (typeof input === 'string') {
            const cleaned = input.includes(',') ? input.split(',').pop() : input;
            const binary = atob(cleaned || '');
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
            return bytes.buffer;
        }
        if (input?.buffer instanceof ArrayBuffer) {
            const bytes = new Uint8Array(input.buffer, input.byteOffset || 0, input.byteLength || input.buffer.byteLength);
            return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        }
        throw new Error('Formato de buffer SHP não suportado.');
    };

    const nowIso = () => new Date().toISOString();
    const getContourCacheKey = () => `company:${App.state.currentUser?.companyId || 'anon'}:default`;

    const isPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';
    const FIRESTORE_DATE_FIELDS = new Set(['dataInstalacao', 'dataColeta']);

    const parseDateLikeValue = (value) => {
        if (!value) return null;

        if (value instanceof Date) {
            return isNaN(value.getTime()) ? null : value;
        }

        if (typeof value === 'number' && Number.isFinite(value)) {
            const timestamp = value >= 1e12 ? value : value * 1000;
            const parsedNumber = new Date(timestamp);
            return isNaN(parsedNumber.getTime()) ? null : parsedNumber;
        }

        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return null;

            const parsedGeneric = new Date(trimmed);
            if (!isNaN(parsedGeneric.getTime())) return parsedGeneric;

            const ptBrMatch = trimmed.match(/^((\d{2})\/(\d{2})\/(\d{4}))(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
            if (ptBrMatch) {
                const [, , day, month, year, hours = '00', minutes = '00', seconds = '00'] = ptBrMatch;
                const parsedPtBr = new Date(
                    Number(year),
                    Number(month) - 1,
                    Number(day),
                    Number(hours),
                    Number(minutes),
                    Number(seconds)
                );
                if (
                    parsedPtBr.getFullYear() === Number(year)
                    && parsedPtBr.getMonth() === Number(month) - 1
                    && parsedPtBr.getDate() === Number(day)
                    && !isNaN(parsedPtBr.getTime())
                ) {
                    return parsedPtBr;
                }
            }
        }

        return null;
    };

    const toFirestoreTimestampIfNeeded = (value) => {
        if (value == null) return value;

        if (value instanceof Timestamp) return value;

        if (typeof value?.toDate === 'function') {
            const fromToDate = value.toDate();
            if (fromToDate instanceof Date && !isNaN(fromToDate.getTime())) {
                return Timestamp.fromDate(fromToDate);
            }
        }

        if (value instanceof Date) {
            return isNaN(value.getTime()) ? value : Timestamp.fromDate(value);
        }

        if (typeof value === 'object') {
            const seconds = Number.isFinite(value.seconds) ? Number(value.seconds) : Number(value._seconds);
            const nanoseconds = Number.isFinite(value.nanoseconds)
                ? Number(value.nanoseconds)
                : (Number.isFinite(value._nanoseconds) ? Number(value._nanoseconds) : 0);

            if (Number.isFinite(seconds)) {
                const millis = (seconds * 1000) + Math.floor((Number.isFinite(nanoseconds) ? nanoseconds : 0) / 1e6);
                return Timestamp.fromMillis(millis);
            }
        }

        const parsedDate = parseDateLikeValue(value);
        if (parsedDate) return Timestamp.fromDate(parsedDate);

        return value;
    };

    const rehydrateFirestoreTypes = (payload, parentKey = null) => {
        if (FIRESTORE_DATE_FIELDS.has(parentKey)) {
            return toFirestoreTimestampIfNeeded(payload);
        }

        if (Array.isArray(payload)) {
            return payload.map(item => rehydrateFirestoreTypes(item, parentKey));
        }

        if (isPlainObject(payload)) {
            const hydrated = {};
            Object.entries(payload).forEach(([key, value]) => {
                hydrated[key] = rehydrateFirestoreTypes(value, key);
            });
            return hydrated;
        }

        return payload;
    };

    const sanitizeFirestoreData = (value) => {
        if (value instanceof Date || value instanceof Timestamp || typeof value?.toDate === 'function') {
            return value;
        }

        if (Array.isArray(value)) {
            return value
                .map(item => sanitizeFirestoreData(item))
                .filter(item => item !== undefined);
        }

        if (isPlainObject(value)) {
            const sanitized = {};
            Object.entries(value).forEach(([key, nestedValue]) => {
                const cleanValue = sanitizeFirestoreData(nestedValue);
                if (cleanValue !== undefined) {
                    sanitized[key] = cleanValue;
                }
            });
            return sanitized;
        }

        return value === undefined ? undefined : value;
    };

    const validateGeoJsonContours = (geojson) => {
        if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
            throw new Error('GeoJSON inválido: FeatureCollection/features ausentes.');
        }
        return geojson.features.length;
    };

    class ContourStorageWeb {
        async save({ key, buffer, geojson }) {
            const startedAt = performance.now();
            const normalizedBuffer = await normalizeToArrayBuffer(buffer);
            const normalizedGeoJson = JSON.parse(JSON.stringify(geojson));
            const jsonText = JSON.stringify(normalizedGeoJson);
            const metadata = {
                key,
                updatedAt: nowIso(),
                filePath: null,
                checksum: `${normalizedBuffer.byteLength}:${normalizedGeoJson.features?.length || 0}`,
                size: normalizedBuffer.byteLength,
                source: 'indexeddb-web'
            };
            await OfflineDB.set('shapefile-cache', normalizedBuffer, `shapefile-zip:${key}`);
            await OfflineDB.set('contours_geojson', jsonText, key);
            await OfflineDB.set('contours_index', metadata);
            logAereoOffline('storage:web:save', { key, bytes: normalizedBuffer.byteLength, ms: Math.round(performance.now() - startedAt) });
            return metadata;
        }

        async load(key) {
            const startedAt = performance.now();
            logAereoOffline('storage:web:load:start', { key, dbName: 'agrovetor-offline-storage', dbVersion: OFFLINE_DB_VERSION, store: 'contours_geojson', getKey: key });
            const metadata = await OfflineDB.get('contours_index', key);
            const raw = await OfflineDB.get('contours_geojson', key);
            if (!raw) {
                logAereoOffline('storage:web:load:miss', { key, metadataExists: Boolean(metadata), getResult: raw == null ? String(raw) : 'value' });
                return null;
            }
            const geojson = JSON.parse(raw);
            const featureCount = validateGeoJsonContours(geojson);
            logAereoOffline('storage:web:load:success', { key, featureCount, bytes: raw.length, ms: Math.round(performance.now() - startedAt) });
            return { geojson, metadata };
        }

        async clear(key) {
            await OfflineDB.delete('contours_index', key);
            await OfflineDB.delete('contours_geojson', key);
            await OfflineDB.delete('shapefile-cache', `shapefile-zip:${key}`);
        }
    }

    class ContourStorageNative {
        constructor() {
            this.directory = 'DATA';
        }

        _ensurePlugin() {
            const fs = Capacitor?.Plugins?.Filesystem;
            if (!fs) throw new Error('Filesystem plugin indisponível no Capacitor.');
            return fs;
        }

        async save({ key, buffer, geojson }) {
            const startedAt = performance.now();
            const normalizedBuffer = await normalizeToArrayBuffer(buffer);
            const normalizedGeoJson = JSON.parse(JSON.stringify(geojson));
            const jsonText = JSON.stringify(normalizedGeoJson);
            const bytes = new TextEncoder().encode(jsonText).byteLength;
            const filePath = `contours/${encodeURIComponent(key)}.geojson`;
            const fs = this._ensurePlugin();
            await fs.writeFile({ path: filePath, data: btoa(unescape(encodeURIComponent(jsonText))), directory: this.directory, recursive: true });
            const metadata = {
                key,
                updatedAt: nowIso(),
                filePath,
                checksum: `${normalizedBuffer.byteLength}:${normalizedGeoJson.features?.length || 0}`,
                size: bytes,
                source: 'filesystem-native'
            };
            await OfflineDB.set('shapefile-cache', normalizedBuffer, `shapefile-zip:${key}`);
            await OfflineDB.set('contours_geojson', jsonText, key);
            await OfflineDB.set('contours_index', metadata);
            logAereoOffline('storage:native:save', { key, directory: this.directory, path: filePath, bytes, ms: Math.round(performance.now() - startedAt) });
            return metadata;
        }

        async load(key) {
            const startedAt = performance.now();
            const metadata = await OfflineDB.get('contours_index', key);
            logAereoOffline('storage:native:metadata', { key, dbName: 'agrovetor-offline-storage', dbVersion: OFFLINE_DB_VERSION, store: 'contours_index', getKey: key, found: Boolean(metadata) });
            const fs = this._ensurePlugin();
            if (metadata?.filePath) {
                try {
                    logAereoOffline('storage:native:filesystem:read:start', { directory: this.directory, path: metadata.filePath });
                    const fileResult = await fs.readFile({ path: metadata.filePath, directory: this.directory });
                    const fileData = typeof fileResult?.data === 'string' ? fileResult.data : '';
                    const jsonText = decodeURIComponent(escape(atob(fileData)));
                    const geojson = JSON.parse(jsonText);
                    const featureCount = validateGeoJsonContours(geojson);
                    logAereoOffline('storage:native:filesystem:read:success', { key, featureCount, bytes: jsonText.length, ms: Math.round(performance.now() - startedAt) });
                    return { geojson, metadata, source: 'filesystem' };
                } catch (error) {
                    logAereoOfflineError('storage:native:filesystem:read:error', error, { directory: this.directory, path: metadata.filePath });
                }
            }

            const indexedRaw = await OfflineDB.get('contours_geojson', key);
            logAereoOffline('storage:native:indexeddb:fallback', { store: 'contours_geojson', getKey: key, found: Boolean(indexedRaw) });
            if (!indexedRaw) return null;

            const geojson = JSON.parse(indexedRaw);
            validateGeoJsonContours(geojson);
            const rebuiltPath = metadata?.filePath || `contours/${encodeURIComponent(key)}.geojson`;
            await fs.writeFile({ path: rebuiltPath, data: btoa(unescape(encodeURIComponent(indexedRaw))), directory: this.directory, recursive: true });
            await OfflineDB.set('contours_index', { ...(metadata || {}), key, filePath: rebuiltPath, size: indexedRaw.length, updatedAt: nowIso(), source: 'filesystem-rebuilt' });
            logAereoOffline('storage:native:filesystem:rebuilt', { key, directory: this.directory, path: rebuiltPath, bytes: indexedRaw.length });
            return { geojson, metadata: await OfflineDB.get('contours_index', key), source: 'indexeddb-rebuild' };
        }

        async clear(key) {
            const metadata = await OfflineDB.get('contours_index', key);
            if (metadata?.filePath) {
                try {
                    const fs = this._ensurePlugin();
                    await fs.deleteFile({ path: metadata.filePath, directory: this.directory });
                } catch (error) {
                    logAereoOfflineError('storage:native:clear:file:error', error, { key, path: metadata?.filePath, directory: this.directory });
                }
            }
            await OfflineDB.delete('contours_index', key);
            await OfflineDB.delete('contours_geojson', key);
            await OfflineDB.delete('shapefile-cache', `shapefile-zip:${key}`);
        }
    }

    const getContourStorageAdapter = () => {
        if (App.state.contourStorageAdapter) return App.state.contourStorageAdapter;
        App.state.contourStorageAdapter = isCapacitorNative() ? new ContourStorageNative() : new ContourStorageWeb();
        logAereoOffline('storage:adapter:selected', { adapter: App.state.contourStorageAdapter.constructor.name, native: isCapacitorNative() });
        return App.state.contourStorageAdapter;
    };

    const logBootStage = (stage, extra = {}) => {
        const payload = Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : '';
        console.info(`[${nowIso()}] ${stage}${payload}`);
    };

    const logBootError = (stage, error, extra = {}) => {
        console.error(`[${nowIso()}] ${stage}`, {
            ...extra,
            message: error?.message || String(error),
            stack: error?.stack || null,
            code: error?.code || null,
        });
    };

    const withTimeout = async (promise, ms, label = 'operação remota') => {
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(`Timeout (${ms}ms): ${label}`)), ms);
        });
        try {
            return await Promise.race([promise, timeoutPromise]);
        } finally {
            clearTimeout(timeoutId);
        }
    };

    const inspectStorageHealth = async () => {
        const diagnostics = {
            indexedDbAvailable: typeof indexedDB !== 'undefined',
            cacheStorageAvailable: typeof caches !== 'undefined',
            persistedStorage: null,
            quotaMb: null,
            usageMb: null,
            cacheCount: null,
            cacheNames: [],
        };

        try {
            if (navigator.storage?.persisted) {
                diagnostics.persistedStorage = await navigator.storage.persisted();
            }
            if (navigator.storage?.estimate) {
                const estimate = await navigator.storage.estimate();
                diagnostics.quotaMb = estimate?.quota ? Number((estimate.quota / (1024 * 1024)).toFixed(2)) : null;
                diagnostics.usageMb = estimate?.usage ? Number((estimate.usage / (1024 * 1024)).toFixed(2)) : null;
            }
        } catch (error) {
            logBootError('STORAGE:estimate:error', error);
        }

        try {
            if (typeof caches !== 'undefined') {
                const names = await caches.keys();
                diagnostics.cacheCount = names.length;
                diagnostics.cacheNames = names;
            }
        } catch (error) {
            logBootError('CACHE:error', error);
        }

        logBootStage('STORAGE:diagnostics', diagnostics);
        return diagnostics;
    };

    const bootstrapCache = {
        dbPromise: null,
        async init() {
            if (!this.dbPromise) {
                this.dbPromise = openDB('agrovetor-bootstrap-cache', 1, {
                    upgrade(db) {
                        if (!db.objectStoreNames.contains('kv')) {
                            db.createObjectStore('kv');
                        }
                    }
                });
            }
            return this.dbPromise;
        },
        async get(key, fallback = null) {
            try {
                const dbInstance = await this.init();
                const value = await dbInstance.get('kv', key);
                return value ?? fallback;
            } catch (error) {
                console.warn('[bootstrap-cache] falha ao ler chave', key, error?.message || error);
                return fallback;
            }
        },
        async set(key, value) {
            try {
                const dbInstance = await this.init();
                await dbInstance.put('kv', value, key);
            } catch (error) {
                console.warn('[bootstrap-cache] falha ao gravar chave', key, error?.message || error);
            }
        }
    };

    const readShapefileAsArrayBuffer = async (url, context = 'online') => {
        if (isCapacitorNative()) {
            try {
                const { CapacitorHttp } = Capacitor.Plugins;
                if (CapacitorHttp?.request) {
                    logShpSource(`capacitor-http-${context}`, url);
                    const response = await CapacitorHttp.request({ url, method: 'GET', responseType: 'arraybuffer', headers: { 'Cache-Control': 'no-store' } });
                    if (!response || response.status < 200 || response.status >= 300) {
                        throw new Error(`HTTP ${response?.status || 'desconhecido'}`);
                    }
                    const normalized = await normalizeToArrayBuffer(response.data);
                    return normalized;
                }
            } catch (error) {
                console.warn('[SHP] CapacitorHttp indisponível, fallback para fetch.', error?.message || error);
            }
        }

        logShpSource(`fetch-${context}`, url);
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Não foi possível baixar o shapefile: ${response.status} ${response.statusText}`);
        return response.arrayBuffer();
    };

    // Módulo para gerenciar o banco de dados local (IndexedDB)
    const OfflineDB = {
        dbPromise: null,
        async init() {
            if (this.dbPromise) return;
            // Version 9 adiciona metadata persistente de contornos para o módulo aéreo
            this.dbPromise = openDB('agrovetor-offline-storage', OFFLINE_DB_VERSION, {
                upgrade(db, oldVersion) {
                    if (oldVersion < 1) {
                        db.createObjectStore('shapefile-cache');
                    }
                    if (oldVersion < 2) {
                        db.createObjectStore('offline-writes', { autoIncrement: true });
                    }
                    if (oldVersion < 3) {
                        db.createObjectStore('sync-history', { keyPath: 'timestamp' });
                    }
                    if (oldVersion < 4) {
                        db.createObjectStore('notifications', { autoIncrement: true });
                    }
                    if (oldVersion < 5) {
                        db.createObjectStore('gps-locations', { autoIncrement: true });
                    }
                    if (oldVersion < 6) {
                        db.createObjectStore('offline-credentials', { keyPath: 'email' });
                    }
                    if (oldVersion < 7) {
                        const kmStore = db.createObjectStore('km_records', { keyPath: 'id' });
                        kmStore.createIndex('companyId', 'companyId', { unique: false });
                        kmStore.createIndex('syncStatus', 'syncStatus', { unique: false });
                        kmStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                        kmStore.createIndex('companyId_status_dataSaida', ['companyId', 'status', 'dataSaida'], { unique: false });
                        kmStore.createIndex('companyId_status_dataChegada', ['companyId', 'status', 'dataChegada'], { unique: false });
                    }
                    if (oldVersion < 8) {
                        const qualidadeStore = db.createObjectStore('qualidade_plantio', { keyPath: 'id' });
                        qualidadeStore.createIndex('companyId', 'companyId', { unique: false });
                        qualidadeStore.createIndex('fazendaId', 'fazendaId', { unique: false });
                        qualidadeStore.createIndex('talhaoId', 'talhaoId', { unique: false });
                        qualidadeStore.createIndex('data', 'data', { unique: false });
                        qualidadeStore.createIndex('indicadorCodigo', 'indicadorCodigo', { unique: false });
                        qualidadeStore.createIndex('tipoPlantio', 'tipoPlantio', { unique: false });
                    }
                    if (oldVersion < 9) {
                        const contoursIndex = db.createObjectStore('contours_index', { keyPath: 'key' });
                        contoursIndex.createIndex('updatedAt', 'updatedAt', { unique: false });
                        db.createObjectStore('contours_geojson');
                    }
                    if (oldVersion < 10) {
                        const masterStore = db.createObjectStore('master_data', { keyPath: 'key' });
                        masterStore.createIndex('collection_company', ['collection', 'companyId'], { unique: true });
                        masterStore.createIndex('collection', 'collection', { unique: false });
                        masterStore.createIndex('companyId', 'companyId', { unique: false });
                        masterStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                    }
                    if (oldVersion < 11) {
                        db.createObjectStore('data_cache', { keyPath: 'id' });
                    }
                },
            });
        },
        async get(storeName, key) {
            try {
                return (await this.dbPromise).get(storeName, key);
            } catch (error) {
                logBootError('INDEXEDDB:error', error, { operation: 'get', storeName, key });
                throw error;
            }
        },
        async getAll(storeName) {
            try {
                return (await this.dbPromise).getAll(storeName);
            } catch (error) {
                logBootError('INDEXEDDB:error', error, { operation: 'getAll', storeName });
                throw error;
            }
        },
        async set(storeName, value, key) {
            try {
                return (await this.dbPromise).put(storeName, value, key);
            } catch (error) {
                logBootError('INDEXEDDB:error', error, { operation: 'put', storeName, key });
                throw error;
            }
        },
        async add(storeName, val) {
            try {
                return (await this.dbPromise).add(storeName, val);
            } catch (error) {
                const isQuota = error?.name === 'QuotaExceededError';
                logBootError(isQuota ? 'INDEXEDDB:quota' : 'INDEXEDDB:error', error, { operation: 'add', storeName });
                throw error;
            }
        },
        async delete(storeName, key) {
            try {
                return (await this.dbPromise).delete(storeName, key);
            } catch (error) {
                logBootError('INDEXEDDB:error', error, { operation: 'delete', storeName, key });
                throw error;
            }
        },
        async upsertMasterData(collection, companyId, items) {
            try {
                const db = await this.dbPromise;
                const tx = db.transaction('master_data', 'readwrite');
                const store = tx.objectStore('master_data');
                const timestamp = new Date().toISOString();
                await store.put({
                    key: `${collection}:${companyId || 'global'}`,
                    collection,
                    companyId: companyId || null,
                    items: Array.isArray(items) ? items : [],
                    count: Array.isArray(items) ? items.length : 0,
                    updatedAt: timestamp,
                });
                await tx.done;
                console.info('[MasterDataSync]', { source: 'remote', collection, companyId: companyId || null, count: Array.isArray(items) ? items.length : 0, updatedAt: timestamp });
                return timestamp;
            } catch (error) {
                console.error('[MasterDataSync] Falha ao salvar cache local', { collection, companyId: companyId || null, error: error?.message || error });
                throw error;
            }
        },
        async getMasterData(collection, companyId) {
            try {
                const db = await this.dbPromise;
                const key = `${collection}:${companyId || 'global'}`;
                const cached = await db.get('master_data', key);
                if (cached) {
                    console.info('[OfflineCadastros]', { source: 'local', collection, companyId: companyId || null, count: cached?.items?.length || 0, updatedAt: cached.updatedAt || null });
                }
                return cached || null;
            } catch (error) {
                console.error('[OfflineCadastros] Falha ao ler cache local', { collection, companyId: companyId || null, error: error?.message || error });
                return null;
            }
        },
    };


    const App = {
        offlineDB: OfflineDB,
        services: {
            CalculationService,
        },
        config: {
            appName: "Inspeção e Planejamento de Cana com IA",
            themeKey: 'canaAppTheme',
            inactivityTimeout: 15 * 60 * 1000,
            inactivityWarningTime: 1 * 60 * 1000,
            backendUrl: 'https://agrovetor-backend.onrender.com', // URL do seu backend
            menuConfig: [
                { label: 'Estimativa Safra', icon: 'fas fa-seedling', target: 'estimativaSafra', permission: 'estimativaSafra' },
                {
                    label: 'Administrativo', icon: 'fas fa-cogs',
                    submenu: [
                        { label: 'Configurações da Empresa', icon: 'fas fa-building', target: 'configuracoesEmpresa', permission: 'configuracoes' }
                    ]
                },
                {
                    label: 'Super Admin', icon: 'fas fa-user-shield',
                    submenu: [
                        { label: 'Gerir Empresas', icon: 'fas fa-building', target: 'gerenciarEmpresas', permission: 'superAdmin' },
                        { label: 'Gerenciar Atualizações', icon: 'fas fa-bullhorn', target: 'gerenciarAtualizacoes', permission: 'superAdmin' }
                    ]
                }
            ],
            roles: {
                admin: { estimativaSafra: true, configuracoes: true, superAdmin: true },
                supervisor: { estimativaSafra: true },
                tecnico: { estimativaSafra: true },
                colaborador: { estimativaSafra: true },
                user: { estimativaSafra: true },
                'super-admin': { estimativaSafra: true, configuracoes: true, superAdmin: true }
            }
        },

        state: {
            isImpersonating: false,
            originalUser: null,
            isAuthenticated: false,
            authMode: null, // 'online' | 'offline'
            isOnline: navigator.onLine,
            syncStatus: 'idle', // 'idle' | 'syncing' | 'error' | 'done'
            bootStage: 'BOOT: start',
            menuRenderedAt: null,
            bootWatchdogTimer: null,
            loginUiRenderedAt: null,
            loginWatchdogTimer: null,
            requiresReauthForSync: false,
            reauthDeferred: false,
            isCheckingConnection: false,
            connectionCheckInterval: null,
            currentUser: null,
            users: [],
            companies: [],
            cachedSubscribedModules: [],
            masterDataSyncStatus: {},
            globalConfigs: {}, // NOVO: Para armazenar configurações globais como feature flags
            companyConfig: {},
            registros: [],
            perdas: [],
            cigarrinha: [],
            planos: [],
            fazendas: [],
            personnel: [],
            frentesDePlantio: [],
            apontamentosPlantio: [],
            qualidadePlantio: [],
            companyLogo: null,
            activeSubmenu: null,
            charts: {},
            harvestPlans: [],
            activeHarvestPlan: null,
            tipos_servico: [],
            operacoes: [],
            produtos: [],
            operacao_produtos: [],
            ordens_servico: [],
            inactivityTimer: null,
            inactivityWarningTimer: null,
            unsubscribeListeners: [],
            deferredInstallPrompt: null,
            adminAction: null, // Stores a function to be executed after admin password confirmation
            expandedChart: null,
            mapboxMap: null,
            aerialMapProvider: null,
            useNativeAerialMap: false,
            mapboxMapInitPromise: null,
            mapboxMapInitializing: false,
            mapboxMapIsLoaded: false,
            mapboxUserMarker: null,
            mapboxTrapMarkers: {},
            armadilhas: [],
            estimativasSafra: [],
            geoJsonData: null,
            estimativaSafraMap: null,
            estimativaSafraMapLoaded: false,
            contourStorageAdapter: null,
            activeContourCacheKey: null,
            selectedMapFeature: null, // NOVO: Armazena a feature do talhão selecionado no mapa
            selectedTalhaoId: null,
            mapInteractionHandlers: null,
            mapLastTalhaoClickAt: 0,
            trapNotifications: [],
            unreadNotificationCount: 0,
            notifiedTrapIds: new Set(JSON.parse(sessionStorage.getItem('notifiedTrapIds')) || []),
            invalidTrapDateLogKeys: new Set(),
            trapPlacementMode: null,
            trapPlacementData: null,
            locationWatchId: null,
            locationUpdateIntervalId: null,
            lastKnownPosition: null,
            riskViewActive: false,
            isTracking: false,
            plantio: [], // Placeholder for Plantio data
            cigarrinha: [], // Placeholder for Cigarrinha data
            clima: [],
            apontamentoPlantioFormIsDirty: false,
            syncInterval: null,
            announcements: [],
            osMap: null,
            osSelectedPlots: new Set(),
            regAppMap: null,
            regAppSelectedPlots: new Map(), // Map<talhaoId, {area: number, direction: string, isPartial: boolean}>
            regAppDirectionTarget: null, // Stores talhaoId when selecting direction on map
            regAppStartPoint: null, // Temporary store for start point during direction selection
            frota: [],
            controleFrota: [], // Mantido para compatibilidade se necessário, mas preferir activeTrips/historyTrips
            activeTrips: [],
            historyTrips: [],
            abastecimentos: [],
            plantioTotalArea: 0,
            plantioVariedadeWarningShown: false,
            plantioLegacyMudaArea: null,
            qualidadePlantioContext: null,
            qualidadePlantioDraft: null,
            osPlanningMap: null,
            osPlanningMapOriginalParent: null,
            osPlanningMapOriginalNextSibling: null,
            osPlanningSelectedPlots: new Set(),
            osPlanningCurrentItems: [],
            osPlanningOperations: [],
            osPlanningEditingOperationId: null,
            osPlanningOperationDraftProducts: [],
            osPlanningLoadedPlans: [],
            osPlanningImportedHistoryCache: {},
            osPlanningActiveTab: 'novo',
        },
        
        fleet: FleetModule,

        elements: {
            regApp: {
                farmSelect: document.getElementById('regAppFarmSelect'),
                date: document.getElementById('regAppDate'),
                shiftRadios: document.querySelectorAll('input[name="regAppShift"]'),
                product: document.getElementById('regAppProduct'),
                dosage: document.getElementById('regAppDosage'),
                operator: document.getElementById('regAppOperator'),
                plotsList: document.getElementById('regAppPlotsList'),
                btnSave: document.getElementById('btnSaveRegApp'),
                mapContainer: document.getElementById('regAppMap'),
                btnCenterMap: document.getElementById('btnCenterRegAppMap'),
            },
            osManual: {
                farmSelect: document.getElementById('osFarmSelect'),
                serviceType: document.getElementById('osServiceType'),
                btnOpenOperationModal: document.getElementById('btnOpenOperationModal'),
                osOperationModal: document.getElementById('osOperationModal'),
                modalGroupSelect: document.getElementById('modalGroupSelect'),
                modalOperationSearch: document.getElementById('modalOperationSearch'),
                modalOperationList: document.getElementById('modalOperationList'),
                btnCloseOperationModal: document.getElementById('osCloseOperationModal'),
                selectedOperationsList: document.getElementById('osSelectedOperationsList'),
                productModal: document.getElementById('osProductModal'),
                productModalTitle: document.getElementById('osProductModalTitle'),
                closeProductModalBtn: document.getElementById('osCloseProductModal'),
                productsListModal: document.getElementById('osProductsList'),
                saveProductsModalBtn: document.getElementById('osSaveProductsModalBtn'),
                responsibleMatricula: document.getElementById('osResponsibleMatricula'),
                responsibleName: document.getElementById('osResponsibleName'),
                observations: document.getElementById('osObservations'),
                totalArea: document.getElementById('osTotalArea'),
                plotsList: document.getElementById('osPlotsList'),
                btnGenerate: document.getElementById('btnGenerateOS'),
                mapContainer: document.getElementById('os-map'),
                btnCenterMap: document.getElementById('btnCenterOSMap'),
            },
            osPlanning: {
                companyName: document.getElementById('osPlanningCompanyName'),
                farmSelect: document.getElementById('osPlanningFarmSelect'),
                subgroupSelect: document.getElementById('osPlanningSubgroupSelect'),
                operationSelect: document.getElementById('osPlanningOperationSelect'),
                serviceTypeSelect: document.getElementById('osPlanningServiceTypeSelect'),
                programInput: document.getElementById('osPlanningProgramInput'),
                dateInput: document.getElementById('osPlanningDateInput'),
                responsibleMatricula: document.getElementById('osPlanningResponsibleMatricula'),
                responsibleName: document.getElementById('osPlanningResponsibleName'),
                modeSelect: document.getElementById('osPlanningModeSelect'),
                notes: document.getElementById('osPlanningNotes'),
                talhaoSearch: document.getElementById('osPlanningTalhaoSearch'),
                plotsList: document.getElementById('osPlanningTalhaoList'),
                selectedCount: document.getElementById('osPlanningSelectedCount'),
                selectedArea: document.getElementById('osPlanningSelectedArea'),
                historyStatus: document.getElementById('osPlanningHistoryStatus'),
                gridBody: document.getElementById('osPlanningGridBody'),
                operationsBody: document.getElementById('osPlanningOperationsBody'),
                addOperationBtn: document.getElementById('osPlanningAddOperationBtn'),
                operationModal: document.getElementById('osPlanningOperationModal'),
                operationModalTitle: document.getElementById('osPlanningOperationModalTitle'),
                operationModalCloseBtn: document.getElementById('osPlanningOperationModalCloseBtn'),
                operationModalCancelBtn: document.getElementById('osPlanningOperationModalCancelBtn'),
                operationModalSaveBtn: document.getElementById('osPlanningOperationModalSaveBtn'),
                operationModalSubgroup: document.getElementById('osPlanningOperationModalSubgroup'),
                operationModalOperation: document.getElementById('osPlanningOperationModalOperation'),
                operationModalServiceType: document.getElementById('osPlanningOperationModalServiceType'),
                operationModalResponsibleMatricula: document.getElementById('osPlanningOperationModalResponsibleMatricula'),
                operationModalResponsibleName: document.getElementById('osPlanningOperationModalResponsibleName'),
                operationModalObservation: document.getElementById('osPlanningOperationModalObservation'),
                operationAddProductBtn: document.getElementById('osPlanningOperationAddProductBtn'),
                operationProductsBody: document.getElementById('osPlanningOperationProductsBody'),
                summarySelected: document.getElementById('osPlanningSummarySelected'),
                summaryArea: document.getElementById('osPlanningSummaryArea'),
                summaryReady: document.getElementById('osPlanningSummaryReady'),
                summaryTrusted: document.getElementById('osPlanningSummaryTrusted'),
                mapContainer: document.getElementById('planejamentoOSMap'),
                btnCenterMap: document.getElementById('osPlanningCenterMapBtn'),
                btnSyncMap: document.getElementById('osPlanningSyncMapBtn'),
                btnExpandMap: document.getElementById('osPlanningExpandMapBtn'),
                btnSelectAll: document.getElementById('osPlanningSelectAllBtn'),
                btnRefresh: document.getElementById('osPlanningRefreshBtn'),
                btnLoadSaved: document.getElementById('osPlanningLoadSavedBtn'),
                btnSaveDraft: document.getElementById('osPlanningSaveDraftBtn'),
                btnSave: document.getElementById('osPlanningSaveBtn'),
                btnSaveReady: document.getElementById('osPlanningSaveReadyBtn'),
                btnGenerateOS: document.getElementById('osPlanningGenerateOSBtn'),
                savedModal: document.getElementById('osPlanningSavedModal'),
                savedModalCloseBtn: document.getElementById('osPlanningSavedModalCloseBtn'),
                savedModalBody: document.getElementById('osPlanningSavedModalBody'),
                savedSearch: document.getElementById('osPlanningSavedSearch'),
                savedFarmFilter: document.getElementById('osPlanningSavedFarmFilter'),
                savedStatusFilter: document.getElementById('osPlanningSavedStatusFilter'),
                savedDateFilter: document.getElementById('osPlanningSavedDateFilter'),
                savedRefreshBtn: document.getElementById('osPlanningSavedRefreshBtn'),
                historyModal: document.getElementById('osPlanningHistoryModal'),
                historyModalCloseBtn: document.getElementById('osPlanningHistoryModalCloseBtn'),
                historyCancelBtn: document.getElementById('osPlanningHistoryCancelBtn'),
                historyConfirmBtn: document.getElementById('osPlanningHistoryConfirmBtn'),
                historyFarmText: document.getElementById('osPlanningHistoryFarmText'),
                historySelectedText: document.getElementById('osPlanningHistorySelectedText'),
                historyReviewText: document.getElementById('osPlanningHistoryReviewText'),
                readyModal: document.getElementById('osPlanningReadyModal'),
                readyModalCloseBtn: document.getElementById('osPlanningReadyModalCloseBtn'),
                readyBackBtn: document.getElementById('osPlanningReadyBackBtn'),
                readyConfirmBtn: document.getElementById('osPlanningReadyConfirmBtn'),
                generateModal: document.getElementById('osPlanningGenerateModal'),
                generateModalCloseBtn: document.getElementById('osPlanningGenerateModalCloseBtn'),
                generateBackBtn: document.getElementById('osPlanningGenerateBackBtn'),
                generateConfirmBtn: document.getElementById('osPlanningGenerateConfirmBtn'),
                actionToast: document.getElementById('osPlanningActionToast'),
                secondaryTabs: document.querySelectorAll('#planejamentoOS [data-os-planning-tab]'),
                panelSalvos: document.getElementById('osPlanningPanelSalvos'),
                panelAlertas: document.getElementById('osPlanningPanelAlertas'),
                panelPendencias: document.getElementById('osPlanningPanelPendencias'),
                panelHistorico: document.getElementById('osPlanningPanelHistorico'),
                savedPanelBody: document.getElementById('osPlanningSavedPanelBody'),
                savedPanelSearch: document.getElementById('osPlanningSavedPanelSearch'),
                savedPanelFarmFilter: document.getElementById('osPlanningSavedPanelFarmFilter'),
                savedPanelStatusFilter: document.getElementById('osPlanningSavedPanelStatusFilter'),
                savedPanelDateFilter: document.getElementById('osPlanningSavedPanelDateFilter'),
                savedPanelFilterBtn: document.getElementById('osPlanningSavedPanelFilterBtn'),
                savedCountTotal: document.getElementById('osPlanningSavedCountTotal'),
                savedCountDraft: document.getElementById('osPlanningSavedCountDraft'),
                savedCountPlanned: document.getElementById('osPlanningSavedCountPlanned'),
                savedCountReady: document.getElementById('osPlanningSavedCountReady'),
                alertToday: document.getElementById('osPlanningAlertToday'),
                alertSoon: document.getElementById('osPlanningAlertSoon'),
                alertLate: document.getElementById('osPlanningAlertLate'),
                alertReady: document.getElementById('osPlanningAlertReady'),
                alertsList: document.getElementById('osPlanningAlertsList'),
                pendenciasList: document.getElementById('osPlanningPendenciasList'),
                pendingNoHistory: document.getElementById('osPlanningPendingNoHistory'),
                pendingAmbiguous: document.getElementById('osPlanningPendingAmbiguous'),
                pendingDivergent: document.getElementById('osPlanningPendingDivergent'),
                pendingBlocked: document.getElementById('osPlanningPendingBlocked'),
                historyFarmFilter: document.getElementById('osPlanningHistoryFarmFilter'),
                historyTalhaoFilter: document.getElementById('osPlanningHistoryTalhaoFilter'),
                historyProgramFilter: document.getElementById('osPlanningHistoryProgramFilter'),
                historyRangeFilter: document.getElementById('osPlanningHistoryRangeFilter'),
                historyQueryBtn: document.getElementById('osPlanningHistoryQueryBtn'),
                historyTimeline: document.getElementById('osPlanningHistoryTimeline'),
                fullscreenMapModal: document.getElementById('osPlanningMapFullscreenModal'),
                fullscreenMapContainer: document.getElementById('planejamentoOSMapFullscreen'),
                fullscreenMapCloseBtn: document.getElementById('osPlanningMapFullscreenCloseBtn'),
                fullscreenMapCancelBtn: document.getElementById('osPlanningMapFullscreenCancelBtn'),
                fullscreenMapConfirmBtn: document.getElementById('osPlanningMapFullscreenConfirmBtn'),
                fullscreenMapCenterBtn: document.getElementById('osPlanningMapFullscreenCenterBtn'),
                fullscreenMapSelectAllBtn: document.getElementById('osPlanningMapFullscreenSelectAllBtn'),
                fullscreenMapSyncBtn: document.getElementById('osPlanningMapFullscreenSyncBtn'),
            },
            welcomeModal: {
                overlay: document.getElementById('welcomeModal'),
                content: document.getElementById('welcomeModalContent'),
                closeBtn: document.getElementById('btnCloseWelcome'),
            },
            updateModal: {
                overlay: document.getElementById('updateModal'),
                title: document.getElementById('updateModalTitle'),
                body: document.getElementById('updateModalBody'),
                versionBadge: document.getElementById('updateVersionBadge'),
                closeBtn: document.getElementById('updateModalCloseBtn'),
                ackBtn: document.getElementById('btnAckUpdate'),
            },
            announcements: {
                version: document.getElementById('announcementVersion'),
                title: document.getElementById('announcementTitle'),
                desc: document.getElementById('announcementDesc'),
                btnPublish: document.getElementById('btnPublishAnnouncement'),
                list: document.getElementById('announcementsList'),
            },
            loadingOverlay: document.getElementById('loading-overlay'),
            loadingProgressText: document.getElementById('loading-progress-text'),
            loginScreen: document.getElementById('loginScreen'),
            appScreen: document.getElementById('appScreen'),
            loginUser: document.getElementById('loginUser'),
            loginPass: document.getElementById('loginPass'),
            btnLogin: document.getElementById('btnLogin'),
            loginMessage: document.getElementById('loginMessage'),
            loginForm: document.getElementById('loginForm'),
            offlineUserList: document.getElementById('offlineUserList'),
            headerTitle: document.querySelector('header h1'),
            headerLogo: document.getElementById('headerLogo'),
            connectionStatusBadge: document.getElementById('connectionStatusBadge'),
            connectionStatusText: document.getElementById('connectionStatusText'),
            reauthBanner: document.getElementById('reauthBanner'),
            reauthNowBtn: document.getElementById('reauthNowBtn'),
            reauthLaterBtn: document.getElementById('reauthLaterBtn'),
            currentDateTime: document.getElementById('currentDateTime'),
            logoutBtn: document.getElementById('logoutBtn'),
            btnToggleMenu: document.getElementById('btnToggleMenu'),
            menu: document.getElementById('menu'),
            content: document.getElementById('content'),
            alertContainer: document.getElementById('alertContainer'),
            notificationContainer: document.getElementById('notification-container'),
            notificationBell: {
                container: document.getElementById('notification-bell-container'),
                toggle: document.getElementById('notification-bell-toggle'),
                count: document.getElementById('notification-count'),
                dropdown: document.getElementById('notification-dropdown'),
                list: document.getElementById('notification-list'), // NOVO
                clearBtn: document.getElementById('clear-notifications-btn'), // NOVO
                noNotifications: document.getElementById('no-notifications'), // NOVO
            },
            userMenu: {
                container: document.getElementById('user-menu-container'),
                toggle: document.getElementById('user-menu-toggle'),
                dropdown: document.getElementById('user-menu-dropdown'),
                username: document.getElementById('userMenuUsername'),
                changePasswordBtn: document.getElementById('changePasswordBtn'),
                manualSyncBtn: document.getElementById('manualSyncBtn'),
                downloadAllAerialTilesBtn: document.getElementById('btnDownloadAllAerialTiles'),
                updateAllAerialTilesBtn: document.getElementById('btnUpdateAllAerialTiles'),
                removeAllAerialTilesBtn: document.getElementById('btnRemoveAllAerialTiles'),
                themeButtons: document.querySelectorAll('.theme-button')
            },
            confirmationModal: {
                overlay: document.getElementById('confirmationModal'),
                title: document.getElementById('confirmationModalTitle'),
                message: document.getElementById('confirmationModalMessage'),
                confirmBtn: document.getElementById('confirmationModalConfirmBtn'),
                cancelBtn: document.getElementById('confirmationModalCancelBtn'),
                closeBtn: document.getElementById('confirmationModalCloseBtn'),
                inputContainer: document.getElementById('confirmationModalInputContainer'),
                input: document.getElementById('confirmationModalInput'),
            },
            changePasswordModal: {
                overlay: document.getElementById('changePasswordModal'),
                closeBtn: document.getElementById('changePasswordModalCloseBtn'),
                cancelBtn: document.getElementById('changePasswordModalCancelBtn'),
                saveBtn: document.getElementById('changePasswordModalSaveBtn'),
                currentPassword: document.getElementById('currentPassword'),
                newPassword: document.getElementById('newPassword'),
                confirmNewPassword: document.getElementById('confirmNewPassword'),
            },
            reauthModal: {
                overlay: document.getElementById('reauthModal'),
                closeBtn: document.getElementById('reauthModalCloseBtn'),
                cancelBtn: document.getElementById('reauthModalCancelBtn'),
                confirmBtn: document.getElementById('reauthModalConfirmBtn'),
                passwordInput: document.getElementById('reauthPasswordInput'),
            },
            adminPasswordConfirmModal: {
                overlay: document.getElementById('adminPasswordConfirmModal'),
                closeBtn: document.getElementById('adminPasswordConfirmModalCloseBtn'),
                cancelBtn: document.getElementById('adminPasswordConfirmModalCancelBtn'),
                confirmBtn: document.getElementById('adminPasswordConfirmModalConfirmBtn'),
                passwordInput: document.getElementById('adminConfirmPassword')
            },
            chartModal: {
                overlay: document.getElementById('chartModal'),
                title: document.getElementById('chartModalTitle'),
                closeBtn: document.getElementById('chartModalCloseBtn'),
                canvas: document.getElementById('expandedChartCanvas'),
            },
            editFarmModal: {
                overlay: document.getElementById('editFarmModal'),
                closeBtn: document.getElementById('editFarmModalCloseBtn'),
                cancelBtn: document.getElementById('editFarmModalCancelBtn'),
                saveBtn: document.getElementById('editFarmModalSaveBtn'),
                nameInput: document.getElementById('editFarmNameInput'),
                editingFarmId: document.getElementById('editingFarmId'),
                typeCheckboxes: document.querySelectorAll('#editFarmTypeCheckboxes input[type="checkbox"]'),
            },
             historyFilterModal: {
                overlay: document.getElementById('historyFilterModal'),
                closeBtn: document.getElementById('historyFilterModalCloseBtn'),
                cancelBtn: document.getElementById('historyFilterModalCancelBtn'),
                viewBtn: document.getElementById('btnViewHistoryModal'),
                clearBtn: document.getElementById('btnClearHistoryModal'),
                userSelect: document.getElementById('historyUserSelectModal'),
                startDate: document.getElementById('historyStartDateModal'),
                endDate: document.getElementById('historyEndDateModal'),
            },
            syncHistoryDetailModal: {
                overlay: document.getElementById('syncHistoryDetailModal'),
                title: document.getElementById('syncHistoryDetailModalTitle'),
                body: document.getElementById('syncHistoryDetailModalBody'),
                closeBtn: document.getElementById('syncHistoryDetailModalCloseBtn'),
                cancelBtn: document.getElementById('syncHistoryDetailModalCancelBtn'),
            },
            configHistoryModal: {
                overlay: document.getElementById('configHistoryModal'),
                title: document.getElementById('configHistoryModalTitle'),
                body: document.getElementById('configHistoryModalBody'),
                closeBtn: document.getElementById('configHistoryModalCloseBtn'),
                cancelBtn: document.getElementById('configHistoryModalCancelBtn'),
            },
            companyConfig: {
                logoUploadArea: document.getElementById('logoUploadArea'),
                logoInput: document.getElementById('logoInput'),
                logoPreview: document.getElementById('logoPreview'),
                removeLogoBtn: document.getElementById('removeLogoBtn'),
                shapefileUploadArea: document.getElementById('shapefileUploadArea'),
                shapefileInput: document.getElementById('shapefileInput'),
                btnTestShapefileDebug: document.getElementById('btnTestShapefileDebug'),
            },
            dashboard: {
                selector: document.getElementById('dashboard-selector'),
                brocaView: document.getElementById('dashboard-broca'),
                perdaView: document.getElementById('dashboard-perda'),
                aereaView: document.getElementById('dashboard-aerea'),
                plantioView: document.getElementById('dashboard-plantio'),
                cigarrinhaView: document.getElementById('dashboard-cigarrinha'),
                climaView: document.getElementById('dashboard-clima'),
                cardBroca: document.getElementById('card-broca'),
                cardPerda: document.getElementById('card-perda'),
                cardAerea: document.getElementById('card-aerea'),
                cardPlantio: document.getElementById('card-plantio'),
                cardCigarrinha: document.getElementById('card-cigarrinha'),
                cardClima: document.getElementById('card-clima'),
                btnBackToSelectorBroca: document.getElementById('btn-back-to-selector-broca'),
                btnBackToSelectorPerda: document.getElementById('btn-back-to-selector-perda'),
                btnBackToSelectorAerea: document.getElementById('btn-back-to-selector-aerea'),
                btnBackToSelectorPlantio: document.getElementById('btn-back-to-selector-plantio'),
                btnBackToSelectorCigarrinha: document.getElementById('btn-back-to-selector-cigarrinha'),
                btnBackToSelectorClima: document.getElementById('btn-back-to-selector-clima'),
                brocaDashboardInicio: document.getElementById('brocaDashboardInicio'),
                brocaDashboardFim: document.getElementById('brocaDashboardFim'),
                btnFiltrarBrocaDashboard: document.getElementById('btnFiltrarBrocaDashboard'),
                perdaDashboardInicio: document.getElementById('perdaDashboardInicio'),
                perdaDashboardFim: document.getElementById('perdaDashboardFim'),
                btnFiltrarPerdaDashboard: document.getElementById('btnFiltrarPerdaDashboard'),
            },
            users: {
                username: document.getElementById('newUserUsername'),
                password: document.getElementById('newUserPassword'),
                role: document.getElementById('newUserRole'),
                permissionsContainer: document.querySelector('#gerenciarUsuarios .permission-grid'),
                permissionCheckboxes: document.querySelectorAll('#gerenciarUsuarios .permission-grid input[type="checkbox"]'),
                btnCreate: document.getElementById('btnCreateUser'),
                list: document.getElementById('usersList'),
                superAdminUserCreation: document.getElementById('superAdminUserCreation'),
                adminTargetCompanyUsers: document.getElementById('adminTargetCompanyUsers'),
            },
            userEditModal: {
                overlay: document.getElementById('userEditModal'),
                title: document.getElementById('userEditModalTitle'),
                closeBtn: document.getElementById('userEditModalCloseBtn'),
                editingUserId: document.getElementById('editingUserId'),
                username: document.getElementById('editUserUsername'),
                role: document.getElementById('editUserRole'),
                permissionGrid: document.getElementById('editUserPermissionGrid'),
                btnSaveChanges: document.getElementById('btnSaveUserChanges'),
                btnResetPassword: document.getElementById('btnResetPassword'),
                btnDeleteUser: document.getElementById('btnDeleteUser'),
            },
            companyManagement: {
                companyName: document.getElementById('newCompanyName'),
                adminEmail: document.getElementById('newCompanyAdminEmail'),
                adminPassword: document.getElementById('newCompanyAdminPassword'),
                btnCreate: document.getElementById('btnCreateCompany'),
                list: document.getElementById('companiesList'),
            },
            editCompanyModal: {
                overlay: document.getElementById('editCompanyModal'),
                title: document.getElementById('editCompanyModalTitle'),
                closeBtn: document.getElementById('editCompanyModalCloseBtn'),
                cancelBtn: document.getElementById('editCompanyModalCancelBtn'),
                saveBtn: document.getElementById('editCompanyModalSaveBtn'),
                editingCompanyId: document.getElementById('editingCompanyId'),
                companyNameDisplay: document.getElementById('editCompanyNameDisplay'),
                modulesGrid: document.getElementById('editCompanyModulesGrid'),
            },
            personnel: {
                id: document.getElementById('personnelId'),
                matricula: document.getElementById('personnelMatricula'),
                name: document.getElementById('personnelName'),
                btnSave: document.getElementById('btnSavePersonnel'),
                list: document.getElementById('personnelList'),
                csvUploadArea: document.getElementById('personnelCsvUploadArea'),
                csvFileInput: document.getElementById('personnelCsvInput'),
                btnDownloadCsvTemplate: document.getElementById('btnDownloadPersonnelCsvTemplate'),
            },
            frenteDePlantio: {
                id: document.getElementById('frenteDePlantioId'),
                name: document.getElementById('frenteDePlantioName'),
                provider: document.getElementById('frenteDePlantioProvider'),
                providerType: document.getElementById('frenteDePlantioProviderType'),
                obs: document.getElementById('frenteDePlantioObs'),
                btnSave: document.getElementById('btnSaveFrenteDePlantio'),
                list: document.getElementById('frenteDePlantioList'),
            },
            apontamentoPlantio: {
                form: document.getElementById('formApontamentoPlantio'),
                entryId: document.getElementById('plantioEntryId'),
                frente: document.getElementById('plantioFrente'),
                provider: document.getElementById('plantioProvider'),
                culture: document.getElementById('plantioCulture'),

                // Novos campos Cana
                canaFields: document.getElementById('plantioCanaFields'),
                tipoPlantio: document.getElementById('plantioTipo'),
                os: document.getElementById('plantioOS'),
                mecanizadoFields: document.getElementById('plantioMecanizadoFields'),
                manualFields: document.getElementById('plantioManualFields'),
                frota: document.getElementById('plantioFrota'),
                pessoas: document.getElementById('plantioPessoas'),
                origemMuda: document.getElementById('plantioOrigemMuda'),
                mudaFazenda: document.getElementById('plantioMudaFazenda'),
                mudaTalhao: document.getElementById('plantioMudaTalhao'),
                mudaTalhaoVariedade: document.getElementById('plantioMudaTalhaoVariedade'),
                mudaTalhaoArea: document.getElementById('plantioMudaTalhaoArea'),

                leaderId: document.getElementById('plantioLeaderId'),
                leaderName: document.getElementById('plantioLeaderName'),
                farmName: document.getElementById('plantioFarmName'),
                date: document.getElementById('plantioDate'),
                addRecordBtn: document.getElementById('addPlantioRecord'),
                recordsContainer: document.getElementById('plantioRecordsContainer'),
                totalArea: document.getElementById('totalPlantedArea'),
                btnSave: document.getElementById('btnSaveApontamentoPlantio'),
                chuva: document.getElementById('plantioChuva'),
                obs: document.getElementById('plantioObs'),
                info: document.getElementById('plantioInfo'),
                insumosSection: document.getElementById('plantioInsumosSection'),
                insumosContainer: document.getElementById('plantioInsumosContainer'),
                addInsumoBtn: document.getElementById('btnAddPlantioInsumo'),
            },
            qualidadePlantio: {
                form: document.getElementById('formQualidadePlantio'),
                tipoPlantio: document.getElementById('qualidadeTipoPlantio'),
                fazenda: document.getElementById('qualidadeFazenda'),
                talhao: document.getElementById('qualidadeTalhao'),
                variedade: document.getElementById('qualidadeVariedade'),
                variedadeHint: document.getElementById('qualidadeVariedadeHint'),
                data: document.getElementById('qualidadeData'),
                tipoInspecao: document.getElementById('qualidadeTipoInspecao'),
                tipoPrestador: document.getElementById('qualidadeTipoPrestador'),
                frentePlantio: document.getElementById('qualidadeFrentePlantio'),
                btnSalvar: document.getElementById('btnSalvarQualidadePlantio'),
                tabs: document.querySelectorAll('.qualidade-tab'),
                tabPanels: document.querySelectorAll('.qualidade-tab-panel'),
                subamostrasList: document.getElementById('qualidadeSubamostrasList'),
                btnAddSubamostra: document.getElementById('btnAdicionarSubamostra'),
                emptySubamostras: document.getElementById('qualidadeSubamostrasEmpty'),
            },
            qualidadeConsumo: {
                tipoPlantio: document.getElementById('qualidadeConsumoTipoPlantio'),
                fazenda: document.getElementById('qualidadeConsumoFazenda'),
                talhao: document.getElementById('qualidadeConsumoTalhao'),
                variedade: document.getElementById('qualidadeConsumoVariedade'),
                data: document.getElementById('qualidadeConsumoData'),
                subamostra: document.getElementById('qualidadeConsumoSubamostra'),
                pesoTotal: document.getElementById('qualidadePesoTotal'),
                metrosLineares: document.getElementById('qualidadeMetrosLineares'),
                consumoMuda: document.getElementById('qualidadeConsumoMudaValor'),
                prestadorTirou: document.getElementById('qualidadePrestadorTirou'),
                fazendaOrigem: document.getElementById('qualidadeFazendaOrigem'),
                emptyState: document.getElementById('qualidadeConsumoEmpty'),
            },
            qualidadeBroca: {
                tipoPlantio: document.getElementById('qualidadeBrocaTipoPlantio'),
                fazenda: document.getElementById('qualidadeBrocaFazenda'),
                talhao: document.getElementById('qualidadeBrocaTalhao'),
                variedade: document.getElementById('qualidadeBrocaVariedade'),
                data: document.getElementById('qualidadeBrocaData'),
                subamostra: document.getElementById('qualidadeBrocaSubamostra'),
                broca: document.getElementById('qualidadeBrocaValor'),
                qtdGemasTotal: document.getElementById('qualidadeBrocaQtdGemasTotal'),
                percentualBroca: document.getElementById('qualidadeBrocaPercentual'),
                emptyState: document.getElementById('qualidadeBrocaEmpty'),
            },
            relatorioQualidade: {
                inicio: document.getElementById('qualidadeReportInicio'),
                fim: document.getElementById('qualidadeReportFim'),
                fazenda: document.getElementById('qualidadeReportFazenda'),
                talhao: document.getElementById('qualidadeReportTalhao'),
                tipoPlantio: document.getElementById('qualidadeReportTipoPlantio'),
                indicador: document.getElementById('qualidadeReportIndicador'),
                tipoInspecao: document.getElementById('qualidadeReportTipoInspecao'),
                tipoPrestador: document.getElementById('qualidadeReportTipoPrestador'),
                prestadorTirou: document.getElementById('qualidadeReportPrestadorTirou'),
                fazendaOrigem: document.getElementById('qualidadeReportFazendaOrigem'),
                frentePlantio: document.getElementById('qualidadeReportFrentePlantio'),
                modelo: document.getElementById('qualidadeReportModelo'),
                btnPdf: document.getElementById('btnPdfRelatorioQualidade'),
                btnExcel: document.getElementById('btnExcelRelatorioQualidade'),
                resultado: document.getElementById('qualidadeReportResult'),
            },
            cadastros: {
                farmCode: document.getElementById('farmCode'),
                farmName: document.getElementById('farmName'),
                farmTypeCheckboxes: document.querySelectorAll('#farmTypeCheckboxes input[type="checkbox"]'),
                btnSaveFarm: document.getElementById('btnSaveFarm'),
                btnDeleteAllFarms: document.getElementById('btnDeleteAllFarms'),
                farmSelect: document.getElementById('farmSelect'),
                talhaoManagementContainer: document.getElementById('talhaoManagementContainer'),
                selectedFarmName: document.getElementById('selectedFarmName'),
                selectedFarmTypes: document.getElementById('selectedFarmTypes'),
                talhaoList: document.getElementById('talhaoList'),
                talhaoId: document.getElementById('talhaoId'),
                talhaoName: document.getElementById('talhaoName'),
                talhaoArea: document.getElementById('talhaoArea'),
                talhaoTCH: document.getElementById('talhaoTCH'),
                talhaoProducao: document.getElementById('talhaoProducao'),
                talhaoCorte: document.getElementById('talhaoCorte'),
                talhaoVariedade: document.getElementById('talhaoVariedade'),
                talhaoDistancia: document.getElementById('talhaoDistancia'),
                talhaoUltimaColheita: document.getElementById('talhaoUltimaColheita'),
                btnSaveTalhao: document.getElementById('btnSaveTalhao'),
                csvUploadArea: document.getElementById('csvUploadArea'),
                csvFileInput: document.getElementById('csvFileInput'),
                btnDownloadCsvTemplate: document.getElementById('btnDownloadCsvTemplate'),
                superAdminFarmCreation: document.getElementById('superAdminFarmCreation'),
                adminTargetCompanyFarms: document.getElementById('adminTargetCompanyFarms'),
                importProgress: {
                    container: document.getElementById('farm-import-progress'),
                    text: document.querySelector('#farm-import-progress .download-progress-text'),
                    bar: document.querySelector('#farm-import-progress .download-progress-bar'),
                }
            },
            planejamento: {
                tipo: document.getElementById('planoTipo'),
                fazenda: document.getElementById('planoFazenda'),
                talhao: document.getElementById('planoTalhao'),
                data: document.getElementById('planoData'),
                responsavel: document.getElementById('planoResponsavel'),
                meta: document.getElementById('planoMeta'),
                obs: document.getElementById('planoObs'),
                btnAgendar: document.getElementById('btnAgendarInspecao'),
                btnSugerir: document.getElementById('btnSugerirPlano'),
                lista: document.getElementById('listaPlanejamento')
            },
            harvest: {
                plansListContainer: document.getElementById('harvest-plans-list-container'),
                plansList: document.getElementById('harvest-plans-list'),
                planEditor: document.getElementById('harvest-plan-editor'),
                btnAddNew: document.getElementById('btnAddNewHarvestPlan'),
                maturador: document.getElementById('harvestMaturador'),
                maturadorDate: document.getElementById('harvestMaturadorDate'),
                btnSavePlan: document.getElementById('btnSaveHarvestPlan'),
                btnCancelPlan: document.getElementById('btnCancelHarvestPlan'),
                frontName: document.getElementById('harvestFrontName'),
                startDate: document.getElementById('harvestStartDate'),
                dailyRate: document.getElementById('harvestDailyRate'),
                fazenda: document.getElementById('harvestFazenda'),
                atr: document.getElementById('harvestAtr'),
                talhaoSelectionList: document.getElementById('harvestTalhaoSelectionList'),
                selectAllTalhoes: document.getElementById('selectAllTalhoes'),
                btnAddOrUpdate: document.getElementById('btnAddOrUpdateHarvestSequence'),
                btnCancelEdit: document.getElementById('btnCancelEditSequence'),
                addOrEditTitle: document.getElementById('addOrEditSequenceTitle'),
                editingGroupId: document.getElementById('editingGroupId'),
                btnOptimize: document.getElementById('btnOptimizeHarvest'),
                tableBody: document.querySelector('#harvestPlanTable tbody'),
                summary: document.getElementById('harvestSummary'),
                superAdminHarvestCreation: document.getElementById('superAdminHarvestCreation'),
                adminTargetCompanyHarvest: document.getElementById('adminTargetCompanyHarvest'),
            },
            broca: {
                form: document.getElementById('lancamentoBroca'),
                codigo: document.getElementById('codigo'),
                data: document.getElementById('data'),
                talhao: document.getElementById('talhao'),
                varietyDisplay: document.getElementById('varietyDisplay'),
                entrenos: document.getElementById('entrenos'),
                base: document.getElementById('brocaBase'),
                meio: document.getElementById('brocaMeio'),
                topo: document.getElementById('brocaTopo'),
                brocado: document.getElementById('brocado'),
                resultado: document.getElementById('resultado'),
                btnSalvar: document.getElementById('btnSalvarBrocamento'),
                filtroFazenda: document.getElementById('fazendaFiltroBrocamento'),
                tipoRelatorio: document.getElementById('tipoRelatorioBroca'),
                filtroInicio: document.getElementById('inicioBrocamento'),
                filtroFim: document.getElementById('fimBrocamento'),
                farmTypeFilter: document.querySelectorAll('#brocaReportFarmTypeFilter input[type="checkbox"]'),
                btnPDF: document.getElementById('btnPDFBrocamento'),
                btnExcel: document.getElementById('btnExcelBrocamento'),
            },
            perda: {
                form: document.getElementById('lancamentoPerda'),
                data: document.getElementById('dataPerda'),
                codigo: document.getElementById('codigoPerda'),
                talhao: document.getElementById('talhaoPerda'),
                varietyDisplay: document.getElementById('varietyDisplayPerda'),
                frente: document.getElementById('frenteServico'),
                turno: document.getElementById('turno'),
                frota: document.getElementById('frotaEquipamento'),
                matricula: document.getElementById('matriculaOperador'),
                operadorNome: document.getElementById('operadorNome'),
                canaInteira: document.getElementById('canaInteira'),
                tolete: document.getElementById('tolete'),
                toco: document.getElementById('toco'),
                ponta: document.getElementById('ponta'),
                estilhaco: document.getElementById('estilhaco'),
                pedaco: document.getElementById('pedaco'),
                resultado: document.getElementById('resultadoPerda'),
                btnSalvar: document.getElementById('btnSalvarPerda'),
                filtroFazenda: document.getElementById('fazendaFiltroPerda'),
                filtroTalhao: document.getElementById('talhaoFiltroPerda'),
                filtroOperador: document.getElementById('operadorFiltroPerda'),
                filtroFrente: document.getElementById('frenteFiltroPerda'),
                filtroInicio: document.getElementById('inicioPerda'),
                filtroFim: document.getElementById('fimPerda'),
                farmTypeFilter: document.querySelectorAll('#perdaReportFarmTypeFilter input[type="checkbox"]'),
                tipoRelatorio: document.getElementById('tipoRelatorioPerda'),
                btnPDF: document.getElementById('btnPDFPerda'),
                btnExcel: document.getElementById('btnExcelPerda'),
            },
            cigarrinha: {
                form: document.getElementById('lancamentoCigarrinha'),
                data: document.getElementById('dataCigarrinha'),
                codigo: document.getElementById('codigoCigarrinha'),
                talhao: document.getElementById('talhaoCigarrinha'),
                varietyDisplay: document.getElementById('varietyDisplayCigarrinha'),
                fase1: document.getElementById('fase1Cigarrinha'),
                fase2: document.getElementById('fase2Cigarrinha'),
                fase3: document.getElementById('fase3Cigarrinha'),
                fase4: document.getElementById('fase4Cigarrinha'),
                fase5: document.getElementById('fase5Cigarrinha'),
                adulto: document.getElementById('adultoPresenteCigarrinha'),
                resultado: document.getElementById('resultadoCigarrinha'),
                btnSalvar: document.getElementById('btnSalvarCigarrinha'),
                filtroFazenda: document.getElementById('fazendaFiltroCigarrinha'),
                filtroInicio: document.getElementById('inicioCigarrinha'),
                filtroFim: document.getElementById('fimCigarrinha'),
                btnPDF: document.getElementById('btnPDFCigarrinha'),
                btnExcel: document.getElementById('btnExcelCigarrinha'),
            },
            cigarrinhaAmostragem: {
                form: document.getElementById('formCigarrinhaAmostragem'),
                data: document.getElementById('dataCigarrinhaAmostragem'),
                codigo: document.getElementById('codigoCigarrinhaAmostragem'),
                talhao: document.getElementById('talhaoCigarrinhaAmostragem'),
                varietyDisplay: document.getElementById('varietyDisplayCigarrinhaAmostragem'),
                addAmostraBtn: document.getElementById('addAmostraCigarrinhaAmostragem'),
                amostrasContainer: document.getElementById('amostrasCigarrinhaAmostragemContainer'),
                adulto: document.getElementById('adultoPresenteCigarrinhaAmostragem'),
                resultado: document.getElementById('resultadoCigarrinhaAmostragem'),
                btnSalvar: document.getElementById('btnSalvarCigarrinhaAmostragem'),
                filtroFazenda: document.getElementById('fazendaFiltroCigarrinhaAmostragem'),
                filtroInicio: document.getElementById('inicioCigarrinhaAmostragem'),
                filtroFim: document.getElementById('fimCigarrinhaAmostragem'),
                btnPDF: document.getElementById('btnPDFCigarrinhaAmostragem'),
                btnExcel: document.getElementById('btnExcelCigarrinhaAmostragem'),
            },
            gerenciamento: {
                lista: document.getElementById('listaGerenciamento'),
                dataType: document.getElementById('manageDataType'),
                startDate: document.getElementById('manageStartDate'),
                endDate: document.getElementById('manageEndDate'),
                applyBtn: document.getElementById('btnApplyManageFilters')
            },
            relatorioColheita: {
                select: document.getElementById('planoRelatorioSelect'),
                optionsContainer: document.getElementById('reportOptionsContainer'),
                colunasDetalhadoContainer: document.getElementById('colunas-detalhado-container'),
                tipoRelatorioSelect: document.getElementById('tipoRelatorioColheita'),
                btnPDF: document.getElementById('btnGerarRelatorioCustomPDF'),
                btnExcel: document.getElementById('btnGerarRelatorioCustomExcel'),
            },
            monitoramentoAereo: {
                container: document.getElementById('monitoramentoAereo-container'),
                mapContainer: document.getElementById('map'),
                btnAddTrap: document.getElementById('btnAddTrap'),
                btnCenterMap: document.getElementById('btnCenterMap'),
                btnHistory: document.getElementById('btnHistory'),
                btnToggleRiskView: document.getElementById('btnToggleRiskView'),
                infoBox: document.getElementById('talhao-info-box'),
                infoBoxContent: document.getElementById('talhao-info-box-content'),
                infoBoxCloseBtn: document.getElementById('close-info-box'),
                trapInfoBox: document.getElementById('trap-info-box'),
                trapInfoBoxContent: document.getElementById('trap-info-box-content'),
                trapInfoBoxCloseBtn: document.getElementById('close-trap-info-box'),
                    mapFarmSearchInput: document.getElementById('map-farm-search-input'),
                    mapFarmSearchBtn: document.getElementById('map-farm-search-btn'),
            },
            estimativaSafra: {
                container: document.getElementById('estimativaSafra'),
                mapContainer: document.getElementById('estimativaSafraMap'),
                farmFilter: document.getElementById('estimativaSafraFarmFilter'),
                varietyFilter: document.getElementById('estimativaSafraVarietyFilter'),
                stageFilter: document.getElementById('estimativaSafraStageFilter'),
                searchInput: document.getElementById('estimativaSafraSearch'),
                openFiltersBtn: document.getElementById('estimativaSafraOpenFilters'),
                toggleToolbarBtn: document.getElementById('estimativaSafraToggleToolbar'),
                toolbarCard: document.getElementById('estimativaSafraToolbarCard'),
                activeFilters: document.getElementById('estimativaSafraActiveFilters'),
                filtersModal: document.getElementById('estimativaSafraFiltersModal'),
                filtersModalClose: document.getElementById('estimativaSafraFiltersModalClose'),
                applyFiltersBtn: document.getElementById('estimativaSafraApplyFilters'),
                clearFiltersBtn: document.getElementById('estimativaSafraClearFilters'),
                centerMapBtn: document.getElementById('estimativaSafraCenterMap'),
                infoBox: document.getElementById('estimativaSafraInfoBox'),
                infoContent: document.getElementById('estimativaSafraInfoContent'),
                closeInfoBtn: document.getElementById('estimativaSafraCloseInfo'),
                legend: document.getElementById('estimativaSafraLegend'),
                summary: document.getElementById('estimativaSafraSummary'),
                modal: document.getElementById('estimativaSafraModal'),
                modalTitle: document.getElementById('estimativaSafraModalTitle'),
                modalSubtitle: document.getElementById('estimativaSafraModalSubtitle'),
                modalClose: document.getElementById('estimativaSafraModalClose'),
                modalCancel: document.getElementById('estimativaSafraModalCancel'),
                modalSave: document.getElementById('estimativaSafraModalSave'),
                modalFeatureKey: document.getElementById('estimativaSafraModalFeatureKey'),
                modalFarm: document.getElementById('estimativaSafraModalFarm'),
                modalTalhao: document.getElementById('estimativaSafraModalTalhao'),
                modalVariedade: document.getElementById('estimativaSafraModalVariedade'),
                modalEstagio: document.getElementById('estimativaSafraModalEstagio'),
                modalSafra: document.getElementById('estimativaSafraModalSafra'),
                modalData: document.getElementById('estimativaSafraModalData'),
                modalArea: document.getElementById('estimativaSafraModalArea'),
                modalTch: document.getElementById('estimativaSafraModalTch'),
                modalToneladas: document.getElementById('estimativaSafraModalToneladas'),
                modalResponsavel: document.getElementById('estimativaSafraModalResponsavel'),
                modalObs: document.getElementById('estimativaSafraModalObs'),
                modalEstimateWholeFarm: document.getElementById('estimativaSafraModalEstimateWholeFarm'),
                modalEstimateSelected: document.getElementById('estimativaSafraModalEstimateSelected'),
                modalEstimateFiltered: document.getElementById('estimativaSafraModalEstimateFiltered'),
            },
            relatorioPlantio: {
                frente: document.getElementById('plantioRelatorioFrente'),
                cultura: document.getElementById('plantioRelatorioCultura'),
                fazenda: document.getElementById('plantioRelatorioFazenda'),
                inicio: document.getElementById('plantioRelatorioInicio'),
                fim: document.getElementById('plantioRelatorioFim'),
                tipo: document.getElementById('tipoRelatorioPlantio'),
                btnPDF: document.getElementById('btnPDFPlantio'),
                btnExcel: document.getElementById('btnExcelPlantio'),
            },
                lancamentoClima: {
                    form: document.getElementById('formLancamentoClima'),
                    entryId: document.getElementById('climaEntryId'),
                    data: document.getElementById('climaData'),
                    fazenda: document.getElementById('climaFazenda'),
                    talhao: document.getElementById('climaTalhao'),
                    tempMax: document.getElementById('climaTempMax'),
                    tempMin: document.getElementById('climaTempMin'),
                    umidade: document.getElementById('climaUmidade'),
                    pluviosidade: document.getElementById('climaPluviosidade'),
                    vento: document.getElementById('climaVento'),
                    obs: document.getElementById('climaObs'),
                    btnSave: document.getElementById('btnSaveLancamentoClima'),
                },
                relatorioClima: {
                    fazenda: document.getElementById('climaRelatorioFazenda'),
                    inicio: document.getElementById('climaRelatorioInicio'),
                    fim: document.getElementById('climaRelatorioFim'),
                    btnPDF: document.getElementById('btnPDFClima'),
                    btnExcel: document.getElementById('btnExcelClima'),
                },
            relatorioMonitoramento: {
                tipoRelatorio: document.getElementById('monitoramentoTipoRelatorio'),
                fazendaFiltro: document.getElementById('monitoramentoFazendaFiltro'),
                inicio: document.getElementById('monitoramentoInicio'),
                fim: document.getElementById('monitoramentoFim'),
                btnPDF: document.getElementById('btnPDFMonitoramento'),
                btnExcel: document.getElementById('btnExcelMonitoramento'),
            },
            relatorioRisco: {
                inicio: document.getElementById('riscoRelatorioInicio'),
                fim: document.getElementById('riscoRelatorioFim'),
                btnPDF: document.getElementById('btnPDFRisco'),
                btnExcel: document.getElementById('btnExcelRisco'),
            },
            trapPlacementModal: {
                overlay: document.getElementById('trapPlacementModal'),
                body: document.getElementById('trapPlacementModalBody'),
                closeBtn: document.getElementById('trapPlacementModalCloseBtn'),
                cancelBtn: document.getElementById('trapPlacementModalCancelBtn'),
                manualBtn: document.getElementById('trapPlacementModalManualBtn'),
                confirmBtn: document.getElementById('trapPlacementModalConfirmBtn'),
            },
            installAppBtn: document.getElementById('installAppBtn'),
        },

        isFeatureGloballyActive(featureKey) {
            // Em modo offline/fail-soft, a ausência de configuração global não deve travar o menu.
            if (!App.state.globalConfigs || Object.keys(App.state.globalConfigs).length === 0) {
                return App.state.authMode === 'offline' ? true : false;
            }
            return App.state.globalConfigs[featureKey] === true;
        },

        getPerfMetrics() {
            return perfLogger.export();
        },

        debounce(func, delay = 1000) {
            let timeout;
            return (...args) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    func.apply(this, args);
                }, delay);
            };
        },

        safeParseFloat(value) {
            if (typeof value === 'number') return value;
            if (typeof value === 'string') {
                const normalized = value.replace(',', '.');
                const parsed = parseFloat(normalized);
                return isNaN(parsed) ? 0 : parsed;
            }
            return 0;
        },

        async init() {
            perfLogger.start('App.init');
            logBootStage('BOOT:start', { isOnline: navigator.onLine });
            logBootStage(`NET:isOnline=${navigator.onLine}`);
            logBootStage('AUTH:init');
            this.auth.startLoginWatchdog(7000);

            try {
                await OfflineDB.init();
                logBootStage('INDEXEDDB:ready', { db: 'agrovetor-offline-storage', version: OFFLINE_DB_VERSION });
            } catch (error) {
                logBootError('INDEXEDDB:error', error, { context: 'OfflineDB.init' });
            }

            await inspectStorageHealth();
            const offlineMapManifest = await bootstrapCache.get('offline-map-manifest:last', null);
            if (offlineMapManifest) {
                logBootStage('MAP:CACHE:manifest', offlineMapManifest);
            } else {
                logBootStage('MAP:CACHE:manifest', { status: 'missing' });
            }
            this.native.init();
            this.ui.applyTheme(localStorage.getItem(this.config.themeKey) || 'theme-green');
            this.ui.setupEventListeners();
            this.auth.checkSession();
            this.auth.onConnectivityChanged(navigator.onLine);
            this.pwa.registerServiceWorker();
            logBootStage('APP:ready');
            perfLogger.end('App.init');
        },

        native: {
            init() {
                // Block global gesture zooming on iOS/Android WebViews
                document.addEventListener('gesturestart', function (e) {
                    e.preventDefault();
                });

                if (window.Capacitor && Capacitor.isNativePlatform()) {
                    this.configureStatusBar();
                    this.registerPushNotifications();
                    this.listenForNetworkChanges(); // Adiciona o listener de rede
                }
            },

            // --- Funcionalidade 4: Monitoramento de Rede ---
            async listenForNetworkChanges() {
                try {
                    const { Network } = Capacitor.Plugins;

                    // Exibe o status inicial
                    const status = await Network.getStatus();
                    console.log(`Status inicial da rede: ${status.connected ? 'Online' : 'Offline'}`);
                    logAereoOffline('network:capacitor:initial', { connected: status.connected });
                    App.auth.onConnectivityChanged(status.connected);

                    // Adiciona um 'ouvinte' para quando o status da rede mudar
                    Network.addListener('networkStatusChange', (status) => {
                        console.log(`Status da rede alterado para: ${status.connected ? 'Online' : 'Offline'}`);
                        logAereoOffline('network:capacitor:change', { connected: status.connected });
                        const eventName = status.connected ? 'online' : 'offline';
                        window.dispatchEvent(new Event(eventName));
                    });
                } catch (e) {
                    console.error("Erro ao configurar o monitoramento de rede do Capacitor.", e);
                }
            },

            // --- Funcionalidade 1: Correção da Barra de Status ---
            configureStatusBar() {
                try {
                    // Importa o plugin StatusBar. A variável 'Capacitor' é injetada pelo Capacitor.
                    const { StatusBar } = Capacitor.Plugins;

                    // `setOverlaysWebView({ overlay: true })` permite que a WebView ocupe a tela inteira,
                    // ficando "atrás" da barra de status. O CSS (env(safe-area-inset-top))
                    // é usado para garantir que o conteúdo não seja sobreposto.
                    StatusBar.setOverlaysWebView({ overlay: true });

                    console.log("Status bar configurada para sobrepor a webview (Edge-to-Edge).");

                } catch (e) {
                    console.error("Erro ao configurar a StatusBar do Capacitor.", e);
                }
            },

            // --- Funcionalidade 2: Geolocalização ---
            async getCurrentLocation() {
                try {
                    const { Geolocation } = Capacitor.Plugins;
                    const coordinates = await Geolocation.getCurrentPosition();
                    console.log('Localização Atual:', coordinates);
                    // Exemplo de como usar:
                    // App.ui.showAlert(`Lat: ${coordinates.coords.latitude}, Lng: ${coordinates.coords.longitude}`);
                    return coordinates;
                } catch (e) {
                    console.error("Erro ao obter localização", e);
                    App.ui.showAlert("Não foi possível obter a sua localização. Verifique as permissões do aplicativo.", "error");
                    return null;
                }
            },

            async watchLocation(callback) {
                try {
                    const { Geolocation } = Capacitor.Plugins;
                    // O watchPosition retorna um ID que pode ser usado para parar de observar
                    const watchId = await Geolocation.watchPosition({}, (position, err) => {
                        if (err) {
                            console.error("Erro ao observar a localização", err);
                            return;
                        }
                        console.log('Nova localização recebida:', position);
                        if (callback && typeof callback === 'function') {
                            callback(position);
                        }
                    });

                    // Para parar de observar a localização, você chamaria:
                    // const { Geolocation } = Capacitor.Plugins;
                    // Geolocation.clearWatch({ id: watchId });

                    return watchId;
                } catch (e) {
                    console.error("Erro ao iniciar o watchPosition", e);
                    App.ui.showAlert("Não foi possível iniciar o monitoramento de localização.", "error");
                    return null;
                }
            },

            // --- Funcionalidade 3: Notificações Push ---
            async registerPushNotifications() {
                const { PushNotifications } = Capacitor.Plugins;

                // 1. Verificar se a permissão já foi concedida
                let permStatus = await PushNotifications.checkPermissions();

                if (permStatus.receive === 'prompt') {
                    // 2. Se for a primeira vez, pedir permissão
                    permStatus = await PushNotifications.requestPermissions();
                }

                if (permStatus.receive !== 'granted') {
                    // 3. Se a permissão for negada, informar o usuário
                    App.ui.showAlert('A permissão para notificações não foi concedida.', 'warning');
                    return;
                }

                // 4. Se a permissão for concedida, registrar o dispositivo no serviço de push (FCM)
                await PushNotifications.register();

                // 5. Adicionar 'ouvintes' (listeners) para os eventos de notificação
                this.addPushNotificationListeners();
            },

            async addPushNotificationListeners() {
                const { PushNotifications } = Capacitor.Plugins;

                // Disparado ao receber o token de registro (FCM Token)
                PushNotifications.addListener('registration', async (token) => {
                    console.info('Token de registro Push:', token.value);

                    // IMPORTANTE: Salve este token no seu banco de dados (Firestore)
                    // associado ao documento do usuário atual.
                    // O seu backend usará este token para enviar notificações para este aparelho.
                    if (App.state.currentUser) {
                        try {
                            await App.data.updateDocument('users', App.state.currentUser.uid, { fcmToken: token.value });
                            console.log("FCM token salvo para o usuário.");
                        } catch (error) {
                            console.error("Erro ao salvar o FCM token:", error);
                        }
                    }
                });

                // Disparado em caso de erro no registro
                PushNotifications.addListener('registrationError', (err) => {
                    console.error('Erro no registro Push:', err);
                });

                // Disparado quando uma notificação é recebida com o app em primeiro plano
                PushNotifications.addListener('pushNotificationReceived', (notification) => {
                    console.log('Notificação Push recebida:', notification);
                    // Exibe um alerta para o usuário, já que a notificação não aparece
                    // na barra de status quando o app está aberto.
                    App.ui.showAlert(
                        `${notification.title}: ${notification.body}`,
                        'info',
                        5000
                    );
                });

                // Disparado quando o usuário toca na notificação (com o app fechado ou em segundo plano)
                PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                    console.log('Ação de Notificação Push executada:', notification);
                    // Aqui você pode redirecionar o usuário para uma tela específica
                    // com base nos dados da notificação.
                    // Ex: if (notification.notification.data.goToPage) { ... }
                });
            }
        },
        
        auth: {
            pendingOfflinePassword: null,
            defaultKdfParams: {
                iterations: 120000,
                hash: 'SHA-256',
                saltBytes: 16
            },
            encryptionVersion: 'aes-gcm-v1',
            hashVersion: 'pbkdf2-sha256-v1',
            _textEncoder: new TextEncoder(),
            _textDecoder: new TextDecoder(),
            _bufferToBase64(buffer) {
                const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer || buffer);
                let binary = '';
                bytes.forEach((b) => { binary += String.fromCharCode(b); });
                return btoa(binary);
            },
            _base64ToBuffer(base64) {
                const binary = atob(base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }
                return bytes.buffer;
            },
            _randomBytes(length) {
                return crypto.getRandomValues(new Uint8Array(length));
            },
            async _deriveBits(password, salt, iterations) {
                const keyMaterial = await crypto.subtle.importKey(
                    'raw',
                    this._textEncoder.encode(password),
                    { name: 'PBKDF2' },
                    false,
                    ['deriveBits']
                );
                return crypto.subtle.deriveBits(
                    {
                        name: 'PBKDF2',
                        salt,
                        iterations,
                        hash: 'SHA-256'
                    },
                    keyMaterial,
                    256
                );
            },
            async _deriveKey(password, salt, iterations) {
                const keyMaterial = await crypto.subtle.importKey(
                    'raw',
                    this._textEncoder.encode(password),
                    { name: 'PBKDF2' },
                    false,
                    ['deriveKey']
                );
                return crypto.subtle.deriveKey(
                    {
                        name: 'PBKDF2',
                        salt,
                        iterations,
                        hash: 'SHA-256'
                    },
                    keyMaterial,
                    { name: 'AES-GCM', length: 256 },
                    false,
                    ['encrypt', 'decrypt']
                );
            },
            async _encryptProfile(profile, password, kdfParams) {
                const iv = this._randomBytes(12);
                const salt = this._randomBytes(this.defaultKdfParams.saltBytes);
                const key = await this._deriveKey(password, salt, kdfParams.iterations);
                const encoded = this._textEncoder.encode(JSON.stringify(profile));
                const cipherBuffer = await crypto.subtle.encrypt(
                    { name: 'AES-GCM', iv },
                    key,
                    encoded
                );
                return {
                    iv: this._bufferToBase64(iv),
                    salt: this._bufferToBase64(salt),
                    cipherText: this._bufferToBase64(cipherBuffer),
                    version: this.encryptionVersion
                };
            },
            async _decryptProfile(encryptedProfile, password, iterations) {
                const iv = new Uint8Array(this._base64ToBuffer(encryptedProfile.iv));
                const salt = new Uint8Array(this._base64ToBuffer(encryptedProfile.salt));
                const cipherBuffer = this._base64ToBuffer(encryptedProfile.cipherText);
                const key = await this._deriveKey(password, salt, iterations);
                const plainBuffer = await crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv },
                    key,
                    cipherBuffer
                );
                return JSON.parse(this._textDecoder.decode(plainBuffer));
            },
            async _hashPassword(password, salt, iterations) {
                const bits = await this._deriveBits(password, salt, iterations);
                return this._bufferToBase64(bits);
            },
            _normalizeEmail(email) {
                return email.trim().toLowerCase();
            },
            async _getSecureStoragePlugin() {
                if (!window.Capacitor || !Capacitor.isNativePlatform?.()) {
                    return null;
                }
                if (Capacitor.isPluginAvailable?.('SecureStoragePlugin')) {
                    return Capacitor.Plugins.SecureStoragePlugin;
                }
                if (Capacitor.isPluginAvailable?.('SecureStorage')) {
                    return Capacitor.Plugins.SecureStorage;
                }
                return null;
            },
            async _getStoredOfflineCredential(email) {
                const normalizedEmail = this._normalizeEmail(email);
                const secureStorage = await this._getSecureStoragePlugin();
                if (secureStorage) {
                    try {
                        const stored = await secureStorage.get({ key: `offline-cred:${normalizedEmail}` });
                        if (stored?.value) {
                            return JSON.parse(stored.value);
                        }
                    } catch (error) {
                        console.warn("Falha ao ler credencial offline no Secure Storage:", error);
                    }
                }
                return OfflineDB.get('offline-credentials', normalizedEmail);
            },
            async _storeOfflineCredential(record) {
                const normalizedEmail = this._normalizeEmail(record.email);
                const secureStorage = await this._getSecureStoragePlugin();
                if (secureStorage) {
                    try {
                        await secureStorage.set({
                            key: `offline-cred:${normalizedEmail}`,
                            value: JSON.stringify(record)
                        });
                    } catch (error) {
                        console.warn("Falha ao guardar credencial offline no Secure Storage:", error);
                    }
                }
                await OfflineDB.set('offline-credentials', record);
            },
            async _verifyPassword(password, credential) {
                if (credential?.hashVersion === this.hashVersion && credential?.passwordHash) {
                    const salt = new Uint8Array(this._base64ToBuffer(credential.kdfParams.salt));
                    const iterations = credential.kdfParams.iterations;
                    const hash = await this._hashPassword(password, salt, iterations);
                    return hash === credential.passwordHash;
                }
                if (credential?.hashedPassword && credential?.salt) {
                    const hashedPassword = CryptoJS.PBKDF2(password, credential.salt, {
                        keySize: 256 / 32,
                        iterations: 1000
                    }).toString();
                    return hashedPassword === credential.hashedPassword;
                }
                return false;
            },
            _setAuthState({ isAuthenticated, authMode, requiresReauthForSync = App.state.requiresReauthForSync }) {
                App.state.isAuthenticated = isAuthenticated;
                App.state.authMode = authMode;
                App.state.requiresReauthForSync = requiresReauthForSync;
                App.ui.updateConnectivityStatus();
            },
            _setBootStage(stage, extra = {}) {
                App.state.bootStage = stage;
                logBootStage(stage, { authMode: App.state.authMode, isOnline: App.state.isOnline, ...extra });
            },
            _clearBootWatchdog() {
                if (App.state.bootWatchdogTimer) {
                    clearTimeout(App.state.bootWatchdogTimer);
                    App.state.bootWatchdogTimer = null;
                }
            },
            _startBootWatchdog(timeoutMs = 2500) {
                this._clearBootWatchdog();
                App.state.bootWatchdogTimer = setTimeout(() => {
                    if (!App.state.menuRenderedAt) {
                        console.error('BOOT_WATCHDOG timeout', {
                            stage: App.state.bootStage,
                            authMode: App.state.authMode,
                            isOnline: App.state.isOnline,
                            user: App.state.currentUser?.uid || null,
                            stack: new Error('BOOT_WATCHDOG').stack
                        });
                        App.ui.renderFallbackMenu();
                        App.ui.showAlert('Menu offline mínimo carregado. Sincronize quando voltar internet.', 'warning', 4000);
                    }
                }, timeoutMs);
            },
            _clearLoginWatchdog() {
                if (App.state.loginWatchdogTimer) {
                    clearTimeout(App.state.loginWatchdogTimer);
                    App.state.loginWatchdogTimer = null;
                }
            },
            startLoginWatchdog(timeoutMs = 7000) {
                this._clearLoginWatchdog();
                App.state.loginWatchdogTimer = setTimeout(() => {
                    if (!App.state.loginUiRenderedAt) {
                        logBootError('BOOT:watchdog:login-timeout', new Error('LOGIN:UI:rendered timeout'), {
                            stage: App.state.bootStage,
                            isOnline: App.state.isOnline,
                            authMode: App.state.authMode,
                        });
                        App.ui.showLoginScreen({ forced: true, reason: 'watchdog-timeout' });
                        App.ui.showLoginMessage('Modo offline disponível. Faça login quando possível.');
                    }
                }, timeoutMs);
            },

            async checkSession() {
                onAuthStateChanged(auth, async (user) => {
                    try {
                        if (user) {
                            this._setBootStage('BOOT: start');
                            this._setAuthState({ isAuthenticated: true, authMode: 'online', requiresReauthForSync: false });
                            App.state.menuRenderedAt = null;
                            this._startBootWatchdog(2500);
                            App.ui.setLoading(true, "A carregar dados do utilizador...");

                            const userDoc = await withTimeout(App.data.getUserData(user.uid), 8000, 'loadUser');
                            if (!(userDoc && userDoc.active)) {
                                this.logout();
                                App.ui.showLoginMessage("A sua conta foi desativada ou não foi encontrada.");
                                return;
                            }

                            this._setBootStage('AUTH:resolved', { userId: user.uid });

                            let companyDoc = null;
                            if (userDoc.role === 'super-admin') {
                                delete userDoc.companyId;
                            }

                            if (userDoc.role !== 'super-admin' && userDoc.companyId) {
                                try {
                                    companyDoc = await withTimeout(App.data.getDocument('companies', userDoc.companyId), 8000, 'loadCompany');
                                    if (!companyDoc || companyDoc.active === false) {
                                        App.auth.logout();
                                        App.ui.showLoginMessage("A sua empresa está desativada. Por favor, contate o suporte.", "error");
                                        return;
                                    }
                                    await bootstrapCache.set(`company:${userDoc.companyId}`, companyDoc);
                                    await bootstrapCache.set(`modules:${userDoc.companyId}`, companyDoc.subscribedModules || ['estimativaSafra']);
                                    this._setBootStage('DATA: company loaded', { companyId: userDoc.companyId });
                                } catch (error) {
                                    console.warn('Falha/timeout ao carregar empresa online:', error?.message || error);
                                }
                            }

                            App.state.currentUser = { ...user, ...userDoc };

                            if (!App.state.currentUser.companyId && App.state.currentUser.role !== 'super-admin') {
                                App.auth.logout();
                                App.ui.showLoginMessage("A sua conta não está associada a uma empresa. Contacte o suporte.", "error");
                                return;
                            }

                            App.state.currentUser.permissions = await App.repositories.permissions.getEffectivePermissions();
                            await bootstrapCache.set(`permissions:${App.state.currentUser.uid || App.state.currentUser.email || 'anonymous'}`, App.state.currentUser.permissions || {});
                            this._setBootStage('PERM: loaded', { permissionCount: Object.keys(App.state.currentUser.permissions || {}).length });
                            if (App.state.currentUser.companyId) {
                                App.state.cachedSubscribedModules = await App.repositories.modules.getEffectiveModules(App.state.currentUser.companyId);
                            }

                            App.ui.setLoading(true, "A carregar configurações...");
                            try {
                                const globalConfigsDoc = await withTimeout(getDoc(doc(db, 'global_configs', 'main')), 8000, 'loadGlobalConfigs');
                                if (globalConfigsDoc.exists()) {
                                    App.state.globalConfigs = globalConfigsDoc.data();
                                    await bootstrapCache.set('global_configs:main', App.state.globalConfigs);
                                } else {
                                    App.state.globalConfigs = {};
                                }
                            } catch (error) {
                                App.state.globalConfigs = await bootstrapCache.get('global_configs:main', {});
                                console.warn('Falha ao carregar configurações globais online, usando cache:', error?.message || error);
                            }

                            if (companyDoc) {
                                App.state.companies = [companyDoc];
                            }

                            App.actions.saveUserProfileLocally(App.state.currentUser);
                            App.ui.showAppScreen();
                            App.data.listenToCoreData();

                            if (this.pendingOfflinePassword) {
                                try {
                                    await this.updateOfflineCredential(user.uid, this.pendingOfflinePassword);
                                } finally {
                                    this.pendingOfflinePassword = null;
                                }
                            }

                            const draftRestored = await App.actions.checkForDraft();
                            if (!draftRestored) {
                                let lastTab = localStorage.getItem('agrovetor_lastActiveTab');
                                if (window.Capacitor && window.Capacitor.isNativePlatform?.()) {
                                    lastTab = 'estimativaSafra';
                                }
                                App.ui.showTab(lastTab || 'estimativaSafra');
                            }

                            if (App.state.isOnline) {
                                await this.resumeOnlineSessionAndSync();
                            }

                            App.actions.checkSequence();
                        } else {
                            if (App.state.isAuthenticated) {
                                App.state.authMode = 'offline';
                                if (App.state.isOnline) {
                                    this._markReauthRequired();
                                }
                                App.ui.showAppScreen();
                                App.ui.setLoading(false);
                                return;
                            }
                            const localProfiles = App.actions.getLocalUserProfiles();
                            this._setBootStage('AUTH:resolved', { userId: null, mode: 'guest' });
                            App.ui.showLoginScreen();
                            if (!navigator.onLine) {
                                App.ui.showLoginMessage('Sem conexão. Você pode entrar com credenciais offline já sincronizadas.');
                            }
                        }
                    } catch (error) {
                        logBootError('AUTH:error', error, { context: 'checkSession' });
                        App.ui.showAlert('Falha ao inicializar sessão. Mostrando login em modo seguro offline.', 'warning', 5000);
                        App.ui.showLoginScreen({ forced: true, reason: 'checkSession-error' });
                    } finally {
                        App.ui.setLoading(false);
                    }
                });
            },
            async login() {
                const email = App.elements.loginUser.value.trim();
                const password = App.elements.loginPass.value;
                logBootStage('LOGIN:submit', { email: email || null, isOnline: navigator.onLine });
                if (!email || !password) {
                    App.ui.showLoginMessage("Preencha e-mail e senha.");
                    return;
                }
                if (!navigator.onLine) {
                    logBootStage('LOGIN:offlineAttempt', { email });
                    await this.loginOffline(email, password);
                    return;
                }
                await this.loginOnline(email, password);
            },
            async loginOnline(email, password) {
                App.ui.setLoading(true, "A autenticar...");
                try {
                    await setPersistence(auth, browserSessionPersistence);
                    await signInWithEmailAndPassword(auth, email, password);
                    this.pendingOfflinePassword = password;
                    logBootStage('LOGIN:success', { mode: 'online', email });
                } catch (error) {
                    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                        App.ui.showLoginMessage("E-mail ou senha inválidos.");
                    } else if (error.code === 'auth/network-request-failed') {
                        App.ui.showLoginMessage("Erro de rede. Verifique sua conexão e tente novamente.");
                    } else {
                        App.ui.showLoginMessage("Ocorreu um erro ao fazer login.");
                    }
                    logBootError('LOGIN:error', error, { mode: 'online', email });
                    App.ui.setLoading(false);
                }
            },

            async loginOffline(email, password) {
                if (!email || !password) {
                    App.ui.showAlert("Por favor, insira e-mail e senha.", "warning");
                    return;
                }

                try {
                    logBootStage('LOGIN:offlineAttempt', { email });
                    const normalizedEmail = this._normalizeEmail(email);
                    const credentials = await this._getStoredOfflineCredential(normalizedEmail);

                    if (!credentials) {
                        App.ui.showAlert("Credenciais offline não encontradas para este e-mail. Faça login online primeiro.", "error");
                        return;
                    }

                    const isValid = await this._verifyPassword(password, credentials);
                    if (!isValid) {
                        App.ui.showAlert("Sua senha mudou. Conecte-se à internet e faça login uma vez para atualizar o acesso offline.", "error");
                        return;
                    }

                    let userProfile = null;
                    if (credentials.encryptedProfile) {
                        userProfile = await this._decryptProfile(credentials.encryptedProfile, password, credentials.kdfParams.iterations);
                    } else if (credentials.userProfile) {
                        userProfile = credentials.userProfile;
                        await this.updateOfflineCredential(credentials.userId || userProfile.uid, password, userProfile);
                    }

                    if (!userProfile) {
                        App.ui.showAlert("Credencial offline inválida. Conecte-se à internet e faça login novamente.", "error");
                        return;
                    }

                    App.state.currentUser = userProfile;
                    this._setAuthState({ isAuthenticated: true, authMode: 'offline', requiresReauthForSync: false });
                    App.state.reauthDeferred = false;
                    App.state.menuRenderedAt = null;

                    this._setBootStage('BOOT: start');
                    this._setBootStage('AUTH: resolved', { userId: userProfile.uid || null });
                    this._startBootWatchdog(2000);

                    App.ui.setLoading(true, "A carregar dados offline...");

                    const companyId = App.state.currentUser.companyId;
                    const effectivePermissions = await App.repositories.permissions.getEffectivePermissions();
                    App.state.currentUser.permissions = effectivePermissions;
                    this._setBootStage('PERM: loaded', { permissionCount: Object.keys(effectivePermissions || {}).length });

                    if (companyId) {
                        App.state.cachedSubscribedModules = await App.repositories.modules.getEffectiveModules(companyId);
                        let companyDoc = await bootstrapCache.get(`company:${companyId}`, null);
                        if (!companyDoc) {
                            try {
                                companyDoc = await withTimeout(App.data.getDocument('companies', companyId), 8000, 'loadCompany');
                            } catch (error) {
                                console.warn('Falha/timeout ao carregar empresa no login offline:', error?.message || error);
                            }
                        }
                        if (companyDoc) {
                            App.state.companies = [companyDoc];
                            await bootstrapCache.set(`company:${companyId}`, companyDoc);
                            await bootstrapCache.set(`modules:${companyId}`, companyDoc.subscribedModules || ['estimativaSafra']);
                            this._setBootStage('DATA: company loaded', { companyId });
                        } else {
                            App.ui.showAlert("Dados da empresa indisponíveis offline. Mostrando menu mínimo.", "info", 5000);
                        }
                    }

                    let globalConfigs = await bootstrapCache.get('global_configs:main', null);
                    if (globalConfigs) {
                        App.state.globalConfigs = globalConfigs;
                    }

                    withTimeout(getDoc(doc(db, 'global_configs', 'main')), 8000, 'loadGlobalConfigs')
                        .then(async (globalConfigsDoc) => {
                            if (globalConfigsDoc?.exists()) {
                                App.state.globalConfigs = globalConfigsDoc.data();
                                await bootstrapCache.set('global_configs:main', App.state.globalConfigs);
                                App.ui.renderMenu();
                            }
                        })
                        .catch((error) => console.warn('Falha/timeout ao atualizar configurações globais em background:', error?.message || error));

                    App.ui.showAppScreen();
                    this._setBootStage('UI: ready');
                    logBootStage('LOGIN:success', { mode: 'offline', email });
                    App.mapModule.loadOfflineShapes();
                    App.data.listenToCoreData();
                } catch (error) {
                    App.ui.showAlert("Ocorreu um erro durante o login offline.", "error");
                    logBootError('LOGIN:error', error, { mode: 'offline', email });
                    App.ui.showLoginScreen({ forced: true, reason: 'offline-login-error' });
                } finally {
                    App.ui.setLoading(false);
                }
            },
            async updateOfflineCredential(userId, password, userProfile = App.state.currentUser) {
                if (!userProfile || !password) return;
                const kdfParams = {
                    iterations: this.defaultKdfParams.iterations,
                    salt: this._bufferToBase64(this._randomBytes(this.defaultKdfParams.saltBytes))
                };
                const saltBuffer = new Uint8Array(this._base64ToBuffer(kdfParams.salt));
                const passwordHash = await this._hashPassword(password, saltBuffer, kdfParams.iterations);
                const encryptedProfile = await this._encryptProfile({
                    uid: userProfile.uid,
                    email: userProfile.email,
                    username: userProfile.username,
                    role: userProfile.role,
                    permissions: userProfile.permissions,
                    companyId: userProfile.companyId,
                }, password, kdfParams);
                const record = {
                    email: this._normalizeEmail(userProfile.email),
                    userId: userId || userProfile.uid,
                    hashVersion: this.hashVersion,
                    kdfParams,
                    passwordHash,
                    encryptedProfile,
                    updatedAt: new Date().toISOString()
                };
                await this._storeOfflineCredential(record);
                App.actions.saveUserProfileLocally(userProfile);
            },
            async onConnectivityChanged(isOnline) {
                App.state.isOnline = isOnline;
                logBootStage(`NET:isOnline=${isOnline}`);
                if (!isOnline) {
                    App.state.syncStatus = 'idle';
                }
                App.ui.updateConnectivityStatus();
                if (isOnline) {
                    await this.resumeOnlineSessionAndSync();
                }
            },
            async resumeOnlineSessionAndSync(options = {}) {
                if (!App.state.isAuthenticated || !App.state.isOnline) {
                    return;
                }
                if (!navigator.onLine) {
                    return;
                }
                if (auth.currentUser) {
                    try {
                        const message = options.isManual ? "A iniciar sincronização manual..." : "Conexão reestabelecida. A iniciar sincronização automática...";
                        if (options.isManual) {
                            App.ui.showSystemNotification("Sincronização", message, "info");
                        }
                        await withTimeout(auth.currentUser.getIdToken(true), 8000, 'refreshToken');
                        await this._afterOnlineSessionReady();
                    } catch (error) {
                        console.warn("Falha ao atualizar token (provável falha de rede/timeout). Entrando em modo offline/necessita reautenticação:", error?.message || error);

                        // Treat timeouts specifically as network errors if offline, else mark reauth
                        if (!navigator.onLine || error.message.includes('Timeout')) {
                            App.state.syncStatus = 'error';
                            App.ui.updateConnectivityStatus();
                        } else {
                            this._markReauthRequired();
                        }
                    }
                } else {
                    this._markReauthRequired();
                }
            },
            _markReauthRequired() {
                App.state.requiresReauthForSync = true;
                App.state.authMode = App.state.authMode || 'offline';
                App.state.syncStatus = 'error';
                App.ui.updateConnectivityStatus();
                if (App.state.isOnline && !App.state.reauthDeferred) {
                    App.ui.showReauthBanner();
                }
            },
            async _afterOnlineSessionReady() {
                App.state.authMode = 'online';
                App.state.requiresReauthForSync = false;
                App.state.reauthDeferred = false;
                App.ui.hideReauthBanner();
                App.ui.updateConnectivityStatus();

                try {
                    const globalConfigsDoc = await withTimeout(getDoc(doc(db, 'global_configs', 'main')), 8000, 'loadGlobalConfigs');
                    if (globalConfigsDoc.exists()) {
                        App.state.globalConfigs = globalConfigsDoc.data();
                        await bootstrapCache.set('global_configs:main', App.state.globalConfigs);
                    }
                } catch (error) {
                    App.state.globalConfigs = await bootstrapCache.get('global_configs:main', App.state.globalConfigs || {});
                    console.warn('Falha ao atualizar configurações globais no retorno online:', error?.message || error);
                }

                if (App.state.currentUser?.companyId && App.state.currentUser.role !== 'super-admin') {
                    const companyDoc = await App.repositories.company.getEffectiveCompany(App.state.currentUser.companyId);
                    if (companyDoc) {
                        App.state.companies = [companyDoc];
                    }
                }

                App.ui.renderMenu();
                App.data.listenToCoreData();
                try {
                    await App.actions.startSync();
                } catch (error) {
                    console.error('Falha na sincronização em background:', error);
                }
            },
            async confirmReauth(password) {
                if (!password) {
                    App.ui.showAlert("Por favor, insira a sua senha para reautenticar.", "warning");
                    return;
                }
                App.ui.setLoading(true, "A reautenticar...");
                try {
                    if (auth.currentUser) {
                        const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
                        await reauthenticateWithCredential(auth.currentUser, credential);
                        await this.updateOfflineCredential(App.state.currentUser.uid, password);
                        await this._afterOnlineSessionReady();
                    } else if (App.state.currentUser?.email) {
                        await signInWithEmailAndPassword(auth, App.state.currentUser.email, password);
                        this.pendingOfflinePassword = password;
                    }
                    App.ui.closeReauthModal();
                } catch (error) {
                    if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                        App.ui.showAlert("A senha está incorreta.", "error");
                    } else if (error.code === 'auth/network-request-failed' || !navigator.onLine) {
                        App.ui.showAlert("Sem conexão com a internet. Verifique sua rede e tente novamente.", "warning");
                    } else {
                        App.ui.showAlert("Não foi possível reautenticar. Tente novamente.", "error");
                    }
                    console.error("Erro ao reautenticar:", error);
                } finally {
                    App.ui.setLoading(false);
                }
            },
            async logout() {
                if (navigator.onLine) {
                    await signOut(auth);
                }
                App.state.isAuthenticated = false;
                App.state.authMode = null;
                App.state.requiresReauthForSync = false;
                App.state.reauthDeferred = false;
                App.state.syncStatus = 'idle';
                App.ui.hideReauthBanner();
                App.ui.updateConnectivityStatus();
                // Limpa todos os listeners e processos em segundo plano
                App.data.cleanupListeners();
                App.actions.stopGpsTracking();
                App.actions.stopAutoSync(); // Para a sincronização automática
                App.charts.destroyAll(); // Destrói todas as instâncias de gráficos

                // Limpa completamente o estado da aplicação para evitar "déjà vu"
                App.state.isImpersonating = false;
                App.state.originalUser = null;
                App.state.currentUser = null;
                App.state.users = [];
                App.state.companies = [];
                App.state.globalConfigs = {};
                App.state.companyConfig = {};
                App.state.registros = [];
                App.state.perdas = [];
                App.state.cigarrinha = [];
                App.state.planos = [];
                App.state.fazendas = [];
                App.state.personnel = [];
                App.state.frentesDePlantio = [];
                App.state.apontamentosPlantio = [];
                App.state.companyLogo = null;
                App.state.harvestPlans = [];
                App.state.activeHarvestPlan = null;
                App.state.armadilhas = [];
                App.state.geoJsonData = null;
                App.state.selectedMapFeature = null;
                App.state.trapNotifications = [];
                App.state.unreadNotificationCount = 0;
                App.state.notifiedTrapIds = new Set();
                App.state.invalidTrapDateLogKeys = new Set();
                App.state.riskViewActive = false;
                App.state.plantio = [];
                App.state.clima = [];
                App.state.apontamentoPlantioFormIsDirty = false;

                // Limpa timers de inatividade e armazenamento local
                clearTimeout(App.state.inactivityTimer);
                clearTimeout(App.state.inactivityWarningTimer);
                localStorage.removeItem('agrovetor_lastActiveTab');
                sessionStorage.removeItem('notifiedTrapIds');

                // Reavalia a sessão para mostrar a tela de login correta (online/offline)
                this.checkSession();
            },
            initiateUserCreation() {
                const els = App.elements.users;
                const email = els.username.value.trim();
                const password = els.password.value;
                const role = els.role.value;
                if (!email || !password) { App.ui.showAlert("Preencha e-mail e senha.", "error"); return; }

                const permissions = {};
                els.permissionsContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    permissions[cb.dataset.permission] = cb.checked;
                });

                // Define the action to be executed upon confirmation
                const userCreationAction = async () => {
                    let targetCompanyId = App.state.currentUser.companyId;
                    if (App.state.currentUser.role === 'super-admin') {
                        targetCompanyId = App.elements.users.adminTargetCompanyUsers.value;
                        if (!targetCompanyId) {
                            throw new Error("Como Super Admin, você deve selecionar uma empresa alvo para criar o utilizador.");
                        }
                    }

                    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
                    const newUser = userCredential.user;
                    await signOut(secondaryAuth);

                    const userData = {
                        username: email.split('@')[0], email, role, active: true, permissions, companyId: targetCompanyId,
                        hasSeenWelcomeTour: false, lastSeenVersion: '0.0.0'
                    };
                    await App.data.createUserData(newUser.uid, userData);
                    
                    App.ui.showAlert(`Utilizador ${email} criado com sucesso!`);
                    els.username.value = '';
                    els.password.value = '';
                    els.role.value = 'user';
                    App.ui.updatePermissionsForRole('user');
                };

                // Store the action and show the modal
                App.state.adminAction = userCreationAction;
                App.ui.showAdminPasswordConfirmModal();
            },

            async executeAdminAction() {
                const adminPassword = App.elements.adminPasswordConfirmModal.passwordInput.value;
                if (!App.state.adminAction || typeof App.state.adminAction !== 'function') { return; }

                // Se estiver offline, confia no papel do utilizador já logado
                if (!navigator.onLine) {
                    const userRole = App.state.currentUser?.role;
                    if (userRole === 'admin' || userRole === 'super-admin') {
                        App.ui.setLoading(true, "A executar ação offline...");
                        try {
                            await App.state.adminAction();
                            App.ui.closeAdminPasswordConfirmModal();
                        } catch (error) {
                            App.ui.showAlert(`Erro ao executar ação offline: ${error.message}`, "error");
                        } finally {
                            App.state.adminAction = null;
                            App.elements.adminPasswordConfirmModal.passwordInput.value = '';
                            App.ui.setLoading(false);
                        }
                        return;
                    }
                }

                // Fluxo online normal com verificação de senha
                if (!adminPassword) { App.ui.showAlert("Por favor, insira a sua senha de administrador para confirmar.", "error"); return; }
                App.ui.setLoading(true, "A autenticar e executar ação...");

                try {
                    const adminUser = auth.currentUser;
                    const credential = EmailAuthProvider.credential(adminUser.email, adminPassword);
                    await reauthenticateWithCredential(adminUser, credential);

                    // Se a reautenticação for bem-sucedida, executa a ação armazenada
                    await App.state.adminAction();
                    App.ui.closeAdminPasswordConfirmModal();

                } catch (error) {
                    if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-login-credentials') {
                        App.ui.showAlert("A sua senha de administrador está incorreta.", "error");
                    } else if (error.code === 'auth/email-already-in-use') {
                        App.ui.showAlert("Este e-mail já está em uso por outro utilizador.", "error");
                    } else if (error.code === 'auth/weak-password') {
                        App.ui.showAlert("A senha do novo utilizador deve ter pelo menos 6 caracteres.", "error");
                    } else {
                        App.ui.showAlert(`Erro ao executar ação: ${error.message}`, "error");
                        console.error("Erro na ação de administrador:", error);
                    }
                } finally {
                    App.state.adminAction = null; // Limpa a ação após a execução
                    App.elements.adminPasswordConfirmModal.passwordInput.value = '';
                    App.ui.setLoading(false);
                }
            },
            async deleteUser(userId) {
                const userToDelete = App.state.users.find(u => u.id === userId);
                if (!userToDelete) return;
                
                App.ui.showConfirmationModal(`Tem a certeza que deseja EXCLUIR o utilizador ${userToDelete.username}? Esta ação não pode ser desfeita.`, async () => {
                    try {
                        await App.data.updateDocument('users', userId, { active: false });
                        App.actions.removeUserProfileLocally(userId);
                        App.ui.showAlert(`Utilizador ${userToDelete.username} desativado.`);
                        App.ui.closeUserEditModal();
                    } catch (error) {
                        App.ui.showAlert("Erro ao desativar utilizador.", "error");
                    }
                });
            },
            async toggleUserStatus(userId) {
                const user = App.state.users.find(u => u.id === userId);
                if (!user) return;
                const newStatus = !user.active;
                await App.data.updateDocument('users', userId, { active: newStatus });
                App.ui.showAlert(`Utilizador ${user.username} ${newStatus ? 'ativado' : 'desativado'}.`);
            },
            async resetUserPassword(userId) {
                const user = App.state.users.find(u => u.id === userId);
                if (!user || !user.email) return;

                App.ui.showConfirmationModal(`Deseja enviar um e-mail de redefinição de senha para ${user.email}?`, async () => {
                    try {
                        await sendPasswordResetEmail(auth, user.email);
                        App.ui.showAlert(`E-mail de redefinição enviado para ${user.email}.`, 'success');
                    } catch (error) {
                        App.ui.showAlert("Erro ao enviar e-mail de redefinição.", "error");
                        console.error(error);
                    }
                });
            },
            async saveUserChanges(userId) {
                const modalEls = App.elements.userEditModal;
                const role = modalEls.role.value;
                const permissions = {};
                modalEls.permissionGrid.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    permissions[cb.dataset.permission] = cb.checked;
                });
                
                await App.data.updateDocument('users', userId, { role, permissions });
                App.ui.showAlert("Alterações guardadas com sucesso!");
                App.ui.closeUserEditModal();
            }
        },

        repositories: {
            permissions: {
                async getEffectivePermissions() {
                    const user = App.state.currentUser;
                    const minimumPermissions = App.config.roles[user?.role || 'user'] || App.config.roles.user;
                    if (!user) {
                        return { ...minimumPermissions };
                    }

                    const cacheKey = `permissions:${user.uid || user.email || 'anonymous'}`;
                    const cachedPermissions = await bootstrapCache.get(cacheKey, null);
                    const mergedCached = { ...minimumPermissions, ...(cachedPermissions || {}), ...(user.permissions || {}) };

                    if (!App.state.isOnline || App.state.authMode === 'offline') {
                        if (!cachedPermissions && !user.permissions) {
                            App.ui.showAlert("Permissões offline mínimas carregadas. Sincronize uma vez online para habilitar todos os módulos.", "info", 5000);
                        }
                        return mergedCached;
                    }

                    withTimeout(App.data.getUserData(user.uid), 8000, 'loadPermissions')
                        .then(async (freshUserDoc) => {
                            if (freshUserDoc?.permissions) {
                                App.state.currentUser.permissions = freshUserDoc.permissions;
                                await bootstrapCache.set(cacheKey, freshUserDoc.permissions);
                                App.ui.renderMenu();
                            }
                        })
                        .catch((error) => console.warn('Falha ao atualizar permissões em background:', error?.message || error));

                    return mergedCached;
                }
            },
            company: {
                async getEffectiveCompany(companyId) {
                    if (!companyId) return null;
                    const cacheKey = `company:${companyId}`;
                    const cachedCompany = await bootstrapCache.get(cacheKey, null);

                    if (App.state.isOnline && App.state.authMode !== 'offline') {
                        withTimeout(App.data.getDocument('companies', companyId), 8000, 'loadCompany')
                            .then(async (remoteCompany) => {
                                if (remoteCompany) {
                                    await bootstrapCache.set(cacheKey, remoteCompany);
                                    App.state.companies = [remoteCompany];
                                    App.ui.renderMenu();
                                }
                            })
                            .catch((error) => console.warn('Falha ao atualizar empresa em background:', error?.message || error));
                    }

                    return cachedCompany;
                }
            },
            modules: {
                async getEffectiveModules(companyId) {
                    const minimumModules = ['estimativaSafra'];
                    if (!companyId) return minimumModules;
                    const cacheKey = `modules:${companyId}`;
                    const cachedModules = await bootstrapCache.get(cacheKey, null);
                    if (cachedModules?.length) {
                        return cachedModules;
                    }
                    const cachedCompany = await App.repositories.company.getEffectiveCompany(companyId);
                    const modules = cachedCompany?.subscribedModules || minimumModules;
                    App.state.cachedSubscribedModules = modules;
                    await bootstrapCache.set(cacheKey, modules);
                    return modules;
                }
            }
        },

        data: {
            cleanupListeners() {
                App.state.unsubscribeListeners.forEach(unsubscribe => unsubscribe());
                App.state.unsubscribeListeners = [];
            },
            collectionSubscriptions: {},

            async subscribeTo(collectionName) {
                if (this.collectionSubscriptions[collectionName]) return;

                const companyId = App.state.currentUser.companyId;
                const isSuperAdmin = App.state.currentUser.role === 'super-admin';

                if (!companyId && !isSuperAdmin) return;

                const applyCollectionData = async (items, source = 'remote', extra = {}) => {
                    const normalized = Array.isArray(items) ? items : [];
                    App.state[collectionName] = normalized;

                    if (MASTER_DATA_COLLECTIONS.includes(collectionName) && !isSuperAdmin && companyId) {
                        try {
                            await App.offlineDB.upsertMasterData(collectionName, companyId, normalized);
                        } catch (error) {
                            console.warn('[MasterDataSync] Falha ao persistir snapshot remoto', { collectionName, companyId, error: error?.message || error });
                        }
                    }

                    if (collectionName === 'armadilhas') {
                        if (App.mapModule) App.mapModule.loadTraps();
                        App.mapModule.checkTrapStatusAndNotify();
                    }

                    if (source !== 'remote') {
                        console.info('[OfflineCombos]', {
                            source,
                            collectionName,
                            companyId: companyId || null,
                            count: normalized.length,
                            ...extra,
                        });
                    }

                    // Debounce render to avoid rapid re-renders from multiple snapshots
                    _perfDebounce('render_' + collectionName, () => {
                        _scheduleRender(() => App.ui.renderSpecificContent(collectionName));
                    }, 80);
                };

                let q;
                if (isSuperAdmin) {
                     q = collection(db, collectionName);
                } else {
                     q = query(collection(db, collectionName), where("companyId", "==", companyId));
                }

                const unsubscribe = onSnapshot(q, async (querySnapshot) => {
                    const data = [];
                    querySnapshot.forEach((doc) => {
                        const item = { id: doc.id, ...doc.data() };
                        if (collectionName === 'armadilhas' && App.mapModule?.parseTrapDate) {
                            item._installDateNormalized = App.mapModule.parseTrapDate(item.dataInstalacao);
                        }
                        data.push(item);
                    });
                    await applyCollectionData(data, 'remote', { cacheEvent: 'snapshot' });
                }, async (error) => {
                    console.error(`Erro ao ouvir a coleção ${collectionName}: `, error);
                    const canUseLocal = MASTER_DATA_COLLECTIONS.includes(collectionName) && !isSuperAdmin && companyId;
                    if (!canUseLocal) return;
                    const cached = await App.offlineDB.getMasterData(collectionName, companyId);
                    if (cached?.items?.length) {
                        await applyCollectionData(cached.items, 'local-fallback', {
                            reason: 'snapshot-error',
                            updatedAt: cached.updatedAt || null,
                        });
                    } else {
                        console.warn('[OfflineCombos] Sem cache local para fallback', {
                            collectionName,
                            companyId,
                            reason: 'snapshot-error',
                        });
                    }
                });

                this.collectionSubscriptions[collectionName] = unsubscribe;
                App.state.unsubscribeListeners.push(unsubscribe);

                if (!navigator.onLine && MASTER_DATA_COLLECTIONS.includes(collectionName) && !isSuperAdmin && companyId) {
                    const cached = await App.offlineDB.getMasterData(collectionName, companyId);
                    if (cached?.items) {
                        await applyCollectionData(cached.items, 'local-offline', {
                            updatedAt: cached.updatedAt || null,
                            reason: cached.items.length === 0 ? 'empty-cache' : 'offline-startup',
                        });
                    }
                }
            },

            async syncMasterData(force = false) {
                const companyId = App.state.currentUser?.companyId;
                const isSuperAdmin = App.state.currentUser?.role === 'super-admin';
                if (!companyId || isSuperAdmin || !navigator.onLine) {
                    return;
                }

                const now = Date.now();
                const throttleMs = force ? 0 : (10 * 60 * 1000);
                const cacheState = App.state.masterDataSyncStatus || {};

                for (const collectionName of MASTER_DATA_COLLECTIONS) {
                    const lastSyncAt = cacheState[collectionName]?.lastSyncAt || 0;
                    if (!force && now - lastSyncAt < throttleMs) {
                        continue;
                    }

                    try {
                        const q = query(collection(db, collectionName), where('companyId', '==', companyId));
                        const snapshot = await getDocs(q);
                        const items = [];
                        snapshot.forEach((itemDoc) => {
                            const item = { id: itemDoc.id, ...itemDoc.data() };
                            if (collectionName === 'armadilhas' && App.mapModule?.parseTrapDate) {
                                item._installDateNormalized = App.mapModule.parseTrapDate(item.dataInstalacao);
                            }
                            items.push(item);
                        });
                        const updatedAt = await App.offlineDB.upsertMasterData(collectionName, companyId, items);
                        App.state.masterDataSyncStatus[collectionName] = {
                            lastSyncAt: Date.now(),
                            updatedAt,
                            count: items.length,
                        };
                    } catch (error) {
                        console.warn('[MasterDataSync] Falha durante sincronização de cadastro-base', {
                            collectionName,
                            companyId,
                            error: error?.message || error,
                        });
                    }
                }
            },
            listenToCoreData() {
                perfLogger.start('listenToCoreData');
                this.cleanupListeners();
                this.collectionSubscriptions = {};

                // Ouve as configurações globais para TODOS os utilizadores
                const globalConfigsRef = doc(db, 'global_configs', 'main');
                const unsubscribeGlobalConfigs = onSnapshot(globalConfigsRef, (doc) => {
                    if (doc.exists()) {
                        App.state.globalConfigs = doc.data();
                    } else {
                        console.warn("Documento de configurações globais 'main' não encontrado. Recursos podem estar desativados por padrão.");
                        App.state.globalConfigs = {}; // Garante que é um objeto vazio
                    }
                    // Re-renderiza o menu sempre que as flags globais mudam
                    App.ui.renderMenu();
                }, (error) => {
                    console.error("Erro ao ouvir as configurações globais: ", error);
                    App.state.globalConfigs = {}; // Reseta em caso de erro
                    App.ui.renderMenu(); // Re-renderiza o menu com flags desativadas
                });
                App.state.unsubscribeListeners.push(unsubscribeGlobalConfigs);

                const companyId = App.state.currentUser.companyId;
                const isSuperAdmin = App.state.currentUser.role === 'super-admin';

                // Core Collections - prioritize essential data, defer secondary collections
                const criticalCollections = ['users', 'fazendas', 'personnel'];
                const deferredCollections = ['frentesDePlantio', 'tipos_servico', 'operacoes', 'produtos', 'operacao_produtos', 'ordens_servico', 'frota', 'armadilhas', 'estimativasSafra'];
                // Load critical data immediately for fast UI render
                criticalCollections.forEach(col => this.subscribeTo(col));
                // Defer secondary data to next idle period for better perceived performance
                if (typeof requestIdleCallback === 'function') {
                    requestIdleCallback(() => {
                        deferredCollections.forEach(col => this.subscribeTo(col));
                    }, { timeout: 3000 });
                } else {
                    setTimeout(() => {
                        deferredCollections.forEach(col => this.subscribeTo(col));
                    }, 300);
                }
                if (navigator.onLine) {
                    this.syncMasterData(false).catch((error) => {
                        console.warn('[MasterDataSync] Falha na pré-carga online', error?.message || error);
                    });
                }

                if (isSuperAdmin) {
                    // Tratamento especial para Clima (Super Admin também não deve carregar tudo por padrão)
                    // Carrega apenas os últimos 6 meses
                    App.data.listenToRecentClima(null, true);

                    // Super Admin também ouve a coleção de empresas
                    const qCompanies = collection(db, 'companies');
                    const unsubscribeCompanies = onSnapshot(qCompanies, (querySnapshot) => {
                        const data = [];
                        querySnapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
                        App.state['companies'] = data;
                        App.ui.renderSpecificContent('companies');
                    }, (error) => console.error(`Erro ao ouvir a coleção companies: `, error));
                    App.state.unsubscribeListeners.push(unsubscribeCompanies);

                    App.state.companyLogo = null;
                    App.ui.renderLogoPreview();

                } else if (companyId) {
                    // OTIMIZAÇÃO: Listener específico para Clima (Recent Data Only)
                    App.data.listenToRecentClima(companyId);

                    // OTIMIZAÇÃO: Listener específico para Controle de Frota (Active Trips Only)
                    App.data.listenToActiveTrips(companyId);

                    // **NOVO**: Ouvir o documento da própria empresa para obter os módulos subscritos
                    const companyDocRef = doc(db, 'companies', companyId);
                    const unsubscribeCompany = onSnapshot(companyDocRef, (doc) => {
                        if (doc.exists()) {
                            // Coloca a empresa do utilizador no estado, para que o menu possa ser renderizado corretamente
                            App.state.companies = [{ id: doc.id, ...doc.data() }];
                        } else if (navigator.onLine) {
                            // Se estiver online e a empresa não for encontrada, desloga o utilizador por segurança.
                            console.error(`Empresa com ID ${companyId} não encontrada. A deslogar o utilizador.`);
                            App.auth.logout();
                        } else {
                            // Se estiver offline e o documento da empresa não estiver no cache, permite que a aplicação continue.
                            // Os módulos podem não ser renderizados corretamente, mas o acesso não é bloqueado.
                            console.warn(`Documento da empresa com ID ${companyId} não encontrado no cache offline. O menu pode estar incompleto.`);
                        }
                        App.ui.renderMenu(); // Re-renderiza o menu quando os dados da empresa mudam
                    });
                    App.state.unsubscribeListeners.push(unsubscribeCompany);

                    // Configurações específicas da empresa (logotipo, etc.)
                    const configDocRef = doc(db, 'config', companyId);
                    const unsubscribeConfig = onSnapshot(configDocRef, (doc) => {
                        if (doc.exists()) {
                            const configData = doc.data();
                            App.state.companyConfig = configData; // Carrega todas as configurações da empresa
                            App.state.companyLogo = configData.logoBase64 || null;

                            if (configData.shapefileURL) {
                                App.mapModule.loadAndCacheShapes(configData.shapefileURL);
                            }

                        } else {
                            App.state.companyLogo = null;
                            App.state.companyConfig = {};
                        }
                        App.ui.renderLogoPreview();
                    });
                    App.state.unsubscribeListeners.push(unsubscribeConfig);
                } else {
                    console.error("Utilizador não é Super Admin e não tem companyId. Carregamento de dados bloqueado.");
                }
                perfLogger.end('listenToCoreData');
            },
            async getDocument(collectionName, docId, options) {
                return await getDoc(doc(db, collectionName, docId)).then(docSnap => {
                    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
                });
            },
            async addDocument(collectionName, data) {
                const hydratedData = rehydrateFirestoreTypes(data);
                const sanitizedData = sanitizeFirestoreData(hydratedData);
                return await addDoc(collection(db, collectionName), { ...sanitizedData, createdAt: serverTimestamp() });
            },
            async setDocument(collectionName, docId, data) {
                const hydratedData = rehydrateFirestoreTypes(data);
                return await setDoc(doc(db, collectionName, docId), sanitizeFirestoreData(hydratedData), { merge: true });
            },
            async updateDocument(collectionName, docId, data) {
                const hydratedData = rehydrateFirestoreTypes(data);
                return await updateDoc(doc(db, collectionName, docId), sanitizeFirestoreData(hydratedData));
            },
            async deleteDocument(collectionName, docId) {
                return await deleteDoc(doc(db, collectionName, docId));
            },
            async getUserData(uid, options = {}) {
                return this.getDocument('users', uid, options);
            },
            async createUserData(uid, data) {
                return this.setDocument('users', uid, data);
            },

            // OTIMIZAÇÃO: Carrega apenas dados recentes de clima para cache offline
            listenToRecentClima(companyId, isSuperAdmin = false) {
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                const dateStr = sixMonthsAgo.toISOString().split('T')[0];

                let q;
                if (isSuperAdmin) {
                    q = query(collection(db, 'clima'), where("data", ">=", dateStr));
                } else if (companyId) {
                    q = query(collection(db, 'clima'), where("companyId", "==", companyId), where("data", ">=", dateStr));
                } else {
                    return;
                }

                const unsubscribe = onSnapshot(q, (querySnapshot) => {
                    const data = [];
                    querySnapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
                    App.state.clima = data;
                    // Notifica UI se necessário, mas o Dashboard usa API preferencialmente
                }, (error) => {
                    console.error("Erro ao ouvir dados recentes de clima: ", error);
                });
                App.state.unsubscribeListeners.push(unsubscribe);
            },

            // OTIMIZAÇÃO: Carrega apenas viagens ativas e histórico recente (últimos 30 dias)
            listenToActiveTrips(companyId) {
                if (!companyId) return;

                // 1. Viagens em Deslocamento (Prioridade)
                const qActive = query(
                    collection(db, 'controleFrota'),
                    where("companyId", "==", companyId),
                    where("status", "==", "EM_DESLOCAMENTO")
                );

                const unsubscribeActive = onSnapshot(qActive, (querySnapshot) => {
                    const activeTrips = [];
                    querySnapshot.forEach((doc) => activeTrips.push({ id: doc.id, ...doc.data() }));

                    App.state.activeTrips = activeTrips;
                    if (App.fleet?.ingestRemoteTrips) {
                        App.fleet.ingestRemoteTrips(activeTrips, []);
                    }
                    App.ui.renderSpecificContent('controleFrota');
                }, (error) => console.error("Erro ao ouvir viagens ativas: ", error));
                App.state.unsubscribeListeners.push(unsubscribeActive);

                // 2. Histórico Recente (Últimos 7 dias para evitar sobrecarga)
                // Usando orderBy para garantir que pegamos os mais recentes
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const dateStr = sevenDaysAgo.toISOString();

                const qHistory = query(
                    collection(db, 'controleFrota'),
                    where("companyId", "==", companyId),
                    where("status", "==", "FINALIZADO"),
                    where("dataSaida", ">=", dateStr),
                    orderBy("dataSaida", "desc")
                );

                const unsubscribeHistory = onSnapshot(qHistory, (querySnapshot) => {
                    const recentHistory = [];
                    querySnapshot.forEach((doc) => recentHistory.push({ id: doc.id, ...doc.data() }));

                    App.state.historyTrips = recentHistory;
                    if (App.fleet?.ingestRemoteTrips) {
                        App.fleet.ingestRemoteTrips([], recentHistory);
                    }
                    App.ui.renderSpecificContent('controleFrota');
                }, (error) => console.error("Erro ao ouvir histórico recente de frota: ", error));
                App.state.unsubscribeListeners.push(unsubscribeHistory);
            }
        },
        
        ui: {
            setMapTransparencyMode(isActive) {
                document.body.classList.toggle('map-active', isActive);
                document.documentElement.classList.toggle('map-active', isActive);
                document.getElementById('appScreen')?.classList.toggle('map-active', isActive);
            },
            _getThemeColors() {
                const styles = getComputedStyle(document.documentElement);
                return {
                    primary: styles.getPropertyValue('--color-primary').trim(),
                    primaryLight: styles.getPropertyValue('--color-primary-light').trim(),
                    text: styles.getPropertyValue('--color-text').trim(),
                    border: styles.getPropertyValue('--color-border').trim(),
                };
            },
            setLoading(isLoading, progressText = "A processar...") {
                App.elements.loadingOverlay.style.display = isLoading ? 'flex' : 'none';
                App.elements.loadingProgressText.textContent = progressText;
            },
            showLoginScreen(options = {}) {
                App.elements.loginForm.style.display = 'block';
                App.elements.loginScreen.style.display = 'flex';
                App.elements.appScreen.style.display = 'none';
                
                if (App.elements.userMenu && App.elements.userMenu.container) {
                    App.elements.userMenu.container.style.display = 'none';
                }
                if (App.elements.notificationBell && App.elements.notificationBell.container) {
                    App.elements.notificationBell.container.style.display = 'none';
                }

                App.elements.loginUser.value = '';
                App.elements.loginPass.value = '';
                App.elements.loginUser.focus();
                this.closeAllMenus();
                App.ui.setLoading(false);
                App.state.loginUiRenderedAt = nowIso();
                App.auth._clearLoginWatchdog();
                logBootStage('LOGIN:UI:rendered', { ...options, isOnline: navigator.onLine });
                App.ui.updateConnectivityStatus();
            },
            showOfflineUserSelection() {
                this.showLoginScreen({ reason: 'offline-selection-removed' });
            },
            showAppScreen() {
                const { currentUser } = App.state;
                App.auth._clearLoginWatchdog();
                App.state.loginUiRenderedAt = nowIso();
                App.ui.setLoading(false);
                App.elements.loginScreen.style.display = 'none';
                App.elements.appScreen.style.display = 'flex';
                App.elements.userMenu.container.style.display = 'block';
                App.elements.notificationBell.container.style.display = 'block';
                App.elements.userMenu.username.textContent = currentUser.username || currentUser.email;
                App.ui.updateConnectivityStatus();
                logBootStage('UI: ready', { screen: 'app' });

                // ALTERAÇÃO PONTO 3: Alterar título do cabeçalho
                App.elements.headerTitle.innerHTML = `<i class="fas fa-leaf"></i> AgroVetor`;

                this.updateDateTime();
                setInterval(() => this.updateDateTime(), 60000);

                // Adiciona verificação periódica para o status das armadilhas
                setInterval(() => {
                    if (App.state.armadilhas.length > 0) {
                        App.mapModule.checkTrapStatusAndNotify();
                    }
                }, 60000); // Verifica a cada minuto

                this.renderMenu();
                this.renderAllDynamicContent();
                App.actions.resetInactivityTimer();
                App.actions.loadNotificationHistory(); // Carrega o histórico de notificações

                App.actions.startGpsTracking(); // O rastreamento agora é manual
                App.actions.startAutoSync(); // Inicia a sincronização automática
            },
            renderSpecificContent(collectionName) {
                const activeTab = document.querySelector('.tab-content.active')?.id;

                switch (collectionName) {
                    case 'companies':
                        if (activeTab === 'gerenciarEmpresas') {
                            this.renderCompaniesList();
                        }
                        break;
                    case 'users':
                        this.populateUserSelects([App.elements.planejamento.responsavel]);
                        if (activeTab === 'gerenciarUsuarios') {
                            this.renderUsersList();
                        }
                        if (App.elements.historyFilterModal.overlay.classList.contains('show')) {
                             this.populateUserSelects([App.elements.historyFilterModal.userSelect]);
                        }
                        break;
                    case 'fazendas':
                        this.populateFazendaSelects();
                        if (activeTab === 'cadastros') {
                            this.renderFarmSelect();
                        }
                        break;
                    case 'personnel':
                        this.populateOperatorSelects();
                        if (activeTab === 'cadastrarPessoas') {
                            this.renderPersonnelList();
                        }
                        break;
                    case 'frentesDePlantio':
                        if (activeTab === 'frenteDePlantio') {
                            this.renderFrenteDePlantioList();
                        }
                        this.populateFrenteDePlantioSelect();
                        this.populateQualidadePrestadorSelects();
                        break;
                    case 'apontamentosPlantio':
                        // This collection is for storing data, no direct render action needed on snapshot
                        break;
                    case 'planos':
                        if (activeTab === 'planejamento') {
                            this.renderPlanejamento();
                        }
                        break;
                    case 'harvestPlans':
                        this.populateHarvestPlanSelect();
                        if (activeTab === 'planejamentoColheita') {
                            this.showHarvestPlanList();
                        }
                        break;
                    case 'estimativasSafra':
                        if (activeTab === 'estimativaSafra' && App.estimativaSafra?.refresh) {
                            App.estimativaSafra.refresh();
                        }
                        break;
                    case 'qualidadePlantio':
                        App.actions.cacheQualidadePlantioEntries();
                        if (activeTab === 'relatorioQualidadePlantio') {
                            App.reports.resetQualidadePlantioReport();
                        }
                        break;
                    case 'frota':
                        if (activeTab === 'gestaoFrota') {
                            App.fleet.renderFleetList();
                        }
                        this.populatePlantioFrotaSelect();
                        break;
                    case 'controleFrota':
                        if (activeTab === 'controleKM') {
                            App.fleet.renderActiveTrips();
                            App.fleet.renderHistory();
                        }
                        break;
                    case 'registros':
                        if (activeTab === 'dashboard' && document.getElementById('dashboard-broca').style.display !== 'none') {
                            _perfDebounce('snap_chart_broca', () => App.charts.renderBrocaDashboardCharts(), 250);
                        }
                        if (activeTab === 'excluirDados') {
                            this.renderExclusao();
                        }
                        break;
                    case 'perdas':
                        if (activeTab === 'dashboard' && document.getElementById('dashboard-perda').style.display !== 'none') {
                            _perfDebounce('snap_chart_perda', () => App.charts.renderPerdaDashboardCharts(), 250);
                        }
                        if (activeTab === 'excluirDados') {
                            this.renderExclusao();
                        }
                        break;
                    // No specific actions needed for 'cigarrinha' or 'armadilhas' on snapshot,
                    // as their primary UIs are user-triggered or handled elsewhere.
                }
            },

            renderAllDynamicContent() {
                const renderWithCatch = (name, fn) => {
                    try {
                        fn();
                    } catch (error) {
                        console.error(`Error rendering component: ${name}`, error);
                        // Optionally, display a message to the user in the specific component's area
                    }
                };

                renderWithCatch('populateFazendaSelects', () => this.populateFazendaSelects());
                renderWithCatch('populateUserSelects', () => this.populateUserSelects([App.elements.planejamento.responsavel]));
                renderWithCatch('populateOperatorSelects', () => this.populateOperatorSelects());
                renderWithCatch('populateQualidadePrestadorSelects', () => this.populateQualidadePrestadorSelects());
                renderWithCatch('updateQualidadeIndicatorOptions', () => this.updateQualidadeIndicatorOptions());
                renderWithCatch('renderQualidadeSubamostras', () => this.renderQualidadeSubamostras());
                renderWithCatch('renderQualidadeContext', () => this.renderQualidadeContext());
                renderWithCatch('updateQualidadeReportIndicators', () => this.updateQualidadeReportIndicators());
                renderWithCatch('renderUsersList', () => this.renderUsersList());
                renderWithCatch('renderPersonnelList', () => this.renderPersonnelList());
                renderWithCatch('renderFrenteDePlantioList', () => this.renderFrenteDePlantioList());
                renderWithCatch('populateFrenteDePlantioSelect', () => this.populateFrenteDePlantioSelect());
                renderWithCatch('populatePlantioFrotaSelect', () => this.populatePlantioFrotaSelect());
                renderWithCatch('renderLogoPreview', () => this.renderLogoPreview());
                renderWithCatch('renderPlanejamento', () => this.renderPlanejamento());
                renderWithCatch('showHarvestPlanList', () => this.showHarvestPlanList());
                renderWithCatch('populateHarvestPlanSelect', () => this.populateHarvestPlanSelect());

                renderWithCatch('dashboard-view', () => {
                    if (document.getElementById('dashboard').classList.contains('active')) {
                        this.showDashboardView('broca');
                    }
                });
            },
            showLoginMessage(message) { App.elements.loginMessage.textContent = message; },
            showAlert(message, type = 'success', duration = 3000) {
                const alertContainer = App.elements.alertContainer;
                if (alertContainer) {
                    alertContainer.innerHTML = `
                        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' || type === 'critical_error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
                        <span>${message}</span>
                    `;
                    alertContainer.className = '';
                    alertContainer.classList.add(type === 'error' || type === 'critical_error' ? 'error' : type);
                    alertContainer.classList.add('show');

                    if (this.alertTimeout) clearTimeout(this.alertTimeout);
                    this.alertTimeout = setTimeout(() => {
                        alertContainer.classList.remove('show');
                    }, duration);
                }

                // Removed showSystemNotification from here to prevent duplicate notifications
                // const title = type.charAt(0).toUpperCase() + type.slice(1);
                // this.showSystemNotification(title, message, type);
            },
            updateConnectivityStatus() {
                const badge = App.elements.connectionStatusBadge;
                const textEl = App.elements.connectionStatusText;
                if (!badge || !textEl) return;

                if (!App.state.isAuthenticated) {
                    badge.style.display = 'none';
                    this.hideReauthBanner();
                    if (!navigator.onLine && App.elements.loginMessage && App.elements.loginScreen.style.display === 'flex') {
                        App.elements.loginMessage.textContent = 'OFFLINE: o login continua disponível para credenciais já sincronizadas.';
                    }
                    return;
                }

                badge.style.display = 'flex';

                let status = 'offline';
                let label = 'Offline';

                if (App.state.syncStatus === 'syncing') {
                    status = 'syncing';
                    label = 'Sincronizando';
                } else if (App.state.isOnline && App.state.requiresReauthForSync) {
                    status = 'reauth';
                    label = 'Reautenticar para sincronizar';
                } else if (App.state.isOnline) {
                    status = 'online';
                    label = 'Online';
                }

                badge.dataset.status = status;
                textEl.textContent = label;

                if (App.state.isOnline && App.state.requiresReauthForSync && !App.state.reauthDeferred) {
                    this.showReauthBanner();
                } else if (!App.state.requiresReauthForSync || !App.state.isOnline) {
                    this.hideReauthBanner();
                }
            },
            showReauthBanner() {
                if (App.elements.reauthBanner) {
                    App.elements.reauthBanner.classList.add('show');
                }
            },
            hideReauthBanner() {
                if (App.elements.reauthBanner) {
                    App.elements.reauthBanner.classList.remove('show');
                }
            },
            showReauthModal() {
                if (App.elements.reauthModal?.overlay) {
                    App.elements.reauthModal.overlay.classList.add('show');
                    App.elements.reauthModal.passwordInput?.focus();
                }
            },
            closeReauthModal() {
                if (App.elements.reauthModal?.overlay) {
                    App.elements.reauthModal.overlay.classList.remove('show');
                }
            },

            showSystemNotification(title, message, type = 'info', options = {}) {
                const { list, count, noNotifications } = App.elements.notificationBell;
                const { logId = null } = options;

                const newNotification = {
                    title: title,
                    type: type,
                    message: message,
                    timestamp: new Date(),
                    logId: logId // Adiciona o ID do log, se disponível
                };

                // Adiciona a nova notificação ao início da lista
                App.state.trapNotifications.unshift(newNotification);
                App.state.unreadNotificationCount++;

                this.updateNotificationBell();
                App.actions.saveNotification(newNotification); // Salva a notificação completa

                // Show floating notification
                this.showFloatingNotification(newNotification);
            },
            showFloatingNotification(notification) {
                const container = App.elements.notificationContainer;
                if (!container) return;

                // Limit the number of notifications on screen to 3
                while (container.children.length >= 3) {
                    container.removeChild(container.firstChild);
                }

                const notificationEl = document.createElement('div');

                // Map system notification types to CSS classes used by trap-notification
                let cssTypeClass = 'info';
                if (notification.type === 'error' || notification.type === 'critical_error') cssTypeClass = 'danger';
                if (notification.type === 'warning') cssTypeClass = 'warning';
                if (notification.type === 'success') cssTypeClass = 'success';

                notificationEl.className = `trap-notification ${cssTypeClass}`;
                if (notification.logId) notificationEl.dataset.logId = notification.logId;
                if (notification.trapId) notificationEl.dataset.trapId = notification.trapId;

                let iconClass = 'fa-info-circle';
                if (cssTypeClass === 'danger') iconClass = 'fa-times-circle';
                if (cssTypeClass === 'warning') iconClass = 'fa-exclamation-triangle';
                if (cssTypeClass === 'success') iconClass = 'fa-check-circle';

                notificationEl.innerHTML = `
                    <div class="icon" style="margin-right: 15px;"><i class="fas ${iconClass}"></i></div>
                    <div class="text" style="flex: 1;">
                        <p><strong>${notification.title || 'Notificação'}</strong></p>
                        <p>${notification.message}</p>
                    </div>
                    <button class="close-btn" style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--color-text-light); margin-left: 10px;">&times;</button>
                `;

                container.appendChild(notificationEl);

                let isDismissing = false;
                const dismiss = (direction = 'right') => {
                    if (isDismissing) return;
                    isDismissing = true;

                    const animationName = direction === 'left' ? 'slideOutLeft' : 'slideOutRight';
                    notificationEl.style.animation = `${animationName} 0.3s ease-out forwards`;

                    notificationEl.addEventListener('animationend', () => {
                        if (notificationEl.parentNode) {
                            notificationEl.remove();
                        }
                    });
                };

                // Auto dismiss after 5 seconds
                const autoDismissTimeout = setTimeout(() => dismiss('right'), 5000);

                // Click on X to close
                const closeBtn = notificationEl.querySelector('.close-btn');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => {
                        clearTimeout(autoDismissTimeout);
                        dismiss('right');
                    });
                }

                // Swipe to close
                let touchStartX = 0;
                let touchEndX = 0;

                notificationEl.addEventListener('touchstart', (event) => {
                    touchStartX = event.changedTouches[0].clientX;
                }, { passive: true });

                notificationEl.addEventListener('touchend', (event) => {
                    touchEndX = event.changedTouches[0].clientX;
                    handleSwipe();
                }, { passive: true });

                const handleSwipe = () => {
                    const threshold = 30; // pixels
                    if (touchEndX < touchStartX - threshold) { // Swipe left
                        clearTimeout(autoDismissTimeout);
                        dismiss('left');
                    } else if (touchEndX > touchStartX + threshold) { // Swipe right
                        clearTimeout(autoDismissTimeout);
                        dismiss('right');
                    }
                };
            },
            updateDateTime() { App.elements.currentDateTime.innerHTML = `<i class="fas fa-clock"></i> ${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`; },
            renderFallbackMenu() {
                const { menu } = App.elements;
                if (!menu) return;
                menu.innerHTML = '';
                const menuContent = document.createElement('div');
                menuContent.className = 'menu-content';
                menu.appendChild(menuContent);
                const btn = document.createElement('button');
                btn.className = 'menu-item active';
                btn.innerHTML = `<i class="fas fa-tachometer-alt"></i><span>Dashboard</span>`;
                btn.addEventListener('click', () => App.ui.showTab('estimativaSafra'));
                menuContent.appendChild(btn);
                App.state.menuRenderedAt = nowIso();
                App.state.bootStage = 'MENU: rendered';
                App.auth._clearBootWatchdog();
                logBootStage('MENU: rendered', { fallback: true });
            },
            renderMenu() {
                const { menu } = App.elements; const { menuConfig } = App.config; const { currentUser } = App.state;
                if (!App.state.isAuthenticated || !currentUser) {
                    menu.innerHTML = '';
                    return;
                }
                menu.innerHTML = '';
                const menuContent = document.createElement('div');
                menuContent.className = 'menu-content';
                menu.appendChild(menuContent);

                const createMenuItem = (item) => {
                    const { currentUser, companies } = App.state;
                    const isSuperAdmin = currentUser.role === 'super-admin';

                    const hasPermission = isSuperAdmin || (item.submenu ?
                        item.submenu.some(sub => currentUser.permissions && currentUser.permissions[sub.permission]) :
                        (currentUser.permissions && currentUser.permissions[item.permission]));

                    if (!hasPermission) return null;

                    if (!isSuperAdmin) {
                        const userCompany = companies.find(c => c.id === currentUser.companyId);
                        const fallbackModules = App.state.cachedSubscribedModules?.length ? App.state.cachedSubscribedModules : ['estimativaSafra'];
                        const subscribedModules = new Set(userCompany?.subscribedModules || fallbackModules);

                        const isVisible = item.submenu ?
                            item.submenu.some(sub => App.isFeatureGloballyActive(sub.permission) && subscribedModules.has(sub.permission)) :
                            (App.isFeatureGloballyActive(item.permission) && subscribedModules.has(item.permission));

                        if (!isVisible) return null;
                    }
                    
                    const btn = document.createElement('button');
                    btn.className = 'menu-btn';
                    btn.innerHTML = `<i class="${item.icon}"></i> <span>${item.label}</span>`;

                    if (isSuperAdmin) {
                        const isAnySubItemHidden = item.submenu && item.submenu.some(sub => !App.isFeatureGloballyActive(sub.permission));
                        const isDirectItemHidden = !item.submenu && item.permission && !App.isFeatureGloballyActive(item.permission);

                        if (isAnySubItemHidden || isDirectItemHidden) {
                            btn.classList.add('globally-disabled-feature');
                            btn.innerHTML += '<span class="feature-status-badge">Oculto</span>';
                        }
                    }
                    
                    if (item.submenu) {
                        btn.innerHTML += '<span class="arrow">&rsaquo;</span>';
                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.renderSubmenu(item);
                        });
                    } else {
                        btn.addEventListener('click', () => {
                            this.closeAllMenus();
                            this.showTab(item.target);
                        });
                    }
                    return btn;
                };
                menuConfig.forEach(item => { const menuItem = createMenuItem(item); if (menuItem) menuContent.appendChild(menuItem); });
                App.state.menuRenderedAt = nowIso();
                App.state.bootStage = 'MENU: rendered';
                App.auth._clearBootWatchdog();
                logBootStage('MENU: rendered', { items: menuContent.childElementCount });
            },
            renderSubmenu(parentItem) {
                const { menu } = App.elements;
                let submenuContent = menu.querySelector('.submenu-content');
                if (submenuContent) submenuContent.remove();

                submenuContent = document.createElement('div');
                submenuContent.className = 'submenu-content';

                const backBtn = document.createElement('button');
                backBtn.className = 'submenu-back-btn';
                backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> <span>Voltar</span>';
                backBtn.onclick = () => {
                    submenuContent.classList.remove('active');
                    setTimeout(() => this.renderMenu(), 300);
                };
                submenuContent.appendChild(backBtn);
                
                const { currentUser, companies } = App.state;
                const userCompany = currentUser.role !== 'super-admin' ? companies.find(c => c.id === currentUser.companyId) : null;
                const fallbackModules = App.state.cachedSubscribedModules?.length ? App.state.cachedSubscribedModules : ['estimativaSafra'];
                const subscribedModules = new Set(userCompany?.subscribedModules || fallbackModules);

                parentItem.submenu.forEach(subItem => {
                    const isSuperAdmin = currentUser.role === 'super-admin';
                    const hasPermission = isSuperAdmin || (currentUser.permissions && currentUser.permissions[subItem.permission]);

                    if (!hasPermission) return;

                    const isGloballyActive = App.isFeatureGloballyActive(subItem.permission);
                    const isSubscribed = isSuperAdmin || subscribedModules.has(subItem.permission);

                    if (!isSuperAdmin && (!isGloballyActive || !isSubscribed)) {
                        return; // Não renderiza para utilizadores normais se não estiver globalmente ativo OU não estiver subscrito
                    }

                    const subBtn = document.createElement('button');
                    subBtn.className = 'submenu-btn';
                    subBtn.innerHTML = `<i class="${subItem.icon}"></i> ${subItem.label}`;

                    if (isSuperAdmin && !isGloballyActive) {
                        subBtn.classList.add('globally-disabled-feature');
                        subBtn.innerHTML += '<span class="feature-status-badge">Oculto</span>';
                    }

                    if (!isSubscribed && !isSuperAdmin) {
                        // Este caso não deveria acontecer por causa do filtro acima, mas é uma segurança.
                        subBtn.classList.add('disabled-module');
                        subBtn.title = "Módulo não disponível na sua subscrição.";
                        subBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            App.ui.showAlert("Este módulo não está incluído na subscrição da sua empresa.", "warning", 5000);
                        });
                    } else {
                        subBtn.addEventListener('click', () => {
                            this.closeAllMenus();
                            this.showTab(subItem.target);
                        });
                    }
                    submenuContent.appendChild(subBtn);
                });
                menu.appendChild(submenuContent);
                requestAnimationFrame(() => submenuContent.classList.add('active'));
            },
            closeAllMenus() {
                document.body.classList.remove('mobile-menu-open');
                App.elements.menu.classList.remove('open');
                App.elements.btnToggleMenu.classList.remove('open');
                const activeSubmenu = App.elements.menu.querySelector('.submenu-content.active');
                if(activeSubmenu) activeSubmenu.classList.remove('active');
            },
            populateHarvestPlanSelect() {
                const { select } = App.elements.relatorioColheita;
                const savedValue = select.value;
                // Use DocumentFragment for better performance
                const fragHP = document.createDocumentFragment();
                const defHP = document.createElement('option');
                defHP.value = '';
                defHP.textContent = 'Selecione um plano de colheita...';
                fragHP.appendChild(defHP);
                if (App.state.harvestPlans.length === 0) {
                    const emptyOpt = document.createElement('option');
                    emptyOpt.value = '';
                    emptyOpt.disabled = true;
                    emptyOpt.textContent = 'Nenhum plano salvo encontrado';
                    fragHP.appendChild(emptyOpt);
                } else {
                    App.state.harvestPlans.forEach(plan => {
                        const opt = document.createElement('option');
                        opt.value = plan.id;
                        opt.textContent = plan.frontName;
                        fragHP.appendChild(opt);
                    });
                }
                select.innerHTML = '';
                select.appendChild(fragHP);
                select.value = savedValue;
            },
            showTab(id) {
                perfLogger.start(`showTab:${id}`);

                // Lazy Load Data Requirements
                const tabDataRequirements = {
                    'dashboard': ['registros', 'perdas', 'apontamentosPlantio', 'cigarrinha', 'armadilhas'],
                    'monitoramentoAereo': ['armadilhas'],
                    'estimativaSafra': ['estimativasSafra'],
                    'planejamento': ['planos'],
                    'planejamentoColheita': ['harvestPlans'],
                    'lancamentoBroca': ['registros'],
                    'lancamentoPerda': ['perdas'],
                    'lancamentoCigarrinha': ['cigarrinha'],
                    'lancamentoCigarrinhaAmostragem': ['cigarrinhaAmostragem'],
                    'qualidadePlantio': ['qualidadePlantio'],
                    'apontamentoPlantio': ['apontamentosPlantio', 'frota'],
                    'gestaoFrota': ['frota'],
                    'controleKM': ['controleFrota', 'frota'],
                    'relatorioBroca': ['registros'],
                    'relatorioPerda': ['perdas'],
                    'relatorioCigarrinha': ['cigarrinha'],
                    'relatorioCigarrinhaAmostragem': ['cigarrinhaAmostragem'],
                    'relatorioQualidadePlantio': ['qualidadePlantio'],
                    'relatorioMonitoramento': ['armadilhas'],
                    'relatorioPlantio': ['apontamentosPlantio', 'frentesDePlantio'],
                    'frenteDePlantio': ['frentesDePlantio']
                };

                if (tabDataRequirements[id]) {
                    tabDataRequirements[id].forEach(col => App.data.subscribeTo(col));
                }

                const { currentUser, companies } = App.state;

                // Encontrar o item de menu correspondente para obter a permissão necessária
                let requiredPermission = null;
                App.config.menuConfig.forEach(item => {
                    if (item.target === id) {
                        requiredPermission = item.permission;
                    } else if (item.submenu) {
                        const subItem = item.submenu.find(sub => sub.target === id);
                        if (subItem) {
                            requiredPermission = subItem.permission;
                        }
                    }
                });

                // LÓGICA DE BLOQUEIO REFINADA
                if (requiredPermission && currentUser.role !== 'super-admin' && !App.state.isImpersonating) {
                    const isGloballyActive = App.isFeatureGloballyActive(requiredPermission);
                    if (!isGloballyActive) {
                        App.ui.showAlert("Esta funcionalidade não está ativa no momento.", "info", 5000);
                        return; // Bloqueia a navegação
                    }

                    const userCompany = companies.find(c => c.id === currentUser.companyId);
                    const fallbackModules = App.state.cachedSubscribedModules?.length ? App.state.cachedSubscribedModules : ['estimativaSafra'];
                    const subscribedModules = new Set(userCompany?.subscribedModules || fallbackModules);
                    if (!subscribedModules.has(requiredPermission)) {
                        App.ui.showAlert("Este módulo não está incluído na subscrição da sua empresa.", "warning", 5000);
                        return; // Bloqueia a navegação
                    }
                }


                const currentActiveTab = document.querySelector('.tab-content.active');
                if (currentActiveTab && currentActiveTab.id === 'apontamentoPlantio' && App.state.apontamentoPlantioFormIsDirty && id !== 'apontamentoPlantio') {
                    App.ui.showConfirmationModal(
                        "Você tem alterações não salvas. Deseja descartá-las e sair?",
                        () => { // onConfirm: Discard and Leave
                            App.state.apontamentoPlantioFormIsDirty = false;
                            App.ui.showTab(id); // Re-trigger the navigation now that the flag is clean
                        }
                    );
                    // Customize modal buttons for this specific confirmation
                    const { confirmBtn, cancelBtn } = App.elements.confirmationModal;
                    confirmBtn.textContent = 'Descartar e Sair';
                    cancelBtn.textContent = 'Continuar Editando';
                    cancelBtn.style.display = 'inline-flex';

                    return; // Stop the current navigation attempt
                }

                if (currentActiveTab && currentActiveTab.id !== id) { // Check if we are actually switching tabs
                    if (currentActiveTab.id === 'lancamentoCigarrinha') {
                        App.ui.clearForm(App.elements.cigarrinha.form);
                    }
                    if (currentActiveTab.id === 'lancamentoCigarrinhaAmostragem') {
                        const amostragemEls = App.elements.cigarrinhaAmostragem;
                        App.ui.clearForm(amostragemEls.form);
                        if (amostragemEls.amostrasContainer) {
                            amostragemEls.amostrasContainer.innerHTML = '';
                        }
                        if (amostragemEls.resultado) {
                            amostragemEls.resultado.textContent = '';
                        }
                    }
                    // Limpa o formulário de apontamento de plantio ao sair da aba
                    if (currentActiveTab.id === 'apontamentoPlantio') {
                        const els = App.elements.apontamentoPlantio;
                        App.ui.clearForm(els.form);
                        if (els.recordsContainer) els.recordsContainer.innerHTML = '';
                        if (els.totalArea) els.totalArea.textContent = 'Total de Área Plantada: 0,00 ha';
                        if (els.leaderName) els.leaderName.textContent = '';
                        if (els.entryId) els.entryId.value = ''; // Garante que sai do modo de edição
                        App.ui.setDefaultDatesForEntryForms();
                        App.state.apontamentoPlantioFormIsDirty = false;
                    }
                    if (currentActiveTab.id === 'controleKM') {
                        App.fleet.onHide();
                    }
                    if (currentActiveTab.id === 'qualidadePlantio' && id !== 'qualidadePlantio') {
                        const qualidadeEls = App.elements.qualidadePlantio;
                        const consumoEls = App.elements.qualidadeConsumo;
                        const brocaEls = App.elements.qualidadeBroca;
                        App.actions.resetQualidadeDraft();
                        if (qualidadeEls?.form) {
                            App.ui.clearForm(qualidadeEls.form);
                        }
                        if (consumoEls) {
                            consumoEls.pesoTotal.value = '';
                            consumoEls.metrosLineares.textContent = '';
                            consumoEls.consumoMuda.textContent = '';
                            consumoEls.prestadorTirou.value = '';
                            consumoEls.fazendaOrigem.value = '';
                        }
                        if (brocaEls) {
                            brocaEls.broca.value = '';
                            brocaEls.qtdGemasTotal.value = '';
                            brocaEls.qtdGemasTotal.readOnly = false;
                            brocaEls.percentualBroca.textContent = '';
                        }
                        App.ui.setQualidadeTab('qual');
                        App.ui.renderQualidadeSubamostras();
                        App.ui.renderQualidadeContext();
                    }
                    if (currentActiveTab.id === 'ordemServicoManual' && id !== 'ordemServicoManual') {
                        const els = App.elements.osManual;
                        if (els.farmSelect) els.farmSelect.value = '';
                        if (els.cropSeasonSelect) els.cropSeasonSelect.value = '';
                        if (els.responsibleInput) els.responsibleInput.value = '';
                        if (els.responsibleName) els.responsibleName.value = '';
                        if (els.serviceType) els.serviceType.value = '';
                        if (els.observations) els.observations.value = '';
                        if (els.plotsList) els.plotsList.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--color-text-light);">Selecione uma fazenda para ver os talhões.</p>';
                        if (els.selectedOperationsList) els.selectedOperationsList.innerHTML = '<div style="padding: 10px; color: var(--color-text-light); border: 1px dashed var(--color-border); text-align: center;">Nenhuma operação adicionada.</div>';
                        if (els.totalArea) els.totalArea.textContent = '0.00 ha';
                        App.state.osSelectedOperations = [];
                        App.state.osTotalArea = 0;
                        if (App.state.osMap) {
                            const map = App.state.osMap;
                            if (map.getSource('os-talhoes')) {
                                map.getSource('os-talhoes').setData({ type: 'FeatureCollection', features: [] });
                            }
                        }
                    }

                    if (currentActiveTab.id === 'planejamentoOS' && id !== 'planejamentoOS' && App.osPlanning?.resetPlanningForm) {
                        App.osPlanning.resetPlanningForm();
                    }
                }

                const mapContainer = App.elements.monitoramentoAereo.container;
                if (id === 'monitoramentoAereo') {
                    mapContainer.classList.add('active');
                    if (App.state.useNativeAerialMap) {
                        App.ui.setMapTransparencyMode(true);
                    }

                    if (!App.state.mapboxMap) {
                        // Lazy Init: Initialize map only when tab is opened
                        // setTimeout to ensure DOM is updated and allow UI thread to breathe
                        setTimeout(() => {
                            if (App.mapModule && App.mapModule.initMap) {
                                App.mapModule.initMap();
                            }
                        }, 50);
                    } else {
                        // Força o redimensionamento do mapa para o contêiner visível
                        setTimeout(() => App.state.mapboxMap.resize(), 0);
                    }
                } else {
                    mapContainer.classList.remove('active');
                    App.ui.setMapTransparencyMode(false);
                    if (App.state.useNativeAerialMap && App.state.aerialMapProvider && typeof App.state.aerialMapProvider.closeMap === 'function') {
                        App.state.aerialMapProvider.closeMap();
                    }
                }

                const estimativaContainer = App.elements.estimativaSafra?.container;
                if (id === 'estimativaSafra') {
                    if (estimativaContainer) estimativaContainer.classList.add('active');
                    setTimeout(() => {
                        if (App.estimativaSafra?.init) App.estimativaSafra.init();
                    }, 50);
                } else if (estimativaContainer) {
                    estimativaContainer.classList.remove('active');
                    App.estimativaSafra?.hideInfoBox?.();
                    if (App.state.estimativaSafraMap) {
                        setTimeout(() => App.state.estimativaSafraMap.resize(), 0);
                    }
                }

                document.querySelectorAll('.tab-content').forEach(tab => {
                    if (tab.id !== 'monitoramentoAereo-container') {
                        tab.classList.remove('active');
                        tab.hidden = true;
                    }
                });

                const tab = document.getElementById(id);
                if (tab) {
                    tab.classList.add('active');
                    tab.hidden = false;
                }
                if (id === 'qualidadePlantio') {
                    const draft = App.actions.ensureQualidadeDraft();
                    this.setQualidadeTab(draft.activeTab || 'qual');
                    this.renderQualidadeSubamostras();
                    this.renderQualidadeContext();
                }
                
                if (id === 'dashboard') {
                   this.showDashboardView('broca'); 
                } else {
                    App.charts.destroyAll(); 
                }
                if (id === 'syncHistory') this.renderSyncHistory();
                if (id === 'excluirDados') this.renderExclusao();
                if (id === 'gerenciarUsuarios') {
                    this.renderUsersList();
                    this.renderPermissionItems(App.elements.users.permissionsContainer);
                    if (App.state.currentUser.role === 'super-admin') {
                        const { superAdminUserCreation, adminTargetCompanyUsers } = App.elements.users;
                        superAdminUserCreation.style.display = 'block';
                        adminTargetCompanyUsers.innerHTML = '<option value="">Selecione uma empresa...</option>';
                        App.state.companies.sort((a,b) => a.name.localeCompare(b.name)).forEach(c => {
                            adminTargetCompanyUsers.innerHTML += `<option value="${c.id}">${c.name}</option>`;
                        });
                    } else {
                        const superAdminUserCreationEl = document.getElementById('superAdminUserCreation');
                        if (superAdminUserCreationEl) {
                           superAdminUserCreationEl.style.display = 'none';
                        }
                    }
                }
                 if (id === 'gerenciarEmpresas') {
                    this.renderCompaniesList();
                    this.renderCompanyModules('newCompanyModules');
                    this.renderGlobalFeatures(); // NOVO
                }
                if (id === 'gerenciarAtualizacoes') {
                    this.renderAnnouncementsManager();
                }
                if (id === 'cadastros') {
                    this.renderFarmSelect();
                    if (App.state.currentUser.role === 'super-admin') {
                        const { superAdminFarmCreation, adminTargetCompanyFarms } = App.elements.cadastros;
                        superAdminFarmCreation.style.display = 'block';
                        adminTargetCompanyFarms.innerHTML = '<option value="">Selecione uma empresa...</option>';
                        App.state.companies.sort((a,b) => a.name.localeCompare(b.name)).forEach(c => {
                            adminTargetCompanyFarms.innerHTML += `<option value="${c.id}">${c.name}</option>`;
                        });
                    } else {
                        const superAdminFarmCreationEl = document.getElementById('superAdminFarmCreation');
                        if (superAdminFarmCreationEl) {
                            superAdminFarmCreationEl.style.display = 'none';
                        }
                    }
                }
                if (id === 'cadastrarPessoas') this.renderPersonnelList();
                if (id === 'planejamento') this.renderPlanejamento();
                if (id === 'ordemServicoManual') {
                    App.osManual.init();
                }
                if (id === 'planejamentoOS') {
                    App.osPlanning.init();
                }
                if (id === 'registroAplicacao') {
                    App.regApp.init();
                }
                if (id === 'gestaoFrota') {
                    App.fleet.init();
                    App.fleet.clearFleetForm();
                    App.fleet.renderFleetList();
                }
                if (id === 'controleKM') {
                    App.fleet.init();
                    App.fleet.onShow(); // Ensures clear forms and fresh pagination
                }
                if (id === 'relatorioFrota') {
                    App.fleet.init();
                    App.fleet.populateReportVehicleSelect();
                }
                if (id === 'planejamentoColheita') {
                    this.showHarvestPlanList();
                    if (App.state.currentUser.role === 'super-admin') {
                        const { superAdminHarvestCreation, adminTargetCompanyHarvest } = App.elements.harvest;
                        superAdminHarvestCreation.style.display = 'block';
                        adminTargetCompanyHarvest.innerHTML = '<option value="">Selecione uma empresa...</option>';
                        App.state.companies.sort((a, b) => a.name.localeCompare(b.name)).forEach(c => {
                            adminTargetCompanyHarvest.innerHTML += `<option value="${c.id}">${c.name}</option>`;
                        });
                    } else {
                        const superAdminHarvestCreationEl = document.getElementById('superAdminHarvestCreation');
                        if (superAdminHarvestCreationEl) {
                           superAdminHarvestCreationEl.style.display = 'none';
                        }
                    }
                }
                if (['relatorioBroca', 'relatorioPerda', 'relatorioMonitoramento', 'relatorioCigarrinha', 'relatorioQualidadePlantio'].includes(id)) this.setDefaultDatesForReportForms();
                if (id === 'relatorioColheitaCustom') this.populateHarvestPlanSelect();
                if (id === 'ordemServicoEscritorio' && App.osEscritorio) App.osEscritorio.renderList();
                if (['lancamentoBroca', 'lancamentoPerda', 'lancamentoCigarrinha', 'apontamentoPlantio', 'qualidadePlantio'].includes(id)) this.setDefaultDatesForEntryForms();
                
                localStorage.setItem('agrovetor_lastActiveTab', id);
                this.closeAllMenus();
                perfLogger.end(`showTab:${id}`);
            },

            switchAuxTab(tabId) {
                document.querySelectorAll('.aux-tab-content').forEach(el => el.style.display = 'none');
                const target = document.getElementById(`aux-tab-${tabId}`);
                if (target) target.style.display = 'block';

                document.querySelectorAll('#cadastrosAuxiliares .qualidade-tab').forEach(btn => btn.classList.remove('active'));
                const clickedBtn = document.querySelector(`#cadastrosAuxiliares .qualidade-tab[onclick*="'${tabId}'"]`);
                if(clickedBtn) clickedBtn.classList.add('active');

                if (App.cadastrosAuxiliares) {
                    if (tabId === 'tipos') App.cadastrosAuxiliares.renderTiposServico();
                    if (tabId === 'operacoes') App.cadastrosAuxiliares.renderOperacoes();
                    if (tabId === 'produtos') App.cadastrosAuxiliares.renderProdutos();
                    if (tabId === 'op_prod') {
                        App.cadastrosAuxiliares.renderOpProd();
                        App.cadastrosAuxiliares.populateDropdowns();
                    }
                }
            },

            // ALTERAÇÃO PONTO 4: Nova função para atualizar o sino de notificação
            updateNotificationBell() {
                const { list, count, noNotifications } = App.elements.notificationBell;
                const notifications = App.state.trapNotifications;
                const unreadCount = App.state.unreadNotificationCount;

                list.innerHTML = ''; // Limpa a lista atual

                if (notifications.length === 0) {
                    noNotifications.innerHTML = '<i class="fas fa-bell-slash"></i><p>Nenhuma notificação nova.</p>';
                    noNotifications.style.display = 'flex';
                    list.style.display = 'none';
                } else {
                    noNotifications.style.display = 'none';
                    list.style.display = 'block';

                    notifications.forEach(notif => {
                        const item = document.createElement('div');
                        const timeAgo = this.timeSince(notif.timestamp);

                        let iconClass = 'fa-info-circle';
                        let typeClass = notif.type || 'info';

                        const lowerCaseTitle = (notif.title || '').toLowerCase();
                        if (notif.trapId) {
                            item.dataset.trapId = notif.trapId;
                            iconClass = 'fa-bug';
                        } else if (lowerCaseTitle.includes('sincroniza')) {
                            iconClass = 'fa-sync-alt';
                            if (notif.logId) item.dataset.logId = notif.logId;
                        }

                        const itemTitle = notif.title || (notif.trapId ? 'Armadilha Requer Atenção' : 'Notificação do Sistema');
                        item.className = `notification-item ${typeClass}`;

                        item.innerHTML = `
                            <i class="fas ${iconClass}"></i>
                            <div class="notification-item-content">
                                <p><strong>${itemTitle}</strong></p>
                                <p>${notif.message}</p>
                                <div class="timestamp">${timeAgo}</div>
                            </div>
                        `;
                        list.appendChild(item);
                    });
                }

                if (unreadCount > 0) {
                    count.textContent = unreadCount;
                    count.classList.add('visible');
                } else {
                    count.classList.remove('visible');
                }
            },

            timeSince(date) {
                const seconds = Math.floor((new Date() - date) / 1000);
                let interval = seconds / 31536000;
                if (interval > 1) return Math.floor(interval) + " anos atrás";
                interval = seconds / 2592000;
                if (interval > 1) return Math.floor(interval) + " meses atrás";
                interval = seconds / 86400;
                if (interval > 1) return Math.floor(interval) + " dias atrás";
                interval = seconds / 3600;
                if (interval > 1) return Math.floor(interval) + " horas atrás";
                interval = seconds / 60;
                if (interval > 1) return Math.floor(interval) + " minutos atrás";
                return "Agora mesmo";
            },

            showDashboardView(viewName) {
                const dashEls = App.elements.dashboard;
                // Hide all views first
                dashEls.selector.style.display = 'none';
                dashEls.brocaView.style.display = 'none';
                dashEls.perdaView.style.display = 'none';
                dashEls.aereaView.style.display = 'none';
                dashEls.plantioView.style.display = 'none';
                dashEls.cigarrinhaView.style.display = 'none';
                dashEls.climaView.style.display = 'none';

                App.charts.destroyAll();

                switch (viewName) {
                    case 'selector':
                        dashEls.selector.style.display = 'grid';
                        break;
                    case 'broca':
                        dashEls.brocaView.style.display = 'block';
                        this.loadDashboardDates('broca');
                        _perfDebounce('chart_broca', () => _scheduleRender(() => App.charts.renderBrocaDashboardCharts()), 200);
                        break;
                    case 'perda':
                        dashEls.perdaView.style.display = 'block';
                        this.loadDashboardDates('perda');
                        _perfDebounce('chart_perda', () => _scheduleRender(() => App.charts.renderPerdaDashboardCharts()), 200);
                        break;
                    case 'aerea':
                        dashEls.aereaView.style.display = 'block';
                        this.loadDashboardDates('aereo');
                        _perfDebounce('chart_aerea', () => _scheduleRender(() => App.charts.renderAereoDashboardCharts()), 200);
                        break;
                    case 'plantio':
                        dashEls.plantioView.style.display = 'block';
                        this.loadDashboardDates('plantio');
                        _perfDebounce('chart_plantio', () => _scheduleRender(() => App.charts.renderPlantioDashboardCharts()), 200);
                        break;
                    case 'cigarrinha':
                        dashEls.cigarrinhaView.style.display = 'block';
                        this.loadDashboardDates('cigarrinha');
                        _perfDebounce('chart_cigarrinha', () => _scheduleRender(() => App.charts.renderCigarrinhaDashboardCharts()), 200);
                        break;
                    case 'clima':
                        dashEls.climaView.style.display = 'block';
                        this.loadDashboardDates('clima');
                        _perfDebounce('chart_clima', () => _scheduleRender(() => App.charts.renderClimaDashboardCharts()), 200);
                        break;
                }
            },
            setDefaultDatesForEntryForms() {
                const today = new Date().toISOString().split('T')[0];
                App.elements.broca.data.value = today;
                App.elements.perda.data.value = today;
                App.elements.cigarrinha.data.value = today;
                App.elements.cigarrinhaAmostragem.data.value = today;
                App.elements.apontamentoPlantio.date.value = today;
                if (App.elements.qualidadePlantio && App.elements.qualidadePlantio.data) {
                    App.elements.qualidadePlantio.data.value = today;
                }
                if (App.elements.lancamentoClima && App.elements.lancamentoClima.data) App.elements.lancamentoClima.data.value = today;
                App.elements.broca.data.max = today;
                App.elements.perda.data.max = today;
                App.elements.cigarrinha.data.max = today;
                App.elements.cigarrinhaAmostragem.data.max = today;
                if (App.elements.qualidadePlantio && App.elements.qualidadePlantio.data) {
                    App.elements.qualidadePlantio.data.max = today;
                }
                if (App.elements.lancamentoClima && App.elements.lancamentoClima.data) App.elements.lancamentoClima.data.max = today;
            },
            setDefaultDatesForReportForms() {
                const today = new Date();
                const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                const todayDate = today.toISOString().split('T')[0];

                const reportSections = ['broca', 'perda', 'cigarrinha', 'cigarrinhaAmostragem', 'relatorioMonitoramento', 'relatorioClima', 'relatorioQualidade'];

                reportSections.forEach(section => {
                    const els = App.elements[section];
                    if (els) {
                        const inicioEl = els.filtroInicio || els.inicio;
                        const fimEl = els.filtroFim || els.fim;

                        if (inicioEl) {
                            inicioEl.value = firstDayOfMonth;
                        }
                        if (fimEl) {
                            fimEl.value = todayDate;
                        }
                    }
                });
            },
            setDefaultDatesForDashboard(type) {
                const today = new Date();
                const firstDayOfYear = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
                const todayDate = today.toISOString().split('T')[0];

                if (type === 'broca') {
                    App.elements.dashboard.brocaDashboardInicio.value = firstDayOfYear;
                    App.elements.dashboard.brocaDashboardFim.value = todayDate;
                } else if (type === 'perda') {
                    App.elements.dashboard.perdaDashboardInicio.value = firstDayOfYear;
                    App.elements.dashboard.perdaDashboardFim.value = todayDate;
                } else if (type === 'clima') {
                    document.getElementById('climaDashboardInicio').value = firstDayOfYear;
                    document.getElementById('climaDashboardFim').value = todayDate;
                }
                App.actions.saveDashboardDates(type, firstDayOfYear, todayDate);
            },
            loadDashboardDates(type) {
                const savedDates = App.actions.getDashboardDates(type);
                if (savedDates.start && savedDates.end) {
                    if (type === 'broca') {
                        App.elements.dashboard.brocaDashboardInicio.value = savedDates.start;
                        App.elements.dashboard.brocaDashboardFim.value = savedDates.end;
                    } else if (type === 'perda') {
                        App.elements.dashboard.perdaDashboardInicio.value = savedDates.start;
                        App.elements.dashboard.perdaDashboardFim.value = savedDates.end;
                    } else if (type === 'clima') {
                        document.getElementById('climaDashboardInicio').value = savedDates.start;
                        document.getElementById('climaDashboardFim').value = savedDates.end;
                    }
                } else {
                    this.setDefaultDatesForDashboard(type);
                }
            },
            clearForm(formElement) {
                if (!formElement) return;
                const inputs = formElement.querySelectorAll('input, select, textarea');
                inputs.forEach(input => {
                    if (input.type === 'checkbox' || input.type === 'radio') {
                        input.checked = false;
                    } else if (input.type !== 'date') {
                        input.value = '';
                    }
                });
                formElement.querySelectorAll('.info-display').forEach(el => el.textContent = '');
                formElement.querySelectorAll('.resultado').forEach(el => el.textContent = '');
            },
            updateQualidadeIndicatorOptions() {
                const els = App.elements.qualidadePlantio;
                if (!els.tipoPlantio) return;
                const tipoPlantio = els.tipoPlantio.value;
                const indicadores = tipoPlantio ? App.actions.getQualidadeIndicadores(tipoPlantio) : [];

                if (els.subamostrasList) {
                    els.subamostrasList.querySelectorAll('.qualidade-indicadores-select').forEach(select => {
                        const subamostra = App.actions.getQualidadeSubamostraById(select.dataset.subamostraId);
                        const selected = subamostra?.selectedIndicadores || [];
                        const available = indicadores.filter(indicador => !selected.includes(indicador.code));
                        const options = available
                            .map(indicador => `<option value="${indicador.code}">${indicador.name}</option>`)
                            .join('');
                        select.innerHTML = `<option value="">Adicionar indicador...</option>${options}`;
                        select.disabled = !tipoPlantio || available.length === 0;
                        const addButton = els.subamostrasList.querySelector(`.qualidade-indicador-add[data-subamostra-id="${select.dataset.subamostraId}"]`);
                        if (addButton) {
                            addButton.disabled = !tipoPlantio || available.length === 0;
                        }
                    });
                }

                this.updateQualidadeSubamostraControls();
            },
            updateQualidadeSubamostraControls() {
                const els = App.elements.qualidadePlantio;
                const hasTipoPlantio = Boolean(els.tipoPlantio?.value);
                if (els.btnAddSubamostra) {
                    els.btnAddSubamostra.disabled = !hasTipoPlantio;
                }
                if (els.subamostrasList) {
                    els.subamostrasList.querySelectorAll('.qualidade-indicadores-select').forEach(select => {
                        if (!hasTipoPlantio) {
                            select.disabled = true;
                        }
                    });
                    els.subamostrasList.querySelectorAll('.qualidade-indicador-add').forEach(button => {
                        if (!hasTipoPlantio) {
                            button.disabled = true;
                        }
                    });
                }
            },
            setQualidadeTab(tabKey) {
                const els = App.elements.qualidadePlantio;
                if (!els.tabs || !els.tabPanels) return;
                const draft = App.actions.ensureQualidadeDraft();
                draft.activeTab = tabKey;

                els.tabs.forEach(tab => {
                    const isActive = tab.dataset.qualidadeTab === tabKey;
                    tab.classList.toggle('active', isActive);
                    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
                });
                els.tabPanels.forEach(panel => {
                    panel.classList.toggle('active', panel.dataset.qualidadePanel === tabKey);
                });
                if (tabKey === 'cm' || tabKey === 'bro') {
                    this.renderQualidadeContext();
                }
            },
            renderQualidadeSubamostras() {
                const els = App.elements.qualidadePlantio;
                const draft = App.actions.ensureQualidadeDraft();
                if (!els.subamostrasList) return;
                if (draft.activeSubamostraId && !draft.subamostras.some(item => item.id === draft.activeSubamostraId)) {
                    draft.activeSubamostraId = draft.subamostras[0]?.id || null;
                }
                if (draft.activeSubamostraId) {
                    draft.subamostras.forEach(item => {
                        if (item.id === draft.activeSubamostraId && item.expanded === false) {
                            item.expanded = true;
                        }
                    });
                }
                const tipoPlantio = els.tipoPlantio?.value || '';
                const indicadores = tipoPlantio ? App.actions.getQualidadeIndicadores(tipoPlantio) : [];

                if (draft.subamostras.length === 0) {
                    els.subamostrasList.innerHTML = '';
                    if (els.emptySubamostras) {
                        els.emptySubamostras.hidden = false;
                    }
                    this.updateQualidadeSubamostraControls();
                    return;
                }

                if (els.emptySubamostras) {
                    els.emptySubamostras.hidden = true;
                }

                els.subamostrasList.innerHTML = draft.subamostras
                    .map(subamostra => this.buildQualidadeSubamostraCard(subamostra, indicadores))
                    .join('');
                this.updateQualidadeSubamostraControls();
            },
            buildQualidadeSubamostraCard(subamostra, indicadores) {
                const selectedIndicadores = subamostra.selectedIndicadores || [];
                const availableIndicators = indicadores.filter(indicador => !selectedIndicadores.includes(indicador.code));
                const options = availableIndicators
                    .map(indicador => `<option value="${indicador.code}">${indicador.name}</option>`)
                    .join('');
                const items = selectedIndicadores
                    .map(code => {
                        const indicador = subamostra.indicadores?.[code];
                        if (!indicador) return '';
                        const status = App.actions.getQualidadeIndicadorStatus(indicador);
                        const statusClass = status === 'preenchido' ? 'status-done' : 'status-pending';
                        const isOpen = indicador.expanded ? 'is-open' : '';
                        const bodyContent = this.buildQualidadeIndicadorBody(subamostra, indicador);
                        return `
                            <div class="qualidade-indicador-item ${isOpen}" data-subamostra-id="${subamostra.id}" data-indicador-code="${indicador.code}">
                                <div class="qualidade-indicador-header">
                                    <button class="qualidade-indicador-toggle" type="button" data-subamostra-id="${subamostra.id}" data-indicador-code="${indicador.code}">
                                        <div class="qualidade-indicador-title">${indicador.name}</div>
                                        <span class="qualidade-status ${statusClass}" data-status-indicador>${status === 'preenchido' ? 'Preenchido' : 'Pendente'}</span>
                                        <i class="fas fa-chevron-down"></i>
                                    </button>
                                    <button class="qualidade-indicador-remove" type="button" data-subamostra-id="${subamostra.id}" data-indicador-code="${indicador.code}">
                                        Remover
                                    </button>
                                </div>
                                <div class="qualidade-indicador-body">${bodyContent}</div>
                            </div>
                        `;
                    })
                    .join('');
                const status = App.actions.getQualidadeSubamostraStatus(subamostra);
                const statusClass = status === 'preenchido' ? 'status-done' : 'status-pending';
                const numeroLabel = App.actions.formatQualidadeSubamostraNumero(subamostra.numero);
                const totalIndicadores = selectedIndicadores.length;
                const preenchidos = selectedIndicadores.filter(code => App.actions.getQualidadeIndicadorStatus(subamostra.indicadores?.[code]) === 'preenchido').length;
                const disableControls = !indicadores.length || availableIndicators.length === 0;
                const hintText = availableIndicators.length
                    ? 'Selecione um indicador para adicionar.'
                    : 'Todos os indicadores disponíveis já foram adicionados.';
                const isOpen = subamostra.expanded !== false;

                return `
                    <div class="qualidade-subamostra-card ${isOpen ? 'is-open' : ''}" data-subamostra-id="${subamostra.id}">
                        <div class="qualidade-subamostra-header">
                            <button class="qualidade-subamostra-toggle" type="button" data-subamostra-id="${subamostra.id}">
                                <div class="qualidade-subamostra-title">
                                    Subamostra ${numeroLabel}
                                    <span class="qualidade-subamostra-meta">${preenchidos}/${totalIndicadores || 0} indicadores</span>
                                </div>
                                <span class="qualidade-status ${statusClass}" data-status-subamostra>${status === 'preenchido' ? 'Preenchida' : 'Pendente'}</span>
                                <i class="fas fa-chevron-down"></i>
                            </button>
                            <button class="qualidade-subamostra-remove" type="button" data-subamostra-id="${subamostra.id}">
                                Remover
                            </button>
                        </div>
                        <div class="qualidade-subamostra-body">
                            <div class="form-row qualidade-subamostra-row">
                                <div class="form-col">
                                    <label>Indicadores</label>
                                    <div class="qualidade-indicadores-controls">
                                        <select class="qualidade-indicadores-select" data-subamostra-id="${subamostra.id}" ${disableControls ? 'disabled' : ''}>
                                            <option value="">Adicionar indicador...</option>
                                            ${options}
                                        </select>
                                        <button class="btn-secondary qualidade-indicador-add" type="button" data-subamostra-id="${subamostra.id}" ${disableControls ? 'disabled' : ''}>
                                            <i class="fas fa-plus"></i> Adicionar
                                        </button>
                                    </div>
                                    <div class="qualidade-indicadores-hint">${hintText}</div>
                                </div>
                            </div>
                            <div class="qualidade-indicadores-list">
                                ${items || '<div class="qualidade-empty-state">Nenhum indicador selecionado.</div>'}
                            </div>
                        </div>
                    </div>
                `;
            },
            buildQualidadeIndicadorBody(subamostra, indicador) {
                if (indicador.type === 'valor') {
                    return `
                        <div class="form-row">
                            <div class="form-col">
                                <label class="required">${indicador.label}</label>
                                <input type="number" min="0" step="0.01" data-subamostra-id="${subamostra.id}" data-indicador-code="${indicador.code}" data-field="valor" value="${indicador.valor ?? ''}">
                            </div>
                        </div>
                    `;
                }
                if (indicador.type === 'gemas') {
                    const valorCalculado = indicador.valorCalculado ?? null;
                    return `
                        <div class="form-row">
                            <div class="form-col">
                                <label class="required">${indicador.label}</label>
                                <input type="number" min="0" step="0.01" data-subamostra-id="${subamostra.id}" data-indicador-code="${indicador.code}" data-field="valor" value="${indicador.valor ?? ''}">
                            </div>
                            <div class="form-col">
                                <label>Resultado</label>
                                <div class="info-display" data-field="valorCalculado">${valorCalculado !== null ? Number(valorCalculado).toFixed(2) : ''}</div>
                            </div>
                        </div>
                    `;
                }
                if (indicador.type === 'consumo') {
                    const consumo = indicador.consumo || {};
                    const consumoMuda = consumo.consumoMudaT ?? null;
                    const pesoTotal = consumo.pesoTotal ?? null;
                    return `
                        <div class="qualidade-indicador-summary">
                            <div><strong>Consumo (t):</strong> <span data-field="consumoMudaT">${consumoMuda !== null ? Number(consumoMuda).toFixed(2) : '-'}</span></div>
                            <div><strong>Peso Total:</strong> <span data-field="pesoTotal">${pesoTotal !== null ? Number(pesoTotal).toFixed(2) : '-'}</span></div>
                            <button type="button" class="btn-secondary qualidade-indicador-edit" data-action="edit-consumo" data-subamostra-id="${subamostra.id}" data-indicador-code="${indicador.code}">
                                <i class="fas fa-pen"></i> Editar na aba CM
                            </button>
                        </div>
                    `;
                }
                if (indicador.type === 'broca') {
                    const broca = indicador.broca || {};
                    const percentual = broca.percentualBroca ?? null;
                    const qtdGemas = broca.qtdGemasTotal ?? null;
                    return `
                        <div class="qualidade-indicador-summary">
                            <div><strong>% Broca:</strong> <span data-field="percentualBroca">${percentual !== null ? Number(percentual).toFixed(2) : '-'}</span></div>
                            <div><strong>Qtd. Gemas:</strong> <span data-field="qtdGemasTotal">${qtdGemas !== null ? Number(qtdGemas).toFixed(2) : '-'}</span></div>
                            <button type="button" class="btn-secondary qualidade-indicador-edit" data-action="edit-broca" data-subamostra-id="${subamostra.id}" data-indicador-code="${indicador.code}">
                                <i class="fas fa-pen"></i> Editar na aba BRO
                            </button>
                        </div>
                    `;
                }
                return '';
            },
            updateQualidadeStatusIndicators(subamostraId, indicadorCode) {
                const subamostra = App.actions.getQualidadeSubamostraById(subamostraId);
                if (!subamostra) return;
                const indicador = subamostra.indicadores?.[indicadorCode];
                if (indicador) {
                    const status = App.actions.getQualidadeIndicadorStatus(indicador);
                    const item = document.querySelector(`.qualidade-indicador-item[data-subamostra-id="${subamostraId}"][data-indicador-code="${indicadorCode}"]`);
                    const badge = item?.querySelector('[data-status-indicador]');
                    if (badge) {
                        badge.textContent = status === 'preenchido' ? 'Preenchido' : 'Pendente';
                        badge.classList.toggle('status-done', status === 'preenchido');
                        badge.classList.toggle('status-pending', status !== 'preenchido');
                    }
                    if (item && indicador.type === 'consumo') {
                        const consumo = indicador.consumo || {};
                        const consumoEl = item.querySelector('[data-field="consumoMudaT"]');
                        const pesoEl = item.querySelector('[data-field="pesoTotal"]');
                        if (consumoEl) {
                            consumoEl.textContent = consumo.consumoMudaT !== undefined && consumo.consumoMudaT !== null
                                ? Number(consumo.consumoMudaT).toFixed(2)
                                : '-';
                        }
                        if (pesoEl) {
                            pesoEl.textContent = consumo.pesoTotal !== undefined && consumo.pesoTotal !== null
                                ? Number(consumo.pesoTotal).toFixed(2)
                                : '-';
                        }
                    }
                    if (item && indicador.type === 'gemas') {
                        const resultadoEl = item.querySelector('[data-field="valorCalculado"]');
                        if (resultadoEl) {
                            resultadoEl.textContent = indicador.valorCalculado !== undefined && indicador.valorCalculado !== null
                                ? Number(indicador.valorCalculado).toFixed(2)
                                : '';
                        }
                    }
                    if (item && indicador.type === 'broca') {
                        const broca = indicador.broca || {};
                        const percentualEl = item.querySelector('[data-field="percentualBroca"]');
                        const qtdEl = item.querySelector('[data-field="qtdGemasTotal"]');
                        if (percentualEl) {
                            percentualEl.textContent = broca.percentualBroca !== undefined && broca.percentualBroca !== null
                                ? Number(broca.percentualBroca).toFixed(2)
                                : '-';
                        }
                        if (qtdEl) {
                            qtdEl.textContent = broca.qtdGemasTotal !== undefined && broca.qtdGemasTotal !== null
                                ? Number(broca.qtdGemasTotal).toFixed(2)
                                : '-';
                        }
                    }
                }
                const status = App.actions.getQualidadeSubamostraStatus(subamostra);
                const card = document.querySelector(`.qualidade-subamostra-card[data-subamostra-id="${subamostraId}"]`);
                const subBadge = card?.querySelector('[data-status-subamostra]');
                if (subBadge) {
                    subBadge.textContent = status === 'preenchido' ? 'Preenchida' : 'Pendente';
                    subBadge.classList.toggle('status-done', status === 'preenchido');
                    subBadge.classList.toggle('status-pending', status !== 'preenchido');
                }
            },
            getTalhoesByFazenda(farmId, { onlyActive = true } = {}) {
                const farm = (App.state.fazendas || []).find(f => String(f.id) === String(farmId));
                if (!farm || !Array.isArray(farm.talhoes)) {
                    console.warn('[OfflineCombos]', {
                        collection: 'talhoes',
                        source: navigator.onLine ? 'remote-state' : 'local-state',
                        farmId: farmId || null,
                        reason: farm ? 'fazenda-sem-talhoes' : 'fazenda-nao-encontrada',
                        isOnline: navigator.onLine,
                    });
                    return [];
                }

                const filtered = farm.talhoes.filter(t => {
                    if (!onlyActive) return true;
                    if (typeof t.ativo === 'boolean') return t.ativo;
                    return t.status !== 'inativo';
                });

                console.info('[OfflineCombos]', {
                    collection: 'talhoes',
                    source: navigator.onLine ? 'remote-state' : 'local-state',
                    companyId: App.state.currentUser?.companyId || null,
                    farmId: farmId || null,
                    count: filtered.length,
                    totalFarmTalhoes: farm.talhoes.length,
                    filter: { onlyActive },
                    cachedAt: new Date().toISOString(),
                });

                return filtered;
            },
            resolveFazendaName(farmId) {
                const farm = (App.state.fazendas || []).find(f => String(f.id) === String(farmId));
                if (!farm) return '';
                return [farm.code, farm.name].filter(Boolean).join(' - ');
            },
            resolveTalhaoName(farmId, talhaoId) {
                const talhao = this.getTalhoesByFazenda(farmId, { onlyActive: false }).find(t => String(t.id) === String(talhaoId));
                return talhao?.name || '';
            },
            updateQualidadeTalhaoOptions(selectEl, farmId, includeAll = false, preserveValue = true) {
                if (!selectEl) return;
                const currentValue = preserveValue ? selectEl.value : '';
                const firstOption = includeAll ? '<option value="">Todos</option>' : '<option value="">Selecione...</option>';
                selectEl.innerHTML = firstOption;

                if (farmId) {
                    const getTalhoes = typeof App.actions.getTalhoesByFazenda === 'function'
                        ? App.actions.getTalhoesByFazenda
                        : null;
                    const talhoes = getTalhoes ? (getTalhoes(farmId, { onlyActive: true }) || []) : [];
                    talhoes
                        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                        .forEach(talhao => {
                            selectEl.innerHTML += `<option value="${talhao.id}">${talhao.name}</option>`;
                        });

                    if (!getTalhoes) {
                        console.warn('[OfflineCombos]', {
                            collection: 'talhoes',
                            source: navigator.onLine ? 'remote-state' : 'local-cache',
                            companyId: App.state.currentUser?.companyId || null,
                            farmId,
                            reason: 'missing-actions-getTalhoesByFazenda',
                        });
                    }

                    if (talhoes.length === 0) {
                        console.warn('[OfflineCombos]', {
                            collection: 'talhoes',
                            source: navigator.onLine ? 'remote-state' : 'local-cache',
                            companyId: App.state.currentUser?.companyId || null,
                            farmId,
                            reason: 'empty-after-filter',
                        });
                        App.ui.showAlert('Sem dados de talhões salvos offline para esta fazenda. Conecte-se para atualizar os cadastros.', 'info', 6000);
                    }
                }
                selectEl.value = currentValue;
            },
            updateQualidadeVariedade() {
                const els = App.elements.qualidadePlantio;
                if (!els.fazenda || !els.talhao || !els.variedade) return;
                const talhao = App.actions
                    .getTalhoesByFazenda(els.fazenda.value, { onlyActive: false })
                    .find(t => String(t.id) === String(els.talhao.value));
                const variedade = talhao?.variedade || '';
                const normalizedVariedade = variedade ? variedade.toUpperCase() : '';
                const hasTalhao = Boolean(els.talhao.value);
                els.variedade.value = normalizedVariedade;
                els.variedade.readOnly = Boolean(normalizedVariedade) || !hasTalhao;
                if (!hasTalhao) {
                    els.variedade.placeholder = 'Selecionar fazenda e talhão';
                } else {
                    els.variedade.placeholder = normalizedVariedade ? '' : 'Digite a variedade';
                }
                if (els.variedadeHint) {
                    els.variedadeHint.hidden = Boolean(variedade) || !els.talhao.value;
                }
            },
            updateQualidadeTipoPrestadorFromFrente() {
                const els = App.elements.qualidadePlantio;
                if (!els.frentePlantio || !els.tipoPrestador) return;
                const frenteId = els.frentePlantio.value;
                const frente = App.state.frentesDePlantio.find(item => item.id === frenteId);
                const autoValue = frente?.providerType || '';
                els.tipoPrestador.dataset.autoValue = autoValue;
                els.tipoPrestador.dataset.override = 'false';
                els.tipoPrestador.dataset.manual = 'false';
                els.tipoPrestador.dataset.overrideUpdatedAt = '';
                els.tipoPrestador.dataset.overrideUpdatedBy = '';
                if (autoValue) {
                    els.tipoPrestador.value = autoValue;
                } else {
                    els.tipoPrestador.value = '';
                }
            },
            renderQualidadeContext() {
                const draft = App.actions.ensureQualidadeDraft();
                const els = App.elements.qualidadePlantio;
                const consumoEls = App.elements.qualidadeConsumo;
                const brocaEls = App.elements.qualidadeBroca;
                if (!consumoEls || !brocaEls) return;

                const base = App.actions.buildQualidadeBaseFromForm();
                const subamostra = App.actions.getQualidadeSubamostraById(draft.activeSubamostraId);
                const hasSubamostra = Boolean(subamostra);
                const hasConsumo = hasSubamostra && Boolean(App.actions.getQualidadeConsumoIndicador(subamostra));
                const hasBroca = hasSubamostra && Boolean(App.actions.getQualidadeBrocaIndicador(subamostra));
                const formattedDate = base.data ? App.actions.formatDateForDisplay(base.data) : '-';

                [consumoEls, brocaEls].forEach(target => {
                    target.tipoPlantio.textContent = base.tipoPlantio || '-';
                    target.fazenda.textContent = base.fazendaNome || '-';
                    target.talhao.textContent = base.talhaoNome || '-';
                    target.variedade.textContent = base.variedadeNome || '-';
                    target.data.textContent = formattedDate;
                    if (target.subamostra) {
                        const numeroLabel = subamostra ? App.actions.formatQualidadeSubamostraNumero(subamostra.numero) : '';
                        target.subamostra.textContent = subamostra ? `Subamostra ${numeroLabel}` : '-';
                    }
                });

                this.toggleQualidadeTabInputs(consumoEls, hasConsumo);
                this.toggleQualidadeTabInputs(brocaEls, hasBroca);

                if (consumoEls.emptyState) {
                    consumoEls.emptyState.hidden = hasConsumo;
                }
                if (brocaEls.emptyState) {
                    brocaEls.emptyState.hidden = hasBroca;
                }

                if (hasConsumo) {
                    this.populateQualidadeConsumoFields(subamostra);
                } else {
                    consumoEls.pesoTotal.value = '';
                    consumoEls.metrosLineares.textContent = '';
                    consumoEls.consumoMuda.textContent = '';
                    consumoEls.prestadorTirou.value = '';
                    consumoEls.fazendaOrigem.value = '';
                }

                if (hasBroca) {
                    this.populateQualidadeBrocaFields(subamostra);
                } else {
                    brocaEls.broca.value = '';
                    brocaEls.qtdGemasTotal.value = '';
                    brocaEls.percentualBroca.textContent = '';
                }
            },
            toggleQualidadeTabInputs(target, enabled) {
                if (!target) return;
                const panelKey = target === App.elements.qualidadeConsumo ? 'cm' : 'bro';
                const panel = document.querySelector(`.qualidade-tab-panel[data-qualidade-panel="${panelKey}"]`);
                if (!panel) return;
                panel.querySelectorAll('input, select, textarea').forEach(input => {
                    input.disabled = !enabled;
                });
            },
            populateQualidadeConsumoFields(subamostra) {
                const consumoEls = App.elements.qualidadeConsumo;
                if (!consumoEls || !subamostra) return;
                const indicador = App.actions.getQualidadeConsumoIndicador(subamostra);
                const consumo = indicador?.consumo || {};
                const metrosLineares = consumo.metrosLineares ?? null;
                const consumoMuda = consumo.consumoMudaT ?? null;
                consumoEls.pesoTotal.value = consumo.pesoTotal ?? '';
                consumoEls.metrosLineares.textContent = metrosLineares !== null ? Number(metrosLineares).toFixed(2) : '';
                consumoEls.consumoMuda.textContent = consumoMuda !== null ? Number(consumoMuda).toFixed(2) : '';
                consumoEls.prestadorTirou.value = consumo.prestadorTirouMudaId || '';
                consumoEls.fazendaOrigem.value = consumo.fazendaOrigemMudaId || '';
            },
            populateQualidadeBrocaFields(subamostra) {
                const brocaEls = App.elements.qualidadeBroca;
                if (!brocaEls || !subamostra) return;
                const indicador = App.actions.getQualidadeBrocaIndicador(subamostra);
                const broca = indicador?.broca || {};
                const hasBrocaValue = broca.broca !== null && broca.broca !== undefined && broca.broca !== '';
                const brocaValue = hasBrocaValue ? App.safeParseFloat(broca.broca) : null;

                brocaEls.broca.value = hasBrocaValue ? brocaValue : '';
                brocaEls.qtdGemasTotal.value = broca.qtdGemasTotal ?? '';
                brocaEls.qtdGemasTotal.readOnly = false;
                const resolvedQtdGemas = App.safeParseFloat(brocaEls.qtdGemasTotal.value);
                const percentual = resolvedQtdGemas > 0 ? (brocaValue / resolvedQtdGemas) * 100 : 0;
                brocaEls.percentualBroca.textContent = resolvedQtdGemas > 0 ? percentual.toFixed(2) : '';
                if (indicador) {
                    indicador.broca = {
                        ...broca,
                        broca: hasBrocaValue ? brocaValue : null,
                        qtdGemasTotal: resolvedQtdGemas,
                        percentualBroca: percentual,
                    };
                }
            },
            updateQualidadeReportIndicators() {
                const els = App.elements.relatorioQualidade;
                if (!els.indicador) return;
                const tipoPlantio = els.tipoPlantio ? els.tipoPlantio.value : '';
                const indicadores = App.actions.getQualidadeIndicadores(tipoPlantio, !tipoPlantio);
                const currentValue = els.indicador.value;
                els.indicador.innerHTML = '<option value="">Todos</option>';
                indicadores.forEach(indicador => {
                    els.indicador.innerHTML += `<option value="${indicador.code}">${indicador.name}</option>`;
                });
                const validCodes = new Set(indicadores.map(ind => ind.code));
                els.indicador.value = validCodes.has(currentValue) ? currentValue : '';
            },
            populateFazendaSelects() {
                const selects = [
                    App.elements.broca.filtroFazenda,
                    App.elements.perda.filtroFazenda,
                    App.elements.planejamento.fazenda,
                    App.elements.harvest.fazenda,
                    App.elements.cadastros.farmSelect,
                    App.elements.broca.codigo,
                    App.elements.perda.codigo,
                    App.elements.cigarrinha.codigo,
                    App.elements.cigarrinhaAmostragem.codigo,
                    App.elements.apontamentoPlantio.mudaFazenda,
                    App.elements.relatorioPlantio.fazenda,
                    App.elements.cigarrinha.filtroFazenda,
                    App.elements.cigarrinhaAmostragem.filtroFazenda,
                    App.elements.relatorioMonitoramento.fazendaFiltro,
                    App.elements.apontamentoPlantio.farmName,
                    App.elements.lancamentoClima.fazenda,
                    App.elements.relatorioClima.fazenda,
                    App.elements.qualidadePlantio.fazenda,
                    App.elements.qualidadeConsumo.fazendaOrigem,
                    App.elements.relatorioQualidade.fazenda,
                    App.elements.relatorioQualidade.fazendaOrigem,
                    document.getElementById('climaDashboardFazenda')
                ];

                const unavailableTalhaoIds = App.actions.getUnavailableTalhaoIds();

                selects.forEach(select => {
                    if (!select) return;
                    const currentValue = select.value;
                    let firstOption = '<option value="">Selecione...</option>';
                    if (select.id.includes('Filtro') || ['qualidadeReportFazenda', 'qualidadeReportFazendaOrigem'].includes(select.id)) {
                        firstOption = '<option value="">Todas</option>';
                    }
                    select.innerHTML = firstOption;

                    let farmsToShow = App.state.fazendas;

                    if (select.id === 'harvestFazenda') {
                        const editingGroupId = App.elements.harvest.editingGroupId.value;
                        let farmOfEditedGroup = null;

                        if (editingGroupId && App.state.activeHarvestPlan) {
                            const editedGroup = App.state.activeHarvestPlan.sequence.find(g => g.id == editingGroupId);
                            if (editedGroup) {
                                farmOfEditedGroup = App.state.fazendas.find(f => f.code === editedGroup.fazendaCodigo);
                            }
                        }

                        farmsToShow = App.state.fazendas.filter(farm => {
                            if (farmOfEditedGroup && farm.id === farmOfEditedGroup.id) {
                                return true; // Always show the farm being edited.
                            }
                            if (!farm.talhoes || farm.talhoes.length === 0) {
                                return false;
                            }
                            const hasAvailablePlot = farm.talhoes.some(talhao => !unavailableTalhaoIds.has(talhao.id));
                            return hasAvailablePlot;
                        });
                    }

                    const sortedFarms = farmsToShow.sort((a, b) => parseInt(a.code) - parseInt(b.code));
                    // Use DocumentFragment to avoid layout thrashing from innerHTML +=
                    const frag = document.createDocumentFragment();
                    const tmpSel = document.createElement('select');
                    tmpSel.innerHTML = firstOption;
                    while (tmpSel.firstChild) frag.appendChild(tmpSel.firstChild);
                    sortedFarms.forEach(farm => {
                        const opt = document.createElement('option');
                        opt.value = farm.id;
                        opt.textContent = farm.code + ' - ' + farm.name;
                        frag.appendChild(opt);
                    });
                    select.innerHTML = '';
                    select.appendChild(frag);
                    select.value = currentValue;
                });
            },
            populateUserSelects(selects) {
                if (!selects || selects.length === 0) return;

                selects.forEach(select => {
                    if (!select) return;
                    const currentValue = select.value;
                    // Use DocumentFragment for better performance
                    const activeUsers = App.state.users
                        .filter(u => u.active)
                        .sort((a, b) => (a.username || '').localeCompare(b.username || ''));
                    const frag = document.createDocumentFragment();
                    const defOpt = document.createElement('option');
                    defOpt.value = '';
                    defOpt.textContent = 'Selecione um utilizador...';
                    frag.appendChild(defOpt);
                    activeUsers.forEach(user => {
                        const opt = document.createElement('option');
                        opt.value = user.id;
                        opt.textContent = user.username || user.email;
                        frag.appendChild(opt);
                    });
                    select.innerHTML = '';
                    select.appendChild(frag);
                    select.value = currentValue;
                });
            },
            populateOperatorSelects() {
                const selects = [
                    App.elements.perda.filtroOperador,
                ];
                selects.forEach(select => {
                    if (!select) return;

                    const currentValue = select.value;
                    let firstOptionHTML = '';
                    firstOptionHTML = select.id === 'operadorFiltroPerda'
                        ? '<option value="">Todos</option>'
                        : '<option value="">Selecione um operador...</option>';
                    // Use DocumentFragment for better performance
                    const sortedPersonnel = App.state.personnel.slice().sort((a, b) => a.name.localeCompare(b.name));
                    const frag = document.createDocumentFragment();
                    const tmpS = document.createElement('select');
                    tmpS.innerHTML = firstOptionHTML;
                    while (tmpS.firstChild) frag.appendChild(tmpS.firstChild);
                    sortedPersonnel.forEach(p => {
                        const opt = document.createElement('option');
                        opt.value = p.matricula;
                        opt.textContent = p.matricula + ' - ' + p.name;
                        frag.appendChild(opt);
                    });
                    select.innerHTML = '';
                    select.appendChild(frag);
                    select.value = currentValue;
                });
            },
            populateQualidadePrestadorSelects() {
                const selects = [
                    App.elements.qualidadeConsumo.prestadorTirou,
                    App.elements.relatorioQualidade.prestadorTirou,
                ];
                const providers = Array.from(new Set(
                    App.state.frentesDePlantio
                        .map(frente => (frente.provider || '').trim())
                        .filter(Boolean)
                )).sort((a, b) => a.localeCompare(b));

                selects.forEach(select => {
                    if (!select) return;
                    const currentValue = select.value;
                    const firstOptionHTML = select.id === 'qualidadeReportPrestadorTirou'
                        ? '<option value="">Todos</option>'
                        : '<option value="">Selecione um prestador...</option>';
                    // Use DocumentFragment for better performance
                    const frag = document.createDocumentFragment();
                    const tmpProv = document.createElement('select');
                    tmpProv.innerHTML = firstOptionHTML;
                    while (tmpProv.firstChild) frag.appendChild(tmpProv.firstChild);
                    providers.forEach(provider => {
                        const opt = document.createElement('option');
                        opt.value = provider;
                        opt.textContent = provider;
                        frag.appendChild(opt);
                    });
                    select.innerHTML = '';
                    select.appendChild(frag);
                    select.value = currentValue;
                });
            },
            renderFarmSelect() {
                const { farmSelect } = App.elements.cadastros;
                const currentValue = farmSelect.value;
                farmSelect.innerHTML = '<option value="">Selecione uma fazenda para gerir...</option>';
                App.state.fazendas.sort((a,b) => parseInt(a.code) - parseInt(b.code)).forEach(farm => {
                    farmSelect.innerHTML += `<option value="${farm.id}">${farm.code} - ${farm.name}</option>`;
                });
                farmSelect.value = currentValue;
                if(!currentValue) {
                    App.elements.cadastros.talhaoManagementContainer.style.display = 'none';
                }
            },
            renderTalhaoList(farmId) {
                const { talhaoList, talhaoManagementContainer, selectedFarmName, selectedFarmTypes } = App.elements.cadastros;
                const farm = App.state.fazendas.find(f => f.id === farmId);
                talhaoList.innerHTML = '';
                if (!farm) {
                    talhaoManagementContainer.style.display = 'none';
                    selectedFarmName.innerHTML = '';
                    selectedFarmTypes.innerHTML = '';
                    return;
                }
                talhaoManagementContainer.style.display = 'block';
                
                selectedFarmName.innerHTML = `${farm.code} - ${farm.name}`;
                
                const farmTypesHTML = farm.types && farm.types.length > 0 ? `(${farm.types.join(', ')})` : '';
                selectedFarmTypes.innerHTML = `
                    <span style="font-weight: 500; font-size: 14px; color: var(--color-text-light); margin-left: 10px;">
                        ${farmTypesHTML}
                    </span>
                    <div style="display: inline-flex; gap: 5px; margin-left: 10px;">
                        <button class="btn-excluir" style="background:var(--color-info); margin-left: 0;" data-action="edit-farm" data-id="${farm.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn-excluir" data-action="delete-farm" data-id="${farm.id}"><i class="fas fa-trash"></i></button>
                    </div>
                `;

                if (!farm.talhoes || farm.talhoes.length === 0) {
                    talhaoList.innerHTML = '<p>Nenhum talhão cadastrado para esta fazenda.</p>';
                    return;
                }
                const table = document.createElement('table');
                table.id = 'personnelTable';
                table.className = 'harvestPlanTable';
                table.innerHTML = `<thead><tr><th>Nome</th><th>Área</th><th>TCH</th><th>Produção</th><th>Variedade</th><th>Corte</th><th>Distância</th><th>Última Colheita</th><th>Ações</th></tr></thead><tbody></tbody>`;
                const tbody = table.querySelector('tbody');
                farm.talhoes.sort((a,b) => a.name.localeCompare(b.name)).forEach(talhao => {
                    const row = tbody.insertRow();
                    const dataColheita = App.actions.formatDateForDisplay(talhao.dataUltimaColheita);

                    row.innerHTML = `
                        <td data-label="Nome">${talhao.name}</td>
                        <td data-label="Área">${talhao.area ? talhao.area.toFixed(2) : ''}</td>
                        <td data-label="TCH">${talhao.tch ? talhao.tch.toFixed(2) : ''}</td>
                        <td data-label="Produção">${talhao.producao ? talhao.producao.toFixed(2) : ''}</td>
                        <td data-label="Variedade">${talhao.variedade || ''}</td>
                        <td data-label="Corte">${talhao.corte || ''}</td>
                        <td data-label="Distância">${talhao.distancia ? talhao.distancia.toFixed(2) : ''}</td>
                        <td data-label="Última Colheita">${dataColheita}</td>
                        <td data-label="Ações">
                            <div style="display: flex; justify-content: flex-end; gap: 5px;">
                                <button class="btn-excluir" style="background:var(--color-info)" data-action="edit-talhao" data-id="${talhao.id}"><i class="fas fa-edit"></i></button>
                                <button class="btn-excluir" data-action="delete-talhao" data-id="${talhao.id}"><i class="fas fa-trash"></i></button>
                            </div>
                        </td>
                    `;
                });
                talhaoList.appendChild(table);
            },
            renderHarvestTalhaoSelection(farmId, plotIdsToCheck = []) {
                const { talhaoSelectionList, editingGroupId, selectAllTalhoes } = App.elements.harvest;
                talhaoSelectionList.innerHTML = '';
                selectAllTalhoes.checked = false;
                
                if (!farmId) {
                    talhaoSelectionList.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">Selecione uma fazenda para ver os talhões.</p>';
                    return;
                }
                
                const farm = App.state.fazendas.find(f => f.id === farmId);
                if (!farm || !farm.talhoes || farm.talhoes.length === 0) {
                    talhaoSelectionList.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">Nenhum talhão cadastrado nesta fazenda.</p>';
                    return;
                }
                
                const allUnavailableTalhaoIds = App.actions.getUnavailableTalhaoIds({ editingGroupId: editingGroupId.value });
                const closedTalhaoIds = new Set(App.state.activeHarvestPlan?.closedTalhaoIds || []);
                
                const availableTalhoes = farm.talhoes.filter(t => !allUnavailableTalhaoIds.has(t.id));
        
                const talhoesToShow = [...availableTalhoes];
                if (plotIdsToCheck.length > 0) {
                    const currentlyEditedTalhoes = farm.talhoes.filter(t => plotIdsToCheck.includes(t.id));
                    currentlyEditedTalhoes.forEach(t => {
                        if (!talhoesToShow.some(ts => ts.id === t.id)) {
                            talhoesToShow.push(t);
                        }
                    });
                }
        
                if (talhoesToShow.length === 0) {
                    talhaoSelectionList.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">Todos os talhões desta fazenda já foram alocados ou encerrados.</p>';
                    return;
                }
        
                talhoesToShow.sort((a,b) => a.name.localeCompare(b.name)).forEach(talhao => {
                    const isChecked = plotIdsToCheck.includes(talhao.id);
                    const isClosed = closedTalhaoIds.has(talhao.id);
                    
                    const label = document.createElement('label');
                    label.className = 'talhao-selection-item';
                    if (isClosed) {
                        label.classList.add('talhao-closed');
                    }
                    label.htmlFor = `talhao-select-${talhao.id}`;
            
                    label.innerHTML = `
                        <input type="checkbox" id="talhao-select-${talhao.id}" data-talhao-id="${talhao.id}" ${isChecked ? 'checked' : ''} ${isClosed ? 'disabled' : ''}>
                        <div class="talhao-name">${talhao.name}</div>
                        <div class="talhao-details">
                            <span><i class="fas fa-ruler-combined"></i>Área: ${talhao.area ? talhao.area.toFixed(2) : 0} ha</span>
                            <span><i class="fas fa-weight-hanging"></i>Produção: ${talhao.producao ? talhao.producao.toFixed(2) : 0} ton</span>
                            <span><i class="fas fa-seedling"></i>Variedade: ${talhao.variedade || 'N/A'}</span>
                            <span><i class="fas fa-cut"></i>Corte: ${talhao.corte || 'N/A'}</span>
                        </div>
                        ${isClosed ? '<div class="talhao-closed-overlay">Encerrado</div>' : ''}
                    `;
                    talhaoSelectionList.appendChild(label);
                });
            },
            updatePermissionsForRole(role, containerSelector = '#gerenciarUsuarios .permission-grid') {
                const permissions = App.config.roles[role] || {};
                const container = document.querySelector(containerSelector);
                if (container) {
                    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                        const key = cb.dataset.permission;
                        cb.checked = !!permissions[key];
                    });
                }
            },
            renderCompaniesList() {
                const { list } = App.elements.companyManagement;
                list.innerHTML = '';
                if (App.state.companies.length === 0) {
                    list.innerHTML = '<p>Nenhuma empresa cadastrada.</p>';
                    return;
                }
                const table = document.createElement('table');
                table.id = 'companiesTable';
                table.className = 'harvestPlanTable'; // Reutilizando estilo
                table.innerHTML = `<thead><tr><th>Nome da Empresa</th><th>Status</th><th>Data de Criação</th><th>Ações</th></tr></thead><tbody></tbody>`;
                const tbody = table.querySelector('tbody');

                App.state.companies.sort((a,b) => a.name.localeCompare(b.name)).forEach(c => {
                    const row = tbody.insertRow();
                    const creationDate = c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString('pt-BR') : 'N/A';

                    // Define o status e o estilo do botão
                    const isActive = c.active !== false; // Considera ativo se 'active' for true ou undefined
                    const statusText = isActive ? 'Ativa' : 'Inativa';
                    const statusClass = isActive ? 'status-active' : 'status-inactive';
                    const buttonText = isActive ? 'Desativar' : 'Ativar';
                    const buttonClass = isActive ? 'btn-excluir' : 'btn-ativar'; // Usa 'btn-excluir' para vermelho, 'btn-ativar' para verde
                    const buttonIcon = isActive ? 'fa-ban' : 'fa-check-circle';

                    row.innerHTML = `
                        <td data-label="Nome">${c.name}</td>
                        <td data-label="Status"><span class="status-badge ${statusClass}">${statusText}</span></td>
                        <td data-label="Data de Criação">${creationDate}</td>
                        <td data-label="Ações">
                            <div style="display: flex; justify-content: flex-end; gap: 5px;">
                                <button class="btn-excluir" style="background:var(--color-purple);" data-action="view-as-company" data-id="${c.id}" title="Ver como ${c.name}"><i class="fas fa-eye"></i></button>
                                <button class="btn-excluir" style="background:var(--color-info);" data-action="edit-company" data-id="${c.id}" title="Editar Módulos"><i class="fas fa-edit"></i></button>
                                <button class="${buttonClass}" data-action="toggle-company" data-id="${c.id}" title="${buttonText} Empresa"><i class="fas ${buttonIcon}"></i></button>
                                <button class="btn-excluir-permanente" data-action="delete-company-permanently" data-id="${c.id}" title="Excluir Permanentemente"><i class="fas fa-skull-crossbones"></i></button>
                            </div>
                        </td>
                    `;
                });
                list.appendChild(table);
            },
            _createModernUserCardHTML(user) {
                const getRoleInfo = (role) => {
                    const roles = { 
                        "super-admin": ['Super Admin', 'var(--color-ai)'],
                        admin: ['Administrador', 'var(--color-danger)'], 
                        supervisor: ['Supervisor', 'var(--color-warning)'], 
                        tecnico: ['Técnico', 'var(--color-info)'], 
                        colaborador: ['Colaborador', 'var(--color-purple)'], 
                        user: ['Utilizador', 'var(--color-text-light)'] 
                    };
                    return roles[role] || ['Desconhecido', '#718096'];
                };
        
                const [roleName, roleColor] = getRoleInfo(user.role);
                const avatarLetter = (user.username || user.email).charAt(0).toUpperCase();

                const company = App.state.companies.find(c => c.id === user.companyId);
                const companyName = company ? company.name : null;
                const companyHTML = companyName ? `<span class="user-card-role" style="background-color: var(--color-text-light); margin-left: 8px;"><i class="fas fa-building"></i> ${companyName}</span>` : '';
        
                const buttonsHTML = user.email.toLowerCase() === 'admin@agrovetor.com' ? '' : `
                    <button class="toggle-btn ${user.active ? 'inactive' : 'active'}" data-action="toggle" data-id="${user.id}">
                        ${user.active ? '<i class="fas fa-ban"></i> Desativar' : '<i class="fas fa-check"></i> Ativar'}
                    </button>
                    <button data-action="edit" data-id="${user.id}"><i class="fas fa-edit"></i> Editar</button>
                `;
        
                return `
                    <div class="user-card-redesigned" style="border-left-color: ${roleColor};">
                        <div class="user-card-header">
                            <div class="user-card-info">
                                <div class="user-card-avatar" style="background-color: ${roleColor}20; color: ${roleColor};">${avatarLetter}</div>
                                <div class="user-card-details">
                                    <h4>${user.username || 'N/A'}</h4>
                                    <p>${user.email}</p>
                                </div>
                            </div>
                            <div class="user-card-status ${user.active ? 'active' : 'inactive'}">
                                <i class="fas fa-circle"></i> ${user.active ? 'Ativo' : 'Inativo'}
                            </div>
                        </div>
                        <div>
                            <span class="user-card-role" style="background-color: ${roleColor};">${roleName}</span>
                            ${companyHTML}
                        </div>
                        <div class="user-card-actions">
                            ${buttonsHTML}
                        </div>
                    </div>`;
            },
            async renderSyncHistory() {
                return;
            },
            renderUsersList() { 
                const { list } = App.elements.users; 
                list.innerHTML = App.state.users
                    .sort((a,b) => (a.username || '').localeCompare(b.username || ''))
                    .map((u) => this._createModernUserCardHTML(u))
                    .join(''); 
            },
            renderFrenteDePlantioList() {
                const { list } = App.elements.frenteDePlantio;
                list.innerHTML = '';
                if (App.state.frentesDePlantio.length === 0) {
                    list.innerHTML = '<p>Nenhuma frente de plantio cadastrada.</p>';
                    return;
                }
                const table = document.createElement('table');
                table.id = 'frenteDePlantioTable';
                table.className = 'harvestPlanTable';
                table.innerHTML = `<thead><tr><th>Nome</th><th>Prestador</th><th>Tipo</th><th>Observação</th><th>Ações</th></tr></thead><tbody></tbody>`;
                const tbody = table.querySelector('tbody');
                App.state.frentesDePlantio.sort((a,b) => a.name.localeCompare(b.name)).forEach(f => {
                    const row = tbody.insertRow();
                    row.innerHTML = `
                        <td data-label="Nome">${f.name}</td>
                        <td data-label="Prestador">${f.provider}</td>
                        <td data-label="Tipo">${f.providerType || '-'}</td>
                        <td data-label="Observação">${f.obs || ''}</td>
                        <td data-label="Ações">
                            <div style="display: flex; justify-content: flex-end; gap: 5px;">
                                <button class="btn-excluir" style="background:var(--color-info)" data-action="edit-frente" data-id="${f.id}"><i class="fas fa-edit"></i></button>
                                <button class="btn-excluir" data-action="delete-frente" data-id="${f.id}"><i class="fas fa-trash"></i></button>
                            </div>
                        </td>
                    `;
                });
                list.appendChild(table);
            },

            populateFrenteDePlantioSelect() {
                const selects = [
                    App.elements.apontamentoPlantio.frente,
                    App.elements.relatorioPlantio.frente,
                    App.elements.qualidadePlantio.frentePlantio,
                    App.elements.relatorioQualidade.frentePlantio
                ];
                selects.forEach(select => {
                    if (!select) return;
                    const currentValue = select.value;
                    let firstOption = '<option value="">Selecione...</option>';
                    if (select.id === 'plantioRelatorioFrente') {
                        firstOption = '<option value="">Todas</option>';
                    } else if (select.id === 'qualidadeReportFrentePlantio') {
                        firstOption = '<option value="">Todas</option>';
                    }
                    select.innerHTML = firstOption;
                    App.state.frentesDePlantio.sort((a, b) => a.name.localeCompare(b.name)).forEach(f => {
                        select.innerHTML += `<option value="${f.id}">${f.name}</option>`;
                    });
                    select.value = currentValue;
                    if (select.id === 'qualidadeFrentePlantio') {
                        App.ui.updateQualidadeTipoPrestadorFromFrente();
                    }
                });
            },

            populatePlantioFrotaSelect() {
                const select = App.elements.apontamentoPlantio.frota;
                if (!select) return;
                const currentValue = select.value;
                select.innerHTML = '<option value="">Selecione...</option>';
                (App.state.frota || [])
                    .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true }))
                    .forEach(vehicle => {
                        const label = `${vehicle.codigo || ''} ${vehicle.placa ? `- ${vehicle.placa}` : ''}`.trim();
                        select.innerHTML += `<option value="${vehicle.id}">${label || vehicle.id}</option>`;
                    });
                select.value = currentValue;
            },

            updatePlantioReportOptions() {
                const { cultura, tipo } = App.elements.relatorioPlantio;
                if (!tipo) return;
                const isCana = cultura && cultura.value === 'Cana-de-açúcar';
                const options = isCana
                    ? [
                        { value: 'resumo', label: 'Modelo A — Resumo Comparativo (Origem da muda × Plantio)' },
                        { value: 'talhao', label: 'Modelo B — Detalhamento por Talhão' },
                        { value: 'insumos', label: 'Modelo C — Consumo de Insumos' },
                        { value: 'operacional', label: 'Modelo D — Operacional' }
                    ]
                    : [
                        { value: 'geral', label: 'Relatório Geral' },
                        { value: 'fazenda', label: 'Relatório por Fazenda' },
                        { value: 'talhao_legacy', label: 'Relatório por Talhão' }
                    ];

                const currentValue = tipo.value;
                tipo.innerHTML = options.map(option => `<option value="${option.value}">${option.label}</option>`).join('');
                const optionValues = options.map(option => option.value);
                tipo.value = optionValues.includes(currentValue) ? currentValue : options[0].value;
            },

            addPlantioRecordCard() {
                const container = App.elements.apontamentoPlantio.recordsContainer;
                if (!container) return;

                container.querySelectorAll('.amostra-card:not(.collapsed)').forEach(c => c.classList.add('collapsed'));

                const recordId = Date.now();
                const card = document.createElement('div');
                card.className = 'amostra-card';
                card.dataset.id = recordId;

                const recordCount = container.children.length + 1;

                card.innerHTML = `
                    <div class="amostra-header" style="cursor: pointer;">
                        <i class="fas fa-chevron-down amostra-toggle-icon"></i>
                        <h4>Lançamento ${recordCount}</h4>
                        <button type="button" class="btn-remover-amostra" title="Remover Lançamento">&times;</button>
                    </div>
                    <div class="amostra-body">
                        <div class="form-row">
                            <div class="form-col">
                                <label for="plantioTalhao-${recordId}" class="required">Talhão:</label>
                                <select id="plantioTalhao-${recordId}" class="plantio-record-input plantio-talhao-select" required></select>
                                <div id="plantioTalhaoInfo-${recordId}" class="info-display"></div>
                            </div>
                            <div class="form-col">
                                <label for="plantioVariedade-${recordId}" class="required">Variedade Plantada:</label>
                                <input type="text" id="plantioVariedade-${recordId}" class="plantio-record-input" required style="text-transform:uppercase" oninput="this.value = this.value.toUpperCase()">
                            </div>
                            <div class="form-col">
                                <label for="plantioArea-${recordId}" class="required">Área Plantada (ha):</label>
                                <input type="number" id="plantioArea-${recordId}" class="plantio-record-input plantio-area-input" required>
                            </div>
                            <div class="form-col">
                                <label for="plantioMudaArea-${recordId}">Área de Muda (ha):</label>
                                <input type="number" id="plantioMudaArea-${recordId}" class="plantio-record-input plantio-muda-area-input" step="0.01" placeholder="0.00">
                            </div>
                        </div>
                    </div>
                `;
                container.appendChild(card);
                card.querySelector('select').focus();
                this.calculateTotalPlantedArea();
                this.populateTalhaoSelect(card);
                this.applyPlantioVariedade(card, this.getPlantioVariedadeFromOrigem());

                const talhaoSelect = card.querySelector('.plantio-talhao-select');
                talhaoSelect.addEventListener('change', () => {
                    this.updateTalhaoInfo(card);
                    this.syncPlantioVariedadeFromOrigem();
                });

                const variedadeInput = card.querySelector('input[id^="plantioVariedade-"]');
                if (variedadeInput) {
                    variedadeInput.addEventListener('input', () => {
                        variedadeInput.value = variedadeInput.value.toUpperCase();
                        variedadeInput.dataset.manual = 'true';
                        this.updatePlantioVariedadeOverrideState(variedadeInput);
                    });
                }
            },

            populateTalhaoSelect(card) {
                const farmId = App.elements.apontamentoPlantio.farmName.value;
                const talhaoSelect = card.querySelector('.plantio-talhao-select');
                talhaoSelect.innerHTML = '<option value="">Selecione...</option>';
                if (farmId) {
                    const farm = App.state.fazendas.find(f => f.id === farmId);
                    if (farm && farm.talhoes) {
                        farm.talhoes.forEach(talhao => {
                            talhaoSelect.innerHTML += `<option value="${talhao.id}">${talhao.name}</option>`;
                        });
                    }
                }
            },

            updateAllTalhaoSelects() {
                const recordCards = App.elements.apontamentoPlantio.recordsContainer.querySelectorAll('.amostra-card');
                recordCards.forEach(card => {
                    this.populateTalhaoSelect(card);
                    this.updateTalhaoInfo(card);
                });
                this.syncPlantioVariedadeFromOrigem();
            },

            getPlantioCycleContext() {
                const selectedDate = App.elements.apontamentoPlantio.date?.value;
                const today = new Date();
                const referenceDate = selectedDate ? new Date(`${selectedDate}T00:00:00`) : today;
                const safeReferenceDate = Number.isNaN(referenceDate.getTime()) ? today : referenceDate;
                const referenceYear = safeReferenceDate.getFullYear();
                const currentSafraCandidates = [
                    `${referenceYear}/${referenceYear + 1}`,
                    `${referenceYear - 1}/${referenceYear}`
                ];

                // Fallback obrigatório: quando não houver safra/ano/ciclo, usa o início do ano local atual.
                const startOfReferenceYear = new Date(referenceYear, 0, 1);

                return {
                    referenceYear,
                    currentCycle: String(referenceYear),
                    currentSafraCandidates,
                    startOfReferenceYear,
                };
            },

            isPlantioInCurrentCycle(apontamento, cycleContext) {
                const normalizedCycle = [apontamento.cicloPlantio, apontamento.ciclo_plantio, apontamento.cycleId]
                    .find(value => value !== undefined && value !== null && String(value).trim() !== '');
                if (normalizedCycle !== undefined) {
                    const currentCycle = cycleContext.currentCycle;
                    return currentCycle !== undefined && String(normalizedCycle).trim() === String(currentCycle).trim();
                }

                const safra = [apontamento.safra, apontamento.harvest]
                    .find(value => value !== undefined && value !== null && String(value).trim() !== '');
                if (safra !== undefined) {
                    const safraNormalizada = String(safra).trim();
                    return (cycleContext.currentSafraCandidates || []).includes(safraNormalizada);
                }

                const ano = [apontamento.ano, apontamento.year]
                    .find(value => value !== undefined && value !== null && String(value).trim() !== '');
                if (ano !== undefined) {
                    return Number.parseInt(ano, 10) === cycleContext.referenceYear;
                }

                const entryDate = apontamento.date || apontamento.data || apontamento.dataApontamento || apontamento.data_apontamento;
                if (!entryDate) return false;
                const parsedDate = new Date(entryDate);
                if (Number.isNaN(parsedDate.getTime())) return false;

                return parsedDate >= cycleContext.startOfReferenceYear;
            },

            async updateTalhaoInfo(card) {
                const talhaoId = card.querySelector('.plantio-talhao-select').value;
                const infoDiv = card.querySelector('.info-display');
                const editingEntryId = App.elements.apontamentoPlantio.entryId.value; // Get ID if we are editing

                if (!talhaoId) {
                    infoDiv.textContent = '';
                    return;
                }

                const farmId = App.elements.apontamentoPlantio.farmName.value;
                const farm = App.state.fazendas.find(f => f.id === farmId);
                if (!farm) { // Defensive check
                    infoDiv.textContent = 'Fazenda não encontrada.';
                    return;
                }
                const talhao = farm.talhoes.find(t => t.id == talhaoId);
                if (!talhao) { // Defensive check
                    infoDiv.textContent = 'Talhão não encontrado.';
                    return;
                }


                let plantedAreaByOthers = 0;
                const currentCulture = App.elements.apontamentoPlantio.culture.value;
                const cycleContext = this.getPlantioCycleContext();

                App.state.apontamentosPlantio.forEach(apontamento => {
                    // If we are editing, and this is the entry we are currently editing, skip its records from the sum.
                    if (editingEntryId && apontamento.id === editingEntryId) {
                        return;
                    }

                    // Only count area from the SAME culture
                    if (apontamento.culture !== currentCulture) {
                        return;
                    }

                    // Considera apenas apontamentos do ciclo atual (safra/ano/ciclo/data).
                    if (!this.isPlantioInCurrentCycle(apontamento, cycleContext)) {
                        return;
                    }

                    apontamento.records.forEach(record => {
                        if (record.talhaoId === talhaoId) {
                            plantedAreaByOthers += record.area;
                        }
                    });
                });

                const remainingArea = talhao.area - plantedAreaByOthers;
                infoDiv.textContent = `Área: ${talhao.area.toFixed(2)}ha | Plantado (outros): ${plantedAreaByOthers.toFixed(2)}ha | Restante: ${remainingArea.toFixed(2)}ha`;
                card.querySelector('.plantio-area-input').max = remainingArea;
                this.applyPlantioVariedade(card, this.getPlantioVariedadeFromOrigem());
            },

            calculateTotalPlantedArea() {
                const container = App.elements.apontamentoPlantio.recordsContainer;
                const totalAreaEl = App.elements.apontamentoPlantio.totalArea;
                if (!container || !totalAreaEl) return;

                let totalArea = 0;
                container.querySelectorAll('.plantio-area-input').forEach(input => {
                    totalArea += parseFloat(input.value) || 0;
                });

                totalAreaEl.textContent = `Total de Área Plantada: ${totalArea.toFixed(2).replace('.', ',')} ha`;
                App.state.plantioTotalArea = totalArea;
                this.updatePlantioInsumoSection(totalArea);
                return totalArea;
            },

            getPlantioInsumoCatalog() {
                const catalog = new Set();
                (App.state.apontamentosPlantio || []).forEach(entry => {
                    (entry.insumos || []).forEach(insumo => {
                        if (insumo.produto) {
                            catalog.add(insumo.produto.toUpperCase());
                        }
                    });
                });
                return Array.from(catalog).sort((a, b) => a.localeCompare(b));
            },

            updatePlantioInsumoSection(totalArea = 0) {
                const els = App.elements.apontamentoPlantio;
                if (!els.insumosSection || !els.insumosContainer) return;
                const shouldShow = totalArea > 0 && els.culture.value === 'Cana-de-açúcar';
                els.insumosSection.style.display = shouldShow ? 'block' : 'none';
                if (!shouldShow) return;
                els.insumosContainer.querySelectorAll('.plantio-insumo-row').forEach(row => {
                    this.updatePlantioInsumoTotal(row, totalArea);
                });
            },

            updatePlantioInsumoTotal(row, totalArea) {
                const doseInput = row.querySelector('.plantio-insumo-dose');
                const totalInput = row.querySelector('.plantio-insumo-total');
                if (!doseInput || !totalInput) return;
                const dose = App.safeParseFloat(doseInput.value);
                const total = totalArea * (dose || 0);
                totalInput.value = total > 0 ? total.toFixed(2).replace('.', ',') : '0,00';
            },

            addPlantioInsumoRow(initialData = {}) {
                const els = App.elements.apontamentoPlantio;
                if (!els.insumosContainer) return;
                const row = document.createElement('div');
                row.className = 'plantio-insumo-row';
                row.dataset.id = `insumo_${Date.now()}`;

                row.innerHTML = `
                    <div class="form-row" style="align-items: flex-end;">
                        <div class="form-col">
                            <label class="required">Produto / Insumo:</label>
                            <select class="plantio-insumo-produto" required style="text-transform: uppercase;"></select>
                            <input type="text" class="plantio-insumo-produto-custom" placeholder="Informe o produto" style="display: none; margin-top: 8px; text-transform: uppercase;">
                        </div>
                        <div class="form-col">
                            <label class="required">Dose:</label>
                            <input type="number" class="plantio-insumo-dose" min="0" step="0.01" placeholder="0,00" required>
                        </div>
                        <div class="form-col">
                            <label>Total gasto:</label>
                            <input type="text" class="plantio-insumo-total" readonly>
                        </div>
                        <div class="form-col" style="max-width: 60px;">
                            <button type="button" class="btn-remover-amostra" title="Remover Insumo">&times;</button>
                        </div>
                    </div>
                `;

                const select = row.querySelector('.plantio-insumo-produto');
                const customInput = row.querySelector('.plantio-insumo-produto-custom');
                const doseInput = row.querySelector('.plantio-insumo-dose');
                const catalog = this.getPlantioInsumoCatalog();

                select.innerHTML = '<option value="">Selecione...</option>';
                catalog.forEach(item => {
                    select.innerHTML += `<option value="${item}">${item}</option>`;
                });
                select.innerHTML += '<option value="__custom__">Outro (digitar)</option>';

                select.addEventListener('change', () => {
                    const isCustom = select.value === '__custom__';
                    customInput.style.display = isCustom ? 'block' : 'none';
                    if (!isCustom) {
                        customInput.value = '';
                    }
                });

                customInput.addEventListener('input', () => {
                    customInput.value = customInput.value.toUpperCase();
                });

                doseInput.addEventListener('input', () => {
                    const totalArea = App.state.plantioTotalArea || 0;
                    this.updatePlantioInsumoTotal(row, totalArea);
                });

                row.querySelector('.btn-remover-amostra').addEventListener('click', () => {
                    row.remove();
                });

                if (initialData.produto) {
                    const normalizedProduto = initialData.produto.toUpperCase();
                    if (catalog.includes(normalizedProduto)) {
                        select.value = normalizedProduto;
                    } else {
                        select.value = '__custom__';
                        customInput.style.display = 'block';
                        customInput.value = normalizedProduto;
                    }
                }
                if (initialData.dose != null) {
                    doseInput.value = initialData.dose;
                }

                els.insumosContainer.appendChild(row);
                const totalArea = App.state.plantioTotalArea || this.calculateTotalPlantedArea() || 0;
                this.updatePlantioInsumoTotal(row, totalArea);
                return row;
            },

            getPlantioOrigemTalhaoData() {
                const els = App.elements.apontamentoPlantio;
                const farmId = els.mudaFazenda?.value;
                const talhaoName = els.mudaTalhao?.value;
                if (!farmId || !talhaoName) return null;
                const farm = App.state.fazendas.find(f => f.id === farmId);
                return farm?.talhoes?.find(t => t.name === talhaoName) || null;
            },

            updatePlantioOrigemTalhaoInfo() {
                const els = App.elements.apontamentoPlantio;
                if (!els.mudaTalhaoVariedade || !els.mudaTalhaoArea) return;
                const talhao = this.getPlantioOrigemTalhaoData();
                if (!talhao) {
                    els.mudaTalhaoVariedade.value = '';
                    els.mudaTalhaoArea.value = '';
                    return;
                }
                els.mudaTalhaoVariedade.value = (talhao.variedade || '').toUpperCase();
                els.mudaTalhaoArea.value = talhao.area != null ? talhao.area.toFixed(2).replace('.', ',') : '';
            },

            clearPlantioOrigemTalhaoInfo() {
                const els = App.elements.apontamentoPlantio;
                if (els.mudaTalhaoVariedade) els.mudaTalhaoVariedade.value = '';
                if (els.mudaTalhaoArea) els.mudaTalhaoArea.value = '';
            },

            clearPlantioVariedadeRecords() {
                const cards = App.elements.apontamentoPlantio.recordsContainer.querySelectorAll('.amostra-card');
                cards.forEach(card => {
                    const variedadeInput = card.querySelector('input[id^="plantioVariedade-"]');
                    if (!variedadeInput) return;
                    variedadeInput.value = '';
                    variedadeInput.dataset.autoVariedade = '';
                    variedadeInput.dataset.override = 'false';
                    variedadeInput.dataset.manual = 'false';
                    variedadeInput.classList.remove('plantio-variedade-diferente');
                });
            },

            getPlantioVariedadeFromOrigem() {
                const talhao = this.getPlantioOrigemTalhaoData();
                return talhao?.variedade ? talhao.variedade.toUpperCase() : '';
            },

            syncPlantioVariedadeFromOrigem() {
                const cards = App.elements.apontamentoPlantio.recordsContainer.querySelectorAll('.amostra-card');
                const varieties = new Set();
                const origemVariedade = this.getPlantioVariedadeFromOrigem();
                cards.forEach(card => {
                    this.applyPlantioVariedade(card, origemVariedade);
                    const currentValue = card.querySelector('input[id^="plantioVariedade-"]')?.value;
                    if (currentValue) varieties.add(currentValue);
                });
                if (varieties.size > 1 && !App.state.plantioVariedadeWarningShown) {
                    App.ui.showAlert("Foram encontradas variedades diferentes entre os lançamentos. Verifique se a variedade plantada está correta.", "warning");
                    App.state.plantioVariedadeWarningShown = true;
                }
            },

            applyPlantioVariedade(card, autoVariedade) {
                const variedadeInput = card.querySelector('input[id^="plantioVariedade-"]');
                if (!variedadeInput) return;
                const normalizedAuto = autoVariedade ? autoVariedade.toUpperCase() : '';
                const manual = variedadeInput.dataset.manual === 'true';
                if (!manual) {
                    variedadeInput.value = normalizedAuto;
                    variedadeInput.dataset.autoVariedade = normalizedAuto;
                    variedadeInput.dataset.override = 'false';
                    variedadeInput.dataset.manual = 'false';
                    this.updatePlantioVariedadeOverrideState(variedadeInput);
                    return;
                }
                const auto = variedadeInput.dataset.autoVariedade || '';
                if (normalizedAuto && normalizedAuto !== auto) {
                    variedadeInput.dataset.autoVariedade = normalizedAuto;
                }
                this.updatePlantioVariedadeOverrideState(variedadeInput);
            },

            updatePlantioVariedadeOverrideState(variedadeInput) {
                const autoVariedade = variedadeInput.dataset.autoVariedade || '';
                const currentValue = variedadeInput.value || '';
                const isDifferent = Boolean(autoVariedade) && currentValue && currentValue !== autoVariedade;
                variedadeInput.dataset.override = isDifferent ? 'true' : 'false';
                variedadeInput.classList.toggle('plantio-variedade-diferente', isDifferent);
            },

            updatePlantioTipoFields() {
                const els = App.elements.apontamentoPlantio;
                if (!els.tipoPlantio || !els.mecanizadoFields || !els.manualFields) return;
                const tipo = els.tipoPlantio.value;
                if (tipo === 'Mecanizado') {
                    els.mecanizadoFields.style.display = 'flex';
                    els.manualFields.style.display = 'none';
                    if (els.pessoas) els.pessoas.value = '';
                } else if (tipo === 'Manual') {
                    els.mecanizadoFields.style.display = 'none';
                    els.manualFields.style.display = 'flex';
                    if (els.frota) els.frota.value = '';
                } else {
                    els.mecanizadoFields.style.display = 'none';
                    els.manualFields.style.display = 'none';
                    if (els.frota) els.frota.value = '';
                    if (els.pessoas) els.pessoas.value = '';
                }
            },

            resetPlantioCanaFields() {
                const els = App.elements.apontamentoPlantio;
                if (!els) return;
                els.tipoPlantio.value = '';
                els.os.value = '';
                els.origemMuda.value = '';
                els.mudaFazenda.value = '';
                els.mudaTalhao.innerHTML = '';
                this.clearPlantioOrigemTalhaoInfo();
                this.clearPlantioVariedadeRecords();
                if (els.frota) els.frota.value = '';
                if (els.pessoas) els.pessoas.value = '';
                if (els.insumosContainer) els.insumosContainer.innerHTML = '';
                if (els.insumosSection) els.insumosSection.style.display = 'none';
                App.state.plantioVariedadeWarningShown = false;
                App.state.plantioLegacyMudaArea = null;
                this.updatePlantioTipoFields();
            },

            renderPersonnelList() {
                const { list } = App.elements.personnel;
                list.innerHTML = '';
                if (App.state.personnel.length === 0) {
                    list.innerHTML = '<p>Nenhuma pessoa cadastrada.</p>';
                    return;
                }
                const table = document.createElement('table');
                table.id = 'personnelTable';
                table.className = 'harvestPlanTable';
                table.innerHTML = `<thead><tr><th>Matrícula</th><th>Nome</th><th>Ações</th></tr></thead><tbody></tbody>`;
                const tbody = table.querySelector('tbody');
                App.state.personnel.sort((a,b) => a.name.localeCompare(b.name)).forEach(p => {
                    const row = tbody.insertRow();
                    row.innerHTML = `
                        <td data-label="Matrícula">${p.matricula}</td>
                        <td data-label="Nome">${p.name}</td>
                        <td data-label="Ações">
                            <div style="display: flex; justify-content: flex-end; gap: 5px;">
                                <button class="btn-excluir" style="background:var(--color-info)" data-action="edit-personnel" data-id="${p.id}"><i class="fas fa-edit"></i></button>
                                <button class="btn-excluir" data-action="delete-personnel" data-id="${p.id}"><i class="fas fa-trash"></i></button>
                            </div>
                        </td>
                    `;
                });
                list.appendChild(table);
            },
            renderLogoPreview() {
                const { logoPreview, removeLogoBtn } = App.elements.companyConfig;
                if (App.state.companyLogo) {
                    logoPreview.src = App.state.companyLogo;
                    logoPreview.style.display = 'block';
                    removeLogoBtn.style.display = 'inline-flex';
                } else {
                    logoPreview.style.display = 'none';
                    removeLogoBtn.style.display = 'none';
                }
            },
            renderGerenciamento() {
                const { lista, dataType, startDate, endDate } = App.elements.gerenciamento;
                lista.innerHTML = '';
                let content = '';

                const type = dataType.value;
                const start = startDate.value;
                const end = endDate.value;

                if (type === 'apontamentoPlantio') {
                    let apontamentosFiltrados = App.state.apontamentosPlantio;
                    if (start) {
                        apontamentosFiltrados = apontamentosFiltrados.filter(a => a.date >= start);
                    }
                    if (end) {
                        apontamentosFiltrados = apontamentosFiltrados.filter(a => a.date <= end);
                    }
                    if (apontamentosFiltrados.length > 0) {
                        content += `<h3>Apontamento de Plantio (${apontamentosFiltrados.length})</h3>`;
                        content += apontamentosFiltrados.map((ap) => `<div class="user-card"><strong>${ap.farmName}</strong> - ${ap.date} <button class="btn-excluir" data-action="delete" data-type="apontamentoPlantio" data-id="${ap.id}"><i class="fas fa-trash"></i> Excluir</button><button class="btn-excluir" style="background-color: var(--color-info);" data-action="edit" data-type="apontamentoPlantio" data-id="${ap.id}"><i class="fas fa-edit"></i> Editar</button></div>`).join('');
                    }
                } else {
                    let registrosFiltrados = App.state.registros;
                    let perdasFiltradas = App.state.perdas;

                    if (start) {
                        registrosFiltrados = registrosFiltrados.filter(r => r.data >= start);
                        perdasFiltradas = perdasFiltradas.filter(p => p.data >= start);
                    }
                    if (end) {
                        registrosFiltrados = registrosFiltrados.filter(r => r.data <= end);
                        perdasFiltradas = perdasFiltradas.filter(p => p.data <= end);
                    }

                    if (type === 'brocamento') {
                        if (registrosFiltrados.length > 0) {
                            content += `<h3>Brocamento (${registrosFiltrados.length})</h3>`;
                            content += registrosFiltrados.map((reg) => `<div class="user-card"><strong>${reg.fazenda}</strong> - ${reg.talhao} (${reg.data}) <button class="btn-excluir" data-action="delete" data-type="brocamento" data-id="${reg.id}"><i class="fas fa-trash"></i> Excluir</button></div>`).join('');
                        }
                    }
                    if (type === 'perda') {
                        if (perdasFiltradas.length > 0) {
                            content += `<h3 style="margin-top:20px;">Perda de Cana (${perdasFiltradas.length})</h3>`;
                            content += perdasFiltradas.map((p) => `<div class="user-card"><strong>${p.fazenda}</strong> - ${p.talhao} (${p.data}) <button class="btn-excluir" data-action="delete" data-type="perda" data-id="${p.id}"><i class="fas fa-trash"></i> Excluir</button></div>`).join('');
                        }
                    }
                }

                lista.innerHTML = content || '<p style="text-align:center; padding: 20px;">Nenhum lançamento encontrado para os filtros selecionados.</p>';
            },
            renderPlanejamento() {
                const { lista } = App.elements.planejamento; lista.innerHTML = '';
                const hoje = new Date(); hoje.setHours(0,0,0,0);
                const planosOrdenados = [...App.state.planos].sort((a,b) => new Date(a.dataPrevista) - new Date(b.dataPrevista));
                if(planosOrdenados.length === 0) { lista.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--color-text-light);">Nenhuma inspeção planejada.</p>'; return; }
                planosOrdenados.forEach(plano => {
                    let status = plano.status;
                    const dataPlano = new Date(plano.dataPrevista + 'T03:00:00Z');
                    if (plano.status === 'Pendente' && dataPlano < hoje) { status = 'Atrasado'; }
                    const fazenda = App.state.fazendas.find(f => f.code === plano.fazendaCodigo);
                    const fazendaNome = fazenda ? `${fazenda.code} - ${fazenda.name}` : 'Desconhecida';
                    const card = document.createElement('div'); card.className = 'plano-card';
                    card.innerHTML = `<div class="plano-header"><span class="plano-title"><i class="fas fa-${plano.tipo === 'broca' ? 'bug' : 'dollar-sign'}"></i> ${fazendaNome} - Talhão: ${plano.talhao}</span><span class="plano-status ${status.toLowerCase()}">${status}</span></div><div class="plano-details"><div><i class="fas fa-calendar-day"></i> Data Prevista: ${dataPlano.toLocaleDateString('pt-BR')}</div><div><i class="fas fa-user-check"></i> Responsável: ${plano.usuarioResponsavel}</div>${plano.meta ? `<div><i class="fas fa-bullseye"></i> Meta: ${plano.meta}</div>` : ''}</div>${plano.observacoes ? `<div style="margin-top:8px;font-size:14px;"><i class="fas fa-info-circle"></i> Obs: ${plano.observacoes}</div>` : ''}<div class="plano-actions">${status !== 'Concluído' ? `<button class="btn-excluir" style="background-color: var(--color-success)" data-action="concluir" data-id="${plano.id}"><i class="fas fa-check"></i> Marcar Concluído</button>` : ''}<button class="btn-excluir" data-action="excluir" data-id="${plano.id}"><i class="fas fa-trash"></i> Excluir</button></div>`;
                    lista.appendChild(card);
                });
            },
            async showHarvestPlanList() {
                const userId = App.state.currentUser?.uid;
                if (userId && App.state.activeHarvestPlan) {
                    try {
                        await App.data.deleteDocument('userDrafts', userId);
                    } catch (error) {
                        console.error("Não foi possível apagar o rascunho do Firestore:", error);
                    }
                }

                App.state.activeHarvestPlan = null;
                App.elements.harvest.plansListContainer.style.display = 'block';
                App.elements.harvest.planEditor.style.display = 'none';
                this.renderHarvestPlansList();
            },
            showHarvestPlanEditor() {
                App.elements.harvest.plansListContainer.style.display = 'none';
                App.elements.harvest.planEditor.style.display = 'block';
            },
            renderHarvestPlansList() {
                const { plansList } = App.elements.harvest;
                plansList.innerHTML = '';
                if(App.state.harvestPlans.length === 0) {
                    plansList.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--color-text-light);">Nenhum plano de colheita criado. Clique em "Novo Plano" para começar.</p>';
                    return;
                }
                App.state.harvestPlans.forEach(plan => {
                    const totalProducao = plan.sequence.reduce((sum, group) => sum + group.totalProducao, 0);
                    const card = document.createElement('div');
                    card.className = 'plano-card';
                    card.innerHTML = `
                        <div class="plano-header">
                            <span class="plano-title"><i class="fas fa-stream"></i> ${plan.frontName}</span>
                            <span class="plano-status pendente">${plan.sequence.length} fazenda(s)</span>
                        </div>
                        <div class="plano-details">
                            <div><i class="fas fa-calendar-day"></i> Início: ${new Date(plan.startDate + 'T03:00:00Z').toLocaleDateString('pt-BR')}</div>
                            <div><i class="fas fa-tasks"></i> ${plan.dailyRate} ton/dia</div>
                            <div><i class="fas fa-weight-hanging"></i> Total: ${totalProducao.toFixed(2)} ton</div>
                        </div>
                        <div class="plano-actions">
                            <button class="btn-excluir" style="background-color: var(--color-info); margin-left: 0;" data-action="edit" data-id="${plan.id}"><i class="fas fa-edit"></i> Editar</button>
                            <button class="btn-excluir" data-action="delete" data-id="${plan.id}"><i class="fas fa-trash"></i> Excluir</button>
                        </div>
                    `;
                    plansList.appendChild(card);
                });
            },
            renderHarvestSequence() {
                if (!App.state.activeHarvestPlan) return;
                const { tableBody, summary } = App.elements.harvest;
                const { startDate, dailyRate, sequence, closedTalhaoIds = [] } = App.state.activeHarvestPlan;
                
                tableBody.innerHTML = '';
                let grandTotalProducao = 0;
                let grandTotalArea = 0;

                let currentDate = startDate ? new Date(startDate + 'T03:00:00Z') : new Date();
                if (isNaN(currentDate.getTime())) {
                    currentDate = new Date();
                }
                const dailyTon = parseFloat(dailyRate) > 0 ? parseFloat(dailyRate) : 1;

                sequence.forEach((group, index) => {
                    const producaoConsiderada = group.totalProducao - (group.producaoColhida || 0);

                    grandTotalProducao += group.totalProducao;
                    grandTotalArea += group.totalArea;

                    const diasNecessarios = Math.ceil(producaoConsiderada / dailyTon);
                    
                    const dataEntrada = new Date(currentDate.getTime());
                    
                    let dataSaida = new Date(dataEntrada.getTime());
                    if (diasNecessarios > 0) {
                        dataSaida.setDate(dataSaida.getDate() + diasNecessarios - 1);
                    }
                    
                    currentDate = new Date(dataSaida.getTime());
                    currentDate.setDate(currentDate.getDate() + 1);
                    
                    const idadeMediaMeses = App.actions.calculateAverageAge(group, dataEntrada);
                    const diasAplicacao = App.actions.calculateMaturadorDays(group);

                    const areaColhida = group.areaColhida || 0;
                    const producaoColhida = group.producaoColhida || 0;

                    const row = tableBody.insertRow();
                    row.draggable = true;
                    row.dataset.id = group.id;
                    
                    row.innerHTML = `
                        <td data-label="Seq.">${index + 1}</td>
                        <td data-label="Fazenda">${group.fazendaCodigo} - ${group.fazendaName}</td>
                        <td data-label="Talhões" class="talhao-list-cell">${group.plots.map(p => p.talhaoName).join(', ')}</td>
                        <td data-label="Área (ha)">${areaColhida.toFixed(2)} / ${group.totalArea.toFixed(2)}</td>
                        <td data-label="Prod. (ton)">${producaoColhida.toFixed(2)} / ${group.totalProducao.toFixed(2)}</td>
                        <td data-label="ATR"><span>${group.atr || 'N/A'}</span></td>
                        <td data-label="Idade (m)">${idadeMediaMeses}</td>
                        <td data-label="Maturador">${group.maturador || 'N/A'}</td>
                        <td data-label="Dias Aplic.">${diasAplicacao}</td>
                        <td data-label="Ação">
                            <div style="display: flex; justify-content: flex-end; gap: 5px;">
                                <button class="btn-excluir" style="background-color: var(--color-info);" title="Editar Grupo no Plano" data-action="edit-harvest-group" data-id="${group.id}"><i class="fas fa-edit"></i></button>
                                <button class="btn-excluir" title="Remover Grupo do Plano" data-action="remove-harvest" data-id="${group.id}"><i class="fas fa-times"></i></button>
                            </div>
                        </td>
                        <td data-label="Entrada">${dataEntrada.toLocaleDateString('pt-BR')}</td>
                        <td data-label="Saída">${dataSaida.toLocaleDateString('pt-BR')}</td>
                    `;
                });

                if (sequence.length > 0) {
                    const allVarieties = new Set();
                    sequence.forEach(group => {
                        const farm = App.state.fazendas.find(f => f.code === group.fazendaCodigo);
                        if(farm) {
                            group.plots.forEach(plot => {
                                const talhao = farm.talhoes.find(t => t.id === plot.talhaoId);
                                if(talhao && talhao.variedade) {
                                    allVarieties.add(talhao.variedade);
                                }
                            });
                        }
                    });
                    const varietiesString = allVarieties.size > 0 ? Array.from(allVarieties).join(', ') : 'N/A';
                    
                    const finalDate = new Date(currentDate.getTime());
                    finalDate.setDate(finalDate.getDate() - 1);

                    summary.innerHTML = `
                        <p>Produção Total (Ativa): <span>${grandTotalProducao.toFixed(2)} ton</span></p>
                        <p>Área Total (Ativa): <span>${grandTotalArea.toFixed(2)} ha</span></p>
                        <p>Data Final de Saída Prevista: <span>${finalDate.toLocaleDateString('pt-BR')}</span></p>
                        <p>Variedades na Sequência: <span>${varietiesString}</span></p>
                    `;
                } else {
                    summary.innerHTML = '<p>Adicione fazendas à sequência para ver o resumo da colheita.</p>';
                }
            },
            validateFields(ids) { return ids.every(id => { const el = document.getElementById(id); const valid = el.value.trim() !== ''; el.style.borderColor = valid ? 'var(--color-border)' : 'var(--color-danger)'; if (!valid) el.focus(); return valid; }); },
            updateBrocadoTotal() {
                const { broca } = App.elements;
                const base = parseInt(broca.base.value) || 0;
                const meio = parseInt(broca.meio.value) || 0;
                const topo = parseInt(broca.topo.value) || 0;
                broca.brocado.value = base + meio + topo;
            },
            calculateBrocamento() {
                const entrenos = parseInt(App.elements.broca.entrenos.value) || 0;
                const brocado = parseInt(App.elements.broca.brocado.value) || 0;
                const resultadoEl = App.elements.broca.resultado;
                if (entrenos > 0) {
                    const porcentagem = (brocado / entrenos) * 100;
                    resultadoEl.textContent = `Brocamento: ${porcentagem.toFixed(2).replace('.', ',')}%`;
                    resultadoEl.style.color = porcentagem > 20 ? 'var(--color-danger)' : 'var(--color-success)';
                } else {
                    resultadoEl.textContent = '';
                }
            },
            calculatePerda() {
                const fields = ['canaInteira', 'tolete', 'toco', 'ponta', 'estilhaco', 'pedaco'];
                const total = fields.reduce((sum, id) => sum + (parseFloat(document.getElementById(id).value) || 0), 0);
                App.elements.perda.resultado.textContent = `Total Perda: ${total.toFixed(2).replace('.', ',')} kg`;
            },

            calculateCigarrinha() {
                const { fase1, fase2, fase3, fase4, fase5, resultado } = App.elements.cigarrinha;
                const f1 = parseInt(fase1.value) || 0;
                const f2 = parseInt(fase2.value) || 0;
                const f3 = parseInt(fase3.value) || 0;
                const f4 = parseInt(fase4.value) || 0;
                const f5 = parseInt(fase5.value) || 0;

                // Lê o método de cálculo do estado da aplicação, com '5' como padrão.
                const divisor = parseInt(App.state.companyConfig?.cigarrinhaCalcMethod || '5', 10);

                const media = (f1 + f2 + f3 + f4 + f5) / divisor;
                resultado.textContent = `Resultado: ${media.toFixed(2).replace('.', ',')}`;
            },

            calculateCigarrinhaAmostragem() {
                const container = document.getElementById('amostrasCigarrinhaAmostragemContainer');
                const resultadoEl = document.getElementById('resultadoCigarrinhaAmostragem');
                if (!container || !resultadoEl) return;

                const amostras = container.querySelectorAll('.amostra-card');
                if (amostras.length === 0) {
                    resultadoEl.textContent = '';
                    return;
                }

                const divisor = parseInt(App.state.companyConfig?.cigarrinhaCalcMethod || '5', 10);
                let somaTotalDeFases = 0;

                amostras.forEach(card => {
                    card.querySelectorAll('.amostra-input').forEach(input => {
                        somaTotalDeFases += parseInt(input.value) || 0;
                    });
                });

                const resultadoFinal = somaTotalDeFases / divisor;

                resultadoEl.textContent = `Resultado: ${resultadoFinal.toFixed(2).replace('.', ',')}`;
            },

            showConfirmationModal(message, onConfirm, inputsConfig = false, onCancel = null) {
                const { overlay, title, message: msgEl, confirmBtn, cancelBtn, closeBtn, inputContainer } = App.elements.confirmationModal;
                title.textContent = "Confirmar Ação";
                msgEl.textContent = message;

                inputContainer.innerHTML = '';
                inputContainer.style.display = 'none';

                if (inputsConfig) {
                    const inputsArray = Array.isArray(inputsConfig) ? inputsConfig : [{ id: 'confirmationModalInput', placeholder: 'Digite para confirmar' }];
                    inputContainer.style.display = 'block';

                    inputsArray.forEach(config => {
                        let inputEl;

                        if (config.type === 'select') {
                            if (config.label) {
                                const label = document.createElement('label');
                                label.htmlFor = config.id;
                                label.textContent = config.label;
                                inputContainer.appendChild(label);
                            }
                            inputEl = document.createElement('select');
                            inputEl.id = config.id;
                            if (config.options && Array.isArray(config.options)) {
                                config.options.forEach(opt => {
                                    const option = document.createElement('option');
                                    option.value = opt.value;
                                    option.textContent = opt.text;
                                    inputEl.appendChild(option);
                                });
                            }
                        } else if (config.type === 'textarea') {
                            inputEl = document.createElement('textarea');
                            inputEl.placeholder = config.placeholder || '';
                        } else {
                            inputEl = document.createElement('input');
                            inputEl.type = config.type || 'text';
                            inputEl.placeholder = config.placeholder || '';
                        }

                        inputEl.id = config.id;
                        inputEl.value = config.value || '';
                        if (config.required) {
                            inputEl.required = true;
                        }
                        inputContainer.appendChild(inputEl);
                    });

                    inputContainer.querySelector('input, textarea, select')?.focus();
                }

                const confirmHandler = () => {
                    let results = {};
                    let allValid = true;
                    if (inputsConfig) {
                        const inputs = Array.from(inputContainer.querySelectorAll('input, textarea, select'));
                        inputs.forEach(input => {
                            if (input.required && !input.value) {
                                allValid = false;
                            }
                            results[input.id] = input.value;
                        });
                    }

                    if (!allValid) {
                        App.ui.showAlert("Por favor, preencha todos os campos obrigatórios.", "error");
                        return;
                    }

                    let valueToConfirm = results;
                    if (!Array.isArray(inputsConfig) && inputsConfig === true) {
                        valueToConfirm = results['confirmationModalInput'];
                    }
                    
                    onConfirm(valueToConfirm);
                    cleanup();
                };
                
                const cancelHandler = () => {
                    if (onCancel) {
                        onCancel();
                    }
                    cleanup();
                };

                const cleanup = () => {
                    overlay.classList.remove('show');
                    confirmBtn.removeEventListener('click', confirmHandler);
                    cancelBtn.removeEventListener('click', cancelHandler);
                    closeBtn.removeEventListener('click', cancelHandler);
                    setTimeout(() => {
                        confirmBtn.textContent = "Confirmar";
                        cancelBtn.style.display = 'inline-flex';
                    }, 300);
                };
                
                confirmBtn.addEventListener('click', confirmHandler);
                cancelBtn.addEventListener('click', cancelHandler);
                closeBtn.addEventListener('click', cancelHandler);
                overlay.classList.add('show');
            },
            showAdminPasswordConfirmModal() {
                App.elements.adminPasswordConfirmModal.overlay.classList.add('show');
                App.elements.adminPasswordConfirmModal.passwordInput.focus();
            },
            closeAdminPasswordConfirmModal() {
                App.elements.adminPasswordConfirmModal.overlay.classList.remove('show');
                App.elements.adminPasswordConfirmModal.passwordInput.value = '';
            },

            showEnableOfflineLoginModal() {},
            closeEnableOfflineLoginModal() {},

            showImpersonationBanner(companyName) {
                this.hideImpersonationBanner(); // Limpa qualquer banner anterior

                const banner = document.createElement('div');
                banner.id = 'impersonation-banner';
                const bannerHeight = 40;

                // Estilos do banner
                Object.assign(banner.style, {
                    position: 'fixed', top: '0', left: '0', width: '100%', height: `${bannerHeight}px`,
                    backgroundColor: 'var(--color-purple)', color: 'white', textAlign: 'center',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    fontSize: '14px', zIndex: '10001', boxSizing: 'border-box'
                });

                // Conteúdo do banner
                banner.innerHTML = `
                    <i class="fas fa-eye" style="margin-right: 10px;"></i>
                    <span>A visualizar como <strong>${companyName}</strong>.</span>
                    <button id="stop-impersonating-btn" style="background: white; color: var(--color-purple); border: none; padding: 5px 10px; border-radius: 5px; margin-left: 20px; cursor: pointer; font-weight: bold;">Sair da Visualização</button>
                `;

                // Adiciona o banner ao corpo e ajusta o padding
                document.body.prepend(banner);
                document.body.style.paddingTop = `${bannerHeight}px`;

                // Adiciona o event listener de forma segura após o elemento estar no DOM
                const stopBtn = document.getElementById('stop-impersonating-btn');
                if (stopBtn) {
                    stopBtn.addEventListener('click', App.actions.stopImpersonating);
                }
            },

            hideImpersonationBanner() {
                const banner = document.getElementById('impersonation-banner');
                if (banner) {
                    banner.remove();
                }
                document.body.style.paddingTop = '0';
            },
            openUserEditModal(userId) {
                const modalEls = App.elements.userEditModal;
                const user = App.state.users.find(u => u.id == userId);
                if (!user) return;

                modalEls.editingUserId.value = user.id;
                modalEls.title.textContent = `Editar Utilizador: ${user.username}`;
                modalEls.username.value = user.username;
                modalEls.role.value = user.role;

                this.renderPermissionItems(modalEls.permissionGrid, user.permissions);

                modalEls.overlay.classList.add('show');
            },
            closeUserEditModal() {
                App.elements.userEditModal.overlay.classList.remove('show');
            },
            openEditCompanyModal(companyId) {
                const modal = App.elements.editCompanyModal;
                const company = App.state.companies.find(c => c.id === companyId);
                if (!company) {
                    App.ui.showAlert("Empresa não encontrada.", "error");
                    return;
                }

                modal.editingCompanyId.value = company.id;
                modal.companyNameDisplay.textContent = company.name;

                const grid = modal.modulesGrid;
                grid.innerHTML = ''; // Limpa o grid antes de preencher

                const allPermissions = App.config.menuConfig.flatMap(item =>
                    item.submenu ? item.submenu : [item]
                ).filter(item => item.permission && item.permission !== 'superAdmin');

                const subscribedModules = new Set(company.subscribedModules || []);

                allPermissions.forEach(perm => {
                    const isChecked = subscribedModules.has(perm.permission);
                    const checkboxHTML = `
                        <label class="report-option-item">
                            <input type="checkbox" data-module="${perm.permission}" ${isChecked ? 'checked' : ''}>
                            <span class="checkbox-visual"><i class="fas fa-check"></i></span>
                            <span class="option-content">
                                <i class="${perm.icon}"></i>
                                <span>${perm.label}</span>
                            </span>
                        </label>
                    `;
                    grid.innerHTML += checkboxHTML;
                });

                modal.overlay.classList.add('show');
            },
            closeEditCompanyModal() {
                App.elements.editCompanyModal.overlay.classList.remove('show');
            },
            openEditFarmModal(farmId) {
                const farm = App.state.fazendas.find(f => f.id === farmId);
                if (!farm) return;
                const modal = App.elements.editFarmModal;
                modal.editingFarmId.value = farm.id;
                modal.nameInput.value = farm.name;

                modal.typeCheckboxes.forEach(cb => {
                    cb.checked = farm.types && farm.types.includes(cb.value);
                });

                modal.overlay.classList.add('show');
                modal.nameInput.focus();
            },
            closeEditFarmModal() {
                App.elements.editFarmModal.overlay.classList.remove('show');
            },

            addAmostraCard() {
                const container = App.elements.cigarrinhaAmostragem.amostrasContainer;
                if (!container) return;

                // Recolhe todos os outros cartões antes de adicionar um novo
                container.querySelectorAll('.amostra-card:not(.collapsed)').forEach(c => c.classList.add('collapsed'));

                const amostraId = Date.now();
                const card = document.createElement('div');
                card.className = 'amostra-card'; // Os novos cartões começam expandidos por padrão
                card.dataset.id = amostraId;

                const amostraCount = container.children.length + 1;

                card.innerHTML = `
                    <div class="amostra-header" style="cursor: pointer;">
                        <i class="fas fa-chevron-down amostra-toggle-icon"></i>
                        <h4>Amostra ${amostraCount}</h4>
                        <button type="button" class="btn-remover-amostra" title="Remover Amostra">&times;</button>
                    </div>
                    <div class="amostra-body">
                        <div class="form-row">
                            ${[1, 2, 3, 4, 5].map(i => `
                                <div class="form-col">
                                    <label for="fase${i}-amostra-${amostraId}">Fase ${i}:</label>
                                    <input type="number" id="fase${i}-amostra-${amostraId}" class="amostra-input" min="0" placeholder="0">
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
                container.appendChild(card);
                card.querySelector('input').focus();
                App.ui.calculateCigarrinhaAmostragem();
            },

            applyTheme(theme) {
                document.body.className = theme;
                App.elements.userMenu.themeButtons.forEach(btn => {
                    btn.classList.toggle('active', btn.id === theme);
                });
                localStorage.setItem(App.config.themeKey, theme);
                
                Chart.defaults.color = this._getThemeColors().text;

                if (App.state.currentUser && document.getElementById('dashboard').classList.contains('active')) {
                    if(document.getElementById('dashboard-broca').style.display !== 'none') {
                        setTimeout(() => App.charts.renderBrocaDashboardCharts(), 50);
                    }
                    if(document.getElementById('dashboard-perda').style.display !== 'none') {
                        setTimeout(() => App.charts.renderPerdaDashboardCharts(), 50);
                    }
                }
            },
            enableEnterKeyNavigation(formSelector) {
                const form = document.querySelector(formSelector);
                if (!form) return;

                form.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
                        e.preventDefault();
                        const fields = Array.from(
                            form.querySelectorAll('input:not([readonly]):not([disabled]), select:not([disabled]), textarea:not([disabled])')
                        );
                        const currentIndex = fields.indexOf(e.target);
                        const nextField = fields[currentIndex + 1];

                        if (nextField) {
                            nextField.focus();
                        } else {
                            form.querySelector('.save, #btnConfirmarOrdemCorte, #btnLogin')?.focus();
                        }
                    }
                });
            },
            _createPermissionItemHTML(perm, permissions = {}) {
                if (!perm.permission) return '';
                const isChecked = permissions[perm.permission];
                return `
                    <label class="permission-item">
                        <input type="checkbox" data-permission="${perm.permission}" ${isChecked ? 'checked' : ''}>
                        <div class="permission-content">
                            <i class="${perm.icon}"></i>
                            <span>${perm.label}</span>
                        </div>
                        <div class="toggle-switch">
                            <span class="slider"></span>
                        </div>
                    </label>
                `;
            },

            renderCompanyModules(containerId) {
                const container = document.getElementById(containerId);
                if (!container) return;
                container.innerHTML = '';

                // Flatten the menu config to get all permissions, excluding superAdmin
                const allPermissions = App.config.menuConfig.flatMap(item =>
                    item.submenu ? item.submenu : [item]
                ).filter(item => item.permission && item.permission !== 'superAdmin');

                allPermissions.forEach(perm => {
                    const checkboxHTML = `
                        <label class="report-option-item">
                            <input type="checkbox" data-module="${perm.permission}" checked>
                            <span class="checkbox-visual"><i class="fas fa-check"></i></span>
                            <span class="option-content">
                                <i class="${perm.icon}"></i>
                                <span>${perm.label}</span>
                            </span>
                        </label>
                    `;
                    container.innerHTML += checkboxHTML;
                });
            },

            renderGlobalFeatures() {
                const grid = document.getElementById('globalFeaturesGrid');
                if (!grid) return;

                grid.innerHTML = ''; // Limpa para re-renderizar
                const allPermissions = App.config.menuConfig.flatMap(item =>
                    item.submenu ? item.submenu : [item]
                ).filter(item => item.permission && item.permission !== 'superAdmin');

                allPermissions.forEach(perm => {
                    const isActive = App.isFeatureGloballyActive(perm.permission);
                    const itemHTML = `
                        <label class="permission-item">
                            <input type="checkbox" data-feature="${perm.permission}" ${isActive ? 'checked' : ''}>
                            <div class="permission-content">
                                <i class="${perm.icon}"></i>
                                <span>${perm.label}</span>
                            </div>
                            <div class="toggle-switch">
                                <span class="slider"></span>
                            </div>
                        </label>
                    `;
                    grid.innerHTML += itemHTML;
                });
            },

            renderPermissionItems(container, permissions = {}, company = null) {
                if (!container) return;
                container.innerHTML = '';

                // Define a lista de módulos permitidos
                let allowedModules = null;
                if (App.state.currentUser.role !== 'super-admin') {
                    const currentCompany = App.state.companies.find(c => c.id === App.state.currentUser.companyId);
                    if (currentCompany && currentCompany.subscribedModules) {
                        allowedModules = new Set(currentCompany.subscribedModules);
                    }
                }

                const allPermissionItems = App.config.menuConfig.flatMap(item =>
                    item.submenu ? item.submenu : [item]
                ).filter(item => item.permission && item.permission !== 'superAdmin');

                // Filtra os itens de permissão com base nos módulos subscritos, se aplicável
                const permissionItemsToRender = allowedModules
                    ? allPermissionItems.filter(perm => allowedModules.has(perm.permission))
                    : allPermissionItems;

                permissionItemsToRender.forEach(perm => {
                    container.innerHTML += this._createPermissionItemHTML(perm, permissions);
                });
            },
            showHistoryFilterModal() {
                const modal = App.elements.historyFilterModal;
                this.populateUserSelects([modal.userSelect]); // Popula apenas o select do modal

                // Set default dates
                const today = new Date();
                const sevenDaysAgo = new Date(today);
                sevenDaysAgo.setDate(today.getDate() - 7);

                modal.startDate.value = sevenDaysAgo.toISOString().split('T')[0];
                modal.endDate.value = today.toISOString().split('T')[0];

                modal.overlay.classList.add('show');
            },
            hideHistoryFilterModal() {
                const modal = App.elements.historyFilterModal;
                modal.overlay.classList.remove('show');
            },

            showSyncHistoryDetailModal() {
                App.elements.syncHistoryDetailModal.overlay.classList.add('show');
            },

            hideSyncHistoryDetailModal() {
                App.elements.syncHistoryDetailModal.overlay.classList.remove('show');
                App.elements.syncHistoryDetailModal.body.innerHTML = ''; // Limpa o conteúdo ao fechar
            },

            hideConfigHistoryModal() {
                const modal = App.elements.configHistoryModal;
                if (modal && modal.overlay) {
                    modal.overlay.classList.remove('show');
                }
            },

            showWelcomeModal() {
                // Return a promise that resolves when the modal is closed
                return new Promise((resolve) => {
                    const { overlay, closeBtn } = App.elements.welcomeModal;
                    overlay.classList.add('show');

                    const closeHandler = () => {
                        overlay.classList.remove('show');
                        closeBtn.removeEventListener('click', closeHandler);
                        resolve();
                    };
                    closeBtn.addEventListener('click', closeHandler);
                });
            },
            showUpdateModal(announcement) {
                return new Promise((resolve) => {
                    const { overlay, title, body, versionBadge, closeBtn, ackBtn } = App.elements.updateModal;

                    title.innerHTML = `<i class="fas fa-rocket"></i> ${announcement.title}`;
                    // Converte quebras de linha em <br> se for texto simples
                    body.innerHTML = announcement.description.replace(/\n/g, '<br>');
                    versionBadge.textContent = announcement.version;

                    overlay.classList.add('show');

                    const closeHandler = () => {
                        overlay.classList.remove('show');
                        closeBtn.removeEventListener('click', closeHandler);
                        ackBtn.removeEventListener('click', closeHandler);
                        resolve();
                    };

                    closeBtn.addEventListener('click', closeHandler);
                    ackBtn.addEventListener('click', closeHandler);
                });
            },
            renderAnnouncementsManager() {
                const { list } = App.elements.announcements;
                if (!list) return;
                list.innerHTML = '';

                // Add Admin Tool for Data Correction
                const adminToolsContainer = document.createElement('div');
                adminToolsContainer.className = 'admin-tools-container';
                adminToolsContainer.style.marginBottom = '20px';
                adminToolsContainer.style.padding = '15px';
                adminToolsContainer.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
                adminToolsContainer.style.border = '1px solid red';
                adminToolsContainer.style.borderRadius = '8px';

                adminToolsContainer.innerHTML = `
                    <h3><i class="fas fa-tools"></i> Ferramentas de Manutenção</h3>
                    <p>Use com cuidado. Estas ações afetam o banco de dados diretamente.</p>
                    <button id="btnFixDateFormats" class="btn btn-primary" style="background-color: #ff3366; border-color: #ff3366;">
                        <i class="fas fa-calendar-check"></i> Corrigir Datas (Bug Importação)
                    </button>
                `;
                list.appendChild(adminToolsContainer);

                setTimeout(() => {
                    const btnFix = document.getElementById('btnFixDateFormats');
                    if (btnFix) {
                        btnFix.addEventListener('click', async () => {
                            if (!confirm("Tem certeza que deseja rodar a correção de datas? Isso irá verificar e corrigir datas mal formatadas (ex: 2020-1-1 -> 2020-01-01) na coleção 'clima'.")) return;

                            App.ui.setLoading(true, "A corrigir datas no servidor...");
                            try {
                                const token = await auth.currentUser.getIdToken();
                                const response = await fetch(`${App.config.backendUrl}/api/admin/fix-dates`, {
                                    method: 'POST',
                                    headers: {
                                        'Authorization': `Bearer ${token}`,
                                        'Content-Type': 'application/json'
                                    }
                                });

                                if (!response.ok) {
                                    const errorText = await response.text();
                                    let errorMsg = errorText;
                                    try {
                                        const errorJson = JSON.parse(errorText);
                                        if (errorJson.message) errorMsg = errorJson.message;
                                    } catch (e) {}
                                    throw new Error(errorMsg);
                                }

                                const result = await response.json();
                                App.ui.showAlert(result.message, "success");
                            } catch (e) {
                                App.ui.showAlert(`Erro: ${e.message}`, "error");
                            } finally {
                                App.ui.setLoading(false);
                            }
                        });
                    }
                }, 0);

                if (!App.state.announcements || App.state.announcements.length === 0) {
                    list.innerHTML += '<p>Nenhuma atualização publicada.</p>';
                    return;
                }

                const table = document.createElement('table');
                table.className = 'harvestPlanTable';
                table.innerHTML = `<thead><tr><th>Versão</th><th>Título</th><th>Data</th><th>Status</th></tr></thead><tbody></tbody>`;
                const tbody = table.querySelector('tbody');

                App.state.announcements.forEach(a => {
                    const row = tbody.insertRow();
                    const date = a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString('pt-BR') : 'N/A';
                    row.innerHTML = `
                        <td data-label="Versão">${a.version}</td>
                        <td data-label="Título">${a.title}</td>
                        <td data-label="Data">${date}</td>
                        <td data-label="Status"><span class="status-badge ${a.active ? 'status-active' : 'status-inactive'}">${a.active ? 'Ativo' : 'Inativo'}</span></td>
                    `;
                });
                list.appendChild(table);
            },

            async renderSyncHistoryDetails(logId) {
                const modal = App.elements.syncHistoryDetailModal;
                modal.body.innerHTML = '<div class="spinner-container" style="display:flex; justify-content:center; padding: 20px;"><div class="spinner"></div></div>';
                this.showSyncHistoryDetailModal();

                try {
                    const logDoc = await App.data.getDocument('sync_history_store', logId);

                    if (!logDoc || !logDoc.items || logDoc.items.length === 0) {
                        modal.body.innerHTML = '<p>Nenhum item detalhado encontrado para este registo de sincronização.</p>';
                        return;
                    }

                    let logTimestamp = new Date();
                    if (logDoc.timestamp) {
                        if (typeof logDoc.timestamp.toDate === 'function') {
                            logTimestamp = logDoc.timestamp.toDate();
                        } else if (logDoc.timestamp.seconds) {
                            logTimestamp = new Date(logDoc.timestamp.seconds * 1000);
                        } else {
                            logTimestamp = new Date(logDoc.timestamp);
                        }
                    }

                    const formattedTimestamp = logDoc.timestamp && !isNaN(logTimestamp) ? logTimestamp.toLocaleString('pt-BR') : 'Data não disponível';
                    modal.title.textContent = `Detalhes da Sincronização de ${formattedTimestamp}`;

                    let contentHTML = '<div class="sync-items-container">';

                    logDoc.items.forEach((item, index) => {
                        const itemStatus = item.status || 'unknown';
                        const cardClass = itemStatus === 'success' ? 'success' : 'failure';
                        const icon = itemStatus === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
                        const title = `Item ${index + 1}: ${item.collection}`;

                        let dataDetails = '';
                        if (item.data) {
                            switch (item.collection) {
                                case 'registros': // Broca
                                    dataDetails = `<p><strong>Fazenda/Talhão:</strong> ${item.data.codigo} / ${item.data.talhao}</p><p><strong>Data:</strong> ${item.data.data}</p><p><strong>Índice:</strong> ${item.data.brocamento}%</p>`;
                                    break;
                                case 'perdas':
                                    dataDetails = `<p><strong>Fazenda/Talhão:</strong> ${item.data.codigo} / ${item.data.talhao}</p><p><strong>Data:</strong> ${item.data.data}</p><p><strong>Total:</strong> ${item.data.total} kg</p>`;
                                    break;
                                default:
                                    dataDetails = Object.entries(item.data)
                                        .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
                                        .join('');
                                    break;
                            }
                        }

                        const errorInfo = item.status === 'failure'
                            ? `<div class="error-message"><strong>Erro:</strong> ${item.error || 'Desconhecido'}</div>`
                            : '';

                        const retryButton = item.status === 'failure'
                            ? `<div class="sync-item-footer">
                                   <button class="btn-retry-sync" data-action="retry-sync-item" data-item-index="${index}" data-log-id="${logId}">
                                       <i class="fas fa-sync-alt"></i> Tentar Novamente
                                   </button>
                               </div>`
                            : '';

                        contentHTML += `
                            <div class="sync-item-card ${cardClass}" id="sync-item-${index}">
                                <div class="sync-item-header">
                                    <i class="fas ${icon}"></i>
                                    <span>${title}</span>
                                </div>
                                <div class="sync-item-body">
                                    ${dataDetails}
                                    ${errorInfo}
                                </div>
                                ${retryButton}
                            </div>
                        `;
                    });

                    contentHTML += '</div>';
                    modal.body.innerHTML = contentHTML;

                } catch (error) {
                    console.error("Erro ao buscar detalhes do histórico de sincronização:", error);
                    modal.body.innerHTML = '<p style="color: var(--color-danger);">Não foi possível carregar os detalhes.</p>';
                }
            },

            async retrySyncItem(logId, itemIndex) {
                App.ui.setLoading(true, "A tentar sincronizar novamente...");
                try {
                    const logDoc = await App.data.getDocument('sync_history_store', logId);
                    if (!logDoc || !logDoc.items || !logDoc.items[itemIndex]) {
                        throw new Error("Registo de log ou item não encontrado.");
                    }

                    const itemToRetry = logDoc.items[itemIndex];
                    if (itemToRetry.status !== 'failure') {
                        App.ui.showAlert("Este item não falhou, não há necessidade de tentar novamente.", "info");
                        return;
                    }

                    // Tenta adicionar o documento novamente
                    await App.data.addDocument(itemToRetry.collection, itemToRetry.data);

                    // Se for bem-sucedido, atualiza o log no Firestore
                    const updatedItems = [...logDoc.items];
                    updatedItems[itemIndex].status = 'success';
                    updatedItems[itemIndex].error = null; // Limpa a mensagem de erro anterior

                    await App.data.updateDocument('sync_history_store', logId, { items: updatedItems });

                    App.ui.showAlert("Item sincronizado com sucesso!", "success");
                    // Re-renderiza os detalhes para refletir a mudança
                    this.renderSyncHistoryDetails(logId);

                } catch (error) {
                    App.ui.showAlert(`Falha ao tentar novamente: ${error.message}`, "error");
                    console.error("Erro ao tentar sincronizar item novamente:", error);
                } finally {
                    App.ui.setLoading(false);
                }
            },

            setupEventListeners() {
                const reauthModal = App.elements.reauthModal;
                if (reauthModal?.closeBtn) reauthModal.closeBtn.addEventListener('click', () => App.ui.closeReauthModal());
                if (reauthModal?.cancelBtn) reauthModal.cancelBtn.addEventListener('click', () => App.ui.closeReauthModal());
                if (reauthModal?.overlay) {
                    reauthModal.overlay.addEventListener('click', (e) => {
                        if (e.target === reauthModal.overlay) App.ui.closeReauthModal();
                    });
                }

                if (App.elements.logoutBtn) App.elements.logoutBtn.addEventListener('click', () => App.auth.logout());
                if (App.elements.btnToggleMenu) {
                    App.elements.btnToggleMenu.addEventListener('click', () => {
                        document.body.classList.toggle('mobile-menu-open');
                        App.elements.menu?.classList.toggle('open');
                        App.elements.btnToggleMenu?.classList.toggle('open');
                    });
                }
                if (App.elements.headerLogo) App.elements.headerLogo.addEventListener('click', () => App.ui.showTab('estimativaSafra'));

                document.addEventListener('click', (e) => {
                    if (App.elements.menu && !App.elements.menu.contains(e.target) && App.elements.btnToggleMenu && !App.elements.btnToggleMenu.contains(e.target)) {
                        this.closeAllMenus();
                    }
                    if (App.elements.userMenu.container && !App.elements.userMenu.container.contains(e.target)) {
                        App.elements.userMenu.dropdown?.classList.remove('show');
                        App.elements.userMenu.toggle?.classList.remove('open');
                        App.elements.userMenu.toggle?.setAttribute('aria-expanded', 'false');
                    }
                    if (App.elements.notificationBell.container && !App.elements.notificationBell.container.contains(e.target)) {
                        App.elements.notificationBell.dropdown?.classList.remove('show');
                    }
                });

                if (App.elements.userMenu.toggle) {
                    App.elements.userMenu.toggle.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const dropdown = App.elements.userMenu.dropdown;
                        const toggle = App.elements.userMenu.toggle;
                        const isShown = dropdown?.classList.toggle('show');
                        toggle?.classList.toggle('open', !!isShown);
                        toggle?.setAttribute('aria-expanded', !!isShown);
                        App.elements.notificationBell.dropdown?.classList.remove('show');
                    });
                }
                if (App.elements.notificationBell.toggle) {
                    App.elements.notificationBell.toggle.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const dropdown = App.elements.notificationBell.dropdown;
                        const isShown = dropdown?.classList.toggle('show');
                        if (isShown) App.actions.markNotificationsAsRead();
                        App.elements.userMenu.dropdown?.classList.remove('show');
                    });
                }
                if (App.elements.notificationBell.clearBtn) {
                    App.elements.notificationBell.clearBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        App.actions.clearAllNotifications();
                    });
                }

                if (App.elements.userMenu.themeButtons) {
                    App.elements.userMenu.themeButtons.forEach((btn) => {
                        btn.addEventListener('click', () => this.applyTheme(btn.id));
                    });
                }

                if (App.elements.users.role) App.elements.users.role.addEventListener('change', (e) => this.updatePermissionsForRole(e.target.value));
                if (App.elements.users.btnCreate) App.elements.users.btnCreate.addEventListener('click', () => App.auth.initiateUserCreation());
                if (App.elements.users.list) {
                    App.elements.users.list.addEventListener('click', (e) => {
                        const button = e.target.closest('button[data-action]');
                        if (!button) return;
                        const { action, id } = button.dataset;
                        if (action === 'edit') this.openUserEditModal(id);
                        if (action === 'toggle') App.auth.toggleUserStatus(id);
                    });
                }

                const adminModal = App.elements.adminPasswordConfirmModal;
                if (adminModal.closeBtn) adminModal.closeBtn.addEventListener('click', () => this.closeAdminPasswordConfirmModal());
                if (adminModal.cancelBtn) adminModal.cancelBtn.addEventListener('click', () => this.closeAdminPasswordConfirmModal());
                if (adminModal.confirmBtn) adminModal.confirmBtn.addEventListener('click', () => App.auth.executeAdminAction());
                if (adminModal.overlay) adminModal.overlay.addEventListener('click', (e) => { if (e.target === adminModal.overlay) this.closeAdminPasswordConfirmModal(); });

                const modalEls = App.elements.userEditModal;
                if (modalEls.closeBtn) modalEls.closeBtn.addEventListener('click', () => this.closeUserEditModal());
                if (modalEls.overlay) modalEls.overlay.addEventListener('click', (e) => { if (e.target === modalEls.overlay) this.closeUserEditModal(); });
                if (modalEls.btnSaveChanges) modalEls.btnSaveChanges.addEventListener('click', () => App.auth.saveUserChanges(modalEls.editingUserId.value));
                if (modalEls.btnResetPassword) modalEls.btnResetPassword.addEventListener('click', () => App.auth.resetUserPassword(modalEls.editingUserId.value));
                if (modalEls.btnDeleteUser) modalEls.btnDeleteUser.addEventListener('click', () => App.auth.deleteUser(modalEls.editingUserId.value));
                if (modalEls.role) modalEls.role.addEventListener('change', (e) => this.updatePermissionsForRole(e.target.value, '#editUserPermissionGrid'));

                const companyEls = App.elements.companyManagement;
                if (companyEls.btnCreate) companyEls.btnCreate.addEventListener('click', () => App.actions.createCompany());
                const btnSaveGlobalFeatures = document.getElementById('btnSaveGlobalFeatures');
                if (btnSaveGlobalFeatures) btnSaveGlobalFeatures.addEventListener('click', () => App.actions.saveGlobalFeatures());
                if (companyEls.list) {
                    companyEls.list.addEventListener('click', (e) => {
                        const button = e.target.closest('button[data-action]');
                        if (!button) return;
                        const { action, id } = button.dataset;
                        if (action === 'edit-company') this.openEditCompanyModal(id);
                        if (action === 'toggle-company') App.actions.toggleCompanyStatus(id);
                        if (action === 'delete-company-permanently') App.actions.deleteCompanyPermanently(id);
                        if (action === 'view-as-company') App.actions.impersonateCompany(id);
                    });
                }

                const editCompanyModalEls = App.elements.editCompanyModal;
                if (editCompanyModalEls.closeBtn) editCompanyModalEls.closeBtn.addEventListener('click', () => this.closeEditCompanyModal());
                if (editCompanyModalEls.cancelBtn) editCompanyModalEls.cancelBtn.addEventListener('click', () => this.closeEditCompanyModal());
                if (editCompanyModalEls.saveBtn) editCompanyModalEls.saveBtn.addEventListener('click', () => App.actions.saveCompanyModuleChanges());
                if (editCompanyModalEls.overlay) editCompanyModalEls.overlay.addEventListener('click', (e) => { if (e.target === editCompanyModalEls.overlay) this.closeEditCompanyModal(); });

                const cpModal = App.elements.changePasswordModal;
                if (App.elements.userMenu.changePasswordBtn) App.elements.userMenu.changePasswordBtn.addEventListener('click', () => cpModal.overlay.classList.add('show'));
                if (cpModal.closeBtn) cpModal.closeBtn.addEventListener('click', () => cpModal.overlay.classList.remove('show'));
                if (cpModal.cancelBtn) cpModal.cancelBtn.addEventListener('click', () => cpModal.overlay.classList.remove('show'));
                if (cpModal.saveBtn) cpModal.saveBtn.addEventListener('click', () => App.actions.changePassword());

                const companyConfigEls = App.elements.companyConfig;
                if (companyConfigEls.logoUploadArea) companyConfigEls.logoUploadArea.addEventListener('click', () => companyConfigEls.logoInput.click());
                if (companyConfigEls.logoInput) companyConfigEls.logoInput.addEventListener('change', (e) => App.actions.handleLogoUpload(e));
                if (companyConfigEls.removeLogoBtn) companyConfigEls.removeLogoBtn.addEventListener('click', () => App.actions.removeLogo());
                if (companyConfigEls.shapefileUploadArea) companyConfigEls.shapefileUploadArea.addEventListener('click', () => companyConfigEls.shapefileInput.click());
                if (companyConfigEls.shapefileInput) companyConfigEls.shapefileInput.addEventListener('change', (e) => App.mapModule.handleShapefileUpload(e));
                if (companyConfigEls.btnTestShapefileDebug) {
                    companyConfigEls.btnTestShapefileDebug.addEventListener('click', () => App.mapModule.runShapefileDebugTest());
                    const isDebugMode = new URLSearchParams(window.location.search).get('debug') === '1';
                    if (isDebugMode) {
                        companyConfigEls.btnTestShapefileDebug.style.display = 'inline-flex';
                        setTimeout(() => App.mapModule.runShapefileDebugTest(), 1200);
                    }
                }

                const configModal = App.elements.configHistoryModal;
                if (configModal.overlay) configModal.overlay.addEventListener('click', (e) => { if (e.target === configModal.overlay) App.ui.hideConfigHistoryModal(); });
                if (configModal.closeBtn) configModal.closeBtn.addEventListener('click', () => App.ui.hideConfigHistoryModal());
                if (configModal.cancelBtn) configModal.cancelBtn.addEventListener('click', () => App.ui.hideConfigHistoryModal());

                document.querySelectorAll('[data-module-target], [data-tab-target]').forEach((btn) => {
                    btn.addEventListener('click', () => {
                        const target = btn.dataset.moduleTarget || btn.dataset.tabTarget;
                        if (target) App.ui.showTab(target);
                    });
                });
            }
        },

        regApp: {
            init() {
                this.populateFarmSelect();
                this.setupEventListeners();
                this.initMap();
                // Set default date
                App.elements.regApp.date.value = new Date().toISOString().split('T')[0];
            },

            setupEventListeners() {
                const els = App.elements.regApp;
                if (!els.farmSelect) return;

                els.farmSelect.addEventListener('change', () => this.handleFarmChange());
                els.btnSave.addEventListener('click', () => this.saveRegistro());

                if (els.btnCenterMap) {
                    els.btnCenterMap.addEventListener('click', () => {
                        const farmId = els.farmSelect.value;
                        if (farmId) {
                            const farm = App.state.fazendas.find(f => f.id === farmId);
                            if (farm) this.zoomToFarm(farm.code);
                        }
                    });
                }

                const btnTogglePanel = document.getElementById('btnToggleRegAppPanel');
                if (btnTogglePanel) {
                    btnTogglePanel.addEventListener('click', () => this.toggleMapSize());
                }
                const btnRecolherMapa = document.getElementById('btn-recolher-mapa-regapp');
                if (btnRecolherMapa) {
                    btnRecolherMapa.addEventListener('click', () => this.toggleMapSize());
                }
                const btnMobileToggleMap = document.getElementById('btnMobileToggleRegAppMap');
                if (btnMobileToggleMap) {
                    btnMobileToggleMap.addEventListener('click', () => this.toggleMapSize());
                }

                // Shift change listener to update map colors
                els.shiftRadios.forEach(radio => {
                    radio.addEventListener('change', () => this.updateMapVisualization());
                });
            },

            initMap() {
                if (App.state.regAppMap) {
                    this.loadShapes();
                    setTimeout(() => App.state.regAppMap.resize(), 200);
                    return;
                }

                const mapContainer = App.elements.regApp.mapContainer;
                if (!mapContainer) return;

                mapboxgl.accessToken = 'pk.eyJ1IjoiY2FybG9zaGduIiwiYSI6ImNtZDk0bXVxeTA0MTcyam9sb2h1dDhxaG8ifQ.uf0av4a0WQ9sxM1RcFYT2w';

                App.state.regAppMap = new mapboxgl.Map({
                    container: mapContainer,
                    style: 'mapbox://styles/mapbox/satellite-streets-v12',
                    center: [-48.45, -21.17],
                    zoom: 10,
                    attributionControl: false
                });

                const map = App.state.regAppMap;

                map.on('load', () => {
                    this.loadShapes();
                    const farmId = App.elements.regApp.farmSelect.value;
                    if (farmId) {
                        const farm = App.state.fazendas.find(f => f.id === farmId);
                        if (farm) {
                            this.filterMap(farm.code);
                            this.zoomToFarm(farm.code);
                        }
                    }
                });

                // Generic Click Listener for Map (Handles both selection and direction setting)
                map.on('click', (e) => {
                    // 1. Direction Selection Mode
                    if (App.state.regAppDirectionTarget) {
                        this.handleDirectionClick(e.lngLat);
                        return;
                    }

                    // 2. Plot Selection Mode
                    const features = map.queryRenderedFeatures(e.point, { layers: ['regapp-talhoes-layer'] });
                    if (features.length > 0) {
                        const feature = features[0];
                        this.togglePlotSelection(feature, true);
                    }
                });

                // Hover Effects
                let hoveredFeatureId = null;
                map.on('mousemove', 'regapp-talhoes-layer', (e) => {
                    if (App.state.regAppDirectionTarget) {
                        map.getCanvas().style.cursor = 'crosshair';
                    } else {
                        map.getCanvas().style.cursor = 'pointer';
                    }

                    if (e.features.length > 0) {
                        if (hoveredFeatureId !== null) {
                            map.setFeatureState({ source: 'regapp-talhoes-source', id: hoveredFeatureId }, { hover: false });
                        }
                        hoveredFeatureId = e.features[0].id;
                        map.setFeatureState({ source: 'regapp-talhoes-source', id: hoveredFeatureId }, { hover: true });
                    }
                });

                map.on('mouseleave', 'regapp-talhoes-layer', () => {
                    map.getCanvas().style.cursor = '';
                    if (hoveredFeatureId !== null) {
                        map.setFeatureState({ source: 'regapp-talhoes-source', id: hoveredFeatureId }, { hover: false });
                        hoveredFeatureId = null;
                    }
                });
            },

            getPrincipalDirection(feature) {
                try {
                    let maxDist = 0;
                    let bearing = 0;
                    let coords = feature.geometry.coordinates;

                    if (feature.geometry.type === 'MultiPolygon') {
                        coords = coords[0]; // Take the first polygon
                    }

                    // coords is now [ring1, ring2...]. ring1 is outer.
                    const ring = coords[0];

                    for (let i = 0; i < ring.length - 1; i++) {
                        const start = turf.point(ring[i]);
                        const end = turf.point(ring[i+1]);
                        const dist = turf.distance(start, end);
                        if (dist > maxDist) {
                            maxDist = dist;
                            bearing = turf.bearing(start, end);
                        }
                    }
                    return bearing;
                } catch (e) {
                    console.error("Error calculating direction:", e);
                    return 0;
                }
            },

            handleDirectionClick(lngLat) {
                const map = App.state.regAppMap;

                // STEP 1: If no start point, set it and wait for second click
                if (!App.state.regAppStartPoint) {
                    App.state.regAppStartPoint = lngLat;

                    // Add visual marker for start point
                    const markerEl = document.createElement('div');
                    markerEl.className = 'temp-start-marker';
                    markerEl.style.width = '15px';
                    markerEl.style.height = '15px';
                    markerEl.style.backgroundColor = '#4caf50'; // Green
                    markerEl.style.borderRadius = '50%';
                    markerEl.style.border = '2px solid white';
                    markerEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';

                    new mapboxgl.Marker(markerEl)
                        .setLngLat(lngLat)
                        .addTo(map);

                    // Store marker instance on map object to remove later
                    map.tempStartMarker = markerEl;

                    App.ui.showAlert("Ponto de INÍCIO definido. Agora clique no ponto onde a aplicação PAROU.", "info", 5000);
                    return;
                }

                // STEP 2: Second click - Calculate Direction and Sweep
                const startLngLat = App.state.regAppStartPoint;
                const endLngLat = lngLat;
                const talhaoId = App.state.regAppDirectionTarget;

                // Calculate bearing from Start to End
                const startPoint = turf.point([startLngLat.lng, startLngLat.lat]);
                const endPoint = turf.point([endLngLat.lng, endLngLat.lat]);
                const bearing = turf.bearing(startPoint, endPoint);

                // Update State
                const currentData = App.state.regAppSelectedPlots.get(talhaoId);
                if (currentData) {
                    const side = currentData.side || 'left';
                    const anchor = currentData.anchor || 'edge';
                    // Update state with new bearing AND the start point coordinates
                    this.updateSelectedState(talhaoId, currentData.totalArea, true, currentData.appliedArea, bearing, startLngLat, side, anchor);
                    App.ui.showAlert(`Direção definida! (Ângulo: ${bearing.toFixed(0)}°)`, 'success');
                }

                // Cleanup
                if (map.tempStartMarker) {
                    map.tempStartMarker.remove();
                    delete map.tempStartMarker;
                }
                document.querySelectorAll('.temp-start-marker').forEach(el => el.remove());

                App.state.regAppStartPoint = null;
                App.state.regAppDirectionTarget = null;
                map.getCanvas().style.cursor = '';
            },

            calculateCutPolygon(originalFeature, targetAreaHa, bearing, startPointCoords, side = 'left', anchor = 'edge') {
                try {
                    let pivot = turf.centroid(originalFeature);
                    if (startPointCoords) {
                        pivot = turf.point([startPointCoords.lng, startPointCoords.lat]);
                    }

                    // Rotate so Bearing points NORTH (Y-Axis)
                    const rotated = turf.transformRotate(originalFeature, -bearing, { pivot: pivot });

                    const bbox = turf.bbox(rotated); // [minX, minY, maxX, maxY]
                    const minX = bbox[0];
                    const maxX = bbox[2];
                    const minY = bbox[1];
                    const maxY = bbox[3];

                    const pivotCoord = pivot.geometry.coordinates;
                    const lineX = pivotCoord[0];

                    const targetAreaSqm = targetAreaHa * 10000;
                    const tolerance = targetAreaSqm * 0.05;

                    let finalSlice = null;
                    let sweepMinX, sweepMaxX;
                    let low, high;

                    // Standardize search range based on selection
                    if (side === 'left') {
                        // Filling the Left/West side
                        if (anchor === 'edge') {
                            // Start from minX, grow towards maxX
                            low = minX; high = maxX;
                        } else {
                            // Start from lineX, grow towards minX (Left)
                            // Interval is [midX, lineX]
                            low = minX; high = lineX;
                        }
                    } else { // right
                        // Filling the Right/East side
                        if (anchor === 'edge') {
                            // Start from maxX, grow towards minX
                            low = minX; high = maxX;
                        } else {
                            // Start from lineX, grow towards maxX (Right)
                            low = lineX; high = maxX;
                        }
                    }

                    // Binary search
                    for(let i=0; i<20; i++) {
                        const midX = (low + high) / 2;
                        let clipPoly;

                        if (side === 'left') {
                            if (anchor === 'edge') {
                                clipPoly = turf.bboxPolygon([minX, minY, midX, maxY]);
                            } else { // line
                                clipPoly = turf.bboxPolygon([midX, minY, lineX, maxY]);
                            }
                        } else { // right
                            if (anchor === 'edge') {
                                clipPoly = turf.bboxPolygon([midX, minY, maxX, maxY]);
                            } else { // line
                                clipPoly = turf.bboxPolygon([lineX, minY, midX, maxY]);
                            }
                        }

                        let sliced = null;
                        try {
                            sliced = turf.intersect(rotated, clipPoly);
                        } catch(e) {
                            try { sliced = turf.intersect(turf.featureCollection([rotated, clipPoly])); } catch(e2){}
                        }

                        if (!sliced) {
                            // Empty intersection: adjust bounds to find the shape
                            if (side === 'left') {
                                if (anchor === 'edge') low = midX; // Move right to find shape
                                else high = midX; // Move left?
                            } else {
                                if (anchor === 'edge') high = midX; // Move left to find shape
                                else low = midX;
                            }
                            continue;
                        }

                        const currentArea = turf.area(sliced);

                        if (Math.abs(currentArea - targetAreaSqm) < tolerance) {
                            finalSlice = sliced;
                            break;
                        }

                        if (currentArea < targetAreaSqm) {
                            // Need MORE area -> Expand
                            if (side === 'left') {
                                if (anchor === 'edge') low = midX; // Expand right
                                else high = midX; // Expand left (towards minX)
                            } else { // right
                                if (anchor === 'edge') high = midX; // Expand left
                                else low = midX; // Expand right (towards maxX)
                            }
                            finalSlice = sliced;
                        } else {
                            // Need LESS area -> Shrink
                            if (side === 'left') {
                                if (anchor === 'edge') high = midX;
                                else low = midX;
                            } else { // right
                                if (anchor === 'edge') low = midX;
                                else high = midX;
                            }
                        }
                    }

                    if (finalSlice) {
                        return turf.transformRotate(finalSlice, bearing, { pivot: pivot });
                    }
                    return originalFeature;
                } catch (e) {
                    console.error("Error calculating cut polygon:", e);
                    return originalFeature;
                }
            },

            loadShapes() {
                const map = App.state.regAppMap;
                if (!map || !App.state.geoJsonData) return;

                const sourceId = 'regapp-talhoes-source';
                const layerId = 'regapp-talhoes-layer';
                const appliedLayerId = 'regapp-applied-layer';
                const borderLayerId = 'regapp-border-layer';
                const labelLayerId = 'regapp-labels';

                if (map.getSource(sourceId)) {
                    map.getSource(sourceId).setData(App.state.geoJsonData);
                } else {
                    map.addSource(sourceId, {
                        type: 'geojson',
                        data: App.state.geoJsonData,
                        generateId: true
                    });
                }

                const themeColors = App.ui._getThemeColors();

                // Base Layer (Similar to OS Manual style)
                if (!map.getLayer(layerId)) {
                    map.addLayer({
                        id: layerId,
                        type: 'fill',
                        source: sourceId,
                        paint: {
                            'fill-color': [
                                'case',
                                ['boolean', ['feature-state', 'selected'], false], themeColors.primary,
                                ['boolean', ['feature-state', 'hover'], false], '#607D8B',
                                '#1C1C1C'
                            ],
                            'fill-opacity': [
                                'case',
                                ['boolean', ['feature-state', 'selected'], false], 0.9,
                                ['boolean', ['feature-state', 'hover'], false], 0.8,
                                0.7
                            ]
                        }
                    });
                }

                // Applied Areas Layer (colored by Shift)
                if (!map.getSource('regapp-applied-source')) {
                    map.addSource('regapp-applied-source', {
                        type: 'geojson',
                        data: { type: 'FeatureCollection', features: [] }
                    });
                }

                if (!map.getLayer(appliedLayerId)) {
                    map.addLayer({
                        id: appliedLayerId,
                        type: 'fill',
                        source: 'regapp-applied-source',
                        paint: {
                            'fill-color': ['get', 'color'],
                            'fill-opacity': 0.7
                        }
                    });
                }

                // Labels (Same style as OS Manual)
                if (!map.getLayer(labelLayerId)) {
                    map.addLayer({
                        id: labelLayerId,
                        type: 'symbol',
                        source: sourceId,
                        minzoom: 10,
                        layout: {
                            'symbol-placement': 'point',
                            'text-field': [
                                'format',
                                ['upcase', ['get', 'AGV_FUNDO']], { 'font-scale': 0.9 },
                                '\n', {},
                                ['upcase', ['get', 'AGV_TALHAO']], { 'font-scale': 1.2 }
                            ],
                            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                            'text-size': 14,
                            'text-ignore-placement': true,
                            'text-allow-overlap': true,
                            'text-pitch-alignment': 'viewport',
                        },
                        paint: {
                            'text-color': '#FFFFFF',
                            'text-halo-color': 'rgba(0, 0, 0, 0.9)',
                            'text-halo-width': 2
                        }
                    });
                }

                // Borders (Same style as OS Manual)
                if (!map.getLayer(borderLayerId)) {
                     map.addLayer({
                        id: borderLayerId,
                        type: 'line',
                        source: sourceId,
                        paint: {
                            'line-color': [
                                'case',
                                ['boolean', ['feature-state', 'selected'], false], '#00FFFF',
                                '#FFFFFF'
                            ],
                            'line-width': [
                                'case',
                                ['boolean', ['feature-state', 'selected'], false], 3,
                                1.5
                            ],
                            'line-opacity': 0.9
                        }
                    });
                }
            },

            populateFarmSelect() {
                const select = App.elements.regApp.farmSelect;
                if (!select) return;
                const currentValue = select.value;
                select.innerHTML = '<option value="">Selecione uma fazenda...</option>';
                App.state.fazendas.sort((a, b) => parseInt(a.code) - parseInt(b.code)).forEach(farm => {
                    select.innerHTML += `<option value="${farm.id}">${farm.code} - ${farm.name}</option>`;
                });
                select.value = currentValue;
            },

            handleFarmChange() {
                // Ensure map is loaded with data if it arrived late
                this.loadShapes();

                const farmId = App.elements.regApp.farmSelect.value;
                const farm = App.state.fazendas.find(f => f.id === farmId);

                App.state.regAppSelectedPlots.clear();
                this.updateMapVisualization(); // Clear applied layer

                if (farm) {
                    this.renderPlotsList(farm.talhoes);
                    this.zoomToFarm(farm.code);
                    this.filterMap(farm.code);
                } else {
                    App.elements.regApp.plotsList.innerHTML = '<p style="color: #888; text-align: center;">Selecione uma fazenda para ver os talhões.</p>';
                }
            },

            renderPlotsList(talhoes) {
                const listContainer = App.elements.regApp.plotsList;
                listContainer.innerHTML = '';

                if (!talhoes || talhoes.length === 0) {
                    listContainer.innerHTML = '<p>Nenhum talhão encontrado.</p>';
                    return;
                }

                talhoes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).forEach(talhao => {
                    const container = document.createElement('div');
                    container.className = 'talhao-selection-item-wrapper';
                    container.style.marginBottom = '10px';
                    container.style.backgroundColor = 'var(--color-surface)';
                    container.style.border = '1px solid var(--color-border)';
                    container.style.borderRadius = 'var(--border-radius)';
                    container.style.overflow = 'hidden';

                    const header = document.createElement('div');
                    header.style.padding = '12px';
                    header.style.display = 'grid';
                    header.style.gridTemplateColumns = 'auto 1fr';
                    header.style.gap = '10px';
                    header.style.alignItems = 'center';
                    header.style.cursor = 'pointer';

                    header.innerHTML = `
                        <input type="checkbox" id="regapp-plot-${talhao.id}" data-id="${talhao.id}">
                        <div>
                            <div style="font-weight: 600; color: var(--color-primary-dark);">${talhao.name}</div>
                            <div style="font-size: 13px; color: var(--color-text-light);">Área Total: ${talhao.area.toFixed(2)} ha</div>
                        </div>
                    `;

                    const details = document.createElement('div');
                    details.id = `regapp-details-${talhao.id}`;
                    details.style.display = 'none';
                    details.style.padding = '10px 12px 12px';
                    details.style.backgroundColor = 'var(--color-bg)';
                    details.style.borderTop = '1px solid var(--color-border)';

                    details.innerHTML = `
                        <div style="margin-bottom: 8px;">
                            <label style="display: flex; align-items: center; font-size: 14px; cursor: pointer;">
                                <input type="checkbox" class="partial-check" style="width: auto; margin-right: 8px;"> Aplicação Parcial?
                            </label>
                        </div>
                        <div class="partial-inputs" style="display: none; flex-direction: column; gap: 10px;">
                            <div style="display: flex; gap: 10px; width: 100%; align-items: flex-end;">
                                <div style="flex: 1; min-width: 100px;">
                                    <label style="font-size: 12px; display: block; margin-bottom: 2px;">Área (ha)</label>
                                    <input type="number" class="partial-area-input" max="${talhao.area}" placeholder="0.00">
                                </div>
                                <div style="flex: 1; min-width: 120px;">
                                    <button type="button" class="btn-pick-direction save" style="width:100%; padding: 8px; font-size: 12px; background: var(--color-warning);">
                                        <i class="fas fa-route"></i> Definir Direção
                                    </button>
                                </div>
                            </div>

                            <!-- Side Selection -->
                            <div style="width: 100%; background: rgba(0,0,0,0.03); padding: 8px; border-radius: 4px;">
                                <div style="display: flex; gap: 15px; margin-bottom: 5px;">
                                    <div style="flex: 1;">
                                        <label style="font-size: 11px; font-weight: bold; display: block; margin-bottom: 4px;">Lado do Preenchimento:</label>
                                        <div style="display: flex; gap: 10px;">
                                            <label style="font-size: 12px; cursor: pointer; display: flex; align-items: center;">
                                                <input type="radio" name="fill-side-${talhao.id}" value="left" checked style="width:auto; margin-right:4px;"> Esq.
                                            </label>
                                            <label style="font-size: 12px; cursor: pointer; display: flex; align-items: center;">
                                                <input type="radio" name="fill-side-${talhao.id}" value="right" style="width:auto; margin-right:4px;"> Dir.
                                            </label>
                                        </div>
                                    </div>
                                    <div style="flex: 1;">
                                        <label style="font-size: 11px; font-weight: bold; display: block; margin-bottom: 4px;">Ponto de Início:</label>
                                        <div style="display: flex; gap: 10px;">
                                            <label style="font-size: 12px; cursor: pointer; display: flex; align-items: center;">
                                                <input type="radio" name="fill-anchor-${talhao.id}" value="edge" checked style="width:auto; margin-right:4px;"> Borda
                                            </label>
                                            <label style="font-size: 12px; cursor: pointer; display: flex; align-items: center;">
                                                <input type="radio" name="fill-anchor-${talhao.id}" value="line" style="width:auto; margin-right:4px;"> Linha
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;

                    const mainCheckbox = header.querySelector('input[type="checkbox"]');
                    const partialCheck = details.querySelector('.partial-check');
                    const partialInputs = details.querySelector('.partial-inputs');
                    const areaInput = details.querySelector('.partial-area-input');
                    const pickDirectionBtn = details.querySelector('.btn-pick-direction');
                    const sideRadios = details.querySelectorAll(`input[name="fill-side-${talhao.id}"]`);
                    const anchorRadios = details.querySelectorAll(`input[name="fill-anchor-${talhao.id}"]`);

                    // Event Listeners
                    header.addEventListener('click', (e) => {
                        if (e.target !== mainCheckbox) {
                            // Toggle checkbox manually
                            mainCheckbox.checked = !mainCheckbox.checked;
                            this.handleSelectionChange(talhao, mainCheckbox.checked);
                        }
                    });

                    mainCheckbox.addEventListener('change', (e) => {
                        this.handleSelectionChange(talhao, e.target.checked);
                    });

                    const updateState = () => {
                        let val = parseFloat(areaInput.value);
                        if (isNaN(val) || val < 0) val = 0;
                        if (val > talhao.area) {
                            val = talhao.area;
                            areaInput.value = val.toFixed(2);
                            App.ui.showAlert("A área aplicada não pode ser maior que a área total.", "warning");
                        }

                        const currentData = App.state.regAppSelectedPlots.get(talhao.id);
                        const bearing = currentData ? currentData.direction : 0;
                        const startPoint = currentData ? currentData.startPoint : null;
                        const side = details.querySelector(`input[name="fill-side-${talhao.id}"]:checked`).value;
                        const anchor = details.querySelector(`input[name="fill-anchor-${talhao.id}"]:checked`).value;

                        this.updateSelectedState(talhao.id, talhao.area, true, val, bearing, startPoint, side, anchor);
                    };

                    partialCheck.addEventListener('change', (e) => {
                        const isPartial = e.target.checked;
                        partialInputs.style.display = isPartial ? 'flex' : 'none';

                        let currentVal = parseFloat(areaInput.value);

                        if (isPartial) {
                            if (isNaN(currentVal) || currentVal <= 0) {
                                currentVal = parseFloat(talhao.area.toFixed(2));
                                areaInput.value = currentVal;
                            }
                            updateState();
                        } else {
                            this.updateSelectedState(talhao.id, talhao.area, false, talhao.area, 0);
                        }
                    });

                    areaInput.addEventListener('input', updateState);
                    sideRadios.forEach(r => r.addEventListener('change', updateState));
                    anchorRadios.forEach(r => r.addEventListener('change', updateState));

                    pickDirectionBtn.innerHTML = '<i class="fas fa-route"></i> Definir Pontos (Início -> Fim)';
                    pickDirectionBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        App.state.regAppDirectionTarget = talhao.id;
                        App.state.regAppStartPoint = null; // Reset start point for new selection
                        App.ui.showAlert("1. Clique no Ponto de INÍCIO da aplicação no mapa.", "info", 5000);
                        if(App.state.regAppMap) App.state.regAppMap.getCanvas().style.cursor = 'crosshair';
                    });

                    container.appendChild(header);
                    container.appendChild(details);
                    listContainer.appendChild(container);
                });
            },

            handleSelectionChange(talhao, isChecked) {
                const details = document.getElementById(`regapp-details-${talhao.id}`);
                const partialCheck = details.querySelector('.partial-check');
                const partialInputs = details.querySelector('.partial-inputs');
                const areaInput = details.querySelector('.partial-area-input');

                if (isChecked) {
                    details.style.display = 'block';

                    // Default values for new selection
                    const side = 'left';
                    const anchor = 'edge';

                    // Calculate automatic direction (Longest Edge)
                    let direction = 0;
                    let feature = null;

                    if(App.state.regAppMap) {
                        const farmCode = App.state.fazendas.find(f => f.id === App.elements.regApp.farmSelect.value)?.code;
                        feature = App.state.geoJsonData?.features.find(f => f.properties.AGV_TALHAO === talhao.name && String(f.properties.AGV_FUNDO) === String(farmCode));

                        if (feature) {
                            direction = this.getPrincipalDirection(feature);
                            // Initially select base layer
                            App.state.regAppMap.setFeatureState({ source: 'regapp-talhoes-source', id: feature.id }, { selected: true });
                        }
                    }

                    this.updateSelectedState(talhao.id, talhao.area, false, talhao.area, direction, null, side, anchor);

                } else {
                    details.style.display = 'none';
                    partialCheck.checked = false;
                    partialInputs.style.display = 'none';
                    areaInput.value = '';
                    this.removeSelection(talhao.id);

                    if(App.state.regAppMap) {
                        const farmCode = App.state.fazendas.find(f => f.id === App.elements.regApp.farmSelect.value)?.code;
                        const feature = App.state.geoJsonData.features.find(f => f.properties.AGV_TALHAO === talhao.name && String(f.properties.AGV_FUNDO) === String(farmCode));
                        if(feature) App.state.regAppMap.setFeatureState({ source: 'regapp-talhoes-source', id: feature.id }, { selected: false });
                    }
                }
            },

            togglePlotSelection(featureOrTalhao, fromMap = false) {
                let talhao, talhaoId;

                if (fromMap) {
                    const talhaoName = featureOrTalhao.properties.AGV_TALHAO;
                    const farmCode = featureOrTalhao.properties.AGV_FUNDO;
                    const farm = App.state.fazendas.find(f => f.code == farmCode);
                    if (!farm) return;
                    talhao = farm.talhoes.find(t => t.name.toUpperCase() === talhaoName.toUpperCase());
                    if (!talhao) return;
                    talhaoId = talhao.id;
                } else {
                    talhao = featureOrTalhao;
                    talhaoId = talhao.id;
                }

                const checkbox = document.getElementById(`regapp-plot-${talhaoId}`);
                if (!checkbox) return;

                const newState = !checkbox.checked;
                checkbox.checked = newState;

                this.handleSelectionChange(talhao, newState);
            },

            updateSelectedState(talhaoId, totalArea, isPartial, appliedArea, direction, startPoint = null, side = 'left', anchor = 'edge') {
                App.state.regAppSelectedPlots.set(talhaoId, {
                    totalArea,
                    isPartial,
                    appliedArea: isPartial ? appliedArea : totalArea,
                    direction: direction,
                    startPoint: startPoint,
                    side: side,
                    anchor: anchor
                });
                this.updateMapVisualization();
            },

            removeSelection(talhaoId) {
                App.state.regAppSelectedPlots.delete(talhaoId);
                this.updateMapVisualization();
            },

            updateMapVisualization() {
                const map = App.state.regAppMap;
                const selectedShift = document.querySelector('input[name="regAppShift"]:checked').value;
                const colors = { 'A': '#2196F3', 'B': '#FF9800', 'C': '#9C27B0' };
                const color = colors[selectedShift];

                const features = [];
                const farmCode = App.state.fazendas.find(f => f.id === App.elements.regApp.farmSelect.value)?.code;

                if (!farmCode || !App.state.geoJsonData) return;

                App.state.regAppSelectedPlots.forEach((data, talhaoId) => {
                    const farm = App.state.fazendas.find(f => f.code == farmCode);
                    const talhao = farm.talhoes.find(t => t.id == talhaoId);

                    if (!talhao) return;

                    const originalFeature = App.state.geoJsonData.features.find(f =>
                        f.properties.AGV_TALHAO === talhao.name &&
                        String(f.properties.AGV_FUNDO) === String(farmCode)
                    );

                    if (!originalFeature) return;

                    if (data.isPartial && data.appliedArea < data.totalArea && data.appliedArea > 0) {
                        let finalFeature = originalFeature;
                        let bearing = 0;

                        if (typeof data.direction === 'number') {
                            bearing = data.direction;
                        } else {
                            const mapDir = { 'N': 0, 'E': 90, 'S': 180, 'W': -90 };
                            bearing = mapDir[data.direction] !== undefined ? mapDir[data.direction] : 0;
                        }

                        // Use the new sweep algorithm with side/anchor
                        finalFeature = this.calculateCutPolygon(originalFeature, data.appliedArea, bearing, data.startPoint, data.side, data.anchor);

                        if (finalFeature) {
                            finalFeature.properties = { ...finalFeature.properties, color: color };
                            features.push(finalFeature);
                        }

                        // For partials, unselect the base layer so the dark background remains visible
                        if(map.getLayer('regapp-talhoes-layer')) {
                             map.setFeatureState({ source: 'regapp-talhoes-source', id: originalFeature.id }, { selected: false });
                        }
                    } else {
                        // Full plot
                        features.push({ ...originalFeature, properties: { ...originalFeature.properties, color: color } });
                        // For full plots, we can also unselect base since the applied layer covers it
                        if(map.getLayer('regapp-talhoes-layer')) {
                             map.setFeatureState({ source: 'regapp-talhoes-source', id: originalFeature.id }, { selected: false });
                        }
                    }
                });

                if (map.getSource('regapp-applied-source')) {
                    map.getSource('regapp-applied-source').setData({
                        type: 'FeatureCollection',
                        features: features
                    });
                }
            },

            filterMap(farmCode) {
                const map = App.state.regAppMap;
                if (!map || !map.getLayer('regapp-talhoes-layer')) return;
                const filter = ['==', ['get', 'AGV_FUNDO'], String(farmCode)];
                map.setFilter('regapp-talhoes-layer', filter);
                map.setFilter('regapp-border-layer', filter);
                map.setFilter('regapp-labels', filter);
            },

            zoomToFarm(farmCode) {
                const map = App.state.regAppMap;
                if (!map || !App.state.geoJsonData) return;
                const features = App.state.geoJsonData.features.filter(f => f.properties.AGV_FUNDO == farmCode);
                if (features.length > 0) {
                    const collection = turf.featureCollection(features);
                    const bbox = turf.bbox(collection);
                    map.fitBounds(bbox, { padding: 20 });
                }
            },

            toggleMapSize() {
                const container = document.getElementById('registroAplicacao');
                const btnToggle = document.getElementById('btnToggleRegAppPanel');
                const btnRecolher = document.getElementById('btn-recolher-mapa-regapp');

                container.classList.toggle('map-expanded');
                const isExpanded = container.classList.contains('map-expanded');

                if (btnToggle) {
                    btnToggle.innerHTML = isExpanded ? '<i class="fas fa-compress-arrows-alt"></i>' : '<i class="fas fa-expand-arrows-alt"></i>';
                    btnToggle.title = isExpanded ? 'Recolher Mapa' : 'Expandir Mapa';
                }

                if (btnRecolher) {
                     if (window.innerWidth <= 768 && isExpanded) {
                        btnRecolher.style.display = 'flex';
                    } else {
                        btnRecolher.style.display = 'none';
                    }
                }

                if (App.state.regAppMap) {
                    setTimeout(() => App.state.regAppMap.resize(), 400);
                }
            },

            async saveRegistro() {
                const { farmSelect, date, product, dosage, operator } = App.elements.regApp;
                const shift = document.querySelector('input[name="regAppShift"]:checked').value;

                if (!farmSelect.value || !date.value || !product.value || !dosage.value) {
                    App.ui.showAlert("Preencha todos os campos obrigatórios (Fazenda, Data, Produto, Dosagem).", "error");
                    return;
                }

                if (App.state.regAppSelectedPlots.size === 0) {
                    App.ui.showAlert("Selecione pelo menos um talhão.", "error");
                    return;
                }

                const farm = App.state.fazendas.find(f => f.id === farmSelect.value);
                const plotsData = [];
                let totalAreaApplied = 0;

                App.state.regAppSelectedPlots.forEach((data, talhaoId) => {
                    const talhao = farm.talhoes.find(t => t.id === talhaoId);
                    if (talhao) {
                        plotsData.push({
                            talhaoId: talhao.id,
                            talhaoName: talhao.name,
                            totalArea: talhao.area,
                            appliedArea: data.appliedArea,
                            isPartial: data.isPartial,
                            direction: data.direction
                        });
                        totalAreaApplied += data.appliedArea;
                    }
                });

                const registroData = {
                    companyId: App.state.currentUser.companyId,
                    farmId: farm.id,
                    farmName: farm.name,
                    farmCode: farm.code,
                    date: date.value,
                    shift: shift,
                    product: product.value.trim(),
                    dosage: parseFloat(dosage.value),
                    operator: operator.value.trim(),
                    plots: plotsData,
                    totalAreaApplied: totalAreaApplied,
                    createdBy: App.state.currentUser.username
                };

                App.ui.showConfirmationModal("Confirmar registro de aplicação?", async () => {
                    App.ui.setLoading(true, "Salvando...");
                    try {
                        if (navigator.onLine) {
                            await App.data.addDocument('registroAplicacao', registroData);
                            App.ui.showAlert("Registro salvo com sucesso!", "success");
                        } else {
                            const entryId = `offline_regApp_${Date.now()}`;
                            await OfflineDB.add('offline-writes', { id: entryId, collection: 'registroAplicacao', data: registroData });
                            App.ui.showAlert('Salvo offline. Será enviado quando houver conexão.', 'info');
                        }

                        // Reset
                        product.value = '';
                        dosage.value = '';
                        operator.value = '';
                        App.state.regAppSelectedPlots.clear();
                        this.renderPlotsList(farm.talhoes); // Re-renders list to clear checks
                        this.updateMapVisualization();

                    } catch (error) {
                        console.error(error);
                        App.ui.showAlert("Erro ao salvar registro.", "error");
                    } finally {
                        App.ui.setLoading(false);
                    }
                });
            }
        },
        
        actions: {
            async fixClimateData() {
                App.ui.showConfirmationModal(
                    "Esta ação irá corrigir datas e formatos inconsistentes em todos os registros de clima importados. Deseja continuar?",
                    async () => {
                        App.ui.setLoading(true, "A corrigir dados de clima...");
                        try {
                            const token = await auth.currentUser.getIdToken();
                            const response = await fetch(`${App.config.backendUrl}/api/admin/fix-dates`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ companyId: App.state.currentUser.companyId })
                            });

                            const result = await response.json();
                            if (response.ok) {
                                App.ui.showAlert(`Correção concluída: ${result.message}`, "success");
                                // Opcional: Recarregar dados
                                window.location.reload();
                            } else {
                                throw new Error(result.message || "Falha na correção.");
                            }
                        } catch (error) {
                            console.error("Erro ao corrigir dados:", error);
                            App.ui.showAlert(`Erro: ${error.message}`, "error");
                        } finally {
                            App.ui.setLoading(false);
                        }
                    }
                );
            },

            async getWeatherForecast() {
                try {
                    const fazendas = App.state.fazendas;
                    if (!fazendas || fazendas.length === 0) {
                        console.warn("Nenhuma fazenda encontrada para previsão do tempo.");
                        return null;
                    }

                    // 1. Calculate centroid of all farms
                    const points = [];
                    fazendas.forEach(f => {
                        if (f.talhoes) {
                            f.talhoes.forEach(t => {
                                // Assuming talhao doesn't store geom yet in memory, but we might have map loaded
                                // Fallback: Use map center or just a known region if no geo data
                            });
                        }
                    });

                    // Better approach: Use the first farm's location if available, or map center
                    // Since we don't always have full GeoJSON loaded in state.fazendas,
                    // we'll try to use App.state.geoJsonData if available.

                    let centerLat, centerLng;

                    if (App.state.geoJsonData && App.state.geoJsonData.features && App.state.geoJsonData.features.length > 0) {
                        const center = turf.center(App.state.geoJsonData);
                        centerLng = center.geometry.coordinates[0];
                        centerLat = center.geometry.coordinates[1];
                    } else {
                        // Fallback generic location (e.g., Ribeirão Preto) if no data
                        centerLat = -21.17;
                        centerLng = -47.81;
                    }

                    // 2. Fetch from Open-Meteo
                    const url = `https://api.open-meteo.com/v1/forecast?latitude=${centerLat}&longitude=${centerLng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=America%2FSao_Paulo`;

                    const response = await fetch(url);
                    if (!response.ok) throw new Error("Falha na API de Clima");
                    return await response.json();

                } catch (error) {
                    console.error("Erro ao obter previsão do tempo:", error);
                    return null;
                }
            },


            async viewConfigHistory() {
                const modal = App.elements.configHistoryModal;
                if (!modal || !modal.body || !modal.overlay) return;
                modal.body.innerHTML = '<div class="spinner-container" style="display:flex; justify-content:center; padding: 20px;"><div class="spinner"></div></div>';
                modal.overlay.classList.add('show');

                try {
                    const q = query(
                        collection(db, 'configChangeHistory'),
                        where("companyId", "==", App.state.currentUser.companyId)
                    );
                    const querySnapshot = await getDocs(q);

                    if (querySnapshot.empty) {
                        modal.body.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--color-text-light);">Nenhum histórico de alterações encontrado.</p>';
                        return;
                    }

                    const logs = [];
                    querySnapshot.forEach(doc => logs.push(doc.data()));

                    logs.sort((a, b) => {
                        const timeA = (a.timestamp && a.timestamp.toMillis) ? a.timestamp.toMillis() : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
                        const timeB = (b.timestamp && b.timestamp.toMillis) ? b.timestamp.toMillis() : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
                        return timeB - timeA;
                    });

                    let contentHTML = '';
                    logs.forEach(log => {
                        const logTimestamp = log.timestamp && log.timestamp.toDate ? log.timestamp.toDate().toLocaleString('pt-BR') : 'Data não disponível';
                        contentHTML += `
                            <div class="plano-card" style="border-left-color: var(--color-purple);">
                                <div class="plano-header">
                                    <span class="plano-title"><i class="fas fa-user-edit"></i> Alterado por: ${log.username || 'Sistema'}</span>
                                    <span class="plano-status" style="background-color: var(--color-text-light); font-size: 12px; text-transform: none;">
                                        ${logTimestamp}
                                    </span>
                                </div>
                                <div class="plano-details" style="grid-template-columns: 1fr;">
                                    <div><strong>Alteração:</strong> ${log.alteracao}</div>
                                    <div><strong>De:</strong> ${log.valorAntigo}</div>
                                    <div><strong>Para:</strong> ${log.valorNovo}</div>
                                    <div style="margin-top: 8px;"><strong>Motivo:</strong> ${log.motivo}</div>
                                </div>
                            </div>
                        `;
                    });
                    modal.body.innerHTML = contentHTML;
                } catch (error) {
                    console.error("Erro ao carregar histórico de configurações:", error);
                    modal.body.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--color-danger);">Erro ao carregar o histórico.</p>';
                }
            },

            async checkActiveConnection() {
                if (App.state.isCheckingConnection || !navigator.onLine) return;
                App.state.isCheckingConnection = true;
                console.log("Actively checking internet connection...");
                try {
                    await fetch('https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js', {
                        mode: 'no-cors',
                        method: 'HEAD',
                        cache: 'no-store'
                    });

                    console.log("Active connection confirmed.");
                    if (App.state.connectionCheckInterval) {
                        clearInterval(App.state.connectionCheckInterval);
                        App.state.connectionCheckInterval = null;
                        console.log("Periodic connection check stopped.");
                    }
                    await App.auth.resumeOnlineSessionAndSync();
                } catch (error) {
                    console.warn("Active connection check failed. Still effectively offline.");
                } finally {
                    App.state.isCheckingConnection = false;
                }
            }
        }
    };

    window.onerror = function(message, source, lineno, colno, error) {
        logBootError('WINDOW:error', error || new Error(String(message)), {
            source: source || null,
            lineno: lineno || null,
            colno: colno || null,
        });
        return false;
    };

    window.addEventListener('unhandledrejection', (event) => {
        logBootError('WINDOW:unhandledrejection', event.reason instanceof Error ? event.reason : new Error(String(event.reason || 'Unhandled rejection')));
        if (App.state.isAuthenticated && !App.state.menuRenderedAt) {
            App.ui.renderFallbackMenu();
            App.ui.showAlert('Falha ao carregar alguns dados. Modo offline mínimo ativado.', 'warning', 5000);
        }
    });

    // Patch de compatibilidade após remoção agressiva de módulos
    const __originalSetupEventListeners = App.ui.setupEventListeners?.bind(App.ui);
    if (__originalSetupEventListeners) {
        App.ui.setupEventListeners = function() {
            try {
                return __originalSetupEventListeners();
            } catch (error) {
                logBootError('UI:setupEventListeners:error', error);
            }
        };
    }

    const __originalRenderAllDynamicContent = App.ui.renderAllDynamicContent?.bind(App.ui);
    if (__originalRenderAllDynamicContent) {
        App.ui.renderAllDynamicContent = function() {
            try {
                return __originalRenderAllDynamicContent();
            } catch (error) {
                logBootError('UI:renderAllDynamicContent:error', error);
            }
        };
    }

    const __originalShowTab = App.ui.showTab?.bind(App.ui);
    if (__originalShowTab) {
        App.ui.showTab = function(id) {
            const safeId = document.getElementById(id) ? id : 'estimativaSafra';
            try {
                return __originalShowTab(safeId);
            } catch (error) {
                logBootError('UI:showTab:error', error, { requestedTab: id, safeTab: safeId });
                if (safeId !== 'estimativaSafra' && document.getElementById('estimativaSafra')) {
                    return __originalShowTab('estimativaSafra');
                }
            }
        };
    }

    if (typeof App.actions.resetInactivityTimer !== 'function') {
        App.actions.resetInactivityTimer = function() {
            clearTimeout(App.state.inactivityTimer);
            clearTimeout(App.state.inactivityWarningTimer);
            if (!App.state.currentUser) return;
            App.state.inactivityWarningTimer = setTimeout(() => {
                const confirmationModal = App.elements.confirmationModal;
                if (!confirmationModal || !confirmationModal.overlay || !confirmationModal.title || !confirmationModal.message || !confirmationModal.confirmBtn || !confirmationModal.closeBtn || !confirmationModal.cancelBtn) {
                    return;
                }
                confirmationModal.title.textContent = 'Sessão prestes a expirar';
                confirmationModal.message.textContent = 'A sua sessão será encerrada em 1 minuto por inatividade. Deseja continuar conectado?';
                confirmationModal.confirmBtn.textContent = 'Continuar';
                confirmationModal.cancelBtn.style.display = 'none';
                const confirmHandler = () => {
                    App.actions.resetInactivityTimer();
                    closeHandler();
                };
                const closeHandler = () => {
                    confirmationModal.overlay.classList.remove('show');
                    confirmationModal.confirmBtn.removeEventListener('click', confirmHandler);
                    confirmationModal.closeBtn.removeEventListener('click', closeHandler);
                    setTimeout(() => {
                        confirmationModal.confirmBtn.textContent = 'Confirmar';
                        confirmationModal.cancelBtn.style.display = 'inline-flex';
                    }, 300);
                };
                confirmationModal.confirmBtn.addEventListener('click', confirmHandler);
                confirmationModal.closeBtn.addEventListener('click', closeHandler);
                confirmationModal.overlay.classList.add('show');
            }, App.config.inactivityTimeout - App.config.inactivityWarningTime);
            App.state.inactivityTimer = setTimeout(() => {
                App.ui.showAlert('Sessão expirada por inatividade.', 'warning');
                App.auth.logout();
            }, App.config.inactivityTimeout);
        };
    }

    const __noopAsync = async () => null;
    const __noop = () => null;
    if (typeof App.actions.loadNotificationHistory !== 'function') App.actions.loadNotificationHistory = __noopAsync;
    if (typeof App.actions.startGpsTracking !== 'function') App.actions.startGpsTracking = __noop;
    if (typeof App.actions.stopGpsTracking !== 'function') App.actions.stopGpsTracking = __noop;
    if (typeof App.actions.startAutoSync !== 'function') App.actions.startAutoSync = __noop;
    if (typeof App.actions.stopAutoSync !== 'function') App.actions.stopAutoSync = __noop;
    if (typeof App.actions.markNotificationsAsRead !== 'function') App.actions.markNotificationsAsRead = __noopAsync;
    if (typeof App.actions.clearAllNotifications !== 'function') App.actions.clearAllNotifications = __noopAsync;
    if (typeof App.actions.checkForDraft !== 'function') App.actions.checkForDraft = async () => false;
    if (typeof App.actions.checkSequence !== 'function') App.actions.checkSequence = __noop;



    if (!App.pwa) {
        App.pwa = {
            registerServiceWorker() {
                if (!('serviceWorker' in navigator)) return;
                window.addEventListener('load', async () => {
                    try {
                        const registration = await navigator.serviceWorker.register('./service-worker.js');
                        logBootStage('SW:registered', { scope: registration.scope });
                        try {
                            const swReady = await navigator.serviceWorker.ready;
                            logBootStage('SW:ready', { scope: swReady.scope });
                        } catch (readyError) {
                            logBootError('SW:ready:error', readyError);
                        }
                        if (registration.waiting) {
                            App.ui.showAlert('Atualização disponível. Aplicando nova versão...', 'info', 4000);
                            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                        }
                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            if (!newWorker) return;
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    App.ui.showAlert('Nova versão baixada. Atualizando...', 'info', 4000);
                                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                                }
                            });
                        });
                        let refreshing = false;
                        navigator.serviceWorker.addEventListener('controllerchange', () => {
                            if (refreshing) return;
                            refreshing = true;
                            App.ui.showAlert('Atualização disponível. Recarregando a aplicação...', 'info', 3500);
                            setTimeout(() => window.location.reload(), 1200);
                        });
                    } catch (error) {
                        logBootError('SW:error', error, { context: 'registerServiceWorker' });
                    }
                });
                window.addEventListener('beforeinstallprompt', (e) => {
                    e.preventDefault();
                    App.state.deferredInstallPrompt = e;
                    if (App.elements.installAppBtn) {
                        App.elements.installAppBtn.style.display = 'flex';
                    }
                });
            }
        };
    }

    if (typeof App.actions.getLocalUserProfiles !== 'function') {
        App.actions.getLocalUserProfiles = function() {
            try {
                return JSON.parse(localStorage.getItem('localUserProfiles') || '[]');
            } catch (error) {
                logBootError('AUTH:getLocalUserProfiles:error', error);
                return [];
            }
        };
    }

    if (typeof App.actions.saveUserProfileLocally !== 'function') {
        App.actions.saveUserProfileLocally = function(userProfile) {
            if (!userProfile || !userProfile.uid) return;
            const safeProfile = {
                uid: userProfile.uid,
                email: userProfile.email || '',
                username: userProfile.username || userProfile.email || '',
                lastLogin: new Date().toISOString()
            };
            const profiles = App.actions.getLocalUserProfiles();
            const index = profiles.findIndex((p) => p.uid === safeProfile.uid);
            if (index > -1) profiles[index] = safeProfile;
            else profiles.push(safeProfile);
            localStorage.setItem('localUserProfiles', JSON.stringify(profiles));
        };
    }

    if (typeof App.actions.removeUserProfileLocally !== 'function') {
        App.actions.removeUserProfileLocally = function(userId) {
            const profiles = App.actions.getLocalUserProfiles().filter((p) => p.uid !== userId);
            localStorage.setItem('localUserProfiles', JSON.stringify(profiles));
        };
    }


    // Patch final: restringe UI e chamadas apenas aos módulos mantidos
    const __allowedTabs = new Set(['estimativaSafra', 'configuracoesEmpresa', 'gerenciarEmpresas', 'gerenciarAtualizacoes']);
    const __safeNoop = () => null;
    const __safeAsyncNoop = async () => null;

    if (!App.mapModule) App.mapModule = {};
    ['initMap','hideTalhaoInfo','hideTrapInfo','promptInstallTrap','centerMapOnUser','toggleRiskView','hideTrapPlacementModal','installTrap','centerOnTrap','loadTraps','checkTrapStatusAndNotify','loadAndCacheShapes'].forEach((name) => {
        if (typeof App.mapModule[name] !== 'function') App.mapModule[name] = __safeNoop;
    });

    if (typeof App.actions.startSync !== 'function') App.actions.startSync = __safeAsyncNoop;
    if (typeof App.actions.getUnavailableTalhaoIds !== 'function') App.actions.getUnavailableTalhaoIds = () => new Set();
    if (typeof App.actions.ensureQualidadeDraft !== 'function') {
        App.actions.ensureQualidadeDraft = () => ({ activeTab: 'qual', itens: [], grupos: [], subamostras: [] });
    }
    if (typeof App.actions.cacheQualidadePlantioEntries !== 'function') App.actions.cacheQualidadePlantioEntries = __safeNoop;

    App.ui.renderAllDynamicContent = function() {
        try {
            if (typeof this.renderLogoPreview === 'function') this.renderLogoPreview();
            const activeTab = document.querySelector('.tab-content.active')?.id || 'estimativaSafra';
            if (activeTab === 'gerenciarEmpresas' && typeof this.renderCompaniesList === 'function') this.renderCompaniesList();
            if (activeTab === 'gerenciarAtualizacoes' && typeof this.renderAnnouncementsManager === 'function') this.renderAnnouncementsManager();
            if (activeTab === 'estimativaSafra' && App.estimativaSafra?.refresh) App.estimativaSafra.refresh();
        } catch (error) {
            logBootError('UI:renderAllDynamicContent:minimal:error', error);
        }
    };

    App.ui.renderSpecificContent = function(collectionName) {
        try {
            const activeTab = document.querySelector('.tab-content.active')?.id || 'estimativaSafra';
            if (collectionName === 'companies' && activeTab === 'gerenciarEmpresas' && typeof this.renderCompaniesList === 'function') {
                this.renderCompaniesList();
            }
            if (collectionName === 'estimativasSafra' && activeTab === 'estimativaSafra' && App.estimativaSafra?.refresh) {
                App.estimativaSafra.refresh();
            }
            if (collectionName === 'config' && activeTab === 'configuracoesEmpresa' && typeof this.renderLogoPreview === 'function') {
                this.renderLogoPreview();
            }
        } catch (error) {
            logBootError('UI:renderSpecificContent:minimal:error', error, { collectionName });
        }
    };

    App.ui.showTab = function(id) {
        const targetId = __allowedTabs.has(id) && document.getElementById(id) ? id : 'estimativaSafra';
        try {
            document.querySelectorAll('.tab-content').forEach((tab) => {
                tab.classList.remove('active');
                tab.hidden = true;
            });
            const estimativaContainer = App.elements.estimativaSafra?.container;
            if (estimativaContainer) estimativaContainer.classList.remove('active');

            const target = document.getElementById(targetId);
            if (target) {
                target.hidden = false;
                target.classList.add('active');
            }
            if (targetId === 'estimativaSafra') {
                if (estimativaContainer) estimativaContainer.classList.add('active');
                setTimeout(() => {
                    try {
                        if (App.estimativaSafra?.init) App.estimativaSafra.init();
                        else if (App.estimativaSafra?.refresh) App.estimativaSafra.refresh();
                    } catch (error) {
                        logBootError('ESTIMATIVA:init:error', error);
                    }
                }, 50);
            }
            if (targetId === 'configuracoesEmpresa') {
                if (typeof this.renderLogoPreview === 'function') this.renderLogoPreview();
            }
            if (targetId === 'gerenciarEmpresas' && typeof this.renderCompaniesList === 'function') {
                this.renderCompaniesList();
                if (typeof this.renderCompanyModules === 'function') this.renderCompanyModules('newCompanyModules');
                if (typeof this.renderGlobalFeatures === 'function') this.renderGlobalFeatures();
            }
            if (targetId === 'gerenciarAtualizacoes' && typeof this.renderAnnouncementsManager === 'function') {
                this.renderAnnouncementsManager();
            }
            localStorage.setItem('agrovetor_lastActiveTab', targetId);
            if (typeof this.closeAllMenus === 'function') this.closeAllMenus();
        } catch (error) {
            logBootError('UI:showTab:minimal:error', error, { requestedTab: id, targetId });
        }
    };

    window.addEventListener('offline', () => {
        logAereoOffline('network:browser:event', { connected: false });
        App.ui.showAlert("Conexão perdida. A operar em modo offline.", "warning");
        App.auth.onConnectivityChanged(false);
        if (App.state.connectionCheckInterval) {
            clearInterval(App.state.connectionCheckInterval);
            App.state.connectionCheckInterval = null;
            console.log("Periodic connection check stopped due to offline event.");
        }
    });

    window.addEventListener('online', () => {
        logAereoOffline('network:browser:event', { connected: true });
        console.log("Browser reports 'online'. Starting active connection checks.");
        App.auth.onConnectivityChanged(true);
        if (App.state.connectionCheckInterval) {
            clearInterval(App.state.connectionCheckInterval);
        }
        App.actions.checkActiveConnection();
        App.state.connectionCheckInterval = setInterval(() => App.actions.checkActiveConnection(), 15000);
    });


    // Patch v7: restaura a lógica real do mapa/SHP e do módulo Estimativa Safra
    App.mapModule = {
            async initMap() {
                if (App.state.mapboxMapInitPromise) {
                    logAereoOffline('init:skip:promise-active');
                    return App.state.mapboxMapInitPromise;
                }

                App.state.mapboxMapInitPromise = (async () => {
                    App.state.aerialMapProvider = createAerialMapProvider({ app: App });
                    App.state.useNativeAerialMap = App.state.aerialMapProvider?.kind === 'android-native';
                    App.ui.setMapTransparencyMode(App.state.useNativeAerialMap);
                    console.info('[AEREO_OFFLINE] init provider inicial:', {
                        providerKind: App.state.aerialMapProvider?.kind || null,
                        useNativeAerialMap: App.state.useNativeAerialMap
                    });
                    this.updateAndroidOfflineButtonsVisibility();

                    if (!App.state.useNativeAerialMap && typeof mapboxgl === 'undefined') {
                        console.error("Mapbox GL JS não está carregado.");
                        App.ui.showAlert("Erro ao carregar a biblioteca do mapa.", "error");
                        return;
                    }

                    logAereoOffline('init:start', {
                        native: isCapacitorNative(),
                        online: navigator.onLine,
                        provider: App.state.aerialMapProvider?.kind || 'desconhecido'
                    });

                    try {
                        if (App.state.useNativeAerialMap) {
                            await this.loadContoursOfflineSafe();
                            await App.state.aerialMapProvider.initMap();
                            if (App.state.geoJsonData) {
                                try {
                                    await App.state.aerialMapProvider.loadTalhoes(App.state.geoJsonData);
                                } catch (e) {
                                    logAereoOfflineError('init:native:loadTalhoes', e);
                                    console.warn('Contornos muito grandes para o limite de memória do plugin nativo.', e);
                                    App.ui.showAlert('Mapa carregado, porém alguns contornos não puderam ser exibidos (tamanho excedido).', 'warning', 6000);
                                }
                            }
                            this.watchUserPosition();
                            logAereoOffline('init:done:native', { hasContours: Boolean(App.state.geoJsonData?.features?.length) });
                            return;
                        }

                        await this._initMapInstanceSafe();
                        await this.loadBaseLayerOfflineSafe();
                        await this.loadContoursOfflineSafe();
                        this.watchUserPosition();
                        this.loadTraps();
                        logAereoOffline('init:done', { hasMap: Boolean(App.state.mapboxMap), hasContours: Boolean(App.state.geoJsonData?.features?.length) });
                    } catch (e) {
                        if (App.state.useNativeAerialMap) {
                            logAereoOfflineError('init:native:error_ignorado', e);
                            if (e?.code === 'offline_package_missing') {
                                App.ui.showAlert(e?.details || 'Região offline não baixada. Conecte-se e baixe.', 'warning', 7000);
                            } else {
                                console.warn('[AEREO_OFFLINE] Erro nativo detectado e silenciado para evitar fallback fatal e alertas falsos.', {
                                    message: e?.message,
                                    details: e?.details || null,
                                    code: e?.code || null
                                });
                                // Não disparamos showAlert aqui pois Mapbox offline sempre tem instabilidades iniciais de tile load
                                // que não são fatais. A activity já tratou de manter-se aberta.
                            }
                        } else {
                            logAereoOfflineError('init:error', e);
                            App.ui.showAlert("Não foi possível carregar o mapa.", "error");
                        }
                    } finally {
                        console.info('[AEREO_OFFLINE] estado final do provider:', {
                            fallback: !App.state.useNativeAerialMap,
                            useNativeAerialMap: App.state.useNativeAerialMap,
                            providerKind: App.state.aerialMapProvider?.kind || null
                        });
                        App.state.mapboxMapInitPromise = null;
                    }
                })();

                return App.state.mapboxMapInitPromise;
            },

            async _initMapInstanceSafe() {
                if (App.state.mapboxMap) {
                    if (App.state.mapboxMapIsLoaded) return;
                    await new Promise((resolve) => App.state.mapboxMap.once('load', resolve));
                    App.state.mapboxMapIsLoaded = true;
                    return;
                }

                if (App.state.mapboxMapInitializing) {
                    logAereoOffline('map:init:lock:wait');
                    while (App.state.mapboxMapInitializing) {
                        await new Promise((resolve) => setTimeout(resolve, 25));
                    }
                    return;
                }

                App.state.mapboxMapInitializing = true;
                const startedAt = performance.now();
                try {
                    mapboxgl.accessToken = 'pk.eyJ1IjoiY2FybG9zaGduIiwiYSI6ImNtZDk0bXVxeTA0MTcyam9sb2h1dDhxaG8ifQ.uf0av4a0WQ9sxM1RcFYT2w';
                    const mapContainer = App.elements.monitoramentoAereo.mapContainer;
                    logAereoOffline('map:init:create');

                    App.state.mapboxMap = new mapboxgl.Map({
                        container: mapContainer,
                        style: 'mapbox://styles/mapbox/satellite-streets-v12',
                        center: [-48.45, -21.17],
                        zoom: 12,
                        attributionControl: false
                    });

                    await new Promise((resolve, reject) => {
                        App.state.mapboxMap.once('load', () => resolve());
                        App.state.mapboxMap.once('error', (error) => reject(error?.error || error));
                    });
                    App.state.mapboxMapIsLoaded = true;
                    logAereoOffline('map:init:loaded', { ms: Math.round(performance.now() - startedAt) });
                } finally {
                    App.state.mapboxMapInitializing = false;
                }
            },

            async loadBaseLayerOfflineSafe() {
                if (!App.state.mapboxMap) return;
                try {
                    logAereoOffline('map:base-layer:ok', { styleLoaded: App.state.mapboxMap.isStyleLoaded?.() });
                    App.state.mapboxMap.resize();
                } catch (error) {
                    logAereoOfflineError('map:base-layer:error', error);
                    App.ui.showAlert('Sem base offline disponível. O mapa será exibido com fundo neutro.', 'warning', 5000);
                }
            },

            async loadContoursOfflineSafe() {
                const mapContainer = document.getElementById('map-container');
                if (mapContainer) mapContainer.classList.add('loading');
                const key = getContourCacheKey();
                App.state.activeContourCacheKey = key;
                logAereoOffline('contours:load:start', { key, online: navigator.onLine });

                try {
                    const loaded = await this._loadContoursFromStorage(key);
                    if (loaded) {
                        this.loadShapesOnMap();
                        if (App.state.useNativeAerialMap && App.state.aerialMapProvider) {
                            await App.state.aerialMapProvider.loadTalhoes(App.state.geoJsonData);
                        }
                        return;
                    }

                    if (navigator.onLine && App.state.companyConfig?.shapefileURL) {
                        await this.loadAndCacheShapes(App.state.companyConfig.shapefileURL);
                        return;
                    }

                    App.state.geoJsonData = null;
                    if (App.state.useNativeAerialMap) {
                        console.warn('[AEREO_OFFLINE] Contornos offline não encontrados, mas prosseguindo com inicialização do mapa nativo sem shapefiles.');
                    } else {
                        App.ui.showAlert('Contornos offline não encontrados. Conecte-se para baixar novamente.', 'warning', 7000);
                    }
                    logAereoOffline('contours:load:missing', { key, online: navigator.onLine });
                } catch (error) {
                    logAereoOfflineError('contours:load:error', error, { key });
                    App.state.geoJsonData = null;
                    if (App.state.useNativeAerialMap) {
                         console.warn('[AEREO_OFFLINE] Erro ao carregar contornos, prosseguindo com inicialização do mapa nativo sem shapefiles.', error);
                    } else {
                        App.ui.showAlert('Contornos offline indisponíveis no cache local. Conecte-se para atualizar.', 'warning', 8000);
                    }
                } finally {
                    if (mapContainer) mapContainer.classList.remove('loading');
                }
            },

            watchUserPosition() {
                if ('geolocation' in navigator) {
                    navigator.geolocation.watchPosition(
                        (position) => {
                            const { latitude, longitude } = position.coords;
                            this.updateUserPosition(latitude, longitude);
                        },
                        (error) => {
                            console.warn(`Erro de Geolocalização: ${error.message}`);
                            App.ui.showAlert("Não foi possível obter sua localização.", "warning");
                        },
                        { enableHighAccuracy: true, timeout: 27000, maximumAge: 60000 }
                    );
                } else {
                    App.ui.showAlert("Geolocalização não é suportada pelo seu navegador.", "error");
                }
            },

            updateUserPosition(lat, lng) {
                const userPosition = [lng, lat]; // Mapbox uses [lng, lat]
                
                if (!App.state.mapboxMap) return;

                if (!App.state.mapboxUserMarker) {
                    const el = document.createElement('div');
                    el.style.backgroundColor = '#4285F4';
                    el.style.width = '16px';
                    el.style.height = '16px';
                    el.style.borderRadius = '50%';
                    el.style.border = '2px solid #ffffff';

                    App.state.mapboxUserMarker = new mapboxgl.Marker(el)
                        .setLngLat(userPosition)
                        .addTo(App.state.mapboxMap);

                    App.state.mapboxMap.flyTo({ center: userPosition, zoom: 15 });
                } else {
                    App.state.mapboxUserMarker.setLngLat(userPosition);
                }
            },

            centerMapOnUser() {
                if (App.state.mapboxUserMarker) {
                    const userPosition = App.state.mapboxUserMarker.getLngLat();
                    App.state.mapboxMap.flyTo({ center: userPosition, zoom: 16 });
                } else {
                    App.ui.showAlert("Ainda não foi possível obter sua localização.", "info");
                }
            },

            async handleShapefileUpload(e) {
                const file = e.target.files[0];
                const input = e.target;
                if (!file) return;

                if (!file.name.toLowerCase().endsWith('.zip')) {
                    App.ui.showAlert("Por favor, selecione um arquivo .zip", "error");
                    input.value = '';
                    return;
                }

                const companyId = App.state.currentUser.companyId;
                if (!companyId) {
                    App.ui.showAlert("ID da empresa não encontrado. Não é possível fazer o upload.", "error");
                    return;
                }

                App.ui.setLoading(true, "A enviar o arquivo para o armazenamento...");

                const storageRef = ref(storage, `shapefiles/${companyId}/map.zip`);

                try {
                    const uploadResult = await uploadBytes(storageRef, file);
                    App.ui.setLoading(true, "A obter o link de download...");

                    const downloadURL = await getDownloadURL(uploadResult.ref);

                    await App.data.setDocument('config', companyId, { shapefileURL: downloadURL }, { merge: true });

                    App.ui.showAlert("Arquivo enviado com sucesso! O mapa será atualizado em breve.", "success");

                } catch (error) {
                    console.error("Erro no upload do shapefile:", error);
                    let errorMessage = "Ocorreu um erro durante o upload.";
                    if (error.code) {
                        switch (error.code) {
                            case 'storage/unauthorized':
                                errorMessage = "Não tem permissão para enviar arquivos. Verifique as regras de segurança do Storage.";
                                break;
                            case 'storage/canceled':
                                errorMessage = "O envio foi cancelado.";
                                break;
                            case 'storage/unknown':
                                errorMessage = "Ocorreu um erro desconhecido no servidor.";
                                break;
                        }
                    }
                    App.ui.showAlert(errorMessage, "error");
                } finally {
                    App.ui.setLoading(false);
                    input.value = '';
                }
            },

            _reprojectGeoJSON(geojson) {
                if (!window.proj4) {
                    console.warn('[SHP] Reprojeção indisponível no main thread (proj4 ausente).');
                    return;
                }
                if (!geojson || !geojson.features || !Array.isArray(geojson.features)) {
                    console.warn("GeoJSON inválido ou vazio para reprojeção.");
                    return;
                }

                const sourceProjection = "EPSG:31982"; // SIRGAS 2000 UTM Zone 22S
                const destProjection = "WGS84";

                geojson.features.forEach(feature => {
                    if (!feature.geometry || !feature.geometry.coordinates) return;

                    try {
                        const reprojectPolygon = (rings) => {
                            return rings.map(ring => {
                                return ring.map(coord => {
                                    // Ensure we only take [x, y] even if Z exists
                                    const p = [coord[0], coord[1]];
                                    return proj4(sourceProjection, destProjection, p);
                                });
                            });
                        };

                        if (feature.geometry.type === 'Polygon') {
                            feature.geometry.coordinates = reprojectPolygon(feature.geometry.coordinates);
                        } else if (feature.geometry.type === 'MultiPolygon') {
                            feature.geometry.coordinates = feature.geometry.coordinates.map(poly => reprojectPolygon(poly));
                        }
                    } catch (e) {
                        console.error("Erro ao reprojetar feature:", feature.id || 'unknown', e);
                    }
                });
                console.log(`Reprojeção de coordenadas de ${sourceProjection} para ${destProjection} concluída.`);
            },

            async loadAndCacheShapes(url) {
                const mapContainer = document.getElementById('map-container');
                if (!url) {
                    if (mapContainer) mapContainer.classList.remove('loading');
                    return;
                }

                const key = App.state.activeContourCacheKey || getContourCacheKey();
                const startedAt = performance.now();
                if (mapContainer) mapContainer.classList.add('loading');
                logAereoOffline('contours:network:fetch:start', { key, url });

                try {
                    const buffer = await readShapefileAsArrayBuffer(url, 'online');
                    logAereoOffline('contours:network:fetch:done', { key, bytes: buffer?.byteLength || 0, ms: Math.round(performance.now() - startedAt) });

                    const { geojson, debug } = await runShapefileWorker(buffer);
                    if (debug) {
                        logAereoOffline('contours:network:worker:debug', {
                            key,
                            sourceProjection: debug.sourceProjection || null,
                            reprojectedCount: debug.reprojectedCount || 0,
                            fallbackReason: debug.fallbackReason || null
                        });
                    }

                    const normalizedGeoJson = this._normalizeContourGeoJson(geojson);
                    await getContourStorageAdapter().save({ key, buffer, geojson: normalizedGeoJson });
                    App.state.geoJsonData = normalizedGeoJson;
                    if (App.state.mapboxMap) this.loadShapesOnMap();
                    logAereoOffline('contours:network:ready', {
                        key,
                        features: normalizedGeoJson.features?.length || 0,
                        ms: Math.round(performance.now() - startedAt)
                    });
                } catch (err) {
                    logAereoOfflineError('contours:network:error', err, { key, url });
                    App.ui.showAlert('Falha ao carregar contornos da rede. Tentando usar cache offline.', 'warning');
                    const restored = await this._loadContoursFromStorage(key);
                    if (!restored) {
                        App.ui.showAlert('Não foi possível carregar os contornos do mapa offline; algumas funcionalidades podem estar indisponíveis.', 'warning', 8000);
                    }
                } finally {
                    if (mapContainer) mapContainer.classList.remove('loading');
                }
            },

            async _loadContoursFromStorage(key) {
                const startedAt = performance.now();
                try {
                    const loaded = await getContourStorageAdapter().load(key);
                    if (!loaded?.geojson) return false;
                    App.state.geoJsonData = this._normalizeContourGeoJson(loaded.geojson);
                    logAereoOffline('contours:storage:loaded', {
                        key,
                        source: loaded.source || loaded.metadata?.source || 'unknown',
                        features: App.state.geoJsonData.features?.length || 0,
                        ms: Math.round(performance.now() - startedAt)
                    });
                    return true;
                } catch (error) {
                    logAereoOfflineError('contours:storage:error', error, { key });
                    try {
                        await getContourStorageAdapter().clear(key);
                    } catch (clearError) {
                        logAereoOfflineError('contours:storage:clear:error', clearError, { key });
                    }
                    return false;
                }
            },

            async loadOfflineShapes() {
                const key = App.state.activeContourCacheKey || getContourCacheKey();
                const loaded = await this._loadContoursFromStorage(key);
                if (!loaded) {
                    App.ui.showAlert('Contornos offline ausentes ou corrompidos. Faça download novamente quando estiver online.', 'warning', 7000);
                    return;
                }
                if (App.state.mapboxMap) this.loadShapesOnMap();
            },

            _normalizeContourGeoJson(geojson) {
                validateGeoJsonContours(geojson);
                let featureIdCounter = 0;
                geojson.features.forEach((feature) => {
                    feature.id = featureIdCounter++;
                    feature.properties = feature.properties || {};
                    const fundo = this._findProp(feature, ['FUNDO_AGR', 'FUNDO_AGRI', 'FUNDOAGRICOLA']);
                    feature.properties.AGV_FUNDO = String(fundo || '').trim();
                    const talhao = this._findProp(feature, ['CD_TALHAO', 'TALHAO', 'COD_TALHAO', 'NAME']);
                    feature.properties.AGV_TALHAO = String(talhao || '').trim();
                });
                return geojson;
            },

            _getGeoJsonBounds(geojson) {
                if (!geojson?.features?.length) return null;
                let minLng = Infinity;
                let minLat = Infinity;
                let maxLng = -Infinity;
                let maxLat = -Infinity;

                const visit = (coords) => {
                    if (!Array.isArray(coords)) return;
                    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
                        minLng = Math.min(minLng, coords[0]);
                        minLat = Math.min(minLat, coords[1]);
                        maxLng = Math.max(maxLng, coords[0]);
                        maxLat = Math.max(maxLat, coords[1]);
                        return;
                    }
                    coords.forEach(visit);
                };

                geojson.features.forEach((feature) => visit(feature?.geometry?.coordinates));

                if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) {
                    return null;
                }
                return [[minLng, minLat], [maxLng, maxLat]];
            },

            async runShapefileDebugTest() {
                const url = App.state.companyConfig?.shapefileURL;
                if (!url) {
                    App.ui.showAlert('Nenhum shapefile configurado para teste.', 'warning');
                    return;
                }

                console.group('[SHP DEBUG] Testar SHP');
                const startedAt = performance.now();
                try {
                    const buffer = await readShapefileAsArrayBuffer(`${url}?debug=${Date.now()}`, 'debug');
                    console.info(`[SHP] bytes shp=${buffer?.byteLength || 0} dbf=0 prj=0`);
                    const { geojson, debug } = await runShapefileWorker(buffer);
                    const bounds = this._getGeoJsonBounds(geojson);

                    console.log('[SHP DEBUG] proj4 loaded =', typeof window.proj4 === 'function');
                    console.log('[SHP DEBUG] CRS detectado =', debug?.sourceProjection || 'desconhecido');
                    console.log('[SHP DEBUG] features count =', geojson?.features?.length || 0);
                    console.log('[SHP DEBUG] features reprojetadas =', debug?.reprojectedCount || 0);
                    console.log('[SHP DEBUG] bounds =', bounds);
                    console.log('[SHP DEBUG] tempo total (ms) =', Math.round(performance.now() - startedAt));

                    App.ui.showAlert('Teste SHP concluído. Verifique os logs no console.', 'success');
                } catch (error) {
                    console.error('[SHP DEBUG] Falha no teste de shapefile:', error);
                    App.ui.showAlert('Falha no teste de shapefile. Veja o console.', 'error');
                } finally {
                    console.groupEnd();
                }
            },

            loadShapesOnMap() {
                const mapContainer = document.getElementById('map-container');
                if (!App.state.mapboxMap || !App.state.geoJsonData) {
                    if (mapContainer) mapContainer.classList.remove('loading');
                    return;
                }

                const map = App.state.mapboxMap;
                const sourceId = 'talhoes-source';
                const layerId = 'talhoes-layer';
                const borderLayerId = 'talhoes-border-layer';
                const labelLayerId = 'talhoes-labels';
                const DEBUG_MAP = !!window.DEBUG_MAP;

                if (DEBUG_MAP) {
                    console.groupCollapsed('[MAP DEBUG] loadShapesOnMap');
                    console.log('hasSourceBefore=', !!map.getSource(sourceId));
                    console.log('layerCountBefore=', Object.keys(map.style?._layers || {}).length);
                    console.log('selectedTalhaoId=', App.state.selectedTalhaoId);
                }

                if (App.state.mapInteractionHandlers) {
                    map.off('mousemove', layerId, App.state.mapInteractionHandlers.mousemove);
                    map.off('mouseleave', layerId, App.state.mapInteractionHandlers.mouseleave);
                    map.off('click', layerId, App.state.mapInteractionHandlers.click);
                    if (DEBUG_MAP) console.log('removedOldHandlers=true');
                    App.state.mapInteractionHandlers = null;
                }

                if (App.state.selectedMapFeature?.id !== undefined && App.state.selectedMapFeature?.id !== null) {
                    map.setFeatureState({ source: sourceId, id: App.state.selectedMapFeature.id }, { selected: false });
                }
                App.state.selectedMapFeature = null;
                App.state.selectedTalhaoId = null;

                const bounds = this._getGeoJsonBounds(App.state.geoJsonData);
                if (map.getSource(sourceId)) {
                    map.getSource(sourceId).setData(App.state.geoJsonData);
                } else {
                    map.addSource(sourceId, {
                        type: 'geojson',
                        data: App.state.geoJsonData,
                        generateId: true
                    });
                }

                const themeColors = App.ui._getThemeColors();

                if (!map.getLayer(layerId)) {
                    map.addLayer({
                        id: layerId,
                        type: 'fill',
                        source: sourceId,
                        paint: {
                            'fill-color': [
                                'case',
                                ['boolean', ['feature-state', 'selected'], false], themeColors.primary,
                                ['boolean', ['feature-state', 'hover'], false], '#607D8B',
                                ['boolean', ['feature-state', 'risk'], false], '#d32f2f',
                                '#1C1C1C'
                            ],
                            'fill-opacity': [
                                'case',
                                ['boolean', ['feature-state', 'selected'], false], 0.9,
                                ['boolean', ['feature-state', 'hover'], false], 0.8,
                                ['boolean', ['feature-state', 'risk'], false], 0.6,
                                0.7
                            ]
                        }
                    });
                }

                if (!map.getLayer(labelLayerId)) {
                    map.addLayer({
                        id: labelLayerId,
                        type: 'symbol',
                        source: sourceId,
                        minzoom: 10,
                        layout: {
                            'symbol-placement': 'point',
                            'text-field': [
                                'format',
                                ['upcase', ['get', 'AGV_FUNDO']], { 'font-scale': 0.9 },
                                '\n', {},
                                ['upcase', ['get', 'AGV_TALHAO']], { 'font-scale': 1.2 }
                            ],
                            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                            'text-size': 14,
                            'text-ignore-placement': true,
                            'text-allow-overlap': true,
                            'text-pitch-alignment': 'viewport',
                        },
                        paint: {
                            'text-color': '#FFFFFF',
                            'text-halo-color': 'rgba(0, 0, 0, 0.9)',
                            'text-halo-width': 2
                        }
                    });
                }

                if (!map.getLayer(borderLayerId)) {
                    map.addLayer({
                        id: borderLayerId,
                        type: 'line',
                        source: sourceId,
                        paint: {
                            'line-color': [
                                'case',
                                ['boolean', ['feature-state', 'selected'], false], '#00FFFF',
                                ['boolean', ['feature-state', 'searched'], false], '#00FFFF',
                                '#FFFFFF'
                            ],
                            'line-width': [
                                'case',
                                ['boolean', ['feature-state', 'selected'], false], 3,
                                ['boolean', ['feature-state', 'searched'], false], 4,
                                2
                            ],
                            'line-opacity': 0.95
                        }
                    });
                }

                console.info('[SHP] layer added');
                if (bounds) {
                    console.info(`[SHP] layer bounds=${JSON.stringify(bounds)}`);
                    map.fitBounds(bounds, { padding: 60, duration: 800 });
                } else {
                    console.info('[SHP] layer bounds=null');
                }

                let hoveredFeatureId = null;

                const handleMouseMove = (e) => {
                    map.getCanvas().style.cursor = 'pointer';
                    if (e.features.length > 0) {
                        if (hoveredFeatureId !== null) {
                            map.setFeatureState({ source: sourceId, id: hoveredFeatureId }, { hover: false });
                        }
                        hoveredFeatureId = e.features[0].id;
                        map.setFeatureState({ source: sourceId, id: hoveredFeatureId }, { hover: true });
                    }
                };

                const handleMouseLeave = () => {
                    map.getCanvas().style.cursor = '';
                    if (hoveredFeatureId !== null) {
                        map.setFeatureState({ source: sourceId, id: hoveredFeatureId }, { hover: false });
                    }
                    hoveredFeatureId = null;
                };

                const handleTalhaoClick = (e) => {
                    if (e.originalEvent.target.closest('.mapboxgl-marker')) return;
                    if (e.features.length === 0) return;

                    const now = Date.now();
                    const elapsed = now - App.state.mapLastTalhaoClickAt;
                    if (elapsed < 180) {
                        if (DEBUG_MAP) console.log('[MAP DEBUG] clickIgnoredByThrottle elapsedMs=', elapsed);
                        return;
                    }
                    App.state.mapLastTalhaoClickAt = now;

                    const clickedFeature = e.features[0];
                    const clickedTalhaoId = String(clickedFeature.id);

                    if (DEBUG_MAP) {
                        console.groupCollapsed('[MAP DEBUG] talhaoClick');
                        console.log('clickedFeatureId=', clickedFeature.id);
                        console.log('clickedTalhaoId=', clickedTalhaoId);
                        console.log('selectedTalhaoIdBefore=', App.state.selectedTalhaoId);
                        console.log('mapLayerCount=', Object.keys(map.style?._layers || {}).length);
                    }

                    if (App.state.trapPlacementMode === 'manual_select') {
                        const clickPosition = e.lngLat;
                        this.showTrapPlacementModal('manual_confirm', { feature: clickedFeature, position: clickPosition });
                        if (DEBUG_MAP) console.groupEnd();
                        return;
                    }

                    if (App.state.selectedMapFeature?.id !== undefined && App.state.selectedMapFeature?.id !== null) {
                        map.setFeatureState({ source: sourceId, id: App.state.selectedMapFeature.id }, { selected: false });
                    }

                    App.state.selectedMapFeature = clickedFeature;
                    App.state.selectedTalhaoId = clickedTalhaoId;
                    map.setFeatureState({ source: sourceId, id: clickedFeature.id }, { selected: true });

                    let riskPercentage = null;
                    if (App.state.riskViewActive) {
                        const farmCode = this._findProp(clickedFeature, ['FUNDO_AGR']);
                        if (App.state.farmRiskPercentages && App.state.farmRiskPercentages[farmCode] !== undefined) {
                            riskPercentage = App.state.farmRiskPercentages[farmCode];
                        }
                    }

                    this.showTalhaoInfo(clickedFeature, riskPercentage);
                    if (DEBUG_MAP) {
                        console.log('selectedTalhaoIdAfter=', App.state.selectedTalhaoId);
                        console.log('infoBoxVisible=', App.elements.monitoramentoAereo.infoBox.classList.contains('visible'));
                        console.groupEnd();
                    }
                };

                map.on('mousemove', layerId, handleMouseMove);
                map.on('mouseleave', layerId, handleMouseLeave);
                map.on('click', layerId, handleTalhaoClick);

                App.state.mapInteractionHandlers = {
                    mousemove: handleMouseMove,
                    mouseleave: handleMouseLeave,
                    click: handleTalhaoClick
                };

                App.elements.monitoramentoAereo.btnToggleRiskView.style.display = 'flex';

                if (DEBUG_MAP) {
                    console.log('handlersBound=1 per event');
                    console.log('layerCountAfter=', Object.keys(map.style?._layers || {}).length);
                    console.groupEnd();
                }
            },


            _findProp(feature, keys) {
                if (!feature || !feature.properties) return 'Não identificado';
                const props = {};
                // Normalize all property keys to uppercase for consistent access
                for (const key in feature.properties) {
                    props[key.toUpperCase()] = feature.properties[key];
                }
                
                for (const key of keys) {
                    if (props[key.toUpperCase()] !== undefined) {
                        // Garante que o retorno seja sempre uma string
                        return String(props[key.toUpperCase()]);
                    }
                }
                return 'Não identificado';
            },

            // ALTERAÇÃO PONTO 5: Melhoria na busca de propriedades do Shapefile
            showTalhaoInfo(feature, riskPercentage = null) { // feature is now a GeoJSON feature
                const DEBUG_MAP = !!window.DEBUG_MAP;
                const fundoAgricola = feature.properties.AGV_FUNDO || 'Não identificado';
                const fazendaNome = this._findProp(feature, ['NM_IMOVEL', 'NM_FAZENDA', 'NOME_FAZEN', 'FAZENDA']);
                const talhaoNome = feature.properties.AGV_TALHAO || 'Não identificado';
                const areaHaRaw = this._findProp(feature, ['AREA_HA', 'AREA', 'HECTARES']);
                const areaHa = Number.parseFloat(String(areaHaRaw).replace(',', '.'));
                const variedade = this._findProp(feature, ['VARIEDADE', 'CULTURA']);

                if (DEBUG_MAP) {
                    console.groupCollapsed('[MAP DEBUG] showTalhaoInfo');
                    console.log('featureId=', feature?.id);
                    console.log('selectedTalhaoId=', App.state.selectedTalhaoId);
                    console.log('reusingInfoPanel=', !!App.elements.monitoramentoAereo.infoBoxContent?.firstElementChild);
                }

                const riskInfoHTML = riskPercentage !== null ? `
                    <div class="info-item risk-info">
                        <span class="label"><i class="fas fa-exclamation-triangle"></i> Risco de Aplicação</span>
                        <span class="value">${riskPercentage.toFixed(2)}%</span>
                    </div>
                ` : '';

                const contentEl = App.elements.monitoramentoAereo.infoBoxContent;
                contentEl.innerHTML = `
                    <div class="info-title">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>Informações do Talhão</span>
                    </div>
                    ${riskInfoHTML}
                    <div class="info-item">
                        <span class="label">Fundo Agrícola</span>
                        <span class="value">${fundoAgricola}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Fazenda</span>
                        <span class="value">${fazendaNome}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Talhão</span>
                        <span class="value">${talhaoNome}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Variedade</span>
                        <span class="value">${variedade}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Área Total</span>
                        <span class="value">${Number.isFinite(areaHa) ? areaHa.toFixed(2).replace('.',',') : '0,00'} ha</span>
                    </div>
                    <div class="info-box-actions" style="padding: 10px 20px 20px 20px;">
                        <button class="btn-download-map save" style="width: 100%;">
                            <i class="fas fa-cloud-download-alt"></i> Baixar Mapa Offline
                        </button>
                    </div>
                    <div class="download-progress-container" style="display: none; padding: 0 20px 20px 20px;">
                        <p class="download-progress-text" style="margin-bottom: 5px; font-size: 14px; color: var(--color-text-light);"></p>
                        <progress class="download-progress-bar" value="0" max="100" style="width: 100%;"></progress>
                    </div>
                `;

                const downloadBtn = contentEl.querySelector('.btn-download-map');
                if (downloadBtn) {
                    downloadBtn.onclick = () => this.startOfflineMapDownload(feature);
                }

                this.hideTrapInfo();
                App.elements.monitoramentoAereo.infoBox.classList.add('visible');

                if (DEBUG_MAP) {
                    console.log('infoBoxVisibleAfter=', App.elements.monitoramentoAereo.infoBox.classList.contains('visible'));
                    console.groupEnd();
                }
            },


            isAndroidNativeAerialModuleAvailable() {
                const cap = window?.Capacitor;
                const isAndroidNative = Boolean(cap?.isNativePlatform?.() && cap?.getPlatform?.() === 'android');
                if (!isAndroidNative) return false;

                return Boolean(cap?.Plugins?.AerialMap || cap?.registerPlugin);
            },

            updateAndroidOfflineButtonsVisibility() {
                const providerKind = App.state.aerialMapProvider?.kind || null;
                const shouldShowOfflineButtons = providerKind === 'android-native' || this.isAndroidNativeAerialModuleAvailable();
                console.info('[Perfil][Aéreo Offline] provider kind:', providerKind);

                const { downloadAllAerialTilesBtn, updateAllAerialTilesBtn, removeAllAerialTilesBtn } = App.elements.userMenu;
                [downloadAllAerialTilesBtn, updateAllAerialTilesBtn, removeAllAerialTilesBtn].forEach((btn) => {
                    if (!btn) return;
                    btn.style.display = shouldShowOfflineButtons ? 'flex' : 'none';
                });
            },

            buildOfflineBatchPayload() {
                if (!App.state.geoJsonData?.features?.length) {
                    throw new Error('Não há talhões carregados para preparar o offline.');
                }

                const bounds = turf.bbox(App.state.geoJsonData);
                const companyId = App.state.currentUser.companyId || null;
                const farmId = App.elements.monitoramentoAereo.mapFarmSearchInput?.dataset?.farmId || null;
                const talhoesGeoJson = JSON.stringify(App.state.geoJsonData);
                const traps = (App.state.armadilhas || [])
                    .filter((trap) => Number.isFinite(Number(trap.longitude)) && Number.isFinite(Number(trap.latitude)))
                    .map((trap) => ({
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [Number(trap.longitude), Number(trap.latitude)]
                        },
                        properties: {
                            id: trap.id || null,
                            talhaoNome: trap.talhaoNome || null,
                            status: trap.status || null
                        }
                    }));

                return {
                    regionId: `monitoramento-aereo-${companyId || 'global'}`,
                    packageId: `monitoramento-aereo-${companyId || 'global'}`,
                    regionName: 'Monitoramento Aéreo (Todos os Tiles)',
                    styleUri: 'mapbox://styles/mapbox/standard-satellite',
                    bounds,
                    minZoom: 12,
                    maxZoom: 16,
                    companyId,
                    farmId,
                    talhoesGeoJson,
                    armadilhasGeoJson: JSON.stringify({ type: 'FeatureCollection', features: traps })
                };
            },

            async ensureNativeAerialOfflineReady(actionName) {
                if (!App.state.aerialMapProvider) {
                    await this.initMap();
                }

                if (!(App.state.useNativeAerialMap && App.state.aerialMapProvider)) {
                    console.warn(`[AEREO_OFFLINE] bloqueado: ${actionName} requer Android nativo.`, {
                        useNativeAerialMap: App.state.useNativeAerialMap,
                        providerKind: App.state.aerialMapProvider?.kind || null
                    });
                    App.ui.showAlert('Este recurso está disponível apenas no Android nativo.', 'warning');
                    return null;
                }

                return App.state.aerialMapProvider;
            },

            async downloadAllAerialTiles() {
                try {
                    const provider = await this.ensureNativeAerialOfflineReady('downloadAllAerialTiles');
                    if (!provider) return;

                    const payload = this.buildOfflineBatchPayload();
                    App.ui.showAlert('Iniciando download offline do Monitoramento Aéreo...', 'info');
                    await provider.downloadOfflineBatch(payload);
                    App.ui.showAlert('Download em lote iniciado. Baixando mapa offline em segundo plano.', 'info');
                } catch (error) {
                    logAereoOfflineError('native-offline:batch:download:error', error);
                    App.ui.showAlert(`Erro ao preparar offline: ${error?.message || 'falha inesperada.'}`, 'warning');
                }
            },

            async updateAllAerialTiles() {
                try {
                    const provider = await this.ensureNativeAerialOfflineReady('updateAllAerialTiles');
                    if (!provider) return;

                    const payload = this.buildOfflineBatchPayload();
                    App.ui.showAlert('Atualizando tiles offline do Monitoramento Aéreo...', 'info');
                    await provider.updateOfflineBatch(payload);
                    App.ui.showAlert('Atualização em lote iniciada.', 'info');
                } catch (error) {
                    logAereoOfflineError('native-offline:batch:update:error', error);
                    App.ui.showAlert(`Erro ao atualizar offline: ${error?.message || 'falha inesperada.'}`, 'warning');
                }
            },

            async removeAllAerialTiles() {
                try {
                    const provider = await this.ensureNativeAerialOfflineReady('removeAllAerialTiles');
                    if (!provider) return;

                    const payload = this.buildOfflineBatchPayload();
                    await provider.removeOfflineBatch({ regionId: payload.regionId });
                    App.ui.showAlert('Tiles offline removidos com sucesso.', 'success');
                } catch (error) {
                    logAereoOfflineError('native-offline:batch:remove:error', error);
                    App.ui.showAlert(`Erro ao remover offline: ${error?.message || 'falha inesperada.'}`, 'warning');
                }
            },

            tileMath: {
                long2tile(lon, zoom) { return (Math.floor((lon + 180) / 360 * Math.pow(2, zoom))); },
                lat2tile(lat, zoom) { return (Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom))); },
                tile2long(x, z) { return (x / Math.pow(2, z) * 360 - 180); },
                tile2lat(y, z) {
                    const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
                    return (180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
                }
            },

            async startOfflineMapDownload(feature) {
                if (App.state.useNativeAerialMap && App.state.aerialMapProvider) {
                    const bbox = turf.bbox(feature);
                    try {
                        await App.state.aerialMapProvider.downloadOfflineRegion({
                            regionId: `talhao-${feature.id || Date.now()}`,
                            regionName: feature.properties?.AGV_TALHAO || 'Talhão',
                            bounds: bbox,
                            minZoom: 12,
                            maxZoom: 16,
                            styleUri: 'mapbox://styles/mapbox/standard-satellite'
                        });
                        App.ui.showAlert('Download offline nativo iniciado.', 'info');
                    } catch (error) {
                        logAereoOfflineError('native-offline:download:error', error);
                        App.ui.showAlert('Falha no download offline nativo. Tente novamente.', 'warning');
                    }
                    return;
                }

                const ZOOM_LEVELS = [14, 15, 16]; // Limite de zoom offline para evitar pacotes gigantes
                const MAX_TILES_PER_PACK = 6000;
                const infoBox = App.elements.monitoramentoAereo.infoBox;
                const progressContainer = infoBox.querySelector('.download-progress-container');
                const progressText = infoBox.querySelector('.download-progress-text');
                const progressBar = infoBox.querySelector('.download-progress-bar');

                const bbox = turf.bbox(feature);
                const [minLng, minLat, maxLng, maxLat] = bbox;

                let totalTilesToDownload = 0;
                const allTileUrls = [];

                ZOOM_LEVELS.forEach(zoom => {
                    const minX = this.tileMath.long2tile(minLng, zoom);
                    const maxX = this.tileMath.long2tile(maxLng, zoom);
                    const minY = this.tileMath.lat2tile(maxLat, zoom);
                    const maxY = this.tileMath.lat2tile(minLat, zoom);

                    for (let x = minX; x <= maxX; x++) {
                        for (let y = minY; y <= maxY; y++) {
                            const satelliteUrl = `https://api.mapbox.com/v4/mapbox.satellite/${zoom}/${x}/${y}@2x.png?access_token=${mapboxgl.accessToken}`;
                            const streetsUrl = `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/${zoom}/${x}/${y}@2x.png?access_token=${mapboxgl.accessToken}`;
                            allTileUrls.push(satelliteUrl);
                            allTileUrls.push(streetsUrl);
                            totalTilesToDownload += 2;
                        }
                    }
                });

                if (totalTilesToDownload > MAX_TILES_PER_PACK) {
                    App.ui.showAlert(`Pacote muito grande (${totalTilesToDownload} tiles). Reduza a área/zoom para no máximo ${MAX_TILES_PER_PACK}.`, 'warning', 7000);
                    return;
                }

                infoBox.querySelector('.btn-download-map').style.display = 'none';
                progressContainer.style.display = 'block';
                progressText.textContent = `A preparar para baixar ${totalTilesToDownload} tiles...`;
                progressBar.value = 0;
                progressBar.max = totalTilesToDownload;

                this.downloadTiles(allTileUrls, { feature, bbox });
            },

            async downloadTiles(urls, metadata = {}) {
                const infoBox = App.elements.monitoramentoAereo.infoBox;
                const progressContainer = infoBox.querySelector('.download-progress-container');
                const progressText = infoBox.querySelector('.download-progress-text');
                const progressBar = infoBox.querySelector('.download-progress-bar');
                let processedCount = 0;
                let failedCount = 0;
                const totalTiles = urls.length;
                const CONCURRENCY_LIMIT = 8; // Increased concurrency

                // This function just triggers the fetch. The service worker does the actual caching.
                const triggerFetch = async (url) => {
                    try {
                        // We don't need the response body, just the status.
                        // The 'no-cors' mode is a trick to speed things up as we don't read the response directly,
                        // but the service worker still gets the full response to cache.
                        const response = await fetch(url, { mode: 'no-cors', cache: 'no-store' });
                        // A response (even opaque) means the request was sent.
                        // The service worker will handle success/failure of caching.
                        // For UI feedback, we assume success if the request doesn't throw an error.
                        return { status: 'success' };
                    } catch (error) {
                        console.warn(`Falha ao iniciar o download para o tile: ${url}`, error);
                        return { status: 'failed' };
                    }
                };

                for (let i = 0; i < totalTiles; i += CONCURRENCY_LIMIT) {
                    const chunk = urls.slice(i, i + CONCURRENCY_LIMIT);
                    const promises = chunk.map(url => triggerFetch(url));
                    const results = await Promise.all(promises);

                    results.forEach(result => {
                        processedCount++;
                        if (result.status === 'failed') {
                            failedCount++;
                        }
                    });

                    progressBar.value = processedCount;
                    progressText.textContent = `A guardar mapa offline... ${processedCount}/${totalTiles} (Falhas: ${failedCount})`;
                }

                const offlineManifest = {
                    downloadedAt: nowIso(),
                    appVersion: 'v23',
                    tileCount: totalTiles,
                    failedTiles: failedCount,
                    talhaoId: metadata.feature?.properties?.id || null,
                    talhaoNome: metadata.feature?.properties?.talhao || null,
                    fazendaNome: metadata.feature?.properties?.fazenda || null,
                    bbox: metadata.bbox || null,
                };
                await bootstrapCache.set('offline-map-manifest:last', offlineManifest);
                logBootStage('MAP:CACHE:manifest:updated', offlineManifest);

                if (failedCount > 0) {
                    App.ui.showAlert(`Download concluído com ${failedCount} falhas. Tente novamente se o mapa offline estiver incompleto.`, 'warning');
                } else {
                    App.ui.showAlert(`Mapa offline guardado com sucesso! ${totalTiles} tiles processados.`, 'success');
                }

                setTimeout(() => {
                    progressContainer.style.display = 'none';
                    infoBox.querySelector('.btn-download-map').style.display = 'block';
                }, 5000);
            },

            hideTalhaoInfo() {
                const DEBUG_MAP = !!window.DEBUG_MAP;
                if (App.state.selectedMapFeature && App.state.mapboxMap) {
                    App.state.mapboxMap.setFeatureState({ source: 'talhoes-source', id: App.state.selectedMapFeature.id }, { selected: false });
                }
                App.state.selectedMapFeature = null;
                App.state.selectedTalhaoId = null;
                App.elements.monitoramentoAereo.infoBox.classList.remove('visible');

                if (DEBUG_MAP) {
                    console.log('[MAP DEBUG] hideTalhaoInfo called');
                }
            },

            loadTraps() {
                if (App.state.useNativeAerialMap && App.state.aerialMapProvider && typeof App.state.aerialMapProvider.loadArmadilhas === 'function') {
                    const trapsGeoJson = {
                        type: 'FeatureCollection',
                        features: App.state.armadilhas.filter(t => t.status === 'Ativa' && Number.isFinite(t.longitude) && Number.isFinite(t.latitude)).map(t => ({
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: [t.longitude, t.latitude] },
                            properties: { trapId: t.id, status: t.status }
                        }))
                    };
                    App.state.aerialMapProvider.loadArmadilhas(trapsGeoJson).catch(console.error);
                    return; // native provider loaded
                }

                if (!App.state.mapboxMap) return; // avoid crash if mapboxMap is not loaded

                Object.values(App.state.mapboxTrapMarkers).forEach(marker => marker.remove());
                App.state.mapboxTrapMarkers = {};

                App.state.armadilhas.forEach(trap => {
                    if (trap.status === 'Ativa') {
                        this.addOrUpdateTrapMarker(trap);
                    }
                });
            },

            logInvalidTrapDate(trap, context = 'geral') {
                const trapId = trap?.id || 'sem-id';
                const logKey = `${context}:${trapId}`;
                if (App.state.invalidTrapDateLogKeys.has(logKey)) return;
                App.state.invalidTrapDateLogKeys.add(logKey);

                console.warn('[MONITORAMENTO_AEREO][ARMADILHA] dataInstalacao inválida', {
                    context,
                    trapId,
                    talhao: trap?.talhaoNome,
                    rawDataInstalacao: trap?.dataInstalacao
                });
            },

            parseTrapDate(value) {
                if (!value) return null;

                if (value instanceof Date) {
                    return isNaN(value.getTime()) ? null : value;
                }

                if (typeof value.toDate === 'function') {
                    const parsed = value.toDate();
                    return parsed instanceof Date && !isNaN(parsed.getTime()) ? parsed : null;
                }

                if (typeof value === 'object') {
                    const seconds = Number.isFinite(value.seconds) ? Number(value.seconds) : Number(value._seconds);
                    if (Number.isFinite(seconds)) {
                        const nanoseconds = Number.isFinite(value.nanoseconds)
                            ? Number(value.nanoseconds)
                            : (Number.isFinite(value._nanoseconds) ? Number(value._nanoseconds) : 0);
                        const millis = (seconds * 1000) + Math.floor((Number.isFinite(nanoseconds) ? nanoseconds : 0) / 1e6);
                        const parsed = new Date(millis);
                        return isNaN(parsed.getTime()) ? null : parsed;
                    }
                }

                return parseDateLikeValue(value);
            },

            addOrUpdateTrapMarker(trap) {
                if (!App.state.mapboxMap || !Number.isFinite(trap?.latitude) || !Number.isFinite(trap?.longitude)) return;

                const installDate = trap._installDateNormalized || this.parseTrapDate(trap.dataInstalacao);
                const isInvalidInstallDate = !installDate;
                if (isInvalidInstallDate) {
                    this.logInvalidTrapDate(trap, 'addOrUpdateTrapMarker');
                }

                const now = new Date();
                const diasDesdeInstalacao = isInvalidInstallDate
                    ? null
                    : Math.floor((now - installDate) / (1000 * 60 * 60 * 24));

                let color = '#388e3c'; // Verde (Normal)
                if (isInvalidInstallDate) {
                    color = '#757575'; // Cinza (Data inválida)
                } else if (diasDesdeInstalacao >= 5 && diasDesdeInstalacao <= 7) {
                    color = '#f57c00'; // Amarelo (Atenção)
                } else if (diasDesdeInstalacao > 7) {
                    color = '#d32f2f'; // Vermelho (Atrasado)
                }
                
                const el = document.createElement('div');
                el.className = 'mapbox-marker';
                el.style.width = '30px';
                el.style.height = '30px';
                el.style.borderRadius = '50%';
                el.style.backgroundColor = color;
                el.style.border = '2px solid white';
                el.style.display = 'flex';
                el.style.justifyContent = 'center';
                el.style.alignItems = 'center';
                el.style.cursor = 'pointer';
                el.innerHTML = '<i class="fas fa-bug" style="color: white; font-size: 16px;"></i>';
                el.title = isInvalidInstallDate
                    ? 'Armadilha com data de instalação inválida'
                    : `Armadilha instalada em ${installDate.toLocaleDateString()}`;

                if (App.state.mapboxTrapMarkers[trap.id]) {
                    const existingEl = App.state.mapboxTrapMarkers[trap.id].getElement();
                    existingEl.style.backgroundColor = color;
                    existingEl.title = el.title;
                } else {
                    const marker = new mapboxgl.Marker(el)
                        .setLngLat([trap.longitude, trap.latitude])
                        .addTo(App.state.mapboxMap);
                    
                    el.addEventListener('click', (e) => { e.stopPropagation(); this.showTrapInfo(trap.id); });
                    App.state.mapboxTrapMarkers[trap.id] = marker;
                }
            },

            promptInstallTrap() {
                if (!App.state.mapboxUserMarker) {
                    App.ui.showAlert("Localização do usuário não disponível para instalar a armadilha.", "error");
                    return;
                }
                this.showTrapPlacementModal('loading');
                const position = App.state.mapboxUserMarker.getLngLat();
                this.findTalhaoFromLocation(position);
            },

            findTalhaoFromLocation(position) { // position is a Mapbox LngLat object
                try {
                    if (typeof turf === 'undefined') {
                        throw new Error("Biblioteca Turf.js não carregada. Verifique sua conexão ou recarregue.");
                    }

                    const containingTalhoes = [];
                    const point = turf.point([position.lng, position.lat]);
                    const allTalhoes = App.state.geoJsonData;

                    if (!allTalhoes || !allTalhoes.features) {
                        this.showTrapPlacementModal('failure');
                        return;
                    }

                    allTalhoes.features.forEach(feature => {
                        try {
                            // Strict check: the user's exact point must be inside the polygon
                            if (turf.booleanPointInPolygon(point, feature.geometry)) {
                                containingTalhoes.push(feature);
                            }
                        } catch (e) {
                            console.warn("Geometria inválida ou erro no processamento do Turf.js:", e, feature.geometry);
                        }
                    });

                    if (containingTalhoes.length === 1) {
                        this.showTrapPlacementModal('success', containingTalhoes);
                    } else if (containingTalhoes.length > 1) {
                        // This case is less likely now but kept for robustness (e.g., overlapping polygons)
                        this.showTrapPlacementModal('conflict', containingTalhoes);
                    } else {
                        this.showTrapPlacementModal('failure');
                    }
                } catch (e) {
                    console.error("Error finding talhao:", e);
                    // Ensure we don't get stuck in a loading state
                    this.hideTrapPlacementModal();
                    App.ui.showAlert("Erro ao detectar talhão: " + e.message, "error");
                }
            },

            showTrapPlacementModal(state, data = null) {
                const { overlay, body, confirmBtn, manualBtn } = App.elements.trapPlacementModal;
                let content = '';
                
                confirmBtn.style.display = 'none';
                manualBtn.style.display = 'inline-flex';

                switch(state) {
                    case 'loading':
                        content = `<div class="spinner"></div><p style="margin-left: 15px;">A detetar talhão...</p>`;
                        manualBtn.style.display = 'none';
                        break;
                    case 'success':
                        const feature = data[0];
                        const fazendaNome = this._findProp(feature, ['NM_IMOVEL', 'NM_FAZENDA', 'NOME_FAZEN', 'FAZENDA']);
                        const talhaoName = feature.properties.AGV_TALHAO || 'Não identificado';
                        const fundoAgricola = feature.properties.AGV_FUNDO || 'Não identificado';

                        content = `<p style="font-weight: 500;">Confirme o local de instalação:</p>
                                   <div class="location-confirmation-box">
                                       <span><strong>Fundo Agrícola:</strong> ${fundoAgricola}</span>
                                       <span><strong>Fazenda:</strong> ${fazendaNome}</span>
                                       <span><strong>Talhão:</strong> ${talhaoName}</span>
                                   </div>
                                   <p>Deseja instalar a armadilha neste local?</p>`;
                        confirmBtn.style.display = 'inline-flex';
                        App.state.trapPlacementData = { feature: feature };
                        break;
                    case 'conflict':
                        content = `<p>Vários talhões detetados na sua localização. Por favor, selecione o correto:</p><div id="talhao-conflict-list" style="margin-top:15px; text-align:left;">`;
                        data.forEach((f, index) => {
                            const name = f.properties.CD_TALHAO || f.properties.TALHAO || `Opção ${index + 1}`;
                            content += `<label class="report-option-item" style="margin-bottom:10px;"><input type="radio" name="talhaoConflict" value="${index}"><span class="checkbox-visual"><i class="fas fa-check"></i></span><span class="option-content">${name}</span></label>`;
                        });
                        content += `</div>`;
                        confirmBtn.style.display = 'inline-flex';
                        App.state.trapPlacementData = { features: data };
                        break;
                    case 'failure':
                        content = `<p style="text-align: center;"><i class="fas fa-exclamation-triangle fa-2x" style="color: var(--color-warning); margin-bottom: 10px;"></i><br>Você precisa estar <strong>dentro de um talhão</strong> para a instalação automática.<br><br>Se necessário, use a opção de seleção manual.</p>`;
                        break;
                    case 'manual_confirm':
                        const manualFeature = data.feature;
                        const manualFazendaNome = this._findProp(manualFeature, ['NM_IMOVEL', 'NM_FAZENDA', 'NOME_FAZEN', 'FAZENDA']);
                        const manualTalhaoName = manualFeature.properties.AGV_TALHAO || 'Não identificado';
                        const manualFundoAgricola = manualFeature.properties.AGV_FUNDO || 'Não identificado';

                        content = `<p style="font-weight: 500;">Confirmar instalação manual:</p>
                                   <div class="location-confirmation-box">
                                       <span><strong>Fundo Agrícola:</strong> ${manualFundoAgricola}</span>
                                       <span><strong>Fazenda:</strong> ${manualFazendaNome}</span>
                                       <span><strong>Talhão:</strong> ${manualTalhaoName}</span>
                                   </div>
                                   <p>Deseja instalar a armadilha neste talhão selecionado?</p>`;
                        confirmBtn.style.display = 'inline-flex';
                        manualBtn.style.display = 'none';
                        App.state.trapPlacementData = { feature: manualFeature, position: data.position };
                        break;
                    case 'manual_select':
                        content = `<p style="font-weight: 500; text-align: center;">Clique no talhão desejado no mapa para o selecionar.</p>`;
                        manualBtn.style.display = 'none';
                        break;
                }
                
                body.innerHTML = content;
                overlay.classList.add('show');
                App.state.trapPlacementMode = state;
            },

            hideTrapPlacementModal() {
                 App.elements.trapPlacementModal.overlay.classList.remove('show');
                 App.state.trapPlacementMode = null;
                 App.state.trapPlacementData = null;
            },

            async installTrap(lat, lng, feature = null) {
                const installDate = new Date();
                const trapId = `trap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                const newTrapData = {
                    id: trapId,
                    latitude: lat,
                    longitude: lng,
                    dataInstalacao: installDate.toISOString(),
                    instaladoPor: App.state.currentUser.uid,
                    status: "Ativa",
                    fazendaNome: feature ? this._findProp(feature, ['NM_IMOVEL', 'NM_FAZENDA', 'NOME_FAZEN', 'FAZENDA']) : 'Não identificado',
                    fazendaCode: feature ? feature.properties.AGV_FUNDO : null,
                    talhaoNome: feature ? feature.properties.AGV_TALHAO : 'Não identificado',
                    companyId: App.state.currentUser.companyId
                };

                App.ui.setLoading(true, "A guardar armadilha...");

                try {
                    if (navigator.onLine) {
                        const dataForFirestore = { ...newTrapData, dataInstalacao: Timestamp.fromDate(installDate) };
                        await App.data.setDocument('armadilhas', trapId, dataForFirestore);
                        this.addOrUpdateTrapMarker({ id: trapId, ...dataForFirestore });
                        App.ui.showAlert(`Armadilha ${trapId.substring(0, 9)}... instalada com sucesso.`, "success");
                    } else {
                        await OfflineDB.add('offline-writes', { id: trapId, collection: 'armadilhas', data: newTrapData });
                        App.ui.showAlert('Armadilha guardada offline. Será enviada quando houver conexão.', 'info');
                        const tempTrapForMarker = { ...newTrapData, dataInstalacao: installDate };
                        this.addOrUpdateTrapMarker(tempTrapForMarker);
                    }
                } catch (error) {
                    console.error("Erro ao instalar armadilha, tentando guardar offline:", error);
                    try {
                        await OfflineDB.add('offline-writes', { id: trapId, collection: 'armadilhas', data: newTrapData });
                        App.ui.showAlert('Falha ao conectar. Armadilha guardada offline.', 'warning');
                        const tempTrapForMarker = { ...newTrapData, dataInstalacao: installDate };
                        this.addOrUpdateTrapMarker(tempTrapForMarker);
                    } catch (offlineError) {
                        console.error("Falha crítica ao guardar armadilha offline:", offlineError);
                        App.ui.showAlert("Falha crítica ao guardar a armadilha offline.", "error");
                    }
                } finally {
                    App.ui.setLoading(false);
                }
            },

            promptCollectTrap(trapId) {
                const trap = App.state.armadilhas.find(t => t.id === trapId);
                if (!trap) return;

                App.ui.showConfirmationModal(
                    `Confirmar coleta para a armadilha em ${trap.talhaoNome || 'local desconhecido'}?`,
                    async (inputs) => {
                        const mothCount = parseInt(inputs.count, 10);
                        if (isNaN(mothCount) || mothCount < 0) {
                            App.ui.showAlert("Por favor, insira um número válido de mariposas.", "error");
                            return;
                        }
                        await this.collectTrap(trapId, mothCount, inputs.observations);
                    },
                    [
                        { id: 'count', placeholder: 'Nº de mariposas capturadas', type: 'number', required: true },
                        { id: 'observations', placeholder: 'Adicionar observações (opcional)', type: 'textarea', value: trap.observacoes || '' }
                    ]
                );
            },

            async collectTrap(trapId, count, observations) {
                const collectionTime = new Date();
                const updateData = {
                    status: "Coletada",
                    dataColeta: collectionTime.toISOString(), // Use ISO String for offline storage
                    coletadoPor: App.state.currentUser.uid,
                    contagemMariposas: count,
                    observacoes: observations || null
                };

                // Optimistic UI Update
                if (App.state.mapboxTrapMarkers[trapId]) {
                    App.state.mapboxTrapMarkers[trapId].remove();
                    delete App.state.mapboxTrapMarkers[trapId];
                }
                this.hideTrapInfo();
                App.ui.showAlert("Coleta registrada. Sincronizando...", "info");

                const trapIndex = App.state.armadilhas.findIndex(t => t.id === trapId);
                if (trapIndex > -1) {
                    App.state.armadilhas[trapIndex].status = "Coletada";
                }
                this.checkTrapStatusAndNotify();

                try {
                    if (!navigator.onLine) {
                        throw new Error("Offline mode detected");
                    }
                    // For online, use Firestore Timestamp
                    const onlineUpdateData = { ...updateData, dataColeta: Timestamp.fromDate(collectionTime) };
                    await App.data.updateDocument('armadilhas', trapId, onlineUpdateData);
                    App.ui.showAlert("Coleta sincronizada com sucesso!", "success");

                } catch (error) {
                    console.error("Erro ao registrar coleta online, salvando offline:", error);
                    try {
                        await OfflineDB.add('offline-writes', {
                            id: `collect_${trapId}_${Date.now()}`, // Unique ID for the write operation
                            type: 'update', // Specify the operation type
                            collection: 'armadilhas',
                            docId: trapId, // The document to update
                            data: updateData // The data for the update
                        });
                        App.ui.showAlert("Coleta salva offline. Será sincronizada quando houver conexão.", "info");
                    } catch (offlineError) {
                        console.error("Falha crítica ao salvar coleta offline:", offlineError);
                        App.ui.showAlert("Falha crítica ao salvar a coleta offline.", "error");
                        // Revert optimistic UI update if offline save also fails
                        const trap = App.state.armadilhas.find(t => t.id === trapId);
                        if (trap) {
                            trap.status = "Ativa";
                            this.addOrUpdateTrapMarker(trap);
                        }
                    }
                }
            },

            async deleteTrap(trapId) {
                App.ui.showConfirmationModal(
                    "Tem a certeza que deseja excluir esta armadilha? Esta ação é irreversível.",
                    async () => {
                        try {
                            await App.data.deleteDocument('armadilhas', trapId);
                            
                            if (App.state.mapboxTrapMarkers[trapId]) {
                                App.state.mapboxTrapMarkers[trapId].remove();
                                delete App.state.mapboxTrapMarkers[trapId];
                            }
                            
                            App.state.armadilhas = App.state.armadilhas.filter(t => t.id !== trapId);

                            App.ui.showAlert("Armadilha excluída com sucesso.", "info");
                            this.hideTrapInfo();
                        } catch (error) {
                            console.error("Erro ao excluir armadilha:", error);
                            App.ui.showAlert("Falha ao excluir armadilha.", "error");
                        }
                    }
                );
            },

            async editTrap(trapId) {
                const trap = App.state.armadilhas.find(t => t.id === trapId);
                if (!trap) return;

                App.ui.showConfirmationModal(
                    `Editar observações para a armadilha em ${trap.talhaoNome || 'local desconhecido'}:`,
                    async (newObservations) => {
                        if (newObservations === null) return;
                        try {
                            await App.data.updateDocument('armadilhas', trapId, { observacoes: newObservations });
                            trap.observacoes = newObservations;
                            this.showTrapInfo(trapId);
                            App.ui.showAlert("Observações atualizadas.", "success");
                        } catch (error) {
                            console.error("Erro ao editar armadilha:", error);
                            App.ui.showAlert("Falha ao atualizar observações.", "error");
                        }
                    },
                    true // needsInput
                );
                
                const input = App.elements.confirmationModal.input;
                input.value = trap.observacoes || '';
                input.placeholder = 'Digite suas observações...';
                App.elements.confirmationModal.confirmBtn.textContent = "Salvar";
            },
            
            showTrapInfo(trapId) {
                try {
                    const trap = App.state.armadilhas.find(t => t.id === trapId);
                    if (!trap) return;

                    const installDate = trap._installDateNormalized || this.parseTrapDate(trap.dataInstalacao);

                    if (!installDate) {
                        this.logInvalidTrapDate(trap, 'showTrapInfo');
                        App.ui.showAlert("Não foi possível abrir os detalhes: a data de instalação desta armadilha está corrompida ou em formato incompatível.", "warning", 5000);
                        return;
                    }

                    const collectionDate = new Date(installDate);
                    collectionDate.setDate(installDate.getDate() + 7);
                    const now = new Date();

                    const diasDesdeInstalacao = Math.floor((now - installDate) / (1000 * 60 * 60 * 24));

                    let statusText = 'Normal';
                    let statusColor = 'var(--color-success)';
                    if (diasDesdeInstalacao >= 5 && diasDesdeInstalacao <= 7) {
                        const diasRestantes = 7 - diasDesdeInstalacao;
                        statusText = `Atenção (${diasRestantes} dias restantes)`;
                        statusColor = 'var(--color-warning)';
                    } else if (diasDesdeInstalacao > 7) {
                        const diasAtraso = diasDesdeInstalacao - 7;
                        statusText = `Atrasado (${diasAtraso} dias)`;
                        statusColor = 'var(--color-danger)';
                    }

                    const contentEl = App.elements.monitoramentoAereo.trapInfoBoxContent;
                    contentEl.innerHTML = `
                        <div class="info-title" style="color: ${statusColor};">
                            <i class="fas fa-bug"></i>
                            <span>Detalhes da Armadilha</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Status</span>
                            <span class="value"><span class="status-indicator" style="background-color: ${statusColor};"></span>${statusText}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Fazenda</span>
                            <span class="value">${trap.fazendaNome || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Talhão</span>
                            <span class="value">${trap.talhaoNome || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Data de Instalação</span>
                            <span class="value">${installDate.toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">Data Prevista para Coleta</span>
                            <span class="value">${collectionDate.toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div class="info-item" id="trap-obs-display" style="${trap.observacoes ? 'display: flex;' : 'display: none;'}">
                            <span class="label">Observações</span>
                            <span class="value" style="white-space: pre-wrap; font-size: 14px;">${trap.observacoes || ''}</span>
                        </div>
                        <div class="info-box-actions">
                            <button class="btn-collect-trap" id="btnCollectTrap"><i class="fas fa-check-circle"></i> Coletar</button>
                            <div class="action-button-group">
                                <button class="action-btn" id="btnEditTrap" title="Editar Observações"><i class="fas fa-edit"></i></button>
                                <button class="action-btn danger" id="btnDeleteTrap" title="Excluir Armadilha"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    `;

                    document.getElementById('btnCollectTrap').onclick = () => this.promptCollectTrap(trapId);
                    document.getElementById('btnEditTrap').onclick = () => this.editTrap(trapId);
                    document.getElementById('btnDeleteTrap').onclick = () => this.deleteTrap(trapId);

                    this.hideTalhaoInfo();
                    App.elements.monitoramentoAereo.trapInfoBox.classList.add('visible');
                } catch (error) {
                    console.error("Erro ao exibir informações da armadilha:", error);
                    App.ui.showAlert(`Não foi possível carregar os dados desta armadilha. Pode haver dados corrompidos. Erro: ${error.message}`, "error", 5000);
                }
            },

            hideTrapInfo() {
                App.elements.monitoramentoAereo.trapInfoBox.classList.remove('visible');
            },
            
            // Verifica o status das armadilhas para gerar notificações de coleta
            checkTrapStatusAndNotify() {
                const activeTraps = App.state.armadilhas.filter(t => t.status === 'Ativa');
                let newNotificationsForBell = [];
                
                activeTraps.forEach(trap => {
                    const installDate = trap._installDateNormalized || this.parseTrapDate(trap.dataInstalacao);
                    if (!installDate) {
                        this.logInvalidTrapDate(trap, 'checkTrapStatusAndNotify');
                        return;
                    }

                    const now = new Date();
                    const diasDesdeInstalacao = Math.floor((now - installDate) / (1000 * 60 * 60 * 24));

                    let notification = null;
                    if (diasDesdeInstalacao >= 5 && diasDesdeInstalacao <= 7) {
                        const diasRestantes = 7 - diasDesdeInstalacao;
                        const msg = diasRestantes > 0 ? `Coleta em ${diasRestantes} dia(s).` : "Coleta hoje.";
                        notification = { trapId: trap.id, type: 'warning', message: msg, timestamp: new Date() };
                    } else if (diasDesdeInstalacao > 7) {
                        const diasAtraso = diasDesdeInstalacao - 7;
                        notification = { trapId: trap.id, type: 'danger', message: `Coleta atrasada em ${diasAtraso} dia(s).`, timestamp: new Date() };
                    }

                    if (notification) {
                        // Adiciona para a lista do sino
                        newNotificationsForBell.push(notification);

                        // Mostra o pop-up apenas se não foi mostrado nesta sessão
                        if (!App.state.notifiedTrapIds.has(trap.id)) {
                            this.showTrapNotification(notification);
                            App.state.notifiedTrapIds.add(trap.id);
                            sessionStorage.setItem('notifiedTrapIds', JSON.stringify(Array.from(App.state.notifiedTrapIds)));
                        }
                    }
                });

                // Atualiza o estado geral de notificações
                const unreadNotifications = newNotificationsForBell.filter(n => !App.state.trapNotifications.some(oldN => oldN.trapId === n.trapId && oldN.message === n.message));
                if (unreadNotifications.length > 0) {
                    App.state.unreadNotificationCount += unreadNotifications.length;
                }
                App.state.trapNotifications = newNotificationsForBell.sort((a, b) => b.timestamp - a.timestamp);
                App.ui.updateNotificationBell();
            },

            showTrapNotification(notification) {
                App.ui.showFloatingNotification({
                    title: 'Armadilha requer atenção',
                    message: notification.message,
                    type: notification.type,
                    trapId: notification.trapId
                });
            },

            toggleRiskView() {
                App.state.riskViewActive = !App.state.riskViewActive;
                this.calculateAndApplyRiskView();
            },

            calculateAndApplyRiskView() {
                const map = App.state.mapboxMap;
                if (!map || !App.state.geoJsonData) return;

                console.log("--- [START] calculateAndApplyRiskView ---");

                // Limpa o estado de risco de features anteriormente destacadas
                if (map.riskFarmFeatureIds) {
                    map.riskFarmFeatureIds.forEach(id => {
                        map.setFeatureState({ source: 'talhoes-source', id: id }, { risk: false });
                    });
                }
                map.riskFarmFeatureIds = [];

                if (!App.state.riskViewActive) {
                    App.elements.monitoramentoAereo.btnToggleRiskView.classList.remove('active');

                    const themeColors = App.ui._getThemeColors();
                    // Restaura as propriedades de pintura originais para a visualização normal
                    map.setPaintProperty('talhoes-layer', 'fill-color', [
                        'case',
                        ['boolean', ['feature-state', 'selected'], false], themeColors.primary,
                        ['boolean', ['feature-state', 'hover'], false], '#607D8B', // Cinza claro para hover
                        ['boolean', ['feature-state', 'risk'], false], '#d32f2f', // Vermelho para risco
                        '#1C1C1C' // Cinza escuro padrão
                    ]);
                    map.setPaintProperty('talhoes-layer', 'fill-opacity', [
                        'case',
                        ['boolean', ['feature-state', 'selected'], false], 0.8,
                        ['boolean', ['feature-state', 'hover'], false], 0.7,
                        ['boolean', ['feature-state', 'risk'], false], 0.6,
                        0.5 // Opacidade padrão
                    ]);
                    map.setPaintProperty('talhoes-border-layer', 'line-opacity', 0.9);

                    // Garante que todos os rótulos sejam exibidos ao desativar a visualização de risco
                    map.setFilter('talhoes-labels', null);
                    this.loadTraps();
                    console.log("Risk view desativada. Revertendo para a visualização padrão.");
                    console.log("--- [END] calculateAndApplyRiskView ---");
                    return;
                }

                // Se a visualização de risco está ativa, preparamos o UI
                App.elements.monitoramentoAereo.btnToggleRiskView.classList.add('active');
                Object.values(App.state.mapboxTrapMarkers).forEach(marker => marker.remove());
                App.state.mapboxTrapMarkers = {};

                // --- 1. CALCULAR O RISCO PRIMEIRO ---
                const currentUserCompanyId = App.state.currentUser.companyId;
                if (!currentUserCompanyId && App.state.currentUser.role !== 'super-admin') {
                    App.ui.showAlert("A sua conta não está associada a uma empresa.", "error");
                    console.log("--- [END] calculateAndApplyRiskView ---");
                    return;
                }

                const farmsInRisk = new Set();
                const farmRiskPercentages = {};

                const allFarms = App.state.fazendas.filter(f => f.companyId === currentUserCompanyId);
                const companyTraps = App.state.armadilhas.filter(t => t.companyId === currentUserCompanyId);
                const collectedTraps = companyTraps.filter(t => t.status === 'Coletada');

                console.log(`[RISK_DEBUG] Encontradas ${allFarms.length} fazendas, ${companyTraps.length} armadilhas no total, ${collectedTraps.length} armadilhas coletadas para a empresa.`);

                allFarms.forEach(farm => {
                    const collectedTrapsOnFarm = collectedTraps.filter(t =>
                        (t.fazendaCode ? parseInt(String(t.fazendaCode).trim()) === parseInt(String(farm.code).trim()) : t.fazendaNome === farm.name)
                    );

                    if (collectedTrapsOnFarm.length === 0) {
                        farmRiskPercentages[farm.code] = 0;
                        return; // Skip if no collections, risk is 0
                    }

                    // 1. Find the most recent collection date on this farm
                    let mostRecentCollectionDate = new Date(0);
                    collectedTrapsOnFarm.forEach(trap => {
                        const collectionDate = trap.dataColeta?.toDate ? trap.dataColeta.toDate() : new Date(trap.dataColeta);
                        if (collectionDate > mostRecentCollectionDate) {
                            mostRecentCollectionDate = collectionDate;
                        }
                    });

                    // 2. Filter to get only collections from that specific day (the monitoring cycle)
                    const latestCycleCollections = collectedTrapsOnFarm.filter(trap => {
                        const collectionDate = trap.dataColeta?.toDate ? trap.dataColeta.toDate() : new Date(trap.dataColeta);
                        return collectionDate.getFullYear() === mostRecentCollectionDate.getFullYear() &&
                               collectionDate.getMonth() === mostRecentCollectionDate.getMonth() &&
                               collectionDate.getDate() === mostRecentCollectionDate.getDate();
                    });

                    // 3. Deduplicate collections for the same trap, keeping only the latest one by time
                    const latestUniqueCollections = new Map();
                    latestCycleCollections.forEach(trap => {
                        // A trap is uniquely identified by its ID
                        const trapKey = trap.id;
                        const existing = latestUniqueCollections.get(trapKey);
                        const collectionDate = trap.dataColeta?.toDate ? trap.dataColeta.toDate() : new Date(trap.dataColeta);
                        if (!existing || collectionDate > (existing.dataColeta?.toDate ? existing.dataColeta.toDate() : new Date(existing.dataColeta))) {
                            latestUniqueCollections.set(trapKey, trap);
                        }
                    });

                    const finalCycleTraps = Array.from(latestUniqueCollections.values());

                    // 4. Count high-risk traps within this final, unique set
                    const highCountTraps = finalCycleTraps.filter(t => t.contagemMariposas >= 6);

                    // Divisor is the number of traps collected in the latest cycle.
                    const divisor = finalCycleTraps.length;
                    const riskPercentage = divisor > 0 ? (highCountTraps.length / divisor) * 100 : 0;

                    farmRiskPercentages[farm.code] = riskPercentage;
                    if (riskPercentage > 30) {
                        farmsInRisk.add(parseInt(String(farm.code).trim(), 10));
                    }
                });

                App.state.farmRiskPercentages = farmRiskPercentages;
                console.log("[RISK_DEBUG] Códigos de fazendas em risco calculados:", Array.from(farmsInRisk));

                // --- 2. APLICAR ESTILOS COM BASE NOS RESULTADOS ---
                if (farmsInRisk.size > 0) {
                    console.log("[RISK_DEBUG] Fazendas em risco encontradas. Aplicando estilo de isolamento.");
                    // Isola as fazendas em risco, permitindo interação com elas
                    map.setPaintProperty('talhoes-layer', 'fill-color', [
                        'case',
                        ['boolean', ['feature-state', 'risk'], false], '#d32f2f', // Vermelho para risco
                        App.ui._getThemeColors().primary // Cor padrão (será invisível)
                    ]);
                    map.setPaintProperty('talhoes-layer', 'fill-opacity', [
                        'case',
                        ['boolean', ['feature-state', 'risk'], false],
                        ['case', ['boolean', ['feature-state', 'selected'], false], 0.85, ['boolean', ['feature-state', 'hover'], false], 0.6, 0.5],
                        0.0 // Invisível se não estiver em risco
                    ]);
                    map.setPaintProperty('talhoes-border-layer', 'line-opacity', [
                        'case',
                        ['boolean', ['feature-state', 'risk'], false], 0.9,
                        0.0 // Invisível se não estiver em risco
                    ]);

                    const allSourceFeatures = map.querySourceFeatures('talhoes-source');
                    const featuresToHighlight = allSourceFeatures.filter(feature => {
                        const farmCode = feature.properties.AGV_FUNDO;
                        return farmsInRisk.has(parseInt(String(farmCode).trim(), 10));
                    });

                    if (featuresToHighlight.length > 0) {
                        const featureIds = featuresToHighlight.map(f => f.id);
                        featureIds.forEach(id => {
                            map.setFeatureState({ source: 'talhoes-source', id: id }, { risk: true });
                        });
                        map.riskFarmFeatureIds = featureIds;

                        // Get the string representations of the farm codes in risk
                        const farmCodesInRiskAsStrings = Array.from(farmsInRisk, code => String(code));

                        // Filter labels to show only those for farms in risk
                        const labelFilter = ['in', ['get', 'AGV_FUNDO'], ['literal', farmCodesInRiskAsStrings]];
                        map.setFilter('talhoes-labels', labelFilter);

                        App.ui.showAlert(`${farmsInRisk.size} fazenda(s) em risco foram destacadas.`, 'info');
                    } else {
                         // This can happen if the farm code in risk doesn't match any map feature
                        console.warn("[RISK_DEBUG] Risk farms calculated, but no corresponding features found on the map.");
                        App.ui.showAlert('Nenhuma fazenda em risco foi identificada no mapa.', 'success');
                         // Revert to default view to avoid a blank map
                        map.setPaintProperty('talhoes-layer', 'fill-color', App.ui._getThemeColors().primary);
                        map.setPaintProperty('talhoes-layer', 'fill-opacity', 0.5);
                        map.setPaintProperty('talhoes-border-layer', 'line-opacity', 0.9);
                        map.setFilter('talhoes-labels', null); // Show all labels
                    }

                } else {
                    console.log("[RISK_DEBUG] No risk farms found. Displaying all plots normally.");
                    App.ui.showAlert('Nenhuma fazenda em risco foi identificada no período.', 'success');
                    // Ensure the map doesn't stay blank by reverting to the default view
                    map.setPaintProperty('talhoes-layer', 'fill-color', '#1C1C1C');
                    map.setPaintProperty('talhoes-layer', 'fill-opacity', 0.7);
                    map.setPaintProperty('talhoes-border-layer', 'line-opacity', 0.9);
                    map.setFilter('talhoes-labels', null); // Show all labels
                }

                console.log("--- [END] calculateAndApplyRiskView ---");
            },

            centerOnTrap(trapId) {
                const marker = App.state.mapboxTrapMarkers[trapId];
                if (marker) {
                    const position = marker.getLngLat();
                    App.state.mapboxMap.flyTo({ center: position, zoom: 18 });
                    this.showTrapInfo(trapId);
                }
            },

            toggleSearch() {
                const searchContainer = document.querySelector('.map-search-container');
                const searchInput = App.elements.monitoramentoAereo.mapFarmSearchInput;
                const searchBtn = App.elements.monitoramentoAereo.mapFarmSearchBtn;
                const searchBtnIcon = searchBtn.querySelector('i');

                const isActive = searchContainer.classList.contains('active');

                if (isActive) {
                    // Se estiver ativo, verifica se tem texto para pesquisar, senão apenas fecha
                    if (searchInput.value.trim() !== '') {
                        this.searchFarmOnMap();
                    } else {
                        searchContainer.classList.remove('active');
                        searchBtnIcon.className = 'fas fa-search';
                        searchInput.value = '';
                    }
                } else {
                    // Se não estiver ativo, ativa
                    searchContainer.classList.add('active');
                    searchBtnIcon.className = 'fas fa-times'; // Ícone de fechar
                    searchInput.focus();
                }
            },

            closeSearch() {
                const searchContainer = document.querySelector('.map-search-container');
                const searchInput = App.elements.monitoramentoAereo.mapFarmSearchInput;
                const searchBtn = App.elements.monitoramentoAereo.mapFarmSearchBtn;
                const searchBtnIcon = searchBtn.querySelector('i');

                if (searchContainer.classList.contains('active')) {
                    searchContainer.classList.remove('active');
                    searchBtnIcon.className = 'fas fa-search';
                    searchInput.value = '';
                }
            },

            searchFarmOnMap() {
                const searchInput = App.elements.monitoramentoAereo.mapFarmSearchInput;
                const searchTerm = searchInput.value.trim().toUpperCase();
                if (!searchTerm) {
                    this.closeSearch();
                    return;
                }

                const { geoJsonData, mapboxMap } = App.state;
                if (!geoJsonData || !mapboxMap) {
                    App.ui.showAlert("Os dados do mapa ainda não foram carregados.", "error");
                    return;
                }

                // Limpa a pesquisa anterior
                if (mapboxMap.searchedFarmFeatureIds) {
                    mapboxMap.searchedFarmFeatureIds.forEach(id => {
                        mapboxMap.setFeatureState({ source: 'talhoes-source', id: id }, { searched: false });
                    });
                }
                mapboxMap.searchedFarmFeatureIds = [];

                // Procura diretamente no GeoJSON pela propriedade normalizada AGV_FUNDO
                const foundFeatures = geoJsonData.features.filter(feature => {
                    const fundoAgricola = feature.properties.AGV_FUNDO;
                    return fundoAgricola && fundoAgricola.toUpperCase().includes(searchTerm);
                });

                if (foundFeatures.length === 0) {
                    App.ui.showAlert(`Nenhum fundo agrícola encontrado com o termo "${searchInput.value}" no mapa.`, "info");
                    return;
                }

                const featureCollection = turf.featureCollection(foundFeatures);
                const bbox = turf.bbox(featureCollection);
                const bounds = [[bbox[0], bbox[1]], [bbox[2], bbox[3]]];

                mapboxMap.fitBounds(bounds, {
                    padding: 60,
                    maxZoom: 14,
                    duration: 1500
                });

                const featureIdsToHighlight = foundFeatures.map(f => f.id);
                featureIdsToHighlight.forEach(id => {
                    mapboxMap.setFeatureState({ source: 'talhoes-source', id: id }, { searched: true });
                });
                mapboxMap.searchedFarmFeatureIds = featureIdsToHighlight;

                // Remove o destaque após 8 segundos
                setTimeout(() => {
                    featureIdsToHighlight.forEach(id => {
                        if (mapboxMap.searchedFarmFeatureIds && mapboxMap.searchedFarmFeatureIds.includes(id)) {
                             mapboxMap.setFeatureState({ source: 'talhoes-source', id: id }, { searched: false });
                        }
                    });
                }, 8000);
            },

        };
    App.estimativaSafra = {
            initialized: false,
            eventsBound: false,
            currentData: [],
            currentFeatureMap: new Map(),
            currentSelectedKey: null,
            currentSelectedKeys: new Set(),
            currentSelectedFeatureIds: new Set(),
            legendExpanded: true,
            summaryExpanded: true,
            infoExpanded: true,
            labelsVisible: true,
            stagePalette: ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4', '#469990', '#dcbeff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#a9a9a9'],
            bindEvents() {
                if (this.eventsBound) return;
                const els = App.elements.estimativaSafra;
                if (!els) return;
                [els.farmFilter, els.varietyFilter, els.stageFilter].forEach((el) => {
                    if (el) el.addEventListener('change', () => this.refresh());
                });
                if (els.searchInput) els.searchInput.addEventListener('input', () => this.refresh());
                if (els.openFiltersBtn) els.openFiltersBtn.addEventListener('click', () => this.openFiltersModal());
                if (els.toggleToolbarBtn) els.toggleToolbarBtn.addEventListener('click', () => this.toggleToolbar());
                if (els.filtersModalClose) els.filtersModalClose.addEventListener('click', () => this.closeFiltersModal());
                if (els.applyFiltersBtn) els.applyFiltersBtn.addEventListener('click', () => { this.closeFiltersModal(); this.refresh(); });
                if (els.clearFiltersBtn) els.clearFiltersBtn.addEventListener('click', () => this.clearFilters());
                if (els.centerMapBtn) els.centerMapBtn.addEventListener('click', () => this.centerMap());
                if (els.closeInfoBtn) els.closeInfoBtn.addEventListener('click', () => this.hideInfoBox());
                if (els.modalClose) els.modalClose.addEventListener('click', () => this.closeModal());
                if (els.modalCancel) els.modalCancel.addEventListener('click', () => this.closeModal());
                if (els.modalSave) els.modalSave.addEventListener('click', () => this.saveEstimate());
                if (els.modalTch) els.modalTch.addEventListener('input', () => this.syncDerivedFields('tch'));
                if (els.modalToneladas) els.modalToneladas.addEventListener('input', () => this.syncDerivedFields('toneladas'));
                if (els.modal) els.modal.addEventListener('click', (event) => {
                    if (event.target === els.modal) this.closeModal();
                });
                if (els.filtersModal) els.filtersModal.addEventListener('click', (event) => {
                    if (event.target === els.filtersModal) this.closeFiltersModal();
                });

                const exclusiveChecks = [els.modalEstimateWholeFarm, els.modalEstimateSelected, els.modalEstimateFiltered].filter(Boolean);
                const syncScopeCards = () => {
                    [['estimativaSafraScopeWholeFarmCard', els.modalEstimateWholeFarm], ['estimativaSafraScopeSelectedCard', els.modalEstimateSelected], ['estimativaSafraScopeFilteredCard', els.modalEstimateFiltered]].forEach(([id, input]) => {
                        const card = document.getElementById(id);
                        if (card) card.classList.toggle('active', Boolean(input?.checked));
                    });
                    this.refreshEstimateModalScope();
                };
                exclusiveChecks.forEach((check) => check.addEventListener('change', () => {
                    if (check.checked) exclusiveChecks.forEach((other) => { if (other !== check) other.checked = false; });
                    syncScopeCards();
                }));
                syncScopeCards();
                this.eventsBound = true;
            },
            async init() {
                this.bindEvents();
                if (this.isMobileViewport()) {
                    this.legendExpanded = false;
                    this.summaryExpanded = false;
                    this.infoExpanded = false;
                    App.elements.estimativaSafra?.toolbarCard?.classList.add('collapsed');
                }
                await this.ensureShapesReady();
                await this.ensureMap();
                this.renderLegend();
                this.refresh();
                this.initialized = true;
            },
            isMobileViewport() {
                return window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
            },
            async ensureShapesReady() {
                if (App.state.geoJsonData?.features?.length) return true;
                const shapefileURL = App.state.companyConfig?.shapefileURL;
                if (!shapefileURL) {
                    App.ui.showAlert('Configure o SHP da empresa para usar o módulo Estimativa Safra.', 'warning');
                    return false;
                }
                try {
                    await App.mapModule.loadAndCacheShapes(shapefileURL);
                    return Boolean(App.state.geoJsonData?.features?.length);
                } catch (error) {
                    console.error('[EstimativaSafra] Falha ao carregar SHP', error);
                    App.ui.showAlert('Não foi possível carregar o SHP do módulo Estimativa Safra.', 'error');
                    return false;
                }
            },
            async ensureMap() {
                if (App.state.estimativaSafraMap) {
                    setTimeout(() => App.state.estimativaSafraMap.resize(), 0);
                    return App.state.estimativaSafraMap;
                }
                if (typeof mapboxgl === 'undefined') {
                    App.ui.showAlert('Mapbox GL não está carregado no app.', 'error');
                    return null;
                }
                mapboxgl.accessToken = 'pk.eyJ1IjoiY2FybG9zaGduIiwiYSI6ImNtZDk0bXVxeTA0MTcyam9sb2h1dDhxaG8ifQ.uf0av4a0WQ9sxM1RcFYT2w';
                const map = new mapboxgl.Map({
                    container: App.elements.estimativaSafra.mapContainer,
                    style: 'mapbox://styles/mapbox/satellite-streets-v12',
                    center: [-47.5, -22.5],
                    zoom: 8,
                    attributionControl: false
                });
                map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');
                await new Promise((resolve, reject) => {
                    map.once('load', resolve);
                    map.once('error', (error) => reject(error?.error || error));
                });
                App.state.estimativaSafraMap = map;
                App.state.estimativaSafraMapLoaded = true;
                return map;
            },
            normalizeFarmCode(value) {
                const raw = String(value || '').trim();
                if (!raw) return '';
                return /^\d+$/.test(raw) ? String(Number(raw)) : raw.toUpperCase();
            },
            getFarmCodeByFeature(feature) {
                return this.normalizeFarmCode(feature?.properties?.AGV_FUNDO || '');
            },
            getTalhaoNameByFeature(feature) {
                return String(feature?.properties?.AGV_TALHAO || '').trim().toUpperCase();
            },
            getFeatureKey(featureOrFarmCode, talhaoName) {
                if (typeof featureOrFarmCode === 'object') {
                    return `${this.getFarmCodeByFeature(featureOrFarmCode)}::${this.getTalhaoNameByFeature(featureOrFarmCode)}`;
                }
                return `${this.normalizeFarmCode(featureOrFarmCode || '')}::${String(talhaoName || '').trim().toUpperCase()}`;
            },
            getFarmByCode(code) {
                const normalized = this.normalizeFarmCode(code);
                return (App.state.fazendas || []).find((farm) => this.normalizeFarmCode(farm.code) === normalized);
            },

            getFarmDisplayName(item) {
                const code = this.normalizeFarmCode(item?.farmCode || item?.farm?.code || item?.farmId || '');
                const name = String(item?.farmName || item?.farm?.name || '').trim();
                return code && name ? `${code} - ${name}` : (name || code || 'Não identificada');
            },
            summarizeSelection(values, emptyText = '-') {
                const unique = [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))];
                if (!unique.length) return emptyText;
                if (unique.length <= 2) return unique.join(' · ');
                return `${unique[0]} · ${unique[1]} +${unique.length - 2}`;
            },
            sortFarmOptions(items) {
                return [...items].sort((a, b) => {
                    const codeA = this.normalizeFarmCode(a.farmCode || a.farm?.code || a.farmId || '');
                    const codeB = this.normalizeFarmCode(b.farmCode || b.farm?.code || b.farmId || '');
                    const numA = Number.parseInt(codeA, 10);
                    const numB = Number.parseInt(codeB, 10);
                    if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) return numA - numB;
                    if (Number.isFinite(numA) && !Number.isFinite(numB)) return -1;
                    if (!Number.isFinite(numA) && Number.isFinite(numB)) return 1;
                    return this.getFarmDisplayName(a).localeCompare(this.getFarmDisplayName(b), undefined, { numeric: true, sensitivity: 'base' });
                });
            },
            getTalhaoRecord(feature) {
                const farm = this.getFarmByCode(this.getFarmCodeByFeature(feature));
                const talhaoName = this.getTalhaoNameByFeature(feature);
                const talhao = (farm?.talhoes || []).find((item) => String(item.name || '').trim().toUpperCase() === talhaoName);
                return { farm, talhao };
            },
            getStageLabel(corte) {
                const n = Number.parseInt(corte, 10);
                if (Number.isFinite(n) && n > 0) return `${n}º corte`;
                return 'Sem estágio';
            },
            getStageOrder(stage) {
                const match = String(stage || '').match(/^(\d+)/);
                return match ? Number.parseInt(match[1], 10) : 999;
            },
            getStageColor(stage) {
                if (stage === 'Sem estágio') return '#a1a1aa';
                const order = this.getStageOrder(stage);
                const idx = Number.isFinite(order) && order > 0 ? (order - 1) % this.stagePalette.length : 0;
                return this.stagePalette[idx];
            },
            getArea(feature, talhao) {
                const raw = talhao?.area ?? feature?.properties?.AREA_HA ?? feature?.properties?.AREA ?? 0;
                const value = Number.parseFloat(String(raw).replace(',', '.'));
                return Number.isFinite(value) ? value : 0;
            },
            buildDataset() {
                const features = App.state.geoJsonData?.features || [];
                const estimates = App.state.estimativasSafra || [];
                this.currentFeatureMap = new Map();
                return features.map((feature) => {
                    const { farm, talhao } = this.getTalhaoRecord(feature);
                    const featureKey = this.getFeatureKey(feature);
                    const farmName = farm?.name || this.getFarmCodeByFeature(feature) || 'Não identificada';
                    const talhaoName = talhao?.name || this.getTalhaoNameByFeature(feature) || 'Não identificado';
                    const stage = this.getStageLabel(talhao?.corte);
                    const history = estimates.filter((item) => String(item.featureKey || '') === featureKey)
                        .sort((a, b) => new Date(b.createdAtLocal || b.dataEstimativa || 0) - new Date(a.createdAtLocal || a.dataEstimativa || 0));
                    const latest = history[0] || null;
                    const item = {
                        feature,
                        featureKey,
                        farmId: farm?.id || null,
                        farmCode: farm?.code || this.getFarmCodeByFeature(feature),
                        farmName,
                        talhaoId: talhao?.id || null,
                        talhaoName,
                        variedade: talhao?.variedade || 'Sem variedade',
                        corte: talhao?.corte || null,
                        stage,
                        area: this.getArea(feature, talhao),
                        latestEstimate: latest,
                        estimateHistory: history,
                        status: latest ? (history.length > 1 ? 'Reestimado' : 'Estimado') : 'Pendente'
                    };
                    this.currentFeatureMap.set(featureKey, item);
                    return item;
                });
            },

            openFiltersModal() {
                App.elements.estimativaSafra?.filtersModal?.classList.add('show');
            },
            closeFiltersModal() {
                App.elements.estimativaSafra?.filtersModal?.classList.remove('show');
            },
            toggleToolbar() {
                const card = App.elements.estimativaSafra?.toolbarCard;
                if (!card) return;
                card.classList.toggle('collapsed');
                const icon = App.elements.estimativaSafra?.toggleToolbarBtn?.querySelector('i');
                if (icon) {
                    icon.className = card.classList.contains('collapsed') ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
                }
            },
            updateActiveFilterSummary() {
                const els = App.elements.estimativaSafra;
                if (!els?.activeFilters) return;
                const parts = [];
                if (els.farmFilter?.value) parts.push(`Fundo: ${els.farmFilter.options[els.farmFilter.selectedIndex]?.text || els.farmFilter.value}`);
                if (els.varietyFilter?.value) parts.push(`Variedade: ${els.varietyFilter.value}`);
                if (els.stageFilter?.value) parts.push(`Corte: ${els.stageFilter.value}`);
                if (String(els.searchInput?.value || '').trim()) parts.push(`Talhão: ${String(els.searchInput.value).trim()}`);
                els.activeFilters.textContent = parts.length ? parts.join(' · ') : 'Sem filtros';
            },
            populateFilters(dataset) {
                const els = App.elements.estimativaSafra;
                const currentFarm = els.farmFilter.value;
                const currentVariety = els.varietyFilter.value;
                const currentStage = els.stageFilter.value;
                const farmOptions = this.sortFarmOptions([...new Map(dataset.map((item) => [String(item.farmId || item.farmCode), item])).values()]);
                els.farmFilter.innerHTML = '<option value="">Todas</option>' + farmOptions.map((item) => `<option value="${item.farmId || item.farmCode}">${this.getFarmDisplayName(item)}</option>`).join('');
                if (farmOptions.some((item) => String(item.farmId || item.farmCode) === String(currentFarm))) els.farmFilter.value = currentFarm;
                const afterFarm = dataset.filter((item) => !els.farmFilter.value || String(item.farmId || item.farmCode) === String(els.farmFilter.value));
                const varieties = [...new Set(afterFarm.map((item) => item.variedade).filter(Boolean))].sort((a,b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }));
                els.varietyFilter.innerHTML = '<option value="">Todas</option>' + varieties.map((value) => `<option value="${value}">${value}</option>`).join('');
                if (varieties.includes(currentVariety)) els.varietyFilter.value = currentVariety;
                const afterVariety = afterFarm.filter((item) => !els.varietyFilter.value || item.variedade === els.varietyFilter.value);
                const stages = [...new Set(afterVariety.map((item) => item.stage))].sort((a,b) => this.getStageOrder(a) - this.getStageOrder(b));
                els.stageFilter.innerHTML = '<option value="">Todos</option>' + stages.map((value) => `<option value="${value}">${value}</option>`).join('');
                if (stages.includes(currentStage)) els.stageFilter.value = currentStage;
                this.updateActiveFilterSummary();
            },
            filterDataset(dataset) {
                const els = App.elements.estimativaSafra;
                const farmValue = els.farmFilter.value;
                const varietyValue = els.varietyFilter.value;
                const stageValue = els.stageFilter.value;
                const searchValue = String(els.searchInput.value || '').trim().toUpperCase();
                return dataset.filter((item) => {
                    if (farmValue && String(item.farmId || item.farmCode) !== String(farmValue)) return false;
                    if (varietyValue && item.variedade !== varietyValue) return false;
                    if (stageValue && item.stage !== stageValue) return false;
                    if (searchValue && !(`${item.talhaoName} ${item.farmName}`.toUpperCase().includes(searchValue))) return false;
                    return true;
                });
            },
            refresh() {
                if (!App.state.geoJsonData?.features?.length || !App.state.estimativaSafraMap) return;
                const dataset = this.buildDataset();
                this.populateFilters(dataset);
                const filtered = this.filterDataset(dataset);
                this.currentData = filtered;
                this.renderMapData(filtered);
                this.renderSummary(filtered);
                this.renderLegend();
                const visibleKeys = new Set(filtered.map((item) => item.featureKey));
                this.currentSelectedKeys = new Set([...this.currentSelectedKeys].filter((key) => visibleKeys.has(key)));
                if (!this.currentSelectedKeys.size && this.currentSelectedKey && visibleKeys.has(this.currentSelectedKey)) {
                    this.currentSelectedKeys.add(this.currentSelectedKey);
                }
                if (!this.currentSelectedKeys.size) {
                    this.currentSelectedKey = null;
                    this.hideInfoBox();
                } else {
                    this.currentSelectedKey = [...this.currentSelectedKeys][0] || null;
                    this.showInfo();
                }
            },
            renderLegend() {
                const legend = App.elements.estimativaSafra.legend;
                if (!legend) return;
                const dataset = this.currentData?.length ? this.currentData : this.buildDataset();
                const stages = [...new Set(dataset.map((item) => item.stage))].sort((a,b) => this.getStageOrder(a) - this.getStageOrder(b));
                const isMobile = this.isMobileViewport();

                if (!this.legendExpanded) {
                    legend.className = 'estimativa-legend is-collapsed is-fab';
                    legend.innerHTML = `
                        <button type="button" class="estimativa-legend-fab-btn" data-action="toggle-legend" aria-label="Expandir legenda" title="Expandir legenda">
                            <i class="fas fa-palette"></i>
                        </button>`;
                    legend.querySelector('[data-action="toggle-legend"]')?.addEventListener('click', () => this.toggleLegend());
                    return;
                }

                const title = isMobile ? `<i class="fas fa-palette"></i><span>Legenda</span>` : `<i class="fas fa-palette"></i><span>Estágios de corte</span>`;
                const labelsBtnText = isMobile
                    ? (this.labelsVisible ? 'Nomes' : 'Mostrar')
                    : (this.labelsVisible ? 'Ocultar nomes' : 'Exibir nomes');
                const labelsBtn = `<button type="button" class="estimativa-mini-btn" data-action="toggle-labels">${labelsBtnText}</button>`;
                legend.className = 'estimativa-legend';
                legend.innerHTML = `
                    <div class="estimativa-legend-header ${isMobile ? 'mobile' : ''}">
                        <div class="estimativa-legend-title-wrap">
                            <h3>${title}</h3>
                        </div>
                        <div class="estimativa-legend-actions">
                            ${labelsBtn}
                            <button type="button" class="estimativa-mini-btn" data-action="toggle-legend">Recolher</button>
                        </div>
                    </div>
                    <div class="estimativa-legend-body">
                        ${stages.map((label) => `<div class="estimativa-legend-item"><span class="estimativa-legend-color" style="background:${this.getStageColor(label)}"></span><span>${label}</span></div>`).join('')}
                    </div>`;
                legend.querySelector('[data-action="toggle-legend"]')?.addEventListener('click', () => this.toggleLegend());
                legend.querySelector('[data-action="toggle-labels"]')?.addEventListener('click', () => this.toggleLabels());
            },
            toggleLegend() {
                this.legendExpanded = !this.legendExpanded;
                this.renderLegend();
            },
            toggleSummary() {
                this.summaryExpanded = !this.summaryExpanded;
                this.renderSummary(this.currentData?.length ? this.currentData : this.buildDataset());
            },
            toggleInfo() {
                this.infoExpanded = !this.infoExpanded;
                if (this.currentSelectedKeys.size) this.showInfo();
            },
            toggleLabels() {
                const map = App.state.estimativaSafraMap;
                if (!map || !map.getLayer('estimativa-safra-label')) return;
                this.labelsVisible = !this.labelsVisible;
                map.setLayoutProperty('estimativa-safra-label', 'visibility', this.labelsVisible ? 'visible' : 'none');
                this.renderLegend();
            },
            renderSummary(dataset) {
                const summary = App.elements.estimativaSafra.summary;
                if (!summary) return;
                const totalArea = dataset.reduce((sum, item) => sum + (item.area || 0), 0);
                const estimated = dataset.filter((item) => item.latestEstimate).length;
                const pending = dataset.length - estimated;
                const tons = dataset.reduce((sum, item) => sum + (Number(item.latestEstimate?.toneladasEstimadas) || 0), 0);
                const isMobile = this.isMobileViewport();
                const compactLine = `${dataset.length} talhões · ${totalArea.toFixed(1).replace('.', ',')} ha`;

                if (isMobile && !this.summaryExpanded) {
                    summary.className = 'estimativa-summary is-collapsed is-fab';
                    summary.innerHTML = `
                        <button type="button" class="estimativa-summary-fab-btn" data-action="toggle-summary" aria-label="Expandir resumo" title="Expandir resumo">
                            <i class="fas fa-chart-pie"></i>
                        </button>`;
                    summary.querySelector('[data-action="toggle-summary"]')?.addEventListener('click', () => this.toggleSummary());
                    return;
                }

                summary.className = 'estimativa-summary';
                const bodyStyle = this.summaryExpanded ? '' : 'style="display:none;"';
                summary.innerHTML = `
                    <div class="estimativa-panel-header ${isMobile ? 'mobile' : ''}">
                        <div>
                            <span class="estimativa-panel-kicker">Resumo</span>
                            <strong class="estimativa-panel-title">${compactLine}</strong>
                        </div>
                        <button type="button" class="estimativa-mini-btn" data-action="toggle-summary">${this.summaryExpanded ? 'Recolher' : 'Abrir'}</button>
                    </div>
                    <div class="estimativa-panel-body" ${bodyStyle}>
                        <div class="estimativa-summary-item"><span class="label">Talhões</span><span class="value">${dataset.length}</span></div>
                        <div class="estimativa-summary-item"><span class="label">Área filtrada</span><span class="value">${totalArea.toFixed(1).replace('.', ',')} ha</span></div>
                        <div class="estimativa-summary-item"><span class="label">Estimados</span><span class="value">${estimated}</span></div>
                        <div class="estimativa-summary-item"><span class="label">Pendentes</span><span class="value">${pending}</span></div>
                        <div class="estimativa-summary-item"><span class="label">Toneladas</span><span class="value">${tons.toFixed(0).replace('.', ',')}</span></div>
                    </div>
                `;
                summary.querySelector('[data-action="toggle-summary"]')?.addEventListener('click', () => this.toggleSummary());
            },
            renderMapData(dataset) {
                const map = App.state.estimativaSafraMap;
                if (!map) return;
                const sourceId = 'estimativa-safra-source';
                const fillLayerId = 'estimativa-safra-fill';
                const lineLayerId = 'estimativa-safra-line';
                const labelLayerId = 'estimativa-safra-label';
                const geojson = {
                    type: 'FeatureCollection',
                    features: dataset.map((item) => ({
                        ...item.feature,
                        id: item.feature.id,
                        properties: {
                            ...(item.feature.properties || {}),
                            featureKey: item.featureKey,
                            farmName: item.farmName,
                            talhaoName: item.talhaoName,
                            variedade: item.variedade,
                            stage: item.stage,
                            stageColor: this.getStageColor(item.stage),
                            areaValue: item.area,
                            status: item.status
                        }
                    }))
                };
                if (map.getSource(sourceId)) {
                    map.getSource(sourceId).setData(geojson);
                } else {
                    map.addSource(sourceId, { type: 'geojson', data: geojson, generateId: false });
                }
                if (!map.getLayer(fillLayerId)) {
                    map.addLayer({
                        id: fillLayerId,
                        type: 'fill',
                        source: sourceId,
                        paint: {
                            'fill-color': ['coalesce', ['get', 'stageColor'], '#94a3b8'],
                            'fill-opacity': [
                                'case',
                                ['boolean', ['feature-state', 'selected'], false], 0.92,
                                ['boolean', ['feature-state', 'hover'], false], 0.82,
                                0.62
                            ]
                        }
                    });
                }
                if (!map.getLayer(lineLayerId)) {
                    map.addLayer({
                        id: lineLayerId,
                        type: 'line',
                        source: sourceId,
                        paint: {
                            'line-color': [
                                'case',
                                ['boolean', ['feature-state', 'selected'], false], '#ffffff',
                                '#0f172a'
                            ],
                            'line-width': [
                                'case',
                                ['boolean', ['feature-state', 'selected'], false], 3.5,
                                ['boolean', ['feature-state', 'hover'], false], 2.5,
                                1.4
                            ],
                            'line-opacity': 0.95
                        }
                    });
                }
                if (!map.getLayer(labelLayerId)) {
                    map.addLayer({
                        id: labelLayerId,
                        type: 'symbol',
                        source: sourceId,
                        minzoom: 11,
                        layout: {
                            'text-field': ['get', 'talhaoName'],
                            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                            'text-size': 12,
                            'text-allow-overlap': true,
                            'visibility': this.labelsVisible ? 'visible' : 'none'
                        },
                        paint: {
                            'text-color': '#ffffff',
                            'text-halo-color': 'rgba(0,0,0,0.85)',
                            'text-halo-width': 1.6
                        }
                    });
                }
                this.bindMapInteractions();
                const bounds = App.mapModule._getGeoJsonBounds(geojson);
                if (bounds && dataset.length) {
                    map.fitBounds(bounds, { padding: 70, duration: 800, maxZoom: 15 });
                }
            },
            bindMapInteractions() {
                const map = App.state.estimativaSafraMap;
                if (!map) return;
                const layerId = 'estimativa-safra-fill';
                const sourceId = 'estimativa-safra-source';
                if (this._handlersBound) return;
                let hoveredId = null;
                map.on('mousemove', layerId, (event) => {
                    map.getCanvas().style.cursor = 'pointer';
                    const feature = event.features?.[0];
                    if (!feature) return;
                    if (hoveredId !== null && hoveredId !== feature.id) {
                        map.setFeatureState({ source: sourceId, id: hoveredId }, { hover: false });
                    }
                    hoveredId = feature.id;
                    map.setFeatureState({ source: sourceId, id: hoveredId }, { hover: true });
                });
                map.on('mouseleave', layerId, () => {
                    map.getCanvas().style.cursor = '';
                    if (hoveredId !== null) map.setFeatureState({ source: sourceId, id: hoveredId }, { hover: false });
                    hoveredId = null;
                });
                map.on('click', layerId, (event) => {
                    const feature = event.features?.[0];
                    if (!feature) return;
                    this.selectFeature(feature.properties?.featureKey, feature.id);
                });
                this._handlersBound = true;
            },
            selectFeature(featureKey, featureId = null) {
                const map = App.state.estimativaSafraMap;
                const sourceId = 'estimativa-safra-source';
                const item = this.currentFeatureMap.get(featureKey);
                if (!item) return;
                const resolvedId = featureId ?? item.feature.id;
                if (this.currentSelectedKeys.has(featureKey)) {
                    this.currentSelectedKeys.delete(featureKey);
                    this.currentSelectedFeatureIds.delete(resolvedId);
                    map.setFeatureState({ source: sourceId, id: resolvedId }, { selected: false });
                } else {
                    this.currentSelectedKeys.add(featureKey);
                    this.currentSelectedFeatureIds.add(resolvedId);
                    map.setFeatureState({ source: sourceId, id: resolvedId }, { selected: true });
                }
                this.currentSelectedKey = [...this.currentSelectedKeys][0] || null;
                if (this.currentSelectedKeys.size) this.showInfo();
                else this.hideInfoBox();
            },
            showInfo() {
                const els = App.elements.estimativaSafra;
                if (!els?.infoBox || !els?.infoContent || !this.currentSelectedKeys.size) return;
                const selectedItems = [...this.currentSelectedKeys].map((key) => this.currentFeatureMap.get(key)).filter(Boolean);
                if (!selectedItems.length) return;
                const isMulti = selectedItems.length > 1;
                const isMobile = this.isMobileViewport();
                const first = selectedItems[0];
                const totalArea = selectedItems.reduce((sum, item) => sum + Number(item.area || 0), 0);
                const farms = [...new Set(selectedItems.map((item) => item.farmName))];
                const variedades = [...new Set(selectedItems.map((item) => item.variedade))];
                const latest = first.latestEstimate;
                const historyHtml = !isMulti && first.estimateHistory.length
                    ? first.estimateHistory.slice(0, 8).map((entry) => `
                        <div class="estimativa-history-item">
                            <strong>${entry.safra || 'Sem safra'}</strong> · v${entry.versao || 1}<br>
                            ${this.formatDate(entry.dataEstimativa)} · TCH ${this.formatNumber(entry.tchEstimado)} · Ton ${this.formatNumber(entry.toneladasEstimadas)}<br>
                            <span style="color: rgba(255,255,255,0.72);">${entry.observacao || 'Sem observação'}</span>
                        </div>
                    `).join('')
                    : '<div class="estimativa-history-item">Histórico disponível apenas para seleção individual.</div>';
                const headerTitle = isMulti ? `${selectedItems.length} talhões selecionados` : `Talhão ${first.talhaoName}`;
                const quickMeta = isMulti
                    ? `${farms.length} fazenda(s) · ${this.formatNumber(totalArea)} ha · ${variedades.length} variedade(s)`
                    : `${first.farmName} · ${first.stage} · ${this.formatNumber(first.area)} ha`;
                const bodyStyle = this.infoExpanded ? '' : 'style="display:none;"';
                const mobilePrimaryAction = `<button class="estimativa-mini-btn estimativa-mobile-primary" data-action="estimate">${isMulti ? 'Estimar' : (latest ? 'Reestimar' : 'Estimar')}</button>`;
                const desktopActions = isMulti
                    ? `<div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
                        <button class="estimativa-action-btn primary" data-action="estimate"><i class="fas fa-pen"></i> Estimar selecionados</button>
                        <button class="estimativa-action-btn secondary" data-action="clear-selection"><i class="fas fa-xmark"></i> Limpar seleção</button>
                    </div>`
                    : `<div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
                        <button class="estimativa-action-btn primary" data-action="estimate"><i class="fas fa-pen"></i>${latest ? 'Reestimar' : 'Estimar'}</button>
                        <button class="estimativa-action-btn secondary" data-action="history"><i class="fas fa-clock-rotate-left"></i> Histórico</button>
                        <button class="estimativa-action-btn secondary" data-action="clear-selection"><i class="fas fa-xmark"></i> Limpar seleção</button>
                    </div>`;
                const mobileBody = isMulti
                    ? `
                    <div class="estimativa-info-grid mobile">
                        <div class="estimativa-info-cell"><span class="label">Fazendas</span><span class="value">${farms.length}</span></div>
                        <div class="estimativa-info-cell"><span class="label">Área total</span><span class="value">${this.formatNumber(totalArea)} ha</span></div>
                        <div class="estimativa-info-cell"><span class="label">Variedades</span><span class="value">${variedades.length}</span></div>
                        <div class="estimativa-info-cell"><span class="label">Talhões</span><span class="value">${selectedItems.map((item) => item.talhaoName).slice(0, 6).join(' · ')}</span></div>
                    </div>
                    <div class="estimativa-mobile-sheet-actions">
                        <button class="estimativa-action-btn primary" data-action="estimate"><i class="fas fa-pen"></i> Estimar selecionados</button>
                        <button class="estimativa-action-btn secondary" data-action="clear-selection"><i class="fas fa-xmark"></i> Limpar</button>
                    </div>`
                    : `
                    <div class="estimativa-info-grid mobile">
                        <div class="estimativa-info-cell"><span class="label">Variedade</span><span class="value">${first.variedade}</span></div>
                        <div class="estimativa-info-cell"><span class="label">Status</span><span class="value">${first.status}</span></div>
                        <div class="estimativa-info-cell"><span class="label">Última</span><span class="value">${latest ? `${this.formatNumber(latest.toneladasEstimadas)} t` : 'Não estimado'}</span></div>
                        <div class="estimativa-info-cell"><span class="label">Safra</span><span class="value">${latest?.safra || '-'}</span></div>
                    </div>
                    <div class="estimativa-mobile-sheet-actions">
                        <button class="estimativa-action-btn primary" data-action="estimate"><i class="fas fa-pen"></i>${latest ? 'Reestimar' : 'Estimar'}</button>
                        <button class="estimativa-action-btn secondary" data-action="history"><i class="fas fa-clock-rotate-left"></i> Histórico</button>
                        <button class="estimativa-action-btn secondary" data-action="clear-selection"><i class="fas fa-xmark"></i> Limpar</button>
                    </div>
                    <div id="estimativaSafraHistoryWrap" class="estimativa-history-list" style="display:none;">${historyHtml}</div>`;
                const desktopBody = isMulti ? `
                    <div class="estimativa-info-grid">
                        <div class="estimativa-info-cell"><span class="label">Fazendas</span><span class="value">${farms.length}</span></div>
                        <div class="estimativa-info-cell"><span class="label">Área total</span><span class="value">${this.formatNumber(totalArea)} ha</span></div>
                        <div class="estimativa-info-cell"><span class="label">Variedades</span><span class="value">${variedades.length}</span></div>
                        <div class="estimativa-info-cell"><span class="label">Status</span><span class="value">Seleção múltipla</span></div>
                    </div>
                    ${desktopActions}` : `
                    <div class="estimativa-info-grid">
                        <div class="estimativa-info-cell"><span class="label">Fazenda</span><span class="value">${first.farmName}</span></div>
                        <div class="estimativa-info-cell"><span class="label">Variedade</span><span class="value">${first.variedade}</span></div>
                        <div class="estimativa-info-cell"><span class="label">Estágio</span><span class="value">${first.stage}</span></div>
                        <div class="estimativa-info-cell"><span class="label">Área</span><span class="value">${this.formatNumber(first.area)} ha</span></div>
                        <div class="estimativa-info-cell"><span class="label">Status</span><span class="value">${first.status}</span></div>
                        <div class="estimativa-info-cell"><span class="label">Última estimativa</span><span class="value">${latest ? `${this.formatNumber(latest.toneladasEstimadas)} t` : 'Não estimado'}</span></div>
                    </div>
                    ${desktopActions}
                    <div id="estimativaSafraHistoryWrap" class="estimativa-history-list" style="display:none;">${historyHtml}</div>`;
                els.infoContent.innerHTML = `
                    <div class="estimativa-panel-header ${isMobile ? 'mobile-sheet' : ''}">
                        <div>
                            <span class="estimativa-panel-kicker">${isMulti ? 'Seleção no mapa' : 'Talhão'}</span>
                            <h3 style="margin:4px 0 0;">${headerTitle}</h3>
                            ${isMobile ? `<div class="estimativa-mobile-sheet-meta">${quickMeta}</div>` : ''}
                        </div>
                        <div class="estimativa-mobile-top-actions">${isMobile ? mobilePrimaryAction : ''}<button type="button" class="estimativa-mini-btn" data-action="toggle-info">${this.infoExpanded ? 'Recolher' : 'Abrir'}</button></div>
                    </div>
                    <div class="estimativa-panel-body" ${bodyStyle}>${isMobile ? mobileBody : desktopBody}</div>`;
                els.infoBox.classList.add('visible');
                els.infoContent.querySelector('[data-action="toggle-info"]')?.addEventListener('click', () => this.toggleInfo());
                els.infoContent.querySelectorAll('[data-action="estimate"]').forEach((btn) => btn.addEventListener('click', () => this.openModal()));
                els.infoContent.querySelector('[data-action="history"]')?.addEventListener('click', () => {
                    const wrap = document.getElementById('estimativaSafraHistoryWrap');
                    if (wrap) wrap.style.display = wrap.style.display === 'none' ? 'grid' : 'none';
                });
                els.infoContent.querySelectorAll('[data-action="clear-selection"]').forEach((btn) => btn.addEventListener('click', () => this.clearSelection()));
            },
            clearSelection() {
                const map = App.state.estimativaSafraMap;
                const sourceId = 'estimativa-safra-source';
                if (map) {
                    [...this.currentSelectedFeatureIds].forEach((id) => map.setFeatureState({ source: sourceId, id }, { selected: false }));
                }
                this.currentSelectedKeys = new Set();
                this.currentSelectedFeatureIds = new Set();
                this.currentSelectedKey = null;
                this.hideInfoBox();
            },
            hideInfoBox() {
                const els = App.elements.estimativaSafra;
                els?.infoBox?.classList.remove('visible');
            },
            clearFilters() {
                const els = App.elements.estimativaSafra;
                els.farmFilter.value = '';
                els.varietyFilter.value = '';
                els.stageFilter.value = '';
                els.searchInput.value = '';
                this.updateActiveFilterSummary();
                this.refresh();
            },
            centerMap() {
                const map = App.state.estimativaSafraMap;
                if (!map || !this.currentData.length) return;
                const geojson = { type: 'FeatureCollection', features: this.currentData.map((item) => item.feature) };
                const bounds = App.mapModule._getGeoJsonBounds(geojson);
                if (bounds) map.fitBounds(bounds, { padding: 70, duration: 700, maxZoom: 15 });
            },
            openModal(featureKey = null) {
                const els = App.elements.estimativaSafra;
                const selectedKeys = featureKey ? [featureKey] : [...this.currentSelectedKeys];
                const targets = selectedKeys.map((key) => this.currentFeatureMap.get(key)).filter(Boolean);
                if (!targets.length) return;
                const first = targets[0];
                const isMulti = targets.length > 1;
                const latestSameSafra = !isMulti ? (first.estimateHistory[0] || null) : null;
                this.currentModalBaseKeys = selectedKeys;
                els.modalTitle.textContent = isMulti ? 'Estimativa de múltiplos talhões' : (latestSameSafra ? 'Reestimativa de safra' : 'Nova estimativa de safra');
                els.modalFeatureKey.value = first.featureKey;
                els.modalSafra.value = latestSameSafra?.safra || this.getDefaultSafra();
                els.modalData.value = latestSameSafra?.dataEstimativa || new Date().toISOString().slice(0, 10);
                els.modalTch.value = latestSameSafra?.tchEstimado ?? '';
                els.modalToneladas.value = latestSameSafra?.toneladasEstimadas ?? '';
                els.modalResponsavel.value = latestSameSafra?.responsavel || App.state.currentUser?.name || App.state.currentUser?.username || '';
                els.modalObs.value = latestSameSafra?.observacao || '';
                if (els.modalEstimateWholeFarm) els.modalEstimateWholeFarm.checked = false;
                if (els.modalEstimateSelected) els.modalEstimateSelected.checked = isMulti;
                if (els.modalEstimateFiltered) els.modalEstimateFiltered.checked = false;
                [['estimativaSafraScopeWholeFarmCard', els.modalEstimateWholeFarm], ['estimativaSafraScopeSelectedCard', els.modalEstimateSelected], ['estimativaSafraScopeFilteredCard', els.modalEstimateFiltered]].forEach(([id, input]) => {
                    const card = document.getElementById(id);
                    if (card) card.classList.toggle('active', Boolean(input?.checked));
                });
                els.modal.classList.add('show');
                this.refreshEstimateModalScope();
            },
            closeModal() {
                App.elements.estimativaSafra?.modal?.classList.remove('show');
            },
            getDefaultSafra() {
                const now = new Date();
                const year = now.getFullYear();
                const next = year + 1;
                return `${year}/${next}`;
            },
            getTargetsForCurrentScope() {
                const els = App.elements.estimativaSafra;
                const baseKeys = [...(this.currentModalBaseKeys || [])];
                const baseTargets = baseKeys.map((key) => this.currentFeatureMap.get(key)).filter(Boolean);
                if (!baseTargets.length) return [];
                const first = baseTargets[0];
                if (els?.modalEstimateWholeFarm?.checked) {
                    return this.currentData.filter((entry) => String(entry.farmId || entry.farmCode) === String(first.farmId || first.farmCode));
                }
                if (els?.modalEstimateFiltered?.checked) {
                    return [...this.currentData];
                }
                if (els?.modalEstimateSelected?.checked) {
                    return baseTargets;
                }
                return [first];
            },
            refreshEstimateModalScope() {
                const els = App.elements.estimativaSafra;
                if (!els?.modal?.classList.contains('show')) return;
                const targets = this.getTargetsForCurrentScope();
                if (!targets.length) return;
                const isMulti = targets.length > 1;
                const totalArea = targets.reduce((sum, item) => sum + Number(item.area || 0), 0);
                const farms = this.sortFarmOptions([...new Map(targets.map((item) => [String(item.farmId || item.farmCode), item])).values()]);
                const talhoes = [...new Set(targets.map((item) => item.talhaoName))].sort((a,b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }));
                const variedades = [...new Set(targets.map((item) => item.variedade))].sort((a,b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }));
                const estagios = [...new Set(targets.map((item) => item.stage))].sort((a,b) => this.getStageOrder(a) - this.getStageOrder(b));
                els.modalFarm.textContent = farms.length === 1 ? this.getFarmDisplayName(farms[0]) : this.summarizeSelection(farms.map((item) => this.getFarmDisplayName(item)), `${farms.length} fazenda(s)`);
                els.modalTalhao.textContent = isMulti ? this.summarizeSelection(talhoes, `${targets.length} talhões`) : (talhoes[0] || '-');
                els.modalVariedade.textContent = variedades.length === 1 ? variedades[0] : this.summarizeSelection(variedades, `${variedades.length} variedade(s)`);
                els.modalEstagio.textContent = estagios.length === 1 ? estagios[0] : this.summarizeSelection(estagios, `${estagios.length} corte(s)`);
                els.modalArea.value = this.toInputNumber(totalArea);
                if (els.modalSubtitle) {
                    if (els.modalEstimateWholeFarm?.checked) {
                        const farmLabel = farms.length === 1 ? this.getFarmDisplayName(farms[0]) : `${farms.length} fazenda(s)`;
                        els.modalSubtitle.textContent = `Aplicando a estimativa para ${targets.length} talhão(ões) da fazenda ${farmLabel}.`;
                    } else if (els.modalEstimateFiltered?.checked) {
                        els.modalSubtitle.textContent = `Aplicando a estimativa para ${targets.length} talhão(ões) do filtro atual.`;
                    } else if (els.modalEstimateSelected?.checked && isMulti) {
                        els.modalSubtitle.textContent = `${targets.length} talhões selecionados no mapa. Revise o escopo antes de salvar.`;
                    } else {
                        els.modalSubtitle.textContent = 'Preencha os dados da estimativa e confirme o escopo de aplicação.';
                    }
                }
                const tch = Number.parseFloat(els.modalTch?.value || '0');
                const tons = Number.parseFloat(els.modalToneladas?.value || '0');
                if (Number.isFinite(tch) && tch > 0) {
                    els.modalToneladas.value = this.toInputNumber(totalArea * tch);
                } else if (Number.isFinite(tons) && tons > 0 && totalArea > 0) {
                    els.modalTch.value = this.toInputNumber(tons / totalArea);
                }
            },
            syncDerivedFields(origin) {
                const els = App.elements.estimativaSafra;
                const area = Number.parseFloat(els.modalArea.value || '0');
                const tch = Number.parseFloat(els.modalTch.value || '0');
                const tons = Number.parseFloat(els.modalToneladas.value || '0');
                if (!Number.isFinite(area) || area <= 0) return;
                if (origin === 'tch' && Number.isFinite(tch) && tch > 0) {
                    els.modalToneladas.value = this.toInputNumber(area * tch);
                }
                if (origin === 'toneladas' && Number.isFinite(tons) && tons > 0) {
                    els.modalTch.value = this.toInputNumber(tons / area);
                }
            },
            async saveEstimate() {
                const els = App.elements.estimativaSafra;
                const featureKey = els.modalFeatureKey.value;
                const item = this.currentFeatureMap.get(featureKey);
                if (!item) {
                    App.ui.showAlert('Talhão da estimativa não encontrado.', 'error');
                    return;
                }
                const safra = String(els.modalSafra.value || '').trim();
                const dataEstimativa = els.modalData.value;
                const tchEstimado = Number.parseFloat(els.modalTch.value || '0');
                const toneladasEstimadas = Number.parseFloat(els.modalToneladas.value || '0');
                if (!safra || !dataEstimativa || !Number.isFinite(tchEstimado) || tchEstimado <= 0 || !Number.isFinite(toneladasEstimadas) || toneladasEstimadas <= 0) {
                    App.ui.showAlert('Preencha safra, data, TCH e toneladas para salvar a estimativa.', 'warning');
                    return;
                }
                const estimateWholeFarm = Boolean(els.modalEstimateWholeFarm?.checked);
                const estimateSelected = Boolean(els.modalEstimateSelected?.checked);
                const estimateFiltered = Boolean(els.modalEstimateFiltered?.checked);
                let targets = [item];
                if (estimateWholeFarm) {
                    targets = this.currentData.filter((entry) => String(entry.farmId || entry.farmCode) === String(item.farmId || item.farmCode));
                } else if (estimateSelected && this.currentSelectedKeys.size) {
                    targets = [...this.currentSelectedKeys].map((key) => this.currentFeatureMap.get(key)).filter(Boolean);
                } else if (estimateFiltered && this.currentData.length) {
                    targets = [...this.currentData];
                }
                const totalArea = targets.reduce((sum, entry) => sum + Number(entry.area || 0), 0);
                const targetMode = estimateWholeFarm ? 'fazenda inteira' : (estimateFiltered ? 'filtro atual' : (estimateSelected ? 'talhões selecionados' : 'talhão'));
                if (targets.length > 1) {
                    const details = estimateFiltered ? `
Filtro atual: ${App.elements.estimativaSafra?.activeFilters?.textContent || 'sem filtros'}` : '';
                    const confirmed = window.confirm(`Deseja realmente salvar a estimativa para ${targets.length} talhão(ões) no modo ${targetMode}? O histórico será preservado.${details}`);
                    if (!confirmed) return;
                }
                try {
                    for (const target of targets) {
                        const targetTons = estimateWholeFarm && totalArea > 0
                            ? (toneladasEstimadas * Number(target.area || 0)) / totalArea
                            : toneladasEstimadas;
                        const sameSafraHistory = (App.state.estimativasSafra || []).filter((entry) => entry.featureKey === target.featureKey && entry.safra === safra);
                        const payload = {
                            companyId: App.state.currentUser.companyId,
                            featureKey: target.featureKey,
                            farmId: target.farmId,
                            farmCode: target.farmCode,
                            farmName: target.farmName,
                            talhaoId: target.talhaoId,
                            talhaoName: target.talhaoName,
                            variedade: target.variedade,
                            estagio: target.stage,
                            areaHa: target.area,
                            safra,
                            dataEstimativa,
                            tchEstimado,
                            toneladasEstimadas: targetTons,
                            observacao: String(els.modalObs.value || '').trim(),
                            responsavel: String(els.modalResponsavel.value || '').trim(),
                            versao: sameSafraHistory.length + 1,
                            reestimativa: sameSafraHistory.length > 0,
                            createdAtLocal: new Date().toISOString(),
                            origemLancamento: estimateWholeFarm ? 'fazenda_inteira' : (estimateFiltered ? 'filtro' : (estimateSelected ? 'multiplos_talhoes' : 'talhao'))
                        };
                        await App.data.addDocument('estimativasSafra', payload);
                    }
                    this.closeModal();
                    App.ui.showAlert(targets.length > 1 ? `Estimativa salva para ${targets.length} talhões com histórico preservado.` : (estimateWholeFarm ? 'Estimativa da fazenda salva com histórico preservado.' : 'Estimativa salva com sucesso.'), 'success');
                } catch (error) {
                    console.error('[EstimativaSafra] Falha ao salvar estimativa', error);
                    App.ui.showAlert('Erro ao salvar estimativa da safra.', 'error');
                }
            },
            formatNumber(value) {
                const number = Number(value || 0);
                return number.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
            },
            toInputNumber(value) {
                const number = Number(value || 0);
                return Number.isFinite(number) ? number.toFixed(2) : '';
            },
            formatDate(value) {
                if (!value) return '-';
                const date = new Date(`${value}T12:00:00`);
                if (Number.isNaN(date.getTime())) return value;
                return date.toLocaleDateString('pt-BR');
            }
        };

    App.init()
        .catch((error) => {
            logBootError('APP:init:error', error);
            App.ui.showLoginScreen({ forced: true, reason: 'init-error' });
        })
        .finally(() => {
            appDiagnostics.finishBoot();
        });
    window.App = App;
});


// Patch v10: restaura ações essenciais dos módulos mantidos e corrige fallbacks restantes
(function applyV10Patch() {
    const App = window.App;
    if (!App) {
        document.addEventListener('DOMContentLoaded', applyV10Patch, { once: true });
        return;
    }
    if (App.__v10PatchApplied) return;
    App.__v10PatchApplied = true;
    const actions = App.actions || (App.actions = {});

    if (typeof App.ui.setupEventListeners === 'function') {
        const originalSetupEventListeners = App.ui.setupEventListeners.bind(App.ui);
        App.ui.setupEventListeners = function() {
            originalSetupEventListeners();
            if (App.elements.btnLogin && !App.elements.btnLogin.dataset.boundLogin) {
                App.elements.btnLogin.dataset.boundLogin = '1';
                App.elements.btnLogin.addEventListener('click', (e) => {
                    e.preventDefault();
                    App.auth.login();
                });
            }
            if (App.elements.loginPass && !App.elements.loginPass.dataset.boundEnter) {
                App.elements.loginPass.dataset.boundEnter = '1';
                App.elements.loginPass.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        App.auth.login();
                    }
                });
            }
            if (App.elements.loginUser && !App.elements.loginUser.dataset.boundEnter) {
                App.elements.loginUser.dataset.boundEnter = '1';
                App.elements.loginUser.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        App.auth.login();
                    }
                });
            }
        };
        App.ui.setupEventListeners();
    }

    if (typeof actions.handleLogoUpload !== 'function') {
        actions.handleLogoUpload = async function(e) {
            const file = e?.target?.files?.[0];
            const input = e?.target;
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                App.ui.showAlert('Por favor, selecione um ficheiro de imagem (PNG, JPG, etc.).', 'error');
                if (input) input.value = '';
                return;
            }
            const maxMb = 1;
            if (file.size > maxMb * 1024 * 1024) {
                App.ui.showAlert(`O ficheiro é muito grande. O tamanho máximo é de ${maxMb}MB para armazenamento direto.`, 'error');
                if (input) input.value = '';
                return;
            }
            App.ui.setLoading(true, 'A carregar logo...');
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const base64String = event?.target?.result;
                    await App.data.setDocument('config', App.state.currentUser.companyId, { logoBase64: base64String }, { merge: true });
                    App.ui.showAlert('Logo carregado com sucesso!', 'success');
                    App.state.companyConfig = { ...(App.state.companyConfig || {}), logoBase64: base64String };
                    if (typeof App.ui.renderLogoPreview === 'function') App.ui.renderLogoPreview();
                } catch (error) {
                    console.error('Erro ao carregar o logo para o Firestore:', error);
                    App.ui.showAlert(`Erro ao carregar o logo: ${error.message}`, 'error');
                } finally {
                    App.ui.setLoading(false);
                    if (input) input.value = '';
                }
            };
            reader.onerror = (error) => {
                App.ui.setLoading(false);
                App.ui.showAlert('Erro ao ler o ficheiro.', 'error');
                console.error('Erro FileReader:', error);
                if (input) input.value = '';
            };
            reader.readAsDataURL(file);
        };
    }

    if (typeof actions.removeLogo !== 'function') {
        actions.removeLogo = function() {
            App.ui.showConfirmationModal('Tem a certeza que deseja remover o logotipo?', async () => {
                App.ui.setLoading(true, 'A remover logo...');
                try {
                    await App.data.updateDocument('config', App.state.currentUser.companyId, { logoBase64: null });
                    App.state.companyConfig = { ...(App.state.companyConfig || {}), logoBase64: null };
                    if (typeof App.ui.renderLogoPreview === 'function') App.ui.renderLogoPreview();
                    App.ui.showAlert('Logo removido com sucesso!', 'success');
                } catch (error) {
                    console.error('Erro ao remover logo do Firestore:', error);
                    App.ui.showAlert(`Erro ao remover o logo: ${error.message}`, 'error');
                } finally {
                    App.ui.setLoading(false);
                    if (App.elements.companyConfig?.logoInput) App.elements.companyConfig.logoInput.value = '';
                }
            });
        };
    }

    if (typeof actions.createCompany !== 'function') {
        actions.createCompany = async function() {
            const els = App.elements.companyManagement || {};
            const name = els.companyName?.value?.trim() || '';
            const email = els.adminEmail?.value?.trim() || '';
            const password = els.adminPassword?.value?.trim() || '';
            if (!name || !email || !password) {
                App.ui.showAlert('Todos os campos são obrigatórios.', 'error');
                return;
            }
            if (password.length < 6) {
                App.ui.showAlert('A senha deve ter pelo menos 6 caracteres.', 'error');
                return;
            }
            const subscribedModules = Array.from(document.querySelectorAll('#newCompanyModules input:checked')).map((cb) => cb.dataset.module);
            if (subscribedModules.length === 0) {
                App.ui.showAlert('Selecione pelo menos um módulo para a empresa.', 'error');
                return;
            }
            App.ui.setLoading(true, 'A criar nova empresa...');
            let companyId = null;
            try {
                const companyRef = await App.data.addDocument('companies', {
                    name,
                    active: true,
                    createdAt: serverTimestamp(),
                    subscribedModules,
                });
                companyId = companyRef.id;
                const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
                const newUser = userCredential.user;
                await signOut(secondaryAuth);
                const adminPermissions = App.config.roles['admin'];
                const userData = {
                    username: email.split('@')[0],
                    email,
                    role: 'admin',
                    active: true,
                    permissions: adminPermissions,
                    companyId,
                };
                await App.data.createUserData(newUser.uid, userData);
                App.ui.showAlert(`Empresa "${name}" e administrador criados com sucesso!`, 'success');
                if (els.companyName) els.companyName.value = '';
                if (els.adminEmail) els.adminEmail.value = '';
                if (els.adminPassword) els.adminPassword.value = '';
                document.querySelectorAll('#newCompanyModules input').forEach((cb) => { cb.checked = true; });
            } catch (error) {
                if (companyId) {
                    try { await App.data.deleteDocument('companies', companyId); } catch (_) {}
                }
                if (error.code === 'auth/email-already-in-use') {
                    App.ui.showAlert('Este e-mail já está em uso por outro utilizador.', 'error');
                } else if (error.code === 'auth/weak-password') {
                    App.ui.showAlert('A senha deve ter pelo menos 6 caracteres.', 'error');
                } else {
                    console.error('Erro na criação inicial:', error);
                    App.ui.showAlert('Erro ao criar a empresa ou o utilizador de autenticação.', 'error');
                }
            } finally {
                App.ui.setLoading(false);
            }
        };
    }

    if (typeof actions.toggleCompanyStatus !== 'function') {
        actions.toggleCompanyStatus = async function(companyId) {
            const company = App.state.companies.find((c) => c.id === companyId);
            if (!company) {
                App.ui.showAlert('Empresa não encontrada.', 'error');
                return;
            }
            const newStatus = company.active === false;
            const actionText = newStatus ? 'ativar' : 'desativar';
            App.ui.showConfirmationModal(`Tem a certeza que deseja ${actionText} a empresa "${company.name}"?`, async () => {
                try {
                    await App.data.updateDocument('companies', companyId, { active: newStatus });
                    App.ui.showAlert(`Empresa ${newStatus ? 'ativada' : 'desativada'} com sucesso!`, 'success');
                } catch (error) {
                    console.error(`Erro ao mudar status da empresa ${companyId}:`, error);
                    App.ui.showAlert(`Erro ao ${actionText} a empresa.`, 'error');
                }
            });
        };
    }

    if (typeof actions._deleteCollectionByCompanyId !== 'function') {
        actions._deleteCollectionByCompanyId = async function(collectionName, companyId, batchSize = 400) {
            const querySnapshot = await getDocs(query(collection(db, collectionName), where('companyId', '==', companyId)));
            if (querySnapshot.empty) return 0;
            const chunks = [];
            for (let i = 0; i < querySnapshot.docs.length; i += batchSize) chunks.push(querySnapshot.docs.slice(i, i + batchSize));
            let deletedCount = 0;
            for (const chunk of chunks) {
                const batch = writeBatch(db);
                chunk.forEach((snap) => batch.delete(snap.ref));
                await batch.commit();
                deletedCount += chunk.length;
            }
            return deletedCount;
        };
    }

    if (typeof actions._executeCascadeDelete !== 'function') {
        actions._executeCascadeDelete = async function(companyId) {
            App.ui.setLoading(true, 'A excluir dados da empresa...');
            const collectionsToDelete = ['users', 'fazendas', 'personnel', 'registros', 'perdas', 'cigarrinha', 'planos', 'harvestPlans', 'armadilhas', 'estimativasSafra', 'config'];
            const errors = [];
            let totalDeleted = 0;
            for (const collectionName of collectionsToDelete) {
                try {
                    totalDeleted += await actions._deleteCollectionByCompanyId(collectionName, companyId);
                } catch (error) {
                    errors.push(`${collectionName}: ${error.message}`);
                }
            }
            try {
                await App.data.deleteDocument('companies', companyId);
            } catch (error) {
                errors.push(`companies: ${error.message}`);
            }
            App.ui.setLoading(false);
            if (errors.length) {
                console.error('Erros na exclusão em cascata:', errors);
                App.ui.showAlert(`A empresa foi parcialmente excluída. Verifique o console. Total removido: ${totalDeleted}.`, 'warning', 10000);
            } else {
                App.ui.showAlert(`Empresa excluída com sucesso! Registros removidos: ${totalDeleted}.`, 'success', 8000);
            }
        };
    }

    if (typeof actions.deleteCompanyPermanently !== 'function') {
        actions.deleteCompanyPermanently = async function(companyId) {
            const company = App.state.companies.find((c) => c.id === companyId);
            if (!company) {
                App.ui.showAlert('Empresa não encontrada.', 'error');
                return;
            }
            const confirmationMessage = `AÇÃO IRREVERSÍVEL!\nIsto irá apagar permanentemente a empresa "${company.name}" e TODOS os seus dados associados.\n\nPara confirmar, digite o nome exato da empresa no campo abaixo.`;
            App.ui.showConfirmationModal(
                confirmationMessage,
                async (userInput) => {
                    if (userInput.confirmationModalInput !== company.name) {
                        App.ui.showAlert('O nome da empresa não corresponde. A exclusão foi cancelada.', 'warning');
                        return;
                    }
                    await actions._executeCascadeDelete(companyId);
                },
                [{ id: 'confirmationModalInput', placeholder: `Digite "${company.name}"`, required: true }]
            );
        };
    }

    if (typeof actions.saveCompanyModuleChanges !== 'function') {
        actions.saveCompanyModuleChanges = async function() {
            const modal = App.elements.editCompanyModal || {};
            const companyId = modal.editingCompanyId?.value;
            if (!companyId) {
                App.ui.showAlert('ID da empresa não encontrado.', 'error');
                return;
            }
            const newSubscribedModules = Array.from(modal.modulesGrid?.querySelectorAll('input:checked') || []).map((cb) => cb.dataset.module);
            if (newSubscribedModules.length === 0) {
                App.ui.showAlert('Uma empresa deve ter pelo menos um módulo subscrito.', 'error');
                return;
            }
            try {
                await App.data.updateDocument('companies', companyId, { subscribedModules: newSubscribedModules });
                App.ui.showAlert('Módulos da empresa atualizados com sucesso!', 'success');
                if (typeof App.ui.closeEditCompanyModal === 'function') App.ui.closeEditCompanyModal();
            } catch (error) {
                console.error('Erro ao atualizar módulos da empresa:', error);
                App.ui.showAlert('Erro ao guardar as alterações.', 'error');
            }
        };
    }

    if (typeof actions.impersonateCompany !== 'function') {
        actions.impersonateCompany = function(companyId) {
            if (App.state.currentUser.role !== 'super-admin' || App.state.isImpersonating) return;
            const companyToImpersonate = App.state.companies.find((c) => c.id === companyId);
            if (!companyToImpersonate) {
                App.ui.showAlert('Empresa não encontrada.', 'error');
                return;
            }
            App.state.originalUser = { ...App.state.currentUser };
            App.state.isImpersonating = true;
            const adminPermissions = App.config.roles['admin'];
            App.state.currentUser = { ...App.state.originalUser, role: 'admin', permissions: adminPermissions, companyId };
            if (typeof App.ui.showImpersonationBanner === 'function') App.ui.showImpersonationBanner(companyToImpersonate.name);
            App.data.listenToCoreData();
            App.ui.renderMenu();
            App.ui.showTab('estimativaSafra');
        };
    }

    if (typeof actions.stopImpersonating !== 'function') {
        actions.stopImpersonating = function() {
            if (!App.state.isImpersonating || !App.state.originalUser) return;
            App.state.currentUser = { ...App.state.originalUser };
            App.state.originalUser = null;
            App.state.isImpersonating = false;
            App.data.listenToCoreData();
            App.ui.renderMenu();
            App.ui.showTab('gerenciarEmpresas');
            if (typeof App.ui.hideImpersonationBanner === 'function') App.ui.hideImpersonationBanner();
        };
    }

    if (typeof actions.notifyAdminsOfNewFeatures !== 'function') {
        actions.notifyAdminsOfNewFeatures = async function(oldConfigs, newConfigs) {
            const newlyEnabledFeatures = Object.keys(newConfigs).filter((key) => newConfigs[key] && !oldConfigs[key]);
            if (newlyEnabledFeatures.length === 0) return;
            try {
                const usersSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
                const promises = [];
                usersSnapshot.forEach((userDoc) => {
                    const user = userDoc.data();
                    const message = `Novas funcionalidades foram ativadas: ${newlyEnabledFeatures.join(', ')}`;
                    if (typeof actions.saveNotification === 'function') {
                        promises.push(actions.saveNotification({
                            userId: userDoc.id,
                            companyId: user.companyId || null,
                            title: 'Novas funcionalidades disponíveis',
                            message,
                            type: 'info',
                        }));
                    }
                });
                await Promise.allSettled(promises);
            } catch (error) {
                console.error('Erro ao notificar administradores sobre novas funcionalidades:', error);
            }
        };
    }

    if (typeof actions.saveGlobalFeatures !== 'function') {
        actions.saveGlobalFeatures = async function() {
            const grid = document.getElementById('globalFeaturesGrid');
            if (!grid) {
                App.ui.showAlert('Elemento de controlo de features não encontrado.', 'error');
                return;
            }
            const oldGlobalConfigs = { ...(App.state.globalConfigs || {}) };
            const newGlobalConfigs = {};
            grid.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
                newGlobalConfigs[cb.dataset.feature] = cb.checked;
            });
            App.ui.setLoading(true, 'A guardar e notificar...');
            try {
                await App.data.setDocument('global_configs', 'main', newGlobalConfigs);
                App.state.globalConfigs = newGlobalConfigs;
                App.ui.showAlert('Configurações globais guardadas com sucesso!', 'success');
                await actions.notifyAdminsOfNewFeatures(oldGlobalConfigs, newGlobalConfigs);
            } catch (error) {
                console.error('Erro ao guardar configurações globais:', error);
                App.ui.showAlert('Erro ao guardar as configurações globais.', 'error');
            } finally {
                App.ui.setLoading(false);
            }
        };
    }

})();


// Hotfix: controles essenciais do cabeçalho via delegação para evitar perda de binding
(function applyHeaderControlsHotfix() {
    function install() {
        const App = window.App;
        if (!App || document.body.dataset.headerControlsHotfixApplied === '1') return;
        document.body.dataset.headerControlsHotfixApplied = '1';

        const closeMenus = () => {
            document.body.classList.remove('mobile-menu-open');
            const menu = document.getElementById('menu');
            const menuBtn = document.getElementById('btnToggleMenu');
            const notifDropdown = document.getElementById('notification-dropdown');
            const notifToggle = document.getElementById('notification-bell-toggle');
            const userDropdown = document.getElementById('user-menu-dropdown');
            const userToggle = document.getElementById('user-menu-toggle');
            menu?.classList.remove('open');
            menuBtn?.classList.remove('open');
            menuBtn?.setAttribute('aria-expanded', 'false');
            notifDropdown?.classList.remove('show');
            notifToggle?.setAttribute('aria-expanded', 'false');
            userDropdown?.classList.remove('show');
            userToggle?.classList.remove('open');
            userToggle?.setAttribute('aria-expanded', 'false');
        };

        document.addEventListener('click', function(e) {
            const menuBtn = e.target.closest('#btnToggleMenu');
            const notifBtn = e.target.closest('#notification-bell-toggle');
            const userBtn = e.target.closest('#user-menu-toggle');
            const menuLink = e.target.closest('#menu button, #menu a');
            const menu = document.getElementById('menu');
            const notifContainer = document.getElementById('notification-bell-container');
            const notifDropdown = document.getElementById('notification-dropdown');
            const userContainer = document.getElementById('user-menu-container');
            const userDropdown = document.getElementById('user-menu-dropdown');

            if (menuBtn) {
                e.preventDefault();
                e.stopPropagation();
                const willOpen = !menu?.classList.contains('open');
                document.body.classList.toggle('mobile-menu-open', willOpen);
                menu?.classList.toggle('open', willOpen);
                menuBtn.classList.toggle('open', willOpen);
                menuBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
                return;
            }

            if (notifBtn) {
                e.preventDefault();
                e.stopPropagation();
                const willOpen = !notifDropdown?.classList.contains('show');
                notifDropdown?.classList.toggle('show', willOpen);
                notifBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
                userDropdown?.classList.remove('show');
                const userToggle = document.getElementById('user-menu-toggle');
                userToggle?.classList.remove('open');
                userToggle?.setAttribute('aria-expanded', 'false');
                if (willOpen && typeof App.actions?.markNotificationsAsRead === 'function') {
                    App.actions.markNotificationsAsRead();
                }
                return;
            }

            if (userBtn) {
                e.preventDefault();
                e.stopPropagation();
                const willOpen = !userDropdown?.classList.contains('show');
                userDropdown?.classList.toggle('show', willOpen);
                userBtn.classList.toggle('open', willOpen);
                userBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
                notifDropdown?.classList.remove('show');
                const notifToggle = document.getElementById('notification-bell-toggle');
                notifToggle?.setAttribute('aria-expanded', 'false');
                return;
            }

            if (menuLink && window.innerWidth <= 1024) {
                closeMenus();
                return;
            }

            if (notifContainer && !notifContainer.contains(e.target)) {
                notifDropdown?.classList.remove('show');
                const notifToggle = document.getElementById('notification-bell-toggle');
                notifToggle?.setAttribute('aria-expanded', 'false');
            }

            if (userContainer && !userContainer.contains(e.target)) {
                userDropdown?.classList.remove('show');
                const userToggle = document.getElementById('user-menu-toggle');
                userToggle?.classList.remove('open');
                userToggle?.setAttribute('aria-expanded', 'false');
            }
        }, true);

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') closeMenus();
        });

        window.addEventListener('resize', function() {
            if (window.innerWidth > 1024) {
                const menu = document.getElementById('menu');
                const menuBtn = document.getElementById('btnToggleMenu');
                document.body.classList.remove('mobile-menu-open');
                menu?.classList.remove('open');
                menuBtn?.classList.remove('open');
                menuBtn?.setAttribute('aria-expanded', 'false');
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install, { once: true });
    } else {
        install();
    }
})();

// Hotfix final: religar controles do cabeçalho depois do login e após cada renderização principal
(function applyHeaderRebindFinalHotfix() {
    function bindHeaderControls() {
        const App = window.App;
        if (!App) return;

        const menuBtn = document.getElementById('btnToggleMenu');
        const menu = document.getElementById('menu');
        const notifContainer = document.getElementById('notification-bell-container');
        const notifToggle = document.getElementById('notification-bell-toggle');
        const notifDropdown = document.getElementById('notification-dropdown');
        const userContainer = document.getElementById('user-menu-container');
        const userToggle = document.getElementById('user-menu-toggle');
        const userDropdown = document.getElementById('user-menu-dropdown');
        const clearNotificationsBtn = document.getElementById('clear-notifications-btn');

        if (!menuBtn || !menu || !notifContainer || !notifToggle || !notifDropdown || !userContainer || !userToggle || !userDropdown) {
            return;
        }

        menuBtn.style.pointerEvents = 'auto';
        notifContainer.style.pointerEvents = 'auto';
        notifToggle.style.pointerEvents = 'auto';
        userContainer.style.pointerEvents = 'auto';
        userToggle.style.pointerEvents = 'auto';

        const closeHeaderOverlays = () => {
            notifDropdown.classList.remove('show');
            notifToggle.setAttribute('aria-expanded', 'false');
            userDropdown.classList.remove('show');
            userToggle.classList.remove('open');
            userToggle.setAttribute('aria-expanded', 'false');
        };

        const closeMobileMenu = () => {
            document.body.classList.remove('mobile-menu-open');
            menu.classList.remove('open');
            menuBtn.classList.remove('open');
            menuBtn.setAttribute('aria-expanded', 'false');
        };

        if (menuBtn.dataset.headerBound !== '1') {
            menuBtn.dataset.headerBound = '1';
            menuBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const willOpen = !menu.classList.contains('open');
                document.body.classList.toggle('mobile-menu-open', willOpen);
                menu.classList.toggle('open', willOpen);
                menuBtn.classList.toggle('open', willOpen);
                menuBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
            };
        }

        if (notifToggle.dataset.headerBound !== '1') {
            notifToggle.dataset.headerBound = '1';
            notifToggle.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const willOpen = !notifDropdown.classList.contains('show');
                notifDropdown.classList.toggle('show', willOpen);
                notifToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
                userDropdown.classList.remove('show');
                userToggle.classList.remove('open');
                userToggle.setAttribute('aria-expanded', 'false');
                if (willOpen && typeof App.actions?.markNotificationsAsRead === 'function') {
                    App.actions.markNotificationsAsRead();
                }
            };
        }

        if (userToggle.dataset.headerBound !== '1') {
            userToggle.dataset.headerBound = '1';
            userToggle.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const willOpen = !userDropdown.classList.contains('show');
                userDropdown.classList.toggle('show', willOpen);
                userToggle.classList.toggle('open', willOpen);
                userToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
                notifDropdown.classList.remove('show');
                notifToggle.setAttribute('aria-expanded', 'false');
            };
        }

        if (clearNotificationsBtn && clearNotificationsBtn.dataset.headerBound !== '1') {
            clearNotificationsBtn.dataset.headerBound = '1';
            clearNotificationsBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof App.actions?.clearAllNotifications === 'function') {
                    App.actions.clearAllNotifications();
                }
            };
        }

        if (document.body.dataset.headerGlobalBound !== '1') {
            document.body.dataset.headerGlobalBound = '1';
            document.addEventListener('click', (e) => {
                if (!menu.contains(e.target) && !menuBtn.contains(e.target)) {
                    if (window.innerWidth <= 1024) closeMobileMenu();
                }
                if (!notifContainer.contains(e.target) && !userContainer.contains(e.target)) {
                    closeHeaderOverlays();
                }
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    closeHeaderOverlays();
                    closeMobileMenu();
                }
            });

            window.addEventListener('resize', () => {
                if (window.innerWidth > 1024) {
                    closeMobileMenu();
                }
            });
        }
    }

    function install() {
        const App = window.App;
        if (!App) {
            setTimeout(install, 100);
            return;
        }
        bindHeaderControls();

        if (!App.__headerRebindShowAppScreenWrapped && typeof App.ui?.showAppScreen === 'function') {
            App.__headerRebindShowAppScreenWrapped = true;
            const originalShowAppScreen = App.ui.showAppScreen.bind(App.ui);
            App.ui.showAppScreen = function() {
                const result = originalShowAppScreen();
                setTimeout(bindHeaderControls, 0);
                setTimeout(bindHeaderControls, 300);
                return result;
            };
        }

        if (!App.__headerRebindRenderMenuWrapped && typeof App.ui?.renderMenu === 'function') {
            App.__headerRebindRenderMenuWrapped = true;
            const originalRenderMenu = App.ui.renderMenu.bind(App.ui);
            App.ui.renderMenu = function() {
                const result = originalRenderMenu();
                setTimeout(bindHeaderControls, 0);
                return result;
            };
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install, { once: true });
    } else {
        install();
    }
})();
