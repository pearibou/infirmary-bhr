import {prepareCatalog,searchCatalog} from './history-model.js?v=fy2027';
export function prepareTabular(data,reporting){
 if(data?.edition!==reporting.edition||data.reportableCount!==reporting.entries.length||!Array.isArray(data.nodes))throw new Error('The tabular edition does not match the reporting catalog.');
 const nodes=new Map(),children=new Map(),reports=new Map(reporting.entries);
 for(const [id,parent,code,title,notes] of data.nodes){if(nodes.has(id)||typeof title!=='string'||!Array.isArray(notes))throw new Error('Invalid tabular entry.');const node={id,parent,code,title,notes,reportable:reports.has(code)};nodes.set(id,node);if(!children.has(parent))children.set(parent,[]);children.get(parent).push(node);}
 for(const node of nodes.values()){if(node.parent&&!nodes.has(node.parent))throw new Error('Missing tabular parent.');const seen=new Set([node.id]);let parent=node.parent;while(parent){if(seen.has(parent))throw new Error('Invalid tabular ancestry.');seen.add(parent);parent=nodes.get(parent)?.parent;}}
 for(const [code,title] of reports)if(nodes.get(code)?.title!==title)throw new Error('A reporting code does not match its tabular entry.');
 const catalog=prepareCatalog({...reporting,entries:[...nodes.values()].filter(n=>n.code).map(n=>[n.code,n.title])});
 return {...data,nodes,children,catalog};
}
export function ancestry(model,id){const result=[];let node=model.nodes.get(id);while(node){result.unshift(node);node=model.nodes.get(node.parent);}return result;}
export function lookup(model,query){return searchCatalog(model.catalog,query,60).map(row=>({...model.nodes.get(row.code),matchKind:row.matchKind}));}
export const noteLabels={notes:'Note',visualImpairment:'Visual acuity with best possible correction',includes:'Includes',inclusionTerm:'Inclusion terms',excludes1:'Excludes1',excludes2:'Excludes2',codeFirst:'Code first',useAdditionalCode:'Use additional code',codeAlso:'Code also',sevenChrNote:'Seventh character instructions',sevenChrDef:'Seventh character definition'};
