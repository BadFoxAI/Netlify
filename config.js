// --- Configuration ---
export const BASE_GRID_SIZE = 32;
export const WORLD_WIDTH_CELLS = 100;
export const WORLD_HEIGHT_CELLS = 80;
export const PAN_SPEED_FACTOR = 0.5;
export const SAVE_KEY = 'simEmojiSave_v6'; // Incremented version for layers
export const MAX_ZOOM = 5.0;
export const MIN_ZOOM = 0.2;
export const ZOOM_INCREMENT = 0.15;
export const MAX_UNDO_STEPS = 50;
export const MAX_BUILD_SIZE = 10; // Max size from slider

// Layer Config
export const DEFAULT_LAYER = 1;
export const MIN_LAYER = 0;
export const MAX_LAYER = 10; // Example max layer

// Tiles that can be built over (e.g., basic ground)
export const OVERWRITABLE_TILES = new Set(['🟩', '🟫']); // Grass, Dirt

// --- Tile Definitions ---
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

// Default starting tile/size
export const DEFAULT_TILE = '🌳';
export const DEFAULT_SIZE = 1;
