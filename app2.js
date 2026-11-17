/* ===== view helpers ===== */
const subjName=t=>t.subj.name;
const whoName=t=>t.who?t.who.name:'Unassigned';
const inSite=t=>!UI.site||!t.subj.siteId||t.subj.siteId===UI.site;
function passF(o){ const t=o.track; if(UI.fCat&&t.ob.cat!==UI.fCat)return false; if(UI.fWho&&(!t.who||t.who.id!==UI.fWho))return false; return true; }
function findOcc(tk,key){ return D.occs.find(o=>o.trackKey===tk&&o.key===key); }
function whenCell(o){ if(o.done)return o.rec&&o.rec.status==='na'?'Not Applicable':'Done '+fmtS(o.rec.completedOn); if(o.days==null)return ''; return whenText(o.days); }
function occRow(o,withAct){
  const t=o.track;
  return '<tr class="click" data-act="occ" data-t="'+esc(o.trackKey)+'" data-k="'+esc(o.key)+'"><td title="'+esc(t.ob.title)+'">'+esc(t.ob.title)+'</td><td>'+esc(subjName(t))+'</td><td class="num">'+(o.due?fmt(o.due):'—')+'</td><td>'+pill(o.status)+workPill(o)+revPill(o)+'</td><td class="mut">'+esc(whenCell(o))+'</td><td>'+esc(whoName(t))+'</td>'+(withAct?'<td><button class="btn sm pri" data-act="occ" data-t="'+esc(o.trackKey)+'" data-k="'+esc(o.key)+'">'+(o.status==='nobaseline'?'Set Baseline':(workOf(o.trackKey,o.key)?'Continue Task':'Start Task'))+'</button></td>':'')+'</tr>';
}
const occHead=a=>'<tr><th>Item</th><th>For</th><th>Due</th><th>Status</th><th>When</th><th>Responsible</th>'+(a?'<th></th>':'')+'</tr>';
function openOccs(){ return D.list.filter(o=>!o.done&&!o.projected&&passF(o)&&inSite(o.track)); }
function filtersHtml(){
  const cats=CATS_ORDER.concat(['Custom']);
  const who=S.people.filter(p=>!p.archived);
  return '<div class="row"><span class="ctl">Category <select data-chg="fCat"><option value="">All</option>'+cats.map(c=>'<option'+(UI.fCat===c?' selected':'')+'>'+esc(c)+'</option>').join('')+'</select></span><span class="ctl">Responsible <select data-chg="fWho"><option value="">All</option>'+who.map(p=>'<option value="'+esc(p.id)+'"'+(UI.fWho===p.id?' selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></span></div>';
}
function empty(msg){ return '<div class="body mut">'+msg+'</div>'; }

/* ===== getting started ===== */
function setupSteps(){
  const sites=S.sites.filter(s=>!s.archived), ppl=S.people.filter(p=>!p.archived), f=S.profile.features;
  const nob=D.noBase.filter(o=>!o.track.ob.routine).length; const s=[];
  s.push({ok:sites.length>0&&sites.every(x=>x.tsbpExpiry&&(!f.controlled||x.deaExpiry)),t:'Enter License Dates For Each Pharmacy',d:'DEA and TSBP expiration dates start the renewal reminders.',a:sites.length?'editsite':'newsite',id:(sites.find(x=>!(x.tsbpExpiry&&(!f.controlled||x.deaExpiry)))||sites[0]||{}).id,b:'Open Pharmacy'});
  s.push({ok:DUTIES.every(d=>ppl.some(p=>(p.duties||[]).includes(d))),t:'Assign The Owner, PIC and Designated Person Duties',d:'Duties decide who is responsible for each item. Until then items show Unassigned.',a:'newperson',b:'Add Person'});
  s.push({ok:ppl.some(p=>(p.role==='Pharmacist'||p.role==='Technician')&&p.licExpiry),t:'Add Pharmacists and Technicians With License Dates',d:'License expirations and training groups create each person\'s items.',a:'newperson',b:'Add Person'});
  if(f.sterile) s.push({ok:S.rooms.some(r=>!r.archived)&&S.equipment.some(e=>e.pec&&!e.archived),t:'Set Up Cleanrooms And PECs',d:'Certification schedules attach to each room and each PEC.',a:'newroom',b:'Add Room'});
  else if(f.hazardous) s.push({ok:S.equipment.some(e=>!e.archived),t:'Add Hoods, Rooms and Other Equipment',d:'Certification schedules attach to each piece of equipment.',a:'newequip',b:'Add Equipment'});
  s.push({ok:S.documents.some(d=>!d.archived),t:'Add Policies, SOPs and Forms',d:'Each document gets its own review schedule.',a:'newdoc',b:'Add Document'});
  s.push({ok:nob===0,t:'Enter Starting Records',d:nob?nob+' items still have no last-done or expiration date.':'Every item has a starting date.',a:'bulk',b:'Enter Starting Records'});
  return s;
}
function checklistHtml(){
  const st=setupSteps(); const done=st.filter(x=>x.ok).length; if(done===st.length)return '';
  return '<div class="card"><div class="hd"><h2>Getting Started</h2><span class="sub">'+done+' of '+st.length+' Done</span></div><div class="tw"><table>'+st.map(x=>'<tr><td style="width:36px">'+(x.ok?pill('done','Done'):pill('upcoming','To Do'))+'</td><td style="max-width:none;white-space:normal"><b>'+esc(x.t)+'</b><div class="mut" style="font-size:13px">'+esc(x.d)+'</div></td><td style="text-align:right">'+(x.ok?'':'<button class="btn sm pri" data-act="'+x.a+'"'+(x.id?' data-id="'+esc(x.id)+'"':'')+'>'+esc(x.b)+'</button>')+'</td></tr>').join('')+'</table></div></div>';
}
function liveDate(pred,fallback){ const o=D.occs.find(x=>!x.done&&x.due&&pred(x)); return o?o.due:fallback; }

/* ===== dashboard ===== */
function vDashboard(){
  const today=D.today, open=openOccs();
  const over=open.filter(o=>o.status==='overdue'), soon=open.filter(o=>o.status==='due-soon'), nob=open.filter(o=>o.status==='nobaseline');
  const next30=open.filter(o=>(o.status==='upcoming'||o.status==='due-soon')&&o.days<=30);
  const st=IL.stats(D.occs.filter(o=>inSite(o.track)),today,IL.addDays(today,-365),today);
  const rate=st.onTimeRate==null?'—':Math.round(st.onTimeRate*100)+'%';
  let h=(S.mode==='live'?checklistHtml():'')+(nob.length?'<div class="banner bad"><span><b>'+nob.length+(nob.length===1?' Item Has':' Items Have')+' No Starting Record.</b> Enter the last completion or expiration dates so due dates can be calculated.</span><button class="btn sm pri" data-act="bulk">Enter Starting Records</button></div><div style="height:12px"></div>':'')+'<div class="tiles">'+
   '<div class="tile bad"><div class="n">'+over.length+'</div><div class="l">Overdue</div></div>'+
   '<div class="tile warn"><div class="n">'+soon.length+'</div><div class="l">Due Soon</div></div>'+
   '<div class="tile acc"><div class="n">'+next30.length+'</div><div class="l">Due In 30 Days</div></div>'+
   '<div class="tile '+(nob.length?'bad':'ok')+'"><div class="n">'+nob.length+'</div><div class="l">No Record Yet</div></div>'+
   '<div class="tile ok"><div class="n">'+rate+'</div><div class="l">On Time, Last 12 Months</div></div></div>';
  const att=over.concat(soon,nob).sort((a,b)=>(a.due||'0000')<(b.due||'0000')?-1:1);
  h+='<div class="card"><div class="hd"><h2>Needs Attention</h2><span class="sub">Overdue, due within the lead time, and items with no starting record</span><span class="spacer"></span>'+filtersHtml()+'</div>';
  h+=att.length?'<div class="tw"><table>'+occHead(true)+att.slice(0,40).map(o=>occRow(o,true)).join('')+'</table></div>'+(att.length>40?'<div class="body mut">Showing 40 of '+att.length+'. Open Obligations for the full list.</div>':''):empty('Nothing is overdue or due soon.');
  h+='</div>';
  const evt=D.tracks.filter(t=>t.ob.rec.kind==='event'&&!t.inactive&&inSite(t));
  if(evt.length) h+='<div class="card"><div class="hd"><h2>Something Changed?</h2><span class="sub">Log an event and its deadlines appear on the calendar</span></div><div class="body row">'+evt.map(t=>'<button class="btn" data-act="newev" data-t="'+esc(t.key)+'">'+esc(t.ob.title)+'</button>').join('')+'</div></div>';
  const up=open.filter(o=>o.status==='upcoming'&&o.days<=90).sort((a,b)=>a.due<b.due?-1:1);
  h+='<div class="card"><div class="hd"><h2>Coming Up</h2><span class="sub">Next 90 days</span></div>'+(up.length?'<div class="tw"><table>'+occHead(false)+up.slice(0,30).map(o=>occRow(o,false)).join('')+'</table></div>':empty('Nothing else due in the next 90 days.'))+'</div>';
  const rt=D.tracks.filter(t=>t.ob.routine&&!t.inactive&&inSite(t));
  if(rt.length){
    h+='<div class="card"><div class="hd"><h2>Daily Routine Checks</h2><span class="sub">Logged once a day; not listed in the calendar</span></div><div class="tw"><table><tr><th>Check</th><th>For</th><th>Last 30 Days</th><th>Today</th><th></th></tr>'+rt.map(t=>{
      const oc=D.occs.filter(o=>o.trackKey===t.key&&o.due>=IL.addDays(today,-29)&&o.due<=today);
      const dn=oc.filter(o=>o.done&&o.rec.status!=='na').length;
      const todayDone=oc.some(o=>o.done&&o.rec&&o.rec.completedOn===today);
      return '<tr><td>'+esc(t.ob.title)+'</td><td>'+esc(subjName(t))+'</td><td class="num">'+dn+' of '+oc.length+' Logged</td><td>'+(todayDone?pill('done','Logged'):pill('upcoming','Not Yet'))+'</td><td>'+(todayDone?'':'<button class="btn sm" data-act="routine" data-t="'+esc(t.key)+'">Log Today</button>')+'</td></tr>';
    }).join('')+'</table></div></div>';
  }
  if(!S.sites.length) h='<div class="banner info">Add a pharmacy first: open Setup.</div>'+h;
  return h;
}

/* ===== calendar facts: hours, holidays, clock ===== */
const DOWN=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const toMin=t=>{ const p=String(t).split(':'); return (+p[0])*60+(+p[1]||0); };
function t12(min){ min=Math.min(min,1440); let h=Math.floor(min/60)%24, m=min%60; const ap=(min>=720&&min<1440)?'PM':'AM'; const hh=h%12===0?12:h%12; return hh+':'+String(m).padStart(2,'0')+' '+ap; }
const dowOfDate=d=>new Date(d+'T00:00:00Z').getUTCDay();
function nowIn(tz){
  const f=new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',weekday:'short',timeZoneName:'short'}); const p={}; f.formatToParts(new Date()).forEach(x=>p[x.type]=x.value);
  return {date:p.year+'-'+p.month+'-'+p.day,min:(+p.hour%24)*60+(+p.minute),s:+p.second,abbr:p.timeZoneName,dow:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(p.weekday),hh:+p.hour%24,mm:p.minute};
}
/* Hours for a date, honoring weekly hours and holiday closures. Returns {closed,reason} or {closed:false,o,c,text} */
/* Closed days the pharmacy sets on its account page (the Account Owner): yearly observances + dated days. Read live from the host, so a change shows
   for everyone who opens the calendar without anyone re-saving it. Returns the day's name, or null. */
const CLOSE_NAMES={goodfriday:'Good Friday',easter:'Easter Sunday',blackfriday:'Day After Thanksgiving',xmaseve:'Christmas Eve',nyeve:"New Year's Eve"};
const CLOSE_BY_OBS={'Good Friday':'goodfriday','Easter Sunday':'easter','Black Friday':'blackfriday','Christmas Eve':'xmaseve',"New Year's Eve":'nyeve'};
function pharmClosure(date){
  const c=window.ILHOST&&ILHOST.pharmacy&&ILHOST.pharmacy.closures; if(!c)return null;
  const md=date.slice(5);
  for(const x of (c.days||[])) if(x.d===date||(x.y&&x.d.slice(5)===md))return x.n;
  if((c.obs||[]).length) for(const it of US.day(date,{hol:false,obs:true})){ const id=it.kind==='obs2'&&CLOSE_BY_OBS[it.name]; if(id&&c.obs.includes(id))return CLOSE_NAMES[id]; }
  return null;
}
function hoursFor(date){
  const p=S.profile;
  const cz=pharmClosure(date); if(cz)return {closed:true,reason:cz};
  for(const it of US.day(date,{tz:p.tz,hol:true,obs:false})){ if((it.kind==='hol'||(it.kind==='obs'&&it.mon))&&p.holClosed[it.hid])return {closed:true,reason:it.name.replace(' (Observed)','')+(it.kind==='obs'?' (Observed)':'')}; }
  const h=p.hours[dowOfDate(date)]; if(!h)return {closed:true,reason:DOWN[dowOfDate(date)]+' Is A Regular Day Off'};
  const o=toMin(h.o), c=toMin(h.c);
  return {closed:false,o,c,text:(o===0&&c>=1440)?'Open 24 Hours':t12(o)+' to '+t12(c)};
}
let ADJ={};
function adjustDue(d){
  if(ADJ[d]!==undefined)return ADJ[d]; let r=d;
  if(hoursFor(d).closed){ const dir=S.profile.shift==='prev'?-1:1, t0=localToday(); let f=null,x=d;
    for(let g=0;g<21;g++){ x=IL.addDays(x,dir); if(!hoursFor(x).closed){ f=x; break; } }
    if(f&&dir<0&&(f<t0||f<(S.profile.launchedAt||''))&&d>=t0){ f=null; x=d; for(let g=0;g<21;g++){ x=IL.addDays(x,1); if(!hoursFor(x).closed){ f=x; break; } } }
    if(f)r=f; }
  ADJ[d]=r; return r;
}
function movedNote(o){ return o&&o.moved?'Moved From '+fmtS(o.origDue)+' ('+(hoursFor(o.origDue).reason||'Closed')+')':''; }
function prevOpenDay(date){ let d=date; for(let i=0;i<14;i++){ d=IL.addDays(d,-1); if(!hoursFor(d).closed)return d; } return null; }
function longDate(d){ return DOWN[dowOfDate(d)].slice(0,3)+', '+fmt(d); }
function clockState(){
  const n=nowIn(S.profile.tz); const hrs=hoursFor(n.date); let st,cls;
  if(hrs.closed){ st='Closed: '+hrs.reason; cls='na'; }
  else if(n.min<hrs.o){ st='Closed: Opens '+t12(hrs.o); cls='late-done'; }
  else if(n.min>=hrs.c){ st='Closed: After Hours'; cls='late-done'; }
  else { st=(hrs.o===0&&hrs.c>=1440)?'Open 24 Hours':'Open Until '+t12(hrs.c); cls='done'; }
  const h12=(n.hh%12===0?12:n.hh%12); return {n,st,cls,time:h12+':'+n.mm+':'+String(n.s).padStart(2,'0')+' '+(n.hh>=12?'PM':'AM')+' '+n.abbr};
}
function updateClock(){ const el=$('#clock'); if(!el||!D)return; const c=clockState(); const t=$('#clkT'), s=$('#clkS'), d=$('#clkD'); if(t)t.textContent=c.time; if(d)d.textContent=longDate(c.n.date); if(s){ s.className='pill p-'+c.cls; s.textContent=c.st; } }
const dayFacts=d=>{ const f=US.day(d,{tz:S.profile.tz,hol:UI.showHol,obs:UI.showObs}), cz=pharmClosure(d); return cz?[{kind:'closed',name:'Closed: '+cz,short:'Closed: '+cz,note:'The pharmacy is closed this day (set on the pharmacy account page). Tasks due this day move to the next open day.'}].concat(f):f; };

/* ===== calendar data ===== */
function calData(from,to){ const k=from+'|'+to+'|'+UI.site; if(!CAL_CACHE[k]){ CAL_CACHE[k]=IL.collect(S,D.obs,D.today,from,to,{siteId:UI.site,skipRoutine:true,adjust:adjustDue}).occs; } return CAL_CACHE[k]; }
function calItems(from,to){ return calData(from,to).filter(o=>o.due&&o.due>=from&&o.due<=to&&passF(o)&&inSite(o.track)&&(UI.showProj||!o.projected)); }
/* ===== task workflow helpers ===== */
const workOf=(tk,k)=>(S.work||{})[tk+'|'+k];
const canReview=p=>!!p&&((p.duties||[]).includes('PIC')||(p.duties||[]).includes('Reviewer'));
const meP=()=>S.people.find(x=>x.id===ME);
const nowIso=()=>new Date().toISOString();
function fmtTs(iso){ try{ return new Intl.DateTimeFormat('en-US',{timeZone:S.profile.tz,month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(iso)); }catch(e){ return String(iso||'').slice(0,16).replace('T',' '); } }
const sizeTxt=n=>n>=1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round((n||0)/1024))+' KB';
const failedRes=(ob,res)=>!!(ob&&ob.res&&ob.res.length&&res&&res!==ob.res[0]);
function workTag(tk,k){ const W=workOf(tk,k); if(!W)return ''; const o=findOcc(tk,k); return failedRes(o&&o.track.ob,W.result)?pill('overdue',W.result):pill('upcoming','In Progress'); }
const workPill=o=>{ const x=workTag(o.trackKey,o.key); return x?' '+x:''; };
const revPill=o=>{ const r=o.done&&o.rec&&o.rec.review; if(!r)return ''; return ' '+(r.status==='pending'?pill('late-done','Awaiting Review'):pill('done','Reviewed')); };
const fileUrl=f=>'/_blob/'+f.id;
function attHtml(files,canRemove){ return (files&&files.length)?files.map((f,i)=>'<div class="att"><a href="'+esc(fileUrl(f))+'" target="_blank" rel="noopener" title="'+esc(f.name)+'">'+esc(f.name)+'</a><span class="mut">'+sizeTxt(f.size)+' · '+esc(f.by||'')+' · '+esc(fmtTs(f.at))+'</span>'+(canRemove?'<button class="btn sm" data-act="rmatt" data-i="'+i+'">Remove</button>':'')+'</div>').join(''):'<div class="mut">No Documentation Attached.</div>'; }
function commentsHtml(list){ return (list&&list.length)?list.map(c=>'<div class="cmt"><div class="mut" style="font-size:12px">'+esc(c.by||'Unspecified User')+' · '+esc(fmtTs(c.at))+'</div><div style="white-space:pre-wrap">'+esc(c.text)+'</div></div>').join(''):'<div class="mut">No Comments Yet.</div>'; }
function histHtml(h){ return (h&&h.length)?h.map(x=>'<div class="cmt"><span class="mut" style="font-size:12px">'+esc(fmtTs(x.at))+' · '+esc(x.by||'')+'</span> '+esc(x.act)+'</div>').join(''):''; }
function taskWho(r){ const k=r.task||{}, h=k.hist||[]; const ed=[...new Set(h.filter(x=>/^Saved/.test(x.act)).map(x=>x.by))];
  return {entered:k.enteredBy||r.by||'',started:k.startedBy||'',completed:r.completedBy||'',reviewed:r.review?(r.review.status==='accepted'?r.review.by:'Awaiting Review'):'',edited:ed.join('; ')}; }
const planKey=p=>p.date+(p.allDay?'00:00':p.time)+'|'+(p.title||'');
const remMine=r=>!r.byId||r.byId===ME;
function planItems(from,to){
  const a=Object.keys(S.plans||{}).map(k=>S.plans[k]).filter(p=>p.date>=from&&p.date<=to).filter(p=>{ const o=findOcc(p.t,p.k); return !(o&&o.done)&&(!o||(passF(o)&&inSite(o.track))); });
  const r=Object.keys(S.reminders||{}).map(k=>S.reminders[k]).filter(x=>x.date>=from&&x.date<=to&&remMine(x)).map(x=>({rem:true,t:'rem',k:x.id,date:x.date,time:x.allDay?'':x.time,allDay:!!x.allDay,title:x.title,subj:'Personal Reminder',done:!!x.done}));
  return a.concat(r).sort((x,y)=>planKey(x)<planKey(y)?-1:1);
}
const planLabel=p=>(p.rem&&p.done?'\u2713 ':'')+(p.allDay?'':t12(toMin(p.time))+' ')+p.title;
const planTag=p=>{ if(p.rem)return {t:'Reminder',c:'p-upcoming'}; const h=hoursFor(p.date); if(h.closed)return {t:'Closed Day',c:'p-overdue'}; if(p.allDay)return {t:'All Day',c:'p-upcoming'}; const m=toMin(p.time); return (m<h.o||m>=h.c)?{t:'After Hours',c:'p-due-soon'}:{t:'During Hours',c:'p-done'}; };

/* ===== calendar lower bound: the calendar cannot go back past the day the account was launched ===== */
const launchDate=()=>S.profile.launchedAt;
const launchMonth=()=>launchDate().slice(0,7);
function clampMonth(ym){ return ym<launchMonth()?launchMonth():ym; }
function clampDay(d){ return d<launchDate()?launchDate():d; }
const launchNote=()=>'The calendar starts '+fmt(launchDate())+', the day this account was launched.';

/* ===== calendar views ===== */
const MONSEL=(m,y)=>'<select data-chg="calm" aria-label="Month">'+MONL.map((n,i)=>{ const dis=(y+'-'+String(i+1).padStart(2,'0'))<launchMonth(); return '<option value="'+(i+1)+'"'+(i+1===m?' selected':'')+(dis?' disabled':'')+'>'+n+'</option>'; }).join('')+'</select>';
function calHead(){
  return '<div class="card"><div class="hd"><h2>Compliance Calendar</h2><span class="btn-grp" style="margin-left:12px">'+[['month','Monthly'],['biweek','Bi-Weekly'],['week','Weekly'],['day','Today']].map(v=>'<button class="btn sm'+(UI.calView===v[0]?' pri':'')+'" data-act="calview" data-v="'+v[0]+'">'+v[1]+'</button>').join('')+'</span><span class="spacer"></span>'+filtersHtml()+'</div>';
}
const weekStartOf=d=>IL.addDays(d,-dowOfDate(d));
function navBar(){
  if(UI.calView==='week'||UI.calView==='biweek'){ const nw=UI.calView==='biweek'?2:1, lb=nw===1?'Week':'2 Weeks'; const d=UI.selDay||D.today; const atL=weekStartOf(d)<=launchDate(); return '<div class="row navbar"><button class="btn sm" data-act="daynav" data-u="m" data-d="-1" aria-label="Back one month"'+(atL?' disabled':'')+'>« Month</button><button class="btn sm" data-act="daynav" data-d="'+(-7*nw)+'" aria-label="Previous '+lb+'"'+(atL?' disabled':'')+'>‹ '+lb+'</button><input type="date" data-chg="dayset" min="'+launchDate()+'" value="'+d+'" aria-label="Any date in the range"><button class="btn sm" data-act="daynav" data-d="'+(7*nw)+'" aria-label="Next '+lb+'">'+lb+' ›</button><button class="btn sm" data-act="daynav" data-u="m" data-d="1" aria-label="Forward one month">Month »</button><button class="btn sm" data-act="daynav" data-d="0">Today</button>'+(atL?'<span class="mut" style="font-size:12px">Calendar starts '+fmt(launchDate())+' (account launch)</span>':'')+'</div>'; }
  if(UI.calView==='day'){ const d=UI.selDay||D.today; const atL=d<=launchDate(); return '<div class="row navbar"><button class="btn sm" data-act="daynav" data-d="-7" aria-label="Back one week"'+(atL?' disabled':'')+'>« Week</button><button class="btn sm" data-act="daynav" data-d="-1" aria-label="Previous day"'+(atL?' disabled':'')+'>‹ Day</button><input type="date" data-chg="dayset" min="'+launchDate()+'" value="'+d+'" aria-label="Date"><button class="btn sm" data-act="daynav" data-d="1" aria-label="Next day">Day ›</button><button class="btn sm" data-act="daynav" data-d="7" aria-label="Forward one week">Week »</button><button class="btn sm" data-act="daynav" data-d="0">Today</button></div>'; }
  const [y,m]=UI.calMonth.split('-').map(Number); const atL=UI.calMonth<=launchMonth();
  return '<div class="row navbar"><button class="btn sm" data-act="calnav" data-u="y" data-d="-1" aria-label="Previous year"'+(atL?' disabled':'')+'>« Year</button><button class="btn sm" data-act="calnav" data-u="m" data-d="-1" aria-label="Previous month"'+(atL?' disabled':'')+'>‹ Month</button>'+MONSEL(m,y)+'<input type="number" data-chg="caly" min="'+launchDate().slice(0,4)+'" max="2999" value="'+y+'" aria-label="Year" style="width:88px"><button class="btn sm" data-act="calnav" data-u="m" data-d="1" aria-label="Next month">Month ›</button><button class="btn sm" data-act="calnav" data-u="y" data-d="1" aria-label="Next year">Year »</button><button class="btn sm" data-act="calnav" data-u="t">Today</button>'+(atL?'<span class="mut" style="font-size:12px">Calendar starts '+fmt(launchDate())+' (account launch)</span>':'')+(US.isLeap(y)?'<span class="pill p-upcoming">Leap Year</span>':'')+'</div>';
}
function vCalendar(){
  const today=D.today; if(!UI.calMonth)UI.calMonth=today.slice(0,7); UI.calMonth=clampMonth(UI.calMonth); if(UI.selDay)UI.selDay=clampDay(UI.selDay);
  const togs='<div class="row togs"><button class="btn sm pri" data-act="addsched" data-d="'+(UI.selDay||'')+'">Add To Schedule</button><span class="mut" style="font-size:12px">Tip: Right-Click A Task To See Its Series</span><label class="ctl"><input type="checkbox" data-chg="showHol"'+(UI.showHol?' checked':'')+'> Federal And Bank Holidays</label><label class="ctl"><input type="checkbox" data-chg="showObs"'+(UI.showObs?' checked':'')+'> Other Observances</label><label class="ctl"><input type="checkbox" data-chg="showProj"'+(UI.showProj?' checked':'')+'> Projected Items</label></div>';
  let h=calHead(); h+='<div class="body calbar"><div>'+navBar()+'</div>'+togs+'</div>';
  const cv=UI.calView; let main=cv==='day'?vDay():cv==='week'?vWeek(1):cv==='biweek'?vWeek(2):vMonth();
  if(cv==='day'){ UI.selDay=clampDay(UI.selDay||today); h+='<div class="calwrap"><div class="calmain">'+main+'</div>'+daySide(true)+'</div>'; }
  else if(UI.panel&&UI.selDay) h+='<div class="calwrap"><div class="calmain">'+main+'</div>'+daySide(false)+'</div>'; else h+=main;
  return h+'</div>';
}
function daySide(inDay){
  const d=clampDay(UI.selDay), hr=hoursFor(d), fc=dayFacts(d), due=calItems(d,d), ps=planItems(d,d), isT=d===D.today;
  const planned={}; ps.forEach(p=>{ planned[p.t+'|'+p.k]=1; });
  const allP=ps.filter(p=>p.allDay), timed=ps.filter(p=>!p.allDay).sort((x,y)=>toMin(x.time)-toMin(y.time)||(x.title<y.title?-1:1));
  const unsched=due.filter(o=>!planned[o.trackKey+'|'+o.key]);
  const open=due.filter(o=>!o.done);
  const rowP=p=>{ const tg=planTag(p); const wt=workTag(p.t,p.k); return '<div class="sr" data-act="occ" data-t="'+esc(p.t)+'" data-k="'+esc(p.k)+'"><div class="tm">'+(p.allDay?'All Day':t12(toMin(p.time)))+'</div><div class="tx"><b title="'+esc(p.title)+'">'+esc(p.title)+'</b><span class="mut">'+esc(p.subj)+'</span>'+(wt?'<span class="pl">'+wt+'</span>':'')+'</div>'+((p.allDay&&tg.t==='All Day')?'':'<span class="pill '+tg.c+'">'+tg.t+'</span>')+'</div>'; };
  const rowD=o=>{ const pls=o.done?(pill(o.status)+revPill(o)):workTag(o.trackKey,o.key); return '<div class="sr" data-act="occ" data-t="'+esc(o.trackKey)+'" data-k="'+esc(o.key)+'"><div class="tm mut">Due</div><div class="tx"><b title="'+esc(o.track.ob.title)+'">'+esc(o.track.ob.title)+'</b><span class="mut">'+esc(subjName(o.track))+' · '+esc(whoName(o.track))+'</span>'+(o.moved?'<span class="mut">'+esc(movedNote(o))+'</span>':'')+(pls?'<span class="pl">'+pls+'</span>':'')+'</div>'+(o.done?'':'<button class="btn sm" data-act="occ" data-t="'+esc(o.trackKey)+'" data-k="'+esc(o.key)+'">'+(workOf(o.trackKey,o.key)?'Continue Task':'Start Task')+'</button>')+'</div>'; };
  let h='<aside class="dayside" aria-label="Tasks for '+esc(longDate(d))+'"><div class="sdh"><div><div style="font-size:16px;font-weight:600">'+longDate(d)+'</div><div class="mut" style="font-size:12.5px">'+(isT?'Today · ':'')+(hr.closed?'Pharmacy Closed: '+esc(hr.reason):'Pharmacy Hours: '+hr.text)+'</div></div>'+(inDay?'':'<button class="btn sm" data-act="closeside" aria-label="Close day panel">Close</button>')+'</div>';
  if(hr.closed&&open.length){ const pv=prevOpenDay(d); h+='<div class="warnbox" style="margin:0 14px 8px">'+open.length+' open item'+(open.length===1?' is':'s are')+' due on a day the pharmacy is closed.'+(pv?' Plan to complete '+(open.length===1?'it':'them')+' by '+longDate(pv)+'.':'')+'</div>'; }
  h+='<div class="sh">All Day</div>';
  const nAll=fc.length+allP.length+unsched.length;
  h+=fc.map(f=>'<div class="sr" style="cursor:default"><div class="tx"><b title="'+esc(f.name)+'">'+esc(f.name)+'</b></div></div>').join('')+allP.map(rowP).join('')+unsched.map(rowD).join('');
  if(!nAll)h+='<div class="sr mut" style="cursor:default">Nothing all day.</div>';
  h+='<div class="sh">Scheduled By Time</div>'+(timed.length?timed.map(rowP).join(''):'<div class="sr mut" style="cursor:default">Nothing scheduled at a set time.</div>');
  h+='<div class="sdf mut">'+due.length+' Item'+(due.length===1?'':'s')+' Due · '+ps.length+' Scheduled</div><div class="sdf"><button class="btn sm pri" data-act="addsched" data-d="'+d+'">Add To Schedule</button></div>'+(inDay?'':'<div class="sdf"><button class="btn sm" data-act="openday" data-d="'+d+'">Open Day Timeline</button></div>')+'</aside>';
  return h;
}
function vMonth(){
  const today=D.today; const [y,m]=UI.calMonth.split('-').map(Number); const first=y+'-'+String(m).padStart(2,'0')+'-01';
  const gridStart=IL.addDays(first,-dowOfDate(first)); const gridEnd=IL.addDays(gridStart,41);
  const by={}, pl={}, pk={}; planItems(gridStart,gridEnd).forEach(p=>{ pk[p.t+'|'+p.k]=1; });
  calItems(gridStart,gridEnd).filter(o=>!pk[o.trackKey+'|'+o.key]).forEach(o=>{(by[o.due]=by[o.due]||[]).push(o);});
   planItems(gridStart,gridEnd).forEach(p=>{(pl[p.date]=pl[p.date]||[]).push(p);});
  const rank={overdue:0,nobaseline:1,'due-soon':2,upcoming:3,'late-done':4,done:5,na:6,projected:7};
  let g='<div class="body" style="padding-top:0"><div class="row" style="margin-bottom:8px;font-size:12px">'+['overdue','due-soon','upcoming','done','late-done','projected'].map(s=>pill(s)).join(' ')+'<span class="mut">|</span><span class="sw wk"></span> Weekend<span class="sw cls"></span> Pharmacy Closed<span class="hl hol" style="display:inline-block;margin:0">Holiday</span><span class="hl dst" style="display:inline-block;margin:0">Time Change</span></div><div class="cal">'+DOWN.map((d,i)=>'<div class="dow'+(i===0||i===6?' wk':'')+'">'+d.slice(0,3)+'</div>').join('');
  for(let i=0;i<42;i++){
    const d=IL.addDays(gridStart,i), dw=i%7;
    if(d<launchDate()){ g+='<div class="day out pre"><div class="d"><b>'+(+d.slice(8))+'</b></div></div>'; continue; }
    const list=(by[d]||[]).sort((a,b)=>rank[a.status]-rank[b.status]); const hr=hoursFor(d); const fc=dayFacts(d); const ps=pl[d]||[];
    g+='<div class="day'+(d.slice(0,7)!==UI.calMonth?' out':'')+(d===today?' today':'')+(d===UI.selDay?' sel':'')+((dw===0||dw===6)?' wk':'')+(hr.closed?' cls':'')+'" data-act="selday" data-d="'+d+'"><div class="d"><b>'+(+d.slice(8))+'</b>'+((list.length+ps.length)?'<span>'+(list.length+ps.length)+'</span>':'')+'</div>'+
      fc.slice(0,2).map(f=>'<div class="hl '+(f.kind==='hol'||f.kind==='obs'?'hol':f.kind)+'" title="'+esc(f.name+'. '+f.note)+'">'+esc(f.short||f.name)+'</div>').join('')+
      ps.slice(0,2).map(p=>'<span class="chip plan'+(p.rem?' rem':'')+'" data-t="'+esc(p.t)+'" data-k="'+esc(p.k)+'" title="Scheduled">'+esc(planLabel(p))+'</span>').join('')+
      list.slice(0,Math.max(1,3-Math.min(2,fc.length)-ps.length>0?3-Math.min(2,fc.length)-ps.length:1)).map(o=>'<span class="chip p-'+o.status+'" data-t="'+esc(o.trackKey)+'" data-k="'+esc(o.key)+'" title="'+esc(o.track.ob.title+' — '+subjName(o.track))+'">'+esc(o.track.ob.title)+'</span>').join('')+
      (list.length>Math.max(1,3-Math.min(2,fc.length)-ps.length)?'<div class="more">+'+(list.length-Math.max(1,3-Math.min(2,fc.length)-ps.length))+' More</div>':'')+'</div>';
  }
  g+='</div></div>';
  let sel=''; if(false){ const l=(by[UI.selDay]||[]); const fc=dayFacts(UI.selDay), hr=hoursFor(UI.selDay);
    sel='<div class="hd"><h2>'+longDate(UI.selDay)+'</h2><span class="sub">'+(hr.closed?'Pharmacy Closed: '+esc(hr.reason):'Open '+hr.text)+' · '+l.length+' Item'+(l.length===1?'':'s')+' Due</span><span class="spacer"></span><button class="btn sm" data-act="openday" data-d="'+UI.selDay+'">Open Day View</button></div>'+(fc.length?'<div class="body" style="padding-bottom:0">'+fc.map(f=>'<div><b>'+esc(f.name)+'</b> <span class="mut">'+esc(f.note)+'</span></div>').join('')+'</div>':'')+(l.length?'<div class="tw"><table>'+occHead(false)+l.map(o=>occRow(o,false)).join('')+'</table></div>':empty('Nothing due on this day.')); }
  return g+sel;
}
function vWeek(nw){
  nw=nw||1; const today=D.today; const sel=clampDay(UI.selDay||today); const ws=weekStartOf(sel), we=IL.addDays(ws,7*nw-1);
  const by={}, pl={}, pk={}; planItems(ws,we).forEach(p=>{(pl[p.date]=pl[p.date]||[]).push(p); pk[p.t+'|'+p.k]=1;}); calItems(ws,we).filter(o=>!pk[o.trackKey+'|'+o.key]).forEach(o=>{(by[o.due]=by[o.due]||[]).push(o);});
  const rank={overdue:0,nobaseline:1,'due-soon':2,upcoming:3,'late-done':4,done:5,na:6,projected:7}; let n=0;
  let h='<div class="body" style="padding-top:0"><div style="font-weight:600;margin-bottom:8px">'+(nw===1?'Week Of ':'Weeks Of ')+fmtS(ws)+' to '+fmt(we)+'</div><div class="wk7 nw'+nw+'">';
  for(let i=0;i<7*nw;i++){
    const d=IL.addDays(ws,i), dw=i%7;
    if(d<launchDate()){ h+='<div class="wcol pre"><div class="wh"><b>'+DOWN[dw].slice(0,3)+' '+(+d.slice(8))+'</b></div></div>'; continue; }
    const hr=hoursFor(d), fc=dayFacts(d), list=(by[d]||[]).sort((a,b)=>rank[a.status]-rank[b.status]), ps=pl[d]||[]; n+=list.length;
    h+='<div class="wcol'+((dw===0||dw===6)?' wk':'')+(hr.closed?' cls':'')+(d===today?' today':'')+(d===UI.selDay&&UI.panel?' sel':'')+'"><div class="wh" data-act="selday" data-d="'+d+'" style="cursor:pointer" title="Show tasks for this day"><b>'+DOWN[dw].slice(0,3)+' '+(nw===1?(+d.slice(8)):fmtS(d))+(d===today?' (Today)':'')+'</b><div class="mut" style="font-size:11.5px">'+(hr.closed?'Closed: '+esc(hr.reason):esc(hr.text))+'</div></div>'+
      fc.map(f=>'<div class="hl '+(f.kind==='hol'||f.kind==='obs'?'hol':f.kind)+'" title="'+esc(f.note)+'">'+esc(f.short||f.name)+'</div>').join('')+
      ps.map(p=>{ const tg=planTag(p); return '<span class="chip plan'+(p.rem?' rem':'')+'" data-act="occ" data-t="'+esc(p.t)+'" data-k="'+esc(p.k)+'" style="cursor:pointer" title="'+esc(planLabel(p)+' — '+tg.t)+'">'+esc(planLabel(p))+'</span>'; }).join('')+
      list.map(o=>'<span class="chip p-'+o.status+'" data-act="occ" data-t="'+esc(o.trackKey)+'" data-k="'+esc(o.key)+'" style="cursor:pointer" title="'+esc(o.track.ob.title+' — '+subjName(o.track))+'">'+esc(o.track.ob.title)+'<span class="mut" style="display:block;font-size:10.5px;overflow:hidden;text-overflow:ellipsis">'+esc(subjName(o.track))+'</span></span>').join('')+'</div>';
  }
  h+='</div>'+(n?'':'<div class="mut" style="margin-top:8px">Nothing is due in this range.</div>')+'</div>';
  return h;
}
function vDay(){
  const date=clampDay(UI.selDay||D.today); const hr=hoursFor(date); const fc=dayFacts(date); const due=calItems(date,date), ps=planItems(date,date);
  const planned={}; ps.forEach(p=>{ planned[p.t+'|'+p.k]=1; }); const unsched=due.filter(o=>!planned[o.trackKey+'|'+o.key]);
  const nowI=nowIn(S.profile.tz); const isToday=nowI.date===date; const timed=ps.filter(p=>!p.allDay), allP=ps.filter(p=>p.allDay);
  let a=hr.closed?8:Math.max(0,Math.floor(hr.o/60)-1), b=hr.closed?18:Math.min(24,Math.ceil(hr.c/60)+1);
  timed.forEach(p=>{ const hh=Math.floor(toMin(p.time)/60); a=Math.min(a,hh); b=Math.max(b,hh+1); }); if(isToday){ a=Math.min(a,nowI.hh); b=Math.max(b,nowI.hh+1); } if(UI.fullDay){ a=0; b=24; }
  let h='<div class="body" style="padding-top:0"><div class="dayhead" style="justify-content:space-between;align-items:center"><div><div style="font-size:18px;font-weight:600">'+longDate(date)+(isToday?' (Today)':'')+'</div><div class="mut">'+(hr.closed?'Pharmacy Closed: '+esc(hr.reason):'Pharmacy Hours: '+hr.text)+' ('+esc(isToday&&nowI.abbr?nowI.abbr:S.profile.tz.split('/').pop().replace('_',' '))+')</div></div><button class="btn sm" data-act="fullday">'+(UI.fullDay?'Show Working Hours':'Show Full 24 Hours')+'</button></div>';
  let tl='<div class="tl" style="margin-top:8px">';
  tl+='<div class="tlr"><div class="tlh">All Day</div><div class="tlb">'+(fc.length||allP.length||unsched.length?fc.map(f=>'<span class="hl '+(f.kind==='hol'||f.kind==='obs'?'hol':f.kind)+'" style="display:inline-block;margin:0">'+esc(f.name)+'</span>').join('')+allP.map(p=>'<span class="chip plan'+(p.rem?' rem':'')+'" data-act="occ" data-t="'+esc(p.t)+'" data-k="'+esc(p.k)+'" style="cursor:pointer">'+esc(p.title+' — '+p.subj)+'</span>').join('')+unsched.map(o=>'<span class="chip p-'+o.status+'" data-act="occ" data-t="'+esc(o.trackKey)+'" data-k="'+esc(o.key)+'" style="cursor:pointer" title="Due this day">'+esc(o.track.ob.title+' — '+subjName(o.track))+'</span>').join(''):'<span class="mut">Nothing all day.</span>')+'</div></div>';
  for(let hh=a;hh<b;hh++){
    const open=!hr.closed&&hh*60<hr.c&&(hh+1)*60>hr.o; const here=timed.filter(p=>Math.floor(toMin(p.time)/60)===hh).sort((x,y)=>toMin(x.time)-toMin(y.time));
    tl+='<div class="tlr'+(open?' open':' shut')+((isToday&&nowI.hh===hh)?' nowrow':'')+'"><div class="tlh">'+t12(hh*60)+'</div><div class="tlb">'+(isToday&&nowI.hh===hh?'<span class="nowtag">Now '+t12(nowI.min)+'</span>':'')+here.map(p=>{ const tg=planTag(p); return '<span class="chip plan'+(p.rem?' rem':'')+'" data-act="occ" data-t="'+esc(p.t)+'" data-k="'+esc(p.k)+'" style="cursor:pointer;display:inline-block;max-width:100%">'+esc(planLabel(p)+' — '+p.subj)+' <span class="pill '+tg.c+'">'+tg.t+'</span></span>'; }).join('')+'</div></div>';
  }
  tl+='</div>'; h+=tl+'<div class="mut" style="font-size:12px;margin-top:6px">Shaded hours are outside pharmacy hours.</div></div>';
  return h;
}
/* ===== review queue and documentation ===== */
function vReview(){
  const recs=S.records.filter(r=>r.review&&r.status!=='void'); const tk=id=>D.tracks.find(t=>t.key===id)||null; const vis=r=>{ const t=tk(r.track); return !t||inSite(t); };
  const pend=recs.filter(r=>r.review.status==='pending'&&vis(r)).sort((a,b)=>a.completedOn<b.completedOn?-1:1);
  const acc=recs.filter(r=>r.review.status==='accepted'&&vis(r)).sort((a,b)=>a.review.at<b.review.at?1:-1).slice(0,25);
  const me=meP(); const peopleN=S.people.filter(p=>!p.archived).length;
  const cell=r=>{ const t=tk(r.track); return '<td title="'+esc(t?t.ob.title:r.track)+'">'+esc(t?t.ob.title:r.track)+'</td><td>'+esc(t?subjName(t):'')+'</td><td class="num">'+fmt(r.completedOn)+'</td><td>'+esc(r.completedBy||'—')+'</td><td>'+esc(r.result||'—')+'</td><td class="num">'+(((r.task||{}).files||[]).length)+'</td>'; };
  let h='<div class="card"><div class="hd"><h2>Review Queue</h2><span class="sub">'+pend.length+' Waiting For A Supervisor</span></div>';
  h+='<div class="body" style="padding-bottom:0"><p class="mut" style="margin:0">Completed tasks wait here. Open one, check the result, comments and documentation, then Accept. Accepting finishes the task and it is documented.</p>'+(peopleN&&!canReview(me)?'<div class="warnbox" style="margin-top:8px">To accept, choose a person with PIC or Reviewer duty in Acting As (top right).</div>':'')+'</div>';
  h+=pend.length?'<div class="tw"><table><tr><th>Item</th><th>For</th><th>Completed</th><th>Completed By</th><th>Result</th><th>Files</th><th></th></tr>'+pend.map(r=>'<tr class="click" data-act="viewrec" data-id="'+esc(r.id)+'">'+cell(r)+'<td><button class="btn sm pri" data-act="viewrec" data-id="'+esc(r.id)+'">Review</button></td></tr>').join('')+'</table></div>':empty('Nothing is waiting for review.');
  h+='</div><div class="card"><div class="hd"><h2>Recently Accepted</h2><span class="sub">Last 25</span></div>'+(acc.length?'<div class="tw"><table><tr><th>Item</th><th>For</th><th>Completed</th><th>Completed By</th><th>Result</th><th>Files</th><th>Accepted By</th><th>Accepted</th></tr>'+acc.map(r=>'<tr class="click" data-act="viewrec" data-id="'+esc(r.id)+'">'+cell(r)+'<td>'+esc(r.review.by||'')+'</td><td class="num">'+esc(fmtTs(r.review.at))+'</td></tr>').join('')+'</table></div>':empty('Nothing accepted yet.'))+'</div>';
  return h;
}
function vDocs(){
  const q=(UI.dq||'').toLowerCase(); const rows=[];
  S.records.forEach(r=>{ if(r.status==='void'||!r.task)return; const t=D.tracks.find(x=>x.key===r.track); (r.task.files||[]).forEach(f=>rows.push({f,title:t?t.ob.title:r.track,subj:t?subjName(t):'',state:r.review?(r.review.status==='pending'?'Awaiting Review':'Reviewed'):'Completed',act:'viewrec',id:r.id})); });
  Object.keys(S.work||{}).forEach(k=>{ const W=S.work[k]; if(!W)return; (W.files||[]).forEach(f=>rows.push({f,title:W.title,subj:W.subj,state:'In Progress',act:'occ',t:W.t,k:W.k})); });
  const list=rows.filter(x=>!q||(x.f.name+' '+x.title+' '+x.subj).toLowerCase().includes(q)).sort((a,b)=>a.f.at<b.f.at?1:-1);
  let h='<div class="card"><div class="hd"><h2>Documentation</h2><span class="sub">'+list.length+' File'+(list.length===1?'':'s')+'</span><span class="spacer"></span><input type="text" data-inp="dq" placeholder="Search" aria-label="Search documentation" value="'+esc(UI.dq||'')+'" style="max-width:240px"></div>';
  h+='<div class="body" style="padding-bottom:0"><p class="mut" style="margin:0">Every file attached to a task, in one place. Attach files from a task screen. Do not attach patient information.</p></div>';
  h+=list.length?'<div class="tw"><table><tr><th>File</th><th>Task</th><th>For</th><th>Attached By</th><th>Attached</th><th>Size</th><th>Task Status</th><th></th></tr>'+list.map(x=>'<tr><td><a href="'+esc(fileUrl(x.f))+'" target="_blank" rel="noopener" title="'+esc(x.f.name)+'">'+esc(x.f.name)+'</a></td><td title="'+esc(x.title)+'">'+esc(x.title)+'</td><td>'+esc(x.subj)+'</td><td>'+esc(x.f.by||'')+'</td><td class="num">'+esc(fmtTs(x.f.at))+'</td><td class="num">'+sizeTxt(x.f.size)+'</td><td>'+esc(x.state)+'</td><td><button class="btn sm" data-act="'+x.act+'" '+(x.act==='viewrec'?'data-id="'+esc(x.id)+'"':'data-t="'+esc(x.t)+'" data-k="'+esc(x.k)+'"')+'>Open Task</button></td></tr>').join('')+'</table></div>':empty('No documentation attached yet.');
  return h+'</div>';
}

/* ===== obligations ===== */
function trackRow(t){
  const ob=t.ob;
  if(t.inactive) return '<tr class="click" data-act="track" data-t="'+esc(t.key)+'"><td>'+esc(ob.title)+'</td><td>'+esc(subjName(t))+'</td><td class="mut">'+esc(IL.freqText(ob,t.trk))+'</td><td>—</td><td>—</td><td>'+pill('na','Inactive')+'</td><td>—</td><td>'+pill(ob.conf)+'</td></tr>';
  const oc=D.occs.filter(o=>o.trackKey===t.key); const done=oc.filter(o=>o.done&&o.rec.status!=='na').sort((a,b)=>a.rec.completedOn<b.rec.completedOn?1:-1)[0];
  const nxt=oc.filter(o=>!o.done&&!o.projected).sort((a,b)=>(a.due||'0')<(b.due||'0')?-1:1)[0];
  const st=nxt?pill(nxt.status):(ob.rec.kind==='event'?pill('na','Awaiting Event'):pill('done','Current'));
  return '<tr class="click" data-act="track" data-t="'+esc(t.key)+'"><td title="'+esc(ob.title)+'">'+esc(ob.title)+'</td><td>'+esc(subjName(t))+'</td><td class="mut">'+esc(IL.freqText(ob,t.trk))+'</td><td class="num">'+(done?fmt(done.rec.completedOn):'—')+'</td><td class="num">'+(nxt&&nxt.due?fmt(nxt.due):'—')+'</td><td>'+st+'</td><td>'+esc(whoName(t))+'</td><td>'+pill(ob.conf)+'</td></tr>';
}
function vObligations(){
  const q=(UI.q||'').toLowerCase(); const hit=(a,b)=>!q||(a+' '+b).toLowerCase().includes(q);
  const tr=D.tracks.filter(t=>inSite(t)&&(!UI.fCat||t.ob.cat===UI.fCat)&&(!UI.fWho||(t.who&&t.who.id===UI.fWho))&&hit(t.ob.title,t.subj.name));
  let h='<div class="card"><div class="hd"><h2>Active Obligations</h2><span class="sub">'+tr.length+' Tracked</span><span class="spacer"></span><input type="text" data-inp="q" placeholder="Search" value="'+esc(UI.q||'')+'" aria-label="Search" style="width:160px">'+filtersHtml()+'</div>';
  if(!tr.length) h+=empty('No tracked obligations yet. Add a pharmacy, people, equipment and documents under People & Assets.');
  else{
    h+='<div class="tw"><table><tr><th>Item</th><th>For</th><th>Frequency</th><th>Last Done</th><th>Next Due</th><th>Status</th><th>Responsible</th><th>Confidence</th></tr>';
    CATS_ORDER.concat(['Custom']).forEach(c=>{ const rows=tr.filter(t=>t.ob.cat===c); if(rows.length){ h+='<tr><td colspan="8" style="background:var(--soft);font-weight:600">'+esc(c)+'</td></tr>'+rows.map(trackRow).join(''); } });
    h+='</table></div>';
  }
  h+='</div>';
  h+='<div class="card"><div class="hd"><h2>Obligation Library</h2><span class="sub">Turn items on or off, change intervals, or add your own</span><span class="spacer"></span><button class="btn pri" data-act="newob">Add Custom Obligation</button></div><div class="tw"><table><tr><th>On</th><th>Category</th><th>Obligation</th><th>Frequency</th><th>Basis</th><th>Confidence</th><th>Applies Here</th><th></th></tr>'+
   D.obs.filter(o=>hit(o.title,o.cat)).map(o=>{ const ap=IL.applies(o,S); return '<tr><td><input type="checkbox" data-chg="obon" data-id="'+esc(o.id)+'"'+(o.active?' checked':'')+' aria-label="Active"></td><td class="mut">'+esc(o.cat)+'</td><td title="'+esc(o.title)+'">'+esc(o.title)+(o.custom?' <span class="mut">(Custom)</span>':'')+'</td><td class="mut">'+esc(IL.freqText(o,{}))+'</td><td>'+esc(o.basis)+'</td><td>'+pill(o.conf)+'</td><td>'+(ap?'Yes':'<span class="mut">No ('+(o.jur&&o.jur!=='US'&&o.jur!==S.profile.state?'State':'Setup Option')+')</span>')+'</td><td><button class="btn sm" data-act="editob" data-id="'+esc(o.id)+'">Details</button></td></tr>'; }).join('')+'</table></div></div>';
  return h;
}

/* ===== people & assets ===== */
function tbl(head,rows,addAct,addLbl,title,sub){
  return '<div class="card"><div class="hd"><h2>'+title+'</h2><span class="sub">'+sub+'</span><span class="spacer"></span><button class="btn pri" data-act="'+addAct+'">'+addLbl+'</button></div>'+(rows.length?'<div class="tw"><table><tr>'+head.map(x=>'<th>'+x+'</th>').join('')+'</tr>'+rows.join('')+'</table></div>':empty('None added yet.'))+'</div>';
}
function vPeople(){
  const sn=id=>{const s=S.sites.find(x=>x.id===id);return s?s.name:'—';};
  let h=tbl(['Name','DEA No','DEA Expires','TSBP License No','TSBP License Expires'],S.sites.filter(s=>!s.archived).map(s=>'<tr class="click" data-act="editsite" data-id="'+esc(s.id)+'"><td>'+esc(s.name)+'</td><td>'+esc(s.deaNo||'—')+'</td><td class="num">'+fmt(liveDate(o=>o.track.subj.id===s.id&&o.track.ob.firstDueField==='deaExpiry',s.deaExpiry))+'</td><td>'+esc(s.tsbpNo||'—')+'</td><td class="num">'+fmt(liveDate(o=>o.track.subj.id===s.id&&o.track.ob.firstDueField==='tsbpExpiry',s.tsbpExpiry))+'</td></tr>'),'newsite','Add Pharmacy','Pharmacies','Each location tracked separately');
  h+=tbl(['Name','Role','Duties','Training Groups','License Expires','Pharmacy'],S.people.filter(p=>!p.archived).map(p=>'<tr class="click" data-act="editperson" data-id="'+esc(p.id)+'"><td>'+esc(p.name)+'</td><td>'+esc(p.role)+'</td><td>'+esc((p.duties||[]).join(', ')||'—')+'</td><td>'+esc((p.tags||[]).map(t=>(TAGS.find(x=>x[0]===t)||[0,t])[1]).join(', ')||'—')+'</td><td class="num">'+fmt(liveDate(o=>o.track.subj.id===p.id&&o.track.ob.firstDueField==='licExpiry',p.licExpiry))+'</td><td>'+esc(sn(p.siteId))+'</td></tr>'),'newperson','Add Person','People','Duties decide who is responsible for each item');
  h+=tbl(['Name','Type','Pharmacy'],S.equipment.filter(e=>!e.archived&&!e.pec).map(e=>'<tr class="click" data-act="editequip" data-id="'+esc(e.id)+'"><td>'+esc(e.name)+'</td><td>'+esc(e.kind)+'</td><td>'+esc(sn(e.siteId))+'</td></tr>'),'newequip','Add Equipment','Equipment','Hoods, rooms, refrigerators, monitors');
  h+=tbl(['Title','Type','Version','Last Reviewed','Review Every','Next Review'],S.documents.filter(d=>!d.archived).map(d=>{ const nr=liveDate(o=>o.track.subj.id===d.id&&o.track.ob.id==='doc-review',d.lastReviewed?IL.addMonths(d.lastReviewed,+d.reviewMonths||12):''); return '<tr class="click" data-act="editdoc" data-id="'+esc(d.id)+'"><td>'+esc(d.title)+'</td><td>'+esc(d.type)+'</td><td>'+esc(d.version||'—')+'</td><td class="num">'+fmt(d.lastReviewed)+'</td><td>'+(+d.reviewMonths||12)+' Months</td><td class="num">'+fmt(nr)+'</td></tr>'; }),'newdoc','Add Document','Policies and Documents','Each document gets its own review schedule');
  return h;
}

/* ===== audit record ===== */
function auditRows(months){
  const today=D.today, from=IL.addMonths(today,-months);
  return D.occs.filter(o=>o.due&&!o.projected&&o.status!=='nobaseline'&&!o.track.ob.routine&&o.due>=from&&o.due<=today&&inSite(o.track)&&(o.done||o.status==='overdue')).sort((a,b)=>a.due<b.due?1:-1);
}
function vAudit(){
  const months=+UI.auditRange, today=D.today, from=IL.addMonths(today,-months);
  const st=IL.stats(D.occs.filter(o=>inSite(o.track)&&!o.track.ob.routine),today,from,today); const rows=auditRows(months);
  let h='<div class="card"><div class="hd"><h2>Audit Record</h2><span class="sub">What was due, when it was done, and by whom</span><span class="spacer"></span><span class="ctl">Period <select data-chg="auditRange">'+[['6','Last 6 Months'],['12','Last 12 Months'],['24','Last 24 Months'],['36','Last 36 Months']].map(x=>'<option value="'+x[0]+'"'+(UI.auditRange===x[0]?' selected':'')+'>'+x[1]+'</option>').join('')+'</select></span><button class="btn" data-act="dlcsv">Download CSV</button><button class="btn pri" data-act="dlreport">Download Audit Report</button></div>'+
   '<div class="body"><div class="tiles" style="margin:0"><div class="tile ok"><div class="n">'+st.on+'</div><div class="l">On Time</div></div><div class="tile warn"><div class="n">'+st.late+'</div><div class="l">Done Late</div></div><div class="tile bad"><div class="n">'+st.missed+'</div><div class="l">Overdue / Missed</div></div><div class="tile acc"><div class="n">'+(st.onTimeRate==null?'—':Math.round(st.onTimeRate*100)+'%')+'</div><div class="l">On-Time Rate</div></div></div>'+
   '<p class="mut" style="margin:10px 0 0;font-size:13px">Counts cover items that came due in this period. Late completions stay recorded as late. Items marked Not Applicable are listed but not counted. Tracking began '+fmt(S.profile.trackingStart)+'; nothing earlier is counted.</p></div>';
  h+=rows.length?'<div class="tw"><table><tr><th>Due</th><th>Item</th><th>For</th><th>Status</th><th>Completed</th><th>By</th><th>Result</th><th>Review</th><th>Late Reason</th></tr>'+rows.slice(0,300).map(o=>{ const r=o.rec||{}; return '<tr class="click" data-act="occ" data-t="'+esc(o.trackKey)+'" data-k="'+esc(o.key)+'"><td class="num">'+fmt(o.due)+'</td><td title="'+esc(o.track.ob.title)+'">'+esc(o.track.ob.title)+'</td><td>'+esc(subjName(o.track))+'</td><td>'+pill(o.status)+'</td><td class="num">'+(o.done?fmt(r.completedOn):'—')+'</td><td>'+esc(r.completedBy||'—')+'</td><td>'+esc(r.result||'—')+'</td><td>'+esc(r.review?(r.review.status==='accepted'?'Accepted: '+r.review.by:'Awaiting Review'):'—')+'</td><td title="'+esc(r.lateReason||r.naReason||'')+'">'+esc(r.lateReason||r.naReason||'—')+'</td></tr>'; }).join('')+'</table></div>':empty('No items came due in this period yet.');
  h+='</div>';
  h+='<div class="card"><div class="hd"><h2>Activity Log</h2><span class="sub">Every change, newest first. Entries cannot be edited.</span></div>'+(S.log.length?'<div class="tw"><table><tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr>'+S.log.slice(0,60).map(l=>'<tr><td class="num">'+esc((l.ts||'').replace('T',' ').slice(0,16))+'</td><td>'+esc(l.by)+'</td><td>'+esc(l.action)+'</td><td title="'+esc(l.detail)+'">'+esc(l.detail)+'</td></tr>').join('')+'</table></div>':empty('No activity yet.'))+'</div>';
  return h;
}

/* ===== setup ===== */
function vCleanroom(){
  const sn=id=>{const x=S.sites.find(y=>y.id===id);return x?x.name:'—';}; let h=''; const f=S.profile.features;
  const pecs=S.equipment.filter(e=>e.pec&&!e.archived);
  if(f.sterile){
    const rms=S.rooms.filter(r=>!r.archived&&r.kind!=='nsa');
    h+=tbl(['Room','ISO Class','Categories Supported','Notes','PECs In The Room','Pharmacy'],rms.map(r=>'<tr class="click" data-act="editroom" data-id="'+esc(r.id)+'"><td>'+esc(r.name)+'</td><td>'+(r.iso?'ISO '+esc(r.iso):'<span class="mut">Not Classified</span>')+'</td><td>'+esc(roomCats(r)||'—')+'</td><td>'+(r.neg?'Next To Or Shared With A Negative Pressure Room':'<span class="mut">—</span>')+'</td><td>'+esc(pecs.filter(e=>e.pec.roomId===r.id).map(e=>e.name).join(', ')||'—')+'</td><td>'+esc(sn(r.siteId))+'</td></tr>'),'newroom','Add Room','Controlled Space: Sterile Rooms And Areas','Ante rooms, buffer rooms and segregated compounding areas. Certification tasks read these details');
    h+=tbl(['Name','Type','Details','Brand And Model','Room','Pharmacy'],pecs.map(e=>{ const rm=S.rooms.find(r=>r.id===e.pec.roomId); return '<tr class="click" data-act="editpec" data-id="'+esc(e.id)+'"><td>'+esc(e.name)+'</td><td>'+esc(PEC_TYPES[e.pec.type]||'—')+'</td><td>'+esc(pecDetail(e.pec)||'—')+'</td><td>'+esc([e.pec.brand,e.pec.model].filter(Boolean).join(' ')||'—')+'</td><td>'+esc(rm?rm.name:'Not Assigned')+'</td><td>'+esc(sn(e.siteId))+'</td></tr>'; }),'newpec','Add PEC','Controlled Space: Primary Engineering Controls (PECs)','Hoods, cabinets and isolators. Certification tasks read these details');
  }
  if(f.nonsterile){
    const ns=S.rooms.filter(r=>!r.archived&&r.kind==='nsa');
    h+=tbl(['Area','Location','Pharmacy'],ns.map(r=>'<tr class="click" data-act="editroom" data-id="'+esc(r.id)+'"><td>'+esc(r.name)+'</td><td>'+esc(r.note||'—')+'</td><td>'+esc(sn(r.siteId))+'</td></tr>'),'newnsa','Add Area','Controlled Space: Nonsterile Compounding Areas','USP <795> designated areas. No ISO class and no certification schedule');
  }
  return h;
}
function vSetup(){
  const p=S.profile; let h='';
  if(S.mode!=='live') h+='<div class="card"><div class="hd"><h2>Start Your Pharmacy</h2></div><div class="body"><p style="margin-top:0">You are looking at sample data. Nothing you do here is saved. Start your own pharmacy to begin tracking for real.</p><button class="btn pri" data-act="wizard">Start My Pharmacy</button></div></div>';
  h+='<div class="card"><div class="hd"><h2>Pharmacy Profile</h2></div><div class="body"><dl class="kv"><dt>Name</dt><dd>'+esc(p.name||'—')+'</dd><dt>State Rules</dt><dd>Texas plus federal, USP and OSHA</dd><dt>Tracking Began</dt><dd>'+fmt(p.trackingStart)+'</dd><dt>Programs Turned On</dt><dd>'+esc(FEATURES.filter(f=>p.features[f[0]]).map(f=>f[1]).join('; ')||'None')+'</dd></dl><div style="margin-top:12px"><button class="btn" data-act="editprofile">Edit Profile</button></div></div></div>';
  const tzl=(TZONES.find(z=>z[0]===p.tz)||[0,p.tz])[1]; const closedNames=US.HOLIDAY_IDS.filter(i=>p.holClosed[i]).map(i=>US.HOLIDAY_NAMES[i]);
  h+='<div class="card"><div class="hd"><h2>Time Zone And Hours</h2><span class="sub">Drives the clock, the open/closed status and after-hours shading</span><span class="spacer"></span><button class="btn pri" data-act="hours">Edit Hours</button></div><div class="body"><dl class="kv"><dt>Time Zone</dt><dd>'+esc(tzl)+'</dd>'+DOWN.map((d,i)=>'<dt>'+d+'</dt><dd>'+(p.hours[i]?(toMin(p.hours[i].o)===0&&toMin(p.hours[i].c)>=1440?'Open 24 Hours':t12(toMin(p.hours[i].o))+' to '+t12(toMin(p.hours[i].c))):'<span class="mut">Closed</span>')+'</dd>').join('')+'<dt>Closed On Holidays</dt><dd style="white-space:normal">'+esc(closedNames.join(', ')||'None')+'</dd><dt>Repeating Task On A Closed Day</dt><dd>'+(p.shift==='prev'?'Moves To The Previous Open Day':'Moves To The Next Open Day')+'</dd></dl></div></div>';
  if(p.features.sterile||p.features.nonsterile)h+=vCleanroom();
  h+='<div class="card"><div class="hd"><h2>Storage and Backup</h2></div><div class="body"><p style="margin-top:0">'+(Store.kind==='db'?'Saved to the shared database. Everyone with access to this page sees the same calendar.':Store.kind==='local'?'Saved in this browser only. '+esc(Store.err):'Not saved. Sample mode.')+'</p><div class="row"><button class="btn" data-act="dlbackup">Download Backup (JSON)</button><label class="btn">Restore From Backup<input type="file" id="restore" accept=".json,application/json" style="display:none"></label><button class="btn" data-act="dlics">Download Calendar File (.ics)</button></div><p class="mut" style="font-size:13px;margin-bottom:0">The calendar file holds every open item for the next 12 months with a 7-day reminder. Import it into Google Calendar, Outlook or Apple Calendar.</p></div></div>';
  h+='<div class="card"><div class="hd"><h2>How Confident Is Each Rule?</h2></div><div class="body"><dl class="kv"><dt>'+pill('High')+'</dt><dd>Primary text, or two or more independent sources agree.</dd><dt>'+pill('Moderate')+'</dt><dd>One secondary source, or sources differ in detail. Verify before relying on it.</dd><dt>'+pill('Low')+'</dt><dd>Secondary summary only. Off by default until verified.</dd><dt>'+pill('Internal')+'</dt><dd>Your own policy. No outside rule is claimed.</dd></dl></div></div>';
  h+='<div class="card"><div class="hd"><h2>Known Gaps and Items To Verify</h2></div><div class="body"><ul style="margin:0;padding-left:18px;display:grid;gap:4px">'+
   ['The Texas pharmacy self-assessment form and the pharmacy license cycle length are not loaded. Neither was confirmed against a primary source. Add them as custom obligations once confirmed with TSBP.',
    'Texas Board of Pharmacy rule changes effective September 1, 2026 (22 TAC 295.8, 297.8) and the 291.17 notarization language need review against the current rule text.',
    'Immunization and BLS certification renewals are not loaded. Add them as custom obligations.',
    'HIPAA intervals are your own policy. They were not checked against HHS text.',
    'Only Texas plus federal, USP and OSHA rules are loaded. Other states are not covered.'].map(x=>'<li>'+x+'</li>').join('')+'</ul></div></div>';
  return h;
}

/* ===== render ===== */
const TABS=[['dashboard','Dashboard'],['calendar','Calendar'],['obligations','Obligations'],['review','Review Queue'],['docs','Documentation'],['people','People & Assets'],['audit','Audit Record'],['setup','Setup']];
function render(){
  const root=$('#app'); if(!root)return;
  if(UI.loading||(!D&&!(BLANK&&S.mode!=='live'))){ root.innerHTML='<div class="wrap"><p class="mut" style="padding:40px 0">Loading…</p></div>'; return; }
  if(BLANK&&S.mode!=='live'){ root.innerHTML='<header class="top"><div class="wrap"><div class="bar"><div class="brand"><span class="mark">Iron<b>Ledger</b></span><small>Compliance Calendar</small></div></div></div></header><main><div class="wrap"><div class="card" style="max-width:640px;margin:40px auto"><div class="hd"><h2>Set Up A New Pharmacy</h2></div><div class="body"><p style="margin-top:0">This calendar is empty. Nothing is scheduled yet. Enter the pharmacy basics and the programs it runs, then add people, equipment, rooms and documents. The calendar fills in from what you add.</p>'+((window.ILHOST&&ILHOST.canStart===false)?'<p><b>This pharmacy’s calendar has not been started.</b> Ask the Account Owner to start it.</p>':'<button class="btn pri" data-act="wizard">Start My Pharmacy</button>')+(Store.kind==='local'&&Store.err?'<p class="mut" style="margin-bottom:0">'+esc(Store.err)+'</p>':'')+''+((window.ILHOST&&ILHOST.canStart===false)?'':'<p class="mut" style="margin:14px 0 0">Have a backup file? <label class="btn sm" style="cursor:pointer">Restore From Backup<input type="file" id="restore" accept=".json,application/json" hidden></label></p>')+'</div></div></div></main>'; const rs=$('#restore'); if(rs)rs.onchange=e=>restoreFile(e.target.files[0]); return; }
  let view=''; try{ view={dashboard:vDashboard,calendar:vCalendar,obligations:vObligations,review:vReview,docs:vDocs,people:vPeople,audit:vAudit,setup:vSetup}[UI.tab](); }catch(e){ view='<div class="banner bad">This view could not be drawn: '+esc(e.message)+'</div>'; }
  const NPEND=S.records.filter(r=>r.review&&r.review.status==='pending'&&r.status!=='void').length;
  const sites=S.sites.filter(s=>!s.archived);
  const people=S.people.filter(p=>!p.archived);
  root.innerHTML='<header class="top"><div class="wrap"><div class="bar"><div class="brand"><span class="mark">Iron<b>Ledger</b></span><small>Compliance Calendar'+(S.profile.name&&S.mode==='live'?' · '+esc(S.profile.name):'')+'</small></div><div class="spacer"></div><button class="clock" id="clock" data-act="hours" title="Time zone and hours of operation"><span id="clkD" class="mut"></span><span id="clkT" class="num"></span><span id="clkS" class="pill"></span></button>'+
   (sites.length>1?'<span class="ctl">Pharmacy <select data-chg="site"><option value="">All</option>'+sites.map(s=>'<option value="'+esc(s.id)+'"'+(UI.site===s.id?' selected':'')+'>'+esc(s.name)+'</option>').join('')+'</select></span>':'')+
   (people.length?'<span class="ctl">Acting As <select data-chg="me"><option value="">Unspecified</option>'+people.map(p=>'<option value="'+esc(p.id)+'"'+(ME===p.id?' selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></span>':'')+
   '</div><nav class="tabs" role="tablist">'+TABS.map(t=>'<button role="tab" aria-selected="'+(UI.tab===t[0])+'" data-act="tab" data-v="'+t[0]+'">'+t[1]+(t[0]==='review'&&NPEND?' <span class="badge">'+NPEND+'</span>':'')+'</button>').join('')+'</nav></div></header>'+
   '<main><div class="wrap'+(UI.tab==='calendar'?' wide':'')+'">'+(S.mode!=='live'?'<div class="banner demo"><span>Sample Data. Nothing is saved until you start your own pharmacy.</span><button class="btn sm pri" data-act="wizard">Start My Pharmacy</button></div><div style="height:12px"></div>':(Store.kind==='local'?'<div class="banner info">'+esc(Store.err||'Saved in this browser only.')+'</div><div style="height:12px"></div>':''))+view+'</div></main>'+
   '<footer class="foot"><div class="wrap" style="display:flex;gap:8px;align-items:baseline"><span class="mark">Iron<b>Ledger</b></span><span>2026 IronLedger LLC</span></div></footer>';
  const rs=$('#restore'); if(rs)rs.onchange=e=>restoreFile(e.target.files[0]);
  updateClock();
}
