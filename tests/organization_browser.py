"""Synthetic private organization settings/logo, print branding, cache and cleanup."""
import json,copy,sys
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,unlock_test_drive
seed={'version':1,'people':[{'id':'p','name':'Synthetic Person','info':'','notes':[],'updatedAt':'2026-11-09T12:00:00.000Z'}]}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=browser.new_page(viewport={'width':1280,'height':900},service_workers='block');prepare_test_page(page)
 page.add_init_script('window.print=()=>{}')
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)));store=[copy.deepcopy(seed)];logo_reads=[];uploads=[]
 page.add_init_script("if(!localStorage.getItem('infirmary.directory.v1'))localStorage.setItem('infirmary.directory.v1',"+json.dumps(json.dumps(seed))+")")
 def api(route):
  req=route.request;u=urlparse(req.url);q=parse_qs(u.query);key=u.path.rsplit('/',1)[-1]
  if 'uploadType' in q and q['uploadType']==['resumable']:return route.fulfill(headers={'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'Location','Location':'https://www.googleapis.com/upload/drive/v3/files/logo-session'},json={})
  if key=='logo-session':uploads.append(req.post_data_buffer);return route.fulfill(json={'id':'private-logo'})
  if key=='private-logo':logo_reads.append(req.headers.get('authorization'));return route.fulfill(content_type='image/png',body=Path('icons/icon-512.png').read_bytes())
  if key=='root':return route.fulfill(json={'id':'root','name':'Infirmary-BHR','mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}})
  if key=='directory':
   if req.method=='PATCH':store[0]=req.post_data_json
   return route.fulfill(json=store[0] if req.method=='GET' else {'id':'directory'})
  if key=='staff-profile':return route.fulfill(json={'version':1,'issuer':'https://accounts.google.com','subject':'synthetic-staff','displayName':'Synthetic Staff'})
  if key=='files':
   query=q.get('q',[''])[0];return route.fulfill(json={'files':[{'id':'directory'}] if 'people_directory.json' in query else [{'id':'staff-profile'}] if 'staff_profile_' in query else []})
  return route.fulfill(json={'files':[]})
 page.route('https://www.googleapis.com/**',api);page.goto('http://localhost:8000');unlock_test_drive(page)
 assert page.locator('#app-menu-toggle').inner_text()=='Brother Health Records'
 page.locator('#app-menu-toggle').click();page.locator('#preferences-open').click();page.locator('#organization-name').fill('Synthetic Community Clinic')
 page.locator('#organization-logo').set_input_files('icons/icon-512.png');page.wait_for_function("document.querySelector('#organization-logo-preview').src.startsWith('blob:')")
 page.locator('#organization-form').get_by_role('button',name='Save organization info').click();page.wait_for_function("document.querySelector('#organization-error').textContent && !document.querySelector('#organization-error').textContent.includes('Saving')");assert 'saved.' in page.locator('#organization-error').inner_text(),(page.locator('#organization-error').inner_text(),errors)
 assert store[0]['organization']['name']=='Synthetic Community Clinic' and store[0]['organization']['logo']['fileId']=='private-logo' and len(uploads)==1
 assert 'organization' not in page.evaluate("JSON.parse(localStorage.getItem('infirmary.directory.v1'))")
 page.wait_for_function("document.querySelector('.abbey-mark').src.startsWith('blob:')");assert all(value=='Bearer synthetic' for value in logo_reads)
 assert page.locator('#app-menu-toggle').inner_text()=='Synthetic Community Clinic' and page.locator('#workspace-organization').inner_text()=='Synthetic Community Clinic'
 assert page.locator('#about-dialog .about-brand img').get_attribute('src')=='icons/bhr-product.svg'
 page.locator('#alert-preferences-dialog [data-close]').click()
 # Printed headers use the private original image, never the previously bundled abbey art.
 page.locator('.chart-navigation').get_by_role('button',name='Demographics').click();page.locator('#demographics-print').click()
 page.wait_for_function("document.querySelector('#bhr-print-frame')?.contentDocument.querySelector('header img')?.naturalWidth>0 || document.querySelector('#demographics-status').textContent");assert page.locator('#bhr-print-frame').count(),page.locator('#demographics-status').inner_text()
 frame=page.frame_locator('#bhr-print-frame');assert frame.locator('header h1').inner_text()=='Synthetic Community Clinic' and frame.locator('header img').get_attribute('src').startswith('blob:')
 page.evaluate("document.querySelector('#bhr-print-frame').contentWindow.dispatchEvent(new Event('afterprint'))");page.locator('#demographics-dialog [data-close]').click()
 page.reload();page.wait_for_function("window.google?.accounts?.oauth2 && !document.querySelector('#drive-status').textContent.startsWith('Preparing')");page.locator('#google-connect').click();page.wait_for_function("!document.body.classList.contains('drive-locked')");page.locator('#drive-dialog [data-close]').click();page.wait_for_function("document.querySelector('#app-menu-toggle').textContent==='Synthetic Community Clinic'")
 page.locator('#app-menu-toggle').click();page.locator('#preferences-open').click();page.locator('#organization-remove-logo').check();page.locator('#organization-form').get_by_role('button',name='Save organization info').click();page.wait_for_function("document.querySelector('#organization-error').textContent && !document.querySelector('#organization-error').textContent.includes('Saving')");assert 'saved.' in page.locator('#organization-error').inner_text(),(page.locator('#organization-error').inner_text(),errors)
 assert store[0]['organization']['logo'] is None and page.locator('.abbey-mark').get_attribute('src').endswith('/icons/icon.svg')
 page.locator('#alert-preferences-dialog [data-close]').click();page.locator('#logout-power').click();page.locator('#confirm-logout').click();page.wait_for_function("document.body.classList.contains('drive-locked')")
 assert page.locator('#app-menu-toggle').inner_text()=='Brother Health Records' and 'Synthetic Community Clinic' not in page.locator('body').text_content()
 assert not errors,errors;browser.close();print('Private organization save/upload/reload/removal, printed headers, cache and logout checks passed')
