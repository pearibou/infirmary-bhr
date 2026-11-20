import {personAge} from './model.js?v=0.31.1';
import {printDocument,clearPrint} from './printing.js?v=0.31.1';

const labels={name:'Surname, First MI',aka:'AKA',dob:'DOB',age:'Age'};
const collator=new Intl.Collator(undefined,{sensitivity:'base',numeric:true});

function rosterRow(person,today){
  const birth=person.birthDate||{};
  const parts=['month','day','year'].map(key=>birth[key]?String(birth[key]).padStart(key==='year'?4:2,'0'):'');
  const middle=person.middleName?.trim();
  const given=[person.firstName,middle?Array.from(middle)[0]+'.':''].filter(Boolean).join(' ');
  return {
    name:[person.lastName,given].filter(Boolean).join(', ')||person.name||'',
    aka:person.preferredName||'',
    dob:parts.some(Boolean)?parts.map(part=>part||'—').join('/'):'',
    birthKey:parts[2]?parts.slice().reverse().join('-'):'',
    age:personAge(person,today)
  };
}

export function initRoster(getPeople,canOpen){
  const dialog=document.querySelector('#roster-dialog');
  const opener=document.querySelector('#roster-open');
  const head=dialog.querySelector('thead tr'),body=dialog.querySelector('tbody');
  const status=dialog.querySelector('[role=status]');
  let order=Object.keys(labels),sort='name',direction=1,dragged,printing=false;
  function rows(){
    const today=new Date();
    return getPeople().filter(person=>!person.deceased).map(person=>rosterRow(person,today)).sort((a,b)=>{
      const key=sort==='dob'?'birthKey':sort;
      const left=a[key],right=b[key];
      const missing=value=>value===null||value==='';
      if(missing(left)!==missing(right))return missing(left)?1:-1;
      const comparison=sort==='age'?(left??0)-(right??0):collator.compare(left,right);
      return direction*comparison||collator.compare(a.name,b.name)||collator.compare(a.aka,b.aka);
    });
  }
  function values(row){return order.map(key=>row[key]===null||row[key]===''?'—':row[key]);}
  function move(key,index){
    const from=order.indexOf(key);
    if(index<0||index>=order.length||from===index)return;
    order.splice(from,1);
    order.splice(index,0,key);
    render();
    head.querySelector(`[data-key="${key}"] button`).focus();
    status.textContent=labels[key]+' moved to column '+(index+1)+'.';
  }
  function render(){
    head.replaceChildren();
    for(const key of order){
      const th=document.createElement('th'),button=document.createElement('button');
      th.scope='col';
      th.dataset.key=key;
      if(sort===key)th.setAttribute('aria-sort',direction===1?'ascending':'descending');
      button.type='button';
      button.textContent=labels[key]+(sort===key?(direction===1?' ↑':' ↓'):'');
      button.title='Click to sort. Drag or press Alt + arrow to move.';
      button.draggable=true;
      button.onclick=()=>{
        direction=sort===key?-direction:1;
        sort=key;
        render();
        head.querySelector(`[data-key="${key}"] button`).focus();
      };
      button.onkeydown=event=>{
        if(!event.altKey||!['ArrowLeft','ArrowRight'].includes(event.key))return;
        event.preventDefault();
        move(key,order.indexOf(key)+(event.key==='ArrowLeft'?-1:1));
      };
      button.ondragstart=event=>{
        dragged=key;
        event.dataTransfer.effectAllowed='move';
        event.dataTransfer.setData('text/plain',key);
      };
      button.ondragend=()=>{dragged=undefined;};
      th.ondragover=event=>{if(dragged)event.preventDefault();};
      th.ondrop=event=>{
        if(!dragged)return;
        event.preventDefault();
        move(dragged,order.indexOf(key));
        dragged=undefined;
      };
      th.append(button);
      head.append(th);
    }
    const list=rows();
    body.replaceChildren();
    for(const row of list){
      const tr=body.insertRow();
      for(const value of values(row))tr.insertCell().textContent=value;
    }
    if(!list.length){
      const empty=body.insertRow().insertCell();
      empty.colSpan=order.length;
      empty.textContent='No living patients in the roster.';
    }
    dialog.querySelector('#roster-print').disabled=!list.length;
  }
  opener.onclick=()=>{
    if(!canOpen())return;
    status.textContent='';
    render();
    dialog.showModal();
  };
  dialog.querySelector('#roster-print').onclick=async()=>{
    if(!canOpen())return;
    try{
      printing=true;
      await printDocument({title:'Current Roster',sections:[{columns:order.map(key=>labels[key]),rows:rows().map(values)}]});
    }catch(error){if(dialog.open)status.textContent=error.message;}
  };
  return {
    refresh(){if(dialog.open&&canOpen())render();},
    clear(){
      if(dialog.open)dialog.close();
      if(printing)clearPrint();
      printing=false;
      body.replaceChildren();
      status.textContent='';
      order=Object.keys(labels);
      sort='name';
      direction=1;
    }
  };
}
