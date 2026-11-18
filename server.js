
const http = require("http");
const httpProxy = require("http-proxy");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 8080);
const TARGET = "http://127.0.0.1:8006";
const USER = process.env.PROXY_USER;
const PASSWORD = process.env.PROXY_PASSWORD;

if (!USER || !PASSWORD) {
  console.error("PROXY_USER ve PROXY_PASSWORD ayarlanmalı!");
  process.exit(1);
}

function safeEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function authorized(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Basic\s+(.+)$/i);

  if (!match) return false;

  let decoded;
  try {
    decoded = Buffer.from(match[1], "base64").toString("utf8");
  } catch {
    return false;
  }

  const index = decoded.indexOf(":");
  if (index < 0) return false;

  return safeEqual(decoded.slice(0, index), USER) &&
         safeEqual(decoded.slice(index + 1), PASSWORD);
}

const proxy = httpProxy.createProxyServer({
  target: TARGET,
  changeOrigin: true,
  ws: true,
  xfwd: true,
  timeout: 30000,
  proxyTimeout: 30000
});

proxy.on("error", (err, req, res) => {
  console.error("Proxy error:", err.message);

  if (res && !res.headersSent && typeof res.writeHead === "function") {
    res.writeHead(502, {
      "Content-Type": "text/plain; charset=utf-8"
    });
    res.end("VM bağlantısı kullanılamıyor.");
  }
});

const page = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#080808">
<title>hacfard-win10</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:#000;color:white;font-family:Segoe UI,Arial}
#app{position:fixed;inset:0}
iframe{width:100%;height:100%;border:0;background:#000}
.toolbar{
 position:fixed;z-index:5;top:12px;left:50%;
 transform:translateX(-50%);
 display:flex;align-items:center;gap:7px;padding:9px 12px;
 border:1px solid #ffffff22;border-radius:17px;
 background:#171717c9;backdrop-filter:blur(22px);
 box-shadow:0 8px 30px #0008;transition:.3s
}
.toolbar.hidden{opacity:0;pointer-events:none;transform:translate(-50%,-15px)}
.brand{font-size:12px;font-weight:800;letter-spacing:1.5px;white-space:nowrap}
.brand span{color:#888}
button{width:36px;height:36px;border:1px solid transparent;border-radius:11px;background:transparent;color:white;font-size:18px;cursor:pointer}
button:hover{background:#ffffff19;border-color:#ffffff22}
.watermark{position:fixed;bottom:11px;right:14px;z-index:5;opacity:.3;font-size:12px;font-weight:700;letter-spacing:1.5px;pointer-events:none;text-shadow:0 1px 5px black}
.status{position:fixed;bottom:13px;left:14px;z-index:5;opacity:.4;font-size:10px;letter-spacing:1px;pointer-events:none}
@media(max-width:600px){
.toolbar{top:8px;padding:6px;gap:3px}
button{width:32px;height:32px}
.brand{font-size:10px}
.watermark{font-size:10px;right:8px;bottom:8px}
}
</style>
</head>
<body>
<div id="app">
 <iframe id="vm" src="/vm/" allow="fullscreen; clipboard-read; clipboard-write" allowfullscreen></iframe>
 <div class="toolbar" id="toolbar">
  <div class="brand">HACFARD<span> / WIN10</span></div>
  <button onclick="reloadVM()" title="Yenile">↻</button>
  <button onclick="fullscreen()" title="Tam ekran">⛶</button>
  <button onclick="toggle()" title="Paneli gizle">◉</button>
 </div>
 <div class="status">HACFARD VIRTUAL SYSTEM</div>
 <div class="watermark">hacfard-win10</div>
</div>
<script>
const vm=document.getElementById("vm");
const bar=document.getElementById("toolbar");
let hidden=false,timer;

function show(){
 if(hidden)return;
 bar.classList.remove("hidden");
 clearTimeout(timer);
 timer=setTimeout(()=>bar.classList.add("hidden"),3500);
}
function toggle(){
 hidden=!hidden;
 bar.classList.toggle("hidden",hidden);
 if(!hidden)show();
}
function reloadVM(){
 vm.src="/vm/";
}
function fullscreen(){
 if(!document.fullscreenElement)
  document.getElementById("app").requestFullscreen?.();
 else document.exitFullscreen?.();
}
document.addEventListener("mousemove",show);
document.addEventListener("touchstart",show,{passive:true});
document.addEventListener("keydown",e=>{
 if(e.key.toLowerCase()==="h")toggle();
});
show();
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (!authorized(req)) {
    res.writeHead(401, {
      "WWW-Authenticate": 'Basic realm="hacfard-win10", charset="UTF-8"',
      "Cache-Control": "no-store"
    });
    return res.end("Authentication required");
  }

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Cache-Control", "no-store");

  if (req.url === "/" || req.url === "/index.html") {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8"
    });
    return res.end(page);
  }

  if (req.url.startsWith("/vm/")) {
    req.url = req.url.slice(3) || "/";
  }

  proxy.web(req, res);
});

server.on("upgrade", (req, socket, head) => {
  if (!authorized(req)) {
    socket.write(
      "HTTP/1.1 401 Unauthorized\r\n" +
      'WWW-Authenticate: Basic realm="hacfard-win10"\r\n' +
      "Connection: close\r\n\r\n"
    );
    return socket.destroy();
  }

  if (req.url.startsWith("/vm/")) {
    req.url = req.url.slice(3) || "/";
  }

  proxy.ws(req, socket, head);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("hacfard-win10 proxy: port " + PORT);
  console.log("VM target: " + TARGET);
});
