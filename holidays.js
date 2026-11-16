/* IronLedger calendar facts: US federal and bank holidays, other observances, leap years, DST by time zone. Pure functions. */
const US = (function () {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  const ds = (y, m, d) => y + '-' + pad(m) + '-' + pad(d);                       // m is 1-12
  const dowOf = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();         // 0=Sun
  const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const isLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  function nth(y, m, dow, n) { const f = dowOf(y, m, 1); return 1 + ((dow - f + 7) % 7) + (n - 1) * 7; }
  function last(y, m, dow) { const l = dim(y, m); return l - ((dowOf(y, m, l) - dow + 7) % 7); }
  function addDays(s, n) { const p = s.split('-').map(Number); const t = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)); return ds(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); }
  function easter(y) { // Meeus/Jones/Butcher
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return ds(y, mo, da);
  }
  /* 5 U.S.C. 6103 legal holidays. Juneteenth since 2021; none before 1971 rules are modeled (Monday-holiday law). */
  function fedList(y) {
    const L = [
      ['newyear', "New Year's Day", ds(y, 1, 1)],
      ['mlk', 'Martin Luther King Jr. Day', ds(y, 1, nth(y, 1, 1, 3))],
      ['presidents', "Washington's Birthday (Presidents Day)", ds(y, 2, nth(y, 2, 1, 3))],
      ['memorial', 'Memorial Day', ds(y, 5, last(y, 5, 1))],
      ['july4', 'Independence Day', ds(y, 7, 4)],
      ['labor', 'Labor Day', ds(y, 9, nth(y, 9, 1, 1))],
      ['columbus', 'Columbus Day (Indigenous Peoples Day)', ds(y, 10, nth(y, 10, 1, 2))],
      ['veterans', 'Veterans Day', ds(y, 11, 11)],
      ['thanks', 'Thanksgiving Day', ds(y, 11, nth(y, 11, 4, 4))],
      ['xmas', 'Christmas Day', ds(y, 12, 25)]
    ];
    if (y >= 2021) L.splice(4, 0, ['juneteenth', 'Juneteenth National Independence Day', ds(y, 6, 19)]);
    return L;
  }
  const HOLIDAY_IDS = ['newyear', 'mlk', 'presidents', 'memorial', 'juneteenth', 'july4', 'labor', 'columbus', 'veterans', 'thanks', 'xmas'];
  const HOLIDAY_NAMES = { newyear: "New Year's Day", mlk: 'Martin Luther King Jr. Day', presidents: "Washington's Birthday (Presidents Day)", memorial: 'Memorial Day', juneteenth: 'Juneteenth', july4: 'Independence Day', labor: 'Labor Day', columbus: 'Columbus Day', veterans: 'Veterans Day', thanks: 'Thanksgiving Day', xmas: 'Christmas Day' };
  const SHORT = { presidents: 'Presidents Day', columbus: 'Columbus Day', juneteenth: 'Juneteenth', mlk: 'MLK Day' };
  const cache = {};
  /* Returns {date: [items]}. kind: 'hol' legal date, 'obs' observed date (federal offices), 'obs2' other observance.
     Fed Reserve rule: Saturday holiday -> banks OPEN the Friday before; Sunday holiday -> banks CLOSED the Monday after. OPM: Sat->Fri, Sun->Mon. */
  function holidays(y) {
    if (cache[y]) return cache[y]; const out = {}; const add = (d, it) => (out[d] = out[d] || []).push(it);
    for (const h of fedList(y)) {
      const id = h[0], name = h[1], date = h[2]; const dw = new Date(date + 'T00:00:00Z').getUTCDay();
      add(date, { kind: 'hol', hid: id, name, short: SHORT[id] || name, note: dw === 6 ? 'Federal and bank holiday. Federal Reserve banks are open the Friday before.' : dw === 0 ? 'Federal and bank holiday. Observed Monday.' : 'Federal and bank holiday.' });
      if (dw === 6) add(addDays(date, -1), { kind: 'obs', hid: id, name: name + ' (Observed)', short: (SHORT[id] || name) + ' (Obs.)', note: 'Federal offices closed. Federal Reserve banks are open.', mon: false });
      if (dw === 0) add(addDays(date, 1), { kind: 'obs', hid: id, name: name + ' (Observed)', short: (SHORT[id] || name) + ' (Obs.)', note: 'Federal offices and Federal Reserve banks closed.', mon: true });
    }
    const e = easter(y), thanks = ds(y, 11, nth(y, 11, 4, 4));
    [[addDays(e, -2), 'Good Friday'], [e, 'Easter Sunday'], [ds(y, 5, nth(y, 5, 0, 2)), "Mother's Day"], [ds(y, 6, nth(y, 6, 0, 3)), "Father's Day"], [addDays(thanks, 1), 'Black Friday'], [ds(y, 12, 24), 'Christmas Eve'], [ds(y, 12, 31), "New Year's Eve"]]
      .forEach(x => add(x[0], { kind: 'obs2', name: x[1], note: 'Not a federal or bank holiday.' }));
    if (isLeap(y)) add(ds(y, 2, 29), { kind: 'leap', name: 'Leap Day', note: y + ' is a leap year (366 days).' });
    return (cache[y] = out);
  }
  /* DST: find days where the UTC offset differs from the day before, in tz. */
  function offsetMin(tz, y, m, d) {
    const t = Date.UTC(y, m - 1, d, 12); const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    const p = {}; f.formatToParts(new Date(t)).forEach(x => p[x.type] = +x.value);
    return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - t) / 60000);
  }
  const dcache = {};
  function dst(y, tz) {
    const k = tz + '|' + y; if (dcache[k]) return dcache[k]; const out = {};
    try {
      let prev = offsetMin(tz, y - 1, 12, 31);
      for (let m = 1; m <= 12; m++) for (let d = 1; d <= dim(y, m); d++) {
        const o = offsetMin(tz, y, m, d);
        if (o !== prev) { const fwd = o > prev; out[ds(y, m, d)] = [{ kind: 'dst', name: fwd ? 'Daylight Saving Time Begins' : 'Daylight Saving Time Ends', note: fwd ? 'Clocks go forward 1 hour at 2:00 AM. The day has 23 hours.' : 'Clocks go back 1 hour at 2:00 AM. The day has 25 hours.' }]; }
        prev = o;
      }
    } catch (e) { /* unknown tz: no DST info */ }
    return (dcache[k] = out);
  }
  /* All calendar facts for one date. opt: {tz, hol, obs} */
  function day(date, opt) {
    opt = opt || {}; const y = +date.slice(0, 4); let L = [];
    const h = holidays(y)[date] || [];
    if (opt.hol !== false) L = L.concat(h.filter(x => x.kind === 'hol' || x.kind === 'obs'));
    if (opt.obs !== false) L = L.concat(h.filter(x => x.kind === 'obs2'));
    L = L.concat(h.filter(x => x.kind === 'leap'));
    // Observed dates may fall in the neighbouring year (e.g. Dec 31 for New Year's Day on a Saturday)
    if (date.slice(5) === '12-31' && opt.hol !== false) { const n = holidays(y + 1)[date] || []; L = L.concat(n.filter(x => x.kind === 'obs')); }
    if (date.slice(5) === '01-01' && opt.hol !== false) { /* Monday-observed for a Dec holiday never lands in January except Jan 1 itself */ }
    if (opt.tz) L = L.concat(dst(y, opt.tz)[date] || []);
    return L;
  }
  return { isLeap, holidays, dst, day, easter, nth, last, addDays, HOLIDAY_IDS, HOLIDAY_NAMES, fedList, dowOf, dim };
})();
if (typeof module !== 'undefined') module.exports = US;
