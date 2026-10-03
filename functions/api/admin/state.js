import {emptyState,validateState} from '../../../src/model.js';
const json=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store'}});
export async function onRequest({request,env}){
 if(!env.DB)return json({error:'Bind the D1 database as DB.'},503);
 try{
  if(request.method==='GET'){const row=await env.DB.prepare('SELECT state,revision FROM app_state WHERE id=1').first();if(!row)return json({error:'Run schema.sql to initialise the database.'},503);return json({state:JSON.parse(row.state),revision:row.revision})}
  if(request.method!=='PUT')return json({error:'Method not allowed'},405);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required'},415);
  const raw=await request.text();if(raw.length>2000000)return json({error:'Data is too large. Export and archive older records.'},413);const body=JSON.parse(raw);validateState(body.state);if(!Number.isInteger(body.revision)||body.revision<0)return json({error:'Invalid revision'},400);
  const result=await env.DB.prepare('UPDATE app_state SET state=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=1 AND revision=?').bind(JSON.stringify(body.state),body.revision).run();
  if(!result.meta.changes)return json({error:'Another session saved changes. Reload before editing; your unsaved entry has not overwritten their data.'},409);
  return json({ok:true,revision:body.revision+1});
 }catch(e){return json({error:e.message.includes('no such table')?'Run schema.sql first.':'Unable to save or load inventory: '+e.message},400)}
}
