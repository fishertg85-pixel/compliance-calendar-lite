import re
r=lambda f:open(f,encoding='utf-8').read()
eng=r('engine.js'); eng=eng.replace("if (typeof module !== 'undefined') module.exports = IL;","")
seed=r('seed.js').replace("if(typeof module!=='undefined')module.exports={SEED,U};","")
html='''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>IronLedger Compliance Calendar</title>
<style>'''+r('app.css')+'''</style></head><body>
<div id="app"></div><div id="modal"></div>
<script>
'''+eng+'\n'+seed+'\n'+r('holidays.js').replace("if (typeof module !== 'undefined') module.exports = US;",'')+'\n'+r('app1.js')+'\n'+r('app2.js')+'\n'+r('app3.js')+'''
</script></body></html>'''
open('index.html','w',encoding='utf-8').write(html)
bl=html.replace('<title>IronLedger Compliance Calendar</title>','<title>IronLedger Compliance Calendar (New Pharmacy)</title>').replace('<script>\n','<script>\nwindow.IL_BLANK=true;\n',1)
open('calendar_blank.html','w',encoding='utf-8').write(bl)
print(len(html))
