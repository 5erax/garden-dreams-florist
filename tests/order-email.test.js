import test from 'node:test';
import assert from 'node:assert/strict';
import {notificationHandler} from '../server/notification-handler.js';
import {database,actors} from './helpers/database.js';

test('notification authentication, SMTP ambiguity and successful dispatch',async()=>{
 const outcomes=[];const handle=notificationHandler({secret:'abcd',verify:async()=>{},claim:async()=>[{id:1},{id:2}],send:async row=>{if(row.id===2)throw Object.assign(Error(),{code:'ETIMEDOUT'});},finish:async(row,state)=>outcomes.push([row.id,state])});
 const request=(secret,mode)=>new Request('https://example.com',{method:'POST',headers:{authorization:`Bearer ${secret}`},body:JSON.stringify({mode})});
 assert.equal((await handle(request('éééé','dispatch'))).status,401);
 assert.equal((await handle(request('abcd','invalid'))).status,400);
 assert.deepEqual(await (await handle(request('abcd','verify'))).json(),{smtpVerified:true});
 assert.deepEqual(await (await handle(request('abcd','dispatch'))).json(),{sent:1,failed:1});
 assert.deepEqual(outcomes,[[1,'SENT'],[2,'UNKNOWN']]);
 const badSmtp=notificationHandler({secret:'abcd',verify:async()=>{throw Object.assign(Error('private SMTP details'),{code:'EAUTH'});}});
 assert.deepEqual(await (await badSmtp(request('abcd','verify'))).json(),{error:'NOTIFICATION_FAILED',code:'EAUTH'});
});

test('outbox is private, leases once, strips customer information and finishes once',async()=>{
 const fixture=await database();try{
  const order=await fixture.order();
  await assert.rejects(fixture.as(actors.alice,()=>fixture.rpc('gd_claim_order_notifications')),/permission denied/);
  const jobs=await fixture.rpc('gd_claim_order_notifications');assert.equal(jobs.length,1);assert.equal(jobs[0].id,order.id);assert.equal(jobs[0].address,undefined);assert.equal(jobs[0].phone,undefined);
  assert.deepEqual(await fixture.rpc('gd_claim_order_notifications'),[]);
  await fixture.rpc('gd_finish_order_notification',[order.id,jobs[0].lease,'SENT','']);
  await assert.rejects(fixture.rpc('gd_finish_order_notification',[order.id,jobs[0].lease,'SENT','']),/LEASE_CONFLICT/);
  assert.equal((await fixture.as(actors.admin,()=>fixture.rpc('gd_order_notification_status'))).pending,0);
 }finally{await fixture.close();}
});
