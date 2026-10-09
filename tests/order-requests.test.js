import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database, actors } from './helpers/database.js';

let fixture;
before(async () => { fixture = await database(); });
beforeEach(async () => { await fixture.db.exec("update gd_orders set created_at=now()-interval '11 minutes'"); });
after(async () => { await fixture?.close(); });
const request = (order, kind = 'CANCEL', body = { reason: 'Không còn nhu cầu nhận hoa' }, id = randomUUID(), actor = actors.alice) =>
  fixture.as(actor, () => fixture.rpc('gd_request_order_change', [id, order.id, order.version, kind, body]));
const resolve = (entry, accept = true, response = 'Shop đã kiểm tra yêu cầu của khách', version = entry.version, actor = actors.admin) =>
  fixture.as(actor, () => fixture.rpc('gd_resolve_order_request', [entry.id, version, accept, response]));

test('OMS-F01/SEC-BR01: only the owner creates/reads/withdraws a request, admin decides', async () => {
  const order = await fixture.order();
  await assert.rejects(request(order, 'CANCEL', { reason: 'Yêu cầu trái quyền' }, randomUUID(), actors.bob), /NOT_FOUND/);
  await assert.rejects(request(order, 'CANCEL', { reason: 'Yêu cầu trái quyền' }, randomUUID(), null));
  const entry = await request(order);
  assert.equal(entry.status, 'OPEN');
  assert.equal(entry.body_hash, undefined);
  const columns = 'id,kind,body,status,version,response';
  assert.equal((await fixture.as(actors.bob, () => fixture.db.query(`select ${columns} from gd_order_requests where id=$1`, [entry.id]))).rows.length, 0);
  assert.equal((await fixture.as(actors.alice, () => fixture.db.query(`select ${columns} from gd_order_requests where id=$1`, [entry.id]))).rows.length, 1);
  await assert.rejects(fixture.as(actors.alice, () => fixture.db.query('select body_hash from gd_order_requests')), /permission denied/);
  await assert.rejects(resolve(entry, true, 'Khách không thể tự duyệt', entry.version, actors.alice), /ADMIN_REQUIRED/);
  await assert.rejects(fixture.as(actors.admin, () => fixture.db.exec("update gd_order_requests set status='ACCEPTED'")), /permission denied/);
  await assert.rejects(fixture.as(actors.bob, () => fixture.rpc('gd_withdraw_order_request', [entry.id, entry.version])), /NOT_FOUND/);
});
test('CRT-BR03: retry keeps one request and one event, changed intent conflicts even after resolution', async () => {
  const order = await fixture.order(), id = randomUUID(), body = { reason: 'Xin hủy trước khi chuẩn bị' };
  const first = await request(order, 'CANCEL', body, id);
  assert.equal((await request(order, 'CANCEL', body, id)).id, first.id);
  await assert.rejects(request(order, 'CANCEL', { reason: 'Thay nội dung cùng mã' }, id), /IDEMPOTENCY_CONFLICT/);
  await assert.rejects(request(order), /REQUEST_ALREADY_OPEN/);
  await resolve(first, false, 'Khách xác nhận vẫn tiếp tục nhận hoa');
  const retry = await request(order, 'CANCEL', body, id);
  assert.equal(retry.status, 'REJECTED');
  const events = await fixture.db.query("select count(*)::int count from gd_order_events where order_id=$1 and event='Khách gửi yêu cầu hủy'", [order.id]);
  assert.equal(events.rows[0].count, 1);
});
test('OMS-BR03/PAY-BR05: request does not cancel; acceptance cancels without claiming refund', async () => {
  let order = await fixture.order();
  order = await fixture.as(actors.admin, () => fixture.rpc('gd_update_order', [order.id, order.version, 'CONFIRMED', 'PAID', 'Đã kiểm tra khoản thu trong fixture']));
  const entry = await request(order);
  assert.equal((await fixture.db.query('select status from gd_orders where id=$1', [order.id])).rows[0].status, 'CONFIRMED');
  const decision = await resolve(entry);
  assert.equal(decision.order.status, 'CANCELLED');
  assert.equal(decision.order.payment_status, 'PAID');
  assert.equal(decision.order.request_body, undefined);
  assert.equal(decision.request.status, 'ACCEPTED');
  const again = await resolve(entry);
  assert.equal(again.order.version, decision.order.version);
  assert.equal((await fixture.db.query('select count(*)::int count from gd_memories where order_id=$1', [order.id])).rows[0].count, 0);
  await assert.rejects(resolve(entry, false), /VERSION_CONFLICT/);
});
test('DLV-BR02/OMS-BR05: recipient correction cannot silently change address, fee, date, items or message', async () => {
  const order = await fixture.order();
  const body = { name: 'Người nhận mới', phone: '+84 900000000', address: order.address, reason: 'Sửa số liên hệ người nhận' };
  await assert.rejects(request(order, 'CONTACT', { ...body, address: 'Một khu vực giao hoàn toàn khác' }), /ADDRESS_REQUOTE_REQUIRED/);
  await assert.rejects(request(order, 'CONTACT', { ...body, total: 0 }), /INVALID_CONTACT/);
  await assert.rejects(request(order, 'CONTACT', { ...body, phone: '1234' }), /INVALID_CONTACT/);
  const entry = await request(order, 'CONTACT', body);
  const decision = await resolve(entry);
  assert.equal(decision.order.recipient_name, body.name);
  assert.equal(decision.order.recipient_phone, '+84900000000');
  for (const field of ['address', 'shipping', 'total', 'items', 'bank', 'delivery_date', 'delivery_time', 'card_message', 'payment_status'])
    assert.deepEqual(decision.order[field], order[field], field);
  assert.equal(decision.order.version, order.version + 1);
  const audit = (await fixture.as(actors.admin, () => fixture.db.query("select before_data,after_data from gd_admin_audit where entity='gd_order_requests' and entity_id=$1", [entry.id]))).rows;
  assert.equal(audit.length, 1);
  assert.equal(audit[0].before_data.version, order.version);
  assert.equal(audit[0].after_data.version, decision.order.version);
  assert.equal(audit[0].after_data.requestId, entry.id);
  assert.deepEqual(audit[0].after_data.changedFields, ['recipient_name', 'recipient_phone']);
  assert.doesNotMatch(JSON.stringify(audit), /Người nhận mới|84900000000|Địa chỉ giả/);
});
test('OMS-BR04: order progress wins a stale change request and rejection remains possible', async () => {
  let order = await fixture.order();
  const entry = await request(order);
  order = await fixture.as(actors.admin, () => fixture.rpc('gd_update_order', [order.id, order.version, 'CONFIRMED', 'UNPAID', '']));
  order = await fixture.as(actors.admin, () => fixture.rpc('gd_update_order', [order.id, order.version, 'PREPARING', 'UNPAID', '']));
  await assert.rejects(resolve(entry), /REQUEST_TOO_LATE/);
  const rejected = await resolve(entry, false, 'Hoa đã vào sản xuất; shop chưa thể hủy theo yêu cầu');
  assert.equal(rejected.request.status, 'REJECTED');
  assert.equal(rejected.order.status, 'PREPARING');
  await assert.rejects(request(order), /REQUEST_TOO_LATE/);
});
test('withdraw/version/validation protect a request lifecycle and keep history', async () => {
  const order = await fixture.order();
  await assert.rejects(request({ ...order, version: order.version + 1 }), /VERSION_CONFLICT/);
  for (const [kind, body] of [['INVALID', { reason: 'Invalid kind' }], ['CANCEL', { reason: 'x' }], ['CANCEL', { reason: null }], ['CANCEL', { reason: 'Valid reason', amount: 1 }]])
    await assert.rejects(request(order, kind, body), /INVALID_ORDER_REQUEST/);
  const entry = await request(order);
  await assert.rejects(fixture.as(actors.alice, () => fixture.rpc('gd_withdraw_order_request', [entry.id, 999])), /VERSION_CONFLICT/);
  const withdraw = () => fixture.as(actors.alice, () => fixture.rpc('gd_withdraw_order_request', [entry.id, entry.version]));
  const withdrawn = await withdraw();
  assert.equal(withdrawn.status, 'WITHDRAWN');
  assert.equal((await withdraw()).version, withdrawn.version);
  await assert.rejects(resolve(withdrawn), /REQUEST_ALREADY_PROCESSED/);
  const next = await request(order);
  assert.notEqual(next.id, entry.id);
  await assert.rejects(resolve(next, true, 'x'), /INVALID_ORDER_REQUEST/);
});
test('SEC-F06: retained recipient copies are erased on the same retention transaction', async () => {
  let order = await fixture.order();
  const original = order;
  const reason = 'Sửa lại PRIVATE NAME tại PRIVATE ADDRESS, 0900000000';
  const body = { name: 'PRIVATE NAME', phone: '0900000000', address: order.address, reason };
  const entry = await request(order, 'CONTACT', body);
  await resolve(entry, true, 'Đã sửa PRIVATE NAME tại PRIVATE ADDRESS, 0900000000');
  order = (await fixture.db.query('select * from gd_orders where id=$1', [order.id])).rows[0];
  await fixture.as(actors.admin, () => fixture.rpc('gd_update_order', [order.id, order.version, 'CANCELLED', 'UNPAID', '']));
  await fixture.db.query("update gd_orders set updated_at=now()-interval '91 days' where id=$1", [order.id]);
  await fixture.db.query('select gd_expire_contacts()');
  const erased = (await fixture.as(actors.alice, () => fixture.db.query('select body from gd_order_requests where id=$1', [entry.id]))).rows[0].body;
  assert.deepEqual(erased, {});
  const events = (await fixture.as(actors.alice, () => fixture.db.query('select event,note from gd_order_events where order_id=$1', [order.id]))).rows;
  assert.doesNotMatch(JSON.stringify(events), /PRIVATE NAME|PRIVATE ADDRESS|0900000000/);
  const response = (await fixture.as(actors.alice, () => fixture.db.query('select response from gd_order_requests where id=$1', [entry.id]))).rows[0].response;
  assert.equal(response, '');
  const retry = await request(original, 'CONTACT', body, entry.id);
  assert.deepEqual(retry.body, erased);
});
test('customer/hour limit is indexed, rejects new intents and still permits saved retries', async () => {
  const order = await fixture.order(actors.bob), body = { reason: 'Kiểm thử giới hạn yêu cầu' }, id = randomUUID();
  const entry = await request(order, 'CANCEL', body, id, actors.bob);
  await fixture.db.query("insert into gd_order_requests(id,order_id,owner_id,kind,body,body_hash,order_version,status) select gen_random_uuid(),$1,$2,'CANCEL','{}','fixture',1,'REJECTED' from generate_series(1,9)", [order.id, actors.bob]);
  await fixture.as(actors.bob, () => fixture.rpc('gd_withdraw_order_request', [entry.id, entry.version]));
  await assert.rejects(request(order, 'CANCEL', body, randomUUID(), actors.bob), /REQUEST_RATE_LIMIT/);
  assert.equal((await request(order, 'CANCEL', body, id, actors.bob)).id, id);
  const source = (await fixture.db.query("select pg_get_functiondef('gd_request_order_change(uuid,uuid,integer,text,jsonb)'::regprocedure) source")).rows[0].source;
  assert.match(source, /pg_advisory_xact_lock\(hashtextextended\('customer:'/);
  assert.equal((await fixture.db.query("select count(*)::int count from pg_indexes where indexname='gd_requests_owner_rate'")).rows[0].count, 1);
});
