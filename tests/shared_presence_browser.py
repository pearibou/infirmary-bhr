"""Independent browser sessions share only synthetic Google Drive presence files."""
import copy,json,re,urllib.parse
from datetime import datetime,timezone,timedelta
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,ignore_event_log_projection
root={'id':'root','name':'Infirmary-BHR','mimeType':'application/vnd.google-apps.folder','parents':[],'appProperties':{'bhrWorkspace':'1'},'capabilities':{'canAddChildren':True}}
files={'root':root,'directory':{'id':'directory','name':'people_directory.json','parents':['root'],'mimeType':'application/json','content':{'version':1,'people':[]}}};serial=[0];fail=[False];lost=[True];requests=[]
for user in ['a','b']:
 files['profile-'+user]={'id':'profile-'+user,'name':'staff_profile_'+user+'.json','parents':['root'],'mimeType':'application/json','content':{'version':1,'issuer':'https://accounts.google.com','subject':user,'displayName':'Synthetic '+user.upper()}}
def meta(file):return {k:copy.deepcopy(v) for k,v in file.items() if k!='content'}
def route_api(route,user):
 req=route.request;url=urllib.parse.urlparse(req.url);query=urllib.parse.parse_qs(url.query);path=url.path;requests.append((user,req.method,path))
 if 'userinfo' in path:route.fulfill(json={'sub':user,'name':'Synthetic '+user.upper(),'email':user+'@example.test'});return
 if '/upload/' in path:
  if query.get('uploadType')==['multipart']:
   boundary=req.headers['content-type'].split('boundary=')[1];parts=[]
   for part in req.post_data.split('--'+boundary):
    if '\r\n\r\n' in part:parts.append(json.loads(part.split('\r\n\r\n',1)[1].strip()))
   metadata,content=parts;assert metadata.get('appProperties',{}).get('bhrPresence')=='1'
   if fail[0]:route.fulfill(status=503,json={'error':{'message':'Synthetic presence unavailable'}});return
   file_id=path.rsplit('/',1)[-1] if req.method=='PATCH' else None
   if not file_id:serial[0]+=1;file_id='presence-'+str(serial[0]);files[file_id]={'id':file_id}
   files[file_id].update(metadata);files[file_id]['content']=content
   if lost[0]:lost[0]=False;route.fulfill(status=503,json={'error':{'message':'Synthetic create response lost'}});return
   route.fulfill(json=meta(files[file_id]));return
  if path.endswith('/directory'):files['directory']['content']=req.post_data_json;route.fulfill(json={'id':'directory'});return
 if path.endswith('/files'):
  if req.method=='POST':
   serial[0]+=1;file_id='folder-'+str(serial[0]);files[file_id]={'id':file_id,**req.post_data_json};route.fulfill(json=meta(files[file_id]));return
  q=query.get('q',[''])[0]
  if fail[0] and "key='bhrPresence'" in q:route.fulfill(status=503,json={'error':{'message':'Synthetic presence unavailable'}});return
  found=[]
  for f in files.values():
   if f.get('trashed'):continue
   parent=re.search(r"'([^']+)' in parents",q)
   if parent and parent[1] not in f.get('parents',[]):continue
   name=re.search(r"name\s*=\s*'([^']+)'",q)
   if name and f.get('name')!=name[1]:continue
   mime=re.search(r"mimeType\s*=\s*'([^']+)'",q)
   if mime and f.get('mimeType')!=mime[1]:continue
   props=re.findall(r"key\s*=\s*'([^']+)'\s+and\s+value\s*=\s*'([^']+)'",q)
   if any(f.get('appProperties',{}).get(k)!=v for k,v in props):continue
   found.append(meta(f))
  route.fulfill(json={'files':found});return
 file_id=path.rsplit('/',1)[-1];file=files.get(file_id)
 if not file or file.get('trashed'):route.fulfill(status=404,json={'error':{'message':'Not found'}});return
 if req.method=='PATCH':
  if fail[0] and file.get('appProperties',{}).get('bhrPresence')=='1':route.fulfill(status=503,json={'error':{'message':'Synthetic presence unavailable'}});return
  update=req.post_data_json
  if 'appProperties' in update:file.setdefault('appProperties',{}).update(update.pop('appProperties'))
  file.update(update);route.fulfill(json=meta(file));return
 route.fulfill(json=file.get('content',{}) if query.get('alt')==['media'] else meta(file))
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);pages=[];errors=[];clock=datetime(2026,11,10,17,tzinfo=timezone.utc)
 def open_user(user,seconds=0):
  page=browser.new_page(viewport={'width':1440,'height':1000},service_workers='block');pages.append(page);prepare_test_page(page);page.clock.set_fixed_time(clock+timedelta(seconds=seconds))
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.route('https://www.googleapis.com/**',lambda route:route_api(route,user));ignore_event_log_projection(page)
  page.goto('http://127.0.0.1:8000');page.wait_for_function("window.google?.accounts?.oauth2 && !document.querySelector('#google-connect').disabled")
  page.locator('#google-connect').click();page.locator('#drive-dialog details summary').click();page.locator('#use-drive-root').click()
  page.wait_for_function("!document.body.classList.contains('drive-locked')")
  page.locator('#drive-dialog [data-close]').click();return page
 def refresh(page,seconds):
  page.clock.set_fixed_time(clock+timedelta(seconds=seconds));page.locator('#manual-sync').click();page.wait_for_function("document.querySelector('#manual-sync').getAttribute('aria-busy')==='false'")
 a=open_user('a');a.wait_for_function("document.querySelector('#connected-users').textContent==='Connected Users: ?'");refresh(a,31);a.wait_for_function("document.querySelector('#connected-users').textContent==='Connected Users: 1'")
 b=open_user('b',31);b.wait_for_function("document.querySelector('#connected-users').textContent==='Connected Users: 2'")
 refresh(a,62);a.wait_for_function("document.querySelector('#connected-users').textContent==='Connected Users: 2'")
 a.locator('#connected-users').click();assert 'Synthetic A (a@example.test)' in a.locator('#connected-users-list').inner_text() and 'Synthetic B (b@example.test)' in a.locator('#connected-users-list').inner_text();a.keyboard.press('Escape')
 other=open_user('a',62);other.wait_for_function("document.querySelector('#connected-users').textContent==='Connected Users: 2'")
 sessions=lambda:[f for f in files.values() if f.get('appProperties',{}).get('bhrPresence')=='1' and not f.get('trashed')]
 assert len(sessions())==3
 assert all(f['parents'][0] in files and files[f['parents'][0]].get('name')=='Presence' for f in sessions())
 assert 'presence' not in json.dumps(files['directory']['content']).lower()
 # Manual sync bursts are throttled, while record sync is still available.
 before=sum(1 for u,m,path in requests if u=='a' and m=='PATCH' and '/presence-' in path)
 for _ in range(2):refresh(a,62)
 after=sum(1 for u,m,path in requests if u=='a' and m=='PATCH' and '/presence-' in path);assert after==before
 # One account's logout removes only that browser session, retaining its other tab.
 other.locator('#logout-power').click();other.locator('#confirm-logout').click();other.wait_for_function("document.body.classList.contains('drive-locked')")
 assert len(sessions())==2 and other.locator('#connected-users').inner_text()=='Connected Users: 0'
 # A presence outage must not cause the records sync to fail or show a false count.
 fail[0]=True;refresh(a,93);a.wait_for_function("document.querySelector('#connected-users').textContent==='Connected Users: ?'")
 assert a.locator('#connection').inner_text().startswith('Last synced') and not a.locator('body').evaluate("e=>e.classList.contains('drive-locked')")
 fail[0]=False;refresh(a,124);a.wait_for_function("document.querySelector('#connected-users').textContent==='Connected Users: 2'")
 # Stopping B's browser sends no logout: expiry removes it from A's next snapshot.
 b.close();refresh(a,310);a.wait_for_function("document.querySelector('#connected-users').textContent==='Connected Users: 1'")
 # A day-old marked session is cleaned up, but an unrelated file in the folder is not.
 old=copy.deepcopy(sessions()[0]);old['id']='old-session-file';old['appProperties']['lastSeen']=(clock-timedelta(days=2)).isoformat();files[old['id']]=old
 files['unrelated']={'id':'unrelated','name':'Unrelated file','parents':old['parents'],'mimeType':'application/json','content':{}}
 refresh(a,341);a.wait_for_function("document.querySelector('#manual-sync').getAttribute('aria-busy')==='false'")
 page_wait=lambda:files['old-session-file'].get('trashed',False)
 for _ in range(100):
  if page_wait():break
  a.wait_for_timeout(20)
 assert files['old-session-file'].get('trashed') and not files['unrelated'].get('trashed')
 assert not errors,errors
 browser.close()
print('PASS: shared private Drive sessions, two Google identities/three browsers, deduplication, throttle, logout removal, failure isolation and expiry')
