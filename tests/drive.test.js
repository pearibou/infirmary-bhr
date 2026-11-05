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
