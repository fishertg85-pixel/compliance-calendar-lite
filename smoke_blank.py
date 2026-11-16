from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':1440,'height':1200}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    # demo unchanged
    pg.goto('file://'+__import__('os').getcwd()+'/index.html'); pg.wait_for_timeout(1200)
    print('DEMO banner:',pg.evaluate("!!document.querySelector('.banner.demo')"),'people:',pg.evaluate("S.people.length"))
    # blank
    pg=ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file://'+__import__('os').getcwd()+'/calendar_blank.html'); pg.wait_for_timeout(1200)
    print('BLANK welcome:',pg.inner_text('.card .hd'),'| mode',pg.evaluate("S.mode"),'| records',pg.evaluate("S.records.length"),'people',pg.evaluate("S.people.length"))
    pg.click('[data-act=wizard]'); pg.wait_for_timeout(300)
    print('intro:',pg.inner_text('#modal')[:120].replace('\n',' | '))
    pg.fill('#f_name','Test Pharmacy'); pg.click('[data-act=msave]'); pg.wait_for_timeout(800)
    print('live:',pg.evaluate("S.mode"),'tab',pg.evaluate("UI.tab"),'banner demo:',pg.evaluate("!!document.querySelector('.banner.demo')"))
    for t in ['dashboard','calendar','obligations','review','docs','people','audit','setup']:
        pg.click(f'nav.tabs button[data-v={t}]'); pg.wait_for_timeout(250)
        bad=pg.evaluate("[...document.querySelectorAll('.banner.bad')].map(e=>e.innerText)")
        print(t,'ok' if not bad else bad)
    print('records after start:',pg.evaluate("S.records.length"),'events',pg.evaluate("S.events.length"))
    pg.reload(); pg.wait_for_timeout(1200); print('after reload mode:',pg.evaluate("S.mode"),pg.evaluate("S.profile.name"))
    pg.click('nav.tabs button[data-v=calendar]'); pg.wait_for_timeout(300); pg.screenshot(path='blank_cal.png')
    # host adapter
    pg2=ctx.new_page(); pg2.on('pageerror',lambda e:errs.append(str(e)))
    pg2.add_init_script("window.__saved=null;window.ILHOST={user:{name:'Test User'},canStart:true,load:async()=>window.__saved,save:async(s)=>{window.__saved=JSON.parse(JSON.stringify(s));}}")
    pg2.goto('file://'+__import__('os').getcwd()+'/calendar_blank.html'); pg2.wait_for_timeout(1200)
    pg2.click('[data-act=wizard]'); pg2.fill('#f_name','Host Pharm'); pg2.click('[data-act=msave]'); pg2.wait_for_timeout(1800)
    print('host kind:',pg2.evaluate("Store.kind"),'saved name:',pg2.evaluate("window.__saved&&window.__saved.profile.name"))
    print('ERRORS',errs); b.close()
