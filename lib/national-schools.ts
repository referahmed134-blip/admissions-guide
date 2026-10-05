import catalog from "../data/national-schools.json";
import snapshot from "../data/snapshots.json";

export type NationalSchool = typeof catalog.schools[number];
const normalized=(s:string)=>s.trim().replace(/[（(]/g,"(").replace(/[）)]/g,")").replace(/\s/g,"");
const byName=new Map(catalog.schools.map(s=>[normalized(s.name),s]));
export const findNationalSchool=(name:string)=>byName.get(normalized(name));
const coverage=new Map<string,Set<number>>();
for(const r of snapshot.rows){const key=r.school+"|"+("province" in r?"undergraduate":"graduate");if(!coverage.has(key))coverage.set(key,new Set());coverage.get(key)!.add(r.year);}
export function schoolCoverage(name:string,kind:string){return [...(coverage.get(name+"|"+kind)||[])].sort();}
export const nationalMetadata={total:catalog.schools.length,undergraduate:catalog.schools.filter(s=>s.level==="本科").length,vocational:catalog.schools.filter(s=>s.level==="专科").length,regions:[...new Set(catalog.schools.map(s=>s.region))],publishedAt:catalog.publishedAt,asOf:catalog.asOf,source:catalog.source};
export function searchSchools(q:string,region:string,level:string,page:number,kind:string){
 const query=normalized(q),matched=catalog.schools.filter(s=>(!query||normalized(s.name).includes(query)||s.id===query||s.id.slice(-5)===query)&&(!region||s.region===region)&&(!level||s.level===level));
 if(query)matched.sort((a,b)=>Number(normalized(b.name)===query)-Number(normalized(a.name)===query));
 const pages=Math.max(1,Math.ceil(matched.length/20)),current=Math.min(page,pages);
 return {schools:matched.slice((current-1)*20,current*20).map(s=>({...s,years:schoolCoverage(s.name,kind)})),total:matched.length,pages,page:current,metadata:nationalMetadata};
}
let verification:{at:number;status:string;message:string;count:number|null}|undefined;
let pending:Promise<NonNullable<typeof verification>>|undefined;
export async function checkNationalDirectory(){
 if(verification&&Date.now()-verification.at<86400000)return verification;
 if(pending)return pending;
 pending=(async()=>{
  try{
   const [countResponse,noteResponse]=await Promise.all([fetch("https://hudong.moe.gov.cn/school/wcmdata/getCounts.jsp?listid=10000101",{signal:AbortSignal.timeout(4500)}),fetch("https://hudong.moe.gov.cn/school/wcmdata/getNote.jsp?listid=10000101",{signal:AbortSignal.timeout(4500)})]);
   if(!countResponse.ok||!noteResponse.ok)throw new Error();
   const [counts,note]=await Promise.all([countResponse.text(),noteResponse.text()]);
   const count=Number(counts.match(/检索出\s*(\d+)\s*条/)?.[1]),date=note.match(/(20\d{2})年(\d{1,2})月(\d{1,2})日/);
   if(!count||!date)throw new Error();
   const published=`${date[1]}-${date[2].padStart(2,"0")}-${date[3].padStart(2,"0")}`;
   const changed=count!==catalog.schools.length||published!==catalog.publishedAt;
   return verification={at:Date.now(),status:changed?"source-changed":"checked",count,message:changed?"教育部名单已有更新，当前保留已核实名录；最新名单请查看官方来源。":"已检查教育部目录，发布日与总数和当前名录一致。"};
  }catch{return verification={at:Date.now(),status:"snapshot",count:null,message:"官方检查暂不可用，显示 2026 年已核实完整名录。"};}
 })();
 try{return await pending;}finally{pending=undefined;}
}
