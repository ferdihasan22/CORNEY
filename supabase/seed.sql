-- CORNEY — seed data KONFIGURASI (dijalankan `supabase db reset` / branch).
-- Hanya config (branches/menus/dll); tabel transaksi sengaja KOSONG ("mulai bersih").
-- Foto menu/banner kosong → diisi via Cloudinary (FASE 7). Idempotent.

-- branches
insert into branches (id,name,address,wa,maps,maxim_name,kembalian,stop_online,close_booth,active) values
 ('sepinggan','CORNEY Sepinggan','Jl. Marsma R. Iswahyudi, Balikpapan','6281200000001','https://www.google.com/maps/search/?api=1&query=CORNEY+Sepinggan+Balikpapan','Corney Sepinggan',200000,'21:30','22:00',true),
 ('gunungsari','CORNEY Gunung Sari','Jl. Gunung Sari Ilir, Balikpapan','6281200000002','https://www.google.com/maps/search/?api=1&query=CORNEY+Gunung+Sari+Balikpapan','Corney Gunung Sari',200000,'21:30','22:00',true)
on conflict (id) do nothing;

-- parents (isian induk)
insert into parents (id,name,sort,active,threshold) values
 ('mozza','Keju Mozza',0,true,5),('sosis','Sosis Reguler',1,true,5),('jumbo','Sosis Jumbo',2,true,5),('mix','Mix',3,true,5)
on conflict (id) do nothing;

-- menus (11 varian; img kosong → FASE 7)
insert into menus (id,parent_id,name,category,price,label,img,sort,active) values
 ('sweet_coklat','mozza','Sweet Coklat','sweet',17000,'Best Seller','',0,true),
 ('sweet_tiramisu','mozza','Sweet Tiramisu','sweet',17000,'','',1,true),
 ('sweet_greentea','mozza','Sweet Greentea','sweet',17000,'','',2,true),
 ('mozza_ori','mozza','Mozza Ori','savory',17000,'','',3,true),
 ('mozza_kentang','mozza','Mozza Kentang','savory',20000,'Pedas','',4,true),
 ('sosis_ori','sosis','Sosis Ori','savory',15000,'','',5,true),
 ('sosis_kentang','sosis','Sosis Kentang','savory',18000,'','',6,true),
 ('jumbo_ori','jumbo','Jumbo Ori','savory',20000,'','',7,true),
 ('jumbo_kentang','jumbo','Jumbo Kentang','savory',23000,'','',8,true),
 ('mix_ori','mix','Mix Ori','savory',19000,'','',9,true),
 ('mix_kentang','mix','Mix Kentang','savory',22000,'','',10,true)
on conflict (id) do nothing;

-- sauces
insert into sauces (id,name,price) values
 ('tomat','Saus Tomat',0),('sambal','Saus Sambal',0),('keju','Saus Keju',3000),('mayo','Mayonaise',3000)
on conflict (id) do nothing;

-- promos
insert into promos (id,active,data) values
 ('PRM-merdeka',true, '{"name":"Diskon Merdeka","type":"diskon","discountKind":"percent","value":20,"target":"all","noCombine":true,"capMax":50000}'),
 ('PRM-pesta',true,   '{"name":"Pesta Sosis","type":"beli_dapat","buyQty":2,"getQty":1,"target":"savory","noCombine":true,"capMax":0}'),
 ('PRM-sore',true,    '{"name":"Sore Mantap","type":"happy_hour","discountKind":"percent","value":15,"startTime":"15:00","endTime":"17:00","target":"all","noCombine":false,"capMax":0}'),
 ('PRM-gajian',false, '{"name":"Gajian Hemat","type":"voucher","discountKind":"nominal","value":5000,"code":"HEMAT5K","quota":100,"target":"all","noCombine":true,"capMax":0}')
on conflict (id) do nothing;

-- banners (img kosong FASE 7)
insert into banners (id,active,sort,data) values
 ('BNR-1',true,0,  '{"title":"Keju Meleleh, Cuma Rp 17k","img":""}'),
 ('BNR-2',true,1,  '{"title":"Menu Baru: Sweet Greentea","img":""}'),
 ('BNR-3',false,2, '{"title":"Promo Weekend Seru","img":""}')
on conflict (id) do nothing;

-- par_stock (stok standar per cabang x isian)
insert into par_stock (branch_id,parent_id,qty) values
 ('sepinggan','mozza',60),('sepinggan','sosis',50),('sepinggan','jumbo',30),('sepinggan','mix',25),
 ('gunungsari','mozza',50),('gunungsari','sosis',40),('gunungsari','jumbo',25),('gunungsari','mix',20)
on conflict (branch_id,parent_id) do nothing;

-- analisa (batas aman default per material)
insert into analisa (ingredient_id, name, per_unit, unit) values
 ('glaze_coklat','Glaze Coklat',12,'kaleng'),('glaze_tiramisu','Glaze Tiramisu',12,'kaleng'),('glaze_greentea','Glaze Greentea',12,'kaleng'),
 ('kentang','Kentang Coating',30,'pack'),('saus_tomat','Saus Tomat',30,'botol'),('saus_sambal','Saus Sambal',30,'botol'),
 ('saus_keju','Saus Keju',25,'botol'),('saus_mayo','Mayonaise',25,'botol')
on conflict (ingredient_id) do nothing;

-- shopping_items (14 item default)
insert into shopping_items (id, name, active) values
 ('kentang','Kentang',true),('glaze_coklat','Glaze Coklat',true),('glaze_tiramisu','Glaze Tiramisu',true),
 ('glaze_greentea','Glaze Greentea',true),('saus_tomat','Saus Tomat',true),('saus_sambal','Saus Sambal',true),
 ('saus_keju','Saus Keju',true),('panir','Tepung Panir',true),('tisu','Tisu',true),
 ('sarung_tangan','Sarung Tangan',true),('plastik15','Plastik 15',true),('plastik24','Plastik 24',true),
 ('minyak','Minyak Goreng',true),('mayonaise','Mayonaise',true)
on conflict (id) do nothing;
