// --- Configuration ---
export const BASE_GRID_SIZE = 32;
export const WORLD_WIDTH_CELLS = 100;
export const WORLD_HEIGHT_CELLS = 80;
export const PAN_SPEED_FACTOR = 0.5;
export const SAVE_KEY = 'simEmojiSave_v7'; // Keep version or increment if format changed significantly again
export const MAX_ZOOM = 5.0;
export const MIN_ZOOM = 0.2;
export const ZOOM_INCREMENT = 0.15;
export const MAX_UNDO_STEPS = 50;
export const MAX_BUILD_SIZE = 10;

// Layer Config
export const LAYER_GROUND = 0;      // Base terrain (grass, dirt, water base, rock base)
export const LAYER_PATHS = 1;       // Roads, paths, rails drawn ON TOP of ground
export const LAYER_FEATURES = 2;    // Trees, rocks, water details, signs ON TOP of ground/paths
export const LAYER_BUILDINGS = 3;   // Structures ON TOP of ground/paths
export const LAYER_AIR = 4;         // Clouds, effects, flying things
// --- Derived ---
export const DEFAULT_LAYER = LAYER_FEATURES; // Default if not specified
export const MIN_LAYER = LAYER_GROUND;
export const MAX_LAYER = LAYER_AIR;

// --- Generated Tile Definitions ---
export const GENERATED_TILES = {
    'T_GRASS': { type: 'noise', color1: '#5a8b5a', color2: '#6aaa6a', density: 0.3 },
    'T_WATER_BASE': { type: 'color', color: '#699cc0' }, // Flat water color for base layer
    'T_DIRT':  { type: 'noise', color1: '#a07040', color2: '#8a6035', density: 0.2 },
    'T_ROCK_BASE':  { type: 'color', color: '#888888'}, // Flat rock base color
    'T_SAND':  { type: 'noise', color1: '#e0d0a0', color2: '#d4c090', density: 0.25 },
    'T_ASPHALT': { type: 'color', color: '#555555' },
    'T_RAIL': { type: 'pattern', color1: '#8a6035', color2: '#707070', pattern: 'rail' }, // Example Rail
    'T_BRICK_PATH': { type: 'pattern', color1: '#c08070', color2: '#a06050', pattern: 'bricks' } // Example Bricks
};
export const GENERATED_TILE_IDS = new Set(Object.keys(GENERATED_TILES));

// Tiles considered 'ground' for placement rules (only allowed on LAYER_GROUND)
export const GROUND_TILES = new Set(['T_GRASS', 'T_DIRT', 'T_SAND', 'T_ROCK_BASE', 'T_WATER_BASE']);
// Tiles considered 'paths' (only allowed on LAYER_PATHS, over GROUND)
export const PATH_TILES = new Set(['T_ASPHALT', 'T_RAIL', 'T_BRICK_PATH', '🛣️', '🛤️']);


// --- Tile Categories (Cleaned Up) ---
export const TILE_CATEGORIES = {
    "Ground": ['T_GRASS', 'T_DIRT', 'T_SAND', 'T_ROCK_BASE', 'T_WATER_BASE'], // Only generated ground tiles
    "Paths": ['T_ASPHALT', 'T_RAIL', 'T_BRICK_PATH', '🛣️', '🛤️'], // Specific path tiles
    "Nature Features": ['🌳', '🌲', '🌴', '🌵', '🪨', '🌊', '💧', '⛰️'], // Natural items (rock emoji is feature now)
    "Residential": ['🏠','🏡','🏘️','🛖','🏚️'],
    "Commercial": ['🏢','🏬','🏪','🛒','🛍️','🏨','🏦','🏧','🍔','🍕','☕'],
    "Industrial": ['🏭','🔧','⚙️','🧱', '🪵','⛏️','🏗️'], // Keep brick wall here
    "Civic/Services": ['🏛️','🏫','🏥','🏤','⛪','🕌','🕍','⛩️','🏰','🏯','🏟️','🚓','🚑','🚒','⛽','💡','♻️','🛰️'],
    "Transport Vehicles": ['🚗','🚕','🚌','🚚','🚛', '🚢','🚤','✈️','🚁','🚀'], // Moved infrastructure
    "Infrastructure": ['🚧','🚦','🌉','⚓'], // Things often on/near paths/water
    "Recreation": ['🎡','🎢','🎪','🎭','🏞️','🏕️','🏖️','⛱️','⛲','⛳','⚽','🏀','🏈','⚾','🎾','🎳','🎣','🏊','🏄'],
    "Farm": ['🍓','🍎','🌽','🥕','🥔','🍅','🍆','🐄','🐖','🐑','🐔','🚜','🧑‍🌾','🧺','🌾'],
    "Signs/Markers": ['🚩','📍','🚧','⬆️','➡️','⬇️','⬅️','⛔','🚫','🅿️'], // Note: duplicate construction sign
    "Air/Sky/Effects": ['⭐','❓','☀️','🌙','☁️','⚡','💥','💫','✨','💯','💣','💰','🗿','🔥'] // Renamed
};

// --- Default Layer Assignments (Refined) ---
export const DEFAULT_TILE_LAYER = {
    // Categories
    "Ground": LAYER_GROUND,
    "Paths": LAYER_PATHS,
    "Nature Features": LAYER_FEATURES,
    "Residential": LAYER_BUILDINGS,
    "Commercial": LAYER_BUILDINGS,
    "Industrial": LAYER_BUILDINGS,
    "Civic/Services": LAYER_BUILDINGS,
    "Transport Vehicles": LAYER_FEATURES, // Sit on paths/ground
    "Infrastructure": LAYER_FEATURES,    // Sit on paths/ground
    "Recreation": LAYER_BUILDINGS,       // Assume most are structures
    "Farm": LAYER_FEATURES,
    "Signs/Markers": LAYER_FEATURES,
    "Air/Sky/Effects": LAYER_AIR,

    // Explicit overrides if needed (though category should cover most)
    '🧱': LAYER_FEATURES, // Brick wall is a feature, not path
};

// Helper to get the default layer for a tile
export function getDefaultLayerForTile(tileId) {
    if (!tileId) return DEFAULT_LAYER; // Handle null/undefined tileId

    // Check specific overrides first
    if (DEFAULT_TILE_LAYER[tileId] !== undefined) {
        return DEFAULT_TILE_LAYER[tileId];
    }
    // Find category
    for (const category in TILE_CATEGORIES) {
        if (TILE_CATEGORIES[category].includes(tileId)) {
            return DEFAULT_TILE_LAYER[category] ?? DEFAULT_LAYER;
        }
    }
    console.warn(`No default layer found for tile: ${tileId}. Using global default.`);
    return DEFAULT_LAYER; // Fallback
}

// Default starting tile/size/layer
export const DEFAULT_TILE = 'T_GRASS';
export const DEFAULT_SIZE = 1;
