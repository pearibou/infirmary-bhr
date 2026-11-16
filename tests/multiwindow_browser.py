"""Synthetic concurrent viewers, explicit resident context and modal draft protection."""
import json
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,unlock_test_drive
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000},service_workers='block');prepare_test_page(page)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    people=[{'id':key,'name':'Brother Synthetic John','preferredName':'Brother Synthetic John','firstName':'John','lastName':surname,'birthDate':{'month':'1','day':day,'year':'1940'},'info':'','notes':[],'updatedAt':'2026-01-01T00:00:00Z'} for key,surname,day in [('synthetic-a','Example A','2'),('synthetic-b','Example B','3')]]
    people.append({'id':'synthetic-deceased','name':'Synthetic Departed','deceased':True,'info':'','notes':[],'updatedAt':'2026-01-01T00:00:00Z'})
    seed={'version':1,'people':people}
    page.add_init_script("localStorage.setItem('infirmary.directory.v1',"+json.dumps(json.dumps(seed))+");")
    page.route('https://www.googleapis.com/drive/v3/files?*',lambda route:route.fulfill(json={'files':[]}))
    page.route('https://sheets.googleapis.com/**',lambda route:route.fulfill(status=404,json={'error':{'message':'Synthetic workbook missing'}}))
    page.goto('http://127.0.0.1:8000');unlock_test_drive(page)
    def main_front():page.locator('#records-window .titlebar').focus()
    main_front();page.locator('.person[data-person-id=synthetic-a]').click()
    modules=[('Demographics','demographics-dialog','demographics-title'),('Vital Signs','vitals-dialog','vitals-title'),('Medications','medications-dialog','medications-title'),('Medical History','history-dialog','history-title'),('Immunizations','immunizations-dialog','immunizations-title')]
    for name,dialog,title in modules:
        main_front();page.locator('.chart-navigation').get_by_role('button',name=name,exact=True).click()
        assert page.locator('#'+dialog).is_visible() and not page.locator('#'+dialog).evaluate('el=>el.matches(":modal")')
        assert 'Example A' in page.locator('#'+title).inner_text() and '01/02/1940' in page.locator('#'+title).inner_text()
        assert page.locator('dialog:modal').count()==0
    assert page.locator('dialog[data-nonmodal=true][open]').count()==5
    main_front();page.locator('.person[data-person-id=synthetic-b]').click()
    for name,dialog,title in modules:assert 'Example A' in page.locator('#'+title).inner_text()
    page.locator('.chart-navigation').get_by_role('button',name='Demographics',exact=True).click()
    assert 'Example B' in page.locator('#demographics-title').inner_text() and 'Example A' in page.locator('#history-title').inner_text()
    # Focusing any exposed title raises just that viewer, including keyboard navigation.
    for name,dialog,title in modules:
        page.locator('#'+dialog+' .dialog-title').focus()
        assert page.locator('#'+dialog).evaluate('el=>el.style.zIndex')=='2'
        assert all(page.locator('#'+other).evaluate('el=>el.style.zIndex')=='1' for _,other,_ in modules if other!=dialog)
    # A modal edit form blocks other windows; minimizing it retains its resident/draft.
    page.locator('#vitals-dialog .dialog-title').focus();page.wait_for_function("!document.querySelector('#vitals-add').disabled")
    page.locator('#vitals-add').click();assert page.locator('#vitals-form-dialog').evaluate('el=>el.matches(":modal")')
    page.locator('#vitals-form').get_by_label('Pulse · bpm',exact=True).fill('88')
    page.locator('#vitals-form-dialog .window-control').click()
    main_front();page.locator('.person[data-person-id=synthetic-b]').click();page.locator('.chart-navigation').get_by_role('button',name='Vital Signs',exact=True).click()
    assert page.locator('#vitals-form-dialog').evaluate('el=>el.matches(":modal")')
    assert page.locator('#vitals-form').get_by_label('Pulse · bpm',exact=True).input_value()=='88'
    assert page.locator('#vitals-person').input_value()=='synthetic-a'
    assert 'Example A' in page.locator('#vitals-form-title').inner_text() and '01/02/1940' in page.locator('#vitals-form-title').inner_text()
    page.locator('#vitals-cancel').click()
    page.wait_for_function("document.querySelector('#vitals-dialog').style.zIndex==='2'")
    for viewport in [{'width':390,'height':844},{'width':1440,'height':1000}]:
        page.set_viewport_size(viewport)
        for _,dialog,_ in modules:
            assert page.locator('#'+dialog).evaluate('el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=document.querySelector(".menubar").getBoundingClientRect().bottom&&r.bottom<=innerHeight+1;}')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('#history-dialog .dialog-title').focus();page.keyboard.press('Escape')
    assert not page.locator('#history-dialog').is_visible() and page.locator('#vitals-dialog').is_visible()
    page.locator('#vitals-dialog .dialog-title').focus();page.locator('#vitals-dialog .window-control').click()
    page.locator('#window-dock [data-window=vitals-dialog]').click()
    assert not page.locator('#vitals-dialog').evaluate('el=>el.matches(":modal")') and page.locator('#vitals-person').input_value()=='synthetic-a'
    # Logout clears every open viewer, including its resident-bearing title.
    page.route('https://www.googleapis.com/drive/v3/files/*?fields=*',lambda route:route.fulfill(json={'id':'root','name':'Infirmary-BHR','appProperties':{'bhrWorkspace':'1'},'mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}}))
    snapshot=page.evaluate("JSON.parse(localStorage.getItem('infirmary.directory.v1'))")
    page.route('https://www.googleapis.com/drive/v3/files/__test-bootstrap?*',lambda route:route.fulfill(json=snapshot))
    page.route('https://www.googleapis.com/upload/drive/v3/files/__test-bootstrap?*',lambda route:route.fulfill(json={'id':'__test-bootstrap'}))
    page.route('https://www.googleapis.com/drive/v3/files?*',lambda route:route.fulfill(json={'files':[{'id':'__test-bootstrap'}] if 'people_directory.json' in route.request.url else []}))
    page.locator('#logout-power').click();page.locator('#confirm-logout').click()
    page.wait_for_function("document.body.classList.contains('drive-locked')")
    assert page.locator('dialog[data-nonmodal=true][open]').count()==0
    for _,dialog,title in modules:assert 'Example A' not in page.locator('#'+title).inner_text() and 'Example B' not in page.locator('#'+title).inner_text()
    for id in ['med-content','vitals-content','immunizations-content','history-content','demographics-content']:assert page.locator('#'+id).text_content()==''
    assert not errors,errors
    browser.close()
print('PASS: five concurrent nonmodal viewers, pinned resident identity, stacking/focus, modal edits, draft isolation, bounds and restore')
