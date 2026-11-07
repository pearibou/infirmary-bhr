// Device-only appearance preference. No chart data belongs in this module.
const KEY='infirmary.backgroundColor',DEFAULT='#8ca9c4';
const $=s=>document.querySelector(s),valid=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
function saved(){try{const color=localStorage.getItem(KEY);return valid(color)?color:DEFAULT;}catch{return DEFAULT;}}
function apply(color){if(!valid(color))return;const channels=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));for(const [name,delta] of [['a',-5],['b',5]])document.documentElement.style.setProperty('--desktop-color-'+name,'#'+channels.map(c=>Math.min(255,Math.max(0,c+delta)).toString(16).padStart(2,'0')).join(''));}
export function initBackground(){
 apply(saved());const dialog=$('#background-dialog'),input=$('#background-color');
 $('#change-background').onclick=()=>{if(document.body.classList.contains('drive-locked'))return;$('#desktop-context-menu').hidden=true;input.value=saved();$('#background-error').textContent='';dialog.showModal();};
 input.oninput=()=>apply(input.value);
 for(const button of dialog.querySelectorAll('[data-background]'))button.onclick=()=>{input.value=button.dataset.background;apply(input.value);};
 $('#background-form').onsubmit=event=>{event.preventDefault();if(!valid(input.value))return;try{localStorage.setItem(KEY,input.value);apply(input.value);dialog.close();}catch{$('#background-error').textContent='The color could not be saved on this device. You can cancel to restore the previous color.';}};
 dialog.addEventListener('close',()=>apply(saved()));dialog.addEventListener('cancel',()=>apply(saved()));
 window.addEventListener('storage',event=>{if(event.key===KEY&&!dialog.open)apply(saved());});
}
