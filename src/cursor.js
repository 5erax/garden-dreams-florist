export function beforeCursor(query, last) {
  if (!last) return query;
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      last.id,
    ) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      last.created_at,
    ) ||
    !Number.isFinite(Date.parse(last.created_at))
  )
    throw new Error("Mốc tải dữ liệu chưa hợp lệ.");
  // Preserve PostgreSQL microseconds so pagination does not skip orders.
  const date = last.created_at;
  return query.or(
    `created_at.lt.${date},and(created_at.eq.${date},id.lt.${last.id})`,
  );
}
