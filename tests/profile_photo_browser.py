"""Synthetic full-photo viewing, keyboard access, Drive denial and session cleanup."""
import json,struct,zlib
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,unlock_test_drive

def chunk(kind,body):return struct.pack('!I',len(body))+kind+body+struct.pack('!I',zlib.crc32(kind+body)&0xffffffff)
width,height=640,360
png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',width,height,8,6,0,0,0))+chunk(b'IDAT',zlib.compress((b'\0'+b'\x89\xaa\xc4\xff'*width)*height))+chunk(b'IEND',b'')
stamp='2026-11-09T12:00:00.000Z'
def person(id,name,file=None):return {'id':id,'name':name,'info':'','notes':[],'updatedAt':stamp,**({'photo':{'fileId':file,'folderId':'patient-folder'}} if file else {})}
seed={'version':1,'people':[person('a','Synthetic Alpha','photo-ok'),person('b','Synthetic Beta','photo-denied'),person('c','Synthetic Gamma')]}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=browser.new_page(viewport={'width':1280,'height':900},service_workers='block');prepare_test_page(page)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)));reads=[]
 page.add_init_script("localStorage.setItem('infirmary.directory.v1',"+json.dumps(json.dumps(seed))+");window.revoked=[];const revoke=URL.revokeObjectURL.bind(URL);URL.revokeObjectURL=url=>{revoked.push(url);revoke(url)}")
 def api(route):
  url=route.request.url
  if '/photo-ok?' in url:reads.append(url);return route.fulfill(content_type='image/png',body=png)
  if '/photo-denied?' in url:return route.fulfill(status=403,json={'error':{'message':'Synthetic access denied'}})
  if '/directory?' in url:return route.fulfill(json=seed if route.request.method=='GET' else {'id':'directory'})
  if 'people_directory.json' in url:return route.fulfill(json={'files':[{'id':'directory'}]})
  if '/root?' in url:return route.fulfill(json={'id':'root','name':'Infirmary-BHR','mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}})
  return route.fulfill(json={'files':[]})
 page.route('https://www.googleapis.com/**',api)
 page.goto('http://localhost:8000');unlock_test_drive(page)
 photo=page.get_by_role('button',name='View full profile photo of Synthetic Alpha',exact=True);photo.locator('img').wait_for()
 cached=photo.locator('img').get_attribute('src');photo.click();viewer=page.locator('#photo-viewer-dialog');viewer.wait_for(state='visible')
 image=viewer.locator('img');page.wait_for_function("document.querySelector('#photo-viewer-image img')?.naturalWidth===640")
 assert image.get_attribute('src')==cached and len(reads)==1
 assert image.evaluate('i=>i.naturalWidth===640&&i.naturalHeight===360&&getComputedStyle(i).objectFit==="contain"')
 assert 'Synthetic Alpha' in viewer.locator('.dialog-title').inner_text()
 page.keyboard.press('Escape');viewer.wait_for(state='hidden');assert viewer.locator('img').count()==0 and 'Synthetic' not in viewer.inner_text()
 photo.focus();page.keyboard.press('Enter');viewer.wait_for(state='visible');viewer.get_by_role('button',name='Close',exact=True).click()
 page.locator('.person strong').filter(has_text='Synthetic Beta').click();page.get_by_role('button',name='View full profile photo of Synthetic Beta',exact=True).click()
 page.wait_for_function("document.querySelector('#photo-viewer-status').textContent.includes('may need access')");assert viewer.locator('img').count()==0
 viewer.get_by_role('button',name='Close',exact=True).click();page.locator('.person strong').filter(has_text='Synthetic Gamma').click();assert page.locator('#detail .avatar').evaluate('n=>n.tagName')=='DIV'
 page.locator('.person strong').filter(has_text='Synthetic Alpha').click();page.set_viewport_size({'width':390,'height':844});page.get_by_role('button',name='View full profile photo of Synthetic Alpha',exact=True).click()
 page.wait_for_function("document.querySelector('#photo-viewer-image img')?.naturalWidth===640")
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert image.evaluate('i=>Math.abs(i.getBoundingClientRect().width/i.getBoundingClientRect().height-640/360)<.01')
 viewer.screenshot(path='/tmp/bhr-profile-photo-viewer-mobile.png')
 # A logout from another tab clears the open image as well as the thumbnail cache.
 page.evaluate("window.dispatchEvent(new StorageEvent('storage',{key:'infirmary.logout',newValue:'synthetic-other-tab'}))")
 page.wait_for_function("document.body.classList.contains('drive-locked')")
 assert viewer.is_hidden() and viewer.locator('img').count()==0 and 'Synthetic' not in viewer.inner_text()
 page.wait_for_function('(url)=>window.revoked.includes(url)',arg=cached)
 assert not errors,errors;browser.close();print('Profile photo viewing, keyboard, permissions, mobile and logout checks passed')
