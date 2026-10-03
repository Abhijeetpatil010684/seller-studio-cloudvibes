import {createRemoteJWKSet,jwtVerify} from 'jose';
const keys=new Map();
export async function onRequest({request,env,next,data}){
 const noStore={'cache-control':'no-store','content-type':'application/json'};
 if(!env.ACCESS_TEAM_DOMAIN||!env.ACCESS_AUD||!env.ADMIN_EMAILS)return new Response(JSON.stringify({error:'Admin access is not configured. Follow SETUP.md.'}),{status:503,headers:noStore});
 try{
  const team=env.ACCESS_TEAM_DOMAIN.replace(/\/$/,'');if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(team))throw Error('Invalid Access domain');
  if(!keys.has(team))keys.set(team,createRemoteJWKSet(new URL(team+'/cdn-cgi/access/certs')));
  const token=request.headers.get('Cf-Access-Jwt-Assertion');if(!token)throw Error('Sign in required');
  const {payload}=await jwtVerify(token,keys.get(team),{issuer:team,audience:env.ACCESS_AUD,algorithms:['RS256']});
  const allowed=env.ADMIN_EMAILS.toLowerCase().split(',').map(x=>x.trim());if(!payload.email||!allowed.includes(payload.email.toLowerCase()))throw Error('Not authorised');data.email=payload.email;
  if(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==new URL(request.url).origin)return new Response(JSON.stringify({error:'Invalid request origin'}),{status:403,headers:noStore});
 }catch{return new Response(JSON.stringify({error:'Sign in through the protected admin page.'}),{status:401,headers:noStore})}
 const response=await next();const headers=new Headers(response.headers);headers.set('cache-control','no-store');return new Response(response.body,{status:response.status,headers});
}
