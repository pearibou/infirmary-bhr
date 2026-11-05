export const emptyDirectory = () => ({version:1,people:[]});
export function validateDirectory(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.people)) throw new Error('Unsupported directory format (expected version 1).');
  const ids=new Set();
  for(const p of data.people){
    if(!p || typeof p.id!=='string' || !p.id || ids.has(p.id) || typeof p.name!=='string' || !p.name.trim() || typeof p.room!=='string' || typeof p.info!=='string' || !Array.isArray(p.notes) || !validDate(p.updatedAt)) throw new Error('Invalid person in directory.');
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
    people.set(old.id,{...latest,notes:[...notes.values()].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.id.localeCompare(b.id))});
  }
  return {version:1,people:[...people.values()]};
}
