let parsedAll = [];
let allData = [];
let currentFilter = "all";
let uploadedFiles = [];
let clubKeywords = ["金城土城", "金城土城館"];
let customState = {
  title: "吃飯統計",
  columns: [
    { key: "name", label: "姓名" },
    { key: "join", label: "參加" },
    { key: "fee", label: "金額", money: true },
    { key: "note", label: "備註" }
  ],
  rows: [{ name: "", join: "", fee: "", note: "" }]
};

const NAME_STOP = new Set([
  "男子", "女子", "男生", "女生", "選手", "姓名", "道館", "單位",
  "場次", "場地", "組別", "項目", "紅方", "藍方", "品勢", "對打",
  "序號", "比賽", "錦標賽", "代表", "教練", "裁判", "個人", "團體",
  "指定", "自選", "對練", "公開", "一般", "社會", "大專", "國小",
  "國中", "高中", "幼兒", "量級", "黑帶", "紅帶", "級別", "青方"
]);

const sampleData = `1.黃羽希 幼兒白帶A 102紅103紅馬步正拳
2.蔡葦儒 幼兒藍137紅138紅 三章
3.張紘駿國小低年級藍帶B142紅144青
4.江曼聿 國小低年級藍帶A150青151紅 三章
5.鍾昀蓁 國小低年級藍帶B 152紅154青三章
6.簡鈞浤 國小幼兒黃帶A202紅203紅一章`;


const sourceData = document.getElementById("sourceData");
const clubName = document.getElementById("clubName");
const resultArea = document.getElementById("resultArea");
const resultBody = document.getElementById("resultBody");
const mobileCards = document.getElementById("mobileCards");
const emptyMessage = document.getElementById("emptyMessage");
const keywordTagsEl = document.getElementById("keywordTags");
const keywordInput = document.getElementById("keywordInput");
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const fileListEl = document.getElementById("fileList");
const parseStatus = document.getElementById("parseStatus");
const analyzeBtn = document.getElementById("analyzeBtn");
const groupChips = document.getElementById("groupChips");
const groupModal = document.getElementById("groupModal");
const modalBody = document.getElementById("modalBody");
const modalTitle = document.getElementById("modalTitle");
const playerNamesEl = document.getElementById("playerNames");
const filterEnabledEl = document.getElementById("filterEnabled");

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
}


function loadSavedSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("tkd_sys_settings") || "null");
    if (!saved) return;
    if (saved.competitionName) {
      document.getElementById("competitionName").value = saved.competitionName;
    }
    if (saved.clubName) clubName.value = saved.clubName;
    if (Array.isArray(saved.keywords) && saved.keywords.length) {
      clubKeywords = saved.keywords;
    }
    if (saved.playerNames && playerNamesEl) playerNamesEl.value = saved.playerNames;
    if (typeof saved.filterEnabled === "boolean" && filterEnabledEl) {
      filterEnabledEl.checked = saved.filterEnabled;
    }
    if (saved.customState) customState = saved.customState;
  } catch (error) {
    /* ignore */
  }
}

function saveSettings() {
  localStorage.setItem("tkd_sys_settings", JSON.stringify({
    competitionName: document.getElementById("competitionName").value,
    clubName: clubName.value,
    keywords: clubKeywords,
    playerNames: playerNamesEl ? playerNamesEl.value : "",
    filterEnabled: filterEnabledEl ? filterEnabledEl.checked : true,
    customState
  }));
}

function renderKeywords() {
  keywordTagsEl.innerHTML = "";
  clubKeywords.forEach((word, index) => {
    const tag = document.createElement("span");
    tag.className = "keyword-tag";
    tag.innerHTML = `${escapeHTML(word)} <button type="button" aria-label="移除">×</button>`;
    tag.querySelector("button").addEventListener("click", () => {
      clubKeywords.splice(index, 1);
      saveSettings();
      renderKeywords();
    });
    keywordTagsEl.appendChild(tag);
  });
}

function addKeyword(raw) {
  const word = String(raw || "").trim();
  if (!word) return;
  if (clubKeywords.some((item) => item === word)) return;
  clubKeywords.push(word);
  saveSettings();
  renderKeywords();
}

keywordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === ",") {
    event.preventDefault();
    addKeyword(keywordInput.value.replace(/,$/, ""));
    keywordInput.value = "";
  }
  if (event.key === "Backspace" && !keywordInput.value && clubKeywords.length) {
    clubKeywords.pop();
    saveSettings();
    renderKeywords();
  }
});

clubName.addEventListener("change", () => {
  addKeyword(clubName.value);
  saveSettings();
});

document.getElementById("competitionName").addEventListener("change", saveSettings);

loadSavedSettings();
renderKeywords();


document.getElementById("loadSampleBtn").addEventListener("click", () => {
  sourceData.value = sampleData;
});

document.getElementById("clearBtn").addEventListener("click", () => {
  sourceData.value = "";
  uploadedFiles = [];
  parsedAll = [];
  allData = [];
  renderFileList();
  resultArea.classList.add("hidden");
  parseStatus.classList.add("hidden");
});


dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    fileInput.click();
  }
});

["dragenter", "dragover"].forEach((type) => {
  dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((type) => {
  dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragover");
  });
});

dropZone.addEventListener("drop", (event) => {
  addFiles(event.dataTransfer.files);
});

fileInput.addEventListener("change", () => {
  addFiles(fileInput.files);
  fileInput.value = "";
});

function addFiles(fileList) {
  const allowed = /\.(pdf|docx|xlsx|xls|csv|txt)$/i;
  Array.from(fileList || []).forEach((file) => {
    if (/\.doc$/i.test(file.name) && !/\.docx$/i.test(file.name)) {
      alert(`舊版 Word（.doc）無法在瀏覽器直接解析。\n請另存成 .docx，或把內容貼到下方文字框。`);
      return;
    }
    if (!allowed.test(file.name)) {
      alert(`不支援的檔案：${file.name}\n請使用 PDF、Word(.docx) 或 Excel。`);
      return;
    }
    if (uploadedFiles.some((item) => item.name === file.name && item.size === file.size)) {
      return;
    }
    uploadedFiles.push(file);
  });
  renderFileList();
}

function renderFileList() {
  fileListEl.innerHTML = "";
  uploadedFiles.forEach((file, index) => {
    const chip = document.createElement("span");
    chip.className = "file-chip";
    chip.innerHTML = `
      ${escapeHTML(file.name)}
      <small>${formatSize(file.size)}</small>
      <button type="button" aria-label="移除">×</button>
    `;
    chip.querySelector("button").addEventListener("click", (event) => {
      event.stopPropagation();
      uploadedFiles.splice(index, 1);
      renderFileList();
    });
    fileListEl.appendChild(chip);
  });
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}


analyzeBtn.addEventListener("click", async () => {
  const raw = sourceData.value.trim();
  if (!raw && uploadedFiles.length === 0) {
    alert("請先上傳檔案，或貼上賽程資料");
    return;
  }

  analyzeBtn.disabled = true;
  setStatus("正在解析檔案，請稍候…");

  try {
    const collected = [];

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      setStatus(`正在解析（${i + 1}/${uploadedFiles.length}）：${file.name}`);
      const items = await parseFile(file);
      collected.push(...items);
    }

    if (raw) {
      collected.push(...parseInput(raw));
    }

    parsedAll = dedupeItems(collected.map(enrichItem)).filter((item) => item.player !== "輪空");
    attachGroups(parsedAll);
    inferOpponents(parsedAll);
    parsedAll.forEach((item) => {
      delete item._src;
      if (!item.boutStyle) item.boutStyle = isOrderStyle(item) ? "order" : "bracket";
      resolveCourt(item);
    });

    const notesOnly = raw && looksLikeCoachNotes(raw) && uploadedFiles.length === 0;
    const filterOn = filterEnabledEl ? filterEnabledEl.checked : true;

    if (notesOnly || !filterOn) {
      allData = parsedAll.slice();
    } else {
      allData = parsedAll.filter((item) => itemMatchesFilter(item));
    }

    allData.sort(sortMatches);

    currentFilter = "all";
    document.querySelectorAll(".filter").forEach((btn) => btn.classList.remove("active"));
    document.querySelector('[data-filter="all"]').classList.add("active");
    document.getElementById("searchPlayer").value = "";

    resultArea.classList.remove("hidden");
    updateStats();
    render();

    const scannedHint = uploadedFiles.some((file) => /\.pdf$/i.test(file.name)) && parsedAll.length === 0
      ? " 若是掃描型 PDF，裡面沒有可選文字，請改貼文字或用 Word/Excel。"
      : "";

    setStatus(
      parsedAll.length && !allData.length
        ? `檔案裡有 ${parsedAll.length} 筆，但用道館名稱沒對到人。可點下方「改用學員名單找人」。${scannedHint}`
        : `完成：檔案裡共 ${parsedAll.length} 筆，目前顯示 ${allData.length} 筆。請往下看出場順序。${scannedHint}`
    );

    if (!allData.length) {
      resultArea.classList.remove("hidden");
    }
  } catch (error) {
    setStatus("解析失敗：" + error.message, true);
    alert("資料無法解析：\n" + error.message);
  } finally {
    analyzeBtn.disabled = false;
  }
});

function setStatus(text, isError) {
  parseStatus.classList.remove("hidden");
  parseStatus.classList.toggle("error", Boolean(isError));
  parseStatus.textContent = text;
}

function getActiveKeywords() {
  const fromTags = clubKeywords.map((item) => item.trim()).filter(Boolean);
  const fromName = clubName.value.trim();
  const list = fromTags.length ? fromTags : (fromName ? [fromName] : []);
  return [...new Set(list)];
}


async function parseFile(file) {
  const name = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (name.endsWith(".pdf")) {
    const text = await extractPdfText(buffer);
    if (!text.trim()) {
      throw new Error(`${file.name} 幾乎沒有文字，可能是掃描檔`);
    }
    return parseInput(text);
  }

  if (name.endsWith(".docx")) {
    if (!window.mammoth) throw new Error("Word 解析套件尚未載入，請確認網路連線");
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return parseInput(result.value || "");
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
    if (!window.XLSX) throw new Error("Excel 解析套件尚未載入，請確認網路連線");
    if (name.endsWith(".csv")) {
      const text = new TextDecoder("utf-8").decode(buffer);
      return parseInput(text);
    }
    const workbook = XLSX.read(buffer, { type: "array" });
    const items = [];
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
      items.push(...parseGrid(rows));
    });
    return items;
  }

  if (name.endsWith(".txt")) {
    const text = new TextDecoder("utf-8").decode(buffer);
    return parseInput(text);
  }

  throw new Error(`不支援的檔案：${file.name}`);
}

async function extractPdfText(buffer) {
  if (!window.pdfjsLib) {
    throw new Error("PDF 解析套件尚未載入，請確認網路連線");
  }

  const data = new Uint8Array(buffer);
  const options = {
    data,
    cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/",
    cMapPacked: true
  };

  let pdf;
  try {
    pdf = await pdfjsLib.getDocument(options).promise;
  } catch (error) {
    pdf = await pdfjsLib.getDocument({ ...options, disableWorker: true }).promise;
  }

  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    setStatus(`正在讀取 PDF 第 ${i}/${pdf.numPages} 頁`);
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(contentToText(content));
  }

  return pages.join("\n\n");
}

function contentToText(content) {
  const items = (content.items || []).filter((item) => item.str != null && item.str !== "");
  if (!items.length) return "";

  const sorted = items.slice().sort((a, b) => {
    const yA = a.transform ? a.transform[5] : 0;
    const yB = b.transform ? b.transform[5] : 0;
    if (Math.abs(yA - yB) > 4) return yB - yA;
    const xA = a.transform ? a.transform[4] : 0;
    const xB = b.transform ? b.transform[4] : 0;
    return xA - xB;
  });

  const lines = [];
  let currentY = null;
  let current = [];

  sorted.forEach((item) => {
    const y = item.transform ? item.transform[5] : 0;
    const x = item.transform ? item.transform[4] : 0;
    if (currentY === null || Math.abs(y - currentY) <= 4) {
      current.push({ x, str: item.str });
      currentY = currentY === null ? y : currentY;
    } else {
      lines.push(joinLine(current));
      current = [{ x, str: item.str }];
      currentY = y;
    }
  });

  if (current.length) lines.push(joinLine(current));
  return lines.join("\n");
}

function joinLine(parts) {
  const sorted = parts.slice().sort((a, b) => a.x - b.x);
  let text = sorted[0].str;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].x - sorted[i - 1].x;
    text += gap > 18 ? "\t" : (/\s$/.test(text) ? "" : " ");
    text += sorted[i].str;
  }
  return text.replace(/[ \t]+/g, " ").trim();
}


function parseInput(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];

  if (looksLikeCoachNotes(text)) {
    return parseCoachNotes(text);
  }

  if (/比賽組別/.test(text) && /籤號/.test(text) && /編號/.test(text)) {
    const booklet = parseOrderBooklet(text);
    if (booklet.length) return booklet;
  }

  if (/MATCH LIST|組別量級/.test(text)) {
    const list = parseMatchList(text);
    if (list.length) return list;
  }

  const sequentialPoomsae = /品勢出場順序表|第一品勢|第二品勢/.test(text)
    || (/場\s*次/.test(text) && /籤號/.test(text) && /品勢/.test(text) && !/編號/.test(text));
  const bracketPoomsae = /比賽組別:\s*P/i.test(text) && /編號/.test(text);
  if (sequentialPoomsae && !bracketPoomsae) {
    const order = parsePoomsaeOrderTable(text);
    if (order.length) return order;
  }

  if (/比賽組別/.test(text) && /籤號/.test(text) && /(公斤|量級)/.test(text)) {
    const loose = parseLooseBracket(text);
    if (loose.length) return loose;
  }

  if (/比賽組別/.test(text) && /籤號/.test(text)) {
    const booklet = parseOrderBooklet(text);
    if (booklet.length) return booklet;
  }

  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      return parseJSON(text);
    } catch (error) {
      return parseSmartText(text);
    }
  }

  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length >= 2 && looksLikeHeader(splitLoose(lines[0]))) {
    return parseTable(text);
  }

  return parseSmartText(text);
}

function parseOrderBooklet(raw) {
  const text = String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[：]/g, ":")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")");

  const lines = text.split(/\n/).map((line) => line.replace(/[ \t]+/g, " ").trim()).filter((line) => {
    return line && !/^=====/.test(line) && !/^籤號/.test(line);
  });

  const items = [];
  let court = "";
  let sectionType = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^品勢$/.test(line)) {
      sectionType = "品勢";
      continue;
    }
    if (/^(對打|對練|競技)$/.test(line)) {
      sectionType = "對打";
      continue;
    }

    const courtMatch = readCourtLine(line);
    if (courtMatch) {
      court = courtMatch;
      continue;
    }

    const header = parseGroupHeader(line);
    if (!header) continue;
    if (!header.type) header.type = sectionType;
    if (header.type === "對練" || header.type === "競技") header.type = "對打";
    header.court = court;
    header.boutStyle = "bracket";

    const block = [];
    let j = i + 1;
    while (j < lines.length && block.length < 7) {
      const next = lines[j];
      if (/^比賽組別/.test(next) || /^(品勢|對打|對練)$/.test(next) || /^第.+場地$/.test(next)) {
        break;
      }
      if (/^[1-4](\s|$)/.test(next) || /^(X|\d{2,4})$/.test(next)) {
        block.push(next);
      }
      j += 1;
    }

    items.push(...parseBracketBlock(header, block));
    i = j - 1;
  }

  return items;
}

function parseGroupHeader(line) {
  const match = line.match(/^比賽組別:\s*([A-Za-z0-9]+)\s*(.+)$/);
  if (!match) return null;

  const groupCode = match[1];
  let rest = match[2].trim();
  const sizeMatch = rest.match(/(\d+)\s*人\s*$/);
  const groupSize = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;
  rest = rest.replace(/(\d+)\s*人\s*$/, "").trim();

  let eventName = "";
  const dual = extractDualPoomsae(rest);
  if (dual.eventName) {
    eventName = dual.eventName;
    rest = rest.replace(/第一品勢.*$/, "").replace(/品勢:\s*.+$/, "").trim();
  } else {
    const eventMatch = rest.match(/品勢:\s*(.+)$/);
    if (eventMatch) {
      eventName = eventMatch[1].trim();
      rest = rest.replace(/品勢:\s*.+$/, "").trim();
    }
  }

  const type = /^P/i.test(groupCode) ? "品勢" : /^K/i.test(groupCode) ? "對打" : "";
  return {
    groupCode,
    division: rest,
    eventName,
    event1: dual.event1 || "",
    event2: dual.event2 || "",
    groupSize,
    type,
    weightClass: extractWeight(rest),
    belt: extractBelt(rest),
    ageGroup: extractAgeGroup(rest),
    gender: extractGender(rest)
  };
}

function parseBracketBlock(header, block) {
  const [line1, m14, line4, mFinal, line3, m32, line2] = block;
  const seeds = {
    1: parseSeedLine(line1, header),
    2: parseSeedLine(line2, header),
    3: parseSeedLine(line3, header),
    4: parseSeedLine(line4, header)
  };

  applyBracketLogic(seeds, m14, m32, mFinal);

  const members = [1, 2, 3, 4].map((n) => seeds[n]).filter(Boolean);
  members.forEach((item) => {
    item.groupSize = header.groupSize || members.length;
    item.groupCode = header.groupCode;
    item.boutStyle = header.boutStyle || "bracket";
  });
  return members;
}

function parseSeedLine(line, header) {
  if (!line || /^[1-9]\d?$/.test(line.trim())) return null;
  const match = String(line).trim().match(/^([1-9]\d?)\s+(.+)$/);
  if (!match) return null;

  let rest = match[2].trim().replace(/\|/g, " ").replace(/\s+/g, " ");
  let playerId = "";
  const idMatch = rest.match(/^(.*?)\s+(\d{4,8})$/);
  if (idMatch) {
    rest = idMatch[1].trim();
    playerId = idMatch[2];
  }

  const split = splitClubPlayer(rest) || { club: "", player: rest.replace(/\s+/g, "") };
  if (!split.player || split.player.length < 2) return null;

  return enrichItem({
    player: split.player.replace(/\s+/g, ""),
    club: split.club,
    type: header.type || "",
    division: header.division || "",
    court: header.court || "",
    matchNo: header.matchNo || "",
    opponent: "",
    opponentClub: "",
    weightClass: header.weightClass || "",
    belt: header.belt || "",
    eventName: header.eventName || "",
    event1: header.event1 || "",
    event2: header.event2 || "",
    ageGroup: header.ageGroup || "",
    gender: header.gender || "",
    color: "",
    seed: parseInt(match[1], 10),
    playerId,
    groupCode: header.groupCode,
    groupSize: header.groupSize,
    nextMatchNo: "",
    nextColor: "",
    nextOpponentHint: "",
    bye: false,
    boutStyle: header.boutStyle || ""
  });
}

function splitClubPlayer(middle) {
  const cleaned = String(middle || "").replace(/\*/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  const clubFirst = cleaned.match(/^(.+?(?:分館|中心|國小|國中|高中|小學|協會|跆訓|跆拳|道館|館|隊|團))\s+(.+)$/);
  if (clubFirst) {
    return {
      club: clubFirst[1].trim(),
      player: clubFirst[2].replace(/\s+/g, "")
    };
  }

  const parts = cleaned.split(" ");
  if (parts.length < 2) return null;
  return {
    club: parts.slice(0, -1).join(""),
    player: parts[parts.length - 1]
  };
}

function winnerHint(players, matchNo) {
  const list = (players || []).filter(Boolean);
  if (!list.length) return "未提及";
  if (list.length === 1) return `${list[0].player}（${list[0].club || "未提及"}）`;
  const names = list.map((item) => item.player).join("／");
  if (matchNo && matchNo !== "X") return `場次${matchNo}勝者（${names}）`;
  return names;
}

function applyPair(upper, lower, matchNo) {
  if (!upper || !lower || !matchNo || matchNo === "X") return false;
  upper.matchNo = matchNo;
  upper.color = "青方";
  upper.opponent = lower.player;
  upper.opponentClub = lower.club;
  upper.bye = false;
  lower.matchNo = matchNo;
  lower.color = "紅方";
  lower.opponent = upper.player;
  lower.opponentClub = upper.club;
  lower.bye = false;
  return true;
}

function applyBracketLogic(seeds, m14, m32, mFinal) {
  const s1 = seeds[1];
  const s2 = seeds[2];
  const s3 = seeds[3];
  const s4 = seeds[4];
  const top = [s1, s4].filter(Boolean);
  const bot = [s3, s2].filter(Boolean);
  const finalNo = mFinal && mFinal !== "X" ? mFinal : "";

  applyPair(s1, s4, m14);
  applyPair(s3, s2, m32);

  const twoPersonFinal = s1 && s2 && !s3 && !s4 && finalNo;
  if (twoPersonFinal) {
    applyPair(s1, s2, finalNo);
    s1.nextMatchNo = "";
    s1.nextColor = "";
    s1.nextOpponentHint = "";
    s2.nextMatchNo = "";
    s2.nextColor = "";
    s2.nextOpponentHint = "";
    return;
  }

  top.forEach((item) => {
    if (!item.matchNo && finalNo) {
      item.bye = true;
      item.opponent = item.opponent || "輪空";
      item.nextMatchNo = finalNo;
      item.nextColor = "青方";
      item.nextOpponentHint = winnerHint(bot, m32);
      return;
    }
    if (finalNo) {
      item.nextMatchNo = finalNo;
      item.nextColor = "青方";
      item.nextOpponentHint = winnerHint(bot, m32);
    }
  });

  bot.forEach((item) => {
    if (!item.matchNo && finalNo) {
      item.bye = true;
      item.opponent = item.opponent || "輪空";
      item.nextMatchNo = finalNo;
      item.nextColor = "紅方";
      item.nextOpponentHint = winnerHint(top, m14);
      return;
    }
    if (finalNo) {
      item.nextMatchNo = finalNo;
      item.nextColor = "紅方";
      item.nextOpponentHint = winnerHint(top, m14);
    }
  });
}

function parseJSON(raw) {
  const json = JSON.parse(raw);
  let list;
  if (Array.isArray(json)) list = json;
  else if (Array.isArray(json.matches)) list = json.matches;
  else if (Array.isArray(json.players)) list = json.players;
  else throw new Error("JSON 找不到 matches 或 players");
  return list.map(normalizeItem);
}

function parseGrid(rows) {
  const cleaned = rows
    .map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? "").trim()) : []))
    .filter((row) => row.some((cell) => cell));

  if (!cleaned.length) return [];

  if (looksLikeHeader(cleaned[0])) {
    const headers = cleaned[0];
    return cleaned.slice(1).map((values) => {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      return normalizeItem(row);
    });
  }

  return parseSmartText(cleaned.map((row) => row.join("\t")).join("\n"));
}

function parseTable(raw) {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) throw new Error("資料至少需要標題列與一筆資料");

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = splitCSVLine(lines[0], delimiter);
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i], delimiter);
    const row = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || "";
    });
    result.push(normalizeItem(row));
  }

  return result;
}

function splitLoose(line) {
  if (line.includes("\t")) return line.split("\t").map((item) => item.trim());
  if (line.includes(",")) return splitCSVLine(line, ",");
  return line.split(/\s{2,}/).map((item) => item.trim());
}

function looksLikeHeader(cells) {
  const joined = cells.join(" ");
  return /(選手|姓名|道館|單位|組別|場次|對手|player|name|club|division)/i.test(joined);
}

function splitCSVLine(line, delimiter) {
  if (delimiter === "\t") return line.split("\t");

  const result = [];
  let current = "";
  let insideQuote = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') insideQuote = !insideQuote;
    else if (char === "," && !insideQuote) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}


function parseSmartText(raw) {
  const text = preprocessText(raw);
  const lines = text.split(/\n/).map((line) => line.trim()).filter((line) => {
    return line && !/^[-_=]{3,}$/.test(line);
  });

  const ctx = emptyContext();
  const items = [];
  let pendingRed = null;

  lines.forEach((line) => {
    if (/^(姓名|選手|道館|單位|場次|序|紅方|藍方)$/.test(line)) return;

    applyContextFromLine(line, ctx);

    const red = line.match(/紅方\s*[:：]?\s*(.+)/);
    const blue = line.match(/藍方\s*[:：]?\s*(.+)/);

    if (red && !blue) {
      pendingRed = personFromFragment(red[1], ctx);
      return;
    }

    if (blue) {
      const bluePerson = personFromFragment(blue[1], ctx);
      if (pendingRed && bluePerson) {
        linkOpponents(pendingRed, bluePerson);
        pushPeople(items, pendingRed, bluePerson);
      } else if (bluePerson) {
        pushPeople(items, bluePerson);
      }
      pendingRed = null;
      return;
    }

    const vsParts = splitVs(line);
    if (vsParts) {
      const left = personFromFragment(vsParts[0], ctx);
      const right = personFromFragment(vsParts[1], ctx);
      if (left && right) {
        linkOpponents(left, right);
        pushPeople(items, left, right);
        return;
      }
    }

    const pairs = extractPersonClubPairs(line);
    if (pairs.length >= 2 && isFightContext(ctx)) {
      const first = makeItem(pairs[0], ctx);
      const second = makeItem(pairs[1], ctx);
      linkOpponents(first, second);
      pushPeople(items, first, second);
      return;
    }

    if (pairs.length) {
      pairs.forEach((pair) => pushPeople(items, makeItem(pair, ctx)));
      return;
    }

    const guessed = guessPlayerFromKeywordLine(line, ctx);
    if (guessed) pushPeople(items, guessed);
  });

  return items.filter((item) => item.player);
}

function preprocessText(raw) {
  return String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[／]/g, "/")
    .replace(/[：]/g, ":")
    .replace(/[【]/g, "\n【")
    .replace(/(組別\s*:)/g, "\n$1")
    .replace(/(場地\s*:)/g, "\n$1")
    .replace(/(場次\s*:?)/g, "\n$1")
    .replace(/(紅方)/g, "\n$1")
    .replace(/(藍方)/g, "\n$1");
}

function emptyContext() {
  return {
    type: "",
    division: "",
    court: "",
    matchNo: "",
    weightClass: "",
    belt: "",
    eventName: "",
    ageGroup: "",
    gender: ""
  };
}

function applyContextFromLine(line, ctx) {
  if (/品勢/.test(line) && !/選手/.test(line)) ctx.type = "品勢";
  if (/對打|競技對打|Kyorugi|sparring/i.test(line)) ctx.type = "對打";
  if (ctx.type === "對打") ctx.eventName = "";
  if (ctx.type === "品勢") ctx.weightClass = "";

  const division = extractDivision(line);
  if (division && division !== ctx.division) {
    ctx.division = division;
    ctx.matchNo = "";
    ctx.weightClass = "";
    ctx.eventName = "";
    ctx.belt = "";
    ctx.court = "";
    ctx.ageGroup = "";
    ctx.gender = "";
  }

  const court = line.match(/(?:場地|場別)\s*:?\s*([^\s，,]+)|(\d+\s*號場)|([A-Ha-h]場)/);
  if (court) ctx.court = (court[1] || court[2] || court[3] || "").replace(/\s+/g, "");

  const matchNo = line.match(/(?:場次|第)\s*:?\s*(\d+)\s*場?/);
  if (matchNo && !/年級/.test(line)) ctx.matchNo = matchNo[1];

  const weight = extractWeight(line);
  if (weight && ctx.type !== "品勢") ctx.weightClass = weight;

  const belt = extractBelt(line);
  if (belt) ctx.belt = belt;

  const eventName = extractPoomsaeEvent(line);
  if (eventName && ctx.type !== "對打") ctx.eventName = eventName;

  const age = extractAgeGroup(line);
  if (age) ctx.ageGroup = age;

  const gender = extractGender(line);
  if (gender) ctx.gender = gender;
}

function pushPeople(list, ...people) {
  people.forEach((item) => {
    if (!item || !item.player || item.player === "輪空") return;
    list.push(item);
  });
}

function extractDivision(line) {
  const cleaned = line
    .replace(/【|】/g, "")
    .replace(/品勢|對打/g, " ")
    .replace(/場地.+$/, "")
    .replace(/場次.+$/, "")
    .trim();

  if (!/(幼兒|國小|國中|高中|大專|一般|社會|公開|成年)/.test(cleaned)) return "";
  if (!/(男|女|混合|團體|個人|黑帶|紅帶|白帶|黃帶|綠帶|藍帶|kg|公斤|量級)/.test(cleaned)) {
    return "";
  }

  return cleaned
    .replace(/\s+/g, " ")
    .replace(/^[:：\-\s]+/, "")
    .slice(0, 40);
}


function extractPersonClubPairs(line) {
  const results = [];
  const used = new Set();

  const push = (player, club) => {
    const name = cleanName(player);
    const gym = cleanClub(club);
    if (!name || NAME_STOP.has(name)) return;
    const key = name + "|" + gym;
    if (used.has(key)) return;
    used.add(key);
    results.push({ player: name, club: gym });
  };

  const reParen = /([\u4e00-\u9fff]{2,4})\s*\(\s*([^)]{2,30})\s*\)/g;
  const reSlash = /([\u4e00-\u9fff]{2,4})\s*\/\s*([\u4e00-\u9fffA-Za-z0-9]{2,20})/g;
  const reSpace = /([\u4e00-\u9fff]{2,4})[\s　]{1,6}([\u4e00-\u9fff]{2,12}(?:跆拳道)?(?:館|隊|協會)?)/g;

  let match;
  while ((match = reParen.exec(line))) push(match[1], match[2]);
  while ((match = reSlash.exec(line))) push(match[1], match[2]);
  while ((match = reSpace.exec(line))) {
    if (NAME_STOP.has(match[2]) || /場|組|級/.test(match[2])) continue;
    push(match[1], match[2]);
  }

  return results;
}

function personFromFragment(fragment, ctx) {
  const text = String(fragment || "").trim();
  if (!text) return null;
  if (/輪空|BYE|bye/i.test(text)) {
    return makeItem({ player: "輪空", club: "" }, ctx);
  }

  const pairs = extractPersonClubPairs(text);
  if (pairs[0]) return makeItem(pairs[0], ctx);

  const nameOnly = text.match(/^([\u4e00-\u9fff]{2,4})/);
  if (nameOnly && !NAME_STOP.has(nameOnly[1])) {
    return makeItem({ player: nameOnly[1], club: "" }, ctx);
  }

  const guessed = guessPlayerFromKeywordLine(text, ctx);
  return guessed;
}

function guessPlayerFromKeywordLine(line, ctx) {
  const keywords = getActiveKeywords();
  for (const keyword of keywords) {
    const index = line.indexOf(keyword);
    if (index === -1) continue;

    const before = line.slice(Math.max(0, index - 12), index);
    const after = line.slice(index + keyword.length, index + keyword.length + 12);
    const nameBefore = before.match(/([\u4e00-\u9fff]{2,4})\s*$/);
    const nameAfter = after.match(/^\s*([\u4e00-\u9fff]{2,4})/);
    const name = cleanName(nameBefore?.[1] || nameAfter?.[1] || "");
    if (name) return makeItem({ player: name, club: keyword }, ctx);
  }
  return null;
}

function splitVs(line) {
  if (!/(?:vs|VS|對戰)/.test(line)) return null;
  const parts = line.split(/\s*(?:vs|VS|Vs|對戰)\s*/);
  if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
    if (parts[0].length < 40 && parts[1].length < 40) return parts;
  }
  return null;
}

function makeItem(pair, ctx) {
  return {
    player: pair.player || "",
    club: pair.club || "",
    type: ctx.type || "",
    division: ctx.division || "",
    court: ctx.court || "",
    matchNo: ctx.matchNo || "",
    opponent: "",
    opponentClub: "",
    weightClass: ctx.weightClass || "",
    belt: ctx.belt || "",
    eventName: ctx.eventName || "",
    ageGroup: ctx.ageGroup || "",
    gender: ctx.gender || "",
    color: ""
  };
}

function linkOpponents(a, b) {
  if (!a || !b) return;
  if (b.player && b.player !== "輪空") {
    a.opponent = a.opponent || b.player;
    a.opponentClub = a.opponentClub || b.club;
  } else if (b.player === "輪空") {
    a.opponent = "輪空";
  }
  if (a.player && a.player !== "輪空") {
    b.opponent = b.opponent || a.player;
    b.opponentClub = b.opponentClub || a.club;
  }
  assignChungHong(a, b);
}

function assignChungHong(a, b) {
  if (!a || !b) return;
  a.color = normalizeColor(a.color) || a.color;
  b.color = normalizeColor(b.color) || b.color;
  if (a.color && b.color) return;
  if (!a.color && !b.color) {
    a.color = "青方";
    b.color = "紅方";
    return;
  }
  if (!a.color) a.color = /紅/.test(b.color) ? "青方" : "紅方";
  if (!b.color) b.color = /紅/.test(a.color) ? "青方" : "紅方";
}

function isFightContext(ctx) {
  return (ctx.type || "").includes("對打");
}


function normalizeItem(item) {
  const row = {
    player: getField(item, ["player", "name", "選手", "姓名", "選手姓名"]),
    type: getField(item, ["type", "event", "項目", "種類"]),
    division: getField(item, ["division", "group", "組別", "級別", "量級"]),
    club: getField(item, ["club", "dojo", "道館", "單位", "代表隊"]),
    court: getField(item, ["court", "venue", "場地", "場別"]),
    matchNo: getField(item, ["matchNo", "match", "場次", "序號"]),
    opponent: getField(item, ["opponent", "對手", "對戰選手"]),
    opponentClub: getField(item, ["opponentClub", "對手道館", "對方單位"]),
    weightClass: getField(item, ["weightClass", "weight", "公斤級"]),
    belt: getField(item, ["belt", "帶色", "段級"]),
    eventName: getField(item, ["eventName", "品勢項目", "指定品勢"]),
    ageGroup: getField(item, ["ageGroup", "年齡組"]),
    gender: getField(item, ["gender", "性別"]),
    color: getField(item, ["color", "紅藍方", "邊"])
  };

  if (!row.club && row.player) {
    const pairs = extractPersonClubPairs(row.player);
    if (pairs[0]) {
      row.player = pairs[0].player;
      row.club = pairs[0].club;
    }
  }

  return row;
}

function getField(object, keys) {
  for (const key of keys) {
    if (object[key] !== undefined && object[key] !== null && String(object[key]).trim() !== "") {
      return String(object[key]).trim();
    }
  }
  return "";
}

function enrichItem(item) {
  splitStuckPlayerClub(item);
  const blob = [item.division, item.type, item.eventName, item.player, item.club].join(" ");
  if (!item.type) item.type = detectType(blob);
  if (item.type === "對練" || item.type === "競技") item.type = "對打";
  if (!item.weightClass) item.weightClass = extractWeight(blob);
  if (!item.belt) item.belt = extractBelt(blob);
  if (!item.eventName && isPoomsae(item)) item.eventName = extractPoomsaeEvent(blob);
  if (isPoomsae(item) && (item.event1 || item.event2)) {
    item.eventName = [item.event1, item.event2].filter(Boolean).join("、") || item.eventName;
  }
  if (!item.gender) item.gender = extractGender(blob);
  if (!item.ageGroup) item.ageGroup = extractAgeGroup(blob);
  if (!item.division) {
    item.division = [item.ageGroup, item.gender, item.belt || item.weightClass].filter(Boolean).join("");
  }
  item.detailLabel = isFight(item)
    ? (item.weightClass || item.belt)
    : (item.eventName || item.belt);
  resolveCourt(item);
  return item;
}

function splitStuckPlayerClub(item) {
  if (item.club) return;
  const source = String(item.player || "");
  const keywords = getActiveKeywords();
  for (const keyword of keywords) {
    if (!source.includes(keyword)) continue;
    item.club = keyword;
    const leftover = source.replace(keyword, "").replace(/[()\/\s]/g, "");
    const name = cleanName(leftover);
    if (name) item.player = name;
    return;
  }
}

function detectType(text) {
  if (/品勢|Poomsae|指定品勢|自選品勢/i.test(text)) return "品勢";
  if (/對打|競技對打|Kyorugi|對練/i.test(text)) return "對打";
  if (/kg|公斤|量級/.test(text) && !/品勢/.test(text)) return "對打";
  return "";
}

function extractWeight(text) {
  const match = String(text || "").match(/[+＋\-－]?\s*\d+(?:\.\d+)?\s*(?:kg|KG|公斤)/i);
  if (match) return match[0].replace(/\s+/g, "");
  const named = String(text || "").match(/([最]?[輕中重]量級|羽量級|蠅量級)/);
  return named ? named[1] : "";
}

function extractBelt(text) {
  const match = String(text || "").match(/((?:白|黃|綠|藍|紅|紅黑|黑)帶(?:\s*[一二三四五六七八九十\d]段)?|[一二三四五六七八九十\d]段)/);
  return match ? match[1].replace(/\s+/g, "") : "";
}

function extractPoomsaeEvent(text) {
  const dual = extractDualPoomsae(text);
  if (dual.eventName) return dual.eventName;
  const match = String(text || "").match(/(指定品勢|自選品勢|團體品勢|個人品勢|自由品勢|對練|太極[一二三四五六七八]章|[一二三四五六七八]章|馬步正拳[、，,]?前抬[腳腿]?[、，,]?前踢|馬步正拳|前抬腳|前踢)/);
  return match ? match[1] : "";
}

function extractDualPoomsae(text) {
  const src = String(text || "").replace(/[：]/g, ":").replace(/\|/g, " ");
  if (!/第一品勢|第二品勢/.test(src)) {
    return { event1: "", event2: "", eventName: "" };
  }
  let first = "";
  let second = "";
  const dual = src.match(/第一品勢\s*:\s*(.*?)第二品勢\s*:\s*(.*)$/);
  if (dual) {
    first = dual[1];
    second = dual[2];
  } else {
    first = (src.match(/第一品勢\s*:\s*(.+)$/) || [])[1] || "";
    second = (src.match(/第二品勢\s*:\s*(.+)$/) || [])[1] || "";
  }
  first = completeWrappedPoomsae(first);
  second = completeWrappedPoomsae(second);
  return {
    event1: first,
    event2: second,
    eventName: [first, second].filter(Boolean).join("、")
  };
}

function normalizePoomsaeName(text) {
  return String(text || "")
    .replace(/籤號.*$/g, "")
    .replace(/單位.*$/g, "")
    .replace(/姓名.*$/g, "")
    .replace(/總分.*$/g, "")
    .replace(/名次.*$/g, "")
    .replace(/比賽(?:組別|人數).*$/g, "")
    .replace(/[|]/g, " ")
    .replace(/\s+/g, "")
    .replace(/[，]/g, "、")
    .replace(/、+/g, "、")
    .replace(/^、|、$/g, "")
    .trim();
}

function completeWrappedPoomsae(text) {
  let name = normalizePoomsaeName(text);
  if (/馬步正拳/.test(name) && /前抬[腳腿]/.test(name) && !/前踢/.test(name)) {
    name = `${name}、前踢`;
  }
  return name;
}

function formatPoomsaeLabel(item, compact) {
  const a = item.event1 || "";
  const b = item.event2 || "";
  const joined = item.eventName || [a, b].filter(Boolean).join("、") || item.detailLabel || "";
  if (!joined) return "";
  if (compact) return shortPoomsae(joined);
  if (a && b) return `第一：${a}　第二：${b}`;
  return joined;
}

function extractGender(text) {
  if (/女子|女生/.test(text)) return "女子";
  if (/男子|男生/.test(text)) return "男子";
  if (/混合/.test(text)) return "混合";
  return "";
}

function extractAgeGroup(text) {
  const match = String(text || "").match(/(幼兒|兒童|國小低年級|國小中年級|國小高年級|國小|國中|高中|大專|一般|社會|公開|成年)/);
  return match ? match[1] : "";
}

function isPoomsae(item) {
  return (item.type || "").includes("品勢");
}

function isFight(item) {
  return /對打|對練|競技/.test(item.type || "");
}

function isOrderStyle(item) {
  if (!item) return false;
  if (item.boutStyle === "order") return true;
  if (item.boutStyle === "bracket") return false;
  if (isFight(item)) return false;
  return isPoomsae(item) && !item.color && !item.nextColor;
}

function isBracketStyle(item) {
  return !isOrderStyle(item);
}

function cleanName(name) {
  const text = String(name || "").replace(/\s+/g, "").trim();
  if (!text || NAME_STOP.has(text) || /[0-9]/.test(text)) return "";
  if (text.length < 2 || text.length > 4) return "";
  return text;
}

function cleanClub(club) {
  return String(club || "")
    .replace(/[()]/g, "")
    .replace(/\s+/g, "")
    .trim();
}


function normalizeText(text) {
  return String(text || "")
    .replace(/\s+/g, "")
    .replace(/跆拳道館/g, "")
    .replace(/跆拳道/g, "")
    .replace(/道館/g, "")
    .replace(/館/g, "")
    .replace(/－/g, "")
    .replace(/-/g, "")
    .toLowerCase();
}

function matchesClub(text, keywords) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return keywords.some((keyword) => {
    const key = normalizeText(keyword);
    if (!key) return false;
    if (normalized.includes(key)) return true;
    if (key.includes(normalized) && normalized.length >= 4) return true;
    return false;
  });
}

function itemMatchesClub(item, keywords) {
  if (matchesClub(item.club, keywords)) return true;
  return matchesClub(`${item.player}${item.club}`, keywords) && !matchesClub(item.opponentClub, keywords);
}

function getPlayerNames() {
  if (!playerNamesEl) return [];
  return tidyPlayerNameList(playerNamesEl.value).names;
}

const NAME_HEADER_SKIP = new Set([
  ...NAME_STOP,
  "參加", "金額", "備註", "電話", "班級", "年級", "學校", "性別",
  "是否", "出勤", "報名", "繳費", "家長", "聯絡", "名字", "編號",
  "序號", "備住", "出席", "午餐", "晚餐", "素食", "葷食"
]);

function isLikelyPersonName(text) {
  const name = String(text || "").replace(/\s+/g, "");
  if (!/^[\u4e00-\u9fff]{2,4}$/.test(name)) return false;
  if (NAME_HEADER_SKIP.has(name)) return false;
  if (/(國小|國中|高中|小學|道館|協會|跆拳|年級|公斤|品勢|對打|場地|場次|護具)$/.test(name)) return false;
  if (/^(白|黃|綠|藍|紅|黑)帶/.test(name)) return false;
  if (/^[一二三四五六七八九十]+章$/.test(name)) return false;
  return true;
}

function pickNameFromToken(token) {
  let text = String(token || "").replace(/[()（）\[\]【】*＊]/g, " ").trim();
  text = text.replace(/^\d+[\.．、)\s]+/, "").replace(/\s+/g, "");
  if (!text) return "";
  const cleaned = cleanName(text);
  if (cleaned && isLikelyPersonName(cleaned)) return cleaned;
  const clubName = text.match(/(?:國小|國中|高中|小學|道館|館|隊|團)([\u4e00-\u9fff]{2,4})$/);
  if (clubName && isLikelyPersonName(clubName[1])) return clubName[1];
  const leading = text.match(/^([\u4e00-\u9fff]{2,4})(?:\d|[A-Za-z]|白帶|黃帶|綠帶|藍帶|紅帶|黑帶|幼兒|國小|國中)/);
  if (leading && isLikelyPersonName(leading[1])) return leading[1];
  return isLikelyPersonName(text) ? text : "";
}

function harvestNamesFromPiece(piece) {
  const found = [];
  const text = String(piece || "").trim();
  if (!text) return found;

  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    tokens.forEach((token) => {
      const name = pickNameFromToken(token);
      if (name) found.push(name);
    });
    if (found.length) return found;
  }

  const one = pickNameFromToken(text);
  if (one) return [one];

  const glued = text.replace(/[^\u4e00-\u9fff]/g, "");
  if (glued.length >= 4 && glued.length <= 24 && !/(國小|國中|高中|道館|館)/.test(glued)) {
    if (glued.length % 3 === 0) {
      const chunks = glued.match(/[\u4e00-\u9fff]{3}/g) || [];
      if (chunks.length && chunks.every(isLikelyPersonName)) return chunks;
    }
  }

  const scanned = text.match(/[\u4e00-\u9fff]{2,4}/g) || [];
  scanned.forEach((item) => {
    if (isLikelyPersonName(item)) found.push(item);
  });
  return found;
}

function tidyPlayerNameList(raw) {
  const names = [];
  const seen = new Set();
  function add(name) {
    if (!name || seen.has(name)) return;
    seen.add(name);
    names.push(name);
  }

  String(raw || "").split(/\r?\n/).forEach((line) => {
    const compact = line.replace(/\s+/g, "");
    if (!compact || /^(姓名|名字|選手|單位|道館|序|編號|學校|年級)$/.test(compact)) return;
    line.split(/\t/).forEach((cell) => {
      cell.split(/[,，、;；|/／]+/).forEach((piece) => {
        harvestNamesFromPiece(piece).forEach(add);
      });
    });
  });

  return { names, text: names.join("\n") };
}

function showNameTidyStatus(count) {
  const el = document.getElementById("playerNamesStatus");
  if (!el) return;
  el.textContent = count ? `已整理成 ${count} 人` : "";
}

function applyTidiedNames(raw, mergeWithCurrent) {
  if (!playerNamesEl) return;
  const source = mergeWithCurrent ? `${playerNamesEl.value}\n${raw}` : raw;
  const tidied = tidyPlayerNameList(source);
  if (!tidied.names.length) {
    showNameTidyStatus(0);
    const el = document.getElementById("playerNamesStatus");
    if (el) el.textContent = "沒辨識到姓名，請改貼中文名字";
    return false;
  }
  playerNamesEl.value = tidied.text;
  showNameTidyStatus(tidied.names.length);
  saveSettings();
  return true;
}

function itemMatchesName(item, names) {
  const player = normalizeText(item.player);
  if (!player) return false;
  return names.some((name) => {
    const key = normalizeText(name);
    if (!key) return false;
    return player === key || player.includes(key) || key.includes(player);
  });
}

function itemMatchesFilter(item) {
  const keywords = getActiveKeywords();
  const names = getPlayerNames();
  if (!keywords.length && !names.length) return true;
  const clubHit = keywords.length ? itemMatchesClub(item, keywords) : false;
  const nameHit = names.length ? itemMatchesName(item, names) : false;
  if (keywords.length && names.length) return clubHit || nameHit;
  if (names.length) return nameHit;
  return clubHit;
}

function looksLikeCoachNotes(text) {
  const lines = String(text).split(/\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return false;
  const hits = lines.filter((line) => /^\d+[\.．、)]?\s*[\u4e00-\u9fff]{2,4}.+\d{2,4}\s*(紅|青|藍)/.test(line));
  return hits.length >= 1 && hits.length >= lines.length * 0.5;
}

function normalizeColor(color) {
  const text = String(color || "");
  if (/紅/.test(text)) return "紅方";
  if (/青|藍/.test(text)) return "青方";
  return "";
}

function shortColor(color) {
  if (/紅/.test(color || "")) return "紅";
  if (/青|藍/.test(color || "")) return "青";
  return "";
}

function parseCoachNotes(raw) {
  return String(raw || "").split(/\n/).map((line) => {
    const stripped = line.trim().replace(/^\d+[\.．、)]\s*/, "");
    if (!stripped) return null;
    let player = "";
    let rest = "";
    for (const len of [3, 2, 4]) {
      const name = stripped.slice(0, len);
      if (!/^[\u4e00-\u9fff]+$/.test(name)) continue;
      const after = stripped.slice(len);
      if (/^(國小|國中|幼兒|幼幼|高中|一般|白帶|黃帶|藍帶|紅帶|黑帶|\s|\d)/.test(after)) {
        player = name;
        rest = after.trim();
        break;
      }
    }
    if (!player) return null;
    const bouts = [];
    rest = rest.replace(/(\d{2,4})\s*(紅方|青方|藍方|紅|青|藍)/g, (_, no, color) => {
      bouts.push({ no, color: normalizeColor(color) });
      return " ";
    });
    const leftover = rest.replace(/\s+/g, " ").trim();
    const eventName = extractPoomsaeEvent(leftover);
    const division = leftover.replace(eventName, "").trim();
    const first = bouts[0] || {};
    const next = bouts[1] || {};
    const type = (eventName || /章|馬步|品勢/.test(leftover))
      ? "品勢"
      : (/公斤|對打/.test(leftover) ? "對打" : (bouts.length ? "品勢" : ""));
    return enrichItem({
      player,
      club: clubName.value || "",
      type,
      division,
      court: "",
      matchNo: first.no || "",
      opponent: "",
      opponentClub: "",
      eventName,
      color: first.color || "",
      nextMatchNo: next.no || "",
      nextColor: next.color || "",
      nextOpponentHint: "",
      bye: false,
      source: "notes",
      boutStyle: bouts.length ? "bracket" : (type === "品勢" ? "order" : "bracket")
    });
  }).filter(Boolean);
}

function parseMatchList(raw) {
  const text = String(raw || "").replace(/[：]/g, ":").replace(/\|/g, " ");
  const lines = text.split(/\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const chunks = [];
  let court = "";
  let current = [];

  function flushChunk() {
    if (!current.length) return;
    chunks.push({ court, lines: current.slice() });
    current = [];
  }

  lines.forEach((line) => {
    const courtHit = readCourtLine(line);
    if (courtHit) {
      flushChunk();
      court = courtHit;
      return;
    }
    if (/^(MATCH LIST|組別量級)/.test(line)) {
      flushChunk();
      current.push(line);
      return;
    }
    if (current.length) current.push(line);
  });
  flushChunk();

  const items = [];
  chunks.forEach((chunk) => {
    const joined = chunk.lines.join("\n");
    if (/敗部/.test(joined)) return;
    const headerLine = joined.match(/([A-Z]{1,3}\d{2}[^\n]{0,40}?)比賽人數:\s*(\d+)\s*人/)
      || joined.match(/([^\n]{4,40}?)比賽人數:\s*(\d+)\s*人/);
    const division = (headerLine ? headerLine[1] : "").replace(/組別量級:/, "").trim();
    const size = headerLine ? parseInt(headerLine[2], 10) : 0;
    const type = /品勢/.test(joined) ? "品勢" : "對打";
    const header = {
      type,
      division,
      groupSize: size,
      court: chunk.court,
      weightClass: extractWeight(division),
      belt: extractBelt(division),
      ageGroup: extractAgeGroup(division),
      gender: extractGender(division),
      groupCode: (division.match(/^[A-Z]{2}\d{2}/) || [""])[0],
      boutStyle: type === "品勢" ? detectPoomsaeStyleFromText(joined) : "bracket"
    };

    const tokens = [];
    chunk.lines.forEach((line) => {
      if (/^(No|單位|姓名|籤號|護具|比賽名稱|比賽地點|比賽日期|MATCH LIST|組別量級)/.test(line)) return;
      const playerLine = normalizePlayerLine(line);
      if (playerLine) {
        tokens.push({ kind: "p", line: playerLine });
        return;
      }
      const matchLine = line.match(/^(\d{3,4})(?:-\d+)?$/);
      if (matchLine) tokens.push({ kind: "m", no: matchLine[1] });
    });
    items.push(...tokensToBracketItems(tokens, header));
  });
  return items;
}

function detectPoomsaeStyleFromText(text) {
  const src = String(text || "");
  if (/品勢出場順序表|第一品勢|第二品勢/.test(src) && !/編號/.test(src)) return "order";
  if (/比賽組別:\s*P/i.test(src) && /編號/.test(src)) return "bracket";
  if (/VS|對\s*戰/.test(src)) return "bracket";
  return "order";
}

function normalizePlayerLine(line) {
  const t = String(line || "").replace(/\|/g, " ").replace(/\s+/g, " ").trim();
  if (!t || /^(籤號|單位|姓名|No|護具|量級|比賽)/.test(t)) return "";
  const start = t.match(/^([1-9]\d?)\s+(.+)$/);
  if (start && /[\u4e00-\u9fff]{2,}/.test(start[2]) && !/^(籤號|單位|姓名|公斤|量級|人)/.test(start[2])) {
    if (!/^\d{2,4}(?:-\d+)?$/.test(start[2]) && !/^(公斤級?|量級)$/.test(start[2].replace(/\s/g, ""))) {
      return `${start[1]} ${start[2]}`;
    }
  }
  const end = t.match(/^(.+?)\s+([1-9]\d?)$/);
  if (end && /[\u4e00-\u9fff]{2,}/.test(end[1]) && !/^(比賽人數|組別|量級|公斤)/.test(end[1])) {
    return `${end[2]} ${end[1]}`;
  }
  return "";
}

function parsePoomsaeOrderTable(raw) {
  const text = String(raw || "").replace(/[：]/g, ":").replace(/\|/g, " ");
  const lines = text.split(/\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const items = [];
  let court = "";
  let header = { type: "品勢", division: "", matchNo: "", eventName: "", event1: "", event2: "", groupSize: 0, court: "" };
  let current = [];

  function stampCurrent() {
    current.forEach((item) => {
      item.groupSize = header.groupSize || current.length;
      item.groupMembers = current;
      item.event1 = header.event1 || item.event1 || "";
      item.event2 = header.event2 || item.event2 || "";
      item.eventName = header.eventName || [item.event1, item.event2].filter(Boolean).join("、");
      item.detailLabel = item.eventName || item.detailLabel;
      item.court = item.court || header.court || court;
    });
  }

  function flush() {
    if (!current.length) return;
    stampCurrent();
    items.push(...current);
    current = [];
  }

  lines.forEach((line) => {
    const courtHit = readCourtLine(line);
    if (courtHit) {
      flush();
      court = courtHit;
      header.court = court;
      return;
    }
    const title = line.match(/^(\d{2,4})\s*-?\s*(?:自由)?品勢出場順序表/);
    const matchHit = line.match(/場\s*次\s*:\s*(\d{2,4})/) || title;
    if (matchHit) {
      flush();
      header = {
        type: "品勢",
        division: "",
        matchNo: matchHit[1],
        eventName: "",
        event1: "",
        event2: "",
        groupSize: 0,
        court
      };
    }
    const divHit = line.match(/比賽組別:\s*(.+?)(?:\s+比賽人數:\s*(\d+)\s*人)?$/)
      || line.match(/組\s*別\s*:\s*(.+)$/);
    if (divHit) {
      header.division = divHit[1].replace(/第一品勢.*$/, "").replace(/第二品勢.*$/, "").trim();
      if (divHit[2]) header.groupSize = parseInt(divHit[2], 10);
    }
    const sizeHit = line.match(/人\s*數\s*:\s*(\d+)/);
    if (sizeHit) header.groupSize = parseInt(sizeHit[1], 10);
    if (/第一品勢|第二品勢/.test(line) && !/^籤號/.test(line) && !/姓名/.test(line)) {
      const dual = extractDualPoomsae(line);
      if (dual.event1) header.event1 = dual.event1;
      if (dual.event2) header.event2 = dual.event2;
      header.event1 = completeWrappedPoomsae(header.event1);
      if (header.event1 || header.event2) {
        header.eventName = [header.event1, header.event2].filter(Boolean).join("、");
      }
    } else if (header.event1 && /[、，]$/.test(header.event1) && !/組\s*別|籤號|場\s*次|人\s*數/.test(line)) {
      const extra = normalizePoomsaeName(line);
      if (extra && extra.length <= 12) {
        header.event1 = completeWrappedPoomsae(header.event1 + extra);
        header.eventName = [header.event1, header.event2].filter(Boolean).join("、");
      }
    }
    if (/^(籤號|單位|姓名)/.test(line) && !/^\d/.test(line)) return;
    const person = line.match(/^(\d{1,2})\s+(.+?)\s+([\u4e00-\u9fff]{2,6}(?:\s*[\/／]\s*[\u4e00-\u9fff]{2,6})*)(?:\s+(\d{3,8}))?\s*$/);
    const playerLine = person
      ? `${person[1]} ${person[2]} ${person[3]}`.trim()
      : normalizePlayerLine(line);
    if (playerLine && /^\d/.test(line) && /[\u4e00-\u9fff]{2,}/.test(line)) {
      const item = parseSeedLine(playerLine, header);
      if (item) {
        if (person) {
          item.player = person[3].replace(/\s+/g, "");
          item.club = person[2].replace(/\s+/g, " ").trim();
        }
        item.matchNo = header.matchNo || "";
        item.boutStyle = "order";
        item.orderNo = item.seed;
        item.color = "";
        item.nextMatchNo = "";
        item.nextColor = "";
        item.opponent = "";
        item.opponentClub = "";
        item.event1 = header.event1 || "";
        item.event2 = header.event2 || "";
        item.eventName = header.eventName || [item.event1, item.event2].filter(Boolean).join("、");
        current.push(item);
      }
    }
  });
  flush();
  return items;
}

function parseLooseBracket(raw) {
  const text = String(raw || "").replace(/[：]/g, ":").replace(/\|/g, " ");
  const lines = text.split(/\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const chunks = [];
  let court = "";
  let buf = [];

  function flushChunk() {
    if (!buf.length) return;
    chunks.push({ court, text: buf.join("\n") });
    buf = [];
  }

  lines.forEach((line) => {
    const courtHit = readCourtLine(line);
    if (courtHit) {
      flushChunk();
      court = courtHit;
      return;
    }
    if (/^比賽組別/.test(line)) {
      flushChunk();
      buf.push(line.replace(/^比賽組別\s*:?\s*/, ""));
      return;
    }
    if (buf.length) buf.push(line);
  });
  flushChunk();

  const items = [];
  chunks.forEach((entry) => {
    const chunk = entry.text;
    if (/敗部/.test(chunk)) return;
    const head = chunk.split(/\n/)[0] || "";
    const weightRaw = extractWeight(chunk) || (chunk.match(/(\d+)\s*公斤/) || [])[1] || "";
    const weightDigits = String(weightRaw).replace(/[^\d.+＋\-－]/g, "");
    let division = (head.replace(/量級.*$/, "").replace(/比賽人數.*$/, "").trim() || head.trim()).replace(/\s+/g, "");
    if (weightDigits && !/公斤/.test(division)) division += `${weightDigits}公斤級`;
    const header = {
      type: /品勢/.test(chunk) ? "品勢" : "對打",
      division,
      court: entry.court,
      weightClass: weightDigits ? `${weightDigits}公斤` : "",
      groupSize: parseInt((chunk.match(/(\d+)\s*人/) || [])[1] || "0", 10),
      boutStyle: /品勢/.test(chunk) ? detectPoomsaeStyleFromText(chunk) : "bracket"
    };
    const weightNum = parseInt(String(weightRaw || "").replace(/\D/g, ""), 10) || 0;
    const chunkLines = chunk.split(/\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
    const tokens = [];
    chunkLines.forEach((line) => {
      if (/^(籤號|單位|姓名|取\d|敗部|量級)/.test(line)) return;
      const playerLine = normalizePlayerLine(line);
      if (playerLine) {
        tokens.push({ kind: "p", line: playerLine });
        return;
      }
      const m = line.match(/^(\d{2,4})(?:-\d+)?$/);
      if (m) {
        const no = parseInt(m[1], 10);
        if (no === weightNum) return;
        if (String(m[1]).length >= 3 || (no >= 10 && no !== weightNum)) {
          tokens.push({ kind: "m", no: m[1] });
        }
      }
    });
    if (/敗部/.test(chunk)) return;
    items.push(...tokensToBracketItems(tokens, header));
  });
  return items;
}

function tokensToBracketItems(tokens, header) {
  const nodes = [];
  tokens.forEach((token) => {
    if (token.kind === "p") {
      const item = parseSeedLine(token.line, header);
      if (item) {
        item._src = token.line;
        nodes.push({ kind: "p", item });
      }
    } else if (token.kind === "m" && token.no && token.no !== "X") {
      nodes.push({ kind: "m", no: String(token.no) });
    }
  });
  pairBracketNodes(nodes);
  const players = nodes.filter((node) => node.kind === "p").map((node) => node.item);
  stampGroup(players, header);
  return players;
}

function pairBracketNodes(nodes) {
  const players = nodes.filter((node) => node.kind === "p").map((node) => node.item);
  const matchAt = [];
  nodes.forEach((node, index) => {
    if (node.kind === "m") matchAt.push(index);
  });

  if (players.length <= 1) {
    if (players[0] && !players[0].matchNo) players[0].bye = true;
    return;
  }
  if (!matchAt.length) {
    players.forEach((item) => {
      if (!item.matchNo) item.bye = true;
    });
    return;
  }

  const waves = matchAt.map((index) => matchWave(getNumber(nodes[index].no)));
  const maxWave = Math.max(...waves);
  const roots = matchAt.filter((_, i) => waves[i] === maxWave);

  if (roots.length !== 1) {
    pairSequentialMatches(nodes);
    return;
  }

  const split = roots[0];
  const matchNo = nodes[split].no;
  const left = nodes.slice(0, split);
  const right = nodes.slice(split + 1);
  pairBracketNodes(left);
  pairBracketNodes(right);
  linkBracketSides(left, right, matchNo);
}

function subtreeExitMatch(nodes) {
  let best = "";
  let bestWave = -1;
  nodes.forEach((node) => {
    if (node.kind !== "m") return;
    const wave = matchWave(getNumber(node.no));
    if (wave >= bestWave) {
      best = node.no;
      bestWave = wave;
    }
  });
  return best;
}

function linkBracketSides(leftNodes, rightNodes, matchNo) {
  const left = leftNodes.filter((node) => node.kind === "p").map((node) => node.item);
  const right = rightNodes.filter((node) => node.kind === "p").map((node) => node.item);
  if (!left.length && !right.length) return;

  if (left.length === 1 && right.length === 1 && !left[0].matchNo && !right[0].matchNo) {
    applyPair(left[0], right[0], matchNo);
    return;
  }

  if (left.length === 1 && !left[0].matchNo) {
    left[0].bye = true;
    if (!left[0].opponent) left[0].opponent = "輪空";
  }
  if (right.length === 1 && !right[0].matchNo) {
    right[0].bye = true;
    if (!right[0].opponent) right[0].opponent = "輪空";
  }

  const leftHint = winnerHint(left, left.length === 1 && !left[0].matchNo ? "" : subtreeExitMatch(leftNodes));
  const rightHint = winnerHint(right, right.length === 1 && !right[0].matchNo ? "" : subtreeExitMatch(rightNodes));

  left.forEach((item) => {
    if (item.nextMatchNo) return;
    item.nextMatchNo = matchNo;
    item.nextColor = "青方";
    item.nextOpponentHint = rightHint;
  });
  right.forEach((item) => {
    if (item.nextMatchNo) return;
    item.nextMatchNo = matchNo;
    item.nextColor = "紅方";
    item.nextOpponentHint = leftHint;
  });
}

function pairSequentialMatches(nodes) {
  const players = nodes.filter((node) => node.kind === "p").map((node) => node.item);
  for (let i = 0; i < nodes.length - 2; i++) {
    if (nodes[i].kind !== "p" || nodes[i + 1].kind !== "m" || nodes[i + 2].kind !== "p") continue;
    const a = nodes[i].item;
    const b = nodes[i + 2].item;
    if (a && b && !a.matchNo && !b.matchNo) applyPair(a, b, nodes[i + 1].no);
  }
  const unpaired = players.filter((item) => !item.matchNo);
  const used = new Set(players.map((item) => item.matchNo).filter(Boolean));
  const leftover = nodes.filter((node) => node.kind === "m" && !used.has(node.no)).map((node) => node.no);
  unpaired.forEach((item) => {
    item.bye = true;
    if (leftover[0] && !item.nextMatchNo) {
      item.nextMatchNo = leftover.shift();
      item.nextColor = "青方";
    }
  });
}

function stampGroup(list, header) {
  (list || []).forEach((item) => {
    if (!item) return;
    item.groupSize = header.groupSize || list.length;
    item.boutStyle = header.boutStyle || item.boutStyle || (isPoomsae(item) ? "bracket" : "bracket");
  });
}

function getNumber(value) {
  const match = String(value || "").match(/\d+/);
  return match ? parseInt(match[0], 10) : 999999;
}

function sortMatches(a, b) {
  const na = getNumber(a.matchNo || a.nextMatchNo);
  const nb = getNumber(b.matchNo || b.nextMatchNo);
  const wa = matchWave(na);
  const wb = matchWave(nb);
  if (wa !== wb) return wa - wb;
  const courtCmp = courtIndex(a.court) - courtIndex(b.court);
  if (courtCmp) return courtCmp;
  if (na !== nb) return na - nb;
  return (a.seed || 0) - (b.seed || 0);
}

function matchWave(n) {
  if (!n || n >= 999999) return 999999;
  if (n >= 1000 && n < 10000) return n % 1000;
  if (n >= 100 && n < 1000) return n % 100;
  return n;
}

function courtNameFromIndex(n) {
  const cn = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (n >= 1 && n <= 9) return `第${cn[n]}場地`;
  if (n > 9) return `第${n}場地`;
  return "";
}

function readCourtLine(line) {
  const t = String(line || "").replace(/\s+/g, "").trim();
  const m = t.match(/^(第[一二三四五六七八九十\d]+(?:[、，,][一二三四五六七八九十\d]+)*場地)$/);
  return m ? m[1] : "";
}

function inferCourtFromMatchNo(matchNo, item) {
  const n = getNumber(matchNo);
  if (!n || n < 100) return "";
  const s = String(n);
  const first = parseInt(s[0], 10);
  const second = s.length >= 4 ? parseInt(s[1], 10) : 0;
  if (s.length === 3) return courtNameFromIndex(first);
  if (s.length === 4 && isPoomsae(item) && second >= 1 && second <= 8) {
    return courtNameFromIndex(second);
  }
  return courtNameFromIndex(first);
}

function resolveCourt(item) {
  if (!item) return;
  const n = getNumber(item.matchNo || item.nextMatchNo);
  const pdfIdx = courtIndex(item.court);
  if (!n || n < 100) return;
  const s = String(n);
  const first = parseInt(s[0], 10);
  const second = s.length >= 4 ? parseInt(s[1], 10) : 0;
  if (s.length === 3) {
    item.court = courtNameFromIndex(first);
    return;
  }
  if (s.length === 4) {
    if (pdfIdx && (pdfIdx === first || pdfIdx === second) && !/[、，,]/.test(item.court || "")) {
      item.court = courtNameFromIndex(pdfIdx);
      return;
    }
    if (isPoomsae(item) && second >= 1 && second <= 8) {
      item.court = courtNameFromIndex(second);
      return;
    }
    item.court = courtNameFromIndex(first);
  }
}

function courtIndex(court) {
  const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8 };
  const text = String(court || "");
  const cn = text.match(/第([一二三四五六七八])/);
  if (cn) return map[cn[1]] || 0;
  const num = text.match(/(\d+)/);
  return num ? parseInt(num[1], 10) : 0;
}

function groupKey(item) {
  if (item.groupCode) return `${item.type || ""}｜${item.groupCode}`;
  const type = item.type || "未提及項目";
  const division = item.division || "未提及組別";
  return `${type}｜${division}`;
}

function attachGroups(items) {
  const map = new Map();
  items.forEach((item) => {
    const key = groupKey(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  items.forEach((item) => {
    item.groupKey = groupKey(item);
    item.groupMembers = map.get(item.groupKey) || [];
  });
}

function inferOpponents(items) {
  const buckets = new Map();
  items.forEach((item) => {
    if (!isFight(item) || !item.matchNo) return;
    const key = `${item.division}|${item.court}|${item.matchNo}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  });

  buckets.forEach((pair) => {
    const unique = [];
    pair.forEach((item) => {
      if (!unique.some((row) => row.player === item.player && row.club === item.club)) {
        unique.push(item);
      }
    });
    if (unique.length === 2) {
      const a = unique[0];
      const b = unique[1];
      a.opponent = a.opponent || b.player;
      a.opponentClub = a.opponentClub || b.club;
      b.opponent = b.opponent || a.player;
      b.opponentClub = b.opponentClub || a.club;
      assignChungHong(a, b);
    }
  });

  items.forEach((item) => {
    if (item.opponent || !item.groupMembers) return;
    if (isFight(item) || isOrderStyle(item)) return;
    if (item.boutStyle !== "bracket") return;
    const others = item.groupMembers.filter((row) => {
      return row.player && row.player !== item.player && row.player !== "輪空";
    });
    if (others.length === 1) {
      item.opponent = others[0].player;
      item.opponentClub = others[0].club;
    }
  });
}

function dedupeItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = [item.player, item.club, item.division, item.matchNo, item.opponent, item.type].join("|");
    if (!item.player || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function displayValue(value) {
  const text = String(value ?? "").trim();
  return text ? text : "未提及";
}

function orderLabel(item) {
  const n = item.orderNo || item.seed;
  const size = item.groupSize;
  if (n && size) return `第${n}位／共${size}人`;
  if (n) return `第${n}位上場`;
  return "輪流出場";
}

function sideCell(item) {
  if (isOrderStyle(item)) return `<span class="side order">輪流出場</span>`;
  return sideBadge(item.bye && !item.matchNo ? item.nextColor : item.color);
}

function opponentCell(item) {
  if (isOrderStyle(item)) {
    return escapeHTML(orderLabel(item));
  }
  return `${escapeHTML(displayValue(item.opponent))}${item.opponentClub ? "<br><small>" + escapeHTML(item.opponentClub) + "</small>" : ""}`;
}

function isMissing(value) {
  return !String(value ?? "").trim();
}


function updateStats() {
  const players = [...new Set(allData.map((item) => item.player))];
  const poomsae = allData.filter((item) => isPoomsae(item));
  const fight = allData.filter((item) => isFight(item));

  document.getElementById("playerCount").textContent = players.length;
  document.getElementById("matchCount").textContent = allData.length;
  document.getElementById("poomsaeCount").textContent = poomsae.length;
  document.getElementById("fightCount").textContent = fight.length;
  updateNextPlayer();
}

function updateNextPlayer() {
  const item = allData[0];
  if (!item) {
    document.getElementById("nextPlayerName").textContent = "無資料";
    document.getElementById("nextPlayerInfo").textContent = "－";
    document.getElementById("nextMatchNo").textContent = "－";
    return;
  }

  document.getElementById("nextPlayerName").textContent = item.player;
  let first;
  if (isOrderStyle(item)) {
    first = `場次 ${displayValue(item.matchNo)} ｜ ${orderLabel(item)}`;
  } else if (item.bye && !item.matchNo) {
    first = `輪空晉級 ｜ 下一場 ${item.nextMatchNo || ""} ${item.nextColor || ""}`;
  } else {
    first = `${item.color || ""} ｜ 場次 ${displayValue(item.matchNo)}`;
  }
  document.getElementById("nextPlayerInfo").textContent =
    `${displayValue(item.type)} ｜ ${first} ｜ ${displayValue(item.court)} ｜ ${displayValue(item.division)}`;
  document.getElementById("nextMatchNo").textContent = isOrderStyle(item)
    ? (item.matchNo || orderLabel(item))
    : (item.matchNo || item.nextMatchNo || "未提及");
}


document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    currentFilter = button.dataset.filter;
    render();
  });
});

document.getElementById("searchPlayer").addEventListener("input", render);

function getFilteredData() {
  const keyword = document.getElementById("searchPlayer").value.trim().toLowerCase();
  return allData.filter((item) => {
    const typeOK = currentFilter === "all" || (item.type || "").includes(currentFilter);
    const searchOK = !keyword || (item.player || "").toLowerCase().includes(keyword);
    return typeOK && searchOK;
  });
}

function getVisibleGroups(data) {
  const map = new Map();
  data.forEach((item) => {
    const key = item.groupKey || groupKey(item);
    if (!map.has(key)) {
      map.set(key, {
        key,
        type: item.type,
        division: item.division,
        court: item.court,
        members: item.groupMembers || [],
        ours: []
      });
    }
    map.get(key).ours.push(item);
  });
  return [...map.values()];
}


function render() {
  const data = getFilteredData();
  resultBody.innerHTML = "";
  mobileCards.innerHTML = "";
  emptyMessage.classList.toggle("hidden", data.length > 0);

  const emptyTitle = document.getElementById("emptyTitle");
  const emptyNameHint = document.getElementById("emptyNameHint");
  const showNameHint = parsedAll.length > 0 && allData.length === 0;
  if (emptyTitle) {
    if (showNameHint) {
      emptyTitle.textContent = "用道館名稱沒找到人";
    } else if (allData.length === 0) {
      emptyTitle.textContent = "還沒找到選手。請確認已按「整理賽程」。";
    } else {
      emptyTitle.textContent = "目前篩選條件下沒有人。可改按「全部」，或清掉搜尋框。";
    }
  }
  if (emptyNameHint) emptyNameHint.classList.toggle("hidden", !showNameHint);
  if (data.length > 0) clearPlayerNamesPulse();

  renderGroupChips(data);

  data.forEach((item, index) => {
    renderTableRow(item, index);
    renderMobileCard(item, index);
  });
}

function guideToPlayerNames() {
  const field = document.getElementById("playerNamesField");
  if (!field || !playerNamesEl) return;
  switchTab("match");
  field.classList.add("field-pulse");
  field.scrollIntoView({ behavior: "smooth", block: "center" });
}

function clearPlayerNamesPulse() {
  document.getElementById("playerNamesField")?.classList.remove("field-pulse");
}

function renderGroupChips(data) {
  groupChips.innerHTML = "";
  const groups = getVisibleGroups(data);
  const summary = document.getElementById("groupSummary");
    if (summary) summary.textContent = groups.length ? `${groups.length} 組，點開可看同組名單` : "目前沒有組別";
  groups.forEach((group) => {
    const sample = group.ours[0] || group.members[0] || {};
    const size = sample.groupSize || group.members.length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "group-chip";
    button.innerHTML = `
      <strong>${escapeHTML(displayValue(group.division))}</strong>
      <span>${escapeHTML(displayValue(group.type))} ｜ 同組 ${size} 人 ｜ 本館 ${group.ours.length} 人</span>
    `;
    button.addEventListener("click", () => openGroupModal(group.key));
    groupChips.appendChild(button);
  });
}

function renderTableRow(item, index) {
  const tr = document.createElement("tr");
  const typeClass = isFight(item) ? "fight" : isPoomsae(item) ? "po" : "unknown";
  tr.innerHTML = `
    <td class="wave-cell">${matchWave(getNumber(item.matchNo || item.nextMatchNo)) === 999999 ? "－" : String(matchWave(getNumber(item.matchNo || item.nextMatchNo))).padStart(2, "0")}</td>
    <td><strong>${escapeHTML(item.player)}</strong></td>
    <td><span class="type ${typeClass}">${escapeHTML(displayValue(item.type))}</span></td>
    <td>
      <button type="button" class="group-link">
        ${escapeHTML(displayValue(item.division))}
        ${isPoomsae(item) && formatPoomsaeLabel(item) ? "<br><small>" + escapeHTML(formatPoomsaeLabel(item)) + "</small>" : ""}
      </button>
    </td>
    <td class="${isMissing(item.court) ? "missing" : ""}">${escapeHTML(displayValue(item.court))}</td>
    <td class="match-number ${isMissing(item.matchNo) && !item.bye ? "missing" : ""}">
      ${item.bye && !item.matchNo ? "輪空晉級" : escapeHTML(displayValue(item.matchNo))}
    </td>
    <td>${sideCell(item)}</td>
    <td class="${!isOrderStyle(item) && isMissing(item.opponent) ? "missing" : ""}">
      ${opponentCell(item)}
    </td>
    <td class="next-cell ${isOrderStyle(item) || isMissing(item.nextMatchNo) ? (isOrderStyle(item) ? "" : "missing") : ""}">
      ${isOrderStyle(item) ? "－" : formatNextMatch(item)}
    </td>
  `;
  tr.querySelector(".group-link").addEventListener("click", () => openGroupModal(item.groupKey));
  resultBody.appendChild(tr);
}

function sideBadge(color) {
  if (!color) return `<span class="missing">未提及</span>`;
  const cls = String(color).includes("紅") ? "hong" : "chung";
  return `<span class="side ${cls}">${escapeHTML(color)}</span>`;
}

function formatNextMatch(item) {
  if (!item.nextMatchNo) return "未提及";
  const color = item.nextColor ? " " + item.nextColor : "";
  const hint = item.nextOpponentHint ? "<br><small>vs " + escapeHTML(item.nextOpponentHint) + "</small>" : "";
  return `場次 ${escapeHTML(item.nextMatchNo)}${escapeHTML(color)}${hint}`;
}

function renderMobileCard(item, index) {
  const card = document.createElement("div");
  card.className = "match-card";
  const firstMatch = isOrderStyle(item)
    ? `本場 ${displayValue(item.matchNo)} ｜ ${orderLabel(item)}`
    : (item.bye && !item.matchNo
      ? "本場輪空晉級"
      : `本場 ${displayValue(item.matchNo)} ${item.color || ""}`);
  const vsLine = isOrderStyle(item)
    ? `出場：<strong>${escapeHTML(orderLabel(item))}</strong>（無青紅、無對戰）`
    : `對手：<strong>${escapeHTML(displayValue(item.opponent))}</strong>${item.opponentClub ? "／" + escapeHTML(item.opponentClub) : ""}`;
  const nextLine = isOrderStyle(item)
    ? "一個個上場打分，打完換下一位"
    : (item.nextMatchNo
      ? escapeHTML("場次 " + item.nextMatchNo + " " + (item.nextColor || "") + (item.nextOpponentHint ? " vs " + item.nextOpponentHint : ""))
      : "未提及");
  card.innerHTML = `
    <div class="card-top">
      <div class="card-player">${index + 1}. ${escapeHTML(item.player)}</div>
      <div class="card-number">${escapeHTML(firstMatch)}</div>
    </div>
    <div class="card-info">
      ${escapeHTML(displayValue(item.type))} ・ ${escapeHTML(displayValue(item.court))}<br>
      ${escapeHTML(displayValue(item.division))}
      ${item.groupSize ? " ｜ 同組 " + item.groupSize + " 人" : ""}<br>
      ${isFight(item) ? "級別" : "品勢項目"}：${escapeHTML(displayValue(isFight(item) ? item.detailLabel : formatPoomsaeLabel(item) || item.detailLabel))}<br>
      ${vsLine}<br>
      ${isOrderStyle(item) ? nextLine : "贏了下一場：" + nextLine}
    </div>
  `;
  card.addEventListener("click", () => openGroupModal(item.groupKey));
  mobileCards.appendChild(card);
}


function openGroupModal(key) {
  const members = parsedAll.filter((item) => (item.groupKey || groupKey(item)) === key);
  const ours = allData.filter((item) => (item.groupKey || groupKey(item)) === key);
  const sample = ours[0] || members[0];
  if (!sample) return;

  modalTitle.textContent = displayValue(sample.division);
  const roster = [...members].sort((a, b) => (a.seed || 99) - (b.seed || 99));
  const size = sample.groupSize || roster.length;

  modalBody.innerHTML = `
    <div class="detail-grid">
      ${detailCell("項目", sample.type)}
      ${detailCell("組別", sample.division)}
      ${detailCell("組別代碼", sample.groupCode)}
      ${detailCell("同組人數", size ? size + " 人" : "")}
      ${detailCell(isFight(sample) ? "對打級別" : "品勢項目", isFight(sample) ? sample.weightClass : (formatPoomsaeLabel(sample) || sample.eventName))}
      ${!isFight(sample) && sample.event1 ? detailCell("第一品勢", sample.event1) : ""}
      ${!isFight(sample) && sample.event2 ? detailCell("第二品勢", sample.event2) : ""}
      ${detailCell("帶色 / 段級", sample.belt)}
      ${detailCell("場地", sample.court)}
      ${detailCell("年齡層", sample.ageGroup)}
    </div>

    <div>
      <h4>同組名單（${size} 人）</h4>
      <div class="person-list">
        ${roster.map((item) => personRow(item, matchesClub(item.club, getActiveKeywords()))).join("") || `<div class="missing">未提及</div>`}
      </div>
    </div>

    <div>
      <h4>本館選手賽程</h4>
      <div class="person-list">
        ${ours.map((item) => matchPlanRow(item)).join("") || `<div class="missing">未提及</div>`}
      </div>
    </div>
  `;

  groupModal.classList.remove("hidden");
}

function matchPlanRow(item) {
  const first = isOrderStyle(item)
    ? `本場：場次 ${displayValue(item.matchNo)} ｜ ${orderLabel(item)}（輪流出場，無青紅）`
    : (item.bye && !item.matchNo
      ? "本場：輪空晉級"
      : `本場：場次 ${displayValue(item.matchNo)} ${item.color || ""} vs ${displayValue(item.opponent)}${item.opponentClub ? "（" + item.opponentClub + "）" : ""}`);
  const next = isOrderStyle(item)
    ? "一個個上場打分，打完換下一位"
    : (item.nextMatchNo
      ? `贏了下一場：場次 ${item.nextMatchNo} ${item.nextColor || ""} vs ${item.nextOpponentHint || "未提及"}`
      : "贏了下一場：未提及");
  return `
    <div class="person-row ours">
      <div>
        <b>${escapeHTML(item.player)}</b>
        <small>籤號 ${item.seed || "未提及"} ｜ ${escapeHTML(first)}</small>
        <small>${escapeHTML(next)}</small>
      </div>
    </div>
  `;
}

function detailCell(label, value) {
  const missing = isMissing(value);
  return `
    <div class="detail-item">
      <span>${escapeHTML(label)}</span>
      <strong class="${missing ? "missing" : ""}">${escapeHTML(displayValue(value))}</strong>
    </div>
  `;
}

function personRow(item, ours) {
  return `
    <div class="person-row ${ours ? "ours" : ""}">
      <div>
        <b>${item.seed ? item.seed + ". " : ""}${escapeHTML(item.player || "未提及")}</b>
        <small>${escapeHTML(displayValue(item.club))} ｜ ${escapeHTML(isOrderStyle(item) ? orderLabel(item) : (item.color || (item.bye ? "輪空晉級" : "")))}</small>
      </div>
      <small>${item.matchNo ? escapeHTML("場次 " + item.matchNo) : (item.bye ? "輪空" : "場次未提及")}</small>
    </div>
  `;
}

function renderOtherPeople(sample, ours, members, opponents) {
  const ourNames = new Set(ours.map((item) => item.player));
  if (isFight(sample)) {
    if (!opponents.length) return `<div class="missing">未提及</div>`;
    return opponents.map((item) => `
      <div class="person-row">
        <div>
          <b>${escapeHTML(displayValue(item.player))}</b>
          <small>${escapeHTML(displayValue(item.club))}</small>
        </div>
      </div>
    `).join("");
  }

  const others = members.filter((item) => item.player && !ourNames.has(item.player));
  if (!others.length) return `<div class="missing">未提及</div>`;
  return others.map((item) => personRow(item, false)).join("");
}

function closeModal() {
  groupModal.classList.add("hidden");
}

document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
document.getElementById("modalBackdrop").addEventListener("click", closeModal);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal();
});


function escapeHTML(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFileName(name) {
  return String(name || "賽程")
    .replace(/[\\/:*?"<>|｜]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "賽程";
}

function exportFileName(ext) {
  const competition = document.getElementById("competitionName").value.trim() || "賽程";
  const club = clubName.value.trim() || "本館";
  return `${safeFileName(`${competition}-${club}`)}.${ext}`;
}

function downloadWorkbook(wb, filename) {
  const name = safeFileName(String(filename || "賽程").replace(/\.xlsx$/i, "")) + ".xlsx";
  try {
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadBlob(
      new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      name
    );
  } catch (error) {
    try {
      XLSX.writeFile(wb, name);
    } catch (inner) {
      alert("匯出失敗：" + (inner.message || error.message));
    }
  }
}

function classifyType(item) {
  if (isFight(item)) return "對打";
  if (isPoomsae(item)) return "品勢";
  if (item.weightClass || /公斤|量級/.test(item.division || "")) return "對打";
  if (item.eventName || /章|品勢/.test([item.division, item.detailLabel].join(""))) return "品勢";
  return item.type || "其他";
}

function formatMatchExport(item) {
  if (isOrderStyle(item)) {
    const match = item.matchNo || "";
    const order = item.orderNo || item.seed;
    if (match && order) return `${match}（第${order}位）`;
    return match || (order ? `第${order}位` : "未提及");
  }
  return formatColorSequence(item);
}

function sideExport(item) {
  if (isOrderStyle(item)) return "輪流出場";
  return displayValue(item.bye && !item.matchNo ? item.nextColor : item.color);
}

function opponentExport(item) {
  if (isOrderStyle(item)) return orderLabel(item);
  return displayValue(item.opponent);
}

function rowsForExport(data) {
  return data.map((item, index) => ({
    順序: index + 1,
    選手: item.player || "未提及",
    項目: displayValue(classifyType(item)),
    組別: displayValue(item.division),
    年齡層: displayValue(item.ageGroup),
    性別: displayValue(item.gender),
    級別或品勢項目: displayValue(isPoomsae(item) ? formatPoomsaeLabel(item) : item.detailLabel),
    帶色段級: displayValue(item.belt),
    場地: displayValue(item.court),
    本場場次: item.bye && !item.matchNo ? "輪空晉級" : displayValue(item.matchNo),
    青紅方: sideExport(item),
    對手: opponentExport(item),
    對手道館: isOrderStyle(item) ? "－" : displayValue(item.opponentClub),
    下一場場次: isOrderStyle(item) ? "－" : displayValue(item.nextMatchNo),
    下一場青紅: isOrderStyle(item) ? "－" : displayValue(item.nextColor),
    下一場對手: isOrderStyle(item) ? "－" : displayValue(item.nextOpponentHint),
    籤號: item.seed || "未提及",
    同組人數: item.groupSize || "未提及",
    本館: displayValue(item.club)
  }));
}

document.getElementById("exportExcelBtn").addEventListener("click", () => {
  if (!window.XLSX) {
    alert("Excel 套件尚未載入，請確認網路連線");
    return;
  }
  if (!allData.length) {
    alert("沒有可匯出的資料。請先解析檔案，並確認畫面上有選手列。");
    return;
  }

  const club = clubName.value.trim() || "本館";
  const workbook = XLSX.utils.book_new();
  const poomsae = allData.filter((item) => classifyType(item) === "品勢");
  const fight = allData.filter((item) => classifyType(item) === "對打");
  const other = allData.filter((item) => classifyType(item) !== "品勢" && classifyType(item) !== "對打");

  const allRows = [
    [`${club}｜全部賽程`],
    ["姓名", "項目", "組別", "場次", "青紅／出場", "對手／順序", "品勢或級別", "場地"]
  ];
  allData.forEach((item) => {
    allRows.push([
      item.player || "",
      classifyType(item),
      compactDivision(item),
      formatMatchExport(item),
      sideExport(item),
      opponentExport(item),
      (isPoomsae(item) ? formatPoomsaeLabel(item, true) : "") || item.weightClass || item.detailLabel || "",
      item.court || ""
    ]);
  });
  const allSheet = XLSX.utils.aoa_to_sheet(allRows);
  allSheet["!cols"] = [15, 8, 28, 18, 14, 18, 16, 12].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(workbook, allSheet, "全部");

  if (poomsae.length) {
    const poomRows = [
      [`${club}｜比賽資料`],
      ["姓名", "組別", "場次", "第一品勢", "第二品勢", "比賽品勢"]
    ];
    poomsae.forEach((item) => {
      poomRows.push([
        item.player || "",
        compactDivision(item),
        formatMatchExport(item),
        shortPoomsae(item.event1 || "") || (item.event2 ? "" : formatPoomsaeLabel(item, true)),
        shortPoomsae(item.event2 || ""),
        formatPoomsaeLabel(item, true)
      ]);
    });
    const poomSheet = XLSX.utils.aoa_to_sheet(poomRows);
    poomSheet["!cols"] = [12, 32, 16, 16, 16, 18].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(workbook, poomSheet, "比賽資料");
  }

  if (fight.length) {
    const fightRows = [
      [`${club}｜對打比賽資料`],
      ["姓名", "體重／組別", "場次＋顏色"]
    ];
    fight.forEach((item) => {
      fightRows.push([
        item.player || "",
        compactDivision(item),
        formatColorSequence(item)
      ]);
    });
    const fightSheet = XLSX.utils.aoa_to_sheet(fightRows);
    fightSheet["!cols"] = [12, 32, 18].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(workbook, fightSheet, "對打比賽資料");
  }

  if (other.length && !poomsae.length && !fight.length) {
    const extra = [
      [`${club}｜其他`],
      ["姓名", "項目", "組別", "場次"]
    ];
    other.forEach((item) => {
      extra.push([item.player || "", item.type || "", compactDivision(item), formatMatchExport(item)]);
    });
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(extra), "其他");
  }

  try {
    downloadWorkbook(workbook, exportFileName("xlsx"));
  } catch (error) {
    alert("匯出失敗：" + error.message);
  }
});

document.getElementById("exportWordBtn").addEventListener("click", () => {
  if (!allData.length) {
    alert("沒有可匯出的資料");
    return;
  }

  const competition = document.getElementById("competitionName").value || "賽程";
  const club = clubName.value || "本館";
  const rows = rowsForExport(allData).map((row) => `
    <tr>
      <td>${escapeHTML(row.順序)}</td>
      <td>${escapeHTML(row.選手)}</td>
      <td>${escapeHTML(row.項目)}</td>
      <td>${escapeHTML(row.組別)}</td>
      <td>${escapeHTML(row.級別或品勢項目)}</td>
      <td>${escapeHTML(row.場地)}</td>
      <td>${escapeHTML(row.本場場次)}</td>
      <td>${escapeHTML(row.青紅方)}</td>
      <td>${escapeHTML(row.對手)}</td>
      <td>${escapeHTML(row.下一場場次)}${row.下一場青紅 && row.下一場青紅 !== "－" && row.下一場青紅 !== "未提及" ? " " + escapeHTML(row.下一場青紅) : ""}</td>
    </tr>
  `).join("");

  const groupsHtml = getVisibleGroups(allData).map((group) => {
    const people = (group.members.length ? group.members : group.ours).map((item) =>
      `<li>${escapeHTML(displayValue(item.player))}（${escapeHTML(displayValue(item.club))}）
       籤號${item.seed || "?"} ${escapeHTML(isOrderStyle(item) ? orderLabel(item) : (item.color || ""))} 場次${escapeHTML(displayValue(item.matchNo))}
       ${isOrderStyle(item) ? "輪流出場" : "對手：" + escapeHTML(displayValue(item.opponent))}
       ${isOrderStyle(item) ? "" : "下一場：" + escapeHTML(displayValue(item.nextMatchNo)) + " " + escapeHTML(item.nextColor || "")}</li>`
    ).join("");
    return `<h3>${escapeHTML(displayValue(group.type))} ｜ ${escapeHTML(displayValue(group.division))}</h3><ul>${people}</ul>`;
  }).join("");

  const html = `
    <html>
      <head>
        <meta charset="utf-8">
        <title>${escapeHTML(competition)}</title>
        <style>
          body { font-family: "Microsoft JhengHei", sans-serif; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #333; padding: 6px 8px; font-size: 12px; }
          th { background: #eee; }
        </style>
      </head>
      <body>
        <h1>${escapeHTML(competition)}</h1>
        <p>道館：${escapeHTML(club)}</p>
        <p>本館選手 ${[...new Set(allData.map((item) => item.player))].length} 人，出場 ${allData.length} 場。</p>
        <table>
          <tr>
            <th>順序</th><th>選手</th><th>項目</th><th>組別</th>
            <th>級別 / 品勢項目</th><th>場地</th><th>本場</th><th>青紅／出場</th><th>對手／順序</th><th>下一場</th>
          </tr>
          ${rows}
        </table>
        <h2>組別細節</h2>
        ${groupsHtml}
      </body>
    </html>
  `;

  downloadBlob(
    new Blob(["\ufeff", html], { type: "application/msword" }),
    exportFileName("doc")
  );
});

function formatColorSequence(item) {
  const parts = [];
  if (item.bye && !item.matchNo && item.nextMatchNo) {
    parts.push(`${item.nextMatchNo}${shortColor(item.nextColor)}`);
    return parts.join("、");
  }
  if (item.matchNo) parts.push(`${item.matchNo}${shortColor(item.color)}`);
  if (item.nextMatchNo) parts.push(`${item.nextMatchNo}${shortColor(item.nextColor)}`);
  return parts.filter(Boolean).join("、") || "未提及";
}

function shortPoomsae(text) {
  return String(text || "")
    .replace(/未提及/g, "")
    .replace(/太極/g, "")
    .replace(/前抬腳/g, "前抬腿")
    .trim();
}

function compactDivision(item) {
  const text = [item.ageGroup, item.gender, item.division, item.weightClass]
    .filter(Boolean)
    .join("");
  return (item.division || text || "").replace(/比賽組別:?/g, "").trim() || "未提及";
}

function bindFold(toggleId, panelId) {
  const toggle = document.getElementById(toggleId);
  const panel = document.getElementById(panelId);
  if (!toggle || !panel) return;
  toggle.addEventListener("click", () => {
    const open = panel.classList.toggle("hidden") === false;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    const arrow = toggle.querySelector(".fold-arrow");
    if (arrow) arrow.textContent = open ? "－" : "＋";
  });
}

bindFold("pasteToggle", "pastePanel");
bindFold("groupToggle", "groupPanel");

if (playerNamesEl) {
  playerNamesEl.addEventListener("change", saveSettings);
  playerNamesEl.addEventListener("focus", clearPlayerNamesPulse);
  playerNamesEl.addEventListener("pointerdown", clearPlayerNamesPulse);
  playerNamesEl.addEventListener("paste", (event) => {
    const text = event.clipboardData?.getData("text") || "";
    const tidied = tidyPlayerNameList(text);
    if (tidied.names.length < 1) return;
    event.preventDefault();
    applyTidiedNames(text, Boolean(playerNamesEl.value.trim()));
    clearPlayerNamesPulse();
  });
}
document.getElementById("goPlayerNamesBtn")?.addEventListener("click", guideToPlayerNames);
if (filterEnabledEl) filterEnabledEl.addEventListener("change", saveSettings);

document.getElementById("tabMatch")?.addEventListener("click", () => switchTab("match"));
document.getElementById("tabCustom")?.addEventListener("click", () => switchTab("custom"));

function switchTab(tab) {
  document.getElementById("tabMatch")?.classList.toggle("active", tab === "match");
  document.getElementById("tabCustom")?.classList.toggle("active", tab === "custom");
  document.getElementById("matchApp")?.classList.toggle("hidden", tab !== "match");
  document.getElementById("customApp")?.classList.toggle("hidden", tab !== "custom");
}

const CUSTOM_TPL = {
  meal: {
    title: "吃飯統計",
    columns: [
      { key: "name", label: "姓名" },
      { key: "join", label: "參加" },
      { key: "fee", label: "金額", money: true },
      { key: "note", label: "備註" }
    ]
  },
  signup: {
    title: "報名收費",
    columns: [
      { key: "name", label: "姓名" },
      { key: "item", label: "項目" },
      { key: "fee", label: "費用", money: true },
      { key: "paid", label: "已繳" },
      { key: "note", label: "備註" }
    ]
  },
  blank: {
    title: "名單",
    columns: [
      { key: "name", label: "姓名" },
      { key: "col1", label: "欄位1" },
      { key: "col2", label: "欄位2" }
    ]
  }
};

function emptyCustomRow() {
  const row = {};
  customState.columns.forEach((col) => { row[col.key] = ""; });
  return row;
}

function renderCustomTable() {
  const head = document.getElementById("customHead");
  const body = document.getElementById("customBody");
  const title = document.getElementById("customTitle");
  if (!head || !body) return;
  if (title) title.value = customState.title;
  head.innerHTML = `<tr>${customState.columns.map((col) => `<th>${escapeHTML(col.label)}</th>`).join("")}<th></th></tr>`;
  body.innerHTML = "";
  customState.rows.forEach((row, rowIndex) => {
    const tr = document.createElement("tr");
    customState.columns.forEach((col) => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.value = row[col.key] || "";
      input.addEventListener("input", () => {
        customState.rows[rowIndex][col.key] = input.value;
        saveSettings();
        updateCustomSum();
      });
      td.appendChild(input);
      tr.appendChild(td);
    });
    const td = document.createElement("td");
    const del = document.createElement("button");
    del.className = "btn gray";
    del.type = "button";
    del.textContent = "刪";
    del.addEventListener("click", () => {
      customState.rows.splice(rowIndex, 1);
      if (!customState.rows.length) customState.rows.push(emptyCustomRow());
      saveSettings();
      renderCustomTable();
    });
    td.appendChild(del);
    tr.appendChild(td);
    body.appendChild(tr);
  });
  updateCustomSum();
}

function updateCustomSum() {
  const el = document.getElementById("customSum");
  if (!el) return;
  const moneyCols = customState.columns.filter((col) => col.money);
  if (!moneyCols.length) {
    el.textContent = `共 ${customState.rows.filter((row) => (row.name || "").trim()).length} 人`;
    return;
  }
  const parts = moneyCols.map((col) => {
    const sum = customState.rows.reduce((acc, row) => acc + (parseFloat(row[col.key]) || 0), 0);
    return `${col.label}合計 ${sum}`;
  });
  el.textContent = `共 ${customState.rows.filter((row) => (row.name || "").trim()).length} 人 ｜ ${parts.join(" ｜ ")}`;
}

function applyCustomTemplate(key) {
  const tpl = CUSTOM_TPL[key] || CUSTOM_TPL.meal;
  customState.title = tpl.title;
  customState.columns = tpl.columns.map((col) => ({ ...col }));
  customState.rows = [emptyCustomRow()];
  saveSettings();
  renderCustomTable();
}

document.getElementById("customTitle")?.addEventListener("input", (event) => {
  customState.title = event.target.value;
  saveSettings();
});
document.getElementById("customApplyTpl")?.addEventListener("click", () => {
  applyCustomTemplate(document.getElementById("customTemplate").value);
});
document.getElementById("customAddRowBtn")?.addEventListener("click", () => {
  customState.rows.push(emptyCustomRow());
  saveSettings();
  renderCustomTable();
});
document.getElementById("customAddColBtn")?.addEventListener("click", () => {
  const label = prompt("新欄位名稱", "備註");
  if (!label) return;
  const key = "col" + Date.now();
  customState.columns.push({ key, label, money: /費|錢|額|元/.test(label) });
  customState.rows.forEach((row) => { row[key] = ""; });
  saveSettings();
  renderCustomTable();
});
document.getElementById("customAddNamesBtn")?.addEventListener("click", () => {
  const raw = document.getElementById("customPasteNames").value || "";
  const names = raw.split(/[\n,，、]/).map((item) => item.trim()).filter(Boolean);
  names.forEach((name) => {
    const row = emptyCustomRow();
    row.name = name;
    customState.rows.push(row);
  });
  document.getElementById("customPasteNames").value = "";
  customState.rows = customState.rows.filter((row, index, list) => {
    return (row.name || "").trim() || index === list.length - 1;
  });
  saveSettings();
  renderCustomTable();
});
document.getElementById("customExportBtn")?.addEventListener("click", () => {
  if (!window.XLSX) return alert("Excel 套件尚未載入");
  const filled = customState.rows.filter((row) => customState.columns.some((col) => String(row[col.key] || "").trim()));
  if (!filled.length) return alert("沒有可匯出的資料，請先填列或貼上姓名。");
  const aoa = [
    [customState.title],
    customState.columns.map((col) => col.label),
    ...filled.map((row) => customState.columns.map((col) => row[col.key] || ""))
  ];
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!cols"] = customState.columns.map(() => ({ wch: 14 }));
  XLSX.utils.book_append_sheet(wb, sheet, safeFileName(customState.title || "統計").slice(0, 31));
  downloadWorkbook(wb, `${customState.title || "客製化統計"}.xlsx`);
});

renderCustomTable();
