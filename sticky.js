import {registerDesktopItem} from './desktop-selection.js?v=0.28.0';
import {smallIcon} from './icons-ui.js?v=0.28.0';
import {validateStickyDrawing,paintSticky} from './sticky-drawing.js?v=0.28.0';
import {makeTrashable,draggedEntry,finishEntryDrag} from './trash.js?v=0.28.0';
const desktop=document.querySelector('.desktop'),layer=document.querySelector('#sticky-notes'),menu=document.querySelector('#desktop-context-menu');
let createNote,moveNote,editNote,dropOffset={x:0,y:0},menuOrigin={x:24,y:24};
const top=()=>document.querySelector('.menubar').getBoundingClientRect().bottom;
function position(card,note){card.style.left=`${Math.max(0,Math.min(note.x,innerWidth-Math.min(260,innerWidth-24)))}px`;card.style.top=`${top()+Math.max(0,Math.min(note.y,innerHeight-top()-120))}px`;}
export function closeDesktopMenu(){menu.hidden=true;}
export function initDesktopNotes(create,move,edit){
  createNote=create;moveNote=move;editNote=edit;initStickyEditor();initStickyMenu();
  desktop.addEventListener('contextmenu',event=>{
    if(document.body.classList.contains('drive-locked')||event.target.closest('.window,.sticky-note,.desktop-icon,dialog,#file-context-menu'))return;
    event.preventDefault();document.querySelector('#new-desktop-note').hidden=false;document.querySelector('#change-background').hidden=false;menuOrigin={x:Math.max(0,event.clientX),y:Math.max(0,event.clientY-top())};menu.hidden=false;
    menu.style.left=`${Math.max(0,Math.min(event.clientX,innerWidth-menu.offsetWidth-8))}px`;menu.style.top=`${Math.max(top(),Math.min(event.clientY,innerHeight-menu.offsetHeight-8))}px`;menu.querySelector('button').focus();
  });
  document.querySelector('#new-desktop-note').onclick=()=>{closeDesktopMenu();createNote(menuOrigin);};
  document.addEventListener('pointerdown',event=>{if(!menu.contains(event.target))closeDesktopMenu();});
  menu.addEventListener('keydown',event=>{if(event.key==='Escape'){closeDesktopMenu();desktop.focus();}});
  desktop.addEventListener('dragover',event=>{if(draggedEntry()?.desktopNoteId){event.preventDefault();event.dataTransfer.dropEffect='move';}});
  desktop.addEventListener('drop',event=>{
    const target=draggedEntry();if(!target?.desktopNoteId||event.target.closest('#desktop-trash'))return;
    event.preventDefault();finishEntryDrag();moveNote(target.desktopNoteId,{x:Math.max(0,event.clientX-dropOffset.x),y:Math.max(0,event.clientY-top()-dropOffset.y)});
  });
  window.addEventListener('resize',()=>{closeDesktopMenu();for(const card of layer.children)position(card,{x:Number(card.dataset.x),y:Number(card.dataset.y)});});
}
export function renderDesktopNotes(notes){
  layer.replaceChildren();const dock=document.querySelector('#sticky-dock');dock.replaceChildren();const ids=new Set(notes.map(n=>n.id));for(const id of minimized)if(!ids.has(id))minimized.delete(id);
  currentNotes=notes;for(const note of notes){
    if(minimized.has(note.id)){const button=document.createElement('button');button.type='button';button.className='sticky-minimized';button.textContent=note.text.trim().split('\n')[0]||'Drawing';button.title='Restore sticky note: '+button.textContent;button.onclick=()=>{minimized.delete(note.id);renderDesktopNotes(currentNotes);};button.oncontextmenu=event=>showStickyMenu(event,note.id,true);dock.append(button);registerDesktopItem(button,{desktopNoteId:note.id,name:button.textContent});continue;}
    const card=document.createElement('article');card.className='sticky-note';card.tabIndex=0;card.setAttribute('aria-label','Shared desktop note');card.dataset.noteId=note.id;card.dataset.x=note.x;card.dataset.y=note.y;
    const header=document.createElement('div');header.className='sticky-title';header.textContent='Note';const pencil=document.createElement('button');pencil.type='button';pencil.className='sticky-edit';pencil.setAttribute('aria-label','Edit sticky note');pencil.title='Edit sticky note';pencil.append(smallIcon('pencil'));pencil.onclick=()=>editNote(note.id);header.append(pencil);
    const text=document.createElement('p');text.textContent=note.text;
    const author=document.createElement('small');author.textContent=note.authorName+' · '+new Date(note.createdAt).toLocaleString();
    card.append(header,text);if(note.drawing?.length){const drawing=document.createElement('canvas');drawing.width=520;drawing.height=240;drawing.className='sticky-card-drawing';drawing.setAttribute('aria-label','Sticky drawing');drawing.setAttribute('role','img');paintSticky(drawing,note.drawing);card.append(drawing);}if(note.editedAt)author.textContent+=' · Edited by '+(note.editedBy||'Connected staff')+' · '+new Date(note.editedAt).toLocaleString();card.append(author);card.ondblclick=event=>{if(!event.target.closest('button'))editNote(note.id);};card.oncontextmenu=event=>showStickyMenu(event,note.id,false);position(card,note);makeTrashable(card,{desktopNoteId:note.id});
    card.addEventListener('dragstart',event=>{const rect=card.getBoundingClientRect();dropOffset={x:event.clientX-rect.left,y:event.clientY-rect.top};});
    card.addEventListener('keydown',event=>{if(event.target.closest('button'))return;if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();moveNote(note.id,{x:Math.max(0,note.x+(event.key==='ArrowRight'?10:event.key==='ArrowLeft'?-10:0)),y:Math.max(0,note.y+(event.key==='ArrowDown'?10:event.key==='ArrowUp'?-10:0))});});
    layer.append(card);registerDesktopItem(card,{desktopNoteId:note.id,name:note.text.trim().split('\n')[0]||'Sticky drawing'});
  }
}

let currentNotes=[],minimized=new Set(),contextId=null,strokes=[],stroke=null,drawing=false;
function hideStickyMenu(){document.querySelector('#sticky-context-menu').hidden=true;contextId=null;}
function showStickyMenu(event,id,isMinimized){event.preventDefault();event.stopPropagation();closeDesktopMenu();const menu=document.querySelector('#sticky-context-menu');contextId=id;menu.hidden=false;document.querySelector('#sticky-menu-minimize').textContent=isMinimized?'Restore note':'Minimize note';menu.style.left=Math.max(4,Math.min(event.clientX,innerWidth-menu.offsetWidth-8))+'px';menu.style.top=Math.max(top(),Math.min(event.clientY,innerHeight-menu.offsetHeight-8))+'px';menu.querySelector('button').focus();}
function initStickyMenu(){
 const menu=document.querySelector('#sticky-context-menu');document.querySelector('#sticky-menu-edit').onclick=()=>{const id=contextId;hideStickyMenu();if(id)editNote(id);};document.querySelector('#sticky-menu-minimize').onclick=()=>{const id=contextId;hideStickyMenu();if(!id)return;if(minimized.has(id))minimized.delete(id);else minimized.add(id);renderDesktopNotes(currentNotes);};document.querySelector('#sticky-menu-trash').onclick=()=>{const id=contextId;hideStickyMenu();if(id)document.dispatchEvent(new CustomEvent('trash-request',{detail:{desktopNoteId:id}}));};
 document.addEventListener('pointerdown',event=>{if(!menu.contains(event.target))hideStickyMenu();});window.addEventListener('resize',hideStickyMenu);menu.onkeydown=event=>{if(event.key==='Escape'){hideStickyMenu();desktop.focus();}if(['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const buttons=[...menu.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);buttons[(index+(event.key==='ArrowDown'?1:buttons.length-1))%buttons.length].focus();}};
}
function setDrawing(enabled){drawing=enabled;document.querySelector('#sticky-draw-toggle').setAttribute('aria-pressed',String(enabled));document.querySelector('#sticky-palette').hidden=!enabled;document.querySelector('#sticky-canvas').classList.toggle('drawing-enabled',enabled);document.querySelector('#sticky-drawing-area').hidden=!enabled&&!strokes.length;}
export function prepareStickyEditor(note=null){strokes=structuredClone(note?.drawing||[]);stroke=null;setDrawing(false);paintSticky(document.querySelector('#sticky-canvas'),strokes);document.querySelector('#sticky-text').value=note?.text||'';document.querySelector('#sticky-editor-title').textContent=note?'Edit Sticky Note':'New Sticky Note';document.querySelector('#sticky-submit').textContent=note?'Save note':'Leave note';}
export function stickyDrawing(){if(stroke){stroke=null;}return structuredClone(validateStickyDrawing(strokes));}
export function clearStickyState(){minimized.clear();currentNotes=[];hideStickyMenu();prepareStickyEditor();document.querySelector('#sticky-dock').replaceChildren();}
function initStickyEditor(){
 const canvas=document.querySelector('#sticky-canvas'),toggle=document.querySelector('#sticky-draw-toggle');toggle.append(smallIcon('pencil'));toggle.onclick=()=>setDrawing(!drawing);
 document.querySelector('#sticky-undo').onclick=()=>{strokes.pop();paintSticky(canvas,strokes);};document.querySelector('#sticky-clear-drawing').onclick=()=>{strokes=[];paintSticky(canvas,strokes);};
 const point=event=>{const r=canvas.getBoundingClientRect();return [Math.max(0,Math.min(1,(event.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(event.clientY-r.top)/r.height))];};
 canvas.onpointerdown=event=>{if(!drawing||event.button!==0)return;event.preventDefault();const next={color:document.querySelector('#sticky-ink').value,size:Number(document.querySelector('#sticky-brush').value),points:[point(event)]};try{validateStickyDrawing([...strokes,next]);}catch(error){document.querySelector('#sticky-error').textContent=error.message;return;}stroke=next;strokes.push(stroke);canvas.setPointerCapture(event.pointerId);paintSticky(canvas,strokes);};
 canvas.onpointermove=event=>{if(!drawing||!stroke||!canvas.hasPointerCapture(event.pointerId))return;event.preventDefault();stroke.points.push(point(event));try{validateStickyDrawing(strokes);}catch(error){stroke.points.pop();document.querySelector('#sticky-error').textContent=error.message;stroke=null;}paintSticky(canvas,strokes);};
 const end=()=>{stroke=null;};canvas.onpointerup=end;canvas.onpointercancel=end;canvas.onlostpointercapture=end;
 document.querySelector('#sticky-dialog').addEventListener('close',()=>{prepareStickyEditor();});
}
