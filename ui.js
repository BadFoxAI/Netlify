import * as config from './config.js';
import * as state from './state.js';
import { drawGeneratedTile } from './drawingUtils.js';

// --- DOM Element References --- (Removed layer controls)
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
export const sizeSlider = document.getElementById('sizeSlider');
export const sizeDisplay = document.getElementById('sizeDisplay');
// Layer buttons and display are removed from exports

let statusTimeout;

// --- UI Update Functions ---
export function populatePalette() {
    paletteDiv.innerHTML = '<h2>Palette</h2>'; const tempCanvasSize=26; const tempCanvas=document.createElement('canvas'); tempCanvas.width=tempCanvasSize; tempCanvas.height=tempCanvasSize; const tempCtx=tempCanvas.getContext('2d');
    for(const category in config.TILE_CATEGORIES){const catDiv=document.createElement('div');catDiv.className='tile-category'; const title=document.createElement('h3');title.textContent=category;catDiv.appendChild(title);
        config.TILE_CATEGORIES[category].forEach(tileId=>{ const span=document.createElement('span'); span.dataset.tile=tileId; span.title=`Build ${tileId}`;
            if(config.GENERATED_TILE_IDS.has(tileId)){tempCtx.clearRect(0,0,tempCanvasSize,tempCanvasSize); const cT=tempCtx.getTransform(); tempCtx.setTransform(1,0,0,1,0,0); drawGeneratedTile(tempCtx,0,0,tempCanvasSize,tileId); tempCtx.setTransform(cT); span.style.backgroundImage=`url(${tempCanvas.toDataURL()})`; span.style.backgroundSize='cover'; span.textContent='';} // Clear text for generated
            else{span.style.backgroundImage='none'; span.textContent=tileId;} // Set emoji content
            span.onclick=()=>{selectTile(tileId); setTool('build');}; catDiv.appendChild(span);
        }); paletteDiv.appendChild(catDiv);
    }
}

export function selectTile(tileId) {
    // This function now ONLY updates state for the tile (which derives the layer) and updates UI appearance.
    state.setSelectedTile(tileId); // This updates state.selectedTile AND state.currentPlacementLayer
    // Removed call to selectLayer(defaultLayer);

    // Update visual selection in palette
    const spans = paletteDiv.querySelectorAll('span');
    spans.forEach(span => { span.classList.toggle('selected-tile', span.dataset.tile === tileId); });

    // Update selected tile display
    if (config.GENERATED_TILE_IDS.has(tileId)) { selectedTileDisplay.textContent = ` ${tileId.replace('T_', '')} `; selectedTileDisplay.style.fontSize = '14px'; selectedTileDisplay.style.fontFamily = 'monospace'; selectedTileDisplay.title = tileId; }
    else { selectedTileDisplay.textContent = tileId; selectedTileDisplay.style.fontSize = '24px'; selectedTileDisplay.style.fontFamily = 'sans-serif'; selectedTileDisplay.title = ''; }
}

export function selectSize(size) { state.setSelectedSize(size); updateSizeUI(); }
export function updateSizeUI() { const s=state.selectedSize; if(sizeSlider.value!=String(s)){sizeSlider.value=s;} sizeDisplay.textContent=`${s}x${s}`; }

// selectLayer function removed
// updateLayerUI function removed

export function setTool(toolName) { state.setCurrentTool(toolName); updateToolUI(); }
export function updateToolUI() { selectedTileDisplay.style.display=state.currentTool==='build'?'inline-block':'none'; buildToolBtn.classList.toggle('active-tool',state.currentTool==='build'); bulldozeToolBtn.classList.toggle('active-tool',state.currentTool==='bulldoze');}
export function updateCoordsDisplay(gx, gy) { coordsDisplay.textContent=`Grid: ${gx},${gy}`; }
export function updateUndoRedoButtons() { undoBtn.disabled=state.undoStack.length===0; redoBtn.disabled=state.redoStack.length===0; }
export function showStatusMessage(message, isSuccess) { if(statusTimeout)clearTimeout(statusTimeout); saveStatus.textContent=message; saveStatus.style.color=isSuccess?'#8f8':'#f88'; statusTimeout=setTimeout(()=>{saveStatus.textContent='';},3000); }
export function showClearConfirmation() { clearConfirmDiv.style.display='block'; }
export function hideClearConfirmation() { clearConfirmDiv.style.display='none'; }
