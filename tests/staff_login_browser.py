"""Synthetic first login, existing shared folder, aliases, reconnect and access refusal."""
import json,re
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,open_drive
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1280,'height':900},service_workers='block');prepare_test_page(page)
 profiles={};subject=['pilot-a'];writes=[];errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 directory={'version':1,'people':[]}
 def backend(route):
  req=route.request;u=urlparse(req.url);params=parse_qs(u.query);q=params.get('q',[''])[0];body=req.post_data or ''
  if 'userinfo' in u.path:return route.fulfill(json={'sub':subject[0],'name':'Google Pilot','email':subject[0]+'@example.test'})
  if req.method in ['PATCH','POST']:writes.append((u.path,body))
  if 'upload' in u.path:
   if 'staff_profile_' in body and req.method=='POST':
    parts=body.split('\r\n\r\n');meta=json.loads(parts[1].split('\r\n--')[0]);value=json.loads(parts[2].split('\r\n--')[0]);key=meta['name'][:-5];profiles[key]=value;return route.fulfill(json={'id':key})
   if u.path.rsplit('/',1)[-1].startswith('staff_profile_'):
    profiles[u.path.rsplit('/',1)[-1]]=json.loads(body);return route.fulfill(json={})
   return route.fulfill(json={'id':'saved'})
  if u.path.endswith('/files'):
   if 'people_directory.json' in q:return route.fulfill(json={'files':[{'id':'directory'}]})
   if 'staff_profile_' in q:
    name=re.search("name = '([^']+)'",q)[1][:-5];return route.fulfill(json={'files':[{'id':name}] if name in profiles else []})
   return route.fulfill(json={'files':[]})
  key=u.path.rsplit('/',1)[-1]
  if key=='denied':return route.fulfill(status=403,json={'error':{'message':'Access denied'}})
  if key=='shared':return route.fulfill(json={'id':'shared','name':'Infirmary-BHR','mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}})
  if key=='directory':return route.fulfill(json=directory)
  if key in profiles:return route.fulfill(json=profiles[key])
  return route.fulfill(status=404,json={'error':{'message':'Synthetic file missing'}})
 page.route('https://www.googleapis.com/**',backend)
 page.goto('http://localhost:8000');page.wait_for_function("window.google?.accounts?.oauth2 && !document.querySelector('#drive-status').textContent.startsWith('Preparing')")
 page.locator('#google-connect').click();page.locator('#open-shared-workspace').wait_for(state='visible')
 page.locator('#shared-workspace-link').fill('https://drive.google.com/drive/folders/denied');page.locator('#open-shared-workspace').click()
 page.wait_for_function("document.querySelector('#drive-status').textContent.includes('Access denied')")
 assert page.locator('body').evaluate("e=>e.classList.contains('drive-locked')") and not writes
 page.locator('#shared-workspace-link').fill('https://drive.google.com/drive/folders/shared');page.locator('#open-shared-workspace').click()
 page.locator('#staff-profile-panel').wait_for(state='visible');assert not writes
 page.locator('#staff-display-name').fill('Nurse Pilot');page.locator('#save-staff-profile').click()
 page.wait_for_function("!document.body.classList.contains('drive-locked')")
 assert page.locator('#records-window').get_attribute('hidden') is not None
 assert 'Nurse Pilot' in page.locator('#current-user').inner_text()
 assert profiles['staff_profile_pilot-a']['subject']=='pilot-a'
 # Reconnect reads the alias without asking again; a different account gets its own prompt.
 page.locator('#disconnect').click();page.locator('#google-connect').click();page.wait_for_function("!document.body.classList.contains('drive-locked')")
 assert page.locator('#staff-profile-panel').is_hidden()
 page.locator('#disconnect').click();subject[0]='pilot-b';page.locator('#google-connect').click();page.locator('#staff-profile-panel').wait_for(state='visible')
 assert page.locator('#staff-display-name').input_value()=='Google Pilot'
 assert page.locator('body').evaluate("e=>e.classList.contains('drive-locked')")
 page.locator('#staff-display-name').fill('Second Pilot');page.locator('#save-staff-profile').click();page.wait_for_function("!document.body.classList.contains('drive-locked')")
 assert profiles['staff_profile_pilot-a']['displayName']=='Nurse Pilot'
 assert profiles['staff_profile_pilot-b']['displayName']=='Second Pilot'
 page.locator('#drive-dialog [data-close]').click();page.locator('#account-toggle').click()
 assert page.locator('#account-email').inner_text()=='pilot-b@example.test'
 page.locator('#account-edit-name').click();page.locator('#staff-display-name').fill('Updated Pilot');page.locator('#save-staff-profile').click()
 page.wait_for_function("document.querySelector('#account-display-name').textContent==='Updated Pilot'")
 assert profiles['staff_profile_pilot-b']['displayName']=='Updated Pilot' and profiles['staff_profile_pilot-a']['displayName']=='Nurse Pilot'
 page.locator('#drive-dialog [data-close]').click();page.locator('#connected-users').click()
 assert page.locator('#connected-users-list').inner_text()=='Updated Pilot (pilot-b@example.test)'
 page.screenshot(path='/tmp/bhr-staff-login.png')
 assert not errors,errors
 assert not any('access_token' in body for _,body in writes)
 browser.close();print('Individual Google login checks passed')
