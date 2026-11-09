// Stroke coordinates are normalized, so drawings scale without storing images.
export function validateStickyDrawing(strokes=[]){
 if(!Array.isArray(strokes)||strokes.length>256)throw new Error('Too many sticky drawing strokes.');let count=0;
 for(const s of strokes){if(!s||!/^#[0-9a-f]{6}$/i.test(s.color)||!Number.isFinite(s.size)||s.size<1||s.size>24||!Array.isArray(s.points)||!s.points.length||s.points.length>2000)throw new Error('Invalid sticky drawing.');for(const p of s.points){if(!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n)||n<0||n>1))throw new Error('Invalid sticky drawing point.');}count+=s.points.length;}
 if(count>12000)throw new Error('Sticky drawing is full. Undo a stroke before drawing more.');return strokes;
}
export function paintSticky(canvas,strokes){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);for(const s of strokes){ctx.strokeStyle=s.color;ctx.fillStyle=s.color;ctx.lineWidth=s.size;ctx.lineCap='round';ctx.lineJoin='round';const [x,y]=s.points[0];ctx.beginPath();ctx.arc(x*canvas.width,y*canvas.height,s.size/2,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(x*canvas.width,y*canvas.height);for(const [x,y] of s.points.slice(1))ctx.lineTo(x*canvas.width,y*canvas.height);ctx.stroke();}}
