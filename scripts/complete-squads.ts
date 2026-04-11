/**
 * Complete Squads Script — Fills in missing club data and generates formations
 *
 * Strategy:
 * 1. Use existing club data from squads-api.json (31% coverage)
 * 2. Use manual data from squads-data.ts (27 teams with clubs)
 * 3. For remaining players — use hardcoded well-known player→club mapping
 * 4. Auto-generate formations (4-3-3) for teams without manual lineups
 * 5. Save enriched data back to squads-api.json
 *
 * Run: npx tsx scripts/complete-squads.ts
 * Re-run monthly to refresh (add new known players)
 */

import * as fs from "fs";
import * as path from "path";

const SQUADS_PATH = path.join(__dirname, "..", "src", "lib", "tournament", "squads-api.json");

// Load current data
const squads = JSON.parse(fs.readFileSync(SQUADS_PATH, "utf-8")) as Record<string, {
  players: { nameEn: string; num: number; pos: string; photo: string; age: number; club?: string }[];
  logo?: string;
}>;

// ============================================================================
// KNOWN PLAYER → CLUB MAPPING (April 2026)
// Updated manually from public sources (Wikipedia, Transfermarkt, FBref)
// ============================================================================
const KNOWN_CLUBS: Record<string, string> = {
  // Argentina
  "E. Martínez": "Aston Villa", "Rulli": "Marseille", "Molina": "Atlético Madrid",
  "Romero": "Tottenham", "L. Martínez": "Inter", "Acuña": "Sevilla", "Otamendi": "Benfica",
  "Montiel": "Sevilla", "Tagliafico": "Lyon", "De Paul": "Atlético Madrid",
  "E. Fernández": "Chelsea", "Mac Allister": "Liverpool", "Lo Celso": "Real Betis",
  "Paredes": "Roma", "Messi": "Inter Miami", "Lautaro": "Inter",
  "Álvarez": "Atlético Madrid", "Garnacho": "Man United", "Dybala": "Roma",
  "N. González": "Juventus",
  // Brazil
  "Alisson": "Liverpool", "Ederson": "Man City", "Danilo": "Flamengo",
  "Marquinhos": "PSG", "Gabriel": "Arsenal", "Militão": "Real Madrid",
  "Wendell": "Porto", "B. Guimarães": "Newcastle", "André": "Wolverhampton",
  "Paquetá": "West Ham", "Rodrygo": "Real Madrid", "Vinícius Jr.": "Real Madrid",
  "Raphinha": "Barcelona", "Savinho": "Man City", "Endrick": "Real Madrid",
  // France
  "Maignan": "Milan", "Koundé": "Barcelona", "Saliba": "Arsenal",
  "Upamecano": "Bayern", "T. Hernández": "Milan", "Konaté": "Liverpool",
  "Tchouaméni": "Real Madrid", "Kanté": "Al-Ittihad", "Griezmann": "Atlético Madrid",
  "Rabiot": "Marseille", "Fofana": "Milan", "Mbappé": "Real Madrid",
  "Dembélé": "PSG", "Thuram": "Inter", "Kolo Muani": "PSG",
  // Spain
  "Unai Simón": "Athletic Bilbao", "Carvajal": "Real Madrid", "Laporte": "Al-Nassr",
  "Le Normand": "Atlético Madrid", "Cucurella": "Chelsea", "Pedri": "Barcelona",
  "Rodri": "Man City", "Gavi": "Barcelona", "Olmo": "Barcelona",
  "L. Yamal": "Barcelona", "Morata": "Milan", "N. Williams": "Athletic Bilbao",
  // England
  "Pickford": "Everton", "Alexander-Arnold": "Real Madrid", "Stones": "Man City",
  "Guehi": "Crystal Palace", "Saka": "Arsenal", "Rice": "Arsenal",
  "Bellingham": "Real Madrid", "Foden": "Man City", "Palmer": "Chelsea",
  "Kane": "Bayern", "Gordon": "Newcastle", "Watkins": "Aston Villa",
  "Walker": "Man City", "Mainoo": "Man United",
  // Germany
  "Neuer": "Bayern", "ter Stegen": "Barcelona", "Rüdiger": "Real Madrid",
  "Tah": "Leverkusen", "Raum": "RB Leipzig", "Kimmich": "Bayern",
  "Musiala": "Bayern", "Wirtz": "Leverkusen", "Havertz": "Arsenal",
  "Sané": "Bayern", "Füllkrug": "West Ham", "Gündoğan": "Barcelona",
  "Schlotterbeck": "Dortmund", "Undav": "Stuttgart",
  // Portugal
  "Diogo Costa": "Porto", "Cancelo": "Barcelona", "Rúben Dias": "Man City",
  "Pepe": "Porto", "Mendes": "PSG", "Bernardo": "Man City",
  "B. Fernandes": "Man United", "Vitinha": "PSG", "R. Leão": "Milan",
  "Ronaldo": "Al-Nassr", "Gonçalo Ramos": "PSG", "Félix": "Chelsea",
  // Netherlands
  "Verbruggen": "Brighton", "Dumfries": "Inter", "V. Dijk": "Liverpool",
  "de Vrij": "Inter", "Aké": "Man City", "de Jong": "Barcelona",
  "Reijnders": "Milan", "Simons": "RB Leipzig", "Gakpo": "Liverpool",
  "Depay": "Corinthians", "Zirkzee": "Man United",
  // Belgium
  "Courtois": "Real Madrid", "Casteels": "Wolfsburg", "Theate": "Rennes",
  "Faes": "Leicester", "De Cuyper": "Club Brugge", "Onana": "Everton",
  "Tielemans": "Aston Villa", "De Bruyne": "Man City", "Doku": "Man City",
  "Lukaku": "Napoli", "Openda": "RB Leipzig", "Trossard": "Arsenal",
  // Croatia
  "Livaković": "Fenerbahçe", "Gvardiol": "Man City", "Šutalo": "Ajax",
  "Perišić": "PSV", "Modrić": "Real Madrid", "Brozović": "Al-Nassr",
  "Kovačić": "Man City", "Kramarić": "Hoffenheim", "Vlašić": "Torino",
  // Uruguay
  "Rochet": "Inter", "Araujo": "Barcelona", "Giménez": "Atlético Madrid",
  "Viña": "Flamengo", "Valverde": "Real Madrid", "Bentancur": "Tottenham",
  "De Arrascaeta": "Flamengo", "Núñez": "Liverpool", "Pellistri": "Panathinaikos",
  "Suárez": "Inter Miami",
  // Colombia
  "Ospina": "Al-Nassr", "L. Díaz": "Liverpool", "Arias": "Galatasaray",
  "D. Sánchez": "Galatasaray", "J. Rodríguez": "Rayo Vallecano",
  "Cuadrado": "Inter", "Córdoba": "Krasnodar", "Borré": "Internacional",
  // Japan
  "Suzuki": "Gamba Osaka", "Mitoma": "Brighton", "Kubo": "Real Sociedad",
  "Kamada": "Crystal Palace", "Endo": "Liverpool", "Tomiyasu": "Arsenal",
  "Doan": "Freiburg", "Tanaka": "Leeds",
  // South Korea
  "Kim Min-jae": "Bayern", "Son Heung-min": "Tottenham", "Hwang Hee-chan": "Wolverhampton",
  "Lee Kang-in": "PSG",
  // Morocco
  "Bounou": "Al-Hilal", "Hakimi": "PSG", "Saiss": "Besiktas", "Mazraoui": "Man United",
  "Amrabat": "Fenerbahçe", "Ounahi": "Marseille", "Ziyech": "Galatasaray",
  "En-Nesyri": "Fenerbahçe", "Diaz": "Real Madrid",
  // Mexico
  "Ochoa": "Salernitana", "Edson Álvarez": "West Ham", "H. Lozano": "PSV",
  "S. Giménez": "Feyenoord", "R. Jiménez": "Fulham",
  // USA
  "M. Turner": "Nottm Forest", "S. Dest": "PSV", "T. Adams": "Bournemouth",
  "W. McKennie": "Juventus", "T. Reyna": "Dortmund", "C. Pulisic": "Milan",
  "Weah": "Juventus", "Musah": "Milan", "Balogun": "Monaco",
  // Senegal
  "É. Mendy": "Al-Ahli", "Koulibaly": "Al-Hilal", "Sabaly": "Betis",
  "I. Gueye": "Everton", "P. Gueye": "Inter Miami", "Sarr": "Crystal Palace",
  "Mané": "Al-Nassr", "Jackson": "Chelsea",
  // Australia
  "M. Ryan": "Roma", "Souttar": "Sheffield United", "Hrustic": "Fiorentina",
  "Irvine": "St. Pauli", "McGree": "Middlesbrough", "Maclaren": "Melbourne City",
  "Duke": "Kobe", "Kuol": "Stuttgart",
  // Iran
  "A. Beiranvand": "Persepolis", "Jahanbakhsh": "Feyenoord",
  "Taremi": "Inter", "Azmoun": "Roma", "Hajsafi": "AEK Athens",
  // Switzerland
  "Sommer": "Inter", "Akanji": "Man City", "R. Rodríguez": "Betis",
  "Xhaka": "Leverkusen", "Freuler": "Bologna", "Shaqiri": "Basel",
  "Embolo": "Monaco", "Ndoye": "Bologna",
  // Turkey
  "Altay Bayındır": "Man United", "Çalhanoğlu": "Inter", "Yıldız": "Juventus",
  "Arda Güler": "Real Madrid", "Ü. Demiral": "Al-Ahli",
  // Ecuador
  "A. Domínguez": "América-MX", "P. Hincapié": "Leverkusen",
  "Caicedo": "Chelsea", "Sarmiento": "Brighton", "Valencia": "Internacional",
  // Sweden
  "Isak": "Newcastle", "Gyökeres": "Sporting CP", "Kulusevski": "Tottenham",
  "Lindelöf": "Man United", "Olsson": "Club Brugge",
  // Norway
  "Ødegaard": "Arsenal", "Haaland": "Man City", "Sørloth": "Atlético Madrid",
  "Nyland": "Sevilla", "Ajer": "Celtic", "Berge": "Fulham",
  // Austria
  "Pentz": "Valladolid", "Posch": "Bologna", "Laimer": "Bayern",
  "Sabitzer": "Dortmund", "Arnautović": "Inter", "Baumgartner": "RB Leipzig",
  // Egypt
  "El-Shenawy": "Al-Ahly", "Hegazi": "Al-Ahly", "Trezeguet": "Trabzonspor",
  "M. Salah": "Liverpool",
  // Algeria
  "Mandréa": "Lorient", "Mahrez": "Al-Ahli", "Bennacer": "Milan",
  "Atal": "Nice", "Bounedjah": "Al-Sadd",
  // Ivory Coast
  "P. Boly": "Forest", "Aurier": "Galatasaray", "Kessié": "Al-Ahli",
  "Haller": "Dortmund", "Pépé": "Villarreal",
  // Ghana
  "Partey": "Arsenal", "Kudus": "West Ham", "Semenyo": "Bournemouth",
  "Inaki Williams": "Athletic Bilbao",
  // New Zealand
  "Marinović": "Wellington Phoenix", "Reid": "Wellington Phoenix",
  "Wood": "Nottm Forest", "Singh": "Wellington Phoenix",
  // Qatar
  "Barsham": "Al-Sadd", "Al-Haydos": "Al-Sadd", "Afif": "Al-Sadd",
  "Ali": "Al-Duhail", "Almoez": "Al-Duhail",
  // Panama
  "Penedo": "Municipal", "Godoy": "Saprissa", "Torres": "Inter Miami",
  "Blackburn": "Real Salt Lake",
  // Cape Verde
  "Vozinha": "Gil Vicente", "Stopira": "Anorthosis",
  // Canada
  "Crepeau": "Portland", "A. Davies": "Bayern", "Johnston": "Nashville",
  "Eustáquio": "Porto", "David": "Lille", "Larin": "Mallorca",
  // Bosnia
  "Begović": "Everton", "Kolarov": "retired", "Džeko": "Fenerbahçe",
  "Pjanić": "Sharjah",
  // Scotland
  "Gunn": "Norwich", "Tierney": "Real Sociedad", "Robertson": "Liverpool",
  "McTominay": "Napoli", "McGinn": "Aston Villa", "Adams": "Torino",
  // Paraguay
  "A. Silva": "Man City", "Almirón": "Atlético Mineiro", "R. Sanabria": "Torino",
  "Enciso": "Brighton",
  // Tunisia
  "Dahmen": "Montpellier", "Bronn": "Salernitana", "Khazri": "Montpellier",
  "Jaziri": "Zamalek",
  // Jordan
  "Shafi": "Al-Wehdat", "Al-Tamari": "Montpellier",
  // Iraq
  "Amjad Attwan": "Al-Quwa Al-Jawiya", "Aymen Hussein": "Apollon",
  // Saudi Arabia
  "Al-Owais": "Al-Hilal", "Al-Ghannam": "Al-Hilal", "Al-Dawsari": "Al-Hilal",
  "Kanno": "Al-Hilal",
  // South Africa
  "R. Williams": "Mamelodi Sundowns", "Mothiba": "Strasbourg", "Tau": "Al-Ahly",
  "Zwane": "Mamelodi Sundowns", "Mokoena": "Mamelodi Sundowns",
  // Haiti
  "Bazile": "Le Havre", "Saint-Félix": "Metz", "Pierrot": "Göztepe",
  // Curaçao
  "Room": "PSV", "Bacuna": "Rangers", "Delvon": "FC Emmen",
  // Norway
  "Nyland": "Sevilla", "Ødegaard": "Arsenal", "Haaland": "Man City",
  "Sørloth": "Atlético Madrid", "Ajer": "Brentford", "Berge": "Fulham",
  "Nusa": "RB Leipzig", "Schjelderup": "Benfica", "Bobb": "Fulham",
  "Ryerson": "Dortmund", "Østigård": "Genoa", "Thorsby": "Cremonese",
  "Thorstvedt": "Sassuolo", "Berg": "Bodø/Glimt", "Strand Larsen": "Crystal Palace",
  "Pedersen": "Torino", "Hauge": "Bodø/Glimt", "Heggem": "Bologna",
  // South Korea
  "Son Heung-min": "Tottenham", "Kim Min-jae": "Bayern", "Lee Kang-in": "PSG",
  "Hwang Hee-chan": "Wolverhampton", "Oh Hyeon-gyu": "Celtic", "Lee Jae-sung": "Mainz",
  "Cho Gue-sung": "Midtjylland", "Kim Young-gwon": "Ulsan", "Kim Jin-su": "Jeonbuk",
  "Hwang In-beom": "Feyenoord", "Jeong Woo-yeong": "Freiburg",
  // Uzbekistan
  "Shomurodov": "Roma", "Krimets": "CSKA Moscow",
  // Congo DR
  "Bakambu": "Olympiakos", "Mbemba": "Marseille",
  // Iraq
  "Aymen Hussein": "Apollon", "Attwan": "Al-Quwa Al-Jawiya",
  // Jordan
  "Al-Tamari": "Montpellier", "Bani Atieh": "APOEL",
  // Czechia
  "Schick": "Leverkusen", "Souček": "West Ham", "Coufal": "West Ham",
  "Hložek": "Leverkusen", "Provod": "Slavia Prague", "Černý": "Wolfsburg",
  "Barák": "Fiorentina", "Ševčík": "Slavia Prague",
  // Canada
  "A. Davies": "Bayern", "David": "Lille", "Eustáquio": "Porto",
  "Larin": "Mallorca", "Buchanan": "Villarreal", "Osorio": "Midtjylland",
  "Miller": "Celtic",
  // Qatar
  "Al-Sheeb": "Al-Sadd", "Pedro Miguel": "Al-Sadd", "Afif": "Al-Sadd",
  "Almoez Ali": "Al-Duhail", "Hatem": "Al-Rayyan",
  // Panama
  "Penedo": "Municipal", "Torres": "Inter Miami", "Blackburn": "Real Salt Lake",
  "Godoy": "Saprissa", "Barcenas": "National", "Murillo": "Colorado Rapids",
  // Bosnia
  "Begović": "Everton", "Džeko": "Fenerbahçe", "Pjanić": "Sharjah",
  "Demirović": "Stuttgart", "Kolašinac": "Atlanta United",
  // Scotland
  "Gunn": "Norwich", "Robertson": "Liverpool", "Tierney": "Real Sociedad",
  "McTominay": "Napoli", "McGinn": "Aston Villa", "Adams": "Torino",
  "Gilmour": "Napoli", "Dykes": "QPR", "Christie": "Bournemouth",
  // Paraguay
  "Almirón": "Atlético Mineiro", "R. Sanabria": "Torino", "Enciso": "Brighton",
  "A. Silva": "Man City", "Alderete": "Getafe", "Gómez": "Palmeiras",
  // Tunisia
  "Dahmen": "Montpellier", "Laidouni": "Antalyaspor", "Sliti": "Al-Ettifaq",
  // Egypt
  "M. Salah": "Liverpool", "El-Shenawy": "Al-Ahly", "Hegazi": "Al-Ahly",
  "Trezeguet": "Trabzonspor", "Elneny": "retired", "Marwan": "Al-Ahly",
  "Mostafa Mohamed": "Nantes", "Sobhi": "Al-Ahly",
  // New Zealand
  "Wood": "Nottm Forest", "Singh": "Wellington Phoenix",
  "Marinović": "Wellington Phoenix", "Cacace": "Empoli",
  // Saudi Arabia
  "Al-Owais": "Al-Hilal", "Al-Dawsari": "Al-Hilal", "Kanno": "Al-Hilal",
  "Al-Ghannam": "Al-Hilal", "Al-Shahrani": "Al-Hilal", "Al-Malki": "Al-Hilal",
  "Al-Buraikan": "Al-Hilal", "Al-Shehri": "Al-Hilal",
  // Cape Verde
  "Vozinha": "Gil Vicente", "Stopira": "Anorthosis", "Ryan Mendes": "Rio Ave",
  // Iran
  "Beiranvand": "Persepolis", "Jahanbakhsh": "Feyenoord", "Taremi": "Inter",
  "Azmoun": "Roma", "Hajsafi": "AEK Athens", "Ghoddos": "Brentford",
  "Ezatolahi": "Vejle", "Mohammadi": "AEK Athens",
  // Ivory Coast
  "Haller": "Dortmund", "Kessié": "Al-Ahli", "Pépé": "Villarreal",
  "Boly": "Forest", "Aurier": "Galatasaray", "Gradel": "Sivasspor",
  "Konan": "RB Salzburg", "Zaha": "Galatasaray",
  // Australia
  "Ryan": "Roma", "Souttar": "Sheffield United", "Hrustic": "Fiorentina",
  "McGree": "Middlesbrough", "Kuol": "Stuttgart", "Irvine": "St. Pauli",
  "Duke": "Kobe", "Maclaren": "Melbourne City",
};

// ============================================================================
// STEP 1: Enrich with known clubs
// ============================================================================
let enriched = 0;
for (const [code, squad] of Object.entries(squads)) {
  for (const p of squad.players) {
    if (!p.club) {
      // Try exact match
      if (KNOWN_CLUBS[p.nameEn]) {
        p.club = KNOWN_CLUBS[p.nameEn];
        enriched++;
      } else {
        // Try last name match
        const lastName = p.nameEn.split(" ").pop() || "";
        for (const [known, club] of Object.entries(KNOWN_CLUBS)) {
          if (known.endsWith(lastName) && lastName.length > 3) {
            p.club = club;
            enriched++;
            break;
          }
        }
      }
    }
  }
}

console.log(`✅ Enriched ${enriched} players with known clubs`);

// ============================================================================
// STEP 2: Generate default formations for teams without starters
// ============================================================================
// (This is handled in squads-data.ts getSquad() — no action needed here)

// ============================================================================
// STEP 3: Stats
// ============================================================================
let total = 0, withClub = 0;
const teamStats: { code: string; total: number; withClub: number }[] = [];
for (const [code, squad] of Object.entries(squads)) {
  const t = squad.players.length;
  const c = squad.players.filter(p => !!p.club).length;
  total += t;
  withClub += c;
  teamStats.push({ code, total: t, withClub: c });
}

console.log(`\n📊 Coverage: ${withClub}/${total} (${Math.round(100 * withClub / total)}%)`);
console.log(`\nTeams with <50% coverage:`);
teamStats
  .filter(t => t.withClub / t.total < 0.5)
  .sort((a, b) => a.withClub / a.total - b.withClub / b.total)
  .forEach(t => {
    console.log(`  ${t.code}: ${t.withClub}/${t.total} (${Math.round(100 * t.withClub / t.total)}%)`);
  });

// ============================================================================
// STEP 4: Save
// ============================================================================
fs.writeFileSync(SQUADS_PATH, JSON.stringify(squads, null, 2), "utf-8");
console.log(`\n💾 Saved to ${SQUADS_PATH}`);

// Regenerate squad-photos.ts
const tsPath = path.join(__dirname, "..", "src", "lib", "tournament", "squad-photos.ts");
let tsContent = `// Auto-generated by scripts/complete-squads.ts\n`;
tsContent += `// Last updated: ${new Date().toISOString()}\n\n`;
tsContent += `export const SQUAD_PHOTOS: Record<string, Record<string, string>> = {\n`;
for (const [code, squad] of Object.entries(squads)) {
  tsContent += `  ${code}: {\n`;
  const seen = new Set<string>();
  for (const p of squad.players) {
    let key = p.nameEn;
    let n = 2;
    while (seen.has(key)) { key = `${p.nameEn} (${n})`; n++; }
    seen.add(key);
    tsContent += `    "${key}": "${p.photo}",\n`;
  }
  tsContent += `  },\n`;
}
tsContent += `};\n\n`;
tsContent += `export const TEAM_LOGOS: Record<string, string> = {\n`;
for (const [code, squad] of Object.entries(squads)) {
  if (squad.logo) tsContent += `  ${code}: "${squad.logo}",\n`;
}
tsContent += `};\n`;
fs.writeFileSync(tsPath, tsContent, "utf-8");
console.log(`📝 Regenerated ${tsPath}`);
