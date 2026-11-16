/* ===== helpers ===== */
const $=s=>document.querySelector(s);
const clone=o=>o==null?o:JSON.parse(JSON.stringify(o));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=p=>(p||'x')+Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4);
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],MONL=['January','February','March','April','May','June','July','August','September','October','November','December'];
let TZ=null; let CAL_CACHE={};
function localToday(){ if(window.__TODAY)return window.__TODAY;
  try{ return new Intl.DateTimeFormat('en-CA',{timeZone:TZ||Intl.DateTimeFormat().resolvedOptions().timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
  catch(e){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); } }
const DEF_CLOSED=['newyear','memorial','july4','labor','thanks','xmas'];
function defHours(){ const o=[null,null,null,null,null,null,null]; for(let i=1;i<=5;i++)o[i]={o:'09:00',c:'18:00'}; return o; }
function defHolClosed(){ const o={}; DEF_CLOSED.forEach(i=>o[i]=true); return o; }
const TZONES=[['America/New_York','Eastern Time (New York)'],['America/Chicago','Central Time (Chicago)'],['America/Denver','Mountain Time (Denver)'],['America/Phoenix','Mountain Time, No DST (Arizona)'],['America/Los_Angeles','Pacific Time (Los Angeles)'],['America/Anchorage','Alaska Time (Anchorage)'],['Pacific/Honolulu','Hawaii Time (Honolulu)'],['America/Puerto_Rico','Atlantic Time (Puerto Rico)']];
function fmt(s){ if(!s)return '—'; const p=s.split('-'); return MON[+p[1]-1]+' '+(+p[2])+', '+p[0]; }
function fmtS(s){ if(!s)return '—'; const p=s.split('-'); return MON[+p[1]-1]+' '+(+p[2]); }
function whenText(d){ if(d==null)return ''; if(d===0)return 'Today'; if(d<0)return Math.abs(d)+(d===-1?' Day Overdue':' Days Overdue'); return 'In '+d+(d===1?' Day':' Days'); }
const STATUS_LABEL={overdue:'Overdue','due-soon':'Due Soon',upcoming:'Upcoming',done:'Done','late-done':'Done Late',na:'Not Applicable',nobaseline:'No Record',projected:'Projected'};
const pill=(st,txt)=>'<span class="pill p-'+st+'">'+esc(txt||STATUS_LABEL[st]||st)+'</span>';
const CATS_ORDER=['Controlled Substances','Licensure','Texas Notifications','USP <795> Nonsterile','USP <797> Sterile','USP <800> Hazardous Drugs','Workplace Safety','Privacy and Security','Policies and Documents'];
const EQUIP_KINDS=['Primary Engineering Control (PEC)','Containment PEC (C-PEC)','Refrigerator / Freezer','Balance / Scale','Monitoring Device','Other'];
const DOC_TYPES=['Policy','SOP','Form','Validation','Training Material','Other'];
const TAGS=[['ns-compounder','Nonsterile Compounder'],['sterile-compounder','Sterile Compounder'],['hd-handler','Hazardous Drug Handler'],['bbp','Bloodborne Pathogen Exposure'],['immunizer','Immunizing Pharmacist']];
const DUTIES=['Owner','PIC','Designated Person'];
const FEATURES=[['controlled','Dispenses Controlled Substances (DEA)'],['nonsterile','Nonsterile Compounding (USP <795>)'],['sterile','Sterile Compounding (USP <797>)'],['hazardous','Hazardous Drugs (USP <800>)'],['bbp','Employees With Bloodborne Pathogen Exposure (Immunizations, Finger Sticks)']];

/* ===== state ===== */
const BLANK=(typeof window!=='undefined'&&window.IL_BLANK===true);
let S=emptyState(); let D=null; let UI={tab:'dashboard',calMonth:null,selDay:null,calView:'month',fCat:'',fWho:'',showProj:true,showHol:true,showObs:true,site:'',auditRange:'12',loading:true};
let ME=''; try{ME=localStorage.getItem('ilcal.me')||'';}catch(e){}
function emptyState(){ return {mode:'demo',profile:{name:'',state:'TX',features:{controlled:true,nonsterile:true,sterile:false,hazardous:false,bbp:false},trackingStart:localToday(),tz:'America/Chicago',hours:defHours(),holClosed:defHolClosed()},plans:{},work:{},reminders:{},rooms:[],sites:[],people:[],equipment:[],documents:[],tracks:{},obl:{},custom:[],records:[],events:[],log:[]}; }
function obligations(){ return IL.mergeObligations(SEED,S.obl,S.custom); }
function todayIn(tz){ try{ return new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }catch(e){ return localToday(); } }
function normalize(){ const p=S.profile; if(!p.launchedAt)p.launchedAt=p.trackingStart||localToday(); if(!p.tz)p.tz='America/Chicago'; if(!Array.isArray(p.hours))p.hours=defHours(); if(!p.holClosed)p.holClosed=defHolClosed(); if(!S.plans)S.plans={}; if(!S.work)S.work={}; if(!S.reminders)S.reminders={}; if(!Array.isArray(S.rooms))S.rooms=[]; if(!p.shift)p.shift='next'; }
function recompute(){
  normalize(); TZ=S.profile.tz; CAL_CACHE={}; ADJ={};
  const today=localToday(); const obs=obligations();
  D=IL.collect(S,obs,today,IL.addDays(today,-760),IL.addDays(today,800),{siteId:UI.site,adjust:adjustDue}); D.today=today; D.obs=obs;
  D.list=D.occs.filter(o=>!o.track.ob.routine);
}

/* ===== demo data (in memory only) ===== */
function makeDemo(){
  const t=localToday(), A=IL.addDays; const st=emptyState(); st.mode='demo';
  st.profile={name:'Sample Pharmacy',state:'TX',features:{controlled:true,nonsterile:true,sterile:true,hazardous:false,bbp:true},trackingStart:A(t,-200),tz:'America/Chicago',hours:(()=>{const h=defHours();h[6]={o:'09:00',c:'13:00'};return h;})(),holClosed:defHolClosed()};
  st.sites=[{id:'s1',name:'Main Street Pharmacy (Sample)',deaNo:'SAMPLE',deaExpiry:A(t,50),tsbpNo:'SAMPLE',tsbpExpiry:A(t,210)}];
  st.people=[
   {id:'p1',name:'Sample Owner',role:'Owner',duties:['Owner'],tags:[],licExpiry:'',siteId:''},
   {id:'p2',name:'Sample Pharmacist-in-Charge',role:'Pharmacist',duties:['PIC','Designated Person'],tags:['sterile-compounder','ns-compounder','bbp','immunizer'],licNo:'SAMPLE',licExpiry:A(t,18),siteId:'s1'},
   {id:'p3',name:'Sample Staff Pharmacist',role:'Pharmacist',duties:[],tags:['sterile-compounder','bbp'],licExpiry:A(t,400),siteId:'s1'},
   {id:'p4',name:'Sample Technician',role:'Technician',duties:[],tags:['ns-compounder','sterile-compounder'],licExpiry:A(t,240),siteId:'s1'}];
  st.rooms=[{id:'rm1',siteId:'s1',kind:'ante',num:'',iso:'8',neg:false,name:'Ante Room'},{id:'rm2',siteId:'s1',kind:'buffer',num:'',iso:'7',neg:false,name:'Buffer Room'},{id:'rm3',siteId:'s1',kind:'nsa',num:'',iso:'',neg:false,name:'Nonsterile Compounding Area',note:'Bench Beside The Dispensing Counter'}];
  st.equipment=[{id:'e1',name:'Hood A (Sample)',kind:'Primary Engineering Control (PEC)',siteId:'s1',pec:{type:'lafw',flow:'h',ft:4,brand:'Sample Brand',model:'Series 100',roomId:'rm2'}},{id:'e2',name:'Refrigerator 1 (Sample)',kind:'Refrigerator / Freezer',siteId:'s1'}];
  st.documents=[{id:'d1',title:'Sterile Compounding SOP Manual (Sample)',type:'SOP',version:'3.1',lastReviewed:A(t,-390),reviewMonths:12,siteId:''},{id:'d2',title:'Controlled Substance Policy (Sample)',type:'Policy',version:'2.0',lastReviewed:A(t,-120),reviewMonths:12,siteId:''},{id:'d3',title:'Immunization Consent Form (Sample)',type:'Form',version:'1.4',lastReviewed:A(t,-30),reviewMonths:12,siteId:''}];
  st.tracks={'dea-biennial|s1':{baselineDate:A(t,-560)},'u797-sop|s1':{baselineDate:A(t,-400)},'u797-cert-pec|e1':{baselineDate:A(t,-170)},'u797-cert-sec|rm1':{baselineDate:A(t,-100)},'u797-cert-sec|rm2':{baselineDate:A(t,-100)},'u795-sop|s1':{baselineDate:A(t,-200)},'osha-ecp|s1':{baselineDate:A(t,-300)},'hipaa-risk|s1':{baselineDate:A(t,-340)},
    'u797-garb|p3':{baselineDate:A(t,-150)},'u797-garb|p4':{baselineDate:A(t,-210)},'u797-media|p3':{baselineDate:A(t,-150)},'u797-media|p4':{baselineDate:A(t,-100)},'u797-didactic|p3':{baselineDate:A(t,-300)},'u797-didactic|p4':{baselineDate:A(t,-300)},'u797-didactic|p2':{baselineDate:A(t,-300)},'u797-garb|p2':{baselineDate:A(t,-300)},'u797-media|p2':{baselineDate:A(t,-300)},
    'u795-training|p2':{baselineDate:A(t,-250)},'u795-training|p4':{baselineDate:A(t,-250)},'osha-training|p2':{baselineDate:A(t,-200)},'osha-training|p3':{baselineDate:A(t,-200)},'hipaa-training|p1':{baselineDate:A(t,-100)},'hipaa-training|p2':{baselineDate:A(t,-100)},'hipaa-training|p3':{baselineDate:A(t,-100)},'hipaa-training|p4':{baselineDate:A(t,-100)}};
  recompute();
  const mk=(track,due,doneOn,extra)=>st.records.push(Object.assign({id:uid('r'),track,completedOn:doneOn,forDue:due,completedBy:'Sample Pharmacist-in-Charge',status:'done',createdAt:doneOn+'T12:00:00Z'},extra||{}));
  // monthly surface sampling: on time, one late, one missed
  const sf=IL.trackOccurrences({ob:obligations().find(o=>o.id==='u797-surface'),trk:{},recs:[],today:t,to:t,trackStart:st.profile.trackingStart});
  sf.forEach((o,i)=>{ if(o.due>=t)return; if(i===1)return; const late=i===2; mk('u797-surface|s1',o.due,late?IL.addDays(o.due,4):IL.addDays(o.due,-2),{result:'Within Action Levels',evidence:'Lab report (sample)',lateReason:late?'Courier delayed lab pickup (sample)':''}); });
  const ms=IL.trackOccurrences({ob:obligations().find(o=>o.id==='cs-reconcile'),trk:{},recs:[],today:t,to:t,trackStart:st.profile.trackingStart});
  ms.forEach(o=>{ if(o.due<t)mk('cs-reconcile|s1',o.due,IL.addDays(o.due,-1),{evidence:'Reconciliation sheet (sample)'}); });
  const sp=IL.trackOccurrences({ob:obligations().find(o=>o.id==='u797-sporicidal'),trk:{},recs:[],today:t,to:t,trackStart:st.profile.trackingStart});
  sp.forEach(o=>{ if(o.due<t)mk('u797-sporicidal|s1',o.due,IL.addDays(o.due,-3),{}); });
  mk('tx-cs-annual|s1','2026-05-01','2026-05-03',{lateReason:'Count scheduled after weekend close (sample)'});
  mk('u797-air|s1',null,IL.addDays(t,-95),{result:'Within Action Levels'}); // air sampling record (no baseline needed)
  { const lr=st.records.filter(r=>r.track==='cs-reconcile|s1').sort((x,y)=>x.completedOn<y.completedOn?-1:1).pop();
    if(lr){ const at=lr.completedOn+'T15:00:00Z'; lr.review={status:'pending'}; lr.task={enteredBy:'Sample Staff Pharmacist',enteredAt:at,startedBy:'Sample Staff Pharmacist',startedAt:at,comments:[{at:at,by:'Sample Staff Pharmacist',text:'Count matched the perpetual inventory (sample).'}],files:[],hist:[{at:at,by:'Sample Staff Pharmacist',act:'Started'},{at:at,by:'Sample Staff Pharmacist',act:'Completed'}]}; lr.completedBy='Sample Staff Pharmacist'; } }
  try{ const pc=IL.trackOccurrences({ob:obligations().find(o=>o.id==='u797-cert-pec'),trk:st.tracks['u797-cert-pec|e1'],recs:[],today:t,to:A(t,150),trackStart:st.profile.trackingStart}).find(o=>!o.done&&o.due);
    if(pc){ const at=new Date().toISOString(); st.work['u797-cert-pec|e1|'+pc.key]={id:'w_demo',t:'u797-cert-pec|e1',k:pc.key,title:'PEC Certification',subj:'Hood A (Sample)',enteredBy:'Sample Technician',enteredAt:at,startedBy:'Sample Technician',startedAt:at,result:'',comments:[{at:at,by:'Sample Technician',text:'Certifier on site. Waiting for the report (sample).'}],files:[],evid:'',note:'',hist:[{at:at,by:'Sample Technician',act:'Started'}]}; } }catch(e){}
  st.log=[{id:'l1',ts:t+'T14:05:00Z',by:'Sample Pharmacist-in-Charge',action:'Completed',detail:'Monthly Controlled Substance Reconciliation (sample entry)'}];
  return st;
}

/* ===== storage ===== */
const Store={db:null,kind:'memory',err:'',unsubs:[],cfgTimer:null,chain:Promise.resolve(),
 async init(){
  if(window.ILHOST){ try{ const o=await Promise.race([ILHOST.load(),new Promise((_,j)=>setTimeout(()=>j(new Error('timeout')),15000))]); this.kind='host'; if(o&&o.mode==='live'){ S=Object.assign(emptyState(),o); } return; }catch(e){ this.kind='local'; this.err='The server did not answer ('+(e&&e.message||'error')+'). Changes are not being saved to the server.'; this.hostFail=true; return; } }
  let db=null; try{ if(window.claude&&claude.use) db=await Promise.race([claude.use('db'),new Promise(r=>setTimeout(()=>r(null),6000))]); }catch(e){}
  this.db=db||null;
  if(this.db){
    try{ const snap=await Promise.race([this.db.doc('cal/config').get(),new Promise((_,j)=>setTimeout(()=>j(new Error('timeout')),10000))]);
      this.kind='db'; if(snap.exists){ await this.loadDb(); } return; }catch(e){ this.err='Shared database did not answer ('+(e&&e.message||'error')+'). Working in this browser only.'; this.db=null; }
  }
  this.kind='local';
  try{ const raw=localStorage.getItem('ilcal.v1'); if(raw){ const o=JSON.parse(raw); if(o&&o.mode==='live'){ S=Object.assign(emptyState(),o); } } }catch(e){}
 },
 async loadDb(){
  const db=this.db; const cfg=clone((await db.doc('cal/config').get()).data()); S=Object.assign(emptyState(),cfg,{mode:'live'});
  const col=async n=>{ try{ return (await db.collection(n).get()).docs.map(d=>clone(d.data())); }catch(e){ return []; } };
  S.records=await col('records'); S.events=await col('events'); S.log=(await col('log')).sort((a,b)=>a.ts<b.ts?1:-1).slice(0,300);
  const ob=await col('obl'); S.obl={}; S.custom=[]; ob.forEach(o=>{ if(o.isCustom)S.custom.push(o); else S.obl[o.id]=o; });
  this.subscribe();
 },
 subscribe(){
  const db=this.db; this.unsubs.forEach(u=>u()); this.unsubs=[]; const re=()=>{recompute();render();};
  const cb=(name,fn)=>this.unsubs.push(db.collection(name).onSnapshot(snap=>{ fn(snap.docs.map(d=>clone(d.data()))); re(); },()=>{}));
  this.unsubs.push(db.doc('cal/config').onSnapshot(s=>{ if(!s.exists||this.cfgDirty)return; const c=clone(s.data()); S=Object.assign(S,c,{mode:'live'}); re(); },()=>{}));
  cb('records',a=>{S.records=a;}); cb('events',a=>{S.events=a;});
  cb('obl',a=>{ S.obl={}; S.custom=[]; a.forEach(o=>{ if(o.isCustom)S.custom.push(o); else S.obl[o.id]=o; }); });
  cb('log',a=>{ S.log=a.sort((x,y)=>x.ts<y.ts?1:-1).slice(0,300); });
 },
 cfgObj(){ return {v:1,profile:S.profile,sites:S.sites,people:S.people,equipment:S.equipment,documents:S.documents,tracks:S.tracks,plans:S.plans,work:S.work,reminders:S.reminders,rooms:S.rooms}; },
 saveLocal(){ if(window.ILHOST&&!this.hostFail){ clearTimeout(this.hostTimer); this.hostTimer=setTimeout(()=>{ this.queue(()=>Promise.resolve(ILHOST.save(S))); },600); return; } if(this.hostFail)return; try{ localStorage.setItem('ilcal.v1',JSON.stringify(S)); }catch(e){} },
 queue(fn){ this.chain=this.chain.then(fn).catch(e=>{ toast('Could not save: '+((e&&e.message)||'read-only view')); }); return this.chain; },
 saveConfig(){ if(S.mode!=='live')return; if(!this.db){ this.saveLocal(); return; } this.cfgDirty=true; clearTimeout(this.cfgTimer);
  this.cfgTimer=setTimeout(()=>{ this.cfgTimer=null; this.queue(()=>this.db.doc('cal/config').set(this.cfgObj())).then(()=>{ if(!this.cfgTimer)this.cfgDirty=false; }); },400); },
 put(coll,obj){ if(S.mode!=='live')return; if(!this.db){ this.saveLocal(); return; } return this.queue(()=>this.db.collection(coll).doc(obj.id).set(obj)); },
 del(coll,id){ if(S.mode!=='live')return; if(!this.db){ this.saveLocal(); return; } return this.queue(()=>this.db.collection(coll).doc(id).delete()); }
};
function whoAmI(){ const p=S.people.find(x=>x.id===ME); return p?p.name:((window.ILHOST&&ILHOST.user&&ILHOST.user.name)||'Unspecified User'); }
function logAct(action,detail){ const e={id:uid('l'),ts:new Date().toISOString(),by:whoAmI(),action,detail}; S.log.unshift(e); S.log=S.log.slice(0,300); Store.put('log',e); }
function toast(m){ document.querySelectorAll('.toast').forEach(x=>x.remove()); const t=document.createElement('div'); t.className='toast'; t.textContent=m; document.body.appendChild(t); setTimeout(()=>t.remove(),3500); }
function changed(kind){ if(kind==='config')Store.saveConfig(); else if(!Store.db)Store.saveLocal(); recompute(); render(); }
