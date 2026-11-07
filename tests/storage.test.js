import test from 'node:test';
import assert from 'node:assert/strict';
import {authorize,loadCurrentUser,disconnect,ensureWorkspaceFolder,getWorkspaceFolder,listDesktopFiles,createDesktopFolder,saveDesktopDocument,syncDirectory} from '../drive.js';
import {mergeDirectories} from '../model.js';
import {createEvent,eventLogText} from '../events.js';
const mime='application/vnd.google-apps.folder',now='2026-01-01T00:00:00Z';
const person=(id,photo)=>({id,name:'Synthetic '+id,info:'',updatedAt:now,notes:[],...(photo?{photo}:{})});
function backend({duplicate=false,conflict=false,failNoteMove=false}={}){
 const directory={version:1,people:[person('p',{fileId:'portrait',folderId:'root'}),person('q',{fileId:'assigned-photo',folderId:'person-folder'})]};
 const files=new Map(),data=new Map(),calls=[];let serial=0,fail=failNoteMove;
 const add=(id,name,mimeType='application/json',parents=['drive-root'],appProperties={})=>files.set(id,{id,name,mimeType,parents,appProperties,capabilities:{canAddChildren:true},modifiedTime:now});
 add('drive-root','My Drive',mime,[]);add('directory','people_directory.json');add('history','BHR_event_log.txt','text/plain');
 data.set('directory',directory);data.set('history',eventLogText([createEvent({id:'owner',name:'Synthetic'},'test','directory','root','Synthetic event')]));
 add('note','Synthetic clinical note','application/json',undefined,{bhrDesktop:'1',kind:'note',authorId:'owner',personId:'p'});
 add('folder','Synthetic folder',mime,undefined,{bhrDesktop:'1',kind:'folder'});add('child','Synthetic child',undefined,['folder'],{bhrDesktop:'1',kind:'note',authorId:'other'});
 add('portrait','Synthetic portrait','image/png');add('assigned-photo','Synthetic assigned photo','image/png',['person-folder']);add('unrelated','Unrelated file','text/plain');
 if(duplicate||conflict){add('container','Infirmary-BHR',mime,undefined,{bhrWorkspace:'1'});if(duplicate)add('other-container','Infirmary-BHR',mime);if(conflict){add('existing-directory','people_directory.json',undefined,['container']);data.set('existing-directory',{version:1,people:[]});}}
 globalThis.fetch=async(input,options={})=>{
  const url=new URL(input),params=url.searchParams,method=options.method||'GET';calls.push({url:url.href,options});
  if(url.pathname.endsWith('/userinfo'))return Response.json({sub:'owner',name:'Synthetic Owner'});
  let id=url.pathname.split('/').at(-1);if(id==='root')id='drive-root';
  if(url.pathname.endsWith('/files')&&method==='GET'){
   const q=params.get('q')||'',parent=q.match(/'([^']+)' in parents/),name=q.match(/name = '([^']+)'/),person=q.match(/key='personId' and value='([^']+)'/);
   return Response.json({files:[...files.values()].filter(file=>!file.trashed&&(!parent||file.parents.includes(parent[1]==='root'?'drive-root':parent[1]))&&(!name||file.name===name[1])&&(!q.includes("mimeType = 'application/vnd.google-apps.folder'")||file.mimeType===mime)&&(!q.includes("key='bhrDesktop'")||file.appProperties.bhrDesktop==='1')&&(!person||file.appProperties.personId===person[1]))});
  }
  if(params.get('uploadType')==='multipart'){
   const boundary=options.headers['Content-Type'].split('boundary=')[1],parts=options.body.split('--'+boundary),meta=JSON.parse(parts[1].split('\r\n\r\n')[1].trim()),body=JSON.parse(parts[2].split('\r\n\r\n')[1].trim());
   id='new-'+(++serial);add(id,meta.name,meta.mimeType,meta.parents,meta.appProperties);data.set(id,body);return Response.json(files.get(id));
  }
  if(method==='POST'){
   const body=JSON.parse(options.body);id='container-'+(++serial);add(id,body.name,body.mimeType,body.parents.map(p=>p==='root'?'drive-root':p),body.appProperties);return Response.json(files.get(id));
  }
  if(!files.has(id))return Response.json({error:{message:'Synthetic file missing'}},{status:404});
  if(method==='PATCH'){
   if(fail&&id==='note'&&params.has('addParents')){fail=false;return Response.json({error:{message:'Synthetic move failed'}},{status:503});}
   if(params.get('uploadType')==='media')data.set(id,JSON.parse(options.body));
   else{Object.assign(files.get(id),JSON.parse(options.body||'{}'));if(params.has('addParents'))files.get(id).parents=[params.get('addParents')];}
   return Response.json(files.get(id));
  }
  if(params.get('alt')==='media'){const value=data.get(id);return typeof value==='string'?new Response(value):Response.json(value);}
  return Response.json(files.get(id));
 };
 return {files,data,calls};
}
async function signIn(){disconnect();globalThis.google={accounts:{oauth2:{initTokenClient:o=>({requestAccessToken:()=>o.callback({access_token:'synthetic',expires_in:3600})})}}};await authorize('synthetic.apps.googleusercontent.com');await loadCurrentUser();}
test('workspace upgrade moves only BHR files, keeps IDs/chart links, and contains new documents/folders/photos',async()=>{
 const b=backend();await signIn();const container=await ensureWorkspaceFolder('root');assert.equal(container.name,'Infirmary-BHR');assert.notEqual(container.id,'drive-root');
 for(const id of ['directory','history','note','folder'])assert.deepEqual(b.files.get(id).parents,[container.id]);
 assert.deepEqual(b.files.get('child').parents,['folder']);assert.equal(b.files.get('note').appProperties.personId,'p');assert.equal(b.files.get('note').appProperties.authorId,'owner');assert.deepEqual(b.files.get('unrelated').parents,['drive-root']);
 assert.deepEqual((await listDesktopFiles()).map(f=>f.id).sort(),['folder','note']);
 const folder=await createDesktopFolder('root','New folder');assert.deepEqual(folder.parents,[container.id]);
 const note=await saveDesktopDocument('root','New note',{kind:'bhr-rich-note',version:1,html:'<b>Synthetic</b>',authorId:'owner',authorName:'Synthetic Owner',createdAt:now,noteAt:now,updatedAt:now});assert.deepEqual(note.parents,[container.id]);
 const localBefore=structuredClone(b.data.get('directory'));const merged=await syncDirectory(container.id,{version:1,people:[]});assert.deepEqual(b.files.get('portrait').parents,[container.id]);assert.equal(merged.people[0].photo.folderId,container.id);assert.equal(mergeDirectories(localBefore,merged).people[0].photo.folderId,container.id);assert.deepEqual(b.files.get('assigned-photo').parents,['person-folder']);
 assert.equal(getWorkspaceFolder(),container.id);const count=b.calls.length;await ensureWorkspaceFolder(container.id);assert.equal(b.calls.length,count);disconnect();assert.equal(getWorkspaceFolder(),undefined);
});
test('duplicate containers and conflicting directory copies stop before moving or overwriting records',async()=>{
 for(const settings of [{duplicate:true},{conflict:true}]){const b=backend(settings);await signIn();await assert.rejects(ensureWorkspaceFolder('root'),/Multiple|Both storage/);assert.deepEqual(b.files.get('directory').parents,['drive-root']);assert.deepEqual(b.files.get('note').parents,['drive-root']);assert.ok(!b.calls.some(c=>c.options.method==='PATCH'&&new URL(c.url).searchParams.has('addParents')));disconnect();}
});
test('partial migration retries reuse the container and preserve the already moved files',async()=>{
 const b=backend({failNoteMove:true});await signIn();await assert.rejects(ensureWorkspaceFolder('root'),/Synthetic move failed/);const parent=b.files.get('directory').parents[0];assert.notEqual(parent,'drive-root');
 const container=await ensureWorkspaceFolder('root');assert.equal(container.id,parent);assert.deepEqual(b.files.get('note').parents,[parent]);assert.equal([...b.files.values()].filter(f=>f.name==='Infirmary-BHR').length,1);disconnect();
});

test('explicitly choosing the intended container after a duplicate warning still migrates legacy root records',async()=>{
 const b=backend({duplicate:true});await signIn();await assert.rejects(ensureWorkspaceFolder('root'),/Multiple/);
 await ensureWorkspaceFolder('container');assert.deepEqual(b.files.get('directory').parents,['container']);assert.deepEqual(b.files.get('history').parents,['container']);disconnect();
});

test('an unavailable legacy photo keeps its reference/initials fallback without blocking directory sync',async()=>{
 const b=backend();b.files.delete('portrait');await signIn();const container=await ensureWorkspaceFolder('root');
 const merged=await syncDirectory(container.id,{version:1,people:[]});assert.equal(merged.people[0].photo.fileId,'portrait');assert.equal(merged.people[0].photo.folderId,'root');disconnect();
});
