// Rich notes use an explicit JSON format, never executable HTML documents.
export const DOCUMENT_KIND='bhr-rich-note';
export function validateDocument(value){
  if(!value||value.kind!==DOCUMENT_KIND||value.version!==1||typeof value.html!=='string'||value.html.length>200000||typeof value.authorId!=='string'||!value.authorId||typeof value.authorName!=='string'||!value.authorName.trim()||!validDate(value.createdAt)||!validDate(value.noteAt)||!validDate(value.updatedAt))throw new Error('Invalid BHR note. The Drive file was not changed.');
  return value;
}
const validDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
export function canManageDocument(file,user){return Boolean(user?.id&&file?.appProperties?.authorId===user.id);}
export function requireDocumentOwner(file,user){if(!canManageDocument(file,user))throw new Error('Only the user who created this clinical note can change or delete it.');}
export function cleanNoteHtml(html,{highlight=false}={}){
  const source=document.createElement('template'),result=document.createElement('div');source.innerHTML=String(html);
  const allowed=new Set(['B','STRONG','I','EM','U','P','DIV','BR','UL','OL','LI']);
  const blocked=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','TEMPLATE']);
  function copy(node,parent){
    if(node.nodeType===Node.TEXT_NODE){parent.append(document.createTextNode(node.textContent));return;}
    if(node.nodeType!==Node.ELEMENT_NODE)return;
    const tag=node.tagName.toUpperCase();if(blocked.has(tag))return;
    if(highlight&&(tag==='MARK'||(allowed.has(tag)||['SPAN','FONT'].includes(tag))&&['#ffff00','#ffffb3','rgb(255, 255, 0)','rgb(255, 255, 179)','yellow'].includes(node.style.backgroundColor.toLowerCase()))){const child=document.createElement(allowed.has(tag)?tag.toLowerCase():'span');child.style.backgroundColor='#ffffb3';parent.append(child);for(const item of node.childNodes)copy(item,child);return;}
    if(allowed.has(tag)){const child=document.createElement(tag.toLowerCase());parent.append(child);for(const item of node.childNodes)copy(item,child);}
    else for(const item of node.childNodes)copy(item,parent);
  }
  for(const child of source.content.childNodes)copy(child,result);
  return result.innerHTML;
}
