// --- Configuration ---
export const BASE_GRID_SIZE = 32;
export const WORLD_WIDTH_CELLS = 100;
export const WORLD_HEIGHT_CELLS = 80;
export const PAN_SPEED_FACTOR = 0.5;
export const SAVE_KEY = 'simEmojiSave_v5'; // Incremented version for new format
export const MAX_ZOOM = 5.0;
export const MIN_ZOOM = 0.2;
export const ZOOM_INCREMENT = 0.15;
export const MAX_UNDO_STEPS = 50;

// Tiles that can be built over (e.g., basic ground)
export const OVERWRITABLE_TILES = new Set(['🟩', '🟫']); // Grass, Dirt

// --- Tile Definitions (Includes Terrain) ---
export const TILE_CATEGORIES = {
    "Terrain": ['🟩', '🟦', '🟫', '🪨', '🌲', '🌳', '🌴', '🌵', '🌊', '💧'],
    "Residential": ['🏠','🏡','🏘️','🛖','🏚️'],
    "Commercial": ['🏢','🏬','🏪','🛒','🛍️','🏨','🏦','🏧','🍔','🍕','☕'],
    "Industrial": ['🏭','🔧','⚙️','🧱','🪵','⛏️','🏗️'],
    "Civic/Services": ['🏛️','🏫','🏥','🏤','⛪','🕌','🕍','⛩️','🏰','🏯','🏟️','🚓','🚑','🚒','⛽','💡','♻️','🛰️'],
    "Transport": ['🚗','🚕','🚌','🚚','🚛','🚧','🚦','🛣️','🛤️','🌉','⚓','🚢','🚤','✈️','🚁','🚀','⛽'],
    "Recreation": ['🎡','🎢','🎪','🎭','🏞️','🏕️','🏖️','⛱️','⛲','⛳','⚽','🏀','🏈','⚾','🎾','🎳','🎣','🏊','🏄'],
    "Farm": ['🍓','🍎','🌽','🥕','🥔','🍅','🍆','🐄','🐖','🐑','🐔','🚜','🧑‍🌾','🧺','🌾'],
    "Signs/Markers": ['🚩','📍','🚧','⬆️','➡️','⬇️','⬅️','⛔','🚫','🅿️'],
    "Special/Misc": ['⭐','❓','☀️','🌙','☁️','⚡','💥','💫','✨','💯','💣','💰','🗿','🔥']
};

// Default starting tile
export const DEFAULT_TILE = '🌳';
export const DEFAULT_SIZE = 1; // Default build size
