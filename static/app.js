const star = document.querySelector(".star.openable");
const btn = document.getElementById("btn");
const hisList = document.getElementById("hisList");
const history = [];

// modal elements
const modal = document.getElementById("modal");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalClose = document.getElementById("modalClose");
const modalCard = document.getElementById("modalCard");
const modalContent = document.getElementById("modalContent");
const modalFoot = document.getElementById("modalFoot");
const modalActions = document.getElementById("modalActions");
const particles = document.getElementById("particles");
const bgA = document.getElementById("bgA");
const bgB = document.getElementById("bgB");


let locked = false;

// ======= localStorage 不重复抽取（适合几百条） =======
const LS_POOL = "ls_pool_v1";
const LS_TOTAL = "ls_total_v1";
const LS_DRAWN = "ls_drawn_v1"; // 记录已抽过的内容
const LS_HASH = "ls_hash_v1";
let TOTAL = 0;

function loadDrawn(){
  try{
    const arr = JSON.parse(localStorage.getItem(LS_DRAWN) || "[]");
    return Array.isArray(arr) ? arr : [];
  }catch(e){
    return [];
  }
}

function saveDrawn(arr){
  localStorage.setItem(LS_DRAWN, JSON.stringify(arr));
}


function simpleHash(str){
  let h = 0;
  for(let i=0;i<str.length;i++){
    h = (h*31 + str.charCodeAt(i)) >>> 0;
  }
  return String(h);
}

function loadLocalPool(){
  try{
    const pool = JSON.parse(localStorage.getItem(LS_POOL) || "null");
    const total = Number(localStorage.getItem(LS_TOTAL) || "0");
    if(Array.isArray(pool)) return { pool, total };
  }catch(e){}
  return { pool: null, total: 0 };
}

function saveLocalPool(pool, total){
  localStorage.setItem(LS_POOL, JSON.stringify(pool));
  localStorage.setItem(LS_TOTAL, String(total));
}

async function ensurePool(){
  const res = await fetch("/api/content");
  const data = await res.json();
  const messages = Array.isArray(data.messages) ? data.messages : [];
  const totalFromServer = messages.length;

  // 用全集 hash 记录版本（可选，但保留没问题）
  const hash = simpleHash(JSON.stringify(messages));
  localStorage.setItem(LS_HASH, hash);

  // 核心：从“已抽列表”里剔除
  const drawn = loadDrawn();
  const drawnSet = new Set(drawn);

  // 剩余池 = 全集 - 已抽
  const pool = messages.filter(m => !drawnSet.has(m));

  // 洗牌
  for(let i=pool.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // 持久化
  saveLocalPool(pool, totalFromServer);
  TOTAL = totalFromServer;

  return pool;
}


async function resetLocalPool(){
  localStorage.removeItem(LS_POOL);
  localStorage.removeItem(LS_TOTAL);
  localStorage.removeItem(LS_HASH);
  localStorage.removeItem(LS_DRAWN); // 关键：清空已抽记录
  return await ensurePool();
}



function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function renderHistory(){
  const top = history.slice(0,5);
  hisList.innerHTML = top.map(x=>`<li>${escapeHtml(x)}</li>`).join("");
}

function openModalFromStar(){
  // 取星星中心点
  const r = btn.getBoundingClientRect();
  const sx = r.left + r.width/2;
  const sy = r.top + r.height/2;

  // 写入 CSS 变量，让卡片从这里“出生”
  modalCard.style.setProperty("--sx", sx + "px");
  modalCard.style.setProperty("--sy", sy + "px");

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal(){
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

modalBackdrop?.addEventListener("click", closeModal);
modalClose?.addEventListener("click", closeModal);
window.addEventListener("keydown", (e)=>{ if(e.key==="Escape") closeModal(); });

async function resetPool(){
  await resetLocalPool();
  history.length = 0;
  renderHistory();
  modalContent.innerHTML = `<div class="text">已重新开始～再点击一次吧 ✨</div>`;
  modalFoot.textContent = "";
  modalActions.innerHTML = "";
}


function spawnParticles(intensity = 10){
  if(!particles) return;
  particles.innerHTML = "";

  const n = Math.max(6, Math.min(18, intensity));
  for(let i=0;i<n;i++){
    const d = document.createElement("div");
    d.className = "p";

    // 随机方向与距离（小而精致）
    const dx = (Math.random()*2 - 1) * (28 + Math.random()*18);
    const dy = (Math.random()*2 - 1) * (28 + Math.random()*18);

    d.style.setProperty("--dx", dx.toFixed(1) + "px");
    d.style.setProperty("--dy", dy.toFixed(1) + "px");
    d.style.animation = `popFly ${420 + Math.random()*220}ms ease-out forwards`;
    d.style.animationDelay = `${Math.random()*60}ms`;

    // 随机大小（更自然）
    const s = 6 + Math.random()*6;
    d.style.width = s + "px";
    d.style.height = s + "px";

    // 偶尔变成“星形颗粒”（用 clip-path，小范围用不重）
    if(Math.random() < 0.35){
      d.style.borderRadius = "2px";
      d.style.clipPath = "polygon(50% 0%, 62% 32%, 98% 35%, 70% 56%, 79% 91%, 50% 72%, 21% 91%, 30% 56%, 2% 35%, 38% 32%)";
    }

    particles.appendChild(d);
  }
}


async function draw(){
  if(locked) return;
  locked = true;

  // 1) 星星斜裂
  star.classList.remove("reset");
  star.classList.add("open");

  spawnParticles(12);

  // 2) 从星星位置打开全屏卡片（先开再填内容，观感更像“从里面出来”）
  openModalFromStar();
  modalContent.innerHTML = `<div class="text">正在打开这颗幸运星…</div>`;
  modalFoot.textContent = "";
  modalActions.innerHTML = "";

  // 3) 确保本地池子存在
  let pool = await ensurePool();

  if(!pool || pool.length === 0){
    modalContent.innerHTML = `<div class="text">你已经把我想说的都抽完啦！请等待更新哟:)。</div>`;
    modalFoot.textContent = `总共 ${TOTAL} 颗，剩余 0 颗`;
    modalActions.innerHTML = `<button id="resetBtn">重新开始</button>`;
    document.getElementById("resetBtn").onclick = resetPool;

    setTimeout(()=>{ star.classList.remove("open"); star.classList.add("reset"); locked=false; }, 900);
    return;
  }

  // 抽一个（不重复）
  const value = pool.pop();
  saveLocalPool(pool, TOTAL);
  const drawn = loadDrawn();
  drawn.push(value);
  saveDrawn(drawn);

  // 展示内容（纯文字）
  modalContent.innerHTML = `<div class="text">${escapeHtml(value)}</div>`;
  history.unshift("💛 " + value);

  modalFoot.textContent = `总共 ${TOTAL} 颗，剩余 ${pool.length} 颗`;
  renderHistory();


  // 4) 星星复原（让“裂开—释放内容—合上”更像仪式）
  setTimeout(()=>{
    star.classList.remove("open");
    star.classList.add("reset");
    locked = false;
  }, 900);
}

// 让 onclick="draw()" 仍可用
window.draw = draw;
window.resetPool = resetPool;

async function startBgSlideshow(){
  if(!bgA || !bgB) return;

  // 1) 从后端获取 photos 列表
  let photos = [];
  try{
    const res = await fetch("/api/photos");
    const data = await res.json();
    photos = Array.isArray(data.photos) ? data.photos : [];
  }catch(e){
    console.error("Failed to load /api/photos", e);
    return;
  }

  if(photos.length === 0) return;

  // 2) 预加载（减少切换闪一下）
  photos.forEach(src => { const im = new Image(); im.src = src; });

  // 3) 先显示第一张
  let idx = 0;
  let showingA = true;
  bgA.style.backgroundImage = `url("${photos[0]}")`;
  bgA.classList.add("is-on");

  // 4) 交叉淡入淡出轮播
  setInterval(() => {
    idx = (idx + 1) % photos.length;
    const next = photos[idx];

    const on = showingA ? bgB : bgA;
    const off = showingA ? bgA : bgB;

    on.style.backgroundImage = `url("${next}")`;
    on.classList.add("is-on");
    off.classList.remove("is-on");

    showingA = !showingA;
  }, 5500);
}

startBgSlideshow();
