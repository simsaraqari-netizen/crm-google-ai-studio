-- =============================================================
-- ربط العقارات بالموظفين عبر مطابقة الاسم
-- يحدّث assigned_employee_id لكل عقار يتطابق اسم موظفه
-- مع أحد الحسابات المسجلة
-- =============================================================

UPDATE public.properties p
SET assigned_employee_id = pr.id
FROM public.profiles pr
WHERE
  pr.role = 'employee'
  AND TRIM(p.assigned_employee_name) = TRIM(pr.name)
  AND (p.assigned_employee_id IS NULL OR p.assigned_employee_id != pr.id);

-- عرض ملخص ما تم
SELECT
  pr.name AS employee_name,
  pr.phone,
  pr.id AS employee_id,
  COUNT(p.id) AS properties_linked
FROM public.profiles pr
LEFT JOIN public.properties p ON p.assigned_employee_id = pr.id
WHERE pr.role = 'employee'
GROUP BY pr.id, pr.name, pr.phone
ORDER BY properties_linked DESC;
