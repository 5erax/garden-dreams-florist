export function adminGroups(features) {
  return [
    ['Vận hành', [['dashboard', 'Tổng quan & thống kê'], ['desk', 'Bàn xử lý đơn', 'operationsDesk'], ['orders', 'Đơn hoa'], ['calendar', 'Lịch giao', 'deliveryCalendar'], ['reconciliation', 'Đối soát tiền', 'reconciliationLedger']]],
    ['Danh mục', [['products', 'Bộ sưu tập'], ['inventory', 'Kho & công thức', 'inventory'], ['memories', 'Vườn kỷ niệm']]],
    ['Cấu hình', [['shipping', 'Giao hoa'], ['shop', 'Cửa hàng & thanh toán']]],
  ].map(([name, tabs]) => [name, tabs.filter(([, , feature]) => !feature || features[feature])]);
}

export function readAdminTab(userId, features, storage) {
  const tabs = adminGroups(features).flatMap(([, items]) => items.map(([key]) => key));
  try {
    const saved = storage?.getItem(`gd-admin-tab:${userId}`);
    return tabs.includes(saved) ? saved : 'orders';
  } catch { return 'orders'; }
}
