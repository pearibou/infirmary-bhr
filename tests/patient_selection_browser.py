"""Synthetic large audit trail: chart selection must not redraw unrelated desktop UI."""
import json
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,unlock_test_drive,open_drive
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1000},service_workers='block');prepare_test_page(page)
 errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 people=[{'id':f'p{i}','name':f'Synthetic Person {i}','firstName':'Synthetic','lastName':f'Person {i}','info':'','notes':[],'updatedAt':'2026-01-01T00:00:00Z'} for i in range(20)]
 events=[{'id':f'e{i}','createdAt':'2026-01-01T00:00:00.000Z','actorName':'Synthetic Staff','action':'person.updated','entityType':'person','entityId':'p0','summary':'Synthetic record updated'} for i in range(2500)]
 seed={'version':1,'people':people,'eventLog':events,'desktopNotes':[{'id':'sticky','text':'Synthetic sticky','createdAt':'2026-01-01T00:00:00.000Z','updatedAt':'2026-01-01T00:00:00.000Z','authorName':'Synthetic Staff','x':12,'y':12}]}
 page.add_init_script("if(!localStorage.getItem('infirmary.directory.v1'))localStorage.setItem('infirmary.directory.v1',"+json.dumps(json.dumps(seed))+");")
 page.route('https://www.googleapis.com/drive/v3/files?*',lambda route:route.fulfill(json={'files':[]}))
 page.route('https://sheets.googleapis.com/**',lambda route:route.fulfill(status=404,json={'error':{'message':'Synthetic workbook missing'}}))
 page.goto('http://127.0.0.1:8000');unlock_test_drive(page)
 page.wait_for_function("document.querySelector('#refill-alert-toggle').getAttribute('aria-busy')==='false'")
 results=page.evaluate("""()=>{
  const people=document.querySelector('#people'),log=document.querySelector('#event-log-text'),sticky=document.querySelector('#sticky-notes'),first=people.querySelector('.person');
  const counts={directory:0,log:0,sticky:0};const observers=Object.entries({directory:people,log,sticky}).map(([key,el])=>{const observer=new MutationObserver(records=>counts[key]+=records.length);observer.observe(el,{childList:true,subtree:true});return observer;});
  const times=[];const icon=document.querySelector('#refill-alert-toggle');icon.classList.add('needs-attention');const blink=icon.querySelector('svg').getAnimations()[0];blink.pause();
  for(let i=0;i<8;i++){blink.currentTime=i%2?900:300;const before=performance.now();const buttons=people.querySelectorAll('.person');buttons[i%2?0:1].click();times.push(performance.now()-before);}
  for(let i=0;i<observers.length;i++){counts[Object.keys(counts)[i]]+=observers[i].takeRecords().length;observers[i].disconnect();}
  return {counts,times,sameDirectory:first===people.querySelector('.person'),selected:document.querySelector('#detail h2').textContent};
 }""")
 print('Selection measurements:',json.dumps(results),flush=True)
 assert results['counts']=={'directory':0,'log':0,'sticky':0},results
 assert results['sameDirectory'] and results['selected']=='Synthetic Person 0'
 assert max(results['times'])<150,results
 # Browsing must leave existing sticky elements intact and preserve keyboard focus.
 page.locator('.person').nth(2).focus();page.keyboard.press('Enter');assert page.locator('#detail h2').inner_text()=='Synthetic Person 10'
 assert page.locator('.person').nth(2).evaluate('el=>el===document.activeElement')
 # Opening the Event Log still shows the complete current audit history.
 page.locator('#app-menu-toggle').click();page.locator('#event-log-icon').click()
 assert page.locator('#event-log-text').inner_text().count('Synthetic record updated')==2500
 page.locator('#event-log-dialog [data-close]').click()
 open_drive(page);page.locator('#disconnect').click()
 assert page.locator('#event-log-text').text_content()==''
 assert not errors,errors
 browser.close()
