"""Synthetic optional-allergy states, editor toggling, safe rendering and persistence."""
from playwright.sync_api import sync_playwright
from browser_helpers import prepare_test_page,unlock_test_drive
import json
seed={'version':1,'people':[{'id':'p','name':'Synthetic Brother','info':'','updatedAt':'2026-01-01T00:00:00Z','notes':[]}]}
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':900},service_workers='block');prepare_test_page(page)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.add_init_script("if(!localStorage.getItem('infirmary.directory.v1'))localStorage.setItem('infirmary.directory.v1',"+json.dumps(json.dumps(seed))+");")
    page.goto('http://127.0.0.1:8000');unlock_test_drive(page)
    assert page.locator('#detail .allergies').count()==0
    page.get_by_label('Edit this record',exact=True).click()
    text=page.get_by_label('Allergies:',exact=True);check=page.get_by_label('No known allergies',exact=True)
    assert text.input_value()=='' and not text.is_disabled() and not check.is_checked()
    value='Synthetic substance\n<script>synthetic text</script>'
    text.fill(value);check.check()
    assert text.is_disabled()
    assert page.locator('#allergy-fields').evaluate('el=>Number(getComputedStyle(el).opacity)<1')
    check.uncheck();assert text.input_value()==value and text.is_enabled()
    page.locator('#person-submit').click()
    assert page.locator('#detail .allergies').inner_text()=='Allergies: '+value
    assert page.locator('#detail .age + .allergies').count()==1
    assert page.locator('#detail script').count()==0
    page.reload();unlock_test_drive(page)
    assert page.locator('#detail .allergies').inner_text()=='Allergies: '+value
    page.get_by_label('Edit this record',exact=True).click();check.check();page.locator('#person-submit').click()
    assert page.locator('#detail .allergies').inner_text()=='No known allergies'
    saved=page.evaluate("JSON.parse(localStorage.getItem('infirmary.directory.v1')).people[0]")
    assert saved['noKnownAllergies'] is True and saved['allergies']==''
    page.get_by_label('Edit this record',exact=True).click()
    assert check.is_checked() and text.is_disabled()
    check.uncheck();assert text.input_value()==''
    page.locator('#person-submit').click();assert page.locator('#detail .allergies').count()==0
    page.set_viewport_size({'width':390,'height':844})
    page.locator('#add-person').click();page.get_by_label('First name',exact=True).fill('Synthetic New')
    assert not check.is_checked() and text.is_enabled()
    page.locator('#person-submit').click();assert page.locator('#detail .allergies').count()==0
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors,errors
    browser.close()
print('PASS: optional allergies; disabled/dimmed checkbox state; safe below-age display; reload; blank omission; new-person defaults; mobile')
