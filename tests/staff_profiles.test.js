import test from 'node:test';
import assert from 'node:assert/strict';
import {authorize,disconnect,loadCurrentUser,getCurrentUser,useSharedWorkspace,loadStaffProfile,saveStaffProfile,hasStaffProfile,validateStaffName} from '../drive.js';
import {canEditNote} from '../model.js';
let files=new Map(),subject='staff-a',calls=[];
async function signIn(id){disconnect();subject=id;globalThis.google={accounts:{oauth2:{initTokenClient:o=>({requestAccessToken:opts=>{assert.equal(opts.prompt,'select_account');o.callback({access_token:'synthetic',expires_in:3600});}})}}};await authorize('test');await loadCurrentUser();}
globalThis.fetch=async(url,opts={})=>{
 calls.push({url,opts});const u=new URL(url),q=u.searchParams.get('q')||'';
 if(url.includes('userinfo'))return Response.json({sub:subject,name:'Google Name',email:subject+'@example.test'});
 if(u.pathname.endsWith('/files/shared'))return Response.json({id:'shared',name:'Infirmary-BHR',mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}});
 if(u.pathname.endsWith('/files')){
  if(opts.method==='POST'){const parts=opts.body.split('\r\n\r\n'),meta=JSON.parse(parts[1].split('\r\n--')[0]),value=JSON.parse(parts[2].split('\r\n--')[0]);files.set(meta.name,{id:meta.name.replace(/\.json$/,''),value});return Response.json({id:meta.name});}
  if(q.includes('people_directory'))return Response.json({files:[{id:'directory'}]});
  const name=q.match(/name = '([^']+)'/)?.[1];return Response.json({files:files.has(name)?[{id:files.get(name).id}]:[]});
 }
 const name=decodeURIComponent(u.pathname.split('/').pop())+'.json';if(files.has(name)){if(opts.method==='PATCH')files.get(name).value=JSON.parse(opts.body);return Response.json(files.get(name).value);}
 return Response.json({error:{message:'Not found'}},{status:404});
};
test('individual profiles persist without changing Google ownership or other staff preferences',async()=>{
 await signIn('staff-a');await useSharedWorkspace('shared');assert.equal(await loadStaffProfile(),null);assert.equal(hasStaffProfile(),false);
 await saveStaffProfile('  Nurse A  ');assert.equal(getCurrentUser().name,'Nurse A');assert.equal(getCurrentUser().id,'staff-a');assert.equal(hasStaffProfile(),true);
 await signIn('staff-b');assert.equal(hasStaffProfile(),false);await useSharedWorkspace('shared');assert.equal(await loadStaffProfile(),null);await saveStaffProfile('Nurse A');assert.equal(getCurrentUser().id,'staff-b');assert.equal(canEditNote({authorId:'staff-a'},getCurrentUser()),false);
 await signIn('staff-a');await useSharedWorkspace('shared');assert.equal((await loadStaffProfile()).name,'Nurse A');await saveStaffProfile('Nurse Alice');assert.equal(files.get('staff_profile_staff-b.json').value.displayName,'Nurse A');
 assert.ok(!calls.some(c=>c.opts.body?.includes('access_token')));
 disconnect();assert.equal(getCurrentUser(),null);assert.equal(hasStaffProfile(),false);
});
test('mismatched profile is rejected; invalid names and My Drive are not accepted',async()=>{
 await signIn('staff-a');await useSharedWorkspace('shared');files.get('staff_profile_staff-a.json').value.subject='staff-b';await assert.rejects(loadStaffProfile(),/does not match/);await assert.rejects(saveStaffProfile('Oops'),/mismatch/);assert.equal(hasStaffProfile(),false);
 for(const v of ['', ' ', 'a'.repeat(101),'a\nb'])assert.throws(()=>validateStaffName(v));await assert.rejects(useSharedWorkspace('root'),/shared/);disconnect();
});
