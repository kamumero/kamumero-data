const fs = require('fs');
const https = require('https');
const http = require('http');

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

const FIDESZ_KW = ["kormány", "orban", "orbán", "fidesz", "szuverenitás", "brüsszel", "nemzeti", "konzervatív", "családvédelem", "hazafias"];
const TISZA_KW = ["magyar péter", "tisza párt", "ellenzék", "kritika", "korrupció", "átláthatóság", "jogállamiság", "uniós", "kiszivárgott", "botrány", "államadósság", "infláció"];

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
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
    let fScore = 0, tScore = 0;
    for (const kw of FIDESZ_KW) if (lower.includes(kw)) fScore++;
    for (const kw of TISZA_KW) if (lower.includes(kw)) tScore++;
    if (fScore > tScore && fScore > 0) return "fidesz";
    if (tScore > fScore && tScore > 0) return "tisza";
    return defaultBlock;
}

function cleanText(text) {
    if (!text) return "";
    return text
        .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
}

function parseRSS(xml, name, defaultBlock) {
    try {
        const titleMatch = xml.match(/<title>(.*?)<\/title>/);
        if (!titleMatch) return null;
        
        const title = cleanText(titleMatch[1]);
        
        const linkMatch = xml.match(/<link>(.*?)<\/link>/);
        const link = linkMatch ? cleanText(linkMatch[1]) : '#';
        
        let author = "Szerkesztőség";
        const authorMatch = xml.match(/<dc:creator>(.*?)<\/dc:creator>/) || xml.match(/<author>(.*?)<\/author>/);
        if (authorMatch) {
            author = cleanText(authorMatch[1]);
            if (author.includes('http') || author.length > 50) author = "Szerkesztőség";
        }
        
        let time = "friss";
        const pubDateMatch = xml.match(/<pubDate>(.*?)<\/pubDate>/);
        if (pubDateMatch) {
            try {
                const d = new Date(pubDateMatch[1]);
                if (!isNaN(d.getTime())) {
                    time = d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
                }
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
    console.log(`Időpont: ${new Date().toLocaleString('hu-HU')}`);
    console.log('');
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (const feed of RSS_FEEDS) {
        console.log(`Lekérés: ${feed.name}...`);
        try {
            const xml = await fetchUrl(feed.url);
            if (xml && xml.trim() && xml.includes('<rss') || xml.includes('<feed')) {
                const article = parseRSS(xml, feed.name, feed.block);
                if (article && article.title && article.title !== '') {
                    results.push(article);
                    successCount++;
                    console.log(`  ✅ ${feed.name} - "${article.title.substring(0, 50)}..."`);
                } else {
                    errorCount++;
                    console.log(`  ⚠️ ${feed.name} - nem sikerült feldolgozni`);
                }
            } else {
                errorCount++;
                console.log(`  ⚠️ ${feed.name} - üres vagy érvénytelen válasz`);
            }
        } catch(e) {
            errorCount++;
            console.error(`  ❌ ${feed.name} hiba:`, e.message);
        }
        await new Promise(r => setTimeout(r, 500));
    }
    
    console.log('');
    console.log(`✅ Sikeres: ${successCount} | ❌ Sikertelen: ${errorCount}`);
    console.log(`📊 Összesen ${results.length} hír betöltve`);
    
    fs.writeFileSync('hirek.json', JSON.stringify(results, null, 2));
    console.log("💾 hirek.json mentve");
    
    if (results.length === 0) {
        console.error("❌ HIBA: Egyetlen hír sem töltődött be!");
        process.exit(1);
    }
}

main().catch(error => {
    console.error("❌ FATAL HIBA:", error);
    process.exit(1);
});
