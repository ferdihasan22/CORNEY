-- OperasionalAnalisa membaca batas-aman analisa → izinkan operasional baca juga.
alter policy analisa_auditor_read on analisa
  using (private.app_role() in ('auditor', 'operasional'));
