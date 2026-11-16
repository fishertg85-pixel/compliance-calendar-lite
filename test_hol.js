const US=require('./holidays.js'); let f=0; const ok=(c,m)=>{ if(!c){f++;console.log('FAIL',m);} };
const hol=(y,id)=>{ const o=US.holidays(y); for(const d in o){ if(o[d].some(x=>x.kind==='hol'&&x.hid===id))return d; } };
// Federal Reserve K.8 (verified 2026-11-13): 2026..2030
const K8={2026:{mlk:'01-19',presidents:'02-16',memorial:'05-25',juneteenth:'06-19',july4:'07-04',labor:'09-07',columbus:'10-12',veterans:'11-11',thanks:'11-26',xmas:'12-25'},
 2027:{newyear:'01-01',mlk:'01-18',presidents:'02-15',memorial:'05-31',juneteenth:'06-19',july4:'07-04',labor:'09-06',columbus:'10-11',thanks:'11-25',xmas:'12-25'},
 2028:{newyear:'01-01',mlk:'01-17',presidents:'02-21',memorial:'05-29'},
 2029:{newyear:'01-01',mlk:'01-15',presidents:'02-19',memorial:'05-28'},
 2030:{mlk:'01-21',presidents:'02-18',memorial:'05-27'}};
for(const y in K8)for(const id in K8[y])ok(hol(+y,id)===y+'-'+K8[y][id],y+' '+id+' got '+hol(+y,id));
ok(US.fedList(2020).length===10&&US.fedList(2021).length===11,'juneteenth from 2021');
const has=(d,k,id)=>(US.day(d)||[]).some(x=>x.kind===k&&(!id||x.hid===id));
ok(has('2026-07-03','obs','july4'),'2026 Jul 3 observed (Sat Jul 4)'); ok(!US.day('2026-07-03').find(x=>x.kind==='obs').mon,'Sat holiday: banks open Friday');
ok(has('2027-07-05','obs','july4')&&US.day('2027-07-05').find(x=>x.kind==='obs').mon,'2027 Jul 5 observed, banks closed');
ok(has('2027-06-18','obs','juneteenth'),'2027 Juneteenth observed Fri Jun 18');
ok(has('2027-12-24','obs','xmas')&&has('2027-12-31','obs','newyear'),'2027 Dec 24 xmas obs; Dec 31 new year obs (2028 Sat)');
ok(US.day('2026-02-16').length===1,'Presidents Day plain');
ok(US.easter(2026)==='2026-04-05'&&US.easter(2027)==='2027-03-28'&&US.easter(2028)==='2028-04-16','easter');
ok(has('2026-04-03','obs2')&&US.day('2026-05-10').some(x=>x.name==="Mother's Day")&&US.day('2026-06-21').some(x=>x.name==="Father's Day"),'observances');
ok(US.isLeap(2028)&&!US.isLeap(2100)&&US.isLeap(2000)&&!US.isLeap(2026),'leap rules');
ok(US.day('2028-02-29').some(x=>x.kind==='leap')&&!US.day('2027-02-28').some(x=>x.kind==='leap'),'leap day marker');
// DST
const d=y=>Object.keys(US.dst(y,'America/Chicago'));
ok(d(2026).join()==='2026-03-08,2026-11-01','Chicago 2026 DST: '+d(2026));
ok(d(2027).join()==='2027-03-14,2027-11-07','Chicago 2027 DST: '+d(2027));
ok(Object.keys(US.dst(2026,'America/Phoenix')).length===0,'Phoenix none');
ok(Object.keys(US.dst(2026,'America/New_York')).join()==='2026-03-08,2026-11-01','NY DST');
ok(US.dst(2026,'America/Chicago')['2026-03-08'][0].name.includes('Begins'),'begins label');
ok(US.day('2026-11-01',{tz:'America/Chicago'}).some(x=>x.kind==='dst'),'day() includes dst');
// toggles
ok(US.day('2026-12-25',{hol:false}).length===0,'hol off'); ok(US.day('2026-12-24',{obs:false}).length===0,'obs off');
console.log(f?'FAILED '+f:'ALL PASSED');
