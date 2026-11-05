// Independent of directory/Drive startup so the header always keeps time.
(()=>{
function updateClock(){
  const now=new Date(),pad=value=>String(value).padStart(2,'0');
  const weekday=now.toLocaleDateString('en-US',{weekday:'long'});
  const month=now.toLocaleDateString('en-US',{month:'long'});
  const time=document.createElement('strong');
  time.className='clock-time';
  time.textContent=`${pad(now.getHours()%12||12)}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${now.getHours()<12?'AM':'PM'}`;
  document.getElementById('clock').replaceChildren(`${weekday}, ${pad(now.getDate())} ${month} ${now.getFullYear()} `,time);
  document.getElementById('clock').dateTime=now.toISOString();
}
updateClock();
setInterval(updateClock,1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateClock();});
})();
