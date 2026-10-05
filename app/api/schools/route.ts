import {searchSchools,checkNationalDirectory,nationalMetadata} from "@/lib/national-schools";
export async function GET(request:Request){
 const p=new URL(request.url).searchParams,q=(p.get("q")||"").trim(),region=p.get("region")||"",level=p.get("level")||"",kind=p.get("type")||"graduate",rawPage=p.get("page")||"1",page=Number(rawPage);
 if(q.length>60||/[<>]/.test(q)||region&&!nationalMetadata.regions.includes(region)||level&&!["本科","专科"].includes(level)||!["graduate","undergraduate"].includes(kind)||!/^\d{1,4}$/.test(rawPage)||page<1)return Response.json({error:"查询条件无效"},{status:400});
 const result=searchSchools(q,region,level,page,kind);
 const verification=p.get("verify")==="1"?await checkNationalDirectory():undefined;
 return Response.json({...result,verification},{headers:{"Cache-Control":"no-store"}});
}
