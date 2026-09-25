'use strict';
const categories = [
  {id:'dishes',name:'Посуда'},
  {id:'decor',name:'Декор для дома'},
  {id:'clothing',name:'Одежда'},
  {id:'gifts',name:'Подарки'},
  {id:'accessories',name:'Аксессуары'},
  {id:'kids',name:'Детские товары'},
];

const userLocation = {x:500,y:420,label:'Вы здесь'};
const metersPerMapUnit = 18;

const stores = [
  {id:'s1',name:'Уютный дом',address:'ТРЦ «Хан Шатыр», пр. Туран, 37',district:'Левый берег',x:430,y:500,opens:'10:00',closes:'22:00',reliability:97,history:{confirmed:412,fulfilled:96}},
  {id:'s2',name:'Керамика и чай',address:'ТРЦ «Керуен», ул. Достык, 9',district:'Левый берег',x:545,y:440,opens:'10:00',closes:'22:00',reliability:94,history:{confirmed:286,fulfilled:93}},
  {id:'s3',name:'Маленький город',address:'ТРЦ «Mega Silk Way», пр. Кабанбай батыра, 62',district:'Левый берег',x:375,y:575,opens:'10:00',closes:'22:00',reliability:91,history:{confirmed:198,fulfilled:90}},
  {id:'s4',name:'Лавка подарков',address:'ул. Кенесары, 40',district:'Правый берег',x:560,y:215,opens:'09:00',closes:'20:00',reliability:88,history:{confirmed:131,fulfilled:87}},
  {id:'s5',name:'Шоурум Сарыарка',address:'пр. Сарыарка, 12',district:'Правый берег',x:405,y:255,opens:'11:00',closes:'21:00',reliability:92,history:{confirmed:174,fulfilled:91}},
  {id:'s6',name:'Home Market',address:'ТРЦ «Азия Парк», пр. Кабанбай батыра, 21',district:'Левый берег',x:655,y:560,opens:'10:00',closes:'22:00',reliability:95,history:{confirmed:367,fulfilled:94}},
  {id:'s7',name:'Гардероб',address:'ул. Бейбитшилик, 25',district:'Правый берег',x:705,y:130,opens:'10:00',closes:'20:00',reliability:86,history:{confirmed:96,fulfilled:84}},
  {id:'s8',name:'Мастерская декора',address:'пр. Республики, 34',district:'Правый берег',x:625,y:170,opens:'10:00',closes:'19:00',reliability:90,history:{confirmed:143,fulfilled:89}},
  {id:'s9',name:'Аксессуары на Сыганак',address:'ул. Сыганак, 10',district:'Левый берег',x:770,y:470,opens:'10:00',closes:'21:00',reliability:93,history:{confirmed:221,fulfilled:92}},
  {id:'s10',name:'Обувь и стиль',address:'пр. Абая, 53',district:'Правый берег',x:480,y:150,opens:'10:00',closes:'21:00',reliability:89,history:{confirmed:158,fulfilled:88}},
];

const products = [
  {id:'tea-set',name:'Чайный сервиз «Дала»',category:'dishes',image:'dishes-tea-set.svg',description:'Фарфоровый сервиз на шесть персон: чайник, шесть чашек и блюдец. Матовая глазурь молочного цвета.',details:'Фарфор · 6 персон · можно в посудомоечную машину',tags:['чай','сервиз','чашки','фарфор']},
  {id:'bowls',name:'Набор пиал «Орнамент»',category:'dishes',image:'dishes-bowls.svg',description:'Шесть керамических пиал с ручной росписью по краю. Подходят для чая, супа и десертов.',details:'Керамика · 6 шт · объём 250 мл',tags:['пиала','керамика','чай']},
  {id:'vase',name:'Керамическая ваза «Степь»',category:'decor',image:'decor-vase.svg',description:'Ваза ручной формовки с узким горлом для сухоцветов и отдельных веток.',details:'Керамика · высота 32 см',tags:['ваза','сухоцветы','интерьер']},
  {id:'candle',name:'Ароматическая свеча «Полынь»',category:'decor',image:'decor-candle.svg',description:'Соевая свеча с запахом степной полыни в керамическом стакане. Около 40 часов горения.',details:'Соевый воск · 220 г · 40 часов',tags:['свеча','аромат','интерьер']},
  {id:'sneakers-white',name:'Кроссовки белые, кожа',category:'clothing',image:'clothing-sneakers-white.jpg',description:'Лаконичные белые кроссовки из гладкой кожи на плоской подошве.',details:'Натуральная кожа · размеры 36–44',tags:['кроссовки','обувь','белые']},
  {id:'sneakers-grey',name:'Кроссовки текстильные, серые',category:'clothing',image:'clothing-sneakers-grey.jpg',description:'Лёгкие кроссовки с сетчатым верхом для города и долгих прогулок.',details:'Текстиль · размеры 37–44',tags:['кроссовки','обувь','серые']},
  {id:'chelsea',name:'Ботинки челси, чёрные',category:'clothing',image:'clothing-chelsea-black.jpg',description:'Кожаные челси с эластичными вставками и рельефной подошвой.',details:'Натуральная кожа · размеры 37–45',tags:['ботинки','челси','обувь']},
  {id:'canvas-high',name:'Кеды высокие, кремовые',category:'clothing',image:'clothing-canvas-high.jpg',description:'Высокие кеды из плотного хлопка на резиновой подошве.',details:'Хлопок · размеры 36–44',tags:['кеды','обувь']},
  {id:'ballet-flats',name:'Балетки с декором',category:'clothing',image:'clothing-ballet-flats.jpg',description:'Балетки персикового цвета с декоративной отделкой носка.',details:'Текстиль · размеры 35–40',tags:['балетки','обувь']},
  {id:'tea-box',name:'Подарочный набор чая',category:'gifts',image:'gifts-tea-box.svg',description:'Четыре сорта листового чая в жестяных банках, упакованы в коробку с лентой.',details:'4 × 50 г · подарочная коробка',tags:['чай','подарок','набор']},
  {id:'notebook',name:'Кожаный блокнот А5',category:'gifts',image:'gifts-notebook.svg',description:'Блокнот в обложке из натуральной кожи со сменным блоком в точку.',details:'Кожа · А5 · 192 страницы',tags:['блокнот','подарок','кожа']},
  {id:'scarf',name:'Шерстяной шарф',category:'accessories',image:'accessories-scarf.svg',description:'Мягкий шарф из мериносовой шерсти, длина 190 см.',details:'Меринос 100% · 190 × 35 см',tags:['шарф','шерсть','зима']},
  {id:'shopper',name:'Кожаная сумка-шоппер',category:'accessories',image:'accessories-shopper.svg',description:'Вместительная сумка из мягкой кожи с внутренним карманом на молнии.',details:'Натуральная кожа · 38 × 32 см',tags:['сумка','шоппер','кожа']},
  {id:'constructor',name:'Деревянный конструктор, 60 деталей',category:'kids',image:'kids-constructor.svg',description:'Набор деревянных кубиков и арок из берёзы, покрытых безопасной краской.',details:'Берёза · 60 деталей · от 3 лет',tags:['конструктор','игрушка','дерево']},
  {id:'bunny',name:'Плюшевый заяц, 35 см',category:'kids',image:'kids-bunny.svg',description:'Мягкая игрушка из гипоаллергенного плюша. Можно стирать в машине.',details:'Плюш · 35 см · от 0 лет',tags:['игрушка','заяц','плюш']},
];

const offers = [
  {id:'o1',productId:'tea-set',storeId:'s2',price:24900,stock:6,updatedMinutesAgo:12},
  {id:'o2',productId:'tea-set',storeId:'s1',price:26500,stock:2,updatedMinutesAgo:40},
  {id:'o3',productId:'tea-set',storeId:'s6',price:23900,stock:1,updatedMinutesAgo:180},
  {id:'o4',productId:'bowls',storeId:'s2',price:8900,stock:14,updatedMinutesAgo:12},
  {id:'o5',productId:'bowls',storeId:'s4',price:9500,stock:5,updatedMinutesAgo:65},
  {id:'o6',productId:'bowls',storeId:'s1',price:9900,stock:0,updatedMinutesAgo:300},
  {id:'o7',productId:'vase',storeId:'s8',price:15900,stock:3,updatedMinutesAgo:25},
  {id:'o8',productId:'vase',storeId:'s1',price:17500,stock:7,updatedMinutesAgo:40},
  {id:'o9',productId:'vase',storeId:'s5',price:14900,stock:1,updatedMinutesAgo:90},
  {id:'o10',productId:'candle',storeId:'s8',price:6900,stock:20,updatedMinutesAgo:25},
  {id:'o11',productId:'candle',storeId:'s4',price:5900,stock:8,updatedMinutesAgo:65},
  {id:'o12',productId:'candle',storeId:'s6',price:7200,stock:2,updatedMinutesAgo:180},
  {id:'o13',productId:'candle',storeId:'s1',price:6500,stock:0,updatedMinutesAgo:40},
  {id:'o14',productId:'sneakers-white',storeId:'s10',price:32900,stock:4,updatedMinutesAgo:8},
  {id:'o15',productId:'sneakers-white',storeId:'s7',price:34500,stock:2,updatedMinutesAgo:55},
  {id:'o16',productId:'sneakers-white',storeId:'s5',price:31900,stock:6,updatedMinutesAgo:90},
  {id:'o17',productId:'sneakers-grey',storeId:'s10',price:38900,stock:3,updatedMinutesAgo:8},
  {id:'o18',productId:'sneakers-grey',storeId:'s7',price:36900,stock:0,updatedMinutesAgo:55},
  {id:'o19',productId:'chelsea',storeId:'s10',price:54900,stock:2,updatedMinutesAgo:8},
  {id:'o20',productId:'chelsea',storeId:'s5',price:52900,stock:1,updatedMinutesAgo:90},
  {id:'o21',productId:'chelsea',storeId:'s7',price:56900,stock:5,updatedMinutesAgo:55},
  {id:'o22',productId:'canvas-high',storeId:'s7',price:27900,stock:9,updatedMinutesAgo:55},
  {id:'o23',productId:'canvas-high',storeId:'s10',price:28500,stock:3,updatedMinutesAgo:8},
  {id:'o24',productId:'ballet-flats',storeId:'s5',price:24900,stock:4,updatedMinutesAgo:90},
  {id:'o25',productId:'ballet-flats',storeId:'s10',price:25900,stock:1,updatedMinutesAgo:8},
  {id:'o26',productId:'tea-box',storeId:'s4',price:12900,stock:10,updatedMinutesAgo:65},
  {id:'o27',productId:'tea-box',storeId:'s2',price:13500,stock:6,updatedMinutesAgo:12},
  {id:'o28',productId:'tea-box',storeId:'s6',price:11900,stock:3,updatedMinutesAgo:180},
  {id:'o29',productId:'notebook',storeId:'s4',price:8500,stock:4,updatedMinutesAgo:65},
  {id:'o30',productId:'notebook',storeId:'s9',price:9200,stock:12,updatedMinutesAgo:20},
  {id:'o31',productId:'scarf',storeId:'s9',price:18900,stock:7,updatedMinutesAgo:20},
  {id:'o32',productId:'scarf',storeId:'s7',price:17900,stock:2,updatedMinutesAgo:55},
  {id:'o33',productId:'scarf',storeId:'s5',price:19900,stock:0,updatedMinutesAgo:90},
  {id:'o34',productId:'shopper',storeId:'s9',price:42900,stock:3,updatedMinutesAgo:20},
  {id:'o35',productId:'shopper',storeId:'s5',price:39900,stock:2,updatedMinutesAgo:90},
  {id:'o36',productId:'shopper',storeId:'s1',price:44500,stock:5,updatedMinutesAgo:40},
  {id:'o37',productId:'constructor',storeId:'s3',price:15900,stock:8,updatedMinutesAgo:15},
  {id:'o38',productId:'constructor',storeId:'s6',price:14500,stock:3,updatedMinutesAgo:180},
  {id:'o39',productId:'constructor',storeId:'s4',price:16900,stock:1,updatedMinutesAgo:65},
  {id:'o40',productId:'bunny',storeId:'s3',price:9900,stock:0,updatedMinutesAgo:15},
  {id:'o41',productId:'bunny',storeId:'s6',price:10500,stock:0,updatedMinutesAgo:180},
];

const visualScenarios = [
  {sampleProductId:'sneakers-white',matches:[['sneakers-white',94],['canvas-high',81],['sneakers-grey',77],['ballet-flats',58],['chelsea',52]]},
  {sampleProductId:'vase',matches:[['vase',91],['candle',64],['bowls',60],['tea-set',55]]},
  {sampleProductId:'tea-set',matches:[['tea-set',93],['bowls',86],['tea-box',71],['vase',49]]},
];

const demoGuestReservations = [
  {name:'Айгерим',phone:'+7 701 555 12 40',qty:1,comment:'Заеду после работы',hoursAgo:2,status:'pending'},
  {name:'Данияр',phone:'+7 777 318 02 66',qty:1,comment:'',hoursAgo:23.2,status:'confirmed'},
  {name:'Мадина',phone:'+7 705 904 71 13',qty:2,comment:'Нужна подарочная упаковка',hoursAgo:6,status:'confirmed'},
];
