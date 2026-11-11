import {presenceFilesRequest as request,uploadPresenceIdentity,getWorkspaceFolder,getDriveSessionEpoch} from './drive.js?v=0.29.0';
import {validatePresenceIdentity,PRESENCE_TTL} from './presence-model.js?v=0.29.0';
const folderType='application/vnd.google-apps.folder',json=value=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
const safe=value=>{if(typeof value!=='string'||!/^[\w-]+$/.test(value))throw new Error('Invalid presence file ID.');return value;};
async function list(q){const files=[];let pageToken;do{const response=await request('files?'+new URLSearchParams({q,fields:'files(id,name,mimeType,parents,appProperties,modifiedTime),nextPageToken',pageSize:'100',...(pageToken?{pageToken}:{})}));if(!Array.isArray(response.files))throw new Error('Invalid shared presence listing.');files.push(...response.files);pageToken=response.nextPageToken;}while(pageToken);return files;}
async function folders(parent,name,key){return (await list(`'${safe(parent)}' in parents and mimeType = '${folderType}' and appProperties has { key='${key}' and value='1' } and trashed = false`)).filter(f=>f.mimeType===folderType&&f.appProperties?.[key]==='1'&&f.parents?.includes(parent));}
async function makeFolder(parent,name,key){const file=await request('files?fields=id',json({name,mimeType:folderType,parents:[safe(parent)],appProperties:{[key]:'1',...(key==='bhrPresenceFolder'?{bhrTemporarySystem:'1'}:{})}}));safe(file.id);return {...file,mimeType:folderType,parents:[parent],appProperties:{[key]:'1'}};}
async function locations(state,now){
 const root=getWorkspaceFolder(),epoch=getDriveSessionEpoch();if(!root)throw new Error('Connect a BHR workspace before checking presence.');if(state.root&&state.root!==root||state.epoch!==undefined&&state.epoch!==epoch)throw new Error('Presence workspace changed.');state.root=root;state.epoch=epoch;
 if(state.folders&&now-state.folderChecked<60000&&now>=state.folderChecked)return state.folders;
 let systems=await folders(root,'System','bhrSystem');if(!systems.length)systems=[await makeFolder(root,'System','bhrSystem')];const found=[];
 for(const system of systems){let entries=await folders(system.id,'Presence','bhrPresenceFolder');if(!entries.length)entries=[await makeFolder(system.id,'Presence','bhrPresenceFolder')];found.push(...entries);}
 if(epoch!==getDriveSessionEpoch()||root!==getWorkspaceFolder())throw new Error('Presence workspace changed.');state.folders=[...new Set(found.map(f=>safe(f.id)))].sort();state.folderChecked=now;return state.folders;
}
const stamp=(state,key,identity,now)=>({bhrPresence:'1',sessionId:state.sessionId,userId:identity.id,profileKey:key,lastSeen:new Date(now).toISOString()});
async function profileKey(identity){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(identity)));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}
export const drivePresenceTransport={
 async touch(state,user,now){
  const parents=await locations(state,now),identity=validatePresenceIdentity({version:1,id:user.id,sessionId:state.sessionId,name:user.name,email:user.email||''}),key=await profileKey(identity),properties=stamp(state,key,identity,now);
  if(state.fileId&&state.profileKey===key){try{await request('files/'+safe(state.fileId)+'?fields=id',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({appProperties:properties})});return;}catch(error){if(error.status!==404)throw error;state.fileId=null;}}
  // Recover a create whose response was lost; never create a new file every heartbeat.
  if(!state.fileId){for(const parent of parents){const files=await list(`'${parent}' in parents and appProperties has { key='sessionId' and value='${safe(state.sessionId)}' } and trashed = false`);const own=files.find(f=>f.appProperties?.bhrPresence==='1'&&f.appProperties?.userId===identity.id&&f.parents?.includes(parent));if(own){state.fileId=own.id;break;}}}
  const file=await uploadPresenceIdentity(state.fileId,{...(state.fileId?{}:{name:'session_'+state.sessionId+'.json',mimeType:'application/json',parents:[parents[0]]}),appProperties:properties},identity);state.fileId=safe(file.id);state.profileKey=key;
 },
 async read(state,now){
  const parents=await locations(state,now),files=[];for(const parent of parents)files.push(...await list(`'${parent}' in parents and appProperties has { key='bhrPresence' and value='1' } and trashed = false`));const records=[];state.identities??=new Map();const seen=new Set();
  for(const file of files){const meta=file.appProperties||{},time=Date.parse(meta.lastSeen);if(meta.bhrPresence!=='1'||!parents.some(id=>file.parents?.includes(id))||!Number.isFinite(time)||time>now+60000||now-time>=PRESENCE_TTL)continue;seen.add(file.id);let cached=state.identities.get(file.id);if(!cached||cached.key!==meta.profileKey){let value;try{value=await request('files/'+safe(file.id)+'?alt=media');}catch(error){if(error.status===404)continue;throw error;}const identity=validatePresenceIdentity(value);if(identity.id!==meta.userId||identity.sessionId!==meta.sessionId||await profileKey(identity)!==meta.profileKey)throw new Error('A shared presence file is inconsistent.');cached={key:meta.profileKey,identity};state.identities.set(file.id,cached);}records.push({...cached.identity,lastSeen:meta.lastSeen});}
  for(const id of state.identities.keys())if(!seen.has(id))state.identities.delete(id);
  // Bound housekeeping. Recheck a day-old session before trashing temporary metadata only.
  for(const file of files.filter(f=>now-Date.parse(f.appProperties?.lastSeen)>86400000).slice(0,2)){try{const fresh=await request('files/'+safe(file.id)+'?fields=id,parents,appProperties');if(fresh.appProperties?.bhrPresence==='1'&&parents.some(id=>fresh.parents?.includes(id))&&now-Date.parse(fresh.appProperties.lastSeen)>86400000)await request('files/'+safe(file.id)+'?fields=id',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({trashed:true})});}catch{/* Expiry works even when optional cleanup fails. */}}
  return records;
 },
 async remove(state){if(!state.fileId||state.epoch!==getDriveSessionEpoch()||state.root!==getWorkspaceFolder())return;await request('files/'+safe(state.fileId)+'?fields=id',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({trashed:true})});state.fileId=null;}
};
