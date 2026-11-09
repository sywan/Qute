// Built-in reference artworks. All are public-domain works (artists died more than 70 years ago
// and the works were published before 1929). Full images: public/styles/<id>.jpg (≤ 800 px);
// thumbnails: public/styles/thumbs/<id>.jpg (120 px). Sources are listed in README.md.

const A = (id, en, zh, artistEn, artistZh, year, movementEn, movementZh) => ({
  id, title: { en, 'zh-TW': zh }, artist: { en: artistEn, 'zh-TW': artistZh }, year,
  movement: { en: movementEn, 'zh-TW': movementZh }
});

export const artworks = [
  A('da-vinci', 'Mona Lisa', '蒙娜麗莎', 'Leonardo da Vinci', '達文西', 'c. 1503–1519', 'Renaissance', '文藝復興'),
  A('michelangelo-creation-of-adam', 'The Creation of Adam', '創造亞當', 'Michelangelo', '米開朗基羅', 'c. 1512', 'Renaissance fresco', '文藝復興濕壁畫'),
  A('turner-shipwreck', 'The Shipwreck of the Minotaur', '米諾陶號船難', 'J. M. W. Turner', '透納', 'c. 1810', 'Romanticism', '浪漫主義'),
  A('hokusai-great-wave', 'The Great Wave off Kanagawa', '神奈川沖浪裏', 'Katsushika Hokusai', '葛飾北齋', 'c. 1831', 'Ukiyo-e', '浮世繪'),
  A('hiroshige-kanbara', 'Evening Snow at Kanbara', '蒲原夜之雪', 'Utagawa Hiroshige', '歌川廣重', '1833–1834', 'Ukiyo-e', '浮世繪'),
  A('renoir-moulin-de-la-galette', 'Dance at Le Moulin de la Galette', '煎餅磨坊的舞會', 'Pierre-Auguste Renoir', '雷諾瓦', '1876', 'Impressionism', '印象派'),
  A('caillebotte-rainy-day', 'Paris Street; Rainy Day', '巴黎街道，雨天', 'Gustave Caillebotte', '卡耶博特', '1877', 'Realism', '寫實主義'),
  A('seurat-grande-jatte', 'A Sunday on La Grande Jatte', '大碗島的星期天下午', 'Georges Seurat', '秀拉', '1884–1886', 'Pointillism', '點描派'),
  A('van-gogh', 'The Bedroom', '臥室', 'Vincent van Gogh', '梵谷', '1889', 'Post-Impressionism', '後印象派'),
  A('van-gogh-starry-night', 'The Starry Night', '星夜', 'Vincent van Gogh', '梵谷', '1889', 'Post-Impressionism', '後印象派'),
  A('munch-scream', 'The Scream', '吶喊', 'Edvard Munch', '孟克', '1893', 'Expressionism', '表現主義'),
  A('cezanne-basket-of-apples', 'The Basket of Apples', '蘋果籃', 'Paul Cézanne', '塞尚', 'c. 1893', 'Post-Impressionism', '後印象派'),
  A('gauguin-mahana-no-atua', 'Day of the God (Mahana no Atua)', '神之日', 'Paul Gauguin', '高更', '1894', 'Synthetism', '綜合主義'),
  A('leighton-flaming-june', 'Flaming June', '燃燒的六月', 'Frederic Leighton', '雷頓', '1895', 'Academic art', '學院派'),
  A('matisse-woman-with-a-hat', 'Woman with a Hat', '戴帽子的女人', 'Henri Matisse', '馬諦斯', '1905', 'Fauvism', '野獸派'),
  A('monet', 'Water Lilies', '睡蓮', 'Claude Monet', '莫內', '1906', 'Impressionism', '印象派'),
  A('klimt-the-kiss', 'The Kiss', '吻', 'Gustav Klimt', '克林姆', '1907–1908', 'Art Nouveau (Vienna Secession)', '新藝術運動（維也納分離派）'),
  A('picabia-udnie', 'Udnie', 'Udnie（年輕的美國女孩）', 'Francis Picabia', '畢卡比亞', '1913', 'Cubism / Orphism', '立體派／奧費主義'),
  A('kandinsky-composition-viii', 'Composition VIII', '構成第八號', 'Wassily Kandinsky', '康丁斯基', '1923', 'Abstract art', '抽象藝術')
];

export const artworkImage = (base, id) => base + 'styles/' + id + '.jpg';
export const artworkThumb = (base, id) => base + 'styles/thumbs/' + id + '.jpg';
