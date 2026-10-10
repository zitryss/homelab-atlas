import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const allowed=new Set(['/index.html','/app.js','/data.js','/model.js','/style.css']);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  let name;
  try {name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);} catch {res.writeHead(400);res.end();return;}
  if(name==='/') name='/index.html';
  if(!allowed.has(name) && !/^\/assets\/[a-zA-Z0-9_-]+\.(svg|png)$/.test(name)){res.writeHead(404);res.end('Not found');return;}
  try {
    const body=await readFile(path.join(root,name));
    res.writeHead(200,{'Content-Type':types[path.extname(name)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
    res.end(req.method==='HEAD'?undefined:body);
  } catch {res.writeHead(404);res.end('Not found');}
});
const host=process.env.HOST||'127.0.0.1', port=Number(process.env.PORT||4173);
server.listen(port,host,()=>console.log(`Homelab Atlas: http://${host}:${server.address().port} (documented topology, not live)`));
