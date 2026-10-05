import fs from 'node:fs';
import crypto from 'node:crypto';
import {parseNjupt,parseSzu,parseNews,parseUjs} from '../lib/admissions.ts';
const root='../sources';
const sources=[
 {kind:'ujs',year:2024,url:'https://yz.ujs.edu.cn/info/1014/6087.htm',file:'ujs2024.html'},
 {kind:'ujs',year:2025,url:'https://yz.ujs.edu.cn/info/1014/7517.htm',file:'ujs2025.html'},
 {kind:'ujs',year:2026,url:'https://yz.ujs.edu.cn/info/1014/8467.htm',file:'ujs2026.html'},
 {kind:'njupt',year:2023,url:'https://yzb.njupt.edu.cn/2023/0901/c7813a269522/page.htm',file:'njupt-2023.html'},
 {kind:'njupt',year:2024,url:'https://yzb.njupt.edu.cn/2024/0622/c7813a269521/page.htm',file:'njupt-2024.html'},
 {kind:'njupt',year:2025,url:'https://yzb.njupt.edu.cn/2025/0526/c7813a284312/page.htm',file:'njupt-2025.html'},
 {kind:'njupt',year:2026,url:'https://yzb.njupt.edu.cn/2026/0529/c7813a302875/page.htm',file:'njupt-2026.html'},
 {kind:'szu',province:'安徽',url:'https://zs.szu.edu.cn/info/1153/2990.htm',file:'szu-anhui.html'},
 {kind:'szu',province:'广东',url:'https://zs.szu.edu.cn/info/1153/2985.htm',file:'szu-guangdong.html'},
];
let rows=JSON.parse(fs.readFileSync('../pdf-snapshots.json','utf8'));
for(const source of sources){const h=fs.readFileSync(`${root}/${source.file}`,'utf8');const parsed=source.kind==='ujs'?parseUjs(h,source.year,source.url):source.kind==='njupt'?parseNjupt(h,source.year,source.url):parseSzu(h,source.province,source.url);if(!parsed.length)throw new Error('No verified data '+source.file);rows.push(...parsed);}
const files=[{school:'南开大学',url:'https://yzb.nankai.edu.cn/_upload/article/files/5b/0c/336faf084039ae2b761653fc6ef6/f6ae48d7-e3ad-4b17-b9d4-95edf51d98ae.pdf',file:'nankai.pdf'},
 {school:'暨南大学',url:'https://yz.jnu.edu.cn/_upload/article/files/12/32/5163bb08427582d706034abd9473/d644ac6e-ad41-446e-a40e-3d661068c839.pdf',file:'jnu-2025.pdf'},
 {school:'暨南大学',url:'https://yz.jnu.edu.cn/_upload/article/files/b6/f0/c9d839214bf1be6b51a3c20588ff/2a62e916-9fd3-4662-bcdc-8ac39279cf51.pdf',file:'jnu-2026.pdf'}].map(f=>({...f,hash:crypto.createHash('sha256').update(fs.readFileSync(`${root}/${f.file}`)).digest('hex')}));
const news={graduate:parseNews(fs.readFileSync(`${root}/nankai-news.html`,'utf8'),'https://yzb.nankai.edu.cn/','南开大学研招网'),undergraduate:parseNews(fs.readFileSync(`${root}/szu-news.html`,'utf8'),'https://zs.szu.edu.cn/','深圳大学本科招生网')};
fs.mkdirSync('data',{recursive:true});fs.writeFileSync('data/snapshots.json',JSON.stringify({rows,sources,files,news,verifiedAt:'2026-10-05'},null,2));
console.log(JSON.stringify({records:rows.length,schools:[...new Set(rows.map(r=>r.school))],news:Object.fromEntries(Object.entries(news).map(([k,v])=>[k,v.length]))}));
