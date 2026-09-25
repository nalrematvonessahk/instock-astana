'use strict';
const categories = [
  {id:'sneakers',name:'Кроссовки'},
  {id:'classic',name:'Классическая обувь'},
  {id:'winter',name:'Зимняя обувь'},
  {id:'boots',name:'Ботинки и сапоги'},
  {id:'kids',name:'Детская обувь'},
  {id:'sport',name:'Спортивная обувь'},
];

const adultSizes = [36, 45];
const kidsSizes = [28, 35];

const userLocation = {x:500,y:420,label:'Вы здесь'};
const metersPerMapUnit = 18;

const stores = [
  {id:'s1',name:'Обувной двор',address:'ТРЦ «Хан Шатыр», пр. Туран, 37',district:'Левый берег',x:430,y:500,opens:'10:00',closes:'22:00',reliability:97,history:{confirmed:412,fulfilled:96}},
  {id:'s2',name:'Шаг',address:'ТРЦ «Керуен», ул. Достык, 9',district:'Левый берег',x:545,y:440,opens:'10:00',closes:'22:00',reliability:94,history:{confirmed:286,fulfilled:93}},
  {id:'s3',name:'Маленькая стопа',address:'ТРЦ «Mega Silk Way», пр. Кабанбай батыра, 62',district:'Левый берег',x:375,y:575,opens:'10:00',closes:'22:00',reliability:91,history:{confirmed:198,fulfilled:90}},
  {id:'s4',name:'Классика',address:'ул. Кенесары, 40',district:'Правый берег',x:560,y:215,opens:'09:00',closes:'20:00',reliability:88,history:{confirmed:131,fulfilled:87}},
  {id:'s5',name:'Шоурум Сарыарка',address:'пр. Сарыарка, 12',district:'Правый берег',x:405,y:255,opens:'11:00',closes:'21:00',reliability:92,history:{confirmed:174,fulfilled:91}},
  {id:'s6',name:'Sneaker Market',address:'ТРЦ «Азия Парк», пр. Кабанбай батыра, 21',district:'Левый берег',x:655,y:560,opens:'10:00',closes:'22:00',reliability:95,history:{confirmed:367,fulfilled:94}},
  {id:'s7',name:'Ботинки и сапоги',address:'ул. Бейбитшилик, 25',district:'Правый берег',x:705,y:130,opens:'10:00',closes:'20:00',reliability:86,history:{confirmed:96,fulfilled:84}},
  {id:'s8',name:'Обувь на Республики',address:'пр. Республики, 34',district:'Правый берег',x:625,y:170,opens:'10:00',closes:'19:00',reliability:90,history:{confirmed:143,fulfilled:89}},
  {id:'s9',name:'Спорт Шаг',address:'ул. Сыганак, 10',district:'Левый берег',x:770,y:470,opens:'10:00',closes:'21:00',reliability:93,history:{confirmed:221,fulfilled:92}},
  {id:'s10',name:'Обувь и стиль',address:'пр. Абая, 53',district:'Правый берег',x:480,y:150,opens:'10:00',closes:'21:00',reliability:89,history:{confirmed:158,fulfilled:88}},
];

const products = [
  {id:'sneakers-white',name:'Кроссовки белые, кожа',category:'sneakers',image:'sneakers-white.jpg',sizeRange:[36,45],description:'Лаконичные белые кроссовки из гладкой кожи на плоской подошве.',details:'Натуральная кожа · резиновая подошва',tags:['кроссовки','белые','кожа']},
  {id:'sneakers-grey',name:'Кроссовки текстильные, серые',category:'sneakers',image:'sneakers-grey.jpg',sizeRange:[36,45],description:'Лёгкие кроссовки с сетчатым верхом для города и долгих прогулок.',details:'Текстиль · вспененная подошва',tags:['кроссовки','серые','текстиль']},
  {id:'canvas-high',name:'Кеды высокие, кремовые',category:'sneakers',image:'canvas-high.jpg',sizeRange:[36,44],description:'Высокие кеды из плотного хлопка на резиновой подошве.',details:'Хлопок · резиновая подошва',tags:['кеды','высокие']},
  {id:'loafers',name:'Лоферы чёрные, кожа',category:'classic',image:'loafers-black.jpg',sizeRange:[39,45],description:'Классические лоферы с мягким блеском и низким каблуком.',details:'Натуральная кожа · кожаная стелька',tags:['лоферы','классика','туфли']},
  {id:'ballet-flats',name:'Балетки с декором',category:'classic',image:'ballet-flats.jpg',sizeRange:[36,41],description:'Балетки персикового цвета с декоративной отделкой носка.',details:'Текстиль · плоская подошва',tags:['балетки','туфли']},
  {id:'puffer-boots',name:'Дутики зимние, до −25 °C',category:'winter',image:'winter-puffer.svg',sizeRange:[36,43],description:'Тёплые дутики с утеплителем и нескользящей подошвой для астанинской зимы.',details:'Нейлон · утеплитель · до −25 °C',tags:['дутики','зима','сапоги','тёплые']},
  {id:'chelsea',name:'Ботинки челси, чёрные',category:'boots',image:'chelsea-black.jpg',sizeRange:[37,45],description:'Кожаные челси с эластичными вставками и рельефной подошвой.',details:'Натуральная кожа · байковая подкладка',tags:['ботинки','челси']},
  {id:'kids-sneakers',name:'Детские кроссовки на липучках',category:'kids',image:'kids-sneakers.svg',sizeRange:[28,35],description:'Лёгкие кроссовки на двух липучках: ребёнок обувается сам.',details:'Текстиль и экокожа · гибкая подошва',tags:['детские','кроссовки','липучки']},
  {id:'running',name:'Беговые кроссовки, лёгкие',category:'sport',image:'running-light.jpg',sizeRange:[36,45],description:'Беговые кроссовки с амортизирующей подошвой и дышащим верхом.',details:'Сетка · амортизация · 240 г',tags:['беговые','спорт','кроссовки']},
];

const offers = [
  {id:'o1',productId:'sneakers-white',storeId:'s10',price:32900,updatedMinutesAgo:8,sizes:{36:1,37:2,38:0,39:0,40:1,41:0,42:2,43:1,44:0,45:1}},
  {id:'o2',productId:'sneakers-white',storeId:'s6',price:34500,updatedMinutesAgo:20,sizes:{37:3,38:2,39:4,40:3,41:2,42:1}},
  {id:'o3',productId:'sneakers-white',storeId:'s5',price:31900,updatedMinutesAgo:90,sizes:{36:0,38:1,39:1,43:2,44:1,45:0}},
  {id:'o4',productId:'sneakers-white',storeId:'s1',price:33900,updatedMinutesAgo:40,sizes:{39:0,40:0,41:0,42:0,44:2,45:1}},
  {id:'o5',productId:'sneakers-grey',storeId:'s6',price:38900,updatedMinutesAgo:20,sizes:{38:2,39:3,40:2,41:4,42:2,43:1}},
  {id:'o6',productId:'sneakers-grey',storeId:'s10',price:37900,updatedMinutesAgo:8,sizes:{36:1,37:0,40:1,44:1}},
  {id:'o7',productId:'sneakers-grey',storeId:'s9',price:39900,updatedMinutesAgo:25,sizes:{39:1,41:1,42:0,43:2,45:1}},
  {id:'o8',productId:'canvas-high',storeId:'s7',price:27900,updatedMinutesAgo:55,sizes:{36:2,37:3,38:4,39:3,40:2,41:0,42:1}},
  {id:'o9',productId:'canvas-high',storeId:'s10',price:28500,updatedMinutesAgo:8,sizes:{38:0,39:1,40:0,43:2,44:1}},
  {id:'o10',productId:'canvas-high',storeId:'s2',price:26900,updatedMinutesAgo:12,sizes:{37:1,38:2,39:0,41:3}},
  {id:'o11',productId:'canvas-high',storeId:'s6',price:29500,updatedMinutesAgo:20,sizes:{40:1,41:1,42:2}},
  {id:'o12',productId:'loafers',storeId:'s4',price:45900,updatedMinutesAgo:65,sizes:{39:1,40:2,41:3,42:2,43:1,44:0,45:1}},
  {id:'o13',productId:'loafers',storeId:'s10',price:47900,updatedMinutesAgo:8,sizes:{41:0,42:1,43:2,44:1}},
  {id:'o14',productId:'loafers',storeId:'s1',price:44500,updatedMinutesAgo:40,sizes:{39:0,40:0,41:1,45:2}},
  {id:'o15',productId:'ballet-flats',storeId:'s5',price:24900,updatedMinutesAgo:90,sizes:{36:2,37:3,38:1,39:2,40:0}},
  {id:'o16',productId:'ballet-flats',storeId:'s4',price:25900,updatedMinutesAgo:65,sizes:{37:1,38:0,39:1,41:2}},
  {id:'o17',productId:'ballet-flats',storeId:'s2',price:23900,updatedMinutesAgo:12,sizes:{36:1,38:2,39:0,40:1}},
  {id:'o18',productId:'puffer-boots',storeId:'s1',price:36900,updatedMinutesAgo:40,sizes:{36:1,37:2,38:3,39:2,40:1,41:0}},
  {id:'o19',productId:'puffer-boots',storeId:'s7',price:34900,updatedMinutesAgo:55,sizes:{38:0,39:0,40:0,42:1,43:2}},
  {id:'o20',productId:'puffer-boots',storeId:'s6',price:38500,updatedMinutesAgo:180,sizes:{37:1,38:1,39:1,40:2,41:1,42:1}},
  {id:'o21',productId:'puffer-boots',storeId:'s8',price:35900,updatedMinutesAgo:25,sizes:{36:0,37:0,39:1,41:2}},
  {id:'o22',productId:'chelsea',storeId:'s10',price:54900,updatedMinutesAgo:8,sizes:{40:1,41:2,42:1,43:0,44:1}},
  {id:'o23',productId:'chelsea',storeId:'s5',price:52900,updatedMinutesAgo:90,sizes:{37:1,38:2,39:1,45:1}},
  {id:'o24',productId:'chelsea',storeId:'s7',price:56900,updatedMinutesAgo:55,sizes:{39:2,40:3,41:2,42:3,43:2,44:1}},
  {id:'o25',productId:'chelsea',storeId:'s8',price:53900,updatedMinutesAgo:25,sizes:{41:0,42:0,43:1}},
  {id:'o26',productId:'kids-sneakers',storeId:'s3',price:15900,updatedMinutesAgo:15,sizes:{28:2,29:3,30:0,31:0,32:2,33:1,34:1,35:0}},
  {id:'o27',productId:'kids-sneakers',storeId:'s6',price:14500,updatedMinutesAgo:180,sizes:{29:1,30:2,31:2,32:1}},
  {id:'o28',productId:'kids-sneakers',storeId:'s9',price:16900,updatedMinutesAgo:25,sizes:{30:1,31:1,33:2,34:2,35:1}},
  {id:'o29',productId:'running',storeId:'s9',price:42900,updatedMinutesAgo:25,sizes:{38:2,39:3,40:4,41:3,42:2,43:1,44:1}},
  {id:'o30',productId:'running',storeId:'s6',price:44500,updatedMinutesAgo:20,sizes:{36:1,37:2,40:0,41:1,45:1}},
  {id:'o31',productId:'running',storeId:'s10',price:41900,updatedMinutesAgo:8,sizes:{39:0,40:1,42:0,43:1}},
  {id:'o32',productId:'running',storeId:'s1',price:43900,updatedMinutesAgo:40,sizes:{40:0,41:0,42:0}},
];

const visualScenarios = [
  {sampleProductId:'sneakers-white',matches:[['sneakers-white',94],['canvas-high',81],['sneakers-grey',77],['running',69],['ballet-flats',41]]},
  {sampleProductId:'chelsea',matches:[['chelsea',92],['loafers',71],['puffer-boots',58],['sneakers-white',34]]},
  {sampleProductId:'running',matches:[['running',91],['sneakers-grey',84],['sneakers-white',70],['kids-sneakers',52]]},
];

const demoGuestReservations = [
  {name:'Айгерим',phone:'+7 701 555 12 40',qty:1,comment:'Заеду после работы',hoursAgo:2,status:'pending'},
  {name:'Данияр',phone:'+7 777 318 02 66',qty:1,comment:'',hoursAgo:23.2,status:'confirmed'},
  {name:'Мадина',phone:'+7 705 904 71 13',qty:1,comment:'Хочу примерить с толстым носком',hoursAgo:6,status:'confirmed'},
];
