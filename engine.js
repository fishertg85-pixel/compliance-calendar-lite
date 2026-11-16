/* IronLedger Compliance Calendar - scheduling engine (pure functions, no DOM). */
const IL = (function () {
  'use strict';
  const DAY = 86400000;
  const pad = n => String(n).padStart(2, '0');
  function pd(s) { const p = s.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function fd(ms) { const t = new Date(ms); return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()); }
  function addDays(s, n) { return fd(pd(s) + n * DAY); }
  function diffDays(a, b) { return Math.round((pd(a) - pd(b)) / DAY); }
  function addMonths(s, n, day) {
    const p = s.split('-').map(Number); const tm = p[1] - 1 + n;
    const y = p[0] + Math.floor(tm / 12); const m = ((tm % 12) + 12) % 12;
    const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return y + '-' + pad(m + 1) + '-' + pad(Math.min(day || p[2], dim));
  }
  function addInterval(s, n, unit, day) {
    if (unit === 'day') return addDays(s, n);
    if (unit === 'week') return addDays(s, 7 * n);
    if (unit === 'month') return addMonths(s, n, day);
    if (unit === 'year') return addMonths(s, 12 * n, day);
    throw new Error('Unknown unit ' + unit);
  }
  function statusFor(due, today, lead) { const d = diffDays(due, today); return d < 0 ? 'overdue' : (d <= lead ? 'due-soon' : 'upcoming'); }
  function mkOpen(due, today, lead, extra) { return Object.assign({ due, status: statusFor(due, today, lead), days: diffDays(due, today), done: false }, extra); }
  function mkDone(due, rec, extra) {
    const eff = (rec.allowedDue && rec.allowedDue > due) ? rec.allowedDue : due;
    const late = !!(due && rec.completedOn > eff);
    return Object.assign({ due, status: rec.status === 'na' ? 'na' : (late ? 'late-done' : 'done'), done: true, rec, lateDays: late ? diffDays(rec.completedOn, eff) : 0, days: due ? diffDays(due, rec.completedOn) : null }, extra);
  }

  /* One track = one obligation for one subject. Returns its occurrences in due order. */
  function trackOccurrences(a) {
    const ob = a.ob, r = ob.rec, trk = a.trk || {}, today = a.today;
    const lead = trk.lead != null ? trk.lead : (ob.lead || 0);
    const horizon = a.to;
    const recs = (a.recs || []).filter(x => x.status !== 'void')
      .sort((x, y) => x.completedOn < y.completedOn ? -1 : x.completedOn > y.completedOn ? 1 : ((x.createdAt || '') < (y.createdAt || '') ? -1 : 1));
    const out = [];
    if (r.kind === 'rolling') {
      const n = trk.n || r.n, unit = trk.unit || r.unit;
      let prev = null; const base = trk.baselineDate || null;
      const real = recs.filter(x => x.status !== 'na');
      if (base && (!real.length || base <= real[0].completedOn)) prev = base;
      for (const rec of real) {
        const due = prev ? addInterval(prev, n, unit) : (trk.firstDue || null);
        out.push(mkDone(due, rec, { key: 'r:' + rec.id, windowStart: prev }));
        prev = rec.completedOn;
      }
      const due = prev ? addInterval(prev, n, unit) : (trk.firstDue || null);
      if (!due) out.push({ key: 'r:open', due: null, status: 'nobaseline', done: false, days: null });
      else {
        out.push(mkOpen(due, today, lead, { key: 'r:open:' + due, windowStart: prev }));
        let d = due, g = 0;
        while (g++ < 400) { d = addInterval(d, n, unit); if (d > horizon) break; out.push({ key: 'p:' + d, due: d, status: 'projected', projected: true, done: false, days: diffDays(d, today) }); }
      }
    } else if (r.kind === 'expiry') {
      let due = trk.firstDue || null;
      for (const rec of recs) { if (rec.status === 'na') continue; out.push(mkDone(due, rec, { key: 'e:' + rec.id })); due = rec.nextDue || null; }
      if (!due) out.push({ key: 'e:open', due: null, status: 'nobaseline', done: false, days: null });
      else {
        const o = mkOpen(due, today, lead, { key: 'e:open:' + due });
        o.openDate = addDays(due, -(r.windowDays || 0)); o.canAct = r.windowDays ? today >= o.openDate : true; out.push(o);
      }
    } else if (r.kind === 'fixed') {
      const n = trk.n || r.n, unit = trk.unit || r.unit;
      const anchor = trk.anchor || r.anchor || today; const aday = +anchor.slice(8);
      const sf = trk.startFrom || r.startFrom; const start = (sf && sf > (a.trackStart || today)) ? sf : (a.trackStart || today);
      const dueAt = k => addInterval(anchor, k * n, unit, aday);
      let k;
      if (unit === 'day' || unit === 'week') { const per = n * (unit === 'week' ? 7 : 1); k = Math.ceil(diffDays(start, anchor) / per); }
      else { k = 0; while (dueAt(k) >= start && k > -5000) k--; while (dueAt(k) < start) k++; }
      const byDue = {}; for (const x of recs) if (x.forDue) byDue[x.forDue] = x;
      let prevDue = dueAt(k - 1), g = 0;
      for (; g < 3000; k++, g++) {
        const due = dueAt(k); if (due > horizon) break;
        let rec = byDue[due];
        if (!rec) rec = recs.find(x => !x.forDue && x.completedOn > prevDue && x.completedOn <= due);
        const ws = addDays(prevDue, 1);
        out.push(rec ? mkDone(due, rec, { key: 'f:' + due, windowStart: ws }) : mkOpen(due, today, lead, { key: 'f:' + due, windowStart: ws }));
        prevDue = due;
      }
    } else if (r.kind === 'event') {
      for (const ev of (a.events || [])) {
        const due = r.direction === 'before' ? addDays(ev.eventDate, -r.offset) : addDays(ev.eventDate, r.offset);
        const rec = recs.find(x => x.forEvent === ev.id);
        out.push(rec ? mkDone(due, rec, { key: 'v:' + ev.id, event: ev }) : mkOpen(due, today, lead, { key: 'v:' + ev.id, event: ev }));
      }
    } else if (r.kind === 'once') {
      const due = trk.due || r.due; const rec = recs[0];
      out.push(rec ? mkDone(due, rec, { key: 'o:' + due }) : mkOpen(due, today, lead, { key: 'o:' + due }));
    }
    out.sort((x, y) => (x.due || '9999') < (y.due || '9999') ? -1 : 1);
    return out;
  }

  /* ---- library + tracks ---- */
  function mergeObligations(seed, overrides, custom) {
    const out = [];
    for (const s of seed) {
      const o = (overrides && overrides[s.id]) || {};
      const m = Object.assign({}, s, o);
      m.rec = Object.assign({}, s.rec, o.rec || {});
      m.active = o.active != null ? o.active : s.defaultActive !== false;
      m.custom = false; out.push(m);
    }
    for (const c of (custom || [])) { out.push(Object.assign({}, c, { custom: true, active: c.active !== false })); }
    return out;
  }
  function applies(ob, st) {
    const f = (st.profile && st.profile.features) || {};
    if (ob.requires && !ob.requires.every(x => f[x])) return false;
    if (ob.jur && ob.jur !== 'US' && ob.jur !== (st.profile && st.profile.state)) return false;
    return true;
  }
  function personMatch(p, tag) {
    if (!tag || tag === 'any') return true;
    if (tag === 'pharmacist') return p.role === 'Pharmacist';
    if (tag === 'technician') return p.role === 'Technician';
    return (p.tags || []).includes(tag);
  }
  function subjectsFor(ob, st) {
    const act = x => !x.archived;
    if (ob.scope === 'facility') return (st.sites || []).filter(act).map(s => ({ type: 'site', id: s.id, name: s.name, siteId: s.id, data: s }));
    if (ob.scope === 'room') return (st.rooms || []).filter(act).filter(r => !ob.roomKinds || ob.roomKinds.includes(r.kind)).map(r => ({ type: 'room', id: r.id, name: r.name, siteId: r.siteId || '', data: r }));
    if (ob.scope === 'person') return (st.people || []).filter(act).filter(p => personMatch(p, ob.personTag)).map(p => ({ type: 'person', id: p.id, name: p.name, siteId: p.siteId || '', data: p }));
    if (ob.scope === 'equipment') return (st.equipment || []).filter(act).filter(e => !ob.equipTypes || ob.equipTypes.includes(e.kind)).map(e => ({ type: 'equipment', id: e.id, name: e.name, siteId: e.siteId || '', data: e }));
    if (ob.scope === 'document') return (st.documents || []).filter(act).filter(d => !ob.docTypes || ob.docTypes.includes(d.type)).map(d => ({ type: 'document', id: d.id, name: d.title, siteId: d.siteId || '', data: d }));
    return [];
  }
  function responsible(st, ob, trk) {
    if (trk && trk.assignee) { const p = (st.people || []).find(x => x.id === trk.assignee); if (p) return p; }
    const p = (st.people || []).find(x => !x.archived && (x.duties || []).includes(ob.ownerRole));
    return p || null;
  }
  function buildTracks(st, obs) {
    const tracks = [];
    for (const ob of obs) {
      if (!ob.active || !applies(ob, st)) continue;
      for (const subj of subjectsFor(ob, st)) {
        const key = ob.id + '|' + subj.id;
        const trk = Object.assign({}, (st.tracks || {})[key] || {});
        if (trk.inactive) { tracks.push({ key, ob, subj, trk, inactive: true }); continue; }
        if (ob.firstDueField && !trk.firstDue && subj.data[ob.firstDueField]) trk.firstDue = subj.data[ob.firstDueField];
        if (ob.baselineField && !trk.baselineDate && subj.data[ob.baselineField]) trk.baselineDate = subj.data[ob.baselineField];
        if (subj.type === 'document' && !trk.n) { trk.n = +subj.data.reviewMonths || 12; trk.unit = 'month'; }
        tracks.push({ key, ob, subj, trk, who: responsible(st, ob, trk) });
      }
    }
    return tracks;
  }
  /* All occurrences for all tracks within [from,to]. Open items outside the range are kept when overdue. */
  function collect(st, obs, today, from, to, opt) {
    opt = opt || {};
    const tracks = buildTracks(st, obs); const out = []; const noBase = [];
    const recsByTrack = {}; for (const r of (st.records || [])) (recsByTrack[r.track] = recsByTrack[r.track] || []).push(r);
    const evByTrack = {}; for (const e of (st.events || [])) (evByTrack[e.track] = evByTrack[e.track] || []).push(e);
    for (const t of tracks) {
      if (t.inactive) continue;
      if (opt.skipRoutine && t.ob.routine) continue;
      if (opt.siteId && t.subj.siteId && t.subj.siteId !== opt.siteId) continue;
      const hz = to > addDays(today, 800) ? to : addDays(today, 800);
      const occs = trackOccurrences({ ob: t.ob, trk: t.trk, recs: recsByTrack[t.key] || [], events: evByTrack[t.key] || [], today, to: hz, trackStart: st.profile && st.profile.trackingStart });
      for (const o of occs) {
        o.track = t; o.trackKey = t.key;
        if (opt.adjust && !o.done && o.due && o.status !== 'nobaseline' && (t.ob.rec.kind === 'rolling' || t.ob.rec.kind === 'fixed')) {
          const nd = opt.adjust(o.due);
          if (nd && nd !== o.due) {
            o.origDue = o.due; o.due = nd; o.moved = true; o.days = diffDays(nd, today);
            if (!o.projected) o.status = statusFor(nd, today, t.trk.lead != null ? t.trk.lead : (t.ob.lead || 0));
          }
        }
        if (o.status === 'nobaseline') { noBase.push(o); out.push(o); continue; }
        if (o.due >= from && o.due <= to) out.push(o);
        else if (!o.done && o.status === 'overdue') out.push(o);
      }
    }
    return { occs: out, noBase, tracks };
  }
  function stats(occs, today, from, to) {
    let on = 0, late = 0, missed = 0, na = 0;
    for (const o of occs) {
      if (o.projected || o.status === 'nobaseline' || !o.due) continue;
      if (o.due < from || o.due > to || o.due > today) continue;
      if (o.status === 'done') on++; else if (o.status === 'late-done') late++; else if (o.status === 'na') na++; else if (o.status === 'overdue') missed++;
    }
    const den = on + late + missed;
    return { on, late, missed, na, total: den, onTimeRate: den ? on / den : null, doneRate: den ? (on + late) / den : null };
  }
  function freqText(ob, trk) {
    const r = ob.rec; trk = trk || {};
    const u = (n, unit) => n === 1 ? ({ day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Annually' })[unit] : 'Every ' + n + ' ' + unit + 's';
    const nn = trk.n || r.n, uu = trk.unit || r.unit;
    if (r.kind === 'fixed') return u(nn, uu) + ' on set dates';
    if (r.kind === 'rolling') return 'Every ' + (nn === 1 ? '' : nn + ' ') + uu + (nn === 1 ? '' : 's') + ' from last done';
    if (r.kind === 'expiry') return 'At expiration' + (r.windowDays ? ' (window opens ' + r.windowDays + ' days before)' : '');
    if (r.kind === 'event') return r.offset + ' days ' + (r.direction === 'before' ? 'before' : 'after') + ' event';
    return 'One time';
  }
  function toICS(items, prodId) {
    const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//' + (prodId || 'IronLedger') + '//Compliance Calendar//EN', 'CALSCALE:GREGORIAN'];
    for (const it of items) {
      const d = it.due.replace(/-/g, ''); const nd = addDays(it.due, 1).replace(/-/g, '');
      L.push('BEGIN:VEVENT', 'UID:' + it.uid + '@ironledgerrx.com', 'DTSTAMP:' + it.stamp, 'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + nd,
        'SUMMARY:' + esc(it.title), 'DESCRIPTION:' + esc(it.desc), 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(it.title), 'TRIGGER:-P' + (it.alarmDays || 7) + 'D', 'END:VALARM', 'END:VEVENT');
    }
    L.push('END:VCALENDAR'); return L.join('\r\n');
  }
  return { pd, fd, addDays, diffDays, addMonths, addInterval, statusFor, trackOccurrences, mergeObligations, applies, subjectsFor, buildTracks, collect, stats, freqText, responsible, toICS };
})();
if (typeof module !== 'undefined') module.exports = IL;
