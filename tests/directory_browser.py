from browser_helpers import prepare_test_page,unlock_test_drive,open_drive,fill_death_date
"""Synthetic directory grouping, plum deceased entries, middle-name persistence and avatar icon."""
from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1280,'height':900},service_workers='block')
    def record(id,first,last,preferred,deceased=False):
        return {'id':id,'name':preferred,'firstName':first,'lastName':last,'preferredName':preferred,'deceased':deceased,'info':'','updatedAt':'2026-01-01T00:00:00Z','notes':[]}
    data={'version':1,'people':[record('a','Zed','Zulu','Brother Alpha'),record('b','Amy','Adams','Brother Zulu'),record('c','Caleb','Zulu','Brother Cedar',True),record('d','David','Adams','Brother Delta',True)]}
    page.add_init_script("if(!localStorage.getItem('infirmary.directory.v1'))localStorage.setItem('infirmary.directory.v1',"+json.dumps(json.dumps(data))+");")
    prepare_test_page(page)
    page.goto('http://127.0.0.1:8000')
    unlock_test_drive(page,profile=True)
    names=lambda:page.locator('.person strong').all_text_contents()
    assert names()==['Brother Zulu','Brother Alpha','Brother Delta','Brother Cedar']
    assert page.locator('.directory-divider').count()==1
    assert page.locator('.directory-divider').evaluate('(el)=>parseFloat(getComputedStyle(el).borderTopWidth)')>=5
    assert page.locator('.deceased-row').count()==2
    assert page.locator('.deceased-row .person').first.evaluate('(el)=>getComputedStyle(el).color')=='rgb(96, 71, 94)'
    page.locator('.person').filter(has_text='Brother Delta').click()
    assert page.get_by_role('img',name='Deceased — crucifix',exact=True).is_visible()
    assert page.locator('.person-header .avatar').inner_text()=='BD'
    page.locator('.person').filter(has_text='Brother Alpha').click()
    assert page.get_by_role('img',name='Deceased — crucifix',exact=True).count()==0
    page.get_by_role('button',name='Edit this record',exact=True).click()
    dialog=page.locator('#person-dialog')
    assert 'Death record' not in dialog.inner_text()
    dialog.get_by_label('Middle name / initial',exact=True).fill('J.')
    dialog.get_by_label('This person is deceased',exact=True).check()
    dialog.get_by_role('button',name='Save record',exact=True).click()
    assert names()==['Brother Zulu','Brother Delta','Brother Cedar','Brother Alpha']
    assert page.locator('.person-header h2').inner_text()=='Brother Alpha'
    assert page.get_by_role('img',name='Deceased — crucifix',exact=True).is_visible()
    assert page.locator('.legal-name').inner_text()=='Zed J. Zulu'
    assert page.locator('.person').filter(has_text='Brother Alpha').locator('span').inner_text()=='Zed J. Zulu'
    assert page.get_by_text('Middle name / initial: J.',exact=True).count()==0
    page.get_by_role('button',name='Edit this record',exact=True).click()
    assert dialog.get_by_label('Middle name / initial',exact=True).input_value()=='J.'
    dialog.get_by_label('This person is deceased',exact=True).uncheck()
    dialog.get_by_role('button',name='Save record',exact=True).click()
    assert names()==['Brother Zulu','Brother Alpha','Brother Delta','Brother Cedar']
    assert page.locator('.deceased-crucifix').count()==0
    page.locator('#search').fill('Caleb')
    assert names()==['Brother Cedar'] and page.locator('.directory-divider').count()==1
    page.locator('#search').fill('J.')
    assert names()==['Brother Alpha']
    page.locator('#search').fill('')
    page.reload()
    unlock_test_drive(page,profile=True)
    assert names()==['Brother Zulu','Brother Alpha','Brother Delta','Brother Cedar']
    page.locator('#add-person').click()
    dialog.get_by_label('Preferred name',exact=True).fill('Brother New')
    dialog.get_by_label('Middle name / initial',exact=True).fill('Genoa')
    dialog.get_by_label('First name',exact=True).fill('John')
    dialog.get_by_label('Last name',exact=True).fill('Smith')
    dialog.get_by_role('button',name='Add person',exact=True).click()
    assert page.locator('.person-header h2').inner_text()=='Brother New'
    assert page.locator('.legal-name').inner_text()=='John Genoa Smith'
    assert page.locator('.person').filter(has_text='Brother New').locator('span').inner_text()=='John Genoa Smith'
    page.get_by_role('button',name='Edit this record',exact=True).click()
    assert dialog.get_by_label('Middle name / initial',exact=True).input_value()=='Genoa'
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    b.close()
    print('PASS: living/deceased surname sorting; divider; plum styling; crucifix only for deceased; middle name New/Edit/search/persistence; unchanged display names; simplified death labels; mobile editor')
