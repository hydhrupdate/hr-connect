// MINUTES HR Connect - Auto Post Script
// Runs via GitHub Actions every day at 6 AM IST (12:30 AM UTC)

const PROJECT = 'hr-connect-3c286';
const APIKEY = 'AIzaSyA-5I3dKQnFaYF0I1tOUyYcRP-mhgEBlW0';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/`;

// ─── HOLIDAYS ───────────────────────────────────────────────
const HOLIDAYS = [
  { date: '03-19', name: 'Ugadi',                emoji: '🌸', msg: 'Wishing everyone a Happy Ugadi! May this Telugu New Year bring joy, prosperity and good health to you and your family.' },
  { date: '05-01', name: 'May Day',               emoji: '✊', msg: 'Happy May Day! Today we celebrate the spirit and dedication of every worker. Thank you for your hard work and commitment.' },
  { date: '06-02', name: 'Telangana Formation Day',emoji: '🌟', msg: 'Happy Telangana Formation Day! Proud to celebrate the spirit and culture of our wonderful state. Jai Telangana!' },
  { date: '08-15', name: 'Independence Day',       emoji: '🇮🇳', msg: 'Happy Independence Day! Let us celebrate the freedom and unity of our great nation. Jai Hind! 🇮🇳' },
  { date: '09-14', name: 'Vinayaka Chavithi',      emoji: '🐘', msg: 'Happy Vinayaka Chavithi! May Lord Ganesha bless you with wisdom, prosperity and remove all obstacles from your path. Ganpati Bappa Morya!' },
  { date: '10-02', name: 'Mahatma Gandhi Jayanthi',emoji: '🕊️', msg: 'On the occasion of Gandhi Jayanthi, let us remember and follow the values of truth, non-violence and peace taught by the Father of our Nation.' },
  { date: '10-20', name: 'Vijaya Dasami',          emoji: '⚔️', msg: 'Happy Vijaya Dasami! May the victory of good over evil inspire us to overcome challenges and achieve success in all our endeavors.' },
  { date: '11-08', name: 'Deepavali',              emoji: '🪔', msg: 'Happy Deepavali! May the festival of lights fill your life with happiness, prosperity and peace. Wishing you and your family a bright and joyful Diwali!' },
];

// ─── HELPERS ────────────────────────────────────────────────
async function fsGet(col) {
  const r = await fetch(`${BASE}${col}?key=${APIKEY}&pageSize=300`);
  const d = await r.json();
  if (!d.documents) return [];
  return d.documents.map(doc => {
    const obj = { fid: doc.name.split('/').pop() };
    Object.keys(doc.fields || {}).forEach(k => {
      const v = doc.fields[k];
      if ('stringValue' in v) obj[k] = v.stringValue;
      else if ('integerValue' in v) obj[k] = parseInt(v.integerValue);
      else if ('booleanValue' in v) obj[k] = v.booleanValue;
      else if ('arrayValue' in v) obj[k] = (v.arrayValue.values || []).map(i => i.stringValue || '');
    });
    return obj;
  });
}

async function fsAdd(col, obj) {
  const fields = {};
  Object.keys(obj).forEach(k => {
    const v = obj[k];
    if (Array.isArray(v)) fields[k] = { arrayValue: { values: v.map(i => ({ stringValue: String(i) })) } };
    else fields[k] = { stringValue: String(v) };
  });
  const r = await fetch(`${BASE}${col}?key=${APIKEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d;
}

// ─── MAIN ───────────────────────────────────────────────────
async function main() {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  const todayDate = ist.toISOString().slice(0, 10); // YYYY-MM-DD
  const todayMD = ist.toISOString().slice(5, 10);   // MM-DD

  console.log(`Running auto-post for IST date: ${todayDate} (MM-DD: ${todayMD})`);

  // Fetch existing updates to avoid duplicate posts
  const updates = await fsGet('updates');
  const todayPosts = updates.filter(u => u.createdAt && u.createdAt.slice(0, 10) === todayDate);
  const todayTags = todayPosts.map(u => u.tag);

  // ── 1. HOLIDAY CHECK ──────────────────────────────────────
  const holiday = HOLIDAYS.find(h => h.date === todayMD);
  if (holiday) {
    const alreadyPosted = todayPosts.some(u => u.tag === 'event' && u.title && u.title.includes(holiday.name));
    if (alreadyPosted) {
      console.log(`Holiday post for ${holiday.name} already exists today. Skipping.`);
    } else {
      await fsAdd('updates', {
        type: 'update',
        title: `${holiday.emoji} Happy ${holiday.name}!`,
        body: holiday.msg,
        tag: 'event',
        author: 'Vendor Partner',
        image: '',
        visibility: JSON.stringify(['managers', 'sales', 'it', 'hr', 'operations']),
        createdAt: ist.toISOString()
      });
      console.log(`✅ Holiday post created: ${holiday.name}`);
    }
  } else {
    console.log(`No holiday today (${todayMD}).`);
  }

  // ── 2. BIRTHDAY CHECK ─────────────────────────────────────
  const alreadyBdayPosted = todayTags.includes('birthday');
  if (alreadyBdayPosted) {
    console.log('Birthday post already exists today. Skipping.');
  } else {
    const assocs = await fsGet('associates');
    const bdays = assocs.filter(a => {
      if (!a.dob || a.status !== 'active') return false;
      const parts = a.dob.split('-');
      if (parts.length < 3) return false;
      // Handle both YYYY-MM-DD and DD-MM-YYYY
      let mm, dd;
      if (parts[0].length === 4) { mm = parts[1]; dd = parts[2]; }
      else { dd = parts[0]; mm = parts[1]; }
      return `${mm.padStart(2,'0')}-${dd.padStart(2,'0')}` === todayMD;
    });

    if (bdays.length > 0) {
      const names = bdays.map(a => a.name);
      const title = '🎂 Birthday Wishes!';
      const body = names.length === 1
        ? `Wishing ${names[0]} a very Happy Birthday! 🎉🎈\n\nMay your day be filled with joy and happiness. The entire MINUTES team wishes you a wonderful birthday!`
        : `Wishing a very Happy Birthday to our wonderful team members:\n\n${names.map(n => '🎂 ' + n).join('\n')}\n\nMay this special day bring you all lots of joy and happiness! 🎉🎈`;

      await fsAdd('updates', {
        type: 'update',
        title,
        body,
        tag: 'birthday',
        author: 'Vendor Partner',
        image: '',
        visibility: JSON.stringify(['managers', 'sales', 'it', 'hr', 'operations']),
        createdAt: ist.toISOString()
      });
      console.log(`✅ Birthday post created for: ${names.join(', ')}`);
    } else {
      console.log('No birthdays today.');
    }
  }

  console.log('Auto-post completed!');
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
