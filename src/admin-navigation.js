export function readAdminTab(userId, features, storage) {
  const tabs = ['orders', 'products', 'shipping', 'shop', 'dashboard'];
  for (const [feature, tab] of [['deliveryCalendar','calendar'],['operationsDesk','desk'],['reconciliationLedger','reconciliation'],['inventory','inventory']])
    if (features[feature]) tabs.push(tab);
  try {
    const saved = storage?.getItem(`gd-admin-tab:${userId}`);
    return tabs.includes(saved) ? saved : 'orders';
  } catch { return 'orders'; }
}
