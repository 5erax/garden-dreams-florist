export function moveProduct(rows, id, target) {
  const ids = rows.map(row => row.id);
  const from = ids.indexOf(id), to = ids.indexOf(target);
  if (from < 0 || to < 0 || from === to) return null;
  ids.splice(from, 1);
  ids.splice(to, 0, id);
  return ids;
}
