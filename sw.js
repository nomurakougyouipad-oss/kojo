/* =====================================================================
   工場 製作指示：サービスワーカー
   ・通信がない時でも画面を開けるように、「画面のファイル」だけを端末にしまう
     （index.html と、Firebase の部品 3つ。版は 10.12.2 に固定）
   ・製作指示などの業務データ、ログイン情報、パスワードはここではしまわない
     （業務データは Firestore 自身の保存のしくみが別に持つ）
   ・効くのは /kojo/ の中だけ。ほかの GitHub Pages のアプリには関係しない
   ・通信がある時は、いつも最新の index.html を取りに行き、しまい直す
     → 新しい版を公開すると、次に開いた時から新しい版になる
   ・Firebase の版を変える時は、下の VERSION も変える（古いしまい場所は消える）
   ===================================================================== */
const VERSION = "kojo-shell-1";
const SDK = [
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js",
];
const PAGE = new URL("./index.html", self.registration.scope).href;
const NET_WAIT_MS = 5000;   // 通信がこの時間で返ってこなければ、しまってある画面を出す

self.addEventListener("install", e=>{
  e.waitUntil((async()=>{
    const c = await caches.open(VERSION);
    const page = await fetch(PAGE, {cache:"no-store"});
    if(!page.ok) throw new Error("index.html を取得できません");
    await c.put(PAGE, page);
    for(const u of SDK){
      let r;
      try{ r = await fetch(u, {mode:"cors", cache:"no-store"}); }catch(err){ r = await fetch(u, {mode:"no-cors"}); }
      await c.put(u, r);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e=>{
  e.waitUntil((async()=>{
    for(const k of await caches.keys()) if(k.startsWith("kojo-shell-") && k!==VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e=>{
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  /* Firebase の部品：しまってあるものを使う（版が固定なので中身は変わらない） */
  if(SDK.includes(url.href)){
    e.respondWith(caches.match(url.href).then(hit=>hit || fetch(req)));
    return;
  }
  /* アプリの画面：まず最新を取りに行き、だめならしまってある画面 */
  const isPage = url.origin===self.location.origin &&
    (req.mode==="navigate" || url.pathname===new URL(PAGE).pathname);
  if(isPage && url.pathname.startsWith(new URL(self.registration.scope).pathname)){
    e.respondWith(pageNetworkFirst());
    return;
  }
  /* それ以外（Firestore・ログインの通信など）には手を出さない */
});

async function pageNetworkFirst(){
  const c = await caches.open(VERSION);
  try{
    const ctrl = new AbortController();
    const timer = setTimeout(()=>ctrl.abort(), NET_WAIT_MS);
    const r = await fetch(PAGE, {cache:"no-store", signal:ctrl.signal});
    clearTimeout(timer);
    if(r.ok){ await c.put(PAGE, r.clone()); return r; }
    const hit = await c.match(PAGE);
    return hit || r;
  }catch(err){
    const hit = await c.match(PAGE);
    if(hit) return hit;
    throw err;
  }
}
