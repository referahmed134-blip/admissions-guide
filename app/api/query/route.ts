import {admissions,canonical,directory} from "@/lib/live-sources";
import {findNationalSchool} from "@/lib/national-schools";
export async function GET(request:Request){
 const p=new URL(request.url).searchParams,kind=p.get("type")||"graduate",rawSchool=(p.get("school")||"").trim(),code=(p.get("code")||"").trim().toUpperCase(),province=p.get("province")||"安徽",category=p.get("category")||"历史";
 if(!["graduate","undergraduate"].includes(kind)||!rawSchool||rawSchool.length>60||/[<>]/.test(rawSchool)||code&&!/^[0-9A-Z]{4,8}$/.test(code))return Response.json({error:"查询条件无效"},{status:400});
 const school=canonical(rawSchool);
 const [data,officialDirectory]=await Promise.all([admissions(school,kind,province),directory(school,kind)]);
 const rows=data.rows.filter(r=>(!code||r.code.startsWith(code))&&(kind==="graduate"||(r.province===province&&r.category===category)));
 let message=data.message,status=data.status;
 if(!rows.length){status="uncovered";message=data.rows.length?"此专业 / 省份 / 科类尚无已接入记录，请查看官方招生资料。":officialDirectory.matched?"已匹配官方院校名录；该校历史统计尚未接入，可查看下方官方资料。":"未匹配已接入名录；研究院所等招生单位可通过研招网继续查询。";}
 return Response.json({school,type:kind,rows,status,message,schoolInfo:findNationalSchool(school)||null,checkedAt:data.checkedAt,dataUpdatedAt:rows.length?`${Math.max(...rows.map(r=>r.year))} 年招生资料`:"未接入",directory:officialDirectory.items},{headers:{"Cache-Control":"no-store"}});
}
