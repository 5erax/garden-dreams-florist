import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { database, actors } from './helpers/database.js';
import { vietnamDate } from '../src/order.js';

let fixture;
const today=vietnamDate();
before(async()=>{fixture=await database();});
beforeEach(async()=>{await fixture.db.exec("update gd_orders set created_at=now()-interval '11 minutes'");});
after(async()=>{await fixture?.close();});
const balance=order=>fixture.as(actors.alice,()=>fixture.rpc('gd_payment_balance',[order.id]));
const reconcile=(order,action='RECEIPT',id=randomUUID(),evidence='Đã kiểm tra giao dịch thực trong fixture',reference='',actor=actors.admin)=>
  fixture.as(actor,()=>fixture.rpc('gd_reconcile_payment',[id,order.id,order.version,action,evidence,reference]));

test('PAY-BR01/SEC-BR01: customers cannot settle, read evidence or invoke the private update engine',async()=>{
  const order=await fixture.order();
  for(const actor of[null,actors.alice,actors.bob]){
    await assert.rejects(reconcile(order,'RECEIPT',randomUUID(),'Chưa kiểm tra ngân hàng','',actor));
    await assert.rejects(fixture.as(actor,()=>fixture.rpc('gd_reconciliation_queue')));
    await assert.rejects(fixture.as(actor,()=>fixture.rpc('gd_reconciliation_totals',[today,today])));
  }
  await assert.rejects(fixture.as(actors.bob,()=>fixture.rpc('gd_payment_balance',[order.id])),/NOT_FOUND/);
  await assert.rejects(fixture.as(actors.alice,()=>fixture.db.query('select gd_private.apply_order_update($1,1,\'PENDING\',\'PAID\',\'Fake receipt\')',[order.id])),/permission denied/);
  assert.equal((await fixture.as(actors.alice,()=>fixture.db.query('select evidence from gd_payment_ledger'))).rows.length,0);
  assert.equal((await balance(order)).receivable,390000);
});
test('PAY-BR02: lost acknowledgement retries one receipt and changed evidence/reference conflicts',async()=>{
  const order=await fixture.order(),id=randomUUID();
  const saved=await reconcile(order,'RECEIPT',id,'INTERNAL BANK PROOF','bank-20261010-01');
  assert.equal(saved.order.payment_status,'PAID');
  assert.equal(saved.event.reference,'BANK-20261010-01');
  assert.equal(saved.event.amount,390000);
  assert.equal(saved.event.request_hash,undefined);
  const retry=await reconcile(order,'RECEIPT',id,'INTERNAL BANK PROOF','bank-20261010-01');
  assert.equal(retry.event.id,saved.event.id);
  assert.equal(retry.order.version,saved.order.version);
  await assert.rejects(reconcile(order,'RECEIPT',id,'Different proof','bank-20261010-01'),/IDEMPOTENCY_CONFLICT/);
  await assert.rejects(reconcile(order,'RECEIPT',id,'INTERNAL BANK PROOF','different-reference'),/IDEMPOTENCY_CONFLICT/);
  await assert.rejects(reconcile(order),/VERSION_CONFLICT/);
  await assert.rejects(reconcile(saved.order),/INVALID_PAYMENT_TRANSITION/);
  const entries=(await fixture.as(actors.admin,()=>fixture.db.query('select id,amount from gd_payment_ledger where order_id=$1',[order.id]))).rows;
  assert.equal(entries.length,1);
  const summary=await balance(order);
  assert.equal(summary.received,390000);assert.equal(summary.refunded,0);assert.equal(summary.receivable,0);
  assert.doesNotMatch(JSON.stringify(summary),/INTERNAL BANK PROOF|BANK-20261010-01|actor|hash/);
  const timeline=(await fixture.as(actors.alice,()=>fixture.db.query('select note from gd_order_events where order_id=$1',[order.id]))).rows;
  assert.doesNotMatch(JSON.stringify(timeline),/INTERNAL BANK PROOF|BANK-20261010-01/);
});
test('PAY-BR04/05: delivered COD stays uncollected until verified; refund is full and revokes sharing',async()=>{
  let order=await fixture.order();
  for(const status of['CONFIRMED','PREPARING','SHIPPING','DELIVERED'])
    order=await fixture.as(actors.admin,()=>fixture.rpc('gd_update_order',[order.id,order.version,status,'UNPAID','']));
  assert.equal((await balance(order)).heldCash,0);
  assert.equal((await balance(order)).receivable,390000);
  assert.equal((await fixture.db.query('select count(*)::int count from gd_memories where order_id=$1',[order.id])).rows[0].count,0);
  const receipt=await reconcile(order);order=receipt.order;
  const memory=(await fixture.db.query('select id from gd_memories where order_id=$1',[order.id])).rows[0];
  await fixture.as(actors.alice,()=>fixture.rpc('gd_share_memory',[memory.id,'LINK','']));
  const refundId=randomUUID(),refund=await reconcile(order,'REFUND',refundId,'Đã hoàn đầy đủ khoản tiền ngoài web','REFUND-COD-01');
  assert.equal(refund.order.status,'DELIVERED');
  assert.equal(refund.order.payment_status,'REFUNDED');
  assert.equal(refund.balance.refunded,390000);assert.equal(refund.balance.heldCash,0);
  assert.equal(refund.balance.refundable,0);assert.equal(refund.balance.receivable,0);
  assert.equal((await reconcile(order,'REFUND',refundId,'Đã hoàn đầy đủ khoản tiền ngoài web','REFUND-COD-01')).event.id,refundId);
  await assert.rejects(reconcile(refund.order,'REFUND'),/INVALID_PAYMENT_TRANSITION/);
  const revoked=(await fixture.db.query('select revoked,share_token from gd_memories where id=$1',[memory.id])).rows[0];
  assert.equal(revoked.revoked,true);assert.equal(revoked.share_token,null);
});
test('references cannot settle a second order and failed duplicate transactions roll back payment and audit',async()=>{
  const one=await fixture.order(),two=await fixture.order();
  await reconcile(one,'RECEIPT',randomUUID(),'Phiếu thu được kiểm tra','RECEIPT-UNIQUE');
  await assert.rejects(reconcile(two,'RECEIPT',randomUUID(),'Phiếu thu bị dùng lại','receipt-unique'),/PAYMENT_REFERENCE_USED/);
  const current=(await fixture.db.query('select payment_status,version from gd_orders where id=$1',[two.id])).rows[0];
  assert.equal(current.payment_status,'UNPAID');assert.equal(current.version,1);
  assert.equal((await fixture.db.query('select count(*)::int count from gd_payment_ledger where order_id=$1',[two.id])).rows[0].count,0);
  assert.equal((await fixture.db.query("select count(*)::int count from gd_admin_audit where entity='gd_payment_ledger' and after_data->>'orderId'=$1",[two.id])).rows[0].count,0);
});
test('legacy update callers still create immutable full-payment ledger entries with private evidence',async()=>{
  const order=await fixture.order();
  const paid=await fixture.as(actors.admin,()=>fixture.rpc('gd_update_order',[order.id,order.version,'CONFIRMED','PAID','PRIVATE FINANCE EVIDENCE']));
  const same=await fixture.as(actors.admin,()=>fixture.rpc('gd_update_order',[paid.id,paid.version,'PREPARING','PAID','Đang chuẩn bị hoa']));
  assert.equal((await fixture.db.query('select count(*)::int count from gd_payment_ledger where order_id=$1',[order.id])).rows[0].count,1);
  const refunded=await fixture.as(actors.admin,()=>fixture.rpc('gd_update_order',[same.id,same.version,'CANCELLED','REFUNDED','Refund recorded externally']));
  assert.equal(refunded.payment_status,'REFUNDED');
  assert.equal((await balance(refunded)).heldCash,0);
  await assert.rejects(fixture.as(actors.admin,()=>fixture.db.exec('delete from gd_payment_ledger')),/permission denied/);
  await assert.rejects(fixture.as(actors.admin,()=>fixture.db.exec('update gd_payment_ledger set amount=1')),/permission denied/);
  const audit=(await fixture.as(actors.admin,()=>fixture.db.query("select before_data,after_data from gd_admin_audit where entity='gd_payment_ledger' and after_data->>'orderId'=$1",[order.id]))).rows;
  assert.equal(audit.length,2);assert.doesNotMatch(JSON.stringify(audit),/PRIVATE FINANCE EVIDENCE|Refund recorded externally/);
});
test('cancellation, malformed requests and immutable snapshot amounts prevent false money transitions',async()=>{
  let order=await fixture.order();
  for(const [action,evidence,reference] of[['PARTIAL','Valid evidence',''],['RECEIPT','x',''],['RECEIPT','Valid evidence','%'],['RECEIPT','Valid evidence','x'.repeat(121)]])
    await assert.rejects(reconcile(order,action,randomUUID(),evidence,reference),/INVALID_RECONCILIATION/);
  await assert.rejects(reconcile(order,'REFUND'),/INVALID_PAYMENT_TRANSITION/);
  order=await fixture.as(actors.admin,()=>fixture.rpc('gd_update_order',[order.id,order.version,'CANCELLED','UNPAID','']));
  await assert.rejects(reconcile(order),/INVALID_PAYMENT_TRANSITION/);
  const summary=await balance(order);assert.equal(summary.receivable,0);assert.equal(summary.received,0);
  const unpaid=await fixture.as(actors.admin,()=>fixture.rpc('gd_reconciliation_queue',['UNPAID','ALL',order.reference,null,null,30]));
  assert.deepEqual(unpaid,[]);
});
test('FIN-BR01/03: reports use Vietnam settlement days, queues are paged and payloads omit contacts',async()=>{
  const period=await fixture.as(actors.admin,()=>fixture.rpc('gd_reconciliation_totals',[today,today]));
  const source=(await fixture.db.query("select coalesce(sum(amount) filter(where kind='RECEIPT'),0)::bigint received,coalesce(sum(amount) filter(where kind='REFUND'),0)::bigint refunded,count(*)::int events from gd_payment_ledger where source='MANUAL'")).rows[0];
  assert.equal(period.received,Number(source.received));assert.equal(period.refunded,Number(source.refunded));
  assert.equal(period.netCollected,period.received-period.refunded);assert.equal(period.eventCount,source.events);
  assert.equal(period.basis,'SETTLEMENT_DATE');
  await assert.rejects(fixture.as(actors.admin,()=>fixture.rpc('gd_reconciliation_totals',['2026-01-01','2026-12-31'])),/INVALID_REPORT_PERIOD/);
  await assert.rejects(fixture.as(actors.admin,()=>fixture.rpc('gd_reconciliation_totals',[today,'2000-01-01'])),/INVALID_REPORT_PERIOD/);
  const page=await fixture.as(actors.admin,()=>fixture.rpc('gd_reconciliation_queue',['ALL','COD','',null,null,1]));
  assert.equal(page.length,2);
  assert.doesNotMatch(JSON.stringify(page),/address|phone|recipient|PRIVATE CARD|evidence|bank|request_body/);
  const next=await fixture.as(actors.admin,()=>fixture.rpc('gd_reconciliation_queue',['ALL','COD','',page[0].created_at,page[0].id,1]));
  assert.equal(next[0].id,page[1].id);
  for(const args of[['INVALID','ALL','',null,null,30],['ALL','CASH','',null,null,30],['ALL','ALL','%',null,null,30],['ALL','ALL','',null,null,100]])
    await assert.rejects(fixture.as(actors.admin,()=>fixture.rpc('gd_reconciliation_queue',args)),/INVALID_QUEUE_FILTER/);
});
test('SEC/FIN: production aggregates exclude test orders even if money events exist',async()=>{
  const order=await fixture.order(),receipt=await reconcile(order);
  const before=await fixture.as(actors.admin,()=>fixture.rpc('gd_reconciliation_totals',[today,today]));
  await fixture.db.exec('alter table gd_orders disable trigger classify_order');
  try{await fixture.db.query('update gd_orders set is_test=true where id=$1',[order.id]);}
  finally{await fixture.db.exec('alter table gd_orders enable trigger classify_order');}
  const after=await fixture.as(actors.admin,()=>fixture.rpc('gd_reconciliation_totals',[today,today]));
  assert.equal(before.received-after.received,receipt.event.amount);
  const queue=await fixture.as(actors.admin,()=>fixture.rpc('gd_reconciliation_queue',['ALL','ALL',order.reference,null,null,30]));
  assert.deepEqual(queue,[]);
});
test('FIN-BR03: Vietnam midnight includes the start and excludes the following day for receipts and refunds',async()=>{
  const isolated=await database();
  try{
    const times=['2030-01-09T16:59:59Z','2030-01-09T17:00:00Z','2030-01-10T16:59:59Z','2030-01-10T17:00:00Z'];
    for(let index=0;index<times.length;index++){
      const order=await isolated.order(actors.alice,{items:[{id:1,quantity:index+1}],expectedTotal:390000*(index+1)});
      const receipt=await isolated.as(actors.admin,()=>isolated.rpc('gd_reconcile_payment',[randomUUID(),order.id,order.version,'RECEIPT','Fixture receipt confirmed','']));
      await isolated.db.query('update gd_payment_ledger set effective_at=$1 where id=$2',[times[index],receipt.event.id]);
      if(index===2){
        const refund=await isolated.as(actors.admin,()=>isolated.rpc('gd_reconcile_payment',[randomUUID(),order.id,receipt.order.version,'REFUND','Fixture refund confirmed','']));
        await isolated.db.query('update gd_payment_ledger set effective_at=$1 where id=$2',[times[3],refund.event.id]);
      }
    }
    const report=await isolated.as(actors.admin,()=>isolated.rpc('gd_reconciliation_totals',['2030-01-10','2030-01-10']));
    assert.equal(report.received,390000*5);assert.equal(report.refunded,0);assert.equal(report.eventCount,2);
    const following=await isolated.as(actors.admin,()=>isolated.rpc('gd_reconciliation_totals',['2030-01-11','2030-01-11']));
    assert.equal(following.received,390000*4);assert.equal(following.refunded,390000*3);assert.equal(following.eventCount,2);
  }finally{await isolated.close();}
});

test('opening snapshots preserve old balances without inventing a settlement date or new collected cash',async()=>{
  const old=await database({through:'202610090011_order_requests.sql'});
  try{
    let paid=await old.order(),refunded=await old.order();
    paid=await old.as(actors.admin,()=>old.rpc('gd_update_order',[paid.id,paid.version,'CONFIRMED','PAID','Existing verified receipt']));
    refunded=await old.as(actors.admin,()=>old.rpc('gd_update_order',[refunded.id,refunded.version,'CONFIRMED','PAID','Existing verified receipt']));
    refunded=await old.as(actors.admin,()=>old.rpc('gd_update_order',[refunded.id,refunded.version,'CANCELLED','REFUNDED','Existing verified refund']));
    await old.db.exec(await readFile(new URL('../supabase/migrations/202610100012_payment_ledger.sql',import.meta.url),'utf8'));
    const entries=(await old.db.query('select source,effective_at,actor_id from gd_payment_ledger')).rows;
    assert.equal(entries.length,3);
    assert.ok(entries.every(entry=>entry.source==='LEGACY'&&entry.effective_at===null&&entry.actor_id===null));
    const snapshot=await old.as(actors.admin,()=>old.rpc('gd_reconciliation_totals',[today,today]));
    assert.equal(snapshot.received,0);assert.equal(snapshot.refunded,0);assert.equal(snapshot.eventCount,0);
    assert.equal(snapshot.legacyReceiptBalance,780000);assert.equal(snapshot.legacyRefundBalance,390000);
    assert.equal((await old.as(actors.alice,()=>old.rpc('gd_payment_balance',[paid.id]))).heldCash,390000);
    assert.equal((await old.as(actors.alice,()=>old.rpc('gd_payment_balance',[refunded.id]))).heldCash,0);
  }finally{await old.close();}
});
