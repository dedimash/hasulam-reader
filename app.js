/* ==========================================================================
   הסולם — תצוגה מקדימה פנימית (app.js v0.9.4)
   Screen switcher, URL hash routing, Modal Source Card & Theme persistence
   ========================================================================== */

function switchScreen(screenId) {
  const screens = document.querySelectorAll('.screen-panel');
  screens.forEach(s => s.classList.remove('active'));

  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(n => n.classList.remove('active'));

  let targetId = screenId;
  if (screenId === 'demo-madrega-02' || screenId === 'madrega02') {
    targetId = 'madrega-02';
  } else if (screenId === 'demo-madrega-03' || screenId === 'madrega03') {
    targetId = 'madrega-03';
  } else if (screenId === 'demo-madrega-04' || screenId === 'madrega04') {
    targetId = 'madrega-04';
  }

  const targetScreen = document.getElementById('screen-' + targetId);
  if (targetScreen) {
    targetScreen.classList.add('active');
  }

  const targetNav = document.getElementById('nav-' + targetId);
  if (targetNav) {
    targetNav.classList.add('active');
  }

  if (window.location.hash !== '#' + targetId) {
    window.location.hash = targetId;
  }
}

function switchMadregaTab(tabName, madregaSuffix = '') {
  const tabReader = document.getElementById(madregaSuffix ? 'madrega' + madregaSuffix + '-tab-reader' : 'madrega-tab-reader');
  const tabInspector = document.getElementById(madregaSuffix ? 'madrega' + madregaSuffix + '-tab-inspector' : 'madrega-tab-inspector');
  const btnReader = document.getElementById(madregaSuffix ? 'tab-btn-reader-' + madregaSuffix : 'tab-btn-reader');
  const btnInspector = document.getElementById(madregaSuffix ? 'tab-btn-inspector-' + madregaSuffix : 'tab-btn-inspector');

  if (!tabReader || !tabInspector) return;

  if (tabName === 'reader') {
    tabReader.style.display = 'block';
    tabInspector.style.display = 'none';
    if (btnReader) btnReader.classList.add('active');
    if (btnInspector) btnInspector.classList.remove('active');
  } else if (tabName === 'inspector') {
    tabReader.style.display = 'none';
    tabInspector.style.display = 'block';
    if (btnReader) btnReader.classList.remove('active');
    if (btnInspector) btnInspector.classList.add('active');
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.dataset.theme || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = newTheme;
  localStorage.setItem('hasulam_theme', newTheme);
  updateThemeButtonText(newTheme);
}

function updateThemeButtonText(theme) {
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.textContent = theme === 'dark' ? '🌙 מצב כהה (פעיל)' : '☀️ מצב בהיר / כהה';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('hasulam_theme') || 'light';
  document.documentElement.dataset.theme = savedTheme;
  updateThemeButtonText(savedTheme);

  const initialHash = window.location.hash.substring(1);
  if (initialHash) {
    switchScreen(initialHash);
  } else {
    switchScreen('status');
  }
});

window.addEventListener('hashchange', () => {
  let screenId = window.location.hash.substring(1) || 'status';
  if (screenId === 'demo-madrega-02' || screenId === 'madrega02') {
    screenId = 'madrega-02';
  } else if (screenId === 'demo-madrega-03' || screenId === 'madrega03') {
    screenId = 'madrega-03';
  } else if (screenId === 'demo-madrega-04' || screenId === 'madrega04') {
    screenId = 'madrega-04';
  }
  switchScreen(screenId);
});

// Source Card Modal Data Map (SSOT generated from Canonical JSON)
const SOURCE_MAP_DATA = {
  "SRC-ARI-01": {
    "author": "רבי יצחק לוריא — האר\"י",
    "work_location": "עץ חיים, שער א', ענף ב' (תע\"ס חלק א' פרק א' אות א')",
    "classification": "דברי האר\"י",
    "excerpt": "טרם שנאצלו הנאצלים ונבראו הנבראים, היה אור עליון פשוט ממלא כל המציאות",
    "attribution": "דברי האר\"י, עץ חיים, שער א' ענף ב', המובאים בראש תלמוד עשר הספירות.",
    "status": "טקסט מקור מאומת",
    "copy_role": "עותק קריאה ציבורי",
    "governed_url": "https://kabbalahmedia.info/he/sources/HujVytxA"
  },
  "SRC-TES-01": {
    "author": "רבי יהודה לייב הלוי אשלג — בעל הסולם",
    "work_location": "תלמוד עשר הספירות, חלק א', פירוש אור פנימי לפתיחת דברי האר\"י / אות א'",
    "classification": "לשון בעל הסולם",
    "excerpt": "כל חכמת הקבלה מיוסדת על ענינים רוחניים, שאינם תופסים לא מקום ולא זמן",
    "attribution": "בעל הסולם, תלמוד עשר הספירות, חלק א', אור פנימי אות א'.",
    "status": "טקסט מקור מאומת",
    "copy_role": "עותק קריאה ציבורי",
    "governed_url": "https://kabbalahmedia.info/he/events/cu/ZPAyLqOP?activeTab=transcription"
  },
  "SRC-PTICHA-01": {
    "author": "רבי יהודה לייב הלוי אשלג — בעל הסולם",
    "work_location": "פתיחה לחכמת הקבלה, אות א'",
    "classification": "לשון בעל הסולם",
    "excerpt": "מחשבת הבריאה היתה כדי להנות לנבראים",
    "attribution": "בעל הסולם, פתיחה לחכמת הקבלה, אות א'.",
    "status": "טקסט מקור מאומת",
    "copy_role": "עותק קריאה ציבורי",
    "governed_url": "https://kabbalahmedia.info/he/sources/kB3eD83I?language=he"
  },
  "SRC-PTICHA-02": {
    "author": "רבי יהודה לייב הלוי אשלג — בעל הסולם",
    "work_location": "פתיחה לחכמת הקבלה, אות א'",
    "classification": "לשון בעל הסולם",
    "excerpt": "הוא השורש של חידוש, שפירושו יציאת יש מאין",
    "attribution": "בעל הסולם, פתיחה לחכמת הקבלה, אות א'.",
    "status": "טקסט מקור מאומת",
    "copy_role": "עותק קריאה ציבורי",
    "governed_url": "https://kabbalahmedia.info/he/sources/kB3eD83I?language=he"
  },
  "SRC-PTICHA-03": {
    "author": "רבי יהודה לייב הלוי אשלג — בעל הסולם",
    "work_location": "פתיחה לחכמת הקבלה, אות א'",
    "classification": "לשון בעל הסולם",
    "excerpt": "כל חומר של הבריאה מראשה ועד סופה",
    "attribution": "בעל הסולם, פתיחה לחכמת הקבלה, אות א'.",
    "status": "טקסט מקור מאומת",
    "copy_role": "עותק קריאה ציבורי",
    "governed_url": "https://kabbalahmedia.info/he/sources/kB3eD83I?language=he"
  },
  "SRC-TES-OR-01": {
    "author": "רבי יהודה לייב הלוי אשלג — בעל הסולם",
    "work_location": "תלמוד עשר הספירות, חלק א', אור פנימי, ביאור \"אור עליון\"",
    "classification": "לשון בעל הסולם",
    "excerpt": "",
    "attribution": "בעל הסולם, תלמוד עשר הספירות, חלק א', אור פנימי, ביאור 'אור עליון'.",
    "status": "טקסט מקור מאומת",
    "copy_role": "עותק קריאה ציבורי",
    "governed_url": "https://kabbalahmedia.info/he/events/cu/ZPAyLqOP?activeTab=transcription"
  },
  "SRC-BOUNDARY-ATZMUTO-01": {
    "author": "רבי יהודה לייב הלוי אשלג — בעל הסולם",
    "work_location": "תלמוד עשר הספירות, חלק א', פרק א', אור פנימי אות ב'",
    "classification": "ביאור נתמך מקור",
    "excerpt": "אמנם בעצמותו ית', אין לנו שום מלה והגה כלל",
    "attribution": "בעל הסולם, תלמוד עשר הספירות, חלק א', פרק א', אור פנימי אות ב'.",
    "status": "טקסט מקור מאומת",
    "copy_role": "עותק קריאה ציבורי",
    "governed_url": "https://kabbalahmedia.info/he/events/cu/ZPAyLqOP?activeTab=transcription"
  },
  "SRC-M02-PTICHA-04-A": {
    "author": "רבי יהודה לייב הלוי אשלג — בעל הסולם",
    "work_location": "פתיחה לחכמת הקבלה, אות ד׳",
    "classification": "לשון בעל הסולם",
    "excerpt": "התפשטות האור והסתלקותו הוא עושה את הכלי רצוי לתפקידו.",
    "attribution": "בעל הסולם, פתיחה לחכמת הקבלה, אות ד׳.",
    "status": "טקסט מקור מאומת",
    "copy_role": "עותק קריאה ציבורי",
    "governed_url": "https://kabbalahmedia.info/he/sources/kB3eD83I?language=he"
  },
  "SRC-M02-PTICHA-04-B": {
    "author": "רבי יהודה לייב הלוי אשלג — בעל הסולם",
    "work_location": "פתיחה לחכמת הקבלה, אות ד׳",
    "classification": "לשון בעל הסולם",
    "excerpt": "ושים כאן עיניך כי הוא עמוק מכל עמוק.",
    "attribution": "בעל הסולם, פתיחה לחכמת הקבלה, אות ד׳.",
    "status": "טקסט מקור מאומת",
    "copy_role": "עותק קריאה ציבורי",
    "governed_url": "https://kabbalahmedia.info/he/sources/kB3eD83I?language=he"
  },
  "SRC-M02-OR-BAHIR-DESIRE": {
    "author": "רבי יהודה לייב הלוי אשלג — בעל הסולם",
    "work_location": "אור הבהיר, אות א׳",
    "classification": "לשון בעל הסולם",
    "excerpt": "",
    "attribution": "בעל הסולם, אור הבהיר, אות א׳.",
    "status": "מקור תמיכה מושגי",
    "copy_role": "עותק קריאה ציבורי",
    "governed_url": "https://kabbalahmedia.info/he/sources/B7htYIL6"
  },
  "SRC-M03-TES-P1-OP-4STAGES": {
    "author": "רבי יהודה לייב הלוי אשלג — בעל הסולם",
    "work_location": "תלמוד עשר הספירות, חלק א׳, פרק א׳, אור פנימי, אות נ׳",
    "classification": "לשון בעל הסולם",
    "excerpt": "ד׳ מדרגות מחויב אור העליון להתפשט עד שמגלה בנאצל את הרצון לקבל הזה על שלימותו הקבועה וקיימת.",
    "attribution": "בעל הסולם, תלמוד עשר הספירות, חלק א׳, פרק א׳, אור פנימי, אות נ׳.",
    "status": "טקסט מקור מאומת",
    "copy_role": "עותק קריאה ציבורי",
    "governed_url": "https://kabbalahmedia.info/he/sources/7scSATcZ"
  },
  "SRC-M03-TES-P1-OP-LONGING": {
    "author": "רבי יהודה לייב הלוי אשלג — בעל הסולם",
    "work_location": "תלמוד עשר הספירות, חלק א׳, פרק א׳, אור פנימי, אות נ׳",
    "classification": "לשון בעל הסולם",
    "excerpt": "הנאצל צריך להשתוקק לקבלת השפע",
    "attribution": "בעל הסולם, תלמוד עשר הספירות, חלק א׳, פרק א׳, אור פנימי, אות נ׳.",
    "status": "טקסט מקור מאומת",
    "copy_role": "עותק קריאה ציבורי",
    "governed_url": "https://kabbalahmedia.info/he/sources/7scSATcZ"
  },
  "SRC-M03-TES-P1-OP-ABCD": {
    "author": "רבי יהודה לייב הלוי אשלג — בעל הסולם",
    "work_location": "תלמוד עשר הספירות, חלק א׳, הסתכלות פנימית, אות ל׳–ל״א",
    "classification": "לשון בעל הסולם",
    "excerpt": "",
    "attribution": "בעל הסולם, תלמוד עשר הספירות, חלק א׳, הסתכלות פנימית, אות ל׳–ל״א.",
    "status": "מקור תמיכה מושגי",
    "copy_role": "עותק קריאה ציבורי",
    "governed_url": "https://kabbalahmedia.info/he/sources/rhRuFdIP"
  },
  "SRC-M03-TES-P2-ZA-TIFERET": {
    "author": "רבי יהודה לייב הלוי אשלג — בעל הסולם",
    "work_location": "תלמוד עשר הספירות, חלק ב׳, הסתכלות פנימית, אות י״ג",
    "classification": "לשון בעל הסולם",
    "excerpt": "",
    "attribution": "בעל הסולם, תלמוד עשר הספירות, חלק ב׳, הסתכלות פנימית, אות י״ג.",
    "status": "מקור תמיכה מושגי",
    "copy_role": "עותק קריאה ציבורי",
    "governed_url": "https://kabbalahmedia.info/he/sources/PtDrdt9v"
  },
  "SRC-M03-TES-P1-OP-HOCHMA-HASSADIM": {
    "author": "רבי יהודה לייב הלוי אשלג — בעל הסולם",
    "work_location": "תלמוד עשר הספירות, חלק א׳, הסתכלות פנימית, אות ל׳–ל״א",
    "classification": "לשון בעל הסולם",
    "excerpt": "",
    "attribution": "בעל הסולם, תלמוד עשר הספירות, חלק א׳, הסתכלות פנימית, אות ל׳–ל״א.",
    "status": "מקור תמיכה מושגי",
    "copy_role": "עותק קריאה ציבורי",
    "governed_url": "https://kabbalahmedia.info/he/sources/rhRuFdIP"
  },
  "SRC-M03-TES-P1-OP-FORM-DISTANCE": {
    "author": "רבי יהודה לייב הלוי אשלג — בעל הסולם",
    "work_location": "תלמוד עשר הספירות, חלק א׳, פרק א׳, אור פנימי, אות ל׳",
    "classification": "לשון בעל הסולם",
    "excerpt": "",
    "attribution": "בעל הסולם, תלמוד עשר הספירות, חלק א׳, פרק א׳, אור פנימי, אות ל׳.",
    "status": "מקור תמיכה מושגי",
    "copy_role": "עותק קריאה ציבורי",
    "governed_url": "https://kabbalahmedia.info/he/sources/7scSATcZ"
  },
  "SRC-M04-MAAMAR-SIYUM-HAZOHAR-FORM-DVEKUT": {
    "author": "רבי יהודה לייב הלוי אשלג — בעל הסולם",
    "work_location": "מאמר לסיום הזוהר, מאמר לסיום הזוהר",
    "classification": "לשון בעל הסולם",
    "excerpt": "השואת הצורה, שיש בין שני רוחניים, מובנת לנו כדביקות. ושינוי הצורה, בין שני רוחניים, מובן לנו כפירוד.",
    "attribution": "בעל הסולם, מאמר לסיום הזוהר.",
    "status": "טקסט מקור מאומת",
    "copy_role": "עותק קריאה ציבורי",
    "governed_url": "https://kabbalahmedia.info/he/sources/VyDjtKiN"
  },
  "SRC-M04-MAAMAR-SIYUM-HAZOHAR-MIDOT": {
    "author": "רבי יהודה לייב הלוי אשלג — בעל הסולם (מביא את חז״ל)",
    "work_location": "מאמר לסיום הזוהר, מאמר לסיום הזוהר",
    "classification": "לשון בעל הסולם",
    "excerpt": "מה הוא רחום, אף אתה רחום. מה הוא חנון, אף אתה חנון.",
    "attribution": "בעל הסולם (בשם חז״ל), מאמר לסיום הזוהר.",
    "status": "טקסט מקור מאומת (חז״ל אצל בעל הסולם)",
    "copy_role": "עותק קריאה ציבורי",
    "governed_url": "https://kabbalahmedia.info/he/sources/VyDjtKiN"
  },
  "SRC-M04-PTICHA-FORM-DISTANCE": {
    "author": "רבי יהודה לייב הלוי אשלג — בעל הסולם",
    "work_location": "פתיחה לחכמת הקבלה, אות י׳",
    "classification": "לשון בעל הסולם",
    "excerpt": "",
    "attribution": "בעל הסולם, פתיחה לחכמת הקבלה, אות י׳.",
    "status": "מקור תמיכה מושגי",
    "copy_role": "עותק קריאה ציבורי",
    "governed_url": "https://kabbalahmedia.info/he/sources/kB3eD83I"
  }
};

function openSourceCard(anchorId) {
  const data = SOURCE_MAP_DATA[anchorId];
  if (!data) return;

  document.getElementById('scModalTitle').textContent = 'כרטיס מקור מבוקר — ' + anchorId;
  document.getElementById('scModalAuthor').textContent = data.author;
  document.getElementById('scModalLocation').textContent = data.work_location;
  document.getElementById('scModalClassification').textContent = data.classification;
  document.getElementById('scModalExcerpt').textContent = data.excerpt;
  document.getElementById('scModalAttribution').textContent = data.attribution;
  document.getElementById('scModalCopyRole').textContent = data.copy_role || 'עותק קריאה ציבורי';
  document.getElementById('scModalStatus').textContent = 'אימות: ' + (data.status || 'טקסט מקור מאומת');

  const actionBtn = document.getElementById('scModalActionButton');
  if (data.governed_url) {
    actionBtn.href = data.governed_url;
    actionBtn.style.display = 'inline-block';
  } else {
    actionBtn.style.display = 'none';
  }

  document.getElementById('sourceCardModal').classList.add('show');
}

function closeSourceCard() {
  document.getElementById('sourceCardModal').classList.remove('show');
}
