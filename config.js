// --- Configuration ---
export const BASE_GRID_SIZE = 32;
export const WORLD_WIDTH_CELLS = 100;
export const WORLD_HEIGHT_CELLS = 80;
export const PAN_SPEED_FACTOR = 0.5;
export const SAVE_KEY = 'simEmojiSave_v4'; // Incremented version
export const MAX_ZOOM = 5.0;
export const MIN_ZOOM = 0.2;
export const ZOOM_INCREMENT = 0.15;
export const MAX_UNDO_STEPS = 50;

// --- Tile Definitions (Includes Terrain) ---
// Using simple characters for terrain, could use specific emojis if preferred
export const TILE_CATEGORIES = {
    "Terrain": ['🟩', '🟦', '🟫', '🪨', '🌲', '🌳', '🌴', '🌵', '🌊', '💧'], // Grass, Water, Dirt, Rock, Trees, Water variations
    "Residential": ['🏠','🏡','🏘️','🛖','🏚️'],
    "Commercial": ['🏢','🏬','🏪','🛒','🛍️','🏨','🏦','🏧','🍔','🍕','☕'],
    "Industrial": ['🏭','🔧','⚙️','🧱','🪵','⛏️','🏗️'],
    "Civic/Services": ['🏛️','🏫','🏥','🏤','⛪','🕌','🕍','⛩️','🏰','🏯','🏟️','🚓','🚑','🚒','⛽','💡','♻️','🛰️'],
    "Transport": ['🚗','🚕','🚌','🚚','🚛','🚧','🚦','🛣️','🛤️','🌉','⚓','🚢','🚤','✈️','🚁','🚀','⛽'],
    "Recreation": ['🎡','🎢','🎪','🎭','🏞️','🏕️','🏖️','⛱️','⛲','⛳','⚽','🏀','🏈','⚾','🎾','🎳','🎣','🏊','🏄'],
    "Farm": ['🍓','🍎','🌽','🥕','🥔','🍅','🍆','🐄','🐖','🐑','🐔','🚜','🧑‍🌾','🧺','🌾'], // Added Wheat
    "Signs/Markers": ['🚩','📍','🚧','⬆️','➡️','⬇️','⬅️','⛔','🚫','🅿️'],
    "Special/Misc": ['⭐','❓','☀️','🌙','☁️','⚡','💥','💫','✨','💯','💣','💰','🗿','🔥'] // Added Fire
};

// Default starting tile
export const DEFAULT_TILE = '🌳';
