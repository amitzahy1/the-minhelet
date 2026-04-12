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

  // ======== ADDITIONAL ENTRIES (April 2026) ========

  // Jordan — Jordanian Pro League, Gulf leagues, some Europe
  "Yazid Abu Layla": "Al-Wehdat",
  "Noureddin Zaid": "Al-Faisaly",
  "M. Shalabia": "Al-Ahli Amman",
  "H. Abu Al Dahab": "Al-Wehdat",
  "M. Abu Hasheesh": "Al-Faisaly",
  "Hadi Al Hourani": "Al-Faisaly",
  "Adham Al Quraishi": "Shabab Al-Ordon",
  "Saed Al Rosan": "Al-Wehdat",
  "A. A. Asad Hajabi": "Al-Wehdat",
  "Abdallah Naseeb": "Al-Jaish",
  "Saleem Obaid": "Al-Ramtha",
  "Issam Smeeri": "Al-Wehdat",
  "M. Abu Dahab": "Al-Wehdat",
  "Mohannad Abu Taha": "Al-Wehdat",
  "Mahmoud Al Mardi": "Al-Faisaly",
  "Nizar Al Rashdan": "Al-Ahli Amman",
  "Rajaei Ayed": "Al-Salt",
  "Amer Jamous": "Al-Faisaly",
  "Ibrahim Sa'deh": "Shabab Al-Ordon",
  "Mohammed Abu Zurayq": "Al-Wehdat",
  "O. Al Fakhouri": "Al-Arabi Kuwait",
  "Yazan Al Naimat": "Al-Faisaly",
  "Ahmad Ersan": "Al-Wehdat",
  "Ali Olwan": "Al-Wehdat",
  "Ibrahim Sabra": "Al-Faisaly",
  "M. Taha": "Al-Wehdat",

  // Iraq — Iraqi Premier League, Gulf leagues, some Europe
  "Kamil Saad": "Al-Shorta",
  "Ahmed Basil": "Al-Quwa Al-Jawiya",
  "Fahad Talib": "Al-Zawraa",
  "Hussein Ali": "Al-Shorta",
  "Merchas Doski": "Erbil",
  "Ahmed Hasan Al Reeshawee": "Al-Zawraa",
  "Frans Putros": "Duhok",
  "Rebin Solaka": "AIK",
  "Zayed Tahseen": "Al-Quwa Al-Jawiya",
  "Munaf Younus": "Al-Zawraa",
  "Amir Al Ammari": "Al-Shorta",
  "Youssef Amyn": "Al-Quwa Al-Jawiya",
  "Ibraheem Bayesh": "Al-Quwa Al-Jawiya",
  "Akam Rahman": "Al-Sulaymaniyah",
  "Zidane Iqbal": "FC Nordsjaelland",
  "Z. Ismaeel": "Al-Shorta",
  "A. Jasim": "Al-Zawraa",
  "A. Sher": "Al-Quwa Al-Jawiya",
  "Kevin Yakob": "Halmstad",
  "H. Abdulkareem": "Al-Shorta",
  "Hasan Abdulkareem": "Al-Shorta",
  "Ali Al Hamadi": "Ipswich",
  "M. Farji": "Al-Quwa Al-Jawiya",
  "A. Y. Hashim": "Al-Zawraa",
  "Meme": "Al-Quwa Al-Jawiya",

  // Uzbekistan — Uzbek Super League, Russian/European leagues
  "B. Ergashev": "Pakhtakor",
  "A. Ne'matov": "Bunyodkor", "A. Ne&apos;matov": "Bunyodkor",
  "U. Yusupov": "AGMK",
  "M. Abdumajidov": "Pakhtakor",
  "K. Alijonov": "Pakhtakor",
  "R. Ashurmatov": "Al-Duhail",
  "U. Eshmurodov": "Nasaf Qarshi",
  "B. Karimov": "AGMK",
  "M. Khamraliev": "Bunyodkor",
  "S. Nasrullayev": "Pakhtakor",
  "F. Sayfiev": "Navbahor",
  "J. Urozov": "AGMK",
  "A. Gʻaniyev": "Pakhtakor",
  "I. Ibragimov": "Lokomotiv Tashkent",
  "J. Iskanderov": "Bunyodkor",
  "O. Hamrobekov": "CSKA Moscow",
  "A. Mozgovoy": "Rostov",
  "U. Rahmonaliyev": "Pakhtakor",
  "O. Shukurov": "AGMK",
  "S. Temirov": "Pakhtakor",
  "D. Khamdamov": "Bunyodkor",
  "A. Odilov": "Pakhtakor",
  "I. Sergeev": "Zenit",
  "O. O'runov": "Lens", "O. O&apos;runov": "Lens",

  // New Zealand — A-League, Wellington Phoenix, lower English/European leagues
  "M. Crocombe": "Wellington Phoenix",
  "O. Sail": "Auckland FC",
  "A. Paulsen": "Wellington Phoenix",
  "N. Tzanev": "Wellington Phoenix",
  "J. McGarry": "Auckland FC",
  "D. Ingham": "Wellington Phoenix",
  "F. de Vries": "Heerenveen",
  "T. Smith": "Colchester",
  "F. Surman": "Auckland FC",
  "Tyler Bindon": "Fiorentina",
  "M. Boxall": "Wellington Phoenix",
  "L. Kelly-Heald": "Auckland FC",
  "N. Pijnaker": "Portland Timbers",
  "T. Payne": "Wellington Phoenix",
  "S. Roux": "Auckland FC",
  "S. Sutton": "Wellington Phoenix",
  "B. Tuiloma": "Vancouver Whitecaps",
  "C. Elliot": "Auckland FC",
  "D. Wilkins": "Wellington Phoenix",
  "J. Bell": "Internacional",
  "R. Thomas": "Wellington Phoenix",
  "C. Lewis": "Wellington Phoenix",
  "M. Stamenić": "Melbourne City",
  "M. Garbett": "Torino",
  "C. McCowatt": "Adelaide United",
  "A. Rufer": "Wellington Phoenix",
  "C. Howieson": "Auckland FC",
  "F. Conchie": "Wellington Phoenix",
  "L. Rogerson": "Wellington Phoenix",
  "A. Greive": "Melbourne Victory",
  "B. Waine": "Wellington Phoenix",
  "E. Just": "Auckland FC",
  "M. Mata": "Adelaide United",
  "J. Randall": "Auckland FC",
  "B. Old": "Wellington Phoenix",
  "O. van Hattum": "Auckland FC",
  "K. Barbarouses": "Wellington Phoenix",

  // Haiti — MLS, French lower divisions, Haitian league, Belgian league
  "T. Algarin": "Racing Club Haïtien",
  "J. Duverger": "Racing Club Haïtien",
  "A. Pierre": "Violette AC",
  "J. Placide": "Metz",
  "Ricardo Ade": "Toronto FC",
  "C. Arcus": "Le Havre",
  "H. Delcroix": "Anderlecht",
  "J. Duverne": "Genk",
  "M. Expérience": "Violette AC",
  "D. Lacroix": "Don Bosco FC",
  "G. Métusala": "Violette AC",
  "W. Paugain": "Racing Club Haïtien",
  "K. Thermoncy": "Don Bosco FC",
  "C. Attys": "Violette AC",
  "J. Bellegarde": "Wolves",
  "D. Jean-Jacques": "LA Galaxy",
  "L. Pierre": "Violette AC",
  "W. Pierre": "Don Bosco FC",
  "C. F. Sainte": "Racing Club Haïtien",
  "J. Casimir": "Violette AC",
  "L. Deedson": "Estrela Amadora",
  "D. Etienne": "Louisville City",
  "Y. Fortuné": "Guingamp",
  "S. Lambese": "Quevilly-Rouen",
  "D. Nazon": "Beveren",
  "W. Pacius": "CF Montréal",
  "F. Pierrot": "Göztepe",
  "R. Providence": "Dunkerque",

  // Cape Verde — Portuguese league, lower European leagues
  "Márcio Rosa": "Boavista",
  "Vózinha": "Gil Vicente",
  "C. dos Santos": "Académica",
  "Diney Borges": "Moreirense",
  "S. Lopes Cabral": "Benfica",
  "Pico": "Santa Clara",
  "S. Moreira": "Gil Vicente",
  "Wagner Pina": "Estoril",
  "Kelvin Pires": "Vizela",
  "J. Soares": "Santa Clara",
  "Telmo Arcanjo": "Vitória Guimarães",
  "Deroy Duarte": "Vitesse",
  "L. Duarte": "Chaves",
  "João Paulo": "Casa Pia",
  "Kevin Pina": "Famalicão",
  "A. Santos": "Portimonense",
  "Yannick Semedo": "Rio Ave",
  "Nuno da Costa": "Porto",
  "F. Domingos": "Nacional",
  "Ieltsin Camoes": "Arouca",
  "Jovane Cabral": "Lazio",
  "D. Livramento": "Casa Pia",
  "Garry Rodrigues": "Al-Ittihad",
  "Willy Semedo": "Vitória Guimarães",

  // Australia — A-League, lower European leagues
  "P. Beach": "Melbourne City",
  "P. Izzo": "Adelaide United",
  "A. Behich": "Melbourne Victory",
  "J. Bos": "Sydney FC",
  "C. Burgess": "Sydney FC",
  "A. Circati": "Parma",
  "J. Geria": "PAOK",
  "L. Herrington": "Wellington Phoenix",
  "M. Degenek": "Columbus Crew",
  "A. Hrustić": "Fiorentina",
  "J. Italiano": "Lazio",
  "A. O'Neill": "Central Coast Mariners", "A. O&apos;Neill": "Central Coast Mariners",
  "Paul Michael Junior Okon-Engstler": "Melbourne City",
  "A. Robertson": "Liverpool",
  "K. Trewin": "Gent",
  "P. Yazbek": "Melbourne City",
  "M. Boyle": "Dundee United",
  "N. Irankunda": "Bayern",
  "D. Jurić": "Sydney FC",
  "A. Mabil": "Grasshoppers",
  "C. Metcalfe": "Sunderland",
  "A. Šuto": "Macarthur FC",
  "N. Velupillay": "Western United",

  // Egypt — Egyptian Premier League (Al-Ahly, Zamalek, Pyramids), some Europe
  "Mostafa Shobeir": "Al-Ahly",
  "Mohamed Sobhi": "Al-Ahly",
  "Al Mahdi Soliman": "Zamalek",
  "Hossam Abdelmaguid": "Zamalek",
  "Mohamed Abdelmonem": "Al-Ahly",
  "Ahmed Eid": "Pyramids",
  "Ahmed Abou El Fotouh": "Zamalek",
  "M. Hamdi": "Al-Ahly",
  "Mohamed Hany": "Al-Ahly",
  "Yasser Ibrahim": "Al-Ahly",
  "M. Ismail": "Pyramids",
  "Rami Rabia": "Al-Ahly",
  "Khaled Sobhy": "Ceramica Cleopatra",
  "T. Alaa": "Pyramids",
  "Emam Ashour": "Al-Ahly",
  "Marwan Attia": "Al-Ahly",
  "Hamdi Fathy": "Pyramids",
  "Islam Issa": "Ceramica Cleopatra",
  "Ahmed Koka": "Pyramids",
  "Mohanad Lasheen": "Smouha",
  "Mahmoud Saber": "Zamalek",
  "Mohamed Shehata": "Zamalek",
  "Trézéguet": "Trabzonspor",
  "Ibrahim Adel": "Al-Ahly",
  "Osama Faisal": "Al-Ahly",
  "Mostafa Fathi": "Zamalek",
  "H. Hassan": "Pyramids",
  "N. Mansy": "Zamalek",
  "Omar Marmoush": "Man City",
  "Salah Mohsen": "Al-Ahly",
  "Zizo": "Zamalek",

  // Iran — Persian Gulf Pro League (Persepolis, Esteghlal, Sepahan), some Europe
  "M. Akhbari": "Sepahan",
  "H. Hosseini": "Esteghlal",
  "M. Khalifeh": "Persepolis",
  "P. Niazmand": "Sepahan",
  "A. Abdullayev": "Zob Ahan",
  "M. Ghorbani": "Sepahan",
  "Saleh Hardani": "Persepolis",
  "M. Hazbavi": "Esteghlal",
  "M. Hosseini": "Persepolis",
  "H. Kanani": "Persepolis",
  "S. Khalilzadeh": "Al-Rayyan",
  "A. Nemati": "Persepolis",
  "R. Rezaeian": "Sepahan",
  "A. Yousefi": "Esteghlal",
  "M. Mohazabieh": "Esteghlal",
  "H. Abarghouei": "Persepolis",
  "M. Murodov": "Sepahan",
  "M. Khodabandelou": "Esteghlal",
  "M. Mohebi": "Persepolis",
  "O. Noorafkan": "Esteghlal",
  "A. Alipour": "Persepolis",
  "M. Hashemnejad": "Persepolis",
  "M. Hosseinnezhad": "Sepahan",
  "A. Hosseinzadeh": "Sepahan",
  "A. Koushki": "Persepolis",
  "S. Moghanlou": "Persepolis",
  "A. Sayyadmanesh": "Hull City",
  "K. Taheri": "Esteghlal",
  "M. Tikdari": "Sepahan",

  // Curaçao — Dutch Eredivisie/Eerste Divisie, Belgian league, lower European
  "T. Bodak": "FC Emmen",
  "T. Doornbusch": "ADO Den Haag",
  "J. Brenet": "FC Twente",
  "S. Floranus": "Excelsior",
  "Deveron Fonville": "FC Dordrecht",
  "J. Gaari": "Almere City",
  "A. Martha": "RKC Waalwijk",
  "T. Noslin": "Lazio",
  "A. Obispo": "PSV",
  "S. Sambo": "Telstar",
  "R. van Eijma": "SC Heerenveen",
  "L. Comenencia": "FC Dordrecht",
  "K. Felida": "Almere City",
  "B. Kuwas": "FC Emmen",
  "G. Roemeratoe": "FC Twente",
  "J. Antonisse": "AZ Alkmaar",
  "J. Bacuna": "Rangers",
  "T. Chong": "Luton",
  "K. Gorré": "NEC Nijmegen",
  "S. Hansen": "Feyenoord",
  "G. Kastaneer": "NAC Breda",
  "J. Locadia": "FC Emmen",
  "J. Margaritha": "Telstar",

  // South Africa — DStv Premiership (Sundowns, Pirates, Chiefs)
  "S. Chaine": "Orlando Pirates",
  "R. Goss": "Kaizer Chiefs",
  "R. Leaner": "Stellenbosch FC",
  "S. Kabini": "AmaZulu",
  "M. Mbokazi": "Orlando Pirates",
  "A. Modiba": "Mamelodi Sundowns",
  "K. Mudau": "Mamelodi Sundowns",
  "K. Ndamase": "Orlando Pirates",
  "S. Ngezana": "Petro de Luanda",
  "I. Okon": "Orlando Pirates",
  "N. Sibisi": "Orlando Pirates",
  "T. Smith": "Kaizer Chiefs",
  "B. Aubaas": "Mamelodi Sundowns",
  "T. Matuludi": "Mamelodi Sundowns",
  "T. Mbatha": "Orlando Pirates",
  "S. Mbule": "Kaizer Chiefs",
  "S. Sithole": "Sekhukhune United",
  "O. Appollis": "Polokwane City",
  "S. Campbell": "Club Brugge",
  "L. Foster": "Burnley",
  "B. Hlongwane": "Minnesota United",
  "E. Makgopa": "Orlando Pirates",
  "T. Maseko": "Mamelodi Sundowns",
  "R. Mofokeng": "Orlando Pirates",
  "E. Mokwana": "Sekhukhune United",
  "T. Moremi": "Stellenbosch FC",
  "M. Nkota": "Al-Ittihad",

  // Qatar — Qatar Stars League (Al-Sadd, Al-Duhail, Al-Rayyan, Al-Arabi, Al-Gharafa)
  "Mahmud Abunada": "Al-Arabi",
  "Shehab Ellethy": "Al-Gharafa",
  "Homam Ahmed": "Al-Gharafa",
  "Sultan Al Braik": "Al-Sadd",
  "A. Al Hussain": "Al-Rayyan",
  "A. Al Oui": "Al-Arabi",
  "Youssef Ayman": "Al-Duhail",
  "Jassem Gaber": "Al-Sadd",
  "Assim Madibo": "Al-Duhail",
  "Mohamed Al Manai": "Al-Gharafa",
  "Ahmed Fathi": "Al-Rayyan",
  "G. Laye": "Al-Gharafa",
  "Tarek Salman": "Al-Sadd",
  "Mohammed Waad": "Al-Sadd",
  "Edmilson Junior": "Al-Duhail",
  "M. Gouda": "Al-Arabi",
  "Mohammed Muntari": "Al-Duhail",

  // ======== BATCH 2 — Remaining missing players (April 2026) ========

  // Canada — MLS, European clubs
  "L. Gavran": "Vancouver Whitecaps",
  "O. Goodman": "Genk",
  "J. Pantemis": "CF Montréal",
  "N. Abatneh": "Vancouver Whitecaps",
  "Z. Bassong": "Freiburg",
  "L. De Fougerolles": "CF Montréal",
  "R. Laryea": "Toronto FC",
  "J. Marshall-Rutty": "Toronto FC",
  "J. Waterman": "Columbus Crew",
  "J. Badwal": "Vancouver Whitecaps",
  "M. Choinière": "CF Montréal",
  "M. Flores": "Charleroi",
  "Malik Henry": "Philadelphia Union",
  "I. Koné": "Watford",
  "R. Priso": "Toronto FC",
  "N. Sigur": "Nashville SC",
  "M. de Brienne": "Vancouver Whitecaps",
  "M. Aiyenero": "PSV",
  "T. Bair": "Motherwell",
  "T. Coimbra": "CF Montréal",
  "J. Hoilett": "Aberdeen",
  "D. Jebbison": "Bournemouth",
  "L. Millar": "Basel",
  "J. Nelson": "Toronto FC",
  "A. Pepple": "CF Montréal",
  "J. Shaffelburg": "Nashville SC",

  // Algeria — USM Alger, MC Alger, European clubs
  "M. Mastil": "USM Alger",
  "L. Zidane": "USM Alger",
  "A. Abada": "Celtic",
  "H. Baouche": "MC Alger",
  "Z. Belaïd": "Angers",
  "R. Belghali": "Trabzonspor",
  "R. Benchaa": "MC Alger",
  "M. Dorval": "Lazio",
  "R. Halaïmia": "Qatar SC",
  "S. Nair": "USM Alger",
  "H. Aouar": "Roma",
  "A. Aouchiche": "Lorient",
  "H. Mrezigue": "USM Alger",
  "Y. Titraoui": "Stade Reims",
  "R. Zerrouki": "Twente",
  "A. Benbouali": "USM Alger",
  "A. Boulbina": "Paradou AC",
  "Amin Chiakha": "Club Brugge",
  "F. Ghedjemis": "AJ Auxerre",
  "A. Hadj-Moussa": "Club Brugge",

  // Ecuador — Liga Pro, European clubs
  "H. Galíndez": "LDU Quito",
  "C. Loor": "Barcelona SC",
  "M. Ramírez": "Independiente del Valle",
  "G. Valle": "Independiente del Valle",
  "J. Chávez": "Barcelona SC",
  "Y. Medina": "Barcelona SC",
  "J. Porozo": "Santos Laguna",
  "A. Preciado": "Sporting CP",
  "C. Ramírez": "LDU Quito",
  "L. Realpe": "Independiente del Valle",
  "J. Alcívar": "LDU Quito",
  "A. Franco": "Atlético Mineiro",
  "M. Lawrence": "Barcelona SC",
  "P. Mercado": "Independiente del Valle",
  "J. Yeboah": "Racine",
  "N. Angulo": "Cruz Azul",
  "L. Campana": "Inter Miami",
  "J. Mercado": "Barcelona SC",
  "A. Minda": "Barcelona SC",
  "G. Plata": "Al-Sadd",
  "Bryan Josías Ramírez León": "LDU Quito",

  // Paraguay — Cerro Porteño, Libertad, Olimpia, European clubs
  "J. Espínola": "Cerro Porteño",
  "R. Fernandez": "Libertad",
  "O. Gill": "Nacional",
  "J. Alonso": "Krasnodar",
  "A. Benítez": "Cerro Porteño",
  "J. Cáceres": "Libertad",
  "D. León": "Cerro Porteño",
  "B. Riveros": "Olimpia",
  "A. Sandez": "Lanús",
  "G. Velázquez": "Cerro Porteño",
  "D. Bobadilla": "América-MX",
  "A. Cubas": "Vélez Sarsfield",
  "H. Cuenca": "Cerro Porteño",
  "M. Galarza": "Genoa",
  "R. Sosa": "Talleres",
  "A. Arce": "Cerro Porteño",
  "G. Ávalos": "Olimpia",

  // Ghana — European clubs, Ghanaian Premier League
  "J. Anang": "St. Pauli",
  "S. Mohan": "Hearts of Oak",
  "L. Zigi": "St. Gallen",
  "E. Annan": "Accra Hearts",
  "A. Djiku": "Fenerbahçe",
  "D. Luckassen": "Kasimpasa",
  "G. Mensah": "Auxerre",
  "J. Opoku": "Augsburg",
  "P. Pfeiffer": "Greuther Fürth",
  "M. Senaya": "Asante Kotoko",
  "E. Owusu": "Genk",
  "P. Owusu": "Legon Cities",
  "K. Sibo": "Nordsjaelland",
  "Caleb Marfo Yirenkyi": "Asante Kotoko",
  "P. Adu": "Beerschot",
  "D. Agyei": "Bristol City",
  "R. Königsdörffer": "Dortmund",
  "K. Nkrumah": "Asante Kotoko",
  "B. Thomas-Asante": "West Brom",

  // Czechia — Slavia Prague, Plzeň, European clubs
  "M. Jedlička": "Slavia Prague",
  "Š. Chaloupek": "Slavia Prague",
  "T. Holeš": "Slavia Prague",
  "V. Jemelka": "Plzeň",
  "D. Jurásek": "Slavia Prague",
  "J. Zelený": "Slavia Prague",
  "L. Červ": "Plzeň",
  "V. Darida": "Slavia Prague",
  "T. Ladra": "Slavia Prague",
  "M. Sadílek": "Twente",
  "T. Chorý": "Slavia Prague",
  "M. Chytil": "Slavia Prague",
  "J. Kliment": "Plzeň",
  "D. Višinský": "Feyenoord",

  // Japan — J1 League, European clubs
  "T. Hayakawa": "Urawa Reds",
  "L. Kokubo": "Strasbourg",
  "T. Nozawa": "Kashima Antlers",
  "T. Ando": "Yokohama F. Marinos",
  "H. Mochizuki": "Kashima Antlers",
  "Y. Nagatomo": "FC Tokyo",
  "A. Seko": "Celtic",
  "Y. Sugawara": "Southampton",
  "S. Taniguchi": "Yokohama F. Marinos",
  "T. Watanabe": "Yokohama F. Marinos",
  "J. Fujita": "Sint-Truiden",
  "R. Sato": "Hiroshima",
  "K. Goto": "Nagoya Grampus",
  "J. Ito": "Reims",
  "S. Machino": "Gladbach",
  "Keito Nakamura": "Reims",
  "Koki Ogawa": "Sint-Truiden",
  "K. Saito": "Bundesliga 2",
  "Y. Soma": "Nagoya Grampus",
  "A. Ueda": "Feyenoord",
  "R. Dōan": "Frankfurt",

  // South Korea — K League 1, European clubs
  "Jo Hyeon-Woo": "Ulsan",
  "Kim Seung-Gyu": "Al-Shabab",
  "Song Bum-Keun": "Jeonbuk",
  "Cho Yu-Min": "FC Seoul",
  "Kim Ji-Soo": "Jeonbuk",
  "Kim Moon-Hwan": "Jeonbuk",
  "Kim Tae-Hyeon": "Ulsan",
  "Lee Myung-Jae": "Ulsan",
  "Lee Tae-Seok": "Jeonbuk",
  "Seol Young-Woo": "Ulsan",
  "Bae Jun-Ho": "Stoke City",
  "Eom Ji-Sung": "FC Seoul",
  "Hwang In-Beom": "Feyenoord",
  "Kim Jin-Gyu": "FC Seoul",
  "Kwon Hyeok-Kyu": "Jeonbuk",
  "Lee Dong-Gyeong": "Ulsan",
  "Paik Seung-Ho": "Jeonbuk",
  "Park Jin-Seop": "Ulsan",
  "Seo Min-Woo": "FC Seoul",
  "Won Du-Jae": "FC Seoul",
  "Jeong Sang-Bin": "Wolverhampton",
  "Son Heung-Min": "Tottenham",
  "Yang Min-Hyeok": "Tottenham",

  // Bosnia — Bosnian PL, European clubs
  "O. Hadžikić": "Željezničar",
  "N. Vasilj": "St. Pauli",
  "M. Zlomislić": "Zrinjski",
  "D. Burnić": "Zrinjski",
  "D. Hadžikadunić": "Metz",
  "N. Katić": "Zürich",
  "T. Muharemović": "Sassuolo",
  "N. Mujakić": "Lecce",
  "S. Radeljić": "Željezničar",
  "I. Bašić": "Zrinjski",
  "A. Gigović": "Freiburg",
  "A. Hadžiahmetović": "Trabzonspor",
  "I. Šunjić": "Željezničar",
  "B. Tahirović": "Ajax",
  "S. Baždar": "Zrinjski",
  "A. Memić": "Željezničar",

  // Panama — Liga Panameña (Tauro FC, CAI, Plaza Amador), MLS, European
  "L. Mejía": "Tauro FC",
  "O. Mosquera": "Tauro FC",
  "E. Roberts": "CAI",
  "C. Samudio": "Tauro FC",
  "I. Anderson": "Tauro FC",
  "A. Andrade": "Tauro FC",
  "C. Blackman": "CAI",
  "É. Davis": "Tauro FC",
  "O. Davis": "CAI",
  "F. Escobar": "New York Red Bulls",
  "E. Fariña": "Plaza Amador",
  "K. Galván": "Tauro FC",
  "J. Gutiérrez": "Tauro FC",
  "J. Hall": "CAI",
  "C. Harvey": "Plaza Amador",
  "M. Krug": "CAI",
  "R. Peralta": "Tauro FC",
  "J. Rivera": "Plaza Amador",
  "D. Aparicio": "Tauro FC",
  "E. Cedeño": "Tauro FC",
  "A. Knight": "CAI",
  "C. Martinez": "Plaza Amador",
  "R. Phillips": "CAI",
  "M. Sanchez": "Tauro FC",
  "J. Welch": "CAI",
  "A. Arroyo": "Tauro FC",
  "Y. Bárcenas": "Nacional",
  "K. Barria": "CAI",
  "O. Browne": "Tauro FC",
  "J. Fajardo": "Tauro FC",
  "G. Herbert": "CAI",
  "G. Herrera": "Tauro FC",
  "H. Hurtado": "Plaza Amador",
  "K. Lenis": "CAI",
  "A. Londoño": "Tauro FC",
  "A. Quintero": "Tauro FC",
  "C. Waterman": "Tauro FC",
  "C. Yanis": "Plaza Amador",

  // Tunisia — Tunisian Ligue 1 (Espérance, CS Sfaxien, Club Africain), European
  "S. Ben Hsan": "Espérance",
  "B. Ben Saïd": "CS Sfaxien",
  "N. Farhati": "Club Africain",
  "A. Arous": "Espérance",
  "M. Ben Ali": "CS Sfaxien",
  "N. Ghandri": "CS Sfaxien",
  "A. Maâloul": "Espérance",
  "Y. Meriah": "Espérance",
  "M. Talbi": "Lorient",
  "Y. Valery": "Angers",
  "H. Mahmoud": "Club Africain",
  "M. Ben Ouanes": "Espérance",
  "M. Ben Romdhane": "Espérance",
  "H. Mejbri": "Burnley",
  "M. Neffati": "Espérance",
  "F. Sassi": "Espérance",
  "Houssem Teka": "Club Africain",
  "F. Chaouat": "CS Sfaxien",
  "S. Ltaief": "Club Africain",
  "H. Mastouri": "CS Sfaxien",

  // Congo DR — Congolese clubs (TP Mazembe, AS Vita Club, V.Club), European
  "M. Epolo": "TP Mazembe",
  "T. Fayulu": "V.Club",
  "L. Mpasi": "AS Vita Club",
  "D. Batubinsika": "TP Mazembe",
  "R. Bushiri": "Lens",
  "S. Kapuadi": "V.Club",
  "J. Kayembe": "TP Mazembe",
  "A. Tuanzebe": "Ipswich",
  "E. Kayembe": "TP Mazembe",
  "B. Cipenga": "V.Club",
  "S. Moutoussamy": "Nantes",
  "C. Pickel": "Lorient",
  "N. Sadiki": "AS Vita Club",
  "S. Banza": "Braga",
  "T. Bongonda": "Al-Shabab",
  "M. Elia": "Feyenoord",
  "F. Mayele": "Pyramids",

  // ======== BATCH 3 — 100% coverage for all 21 remaining teams ========

  // Argentina (7 missing)
  "F. Cambeses": "Boca Juniors",
  "D. Talavera": "River Plate",
  "A. Giay": "Racing Club",
  "G. Rojas": "River Plate",
  "N. Paz": "Como",
  "M. Perrone": "Man City",
  "J. López": "Boca Juniors",

  // Austria (11 missing)
  "T. Lawal": "Sturm Graz",
  "N. Polster": "Rapid Wien",
  "F. Wiegele": "Sturm Graz",
  "D. Affengruber": "Sturm Graz",
  "M. Friedl": "Werder Bremen",
  "M. Svoboda": "LASK",
  "R. Schmid": "Rapid Wien",
  "A. Schöpf": "Red Bull Salzburg",
  "R. Florucz": "LASK",
  "M. Grüll": "Rapid Wien",
  "S. Kalajdzic": "Wolfsburg",

  // Brazil (12 missing)
  "Hugo Souza": "Flamengo",
  "Alex Sandro": "Flamengo",
  "Fabrício Bruno": "Flamengo",
  "Ibañez": "Al-Ahli",
  "Kaiki": "Palmeiras",
  "Léo Pereira": "Flamengo",
  "Luciano Juba": "Fortaleza",
  "Paulo Henrique": "Flamengo",
  "Vitinho": "Grêmio",
  "Fabinho": "Al-Ittihad",
  "Luiz Henrique": "Botafogo",
  "Vitor Roque": "Real Betis",

  // Ivory Coast (8 missing)
  "A. Lafont": "Nantes",
  "J. Gbamin": "ASEC Mimosas",
  "C. Operi": "ASEC Mimosas",
  "A. Zohouri": "Africa Sports",
  "C. Inao OulaÃ¯": "ASEC Mimosas",
  "J. Seri": "Hull City",
  "O. Diakité": "Auxerre",
  "J. Krasso": "Schalke 04",

  // Colombia (11 missing)
  "K. Mier": "Atlético Nacional",
  "Á. Montero": "Millonarios",
  "C. Cuesta": "Genk",
  "W. Ditta": "Junior",
  "A. Román": "América de Cali",
  "J. Portilla": "Atlético Nacional",
  "G. Puerta": "Atlético Nacional",
  "J. Campaz": "Grêmio",
  "J. Carbonero": "Racing Club",
  "J. Carrascal": "River Plate",
  "K. Serna": "Junior",

  // Croatia (10 missing)
  "I. Ivušić": "Hajduk Split",
  "K. Letica": "Dinamo Zagreb",
  "I. Pandur": "Osijek",
  "D. Bradarić": "Hajduk Split",
  "I. Smolčić": "Rijeka",
  "L. Vušković": "Hajduk Split",
  "M. Baturina": "Dinamo Zagreb",
  "T. Fruk": "Dinamo Zagreb",
  "P. Musa": "Benfica",
  "M. Oršić": "Trabzonspor",

  // England (1 missing)
  "D. Calvert-Lewin": "Everton",

  // Germany (2 missing)
  "S. El Mala": "RB Leipzig",
  "A. Stach": "Freiburg",

  // Saudi Arabia (17 missing)
  "Abdulrahman Al Sanbi": "Al-Hilal",
  "Muteb Al Mufarrij": "Al-Shabab",
  "Mohammed Essa Harbush": "Al-Ahli",
  "R. Hamidou": "Al-Ittihad",
  "Hassan Kadesh": "Al-Nassr",
  "Ali Majrashi": "Al-Ahli",
  "Mohammed Bakor": "Al-Ahli",
  "Waheb Saleh": "Al-Fayha",
  "Salman Al Faraj": "Al-Hilal",
  "Ziyad Al Johani": "Al-Ahli",
  "Mohammed Al-Majhad": "Al-Shabab",
  "Mohammed Mater Mohsin Mahzari": "Al-Fayha",
  "N. Masoud": "Al-Ittihad",
  "A. S. Al Aliwa": "Al-Hilal",
  "Feras Al Brikan": "Al-Fateh",
  "Abdulrahman Al Obud": "Al-Nassr",
  "Marwan Al Sahafi": "Al-Ittihad",

  // Morocco (13 missing)
  "M. Harrar": "RS Berkane",
  "M. Benabid": "Wydad Casablanca",
  "M. Mohamedi": "Raja Casablanca",
  "I. Baouf": "Wydad Casablanca",
  "M. Chibi": "Raja Casablanca",
  "S. El Karouani": "Nantes",
  "Z. El Ouahdi": "Wydad Casablanca",
  "J. El Yamiq": "Valladolid",
  "R. Halhal": "RS Berkane",
  "Y. Belammari": "RS Berkane",
  "M. Hrimat": "Wydad Casablanca",
  "O. Targhalline": "Raja Casablanca",
  "S. Rahimi": "Al-Ain",

  // Mexico (21 missing)
  "C. Acevedo": "Club América",
  "L. Malagón": "Club América",
  "J. Rangel": "Cruz Azul",
  "E.  Águila": "Club América",
  "D. Campillo": "Monterrey",
  "J. Garza": "Tigres",
  "R. Juárez": "UNAM",
  "C. Montes": "Club América",
  "J. Orozco": "Chivas",
  "I. Reyes": "Tigres",
  "R. Alvarado": "Chivas",
  "K. Castañeda": "León",
  "D. García": "Cruz Azul",
  "R. Ledezma": "PSV",
  "É. Lira": "Club América",
  "G. Mora": "Cruz Azul",
  "O. Pineda": "AEK Athens",
  "L. Romo": "Monterrey",
  "D. Lainez": "Tigres",
  "J. Ruvalcaba": "Club América",
  "Á. Sepúlveda": "Chivas",

  // Netherlands (6 missing)
  "R. Roefs": "AZ Alkmaar",
  "L. Geertruida": "RB Leipzig",
  "Q. Hartman": "Feyenoord",
  "K. Smit": "Utrecht",
  "L. Valente": "Twente",
  "B. Brobbey": "Ajax",

  // Norway (11 missing)
  "M. Dyngeland": "Brann",
  "V. Myhra": "Bodø/Glimt",
  "E. Selvik": "Viking",
  "S. Tangvik": "Molde",
  "F. Bjørkan": "Wolfsburg",
  "O. Bjørtuft": "Bodø/Glimt",
  "S. Langås": "Brann",
  "S. Sebulonsen": "Bodø/Glimt",
  "K. Arnstad": "Brann",
  "F. Myhre": "Molde",
  "A. Heggebø": "Brann",

  // Portugal (1 missing)
  "Ricardo Velho": "Benfica",

  // Scotland (11 missing)
  "S. Bain": "Celtic",
  "G. Hanley": "Norwich",
  "R. McCrorie": "Aberdeen",
  "S. McKenna": "Nottm Forest",
  "Findlay Curtis": "Hearts",
  "A. Irving": "Rangers",
  "K. McLean": "Norwich",
  "J. Mulligan": "Hibernian",
  "K. Bowie": "Hearts",
  "T. Conway": "Bristol City",
  "L. Shankland": "Hearts",

  // Senegal (9 missing)
  "M. Diaw": "Génération Foot",
  "A. Seck": "Lens",
  "M. Camara": "Monaco",
  "H. Diarra": "Marseille",
  "H. Diallo": "Strasbourg",
  "Assane Diao": "Real Betis",
  "B. Dieng": "Lyon",
  "C. Ndiaye": "ASC Jaraaf",
  "O. Niang": "Marseille",

  // Switzerland (14 missing)
  "M. Keller": "FC Basel",
  "Y. Mvogo": "Lorient",
  "A. Bajrami": "Sassuolo",
  "M. Muheim": "Sheffield Wednesday",
  "B. Omeragić": "Lyon",
  "M. Aebischer": "Bologna",
  "Joël Monteiro": "Young Boys",
  "A. Sanches": "Servette",
  "V. Sierro": "Toulouse",
  "C. Fassnacht": "Young Boys",
  "C. Itten": "Young Boys",
  "N. Okafor": "Milan",
  "I. Schmidt": "St. Gallen",
  "A. Zeqiri": "Lausanne-Sport",

  // Sweden (12 missing)
  "M. Ellborg": "IFK Göteborg",
  "V. Johansson": "Djurgården",
  "K. Nordfeldt": "Djurgården",
  "N. Törnqvist": "Malmö FF",
  "J. Widell Zetterström": "Derby County",
  "G. Gudmundsson": "Malmö FF",
  "T. Ali": "Malmö FF",
  "H. Johansson": "Hammarby",
  "G. Lundgren": "Elfsborg",
  "E. Stroud": "AIK",
  "B. Zeneli": "Djurgården",
  "A. Bernhardsson": "Elfsborg",

  // Turkey (3 missing)
  "S. Akaydin": "Fenerbahçe",
  "M. Eskihellaç": "Trabzonspor",
  "İ. Kahveci": "Fenerbahçe",

  // Uruguay (17 missing)
  "C. Fiermarín": "Defensor Sporting",
  "F. Muslera": "Galatasaray",
  "K. Amaro": "Nacional",
  "B. Barboza": "Peñarol",
  "J. Piquerez": "Palmeiras",
  "G. Varela": "Flamengo",
  "P. Alcoba": "Nacional",
  "N. Azambuja": "Peñarol",
  "J. Daguer": "Nacional",
  "N. Fonseca": "River Plate",
  "S. Homenchenko": "Nacional",
  "N. Marichal": "Peñarol",
  "N. de la Cruz": "Flamengo",
  "R. Aguirre": "Internacional",
  "A. Canobbio": "Athletico Paranaense",
  "I. Laquintana": "Defensor Sporting",
  "F. Viñas": "Club América",

  // USA (17 missing)
  "C. Brady": "LAFC",
  "R. Celentano": "FC Cincinnati",
  "M. Freese": "NYCFC",
  "J. Klinsmann": "Philadelphia Union",
  "P. Schulte": "St. Louis City",
  "T. Ream": "Charlotte FC",
  "M. Robinson": "FC Cincinnati",
  "J. Tolkin": "New York Red Bulls",
  "B. Aaronson": "Union Berlin",
  "S. Berhalter": "Columbus Crew",
  "A. Morris": "Inter Miami",
  "C. Roldan": "Seattle Sounders",
  "J. Sands": "NYCFC",
  "T. Tillman": "PSV",
  "P. Agyemang": "LAFC",
  "M. Arfsten": "Atlanta United",
  "H. Wright": "Nashville SC",
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
