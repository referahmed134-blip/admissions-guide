import {news} from "@/lib/live-sources";
export async function GET(request:Request){const kind=new URL(request.url).searchParams.get("type")||"graduate";if(!["graduate","undergraduate"].includes(kind))return Response.json({error:"招生类型无效"},{status:400});return Response.json(await news(kind),{headers:{"Cache-Control":"no-store"}});}
