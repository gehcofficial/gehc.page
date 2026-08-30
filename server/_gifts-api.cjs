require('dotenv').config();
const http = require('http');

const ALL = [
  ['usr-jessica-poyoh','Jessica Poyoh'],['usr-gemma-montol','Gemma Montol'],
  ['usr-riska-sajow','Riska Sajow'],['usr-gabriel-lintong','Gabriel Lintong'],
  ['usr-kimberly-turambi','Kimberly Turambi'],['usr-kevin-budianto','Kevin Budianto'],
  ['usr-clay-langi','Clay Langi'],['usr-michelle-watung','Michelle Watung'],
  ['usr-ario-semet','Ario Semet'],['usr-ivanna-pande','Ivanna Pande'],
  ['usr-jeremy-walangitan','Jeremy Walangitan'],['usr-kimmy-casey','Kimmy Casey Liogu'],
  ['usr-timoty-wewengkang','Timoty Wewengkang'],['usr-virginia-parera','Virginia Parera'],
  ['usr-nicole-naray','Nicole Naray'],['usr-chelsea-tjheuw','Chelsea Tjheuw'],
  ['usr-daud-lumanauw','Daud Lumanauw'],['usr-pnt-kevin','Pnt. Kevin Kamagi'],
  ['usr-lucky-losu','Lucky Losu'],['usr-shien-siauw','Shien Siauw'],
  ['usr-soneta-imanuela','Soneta Imanuela'],['usr-lorenzo-ricsamana','Lorenzo Ricsamana'],
  ['usr-mega-welan','Mega Welan'],['usr-putri-massie','Putri Massie'],
  ['usr-nelcy-lodarmase','Nelcy Lodarmase'],['usr-marhaen-manus','Marhaen Manus'],
  ['usr-aurellia-hillary','Aurellia Hillary'],['usr-yohana-doga','Yohana Doga'],
  ['usr-akwila-gente','Akwila Gente'],['usr-timothy-mewengkang','Timothy Mewengkang'],
  ['usr-lovely-pantouw','Lovely Pantouw'],['usr-agnes-reimas','Agnes Reimas'],
  ['usr-thea-sanger','Thea Sanger'],['usr-febrian-evander','Febrian Evander'],
  ['usr-avriel-singal','Avriel Singal'],['usr-imanuel-yimna','Imanuel Yimna Esau'],
  ['usr-jilova-pakasi','Jilova Pakasi'],['usr-jeconia-wanget','Jeconia Wanget'],
  ['usr-natalie-musak','Natalie Musak'],['usr-cia-worung','Cia Worung'],
  ['usr-hoky-theos','Hoky Theos'],['usr-kezia-joseph','Kezia Joseph'],
  ['usr-injilia-oroh','Injilia Oroh'],['usr-marshal-maramis','Marshal Maramis'],
  ['usr-reywin-rengkuan','Reywin Rengkuan'],['usr-angelita-entjaurau','Angelita Entjaurau'],
  ['usr-resty-budianto','Resty Budianto'],['usr-david-pesoth','David Pesoth'],
  ['usr-gievara-bogar','Gievara Bogar'],['usr-shanella-mondong','Shanella Mondong'],
  ['usr-glenity-siauw','Glenity Siauw'],['usr-lingkan-pinontoan','Lingkan Pinontoan'],
  ['usr-jonathan-tintingon','Jonathan Tintingon'],['usr-yuen-pajow','Yuen Pajow'],
  ['usr-jeconia-luwuk','Jeconia Luwuk'],['usr-trivena-rattu','Trivena Rattu'],
  ['usr-diferd-wuri','Diferd Wuri'],['usr-gracia-laura','Gracia Laura'],
  ['usr-jacqson-naharia','Jacqson Naharia'],['usr-alvandi-saerang','Alvandi Saerang'],
  ['usr-reiner-montolalu','Reiner Montolalu'],['usr-stefanus-tambariki','Stefanus Tambariki'],
  ['usr-jeremiah-mewengkang','Jeremiah Mewengkang'],['usr-prichel-kampong','Prichel Kampong'],
  ['usr-syallomitha-mawitjere','Syallomitha Mawitjere'],['usr-artjuna-timbuleng','Artjuna Timbuleng'],
  ['usr-michel-lonteng','Michel Lonteng'],['usr-mighty-rengkung','Mighty Rengkung'],
  ['usr-zhanon-lausan','Zhanon Lausan'],['usr-farendy-lumintang','Farendy Lumintang'],
  ['usr-holly-kalele','Holly Kalele'],['usr-aditya-wellem','Aditya Wellem'],
  ['usr-krisetia-mamoto','Krisetia Mamoto'],['usr-filipo-karinda','Filipo Karinda'],
  ['usr-christian-lombogia','Christian Lombogia'],['usr-milithya-wuisan','Milithya Wuisan'],
  ['usr-patrisha-lengkey','Patrisha Lengkey'],['usr-fladyna-mondoringin','Fladyna Mondoringin'],
  ['usr-theodore-kowaas','Theodore Kowaas'],['usr-julivie-irot','Julivie Irot'],
];

async function apiCall(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: 8787, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch(e) { resolve(buf); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('Checking server...');
  try {
    await apiCall('/api/health', {});
    console.log('Server running');
  } catch(e) {
    console.log('Server not running. Start with: node server/index.mjs');
    process.exit(1);
  }
  console.log('Use API endpoint to update gifts');
  console.log('POST /api/admin/users/:id with gift data');
}

main().catch(e => { console.error(e); process.exit(1); });
