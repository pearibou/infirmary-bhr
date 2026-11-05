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
