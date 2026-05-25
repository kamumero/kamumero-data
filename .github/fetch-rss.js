const fs = require('fs');
const https = require('https');

// HTTP kérés függvény (node-fetch nélkül, natív https)
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

const RSS_FEEDS = [
    { name: "Telex", url: "https://telex.hu/rss", block: "tisza" },
    { name: "24.hu", url: "https://24.hu/feed", block: "fidesz" },
    { name: "Index", url: "https://index.hu/rss", block: "fidesz" },
    { name: "HVG", url: "https://hvg.hu/rss", block: "tisza" },
    { name: "Portfolio", url: "https://portfolio.hu/rss", block: "tisza" },
    { name: "444", url: "https://444.hu/feed", block: "tisza" },
    { name: "Magyar Nemzet", url: "https://magyarnemzet.hu/rss", block: "fidesz" },
    { name: "Népszava", url: "https://nepszava.hu/feed", block: "tisza" },
    { name: "Mandiner", url: "https://mandiner.hu/rss", block: "fidesz" },
    { name: "Vadhajtások", url: "https://vadhajtasok.hu/feed", block: "tisza" },
    { name: "Pesti Srácok", url: "https://pestisracok.hu/feed", block: "fidesz" },
    { name: "G7", url: "https://g7.hu/feed", block: "tisza" },
    { name: "Szabad Európa", url: "https://www.szabadeuropa.hu/rss", block: "tisza" },
    { name: "Magyar Hang", url: "https://hang.hu/feed", block: "tisza" },
    { name: "Economx", url: "https://economx.hu/feed", block: "tisza" },
    { name: "Blikk", url: "https://blikk.hu/rss", block: "tisza" },
    { name: "Origo", url: "https://origo.hu/rss", block: "fidesz" }
];

const FIDESZ_KW = ["kormány", "orban", "orbán", "fidesz", "szuverenitás", "brüsszel", "nemzeti", "konzervatív"];
const TISZA_KW = ["magyar péter", "tisza párt", "ellenzék", "korrupció", "átláthatóság", "jogállamiság", "államadósság"];

function detectBlock(title, defaultBlock) {
    if (!title) return defaultBlock;
    const lower = title.toLowerCase();
    let f = 0, t = 0;
    for (const kw of FIDESZ_KW) if (lower.includes(kw)) f++;
    for (const kw of TISZA_KW) if (lower.includes(kw)) t++;
    if (f > t && f > 0) return "fidesz";
    if (t > f && t > 0) return "tisza";
    return defaultBlock;
}

function parseRSS(xml, name, defaultBlock) {
    try {
        const titleMatch = xml.match(/<title>(.*?)<\/title>/);
        if (!titleMatch) return null;
        
        const title = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/, '$1');
        const link = xml.match(/<link>(.*?)<\/link>/)?.[1] || "#";
        const author = xml.match(/<dc:creator>(.*?)<\/dc:creator>/)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/, '$1') ||
                      xml.match(/<author>(.*?)<\/author>/)?.[1] || "Szerkesztőség";
        const pubDate = xml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1];
        const time = pubDate ? new Date(pubDate).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }) : "friss";
        const block = detectBlock(title, defaultBlock);
        
        return { name, title, author, time, link, block };
    } catch(e) {
        console.error(`Parse hiba ${name}:`, e.message);
        return null;
    }
}

async function main() {
    console.log("=== RSS lekérés indítása ===");
    const results = [];
    
    for (const feed of RSS_FEEDS) {
        console.log(`Lekérés: ${feed.name}...`);
        try {
            const xml = await fetchUrl(feed.url);
            if (xml) {
                const article = parseRSS(xml, feed.name, feed.block);
                if (article) results.push(article);
            }
        } catch(e) {
            console.error(`Hiba ${feed.name}:`, e.message);
        }
        await new Promise(r => setTimeout(r, 300));
    }
    
    console.log(`✅ ${results.length} hír betöltve`);
    fs.writeFileSync('hirek.json', JSON.stringify(results, null, 2));
    console.log("hirek.json mentve");
}

main().catch(console.error);
