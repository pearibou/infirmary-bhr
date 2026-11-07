import {registerWindow,showWindow,updateWindowTitle,bringToFront} from './windows.js?v=0.8.2';
import {clearTrashSelection} from './trash.js?v=0.8.2';
import {listDesktopFiles,desktopFileMetadata,readDesktopDocument,saveDesktopDocument,createDesktopFolder,changeDesktopFile,getCurrentUser} from './drive.js?v=0.8.2';
import {cleanNoteHtml,validateDocument,canManageDocument} from './documents-model.js?v=0.8.2';
const $=selector=>document.querySelector(selector),noteDialog=$('#rich-note-dialog'),folderTemplate=$('#file-browser-template'),context=$('#file-context-menu');
let hooks,active=false,generation=0,refreshNumber=0,busy=false,editor=null,contextFile,contextView,actionFile,actionKind,dragged,dirty=false,renaming=false,refreshPending=false,editorRequest=0;
let desktopFiles=[],tooltipTimer,tooltipTarget,windowNumber=0;
const folderViews=new Map();
function hideFilename(){clearTimeout(tooltipTimer);tooltipTarget?.removeAttribute('aria-describedby');tooltipTarget=null;$('#filename-tooltip').hidden=true;$('#filename-tooltip').textContent='';}
function filenameHint(button,name){
  const show=()=>{hideFilename();tooltipTimer=setTimeout(()=>{
    const label=button.querySelector('span');if(!active||!context.hidden||!button.isConnected||!label||label.scrollWidth<=label.clientWidth)return;
    const tip=$('#filename-tooltip');tip.textContent=name;tip.hidden=false;tooltipTarget=button;button.setAttribute('aria-describedby','filename-tooltip');
    const box=button.getBoundingClientRect(),size=tip.getBoundingClientRect();
    tip.style.left=Math.max(8,Math.min(box.left+(box.width-size.width)/2,innerWidth-size.width-8))+'px';
    tip.style.top=Math.max(8,box.bottom+5+size.height<=innerHeight?box.bottom+5:box.top-size.height-5)+'px';
  },400);};
  button.addEventListener('pointerenter',show);button.addEventListener('focus',show);
  for(const event of ['pointerleave','blur','pointerdown'])button.addEventListener(event,hideFilename);
}

const folder=file=>file.appProperties?.kind==='folder';
function node(tag,text,cls){const result=document.createElement(tag);if(text!==undefined)result.textContent=text;if(cls)result.className=cls;return result;}
function status(message){$('#file-status').textContent=message;$('#file-status').hidden=!message;}
function allowed(file){return folder(file)||canManageDocument(file,getCurrentUser());}
function closeContext(){context.hidden=true;contextFile=null;contextView=null;if(refreshPending&&active)queueMicrotask(refreshFiles);}
function localDate(value=new Date()){const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,19);}
function genericName(value){return 'Note '+new Date(value).toLocaleString();}
async function operation(work){
  if(busy||!active)throw new Error('Finish the current Drive operation first.');
  const epoch=generation;busy=true;hooks.busy(true);status('Working in Google Drive…');
  try{const result=await work(epoch);if(epoch!==generation)return;status('');return result;}
  catch(error){if(epoch===generation)status(error.message);throw error;}
  finally{busy=false;hooks.busy(false);}
}
function record(action,file,personId){hooks.activity('document.'+action,folder(file)?'folder':'document',file.id,'Desktop '+(folder(file)?'folder':'clinical note')+' '+action,personId);}
export function initDocuments(options){
  hooks=options;document.addEventListener('keydown',event=>{if(event.key==='Escape')hideFilename();});window.addEventListener('resize',hideFilename);document.addEventListener('scroll',hideFilename,true);document.addEventListener('pointerdown',hideFilename,true);
  $('#new-rich-note').onclick=()=>{options.closeDesktopMenu();openEditor(null,'root');};
  $('#new-drive-folder').onclick=()=>{options.closeDesktopMenu();newFolder('root');};
  $('#rich-note-form').onsubmit=event=>{event.preventDefault();saveEditor();};
  for(const button of document.querySelectorAll('[data-format]')){
    button.addEventListener('mousedown',event=>event.preventDefault());
    button.onclick=()=>{if($('#rich-note-body').contentEditable!=='true')return;$('#rich-note-body').focus();document.execCommand(button.dataset.format,false,null);dirty=true;};
  }
  $('#rich-note-body').addEventListener('paste',event=>{event.preventDefault();document.execCommand('insertText',false,event.clipboardData.getData('text/plain'));});
  $('#rich-note-body').addEventListener('drop',event=>event.preventDefault());
  for(const id of ['rich-note-name','rich-note-time','rich-note-body'])$('#'+id).addEventListener('input',()=>dirty=true);
  // Closing/minimizing keeps an unsaved draft in memory until explicit discard or logout.
  noteDialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  $('#file-action-dialog').addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  $('#file-action-form').onsubmit=event=>{event.preventDefault();performAction();};
  for(const button of context.querySelectorAll('[data-file-action]'))button.onclick=()=>{const file=contextFile,view=contextView,action=button.dataset.fileAction;closeContext();if(file)handleAction(file,action,view);};
  document.addEventListener('pointerdown',event=>{if(!context.contains(event.target))closeContext();});
  context.addEventListener('keydown',event=>{
    if(event.key==='Escape'){closeContext();return;}
    const items=[...context.querySelectorAll('button:not(:disabled):not([hidden])')],index=items.indexOf(document.activeElement);
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();items[(index+(event.key==='ArrowDown'?1:items.length-1))%items.length]?.focus();}
  });
  $('#desktop-trash').addEventListener('dragover',event=>{if(dragged){event.preventDefault();event.dataTransfer.dropEffect='move';}});
  $('#desktop-trash').addEventListener('drop',event=>{if(!dragged)return;event.preventDefault();const file=dragged;endDrag();handleAction(file,'trash');});
  $('.desktop').addEventListener('dragover',event=>{if(dragged&&!event.target.closest('.desktop-icon,dialog,.window'))event.preventDefault();});
  $('.desktop').addEventListener('drop',event=>{if(!dragged||event.target.closest('.desktop-icon,dialog,.window'))return;event.preventDefault();const file=dragged;endDrag();moveFile(file,'root');});
  window.addEventListener('beforeunload',event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}});
}
export function documentsSession(ready){
  if(ready){if(!active){active=true;generation++;refreshFiles();}return;}
  if(!active&&!editor&&!desktopFiles.length)return;
  hideFilename();active=false;renaming=false;refreshPending=false;generation++;refreshNumber++;dirty=false;editor=null;desktopFiles=[];contextFile=null;contextView=null;actionFile=null;for(const view of [...folderViews.values()])closeFolder(view);endDrag();closeContext();status('');
  document.querySelectorAll('.drive-file').forEach(item=>item.remove());
  $('#rich-note-form').reset();$('#rich-note-body').replaceChildren();$('#rich-note-author').textContent='';$('#rich-note-error').textContent='';$('#file-action-form').reset();$('#file-patient').replaceChildren();$('#file-action-description').textContent='';$('#file-action-error').textContent='';
  for(const dialog of [noteDialog,$('#file-action-dialog')]){if(dialog.open)dialog.close();document.querySelector(`#window-dock [data-window="${dialog.id}"]`)?.remove();}
}
function closeFolder(view){
  folderViews.delete(view.parent);view.request++;document.querySelector(`#window-dock [data-window="${view.element.id}"]`)?.remove();
  if(view.element.open)view.element.close();view.element.remove();view.element.replaceChildren();view.files=[];view.stack=[];view.file={name:''};view.parent='';
}
async function openFolder(file,ancestors=[]){
  let view=folderViews.get(file.id);
  if(!view){
    const element=folderTemplate.content.firstElementChild.cloneNode(true),offset=(folderViews.size%7)*24;
    element.id='folder-window-'+(++windowNumber);element.dataset.folderId=file.id;
    Object.assign(element.style,{position:'fixed',left:Math.min(Math.max(12,innerWidth*.12+offset),Math.max(12,innerWidth-660))+'px',top:Math.min($('.menubar').getBoundingClientRect().bottom+36+offset,Math.max($('.menubar').getBoundingClientRect().bottom,innerHeight-220))+'px'});
    view={element,parent:file.id,file,stack:file.id==='root'?[]:[...ancestors.filter(item=>item.id!==file.id),file],files:[],request:0,error:''};
    view.get=name=>element.querySelector(`[data-field="${name}"]`);
    folderViews.set(file.id,view);document.body.append(element);
    registerWindow(element,{title:()=>view.file.name,icon:'folder'});
    view.get('folder-new-note').onclick=()=>openEditor(null,view.parent);
    view.get('folder-new-folder').onclick=()=>newFolder(view.parent,view);
    view.get('file-refresh').onclick=refreshFiles;
    view.get('file-up').onclick=async()=>{
      if(view.parent==='root')return;
      const parentId=view.file.parents?.[0];
      if(!parentId||parentId==='root'||desktopFiles.some(item=>item.id===view.parent)){openFolder({id:'root',name:'My Drive · BHR notes',appProperties:{kind:'folder'}});return;}
      const epoch=generation;
      try{const ancestor=await desktopFileMetadata(parentId);if(epoch===generation)openFolder(ancestor,view.stack.slice(0,-2));}catch(error){if(epoch===generation)status(error.message);}
    };
    view.get('close').dataset.close=element.id;view.get('close').onclick=()=>closeFolder(view);
    element.addEventListener('dragover',event=>{if(dragged){event.preventDefault();event.dataTransfer.dropEffect='move';}});
    element.addEventListener('drop',event=>{if(!dragged)return;event.preventDefault();event.stopPropagation();const moving=dragged;endDrag();moveFile(moving,view.parent);});
    element.addEventListener('contextmenu',event=>{if(event.target.closest('.drive-file'))return;event.preventDefault();if(active)showFolderMenu(event,view);});
    renderFolder(view);
  }
  showWindow(view.element);await refreshFiles();
}
export async function refreshFiles(){
  if(!active)return;
  if(busy||renaming||dragged||!context.hidden){refreshPending=true;return;}
  refreshPending=false;const epoch=generation,request=++refreshNumber,views=[...folderViews.values()];
  try{
    const [root,...results]=await Promise.all([listDesktopFiles(),...views.map(async view=>{
      try{const [files,file]=await Promise.all([listDesktopFiles(view.parent),view.parent==='root'?Promise.resolve(view.file):desktopFileMetadata(view.parent)]);return {view,files,file};}
      catch(error){return {view,error:error.message};}
    })]);
    if(epoch!==generation||request!==refreshNumber)return;
    if(renaming||dragged||!context.hidden){refreshPending=true;return;}
    desktopFiles=root;
    for(const result of results){if(folderViews.get(result.view.parent)!==result.view)continue;const view=result.view;
      if(result.error)view.error='Could not load folder: '+result.error;
      else{view.files=result.files;view.file=result.file;view.error='';}
    }
    const names=new Map([...root,...[...folderViews.values()].flatMap(view=>[view.file,...view.files])].map(file=>[file.id,file]));
    for(const view of folderViews.values())view.stack=view.stack.map(file=>names.get(file.id)||file);
    renderFiles();status('');
  }catch(error){if(epoch===generation&&request===refreshNumber)status('Could not load Drive notes and folders. '+error.message);}
}
function renderFolder(view){
  view.get('folder-files').replaceChildren(...sort(view.files).map(file=>fileIcon(file,view)));
  view.get('file-folder-title').textContent=view.file.name;view.element.setAttribute('aria-label',view.file.name);
  view.get('file-path').textContent=['My Drive',...view.stack.map(item=>item.id===view.parent?view.file.name:item.name)].join(' / ');
  view.get('folder-empty').textContent=view.error||(view.files.length?'':'This folder is empty.');
  view.get('file-up').disabled=view.parent==='root';updateWindowTitle(view.element);
}
function renderFiles(){
  hideFilename();document.querySelectorAll('#desktop-icons > .drive-file').forEach(item=>item.remove());
  for(const file of sort(desktopFiles))$('#desktop-icons').append(fileIcon(file));
  for(const view of folderViews.values())renderFolder(view);
}
const sort=files=>[...files].sort((a,b)=>Number(folder(b))-Number(folder(a))||a.name.localeCompare(b.name));
function fileIcon(file,view=null){
  const button=node('button',undefined,'desktop-icon drive-file');button.type='button';button.dataset.fileId=file.id;button.setAttribute('aria-label',file.name);button.setAttribute('aria-description',folder(file)?'Folder':allowed(file)?'Your clinical note':'Read-only · another author');filenameHint(button,file.name);
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 48 48');svg.setAttribute('aria-hidden','true');
  svg.innerHTML=folder(file)?'<path d="M4 12h17l5 5h18v25H4z" fill="#ddd" stroke="#111" stroke-width="2"/><path d="M4 19h40" stroke="#111"/>':'<path d="M10 3h20l9 9v33H10z" fill="#fff" stroke="#111" stroke-width="2"/><path d="M30 3v10h9M16 20h17m-17 6h17m-17 6h17m-17 6h12" fill="none" stroke="#555" stroke-width="2"/>';
  button.append(svg,node('span',file.name));
  button.addEventListener('pointerdown',clearTrashSelection);button.addEventListener('focus',clearTrashSelection);
  button.ondblclick=()=>handleAction(file,'open',view);
  button.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();handleAction(file,'open',view);}if(event.key==='Delete'){event.preventDefault();handleAction(file,'trash',view);}if(event.key==='F2'){event.preventDefault();handleAction(file,'rename',view);}});
  button.oncontextmenu=event=>{event.preventDefault();event.stopPropagation();contextFile=file;contextView=view;
    for(const action of context.querySelectorAll('button')){action.hidden=folder(file)&&action.dataset.fileAction==='attach';action.disabled=action.dataset.fileAction!=='open'&&!allowed(file);}
    context.querySelector('[data-file-action="rename"]').textContent=folder(file)?'Rename folder':'Rename note';
    context.hidden=false;context.style.left=Math.max(0,Math.min(event.clientX,innerWidth-context.offsetWidth-8))+'px';context.style.top=Math.max($('.menubar').getBoundingClientRect().bottom,Math.min(event.clientY,innerHeight-context.offsetHeight-8))+'px';context.querySelector('button').focus();
  };
  button.draggable=allowed(file);
  button.addEventListener('dragstart',event=>{if(!allowed(file)||event.target.closest('input')){event.preventDefault();return;}dragged=file;document.body.classList.add('dragging-entry');event.dataTransfer.setData('application/x-bhr-drive-file',file.id);event.dataTransfer.effectAllowed='move';});
  button.addEventListener('dragend',endDrag);
  if(folder(file)){
    button.addEventListener('dragover',event=>{if(dragged&&dragged.id!==file.id){event.preventDefault();button.classList.add('drop-ready');}});
    button.addEventListener('dragleave',()=>button.classList.remove('drop-ready'));
    button.addEventListener('drop',event=>{if(!dragged)return;event.preventDefault();event.stopPropagation();const moving=dragged;endDrag();moveFile(moving,file.id);});
  }
  return button;
}
function endDrag(){dragged=null;if(refreshPending&&active)queueMicrotask(refreshFiles);document.body.classList.remove('dragging-entry');document.querySelectorAll('.drop-ready').forEach(item=>item.classList.remove('drop-ready'));}
async function handleAction(file,action,view=null){
  if(!active)return;
  if(action==='open'){if(folder(file))await openFolder(file,view?.stack||[]);else await openEditor(file);return;}
  if(!allowed(file)){status('Only the creator can change or delete this clinical note.');return;}
  if(action==='rename'){renameInline(file,view);return;}
  actionFile=file;actionKind=action;$('#file-action-error').textContent='';$('#file-action-title').textContent=action==='attach'?'Attach note to patient’s chart':'Send to Trash (delete)';
  $('#file-action-description').textContent=action==='attach'?'The note stays in its Drive folder and also appears on the selected person’s chart.':'Send “'+file.name+'” to Google Drive Trash? It will disappear from BHR. Only empty folders may be deleted. Recovery is available in Drive Trash.';
  $('#file-patient-label').hidden=action!=='attach';$('#file-patient').disabled=action!=='attach';$('#file-patient').replaceChildren();
  if(action==='attach'){
    const empty=node('option','Choose a person…');empty.value='';$('#file-patient').append(empty);
    let deceasedGroup=false;
    for(const person of hooks.people()){
      if(person.deceased&&!deceasedGroup){deceasedGroup=true;
        if($('#file-patient').options.length>1){const divider=node('option','────────────────');divider.value='';divider.disabled=true;divider.className='person-divider';divider.setAttribute('aria-label','Deceased people below');$('#file-patient').append(divider);}
      }
      const item=node('option',person.name+(person.deceased?' (Deceased)':''));item.value=person.id;$('#file-patient').append(item);
    }
  }
  if(!$('#file-action-dialog').open)$('#file-action-dialog').showModal();
}
async function performAction(){
  const file=actionFile,action=actionKind,personId=$('#file-patient').value;
  if(!file||busy)return;
  $('#file-action-dialog').querySelectorAll('button').forEach(button=>button.disabled=true);
  try{
    await operation(async epoch=>{const changed=await changeDesktopFile(file,action==='attach'?{personId}:{trash:true});if(epoch!==generation)return;if(action==='trash'&&folder(file)){const open=folderViews.get(file.id);if(open)closeFolder(open);}record(action==='attach'?'attached':'trashed',changed,action==='attach'?personId:undefined);$('#file-action-dialog').close();});
    await refreshFiles();hooks.chartChanged();
  }catch(error){if(active)$('#file-action-error').textContent=error.message;}
  finally{$('#file-action-dialog').querySelectorAll('button').forEach(button=>button.disabled=false);}
}
async function newFolder(target,view=null){
  try{let created;await operation(async epoch=>{created=await createDesktopFolder(target);if(epoch!==generation)return;record('created',created);});await refreshFiles();if(created&&active)renameInline(created,view);}
  catch{} // operation exposes a retryable error in the status region.
}
function renameInline(file,view=null){
  const icons=[...document.querySelectorAll('.drive-file')].filter(item=>item.dataset.fileId===file.id),icon=(view?.element.open?icons.find(item=>view.element.contains(item)):null)||icons[0];if(!icon||!allowed(file))return;
  renaming=true;const input=node('input');input.value=file.name;input.maxLength=180;input.setAttribute('aria-label',folder(file)?'Folder name':'Note name');icon.querySelector('span').replaceWith(input);input.focus();input.select();
  let finished=false;
  const finish=async cancel=>{if(finished)return;finished=true;renaming=false;if(cancel||!input.value.trim()||input.value.trim()===file.name){renderFiles();if(refreshPending)refreshFiles();return;}
    try{await operation(async epoch=>{const changed=await changeDesktopFile(file,{name:input.value});if(epoch!==generation)return;record('renamed',changed);});await refreshFiles();hooks.chartChanged();}catch{if(active)renderFiles();}
  };
  input.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Enter'){event.preventDefault();finish(false);}if(event.key==='Escape'){event.preventDefault();finish(true);}});
  input.addEventListener('blur',()=>finish(false));
}
async function moveFile(file,target){
  if(!allowed(file)||file.parents?.includes(target)||target==='root'&&desktopFiles.some(item=>item.id===file.id))return;
  try{await operation(async epoch=>{const changed=await changeDesktopFile(file,{parent:target});if(epoch!==generation)return;record('moved',changed);});await refreshFiles();}catch{}
}
function showFolderMenu(event,view){
  // Reuse desktop commands, targeting this folder rather than the Drive root.
  const menu=$('#desktop-context-menu');$('#new-desktop-note').hidden=true;menu.hidden=false;menu.style.left=Math.min(event.clientX,innerWidth-188)+'px';menu.style.top=Math.max($('.menubar').getBoundingClientRect().bottom,Math.min(event.clientY,innerHeight-menu.offsetHeight-8))+'px';
  $('#new-rich-note').onclick=()=>{hooks.closeDesktopMenu();openEditor(null,view.parent);};$('#new-drive-folder').onclick=()=>{hooks.closeDesktopMenu();newFolder(view.parent,view);};menu.querySelector('button:not([hidden])')?.focus();
  // Restore root targeting as soon as the desktop receives a context-menu event.
}
document.querySelector('.desktop').addEventListener('contextmenu',()=>{
  if(!hooks)return;$('#new-desktop-note').hidden=false;$('#new-rich-note').onclick=()=>{hooks.closeDesktopMenu();openEditor(null,'root');};$('#new-drive-folder').onclick=()=>{hooks.closeDesktopMenu();newFolder('root');};
});
async function openEditor(file=null,target='root'){
  if(!active)return;
  if(dirty&&editor){if(editor.file?.id===file?.id){if(!noteDialog.open)noteDialog.showModal();return;}if(!confirm('Discard the unsaved clinical note draft?'))return;}
  const epoch=generation,request=++editorRequest;
  try{
    let document,fileMetadata=file;
    if(file){const loaded=await readDesktopDocument(file.id);fileMetadata=loaded.file;document=validateDocument(loaded.content);if(document.authorId!==fileMetadata.appProperties.authorId)throw new Error('Note author metadata does not match. The note was not opened.');}
    else {const user=getCurrentUser();if(!user)throw new Error('Reconnect to identify the clinical note author.');const now=new Date().toISOString();document={kind:'bhr-rich-note',version:1,html:'',noteAt:now,createdAt:now,updatedAt:now,authorId:user.id,authorName:user.name};}
    if(epoch!==generation||request!==editorRequest)return;
    editor={file:fileMetadata,document,target};dirty=false;const editable=!file||canManageDocument(fileMetadata,getCurrentUser());
    $('#rich-note-name').value=fileMetadata?.name||genericName(document.noteAt);$('#rich-note-time').value=localDate(document.noteAt);$('#rich-note-body').innerHTML=cleanNoteHtml(document.html);$('#rich-note-author').textContent='Entered by '+document.authorName+(editable?'':' · Read-only: only the creator can edit or delete');
    $('#rich-note-name').disabled=!editable;$('#rich-note-time').disabled=!editable;$('#rich-note-body').contentEditable=String(editable);$('#rich-note-save').hidden=!editable;documentButtons(!editable);$('#rich-note-error').textContent='';
    window.document.querySelector('#window-dock [data-window="rich-note-dialog"]')?.remove();
    if(!noteDialog.open)noteDialog.showModal();$('#rich-note-body').focus();
  }catch(error){if(epoch===generation)status(error.message);}
}
function documentButtons(disabled){for(const button of window.document.querySelectorAll('[data-format]'))button.disabled=disabled;}
async function saveEditor(){
  if(!editor||busy)return;
  const time=$('#rich-note-time').value,date=new Date(time);
  if(!time||!Number.isFinite(date.getTime())){$('#rich-note-error').textContent='Enter a valid date and time.';return;}
  const html=cleanNoteHtml($('#rich-note-body').innerHTML);if(html.length>200000){$('#rich-note-error').textContent='This note is too long. Use fewer than 200,000 characters of formatted content.';return;}
  const entry=editor,name=$('#rich-note-name').value.trim()||genericName(date),content={...entry.document,html,noteAt:date.toISOString(),updatedAt:new Date().toISOString()};
  setEditorBusy(true);$('#rich-note-error').textContent='Saving directly to Google Drive…';
  try{
    await operation(async epoch=>{const saved=await saveDesktopDocument(entry.target,name,content,entry.file);if(epoch!==generation)return;record(entry.file?'updated':'created',saved);dirty=false;editor={file:saved,document:content,target:entry.target};noteDialog.close();});
    await refreshFiles();hooks.chartChanged();
  }catch(error){if(active)$('#rich-note-error').textContent=error.message;}
  finally{setEditorBusy(false);}
}
function setEditorBusy(value){
  const editable=Boolean(editor&&(!editor.file||canManageDocument(editor.file,getCurrentUser())));
  noteDialog.querySelectorAll('button').forEach(button=>button.disabled=value);
  $('#rich-note-name').disabled=value||!editable;$('#rich-note-time').disabled=value||!editable;$('#rich-note-body').contentEditable=String(!value&&editable);documentButtons(value||!editable);
}
export function chartDocuments(container,personId){
  const heading=node('div',undefined,'notes-heading'),title=node('h3','Clinical documents'),refresh=node('button','↻ Refresh');refresh.type='button';heading.append(title,refresh);container.append(heading);
  const items=node('div',undefined,'chart-documents');container.append(items);
  const load=async()=>{if(!active)return;const epoch=generation;items.textContent='Loading clinical documents…';
    try{const files=await listDesktopFiles('root',personId);if(epoch!==generation||!items.isConnected)return;items.replaceChildren();if(!files.length)items.textContent='No clinical documents attached.';
      for(const file of sort(files)){if(folder(file))continue;const open=node('button',file.name);open.type='button';open.onclick=()=>openEditor(file);items.append(open);}
    }catch(error){if(epoch===generation&&items.isConnected)items.textContent='Could not load clinical documents. '+error.message;}
  };refresh.onclick=load;load();
}
