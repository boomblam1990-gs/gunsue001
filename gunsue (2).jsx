import React, { useState, useMemo, useRef } from "react";

/* ============================================================
   ★ ตั้งค่าหลัก
   ============================================================ */
const NAME = "กุนซือ";
const NAME_EN = "Gunsue · Strategic Advisor";
const VERSION = "5.2.0";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL_PREVIEW = "claude-sonnet-4-6";
const MAX_TOKENS = 4096;
const DEFAULT_PROVIDER = "puter";   // ★ ใช้ฟรีสำหรับทุกคน ไม่ตัดโทเคนผู้พัฒนา (สลับเป็น "anthropic" ได้ถ้าต้องการ)
const DEFAULT_THEME = "light";
const DEV = { name: "อรรถพล ภักดี", role: "นักวิชาการสาธารณสุขปฏิบัติการ", unit: "กลุ่มงานพัฒนายุทธศาสตร์สาธารณสุข", org: "สำนักงานสาธารณสุขจังหวัดพิษณุโลก" };

const PROVIDERS = {
  puter:      { label: "ใช้ฟรี · ไม่ต้องมีคีย์ (Puter)", def: "gpt-4o-mini", sugg: ["gpt-4o-mini", "gpt-4.1-nano", "claude-sonnet-4", "gemini-2.0-flash"], keyless: true },
  anthropic:  { label: "Claude", def: "claude-sonnet-5", sugg: ["claude-sonnet-5", "claude-opus-4-8", "claude-haiku-4-5"], keyHint: "sk-ant-..." },
  google:     { label: "Gemini (Google) · มีชั้นฟรี", def: "gemini-2.0-flash", sugg: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"], keyHint: "AIza...", free: true },
  openai:     { label: "ChatGPT (OpenAI)", def: "gpt-4o", sugg: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "o4-mini"], keyHint: "sk-..." },
  compatible: { label: "อื่น ๆ (OpenAI-compatible)", def: "", sugg: ["deepseek-chat", "grok-2", "qwen-max"], keyHint: "คีย์ของผู้ให้บริการ" },
};
let puterPromise = null;
function loadPuter() {
  if (typeof window !== "undefined" && window.puter) return Promise.resolve();
  if (puterPromise) return puterPromise;
  puterPromise = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://js.puter.com/v2/"; s.async = true;
    s.onload = () => res(); s.onerror = () => rej(new Error("puter-load"));
    document.head.appendChild(s);
  });
  return puterPromise;
}

/* ============================================================
   1) ตรรกะเครื่องยนต์
   ============================================================ */
const PURPOSES = {
  policy:    { label: "กำหนดนโยบาย",            group: "A", fw: ["PESTEL", "Stakeholder", "Scenario", "Policy Options", "Cost–Benefit"], def: { org: "national", user: "exec", h: "y5" } },
  strategy:  { label: "วางยุทธศาสตร์องค์กร",     group: "A", fw: ["SWOT", "TOWS", "VRIO", "Strategy Map", "BSC", "OKR"],                 def: { org: "org", user: "mid", h: "y3" } },
  foresight: { label: "คาดการณ์อนาคต",          group: "A", fw: ["Horizon Scanning", "Scenario", "Delphi", "Megatrend"],                def: { org: "national", user: "exec", h: "y5" } },
  problem:   { label: "แก้ปัญหา",               group: "B", fw: ["Problem Tree", "5 Whys", "Fishbone", "TOWS (WT/WO)"],                 def: { org: "org", user: "super", h: "y1" } },
  choice:    { label: "เลือกทางเลือก",          group: "B", fw: ["Decision Matrix", "MCDA", "Cost–Benefit"],                            def: { org: "org", user: "mid", h: "y1" } },
  allocate:  { label: "จัดสรรงบ/ลำดับสำคัญ",     group: "B", fw: ["Impact–Effort", "MoSCoW", "Portfolio Matrix"],                       def: { org: "org", user: "mid", h: "y3" } },
  plan:      { label: "จัดทำแผนงาน/โครงการ",     group: "C", fw: ["Logframe", "Theory of Change", "OKR", "RACI", "WBS"],                def: { org: "team", user: "practitioner", h: "y1" } },
  change:    { label: "ปฏิรูป/บริหารการเปลี่ยนแปลง", group: "C", fw: ["Kotter", "ADKAR", "Force Field", "Stakeholder"],                def: { org: "org", user: "mid", h: "y3" } },
  crisis:    { label: "รับมือวิกฤต/ความเสี่ยง",   group: "D", fw: ["Risk Register", "Scenario", "Contingency", "Trigger Points"],       def: { org: "org", user: "exec", h: "urgent" } },
  evaluate:  { label: "ประเมินผล/ทบทวน",         group: "D", fw: ["Logic Model", "Gap Analysis", "KPI Review", "After-Action Review"], def: { org: "org", user: "mid", h: "y1" } },
};
const GROUPS = { A: "ตั้งทิศ / มองอนาคต", B: "ตัดสินใจ / เลือก", C: "ลงมือ", D: "รับมือ / ทบทวน" };
const GC = { A: "#7C5CF7", B: "#EC4899", C: "#10B981", D: "#F59E0B" };
const HORIZONS = {
  urgent: { label: "ระยะเร่งด่วน/วิกฤติ · 0–3 เดือน", add: ["Triage", "Contingency"], stripForesight: true },
  m6:     { label: "ระยะ 6 เดือน",  add: ["OKR"],      stripForesight: true },
  y1:     { label: "ระยะ 1 ปี",     add: ["OKR"],      stripForesight: false },
  y3:     { label: "ระยะ 3 ปี",     add: ["Roadmap"],  stripForesight: false },
  y5:     { label: "ระยะ 5 ปี",     add: ["Scenario", "Horizon Scanning"], stripForesight: false },
};
const ORG = {
  national: { label: "ชาติ / นโยบายสาธารณะ", unit: "ระบบระดับประเทศ ผลลัพธ์เชิงนโยบาย stakeholder ข้ามกระทรวง" },
  ministry: { label: "กระทรวง / กรม",       unit: "ภารกิจและงบของหน่วยงาน สอดคล้องนโยบายชาติ" },
  region:   { label: "จังหวัด / เขต",       unit: "บริบทและทรัพยากรพื้นที่ แปลงนโยบายสู่ปฏิบัติ" },
  org:      { label: "องค์กร / หน่วยงาน",    unit: "ขีดความสามารถภายในองค์กร ตัวชี้วัดระดับองค์กร" },
  team:     { label: "ทีม / โครงการ",       unit: "งานและกิจกรรม ตัวชี้วัดระดับปฏิบัติการ" },
};
const USER = {
  exec:        { label: "ผู้บริหารระดับสูง",  style: "นำด้วยบทสรุปผู้บริหาร 2–3 บรรทัด แล้วเน้นทางเลือก ความเสี่ยง และข้อเสนอเพื่อตัดสินใจ สั้น กระชับ" },
  mid:         { label: "ผู้บริหารระดับกลาง", style: "เชื่อมยุทธศาสตร์กับการปฏิบัติ ระบุแผน ทรัพยากรที่ต้องใช้ และตัวชี้วัด" },
  super:       { label: "หัวหน้างาน",        style: "เน้นแผนงาน การมอบหมายงานแบบ RACI และแนวทางติดตามงาน" },
  practitioner:{ label: "ผู้ปฏิบัติ / นักวิเคราะห์", style: "ลงรายละเอียด ต้องมีหัวข้อ 'ข้อมูลที่ต้องเตรียม' และ 'วิธีทำทีละขั้น' พร้อมเทมเพลต/ตารางที่ใช้ได้จริง" },
};
const SECTORS = ["การแพทย์และสาธารณสุข", "การศึกษา", "เศรษฐกิจ/การคลัง", "ความมั่นคง", "สิ่งแวดล้อม", "คมนาคม", "เกษตร", "ดิจิทัล/เทคโนโลยี", "สังคม/สวัสดิการ", "แรงงาน", "ท่องเที่ยว", "ยุติธรรม", "อื่นๆ"];
const HEALTH = "การแพทย์และสาธารณสุข";
const FORESIGHT = ["Scenario", "Horizon Scanning", "Delphi", "Megatrend"];
const FOLLOW = [
  { key: "strategy", label: "กำหนดกลยุทธ์", deliver: "แผนกลยุทธ์ที่พร้อมใช้: วิสัยทัศน์ ประเด็นยุทธศาสตร์ เป้าประสงค์ กลยุทธ์หลัก และตัวชี้วัดระดับกลยุทธ์" },
  { key: "policy", label: "กำหนดนโยบาย", deliver: "ข้อเสนอเชิงนโยบาย: หลักการและเหตุผล ทางเลือกนโยบาย 2–3 แบบพร้อมข้อดี/ข้อเสีย ข้อเสนอที่แนะนำ และกลไกขับเคลื่อน" },
  { key: "plan", label: "จัดทำโครงการ", deliver: "โครงการที่พร้อมเสนอในรูป Logframe: หลักการเหตุผล วัตถุประสงค์ กลุ่มเป้าหมาย กิจกรรมหลัก ตัวชี้วัดผลผลิต/ผลลัพธ์ งบประมาณโดยสังเขป ผู้รับผิดชอบ และไทม์ไลน์" },
  { key: "allocate", label: "จัดลำดับ/จัดสรรงบ", deliver: "ผลการจัดลำดับความสำคัญ: เกณฑ์การให้คะแนน ตารางคะแนนแต่ละรายการ ลำดับผลลัพธ์ และเหตุผลประกอบ" },
  { key: "crisis", label: "รับมือความเสี่ยง", deliver: "แผนบริหารความเสี่ยง: ทะเบียนความเสี่ยง (โอกาส×ผลกระทบ) มาตรการรับมือ จุดกระตุ้น (trigger) และผู้รับผิดชอบ" },
  { key: "evaluate", label: "วางตัวชี้วัด/ประเมินผล", deliver: "กรอบติดตามประเมินผล: Logic Model ตัวชี้วัดนำ/ตาม วิธีเก็บข้อมูล รอบการประเมิน และเกณฑ์ความสำเร็จ" },
];
const EXTRAS = {
  slides: { label: "โครงสไลด์นำเสนอ", prompt: (b) => `ออกแบบโครงสไลด์นำเสนอ 8–12 สไลด์ จากผลวิเคราะห์ด้านล่าง ภาษาไทย Markdown ใช้รูปแบบ "## สไลด์ N: หัวข้อ" ตามด้วยหัวข้อย่อยเป็น bullet สั้น\n\n${b}` },
  qa: { label: "Q&A เตรียมตอบกรรมการ", prompt: (b) => `คาดการณ์คำถามที่กรรมการ/ผู้บริหารน่าจะถาม 8–10 ข้อ จากผลวิเคราะห์ด้านล่าง พร้อมแนวคำตอบที่หนักแน่น ภาษาไทย Markdown จัดเป็น "### Q: ..." แล้วบรรทัด "A: ..."\n\n${b}` },
  memo: { label: "บันทึกเสนอผู้บริหาร", prompt: (b) => `ร่างบันทึกข้อความราชการเสนอผู้บริหาร จากผลวิเคราะห์ด้านล่าง ภาษาไทย Markdown มีหัวข้อ: เรื่อง / เรียน / ต้นเรื่อง / ข้อเท็จจริง / ข้อพิจารณา / ข้อเสนอเพื่อโปรดพิจารณา\n\n${b}` },
  action: { label: "แผนปฏิบัติการ + RACI", prompt: (b) => `จัดทำแผนปฏิบัติการจากผลวิเคราะห์ด้านล่าง ภาษาไทย Markdown เป็นตาราง: กิจกรรม | ผู้รับผิดชอบ (R/A/C/I) | ระยะเวลา | ตัวชี้วัด | งบโดยสังเขป อย่างน้อย 6 กิจกรรม\n\n${b}` },
  risk: { label: "ทะเบียนความเสี่ยง", prompt: (b) => `จัดทำทะเบียนความเสี่ยงจากผลวิเคราะห์ด้านล่าง ภาษาไทย Markdown เป็นตาราง: ความเสี่ยง | โอกาส | ผลกระทบ | ระดับ | มาตรการรับมือ | ผู้รับผิดชอบ อย่างน้อย 6 รายการ\n\n${b}` },
  kpi: { label: "ชุดตัวชี้วัด (KPI)", prompt: (b) => `ออกแบบชุดตัวชี้วัดจากผลวิเคราะห์ด้านล่าง ภาษาไทย Markdown เป็นตาราง: ตัวชี้วัด | ประเภท (นำ/ตาม) | เป้าหมาย | วิธีเก็บข้อมูล | ความถี่ | ผู้รับผิดชอบ อย่างน้อย 6 ตัว\n\n${b}` },
  swot: { label: "SWOT/TOWS สรุป", prompt: (b) => `สรุปเป็นตาราง SWOT และ TOWS จากผลวิเคราะห์ด้านล่าง ภาษาไทย Markdown: ตาราง SWOT (ด้านละ ≥3) และตาราง TOWS (SO/ST/WO/WT ช่องละ ≥1 กลยุทธ์)\n\n${b}` },
};
const FW_META = {
  "PESTEL": { why: "สแกนแรงภายนอก 6 ด้านอย่างเป็นระบบ กันการมองข้ามปัจจัยมหภาค", ref: "Aguilar (1967)" },
  "SWOT": { why: "สรุปปัจจัยภายใน–ภายนอกเป็นภาพเดียว ใช้เป็นฐานตั้งกลยุทธ์", ref: "Learned, Christensen, Andrews & Guth (1965)" },
  "TOWS": { why: "แปลง SWOT เป็นทางเลือกกลยุทธ์ 4 แบบ (SO/ST/WO/WT)", ref: "Weihrich (1982)" },
  "Stakeholder": { why: "ระบุผู้มีส่วนได้เสีย จัดระดับตามอำนาจ–ความสนใจ วางกลยุทธ์การมีส่วนร่วม", ref: "Freeman (1984); Mendelow (1991)" },
  "Scenario": { why: "วางแผนเผื่ออนาคตหลายฉากภายใต้ความไม่แน่นอนสูง หากลยุทธ์ที่ทนทานทุกฉาก", ref: "Wack/Shell (1970s); Schwartz (1991)" },
  "Policy Options": { why: "สร้างและเทียบทางเลือกนโยบายด้วยเกณฑ์ชัดเจน สู่ข้อเสนอที่ตัดสินใจได้", ref: "Bardach, Eightfold Path" },
  "Cost–Benefit": { why: "ตีค่าผลได้–ผลเสียเป็นหน่วยเทียบกันได้ ประเมินความคุ้มค่า", ref: "Boardman et al." },
  "VRIO": { why: "ประเมินว่าทรัพยากรใดเป็นแต้มต่อยั่งยืน (มีค่า/หายาก/ลอกยาก/องค์กรใช้ได้)", ref: "Barney (1991, 1995)" },
  "Strategy Map": { why: "ร้อยวัตถุประสงค์เชิงกลยุทธ์เป็นความสัมพันธ์เหตุ–ผล 4 มุมมอง", ref: "Kaplan & Norton (2004)" },
  "BSC": { why: "แปลงยุทธศาสตร์เป็นตัวชี้วัดสมดุล 4 มุมมอง (ภาครัฐวางประชาชนบนสุด)", ref: "Kaplan & Norton (1992, 1996)" },
  "OKR": { why: "ตั้งเป้าหมายท้าทายพร้อมผลลัพธ์หลักที่วัดได้ เชื่อมกลยุทธ์สู่การลงมือ", ref: "Grove (Intel); Doerr (2018)" },
  "Horizon Scanning": { why: "ค้นหาสัญญาณอ่อน/แนวโน้มอุบัติใหม่ก่อนกลายเป็นประเด็นใหญ่", ref: "OECD/UK Foresight" },
  "Delphi": { why: "รวบรวมความเห็นผู้เชี่ยวชาญหลายรอบจนได้ฉันทามติ เมื่อข้อมูลจำกัด", ref: "Dalkey & Helmer, RAND (1963)" },
  "Megatrend": { why: "ระบุแนวโน้มใหญ่ระยะยาวที่กำหนดทิศบริบท", ref: "Naisbitt (1982)" },
  "Problem Tree": { why: "แยกสาเหตุ–แก่นปัญหา–ผลกระทบเป็นโครงสร้างต้นไม้ ก่อนออกแบบทางแก้", ref: "GTZ ZOPP / LFA" },
  "5 Whys": { why: "ถามซ้ำจนถึงสาเหตุราก ไม่แก้ที่ปลายเหตุ", ref: "Toyoda; Toyota Production System" },
  "Fishbone": { why: "จัดกลุ่มสาเหตุที่เป็นไปได้ตามหมวด เห็นเหตุปัจจัยรอบด้าน", ref: "Ishikawa (1968)" },
  "Decision Matrix": { why: "ให้คะแนนทางเลือกตามเกณฑ์ถ่วงน้ำหนัก ลดอคติในการเลือก", ref: "Pugh Matrix" },
  "MCDA": { why: "ตัดสินใจภายใต้หลายเกณฑ์ที่ขัดกัน ด้วยวิธีเชิงปริมาณ", ref: "Keeney & Raiffa (1976)" },
  "Impact–Effort": { why: "จัดลำดับงานตามผลกระทบเทียบแรงที่ลง หา quick wins", ref: "Prioritization Matrix" },
  "MoSCoW": { why: "จัดลำดับความจำเป็น Must/Should/Could/Won't ภายใต้ทรัพยากรจำกัด", ref: "Clegg, DSDM (1994)" },
  "Portfolio Matrix": { why: "จัดสรรทรัพยากรข้ามชุดงาน/โครงการตามความน่าสนใจ–ความสามารถ", ref: "BCG (1970); GE–McKinsey" },
  "Logframe": { why: "เชื่อมกิจกรรม–ผลผลิต–ผลลัพธ์–ตัวชี้วัด–สมมติฐานในตารางเดียว", ref: "PCI for USAID (1969)" },
  "Theory of Change": { why: "อธิบายเส้นทางเหตุ–ผลจากกิจกรรมสู่การเปลี่ยนแปลง พร้อมสมมติฐาน", ref: "Weiss (1995); Aspen Institute" },
  "RACI": { why: "กำหนดบทบาทชัด (รับผิดชอบ/อนุมัติ/ปรึกษา/แจ้ง) กันงานตกหล่น–ซ้ำซ้อน", ref: "Responsibility Assignment Matrix (PMI)" },
  "WBS": { why: "ย่อยงานใหญ่เป็นชิ้นบริหารได้ ครอบคลุมขอบเขตครบ", ref: "Work Breakdown Structure (PMI)" },
  "Kotter": { why: "นำการเปลี่ยนแปลงองค์กรผ่าน 8 ขั้น จากสร้างความเร่งด่วนถึงฝังวัฒนธรรม", ref: "Kotter, Leading Change (1996)" },
  "ADKAR": { why: "บริหารการเปลี่ยนแปลงระดับบุคคล (ตระหนัก–อยาก–รู้–ทำได้–คงอยู่)", ref: "Hiatt/Prosci (2003)" },
  "Force Field": { why: "ชั่งแรงหนุน–แรงต้าน วางกลยุทธ์เพิ่มแรงหนุน/ลดแรงต้าน", ref: "Lewin (1951)" },
  "Risk Register": { why: "บันทึกความเสี่ยง จัดระดับโอกาส×ผลกระทบ พร้อมมาตรการรับมือ", ref: "ISO 31000" },
  "Contingency": { why: "เตรียมแผนสำรองสำหรับเหตุไม่พึงประสงค์ ลดผลกระทบเมื่อเกิดจริง", ref: "Business Continuity (ISO 22301)" },
  "Trigger Points": { why: "กำหนดเกณฑ์/จุดที่ต้องสลับไปใช้แผนสำรองอย่างชัดเจน", ref: "BCM practice" },
  "Logic Model": { why: "เชื่อมทรัพยากร–กิจกรรม–ผลผลิต–ผลลัพธ์ เป็นฐานติดตามประเมินผล", ref: "W.K. Kellogg Foundation" },
  "Gap Analysis": { why: "เทียบสถานะปัจจุบันกับเป้าหมาย ระบุช่องว่างที่ต้องปิด", ref: "Strategic Planning practice" },
  "KPI Review": { why: "ทบทวนตัวชี้วัดเทียบเป้า วิเคราะห์ส่วนต่างเพื่อปรับการดำเนินงาน", ref: "Kaplan & Norton" },
  "After-Action Review": { why: "ถอดบทเรียนหลังปฏิบัติ (คาดว่า/เกิดจริง/ทำไม/ปรับอย่างไร)", ref: "US Army AAR" },
  "Triage": { why: "คัดกรองจัดลำดับความเร่งด่วนเมื่อทรัพยากรจำกัดในภาวะวิกฤต", ref: "Emergency Triage" },
  "Roadmap": { why: "วางลำดับริเริ่มตามเวลา เห็นเส้นทางจากปัจจุบันสู่เป้าหมาย", ref: "Roadmapping (Phaal et al.)" },
  "6BB+1": { why: "ประเมินความเข้มแข็งของระบบสุขภาพครบ 6 เสาหลัก WHO + พลังการมีส่วนร่วมของประชาชน (Plus One) — เหมาะกับโจทย์สายสาธารณสุข", ref: "WHO Health System Building Blocks (2007) + Community Participation (Plus One)" },
};
const fwMeta = (name) => FW_META[name] || FW_META[name.split(" (")[0]] || { why: "—", ref: "—" };
function routeFrameworks(purposeKeys, horizonKey, sectorList = []) {
  let base = [];
  purposeKeys.forEach((pk) => (PURPOSES[pk]?.fw || []).forEach((f) => { if (!base.includes(f)) base.push(f); }));
  const h = HORIZONS[horizonKey]; let struck = [];
  if (h.stripForesight) { struck = base.filter((f) => FORESIGHT.includes(f)); base = base.filter((f) => !FORESIGHT.includes(f)); }
  const active = [...base]; h.add.forEach((f) => { if (!active.includes(f)) active.push(f); });
  // เลนส์เฉพาะสายสาธารณสุข
  if (sectorList.includes(HEALTH) && purposeKeys.length && !active.includes("6BB+1")) active.push("6BB+1");
  return { active, struck };
}
const TABS = [
  { k: "report", ic: "📊", label: "รายงาน" },
  { k: "onepager", ic: "📄", label: "บทสรุป 1 หน้า" },
  { k: "prep", ic: "🧭", label: "เตรียมข้อมูล" },
  { k: "extra", ic: "✨", label: "รูปแบบอื่น ๆ" },
  { k: "tools", ic: "🛠️", label: "เครื่องมือ & อ้างอิง" },
  { k: "mindmap", ic: "🗺️", label: "มายด์แมพ" },
];

/* ============================================================
   2) Markdown
   ============================================================ */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function parseBlocks(text) {
  const lines = String(text).replace(/\r/g, "").split("\n");
  const blocks = []; let i = 0, para = [], bullets = [];
  const fP = () => { if (para.length) { blocks.push({ t: "p", v: para.join(" ") }); para = []; } };
  const fB = () => { if (bullets.length) { blocks.push({ t: "ul", v: bullets }); bullets = []; } };
  const isSep = (s) => s.includes("-") && /^\|?[\s:|-]+\|?$/.test(s);
  const pr = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  while (i < lines.length) {
    const tr = lines[i].trim();
    if (tr.startsWith("|")) {
      fP(); fB(); const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { rows.push(lines[i].trim()); i++; }
      if (rows.length === 1) { blocks.push({ t: "p", v: pr(rows[0]).filter(Boolean).join(" · ") }); continue; }
      let header, body;
      if (isSep(rows[1])) { header = pr(rows[0]); body = rows.slice(2).map(pr); }
      else { header = pr(rows[0]); body = rows.slice(1).filter((r) => !isSep(r)).map(pr); }
      body = body.filter((r) => r.some((c) => c !== ""));
      blocks.push({ t: "table", header, body }); continue;
    }
    if (tr.startsWith("### ")) { fP(); fB(); blocks.push({ t: "h3", v: tr.slice(4) }); i++; continue; }
    if (tr.startsWith("## ")) { fP(); fB(); blocks.push({ t: "h2", v: tr.slice(3) }); i++; continue; }
    if (tr.startsWith("# ")) { fP(); fB(); blocks.push({ t: "h2", v: tr.slice(2) }); i++; continue; }
    if (/^[-–—]{3,}$/.test(tr)) { fP(); fB(); blocks.push({ t: "hr" }); i++; continue; }
    if (tr.startsWith("> ")) { fP(); fB(); blocks.push({ t: "quote", v: tr.slice(2) }); i++; continue; }
    if (/^[-*]\s+/.test(tr)) { fP(); bullets.push(tr.replace(/^[-*]\s+/, "")); i++; continue; }
    if (tr === "") { fP(); fB(); i++; continue; }
    fB(); para.push(tr); i++;
  }
  fP(); fB(); return blocks;
}
function Inline({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) => p.startsWith("**") && p.endsWith("**")
    ? <strong key={i} style={{ color: "var(--text)", fontWeight: 700 }}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>)}</>;
}
function Markdown({ text }) {
  const blocks = parseBlocks(text);
  return <div className="md">{blocks.map((b, k) => {
    if (b.t === "h2") return <h2 key={k} className="md-h2"><Inline text={b.v} /></h2>;
    if (b.t === "h3") return <h3 key={k} className="md-h3"><Inline text={b.v} /></h3>;
    if (b.t === "p") return <p key={k} className="md-p"><Inline text={b.v} /></p>;
    if (b.t === "hr") return <div key={k} className="md-hr" />;
    if (b.t === "quote") return <blockquote key={k} className="md-quote"><Inline text={b.v} /></blockquote>;
    if (b.t === "ul") return <ul key={k} className="md-ul">{b.v.map((x, j) => <li key={j}><Inline text={x} /></li>)}</ul>;
    if (b.t === "table") return <div key={k} className="md-table-wrap"><table className="md-table">
      <thead><tr>{b.header.map((h, j) => <th key={j}><Inline text={h} /></th>)}</tr></thead>
      <tbody>{b.body.map((row, r) => <tr key={r}>{row.map((c, j) => <td key={j}><Inline text={c} /></td>)}</tr>)}</tbody></table></div>;
    return null;
  })}</div>;
}
function blocksToHtml(blocks) {
  const inl = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return blocks.map((b) => {
    if (b.t === "h2") return `<h2>${inl(b.v)}</h2>`;
    if (b.t === "h3") return `<h3>${inl(b.v)}</h3>`;
    if (b.t === "p") return `<p>${inl(b.v)}</p>`;
    if (b.t === "hr") return `<hr/>`;
    if (b.t === "quote") return `<blockquote>${inl(b.v)}</blockquote>`;
    if (b.t === "ul") return `<ul>${b.v.map((x) => `<li>${inl(x)}</li>`).join("")}</ul>`;
    if (b.t === "table") return `<table class="rpt"><tr>${b.header.map((h) => `<th>${inl(h)}</th>`).join("")}</tr>${b.body.map((r) => `<tr>${r.map((c) => `<td>${inl(c)}</td>`).join("")}</tr>`).join("")}</table>`;
    return "";
  }).join("");
}

/* ============================================================
   3) มายด์แมพ
   ============================================================ */
function MindMap({ data }) {
  const branches = (data && data.branches) || [];
  const rowH = 50; let y = 0;
  const layout = branches.map((b) => {
    const kids = (b.children || []).map((name) => ({ name, y: (y++) * rowH + rowH / 2 }));
    let by; if (kids.length) by = (kids[0].y + kids[kids.length - 1].y) / 2; else by = (y++) * rowH + rowH / 2;
    return { name: b.name, y: by, kids };
  });
  const totalH = Math.max(y * rowH, 160);
  const rootY = layout.length ? (layout[0].y + layout[layout.length - 1].y) / 2 : totalH / 2;
  const rootX = 14, rootW = 152, bX = 208, bW = 176, cX = 430, cW = 196, W = cX + cW + 16;
  const curve = (x1, y1, x2, y2) => { const mx = (x1 + x2) / 2; return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`; };
  return (
    <div className="mm-scroll">
      <svg width={W} height={totalH} className="mm-svg">
        {layout.map((b, bi) => (<g key={bi}>
          <path d={curve(rootX + rootW, rootY, bX, b.y)} className="mm-link" />
          {b.kids.map((k, ki) => <path key={ki} d={curve(bX + bW, b.y, cX, k.y)} className="mm-link" />)}
        </g>))}
        <foreignObject x={rootX} y={rootY - 24} width={rootW} height={48}><div xmlns="http://www.w3.org/1999/xhtml" className="mm-node mm-root">{data.root || "หัวข้อ"}</div></foreignObject>
        {layout.map((b, bi) => (<g key={"n" + bi}>
          <foreignObject x={bX} y={b.y - 21} width={bW} height={42}><div xmlns="http://www.w3.org/1999/xhtml" className="mm-node mm-branch">{b.name}</div></foreignObject>
          {b.kids.map((k, ki) => (<foreignObject key={ki} x={cX} y={k.y - 19} width={cW} height={38}><div xmlns="http://www.w3.org/1999/xhtml" className="mm-node mm-child">{k.name}</div></foreignObject>))}
        </g>))}
      </svg>
    </div>
  );
}

/* ============================================================
   4) แอปหลัก
   ============================================================ */
export default function Gunsue() {
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [topic, setTopic] = useState("สังคมผู้สูงอายุ");
  const [sectors, setSectors] = useState([HEALTH]);
  const [customSector, setCustomSector] = useState("");
  const [purposes, setPurposes] = useState(["policy"]);
  const [org, setOrg] = useState("national");
  const [userLv, setUserLv] = useState("exec");
  const [horizon, setHorizon] = useState("y5");
  const [touched, setTouched] = useState({ org: false, user: false, h: false });
  const [context, setContext] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [showConn, setShowConn] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const [grounding, setGrounding] = useState(false);
  const [files, setFiles] = useState([]);
  const fileRef = useRef(null);

  const [provider, setProvider] = useState(DEFAULT_PROVIDER);
  const [userKey, setUserKey] = useState("");
  const [model, setModel] = useState(PROVIDERS[DEFAULT_PROVIDER].def);
  const [baseUrl, setBaseUrl] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [ranSig, setRanSig] = useState("");
  const [ranConfig, setRanConfig] = useState(null);
  const [sources, setSources] = useState([]);
  const [usedGrounding, setUsedGrounding] = useState(false);

  const [view, setView] = useState("report");
  const [onepager, setOnepager] = useState(""); const [opLoading, setOpLoading] = useState(false); const [opErr, setOpErr] = useState("");
  const [prep, setPrep] = useState(""); const [prepLoading, setPrepLoading] = useState(false); const [prepErr, setPrepErr] = useState("");
  const [extra, setExtra] = useState(""); const [extraKey, setExtraKey] = useState(""); const [extraLoading, setExtraLoading] = useState(false); const [extraErr, setExtraErr] = useState("");
  const [mindmap, setMindmap] = useState(null); const [mmLoading, setMmLoading] = useState(false); const [mmError, setMmError] = useState("");
  const [fwOpen, setFwOpen] = useState(null);
  const [copied, setCopied] = useState(false);
  const [refine, setRefine] = useState("");

  const { active, struck } = useMemo(() => routeFrameworks(purposes, horizon, sectors), [purposes, horizon, sectors]);
  const allSectors = () => sectors.map((s) => (s === "อื่นๆ" && customSector.trim() ? customSector.trim() : s));
  const canGround = provider === "anthropic";
  const keyless = !!PROVIDERS[provider].keyless;
  const sig = JSON.stringify({ topic, sectors, customSector, purposes, org, userLv, horizon, context, grounding, provider, files: files.map((f) => f.name) });
  const dirty = ranSig && sig !== ranSig;
  const usedFw = (ranConfig && ranConfig.frameworks) || active;

  const toggle = (arr, setArr, key) => setArr(arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key]);
  const togglePurpose = (key) => {
    const next = purposes.includes(key) ? purposes.filter((k) => k !== key) : [...purposes, key];
    setPurposes(next); const primary = next[0];
    if (primary) { if (!touched.org) setOrg(PURPOSES[primary].def.org); if (!touched.user) setUserLv(PURPOSES[primary].def.user); if (!touched.h) setHorizon(PURPOSES[primary].def.h); }
  };
  const setLevel = (which, val) => {
    if (which === "org") setOrg(val); if (which === "user") setUserLv(val); if (which === "h") setHorizon(val);
    setTouched((t) => ({ ...t, [which]: true }));
  };
  const pickProvider = (k) => { setProvider(k); setModel(PROVIDERS[k].def); if (k !== "anthropic") setGrounding(false); };

  const readFile = (file) => new Promise((resolve) => {
    const name = file.name, type = file.type || "";
    const isImg = /^image\//.test(type) || /\.(png|jpe?g|webp|gif)$/i.test(name);
    const isPdf = type === "application/pdf" || /\.pdf$/i.test(name);
    const r = new FileReader();
    if (isImg) { r.onload = () => resolve({ name, kind: "image", media: type || "image/png", data: String(r.result).split(",")[1] }); r.readAsDataURL(file); }
    else if (isPdf) { r.onload = () => resolve({ name, kind: "pdf", data: String(r.result).split(",")[1] }); r.readAsDataURL(file); }
    else { r.onload = () => resolve({ name, kind: "text", text: String(r.result).slice(0, 4000) }); r.readAsText(file); }
  });
  const handleFiles = async (e) => {
    const picked = Array.from(e.target.files || []).slice(0, 5 - files.length);
    const read = await Promise.all(picked.map(readFile));
    setFiles((prev) => [...prev, ...read].slice(0, 5));
    if (fileRef.current) fileRef.current.value = "";
  };
  const removeFile = (name) => setFiles((prev) => prev.filter((f) => f.name !== name));

  const modelName = () => model.trim() || PROVIDERS[provider].def;
  async function callAI(promptText, opts = {}) {
    const key = userKey.trim();
    const imgs = opts.attachFiles ? files.filter((f) => f.kind === "image") : [];
    const pdfs = opts.attachFiles ? files.filter((f) => f.kind === "pdf") : [];
    const txtf = opts.attachFiles ? files.filter((f) => f.kind === "text") : [];
    const full = (txtf.length ? txtf.map((f) => `[ไฟล์แนบ: ${f.name}]\n${f.text}`).join("\n\n") + "\n\n" : "") + promptText;

    if (provider === "puter") {
      await loadPuter();
      if (!window.puter || !window.puter.ai || !window.puter.ai.chat) throw new Error("puter-unavailable");
      const resp = await window.puter.ai.chat(full, { model: modelName() });
      let text = "";
      if (typeof resp === "string") text = resp;
      else if (resp && resp.message) { const c = resp.message.content; text = typeof c === "string" ? c : (Array.isArray(c) ? c.map((x) => x.text || "").join("") : ""); }
      else if (resp && resp.text) text = resp.text;
      else text = String(resp || "");
      return { text, sources: [] };
    }
    if (provider === "anthropic") {
      const headers = { "Content-Type": "application/json" };
      let mdl = MODEL_PREVIEW;
      if (key) { headers["x-api-key"] = key; headers["anthropic-version"] = "2023-06-01"; headers["anthropic-dangerous-direct-browser-access"] = "true"; mdl = modelName(); }
      const content = [];
      pdfs.forEach((f) => content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data } }));
      imgs.forEach((f) => content.push({ type: "image", source: { type: "base64", media_type: f.media, data: f.data } }));
      content.push({ type: "text", text: full });
      const body = { model: mdl, max_tokens: opts.maxOut || MAX_TOKENS, messages: [{ role: "user", content }] };
      if (opts.web) body.tools = [{ type: "web_search_20250305", name: "web_search" }];
      const res = await fetch(ANTHROPIC_URL, { method: "POST", headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const srcs = []; (data.content || []).forEach((b) => { if (b.type === "web_search_tool_result" && Array.isArray(b.content)) b.content.forEach((r) => { if (r && r.url) srcs.push({ url: r.url, title: r.title || r.url }); }); });
      return { text, sources: srcs };
    }
    if (provider === "openai" || provider === "compatible") {
      if (!key) throw new Error("no-key");
      const url = provider === "compatible" ? baseUrl.trim().replace(/\/+$/, "") + "/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
      const content = imgs.length ? [{ type: "text", text: full }, ...imgs.map((f) => ({ type: "image_url", image_url: { url: `data:${f.media};base64,${f.data}` } }))] : full;
      const body = { model: modelName(), messages: [{ role: "user", content }], max_tokens: opts.maxOut || MAX_TOKENS };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      return { text: data.choices?.[0]?.message?.content || "", sources: [] };
    }
    if (provider === "google") {
      if (!key) throw new Error("no-key");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName()}:generateContent?key=${encodeURIComponent(key)}`;
      const parts = [{ text: full }, ...imgs.map((f) => ({ inline_data: { mime_type: f.media, data: f.data } }))];
      const body = { contents: [{ parts }], generationConfig: { maxOutputTokens: opts.maxOut || MAX_TOKENS } };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
      return { text, sources: [] };
    }
    throw new Error("provider");
  }

  const resetOutputs = () => { setResult(""); setOnepager(""); setPrep(""); setExtra(""); setExtraKey(""); setMindmap(null); setSources([]); };
  const errMsg = (e) => {
    const s = String(e);
    if (s.includes("no-key")) return "กรุณาใส่ API key ของค่ายที่เลือกในเมนู 'การเชื่อมต่อ AI'";
    if (s.includes("puter")) return "เชื่อมต่อบริการฟรี (Puter) ไม่สำเร็จ ลองใหม่ หรือเปิดเมนูการเชื่อมต่อแล้วเลือกค่ายอื่น";
    return "การเรียกใช้ไม่สำเร็จ ตรวจค่าย/คีย์/ชื่อโมเดล แล้วลองใหม่ (บางค่ายอาจบล็อกการเรียกจากเบราว์เซอร์ ต้องใช้ผ่านเซิร์ฟเวอร์)";
  };

  async function generate(opts = {}) {
    const pl = opts.purposes || purposes;
    if (!topic.trim()) { setError("ใส่หัวข้อที่ต้องการวิเคราะห์ก่อน"); return; }
    if (pl.length === 0) { setError("เลือกจุดประสงค์อย่างน้อย 1 ข้อ"); return; }
    if (opts.purposes) setPurposes(opts.purposes);
    setLoading(true); setError(""); resetOutputs(); setView("report");
    const fw = routeFrameworks(pl, horizon, sectors).active;
    const pLabels = pl.map((k, i) => `${i + 1}) ${PURPOSES[k].label}`).join("  ");
    const secStr = allSectors().join(", ");
    setRanConfig({ topic, sectors: secStr, purposes: pl.map((k) => PURPOSES[k].label).join(" + "), org: ORG[org].label, user: USER[userLv].label, hasFiles: files.length, frameworks: fw, provider: PROVIDERS[provider].label });
    const useWeb = !!opts.web && canGround;
    const basis = opts.basis ? `\n[ต่อยอดจากผลวิเคราะห์ก่อนหน้า — ใช้เป็นวัตถุดิบ อย่าวิเคราะห์ซ้ำ ให้พัฒนาต่อ]\n${opts.basis.slice(0, 1600)}\n` : "";
    const deliverLine = opts.deliver ? `\n[ขั้นต่อยอด] ผลิตผลงานที่พร้อมนำไปใช้จริง: ${opts.deliver} — จัดเป็นหัวข้อ ## ชัดเจน มีตารางที่กรอกได้จริง\n` : "";
    const extraLine = opts.extra ? `\n[ข้อมูล/คำสั่งเพิ่มเติมจากผู้ใช้]\n${opts.extra.slice(0, 1200)}\n` : "";
    const fileNote = files.length ? "มีไฟล์แนบ — ดึงข้อมูล/ตัวเลขจากไฟล์มาใช้และระบุว่าอ้างอิงจากเอกสารแนบ\n" : "";
    const webNote = useWeb ? "ใช้การค้นเว็บหาตัวเลข/ข้อเท็จจริงล่าสุดพร้อมอ้างอิง\n" : "";
    const bbNote = fw.includes("6BB+1") ? "[นิยาม 6BB+1] วิเคราะห์ระบบสุขภาพ 7 องค์ประกอบ: 1)การบริการสุขภาพ 2)กำลังคนด้านสุขภาพ 3)ระบบข้อมูลสุขภาพ 4)ยา เวชภัณฑ์ และเทคโนโลยี 5)การเงินการคลังสุขภาพ 6)ภาวะผู้นำและธรรมาภิบาล 7)การมีส่วนร่วมของประชาชน/พลังชุมชน (Plus One) — ทำเป็นตารางประเมินรายองค์ประกอบ (สถานะ/ช่องว่าง/ข้อเสนอ)\n" : "";
    const prompt = `คุณคือเครื่องยนต์วิเคราะห์ยุทธศาสตร์ระดับมืออาชีพ ตอบเป็น Markdown ภาษาไทยเท่านั้น (ไม่มีคำนำ/คำท้ายนอกเนื้อหา)
${basis}${deliverLine}${extraLine}${fileNote}${webNote}${bbNote}[อินพุต]
หัวข้อ: ${topic}
สายงาน: ${secStr}
จุดประสงค์ (ทำตามลำดับ): ${pLabels}
ระดับองค์กร: ${ORG[org].label} | ระดับผู้ใช้: ${USER[userLv].label} | กรอบเวลา: ${HORIZONS[horizon].label}
บริบทเสริม: ${context.trim() || "ไม่ระบุ"}

[กติกา]
1. เริ่มด้วย "## คำถามยุทธศาสตร์" แปลงหัวข้อลอยเป็นคำถามที่ตัดสินใจได้ 1 ประโยค
2. ใช้เฉพาะเฟรมเวิร์กเหล่านี้ เรียงตามตรรกะ (มองสถานการณ์ → สร้างทางเลือก → แปลงเป็นการกระทำ): ${fw.join(", ")}
   แต่ละเฟรมเวิร์ก = หนึ่งหัวข้อ "## " และวงเล็บสั้น ๆ ว่าทำไมเหมาะ พร้อมตาราง Markdown ที่มีเนื้อหาจริง (เขียนตารางให้ครบทุกแถวเสมอ)
3. หน่วยการวิเคราะห์ให้ตรงระดับองค์กร: ${ORG[org].unit}
4. ปรับความลึก/รูปแบบตามผู้ใช้: ${USER[userLv].style}
5. ตัวเลข/ข้อเท็จจริงถือเป็นค่าประมาณ กำกับว่าควรตรวจสอบล่าสุด (เว้นแต่ยืนยันจากไฟล์แนบ/ค้นเว็บ)
6. กระชับ ตรงประเด็น มีสาระ เขียนให้จบสมบูรณ์ทุกหัวข้อ`;
    try {
      const { text, sources: srcs } = await callAI(prompt, { web: useWeb, attachFiles: true });
      const out = text.replace(/```(?:markdown)?/g, "").trim();
      if (!out) throw new Error("empty");
      setResult(out); setSources(srcs); setUsedGrounding(useWeb); setRanSig(sig); setRefine("");
    } catch (e) { setError(errMsg(e)); }
    finally { setLoading(false); }
  }
  const runMain = () => generate({ web: grounding });
  const runFollow = (f) => generate({ purposes: [f.key], basis: result, deliver: f.deliver, web: grounding });
  const runRefine = () => { if (!refine.trim()) return; generate({ basis: result, extra: refine, web: grounding }); };

  async function genInto(setBusy, setErr, setVal, prompt, attachFiles = false, maxOut) {
    setBusy(true); setErr(""); setVal("");
    try {
      const { text } = await callAI(prompt, { attachFiles, maxOut });
      const out = text.replace(/```(?:markdown)?/g, "").trim();
      if (!out) throw new Error("empty"); setVal(out);
    } catch (e) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  }
  const makeOnepager = () => genInto(setOpLoading, setOpErr, setOnepager,
    `สรุปผลวิเคราะห์ด้านล่างเป็น "บทสรุปผู้บริหาร 1 หน้า" ภาษาไทย Markdown มีหัวข้อ: ## บริบท/ประเด็น · ## ข้อค้นพบหลัก (3-5) · ## ข้อเสนอ/ทางเลือก · ## ความเสี่ยงสำคัญ · ## ก้าวถัดไป กระชับ\n\n${result}`);
  const makePrep = () => genInto(setPrepLoading, setPrepErr, setPrep,
    `สร้าง "แนวทางเตรียมความพร้อม" ภาษาไทย Markdown สำหรับ หัวข้อ: ${topic} | สายงาน: ${allSectors().join(", ")} | จุดประสงค์: ${purposes.map((k) => PURPOSES[k].label).join(", ")} | ระดับ: ${ORG[org].label}
ต้องมี (## ) ครบ: ## ข้อมูลที่ต้องเตรียม (ตาราง: รายการข้อมูล|แหล่ง/วิธีได้มา|ทำไมสำคัญ ≥6 แถว) · ## ประเด็นสำคัญที่ต้องคำนึงถึง (bullet 5-7) · ## ผู้มีส่วนได้เสียที่ควรปรึกษา (bullet 4-6) · ## ข้อควรระวัง/กับดักที่พบบ่อย (bullet 4-5) เขียนให้จบสมบูรณ์`, true);
  const runExtra = (key) => { setExtraKey(key); genInto(setExtraLoading, setExtraErr, setExtra, EXTRAS[key].prompt(result)); };
  async function makeMindmap() {
    setMmLoading(true); setMmError(""); setMindmap(null);
    const basis = result ? result.slice(0, 2400) : `หัวข้อ ${topic} / สายงาน ${allSectors().join(", ")} / จุดประสงค์ ${purposes.map((k) => PURPOSES[k].label).join(", ")}`;
    const prompt = `สรุปเนื้อหาต่อไปนี้เป็นมายด์แมพ ภาษาไทย ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นหรือ code fence
รูปแบบ: {"root":"หัวข้อกลางสั้น","branches":[{"name":"กิ่งหลัก","children":["ย่อย","ย่อย"]}]}
กติกา: กิ่งหลัก 4-6 กิ่ง แต่ละกิ่งมีลูก 2-4 ข้อ ข้อความสั้นกระชับ\nเนื้อหา:\n${basis}`;
    try {
      const { text } = await callAI(prompt, { maxOut: 1500 });
      let raw = text.replace(/```(?:json)?/g, "").trim();
      const s = raw.indexOf("{"), e = raw.lastIndexOf("}"); if (s >= 0 && e > s) raw = raw.slice(s, e + 1);
      const obj = JSON.parse(raw); if (!obj.branches || !Array.isArray(obj.branches)) throw new Error("shape");
      setMindmap(obj);
    } catch (e) { setMmError("สร้างมายด์แมพไม่สำเร็จ ลองใหม่อีกครั้ง"); }
    finally { setMmLoading(false); }
  }
  const goTab = (t) => {
    setView(t);
    if (t === "onepager" && !onepager && !opLoading) makeOnepager();
    if (t === "prep" && !prep && !prepLoading) makePrep();
    if (t === "mindmap" && !mindmap && !mmLoading) makeMindmap();
  };
  const copyReport = async () => { try { await navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch (e) {} };

  function exportDoc() {
    if (!result) return;
    const c = ranConfig || {};
    const dateStr = new Date().toLocaleDateString("th-TH");
    const cfgRows = [["หัวข้อ", c.topic || topic], ["สายงาน", c.sectors || allSectors().join(", ")], ["จุดประสงค์", c.purposes || ""], ["ระดับองค์กร", c.org || ""], ["ระดับผู้ใช้", c.user || ""], ["วันที่ออกรายงาน", dateStr]]
      .map((r) => `<tr><td class="k">${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join("");
    let body = `<div class="cover"><div class="brand">${esc(NAME)} · ${esc(NAME_EN)} v${VERSION}</div><h1 class="doctitle">${esc(c.topic || topic)}</h1><table class="cfg">${cfgRows}</table></div>`;
    body += blocksToHtml(parseBlocks(result));
    if (onepager) body += `<h1 class="sec">บทสรุปผู้บริหาร</h1>` + blocksToHtml(parseBlocks(onepager));
    if (prep) body += `<h1 class="sec">แนวทาง &amp; เตรียมข้อมูล</h1>` + blocksToHtml(parseBlocks(prep));
    if (extra) body += `<h1 class="sec">${esc(EXTRAS[extraKey]?.label || "ผลลัพธ์เพิ่มเติม")}</h1>` + blocksToHtml(parseBlocks(extra));
    body += `<h1 class="sec">เครื่องมือที่ใช้และแหล่งอ้างอิงระเบียบวิธี</h1><table class="rpt"><tr><th>เครื่องมือ</th><th>เหตุผลการใช้</th><th>อ้างอิง</th></tr>`;
    usedFw.forEach((f) => { const m = fwMeta(f); body += `<tr><td>${esc(f)}</td><td>${esc(m.why)}</td><td>${esc(m.ref)}</td></tr>`; });
    body += `</table>`;
    if (sources.length) { body += `<h1 class="sec">แหล่งข้อมูลค้นเว็บสด</h1><ol>`; sources.forEach((s) => { body += `<li>${esc(s.title)} — ${esc(s.url)}</li>`; }); body += `</ol>`; }
    body += `<div class="sign">พัฒนาโดย ${esc(DEV.name)} · ${esc(DEV.role)}<br/>${esc(DEV.unit)} ${esc(DEV.org)}</div>`;
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(c.topic || topic)}</title><style>${DOC_CSS}</style></head><body>${body}</body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `${esc(NAME)}_${(c.topic || topic).replace(/[\\/\s]+/g, "_").slice(0, 40)}.doc`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const Chip = ({ on, onClick, children, badge }) => (
    <button type="button" onClick={onClick} className={"chip" + (on ? " chip-on" : "")}>{children}{badge && <span className="chip-badge">{badge}</span>}</button>
  );
  const PChip = ({ on, onClick, children, badge, color }) => (
    <button type="button" onClick={onClick} className={"chip" + (on ? " chip-on" : "")}
      style={on ? { borderColor: color, color, background: color + "1F" } : {}}>
      {children}{badge && <span className="chip-badge" style={{ background: color, color: "#fff" }}>{badge}</span>}
    </button>
  );

  return (
    <div className={"root " + theme}>
      <style>{CSS}</style>
      <header className="head">
        <div className="head-top">
          <div className="brand-mark"><span className="logo">ก</span>
            <div><div className="brand-name">{NAME}</div><div className="eyebrow">เครื่องยนต์บริหารยุทธศาสตร์ · v{VERSION}</div></div>
          </div>
          <button className="theme-btn" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>{theme === "dark" ? "☀ สว่าง" : "🌙 มืด"}</button>
        </div>
        <div className="accent-bar" />
        <p className="sub">{NAME_EN} — ป้อนโจทย์ กุนซือจะเลือกเครื่องมือที่เหมาะพร้อมเหตุผลและแหล่งอ้างอิง แล้ววิเคราะห์ให้ครบทุกมิติ ปรับใช้ได้ทุกหน่วยงาน ทุกระดับ</p>
        <div className="dev">พัฒนาโดย <b>{DEV.name}</b> · {DEV.role} · {DEV.unit} {DEV.org}</div>
        <button className="how-toggle" onClick={() => setShowHow((s) => !s)}>{showHow ? "▾" : "▸"} หลักการทำงานของกุนซือ</button>
        {showHow && (<div className="how">
          <span className="how-step"><b>1 Framing</b> แปลงหัวข้อเป็นคำถามยุทธศาสตร์</span>
          <span className="how-step"><b>2 Routing</b> จุดประสงค์เลือกชุดเครื่องมือ</span>
          <span className="how-step"><b>3 Grounding</b> ไฟล์แนบ + ค้นเว็บ + บริบท</span>
          <span className="how-step"><b>4 Analysis</b> รันเครื่องมือตามลำดับตรรกะ</span>
          <span className="how-step"><b>5 Output</b> หลายรูปแบบ + ต่อยอด + ส่งออก</span>
        </div>)}
      </header>

      <div className="grid">
        <section className="panel">
          <div className="panel-head"><span className="panel-ic">🎯</span><span className="panel-title">ตั้งโจทย์</span></div>
          <label className="field"><span className="lbl">หัวข้อ / ประเด็น</span>
            <textarea className="ta" rows={2} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="เช่น สังคมผู้สูงอายุ" /></label>
          <div className="field"><span className="lbl">สายงาน <em className="hint">— เลือกได้หลายค่า</em></span>
            <div className="chips">{SECTORS.map((s) => <Chip key={s} on={sectors.includes(s)} onClick={() => toggle(sectors, setSectors, s)}>{s}</Chip>)}</div>
            {sectors.includes(HEALTH) && <div className="lens-note">🩺 เปิดเลนส์ <b>6BB+1</b> อัตโนมัติสำหรับสายสาธารณสุข</div>}
            {sectors.includes("อื่นๆ") && <input className="ta" style={{ marginTop: 8 }} value={customSector} onChange={(e) => setCustomSector(e.target.value)} placeholder="ระบุสายงาน เช่น การผังเมือง" />}</div>
          <div className="field"><span className="lbl">จุดประสงค์ <em className="hint">— ตัวจัดเส้นทางหลัก · เลือกได้หลายข้อ</em></span>
            {["A", "B", "C", "D"].map((g) => (<div key={g} className="pgroup"><div className="pgroup-lbl" style={{ color: GC[g] }}>{GROUPS[g]}</div>
              <div className="chips">{Object.entries(PURPOSES).filter(([, v]) => v.group === g).map(([k, v]) => {
                const idx = purposes.indexOf(k);
                return <PChip key={k} on={idx >= 0} color={GC[g]} badge={purposes.length > 1 && idx >= 0 ? idx + 1 : null} onClick={() => togglePurpose(k)}>{v.label}</PChip>;
              })}</div></div>))}
          </div>
          <div className="row2">
            <div className="field"><span className="lbl">ระดับองค์กร {touched.org && <em className="tag-manual">ตั้งเอง</em>}</span>
              <div className="chips">{Object.entries(ORG).map(([k, v]) => <Chip key={k} on={org === k} onClick={() => setLevel("org", k)}>{v.label}</Chip>)}</div></div>
            <div className="field"><span className="lbl">ระดับผู้ใช้ {touched.user && <em className="tag-manual">ตั้งเอง</em>}</span>
              <div className="chips">{Object.entries(USER).map(([k, v]) => <Chip key={k} on={userLv === k} onClick={() => setLevel("user", k)}>{v.label}</Chip>)}</div></div>
          </div>
          <div className="field"><span className="lbl">กรอบเวลา {touched.h && <em className="tag-manual">ตั้งเอง</em>}</span>
            <div className="chips">{Object.entries(HORIZONS).map(([k, v]) => <Chip key={k} on={horizon === k} onClick={() => setLevel("h", k)}>{v.label}</Chip>)}</div></div>
          <div className="field"><span className="lbl">เอกสารที่เกี่ยวข้อง <em className="hint">— PDF / รูป / ข้อความ (สูงสุด 5)</em></span>
            <input ref={fileRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.md" onChange={handleFiles} style={{ display: "none" }} />
            <button type="button" className="attach-btn" onClick={() => fileRef.current && fileRef.current.click()} disabled={files.length >= 5}>＋ แนบไฟล์</button>
            {files.length > 0 && <div className="file-list">{files.map((f) => (<span key={f.name} className="file-chip"><span className="file-kind">{f.kind}</span>{f.name}<button onClick={() => removeFile(f.name)}>×</button></span>))}</div>}</div>
          <div className="field"><button type="button" className="ctx-toggle" onClick={() => setShowContext((s) => !s)}>{showContext ? "▾" : "▸"} บริบทเสริม (ไม่บังคับ) — งบ ข้อจำกัด เงื่อนไข</button>
            {showContext && <textarea className="ta" rows={2} value={context} onChange={(e) => setContext(e.target.value)} placeholder="เช่น งบจำกัด 50 ล้าน / ต้องยึดแผนชาติ ฉ.3" />}</div>
          <div className="field"><button type="button" className="ctx-toggle" onClick={() => setShowConn((s) => !s)}>{showConn ? "▾" : "▸"} 🔌 การเชื่อมต่อ AI — เริ่มต้นใช้ฟรี (Puter) · เปลี่ยนค่ายได้</button>
            {showConn && (<div className="conn">
              <div className="conn-sub">ผู้ให้บริการ</div>
              <div className="chips">{Object.entries(PROVIDERS).map(([k, v]) => <Chip key={k} on={provider === k} onClick={() => pickProvider(k)}>{v.label}</Chip>)}</div>
              {!keyless && <input type="password" className="ta" style={{ marginTop: 10 }} value={userKey} onChange={(e) => setUserKey(e.target.value)} placeholder={`API key (${PROVIDERS[provider].keyHint})`} />}
              <input className="ta" style={{ marginTop: 8 }} list="model-sugg" value={model} onChange={(e) => setModel(e.target.value)} placeholder={`ชื่อโมเดล (เช่น ${PROVIDERS[provider].def || "ระบุเอง"})`} />
              <datalist id="model-sugg">{PROVIDERS[provider].sugg.map((m) => <option key={m} value={m} />)}</datalist>
              {provider === "compatible" && <input className="ta" style={{ marginTop: 8 }} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="Base URL เช่น https://api.deepseek.com" />}
              <div className="conn-note">
                {keyless ? "✨ ใช้ฟรี ไม่ต้องมีคีย์ — เมื่อเรียกครั้งแรกจะให้ล็อกอินบัญชี Puter (ฟรี) การใช้งานเป็นของผู้ใช้แต่ละคน ไม่ตัดโทเคนผู้พัฒนา (บริการภายนอก โปรดตรวจเงื่อนไขที่ puter.com)"
                  : <>คีย์อยู่ในเบราว์เซอร์ของคุณเท่านั้น ส่งตรงไปผู้ให้บริการ · คิดค่าใช้จ่ายกับบัญชีของคุณ{PROVIDERS[provider].free ? " · รับคีย์ฟรีที่ aistudio.google.com" : ""}{provider !== "anthropic" ? " · ค้นเว็บสดเฉพาะ Claude" : ""}</>}
                {(userKey.trim() || keyless) && <b className="conn-on"> ● ใช้ {PROVIDERS[provider].label}</b>}
              </div>
            </div>)}
          </div>
        </section>

        <section className="panel routing">
          <div className="panel-head"><span className="panel-ic">🧭</span><span className="panel-title">เส้นทางเครื่องมือ</span></div>
          <div className="route-line"><span className="route-k">โจทย์</span><span className="route-v">{topic || "—"}</span></div>
          <div className="route-line"><span className="route-k">จุดประสงค์</span><span className="route-v hl">{purposes.length ? purposes.map((k) => PURPOSES[k].label).join(" + ") : "— เลือกอย่างน้อย 1"}</span></div>
          <div className="route-mini"><span>{ORG[org].label}</span><i>·</i><span>{USER[userLv].label}</span><i>·</i><span>{HORIZONS[horizon].label.split(" · ")[0]}</span></div>
          <div className="fw-head">เครื่องมือที่จะเรียกใช้ <span className="fw-count">{active.length}</span> <em className="fw-hint">คลิกเพื่อดูเหตุผล</em></div>
          <div className="chips fw-chips">
            {active.map((f) => <button key={f} className={"fw active" + (fwOpen === f ? " fw-sel" : "") + (f === "6BB+1" ? " fw-special" : "")} onClick={() => setFwOpen(fwOpen === f ? null : f)}>{f}</button>)}
            {struck.map((f) => <span key={f} className="fw struck" title="ตัดออกเพราะกรอบเวลาสั้น">{f}</span>)}
            {active.length === 0 && <span className="fw-empty">เลือกจุดประสงค์เพื่อดูเส้นทาง</span>}
          </div>
          {fwOpen && (<div className="fw-detail"><div className="fw-detail-name">{fwOpen}</div><div className="fw-detail-why">{fwMeta(fwOpen).why}</div><div className="fw-detail-ref">อ้างอิง: {fwMeta(fwOpen).ref}</div></div>)}
          {struck.length > 0 && <div className="strip-note">กรอบเวลาสั้น → ตัดเครื่องมือมองอนาคตออก</div>}
          <label className={"ground" + (canGround ? "" : " ground-off")}><input type="checkbox" checked={grounding && canGround} disabled={!canGround} onChange={(e) => setGrounding(e.target.checked)} /><span>🌐 ค้นเว็บสด (grounding) — หาตัวเลขล่าสุดพร้อมอ้างอิง <em>{canGround ? "ช้าลงเล็กน้อย" : "เฉพาะ Claude"}</em></span></label>
          <button type="button" className="run" onClick={runMain} disabled={loading}>{loading ? <span className="run-load">กุนซือกำลังวิเคราะห์…</span> : (dirty ? "▶  วิเคราะห์อีกครั้ง (อินพุตเปลี่ยน)" : "▶  ให้กุนซือวิเคราะห์")}</button>
          {error && <div className="err">{error}</div>}
          <div className="run-note">เหตุผล/แหล่งอ้างอิงเครื่องมือมาจากคลังระเบียบวิธี · ตัวเลขเป็นค่าประมาณเว้นแต่ยืนยันจากไฟล์แนบ/ค้นเว็บ</div>
        </section>
      </div>

      {(loading || result) && (
        <section className="output">
          {ranConfig && (<div className="out-config-row">
            <span className="oc">{ranConfig.topic}</span><i>·</i><span>{ranConfig.sectors}</span><i>·</i><span>{ranConfig.purposes}</span><i>·</i><span>{ranConfig.org}</span><i>·</i><span>{ranConfig.user}</span>
            {ranConfig.hasFiles > 0 && <><i>·</i><span className="oc">📎 {ranConfig.hasFiles}</span></>}
            {usedGrounding && <><i>·</i><span className="oc">🌐 ค้นเว็บ</span></>}
            <i>·</i><span className="oc">{ranConfig.provider}</span>
          </div>)}

          {result && (<div className="tabbar">{TABS.map((t) => (
            <button key={t.k} className={"tab" + (view === t.k ? " tab-on" : "")} onClick={() => goTab(t.k)}><span className="tab-ic">{t.ic}</span>{t.label}</button>
          ))}</div>)}

          {loading && !result && (<div className="skeleton">
            <div className="sk-line w60" /><div className="sk-line w90" /><div className="sk-line w80" /><div className="sk-line w70" />
            <div className="sk-pulse">กุนซือกำลังรันเครื่องมือ {active.length} ตัว{files.length ? ` · อ่านไฟล์ ${files.length}` : ""}{grounding && canGround ? " · ค้นเว็บ" : ""}…</div></div>)}

          {result && view === "report" && (<>
            <div className="report-bar">
              <button className="mini-btn" onClick={copyReport}>{copied ? "✓ คัดลอกแล้ว" : "⧉ คัดลอก"}</button>
              <button className="mini-btn primary" onClick={exportDoc}>⬇ ดาวน์โหลด (Word)</button>
            </div>
            <Markdown text={result} />
            {sources.length > 0 && (<div className="src"><div className="src-lbl">🌐 แหล่งข้อมูลค้นเว็บสด</div>
              <ol>{sources.map((s, i) => <li key={i}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ol></div>)}
            <div className="follow">
              <div className="follow-lbl">ต่อยอดผลนี้ให้เป็นผลงานพร้อมใช้ →</div>
              <div className="chips">{FOLLOW.map((f) => (<button key={f.key} className="follow-btn" disabled={loading} onClick={() => runFollow(f)} title={f.deliver}>{f.label}</button>))}</div>
            </div>
            <div className="refine">
              <div className="refine-lbl">เพิ่มข้อมูล / ปรับแก้ แล้วประมวลผลใหม่</div>
              <textarea className="ta" rows={3} value={refine} onChange={(e) => setRefine(e.target.value)} placeholder="พิมพ์ข้อมูลเพิ่มเติมหรือทิศทางที่ต้องการ เช่น 'เพิ่มมิติกำลังคน อสม.'" />
              <button className="refine-btn" disabled={loading || !refine.trim()} onClick={runRefine}>↻ ประมวลผลใหม่พร้อมข้อมูลนี้</button>
            </div>
          </>)}

          {result && view === "onepager" && (<div className="pane">
            {opLoading && <div className="sk-pulse" style={{ padding: "16px 0" }}>กำลังสรุปเป็นบทสรุป 1 หน้า…</div>}
            {opErr && <div className="err">{opErr} <button className="mini-btn" onClick={makeOnepager}>ลองใหม่</button></div>}
            {onepager && !opLoading && <Markdown text={onepager} />}</div>)}

          {result && view === "prep" && (<div className="pane">
            {prepLoading && <div className="sk-pulse" style={{ padding: "16px 0" }}>กำลังจัดทำแนวทางเตรียมความพร้อม…</div>}
            {prepErr && <div className="err">{prepErr} <button className="mini-btn" onClick={makePrep}>ลองใหม่</button></div>}
            {prep && !prepLoading && <Markdown text={prep} />}</div>)}

          {result && view === "extra" && (<div className="pane">
            <div className="extra-buttons">{Object.entries(EXTRAS).map(([k, v]) => (
              <button key={k} className={"ex-btn" + (extraKey === k ? " on" : "")} disabled={extraLoading} onClick={() => runExtra(k)}>{v.label}</button>))}</div>
            {extraLoading && <div className="sk-pulse" style={{ padding: "16px 0" }}>กำลังสร้าง {EXTRAS[extraKey]?.label}…</div>}
            {extraErr && <div className="err">{extraErr} <button className="mini-btn" onClick={() => runExtra(extraKey)}>ลองใหม่</button></div>}
            {extra && !extraLoading && <Markdown text={extra} />}
            {!extra && !extraLoading && !extraErr && <p className="extra-hint">เลือกรูปแบบผลลัพธ์ที่ต้องการด้านบน กุนซือจะแปลงจากผลวิเคราะห์ให้</p>}
          </div>)}

          {result && view === "tools" && (<div className="pane">
            <p className="tools-intro">เครื่องมือ {usedFw.length} ตัวที่กุนซือเลือกใช้กับโจทย์นี้ พร้อมเหตุผลและแหล่งอ้างอิงระเบียบวิธีต้นฉบับ</p>
            {usedFw.map((f) => (<div key={f} className="tool-row"><div className="tool-name">{f}</div><div className="tool-why">{fwMeta(f).why}</div><div className="tool-ref">อ้างอิง: {fwMeta(f).ref}</div></div>))}</div>)}

          {result && view === "mindmap" && (<div className="pane">
            {mmLoading && <div className="sk-pulse" style={{ padding: "20px 0" }}>กำลังสรุปเป็นมายด์แมพ…</div>}
            {mmError && <div className="err">{mmError} <button className="mini-btn" onClick={makeMindmap}>ลองใหม่</button></div>}
            {mindmap && !mmLoading && (<><MindMap data={mindmap} /><button className="mini-btn" onClick={makeMindmap} style={{ marginTop: 14 }}>↻ สร้างมายด์แมพใหม่</button></>)}</div>)}
        </section>
      )}

      <footer className="foot">
        <div>{NAME} · {NAME_EN} v{VERSION}</div>
        <div>พัฒนาโดย {DEV.name} · {DEV.role} · {DEV.unit} {DEV.org}</div>
      </footer>
    </div>
  );
}

/* ============================================================ */
const DOC_CSS = `
@page{margin:2.5cm;}
body{font-family:"TH Sarabun New","Sarabun","Tahoma",sans-serif;font-size:16pt;color:#1a1a1a;line-height:1.5;}
.cover{border-bottom:2px solid #6D5FEF;padding-bottom:14px;margin-bottom:20px;}
.brand{font-size:12pt;color:#6D5FEF;letter-spacing:.05em;}
.doctitle{font-size:24pt;margin:8px 0 14px;color:#2a2350;}
table.cfg{border-collapse:collapse;font-size:13pt;}
table.cfg td{border:1px solid #ccc;padding:4px 10px;}
table.cfg td.k{background:#f0eefc;font-weight:bold;width:150px;}
h1.sec{font-size:18pt;color:#6D5FEF;border-bottom:1px solid #6D5FEF;margin-top:26px;padding-bottom:4px;}
h2{font-size:16pt;color:#2a2350;border-left:4px solid #6D5FEF;padding-left:10px;margin-top:20px;}
h3{font-size:14pt;color:#6D5FEF;margin-top:14px;}
p{margin:8px 0;}
blockquote{border-left:3px solid #E08600;background:#fdf4e3;padding:8px 12px;margin:12px 0;}
table.rpt{border-collapse:collapse;width:100%;font-size:13pt;margin:12px 0;}
table.rpt th{background:#6D5FEF;color:#fff;border:1px solid #6D5FEF;padding:6px 10px;text-align:left;}
table.rpt td{border:1px solid #bbb;padding:6px 10px;vertical-align:top;}
ul,ol{margin:8px 0 8px 22px;}
.sign{margin-top:32px;padding-top:12px;border-top:1px solid #ccc;font-size:13pt;color:#555;}
hr{border:none;border-top:1px solid #ccc;margin:16px 0;}
`;
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
.root{
  --bg:#EEF2FB;--panel:#FFFFFF;--panel2:#F4F7FD;--line:#E7ECF7;--field:#F6F9FE;
  --text:#1E2A44;--muted:#6B7793;--dim:#9AA4BE;--body:#3A4763;
  --brand1:#6D5FEF;--brand2:#22B7E6;--accent:#16B981;--warn:#F0617A;--signal:#22B7E6;
  --chipOn:rgba(109,95,239,.10);--fwOn:rgba(34,183,230,.12);--link:#2A7FE8;--danger:#E5566E;
  --grad:linear-gradient(90deg,#22B7E6,#7C5CF7);--gradbtn:linear-gradient(135deg,#6D5FEF,#22B7E6);
  --shadow:0 12px 34px rgba(90,105,170,.14);
  color:var(--text);min-height:100vh;font-family:'IBM Plex Sans Thai',system-ui,sans-serif;line-height:1.55;padding:clamp(16px,4vw,40px);box-sizing:border-box;
  background:radial-gradient(1000px 480px at 8% -12%,rgba(124,92,247,.10),transparent 60%),radial-gradient(820px 440px at 100% -6%,rgba(34,183,230,.10),transparent 55%),var(--bg);
  transition:background .25s,color .25s;
}
.root.dark{
  --bg:#0E1020;--panel:#181C30;--panel2:#20263F;--line:#2C3350;--field:#12162A;
  --text:#ECF0FF;--muted:#98A2C6;--dim:#69739B;--body:#C7D0EC;
  --brand1:#8B7BFF;--brand2:#2FC3F0;--accent:#2DD4BF;--warn:#FB7185;--signal:#2FC3F0;
  --chipOn:rgba(139,123,255,.16);--fwOn:rgba(47,195,240,.14);--link:#7DE3D4;--danger:#FB7185;
  --grad:linear-gradient(90deg,#2FC3F0,#8B7BFF);--gradbtn:linear-gradient(135deg,#8B7BFF,#2FC3F0);
  --shadow:0 12px 34px rgba(6,8,22,.42);
  background:radial-gradient(1000px 480px at 8% -12%,rgba(139,123,255,.20),transparent 60%),radial-gradient(820px 440px at 100% -6%,rgba(47,195,240,.14),transparent 55%),var(--bg);
}
.root *{box-sizing:border-box;}
.head{max-width:1120px;margin:0 auto 22px;}
.head-top{display:flex;justify-content:space-between;align-items:center;gap:12px;}
.brand-mark{display:flex;align-items:center;gap:12px;}
.logo{width:44px;height:44px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:24px;color:#fff;background:var(--gradbtn);box-shadow:0 8px 20px rgba(109,95,239,.42);}
.brand-name{font-size:24px;font-weight:700;line-height:1.1;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;}
.eyebrow{font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.1em;color:var(--muted);margin-top:2px;}
.theme-btn{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--text);background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:9px 14px;cursor:pointer;white-space:nowrap;box-shadow:0 3px 12px rgba(90,105,170,.12);}
.theme-btn:hover{border-color:var(--brand1);}
.accent-bar{height:5px;border-radius:999px;background:var(--grad);margin:16px 0 14px;max-width:180px;}
.sub{color:var(--muted);margin:0;font-size:15px;max-width:730px;}
.dev{margin-top:12px;font-size:12.5px;color:var(--muted);border-left:3px solid var(--brand1);padding-left:10px;}
.dev b{color:var(--text);}
.how-toggle{background:none;border:none;color:var(--brand1);font-family:inherit;font-size:12.5px;cursor:pointer;padding:0;margin-top:14px;font-weight:600;}
.how{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;}
.how-step{font-size:11.5px;color:var(--muted);background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px 12px;box-shadow:0 2px 8px rgba(90,105,170,.06);}
.how-step b{color:var(--brand1);font-weight:700;}
.grid{max-width:1120px;margin:0 auto;display:grid;grid-template-columns:1.35fr 1fr;gap:18px;align-items:start;}
@media(max-width:820px){.grid{grid-template-columns:1fr;}}
.panel{position:relative;overflow:hidden;background:var(--panel);border:1px solid var(--line);border-radius:20px;padding:22px;box-shadow:var(--shadow);}
.panel::before{content:"";position:absolute;top:0;left:0;right:0;height:4px;background:var(--grad);}
.panel-head{display:flex;align-items:center;gap:11px;margin-bottom:18px;}
.panel-ic{width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:18px;background:var(--chipOn);}
.panel-title{font-size:16px;font-weight:700;color:var(--text);}
.field{margin-bottom:18px;}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
@media(max-width:560px){.row2{grid-template-columns:1fr;}}
.lbl{display:block;font-size:13px;font-weight:600;color:var(--text);margin-bottom:9px;}
.hint{color:var(--brand2);font-style:normal;font-weight:500;font-size:12px;}
.lens-note{margin-top:9px;font-size:11.5px;color:var(--accent);background:rgba(22,185,129,.10);border:1px solid rgba(22,185,129,.3);border-radius:9px;padding:7px 11px;}
.lens-note b{color:var(--accent);}
.tag-manual{font-style:normal;font-size:10px;font-family:'IBM Plex Mono',monospace;color:var(--accent);background:rgba(22,185,129,.14);border-radius:5px;padding:1px 6px;margin-left:6px;vertical-align:middle;}
.ta{width:100%;background:var(--field);border:1px solid var(--line);border-radius:12px;color:var(--text);font-family:inherit;font-size:14px;padding:11px 13px;resize:vertical;outline:none;transition:border-color .15s,box-shadow .15s;}
.ta:focus{border-color:var(--brand1);box-shadow:0 0 0 3px var(--chipOn);}
.chips{display:flex;flex-wrap:wrap;gap:7px;}
.chip{position:relative;font-family:inherit;font-size:12.5px;color:var(--muted);background:var(--field);border:1px solid var(--line);border-radius:999px;padding:7px 14px;cursor:pointer;transition:all .14s;line-height:1.3;}
.chip:hover{border-color:var(--brand1);color:var(--brand1);transform:translateY(-1px);}
.chip-on{background:var(--chipOn);border-color:var(--brand1);color:var(--brand1);font-weight:600;}
.chip-badge{display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;margin-left:7px;font-family:'IBM Plex Mono',monospace;font-size:10px;background:var(--brand1);color:#fff;border-radius:50%;padding:0 3px;}
.pgroup{margin-bottom:12px;}
.pgroup-lbl{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.08em;margin-bottom:7px;font-weight:700;}
.attach-btn{font-family:inherit;font-size:13px;color:var(--brand2);background:var(--field);border:1px dashed var(--brand2);border-radius:12px;padding:10px 16px;cursor:pointer;transition:all .14s;}
.attach-btn:hover{background:var(--fwOn);}
.attach-btn:disabled{opacity:.5;cursor:not-allowed;}
.file-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;}
.file-chip{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text);background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:5px 9px;}
.file-kind{font-family:'IBM Plex Mono',monospace;font-size:9px;text-transform:uppercase;color:var(--brand2);background:var(--fwOn);border-radius:4px;padding:1px 5px;}
.file-chip button{background:none;border:none;color:var(--muted);cursor:pointer;font-size:15px;line-height:1;padding:0;}
.file-chip button:hover{color:var(--danger);}
.ctx-toggle{background:none;border:none;color:var(--muted);font-family:inherit;font-size:12.5px;cursor:pointer;padding:0;margin-bottom:8px;text-align:left;font-weight:500;}
.ctx-toggle:hover{color:var(--brand1);}
.conn{background:var(--field);border:1px solid var(--line);border-radius:13px;padding:14px;}
.conn-sub{font-size:11.5px;color:var(--dim);margin-bottom:8px;font-family:'IBM Plex Mono',monospace;letter-spacing:.05em;}
.conn-note{font-size:11px;color:var(--dim);margin-top:9px;line-height:1.6;}
.conn-on{color:var(--accent);font-weight:700;}
.routing{position:sticky;top:16px;}
@media(max-width:820px){.routing{position:static;}}
.route-line{display:flex;gap:10px;font-size:13px;padding:6px 0;border-bottom:1px dashed var(--line);}
.route-k{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--dim);min-width:74px;padding-top:2px;}
.route-v{color:var(--text);flex:1;}
.route-v.hl{color:var(--brand1);font-weight:700;}
.route-mini{display:flex;gap:8px;align-items:center;flex-wrap:wrap;color:var(--muted);font-size:12px;margin:10px 0 4px;}
.route-mini i{color:var(--dim);font-style:normal;}
.fw-head{font-size:12.5px;font-weight:600;color:var(--text);margin:16px 0 9px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.fw-count{font-family:'IBM Plex Mono',monospace;font-size:11px;background:var(--fwOn);color:var(--brand2);border-radius:6px;padding:1px 7px;font-weight:600;}
.fw-hint{font-style:normal;font-weight:400;font-size:11px;color:var(--dim);}
.fw{font-family:'IBM Plex Mono',monospace;font-size:11.5px;padding:5px 11px;border-radius:8px;border:1px solid var(--line);animation:pop .22s ease;cursor:default;background:var(--field);color:var(--muted);}
button.fw{cursor:pointer;}
.fw.active{background:var(--fwOn);border-color:var(--brand2);color:var(--brand2);}
.fw.fw-special{background:rgba(22,185,129,.12);border-color:var(--accent);color:var(--accent);}
.fw.fw-sel{outline:2px solid var(--brand1);}
.fw.struck{color:var(--dim);text-decoration:line-through;opacity:.55;}
.fw-empty{font-size:12px;color:var(--dim);}
@keyframes pop{from{opacity:0;transform:translateY(3px);}to{opacity:1;transform:none;}}
.fw-detail{margin-top:10px;background:var(--field);border:1px solid var(--brand1);border-radius:12px;padding:12px 14px;animation:pop .2s ease;}
.fw-detail-name{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--brand1);font-weight:700;margin-bottom:5px;}
.fw-detail-why{font-size:13px;color:var(--body);margin-bottom:6px;}
.fw-detail-ref{font-size:11.5px;color:var(--muted);font-style:italic;}
.strip-note{font-size:11px;color:var(--warn);margin-top:8px;}
.ground{display:flex;gap:9px;align-items:flex-start;margin-top:16px;font-size:12.5px;color:var(--muted);cursor:pointer;background:var(--field);border:1px solid var(--line);border-radius:12px;padding:11px 13px;}
.ground.ground-off{opacity:.55;}
.ground input{margin-top:3px;accent-color:var(--brand1);}
.ground em{font-style:normal;color:var(--dim);font-size:11px;}
.run{width:100%;margin-top:14px;background:var(--gradbtn);color:#fff;border:none;border-radius:14px;font-family:inherit;font-size:15.5px;font-weight:700;padding:15px;cursor:pointer;transition:transform .1s,box-shadow .2s,filter .15s;box-shadow:0 12px 28px rgba(109,95,239,.4);}
.run:hover{filter:brightness(1.04);transform:translateY(-1px);}
.run:active{transform:scale(.99);}
.run:disabled{opacity:.75;cursor:wait;}
.run-load{font-family:'IBM Plex Mono',monospace;font-size:13px;}
.run-note{font-size:11px;color:var(--dim);margin-top:10px;line-height:1.5;}
.err{color:var(--danger);font-size:12.5px;margin-top:10px;}
.output{max-width:1120px;margin:18px auto 0;position:relative;overflow:hidden;background:var(--panel);border:1px solid var(--line);border-radius:20px;padding:clamp(20px,4vw,34px);box-shadow:var(--shadow);}
.output::before{content:"";position:absolute;top:0;left:0;right:0;height:4px;background:var(--grad);}
.out-config-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted);padding-bottom:14px;margin-bottom:16px;border-bottom:1px solid var(--line);}
.out-config-row .oc{color:var(--brand1);font-weight:600;}
.out-config-row i{color:var(--dim);font-style:normal;}
.tabbar{display:flex;gap:6px;overflow-x:auto;padding:6px;background:var(--field);border:1px solid var(--line);border-radius:16px;margin-bottom:20px;}
.tab{display:inline-flex;align-items:center;gap:7px;white-space:nowrap;font-family:inherit;font-size:13px;color:var(--muted);background:none;border:none;border-radius:12px;padding:10px 15px;cursor:pointer;transition:all .15s;font-weight:500;}
.tab:hover{color:var(--text);background:var(--panel2);}
.tab-ic{font-size:15px;line-height:1;}
.tab-on{background:var(--gradbtn);color:#fff;font-weight:700;box-shadow:0 6px 16px rgba(109,95,239,.4);}
.tab-on:hover{background:var(--gradbtn);color:#fff;}
.skeleton{padding:8px 0;}
.sk-line{height:12px;background:linear-gradient(90deg,var(--panel2),var(--line),var(--panel2));background-size:200% 100%;border-radius:6px;margin:12px 0;animation:sh 1.3s infinite;}
.w60{width:60%;}.w90{width:90%;}.w80{width:80%;}.w70{width:70%;}
@keyframes sh{0%{background-position:200% 0;}100%{background-position:-200% 0;}}
.sk-pulse{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--brand1);margin-top:18px;}
.report-bar{display:flex;justify-content:flex-end;gap:8px;margin-bottom:4px;}
.pane{padding-top:4px;}
.md-h2{font-size:19px;font-weight:700;color:var(--text);margin:26px 0 12px;padding-left:12px;border-left:4px solid var(--brand1);}
.md-h2:first-child{margin-top:0;}
.md-h3{font-size:15px;font-weight:700;color:var(--brand1);margin:18px 0 8px;}
.md-p{font-size:14.5px;color:var(--body);margin:10px 0;}
.md-ul{margin:10px 0;padding-left:20px;}
.md-ul li{font-size:14px;color:var(--body);margin:5px 0;}
.md-hr{height:1px;background:var(--line);margin:22px 0;border:none;}
.md-quote{border-left:3px solid var(--accent);background:rgba(22,185,129,.08);border-radius:0 10px 10px 0;padding:11px 15px;margin:14px 0;font-size:13.5px;color:var(--body);}
.md-table-wrap{overflow-x:auto;margin:14px 0;border:1px solid var(--line);border-radius:13px;}
.md-table{width:100%;border-collapse:collapse;font-size:13px;min-width:420px;}
.md-table th{background:var(--chipOn);color:var(--brand1);font-weight:700;text-align:left;padding:11px 13px;border-bottom:1px solid var(--line);white-space:nowrap;}
.md-table td{padding:11px 13px;border-bottom:1px solid var(--line);color:var(--body);vertical-align:top;}
.md-table tr:last-child td{border-bottom:none;}
.md-table tr:nth-child(even) td{background:var(--field);}
.src{margin-top:22px;background:var(--field);border:1px solid var(--line);border-radius:13px;padding:14px 16px;}
.src-lbl{font-size:12.5px;font-weight:700;color:var(--brand1);margin-bottom:8px;}
.src ol{margin:0;padding-left:20px;}
.src li{font-size:12.5px;margin:4px 0;}
.src a{color:var(--link);text-decoration:none;}
.src a:hover{text-decoration:underline;}
.follow{margin-top:26px;padding-top:20px;border-top:1px solid var(--line);}
.follow-lbl{font-size:13px;font-weight:700;color:var(--text);margin-bottom:11px;}
.follow-btn{font-family:inherit;font-size:12.5px;color:var(--brand1);background:var(--chipOn);border:1px solid var(--brand1);border-radius:999px;padding:8px 16px;cursor:pointer;transition:all .14s;font-weight:600;}
.follow-btn:hover{background:var(--gradbtn);color:#fff;border-color:transparent;transform:translateY(-1px);}
.follow-btn:disabled{opacity:.5;cursor:wait;}
.refine{margin-top:22px;padding-top:20px;border-top:1px solid var(--line);}
.refine-lbl{font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px;}
.refine-btn{margin-top:10px;font-family:inherit;font-size:13px;font-weight:700;color:#fff;background:var(--gradbtn);border:none;border-radius:12px;padding:12px 20px;cursor:pointer;box-shadow:0 8px 18px rgba(109,95,239,.35);}
.refine-btn:hover{filter:brightness(1.05);}
.refine-btn:disabled{opacity:.5;cursor:not-allowed;box-shadow:none;}
.extra-buttons{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;}
.ex-btn{font-family:inherit;font-size:12.5px;color:var(--text);background:var(--field);border:1px solid var(--line);border-radius:11px;padding:9px 15px;cursor:pointer;transition:all .14s;font-weight:500;}
.ex-btn:hover{border-color:var(--brand1);color:var(--brand1);transform:translateY(-1px);}
.ex-btn.on{background:var(--chipOn);border-color:var(--brand1);color:var(--brand1);font-weight:700;}
.ex-btn:disabled{opacity:.5;cursor:wait;}
.extra-hint{font-size:13px;color:var(--muted);padding:8px 0;}
.tools-intro{font-size:13px;color:var(--muted);margin:0 0 16px;}
.tool-row{border:1px solid var(--line);border-left:4px solid var(--brand1);border-radius:12px;padding:13px 15px;margin-bottom:10px;background:var(--field);}
.tool-name{font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--brand1);font-weight:700;margin-bottom:5px;}
.tool-why{font-size:13.5px;color:var(--body);margin-bottom:6px;}
.tool-ref{font-size:11.5px;color:var(--muted);font-style:italic;}
.mm-scroll{overflow:auto;max-width:100%;border:1px solid var(--line);border-radius:13px;background:var(--field);padding:10px;}
.mm-svg{display:block;}
.mm-link{fill:none;stroke:var(--brand1);stroke-width:1.5;opacity:.45;}
.mm-node{height:100%;display:flex;align-items:center;justify-content:center;text-align:center;border-radius:11px;font-size:11.5px;line-height:1.25;padding:4px 8px;overflow:hidden;}
.mm-root{background:var(--gradbtn);color:#fff;font-weight:700;font-size:12.5px;}
.mm-branch{background:var(--chipOn);border:1px solid var(--brand1);color:var(--brand1);font-weight:600;}
.mm-child{background:var(--panel);border:1px solid var(--line);color:var(--body);}
.mini-btn{font-family:'IBM Plex Mono',monospace;font-size:11.5px;color:var(--brand1);background:var(--field);border:1px solid var(--brand1);border-radius:10px;padding:8px 14px;cursor:pointer;font-weight:600;}
.mini-btn:hover{background:var(--chipOn);}
.mini-btn.primary{color:#fff;background:var(--gradbtn);border:none;box-shadow:0 5px 14px rgba(109,95,239,.35);}
.foot{max-width:1120px;margin:28px auto 0;font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--dim);text-align:center;letter-spacing:.03em;line-height:1.8;}
`;
