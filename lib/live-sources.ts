import snapshot from "../data/snapshots.json";
import provinceSources from "../data/szu-provinces.json";
import { clean,parseNews,parseNjupt,parseSzu,parseUjs,type AdmissionRow } from "./admissions";
import {findNationalSchool} from "./national-schools";
type Cached={value:string;at:number};
const cache=new Map<string,Cached>();
const pdfChecks=new Map<string,{hash:string;at:number}>();
export function cacheCheckedAt(url:string){return cache.get(url)?.at||Date.now();}
async function checkPdf(url:string,expected:string){
 let cached=pdfChecks.get(url);
 if(!cached||Date.now()-cached.at>600000){const response=await fetch(url,{signal:AbortSignal.timeout(9000)});if(!response.ok)throw new Error("pdf_unavailable");const bytes=await response.arrayBuffer();if(bytes.byteLength>3000000||bytes.byteLength<1000)throw new Error("invalid_pdf");const digest=await crypto.subtle.digest("SHA-256",bytes);cached={hash:[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,"0")).join(""),at:Date.now()};pdfChecks.set(url,cached);}
 return {unchanged:cached.hash===expected,at:cached.at};
}
export async function officialText(url:string){
 const existing=cache.get(url);if(existing&&Date.now()-existing.at<600000)return existing.value;
 const response=await fetch(url,{headers:{Accept:"text/html,application/xhtml+xml","User-Agent":"YantuAdmissions/1.0 (public admissions information)"},signal:AbortSignal.timeout(9000)});
 if(!response.ok)throw new Error("official_source_unavailable");
 const html=await response.text();if(html.length>2500000||html.length<300)throw new Error("unexpected_response");
 if(cache.size>150)cache.clear();cache.set(url,{value:html,at:Date.now()});return html;
}
export const aliases:Record<string,string>={"南邮":"南京邮电大学","南京邮电":"南京邮电大学","南开":"南开大学","暨南":"暨南大学","暨大":"暨南大学","深大":"深圳大学","深圳":"深圳大学"};
export const canonical=(input:string)=>aliases[input.trim()]||findNationalSchool(input)?.name||input.trim();
const knownPortals:Record<string,string>={"南京邮电大学":"https://yzb.njupt.edu.cn/","南开大学":"https://yzb.nankai.edu.cn/","暨南大学":"https://yz.jnu.edu.cn/","深圳大学":"https://zs.szu.edu.cn/"};
export async function directory(school:string,kind:string){
 const fallback={name:kind==="graduate"?"研招网全国院校库":"阳光高考全国院校库",url:kind==="graduate"?"https://yz.chsi.com.cn/sch/":"https://gaokao.chsi.com.cn/sch/"};
 const items:{name:string;url:string}[]=[];
 const nationallyListed=!!findNationalSchool(school);
 if(nationallyListed)items.push({name:`${school} · 教育部高校名录来源`,url:"https://hudong.moe.gov.cn/qggxmd/"});
 if(school==="江苏大学"&&kind==="graduate")items.push({name:"江苏大学官方研招网",url:"https://yz.ujs.edu.cn/"});
 if(school==="北京中医药大学"&&kind==="graduate")items.push({name:"北京中医药大学官方研究生院",url:"https://yanjiusheng.bucm.edu.cn/zsjy/sszs/index.htm"},{name:"北京中医药大学 2026 年硕士复试分数线原文",url:"https://yanjiusheng.bucm.edu.cn/zsjy/sszs/aed9e120d839490b801b29492c834dac.htm"});
 if(knownPortals[school]&&((kind==="graduate"&&school!=="深圳大学")||(kind==="undergraduate"&&school==="深圳大学")))items.push({name:`${school}官方招生网`,url:knownPortals[school]});
 if(kind==="graduate"){
  try{
   const html=await officialText(`https://yz.chsi.com.cn/sch/searchyxmc.do?yxmc=${encodeURIComponent(school)}`);
   for(const m of html.matchAll(/<a\b([^>]*js-yxk-yxmc[^>]*)>([\s\S]*?)<\/a>/gi)){
    const href=m[1].match(/href=["']([^"']+)["']/i)?.[1],name=clean(m[2]);if(href&&name.includes(school)){items.push({name:`${name} · 研招网官方院校信息`,url:new URL(href,"https://yz.chsi.com.cn").href});}
   }
   return {items:[...items,fallback],matched:nationallyListed||items.some(i=>i.name.includes("研招网官方")),available:true};
  }catch{return {items:[...items,{name:`${school} · 研招网名称搜索`,url:`https://yz.chsi.com.cn/sch/searchyxmc.do?yxmc=${encodeURIComponent(school)}`},fallback],matched:nationallyListed,available:false};}
 }
 // This public directory currently challenges automated requests. Link to its official UI
 // instead of asserting an unverified school match or trying to bypass that challenge.
 return {items:[...items,fallback],matched:nationallyListed,available:false};
}
export async function admissions(school:string,kind:string,province:string){
 let rows=(snapshot.rows as AdmissionRow[]).filter(r=>r.school===school&&(kind==="undergraduate"?!!r.province:!r.province));
 let status="snapshot",message="已核实历史快照 · 官方更新暂未验证",checkedAt:string|null=null;
 if(school==="南京邮电大学"&&kind==="graduate"){
  const sources=snapshot.sources.filter(s=>s.kind==="njupt").map(s=>({year:s.year!,url:s.url}));let discovered=false;
  try{const html=await officialText("https://yzb.njupt.edu.cn/7813/list.htm");for(const m of html.matchAll(/<a\b([^>]+)>([\s\S]*?)<\/a>/gi)){const title=clean(m[1].match(/title=["']([^"']+)["']/)?.[1]||m[2]);if(!title.includes("报考录取情况表"))continue;const year=Number(title.match(/(20\d{2})年/)?.[1]),href=m[1].match(/href=["']([^"']+)["']/)?.[1];if(year&&href&&!sources.some(s=>s.year===year)){const url=new URL(href,"https://yzb.njupt.edu.cn");if(url.hostname==="yzb.njupt.edu.cn")sources.push({year,url:url.href});}}discovered=true;}catch{}
  const updates=await Promise.allSettled(sources.slice(-6).map(async source=>{const parsed=parseNjupt(await officialText(source.url),source.year!,source.url);if(!parsed.length)throw new Error("source_format_changed");return parsed;}));
  let success=0;for(let i=0;i<updates.length;i++){const update=updates[i];if(update.status==="fulfilled"){rows=rows.filter(r=>r.year!==sources[i].year);rows.push(...update.value);success++;}}
  if(success){checkedAt=new Date(Math.max(...sources.map(s=>cacheCheckedAt(s.url)))).toISOString();status=success===updates.length&&discovered?"live":"partial";message=status==="live"?"官方网页已检查 · 数据按原表更新":"部分官方网页已检查 · 其余保留历史快照";}else message="官方来源暂不可用 · 显示已核实历史快照";
 }else if(school==="江苏大学"&&kind==="graduate"){
  const sources=snapshot.sources.filter(s=>s.kind==="ujs").map(s=>({year:s.year!,url:s.url}));let discovered=false;
  try{const html=await officialText("https://yz.ujs.edu.cn/index/gzdtyxxfw.htm");for(const m of html.matchAll(/<a\b([^>]+)>([\s\S]*?)<\/a>/gi)){const title=clean(m[2]),year=Number(title.match(/(20\d{2})年硕士研究生复试分数线及报考录取情况表/)?.[1]),href=m[1].match(/href=["']([^"']+)["']/)?.[1];if(year&&href&&!sources.some(s=>s.year===year)){const url=new URL(href,"https://yz.ujs.edu.cn/index/gzdtyxxfw.htm");if(url.hostname==="yz.ujs.edu.cn")sources.push({year,url:url.href});}}discovered=true;}catch{}
  const selected=sources.slice(-6),updates=await Promise.allSettled(selected.map(async s=>{const parsed=parseUjs(await officialText(s.url),s.year,s.url);if(parsed.length<100)throw new Error();return parsed;}));
  let success=0;updates.forEach((r,i)=>{if(r.status==="fulfilled"){rows=rows.filter(v=>v.year!==selected[i].year).concat(r.value);success++;}});
  if(success){checkedAt=new Date(Math.max(...selected.map(s=>cacheCheckedAt(s.url)))).toISOString();status=success===updates.length&&discovered?"live":"partial";message=status==="live"?"官方招生统计已检查 · 新年份按原表接入":"部分官方统计已检查 · 其余保留核实快照";}
 }else if(school==="深圳大学"&&kind==="undergraduate"){
  const provinceUrl=(provinceSources as Record<string,string>)[province];
  const source=provinceUrl?{url:provinceUrl}:snapshot.sources.find(s=>s.kind==="szu"&&s.province===province);
  if(source){try{const updated=parseSzu(await officialText(source.url),province,source.url);if(!updated.length)throw new Error();rows=rows.filter(r=>r.province!==province).concat(updated);checkedAt=new Date(cacheCheckedAt(source.url)).toISOString();status="live";message="官方录取网页已检查 · 保留原表年份";}catch{message="官方来源暂不可用 · 显示已核实录取快照";}}
 }else if((school==="南开大学"||school==="暨南大学")&&kind==="graduate"){
  const index=school==="南开大学"?"https://yzb.nankai.edu.cn/2018/0926/c2575a108685/page.htm":"https://yz.jnu.edu.cn/33067/";
  try{const files=snapshot.files.filter(f=>f.school===school);const [html,checks]=await Promise.all([officialText(index),Promise.all(files.map(f=>checkPdf(f.url,f.hash)))]);const plain=clean(html);if(!/硕士研究生|报考录取/.test(plain))throw new Error();checkedAt=new Date(Math.max(...checks.map(c=>c.at))).toISOString();const maxYear=Math.max(...rows.map(r=>r.year));const discoveredYears=[...plain.matchAll(/(20\d{2})年.{0,30}(?:报考录取|硕士研究生报考)/g)].map(m=>Number(m[1]));const newest=discoveredYears.length?Math.max(...discoveredYears):maxYear;
   status=checks.every(c=>c.unchanged)?"verified-pdf":"source-changed";message=checks.some(c=>!c.unchanged)?"官方 PDF 内容已变更 · 当前显示旧快照，数字需重新核实":newest>maxYear?`官方已出现 ${newest} 年资料 · 新年份需补充核实`:`官方 PDF 内容已检查 · 与 ${snapshot.verifiedAt} 核实快照一致`;
  }catch{message="官方目录暂不可用 · 显示已核实 PDF 历史快照";}
 }
 return {rows,status,message,checkedAt};
}
export async function news(kind:string){
 const sources=kind==="graduate"?[{url:"https://yzb.nankai.edu.cn/5509/list.htm",name:"南开大学研招网"},{url:"https://yzb.njupt.edu.cn/",name:"南京邮电大学研招网"},{url:"https://yz.jnu.edu.cn/",name:"暨南大学研招网"}]:[{url:"https://zs.szu.edu.cn/",name:"深圳大学本科招生网"},{url:"https://gaokao.chsi.com.cn/gkxx/",name:"阳光高考"}];
 const results=await Promise.allSettled(sources.map(async s=>{const articles=parseNews(await officialText(s.url),s.url,s.name);if(!articles.length)throw new Error();return articles;}));
 const fresh=results.flatMap(r=>r.status==="fulfilled"?r.value:[]),backup=(kind==="graduate"?snapshot.news.graduate:snapshot.news.undergraduate);
 const articles=[...new Map([...fresh,...backup].map(a=>[a.url,a])).values()].sort((a,b)=>b.date.localeCompare(a.date));
 return {articles,checkedAt:fresh.length?new Date().toISOString():null,message:fresh.length?"已检查官方来源 · 打开页面每 10 分钟刷新":"官方更新暂不可用 · 历史公告与官方入口"};
}
