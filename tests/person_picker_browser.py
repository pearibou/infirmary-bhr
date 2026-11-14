"""Synthetic duplicate preferred names in the three native clinical person selectors."""
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
    page.goto('http://127.0.0.1:8000');unlock_test_drive(page,open_records=False)
    for icon,dialog,select in [('vitals-icon','vitals-dialog','vitals-person'),('immunizations-icon','immunizations-dialog','immunizations-person'),('medications-icon','medications-dialog','med-person')]:
        page.locator('#'+icon).dblclick()
        picker=page.locator('#'+select)
        assert picker.locator('option[value=synthetic-a]').text_content()=='Brother Synthetic John — John Example A · DOB: 01/02/1940'
        assert picker.locator('option[value=synthetic-b]').text_content()=='Brother Synthetic John — John Example B · DOB: 01/03/1940'
        assert picker.locator('optgroup[label=Deceased] option').text_content()=='Synthetic Departed · DOB: —/—/— (Deceased)'
        assert all('\n' not in text for text in picker.locator('option').all_text_contents())
        picker.select_option('synthetic-b');page.wait_for_function('(id)=>!document.getElementById(id).disabled',arg=select)
        assert picker.input_value()=='synthetic-b'
        page.set_viewport_size({'width':390,'height':844})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert picker.locator('option:checked').text_content()=='Brother Synthetic John — John Example B · DOB: 01/03/1940'
        page.set_viewport_size({'width':1440,'height':1000});page.locator('#'+dialog+' [data-close]').click()
    assert not errors,errors
    browser.close()
print('PASS: full name/DOB native one-line selectors, duplicate preferred names, stable IDs, deceased grouping and mobile layout')
