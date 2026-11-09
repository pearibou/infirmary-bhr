// Nonsensitive, browser-local preference. Does not change direct Sheets saves.
export const SYNC_INTERVALS=[0,5,10,30,60,120,300,600];
export const SYNC_PREFERENCE_KEY='infirmary.autoSyncSeconds';
export function validSyncInterval(value){if(!SYNC_INTERVALS.includes(value))throw new Error('Choose an available automatic sync frequency.');return value;}
export function loadSyncInterval(storage){try{const value=storage.getItem(SYNC_PREFERENCE_KEY);return value===null?10:validSyncInterval(Number(value));}catch{return 10;}}
export function syncDescription(seconds){return seconds===0?'Automatic checks off · manual sync available':`Auto-sync every ${seconds<60?seconds+' seconds':seconds/60+' minute'+(seconds===60?'':'s')} when connected`;}
