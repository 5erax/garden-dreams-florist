begin;
insert into public.gd_products(id,name,occasion,price,stems,description,image,featured) values
(1,'Nắng dịu','Chúc mừng',390000,'Cúc trắng, cúc vàng','Một bó cúc nhỏ, trong trẻo như một lời chúc bình an.','/flowers/bouquet_1.webp',true),
(2,'Khúc hồng','Tình yêu',490000,'Cẩm chướng hồng','Những cánh cẩm chướng xếp mềm, dành cho lời cảm ơn chưa nói.','/flowers/bouquet_2.webp',true),
(3,'Lời thì thầm','Sinh nhật',450000,'Hồng chùm, lá bạc','Sắc hồng nhẹ cùng những nhánh lá, ôm trọn một ngày vui.','/flowers/bouquet_3.webp',false),
(4,'Tình ca','Cưới hỏi',690000,'Hồng kem, eucalyptus','Một chút cổ điển, một chút dịu dàng cho ngày đặc biệt.','/flowers/bouquet_4.webp',false),
(5,'Mộng hoa','Cưới hỏi',590000,'Ly hồng, hoa phụ','Hoa ly kiêu hãnh giữa những cánh hoa nhỏ đầy duyên dáng.','/flowers/bouquet_5.webp',false),
(6,'Giấc mơ mẫu đơn','Tình yêu',890000,'Mẫu đơn hồng','Mẫu đơn bung nở, mềm mại và đầy đặn như một cái ôm.','/flowers/bouquet_6.webp',true),
(7,'Má hồng','Tình yêu',550000,'Hồng phấn','Một bảng màu êm dịu, dành cho người khiến bạn mỉm cười.','/flowers/bouquet_7.webp',false),
(8,'Nhớ thương','Tình yêu',650000,'Hồng đỏ, giấy vintage','Hồng đỏ sâu được gói trong giấy mộc, để lời yêu thêm ấm.','/flowers/bouquet_8.webp',true),
(9,'Giai điệu vườn','Sinh nhật',520000,'Hoa phối sắc pastel','Một khu vườn nhỏ với những sắc màu vui tươi vừa đủ.','/flowers/bouquet_9.webp',false),
(10,'Hồng nhung','Tình yêu',790000,'Hồng đỏ nhung','Màu đỏ nồng nàn, cho một lời thương thật rõ ràng.','/flowers/bouquet_10.webp',false),
(11,'Nắng mùa hè','Sinh nhật',480000,'Hoa vàng phối','Gói một chút nắng để ngày của người nhận sáng hơn.','/flowers/bouquet_11.webp',false),
(12,'Khoảng trời xanh','Chúc mừng',620000,'Phi yến xanh','Một mảng trời dịu mát, dành cho những khởi đầu mới.','/flowers/bouquet_12.webp',false),
(13,'Mẫu đơn kiêu sa','Cưới hỏi',950000,'Mẫu đơn, hoa phụ','Những cánh mẫu đơn nhiều lớp cho khoảnh khắc đáng nhớ.','/flowers/bouquet_13.webp',false),
(14,'Lời hẹn tulip','Tình yêu',720000,'Tulip hồng','Tulip thanh thoát, nói một lời hẹn nhẹ nhàng mà chân thành.','/flowers/bouquet_14.webp',false),
(15,'Hòa nhịp','Cưới hỏi',850000,'Hồng đỏ, hồng trắng','Đỏ và trắng đứng cạnh nhau, như hai người cùng chung nhịp.','/flowers/bouquet_15.webp',false),
(16,'Đồng hoa','Chúc mừng',420000,'Cúc phối màu','Một bó hoa phóng khoáng với tinh thần của buổi sớm ngoài đồng.','/flowers/bouquet_16.webp',false),
(17,'Bình yên','Chúc mừng',580000,'Cẩm tú cầu xanh','Cẩm tú cầu xanh nhạt, món quà dành cho một ngày cần bình yên.','/flowers/bouquet_17.webp',false),
(18,'Ngày rực rỡ','Sinh nhật',460000,'Đồng tiền vàng','Những bông đồng tiền tươi sáng, gửi niềm vui thật giản đơn.','/flowers/bouquet_18.webp',false),
(19,'Tinh khôi','Chúc mừng',640000,'Ly trắng','Sắc trắng trang nhã, gửi một lời chúc đầy trân trọng.','/flowers/bouquet_19.webp',false),
(20,'Ôm dịu dàng','Tình yêu',560000,'Hoa hồng phấn, eucalyptus','Màu phấn mềm và hương lá mát, một cái ôm không cần lời.','/flowers/bouquet_20.webp',false)
on conflict(id) do nothing;
select setval('public.gd_products_id_seq',(select max(id) from public.gd_products));
commit;
