"""Synthetic cleanup failure/retry, form/photo/sticky purge, and Drive recovery."""
import json,struct,zlib
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,unlock_test_drive

def chunk(kind,body):return struct.pack('!I',len(body))+kind+body+struct.pack('!I',zlib.crc32(kind+body)&0xffffffff)
png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',2,2,8,6,0,0,0))+chunk(b'IDAT',zlib.compress((b'\0'+b'\x88\x88\x88\xff'*2)*2))+chunk(b'IEND',b'')
now='2026-01-01T00:00:00Z'
seed={'version':1,'people':[{'id':'synthetic-person','name':'Synthetic Private Person','info':'Synthetic private details','birthDate':{'year':'1950','month':'1','day':'1'},'updatedAt':now,'notes':[{'id':'n','text':'Synthetic protected note','createdAt':now}]}],'desktopNotes':[{'id':'sticky','text':'Synthetic shared reminder','drawing':[{'color':'#2454a4','size':5,'points':[[.1,.2],[.8,.7]]}],'createdAt':now,'updatedAt':now,'authorName':'Synthetic Staff','x':20,'y':30}]}
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':900},service_workers='block');prepare_test_page(page)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.add_init_script("localStorage.setItem('infirmary.directory.v1',"+json.dumps(json.dumps(seed))+");window.revoked=[];const revoke=URL.revokeObjectURL;URL.revokeObjectURL=url=>{revoked.push(url);revoke(url)}")
    page.goto('http://127.0.0.1:8000');unlock_test_drive(page)
    store=[seed]
    page.route('https://www.googleapis.com/drive/v3/files/*?fields=*',lambda route:route.fulfill(json={'id':'root','name':'Infirmary-BHR','appProperties':{'bhrWorkspace':'1'},'mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}}))
    page.route('https://www.googleapis.com/drive/v3/files?*',lambda route:route.fulfill(json={'files':[] if 'BHR_event_log.txt' in route.request.url else [{'id':'cleanup-directory'}]}))
    page.route('https://www.googleapis.com/drive/v3/files/cleanup-directory?*',lambda route:route.fulfill(json=store[0]))
    def save(route):store[0]=route.request.post_data_json;route.fulfill(json={'id':'cleanup-directory'})
    page.route('https://www.googleapis.com/upload/drive/v3/files/cleanup-directory?*',save)
    page.get_by_label('Edit this record',exact=True).click()
    page.locator('#person-photo').set_input_files({'name':'synthetic.png','mimeType':'image/png','buffer':png})
    page.wait_for_function("document.querySelector('#person-photo-preview img')?.src.startsWith('blob:')")
    photo=page.locator('#person-photo-preview img').get_attribute('src')
    page.locator('#person-dialog .window-control').click()
    page.evaluate("()=>{document.querySelector('#note-edit-text').value='Synthetic private draft';window.remove=Storage.prototype.removeItem;Storage.prototype.removeItem=function(key){if(key==='infirmary.directory.v1')throw new Error('Synthetic storage failure');return remove.call(this,key)}}")
    page.locator('#logout-power').click();page.locator('#confirm-logout').click()
    page.wait_for_function("document.querySelector('#logout-status').textContent.includes('Synthetic storage failure')")
    assert not page.locator('body').evaluate("el=>el.classList.contains('drive-locked')")
    assert page.evaluate("JSON.parse(localStorage.getItem('infirmary.directory.v1')).people.length")==1
    assert page.locator('#note-edit-text').input_value()=='Synthetic private draft'
    page.evaluate('()=>{Storage.prototype.removeItem=window.remove}')
    page.locator('#confirm-logout').click()
    page.wait_for_function("document.body.classList.contains('drive-locked')")
    assert page.evaluate("localStorage.getItem('infirmary.directory.v1')") is None
    assert 'Synthetic' not in page.locator('body').text_content()
    assert page.locator('#sticky-notes').text_content()=='' and page.locator('#sticky-dock').text_content()==''
    assert page.locator('#sticky-canvas').evaluate("c=>!c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((n,i)=>i%4===3&&n>0)")
    assert page.locator('#note-edit-text').input_value()==''
    assert page.locator('#person-photo').input_value()==''
    assert page.locator('#person-photo-preview img').count()==0
    assert page.evaluate('(url)=>revoked.includes(url)',photo)
    assert len(store[0]['people'])==1 and store[0]['desktopNotes'][0]['text']=='Synthetic shared reminder'
    assert any(event['action']=='session.logout_requested' for event in store[0]['eventLog'])
    # Reconnecting pulls the preserved Drive copy instead of resurrecting local data.
    page.locator('#google-connect').click();page.locator('#use-drive-root').click()
    page.wait_for_function("!document.body.classList.contains('drive-locked')")
    assert 'Synthetic Private Person' in page.locator('#people').inner_text()
    assert 'Synthetic shared reminder' in page.locator('#sticky-notes').inner_text()
    assert not errors,errors
    browser.close()
print('PASS: storage cleanup failure is retryable; successful logout purges forms, photo blobs, stickies and records; Drive copy survives and reconnect restores it')
