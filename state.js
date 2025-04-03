import * as config from './config.js';
import { showStatusMessage, updateUndoRedoButtons, selectTile, updateSizeUI, updateLayerUI } from './ui.js';

// --- Game State Variables --- (Unchanged)
export let camX = 0; export let camY = 0; export let zoomLevel = 1.0; export let gridData = new Map();
export let selectedTile = config.DEFAULT_TILE; export let selectedSize = config.DEFAULT_SIZE;
export let selectedLayer = config.DEFAULT_LAYER; export let currentTool = 'build';
export let undoStack = []; export let redoStack = [];

// --- State Modifiers --- (Unchanged)
export function setCamPos(x, y) { camX = x; camY = y; } export function setZoomLevel(level) { zoomLevel = level; }
export function setGridData(dataMap) { gridData = dataMap; } export function setSelectedTile(tile) { selectedTile = tile; }
export function setSelectedSize(size) { selectedSize = Math.max(1, Math.min(size, config.MAX_BUILD_SIZE)); }
export function setSelectedLayer(layer) { selectedLayer = Math.max(config.MIN_LAYER, Math.min(layer, config.MAX_LAYER)); }
export function setCurrentTool(tool) { currentTool = tool; }

// --- Helper --- (Unchanged)
export function getEffectiveTileData(gx, gy) { /* ... */ }

// --- Undo/Redo Logic --- (Unchanged)
export function performAction(actionData) { /* ... */ } export function undo() { /* ... */ } export function redo() { /* ... */ }

// --- Save/Load Logic --- (Save/Load File/Local unchanged from v6)
export function saveGameToLocal() { /* ... unchanged ... */ } export function loadGameFromLocal() { /* ... unchanged ... */ }
export function saveGameToFile() { /* ... unchanged ... */ } export function loadGameFromFile(file) { /* ... unchanged ... */ }

// --- Clear Logic (UPDATED) ---
export function confirmClearSaveData() {
    try {
        localStorage.removeItem(config.SAVE_KEY);
        showStatusMessage("Local save data cleared.", true);

        // --- ADDED: Reset Game State ---
        setGridData(new Map()); // Clear the grid map
        setCamPos(0, 0);        // Reset camera position
        setZoomLevel(1.0);      // Reset zoom
        // Reset UI selections
        selectTile(config.DEFAULT_TILE); // Resets tile and its default layer
        selectSize(config.DEFAULT_SIZE); // Resets size and updates UI
        // selectLayer(config.DEFAULT_LAYER); // selectTile already sets default layer
        setTool('build');
        // Clear history
        undoStack = [];
        redoStack = [];
        updateUndoRedoButtons();
        // --- End Reset ---

        // Signal state change if needed (e.g., for immediate redraw outside game loop)
         window.dispatchEvent(new Event('stateLoaded')); // Re-use existing event

    } catch (error) {
        console.error("Error clearing save data:", error);
        showStatusMessage("Error clearing save data.", false);
    }
}
