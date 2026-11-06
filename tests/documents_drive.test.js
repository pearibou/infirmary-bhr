import test from 'node:test';
import assert from 'node:assert/strict';
import {authorize,disconnect,loadCurrentUser,listDesktopFiles,saveDesktopDocument,changeDesktopFile} from '../drive.js';
import {validateDocument,canManageDocument} from '../documents-model.js';
const now='2026-01-01T00:00:00Z';
const metadata=(extra={})=>({id:'note',name:'Synthetic note',modifiedTime:now,parents:['root'],appProperties:{bhrDesktop:'1',kind:'note',authorId:'owner'},...extra});
const document=()=>({kind:'bhr-rich-note',version:1,html:'<b>Synthetic</b>',noteAt:now,createdAt:now,updatedAt:now,authorId:'owner',authorName:'Synthetic Owner'});
async function signIn(){globalThis.google={accounts:{oauth2:{initTokenClient:options=>({requestAccessToken:()=>options.callback({access_token:'synthetic',expires_in:3600})})}}};await authorize('test.apps.googleusercontent.com');globalThis.fetch=async()=>Response.json({sub:'owner',name:'Synthetic Owner'});await loadCurrentUser();}
test('new rich notes go to Drive root as JSON with author metadata and no-store',async()=>{
 await signIn();let request;globalThis.fetch=async(url,options)=>{request={url,options};return Response.json(metadata());};
 await saveDesktopDocument('root','Synthetic note',document());
 assert.match(request.url,/www.googleapis.com\/upload\/drive\/v3\/files/);assert.equal(request.options.cache,'no-store');assert.match(request.options.body,/"parents":\["root"\]/);assert.match(request.options.body,/"authorId":"owner"/);assert.match(request.options.body,/"kind":"bhr-rich-note"/);disconnect();
});
test('clinical note rename, move, attachment and trash reject another author before any write',async()=>{
 await signIn();let writes=0;globalThis.fetch=async(url,options={})=>{if(options.method)writes++;return Response.json(metadata({appProperties:{bhrDesktop:'1',kind:'note',authorId:'someone-else'}}));};
 for(const change of [{name:'Other'},{parent:'root'},{personId:'p'},{trash:true}])await assert.rejects(changeDesktopFile(metadata(),change),/Only the user/);
 await assert.rejects(saveDesktopDocument('root','Attempted edit',document(),metadata()),/Only the user/);
 assert.equal(writes,0);disconnect();
});
test('stale note snapshots stop edits; conditional writes carry the Drive ETag',async()=>{
 await signIn();let writes=0;globalThis.fetch=async(url,options={})=>{if(options.method){writes++;assert.equal(options.headers['If-Match'],'"version-1"');return Response.json(metadata());}return Response.json(metadata(),{headers:{etag:'"version-1"'}});};
 await assert.rejects(changeDesktopFile(metadata({modifiedTime:'2025-01-01T00:00:00Z'}),{name:'new'}),/changed/);
 await changeDesktopFile(metadata(),{name:'new'});assert.equal(writes,1);disconnect();
});
test('nonempty folders cannot bypass note deletion ownership and descendant moves are refused',async()=>{
 await signIn();const folder=metadata({id:'folder',mimeType:'application/vnd.google-apps.folder',appProperties:{bhrDesktop:'1',kind:'folder'}});let writes=0;
 globalThis.fetch=async(url,options={})=>{if(options.method)writes++;return Response.json(url.includes('files?')?{files:[metadata({appProperties:{bhrDesktop:'1',kind:'note',authorId:'other'}})]}:folder);};
 await assert.rejects(changeDesktopFile(folder,{trash:true}),/Only empty folders/);
 await assert.rejects(changeDesktopFile(folder,{parent:'folder'}),/inside itself/);assert.equal(writes,0);disconnect();
});
test('managed desktop listing follows pages without exposing unrelated root files',async()=>{
 await signIn();let count=0;globalThis.fetch=async()=>Response.json(++count===1?{files:[metadata(),{id:'private-unrelated'}],nextPageToken:'next'}:{files:[metadata({id:'second'})]});
 assert.deepEqual((await listDesktopFiles()).map(item=>item.id),['note','second']);disconnect();
});
test('rich document format and ownership reject missing author or corrupt dates',()=>{
 assert.equal(validateDocument(document()).kind,'bhr-rich-note');assert.throws(()=>validateDocument({...document(),authorId:''}));assert.throws(()=>validateDocument({...document(),noteAt:'invalid'}));assert.equal(canManageDocument(metadata(),{id:'owner'}),true);assert.equal(canManageDocument(metadata(),{id:'other'}),false);
});
