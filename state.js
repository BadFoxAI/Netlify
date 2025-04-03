import * as config from './config.js';
// Removed updateLayerUI import
import { showStatusMessage, updateUndoRedoButtons, selectTile, updateSizeUI } from './ui.js';

// --- Game State Variables --- (Unchanged)
export let camX = 0; export let camY = 0; export let zoomLevel = 1.0;
export let gridData = new Map(); export let selectedTile = config.DEFAULT_TILE;
export let selectedSize = config.DEFAULT_SIZE; export let currentPlacementLayer = config.getDefaultLayerForTile(config.DEFAULT_TILE);
export let currentTool = 'build'; export let undoStack = []; export let redoStack = [];

// --- State Modifiers --- (Unchanged)
export function setCamPos(x, y) { camX = x; camY = y; } export function setZoomLevel(level) { zoomLevel = level; }
export function setGridData(dataMap) { gridData = dataMap; }
export function setSelectedTile(tileId) { selectedTile = tileId; currentPlacementLayer = config.getDefaultLayerForTile(tileId); }
export function setSelectedSize(size) { selectedSize = Math.max(1, Math.min(size, config.MAX_BUILD_SIZE)); }
// setSelectedLayer removed
export function setCurrentTool(tool) { currentTool = tool; }

// --- Helper: Get Effective Tile Info --- (Unchanged)
export function getEffectiveTileInfo(gx, gy) { const key=`${gx},${gy}`; const layerMap=gridData.get(key); if(!layerMap)return null; let topmostLayer=-Infinity; let topmostData=null; let topmostLayerKey=-1; for(const layerStr in layerMap){const layer=parseInt(layerStr,10); if(layer>topmostLayer){topmostLayer=layer; topmostData=layerMap[layer]; topmostLayerKey=layer;}} if(topmostData===null||topmostLayer===-Infinity)return null; if(typeof topmostData==='string'){return{tile:topmostData,size:1,layer:topmostLayer,isOrigin:true,originX:gx,originY:gy};}else if(typeof topmostData==='object'&&topmostData!==null){if(topmostData.isOrigin){return{tile:topmostData.tile,size:topmostData.size||1,layer:topmostLayer,isOrigin:true,originX:gx,originY:gy};}else{const originKey=`${topmostData.originX},${topmostData.originY}`; const originLayerMap=gridData.get(originKey); const originData=originLayerMap?originLayerMap[topmostLayerKey]:null; if(typeof originData==='object'&&originData?.isOrigin){return{tile:originData.tile,size:originData.size||1,layer:topmostLayer,isOrigin:false,originX:topmostData.originX,originY:topmostData.originY};}else{console.warn(`Orphaned part at ${gx},${gy}, layer ${topmostLayer} ref ${topmostData.originX},${topmostData.originY}`); return null;}}} return null; }

// --- Undo/Redo Logic --- (Unchanged)
export function performAction(actionData){/*...*/} export function undo(){/*...*/} export function redo(){/*...*/}

// --- Save/Load Logic --- (Unchanged - v9 format)
export function saveGameToLocal(){/*...*/} export function loadGameFromLocal(){/*...*/} export function saveGameToFile(){/*...*/} export function loadGameFromFile(file){/*...*/}

// --- Clear Logic (FIXED) ---
export function confirmClearSaveData() {
    try {
        localStorage.removeItem(config.SAVE_KEY);
        showStatusMessage("Local save data cleared.", true);
        // Reset Game State
        setGridData(new Map()); setCamPos(0, 0); setZoomLevel(1.0);
        selectTile(config.DEFAULT_TILE); // Resets tile & placementLayer
        // *** CORRECTED CALL ***
        setSelectedSize(config.DEFAULT_SIZE); // Use the state function
        // *** END CORRECTION ***
        setCurrentTool('build');
        undoStack = []; redoStack = []; updateUndoRedoButtons();
        // Signal state change for redraw etc.
        window.dispatchEvent(new Event('stateLoaded'));
    } catch (error) {
        console.error("Error clearing save data:", error);
        showStatusMessage("Error clearing save data.", false);
    }
}
