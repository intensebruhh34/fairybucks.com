import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';

export async function checkParentDataRights(db,root){
 const a=randomUUID(),b=randomUUID(),fa=randomUUID(),fb=randomUUID();
 const child=randomUUID(),sibling=randomUUID(),other=randomUUID();
 const email=a+'@example.test',emailB=b+'@example.test';
 const request=randomUUID();
 await db.exec(`insert into auth.users(id,email,email_confirmed_at) values('${a}','${email}',now()),('${b}','${emailB}',now());
 insert into public.families(id,owner_id) values('${fa}','${a}'),('${fb}','${b}');
 insert into public.child_profiles(id,family_id,nickname) values('${child}','${fa}','Rights child'),('${sibling}','${fa}','Keep sibling'),('${other}','${fb}','Other family');
 insert into public.fairy_wallets(child_id,balance) values('${child}',10),('${sibling}',20),('${other}',30);
 insert into public.fairy_transactions(child_id,amount,description) values('${child}',10,'Rights reward');
 insert into public.lost_teeth(child_id,lost_on) values('${child}',current_date);
 insert into public.treasure_requests(id,child_id,treasure_id,status,price_at_request)
 values('${request}','${child}',(select id from public.treasures where shop_key=1),'pending',15);
 insert into private.parent_pin_security(parent_id,pin_hash) values('${a}','SECRET-PIN-HASH');
 insert into private.fairybucks_child_sessions(child_id,token_hash,expires_at)
 values('${child}',extensions.digest('SECRET-CHILD-TOKEN','sha256'),now()+interval '1 hour');`);
 const exportTemplate=readFileSync(root+'/supabase/operators/export_family_data.sql','utf8');
 const exportSQL=(parent=a,address=email)=>exportTemplate.replace('REPLACE_WITH_VERIFIED_PARENT_EMAIL',address)
  .replace('00000000-0000-0000-0000-000000000000',parent)
  .replace("'REPLACE_WITH_VERIFIED_REQUEST_REF'::text","'RIGHTS-TEST'::text");
 assert.equal((await db.query(exportTemplate)).rows.length,0,'Default export leaked data');
 assert.equal((await db.query(exportSQL(a,emailB))).rows.length,0,'Mismatched identity exported data');
 const data=(await db.query(exportSQL())).rows[0].family_data;
 assert.deepEqual(data.explorers.map(c=>c.id).sort(),[child,sibling].sort());
 assert.equal(data.wallets.length,2);assert.equal(data.teeth.length,1);
 assert.equal(data.transactions.length,1);assert.equal(data.treasure_requests[0].id,request);
 const serialized=JSON.stringify(data);
 for(const secret of ['SECRET-PIN-HASH','SECRET-CHILD-TOKEN',emailB,other,'token_hash','pin_hash','"lease"'])
  assert.ok(!serialized.includes(secret),'Export included another family or security data: '+secret);
 const deletion=readFileSync(root+'/supabase/operators/delete_explorer_data.sql','utf8');
 const deleteSQL=(parent=a,address=email,target=child,confirmed=true)=>deletion
  .replace("parent uuid:='00000000-0000-0000-0000-000000000000'",`parent uuid:='${parent}'`)
  .replace("child uuid:='00000000-0000-0000-0000-000000000000'",`child uuid:='${target}'`)
  .replace('REPLACE_WITH_VERIFIED_PARENT_EMAIL',address)
  .replace("case_ref text:='REPLACE_WITH_VERIFIED_REQUEST_REF'","case_ref text:='RIGHTS-TEST'")
  .replace('REPLACE_WITH_DELETE_EXPLORER_AND_UUID',confirmed?'DELETE EXPLORER '+target:'WRONG');
 async function rejects(sql){let failed=false;try{await db.exec(sql);}catch{failed=true;await db.exec('rollback');}assert.ok(failed,'Unsafe deletion accepted');}
 await rejects(deletion);await rejects(deleteSQL(a,email,child,false));
 await rejects(deleteSQL(b,emailB));await rejects(deleteSQL(a,emailB));
 // An unknown dependency must roll the whole transaction back, including session revocation.
 await db.exec(`create table public.rights_test_dependency(child_id uuid references public.child_profiles(id));
 insert into public.rights_test_dependency values('${child}');`);
 await rejects(deleteSQL());
 assert.equal((await db.query(`select count(*)::int as n from public.treasure_requests where child_id='${child}'`)).rows[0].n,1);
 assert.equal((await db.query(`select count(*)::int as n from private.fairybucks_child_sessions where child_id='${child}'`)).rows[0].n,1);
 await db.exec('drop table public.rights_test_dependency');
 await db.exec(deleteSQL());
 for(const table of ['child_profiles','fairy_wallets','fairy_transactions','lost_teeth','treasure_requests']){
  const key=table==='child_profiles'?'id':'child_id';
  assert.equal((await db.query(`select count(*)::int as n from public.${table} where ${key}='${child}'`)).rows[0].n,0);
 }
 assert.equal((await db.query(`select count(*)::int as n from private.fairybucks_child_sessions where child_id='${child}'`)).rows[0].n,0);
 assert.equal((await db.query(`select balance from public.fairy_wallets where child_id='${sibling}'`)).rows[0].balance,20);
 assert.equal((await db.query(`select balance from public.fairy_wallets where child_id='${other}'`)).rows[0].balance,30);
 assert.equal((await db.query(`select count(*)::int as n from auth.users where id='${a}'`)).rows[0].n,1);
 assert.deepEqual((await db.query(exportSQL())).rows[0].family_data.explorers.map(c=>c.id),[sibling]);
 await rejects(deleteSQL());
 console.log('PASS parent data rights: scoped copy, secret exclusion, exact deletion confirmation, dependency rollback, sibling/family preservation');
}
