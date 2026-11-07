import {validateDocument,requireDocumentOwner} from './documents-model.js?v=0.8.2';
import {mergeEventLogs,eventLogText,parseEventLogText} from './events.js?v=0.8.2';
import {validateDirectory,mergeDirectories} from './model.js?v=0.8.2';
let token,expires=0,loading,authorizedClient,currentUser;
const activeRequests=new Set();
export function disconnect(){for(const controller of activeRequests)controller.abort(new DOMException('Google Drive connection closed.','AbortError'));activeRequests.clear();token=undefined;expires=0;authorizedClient=undefined;currentUser=undefined;}
function loadGoogle(){
  if(globalThis.google?.accounts?.oauth2)return Promise.resolve();
  if(loading)return loading;
  loading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;const timer=setTimeout(()=>{script.remove();loading=undefined;reject(new Error('Google sign-in timed out. Check your connection and try again.'));},20000);script.onload=()=>{clearTimeout(timer);resolve();};script.onerror=()=>{clearTimeout(timer);loading=undefined;script.remove();reject(new Error('Cannot load Google sign-in. Check your connection.'));};document.head.append(script);});return loading;
}
export async function prepareGoogle(){await loadGoogle();}
export function authorize(clientId){
  if(token && authorizedClient===clientId && Date.now()<expires)return Promise.resolve();
  currentUser=undefined;
  return new Promise((resolve,reject)=>{
    google.accounts.oauth2.initTokenClient({client_id:clientId,scope:'openid email profile https://www.googleapis.com/auth/drive',callback:r=>{if(r.error){reject(new Error(r.error_description||r.error));return;}token=r.access_token;authorizedClient=clientId;expires=Date.now()+(Number(r.expires_in)-60)*1000;resolve();},error_callback:r=>reject(new Error(r.type==='popup_closed'?'Sign-in window closed.':r.message||'Google sign-in failed.'))}).requestAccessToken({prompt:''});
  });
}
async function driveFetch(url,options={},timeout=30000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);activeRequests.add(controller);
  try{return await fetch(url,{...options,cache:'no-store',signal:controller.signal});}
  catch(error){if(error.name==='AbortError'&&controller.signal.reason?.message==='Google Drive connection closed.')throw new Error('Google Drive connection closed.');if(error.name==='AbortError')throw new Error('Google Drive request timed out. Local records are retained; sync will retry.');throw error;}
  finally{clearTimeout(timer);activeRequests.delete(controller);}
}
async function api(path,options={}){
  const response=await driveFetch('https://www.googleapis.com/drive/v3/'+path,{...options,headers:{Authorization:`Bearer ${token}`,...options.headers}});
  if(!response.ok){if(response.status===401)disconnect();let message;try{message=(await response.json()).error?.message;}catch{}throw new Error(message||`Google Drive request failed (${response.status}).`);}return response;
}
export async function syncDirectory(folder,local){
  if(!/^[\w-]+$/.test(folder))throw new Error('Enter the folder ID from its Google Drive URL.');
  const metadata=await(await api(`files/${encodeURIComponent(folder)}?fields=id,mimeType,capabilities(canAddChildren)&supportsAllDrives=true`)).json();
  if(metadata.mimeType!=='application/vnd.google-apps.folder'||!metadata.capabilities?.canAddChildren)throw new Error('Choose a writable Google Drive folder.');
  const query=new URLSearchParams({q:`'${folder}' in parents and name = 'people_directory.json' and trashed = false`,fields:'files(id,name),nextPageToken',pageSize:'100',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});
  const listing=await(await api(`files?${query}`)).json();
  if(listing.files.length>1||listing.nextPageToken)throw new Error('Multiple people_directory.json files found. Resolve duplicates in Drive before syncing.');
  const file=listing.files[0];let merged=local,logFile,logText;
  const prepareLog=async()=>{if(!merged.eventLog?.length)return;const result=await readEventLog(folder);logFile=result.file;logText=result.text;const events=mergeEventLogs(merged.eventLog,result.events);merged={...merged,eventLog:events};};
  if(file){const response=await api(`files/${file.id}?alt=media&supportsAllDrives=true`);merged=mergeDirectories(local,validateDirectory(await response.json()));
    // A second read reduces the race window; Drive media updates are not transactional.
    const latest=await(await api(`files/${file.id}?alt=media&supportsAllDrives=true`)).json();merged=mergeDirectories(merged,validateDirectory(latest));
    await prepareLog();
    const responseWrite=await driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media&supportsAllDrives=true`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(merged)});if(!responseWrite.ok)throw new Error(`Drive upload failed (${responseWrite.status}). Local notes remain saved.`);
  }else{
    await prepareLog();
    const boundary='infirmary_'+crypto.randomUUID();const body=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({name:'people_directory.json',parents:[folder],mimeType:'application/json'})}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(merged)}\r\n--${boundary}--`;
    const response=await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':`multipart/related; boundary=${boundary}`},body});if(!response.ok)throw new Error(`Drive file creation failed (${response.status}). Local notes remain saved.`);
  }
  if(merged.eventLog?.length){try{const text=eventLogText(merged.eventLog);if(!logFile||text!==logText)await writeEventLog(folder,logFile,text);}catch{throw new Error('Directory saved, but Event Log text sync failed. Retry sync to publish its protected history.');}}
  return merged;
}

let pickerLoading;
export async function preparePicker(){
  if(globalThis.google?.picker)return;
  if(pickerLoading)return pickerLoading;
  pickerLoading=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pickerLoading=undefined;reject(new Error('Google folder picker timed out. Try again or paste a folder link.'));},20000);
    const load=()=>globalThis.gapi.load('picker',{callback:()=>{clearTimeout(timer);resolve();},onerror:()=>{clearTimeout(timer);pickerLoading=undefined;reject(new Error('Could not load Google folder picker.'));}});
    if(globalThis.gapi){load();return;}
    const script=document.createElement('script');script.src='https://apis.google.com/js/api.js';script.async=true;script.onload=load;script.onerror=()=>{clearTimeout(timer);pickerLoading=undefined;script.remove();reject(new Error('Cannot load Google folder picker. Check your connection.'));};document.head.append(script);
  });return pickerLoading;
}
export function pickFolder({pickerApiKey,projectNumber}){
  if(!token || Date.now()>=expires)throw new Error('Connect your Google account first.');
  if(!pickerApiKey || !projectNumber)throw new Error('The site administrator must configure Google Picker, or you can paste a folder link.');
  if(!globalThis.google?.picker)throw new Error('Folder picker is not ready. Try again.');
  return new Promise(resolve=>{
    const picker=google.picker;
    const view=new picker.DocsView(picker.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes('application/vnd.google-apps.folder');
    new picker.PickerBuilder().addView(view).setOAuthToken(token).setDeveloperKey(pickerApiKey).setAppId(projectNumber).setOrigin(location.origin).setTitle('Choose a Google Drive folder').setCallback(result=>{
      if(result.action===picker.Action.PICKED){const folder=result.docs[0];resolve({id:folder.id,name:folder.name||'Drive folder'});}
      else if(result.action===picker.Action.CANCEL)resolve(null);
    }).build().setVisible(true);
  });
}

export function hasDriveAccess(){return Boolean(token && Date.now()<expires);}

export async function uploadPersonFile(folder,file){
  if(!hasDriveAccess())throw new Error('Reconnect Google Drive before uploading.');
  if(!/^[\w-]+$/.test(folder))throw new Error('Choose a valid attached folder.');
  const metadata=await(await api(`files/${encodeURIComponent(folder)}?fields=id,mimeType,capabilities(canAddChildren)&supportsAllDrives=true`)).json();
  if(metadata.mimeType!=='application/vnd.google-apps.folder'||!metadata.capabilities?.canAddChildren)throw new Error('The attached folder is not writable by this Google account.');
  const mimeType=file.type||'application/octet-stream';
  const session=await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-Upload-Content-Type':mimeType,'X-Upload-Content-Length':String(file.size)},body:JSON.stringify({name:file.name,parents:[folder],mimeType})});
  if(!session.ok)throw new Error(`Could not start Drive upload (${session.status}).`);
  const location=session.headers.get('Location');
  if(!location)throw new Error('Google did not return an upload destination.');
  const target=new URL(location);
  if(target.protocol!=='https:'||target.hostname!=='www.googleapis.com'||!target.pathname.startsWith('/upload/drive/'))throw new Error('Unexpected Google upload destination. Upload stopped.');
  // Stream the browser File directly; no local persistence, app server or GitHub route.
  const result=await driveFetch(target.href,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':mimeType},body:file},300000);
  if(!result.ok)throw new Error(`Drive upload failed (${result.status}). Check the destination before retrying.`);
  return result.json();
}

export function getCurrentUser(){return hasDriveAccess()?currentUser:null;}
export async function loadCurrentUser(){
  if(!hasDriveAccess())throw new Error('Connect Google before identifying the note author.');
  if(currentUser)return currentUser;
  const activeToken=token;
  const response=await driveFetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:`Bearer ${activeToken}`}});
  if(!response.ok)throw new Error('Could not identify the Google account. Reconnect to enable authored notes.');
  const profile=await response.json();
  if(!profile.sub||typeof profile.sub!=='string'||(!profile.name&&!profile.email))throw new Error('Google did not return an account identity.');
  if(token!==activeToken)throw new Error('Google connection changed. Reconnect before editing notes.');
  currentUser={id:profile.sub,name:profile.name||profile.email};return currentUser;
}
export async function readPersonPhoto(fileId){
  if(!hasDriveAccess())throw new Error('Connect Google to view this photo.');
  if(!/^[\w-]+$/.test(fileId))throw new Error('Invalid photo reference.');
  const response=await api(`files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`),blob=await response.blob();
  if(!['image/jpeg','image/png','image/webp','image/gif'].includes(blob.type)||blob.size>10*1024*1024)throw new Error('Photo format or size is unsupported.');return blob;
}

async function readEventLog(folder){
  const query=new URLSearchParams({q:`'${folder}' in parents and name = 'BHR_event_log.txt' and trashed = false`,fields:'files(id,name),nextPageToken',pageSize:'100',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});
  const listing=await(await api(`files?${query}`)).json();
  if(listing.files.length>1||listing.nextPageToken)throw new Error('Multiple BHR_event_log.txt files found. Resolve duplicates before syncing.');
  const file=listing.files[0];let events=[],text;
  if(file){const first=await(await api(`files/${file.id}?alt=media&supportsAllDrives=true`)).text();text=await(await api(`files/${file.id}?alt=media&supportsAllDrives=true`)).text();events=mergeEventLogs(parseEventLogText(first),parseEventLogText(text));}
  return {file,events,text};
}
async function writeEventLog(folder,file,text){
  let url,options;
  if(file){url=`https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media&supportsAllDrives=true`;options={method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'text/plain; charset=UTF-8'},body:text};}
  else{const boundary='eventlog_'+crypto.randomUUID();url='https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true';options={method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':`multipart/related; boundary=${boundary}`},body:`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({name:'BHR_event_log.txt',parents:[folder],mimeType:'text/plain'})}\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${text}\r\n--${boundary}--`};}
  const response=await driveFetch(url,options);if(!response.ok)throw new Error('Event log upload failed.');
}

// Managed desktop documents and native folders live directly in Drive, not in
// directory JSON or browser storage. appProperties keeps unrelated files hidden.
const documentFields='id,name,mimeType,parents,appProperties,modifiedTime,trashed';
const safeDriveId=id=>{if(typeof id!=='string'||!/^[\w-]+$/.test(id))throw new Error('Invalid Drive file ID.');return encodeURIComponent(id);};
function requireFilesAccess(){if(!hasDriveAccess()||!getCurrentUser())throw new Error('Connect an identified Google account before using desktop notes.');}
export async function listDesktopFiles(parent='root',personId=null,allChildren=false){
  requireFilesAccess();safeDriveId(parent);
  if(personId)safeDriveId(personId);
  const match=personId?`appProperties has { key='personId' and value='${personId}' }`:`'${parent}' in parents`;
  const q=`trashed = false and ${match}${allChildren?'':" and appProperties has { key='bhrDesktop' and value='1' }"}`;
  const files=[];let pageToken;
  do{const params=new URLSearchParams({q,fields:`files(${documentFields}),nextPageToken`,pageSize:'100',...(pageToken?{pageToken}:{})});const result=await(await api('files?'+params)).json();files.push(...result.files.filter(file=>allChildren||file.appProperties?.bhrDesktop==='1'&&['note','folder'].includes(file.appProperties?.kind)));pageToken=result.nextPageToken;}while(pageToken);
  return files;
}
export async function desktopFileMetadata(id){
  requireFilesAccess();const response=await api(`files/${safeDriveId(id)}?fields=${documentFields}`),file=await response.json();
  if(file.trashed||file.appProperties?.bhrDesktop!=='1'||!['folder','note'].includes(file.appProperties?.kind))throw new Error('This is not an available BHR desktop file.');
  return {...file,etag:response.headers.get('etag')};
}
export async function readDesktopDocument(id){
  const file=await desktopFileMetadata(id);
  const content=await(await api(`files/${safeDriveId(id)}?alt=media`)).json();
  return {file,content};
}
async function checkDesktopChange(id,baseline,requireOwner=true){
  const file=await desktopFileMetadata(id);
  if(requireOwner)requireDocumentOwner(file,getCurrentUser());
  if(baseline&&file.modifiedTime!==baseline.modifiedTime)throw new Error('This item changed in Drive. Close and reopen it before trying again.');
  return file;
}
export async function saveDesktopDocument(parent,name,content,baseline=null){
  requireFilesAccess();safeDriveId(parent);validateDocument(content);
  if(content.authorId!==getCurrentUser().id)throw new Error('The clinical note author cannot be changed.');
  let previous;
  if(baseline){previous=await checkDesktopChange(baseline.id,baseline);const original=validateDocument((await readDesktopDocument(baseline.id)).content);if(original.authorId!==content.authorId||original.createdAt!==content.createdAt)throw new Error('The clinical note author and creation time cannot be changed.');}
  const metadata={name:name.trim()||'Untitled note',mimeType:'application/json',appProperties:{bhrDesktop:'1',kind:'note',authorId:content.authorId,...(previous?.appProperties?.personId?{personId:previous.appProperties.personId}:{})},...(!baseline?{parents:[parent]}:{})};
  const boundary='bhrnote_'+crypto.randomUUID(),body=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(content)}\r\n--${boundary}--`;
  const response=await driveFetch(`https://www.googleapis.com/upload/drive/v3/files${baseline?'/'+safeDriveId(baseline.id):''}?uploadType=multipart&fields=${documentFields}`,{method:baseline?'PATCH':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':`multipart/related; boundary=${boundary}`,...(previous?.etag?{'If-Match':previous.etag}:{})},body});
  if(!response.ok)throw new Error(response.status===412?'This note changed in Drive. Reopen it before editing.':'Note save failed. Your draft has been kept.');
  return response.json();
}
export async function createDesktopFolder(parent,name='New Folder'){
  requireFilesAccess();safeDriveId(parent);
  return (await api(`files?fields=${documentFields}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,mimeType:'application/vnd.google-apps.folder',parents:[parent],appProperties:{bhrDesktop:'1',kind:'folder'}})})).json();
}
export async function changeDesktopFile(baseline,change){
  requireFilesAccess();const folder=baseline.appProperties?.kind==='folder',file=await checkDesktopChange(baseline.id,baseline,!folder);
  let query='',body={};
  if(change.name!==undefined){if(!change.name.trim())throw new Error('Enter a name.');body.name=change.name.trim();}
  if(change.personId!==undefined){if(folder)throw new Error('Only notes can be attached to a chart.');safeDriveId(change.personId);body.appProperties={...file.appProperties,personId:change.personId};}
  if(change.parent!==undefined){
    safeDriveId(change.parent);
    if(change.parent!=='root'){
      let ancestor=change.parent;const seen=new Set();
      while(ancestor!=='root'){
        if(ancestor===file.id||seen.has(ancestor))throw new Error('A folder cannot be moved inside itself or its descendants.');seen.add(ancestor);
        const target=await desktopFileMetadata(ancestor);if(target.appProperties?.kind!=='folder')throw new Error('Choose a folder.');ancestor=target.parents?.[0]||'root';
        // My Drive's actual root ID is not a managed folder.
        if(!seen.has(ancestor)&&ancestor!=='root'){const root=await(await api('files/root?fields=id')).json();if(ancestor===root.id)ancestor='root';}
      }
    }
    query='&'+new URLSearchParams({addParents:change.parent,removeParents:(file.parents||[]).join(',')});
  }
  if(change.trash){if(folder&&(await listDesktopFiles(file.id,null,true)).length)throw new Error('Only empty folders can be deleted. Move or delete their contents first.');body.trashed=true;}
  return (await api(`files/${safeDriveId(file.id)}?fields=${documentFields}${query}`,{method:'PATCH',headers:{'Content-Type':'application/json',...(file.etag?{'If-Match':file.etag}:{})},body:JSON.stringify(body)})).json();
}
