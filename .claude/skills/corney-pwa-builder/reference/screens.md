# Stitch UI Reference — 70 Screens

Project: **CORNEY POS Login Screen** · `projects/4747735536330481940`. These are the visual reference designs; match layout/branding when building React components. Fetch a screen's HTML/screenshot via `mcp__stitch__get_screen` (name = `projects/4747735536330481940/screens/<id>`).

## CORNEY App — Customer
| Screen | id | Maps to |
|---|---|---|
| CORNEY App Landing Page - Welcome | ec2f4741f658443090d1b6e9d6c01283 | §4 landing |
| Choose Branch - CORNEY App | 3191ecd7ecdd497d876c0e6c829fd88d | §4.4 choose branch |
| Menu Storefront - CORNEY App | b3c66a8f7bc446cba2c4b3deadb0e3c0 | CUS-01 |
| Product Detail - Sweet Coklat (Sweet) | 18e3fa4b45e6461fbf03e83de9fa65b7 | CUS-01 (sweet, no sauce) |
| Product Detail - Mozza Ori (Refined) | 8d801a005b6f4afe81858b7da66fc3d5 | CUS-01 (savory) |
| Add Sauce Modal - Mobile | 561643f53678462581af95ddb7755282 | CUS-01 sauce |
| Keranjang - CORNEY App | 0df8b7b090584efe87c4d2d0e846cb43 | cart |
| Compose Order - Multi-Branch Cart | 570771ca36d84592ac72892cae1a10e7 | checkout |
| Verifikasi WhatsApp - Success state | 82a0967acb30457f80ebaebb0689c585 | §4 OTP |
| QRIS Payment - Waiting State | bc47b6f32df442e08ffb5ae2786187ca | CUS-03 |
| Payment Success - CORNEY App | 49011e6638204aa699db8c1b91754a90 | §4 success + PIN |
| Struk Digital - CORNEY App | 9210d2452ada4d7e9ab0bb5c2a9077a3 | CUS-04 |
| Riwayat Pesanan - CORNEY App | 8187134baf914ea4bffbfddc32b0553a | CUS-04 |
| Lacak Pesanan - Diproses | 948f9f004f0c4e5b890bcdad9b3f338f | §4.5 status |
| Lacak Pesanan - Selesai | bfee06178a0c4ec9bc5413ca86ae2eea | §4.5 status |
| Join CORNEY Rewards - Registration | 4c7c5587cd9942ca8f5c99f58dea0db2 | CUS-05 |
| CORNEY Rewards - Member Dashboard | 1cb96c8b0ff442128d487a403a2922d2 | CUS-05 |

## CORNEY Ops — Kasir
| Screen | id | Maps to |
|---|---|---|
| CORNEY POS Login - Landscape | 695c19c4a7ee4cc88e3f27abc9d115ae | §6.1 login |
| Stock Confirmation - Buka Toko | 5474d8588e07431ba48389af06d18531 | OPN-01 |
| Buka Kas - Buka Toko | a5c1fd4cc3ab47669e6aad1e0dbefeaf | OPN-02 |
| Walk-in Sale - CORNEY POS | 59439bd7cbc14d25b10db6f2167c1508 | WLK-01/02 |
| Add Sauce Modal - CORNEY POS | 91dc8afcf55642448a5ef21e95f1aad8 | WLK-02 sauce |
| Payment Modal - CORNEY POS | 568322a6c77a4d9bbce8d4abe56e89a7 | §6.7 channels |
| Online Orders - CORNEY POS | aa865b0e43ac40be99505cd2e6020651 | §6.5 |
| Cooking Queue - CORNEY KITCHEN | 3c1113fde1ff45c882ad35acfd509a66 | MSK-01..04 |
| Request Stock Correction - CORNEY POS | 7bb0989cbfda48f6962dc43297f6a569 | BHN-06 (propose) |
| Tomorrow's Shopping Request - CORNEY POS | 5a7fa64f3e0d49608f12a831d3ecacfa | CLS-00 |
| Closing: Match Remaining Stock | a98ddc4d74804e728de658e2ba21fdef | CLS-02 |
| Closing: Breakage & Loss | a076efd728144de98f221a6ffa2e82fa | CLS-02b |
| Closing: Reconcile Cash & Channels | 8c2ecafedade41a9a7d22f15ff94a331 | CLS-03 |
| Closing: Urgent Cash & Refunds | 8fb44887b6d743f1a4b75f64498fac49 | CLS-04/04b |
| Closing: Free Items (Promo vs Warranty) | c2727b4276ba4c1f9c92f6cc0eefd8b9 | §6.8.4 |
| Daily Closing Report - CORNEY POS | d98f055304d944ffa2288f4d34e397b8 | CLS-06 |
| Laporan Anomali - CORNEY POS | a0164fdb04734ab7897c2d6ab2662637 | OWN-07 (kasir view) |

## CORNEY Ops — Owner
| Screen | id | Maps to |
|---|---|---|
| Owner Cockpit - Mobile Dashboard | 20f2148d83ac42e1b66292e8eb63e974 | OWN-01 |
| Owner Cockpit - Desktop Dashboard | 82d414840b6a480385f98e1609213726 | OWN-01 |
| Manage Parent Fillings - Desktop | 87e98fa3fbde4b1ebd6f93c7f7facdd2 | OWN-02 step1 |
| Manage Parent Fillings - Mobile | 32525123e93646dcbfa70ebb60160164 | OWN-02 step1 |
| Master Data - Resep/BOM (Mobile) | 6cd098ec435e44c5bee3ed59a0994b3f | OWN-02 BOM |
| Master Data - Resep/BOM (Desktop) | a03cb652e2df4354921fffef0477c939 | OWN-02 BOM |
| Manage Branches - Desktop | 64af12ac1c144de091d85946cf8f8490 | OWN-06 |
| Manage Branches - Mobile | 15b0f081083b4b3f9fafbd5e90b1f50f | OWN-06 |
| Stock Correction Approval - CORNEY Owner | dbbc3c9719864e0a9e0747c376516ecf | BHN-06 (execute) |
| Promo System - CORNEY Owner | 11175faf3fc04dcfa36c745b2369ffa3 | OWN-10 |
| Financial Reports - CORNEY POS | 819080fd80e44775bfeec27d1f975323 | OWN-03 |
| Purchase Ledger - CORNEY Owner | 3853fc01aa24428fbb2ab44b6a539937 | OWN-08 |
| Investor Payout & Net Profit | c38119a6f5354364bdb722cecd8ab3b5 | OWN-11 |
| Notifications & Alerts - CORNEY Owner | fa8bbf404bbe4ef2bc107bd3a1297953 | OWN-05 |
| User & Access Management | 2149be938d634501a6fce762fdc800f1 | OWN-04 |

## CORNEY Ops — Produksi / Operasional / Auditor
| Screen | id | Maps to |
|---|---|---|
| Record Production Output - Mobile | cdbe768bdc4c4391a8bb4c201bd42c1f | PRD-01 |
| Record Production Output - Desktop | a7792008d74f47bd89c04a07d8b5485e | PRD-01 |
| Central Freezer Stock per Branch - Produksi | ade3828f1cb54fd4ad2c0738b7a3f974 | PRD-02 |
| Freezer Opname - Produksi | e413e602154d4a4fa5400d5c3d200407 | PRD-04 |
| Raw Material Reorder - Produksi | 9a9dc3217397483ea2720625b1f353fb | PRD-03 |
| Fill Stock to Par - Operasional | 812fdbf20ab848258303876049b81fe2 | OPS-01 |
| Field Audit - Operasional | 0d9a2b6c1cf446f3a30c6785986da6cd | OPS-02 |
| Collect Cash Deposit - Operasional | c95c099350db4ac5a9d0a6e9833c34e9 | OPS-04 |
| Collect Cash Deposit - Mobile Refined | 671554c7c421410f85778e6168901c09 | OPS-04 |
| Supplier Bridge - Combined Shopping Requests | cf29ba7e001840d6bbba367421c235f9 | OPS-03 |
| Receive & Verify Deposit - Auditor | 0776f1f0691342aa9f654fc39de11326 | AUD-01 |
| Trace Discrepancy Point - Auditor | fccd0111ffed452c8f0e71042c904f06 | AUD-02 |
| Audit Log - Immutable Trail | 4688faa40f3b4088bd26cb82e2a7d4fa | AUD-04 |

## CORNEY Supplier
| Screen | id | Maps to |
|---|---|---|
| CORNEY Supplier - Login Portal | 0d0c6038ee0345fc8929484049507413 | §7.4 login |
| Manage Catalog - Daily Branch Needs | 053283f093d54a5ca7912a862a6c1f33 | SUP-01 |
| Manage Catalog - Category 2 (Dough) | 7c61cf21fd0e4046a617b6795d2fb511 | SUP-02 |
| Mark Item Out of Stock - Supplier App | 259c9f8319e2468a82b4b1df07ad22a4 | SUP-05 |
| Price History & Owner Notification | 85181c3fd8714f059394890ef270e13e | SUP-04 |

## Food photography assets (4)
- Chocolate Glazed Corndog — 917cda8f239441cca8109c4a0daa5394
- Korean Mozzarella cheese-pull — 9348fe99a81a4b1bbf0040cbb88f7070
- Potato Corndog (Gamja) — ccb54964f5aa402cb3c69f99eefbbf97
- (one more food-photo variant exists in project)

**Note:** Some closing/online flows have additional sub-screens; when building, list the project's current screens fresh (count was 70) since titles may evolve.
