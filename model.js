export const emptyDirectory = () => ({version:1,people:[]});
export function validateDirectory(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.people)) throw new Error('Unsupported directory format (expected version 1).');
  const ids=new Set();
  for(const p of data.people){
    if(!p || typeof p.id!=='string' || !p.id || ids.has(p.id) || typeof p.name!=='string' || !p.name.trim() || (p.room!==undefined && typeof p.room!=='string') || typeof p.info!=='string' || !Array.isArray(p.notes) || !validDate(p.updatedAt)) throw new Error('Invalid person in directory.');
    for(const field of ['firstName','lastName','preferredName'])if(p[field]!==undefined && typeof p[field]!=='string')throw new Error('Invalid name field.');
    if(p.birthDate!==undefined && (!p.birthDate || typeof p.birthDate!=='object' || birthDateError(p.birthDate)))throw new Error('Invalid birth date.');
    if(p.driveFolders!==undefined){
      if(!Array.isArray(p.driveFolders))throw new Error('Invalid Drive folders.');
      const folders=new Set();
      for(const folder of p.driveFolders){if(!folder || typeof folder.id!=='string' || !/^[\w-]+$/.test(folder.id) || typeof folder.name!=='string' || folders.has(folder.id))throw new Error('Invalid Drive folder link.');folders.add(folder.id);}
    }
    ids.add(p.id); const notes=new Set();
    for(const n of p.notes){if(!n || typeof n.id!=='string' || !n.id || notes.has(n.id) || typeof n.text!=='string' || !n.text.trim() || !validDate(n.createdAt)) throw new Error('Invalid note in directory.'); notes.add(n.id);}
  }
  return data;
}
function validDate(value){return typeof value==='string' && Number.isFinite(Date.parse(value));}
export function mergeDirectories(local,remote){
  validateDirectory(local);validateDirectory(remote);
  const people=new Map(local.people.map(p=>[p.id,structuredClone(p)]));
  for(const incoming of remote.people){
    const old=people.get(incoming.id);
    if(!old){people.set(incoming.id,structuredClone(incoming));continue;}
    const notes=new Map(old.notes.map(n=>[n.id,n]));
    for(const note of incoming.notes){const existing=notes.get(note.id);if(existing && JSON.stringify(existing)!==JSON.stringify(note)) throw new Error('Conflicting note IDs. Sync stopped to protect both copies.');notes.set(note.id,note);}
    const latest=Date.parse(incoming.updatedAt)>Date.parse(old.updatedAt)?incoming:old;
    const folders=new Map([...(old.driveFolders||[]),...(incoming.driveFolders||[])].map(folder=>[folder.id,folder]));
    people.set(old.id,{...latest,...(folders.size?{driveFolders:[...folders.values()]}:{}),notes:[...notes.values()].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.id.localeCompare(b.id))});
  }
  return {version:1,people:[...people.values()]};
}

export function personName(person){
  return person.preferredName?.trim() || [person.firstName,person.lastName].filter(Boolean).join(' ').trim() || person.name || '';
}
export function birthDateError(birth={}){
  const {month='',day='',year=''}=birth;
  for(const [value,max] of [[month,12],[day,31],[year,9999]]){
    if(value!==''&&(!/^\d+$/.test(String(value))||Number(value)<1||Number(value)>max))return 'Enter a valid month (1–12), day (1–31), and year (1–9999), or leave boxes blank.';
  }
  if(month!==''&&day!==''){
    const y=year===''?2000:Number(year),m=Number(month),d=Number(day);
    const date=new Date(0);date.setFullYear(y,m,0);
    if(d>date.getDate())return 'This day does not exist in the selected month.';
  }
  return '';
}
export function parseFolder(value){
  const input=value.trim();
  if(/^[\w-]+$/.test(input))return input;
  try{const url=new URL(input);if(url.protocol!=='https:'||url.hostname!=='drive.google.com')throw new Error();const match=url.pathname.match(/^\/drive\/(?:u\/\d+\/)?folders\/([\w-]+)\/?$/);if(match)return match[1];}catch{}
  throw new Error('Use a Google Drive folder link or folder ID.');
}
