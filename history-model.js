export const HISTORY_FIELDS=['id','code','officialTitle','displayName','onset','notes','edition','enteredBy','enteredById','enteredAt','updatedBy','updatedById','updatedAt','revision'];
export const HISTORY_HEADERS=['Entry ID','ICD-10-CM code','Official title','Display name','Onset','Notes','Code edition','Entered by','Entered by ID','Entered at','Updated by','Updated by ID','Updated at','Revision'];
export const EDITABLE_HISTORY_FIELDS=['code','officialTitle','displayName','onset','notes','edition'];
export function validOnset(value){if(!value)return true;const m=value.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);if(!m||+m[1]<1)return false;const y=+m[1],month=m[2]?+m[2]:1,day=m[3]?+m[3]:1,date=new Date(0);date.setUTCFullYear(y,month-1,day);return date.getUTCFullYear()===y&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;}
export function validateHistory(entry){
 if(!entry||HISTORY_FIELDS.some(key=>typeof entry[key]!=='string'||entry[key].length>5000)||!entry.id)throw new Error('Invalid medical history entry.');
 if(!entry.officialTitle.trim()&&!entry.displayName.trim())throw new Error('Select a diagnosis or enter a condition name.');
 if(entry.code&&(!/^(?:[A-Z][0-9]|QA)[A-Z0-9](?:\.[A-Z0-9]{1,4})?$/.test(entry.code)||!entry.officialTitle.trim()||!entry.edition.trim()))throw new Error('Select a complete ICD-10-CM result.');
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
const aliases={htn:'hypertension',dm:'diabetes',dm2:'type 2 diabetes',t2dm:'type 2 diabetes',dm1:'type 1 diabetes',t1dm:'type 1 diabetes',mi:'myocardial infarction',aki:'acute kidney failure',hf:'heart failure',chf:'heart failure',copd:'chronic obstructive pulmonary',gerd:'gastro esophageal reflux',cad:'atherosclerotic heart',bph:'benign prostatic hyperplasia',ckd:'chronic kidney disease',afib:'atrial fibrillation',osa:'obstructive sleep apnea',uti:'urinary tract infection',dvt:'deep vein thrombosis'};
const fillers=new Set(['a','an','the','of','and','for','patient','has','is']);
const critical=new Set(['with','without','left','right','bilateral','acute','chronic','1','2']);
const tokens=value=>normalize(value).replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(Boolean);
function queryTokens(query){return [...new Set(tokens(normalize(query).replace(/\b(?:[a-z]\.){2,}[a-z]?\.?/g,term=>term.replaceAll('.','')).replace(/\bw\/o\b/g,'without').replace(/\bno complications\b/g,'without complications').replace(/\bhigh blood pressure\b/g,'hypertension').replace(/\bheart attack\b/g,'myocardial infarction').replace(/\bacid reflux\b/g,'gastro esophageal reflux').replace(/\btype ii\b/g,'type 2').replace(/\btype i\b/g,'type 1')).flatMap(word=>(aliases[word]||word).split(' ')).filter(word=>!fillers.has(word)))].slice(0,16);}
// Bounded edit distance, including a swapped adjacent pair. Never fuzzy-match codes.
function nearby(a,b,max){if(Math.abs(a.length-b.length)>max)return false;let priorPrior,prior=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const current=[i];let best=i;for(let j=1;j<=b.length;j++){let value=Math.min(prior[j]+1,current[j-1]+1,prior[j-1]+(a[i-1]===b[j-1]?0:1));if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])value=Math.min(value,priorPrior[j-2]+1);current[j]=value;best=Math.min(best,value);}if(best>max)return false;priorPrior=prior;prior=current;}return prior[b.length]<=max;}
export function prepareCatalog(catalog){
 if(!catalog?.edition||!Array.isArray(catalog.entries)||catalog.entries.length<70000)throw new Error('The local diagnosis catalog is unavailable or incomplete.');
 const postings=new Map(),index=catalog.entries.map(([code,title],i)=>{const words=tokens(title);for(const word of new Set(words)){if(!postings.has(word))postings.set(word,[]);postings.get(word).push(i);}return {code,title,words:words.join(' '),compact:code.replace('.','').toLowerCase()};});
 return {...catalog,index,postings,vocabulary:[...postings.keys()]};
}
export function searchCatalog(catalog,query,limit=30){
 const q=normalize(query).trim().slice(0,200);if(q.length<2)return [];const compact=q.replace(/\W/g,''),codeQuery=/^(?:[a-z]\d|qa)[a-z0-9]{1,5}$/.test(compact),matches=[];if(!compact)return [];
 for(const row of catalog.index)if(row.compact===compact||row.compact.startsWith(compact))matches.push({code:row.code,title:row.title,score:row.compact===compact?0:1,matchKind:'code'});
 if(codeQuery)return matches.sort((a,b)=>a.score-b.score||a.code.localeCompare(b.code)).slice(0,limit);
 const terms=queryTokens(q);if(!terms.length)return matches.slice(0,limit);const candidates=new Map();
 for(const [termIndex,term] of terms.entries()){
  const options=new Map([[term,0]]);
  if(!critical.has(term))for(const word of catalog.vocabulary){if(term.length>=3&&word.startsWith(term))options.set(word,word===term?0:1);else if(term.length>=5&&nearby(term,word,term.length>=9?2:1))options.set(word,2);}
  for(const [word,cost] of options)for(const id of catalog.postings.get(word)||[]){if(!candidates.has(id))candidates.set(id,new Map());const found=candidates.get(id);found.set(termIndex,Math.min(found.get(termIndex)??Infinity,cost));}
 }
 for(const [id,found] of candidates){if(terms.some((term,i)=>critical.has(term)&&!found.has(i)))continue;const full=found.size===terms.length;if(!full&&(terms.length<2||found.size<(terms.length===2?1:Math.ceil(terms.length*.6))||!terms.some((term,i)=>term.length>=4&&!critical.has(term)&&found.has(i))))continue;
  const row=catalog.index[id],cost=[...found.values()].reduce((a,b)=>a+b,0);matches.push({code:row.code,title:row.title,score:(full?10:100)+(terms.length-found.size)*10+cost*2+(row.words.startsWith(terms.join(' '))?0:1),matchKind:full?(cost?'spelling':'text'):'related'});
 }
 const seen=new Set();return matches.sort((a,b)=>a.score-b.score||a.title.length-b.title.length||a.code.localeCompare(b.code)).filter(row=>!seen.has(row.code)&&seen.add(row.code)).slice(0,limit);
}
let cached;
export async function loadCatalog(){if(!cached)cached=fetch('./data/icd10cm-2027.json',{cache:'force-cache'}).then(response=>{if(!response.ok)throw new Error('The public diagnosis catalog could not be loaded.');return response.json();}).then(prepareCatalog).catch(error=>{cached=null;throw error;});return cached;}
