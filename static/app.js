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
  await fetch("/api/reset");
  history.length = 0;
  renderHistory();
  modalContent.innerHTML = `<div class="text">已重新开始～再折一颗吧 ✨</div>`;
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

  // 3) 拉取内容
  const res = await fetch("/api/draw");
  const data = await res.json();

  if(data.exhausted){
    modalContent.innerHTML = `<div class="text">${escapeHtml(data.message || "你已经把我想说的都抽完了。")}</div>`;
    modalFoot.textContent = `总共 ${data.total ?? "-"} 颗，剩余 ${data.left ?? "-"} 颗`;
    modalActions.innerHTML = `<button id="resetBtn">重新开始</button>`;
    document.getElementById("resetBtn").onclick = resetPool;

    // 斜裂后复原
    setTimeout(()=>{ star.classList.remove("open"); star.classList.add("reset"); locked=false; }, 900);
    return;
  }

  const item = data.item;

  if(item.type === "text"){
    modalContent.innerHTML = `<div class="text">${escapeHtml(item.value)}</div>`;
    history.unshift("💛 " + item.value);
  }

  modalFoot.textContent = `总共 ${data.total} 颗，剩余 ${data.left} 颗`;
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
