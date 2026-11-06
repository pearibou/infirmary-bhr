// Photos are transient browser objects. Only Drive file references enter directory JSON.
export async function validatePhoto(file){
  if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type))throw new Error('Choose a JPEG, PNG, WebP, or GIF photo.');
  if(file.size>10*1024*1024)throw new Error('Choose a photo smaller than 10 MB.');
  const url=URL.createObjectURL(file);
  try{await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>image.naturalWidth?resolve():reject(new Error('This image cannot be displayed.'));image.onerror=()=>reject(new Error('This image cannot be displayed.'));image.src=url;});}
  finally{URL.revokeObjectURL(url);}
}
