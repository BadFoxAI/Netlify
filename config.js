// --- Configuration ---
export const BASE_GRID_SIZE = 32;
export const WORLD_WIDTH_CELLS = 100;
export const WORLD_HEIGHT_CELLS = 80;
export const PAN_SPEED_FACTOR = 0.5;
export const SAVE_KEY = 'simEmojiSave_v7'; // Version for layer rework & generated tiles
export const MAX_ZOOM = 5.0;
export const MIN_ZOOM = 0.2;
export const ZOOM_INCREMENT = 0.15;
export const MAX_UNDO_STEPS = 50;
export const MAX_BUILD_SIZE = 10;

// Layer Config
export const LAYER_GROUND = 0;
export const LAYER_PATHS = 1;
export const LAYER_FEATURES = 2; // Trees, rocks, water features
export const LAYER_BUILDINGS = 3;
export const LAYER_AIR = 4; // Clouds, planes?
// --- Derived ---
export const DEFAULT_LAYER = LAYER_FEATURES; // Default if not specified
export const MIN_LAYER = LAYER_GROUND;
export const MAX_LAYER = LAYER_AIR;

// --- Generated Tile Definitions ---
// ID: { type: 'color'|'noise'|'pattern', color: 'hex', [options] }
export const GENERATED_TILES = {
    'T_GRASS': { type: 'noise', color1: '#5a8b5a', color2: '#6aaa6a', density: 0.3 },
    'T_WATER': { type: 'pattern', color1: '#699cc0', color2: '#5080a4', pattern: 'waves' },
    'T_DIRT':  { type: 'noise', color1: '#a07040', color2: '#8a6035', density: 0.2 },
    'T_ROCK':  { type: 'noise', color1: '#888888', color2: '#707070', density: 0.4 },
    'T_SAND':  { type: 'noise', color1: '#e0d0a0', color2: '#d4c090', density: 0.25 },
    // Add more patterns/colors as needed
    'T_ASPHALT': { type: 'color', color: '#555555' },
};
export const GENERATED_TILE_IDS = new Set(Object.keys(GENERATED_TILES));

// Tiles that can be built *over* on a lower layer
// Primarily ground tiles. Might not be strictly needed if layer logic is robust.
export const OVERWRITABLE_TILES = new Set(['T_GRASS', 'T_DIRT', 'T_SAND']);

// --- Tile Categories (using Generated Tile IDs now) ---
export const TILE_CATEGORIES = {
    "Terrain": ['T_GRASS', 'T_DIRT', 'T_SAND', 'T_ROCK', 'T_WATER', '🌳', '🌲', '🌴', '🌵', '🌊', '💧', '⛰️'], // Keep some nature emojis
    "Paths": ['T_ASPHALT', '🛣️', '🛤️', '🧱'], // Added asphalt
    "Residential": ['🏠','🏡','🏘️','🛖','🏚️'],
    "Commercial": ['🏢','🏬','🏪','🛒','🛍️','🏨','🏦','🏧','🍔','🍕','☕'],
    "Industrial": ['🏭','🔧','⚙️','🪵','⛏️','🏗️'], // Removed Brick 🧱 here
    "Civic/Services": ['🏛️','🏫','🏥','🏤','⛪','🕌','🕍','⛩️','🏰','🏯','🏟️','🚓','🚑','🚒','⛽','💡','♻️','🛰️'],
    "Transport": ['🚗','🚕','🚌','🚚','🚛','🚧','🚦','🌉','⚓','🚢','🚤','✈️','🚁','🚀','⛽'], // Removed road/rail
    "Recreation": ['🎡','🎢','🎪','🎭','🏞️','🏕️','🏖️','⛱️','⛲','⛳','⚽','🏀','🏈','⚾','🎾','🎳','🎣','🏊','🏄'],
    "Farm": ['🍓','🍎','🌽','🥕','🥔','🍅','🍆','🐄','🐖','🐑','🐔','🚜','🧑‍🌾','🧺','🌾'],
    "Signs/Markers": ['🚩','📍','🚧','⬆️','➡️','⬇️','⬅️','⛔','🚫','🅿️'],
    "Special/Misc": ['⭐','❓','☀️','🌙','☁️','⚡','💥','💫','✨','💯','💣','💰','🗿','🔥']
};

// --- Default Layer Assignments (by Category or specific tile) ---
export const DEFAULT_TILE_LAYER = {
    // Categories (can be overridden by specific tiles below)
    "Terrain": LAYER_FEATURES, // Most terrain items are features
    "Paths": LAYER_PATHS,
    "Residential": LAYER_BUILDINGS,
    "Commercial": LAYER_BUILDINGS,
    "Industrial": LAYER_BUILDINGS,
    "Civic/Services": LAYER_BUILDINGS,
    "Transport": LAYER_FEATURES, // Vehicles sit on top of roads
    "Recreation": LAYER_BUILDINGS, // Most are structures
    "Farm": LAYER_FEATURES, // Crops, animals
    "Signs/Markers": LAYER_FEATURES,
    "Special/Misc": LAYER_AIR, // Effects often float

    // Specific Overrides (Generated Ground)
    "T_GRASS": LAYER_GROUND,
    "T_DIRT": LAYER_GROUND,
    "T_SAND": LAYER_GROUND,
    "T_ROCK": LAYER_GROUND, // Rock base is ground
    "T_WATER": LAYER_GROUND, // Water base is ground
    "T_ASPHALT": LAYER_PATHS, // Asphalt IS the path layer

    // Specific Overrides (Emojis)
    '🌳': LAYER_FEATURES, '🌲': LAYER_FEATURES, '🌴': LAYER_FEATURES, '🌵': LAYER_FEATURES,
    '🛣️': LAYER_PATHS, '🛤️': LAYER_PATHS, '🧱': LAYER_PATHS, // Brick path
    '🌊': LAYER_FEATURES, '💧': LAYER_FEATURES, // Water effects are features
    '☁️': LAYER_AIR, '✈️': LAYER_AIR, '🚁': LAYER_AIR, '🚀': LAYER_AIR, '🛰️': LAYER_AIR,
    // Add more specific overrides if needed
};

// Helper to get the default layer for a tile
export function getDefaultLayerForTile(tileId) {
    if (DEFAULT_TILE_LAYER[tileId] !== undefined) {
        return DEFAULT_TILE_LAYER[tileId];
    }
    // Find category if specific tile not found
    for (const category in TILE_CATEGORIES) {
        if (TILE_CATEGORIES[category].includes(tileId)) {
            return DEFAULT_TILE_LAYER[category] ?? DEFAULT_LAYER; // Use category default or global default
        }
    }
    return DEFAULT_LAYER; // Fallback
}


// Default starting tile/size/layer
export const DEFAULT_TILE = 'T_GRASS'; // Start with grass
export const DEFAULT_SIZE = 1;
