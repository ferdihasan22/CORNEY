-- Lengkapi skema config agar SETIA dengan bentuk data app (master store):
-- parents butuh active + threshold (peringatan stok rendah);
-- menus butuh sort (urutan tampil, store mengandalkan urutan array).
alter table parents add column if not exists active boolean default true;
alter table parents add column if not exists threshold int default 5;
alter table menus   add column if not exists sort int default 0;
