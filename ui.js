import * as config from './config.js';
import * as state from './state.js';

// --- DOM Element References ---
export const paletteDiv = document.getElementById('palette');
export const selectedTileDisplay = document.getElementById('selectedTileDisplay');
export const coordsDisplay = document.getElementById('coordsDisplay');
export const buildToolBtn = document.getElementById('buildToolBtn');
export const bulldozeToolBtn = document.getElementById('bulldozeToolBtn');
export const saveFileBtn = document.getElementById('saveFileBtn');
export const loadFileBtn = document.getElementById('loadFileBtn');
export const clearSaveBtn = document.getElementById('clearSaveBtn');
export const clearConfirmDiv = document.getElementById('clearConfirm');
export const clearConfirmYesBtn = document.getElementById('clearConfirmYes');
export const clearConfirmNoBtn = document.getElementById('clearConfirmNo');
export const saveStatus = document.getElementById('saveStatus');
export const fileInput = document.getElementById('fileInput');
export const zoomInBtn = document.getElementById('zoomInBtn');
export const zoomOutBtn = document.getElementById('zoomOutBtn');
export const undoBtn = document.getElementById('undoBtn');
export const redoBtn = document.getElementById('redoBtn');
// ADDED Size Buttons
export const size1xBtn = document.getElementById('size1xBtn');
export const size2xBtn = document.getElementById('size2xBtn');
export const size3xBtn = document.getElementById('size3xBtn');


let statusTimeout;

// --- UI Update Functions ---
export function populatePalette() { /* ... Unchanged ... */
    paletteDiv.innerHTML = '<h2>Palette</h2>'; // Clear old content, keep header
    for (const category in config.TILE_CATEGORIES) {
        const catDiv = document.createElement('div');
        catDiv.className = 'tile-category'; // Renamed class
        const title = document.createElement('h3');
        title.textContent = category;
        catDiv.appendChild(title);

        config.TILE_CATEGORIES[category].forEach(tile => {
            const span = document.createElement('span');
            span.textContent = tile;
            span.dataset.tile = tile; // Use data-tile
            span.title = `Build ${tile}`;
            span.onclick = () => {
                selectTile(tile); // Use selectTile function
                // Optional: Reset size to 1x1 when selecting a new tile?
                // selectSize(config.DEFAULT_SIZE);
                setTool('build'); // Switch to build tool when selecting a tile
            };
            catDiv.appendChild(span);
        });
        paletteDiv.appendChild(catDiv);
    }
}

export function selectTile(tile) {
    state.setSelectedTile(tile); // Update state
    selectedTileDisplay.textContent = tile;
    const spans = paletteDiv.querySelectorAll('span');
    spans.forEach(span => {
        span.classList.toggle('selected-tile', span.dataset.tile === tile);
    });
}

// ADDED Size Selection UI Logic
export function selectSize(size) {
    state.setSelectedSize(size); // Update state
    updateSizeUI(); // Update button highlights
}

export function updateSizeUI() {
    size1xBtn.classList.toggle('active-size', state.selectedSize === 1);
    size2xBtn.classList.toggle('active-size', state.selectedSize === 2);
    size3xBtn.classList.toggle('active-size', state.selectedSize === 3);
}
// --- End Size Selection UI ---

export function setTool(toolName) { /* ... Unchanged ... */
    state.setCurrentTool(toolName); // Update state
    updateToolUI(); // Update button appearance
}

export function updateToolUI() { /* ... Unchanged ... */
    selectedTileDisplay.style.display = state.currentTool === 'build' ? 'inline' : 'none';
    buildToolBtn.classList.toggle('active-tool', state.currentTool === 'build');
    bulldozeToolBtn.classList.toggle('active-tool', state.currentTool === 'bulldoze');
}

export function updateCoordsDisplay(gx, gy) { /* ... Unchanged ... */
    coordsDisplay.textContent = `Grid: ${gx},${gy}`;
}

export function updateUndoRedoButtons() { /* ... Unchanged ... */
    undoBtn.disabled = state.undoStack.length === 0;
    redoBtn.disabled = state.redoStack.length === 0;
}

export function showStatusMessage(message, isSuccess) { /* ... Unchanged ... */
    if (statusTimeout) clearTimeout(statusTimeout);
    saveStatus.textContent = message;
    saveStatus.style.color = isSuccess ? '#8f8' : '#f88';
    statusTimeout = setTimeout(() => { saveStatus.textContent = ''; }, 3000);
}

export function showClearConfirmation() { /* ... Unchanged ... */
    clearConfirmDiv.style.display = 'block';
}
export function hideClearConfirmation() { /* ... Unchanged ... */
    clearConfirmDiv.style.display = 'none';
}
