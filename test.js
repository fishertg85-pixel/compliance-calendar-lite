const IL=require('./engine.js'); let f=0;
const eq=(a,b,m)=>{ if(JSON.stringify(a)!==JSON.stringify(b)){f++;console.log('FAIL',m,JSON.stringify(a),'!=',JSON.stringify(b));} else console.log('ok  ',m); };
// dates
eq(IL.addMonths('2026-01-31',1),'2026-02-28','EOM clamp Feb');
eq(IL.addMonths('2026-01-31',2,31),'2026-03-31','anchor day restores 31');
eq(IL.addInterval('2024-02-29',1,'year'),'2025-02-28','leap -> non-leap');
eq(IL.addInterval('2026-11-13',-1,'month'),'2026-10-13','negative month');
eq(IL.diffDays('2026-12-01','2026-11-13'),18,'diff');
eq(IL.addDays('2026-12-31',1),'2027-01-01','year rollover');
const today='2026-11-13', to='2027-12-31';
const run=(ob,trk,recs,events,ts)=>IL.trackOccurrences({ob,trk,recs,events,today,to,trackStart:ts||today});
// rolling: DEA biennial
const bi={rec:{kind:'rolling',n:2,unit:'year'},lead:90};
let o=run(bi,{baselineDate:'2025-03-10'},[]); 
eq(o[0].due,'2027-03-10','rolling due from baseline'); eq(o[0].status,'upcoming','rolling upcoming (>90d)');
o=run(bi,{baselineDate:'2024-12-01'},[]); eq([o[0].due,o[0].status],['2026-12-01','due-soon'],'rolling due-soon');
o=run(bi,{baselineDate:'2024-10-01'},[]); eq([o[0].due,o[0].status,o[0].days],['2026-10-01','overdue',-43],'rolling overdue');
o=run(bi,{},[]); eq(o[0].status,'nobaseline','no baseline flagged');
o=run(bi,{firstDue:'2026-12-20'},[]); eq(o[0].due,'2026-12-20','firstDue used when never done');
// early completion resets chain from actual date
o=run(bi,{baselineDate:'2025-01-15'},[{id:'a',completedOn:'2026-11-01'}]);
eq(o.map(x=>x.status+':'+x.due).slice(0,2),['done:2027-01-15','upcoming:2028-11-01'],'early completion shortens/reset chain');
// late completion recorded as late
o=run({rec:{kind:'rolling',n:12,unit:'month'},lead:30},{baselineDate:'2025-06-01'},[{id:'b',completedOn:'2026-06-20'}]);
eq([o[0].status,o[0].lateDays],['late-done',19],'late completion recorded late');
eq(o[1].due,'2027-06-20','next due from actual completion');
// projected occurrences
o=run({rec:{kind:'rolling',n:6,unit:'month'},lead:30},{baselineDate:'2026-10-01'},[]);
eq(o.filter(x=>x.projected).map(x=>x.due),['2027-10-01'],'projection within horizon only');
// fixed monthly EOM, tracking start mid-month
const mo={rec:{kind:'fixed',n:1,unit:'month',anchor:'2026-12-31'},lead:7};
o=run(mo,{},[]).slice(0,4); eq(o.map(x=>x.due),['2026-11-30','2026-12-31','2027-01-31','2027-02-28'],'fixed monthly EOM sequence');
eq(o[0].status,'upcoming','Nov 30 upcoming (17 days)');
o=run(mo,{},[{id:'c',completedOn:'2026-11-20',forDue:'2026-11-30'}]); eq(o[0].status,'done','fixed done matched by forDue');
o=run(mo,{},[],[],'2026-09-01'); eq(o.filter(x=>x.status==='overdue').map(x=>x.due),['2026-09-30','2026-10-31'],'missed months overdue when tracking started earlier');
o=run(mo,{},[{id:'d',completedOn:'2026-12-02',forDue:'2026-11-30'}]); eq([o[0].status,o[0].lateDays],['late-done',2],'fixed late');
// fixed annual May 1 with past anchor
const may={rec:{kind:'fixed',n:1,unit:'year',anchor:'2026-05-01'},lead:45};
o=run(may,{},[]); eq(o[0].due,'2027-05-01','annual May 1 next occurrence'); eq(o.length,1,'annual: one occurrence inside horizon');
o=run(may,{},[],[],'2026-01-01'); eq([o[0].due,o[0].status],['2026-05-01','overdue'],'May 1 overdue if tracking started before');
// daily/weekly
const wk={rec:{kind:'fixed',n:1,unit:'week',anchor:'2026-11-02'},lead:1};
o=run(wk,{},[]).slice(0,2); eq(o.map(x=>x.due),['2026-11-16','2026-11-23'],'weekly sequence');
const dy={rec:{kind:'fixed',n:1,unit:'day',anchor:'2026-01-01'},lead:0};
o=run(dy,{},[]).slice(0,2); eq(o.map(x=>x.due),['2026-11-13','2026-11-14'],'daily sequence from trackStart');
// expiry
const ex={rec:{kind:'expiry',windowDays:60},lead:90};
o=run(ex,{firstDue:'2027-01-10'},[]); eq([o[0].due,o[0].status,o[0].canAct,o[0].openDate],['2027-01-10','due-soon',false,'2026-11-11'].map((x,i)=>i==2?true:x),'expiry window open flag');
o=run(ex,{firstDue:'2027-03-01'},[]); eq([o[0].status,o[0].canAct],['upcoming',false],'expiry window closed');
o=run(ex,{firstDue:'2026-11-01'},[{id:'e',completedOn:'2026-11-05',nextDue:'2029-11-01'}]);
eq(o.map(x=>x.status+':'+x.due),['late-done:2026-11-01','upcoming:2029-11-01'],'expiry renewal late then next');
o=run(ex,{},[]); eq(o[0].status,'nobaseline','expiry no date flagged');
// event
const evr={rec:{kind:'event',offset:10,direction:'after'},lead:3};
o=run(evr,{},[],[{id:'v1',eventDate:'2026-11-08'}]); eq([o[0].due,o[0].status],['2026-11-18','upcoming'],'event +10 (5 days out, lead 3)');
o=run(evr,{},[{id:'r',completedOn:'2026-11-12',forEvent:'v1'}],[{id:'v1',eventDate:'2026-11-08'}]); eq(o[0].status,'done','event done');
o=run({rec:{kind:'event',offset:14,direction:'before'},lead:3},{},[],[{id:'v2',eventDate:'2026-12-20'}]); eq(o[0].due,'2026-12-06','event before');
// void ignored, once
o=run(bi,{baselineDate:'2025-03-10'},[{id:'v',completedOn:'2026-11-01',status:'void'}]); eq(o[0].due,'2027-03-10','void record ignored');
o=run({rec:{kind:'once',due:'2026-11-20'},lead:7},{},[]); eq(o[0].status,'due-soon','once due-soon');
// stats
const all=run(mo,{},[{id:'c1',completedOn:'2026-09-20',forDue:'2026-09-30'},{id:'c2',completedOn:'2026-11-02',forDue:'2026-10-31'}],[],'2026-08-01');
const s=IL.stats(all,today,'2026-08-01',today); eq([s.on,s.late,s.missed],[1,1,1],'stats: Sep on-time, Oct late, Aug missed (Nov 30 not yet due)');
// ICS
const ics=IL.toICS([{uid:'x1',stamp:'20261113T000000Z',due:'2026-12-01',title:'A; B, C',desc:'line1\nline2'}]); eq(/DTSTART;VALUE=DATE:20261201/.test(ics)&&/A\; B\\, C/.test(ics),true,'ICS escaping');
eq(IL.addInterval('2028-02-29',1,'year',29),'2029-02-28','leap clamp 2029');
eq(IL.addInterval('2028-02-29',4,'year',29),'2032-02-29','leap returns 2032');
eq(IL.addDays('2100-02-28',1),'2100-03-01','2100 is not a leap year');

eq(IL.diffDays('2028-03-01','2027-03-01'),366,'Mar 2027 to Mar 2028 spans Feb 29 2028 = 366 days');
eq(IL.diffDays('2029-03-01','2028-03-01'),365,'Mar 2028 to Mar 2029 = 365 days');
console.log(f?('\n'+f+' FAILED'):'\nALL PASSED'); process.exit(f?1:0);