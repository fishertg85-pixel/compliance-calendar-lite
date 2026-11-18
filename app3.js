/* ===== form + modal helpers ===== */
const fld=(l,h,hint)=>'<div class="fld"><label>'+l+'</label>'+h+(hint?'<div class="hint">'+hint+'</div>':'')+'</div>';
const inp=(id,v,type,ph)=>'<input type="'+(type||'text')+'" id="f_'+id+'" value="'+esc(v==null?'':v)+'"'+(ph?' placeholder="'+esc(ph)+'"':'')+'>';
const sel=(id,opts,v)=>'<select id="f_'+id+'">'+opts.map(o=>{const a=Array.isArray(o)?o:[o,o];return '<option value="'+esc(a[0])+'"'+(a[0]===v?' selected':'')+'>'+esc(a[1])+'</option>';}).join('')+'</select>';
const chk=(id,opts,vals)=>'<div class="checks" id="f_'+id+'">'+opts.map(a=>'<label><input type="checkbox" value="'+esc(a[0])+'"'+((vals||[]).includes(a[0])?' checked':'')+'> '+esc(a[1])+'</label>').join('')+'</div>';
const area=(id,v,ph)=>'<textarea id="f_'+id+'"'+(ph?' placeholder="'+esc(ph)+'"':'')+'>'+esc(v||'')+'</textarea>';
const bool=(id,v,l)=>'<label class="checks"><input type="checkbox" id="f_'+id+'"'+(v?' checked':'')+'> '+esc(l)+'</label>';
const V=id=>{const e=document.getElementById('f_'+id);return e?e.value.trim():'';};
const VB=id=>{const e=document.getElementById('f_'+id);return !!(e&&e.checked);};
const VC=id=>[...document.querySelectorAll('#f_'+id+' input:checked')].map(x=>x.value);
let MODAL=null;
function openModal(title,body,foot,o){
  o=o||{}; MODAL={save:o.save||null};
  $('#modal').innerHTML='<div class="ov" data-act="ovclose"><div class="modal'+(o.wide?' wide':'')+(o.xwide?' xwide':'')+'" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><h3>'+esc(title)+'</h3><div class="mb">'+body+'<div class="err" id="merr"></div></div><div class="mf">'+(foot||'')+'</div></div></div>';
  const f=document.querySelector('#modal input:not([type=checkbox]),#modal select,#modal textarea'); if(f&&!o.nofocus)f.focus();
}
function closeModal(){ $('#modal').innerHTML=''; MODAL=null; }
function merr(m){ const e=$('#merr'); if(e){e.textContent=m;} return false; }
const FOOT_SAVE=(lbl)=>'<button class="btn" data-act="close">Cancel</button><button class="btn pri" data-act="msave">'+(lbl||'Save')+'</button>';
/* generic form: fields [{id,label,type,opts,hint,ph,req}] */
function formModal(o){
  const v=o.vals||{};
  const body=o.fields.map(f=>{ let h; const val=v[f.id];
    if(f.type==='select')h=sel(f.id,f.opts,val); else if(f.type==='checks')h=chk(f.id,f.opts,val); else if(f.type==='area')h=area(f.id,val,f.ph); else if(f.type==='bool')return bool(f.id,val,f.label); else h=inp(f.id,val,f.type,f.ph);
    return fld(f.label,h,f.hint); }).join('');
  openModal(o.title,(o.intro?'<p class="mut" style="margin:0">'+o.intro+'</p>':'')+body,(o.extra||'')+FOOT_SAVE(o.saveLabel),{save:()=>{
    const r={}; for(const f of o.fields){ r[f.id]=f.type==='checks'?VC(f.id):f.type==='bool'?VB(f.id):V(f.id); if(f.req&&!r[f.id]&&!(Array.isArray(r[f.id])))return merr(f.label+' Is Required.'); }
    const e=o.save(r); if(e)return merr(e); closeModal(); }});
}
function textModal(title,text){ openModal(title,'<p class="mut" style="margin:0">Your browser blocked the file save. Select all of this text and copy it into a file.</p><textarea style="min-height:260px;font-family:var(--mono);font-size:12px" readonly id="f_txt">'+esc(text)+'</textarea>','<button class="btn pri" data-act="close">Close</button>',{nofocus:true}); }
async function saveFile(name,data){
  let dl=null; try{ dl=await claude.use('downloads'); }catch(e){}
  if(!dl&&window.ILHOST){ try{ const type=/\.csv$/i.test(name)?'text/csv':/\.html?$/i.test(name)?'text/html':/\.json$/i.test(name)?'application/json':'text/plain'; const u=URL.createObjectURL(new Blob([data],{type:type+';charset=utf-8'})); const a=document.createElement('a'); a.href=u; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),4000); toast('Saved '+name); return; }catch(e){} }
  if(!dl){ textModal(name,data); return; }
  try{ await dl.save({filename:name,data}); toast('Saved '+name); }catch(e){ if(e&&e.code==='declined')return; textModal(name,data); }
}
const siteOpts=()=>[['','Not Assigned']].concat(S.sites.filter(s=>!s.archived).map(s=>[s.id,s.name]));
const subjLine=t=>t.ob.title+' — '+t.subj.name;

/* ===== record completion ===== */
const needMe=()=>(S.people.some(p=>!p.archived)&&!ME&&!(window.ILHOST&&ILHOST.user&&ILHOST.user.name))?'Select Your Name In Acting As (Top Right) First, So The Record Shows Who Did This.':'';
let ASSETS;
async function getAssets(){ if(ASSETS!==undefined)return ASSETS; try{ ASSETS=(window.claude&&claude.use)?await Promise.race([claude.use('assets'),new Promise(r=>setTimeout(()=>r(null),6000))]):null; }catch(e){ ASSETS=null; } return ASSETS; }
function refreshAtt(){ const el=$('#attList'); if(el&&MODAL&&MODAL.files)el.innerHTML=attHtml(MODAL.files,true); }
async function attachFiles(el){
  const files=[...el.files]; el.value=''; const tok=MODAL&&MODAL.token; if(!tok||!files.length)return;
  const A=await getAssets(); if(!MODAL||MODAL.token!==tok)return;
  if(!A){ merr('Attachments Are Not Available In This View. They Need Editor Access To The Published Calendar.'); return; }
  merr(''); const who=whoAmI();
  for(const f of files){ if(f.size>20*1048576){ merr(f.name+' Is Over The 20 MB Limit.'); continue; }
    try{ const r=await A.upload(f); if(!MODAL||MODAL.token!==tok)return; MODAL.files.push({id:r.id,name:f.name,size:r.sizeBytes||f.size,type:r.contentType||f.type,by:who,at:nowIso()}); }
    catch(e){ if(!MODAL||MODAL.token!==tok)return; merr('Could Not Attach '+f.name+': '+((e&&e.message)||'file type not supported')+'. PDF, images, and text or CSV files are supported.'); } }
  refreshAtt();
}
function collectWork(o){
  const t=o.track, ob=t.ob, pk=o.trackKey+'|'+o.key, now=nowIso(), who=whoAmI(); const old=S.work[pk]; const fresh=!old; const bits=[];
  const W=fresh?{id:uid('w'),t:o.trackKey,k:o.key,title:ob.title,subj:t.subj.name,enteredBy:who,enteredAt:now,startedBy:V('sby')||who,startedAt:(MODAL&&MODAL.openedAt)||now,result:'',comments:[],files:[],evid:'',note:'',hist:[{at:now,by:who,act:'Started'}]}:clone(old);
  const c=V('cmt'); if(c){ W.comments.push({at:now,by:who,text:c}); bits.push('comment added'); }
  if(ob.res&&ob.res.length){ const r=V('res'); if(r!==(W.result||'')){ bits.push(r?'result '+r:'result cleared'); W.result=r; } }
  const prev=(W.files||[]).map(f=>f.id), cur=MODAL.files.map(f=>f.id);
  MODAL.files.filter(f=>!prev.includes(f.id)).forEach(f=>bits.push('attached '+f.name)); (W.files||[]).filter(f=>!cur.includes(f.id)).forEach(f=>bits.push('removed '+f.name));
  if(MODAL&&MODAL.form){ const d=MODAL.form.read(o); W.data=d; if(JSON.stringify(d)!==MODAL.base)bits.push('details updated'); }
  W.files=MODAL.files.map(f=>Object.assign({},f)); W.evid=V('evid'); W.note=V('note');
  if(bits.length)W.hist.push({at:now,by:who,act:'Saved: '+bits.join('; ')});
  return {W,bits,fresh};
}
function workSave(o){
  const e=needMe(); if(e)return merr(e); const pk=o.trackKey+'|'+o.key;
  const cw=collectWork(o); S.work[pk]=cw.W;
  logAct(cw.fresh?'Started Task':'Saved Task',subjLine(o.track)+(cw.bits.length?': '+cw.bits.join('; '):''));
  closeModal(); toast(failedRes(o.track.ob,cw.W.result)?'Saved. A failed result keeps this task open.':'Saved. The task stays open until it is completed.'); changed('config'); return true;
}

/* ===== task screen: start, save and close, complete ===== */
/* ===== task types: each type has its own window ===== */
const CERT_TESTS={'u797-cert-pec':['HEPA Filter Integrity (Leak) Test','Airflow Velocity','Airflow Pattern (Smoke Study)','Total Particle Count'],'u797-cert-sec':['HEPA Filter Integrity (Leak) Test','Airflow Velocity And Uniformity','Air Changes Per Hour','Room Pressure Differentials','Total Particle Count']};
const PEC_TYPES={lafw:'Laminar Airflow Workbench (LAFW)',bsc:'Biological Safety Cabinet (BSC)',cai:'Compounding Aseptic Isolator (CAI)',caci:'Compounding Aseptic Containment Isolator (CACI)'};
const BSC_TYPES=['Class II Type A1','Class II Type A2','Class II Type B1','Class II Type B2'];
const PEC_TESTS={lafw:['HEPA Filter Integrity (Leak) Test','Airflow Velocity','Airflow Pattern (Smoke Study)','Total Particle Count','Induction Leak','Backstreaming'],bsc:['HEPA Filter Integrity (Leak) Test','Downflow Velocity','Inflow Velocity','Airflow Pattern (Smoke Study)','Total Particle Count','Site Installation Assessment'],cai:['HEPA Filter Integrity (Leak) Test','Chamber Pressure','Ingress And Egress','Particle Containment','Total Particle Count']};
PEC_TESTS.caci=PEC_TESTS.cai;
function certTests(o){ const s=o.track.subj; if(s.type==='room')return CERT_TESTS['u797-cert-sec']; const p=s.data&&s.data.pec; return (p&&PEC_TESTS[p.type])||CERT_TESTS['u797-cert-pec']; }
function pecDetail(p){ return [p.type==='lafw'?(p.flow==='h'?'Horizontal Airflow':'Vertical Airflow'):'',p.type==='bsc'?p.bsc:'',p.ft?p.ft+' ft':''].filter(Boolean).join(' · '); }
function certInfo(o){ const s=o.track.subj; if(s.type==='room')return '<div class="banner info" style="margin:0 0 8px"><b>'+esc(s.name)+'</b> · Required Air Quality: ISO '+esc(s.data.iso)+'</div>'; const p=s.data&&s.data.pec; if(!p)return '';
  return '<div class="banner info" style="margin:0 0 8px"><b>'+esc(s.name)+'</b> · '+esc([PEC_TYPES[p.type],pecDetail(p),[p.brand,p.model].filter(Boolean).join(' ')].filter(Boolean).join(' · '))+' · Required Air Quality: ISO 5</div>'; }
const TESTRES=[['','Choose'],['Pass','Pass'],['Fail','Fail']];
const TESTRES_L={Pass:'Pass',Fail:'Fail',NA:'Not Performed'};
const FORMS={
 cert:{
  onLabel:'Test Date', onHint:'<span id="fmNext"></span>', resLabel:'Certification Status', pendLabel:'Pending', resHint:'Set Automatically From The Test Results. Pending Until Every Test Has A Result. Complete Is Available Only When The Status Is Certified.', noEvid:true,
  pre(W,o){ const d=(W&&W.data)||{}, tests=certTests(o);
    return certInfo(o)+'<div class="sec">Certifier</div><div class="g2">'+fld('Certifier Company',inp('fm_co',d.co,'text'))+fld('Certifier Name',inp('fm_cn',d.cn,'text'))+'</div>'+fld('Certification Report Number',inp('fm_rn',d.rn,'text'))+
     '<div class="sec">Tests Performed</div><div class="tw"><table><tr><th>Test</th><th style="width:190px">Result</th></tr>'+tests.map((n,i)=>'<tr><td>'+esc(n)+'</td><td>'+sel('fm_t'+i,TESTRES,((d.tests||[])[i]||{}).r||'')+'</td></tr>').join('')+'</table></div><div class="sec">Certification Result</div>'; },
  post(W,o){ const d=(W&&W.data)||{}; return '<div id="fmFail" style="display:none"><div class="warnbox" style="margin:0 0 8px">Not certified. Record the corrective action and when the re-test will be done. The task stays open.</div>'+fld('Corrective Action',area('fm_ca',d.ca,'What will be fixed, and by whom'))+fld('Re-Test Date',inp('fm_rt',d.rt,'date'))+'</div>'; },
  read(o){ const tests=certTests(o); return {on:V('on'),co:V('fm_co'),cn:V('fm_cn'),rn:V('fm_rn'),tests:tests.map((n,i)=>({n,r:V('fm_t'+i)})),ca:V('fm_ca'),rt:V('fm_rt')}; },
  check(d,o){ if(!d.co)return 'Enter The Certifier Company.'; if(!d.cn)return 'Enter The Certifier Name.'; if(!d.rn)return 'Enter The Certification Report Number.';
    if(d.tests.some(x=>!x.r))return 'Choose A Result For Every Test: Pass Or Fail.';
    if(d.tests.some(x=>x.r==='Fail'))return 'A Test Is Marked Fail, So This Cannot Be Completed As Certified. Correct The Test Entry, Or Use Save And Close.';
    if(!(MODAL&&MODAL.files&&MODAL.files.length))return 'Attach The Certification Report.'; return ''; },
  bind(o){ const ob=o.track.ob, n=(o.track.trk&&o.track.trk.n)||ob.rec.n, u=(o.track.trk&&o.track.trk.unit)||ob.rec.unit;
    const nx=()=>{ const d=V('on'); const e=$('#fmNext'); if(e)e.textContent=d&&/^\d{4}-\d{2}-\d{2}$/.test(d)?'Next Certification Due '+fmt(IL.addInterval(d,n,u))+' ('+IL.freqText(ob,o.track.trk).toLowerCase()+').':''; };
    const fl=()=>{ const r=V('res'); $('#fmFail').style.display=(r&&r!==ob.res[0])?'':'none'; };
    const rs=$('#f_res'); rs.disabled=true; const tests=certTests(o);
    const der=()=>{ const v=tests.map((n,i)=>V('fm_t'+i)); const r=v.some(x=>!x)?'':(v.some(x=>x==='Fail')?ob.res[1]:ob.res[0]); if(rs.value!==r){ rs.value=r; rs.dispatchEvent(new Event('change')); } };
    tests.forEach((n,i)=>$('#f_fm_t'+i).addEventListener('change',der));
    $('#f_on').addEventListener('input',nx); rs.addEventListener('change',fl); nx(); der(); fl(); },
  view(d,t){ if(!d)return ''; return '<div class="sec">Certification Details</div><dl class="kv"><dt>Certifier</dt><dd>'+esc([d.co,d.cn].filter(Boolean).join(' · ')||'—')+'</dd><dt>Report Number</dt><dd>'+esc(d.rn||'—')+'</dd><dt>Test Date</dt><dd>'+(d.on?fmt(d.on):'—')+'</dd></dl>'+
     ((d.tests||[]).length?'<div class="tw"><table><tr><th>Test</th><th>Result</th></tr>'+d.tests.map(x=>'<tr><td>'+esc(x.n)+'</td><td>'+esc(TESTRES_L[x.r]||'—')+'</td></tr>').join('')+'</table></div>':'')+
     (d.ca?'<dl class="kv"><dt>Corrective Action</dt><dd style="white-space:normal">'+esc(d.ca)+'</dd>'+(d.rt?'<dt>Re-Test Date</dt><dd>'+fmt(d.rt)+'</dd>':'')+'</dl>':''); }
 }
};
const formOf=ob=>ob&&ob.form&&FORMS[ob.form]||null;

function recModal(o){
  const t=o.track, ob=t.ob, k=ob.rec.kind, today=D.today, pk=o.trackKey+'|'+o.key; const W=(S.work||{})[pk]; const hasRes=!!(ob.res&&ob.res.length); const F=formOf(ob);
  const alsoIds=(ob.alsoSatisfies||[]).filter(id=>D.tracks.some(x=>x.key===id+'|'+t.subj.id&&!x.inactive));
  const alsoTitles=alsoIds.map(id=>(D.obs.find(x=>x.id===id)||{}).title).filter(Boolean);
  let note=''; if(k==='expiry'&&o.openDate&&!o.canAct)note='<div class="warnbox">The renewal window opens '+fmt(o.openDate)+'. You can still record a renewal now.</div>';
  let cl=o.moved?'<div class="banner info" style="margin:0 0 8px">'+esc(movedNote(o))+' To The '+(S.profile.shift==='prev'?'Previous':'Next')+' Open Day.</div>':''; if(o.due){ const hh=hoursFor(o.due); if(hh.closed){ const pv=prevOpenDay(o.due); cl='<div class="warnbox">The due date falls on a day the pharmacy is closed ('+esc(hh.reason)+').'+(pv?' Plan to complete it by '+longDate(pv)+'.':'')+'</div>'; } }
  const pln=(S.plans||{})[pk]; if(pln)cl+='<div class="banner info" style="margin:0">Scheduled for '+esc(longDate(pln.date)+(pln.allDay?' (All Day)':' at '+t12(toMin(pln.time))))+'.</div>';
  const me=whoAmI()==='Unspecified User'?'':whoAmI();
  const last=W&&W.hist&&W.hist.length?W.hist[W.hist.length-1]:null;
  const stat=W?'<div class="banner info" style="margin:0"><b>In Progress.</b> Started by '+esc(W.startedBy||'—')+' on '+esc(fmtTs(W.startedAt))+'. Entered by '+esc(W.enteredBy||'—')+'.'+(last?' Last saved '+esc(fmtTs(last.at))+' by '+esc(last.by||'—')+'.':'')+'</div>':'<div class="banner info" style="margin:0"><b>Not Started.</b> Saving or completing records who started it and when.</div>';
  const body=cl+stat+'<dl class="kv"><dt>Item</dt><dd>'+esc(ob.title)+'</dd><dt>For</dt><dd>'+esc(t.subj.name)+'</dd><dt>Due</dt><dd>'+(o.due?fmt(o.due)+' ('+esc(whenText(o.days))+')':'—')+'</dd><dt>Authority</dt><dd>'+esc(ob.auth||'—')+' '+pill(ob.conf)+'</dd><dt>Keep As Evidence</dt><dd style="white-space:normal">'+esc(ob.evid||'—')+'</dd></dl>'+note+
   '<datalist id="plist">'+S.people.filter(p=>!p.archived).map(p=>'<option value="'+esc(p.name)+'">').join('')+'</datalist>'+
   (W?'':fld('Started By','<input type="text" id="f_sby" list="plist" value="'+esc(me)+'">'))+
   (F?F.pre(W,o):'')+(hasRes?fld((F&&F.resLabel)||'Result',sel('res',[['',(F&&F.pendLabel)||'Pending: Results Not In']].concat(ob.res.map(x=>[x,x])),W?(W.result||''):''),(F&&F.resHint)||'Complete Is Available Only When The Result Is "'+esc(ob.res[0])+'".')+'<div id="resWarn"></div>':'')+(F?F.post(W,o):'')+
   fld('Comments','<div id="cmtList" class="cmts">'+commentsHtml(W?W.comments:[])+'</div>'+area('cmt','','Add A Comment: Details That Matter For This Task'))+
   fld('Documentation','<div id="attList">'+attHtml(W?W.files:[],true)+'</div><input type="file" id="f_file" multiple data-chg="attach" accept="application/pdf,image/*,text/plain,text/csv,.csv,.txt,.md,.json">','PDF, Images, Text Or CSV. Up To 20 MB Each. Do Not Attach Patient Information.')+
   '<div class="sec">Completion</div>'+
   '<div class="g2">'+fld((F&&F.onLabel)||'Completed On',inp('on',(W&&W.data&&W.data.on)||today,'date'),F&&F.onHint)+fld('Completed By','<input type="text" id="f_by" list="plist" value="'+esc(me)+'">')+'</div>'+
   (k==='expiry'?fld('New Expiration Date',inp('next','','date'),'Required. This starts the next renewal cycle.'):'')+
   ((F&&F.noEvid)?'':fld('Evidence Location',inp('evid',W?W.evid:'','text','Binder, file name or folder')))+
   '<div class="fld" id="lateBox" style="display:none"><label>Reason For Late Completion (Required)</label><textarea id="f_late" placeholder="What happened, and what changed to prevent it?"></textarea></div>'+
   fld('Completion Notes',area('note',W?W.note:''))+
   (alsoTitles.length?bool('also',true,'Also Counts For: '+alsoTitles.join('; ')):'');
  const canNA=(k==='fixed'||k==='event'||k==='once');
  openModal(W?'Task In Progress':'Start Task',body,'<button class="btn" data-act="series" data-t="'+esc(o.trackKey)+'" data-k="'+esc(o.key)+'">View Series</button><button class="btn" data-act="plan" data-t="'+esc(o.trackKey)+'" data-k="'+esc(o.key)+'">'+(pln?'Change Time':'Set Time')+'</button>'+(canNA?'<button class="btn danger" data-act="mna">Mark Not Applicable</button>':'')+'<span style="flex:1"></span><button class="btn" data-act="close">Cancel</button><button class="btn" data-act="mwork">Save And Close</button><button class="btn pri" id="btnDone" data-act="msave">Complete</button>',{wide:true,save:()=>saveRec(o,false,alsoIds)});
  MODAL.na=()=>saveRec(o,true,[]); MODAL.due=o.due; MODAL.work=()=>workSave(o); MODAL.token=Math.random(); MODAL.openedAt=nowIso(); MODAL.files=W?W.files.map(f=>Object.assign({},f)):[]; MODAL.o=o; MODAL.form=F; MODAL.base=F?JSON.stringify(W&&W.data?W.data:F.read(o)):'';
  MODAL.dirty=()=>!!((F&&JSON.stringify(F.read(o))!==MODAL.base)||V('cmt')||(hasRes&&V('res')!==(W?(W.result||''):''))||MODAL.files.length!==(W?W.files.length:0));
  const chkLate=()=>{ const d=V('on'); $('#lateBox').style.display=(o.due&&d&&d>o.due)?'':'none'; }; $('#f_on').addEventListener('input',chkLate); chkLate();
  const upd=()=>{ if(!hasRes)return; const r=V('res'), ok=r===ob.res[0]; const b=$('#btnDone'); b.disabled=!ok; $('#resWarn').innerHTML=(r&&!ok)?'<div class="warnbox" style="margin:0 0 8px">This result cannot be completed. Save And Close, and record the follow-up in Comments. The task stays open.</div>':''; };
  if(hasRes){ $('#f_res').addEventListener('change',upd); upd(); }
  if(F&&F.bind)F.bind(o);
}
function saveRec(o,na,alsoIds){
  const t=o.track, ob=t.ob, k=ob.rec.kind; const on=V('on')||D.today; const pk=o.trackKey+'|'+o.key;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(on))return merr('Enter A Valid Completion Date.');
  if(on>IL.addDays(D.today,1))return merr('Completion Date Cannot Be In The Future.');
  const late=!!(o.due&&on>o.due), lr=V('late');
  let reason='';
  if(na){ reason=prompt_na(); if(!reason)return merr('A Reason Is Required To Mark This Not Applicable. Type It In Completion Notes.'); }
  if(!na){ const e=needMe(); if(e)return merr(e); if(ob.res&&ob.res.length&&V('res')!==ob.res[0])return merr('Complete Is Available Only When The Result Is "'+ob.res[0]+'". Use Save And Close While Results Are Pending.'); }
  if(!na&&MODAL&&MODAL.form){ const m=MODAL.form.check(MODAL.form.read(o),o); if(m)return merr(m); }
  if(!na&&late&&!lr)return merr('A Reason For Late Completion Is Required.');
  if(!na&&k==='expiry'){ const n=V('next'); if(!n)return merr('Enter The New Expiration Date.'); if(n<=on)return merr('The New Expiration Date Must Be After The Completion Date.'); }
  const rec={id:uid('r'),track:o.trackKey,completedOn:on,forDue:k==='fixed'?(o.origDue||o.due):null,forEvent:o.event?o.event.id:null,completedBy:V('by'),status:na?'na':'done',result:V('res'),evidence:V('evid'),lateReason:na?'':lr,nextDue:k==='expiry'?V('next'):'',note:V('note'),naReason:na?reason:'',createdAt:nowIso(),by:whoAmI()};
  if(!na){ const cw=collectWork(o), W=cw.W; W.hist.push({at:nowIso(),by:whoAmI(),act:'Completed'}); rec.task={enteredBy:W.enteredBy,enteredAt:W.enteredAt,startedBy:W.startedBy,startedAt:W.startedAt,comments:W.comments,files:W.files,hist:W.hist}; rec.review={status:'pending'}; if(W.data)rec.data=W.data; }
  if(o.moved)rec.allowedDue=o.due;
  S.records.push(rec); Store.put('records',rec);
  if(S.plans&&S.plans[pk]){ delete S.plans[pk]; Store.saveConfig(); }
  if(S.work&&S.work[pk]){ delete S.work[pk]; Store.saveConfig(); }
  if(!na&&ob.id==='doc-review'){ t.subj.data.lastReviewed=on; Store.saveConfig(); }
  if(!na&&VB('also')) alsoIds.forEach(id=>{ const lk=id+'|'+t.subj.id; const r2=Object.assign({},rec,{id:uid('r'),track:lk,forDue:null,forEvent:null,linkedFrom:rec.id,note:'Counted from: '+ob.title+(rec.note?'. '+rec.note:'')}); delete r2.task; delete r2.review; S.records.push(r2); Store.put('records',r2); });
  logAct(na?'Marked Not Applicable':(late?'Completed Late':'Completed'),subjLine(t)+' ('+fmt(on)+(o.due?', due '+fmt(o.due):'')+')'+(na?': '+reason:''));
  closeModal(); toast(na?'Marked not applicable.':late?'Completed late. Sent to the Review Queue.':'Completed. Sent to the Review Queue.'); changed('rec'); return true;
}
function prompt_na(){ return V('note'); }

function detailModal(o){
  const t=o.track, r=o.rec, tk=r.task, rv=r.review; const pend=!!(rv&&rv.status==='pending'&&r.status!=='void'); const me=meP(), may=canReview(me);
  const body=(rv&&r.status!=='void'?'<div class="banner '+(pend?'info':'info')+'" style="margin:0">'+(pend?'<b>Completed And Locked.</b> Waiting for a supervisor to review.':'<b>Accepted.</b> This task is complete and documented. It cannot be changed.')+'</div>':'')+
   '<dl class="kv"><dt>Item</dt><dd>'+esc(t.ob.title)+'</dd><dt>For</dt><dd>'+esc(t.subj.name)+'</dd><dt>Due</dt><dd>'+fmt(o.due)+'</dd><dt>Status</dt><dd>'+pill(o.status)+revPill(o)+(o.lateDays?' ('+o.lateDays+' days late)':'')+'</dd>'+
   (tk?'<dt>Entered By</dt><dd>'+esc(tk.enteredBy||'—')+' · '+esc(fmtTs(tk.enteredAt))+'</dd><dt>Started By</dt><dd>'+esc(tk.startedBy||'—')+' · '+esc(fmtTs(tk.startedAt))+'</dd>':'')+
   '<dt>Completed On</dt><dd>'+fmt(r.completedOn)+'</dd><dt>Completed By</dt><dd>'+esc(r.completedBy||'—')+'</dd>'+
   (rv&&rv.status==='accepted'?'<dt>Reviewed By</dt><dd>'+esc(rv.by||'—')+' · '+esc(fmtTs(rv.at))+(rv.note?'<div style="white-space:normal">'+esc(rv.note)+'</div>':'')+'</dd>':'')+
   '<dt>Result</dt><dd>'+esc(r.result||'—')+'</dd><dt>Evidence</dt><dd style="white-space:normal">'+esc(r.evidence||'—')+'</dd>'+(r.lateReason?'<dt>Late Reason</dt><dd style="white-space:normal">'+esc(r.lateReason)+'</dd>':'')+(r.naReason?'<dt>Not Applicable Because</dt><dd style="white-space:normal">'+esc(r.naReason)+'</dd>':'')+(r.nextDue?'<dt>New Expiration</dt><dd>'+fmt(r.nextDue)+'</dd>':'')+(r.note?'<dt>Completion Notes</dt><dd style="white-space:normal">'+esc(r.note)+'</dd>':'')+(tk?'':'<dt>Entered</dt><dd>'+esc((r.createdAt||'').slice(0,10))+(r.by?' by '+esc(r.by):'')+'</dd>')+'</dl>'+(r.data&&formOf(t.ob)?formOf(t.ob).view(r.data,t):'')+
   (tk?'<div class="sec">Comments</div><div class="cmts">'+commentsHtml(tk.comments)+'</div><div class="sec">Documentation</div>'+attHtml(tk.files,false)+'<div class="sec">Activity</div><div class="cmts">'+histHtml((tk.hist||[]).concat(rv&&rv.status==='accepted'?[{at:rv.at,by:rv.by,act:'Reviewed: Accepted'}]:[]))+'</div>':'')+
   (pend?'<div class="sec">Review</div>'+(me&&me.name&&(r.completedBy||'').toLowerCase()===me.name.toLowerCase()?'<div class="warnbox" style="margin:0 0 8px">You completed this task. A different supervisor is usually expected to review it. It is recorded if you accept it yourself.</div>':'')+(!may?'<div class="warnbox" style="margin:0 0 8px">Only a person with PIC or Reviewer duty can accept. Choose one in Acting As (top right).</div>':'')+fld('Reviewer Comment',area('rvnote','','Optional')):'')+
   (r.status==='void'?'':fld('Reason To Void (Only If Entered In Error)',inp('void','','text','Required to void')));
  openModal('Completed Item',body,(r.status==='void'?'':'<button class="btn danger" data-act="mvoid" style="margin-right:auto">Void This Record</button>')+'<button class="btn" data-act="series" data-t="'+esc(o.trackKey)+'" data-k="'+esc(o.key)+'">View Series</button><button class="btn" data-act="mtrack" data-t="'+esc(o.trackKey)+'">Open Track</button>'+(pend?'<button class="btn" data-act="close">Close</button><button class="btn pri" data-act="maccept"'+(may?'':' disabled')+'>Accept</button>':'<button class="btn pri" data-act="close">Close</button>'),{nofocus:true,wide:true});
  MODAL.rec=r; MODAL.occ=o;
}
function acceptRec(){
  const r0=MODAL&&MODAL.rec; if(!r0)return; const r=S.records.find(x=>x.id===r0.id)||r0; const me=meP();
  if(!me||!canReview(me))return merr('Only A Person With PIC Or Reviewer Duty Can Accept. Choose One In Acting As.');
  if(!r.review||r.review.status!=='pending')return merr('This Task Was Already Reviewed.');
  const at=nowIso(); r.review={status:'accepted',by:me.name,byId:me.id,at:at,note:V('rvnote'),sameAsCompleter:(r.completedBy||'').toLowerCase()===me.name.toLowerCase()};
  Store.put('records',r); logAct('Accepted',subjLine(MODAL.occ.track)+' ('+fmt(r.completedOn)+')'); closeModal(); toast('Accepted. The task is complete and documented.'); changed('rec');
}

function voidRec(){
  const r0=MODAL&&MODAL.rec; if(!r0)return; const r=S.records.find(x=>x.id===r0.id)||r0; const why=V('void'); if(!why)return merr('Type A Reason In The Void Field.');
  r.status='void'; r.voidReason=why; r.voidedAt=new Date().toISOString(); Store.put('records',r);
  logAct('Voided Record',subjLine(MODAL.occ.track)+' ('+fmt(r.completedOn)+'): '+why); closeModal(); toast('Record voided. It stays in the log.'); changed('rec');
}

/* ===== baseline ===== */
function baselineModal(o){
  const t=o.track, k=t.ob.rec.kind;
  const exp=k==='expiry';
  openModal('Set Starting Record',
   '<dl class="kv"><dt>Item</dt><dd>'+esc(t.ob.title)+'</dd><dt>For</dt><dd>'+esc(t.subj.name)+'</dd></dl><p class="mut" style="margin:0">No due date can be shown yet. IronLedger does not guess one.</p>'+
   (exp?fld('Current Expiration Date',inp('first','','date')):
   fld('Last Completed On',inp('base','','date'),'The next due date is counted from this date.')+fld('Or Next Due Date',inp('first','','date'),'Use this when you know the due date but not the last completion.'))+
   fld('Or This Does Not Apply',bool('inact',false,'Stop Tracking This Item For This Subject')+inp('why','','text','Reason (required)')),
   FOOT_SAVE(),{save:()=>{
    const key=o.trackKey, tr=Object.assign({},S.tracks[key]||{});
    if(VB('inact')){ if(!V('why'))return merr('Enter A Reason For Stopping.'); tr.inactive=true; tr.inactiveReason=V('why'); logAct('Stopped Tracking',subjLine(t)+': '+tr.inactiveReason); }
    else{ const b=V('base'), f=V('first'); if(!b&&!f)return merr('Enter A Date.'); if(b)tr.baselineDate=b; if(f){ if(k==='expiry'&&t.ob.firstDueField)t.subj.data[t.ob.firstDueField]=f; else tr.firstDue=f; } logAct('Set Starting Record',subjLine(t)+': '+(b?'last done '+fmt(b):'next due '+fmt(f))); }
    S.tracks[key]=tr; closeModal(); changed('config'); return true; }});
}

/* ===== scheduling and hours ===== */
const QT=(()=>{ const r=[]; for(let m=0;m<1440;m+=15)r.push([String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'),t12(m)]); return r; })();
const snap15=t=>{ const m=Math.min(1425,Math.round(toMin(t)/15)*15); return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); };
function planModal(tk,k){
  const o=findOcc(tk,k); if(!o)return; const key=tk+'|'+k, cur=(S.plans||{})[key];
  const d0=cur?cur.date:(o.due&&o.due>=D.today?o.due:D.today); const hr0=hoursFor(d0); const t0=cur&&cur.time?snap15(cur.time):(hr0.closed?'09:00':snap15(String(Math.floor(hr0.o/60)).padStart(2,'0')+':'+String(hr0.o%60).padStart(2,'0')));
  openModal('Set Time','<dl class="kv"><dt>Item</dt><dd>'+esc(o.track.ob.title)+'</dd><dt>For</dt><dd>'+esc(o.track.subj.name)+'</dd><dt>Due</dt><dd>'+fmt(o.due)+'</dd></dl><div class="g2">'+fld('Planned Date',inp('pd',d0,'date'))+fld('Planned Time',sel('pt',QT,t0),'Starts On The Hour, Half Hour Or Quarter Hour.')+'</div><label class="ctl" style="margin:4px 0 8px"><input type="checkbox" id="f_ad"'+(cur&&cur.allDay?' checked':'')+'> All Day (No Set Time)</label><div id="planWarn"></div>',
   (cur?'<button class="btn danger" data-act="unplan" data-t="'+esc(tk)+'" data-k="'+esc(k)+'" style="margin-right:auto">Remove Schedule</button>':'')+FOOT_SAVE('Save Schedule'),
   {save:()=>{ const d=V('pd'), t=V('pt'), ad=$('#f_ad').checked; if(!d||(!ad&&!t))return merr('Enter A Date And Time.'); S.plans[key]={date:d,time:ad?'':t,allDay:ad,t:tk,k:k,title:o.track.ob.title,subj:o.track.subj.name}; logAct('Scheduled',o.track.ob.title+' — '+o.track.subj.name+' for '+fmt(d)+(ad?' (All Day)':' '+t12(toMin(t)))); closeModal(); changed('config'); return true; }});
  const w=()=>{ const d=V('pd'), t=V('pt'), ad=$('#f_ad').checked; $('#f_pt').disabled=ad; if(!d){ $('#planWarn').innerHTML=''; return; } const h=hoursFor(d); let m='',c='ok';
    if(h.closed){ m=longDate(d)+': pharmacy closed ('+h.reason+').'; c='warnbox'; } else if(ad){ m='All day. Pharmacy hours that day: '+h.text+'.'; } else { const mm=toMin(t); if(mm<h.o||mm>=h.c){ m='After hours. Pharmacy hours that day: '+h.text+'.'; c='warnbox'; } else m='During pharmacy hours ('+h.text+').'; }
    if(o.due&&d>o.due){ m+=' This is after the due date ('+fmt(o.due)+').'; c='warnbox'; }
    $('#planWarn').innerHTML='<div class="'+(c==='ok'?'banner info':'warnbox')+'" style="margin:0">'+esc(m)+'</div>'; };
  $('#f_pd').addEventListener('input',w); $('#f_pt').addEventListener('change',w); $('#f_ad').addEventListener('change',w); w();
}
function hoursModal(){
  const p=S.profile;
  const rows=DOWN.map((d,i)=>{ const h=p.hours[i]; const c24=h&&toMin(h.o)===0&&toMin(h.c)>=1440; return '<tr><td>'+d+'</td><td><label class="checks"><input type="checkbox" data-hc="'+i+'"'+(h?'':' checked')+'> Closed</label></td><td><label class="checks"><input type="checkbox" data-h24="'+i+'"'+(c24?' checked':'')+'> 24 Hours</label></td><td><input type="time" data-ho="'+i+'" value="'+(h&&!c24?h.o:'09:00')+'"></td><td><input type="time" data-hc2="'+i+'" value="'+(h&&!c24?h.c:'18:00')+'"></td></tr>'; }).join('');
  const hol=US.HOLIDAY_IDS.map(i=>[i,US.HOLIDAY_NAMES[i]]);
  openModal('Time Zone And Hours','<p class="mut" style="margin:0">Hours drive the clock, the open/closed status, after-hours shading and scheduling warnings. Times are in the pharmacy time zone.</p>'+fld('Time Zone',sel('tz',TZONES,p.tz),'Daylight saving time follows this zone automatically.')+'<div class="tw"><table><tr><th>Day</th><th></th><th></th><th>Opens</th><th>Closes</th></tr>'+rows+'</table></div>'+((window.ILHOST&&ILHOST.pharmacy)?'<p class="mut">Federal holiday closures and other closed days are set on the pharmacy page.</p>':fld('Pharmacy Is Closed On',chk('hol',hol,US.HOLIDAY_IDS.filter(i=>p.holClosed[i])),'A holiday on a Sunday closes the pharmacy the following Monday. A holiday on a Saturday does not close the Friday before.'))+fld('When A Repeating Task Falls On A Closed Day',sel('shift',[['next','Move It To The Next Open Day'],['prev','Move It To The Previous Open Day']],p.shift||'next'),'Closed Days Are Weekends, Holidays And Any Day The Pharmacy Is Closed. Expiration Dates, Event-Based And One-Time Items Never Move.'),FOOT_SAVE(),{wide:true,nofocus:true,save:()=>{
    const hrs=[]; for(let i=0;i<7;i++){ const cl=document.querySelector('[data-hc="'+i+'"]').checked, a24=document.querySelector('[data-h24="'+i+'"]').checked; const o=document.querySelector('[data-ho="'+i+'"]').value, c=document.querySelector('[data-hc2="'+i+'"]').value;
      if(cl){ hrs.push(null); continue; } if(a24){ hrs.push({o:'00:00',c:'24:00'}); continue; } if(!o||!c)return merr(DOWN[i]+': Enter Open And Close Times.'); if(toMin(c)<=toMin(o))return merr(DOWN[i]+': Closing Time Must Be After Opening Time. For all day, use 24 Hours.'); hrs.push({o,c}); }
    p.tz=V('tz'); p.shift=V('shift')||'next'; p.hours=hrs; if(!(window.ILHOST&&ILHOST.pharmacy)){ p.holClosed={}; VC('hol').forEach(i=>p.holClosed[i]=true); } logAct('Edited Hours',p.tz); closeModal(); changed('config'); return true; }});
}

/* ===== starting records (bulk) ===== */
function bulkModal(){
  const rows=D.noBase.filter(o=>!o.track.ob.routine).sort((a,b)=>{ const ca=CATS_ORDER.indexOf(a.track.ob.cat), cb=CATS_ORDER.indexOf(b.track.ob.cat); return ca-cb||(a.track.ob.title<b.track.ob.title?-1:1); });
  if(!rows.length){ toast('Every item already has a starting record.'); return; }
  openModal('Enter Starting Records','<p class="mut" style="margin:0">Leave a date blank if you do not know it. It stays flagged as No Record. Nothing is guessed.</p><div class="tw"><table><tr><th>Item</th><th>For</th><th>Enter</th><th>Date</th></tr>'+rows.map((o,i)=>{ const ex=o.track.ob.rec.kind==='expiry'; return '<tr><td title="'+esc(o.track.ob.title)+'">'+esc(o.track.ob.title)+'</td><td>'+esc(o.track.subj.name)+'</td><td class="mut">'+(ex?'Current Expiration':'Last Done On')+'</td><td><input type="date" data-bk="'+i+'" aria-label="Date"></td></tr>'; }).join('')+'</table></div>',FOOT_SAVE('Save Dates'),{wide:true,nofocus:true,save:()=>{
    let n=0, bad='';
    rows.forEach((o,i)=>{ const el=document.querySelector('[data-bk="'+i+'"]'); const v=el&&el.value; if(!v)return; const t=o.track, ex=t.ob.rec.kind==='expiry';
      if(!ex&&v>D.today){ bad=t.ob.title+': Last Done Cannot Be In The Future.'; return; } });
    if(bad)return merr(bad);
    rows.forEach((o,i)=>{ const el=document.querySelector('[data-bk="'+i+'"]'); const v=el&&el.value; if(!v)return; const t=o.track, ex=t.ob.rec.kind==='expiry'; const tr=Object.assign({},S.tracks[o.trackKey]||{});
      if(ex){ if(t.ob.firstDueField)t.subj.data[t.ob.firstDueField]=v; else tr.firstDue=v; } else { if(t.ob.baselineField)t.subj.data[t.ob.baselineField]=v; else tr.baselineDate=v; }
      S.tracks[o.trackKey]=tr; n++; });
    if(!n)return merr('Enter At Least One Date.');
    logAct('Entered Starting Records',n+' item'+(n===1?'':'s')); closeModal(); toast(n+' starting record'+(n===1?'':'s')+' saved.'); changed('config'); return true; }});
}

/* ===== track modal ===== */
function trackModal(key){
  const t=D.tracks.find(x=>x.key===key); if(!t)return; const ob=t.ob;
  const recs=S.records.filter(r=>r.track===key).sort((a,b)=>a.completedOn<b.completedOn?1:-1);
  const evs=S.events.filter(e=>e.track===key).sort((a,b)=>a.eventDate<b.eventDate?1:-1);
  const src=(ob.src||[]).map(s=>'<a href="'+esc(s.u)+'" target="_blank" rel="noopener">'+esc(s.t)+'</a>').join('<br>');
  const body='<dl class="kv"><dt>Obligation</dt><dd>'+esc(ob.title)+'</dd><dt>For</dt><dd>'+esc(t.subj.name)+'</dd><dt>Frequency</dt><dd>'+esc(IL.freqText(ob,t.trk))+'</dd><dt>Authority</dt><dd>'+esc(ob.auth||'—')+'</dd><dt>Basis / Confidence</dt><dd>'+esc(ob.basis)+' '+pill(ob.conf)+'</dd><dt>Responsible</dt><dd>'+esc(whoName(t))+'</dd><dt>Evidence To Keep</dt><dd style="white-space:normal">'+esc(ob.evid||'—')+'</dd><dt>Note</dt><dd style="white-space:normal">'+esc(ob.note||'—')+'</dd>'+(src?'<dt>Sources</dt><dd style="white-space:normal">'+src+'</dd>':'')+'</dl>'+
   (ob.rec.kind==='event'?'<div class="lbl">Events</div>'+(evs.length?'<table>'+evs.map(e=>'<tr><td class="num">'+fmt(e.eventDate)+'</td><td>'+esc(e.note||'')+'</td><td><button class="btn sm" data-act="delev" data-id="'+esc(e.id)+'">Remove</button></td></tr>').join('')+'</table>':'<div class="mut">No events logged.</div>'):'')+
   '<div class="lbl">History</div>'+(recs.length?'<div class="tw"><table><tr><th>Completed</th><th>By</th><th>Result</th><th>Status</th><th>Late Reason</th></tr>'+recs.map(r=>'<tr><td class="num">'+fmt(r.completedOn)+'</td><td>'+esc(r.completedBy||'—')+'</td><td>'+esc(r.result||'—')+'</td><td>'+esc(r.status==='void'?'Void':r.status==='na'?'Not Applicable':'Done')+'</td><td>'+esc(r.lateReason||'—')+'</td></tr>').join('')+'</table></div>':'<div class="mut">No records yet.</div>');
  const ev=ob.rec.kind==='event'; const op=D.occs.find(o=>o.trackKey===key&&!o.done&&!o.projected);
  openModal('Track Detail',body,(op?'<button class="btn pri" data-act="trackrec" data-t="'+esc(key)+'">'+(op.status==='nobaseline'?'Set Starting Record':'Record Completion')+'</button>':'')+'<button class="btn" data-act="edittrack" data-t="'+esc(key)+'" style="margin-right:auto">Edit Track</button>'+(ev?'<button class="btn" data-act="newev" data-t="'+esc(key)+'">Log Event</button>':'')+'<button class="btn" data-act="close">Close</button>',{wide:true,nofocus:true});
}
function editTrack(key){
  const t=D.tracks.find(x=>x.key===key); if(!t)return; const ob=t.ob, k=ob.rec.kind, tr=S.tracks[key]||{};
  const fx=(k==='rolling'||k==='fixed');
  formModal({title:'Edit Track',intro:esc(subjLine(t))+'. These changes apply to this subject only.',vals:{n:tr.n||'',unit:tr.unit||'',anchor:tr.anchor||'',base:tr.baselineDate||'',first:tr.firstDue||'',assignee:tr.assignee||'',inactive:!!tr.inactive,why:tr.inactiveReason||''},
   fields:[].concat(fx?[{id:'n',label:'Override Interval (Number)',type:'number',hint:'Blank uses the library value ('+IL.freqText(ob,{})+').'},{id:'unit',label:'Override Interval Unit',type:'select',opts:[['','Library Default'],['day','Days'],['week','Weeks'],['month','Months'],['year','Years']]}]:[],k==='fixed'?[{id:'anchor',label:'Schedule Anchor Date',type:'date',hint:'Due dates fall on this date every cycle.'}]:[],k==='rolling'?[{id:'base',label:'Last Completed On (Baseline)',type:'date'}]:[],(k==='rolling'||k==='expiry')?[{id:'first',label:k==='expiry'?'Current Expiration Date':'Next Due Date',type:'date'}]:[],
    [{id:'assignee',label:'Responsible Person',type:'select',opts:[['','Use Duty Default']].concat(S.people.filter(p=>!p.archived).map(p=>[p.id,p.name]))},{id:'inactive',label:'Stop Tracking This Item',type:'bool'},{id:'why',label:'Reason For Stopping',type:'text',hint:'Required when tracking is stopped.'}]),
   save:v=>{ const nt=Object.assign({},S.tracks[key]||{}); if(v.inactive&&!v.why)return 'Enter A Reason For Stopping.';
     ['n','unit','anchor','base','first','assignee'].forEach(f=>{ const m={base:'baselineDate',first:'firstDue'}[f]||f; if(v[f]!==undefined&&v[f]!==''&&(f!=='n'||+v[f]>0))nt[m]=f==='n'?+v[f]:v[f]; else if(v[f]==='')delete nt[m]; });
     if(nt.n&&!nt.unit)nt.unit=(ob.rec.unit||'month'); if(!nt.n)delete nt.unit;
     if(v.inactive){nt.inactive=true;nt.inactiveReason=v.why;}else{delete nt.inactive;delete nt.inactiveReason;}
     S.tracks[key]=nt; logAct('Edited Track',subjLine(t)); changed('config'); }});
}
function eventModal(key){
  const t=D.tracks.find(x=>x.key===key); if(!t)return;
  formModal({title:'Log Event',intro:esc(t.ob.title)+'. '+esc(t.ob.note||''),fields:[{id:'d',label:'Event Date',type:'date',req:true},{id:'note',label:'Note',type:'text',ph:'For example: new PIC name'}],vals:{d:D.today},saveLabel:'Log Event',
   save:v=>{ const e={id:uid('v'),track:key,eventDate:v.d,note:v.note}; S.events.push(e); Store.put('events',e); logAct('Logged Event',subjLine(t)+' ('+fmt(v.d)+')'); changed('ev'); }});
}

/* ===== obligations editor ===== */
function obModal(id){
  const ob=D.obs.find(x=>x.id===id); if(!ob)return; const r=ob.rec, fx=(r.kind==='rolling'||r.kind==='fixed');
  const src=(ob.src||[]).map(s=>'<a href="'+esc(s.u)+'" target="_blank" rel="noopener">'+esc(s.t)+'</a>').join('<br>');
  const ov=S.obl[id]||{};
  formModal({title:ob.title,intro:esc(ob.auth||'')+' '+pill(ob.conf)+' '+esc(ob.basis)+'<br>'+esc(ob.note||'')+(src?'<br><br>'+src:''),
   vals:{n:fx?r.n:'',unit:fx?r.unit:'',lead:ob.lead,ownerRole:ob.ownerRole},
   fields:[].concat(fx?[{id:'n',label:'Interval (Number)',type:'number'},{id:'unit',label:'Interval Unit',type:'select',opts:[['day','Days'],['week','Weeks'],['month','Months'],['year','Years']]}]:[],[{id:'lead',label:'Warn This Many Days Before Due',type:'number'},{id:'ownerRole',label:'Responsible Duty',type:'select',opts:DUTIES}]),
   extra:(ob.custom?'<button class="btn danger" data-act="delob" data-id="'+esc(id)+'" style="margin-right:auto">Delete</button>':(Object.keys(ov).length?'<button class="btn" data-act="resetob" data-id="'+esc(id)+'" style="margin-right:auto">Reset To Library Default</button>':'')),
   save:v=>{ const lead=+v.lead; if(!(lead>=0))return 'Enter The Warning Days.';
     if(ob.custom){ const c=S.custom.find(x=>x.id===id); if(fx){c.rec.n=+v.n;c.rec.unit=v.unit;} c.lead=lead; c.ownerRole=v.ownerRole; Store.put('obl',c); }
     else{ const o=Object.assign({},ov,{id,lead,ownerRole:v.ownerRole}); if(fx){ if(!(+v.n>0))return 'Enter The Interval.'; o.rec={n:+v.n,unit:v.unit}; } S.obl[id]=o; Store.put('obl',o); }
     logAct('Edited Obligation',ob.title); changed('obl'); }});
}
function newObModal(){
  formModal({title:'Add Custom Obligation',intro:'For items outside the library: vaccine certification renewals, vendor contracts, insurance, your own policies.',saveLabel:'Add',
   vals:{scope:'facility',kind:'rolling',n:12,unit:'month',lead:30,ownerRole:'PIC'},
   fields:[{id:'title',label:'Title',type:'text',req:true},{id:'scope',label:'Applies To',type:'select',opts:[['facility','Each Pharmacy'],['person','Each Person'],['equipment','Each Piece Of Equipment'],['document','Each Document']]},
    {id:'kind',label:'Schedule Type',type:'select',opts:[['rolling','Repeats After Last Completion'],['fixed','Repeats On Fixed Dates'],['once','One Time'],['expiry','Expires And Is Renewed']]},
    {id:'n',label:'Repeat Every (Number)',type:'number'},{id:'unit',label:'Repeat Unit',type:'select',opts:[['week','Weeks'],['month','Months'],['year','Years']]},
    {id:'date',label:'Fixed Anchor Or One-Time Due Date',type:'date',hint:'Used for fixed-date and one-time items.'},{id:'lead',label:'Warn This Many Days Before Due',type:'number'},{id:'ownerRole',label:'Responsible Duty',type:'select',opts:DUTIES},
    {id:'auth',label:'Reference Or Authority',type:'text',ph:'Your policy, contract or rule'},{id:'evid',label:'Evidence To Keep',type:'text'}],
   save:v=>{ const rec={kind:v.kind}; if(v.kind==='rolling'||v.kind==='fixed'){ if(!(+v.n>0))return 'Enter The Repeat Interval.'; rec.n=+v.n; rec.unit=v.unit; }
     if(v.kind==='fixed'){ if(!v.date)return 'Enter The Anchor Date.'; rec.anchor=v.date; } if(v.kind==='once'){ if(!v.date)return 'Enter The Due Date.'; rec.due=v.date; } if(v.kind==='expiry')rec.windowDays=0;
     const c={id:uid('c'),isCustom:true,cat:'Custom',title:v.title,scope:v.scope,personTag:v.scope==='person'?'any':undefined,ownerRole:v.ownerRole,jur:'US',basis:'Internal',auth:v.auth||'Your policy',conf:'Internal',rec,lead:+v.lead||0,evid:v.evid,note:'Custom obligation.',src:[]};
     S.custom.push(c); Store.put('obl',c); logAct('Added Custom Obligation',v.title); changed('obl'); }});
}

/* ===== entities ===== */
function entityForm(kind,id){
  const list={site:S.sites,person:S.people,equip:S.equipment,doc:S.documents}[kind]; const cur=id?list.find(x=>x.id===id):null; const v=cur||{};
  const F={
   site:[{id:'name',label:'Pharmacy Name',type:'text',req:true},{id:'deaNo',label:'DEA Registration Number',type:'text'},{id:'deaExpiry',label:'DEA Expiration Date',type:'date',hint:'Starts the renewal reminder.'},{id:'tsbpNo',label:'TSBP License Number',type:'text'},{id:'tsbpExpiry',label:'TSBP License Expiration Date',type:'date'}],
   person:[{id:'name',label:'Name',type:'text',req:true},{id:'role',label:'Role',type:'select',opts:['Pharmacist','Technician','Owner','Other Staff']},{id:'duties',label:'Duties',type:'checks',opts:DUTIES.concat(['Reviewer','Compliance Technician']).map(d=>[d,d]),hint:'PIC And Reviewer Can Accept Completed Tasks. Owner, PIC, Designated Person And Compliance Technician Can Add To The Schedule.'},{id:'tags',label:'Training Groups',type:'checks',opts:TAGS},{id:'licNo',label:'License Or Registration Number',type:'text'},{id:'licExpiry',label:'License Or Registration Expiration',type:'date'},{id:'siteId',label:'Pharmacy',type:'select',opts:siteOpts()}],
   equip:[{id:'name',label:'Name',type:'text',req:true},{id:'kind',label:'Type',type:'select',opts:EQUIP_KINDS},{id:'siteId',label:'Pharmacy',type:'select',opts:siteOpts()}],
   doc:[{id:'title',label:'Title',type:'text',req:true},{id:'type',label:'Type',type:'select',opts:DOC_TYPES},{id:'version',label:'Version',type:'text'},{id:'lastReviewed',label:'Last Reviewed On',type:'date',hint:'Starts the review schedule.'},{id:'reviewMonths',label:'Review Every (Months)',type:'number'},{id:'siteId',label:'Pharmacy',type:'select',opts:siteOpts()}]
  }[kind];
  const pre={doc:{reviewMonths:12,type:'Policy'},person:{role:'Pharmacist',duties:[],tags:[]},equip:{kind:EQUIP_KINDS[0]},site:{}}[kind];
  const title=(cur?'Edit ':'Add ')+{site:'Pharmacy',person:'Person',equip:'Equipment',doc:'Document'}[kind];
  formModal({title,fields:F,vals:Object.assign({},pre,v),saveLabel:cur?'Save':'Add',
   extra:cur?'<button class="btn danger" data-act="archive" data-k="'+kind+'" data-id="'+esc(id)+'" style="margin-right:auto">Archive</button>':'',
   save:r=>{ if(kind==='doc'&&!(+r.reviewMonths>0))return 'Enter The Review Interval In Months.'; if(kind==='doc')r.reviewMonths=+r.reviewMonths;
     const L2={site:S.sites,person:S.people,equip:S.equipment,doc:S.documents}[kind]; const c2=id?L2.find(x=>x.id===id):null; if(id&&!c2)return 'This entry changed while it was open. Close it and open it again.';
     if(c2){ Object.assign(c2,r); logAct('Edited '+title.split(' ').slice(1).join(' '),r.name||r.title); } else { const n=Object.assign({id:uid(kind[0])},r); L2.push(n); logAct('Added '+title.split(' ').slice(1).join(' '),n.name||n.title); }
     changed('config'); }});
}
function profileForm(){
  const p=S.profile;
  formModal({title:'Edit Profile',vals:{name:p.name,start:p.trackingStart,feat:FEATURES.filter(f=>p.features[f[0]]).map(f=>f[0])},
   fields:[{id:'name',label:'Pharmacy Group Name',type:'text',req:true},{id:'start',label:'Tracking Start Date',type:'date',req:true,hint:'Occurrences before this date are not counted as missed.'},{id:'feat',label:'Programs',type:'checks',opts:FEATURES}],
   save:v=>{ p.name=v.name; p.trackingStart=v.start; p.features={}; FEATURES.forEach(f=>p.features[f[0]]=v.feat.includes(f[0])); logAct('Edited Profile',p.name); changed('config'); }});
}
function wizard(){
  const HP=(window.ILHOST&&ILHOST.pharmacy)||null;           // what the host account already knows about this pharmacy
  formModal({title:'Start My Pharmacy',intro:(BLANK?'Enter the basics. Everything else can be added later.':'Sample data is cleared. Enter the basics. Everything else can be added later.'),saveLabel:'Start',
   vals:{feat:(HP&&HP.features&&HP.features.length)?HP.features:['controlled','nonsterile'],start:(D?D.today:localToday()),state:'TX',tz:(HP&&HP.tz&&TZONES.some(z=>z[0]===HP.tz))?HP.tz:'America/Chicago',name:(HP&&HP.name)||'',owner:(HP&&HP.ownerName)||''},
   fields:[{id:'name',label:'Pharmacy Name',type:'text',req:true},{id:'owner',label:'Owner Name',type:'text'},{id:'pic',label:'Pharmacist-In-Charge Name',type:'text'},{id:'feat',label:'Programs You Run',type:'checks',opts:FEATURES},{id:'tz',label:'Time Zone',type:'select',opts:TZONES},{id:'start',label:'Tracking Start Date',type:'date',req:true,hint:'Counting begins here. Earlier history is not scored.'}],
   save:v=>{
     const st=emptyState(); st.mode='live'; st.profile={name:v.name,state:'TX',features:{},trackingStart:v.start,launchedAt:todayIn(v.tz),tz:v.tz,hours:(HP&&Array.isArray(HP.hours)&&HP.hours.length===7)?HP.hours:defHours(),holClosed:defHolClosed()}; FEATURES.forEach(f=>st.profile.features[f[0]]=v.feat.includes(f[0]));
     st.sites=[{id:'s1',name:v.name}]; if(v.owner)st.people.push({id:'p1',name:v.owner,role:'Owner',duties:['Owner'],tags:[],siteId:''}); if(v.pic)st.people.push({id:'p2',name:v.pic,role:'Pharmacist',duties:['PIC','Designated Person'],tags:[],siteId:'s1'});
     S=st; ME=''; UI.site=''; UI.calMonth=null; UI.selDay=null; if(Store.db){ Store.kind='db'; Store.subscribe(); } else { Store.kind=window.ILHOST?'host':'local'; }
     persistAll(); logAct('Started Pharmacy',v.name); UI.tab='setup'; location.hash='#setup'; changed('config'); toast('Started. Add people, equipment and documents next.'); }});
}
function persistAll(){
  if(S.mode!=='live')return; if(!Store.db){ Store.saveLocal(); return; }
  Store.saveConfig();
  S.records.forEach(r=>Store.put('records',r)); S.events.forEach(e=>Store.put('events',e)); Object.values(S.obl).forEach(o=>Store.put('obl',o)); S.custom.forEach(c=>Store.put('obl',c));
}
function restoreFile(f){
  if(!f)return; const rd=new FileReader();
  rd.onload=()=>{ try{ const o=JSON.parse(rd.result); if(!o||!o.profile||!Array.isArray(o.sites))throw new Error('Not an IronLedger backup'); S=Object.assign(emptyState(),o,{mode:'live'}); if(Store.db){Store.kind='db';Store.subscribe();} else Store.kind=window.ILHOST?'host':'local'; persistAll(); logAct('Restored Backup',f.name); changed('config'); toast('Backup restored.'); }catch(e){ toast('Could not read that file: '+e.message); } };
  rd.readAsText(f);
}

/* ===== exports ===== */
const csvCell=s=>'"'+String(s==null?'':s).replace(/"/g,'""')+'"';
function csvText(months){
  const rows=[['Due','Item','Category','For','Status','Completed On','Completed By','Result','Entered By','Started By','Reviewed By','Edited By','Evidence','Late Reason','Authority','Confidence']];
  auditRows(months).forEach(o=>{ const r=o.rec||{}; rows.push([o.due,o.track.ob.title,o.track.ob.cat,o.track.subj.name,STATUS_LABEL[o.status],o.done?r.completedOn:'',r.completedBy,r.result,taskWho(r).entered,taskWho(r).started,taskWho(r).reviewed,taskWho(r).edited,r.evidence,r.lateReason||r.naReason,o.track.ob.auth,o.track.ob.conf]); });
  return '﻿'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
}
function reportHtml(months){
  const today=D.today, from=IL.addMonths(today,-months); const rows=auditRows(months);
  const st=IL.stats(D.occs.filter(o=>!o.track.ob.routine),today,from,today);
  const gaps=D.noBase.filter(o=>!o.track.ob.routine);
  const th=a=>'<tr>'+a.map(x=>'<th>'+x+'</th>').join('')+'</tr>';
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Compliance Audit Report</title><style>body{font:13px/1.45 system-ui,sans-serif;color:#17212b;margin:28px}h1{margin:0 0 4px;font-size:22px}h2{font-size:15px;margin:22px 0 6px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #c9d2da;padding:4px 7px;text-align:left;vertical-align:top;font-size:12px}th{background:#eef2f5}.m{color:#586878}.l{color:#8a5200;font-weight:600}.o{color:#a8211a;font-weight:600}footer{margin-top:28px;color:#586878;font-size:11px}.sig{margin-top:26px;display:flex;gap:40px}.sig div{border-top:1px solid #17212b;padding-top:4px;min-width:240px}</style></head><body>'+
   '<h1>Compliance Audit Report</h1><div class="m">'+esc(S.profile.name||'Pharmacy')+(S.mode!=='live'?' (SAMPLE DATA)':'')+' · Period '+fmt(from)+' to '+fmt(today)+' · Generated '+fmt(today)+' · Tracking began '+fmt(S.profile.trackingStart)+'</div>'+
   '<h2>Summary</h2><table>'+th(['On Time','Done Late','Overdue / Missed','On-Time Rate'])+'<tr><td>'+st.on+'</td><td>'+st.late+'</td><td>'+st.missed+'</td><td>'+(st.onTimeRate==null?'—':Math.round(st.onTimeRate*100)+'%')+'</td></tr></table>'+
   '<h2>Items Due In This Period</h2><table>'+th(['Due','Item','For','Status','Completed','Entered By','Started By','Completed By','Reviewed By','Edited By','Result','Evidence','Late Reason'])+rows.map(o=>{ const r=o.rec||{}; return '<tr><td>'+fmt(o.due)+'</td><td>'+esc(o.track.ob.title)+'<div class="m">'+esc(o.track.ob.auth||'')+'</div></td><td>'+esc(o.track.subj.name)+'</td><td class="'+(o.status==='overdue'?'o':o.status==='late-done'?'l':'')+'">'+esc(STATUS_LABEL[o.status])+'</td><td>'+(o.done?fmt(r.completedOn):'—')+'</td><td>'+esc(taskWho(r).entered)+'</td><td>'+esc(taskWho(r).started)+'</td><td>'+esc(r.completedBy||'')+'</td><td>'+esc(taskWho(r).reviewed)+(r.review&&r.review.status==='accepted'?'<div class="m">'+esc(fmtTs(r.review.at))+'</div>':'')+'</td><td>'+esc(taskWho(r).edited)+'</td><td>'+esc(r.result||'')+'</td><td>'+esc(r.evidence||'')+'</td><td>'+esc(r.lateReason||r.naReason||'')+'</td></tr>'; }).join('')+'</table>'+
   (gaps.length?'<h2>Items With No Starting Record</h2><table>'+th(['Item','For'])+gaps.map(o=>'<tr><td>'+esc(o.track.ob.title)+'</td><td>'+esc(o.track.subj.name)+'</td></tr>').join('')+'</table>':'')+
   '<h2>Basis Of Each Rule</h2><p class="m">Each item carries a confidence rating in the app: High (primary text or two independent sources), Moderate (verify before relying), Low (off by default), Internal (your own policy). This report lists schedules and records. It is not legal advice and does not replace the current rule text.</p>'+
   '<div class="sig"><div>Pharmacist-In-Charge</div><div>Date</div></div><footer>2026 IronLedger LLC</footer></body></html>';
}
function icsText(){
  const today=D.today, end=IL.addMonths(today,12); const stamp=new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
  const items=D.occs.filter(o=>!o.done&&o.due&&!o.projected&&!o.track.ob.routine&&o.due<=end&&o.status!=='nobaseline').map(o=>({uid:(o.trackKey+'-'+o.due).replace(/[^A-Za-z0-9-]/g,''),stamp,due:o.due<today?today:o.due,title:o.track.ob.title+' — '+o.track.subj.name,desc:(o.track.ob.auth||'')+(o.due<today?' (Overdue since '+o.due+')':'')+'. Responsible: '+whoName(o.track),alarmDays:Math.max(1,Math.min(30,o.track.ob.lead||7))}));
  return IL.toICS(items,'IronLedger');
}

/* ===== task series view (right-click a task, or View Series) ===== */
let SER=null;
const intMonths=ob=>{ const r=ob.rec||{}, n=+r.n||1; return r.unit==='year'?12*n:r.unit==='month'?n:r.unit==='week'?n/4.345:r.unit==='day'?n/30.4:12; };
const alignStart=(ym,n)=>{ const y=ym.slice(0,4), m=+ym.slice(5,7)-1; const s=y+'-'+String((n>=12?0:Math.floor(m/n)*n)+1).padStart(2,'0'); return s<launchMonth()?launchMonth():s; };
function seriesOpen(tk,anchor){ const t=D.tracks.find(x=>x.key===tk); if(!t)return; const mo=intMonths(t.ob), n=mo<=3?3:mo<=6?6:12; SER={t:tk,n:n,start:alignStart((anchor||D.today).slice(0,7),n)}; seriesDraw(); }
function seriesDraw(){
  const t=D.tracks.find(x=>x.key===SER.t); if(!t){ closeModal(); return; } const n=SER.n, ob=t.ob; const from=SER.start+'-01', to=IL.addDays(IL.addMonths(from,n),-1);
  const occs=IL.collect(S,D.obs,D.today,from,to,{siteId:UI.site,adjust:adjustDue}).occs.filter(o=>o.trackKey===SER.t&&o.due&&o.due>=from&&o.due<=to).sort((x,y)=>x.due<y.due?-1:1);
  const by={}; occs.forEach(o=>{ const k=o.due.slice(0,7); (by[k]=by[k]||[]).push(o); });
  let cols=''; for(let i=0;i<n;i++){ const ym=IL.addMonths(from,i).slice(0,7); const l=by[ym]||[];
    cols+='<div class="serc'+(ym===D.today.slice(0,7)?' now':'')+'"><div class="serh">'+MON[+ym.slice(5,7)-1]+' '+ym.slice(0,4)+'</div>'+l.slice(0,6).map(o=>'<span class="chip p-'+o.status+'" data-act="occ" data-t="'+esc(o.trackKey)+'" data-k="'+esc(o.key)+'" style="cursor:pointer" title="'+esc(fmt(o.due)+': '+STATUS_LABEL[o.status])+'">'+(+o.due.slice(8))+' · '+esc(STATUS_LABEL[o.status])+'</span>').join('')+(l.length>6?'<div class="more">+'+(l.length-6)+' More</div>':'')+'</div>'; }
  const atL=SER.start<=launchMonth(); const endLbl=IL.addMonths(from,n-1).slice(0,7); const lbl=m=>MON[+m.slice(5,7)-1]+' '+m.slice(0,4);
  const body='<dl class="kv"><dt>Item</dt><dd>'+esc(ob.title)+'</dd><dt>For</dt><dd>'+esc(t.subj.name)+'</dd><dt>Repeats</dt><dd>'+esc(IL.freqText(ob,t.trk))+'</dd><dt>Responsible</dt><dd>'+esc(whoName(t))+'</dd></dl>'+
   '<div class="row"><span class="btn-grp">'+[[3,'Quarterly'],[6,'6 Months'],[12,'Yearly']].map(v=>'<button class="btn sm'+(SER.n===v[0]?' pri':'')+'" data-act="serrange" data-n="'+v[0]+'">'+v[1]+'</button>').join('')+'</span><button class="btn sm" data-act="sernav" data-d="-1"'+(atL?' disabled':'')+'>‹ Previous</button><b>'+lbl(SER.start)+' to '+lbl(endLbl)+'</b><button class="btn sm" data-act="sernav" data-d="1">Next ›</button><button class="btn sm" data-act="sernav" data-d="0">Today</button>'+(atL?'<span class="mut" style="font-size:12px">Calendar starts '+fmt(launchDate())+'</span>':'')+'</div>'+
   '<div class="ser" style="grid-template-columns:repeat('+n+',minmax(0,1fr))">'+cols+'</div>'+
   (occs.length?'<div class="tw"><table><tr><th>Due</th><th>Status</th><th>Completed</th><th>Completed By</th><th>Result</th><th>Review</th><th></th></tr>'+occs.slice(0,200).map(o=>{ const r=o.rec||{}; return '<tr class="click" data-act="occ" data-t="'+esc(o.trackKey)+'" data-k="'+esc(o.key)+'"><td class="num">'+fmt(o.due)+(o.moved?' <span class="mut" style="font-size:12px">('+esc(movedNote(o))+')</span>':'')+'</td><td>'+pill(o.status)+workPill(o)+'</td><td class="num">'+(o.done?fmt(r.completedOn):'—')+'</td><td>'+esc(o.done?(r.completedBy||'—'):'—')+'</td><td>'+esc(o.done?(r.result||'—'):'—')+'</td><td>'+esc(o.done&&r.review?(r.review.status==='accepted'?'Accepted: '+r.review.by:'Awaiting Review'):'—')+'</td><td><button class="btn sm" data-act="occ" data-t="'+esc(o.trackKey)+'" data-k="'+esc(o.key)+'">'+(o.done?'View':(workOf(o.trackKey,o.key)?'Continue Task':'Start Task'))+'</button></td></tr>'; }).join('')+'</table></div>':'<div class="mut" style="margin-top:8px">Nothing is due in this range.</div>')+
   '<p class="mut" style="font-size:12px;margin:8px 0 0">Future dates are projected and assume each task is done on time.</p>';
  openModal('Series: '+ob.title,body,'<button class="btn pri" data-act="close">Close</button>',{nofocus:true,xwide:true}); MODAL.series=true;
}
function ctxClose(){ const c=document.getElementById('ctx'); if(c)c.remove(); }

/* ===== actions ===== */
const ACT={
  tab(el){ UI.tab=el.dataset.v; location.hash='#'+UI.tab; render(); window.scrollTo(0,0); },
  close(){ closeModal(); }, msave(){ if(MODAL&&MODAL.save)MODAL.save(); }, mna(){ if(MODAL&&MODAL.na)MODAL.na(); }, mvoid(){ voidRec(); }, mwork(){ if(MODAL&&MODAL.work)MODAL.work(); }, maccept(){ acceptRec(); },
  rmatt(el){ if(MODAL&&MODAL.files){ MODAL.files.splice(+el.dataset.i,1); refreshAtt(); } },
  viewrec(el){ const o=D.occs.find(x=>x.done&&x.rec&&x.rec.id===el.dataset.id); if(!o){ toast('Could not open this record.'); return; } detailModal(o); },
  ovclose(el,e){ if(e.target===el)closeModal(); },
  addsched(el){ const e=addGate(); if(e){ toast(e); return; } schedModal(el.dataset.d); },
  remdel(el){ delete S.reminders[el.dataset.id]; closeModal(); changed('config'); },
  remdone(el){ const r=S.reminders[el.dataset.id]; if(r){ r.done=!r.done; r.doneAt=r.done?nowIso():''; } closeModal(); changed('config'); },
  occ(el){ if(el.dataset.t==='rem'){ remModal(el.dataset.k); return; } const o=findOcc(el.dataset.t,el.dataset.k); if(!o)return; if(o.status==='nobaseline')baselineModal(o); else if(o.done)detailModal(o); else recModal(o); },
  bulk(){ bulkModal(); }, trackrec(el){ const k=el.dataset.t; const op=D.occs.find(o=>o.trackKey===k&&!o.done&&!o.projected); closeModal(); if(!op)return; if(op.status==='nobaseline')baselineModal(op); else recModal(op); },
  track(el){ trackModal(el.dataset.t); }, mtrack(el){ closeModal(); trackModal(el.dataset.t); }, edittrack(el){ editTrack(el.dataset.t); }, newev(el){ eventModal(el.dataset.t); },
  delev(el){ const e=S.events.find(x=>x.id===el.dataset.id); if(!e)return; if(S.records.some(r=>r.forEvent===e.id&&r.status!=='void')){ toast('This event has a completed record. Void the record first.'); return; } S.events=S.events.filter(x=>x!==e); Store.del('events',e.id); logAct('Removed Event',fmt(e.eventDate)); closeModal(); changed('ev'); },
  routine(el){ const t=D.tracks.find(x=>x.key===el.dataset.t); if(!t)return; const r={id:uid('r'),track:t.key,completedOn:D.today,forDue:t.ob.rec.kind==='fixed'?D.today:null,completedBy:whoAmI()==='Unspecified User'?'':whoAmI(),status:'done',createdAt:new Date().toISOString(),by:whoAmI()}; S.records.push(r); Store.put('records',r); logAct('Completed',subjLine(t)+' ('+fmt(D.today)+')'); changed('rec'); },
  calnav(el){ const u=el.dataset.u, d=+el.dataset.d; if(u==='t'){ UI.calMonth=clampMonth(D.today.slice(0,7)); UI.selDay=clampDay(D.today); } else { let nm=IL.addMonths(UI.calMonth+'-01',u==='y'?12*d:d).slice(0,7); if(+nm.slice(0,4)>2999){ toast('Dates are supported up to 2999.'); return; } if(nm<launchMonth()){ nm=launchMonth(); toast(launchNote()); } UI.calMonth=nm; } render(); },
  daynav(el){ const d=+el.dataset.d; let nd=d===0?D.today:(el.dataset.u==='m'?IL.addMonths(UI.selDay||D.today,d):IL.addDays(UI.selDay||D.today,d)); if(nd<launchDate()){ nd=launchDate(); toast(launchNote()); } UI.selDay=nd; UI.calMonth=UI.selDay.slice(0,7); render(); },
  openday(el){ UI.selDay=el.dataset.d; UI.calView='day'; render(); },
  calview(el){ UI.calView=el.dataset.v; if(UI.calView==='day')UI.selDay=clampDay(D.today); else if((UI.calView==='week'||UI.calView==='biweek')&&!UI.selDay)UI.selDay=clampDay(D.today); if(UI.calView==='month'&&UI.selDay)UI.calMonth=UI.selDay.slice(0,7); render(); }, selday(el){ UI.panel=true; UI.selDay=el.dataset.d; UI.calMonth=UI.calMonth||el.dataset.d.slice(0,7); render(); },
  closeside(){ UI.panel=false; render(); },
  series(el){ if(MODAL&&MODAL.dirty&&MODAL.dirty()){ merr('Save And Close First, Then Open The Series.'); return; } const o=el.dataset.k?findOcc(el.dataset.t,el.dataset.k):null; seriesOpen(el.dataset.t,o&&o.due); },
  serrange(el){ SER.n=+el.dataset.n; SER.start=alignStart(SER.start,SER.n); seriesDraw(); },
  sernav(el){ const d=+el.dataset.d; if(d===0)SER.start=alignStart(D.today.slice(0,7),SER.n); else { let s=IL.addMonths(SER.start+'-01',d*SER.n).slice(0,7); if(+s.slice(0,4)>2999){ toast('Dates are supported up to 2999.'); return; } if(s<launchMonth()){ s=launchMonth(); toast(launchNote()); } SER.start=s; } seriesDraw(); }, fullday(){ UI.fullDay=!UI.fullDay; render(); },
  hours(){ hoursModal(); }, plan(el){ if(MODAL&&MODAL.dirty&&MODAL.dirty()){ merr('Save And Close First, Then Set The Time.'); return; } closeModal(); planModal(el.dataset.t,el.dataset.k); }, unplan(el){ delete S.plans[el.dataset.t+'|'+el.dataset.k]; logAct('Removed Schedule',el.dataset.t); closeModal(); changed('config'); },
  newob(){ newObModal(); }, editob(el){ obModal(el.dataset.id); },
  delob(el){ const id=el.dataset.id; S.custom=S.custom.filter(c=>c.id!==id); Store.del('obl',id); logAct('Deleted Custom Obligation',id); closeModal(); changed('obl'); },
  resetob(el){ const id=el.dataset.id; delete S.obl[id]; Store.del('obl',id); logAct('Reset Obligation',id); closeModal(); changed('obl'); },
  newsite(){entityForm('site');}, editsite(el){entityForm('site',el.dataset.id);}, newperson(){entityForm('person');}, editperson(el){entityForm('person',el.dataset.id);},
  newequip(){entityForm('equip');}, editequip(el){ const e=S.equipment.find(x=>x.id===el.dataset.id); if(e&&e.pec)pecModal(e.id); else entityForm('equip',el.dataset.id); }, newroom(){ roomModal(); }, newnsa(){ roomModal(null,'nsa'); }, editroom(el){ roomModal(el.dataset.id); }, newpec(){ pecModal(); }, editpec(el){ pecModal(el.dataset.id); }, newdoc(){entityForm('doc');}, editdoc(el){entityForm('doc',el.dataset.id);},
  archive(el){ const k=el.dataset.k; const list={site:S.sites,person:S.people,equip:S.equipment,doc:S.documents,room:S.rooms}[k]; const x=list.find(y=>y.id===el.dataset.id); if(x){ x.archived=true; logAct('Archived',x.name||x.title); } closeModal(); changed('config'); },
  wizard(){ wizard(); }, editprofile(){ profileForm(); },
  dlcsv(){ saveFile('ironledger-audit-record.csv',csvText(+UI.auditRange)); },
  dlreport(){ saveFile('ironledger-audit-report.html',reportHtml(+UI.auditRange)); },
  dlbackup(){ saveFile('ironledger-backup-'+D.today+'.json',JSON.stringify(Object.assign({},S,{log:S.log.slice(0,300)}),null,1)); },
  dlics(){ saveFile('ironledger-calendar.ics',icsText()); }
};
document.addEventListener('click',e=>{ ctxClose(); const el=e.target.closest('[data-act]'); if(!el)return; if(el.dataset.act==='ovclose'&&e.target!==el)return; const f=ACT[el.dataset.act]; if(f){ if(el.tagName==='BUTTON'||el.tagName==='A')e.stopPropagation(); f(el,e); } });
document.addEventListener('change',e=>{ const el=e.target.closest('[data-chg]'); if(!el)return; const c=el.dataset.chg; if(c==='attach'){ attachFiles(el); return; }
  if(c==='fCat')UI.fCat=el.value; else if(c==='fWho')UI.fWho=el.value; else if(c==='showProj')UI.showProj=el.checked; else if(c==='auditRange')UI.auditRange=el.value; else if(c==='showHol')UI.showHol=el.checked; else if(c==='showObs')UI.showObs=el.checked;
  else if(c==='calm'){ const y=UI.calMonth.slice(0,4); UI.calMonth=clampMonth(y+'-'+String(el.value).padStart(2,'0')); }
  else if(c==='caly'){ const y=parseInt(el.value,10); if(!(y>=1&&y<=2999)){ toast('Enter a year up to 2999.'); render(); return; } const nm=y+'-'+UI.calMonth.slice(5); if(nm<launchMonth())toast(launchNote()); UI.calMonth=clampMonth(nm); }
  else if(c==='dayset'){ if(el.value){ let v=el.value; if(v<launchDate()){ v=launchDate(); toast(launchNote()); } UI.selDay=v; UI.calMonth=v.slice(0,7); } }
  else if(c==='site'){ UI.site=el.value; recompute(); } else if(c==='me'){ ME=el.value; try{localStorage.setItem('ilcal.me',ME);}catch(x){} }
  else if(c==='obon'){ const id=el.dataset.id; const o=Object.assign({},S.obl[id]||{},{id,active:el.checked}); S.obl[id]=o; Store.put('obl',o); logAct(el.checked?'Turned On Obligation':'Turned Off Obligation',(D.obs.find(x=>x.id===id)||{}).title||id); changed('obl'); return; }
  render(); });
document.addEventListener('input',e=>{ const el=e.target.closest('[data-inp]'); if(!el)return; UI[el.dataset.inp]=el.value; render(); const n=document.querySelector('[data-inp="'+el.dataset.inp+'"]'); if(n){ n.focus(); try{n.setSelectionRange(n.value.length,n.value.length);}catch(x){} } });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ if(document.getElementById('ctx'))ctxClose(); else if(MODAL)closeModal(); } });
window.addEventListener('scroll',ctxClose,true);
document.addEventListener('contextmenu',e=>{ const el=e.target.closest('[data-act="occ"],[data-act="track"],.chip[data-t]'); if(!el||!el.dataset.t||el.dataset.t==='rem'||(MODAL&&!MODAL.series))return; e.preventDefault(); ctxClose();
  const isT=el.dataset.act==='track', at=' data-t="'+esc(el.dataset.t)+'" data-k="'+esc(el.dataset.k||'')+'"'; const c=document.createElement('div'); c.id='ctx'; c.className='ctx'; c.setAttribute('role','menu');
  c.innerHTML='<button role="menuitem" data-act="series"'+at+'>View Series</button><button role="menuitem" data-act="'+(isT?'track':'occ')+'"'+at+'>'+(isT?'Open Track':'Open Task')+'</button>'; document.body.appendChild(c);
  c.style.left=Math.max(4,Math.min(e.clientX,innerWidth-c.offsetWidth-8))+'px'; c.style.top=Math.max(4,Math.min(e.clientY,innerHeight-c.offsetHeight-8))+'px'; });
window.addEventListener('hashchange',()=>{ const h=location.hash.slice(1); if(TABS.some(t=>t[0]===h)&&h!==UI.tab){ UI.tab=h; render(); } });

/* ===== adding to the schedule: personal reminders and shared preset tasks ===== */
const ADDERS=['Owner','PIC','Designated Person','Compliance Technician'];
const REPS=[['none','Does Not Repeat',0,''],['w1','Weekly',1,'week'],['w2','Every 2 Weeks',2,'week'],['m1','Monthly',1,'month'],['m3','Every 3 Months',3,'month'],['m6','Every 6 Months',6,'month'],['y1','Yearly',1,'year']];
const PRESETS=[
 ['Compounding',[['Clean Room Recertification','m6'],['Hood Or Isolator Certification','m6'],['Surface Sampling (Viable)','m1'],['Non-Viable Particle Count','m6'],['Sporicidal Disinfection','m1'],['Media Fill Test','m6'],['Compounding Personnel Competency Assessment','m6'],['Master Formulation Record Review','y1'],['Compounding SOP Review','y1'],['Balance And Scale Calibration','y1'],['Pressure Differential Log Review','w1'],['Stock Ingredient Expiration Check','m1'],['Hazardous Drug Spill Kit Check','m1'],['Compounding Batch Record Review','m1'],['Compounding Area Temperature And Humidity Log Review','w1']]],
 ['Pharmacy',[['Controlled Substance Inventory Count','y1'],['Controlled Substance Reconciliation','m1'],['Cycle Count','m1'],['Expired Medication Check','m1'],['Recall Check','w1'],['Refrigerator Temperature Log Review','w1'],['Policy And Procedure Review','y1'],['Staff Training Review','y1'],['Fire Extinguisher And Safety Equipment Check','m1'],['Eyewash Station Flush','w1'],['License And Registration Review','m3'],['Quality Assurance Meeting','m3'],['Documentation Scan And File','m1'],['Wholesaler And Vendor Contract Review','y1'],['Data Backup Verification','m1']]]
];
function addGate(){ const e=needMe(); if(e)return e; if(S.people.some(p=>!p.archived)){ const p=meP(); if(!p||!(p.duties||[]).some(d=>ADDERS.includes(d)))return 'Your Duties Do Not Include Adding To The Schedule. Ask An Owner, PIC, Designated Person Or Compliance Technician.'; } return ''; }
function presetSel(){ return '<select id="f_sp"><option value="">Choose A Task</option>'+PRESETS.map(g=>'<optgroup label="'+esc(g[0]+' Tasks')+'">'+g[1].map(p=>'<option value="'+esc(p[0])+'" data-rep="'+p[1]+'">'+esc(p[0])+'</option>').join('')+'</optgroup>').join('')+'</select>'; }
const defTime=d=>{ const h=hoursFor(d); return h.closed?'09:00':snap15(String(Math.floor(h.o/60)).padStart(2,'0')+':'+String(h.o%60).padStart(2,'0')); };
function schedModal(d0){
  const d=(d0&&d0>=D.today)?d0:D.today; const sites=S.sites.filter(s=>!s.archived), people=S.people.filter(p=>!p.archived);
  const body='<p class="mut" style="margin:0 0 8px">A reminder is for you. A shared task goes on the calendar for everyone who has access to it.</p>'+
   fld('What Are You Adding?',sel('ty',[['rem','Personal Reminder (Only You See It)'],['task','Shared Task (Everyone With Calendar Access)']],'rem'))+
   '<div id="blkR">'+fld('Reminder',inp('rt','','text','Example: Scan All Documentation'))+fld('Notes (Optional)',area('rn','','Details To Remember'))+'<div class="g2">'+fld('Date',inp('rd',d,'date'))+fld('Time',sel('rm',QT,defTime(d)))+'</div><label class="ctl" style="margin:4px 0 8px"><input type="checkbox" id="f_rad" checked> All Day (No Set Time)</label></div>'+
   '<div id="blkS" style="display:none">'+fld('Task',presetSel(),'Preset Compounding And Pharmacy Tasks. Choose The Closest Match.')+'<div class="g2">'+fld('Due Date (Or First Due Date)',inp('sd',d,'date'))+fld('Repeat',sel('sr',REPS.map(r=>[r[0],r[1]]),'none'))+'</div>'+fld('Responsible',sel('sw',[['','Default For This Task']].concat(people.map(p=>[p.id,p.name])),''))+(sites.length>1?fld('Pharmacy',sel('ss',[['','All Pharmacies']].concat(sites.map(s=>[s.id,s.name])),'')):'')+fld('Instructions (Optional)',area('sn','','Details Everyone Should See'))+'</div><div id="schedWarn"></div>';
  openModal('Add To Schedule',body,FOOT_SAVE('Add'),{nofocus:true,save:()=>{
    if(V('ty')==='rem'){ const title=V('rt'), date=V('rd'), ad=$('#f_rad').checked, tm=V('rm'); if(!title)return merr('Enter What To Remember.'); if(!date)return merr('Enter A Date.'); if(date<D.today)return merr('Choose Today Or A Later Date.'); if(!ad&&!tm)return merr('Choose A Time Or Check All Day.');
      const r={id:uid('m'),title,notes:V('rn'),date,time:ad?'':tm,allDay:ad,by:whoAmI(),byId:ME,at:nowIso(),done:false}; S.reminders[r.id]=r; closeModal(); UI.selDay=date; UI.calMonth=date.slice(0,7); UI.panel=true; changed('config'); toast('Reminder Added For '+fmt(date)+'.'); return true; }
    const nm=V('sp'); if(!nm)return merr('Choose A Task From The List.'); const date=V('sd'); if(!date)return merr('Enter The Due Date.'); if(date<D.today)return merr('Choose Today Or A Later Date.'); if(!sites.length)return merr('Add A Pharmacy First.');
    const rp=REPS.find(x=>x[0]===V('sr'))||REPS[0], grp=(PRESETS.find(g=>g[1].some(p=>p[0]===nm))||[''])[0], who=whoAmI();
    const rec=rp[2]?{kind:'fixed',anchor:date,startFrom:date,n:rp[2],unit:rp[3]}:{kind:'once',due:date};
    const ob={id:uid('c'),isCustom:true,cat:'Custom',preset:grp,title:nm,scope:'facility',ownerRole:'Designated Person',jur:'US',basis:'Internal',auth:'Added To The Schedule By '+who,conf:'Internal',rec,lead:7,evid:'',note:V('sn')||('Added To The Schedule By '+who+'.'),src:[],addedBy:who,addedAt:nowIso()};
    S.custom.push(ob); Store.put('obl',ob);
    const sid=V('ss'), asg=V('sw'); sites.forEach(s=>{ const key=ob.id+'|'+s.id; if(sid&&s.id!==sid)S.tracks[key]={inactive:true,inactiveReason:'Added For Another Pharmacy'}; else if(asg)S.tracks[key]={assignee:asg}; });
    logAct('Added Shared Task',nm+' — '+fmt(date)+(rp[2]?' · '+rp[1]:'')); closeModal(); const sd=adjustDue(date); UI.selDay=sd; UI.calMonth=sd.slice(0,7); UI.panel=true; changed('config'); toast('Shared Task Added. Everyone With Calendar Access Sees It.'); return true; }});
  const w=()=>{ const r=V('ty')==='rem', date=r?V('rd'):V('sd'); let m='';
    if(date){ const h=hoursFor(date); if(h.closed){ m=r?longDate(date)+': pharmacy closed ('+h.reason+'). The reminder stays on this date.':longDate(date)+' is a closed day ('+h.reason+'). It will show on '+longDate(adjustDue(date))+'.'; } }
    $('#schedWarn').innerHTML=m?'<div class="warnbox" style="margin:0">'+esc(m)+'</div>':(r?'':'<div class="banner info" style="margin:0">A repeating task that lands on a closed day moves to the '+(S.profile.shift==='prev'?'previous':'next')+' open day.</div>'); };
  const tg=()=>{ const r=V('ty')==='rem'; $('#blkR').style.display=r?'':'none'; $('#blkS').style.display=r?'none':''; w(); };
  $('#f_ty').addEventListener('change',tg); $('#f_rd').addEventListener('input',w); $('#f_sd').addEventListener('input',w);
  $('#f_sp').addEventListener('change',()=>{ const o=$('#f_sp').selectedOptions[0]; if(o&&o.dataset.rep)$('#f_sr').value=o.dataset.rep; });
  $('#f_rad').addEventListener('change',()=>{ $('#f_rm').disabled=$('#f_rad').checked; }); $('#f_rm').disabled=true; w();
}
function remModal(id){
  const r=(S.reminders||{})[id]; if(!r||!remMine(r))return;
  openModal('Personal Reminder','<div class="banner info" style="margin:0 0 8px">Shown Only To The Person Who Created It.</div>'+fld('Reminder',inp('rt',r.title))+fld('Notes (Optional)',area('rn',r.notes||''))+'<div class="g2">'+fld('Date',inp('rd',r.date,'date'))+fld('Time',sel('rm',QT,r.time?snap15(r.time):defTime(r.date)))+'</div><label class="ctl" style="margin:4px 0 8px"><input type="checkbox" id="f_rad"'+(r.allDay?' checked':'')+'> All Day (No Set Time)</label>',
   '<button class="btn danger" data-act="remdel" data-id="'+esc(id)+'" style="margin-right:auto">Delete</button><button class="btn" data-act="remdone" data-id="'+esc(id)+'">'+(r.done?'Mark Not Done':'Mark Done')+'</button>'+FOOT_SAVE(),
   {nofocus:true,save:()=>{ const title=V('rt'), date=V('rd'), ad=$('#f_rad').checked, tm=V('rm'); if(!title)return merr('Enter What To Remember.'); if(!date)return merr('Enter A Date.'); if(!ad&&!tm)return merr('Choose A Time Or Check All Day.');
     Object.assign(r,{title,notes:V('rn'),date,time:ad?'':tm,allDay:ad}); closeModal(); changed('config'); return true; }});
  const sync=()=>{ $('#f_rm').disabled=$('#f_rad').checked; }; $('#f_rad').addEventListener('change',sync); sync();
}

/* ===== cleanroom rooms and PECs ===== */
const ROOM_KINDS={ante:'Ante Room',buffer:'Buffer Room',sca:'Segregated Compounding Area (SCA)',nsa:'Nonsterile Compounding Area'};
function roomName(kind,num,nm){ if(kind==='nsa')return nm||''; if(kind==='sca')return 'Segregated Compounding Area'+(num?' '+num:''); return (kind==='ante'?'Ante Room':'Buffer Room')+(num?' '+num:''); }
function roomCats(r){ return r.kind==='sca'?'Category 1 Only':r.kind==='buffer'?'Categories 1, 2 And 3':''; }
function roomModal(id,kind0){
  const cur=id?S.rooms.find(x=>x.id===id):null; const f=S.profile.features; const sites=S.sites.filter(s=>!s.archived);
  const v=cur||{kind:kind0||(f.sterile?'buffer':'nsa'),iso:'7',num:'',neg:false,name:'',note:''};
  const kinds=[]; if(f.sterile)kinds.push('ante','buffer','sca'); if(f.nonsterile)kinds.push('nsa'); if(!kinds.includes(v.kind))kinds.push(v.kind);
  openModal(cur?'Edit Room Or Area':'Add Room Or Area','<p class="mut" style="margin:0 0 8px">Sterile rooms get their own certification schedule. Nonsterile areas do not.</p>'+fld('Type',sel('rk',kinds.map(k=>[k,ROOM_KINDS[k]]),v.kind))+
   '<div id="blkNum">'+fld('Room Number (Optional)',inp('rn',v.num,'text','1'),'Use 1, 2 And So On When There Is More Than One Room Of The Same Type.')+'</div>'+
   '<div id="blkNs">'+fld('Area Name',inp('rnm',v.kind==='nsa'?v.name:'','text','Example: Nonsterile Compounding Bench'))+fld('Location (Optional)',inp('rnt',v.note||'','text','Example: Back Counter, Left Of The Sink'))+'</div>'+
   (sites.length>1?fld('Pharmacy',sel('rs',sites.map(s=>[s.id,s.name]),v.siteId||sites[0].id)):'')+
   '<div id="blkAnte">'+bool('rneg',v.neg,'Next To Or Shared With A Negative Pressure Room')+'</div><div id="blkIso">'+fld('ISO Class','<select id="f_ri"></select>')+'</div><div id="roomNote" class="banner info" style="margin:0"></div>',
   (cur?'<button class="btn danger" data-act="archive" data-k="room" data-id="'+esc(id)+'" style="margin-right:auto">Archive</button>':'')+FOOT_SAVE(cur?'Save':'Add'),
   {nofocus:true,save:()=>{ if(!sites.length)return merr('Add A Pharmacy First.'); const kind=V('rk'), siteId=V('rs')||sites[0].id; let num=V('rn'), iso=V('ri'), neg=kind==='ante'&&VB('rneg'), nm, note='';
     if(kind==='nsa'){ nm=V('rnm'); if(!nm)return merr('Enter An Area Name.'); num=''; iso=''; neg=false; note=V('rnt'); }
     else { if(num&&!/^\d{1,2}$/.test(num))return merr('Room Number Must Be A Number, Like 1 Or 2.'); if(kind==='sca'){ iso=''; neg=false; } else { if(kind==='buffer'&&iso!=='7')return merr('A Buffer Room Must Be ISO 7.'); if(neg&&iso!=='7')return merr('An Ante Room Next To Or Shared With A Negative Pressure Room Must Be ISO 7.'); } nm=roomName(kind,num); }
     if(S.rooms.some(r=>!r.archived&&r.id!==id&&r.siteId===siteId&&r.name===nm))return merr(nm+' Already Exists. Use A Different '+(kind==='nsa'?'Name.':'Room Number.'));
     const r=Object.assign(cur||{id:uid('rm')},{kind,num,iso,neg,siteId,name:nm,note}); if(!cur)S.rooms.push(r); logAct(cur?'Edited Room':'Added Room',nm+(iso?', ISO '+iso:'')); closeModal(); changed('config'); return true; }});
  const sync=()=>{ const k=V('rk'), ante=k==='ante', neg=ante&&VB('rneg'), si=$('#f_ri'), pv=si.value||v.iso, ns=k==='nsa', sca=k==='sca'; $('#blkAnte').style.display=ante?'':'none'; $('#blkNs').style.display=ns?'':'none'; $('#blkNum').style.display=ns?'none':''; $('#blkIso').style.display=(ns||sca)?'none':'';
    si.innerHTML=ante?(neg?'<option value="7">ISO 7</option>':'<option value="8">ISO 8</option><option value="7">ISO 7</option>'):'<option value="7">ISO 7</option>'; if([...si.options].some(o=>o.value===pv))si.value=pv;
    $('#roomNote').textContent=ns?'USP <795> requires a designated, clean, organized and well-lit area. It has no ISO class and no certification schedule. Beyond-use dates come from the dosage-form table, per product.':sca?'An SCA is not ISO classified. It supports Category 1 preparations only, made in an ISO 5 PEC. Category 1 limit: 12 hours at room temperature or 24 hours refrigerated. Category 2 and 3 preparations need a cleanroom suite (ante room and buffer room).':ante?(neg?'An ante room next to or shared with a negative pressure room must be ISO 7.':'An ante room is ISO 8 or ISO 7. It must be ISO 7 if it is next to or shared with a negative pressure room.'):'A buffer room is ISO 7. It supports Category 1, 2 and 3 preparations.'; };
  $('#f_rk').addEventListener('change',sync); $('#f_rneg').addEventListener('change',sync); sync();
}
function pecModal(id){
  const cur=id?S.equipment.find(x=>x.id===id):null; const p0=(cur&&cur.pec)||{type:'lafw',flow:'h',ft:4}; const sites=S.sites.filter(s=>!s.archived);
  const std=[3,4,5,6].includes(+p0.ft); const siteId0=(cur&&cur.siteId)||(sites[0]&&sites[0].id)||'';
  const roomOpts=sid=>[['','Not Assigned To A Room']].concat(S.rooms.filter(r=>!r.archived&&(r.kind==='buffer'||r.kind==='sca')&&r.siteId===sid).map(r=>[r.id,r.name]));
  openModal(cur?'Edit PEC':'Add PEC','<p class="mut" style="margin:0 0 8px">Each PEC gets its own certification schedule and test list.</p>'+fld('Name',inp('pn',cur?cur.name:'','text','Example: Hood A'))+(sites.length>1?fld('Pharmacy',sel('ps',sites.map(s=>[s.id,s.name]),siteId0)):'')+
   fld('Room',sel('pr',roomOpts(siteId0),p0.roomId||''),'PECs Sit In A Buffer Room Or An SCA. Add The Room First If It Is Not Listed.')+'<div id="pecNote"></div>'+fld('PEC Type',sel('pt',Object.keys(PEC_TYPES).map(k=>[k,PEC_TYPES[k]]),p0.type))+
   '<div id="blkFlow">'+fld('Airflow Direction',sel('pf',[['h','Horizontal'],['v','Vertical']],p0.flow||'h'))+'</div><div id="blkBsc">'+fld('Cabinet Type',sel('pb',BSC_TYPES.map(x=>[x,x]),p0.bsc||BSC_TYPES[1]))+'</div>'+
   '<div id="blkLen"><div class="g2">'+fld('Length',sel('pl',[['3','3 ft'],['4','4 ft'],['5','5 ft'],['6','6 ft'],['x','Other: Enter Exact Feet']],std?String(+p0.ft):(p0.ft?'x':'4')))+'<div id="blkLenX">'+fld('Exact Length (Feet)',inp('plx',std?'':p0.ft,'number','Example: 4.5'))+'</div></div></div>'+
   '<div class="g2">'+fld('Brand',inp('pbr',p0.brand,'text'))+fld('Series Or Model',inp('pm',p0.model,'text'))+'</div>',
   (cur?'<button class="btn danger" data-act="archive" data-k="equip" data-id="'+esc(id)+'" style="margin-right:auto">Archive</button>':'')+FOOT_SAVE(cur?'Save':'Add'),
   {nofocus:true,save:()=>{ const name=V('pn'); if(!name)return merr('Enter A Name.'); if(!sites.length)return merr('Add A Pharmacy First.'); const type=V('pt'), siteId=V('ps')||sites[0].id;
     const pec={type,roomId:V('pr'),brand:V('pbr'),model:V('pm')}; if(type==='lafw')pec.flow=V('pf'); if(type==='bsc')pec.bsc=V('pb');
     if(type==='lafw'||type==='bsc'){ const l=V('pl'); if(l==='x'){ const x=+V('plx'); if(!(x>0&&x<=20))return merr('Enter The Exact Length In Feet.'); pec.ft=x; } else pec.ft=+l; }
     if(pec.roomId&&!S.rooms.some(r=>r.id===pec.roomId&&r.siteId===siteId))pec.roomId='';
     const e=cur||{id:uid('e'),kind:EQUIP_KINDS[0]}; Object.assign(e,{name,siteId,pec}); if(!cur)S.equipment.push(e); logAct(cur?'Edited PEC':'Added PEC',name+', '+PEC_TYPES[type]); closeModal(); changed('config'); return true; }});
  const sync=()=>{ const t=V('pt'); $('#blkFlow').style.display=t==='lafw'?'':'none'; $('#blkBsc').style.display=t==='bsc'?'':'none'; $('#blkLen').style.display=(t==='lafw'||t==='bsc')?'':'none'; $('#blkLenX').style.visibility=V('pl')==='x'?'visible':'hidden'; };
  const rooms=()=>{ const el=$('#f_pr'); if(!el)return; const pv=el.value; const sid=V('ps')||siteId0; el.innerHTML=roomOpts(sid).map(o=>'<option value="'+esc(o[0])+'">'+esc(o[1])+'</option>').join(''); if([...el.options].some(o=>o.value===pv))el.value=pv; };
  const note=()=>{ const r=S.rooms.find(x=>x.id===V('pr')); $('#pecNote').innerHTML=r&&roomCats(r)?'<div class="banner info" style="margin:0 0 8px">'+esc(r.name)+': '+esc(roomCats(r))+'.</div>':''; };
  $('#f_pt').addEventListener('change',sync); $('#f_pl').addEventListener('change',sync); $('#f_pr').addEventListener('change',note); if($('#f_ps'))$('#f_ps').addEventListener('change',()=>{rooms();note();}); sync(); note();
}

/* ===== boot ===== */
(async function boot(){
  const h=location.hash.slice(1); if(TABS.some(t=>t[0]===h))UI.tab=h;
  render();
  try{ await Store.init(); }catch(e){ Store.kind='memory'; }
  if(S.mode!=='live'){ if(BLANK){ S=emptyState(); S.mode='blank'; } else S=makeDemo(); }
  if(window.ILHOST&&ILHOST.user&&ILHOST.user.name&&!ME){ const nm=String(ILHOST.user.name).trim().toLowerCase(); const pp=S.people.find(x=>!x.archived&&String(x.name||'').trim().toLowerCase()===nm); if(pp)ME=pp.id; }
  UI.loading=false; if(!BLANK||S.mode==='live')recompute(); render();
  setInterval(()=>{ try{ if(!D)return; if(localToday()!==D.today){ recompute(); render(); } else updateClock(); }catch(e){} },1000);
})();
