"""Synthetic timed directory checks, manual/save sync, status text and expiry lock."""
import json
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,unlock_test_drive
seed={'version':1,'people':[{'id':'p','name':'Synthetic Person','info':'','notes':[],'updatedAt':'2026-11-09T12:00:00.000Z'}]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1280,'height':900},service_workers='block');prepare_test_page(page)
 page.clock.install(time=datetime(2026,11,9,17,tzinfo=timezone.utc));errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("if(!localStorage.getItem('infirmary.directory.v1'))localStorage.setItem('infirmary.directory.v1',"+json.dumps(json.dumps(seed))+")")
 store=[seed];writes=[];held=[];holding=[False]
 def api(route):
  req=route.request;url=req.url
  if '/root?' in url:return route.fulfill(json={'id':'root','name':'Infirmary-BHR','mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}})
  if '/directory?' in url:
   if req.method=='PATCH':
    store[0]=req.post_data_json;writes.append(store[0])
    if holding[0]:held.append(route);return
    return route.fulfill(json={'id':'directory'})
   return route.fulfill(json=store[0])
  if 'people_directory.json' in url:return route.fulfill(json={'files':[{'id':'directory'}]})
  return route.fulfill(json={'files':[]})
 page.route('https://www.googleapis.com/**',api)
 page.goto('http://localhost:8000');unlock_test_drive(page);page.wait_for_function("document.querySelector('#refill-alert-toggle').getAttribute('aria-busy')==='false'")
 def preference(value):
  page.locator('#app-menu-toggle').click();page.locator('#preferences-open').click();page.locator('#sync-frequency').select_option(str(value));page.locator('#sync-preferences-form').get_by_role('button',name='Save sync setting',exact=True).click();assert 'saved' in page.locator('#sync-preferences-status').inner_text();page.locator('#alert-preferences-dialog [data-close]').click()
 preference(0);assert page.evaluate("localStorage.getItem('infirmary.autoSyncSeconds')")=='0'
 before=len(writes);page.clock.fast_forward(60000);page.wait_for_timeout(50);assert len(writes)==before
 assert 'off' in page.locator('#auto-sync-status').inner_text().lower()
 holding[0]=True;page.locator('#manual-sync').click();page.locator('#sync-status').wait_for(state='visible');assert page.locator('#sync-status').inner_text()=='Synchronizing...'
 page.wait_for_timeout(100);assert held;held.pop().fulfill(json={'id':'directory'});holding[0]=False;page.locator('#sync-status').wait_for(state='hidden')
 before=len(writes);page.locator('.note-form input').fill('Synthetic note while periodic checks are off');page.locator('.note-form input').press('Enter');assert len(writes)==before
 with page.expect_response('**/upload/drive/v3/files/directory?*'):page.locator('#manual-sync').click()
 page.wait_for_function("document.querySelector('#manual-sync').getAttribute('aria-busy')==='false'");assert len(writes)>before
 preference(30);before=len(writes);page.clock.fast_forward(29000);page.wait_for_timeout(50);assert len(writes)==before
 page.clock.fast_forward(1000);page.wait_for_function("document.querySelector('#manual-sync').getAttribute('aria-busy')==='false'");assert len(writes)>before
 for selector in ['.clinical-documents','.quick-notes-heading','.person-folders']:assert page.locator(selector).evaluate('n=>getComputedStyle(n).borderTopWidth')=='1px'
 preference(0);page.reload();unlock_test_drive(page);assert 'off' in page.locator('#auto-sync-status').inner_text().lower()
 page.clock.fast_forward(3600000);page.wait_for_function("document.body.classList.contains('drive-locked')")
 assert not errors,errors;b.close();print('Sync frequency/off, sync status, save/manual behavior, persistence, section dividers and expiry checks passed')
