"""Synthetic chart, demographics, printable letterhead and logout checks."""
import json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser_helpers import open_bhr,prepare_test_page,unlock_test_drive
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1000},service_workers='block');page=context.new_page();prepare_test_page(page)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    def person(id,last,deceased=False):return {'id':id,'name':'Synthetic '+last,'firstName':'Synthetic','middleName':'M','lastName':last,'preferredName':'Synthetic '+last,'info':'','notes':[],'deceased':deceased,'updatedAt':'2026-01-01T00:00:00Z',**({'photo':{'fileId':'synthetic-portrait','folderId':'root'}} if id=='a' else {})}
    seed={'version':1,'people':[person('z','Zulu'),person('dead','Aardvark',True),person('a','Alpha')]}
    seed['people'][2]['birthDate']={'month':'1','day':'1','year':'1955'}
    page.add_init_script("if(!localStorage.getItem('infirmary.directory.v1'))localStorage.setItem('infirmary.directory.v1',"+json.dumps(json.dumps(seed))+");")
    page.route('https://www.googleapis.com/drive/v3/files/synthetic-portrait?*',lambda route:route.fulfill(content_type='image/png',body=Path('icons/icon-512.png').read_bytes()))
    directory=[seed]
    page.route('https://www.googleapis.com/drive/v3/files/root?*',lambda route:route.fulfill(json={'id':'root','name':'Infirmary-BHR','appProperties':{'bhrWorkspace':'1'},'mimeType':'application/vnd.google-apps.folder','capabilities':{'canAddChildren':True}}))
    page.route('https://www.googleapis.com/drive/v3/files?*',lambda route:route.fulfill(json={'files':[] if 'Medication Lists' in route.request.url or 'BHR_event_log' in route.request.url or 'bhrDesktop' in route.request.url else [{'id':'__test-bootstrap'}]}))
    page.route('https://www.googleapis.com/drive/v3/files/__test-bootstrap?*',lambda route:route.fulfill(json=directory[0]))
    def write(route):
        directory[0]=route.request.post_data_json;route.fulfill(json={'id':'__test-bootstrap'})
    page.route('https://www.googleapis.com/upload/drive/v3/files/__test-bootstrap?*',write)
    page.goto('http://127.0.0.1:8000');unlock_test_drive(page)
    open_bhr(page);assert page.locator('.person.selected strong').inner_text()=='Synthetic Alpha'
    page.locator('#detail .record-pencil').click();assert page.locator('#person-basic-fields [name=dem-sex]').is_visible();page.get_by_label('Sex',exact=True).fill('Custom entry');page.locator('#person-additional-tab').click()
    assert page.locator('#person-additional-fields').is_visible() and page.locator('#person-basic-fields').is_hidden()
    page.get_by_label('Primary care provider',exact=True).fill('Synthetic PCP');page.get_by_label('Patient e-mail address',exact=True).fill('synthetic@example.invalid');page.get_by_label('Primary language',exact=True).fill('Synthetic language');page.get_by_label('Religion',exact=True).fill('Synthetic religion');page.get_by_label('Originally from',exact=True).fill('Synthetic origin');page.get_by_label('Patient address',exact=True).fill('Synthetic private address\nSecond line');page.get_by_label('Home phone number',exact=True).fill('555 0100');page.get_by_label('Cell phone number',exact=True).fill('555 0101');page.get_by_label('Preferred pharmacy',exact=True).fill('Synthetic pharmacy');page.get_by_label('Pharmacy address',exact=True).fill('Synthetic pharmacy address\nSecond pharmacy line');page.get_by_label('Pharmacy phone number',exact=True).fill('555 0103');page.get_by_label('Pharmacy fax number',exact=True).fill('555 0104')
    assert page.locator('#dem-sex-options option').evaluate_all('(items)=>items.map(item=>item.value)')==['Male','Female']
    page.get_by_label('Social Security Number',exact=True).fill('000-00-0000')
    page.get_by_label('Race/ethnicity',exact=True).fill('Synthetic ethnicity');page.get_by_label('Nationality',exact=True).fill('Synthetic nationality')
    page.locator('#dem-add-contacts').click();contact=page.locator('#dem-contacts fieldset').first;contact.get_by_label('Name',exact=True).fill('Synthetic contact');contact.get_by_label('Relationship to patient').fill('Sibling');contact.get_by_label('Phone number',exact=True).fill('555 0102');contact.get_by_label('Emergency contact',exact=True).check()
    page.locator('#dem-add-contacts').click();page.locator('#dem-contacts fieldset').last.get_by_label('Name',exact=True).fill('Synthetic second contact')
    page.locator('#dem-add-policies').click();policy=page.locator('#dem-policies fieldset');policy.get_by_label('Insurance company',exact=True).fill('Synthetic insurer');policy.get_by_label('Policy / member number',exact=True).fill('Synthetic policy number')
    page.locator('#person-submit').click();page.wait_for_function("!document.querySelector('#person-dialog').open")
    saved=page.evaluate("JSON.parse(localStorage.getItem('infirmary.directory.v1')).people.find(p=>p.id==='a').demographics")
    assert saved['sex']=='Custom entry' and saved['ssn']=='000-00-0000'
    assert page.locator('#detail .age').inner_text()=='71 y.o. Custom entry.'
    assert '000-00-0000' not in page.locator('#detail').inner_text()
    assert '000-00-0000' not in page.evaluate("JSON.stringify(JSON.parse(localStorage.getItem('infirmary.directory.v1')).eventLog)")
    assert saved['raceEthnicity']=='Synthetic ethnicity' and saved['nationality']=='Synthetic nationality'
    assert saved['primaryCareProvider']=='Synthetic PCP' and saved['email']=='synthetic@example.invalid'
    assert saved['pharmacyFax']=='555 0104' and saved['pharmacyAddress']=='Synthetic pharmacy address\nSecond pharmacy line'
    assert saved['contacts'][0]['emergency'] is True and len(saved['contacts'])==2 and saved['policies'][0]['policyNumber']=='Synthetic policy number'
    page.get_by_role('button',name='Demographics',exact=True).click();assert 'Synthetic private address' in page.locator('#demographics-content').inner_text();assert '000-00-0000' in page.locator('#demographics-content').inner_text()
    pending=[];page.route('**/icons/icon-512.png',lambda route:pending.append(route));page.locator('#demographics-print').click()
    page.wait_for_function("document.querySelector('#bhr-print-frame')?.contentDocument?.body?.textContent.includes('Synthetic private address')")
    identity=page.frame_locator('#bhr-print-frame').locator('.identity p').all_text_contents()
    dob_index=next(i for i,text in enumerate(identity) if text.startswith('Date of birth:'))
    assert identity[dob_index+1]=='71 y.o. Custom entry'
    page.evaluate("()=>{window.printCalls=0;document.querySelector('#bhr-print-frame').contentWindow.print=()=>{window.printCalls++};}")
    page.wait_for_timeout(100);assert pending;pending.pop().fulfill(content_type='image/png',body=Path('icons/icon-512.png').read_bytes())
    page.wait_for_function('window.printCalls===1');frame=page.frame_locator('#bhr-print-frame');assert frame.locator('h1').inner_text()=='Brother Health Records';assert 'Synthetic policy number' in frame.locator('body').inner_text()
    assert frame.locator('.fields').first.locator('dt').all_text_contents()==['Sex:','Social Security Number:','Primary language:','Originally from:','Religion:','Race/ethnicity:','Nationality:','Patient address:','Home phone number:','Cell phone number:','E-mail address:','Primary care provider:']
    assert '000-00-0000' in frame.locator('body').inner_text()
    assert frame.locator('thead tr').count()==1 and frame.locator('.fields dd').filter(has_text='Synthetic private address').count()==1
    assert page.locator('body > img[src*="abbey-letterhead"]').count()==0
    assert frame.locator('.profile-photo').count()==1
    photo_url=frame.locator('.profile-photo').get_attribute('src')
    page.evaluate("window.revoked=[];const revoke=URL.revokeObjectURL.bind(URL);URL.revokeObjectURL=url=>{window.revoked.push(url);revoke(url)}")
    preview=page.context.new_page();preview.set_viewport_size({'width':816,'height':1056});preview.route('**/print-preview-test',lambda route:route.fulfill(body='<!doctype html><html><body></body></html>',content_type='text/html'));preview.goto('http://127.0.0.1:8000/print-preview-test');preview.set_content(page.locator('#bhr-print-frame').evaluate('frame=>frame.contentDocument.documentElement.outerHTML'));preview.locator('header img').evaluate('image=>image.decode()');preview.locator('.profile-photo').evaluate('image=>image.decode()');preview.screenshot(path='/tmp/bhr-demographics-print.png');preview.pdf(path='/tmp/bhr-demographics-print.pdf',format='Letter',display_header_footer=True);preview.close();assert 'Pages:           1' in subprocess.check_output(['pdfinfo','/tmp/bhr-demographics-print.pdf'],text=True)
    page.evaluate("document.querySelector('#bhr-print-frame').contentWindow.dispatchEvent(new Event('afterprint'))")
    assert page.locator('#bhr-print-frame').count()==0 and photo_url in page.evaluate('window.revoked')
    page.locator('#demographics-dialog [data-close]').click();page.locator('#detail .record-pencil').click();page.locator('#person-additional-tab').click();assert page.get_by_label('Sex',exact=True).input_value()=='Custom entry';assert page.get_by_label('Primary language',exact=True).input_value()=='Synthetic language';page.locator('#person-dialog [data-close]').click()
    page.set_viewport_size({'width':390,'height':844});page.get_by_role('button',name='Demographics',exact=True).click();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.locator('#demographics-dialog [data-close]').click()
    page.locator('.person strong').filter(has_text='Synthetic Zulu').click()
    page.locator('#logout-power').click();page.locator('#confirm-logout').click();page.wait_for_function("document.body.classList.contains('drive-locked')")
    assert 'Synthetic private address' not in page.locator('body').text_content();assert page.locator('#dem-contacts').inner_text()=='';assert page.get_by_label('Primary language',exact=True).input_value()=='';assert page.get_by_label('Social Security Number',exact=True).input_value()=='';assert page.locator('#bhr-print-frame').count()==0
    page.route('https://www.googleapis.com/drive/v3/files?*staff_profile_*',lambda route:route.fulfill(json={'files':[{'id':'synthetic-staff-profile'}]}))
    page.route('https://www.googleapis.com/drive/v3/files/synthetic-staff-profile?*',lambda route:route.fulfill(json={'version':1,'issuer':'https://accounts.google.com','subject':'synthetic-staff','displayName':'Synthetic Staff'}))
    page.locator('#google-connect').click();page.locator('#use-drive-root').click();page.wait_for_function("!document.body.classList.contains('drive-locked')")
    open_bhr(page);assert page.locator('.person.selected strong').inner_text()=='Synthetic Alpha'
    assert directory[0]['people'][2]['demographics']['language']=='Synthetic language'
    assert not errors,errors
    browser.close()
print('PASS: deterministic initial chart; additional information tabs; structured contacts/policies save and reload; demographics; print-only letterhead; standard print invocation; mobile; logout cleanup')
