import {makeTrashable,draggedEntry,finishEntryDrag} from './trash.js?v=0.7.8';
const desktop=document.querySelector('.desktop'),layer=document.querySelector('#sticky-notes'),menu=document.querySelector('#desktop-context-menu');
let createNote,moveNote,dropOffset={x:0,y:0},menuOrigin={x:24,y:24};
const top=()=>document.querySelector('.menubar').getBoundingClientRect().bottom;
function position(card,note){card.style.left=`${Math.max(0,Math.min(note.x,innerWidth-Math.min(260,innerWidth-24)))}px`;card.style.top=`${top()+Math.max(0,Math.min(note.y,innerHeight-top()-120))}px`;}
export function closeDesktopMenu(){menu.hidden=true;}
export function initDesktopNotes(create,move){
  createNote=create;moveNote=move;
  desktop.addEventListener('contextmenu',event=>{
    if(document.body.classList.contains('drive-locked')||event.target.closest('.window,.sticky-note'))return;
    event.preventDefault();menuOrigin={x:Math.max(0,event.clientX),y:Math.max(0,event.clientY-top())};menu.hidden=false;
    menu.style.left=`${Math.max(0,Math.min(event.clientX,innerWidth-180))}px`;menu.style.top=`${Math.max(top(),Math.min(event.clientY,innerHeight-50))}px`;menu.querySelector('button').focus();
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
  layer.replaceChildren();
  for(const note of notes){
    const card=document.createElement('article');card.className='sticky-note';card.tabIndex=0;card.setAttribute('aria-label','Shared desktop note');card.dataset.x=note.x;card.dataset.y=note.y;
    const header=document.createElement('div');header.className='sticky-title';header.textContent='Note';
    const text=document.createElement('p');text.textContent=note.text;
    const author=document.createElement('small');author.textContent=note.authorName+' · '+new Date(note.createdAt).toLocaleString();
    card.append(header,text,author);position(card,note);makeTrashable(card,{desktopNoteId:note.id});
    card.addEventListener('dragstart',event=>{const rect=card.getBoundingClientRect();dropOffset={x:event.clientX-rect.left,y:event.clientY-rect.top};});
    card.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();moveNote(note.id,{x:Math.max(0,note.x+(event.key==='ArrowRight'?10:event.key==='ArrowLeft'?-10:0)),y:Math.max(0,note.y+(event.key==='ArrowDown'?10:event.key==='ArrowUp'?-10:0))});});
    layer.append(card);
  }
}
