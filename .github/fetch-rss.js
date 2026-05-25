const fs = require('fs');
const https = require('http');

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

function get(url) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? require('https') : require('http');
        lib.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

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
        
        let title = titleMatch[1];
        title = title.replace(/<!\[CDATA\[(.*?)\]\]>/, '$1');
        title = title.replace(/&amp;/g, '&');
        title = title.replace(/&lt;/g, '<');
        title = title.replace(/&gt;/g, '>');
        
        const linkMatch = xml.match(/<link>(.*?)<\/link>/);
        const link = linkMatch ? linkMatch[1] : '#';
        
        const authorMatch = xml.match(/<dc:creator>(.*?)<\/dc:creator>/) || xml.match(/<author>(.*?)<\/author>/);
        let author = authorMatch ? authorMatch[1] : "Szerkesztőség";
        author = author.replace(/<!\[CDATA\[(.*?)\]\]>/, '$1');
        
        const pubDateMatch = xml.match(/<pubDate>(.*?)<\/pubDate>/);
        let time = "friss";
        if (pubDateMatch) {
            try {
                const d = new Date(pubDateMatch[1]);
                time = d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
            } catch(e) {}
        }
        
        const block = detectBlock(title, defaultBlock);
        
        return { name, title, author, time, link, block };
    } catch(e) {
        console.error(`Hiba a(z) ${name} feldolgozásakor:`, e.message);
        return null;
    }
}

async function main() {
    console.log("=== RSS lekérés indítása ===");
    const results = [];
    
    for (const feed of RSS_FEEDS) {
        console.log(`Lekérés: ${feed.name}...`);
        try {
            const xml = await get(feed.url);
            if (xml && xml.trim()) {
                const article = parseRSS(xml, feed.name, feed.block);
                if (article) {
                    results.push(article);
                    console.log(`  ✅ ${feed.name} sikeres`);
                } else {
                    console.log(`  ⚠️ ${feed.name} - nem sikerült feldolgozni`);
                }
            } else {
                console.log(`  ⚠️ ${feed.name} - üres válasz`);
            }
        } catch(e) {
            console.error(`  ❌ ${feed.name} hiba:`, e.message);
        }
        await new Promise(r => setTimeout(r, 500));
    }
    
    console.log(`\n✅ Összesen ${results.length} hír betöltve`);
    fs.writeFileSync('hirek.json', JSON.stringify(results, null, 2));
    console.log("hirek.json mentve");
}

main().catch(error => {
    console.error("FATAL HIBA:", error);
    process.exit(1);
});
