(function (global) {
  'use strict';
  const instances = new Set();
  const remoteCache = new Map();
  let sequence = 0;
  const SETTINGS_KEY = 'hasulam.scan.settings.v1';
  const CUSTOM_KEY = 'hasulam.scan.custom.v1';
  const MAX_INPUT_CHARS = 1000000;
  const MAX_STORED_CUSTOM_CHARS = 160000;
  const DEFAULT_SETTINGS = { wpm: 120, vowels: true, trope: true, highlight: true, font: 'serif' };
  const BOOKS = [
    ['Genesis','בראשית',50], ['Exodus','שמות',40], ['Leviticus','ויקרא',27], ['Numbers','במדבר',36], ['Deuteronomy','דברים',34],
    ['Joshua','יהושע',24], ['Judges','שופטים',21], ['I Samuel','שמואל א',31], ['II Samuel','שמואל ב',24], ['I Kings','מלכים א',22], ['II Kings','מלכים ב',25],
    ['Isaiah','ישעיהו',66], ['Jeremiah','ירמיהו',52], ['Ezekiel','יחזקאל',48], ['Hosea','הושע',14], ['Joel','יואל',4], ['Amos','עמוס',9],
    ['Obadiah','עובדיה',1], ['Jonah','יונה',4], ['Micah','מיכה',7], ['Nahum','נחום',3], ['Habakkuk','חבקוק',3], ['Zephaniah','צפניה',3],
    ['Haggai','חגי',2], ['Zechariah','זכריה',14], ['Malachi','מלאכי',3], ['Psalms','תהלים',150], ['Proverbs','משלי',31], ['Job','איוב',42],
    ['Song of Songs','שיר השירים',8], ['Ruth','רות',4], ['Lamentations','איכה',5], ['Ecclesiastes','קהלת',12], ['Esther','אסתר',10],
    ['Daniel','דניאל',12], ['Ezra','עזרא',10], ['Nehemiah','נחמיה',13], ['I Chronicles','דברי הימים א',29], ['II Chronicles','דברי הימים ב',36]
  ];
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function stored(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; } }
  function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; } }
  function safeURL(value) { if(typeof value!=='string'||!value.trim())return null;try { const u = new URL(value, location.href); return /^(https?:)$/.test(u.protocol) ? u.href : null; } catch (_) { return null; } }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function hash(value) { let h = 2166136261; for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
  function graphemes(word) {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) return Array.from(new Intl.Segmenter('he', { granularity: 'grapheme' }).segment(word), v => v.segment);
    return word.match(/\P{M}\p{M}*/gu) || Array.from(word);
  }
  function tokenize(segments) {
    const words = [];
    segments.forEach((segment, segmentIndex) => {
      const matches = String(segment.text || '').match(/\S+/gu) || [];
      matches.forEach(raw => words.push({ raw, ref: String(segment.ref || ''), segmentIndex }));
    });
    return words;
  }
  function cleanDisplay(word, settings) {
    let result = word;
    if (!settings.trope) result = result.replace(/[\u0591-\u05AF]/g, '');
    // Keep maqaf (05BE), paseq (05C0) and sof pasuq (05C3) intact.
    if (!settings.vowels) result = result.replace(/[\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g, '');
    return result;
  }
  function splitWord(raw, settings) {
    const shown = cleanDisplay(raw, settings);
    const clusters = graphemes(shown);
    const letterPositions = [];
    clusters.forEach((g, i) => { if (/[\p{L}\p{N}]/u.test(g)) letterPositions.push(i); });
    const n = letterPositions.length;
    const target = n <= 1 ? 0 : n <= 5 ? 1 : n <= 9 ? 2 : n <= 13 ? 3 : 4;
    const at = n ? letterPositions[Math.min(target, n - 1)] : Math.floor(clusters.length / 2);
    const prefix = clusters.slice(0, at).join('');
    const center = clusters[at] || '';
    const suffix = clusters.slice(at + 1).join('');
    const rtl = /[\u0590-\u05FF]/.test(shown);
    return { shown, center, left: rtl ? suffix : prefix, right: rtl ? prefix : suffix, rtl, length: clusters.length };
  }
  function plainSefariaText(markup) {
    // A template stays inert, including image/iframe URLs in untrusted markup.
    const template = document.createElement('template');
    template.innerHTML = String(markup);
    template.content.querySelectorAll('sup,script,style,i.footnote').forEach(n => n.remove());
    template.content.querySelectorAll('br').forEach(n => n.replaceWith(document.createTextNode(' ')));
    return (template.content.textContent || '').replace(/\{[פס]\}/g, '').replace(/\s+/g, ' ').trim();
  }
  function validateRemoteResponse(source, data) {
    const remote = source.remoteLoad;
    const shape = remote?.expectedShape;
    const rows = source.sectionRefsByRow;
    const expectedRefs = source.expectedRefs || source.orderedSegmentRefs;
    if (!remote || !shape || !Array.isArray(rows) || !Array.isArray(expectedRefs)) throw new Error('מפת המקור המלאה אינה זמינה.');
    if (data.ref !== remote.expectedNormalizedRef) throw new Error('המקור החזיר טווח שונה מהפרשה שנבחרה.');
    if (!Array.isArray(data.warnings) || data.warnings.length) throw new Error('שירות המקורות החזיר אזהרה; הטקסט לא הופעל.');
    if (data.textDepth !== shape.textDepth || data.isSpanning !== shape.isSpanning) throw new Error('מבנה המקור השתנה. נדרשת בדיקת המיפוי.');
    const versions = Array.isArray(data.versions) ? data.versions : [];
    const version = versions.find(v => v.versionTitle === remote.versionTitle && v.isSource === true && v.actualLanguage === 'he');
    if (!version) throw new Error('הנוסח המקורי שנבחר אינו זמין.');
    const text = version.text;
    if (!Array.isArray(text) || text.length !== shape.sectionCount || rows.length !== text.length || !Array.isArray(shape.sectionLengths)) throw new Error('מספר חלקי הפרשה אינו תואם למקור המאומת.');
    const segments = [];
    for (let row = 0; row < text.length; row++) {
      if (!Array.isArray(text[row]) || !Array.isArray(rows[row]) || text[row].length !== shape.sectionLengths[row] || rows[row].length !== text[row].length) throw new Error('אחד מחלקי הפרשה חסר או שמספר פסקאותיו השתנה.');
      for (let column = 0; column < text[row].length; column++) {
        const raw = text[row][column];
        const ref = rows[row][column];
        if (typeof raw !== 'string' || !raw.trim() || typeof ref !== 'string' || !ref) throw new Error('אחת מפסקאות המקור חסרה.');
        segments.push({ ref, rawHTML: raw });
      }
    }
    if (segments.length !== source.segmentCount || segments.length !== expectedRefs.length || new Set(expectedRefs).size !== expectedRefs.length || segments.some((s,i) => s.ref !== expectedRefs[i])) throw new Error('רצף פסקאות המקור אינו תואם לפרשה המאומתת.');
    return { segments, version };
  }
  function parseImport(contents, name) {
    if (contents.length > MAX_INPUT_CHARS) throw new Error('הטקסט גדול מדי. אפשר לטעון עד מיליון תווים בכל פעם.');
    let value = contents;
    if (/\.json$/i.test(name)) {
      try { value = JSON.parse(contents); } catch (_) { throw new Error('קובץ JSON אינו תקין. אפשר לתקן אותו או לטעון קובץ TXT.'); }
    }
    const collect = (item, depth = 0) => {
      if (depth > 50) throw new Error('מבנה הקובץ עמוק מדי. בחרו רשימת טקסטים פשוטה.');
      if (typeof item === 'string') return [item];
      if (Array.isArray(item)) return item.flatMap(value => collect(value, depth + 1));
      if (item && typeof item === 'object') {
        if (typeof item.text === 'string') return [item.text];
        if (item.text !== undefined) return collect(item.text, depth + 1);
        if (item.content !== undefined) return collect(item.content, depth + 1);
        if (item.segments !== undefined) return collect(item.segments, depth + 1);
      }
      throw new Error('הקובץ צריך להכיל טקסט, רשימת טקסטים או שדה text / content.');
    };
    const lines = collect(value).join('\n').split(/\r?\n/).filter(s => s.trim());
    if (!lines.length) throw new Error('הטקסט ריק. הוסיפו מילים כדי להתחיל.');
    return lines.map((text, i) => ({ ref: name + ' · קטע ' + (i + 1), text }));
  }

  class Reader {
    constructor(container, options) {
      this.host = container;
      this.options = options || {};
      this.full = this.options.mode === 'full';
      this.id = 'hs-reader-' + (++sequence);
      this.catalog = Array.isArray(global.HASULAM_SCAN_DATA?.parashot) ? global.HASULAM_SCAN_DATA.parashot : [];
      this.parashaId = this.options.parashaId || this.catalog[0]?.id || '';
      this.sourceKey = this.options.sourceKey === 'zohar' ? 'zohar' : 'torah';
      this.inputMode = 'parasha';
      const previous = stored(SETTINGS_KEY) || {};
      this.settings = { ...DEFAULT_SETTINGS, ...previous };
      this.settings.wpm = clamp(Number(this.settings.wpm) || 120, 30, 3000);
      if (!['serif','david','sans'].includes(this.settings.font)) this.settings.font = 'serif';
      this.words = [];
      this.segments = [];
      this.index = 0;
      this.playing = false;
      this.ended = false;
      this.timer = null;
      this.request = 0;
      this.aborter = null;
      this.source = null;
      this.storageKey = null;
      this.positionDirty = false;
      this.destroyed = false;
      this.build();
      if (global.ResizeObserver) {
        this.resizeObserver = new ResizeObserver(() => { if (this.words.length && !this.destroyed) this.render(); });
        this.resizeObserver.observe(this.stage);
      }
      this.visibilityHandler = () => { if (document.hidden) this.pause(true); };
      this.pageHandler = () => this.pause(true);
      document.addEventListener('visibilitychange', this.visibilityHandler);
      global.addEventListener('pagehide', this.pageHandler);
      instances.add(this);
      if (this.full && this.options.inputMode === 'book') this.setInputMode('book');
      else this.loadParasha(false);
    }
    button(text, title, onClick, className) {
      const button = el('button', className || '', text);
      button.type = 'button';
      if (title) { button.title = title; button.setAttribute('aria-label', title); }
      button.addEventListener('click', onClick);
      return button;
    }
    field(labelText, input) {
      const wrapper = el('div', 'hs-field');
      if (!input.id) input.id = this.id + '-field-' + (++sequence);
      const label = el('label', '', labelText);
      label.htmlFor = input.id;
      wrapper.append(label, input);
      return wrapper;
    }
    build() {
      this.host.replaceChildren();
      this.root = el('section', 'hasulam-scan' + (this.full ? ' hs-full' : ''));
      this.root.dir = 'rtl';
      this.root.tabIndex = 0;
      this.root.setAttribute('aria-labelledby', this.id + '-title');
      const head = el('div', 'hs-head');
      const heading = el('div');
      heading.append(el('span', 'hs-eyebrow', 'רגע עם המילים'));
      const title = el('h2', 'hs-title', this.full ? 'מרחב הקריאה' : 'לפני שמתחילים ללמוד');
      title.id = this.id + '-title';
      heading.append(title, el('p', 'hs-intro', 'אפשר לשהות עם מילות המקור בקצב שנוח לכם. בחרו מקור, לחצו להתחלה ועצרו בכל רגע.'));
      this.parashaLabel = el('span', 'hs-parasha-label');
      head.append(heading, this.parashaLabel);
      this.inner = el('div', 'hs-inner');
      if (this.full) this.buildFullInputs();
      this.sourceRow = el('div', 'hs-source-row');
      this.sourceTabs = el('div', 'hs-source-tabs');
      this.sourceTabs.setAttribute('role','group');
      this.sourceTabs.setAttribute('aria-label','מקור הקריאה');
      this.torahButton = this.button('תנ״ך', 'קריאת הפרשה בתנ״ך', () => this.changeSource('torah'));
      this.zoharButton = this.button('זוהר', 'קריאת הפרשה בזוהר בארמית', () => this.changeSource('zohar'));
      this.sourceTabs.append(this.torahButton, this.zoharButton);
      this.sourceHint = el('p', 'hs-source-hint');
      this.sourceRow.append(this.sourceTabs, this.sourceHint);
      this.inner.append(this.sourceRow);
      this.stage = el('div', 'hs-stage');
      this.stage.setAttribute('aria-label','המילה הנוכחית');
      this.word = el('div', 'hs-word');
      this.word.setAttribute('aria-hidden','true');
      this.left = el('span', 'hs-word-left');
      this.center = el('span', 'hs-word-center');
      this.right = el('span', 'hs-word-right');
      this.word.append(this.left, this.center, this.right);
      this.stageMessage = el('p', 'hs-stage-message');
      this.wordAnnouncement = el('span', 'hs-sr-only');
      this.wordAnnouncement.setAttribute('aria-live','polite');
      this.stage.append(this.word, this.stageMessage, this.wordAnnouncement);
      this.inner.append(this.stage);
      const reference = el('div', 'hs-reference');
      this.reference = el('bdi');
      this.position = el('span', 'hs-position');
      reference.append(this.reference, this.position);
      this.progress = el('input', 'hs-progress');
      this.progress.type = 'range';
      this.progress.min = '0'; this.progress.max = '0'; this.progress.value = '0'; this.progress.step = '1';
      this.progress.setAttribute('aria-label','מיקום בטקסט');
      this.progress.addEventListener('input', () => this.seek(Number(this.progress.value)));
      this.inner.append(reference, this.progress);
      const controls = el('div', 'hs-control-row');
      const transport = el('div', 'hs-transport');
      this.playButton = this.button('התחלה ▶', 'התחלת הקריאה', () => this.toggle(), 'hs-play');
      this.playButton.setAttribute('aria-pressed','false');
      this.backButton = this.button('−10', 'חזרה עשר מילים', () => this.seek(this.index - 10), 'hs-icon-button');
      this.previousButton = this.button('›', 'המילה הקודמת', () => this.seek(this.index - 1), 'hs-icon-button');
      this.nextButton = this.button('‹', 'המילה הבאה', () => this.seek(this.index + 1), 'hs-icon-button');
      this.restartButton = this.button('↺', 'חזרה לתחילת הטקסט', () => this.seek(0), 'hs-icon-button');
      transport.append(this.playButton, this.backButton, this.previousButton, this.nextButton, this.restartButton);
      this.seekButtons = [this.backButton, this.previousButton, this.nextButton, this.restartButton];
      const speed = el('div', 'hs-speed');
      const speedLabel = el('label', '', 'מילים בדקה'); speedLabel.htmlFor = this.id + '-speed';
      this.speed = el('input'); this.speed.type = 'range'; this.speed.min = '30'; this.speed.max = '3000'; this.speed.step = '10'; this.speed.value = String(this.settings.wpm); this.speed.id = this.id + '-speed';
      this.speed.setAttribute('aria-label','מהירות הקריאה במילים בדקה');
      this.speedNumber = el('input'); this.speedNumber.type = 'number'; this.speedNumber.min = '30'; this.speedNumber.max = '3000'; this.speedNumber.step = '10'; this.speedNumber.value = String(this.settings.wpm);
      this.speedNumber.setAttribute('aria-label','הקלדת מהירות הקריאה');
      this.speed.addEventListener('input', () => this.setSpeed(this.speed.value));
      this.speedNumber.addEventListener('change', () => this.setSpeed(this.speedNumber.value));
      speed.append(speedLabel, this.speed, this.speedNumber); controls.append(transport, speed); this.inner.append(controls);
      this.status = el('p', 'hs-status'); this.status.setAttribute('role','status'); this.status.setAttribute('aria-live','polite'); this.inner.append(this.status);
      this.bookJump = el('div','hs-book-jump'); this.bookJump.hidden = true;
      this.bookJumpSelect = el('select'); this.bookJumpSelect.setAttribute('aria-label','מעבר לפרק בספר שנטען');
      this.bookJumpSelect.addEventListener('change',()=>this.seek(Number(this.bookJumpSelect.value)));
      this.bookJump.append(el('span','','מעבר לפרק'),this.bookJumpSelect); this.inner.append(this.bookJump);
      this.buildSettings();
      this.context = el('details', 'hs-context');
      this.contextSummary = el('summary', '', 'הקטע בהקשרו');
      this.contextRef = el('p', 'hs-context-ref');
      this.contextText = el('p', 'hs-context-text');
      this.context.append(this.contextSummary, this.contextRef, this.contextText);
      this.context.addEventListener('toggle', () => { if (this.context.open) { this.pause(); this.updateContext(); } });
      this.inner.append(this.context);
      this.provenance = el('details', 'hs-provenance');
      this.provenance.append(el('summary', '', 'על הטקסט ומקורו'));
      this.provenanceText = el('p'); this.provenanceLink = el('a', '', 'פתיחת המקור');
      this.provenanceLink.target = '_blank'; this.provenanceLink.rel = 'noopener noreferrer';
      this.provenance.append(this.provenanceText, this.provenanceLink); this.inner.append(this.provenance);
      const bottom = el('div', 'hs-bottom');
      bottom.append(el('span', '', 'הקריאה מתחילה רק בבחירתכם. אפשר להמשיך ללימוד בכל רגע.'));
      if (!this.full && this.options.fullReaderHref) {
        const link = el('a', '', 'למרחב הקריאה המלא ←');
        link.href = this.options.fullReaderHref;
        this.fullLink = link;
        bottom.append(link);
      } else bottom.append(el('span', '', 'מקלדת: רווח להפעלה · חצים למילה הקודמת / הבאה'));
      this.inner.append(bottom);
      this.root.append(head, this.inner); this.host.append(this.root);
      this.root.addEventListener('keydown', event => this.onKey(event));
      this.applyTypography();
    }
    buildFullInputs() {
      const wrap = el('div','hs-full-inputs');
      const tabs = el('div','hs-input-tabs'); tabs.setAttribute('role','group'); tabs.setAttribute('aria-label','סוג הטקסט');
      this.inputButtons = {};
      [['parasha','פרשת שבוע'],['book','ספרי התנ״ך'],['custom','טקסט אישי']].forEach(([key,label])=>{
        const button=this.button(label,'',()=>this.setInputMode(key)); button.setAttribute('aria-pressed',key==='parasha'?'true':'false'); this.inputButtons[key]=button; tabs.append(button);
      });
      wrap.append(tabs);
      this.parashaPanel=el('div','hs-catalog-fields');
      this.parashaSelect=el('select');
      this.catalog.forEach(p=>{const option=el('option','','פרשת '+p.heTitle); option.value=p.id; this.parashaSelect.append(option);});
      this.parashaSelect.value=this.parashaId;
      this.parashaSelect.addEventListener('change',()=>{this.parashaId=this.parashaSelect.value;this.loadParasha();});
      this.parashaPanel.append(this.field('בחירת פרשה',this.parashaSelect));
      this.bookPanel=el('div'); this.bookPanel.hidden=true;
      const bookFields=el('div','hs-book-fields');
      this.bookSelect=el('select');
      [['תורה',0,5],['נביאים',5,26],['כתובים',26,39]].forEach(([label,start,end])=>{
        const group=el('optgroup');group.label=label;
        BOOKS.slice(start,end).forEach(([name,he])=>{const opt=el('option','',he);opt.value=name;group.append(opt);});
        this.bookSelect.append(group);
      });
      this.chapterSelect=el('select');
      const bookChanged=()=>{this.cancelRequest();this.pause();this.empty('הבחירה השתנתה. לחצו על טעינת הטקסט.');};
      this.bookSelect.addEventListener('change',()=>{bookChanged();this.populateChapters();});
      this.chapterSelect.addEventListener('change',bookChanged);
      this.languageSelect=el('select'); [['he','עברית'],['en','תרגום לאנגלית']].forEach(([value,label])=>{const opt=el('option','',label);opt.value=value;this.languageSelect.append(opt);});
      this.languageSelect.addEventListener('change',bookChanged);
      this.loadBookButton=this.button('טעינת הטקסט','',()=>this.loadBook());
      this.cancelLoadButton=this.button('ביטול הטעינה','',()=>{this.cancelRequest();this.empty('הטעינה בוטלה. אפשר לבחור מקור ולהתחיל שוב.');}); this.cancelLoadButton.hidden=true;
      bookFields.append(this.field('ספר',this.bookSelect),this.field('פרק',this.chapterSelect),this.field('שפה',this.languageSelect),this.loadBookButton,this.cancelLoadButton);
      this.bookPanel.append(bookFields,el('p','hs-input-note','טעינת ספר או פרק דורשת חיבור לאינטרנט. ספר שלם נטען פרק אחר פרק.'));
      this.populateChapters();
      this.customPanel=el('div');this.customPanel.hidden=true;
      this.customText=el('textarea','hs-custom-text'); this.customText.placeholder='הדביקו כאן את הטקסט שתרצו לקרוא…'; this.customText.setAttribute('aria-label','הטקסט האישי לקריאה');this.customText.maxLength=MAX_INPUT_CHARS;
      const customActions=el('div','hs-custom-actions');
      const loadText=this.button('פתיחת הטקסט','',()=>this.loadCustom(this.customText.value,'טקסט אישי'));
      this.restoreCustom=this.button('הטקסט האחרון','טעינת הטקסט האישי האחרון שנשמר בדפדפן',()=>{const s=stored(CUSTOM_KEY);if(s&&typeof s.text==='string'){this.customText.value=s.text;this.loadCustom(s.text,s.name||'טקסט אישי');}});
      this.restoreCustom.hidden=!stored(CUSTOM_KEY);
      this.fileInput=el('input');this.fileInput.type='file';this.fileInput.accept='.txt,.json,text/plain,application/json';
      this.fileInput.addEventListener('change',()=>this.loadFile());
      const fileLabel=el('label','hs-upload-label','או טעינת קובץ TXT / JSON ');fileLabel.append(this.fileInput);
      customActions.append(loadText,this.restoreCustom,fileLabel);
      this.rememberCustom=el('input');this.rememberCustom.type='checkbox';
      const remember=el('label','hs-checkbox');remember.append(this.rememberCustom,document.createTextNode('שמירת הטקסט האישי בדפדפן הזה'));
      this.customPanel.append(this.customText,customActions,el('p','hs-input-note','הטקסט האישי נשאר בדפדפן ואינו נשלח לשרת. מקורו יוצג כטקסט אישי.'),remember);
      wrap.append(this.parashaPanel,this.bookPanel,this.customPanel);this.inner.append(wrap);
    }
    buildSettings() {
      const details=el('details','hs-settings'); details.append(el('summary','','תצוגה וקצב אישי'));
      const options=el('div','hs-options');
      for(const [key,label] of [['vowels','ניקוד'],['trope','טעמים'],['highlight','אות מיקוד מודגשת']]){
        const checkbox=el('input');checkbox.type='checkbox';checkbox.checked=!!this.settings[key];
        checkbox.addEventListener('change',()=>{this.settings[key]=checkbox.checked;save(SETTINGS_KEY,this.settings);this.render();});
        const wrapper=el('label','hs-checkbox');wrapper.append(checkbox,document.createTextNode(label));options.append(wrapper);
      }
      const font=el('select');font.setAttribute('aria-label','סגנון הכתב');
      [['serif','כתב מסורתי'],['david','כתב דוד'],['sans','כתב בהיר']].forEach(([key,label])=>{const option=el('option','',label);option.value=key;font.append(option);});
      font.value=this.settings.font;font.addEventListener('change',()=>{this.settings.font=font.value;save(SETTINGS_KEY,this.settings);this.applyTypography();this.render();});
      const fontLabel=el('label','hs-font-label','סגנון הכתב');fontLabel.append(font);options.append(fontLabel);
      details.append(options,el('p','hs-input-note','אפשר לבחור גם קצב אטי. המילים עצמן נשמרות במקור; הגדרות הניקוד והטעמים משנות רק את התצוגה.'));
      this.inner.append(details);
    }
    applyTypography() {
      this.word.className='hs-word'+(this.settings.font==='sans'?' hs-sans':this.settings.font==='david'?' hs-david':'');
      this.word.dataset.highlight=String(!!this.settings.highlight);
    }
    currentParasha() { return this.catalog.find(p=>p.id===this.parashaId); }
    changeSource(key) { this.sourceKey=key;this.loadParasha(); }
    setInputMode(mode) {
      if(this.inputMode===mode)return;
      this.cancelRequest();this.pause();this.inputMode=mode;
      Object.entries(this.inputButtons).forEach(([key,node])=>node.setAttribute('aria-pressed',String(key===mode)));
      this.parashaPanel.hidden=mode!=='parasha';this.bookPanel.hidden=mode!=='book';this.customPanel.hidden=mode!=='custom';
      this.sourceRow.hidden=mode!=='parasha';
      if(mode==='parasha')this.loadParasha();
      else {this.parashaLabel.textContent=mode==='book'?'ספרי התנ״ך':'טקסט אישי';this.empty(mode==='book'?'בחרו ספר ופרק, ואז לחצו על טעינת הטקסט.':'הדביקו טקסט או בחרו קובץ כדי להתחיל.');}
    }
    loadParasha(allowNetwork = true) {
      this.cancelRequest();this.pause();
      const p=this.currentParasha();
      if(this.fullLink){
        const url=new URL(this.options.fullReaderHref,location.href);
        url.searchParams.set('parasha',this.parashaId);
        url.searchParams.set('source',this.sourceKey);
        this.fullLink.href=url.href;
      }
      this.parashaLabel.textContent=p?'פרשת '+p.heTitle:'בחירת פרשה';
      this.torahButton.setAttribute('aria-pressed',String(this.sourceKey==='torah'));
      this.zoharButton.setAttribute('aria-pressed',String(this.sourceKey==='zohar'));
      this.sourceHint.textContent=this.sourceKey==='zohar'?'מילות הזוהר בארמית':'מילות הפרשה בתורה';
      if(!p){this.empty('הפרשה הזאת עדיין לא נמצאת במרחב הקריאה.');return;}
      const source=p[this.sourceKey];
      if(!source||source.complete!==true){this.empty('נוסח מלא מאומת של המקור הזה עדיין לא צורף לפרשה. אפשר לבחור מקור אחר או להמשיך ללימוד.');return;}
      if(source.remoteLoad){
        if(!allowNetwork){this.empty('הזוהר נבחר. לחצו על זוהר כדי לטעון אותו מספריא.');return;}
        this.loadRemoteSource(source,p.id+':'+this.sourceKey);return;
      }
      if(!Array.isArray(source.segments)||!source.segments.length){this.empty('נוסח מלא מאומת של המקור הזה עדיין לא צורף לפרשה. אפשר לבחור מקור אחר או להמשיך ללימוד.');return;}
      this.loadSource(source,p.id+':'+this.sourceKey);
    }
    async loadRemoteSource(source, identity) {
      const request = this.request;
      const remote = source.remoteLoad;
      const url = safeURL(remote.apiUrl || remote.url);
      if (!url || new URL(url).hostname !== 'www.sefaria.org') { this.empty('כתובת המקור אינה זמינה.'); return; }
      const key = url + ':' + hash(JSON.stringify(source.sectionRefsByRow || []));
      const cached = remoteCache.get(key);
      if (cached) { this.loadSource(cached, identity); return; }
      this.aborter = new AbortController();
      const signal = this.aborter.signal;
      this.empty('טוענים את מילות הזוהר לפרשה…');
      this.setStatus('הזוהר נטען ישירות מספריא. הטעינה דורשת חיבור לאינטרנט.');
      try {
        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error('שירות המקורות אינו זמין כרגע.');
        const data = await response.json();
        if (request !== this.request || this.destroyed) return;
        const validated = validateRemoteResponse(source, data);
        const segments = validated.segments.map(item => ({ ref: item.ref, text: plainSefariaText(item.rawHTML) }));
        if (segments.some(s => !s.text.trim())) throw new Error('אחת מפסקאות המקור ריקה לאחר הכנת התצוגה.');
        const loaded = { ...source, segments, versionTitle: validated.version.versionTitle, license: validated.version.license || source.license || '' };
        remoteCache.set(key, loaded);
        if (remoteCache.size > 6) remoteCache.delete(remoteCache.keys().next().value);
        this.loadSource(loaded, identity);
      } catch (error) {
        if (request !== this.request || signal.aborted || this.destroyed) return;
        this.empty('הזוהר לא נטען. אפשר ללחוץ שוב על זוהר כדי לנסות מחדש, או לבחור בתנ״ך.');
        this.setStatus(error?.message || 'בדקו את החיבור לאינטרנט ונסו שוב.', true);
      } finally {
        if (request === this.request) this.aborter = null;
      }
    }
    cancelRequest() {
      this.request++;
      if(this.aborter){this.aborter.abort();this.aborter=null;}
      if(this.cancelLoadButton)this.cancelLoadButton.hidden=true;
      if(this.loadBookButton)this.loadBookButton.disabled=false;
    }
    empty(message) {
      this.pause();this.words=[];this.segments=[];this.index=0;this.ended=false;this.source=null;this.storageKey=null;this.positionDirty=false;
      this.stageMessage.textContent=message;this.stageMessage.hidden=false;this.word.hidden=true;this.stage.dataset.empty='true';
      this.wordAnnouncement.textContent='';
      this.reference.textContent='';this.position.textContent='';this.progress.max='0';this.progress.value='0';this.progress.disabled=true;
      this.playButton.disabled=true;this.seekButtons.forEach(b=>b.disabled=true);this.context.hidden=true;this.provenance.hidden=true;this.bookJump.hidden=true;
      this.setStatus('');
    }
    loadSource(source, identity) {
      this.pause();
      if(!Array.isArray(source.segments)||source.segments.some(s=>!s||typeof s.text!=='string')){this.empty('מבנה הטקסט אינו תקין. לא ניתן להתחיל קריאה.');return;}
      const segments=source.segments.map(s=>({ref:String(s.ref||source.ref||''),text:s.text}));
      const words=tokenize(segments);
      if(!words.length){this.empty('לא נמצאו מילים במקור הזה.');return;}
      this.source=source;this.segments=segments;this.words=words;this.index=0;this.ended=false;
      const fingerprint=hash([source.versionTitle||'',...segments.map(s=>s.ref+'\u0000'+s.text)].join('\u0001'));
      this.storageKey='hasulam.scan.position.v1.'+hash(identity)+'.'+fingerprint;
      this.positionDirty=false;
      const resume=stored(this.storageKey);
      if(resume&&Number.isInteger(resume.index))this.index=clamp(resume.index,0,words.length-1);
      this.progress.max=String(words.length-1);this.progress.disabled=false;this.stageMessage.hidden=true;this.word.hidden=false;this.stage.dataset.empty='false';
      this.context.hidden=false;this.provenance.hidden=false;this.playButton.disabled=false;this.seekButtons.forEach(b=>b.disabled=false);
      this.provenanceText.textContent=[source.label||'מקור הקריאה',source.ref||'',source.versionTitle||'',source.license?'רישיון: '+source.license:''].filter(Boolean).join(' · ');
      const url=safeURL(source.sourceUrl);this.provenanceLink.hidden=!url;if(url)this.provenanceLink.href=url;else this.provenanceLink.removeAttribute('href');
      this.bookJump.hidden=true;this.render();
      this.setStatus(this.index>0?'המיקום האחרון שוחזר. הקריאה ממתינה לבחירתכם.':'מוכנים לקריאה. בחרו קצב נוח ולחצו להתחלה.');
    }
    setStatus(message,isError) {this.status.textContent=message;this.status.dataset.error=String(!!isError);}
    render() {
      this.applyTypography();
      if(!this.words.length)return;
      const token=this.words[this.index];
      const parts=splitWord(token.raw,this.settings);
      this.left.textContent=parts.left;this.center.textContent=parts.center;this.right.textContent=parts.right;
      [this.left,this.center,this.right].forEach(n=>n.dir=parts.rtl?'rtl':'ltr');
      // Fit both arms to their actual fixed-center grid slots. Total width alone
      // is insufficient for long Hebrew maqaf compounds with an uneven suffix.
      this.word.classList.remove('hs-long-word');
      const maxSize=this.root.clientWidth<600?(this.settings.font==='sans'?39:45):(this.full?70:64);
      this.word.style.fontSize=maxSize+'px';
      if(this.stage.clientWidth>0){
        let size=maxSize;
        for(let attempt=0;attempt<3;attempt++){
          let ratio=1;
          for(const side of [this.left,this.right]){
            if(!side.textContent)continue;
            const range=document.createRange();range.selectNodeContents(side);
            const painted=range.getBoundingClientRect().width;range.detach();
            if(painted>0)ratio=Math.min(ratio,Math.max(0,side.getBoundingClientRect().width-3)/painted);
          }
          if(ratio>=.995)break;
          size*=ratio*.97;
          if(size<12){
            this.left.textContent='';this.right.textContent='';this.center.textContent=parts.shown;
            this.word.classList.add('hs-long-word');size=18;break;
          }
          this.word.style.fontSize=size+'px';
        }
        this.word.style.fontSize=size+'px';
      }
      this.reference.textContent=token.ref||this.source.ref||'';
      this.position.textContent='מילה '+(this.index+1).toLocaleString('he-IL')+' מתוך '+this.words.length.toLocaleString('he-IL');
      this.progress.value=String(this.index);this.progress.setAttribute('aria-valuetext',this.position.textContent);
      if(!this.playing)this.wordAnnouncement.textContent=parts.shown;
      this.updateContext();this.updatePlayButton();
    }
    updateContext() {
      if(!this.words.length)return;
      const segment=this.segments[this.words[this.index].segmentIndex];
      if(this.context.open||!this.playing){this.contextRef.textContent=segment.ref;this.contextText.textContent=segment.text;}
    }
    updatePlayButton() {
      this.playButton.setAttribute('aria-pressed',String(this.playing));
      const text=this.playing?'השהיה Ⅱ':this.ended?'קריאה מחדש ↺':this.index>0?'המשך ▶':'התחלה ▶';
      this.playButton.textContent=text;
      this.playButton.setAttribute('aria-label',this.playing?'השהיית הקריאה':this.ended?'קריאה מחדש מההתחלה':'התחלת הקריאה');
      this.root.dataset.playing=String(this.playing);
    }
    play() {
      if(!this.words.length||this.destroyed)return;
      instances.forEach(other=>{if(other!==this)other.pause();});
      if(this.ended){this.index=0;this.ended=false;this.positionDirty=true;}
      this.context.open=false;
      this.playing=true;this.wordAnnouncement.textContent='';this.render();this.setStatus('הקריאה פועלת. אפשר להשהות בכל רגע.');this.schedule();
    }
    schedule() {
      clearTimeout(this.timer);
      if(!this.playing)return;
      const raw=this.words[this.index].raw;
      const multiplier=/[.,;:!?׃][\p{M}"'״׳)\]]*$/u.test(raw)?1.5:1;
      this.timer=setTimeout(()=>{
        if(!this.playing||this.destroyed)return;
        if(this.index>=this.words.length-1){this.ended=true;this.pause();this.setStatus('הגעתם לסיום הטקסט. אפשר לחזור לתחילתו או להמשיך ללימוד.');return;}
        this.index++;this.positionDirty=true;this.render();if(this.index%20===0)this.persist();this.schedule();
      },60000/this.settings.wpm*multiplier);
    }
    pause(quiet) {
      const wasPlaying=this.playing;this.playing=false;clearTimeout(this.timer);this.timer=null;this.persist();
      if(this.playButton)this.updatePlayButton();
      if(this.words.length){this.updateContext();this.wordAnnouncement.textContent=cleanDisplay(this.words[this.index].raw,this.settings);}
      if(wasPlaying&&!quiet&&!this.ended)this.setStatus('הקריאה מושהית. אפשר לשהות במילים או להמשיך.');
    }
    toggle() {if(this.playing)this.pause();else this.play();}
    seek(index) {if(!this.words.length)return;this.pause(true);this.ended=false;this.index=clamp(Math.floor(index),0,this.words.length-1);this.positionDirty=true;this.render();this.persist();this.setStatus('הקריאה מושהית במיקום שבחרתם.');}
    setSpeed(value) {
      const parsed=Number(value);this.settings.wpm=clamp(Number.isFinite(parsed)&&parsed>0?Math.round(parsed):120,30,3000);
      this.speed.value=String(this.settings.wpm);this.speedNumber.value=String(this.settings.wpm);save(SETTINGS_KEY,this.settings);if(this.playing)this.schedule();
    }
    persist() {if(this.positionDirty&&this.storageKey&&this.words.length){if(save(this.storageKey,{index:this.index,updatedAt:Date.now()}))this.positionDirty=false;}}
    onKey(event) {
      if(event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,select,textarea,button,a,summary,[contenteditable="true"]'))return;
      if(event.code==='Space'){event.preventDefault();this.toggle();}
      else if(event.code==='ArrowLeft'){event.preventDefault();this.seek(this.index+1);}
      else if(event.code==='ArrowRight'){event.preventDefault();this.seek(this.index-1);}
      else if(event.code==='ArrowUp'){event.preventDefault();this.setSpeed(this.settings.wpm+10);}
      else if(event.code==='ArrowDown'){event.preventDefault();this.setSpeed(this.settings.wpm-10);}
    }
    populateChapters() {
      const book=BOOKS.find(b=>b[0]===this.bookSelect.value)||BOOKS[0];
      this.chapterSelect.replaceChildren();const all=el('option','','הספר כולו');all.value='all';this.chapterSelect.append(all);
      for(let c=1;c<=book[2];c++){const opt=el('option','','פרק '+c);opt.value=String(c);this.chapterSelect.append(opt);}
      this.chapterSelect.value='1';
    }
    async loadBook() {
      this.cancelRequest();this.pause();
      const request=this.request;
      const book=BOOKS.find(b=>b[0]===this.bookSelect.value);
      const language=this.languageSelect.value;
      const chapter=this.chapterSelect.value;
      if(!book)return;
      this.aborter=new AbortController();const signal=this.aborter.signal;
      this.empty('טוענים את הטקסט מספריא…');this.loadBookButton.disabled=true;this.cancelLoadButton.hidden=false;
      const chapters=chapter==='all'?Array.from({length:book[2]},(_,i)=>i+1):[Number(chapter)];
      let version=language==='he'?"Tanach with Ta'amei Hamikra":'';let license='';const segments=[];const chapterStarts=[];
      try {
        for(let i=0;i<chapters.length;i++){
          const c=chapters[i];
          if(request!==this.request||this.destroyed)return;
          this.setStatus('טעינת '+book[1]+' · פרק '+c+' ('+(i+1)+' מתוך '+chapters.length+')');
          const ref=book[0]+' '+c;
          const params=new URLSearchParams({context:'0',pad:'0',commentary:'0'});
          if(version)params.set(language==='he'?'vhe':'ven',version);
          const response=await fetch('https://www.sefaria.org/api/texts/'+encodeURIComponent(ref)+'?'+params.toString(),{signal});
          if(!response.ok)throw new Error('שירות המקורות לא החזיר את הפרק שביקשתם.');
          const data=await response.json();
          if(request!==this.request||this.destroyed)return;
          if(data.ref!==ref)throw new Error('המקור החזיר פרק שונה מהפרק שביקשתם.');
          const content=language==='he'?data.he:data.text;
           if(data.error||!Array.isArray(content)||!content.length||content.some(v=>typeof v!=='string'||!plainSefariaText(v)))throw new Error('לא התקבל נוסח שלם במבנה הצפוי לפרק '+c+'.');
          const currentVersion=language==='he'?data.heVersionTitle:data.versionTitle;
          if(typeof currentVersion!=='string'||!currentVersion.trim())throw new Error('המקור לא החזיר זיהוי של נוסח הטקסט.');
          if(version&&currentVersion!==version)throw new Error('המקור החליף נוסח במהלך הטעינה. בחרו פרק יחיד ונסו שוב.');
          version=version||currentVersion||'';
          license=license||(language==='he'?data.heLicense:data.license)||'';
          chapterStarts.push({chapter:c,segmentIndex:segments.length});
          content.forEach((text,index)=>segments.push({ref:book[0]+' '+c+':'+(index+1),text:plainSefariaText(text)}));
        }
        if(request!==this.request||this.destroyed)return;
        const ref=book[0]+(chapter==='all'?'':' '+chapter);
        this.parashaLabel.textContent=book[1]+(chapter==='all'?' · הספר כולו':' · פרק '+chapter);
        this.loadSource({label:language==='he'?'תנ״ך — נוסח עברי':'תנ״ך — תרגום לאנגלית',ref,sourceUrl:'https://www.sefaria.org/'+encodeURIComponent(ref.replace(/ /g,'_')),versionTitle:version,license,complete:true,segments},'book:'+ref+':'+language);
        if(chapterStarts.length>1){
          this.bookJumpSelect.replaceChildren();
          chapterStarts.forEach(item=>{const index=this.words.findIndex(w=>w.segmentIndex>=item.segmentIndex);if(index<0)return;const option=el('option','','פרק '+item.chapter);option.value=String(index);this.bookJumpSelect.append(option);});
          this.bookJump.hidden=false;
        }
      } catch(error) {
        if(request!==this.request||signal.aborted||this.destroyed)return;
        this.empty('הטקסט לא נטען. בדקו את החיבור ונסו שוב.');this.setStatus(error?.message||'אירעה שגיאה בטעינה.',true);
      } finally {
        if(request===this.request){this.loadBookButton.disabled=false;this.cancelLoadButton.hidden=true;this.aborter=null;}
      }
    }
    loadCustom(contents,name) {
      this.cancelRequest();this.pause();
      try {
        const segments=parseImport(contents,name);
        this.parashaLabel.textContent='טקסט אישי';
        this.loadSource({label:'טקסט אישי — הוזן על ידיכם',ref:name,sourceUrl:'',versionTitle:'',license:'',complete:true,segments},'custom:'+name);
        if(this.rememberCustom?.checked){
          if(contents.length<=MAX_STORED_CUSTOM_CHARS){const ok=save(CUSTOM_KEY,{text:contents,name});this.restoreCustom.hidden=!ok;if(!ok)this.setStatus('הטקסט מוכן לקריאה. לא ניתן היה לשמור עותק בדפדפן.');}
          else this.setStatus('הטקסט מוכן לקריאה. בגלל גודלו, התוכן עצמו לא נשמר בדפדפן.');
        }
      } catch(error){this.empty('הטקסט לא נטען.');this.setStatus(error.message,true);}
    }
    async loadFile() {
      const file=this.fileInput.files?.[0];if(!file)return;
      this.cancelRequest();this.pause();const request=this.request;
      if(file.size>4*1024*1024){this.empty('הקובץ גדול מדי.');this.setStatus('אפשר לטעון קובץ עד 4 MiB ומיליון תווים.',true);return;}
      try {const contents=await file.text();if(request!==this.request||this.destroyed)return;this.loadCustom(contents,file.name);}
      catch(_){if(request===this.request){this.empty('לא ניתן לקרוא את הקובץ.');this.setStatus('נסו לשמור אותו כקובץ UTF-8 ולטעון מחדש.',true);}}
      finally {this.fileInput.value='';}
    }
    destroy() {
      this.pause(true);this.cancelRequest();this.destroyed=true;instances.delete(this);
      document.removeEventListener('visibilitychange',this.visibilityHandler);global.removeEventListener('pagehide',this.pageHandler);this.host.replaceChildren();
      if(this.resizeObserver)this.resizeObserver.disconnect();
    }
  }
  global.HasulamScan = Object.freeze({
    mount(container, options) { if(typeof container==='string')container=document.querySelector(container);if(!container)throw new Error('Reader mount element not found.');return new Reader(container,options||{}); },
    // Exposed for small, meaningful integration checks without requiring playback.
    tokenize, splitWord, parseImport, validateRemoteResponse
  });
})(window);
