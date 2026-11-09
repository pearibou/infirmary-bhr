// Public UI artwork only. Captions are accessibility labels, never printed.
export const CALENDAR_SYMBOLS=[['star','Blue Star of Life'],['heartbeat','Heart and pulse'],['nurse','Nurse'],['caduceus','Winged staff'],['accessibility','Wheelchair'],['hospital','Hospital'],['star-outline','Outlined star'],['first-aid','First aid kit'],['ribbon','Ribbon'],['pills','Medicines'],['lab','Laboratory'],['bandage','Bandages'],['syringe','Syringe'],['dna','Double helix'],['thermometer','Thermometer'],['mortar','Mortar and pestle'],['record','Medical document'],['ambulance','Ambulance'],['stethoscope','Stethoscope'],['iv','Infusion bag'],['microscope','Microscope']];
const paths={
 heartbeat:'<path d="M24 42 7 26C-6 13 12-1 24 12 36-1 54 13 41 26L24 42M3 23h10l3-7 4 15 4-17 4 11h12"/>',
 nurse:'<path d="M12 20 7 10Q24-2 41 10l-5 10M21 9h6m-3-3v6M11 44V27Q11 15 24 15t13 12v17M15 28q4-3 6-8 8 7 13 6v6q-1 10-10 10t-9-10zM18 41v4m12-4v4"/>',
 caduceus:'<circle cx="24" cy="5" r="3"/><path d="M24 9v36M22 15C13 0 8 18 2 12q3 14 17 8m7-5C35 0 40 18 46 12q-3 14-17 8M16 22c-16 9 25 8 12 17l-7 6M32 22c16 9-25 8-12 17l7 6"/>',
 accessibility:'<circle cx="21" cy="7" r="4"/><path d="M20 15v15h15l7 12 4-2M26 19h9M18 21a15 15 0 1 0 17 17M13 19a19 19 0 1 0 25 21"/>',
 hospital:'<rect x="5" y="4" width="38" height="40" rx="5"/><path d="M15 12h6v10h6V12h6v25h-6V26h-6v11h-6z"/>',
 'star-outline':'<path d="M19 3h10v13l11-6 5 9-11 6 11 6-5 9-11-6v12H19V34L8 40l-5-9 11-6L3 19l5-9 11 6z"/>',
 'first-aid':'<rect x="4" y="13" width="40" height="29" rx="4"/><path d="M18 13V7h12v6"/><circle cx="24" cy="28" r="10"/><path d="M21 21h6v4h4v6h-4v4h-6v-4h-4v-6h4z"/>',
 ribbon:'<path d="M17 24C2 5 34-8 35 12c0 10-19 24-24 32l-7-9 19-24h6M16 20l24 16-7 9L12 27M27 11l-5 8"/>',
 pills:'<path d="M7 29 28 8a10 10 0 0 1 14 14L21 43A10 10 0 0 1 7 29zM18 18l14 14"/><circle cx="35" cy="36" r="10" fill="white"/><path d="M25 36h20"/>',
 lab:'<path d="M6 13h12M8 13v25a4 4 0 0 0 8 0V13M29 5v17L19 40q-2 4 3 4h20q5 0 3-4L35 22V5M26 5h12M25 31h14M11 18v19"/>',
 bandage:'<rect x="3" y="16" width="42" height="16" rx="5" transform="rotate(45 24 24)"/><rect x="3" y="16" width="42" height="16" rx="5" transform="rotate(-45 24 24)" fill="white"/><path d="m19 23 1-1m4-4 1-1m-2 10 1-1m4-4 1-1m-2 10 1-1m4-4 1-1"/>',
 syringe:'<path d="m4 44 7-7m-2-4 6 6 22-22-6-6zM28 8l12 12M34 4l10 10M39 9l-6 6M13 29l5 5m1-11 5 5m1-11 5 5"/>',
 dna:'<path d="M10 3c0 22 28 20 28 42M38 3c0 22-28 20-28 42M11 7h25M14 13h19M20 19h8M20 29h8M14 35h19M11 41h25"/>',
 thermometer:'<path d="M12 29 34 7a7 7 0 0 1 10 10L22 39h-5l-6 6a4 4 0 0 1-6-6l7-6zM12 33l5 6M20 29l15-15M24 17l4 4m2-10 4 4"/>',
 mortar:'<path d="M5 23h38v4H5zM7 27c2 23 32 23 34 0M25 22 36 5q3-4 6 0l-9 17M4 43h40"/>',
 record:'<path d="M17 3h24v42H7V13L17 3v12H7M28 8v10m-5-5h10M14 24h20M14 31h20M14 38h15"/>',
 ambulance:'<path d="M3 12h27v27H3zM30 20h9l7 11v8H30M33 20v-6h4v6M10 20h5v-5h5v5h5v5h-5v5h-5v-5h-5zM30 29h14"/><circle cx="12" cy="39" r="6" fill="white"/><circle cx="37" cy="39" r="6" fill="white"/>',
 stethoscope:'<path d="M8 4C-2 4 1 28 15 28S32 4 22 4M8 3v3m14-3v3M15 28v9a9 9 0 0 0 18 0V24"/><circle cx="34" cy="17" r="8"/><circle cx="34" cy="17" r="4"/>',
 iv:'<rect x="10" y="6" width="27" height="29" rx="3"/><circle cx="23" cy="6" r="3" fill="white"/><path d="M10 14h27M14 20h9m-9 5h6m-6 5h6M20 35v6q0 5 6 5h8q6 0 6-5v-5M40 36v-5"/>',
 microscope:'<path d="m26 4 10 5-10 21-10-5zM27 2l10 5m-22 20 10 5M28 25c17 7 12 18-2 18M5 35h24M16 43l-2-8M12 43h27v4H12z"/>'
};
export function calendarSymbol(doc,id='star'){
 if(!CALENDAR_SYMBOLS.some(([key])=>key===id))throw new Error('Choose a calendar symbol.');
 if(id==='star'){const image=doc.createElement('img');image.src=new URL('./icons/star-of-life.png',import.meta.url).href;image.alt='';return image;}
 const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 48 48');svg.setAttribute('aria-hidden','true');svg.setAttribute('fill','none');svg.setAttribute('stroke','#222');svg.setAttribute('stroke-width','2');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.innerHTML=paths[id];return svg;
}
