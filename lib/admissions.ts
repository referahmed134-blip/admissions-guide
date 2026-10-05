export type AdmissionRow={school:string;year:number;college:string;name:string;code:string;mode:string;applicants:number|null;admitted:number|null;recommended:number|null;score:number|null;scoreSource?:string|null;average?:number|null;rank?:number|null;ratio:number|null;source:string;note:string;province?:string;category?:string};
export const clean=(s:string)=>s.replace(/<script\b[\s\S]*?<\/script>/gi,"").replace(/<style\b[\s\S]*?<\/style>/gi,"").replace(/<[^>]*>/g,"").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/\s+/g," ").trim();
export const num=(s:string|undefined)=>s&&/^\d+(?:\.\d+)?$/.test(s.replace(/[ ,]/g,""))?Number(s.replace(/[ ,]/g,"")):null;
export function tables(html:string):string[][][]{
 return [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(t=>{
  const grid:string[][]=[];let y=0;
  for(const tr of t[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
   const row=grid[y]||=[];let x=0;
   for(const td of tr[1].matchAll(/<(?:td|th)\b([^>]*)>([\s\S]*?)<\/(?:td|th)>/gi)){
    while(row[x]!==undefined)x++;
    const rs=Math.min(200,Number(td[1].match(/rowspan\s*=\s*["']?(\d+)/i)?.[1]||1)),cs=Math.min(30,Number(td[1].match(/colspan\s*=\s*["']?(\d+)/i)?.[1]||1)),value=clean(td[2]);
    for(let dy=0;dy<rs;dy++)for(let dx=0;dx<cs;dx++){grid[y+dy]||=[];grid[y+dy][x+dx]=value;}
    x+=cs;
   }y++;
  }return grid;
 });
}
export function parseNjupt(html:string,year:number,source:string):AdmissionRow[]{
 const rows:AdmissionRow[]=[];
 const note=clean(html).match(/注[：:]\s*1[.．、]?[^。]+。/)?.[0]||"报名、录取、推免及专项计划按官方原表口径展示。表内报名/录取比例不能等同于统考一志愿录取概率。";
 for(const grid of tables(html)){
  if(!grid.slice(0,3).some(r=>r.some(c=>c?.includes("专业代码"))))continue;
  const headers=grid[0];
  const recIndex=headers.findIndex(c=>c.includes("推免"));
  const applicantIndex=headers.findIndex(c=>/报名|报考/.test(c));
  const scoreIndex=headers.findIndex(c=>c.includes("复试分数线"));
  for(const c of grid){
   if(!/^\d{4}[0-9A-Z]{2}$/.test(c[2]||""))continue;
   const m=c.findIndex(v=>v==="全日制"||v==="非全日制");if(m<0)continue;
   const applicants=num(c[applicantIndex]),admitted=num(c.at(-1));
   let score=num(c[scoreIndex]);if(score===null||score<100||score>750)score=num(c[scoreIndex+1]);if(score!==null&&(score<100||score>750))score=null;
   if(applicants===null||admitted===null)continue;
   rows.push({school:"南京邮电大学",year,college:c[1],code:c[2],name:c[3],mode:c[m],applicants,admitted,recommended:recIndex>=0?num(c[recIndex]):null,score,ratio:admitted>0?applicants/admitted:null,source,note});
  }
 }return rows;
}
export const undergraduateCodes:Record<string,string>={"经济学":"020101","国际经济与贸易":"020401","金融学":"020301K","会计学":"120203K","法学":"030101K","广告学":"050303","汉语言文学":"050101","英语":"050201","数学与应用数学":"070101","物理学":"070201","统计学":"071201","计算机科学与技术":"080901","软件工程":"080902","电子信息工程":"080701","通信工程":"080703","自动化":"080801","生物科学":"071001","临床医学":"100201K","工商管理":"120201K","行政管理":"120402","社会学":"030301","新闻学":"050301","网络与新媒体":"050306T","心理学":"071101","应用心理学":"071102","土木工程":"081001","建筑学":"082801","护理学":"101101","德语":"050203","日语":"050207","学前教育":"040106","物流管理":"120601","哲学":"010101"};
export function parseSzu(html:string,province:string,source:string):AdmissionRow[]{
 const output:AdmissionRow[]=[];
 // The verified interprovincial tables explicitly include province and subject category.
 for(const grid of tables(html))for(const c of grid){
  if(c[0]!==province||!["历史","物理","文科","理科","综合改革"].includes(c[1]))continue;
  const name=c[2],baseName=name.split(/[（(]/)[0],code=undergraduateCodes[baseName];if(!code)continue;
  const yearHeaders=grid.find(r=>r.includes("2025年")&&r.includes("2024年"));
  for(const year of [2025,2024]){
   const offset=yearHeaders?.indexOf(`${year}年`)??-1;if(offset<0)continue;
   const span=yearHeaders!.filter(v=>v===`${year}年`).length;
   const admitted=num(c[offset]),score=num(c[offset+3]);if(admitted===null||score===null)continue;
   output.push({school:"深圳大学",year,college:"本科招生",name,code,mode:"普通批",applicants:null,admitted,recommended:null,score,average:num(c[offset+2]),rank:num(c[offset+(span===6?5:4)]),ratio:null,source,province,category:c[1],note:"按官方生源省份、科类与专业分别统计；未公开该专业报名人数，不计算本科报录比。专业代码为教育部本科专业目录代码，不等同于各省志愿填报代码。"});
  }
 }
 if(province==="广东")for(const grid of tables(html)){
  const title=grid.slice(0,2).flat().join(" ");if(title.includes("专项"))continue;
  const category=title.includes("历史")?"历史":title.includes("物理")?"物理":"";if(!category)continue;
  for(const c of grid){
   if(!/^\d{3}$/.test(c[0]||"")||!c[2])continue;
   const name=c[2],code=undergraduateCodes[name.split(/[（(]/)[0]];if(!code)continue;
   for(const [year,offset] of [[2025,3],[2024,9]]){
    const admitted=num(c[offset]),score=num(c[offset+3]);if(admitted===null||score===null)continue;
    output.push({school:"深圳大学",year,college:c[1],name,code,mode:"普通批",applicants:null,admitted,recommended:null,score,average:num(c[offset+2]),rank:num(c[offset+5]),ratio:null,source,province,category,note:"广东普通批分专业录取统计，已排除地方专项计划。代码为本科专业目录代码，填报志愿请核对广东当年招生计划与专业组。"});
   }
  }
 }return output;
}
export function parseUjs(html:string,year:number,source:string):AdmissionRow[]{
 const output:AdmissionRow[]=[];
 for(const grid of tables(html)){
  const h=grid.find(r=>r.includes("专业代码")&&r.some(c=>c.includes("报考人数")));if(!h)continue;
  const codeIndex=h.indexOf("专业代码"),collegeIndex=h.indexOf("院系所名称"),nameIndex=h.indexOf("专业名称"),directionIndex=h.indexOf("专业方向代码与名称"),scoreIndex=h.indexOf("复试分数线"),recIndex=h.findIndex(c=>c.includes("推免生"));
  for(const c of grid){
   if(!/^\d{6}$/.test(c[codeIndex]||""))continue;
   for(const mode of ["全日制","非全日制"]){
    const appIndex=h.findIndex(v=>v.startsWith(mode)&&v.includes("报考人数")),admIndex=h.findIndex(v=>v.startsWith(mode)&&v.includes("录取人数"));
    const applicants=num(c[appIndex]),admitted=num(c[admIndex]);if(applicants===null||admitted===null)continue;
    const scoreText=c[scoreIndex]||"",last=scoreText.split(/[\/／]/).at(-1),score=num(last);
    output.push({school:"江苏大学",year,college:c[collegeIndex],name:c[nameIndex]+(c[directionIndex]?` · ${c[directionIndex]}`:""),code:c[codeIndex],mode,applicants,admitted,recommended:mode==="全日制"?num(c[recIndex]):null,score:score!==null&&score>=100&&score<=750?score:null,ratio:admitted>0?applicants/admitted:null,source,note:`${year>=2025?"原表为统考报考人数与统考实际录取人数，推免单列。":"按原表的全日制、非全日制报名与录取分别计算，推免单列。"}录取人数可能含调剂，比例不代表一志愿录取概率。复试要求：${scoreText}；“国家A线”未转写为学校专业分数。`});
   }
  }
 }return output;
}
export function parseNews(html:string,base:string,source:string){
 const rows:{title:string;url:string;date:string;category:string;source:string}[]=[];const seen=new Set<string>();
 for(const m of html.matchAll(/<a\b([^>]+)>([\s\S]*?)<\/a>/gi)){
  const href=m[1].match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
  const rawTitle=clean(m[1].match(/title\s*=\s*["']([^"']+)["']/i)?.[1]||m[2]);
  const title=rawTitle.replace(/^20\d{2}-\d{2}-\d{2}\s*[★]?\s*/,"").replace(/^\d{1,2}\s+20\d{2}-\d{2}\s*/,"");
  if(!href||title.length<12||!/(招生|硕士|研究生|考试|复试|录取|推免|专业目录|招生简章|高考|本科)/.test(title)||title.length>140)continue;
  let url:URL;try{url=new URL(href,base);}catch{continue;}
  if(!["https:","http:"].includes(url.protocol)||url.hostname!==new URL(base).hostname||seen.has(url.href)||!/(page\.(htm|psp)|\d+\.htm[l]?|\d+\.shtml)/.test(url.pathname))continue;
  seen.add(url.href);
  const suffix=html.slice((m.index||0)+m[0].length,(m.index||0)+m[0].length+220);
  const ownDate=rawTitle.match(/20\d{2}[-年/.]\d{1,2}[-月/.]\d{1,2}/)?.[0]||rawTitle.match(/^(\d{1,2})\s+(20\d{2})-(\d{2})/)?.slice(1).map((v,i,all)=>i===0?`${all[1]}-${all[2]}-${v.padStart(2,"0")}`:"").join("");
  const date=(ownDate||suffix.match(/20\d{2}[-年/.]\d{1,2}[-月/.]\d{1,2}/)?.[0]||url.pathname.match(/\/(20\d{2})\/(\d{2})(\d{2})\//)?.slice(1).join("-")||"").replace(/[年月/.]/g,"-");
  rows.push({title,url:url.href,date,source,category:/(简章|目录|章程|科目|招生计划)/.test(title)?"简章目录":/(复试|录取|调剂|推免)/.test(title)?"复试录取":"招生动态"});
 }return rows.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12);
}
