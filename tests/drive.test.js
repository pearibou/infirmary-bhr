import test from 'node:test';
import assert from 'node:assert/strict';
import {authorize,disconnect,syncDirectory} from '../drive.js';
const directory={version:1,people:[]};
function signIn(){globalThis.google={accounts:{oauth2:{initTokenClient:options=>({requestAccessToken:()=>options.callback({access_token:'test-only',expires_in:3600})})}}};return authorize('test.apps.googleusercontent.com');}
test('Drive validates folder, pulls JSON, then uploads merged data',async()=>{
 await signIn();const calls=[];globalThis.fetch=async(url,options={})=>{calls.push({url,options});if(url.includes('files/folder?'))return Response.json({mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}});if(url.includes('files?q='))return Response.json({files:[{id:'file'}]});if(url.includes('alt=media'))return Response.json(directory);return Response.json({id:'file'});};
 assert.deepEqual(await syncDirectory('folder',directory),directory);assert.equal(calls.length,5);assert.equal(calls.at(-1).options.method,'PATCH');assert.deepEqual(JSON.parse(calls.at(-1).options.body),directory);disconnect();
});
test('Drive rejects duplicate files without uploading',async()=>{
 await signIn();let writes=0;globalThis.fetch=async(url,options={})=>{if(options.method)writes++;return Response.json(url.includes('files/folder?')?{mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}}:{files:[{id:'a'},{id:'b'}]});};await assert.rejects(syncDirectory('folder',directory),/Multiple/);assert.equal(writes,0);disconnect();
});
test('Drive creates a multipart JSON file when folder has no directory',async()=>{
 await signIn();let upload;globalThis.fetch=async(url,options={})=>{if(options.method){upload=options;return Response.json({id:'new'});}return Response.json(url.includes('files/folder?')?{mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}}:{files:[]});};await syncDirectory('folder',directory);assert.equal(upload.method,'POST');assert.match(upload.body,/people_directory.json/);assert.match(upload.body,/"parents":\["folder"\]/);disconnect();
});

import {uploadPersonFile} from '../drive.js';
test('arbitrary binary files upload directly to the assigned Drive folder',async()=>{
 await signIn();const calls=[];
 globalThis.fetch=async(url,options={})=>{calls.push({url,options});
  if(url.includes('files/person-folder?'))return Response.json({mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}});
  if(options.method==='POST')return new Response('',{headers:{Location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=test'}});
  return Response.json({id:'uploaded'});
 };
 const file=new File([new Uint8Array([0,255,16,42])],'synthetic.unknown');
 assert.equal((await uploadPersonFile('person-folder',file)).id,'uploaded');
 assert.deepEqual(JSON.parse(calls[1].options.body).parents,['person-folder']);
 assert.equal(calls[2].options.body,file);assert.equal(calls[2].options.method,'PUT');
 assert.ok(calls.every(call=>new URL(call.url).hostname==='www.googleapis.com'));disconnect();
});
test('upload refuses unexpected destination and never sends file bytes there',async()=>{
 await signIn();let requests=0;globalThis.fetch=async(url,options={})=>{requests++;return options.method==='POST'?new Response('',{headers:{Location:'https://example.com/upload/drive/steal'}}):Response.json({mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}});};
 await assert.rejects(uploadPersonFile('folder',new File(['synthetic'],'test.dat')),/Unexpected/);assert.equal(requests,2);disconnect();
});

import {getCurrentUser,loadCurrentUser,readPersonPhoto} from '../drive.js';
test('note identity comes from Google userinfo and is cleared on disconnect',async()=>{
 await signIn();let reads=0;globalThis.fetch=async(url)=>{assert.equal(url,'https://www.googleapis.com/oauth2/v3/userinfo');reads++;return Response.json({sub:'stable-google-id',name:'Synthetic Staff'});};
 assert.equal(getCurrentUser(),undefined);assert.deepEqual(await loadCurrentUser(),{id:'stable-google-id',name:'Synthetic Staff'});await loadCurrentUser();assert.equal(reads,1);disconnect();assert.equal(getCurrentUser(),null);
});
test('photos are read as authenticated blobs and reject nonimage media',async()=>{
 await signIn();globalThis.fetch=async(url,opts)=>{assert.match(url,/files\/photo-file\?alt=media/);assert.equal(opts.headers.Authorization,'Bearer test-only');return new Response(new Uint8Array([1,2]),{headers:{'Content-Type':'image/png'}});};assert.equal((await readPersonPhoto('photo-file')).type,'image/png');
 globalThis.fetch=async()=>new Response('<svg/>',{headers:{'Content-Type':'image/svg+xml'}});await assert.rejects(readPersonPhoto('photo-file'),/unsupported/);disconnect();
});

import {createEvent,eventLogText,parseEventLogText} from '../events.js';
test('sync recovers immutable event history from JSON and text and writes both copies',async()=>{
 await signIn();
 const user={id:'test',name:'Synthetic Staff'},event=()=>createEvent(user,'test.change','person','p','Synthetic change');
 const localEvent=event(),remoteEvent=event(),textEvent=event();let cloud={version:1,people:[],eventLog:[remoteEvent]},text=eventLogText([textEvent]);
 globalThis.fetch=async(url,options={})=>{
  if(options.method==='PATCH'){if(url.includes('/files/log?'))text=options.body;else cloud=JSON.parse(options.body);return Response.json({id:'saved'});}
  if(url.includes('files/folder?'))return Response.json({mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}});
  if(url.includes('files?q='))return Response.json({files:[{id:url.includes('BHR_event_log.txt')?'log':'directory'}]});
  return url.includes('files/log?')?new Response(text):Response.json(cloud);
 };
 let merged=await syncDirectory('folder',{version:1,people:[],eventLog:[localEvent]});assert.equal(merged.eventLog.length,3);assert.equal(cloud.eventLog.length,3);assert.equal(parseEventLogText(text).length,3);
 merged=await syncDirectory('folder',merged);assert.equal(merged.eventLog.length,3);disconnect();
});
test('new event text is multipart UTF-8 with real CRLF separators',async()=>{
 await signIn();let body;
 globalThis.fetch=async(url,options={})=>{
  if(options.method==='POST'){if(options.body.includes('BHR_event_log.txt'))body=options.body;return Response.json({id:'new'});}
  if(url.includes('files/folder?'))return Response.json({mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}});
  return Response.json({files:[]});
 };
 await syncDirectory('folder',{version:1,people:[],eventLog:[createEvent({name:'Synthetic'},'test.change','person','p','Created')]});assert.ok(body.includes('\r\nContent-Type: text/plain; charset=UTF-8\r\n'));assert.ok(!body.includes('\\r\\n'));disconnect();
});
test('unrecognized existing event text stops sync without overwriting directory or log',async()=>{
 await signIn();let writes=0;
 globalThis.fetch=async(url,options={})=>{
  if(options.method){writes++;return Response.json({});}
  if(url.includes('files/folder?'))return Response.json({mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}});
  if(url.includes('files?q='))return Response.json({files:[{id:url.includes('BHR_event_log.txt')?'log':'directory'}]});
  return url.includes('files/log?')?new Response('Unrecognized original text'):Response.json({version:1,people:[]});
 };
 await assert.rejects(syncDirectory('folder',{version:1,people:[],eventLog:[createEvent({name:'Synthetic'},'test.change','person','p','Created')]}),/not overwritten/);assert.equal(writes,0);disconnect();
});

test('text publication failure is reported after a successful JSON history save',async()=>{
 await signIn();let saved;
 globalThis.fetch=async(url,options={})=>{
  if(options.method==='PATCH'){saved=JSON.parse(options.body);return Response.json({id:'directory'});}
  if(options.method==='POST')return new Response('',{status:500});
  if(url.includes('files/folder?'))return Response.json({mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}});
  if(url.includes('files?q='))return Response.json({files:url.includes('BHR_event_log.txt')?[]:[{id:'directory'}]});
  return Response.json({version:1,people:[]});
 };
 await assert.rejects(syncDirectory('folder',{version:1,people:[],eventLog:[createEvent({name:'Synthetic'},'test.change','person','p','Created')]}),/Directory saved, but Event Log/);
 assert.equal(saved.eventLog.length,1);disconnect();
});

test('disconnect aborts in-flight Drive requests and drops access',async()=>{
 await signIn();let started;
 const pending=new Promise(resolve=>started=resolve);
 globalThis.fetch=async(url,options)=>new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(options.signal.reason));started();});
 const request=readPersonPhoto('synthetic-photo');await pending;disconnect();await assert.rejects(request,/connection closed/);assert.equal(getCurrentUser(),null);
});
