// Only entries dragged from this app can trigger a trash drop. Never read dropped files.
const trash=document.querySelector('#desktop-trash');
let selected,dragged;
function select(target,node){selected=target;document.querySelectorAll('.trash-selected').forEach(el=>el.classList.remove('trash-selected'));node?.classList.add('trash-selected');}
function request(target){if(target)document.dispatchEvent(new CustomEvent('trash-request',{detail:target}));}
export function makeTrashable(node,target){
  node.draggable=true;node.title=(node.title?node.title+'. ':'')+'Drag to Trash or press Delete to remove';
  node.addEventListener('click',event=>{if(event.target.closest('button,a,input,textarea,summary')&&event.target.closest('button')!==node)return;select(target,node);});
  node.addEventListener('focus',()=>select(target,node));
  node.addEventListener('keydown',event=>{if(event.target!==node)return;if(event.key==='Delete'){event.preventDefault();request(target);}});
  node.addEventListener('dragstart',event=>{
    if(event.target.closest('button,a')&&event.target.closest('button,a')!==node){event.preventDefault();return;}
    dragged=target;select(target,node);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-infirmary-entry','entry');document.body.classList.add('dragging-entry');
  });
  node.addEventListener('dragend',endDrag);
}
function endDrag(){dragged=undefined;trash.classList.remove('drop-ready');document.body.classList.remove('dragging-entry');}
trash.addEventListener('dragover',event=>{if(!dragged)return;event.preventDefault();event.dataTransfer.dropEffect='move';trash.classList.add('drop-ready');});
trash.addEventListener('dragleave',()=>trash.classList.remove('drop-ready'));
trash.addEventListener('drop',event=>{if(!dragged)return;event.preventDefault();event.stopPropagation();const target=dragged;endDrag();request(target);});
trash.onclick=()=>request(selected);
export function clearTrashSelection(){selected=undefined;document.querySelectorAll('.trash-selected').forEach(el=>el.classList.remove('trash-selected'));}

export function draggedEntry(){return dragged;}

export function finishEntryDrag(){endDrag();}
