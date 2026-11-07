export const HISTORY_FIELDS=['id','code','officialTitle','displayName','onset','notes','edition','enteredBy','enteredById','enteredAt','updatedBy','updatedById','updatedAt','revision'];
export const HISTORY_HEADERS=['Entry ID','ICD-10-CM code','Official title','Display name','Onset','Notes','Code edition','Entered by','Entered by ID','Entered at','Updated by','Updated by ID','Updated at','Revision'];
export const EDITABLE_HISTORY_FIELDS=['code','officialTitle','displayName','onset','notes','edition'];
export function validOnset(value){if(!value)return true;const m=value.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);if(!m||+m[1]<1)return false;const y=+m[1],month=m[2]?+m[2]:1,day=m[3]?+m[3]:1,date=new Date(0);date.setUTCFullYear(y,month-1,day);return date.getUTCFullYear()===y&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;}
export function validateHistory(entry){
 if(!entry||HISTORY_FIELDS.some(key=>typeof entry[key]!=='string'||entry[key].length>5000)||!entry.id)throw new Error('Invalid medical history entry.');
 if(!entry.officialTitle.trim()&&!entry.displayName.trim())throw new Error('Select a diagnosis or enter a condition name.');
 if(entry.code&&(!/^[A-Z][0-9][A-Z0-9](?:\.[A-Z0-9]{1,4})?$/.test(entry.code)||!entry.officialTitle.trim()||!entry.edition.trim()))throw new Error('Select a complete ICD-10-CM result.');
 if(!entry.code&&(entry.officialTitle||entry.edition))throw new Error('An uncoded condition must use its display name only.');
 if(!validOnset(entry.onset))throw new Error('Onset must be a year, YYYY-MM, or YYYY-MM-DD, or left blank.');
 if(!/^\d+$/.test(entry.revision)||!Number.isSafeInteger(+entry.revision)||+entry.revision<1)throw new Error('Invalid history revision.');
 for(const key of ['enteredAt','updatedAt'])if(!Number.isFinite(Date.parse(entry[key])))throw new Error('Invalid history timestamp.');
 return entry;
}
export function historyToRow(entry){return HISTORY_FIELDS.map(key=>String(entry[key]??''));}
export function parseHistoryRows(values,metadata){
 if(!HISTORY_HEADERS.every((title,i)=>values[0]?.[i]===title))throw new Error('Medical History headings do not match the BHR template. Existing cells were left unchanged.');
 const ids=new Set(),rows=[];for(const row of values.slice(1)){const cells=HISTORY_FIELDS.map((_,i)=>String(row[i]??''));if(cells.every(value=>!value.trim()))continue;const entry=validateHistory(Object.fromEntries(HISTORY_FIELDS.map((key,i)=>[key,cells[i]])));if(ids.has(entry.id))throw new Error('Duplicate medical history entry IDs.');ids.add(entry.id);const metadataId=metadata.get(entry.id);if(!Number.isInteger(metadataId))throw new Error('A history entry is missing its stable row marker. Existing cells were left unchanged.');rows.push({...entry,baseline:cells,metadataId});}return rows;
}
export function newHistory(fields,user,id=crypto.randomUUID(),now=new Date()){
 const stamp=now.toISOString(),entry=Object.fromEntries(HISTORY_FIELDS.map(key=>[key,'']));Object.assign(entry,Object.fromEntries(EDITABLE_HISTORY_FIELDS.map(key=>[key,String(fields[key]||'').trim()])),{id,enteredBy:user.name,enteredById:user.id,enteredAt:stamp,updatedBy:user.name,updatedById:user.id,updatedAt:stamp,revision:'1'});return validateHistory(entry);
}
export function reviseHistory(before,fields,user,now=new Date()){const entry={...before,...Object.fromEntries(EDITABLE_HISTORY_FIELDS.map(key=>[key,String(fields[key]||'').trim()])),updatedBy:user.name,updatedById:user.id,updatedAt:now.toISOString(),revision:String(+before.revision+1)};delete entry.metadataId;delete entry.baseline;return validateHistory(entry);}
export const historyName=entry=>entry.displayName.trim()||entry.officialTitle;
const normalize=value=>String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const aliases={htn:'hypertension',dm:'diabetes',chf:'heart failure',copd:'chronic obstructive pulmonary',gerd:'gastro esophageal reflux',cad:'atherosclerotic heart'};
export function prepareCatalog(catalog){if(!catalog?.edition||!Array.isArray(catalog.entries)||catalog.entries.length<70000)throw new Error('The local diagnosis catalog is unavailable or incomplete.');return {...catalog,index:catalog.entries.map(([code,title])=>({code,title,words:normalize(title).replace(/[^a-z0-9]+/g,' '),compact:code.replace('.','').toLowerCase()}))};}
export function searchCatalog(catalog,query,limit=30){const q=normalize(query).trim();if(q.length<2)return [];const words=(aliases[q]||q).replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/),compact=q.replace(/\W/g,'');const matches=[];for(const row of catalog.index){let score;if(row.compact===compact)score=0;else if(row.compact.startsWith(compact))score=1;else if(words.every(word=>row.words.includes(word)))score=row.words.startsWith(words.join(' '))?2:3;else continue;matches.push({...row,score});}return matches.sort((a,b)=>a.score-b.score||a.title.length-b.title.length||a.code.localeCompare(b.code)).slice(0,limit);}
let cached;
export async function loadCatalog(){if(!cached)cached=fetch('./data/icd10cm-2026-april.json',{cache:'force-cache'}).then(response=>{if(!response.ok)throw new Error('The public diagnosis catalog could not be loaded.');return response.json();}).then(prepareCatalog).catch(error=>{cached=null;throw error;});return cached;}
