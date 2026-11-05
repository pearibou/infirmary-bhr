// Independent of directory/Drive startup so the header always keeps time.
(()=>{
function updateClock(){
  const now=new Date(),pad=value=>String(value).padStart(2,'0');
  const weekday=now.toLocaleDateString('en-US',{weekday:'long'});
  const month=now.toLocaleDateString('en-US',{month:'long'});
  document.getElementById('clock').textContent=`${weekday}, ${pad(now.getDate())} ${month} ${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  document.getElementById('clock').dateTime=now.toISOString();
}
updateClock();
setInterval(updateClock,1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateClock();});
})();
