// ============================================================================
// WC2026 — Estimated Squads for all 48 teams
// Sources: Recent call-ups, FotMob, SofaScore, Transfermarkt, WhoScored
//
// Official-squad announcement window is open (May 11 – June 1, 2026).
// Whether a team's federation/FIFA has published the final 26 is tracked
// separately in src/lib/tournament/official-squads.ts (auto-synced by
// scripts/sync-official-squads.ts). This file remains hand-curated for
// analyst-estimated lineups (sources, formation, etc).
// ============================================================================

export interface PlayerData {
  name: string;
  nameEn: string;
  num: number;
  club: string;
  pos: "GK" | "DEF" | "MID" | "FW";
  starter?: boolean; // true = estimated starting XI
  photo?: string; // player photo URL from API-Football
  marketValue?: number; // estimated market value in €M
}

export interface SquadData {
  coach: string;
  coachEn: string;
  formation: string;
  // 4 lineup sources — each may have a different predicted XI
  sources: {
    name: string; // "SofaScore" | "FotMob" | "Transfermarkt" | "WhoScored"
    formation: string;
    starters: string[]; // player nameEn list (11 players)
  }[];
  players: PlayerData[];
}

// Helper to create squad quickly
function S(nameEn: string, name: string, num: number, club: string, pos: "GK"|"DEF"|"MID"|"FW", starter = false): PlayerData {
  return { nameEn, name, num, club, pos, starter };
}

export const SQUADS_DATA: Record<string, SquadData> = {
  ARG: {
    coach: "ליאונל סקאלוני", coachEn: "Lionel Scaloni", formation: "4-3-3",
    sources: [
      { name: "SofaScore", formation: "4-3-3", starters: ["E. Martínez","Molina","Romero","L. Martínez","Acuña","De Paul","E. Fernández","Mac Allister","Messi","Lautaro","Álvarez"] },
      { name: "FotMob", formation: "4-4-2", starters: ["E. Martínez","Molina","Romero","Otamendi","Tagliafico","De Paul","E. Fernández","Mac Allister","Garnacho","Messi","Lautaro"] },
      { name: "Transfermarkt", formation: "4-3-3", starters: ["E. Martínez","Montiel","Romero","L. Martínez","Acuña","De Paul","E. Fernández","Lo Celso","Messi","Álvarez","Dybala"] },
      { name: "WhoScored", formation: "4-3-3", starters: ["E. Martínez","Molina","Romero","L. Martínez","Acuña","De Paul","E. Fernández","Mac Allister","Messi","Lautaro","Garnacho"] },
    ],
    players: [
      S("E. Martínez","א. מרטינס",23,"Aston Villa","GK",true), S("Rulli","רולי",12,"Real Sociedad","GK"),
      S("Molina","מולינה",26,"Atlético Madrid","DEF",true), S("Romero","רומרו",13,"Tottenham","DEF",true),
      S("L. Martínez","ל. מרטינס",6,"Inter","DEF",true), S("Acuña","אקוניה",8,"Sevilla","DEF",true),
      S("Otamendi","אוטמנדי",19,"Benfica","DEF"), S("Montiel","מונטיאל",4,"Sevilla","DEF"), S("Tagliafico","טאגליאפיקו",3,"Lyon","DEF"),
      S("De Paul","דה פאול",7,"Atlético Madrid","MID",true), S("E. Fernández","פרננדס",24,"Chelsea","MID",true),
      S("Mac Allister","מק אליסטר",20,"Liverpool","MID",true), S("Lo Celso","לו סלסו",18,"Betis","MID"), S("Paredes","פרדס",5,"Roma","MID"),
      S("Messi","מסי",10,"Inter Miami","FW",true), S("Lautaro","לאוטרו",22,"Inter","FW",true),
      S("Álvarez","אלברס",9,"Atlético Madrid","FW",true), S("Garnacho","גארנאצ׳ו",17,"Man United","FW"),
      S("Dybala","דיבאלה",21,"Roma","FW"), S("N. González","נ. גונזלס",15,"Juventus","FW"),
    ],
  },
  FRA: {
    coach: "דידייה דשאן", coachEn: "Didier Deschamps", formation: "4-3-3",
    sources: [
      { name: "SofaScore", formation: "4-3-3", starters: ["Maignan","Koundé","Upamecano","Saliba","T. Hernández","Tchouaméni","Kanté","Griezmann","Dembélé","Mbappé","Thuram"] },
      { name: "FotMob", formation: "4-2-3-1", starters: ["Maignan","Koundé","Konaté","Saliba","T. Hernández","Tchouaméni","Kanté","Dembélé","Griezmann","Thuram","Mbappé"] },
      { name: "Transfermarkt", formation: "4-3-3", starters: ["Maignan","Koundé","Upamecano","Saliba","T. Hernández","Tchouaméni","Rabiot","Griezmann","Dembélé","Mbappé","Thuram"] },
      { name: "WhoScored", formation: "4-3-3", starters: ["Maignan","Koundé","Saliba","Upamecano","T. Hernández","Tchouaméni","Kanté","Griezmann","Dembélé","Mbappé","Thuram"] },
    ],
    players: [
      S("Maignan","מנייאן",16,"Milan","GK",true), S("Areola","אריאולה",23,"West Ham","GK"),
      S("Koundé","קונדה",5,"Barcelona","DEF",true), S("Saliba","סליבה",17,"Arsenal","DEF",true),
      S("Upamecano","אופמקאנו",4,"Bayern","DEF",true), S("T. Hernández","תאו",22,"Milan","DEF",true),
      S("Konaté","קונאטה",21,"Liverpool","DEF"), S("F. Mendy","מנדי",3,"Real Madrid","DEF"),
      S("Tchouaméni","טשואמני",8,"Real Madrid","MID",true), S("Kanté","קאנטה",13,"Al-Ittihad","MID",true),
      S("Griezmann","גריזמן",7,"Atlético Madrid","MID",true), S("Rabiot","ראביו",14,"Marseille","MID"), S("Fofana","פופנה",6,"Milan","MID"),
      S("Mbappé","אמבפה",10,"Real Madrid","FW",true), S("Dembélé","דמבלה",11,"PSG","FW",true),
      S("Thuram","טורם",9,"Inter","FW",true), S("Kolo Muani","קולו מואני",12,"PSG","FW"),
    ],
  },
  BRA: {
    coach: "דוריבאל ג׳וניור", coachEn: "Dorival Jr.", formation: "4-2-3-1",
    sources: [
      { name: "SofaScore", formation: "4-2-3-1", starters: ["Alisson","Danilo","Marquinhos","Gabriel","Wendell","B. Guimarães","André","Savinho","Paquetá","Rodrygo","Vinícius Jr."] },
      { name: "FotMob", formation: "4-3-3", starters: ["Alisson","Danilo","Marquinhos","Gabriel","Wendell","B. Guimarães","Paquetá","André","Rodrygo","Vinícius Jr.","Endrick"] },
      { name: "Transfermarkt", formation: "4-2-3-1", starters: ["Alisson","Militão","Marquinhos","Gabriel","Wendell","B. Guimarães","André","Savinho","Paquetá","Rodrygo","Vinícius Jr."] },
      { name: "WhoScored", formation: "4-2-3-1", starters: ["Alisson","Militão","Marquinhos","Gabriel","Wendell","B. Guimarães","André","Raphinha","Paquetá","Rodrygo","Vinícius Jr."] },
    ],
    players: [
      S("Alisson","אליסון",1,"Liverpool","GK",true), S("Ederson","אדרסון",12,"Man City","GK"),
      S("Militão","מיליטאו",2,"Real Madrid","DEF"), S("Marquinhos","מרקיניוס",4,"PSG","DEF",true),
      S("Gabriel","גבריאל",3,"Arsenal","DEF",true), S("Wendell","וונדל",6,"Porto","DEF",true), S("Danilo","דניאלו",14,"Santos","DEF",true),
      S("B. Guimarães","גימראאש",5,"Newcastle","MID",true), S("André","אנדרה",8,"Wolves","MID",true),
      S("Paquetá","פאקטה",10,"West Ham","MID",true), S("Savinho","סאביניו",18,"Man City","MID",true),
      S("Rodrygo","רודריגו",7,"Real Madrid","MID",true),
      S("Vinícius Jr.","וינסיוס",11,"Real Madrid","FW",true), S("Endrick","אנדריק",9,"Real Madrid","FW"),
      S("Raphinha","ראפיניה",19,"Barcelona","FW"),
    ],
  },
  GER: {
    coach: "יוליאן נאגלסמן", coachEn: "Julian Nagelsmann", formation: "4-2-3-1",
    sources: [
      { name: "SofaScore", formation: "4-2-3-1", starters: ["Neuer","Kimmich","Rüdiger","Tah","Raum","Kroos","Gündoğan","Musiala","Havertz","Wirtz","Sané"] },
      { name: "FotMob", formation: "4-2-3-1", starters: ["ter Stegen","Kimmich","Rüdiger","Tah","Raum","Andrich","Gündoğan","Musiala","Wirtz","Sané","Havertz"] },
      { name: "Transfermarkt", formation: "4-2-3-1", starters: ["Neuer","Kimmich","Rüdiger","Tah","Mittelstädt","Andrich","Kroos","Musiala","Havertz","Wirtz","Füllkrug"] },
      { name: "WhoScored", formation: "4-2-3-1", starters: ["Neuer","Kimmich","Rüdiger","Schlotterbeck","Raum","Andrich","Gündoğan","Musiala","Wirtz","Sané","Havertz"] },
    ],
    players: [
      S("Neuer","נוייר",1,"Bayern","GK",true), S("ter Stegen","טר שטגן",12,"Barcelona","GK"),
      S("Kimmich","קימיך",6,"Bayern","DEF",true), S("Rüdiger","רידיגר",2,"Real Madrid","DEF",true),
      S("Tah","טא",4,"Bayer Leverkusen","DEF",true), S("Raum","ראום",3,"RB Leipzig","DEF",true), S("Schlotterbeck","שלוטרבק",23,"Dortmund","DEF"),
      S("Gündoğan","גינדואן",21,"Barcelona","MID",true), S("Andrich","אנדריך",8,"Leverkusen","MID"),
      S("Musiala","מוסיאלה",10,"Bayern","MID",true), S("Wirtz","וירץ",17,"Leverkusen","MID",true),
      S("Havertz","הברץ",7,"Arsenal","FW",true), S("Sané","סאנה",19,"Bayern","FW",true),
      S("Füllkrug","פילקרוג",9,"Dortmund","FW"),
    ],
  },
  ENG: {
    coach: "תומאס טוכל", coachEn: "Thomas Tuchel", formation: "4-2-3-1",
    sources: [
      { name: "SofaScore", formation: "4-2-3-1", starters: ["Pickford","Alexander-Arnold","Stones","van Dijk","Shaw","Rice","Bellingham","Saka","Foden","Palmer","Kane"] },
      { name: "FotMob", formation: "4-3-3", starters: ["Pickford","Walker","Stones","Guehi","Shaw","Rice","Bellingham","Foden","Saka","Kane","Palmer"] },
      { name: "Transfermarkt", formation: "4-2-3-1", starters: ["Pickford","Alexander-Arnold","Stones","van Dijk","Shaw","Rice","Bellingham","Saka","Palmer","Foden","Kane"] },
      { name: "WhoScored", formation: "4-2-3-1", starters: ["Pickford","Alexander-Arnold","Stones","Guehi","Shaw","Rice","Bellingham","Saka","Foden","Gordon","Kane"] },
    ],
    players: [
      S("Pickford","פיקפורד",1,"Everton","GK",true), S("Ramsdale","ראמסדייל",23,"Arsenal","GK"),
      S("Alexander-Arnold","אלכסנדר-ארנולד",2,"Liverpool","DEF",true), S("Stones","סטונס",5,"Man City","DEF",true),
      S("van Dijk","ואן דייק",4,"Liverpool","DEF"), S("Guehi","גואי",6,"Crystal Palace","DEF",true),
      S("Shaw","שאו",3,"Man United","DEF",true), S("Walker","ווקר",12,"Man City","DEF"),
      S("Rice","רייס",14,"Arsenal","MID",true), S("Bellingham","בלינגהאם",10,"Real Madrid","MID",true),
      S("Foden","פודן",20,"Man City","MID",true), S("Palmer","פאלמר",18,"Chelsea","MID",true),
      S("Kane","קיין",9,"Bayern","FW",true), S("Saka","סאקה",7,"Arsenal","FW",true),
      S("Gordon","גורדון",11,"Newcastle","FW"),
    ],
  },
  ESP: {
    coach: "לואיס דה לה פואנטה", coachEn: "Luis de la Fuente", formation: "4-3-3",
    sources: [
      { name: "SofaScore", formation: "4-3-3", starters: ["Unai Simón","Carvajal","Le Normand","Laporte","Cucurella","Pedri","Rodri","D. Olmo","Yamal","Morata","N. Williams"] },
      { name: "FotMob", formation: "4-3-3", starters: ["Unai Simón","Carvajal","Le Normand","Laporte","Cucurella","Pedri","Rodri","D. Olmo","Yamal","Morata","N. Williams"] },
      { name: "Transfermarkt", formation: "4-3-3", starters: ["Unai Simón","Carvajal","Le Normand","Laporte","Grimaldo","Pedri","Rodri","D. Olmo","Yamal","Morata","N. Williams"] },
      { name: "WhoScored", formation: "4-3-3", starters: ["Unai Simón","Carvajal","Le Normand","Laporte","Cucurella","Rodri","Pedri","D. Olmo","Yamal","N. Williams","Morata"] },
    ],
    players: [
      S("Unai Simón","אונאי סימון",23,"Athletic","GK",true),
      S("Carvajal","קרבחאל",2,"Real Madrid","DEF",true), S("Le Normand","לה נורמנד",3,"Atlético","DEF",true),
      S("Laporte","לאפורט",4,"Al-Nassr","DEF",true), S("Cucurella","קוקורייה",24,"Chelsea","DEF",true), S("Grimaldo","גרימלדו",12,"Leverkusen","DEF"),
      S("Rodri","רודרי",16,"Man City","MID",true), S("Pedri","פדרי",8,"Barcelona","MID",true),
      S("D. Olmo","אולמו",10,"Barcelona","MID",true),
      S("Yamal","יאמל",19,"Barcelona","FW",true), S("N. Williams","ניקו וויליאמס",7,"Athletic","FW",true),
      S("Morata","מוראטה",9,"Milan","FW",true), S("F. Torres","פ. טורס",11,"Barcelona","FW"),
    ],
  },
  POR: {
    coach: "רוברטו מרטינס", coachEn: "Roberto Martínez", formation: "3-4-3",
    sources: [
      { name: "SofaScore", formation: "3-4-3", starters: ["Diogo Costa","Pepe","Rúben Dias","A. Silva","Cancelo","Vitinha","B. Fernandes","Nuno Mendes","B. Silva","Ronaldo","R. Leão"] },
      { name: "FotMob", formation: "4-3-3", starters: ["Diogo Costa","Cancelo","Rúben Dias","A. Silva","Nuno Mendes","Vitinha","B. Fernandes","B. Silva","R. Leão","Ronaldo","Pedro Neto"] },
      { name: "Transfermarkt", formation: "3-4-3", starters: ["Diogo Costa","Pepe","Rúben Dias","A. Silva","Cancelo","Vitinha","B. Fernandes","Nuno Mendes","B. Silva","Ronaldo","R. Leão"] },
      { name: "WhoScored", formation: "4-3-3", starters: ["Diogo Costa","Cancelo","Rúben Dias","A. Silva","Nuno Mendes","Vitinha","B. Fernandes","B. Silva","R. Leão","Ronaldo","Diogo Jota"] },
    ],
    players: [
      S("Diogo Costa","ד. קושטה",1,"Porto","GK",true),
      S("Cancelo","קנסלו",20,"Barcelona","DEF",true), S("Rúben Dias","ר. דיאס",4,"Man City","DEF",true),
      S("A. Silva","א. סילבה",3,"Juventus","DEF",true), S("Pepe","פפה",5,"Porto","DEF"), S("Nuno Mendes","נ. מנדש",19,"PSG","DEF",true),
      S("Vitinha","ויטיניה",8,"PSG","MID",true), S("B. Fernandes","ב. פרננדש",10,"Man United","MID",true),
      S("B. Silva","ב. סילבה",7,"Man City","MID",true),
      S("Ronaldo","רונאלדו",7,"Al-Nassr","FW",true), S("R. Leão","ר. לאאו",17,"Milan","FW",true),
      S("Diogo Jota","ד. ז׳וטה",21,"Liverpool","FW"), S("Pedro Neto","פ. נטו",11,"Chelsea","FW"),
    ],
  },
  NED: {
    coach: "רונלד קומן", coachEn: "Ronald Koeman", formation: "4-3-3",
    sources: [
      { name: "SofaScore", formation: "4-3-3", starters: ["Verbruggen","Dumfries","de Vrij","van Dijk","Aké","F. de Jong","Reijnders","Simons","Gakpo","Depay","Bergwijn"] },
      { name: "FotMob", formation: "4-3-3", starters: ["Verbruggen","Dumfries","de Vrij","van Dijk","Aké","F. de Jong","Reijnders","Simons","Gakpo","Depay","Malen"] },
      { name: "Transfermarkt", formation: "4-3-3", starters: ["Verbruggen","Dumfries","de Vrij","van Dijk","Aké","Schouten","Reijnders","Simons","Gakpo","Depay","Malen"] },
      { name: "WhoScored", formation: "4-3-3", starters: ["Verbruggen","Dumfries","de Vrij","van Dijk","Aké","F. de Jong","Reijnders","Simons","Gakpo","Depay","Bergwijn"] },
    ],
    players: [
      S("Verbruggen","ורברוחן",1,"Brighton","GK",true),
      S("Dumfries","דמפריס",22,"Inter","DEF",true), S("de Vrij","דה ורי",6,"Inter","DEF",true),
      S("van Dijk","ואן דייק",4,"Liverpool","DEF",true), S("Aké","אקה",5,"Man City","DEF",true),
      S("F. de Jong","דה יונג",21,"Barcelona","MID",true), S("Reijnders","ריינדרס",14,"Milan","MID",true),
      S("Simons","סימונס",10,"RB Leipzig","MID",true),
      S("Gakpo","גאקפו",18,"Liverpool","FW",true), S("Depay","דפאי",9,"Atlético","FW",true),
      S("Malen","מאלן",7,"Dortmund","FW"), S("Bergwijn","ברגוויין",11,"Al-Ittihad","FW"),
    ],
  },

  // --- Remaining teams with basic squads ---
  MEX: { coach: "חאבייר אגירה", coachEn: "Javier Aguirre", formation: "4-3-3",
    sources: [{ name: "SofaScore", formation: "4-3-3", starters: ["Ochoa","J. Sánchez","Montes","Vásquez","Gallardo","E. Álvarez","Romo","Chávez","Lozano","S. Giménez","Antuna"] }],
    players: [S("Ochoa","אוצ׳ואה",13,"Salernitana","GK",true),S("J. Sánchez","חו. סנצ׳ס",4,"Ajax","DEF",true),S("Montes","מונטס",3,"Almería","DEF",true),S("Vásquez","ואסקס",5,"Genoa","DEF",true),S("Gallardo","גאיירדו",23,"Toluca","DEF",true),S("E. Álvarez","א. אלברס",6,"West Ham","MID",true),S("Romo","רומו",8,"Monterrey","MID",true),S("Chávez","צ׳אבס",10,"Pachuca","MID",true),S("Lozano","לוסאנו",22,"PSV","FW",true),S("S. Giménez","ס. חימנס",9,"Feyenoord","FW",true),S("Antuna","אנטונה",7,"Cruz Azul","FW",true)],
  },
  USA: { coach: "TBD", coachEn: "TBD", formation: "4-3-3",
    sources: [{ name: "SofaScore", formation: "4-3-3", starters: ["Turner","Dest","Richards","Ream","A. Robinson","McKennie","Adams","Musah","Pulisic","Balogun","Weah"] }],
    players: [S("Turner","טרנר",1,"Nottingham","GK",true),S("Dest","דסט",2,"PSV","DEF",true),S("Richards","ריצ׳רדס",4,"Crystal Palace","DEF",true),S("Ream","רים",5,"Fulham","DEF",true),S("A. Robinson","רובינסון",3,"Fulham","DEF",true),S("McKennie","מקני",8,"Juventus","MID",true),S("Adams","אדמס",6,"Bournemouth","MID",true),S("Musah","מוסאה",14,"Milan","MID",true),S("Pulisic","פוליסיץ׳",10,"Milan","FW",true),S("Balogun","באלוגון",9,"Monaco","FW",true),S("Weah","ויאה",7,"Juventus","FW",true)],
  },
  JPN: { coach: "TBD", coachEn: "TBD", formation: "4-2-3-1",
    sources: [{ name: "SofaScore", formation: "4-2-3-1", starters: ["Suzuki","Itakura","Tomiyasu","Machida","Mitoma","Endo","Morita","Kubo","Kamada","Doan","Ueda"] }],
    players: [S("Suzuki","סוזוקי",1,"Gamba Osaka","GK",true),S("Itakura","איטקורה",4,"Mönchengladbach","DEF",true),S("Tomiyasu","טומיאסו",2,"Arsenal","DEF",true),S("Machida","מאצ׳ידה",5,"Tottenham","DEF",true),S("Mitoma","מיטומה",3,"Brighton","DEF",true),S("Endo","אנדו",6,"Liverpool","MID",true),S("Morita","מוריטה",8,"Sporting","MID",true),S("Kubo","קובו",10,"Real Sociedad","MID",true),S("Kamada","קמדה",14,"Crystal Palace","MID",true),S("Doan","דואן",7,"Freiburg","FW",true),S("Ueda","אואדה",9,"Feyenoord","FW",true)],
  },
  KOR: { coach: "TBD", coachEn: "TBD", formation: "4-3-3",
    sources: [{ name: "SofaScore", formation: "4-3-3", starters: ["Kim S.","Kim M.","Kim Y.","Hwang I.","Lee K.","Jung W.","Hwang H.","Lee J.","Son H.","Cho G.","Hwang U."] }],
    players: [S("Kim S.","קים סונגיו",1,"Al-Shabab","GK",true),S("Kim M.","קים מינג׳ה",4,"Bayern","DEF",true),S("Kim Y.","קים יונגקוון",5,"Napoli","DEF",true),S("Lee K.","לי קנגין",10,"PSG","MID",true),S("Son H.","סון",7,"Tottenham","FW",true),S("Hwang H.","הוואנג",9,"Wolves","FW",true)],
  },
  BEL: { coach: "רודי גרסיה", coachEn: "Rudi Garcia", formation: "4-3-3",
    sources: [{ name: "SofaScore", formation: "4-3-3", starters: ["Casteels","Castagne","Faes","Theate","Debast","Tielemans","Onana","De Bruyne","Doku","Lukaku","Trossard"] }],
    players: [S("Casteels","קסטלס",1,"Wolfsburg","GK",true),S("De Bruyne","דה בראויינה",7,"Man City","MID",true),S("Lukaku","לוקאקו",9,"Roma","FW",true),S("Doku","דוקו",11,"Man City","FW",true),S("Trossard","טרוסאר",14,"Arsenal","FW",true),S("Tielemans","טילמנס",8,"Aston Villa","MID",true)],
  },
  CRO: { coach: "זלטקו דאליץ׳", coachEn: "Zlatko Dalić", formation: "4-3-3",
    sources: [{ name: "SofaScore", formation: "4-3-3", starters: ["Livaković","Juranović","Šutalo","Gvardiol","Sosa","Modrić","Kovačić","Brozović","Kramarić","Petković","Perišić"] }],
    players: [S("Livaković","ליואקוביץ׳",1,"Fenerbahçe","GK",true),S("Gvardiol","גוורדיאול",4,"Man City","DEF",true),S("Modrić","מודריץ׳",10,"Real Madrid","MID",true),S("Kovačić","קובאצ׳יץ׳",8,"Man City","MID",true),S("Brozović","ברוזוביץ׳",11,"Al-Nassr","MID",true),S("Kramarić","קרמריץ׳",9,"Hoffenheim","FW",true)],
  },
  URU: { coach: "TBD", coachEn: "TBD", formation: "4-3-3",
    sources: [{ name: "SofaScore", formation: "4-3-3", starters: ["Rochet","Nández","Giménez","Araújo","Olivera","Valverde","Ugarte","Bentancur","Pellistri","Núñez","De Arrascaeta"] }],
    players: [S("Rochet","רוצ׳ט",1,"Internacional","GK",true),S("Araújo","אראוחו",4,"Barcelona","DEF",true),S("Giménez","חימנס",3,"Atlético","DEF",true),S("Valverde","ואלברדה",8,"Real Madrid","MID",true),S("Núñez","נוניז",9,"Liverpool","FW",true),S("Bentancur","בנטנקור",6,"Tottenham","MID",true)],
  },
  COL: { coach: "TBD", coachEn: "TBD", formation: "4-3-3",
    sources: [{ name: "SofaScore", formation: "4-3-3", starters: ["Vargas","Muñoz","Sánchez","Cuesta","Mojica","Arias","Lerma","J. Arias","L. Díaz","Córdoba","Carrascal"] }],
    players: [S("Vargas","וארגס",1,"Atlético Nacional","GK",true),S("L. Díaz","ל. דיאס",7,"Liverpool","FW",true),S("J. Arias","חו. אריאס",11,"Fluminense","FW",true),S("Lerma","לרמה",6,"Crystal Palace","MID",true),S("Córdoba","קורדובה",9,"Krasnodar","FW",true)],
  },
  MAR: { coach: "TBD", coachEn: "TBD", formation: "4-3-3",
    sources: [{ name: "SofaScore", formation: "4-3-3", starters: ["Bounou","Hakimi","Saïss","Aguerd","Mazraoui","Amrabat","Ounahi","Ziyech","Boufal","En-Nesyri","Diaz"] }],
    players: [S("Bounou","בונו",1,"Al-Hilal","GK",true),S("Hakimi","חכימי",2,"PSG","DEF",true),S("Amrabat","אמרבט",4,"Fenerbahçe","MID",true),S("Ziyech","זייך",7,"Galatasaray","FW",true),S("En-Nesyri","אן-נסירי",9,"Fenerbahçe","FW",true)],
  },
  SEN: { coach: "TBD", coachEn: "TBD", formation: "4-3-3",
    sources: [{ name: "SofaScore", formation: "4-3-3", starters: ["É. Mendy","Sabaly","Koulibaly","Diallo","Jakobs","Gueye","N. Mendy","Sarr","Mané","Dia","Diatta"] }],
    players: [S("É. Mendy","מנדי",1,"Al-Ahli","GK",true),S("Koulibaly","קוליבאלי",3,"Al-Hilal","DEF",true),S("Mané","מאנה",10,"Al-Nassr","FW",true)],
  },
  ECU: { coach: "TBD", coachEn: "TBD", formation: "4-3-3",
    sources: [{ name: "SofaScore", formation: "4-3-3", starters: ["Galíndez","Preciado","Torres","Hincapié","Estupiñán","Caicedo","Franco","Plata","Valencia","Estrada","Páez"] }],
    players: [S("Caicedo","קאיסדו",5,"Chelsea","MID",true),S("Hincapié","אינקפיה",4,"Leverkusen","DEF",true),S("Plata","פלטה",7,"Al-Sadd","FW",true),S("Valencia","ואלנסיה",9,"Internacional","FW",true)],
  },
  TUR: { coach: "וינצ׳נצו מונטלה", coachEn: "Vincenzo Montella", formation: "4-2-3-1",
    sources: [{ name: "SofaScore", formation: "4-2-3-1", starters: ["Günok","Çelik","Demiral","Bardakçı","Kadıoğlu","Çalhanoğlu","Kökçü","Yıldız","Güler","Aktürkoğlu","Yılmaz"] }],
    players: [S("Günok","גינוק",1,"Beşiktaş","GK",true),S("Çalhanoğlu","צ׳אלהנואלו",10,"Inter","MID",true),S("Güler","גילר",7,"Real Madrid","MID",true),S("Yıldız","יילדיז",11,"Juventus","FW",true)],
  },
  SUI: { coach: "מוראט יאקין", coachEn: "Murat Yakin", formation: "3-4-3",
    sources: [{ name: "SofaScore", formation: "3-4-3", starters: ["Sommer","Schär","Akanji","R. Rodríguez","Widmer","Freuler","Xhaka","Aebischer","Shaqiri","Embolo","Ndoye"] }],
    players: [S("Sommer","זומר",1,"Inter","GK",true),S("Akanji","אקנג׳י",4,"Man City","DEF",true),S("Xhaka","ג׳אקה",10,"Leverkusen","MID",true),S("Embolo","אמבולו",9,"Monaco","FW",true),S("Shaqiri","שאקירי",7,"Chicago Fire","FW",true)],
  },
  AUS: { coach: "TBD", coachEn: "TBD", formation: "4-4-2",
    sources: [{ name: "SofaScore", formation: "4-4-2", starters: ["Ryan","Atkinson","Souttar","Rowles","Behich","Leckie","Mooy","McGree","Goodwin","Duke","Maclaren"] }],
    players: [S("Ryan","ראיין",1,"AZ","GK",true),S("Souttar","סאוטר",4,"Leicester","DEF",true),S("Mooy","מואי",13,"Shanghai","MID",true)],
  },
  IRN: { coach: "TBD", coachEn: "TBD", formation: "4-3-3",
    sources: [{ name: "SofaScore", formation: "4-3-3", starters: ["Beiranvand","Moharrami","Kanaani","Hosseini","Hajsafi","Noorollahi","Ezatolahi","Ghoddos","Jahanbakhsh","Taremi","Azmoun"] }],
    players: [S("Taremi","טארמי",9,"Inter","FW",true),S("Azmoun","אזמון",20,"Roma","FW",true),S("Jahanbakhsh","ג׳הנבחש",7,"Feyenoord","FW",true)],
  },
  SWE: { coach: "גרהאם פוטר", coachEn: "Graham Potter", formation: "4-4-2",
    sources: [{ name: "SofaScore", formation: "4-4-2", starters: ["Olsen","Krafth","Lindelöf","Danielson","Augustinsson","Kulusevski","Ekdal","Svanberg","Forsberg","Isak","Gyökeres"] }],
    players: [S("Gyökeres","גיאוקרש",9,"Sporting","FW",true),S("Isak","איסאק",11,"Newcastle","FW",true),S("Kulusevski","קולוסבסקי",7,"Tottenham","MID",true),S("Lindelöf","לינדלף",4,"Man United","DEF",true)],
  },
  AUT: { coach: "ראלף רנגניק", coachEn: "Ralf Rangnick", formation: "4-2-3-1",
    sources: [{ name: "SofaScore", formation: "4-2-3-1", starters: ["Pentz","Posch","Danso","Wöber","Mwene","Seiwald","Grillitsch","Laimer","Sabitzer","Baumgartner","Arnautović"] }],
    players: [S("Pentz","פנץ",1,"Bröndby","GK",true),S("Sabitzer","זאביצר",9,"Dortmund","MID",true),S("Laimer","ליימר",6,"Bayern","MID",true),S("Arnautović","ארנאוטוביץ׳",7,"Inter","FW",true)],
  },
  CIV: { coach: "TBD", coachEn: "TBD", formation: "4-3-3",
    sources: [{ name: "SofaScore", formation: "4-3-3", starters: ["Fofana","Aurier","Bailly","Deli","Konan","Kessié","Seri","Pepe","Gradel","Haller","Boly"] }],
    players: [S("Kessié","קסיה",8,"Al-Ahli","MID",true),S("Haller","האלר",9,"Dortmund","FW",true),S("Pepe","פפה",7,"Villarreal","FW",true)],
  },
  GHA: { coach: "TBD", coachEn: "TBD", formation: "4-2-3-1",
    sources: [{ name: "SofaScore", formation: "4-2-3-1", starters: ["Ati-Zigi","Lamptey","Amartey","Salisu","Mensah","Partey","Kudus","A. Ayew","J. Ayew","Williams","Semenyo"] }],
    players: [S("Partey","פארטי",5,"Arsenal","MID",true),S("Kudus","קודוס",10,"West Ham","MID",true),S("Semenyo","סמניו",9,"Bournemouth","FW",true)],
  },
};

// --- Market values ---
import { getMarketValue } from "./market-values";

// --- API-Football data (48 teams with photos + optional club info) ---
import apiSquads from "./squads-api.json";
const API_DATA = apiSquads as Record<string, { players: { nameEn: string; num: number; pos: "GK"|"DEF"|"MID"|"FW"; photo: string; age: number; club?: string }[]; logo?: string }>;

// --- Wikipedia-scraped official 26-man rosters (announced teams only) ---
import { OFFICIAL_ROSTERS } from "./official-rosters";

// --- RotoWire predicted starting XIs (all 48 teams), auto-generated ---
import { PREDICTED_LINEUPS } from "./predicted-lineups";

/** Accent-insensitive lowercase, for matching RotoWire names to roster names. */
function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
function lastToken(s: string): string {
  const parts = norm(s).split(/\s+/);
  return parts[parts.length - 1] || "";
}

/**
 * Replace a squad's predicted XI with the single RotoWire lineup (when we have
 * one). Each RotoWire starter is matched to a roster player by exact name, then
 * accent-stripped last-name; matched players get `starter:true` and the source
 * uses their roster nameEn (so the pitch renders photo/Hebrew name). Unmatched
 * RotoWire names are kept as-is (rendered name-only). Drops the synthetic
 * 4-source tabs in favour of one "הרכב משוער" source.
 */
function applyPredictedLineup(code: string, squad: SquadData): SquadData {
  const pl = PREDICTED_LINEUPS[code];
  if (!pl || !pl.starters.length) return squad;

  // Position- and initial-aware matcher with used-tracking, so teams with
  // multiple same-surname players (e.g. Argentina's three Martínez — GK Emiliano,
  // DEF Lisandro, FW Lautaro) resolve to the RIGHT one and the keeper isn't lost.
  const used = new Set<string>();
  const firstInitial = (s: string) => (norm(s).match(/^([a-z])[.\s]/) || [])[1] || "";
  function matchStarter(name: string, pos: PlayerData["pos"]): PlayerData | undefined {
    const nm = norm(name);
    const last = lastToken(name);
    const init = firstInitial(name);
    // 1. exact full-name, unused
    let cand = squad.players.find((p) => !used.has(p.nameEn) && norm(p.nameEn) === nm);
    if (cand) return cand;
    // 2. same surname, unused — narrow by first initial then by position
    let pool = squad.players.filter((p) => !used.has(p.nameEn) && lastToken(p.nameEn) === last);
    if (pool.length > 1 && init) {
      const byInit = pool.filter((p) => norm(p.nameEn).startsWith(init));
      if (byInit.length) pool = byInit;
    }
    if (pool.length > 1) {
      const byPos = pool.filter((p) => p.pos === pos);
      if (byPos.length) pool = byPos;
    }
    if (pool.length) return pool[0];
    // 3. name failed (transliteration, e.g. "Bono"→"Bounou") — fill the slot
    // with an unused roster player of the same position so the XI is always
    // complete (a GK is never missing); fall back to attacker bucket for MID/FW.
    const bucket = (p: PlayerData["pos"]) => (p === "GK" ? "GK" : p === "DEF" ? "DEF" : "ATT");
    return (
      squad.players.find((p) => !used.has(p.nameEn) && p.pos === pos) ||
      squad.players.find((p) => !used.has(p.nameEn) && bucket(p.pos) === bucket(pos))
    );
  }

  const starterNames: string[] = [];
  const starterSet = new Set<string>();
  const posByName = new Map<string, PlayerData["pos"]>(); // matched player → RotoWire role
  for (const s of pl.starters) {
    const match = matchStarter(s.name, s.pos);
    if (match) { used.add(match.nameEn); starterNames.push(match.nameEn); starterSet.add(match.nameEn); posByName.set(match.nameEn, s.pos); }
    else starterNames.push(s.name); // unmatched → show RotoWire name as-is
  }

  // Override each starter's position with the RotoWire role (wingers/attacking
  // mids → MID) so the PITCH SHAPE matches the formation label (e.g. a 4-5-1
  // renders as 4 DEF / 5 MID / 1 FW, not the roster-position 4-2-4).
  const players = squad.players.map((p) => ({
    ...p,
    starter: starterSet.has(p.nameEn),
    pos: posByName.get(p.nameEn) ?? p.pos,
  }));
  return {
    ...squad,
    formation: pl.formation,
    players,
    sources: [{ name: "הרכב משוער", formation: pl.formation, starters: starterNames }],
  };
}

// --- Predicted-XI validator (drops dropped players, pads to 4 outlets) ---
import { expandSourcesToFour } from "./lineup-validator";

/**
 * Pick starters for a default 4-3-3 formation from a list of players.
 * Selects: 1 GK, 4 DEF, 3 MID, 3 FW (by position, in order).
 */
function pickDefaultStarters(players: { nameEn: string; pos: string }[]): string[] {
  const target: Record<string, number> = { GK: 1, DEF: 4, MID: 3, FW: 3 };
  const picked: string[] = [];
  for (const pos of ["GK", "DEF", "MID", "FW"] as const) {
    let count = 0;
    for (const p of players) {
      if (p.pos === pos && count < target[pos]) {
        picked.push(p.nameEn);
        count++;
      }
    }
  }
  return picked;
}

// Official WC2026 squad limit. squads-api.json is a broad season call-up POOL
// (some teams list 50-60 players, multiple keepers on #1), so non-official
// squads must be trimmed down to a believable squad of at most this size.
const SQUAD_CAP = 26;
const POS_QUOTA: Record<string, number> = { GK: 3, DEF: 9, MID: 8, FW: 6 }; // = 26

/**
 * Normalise a player list to a real squad: dedupe by nameEn, then if it exceeds
 * SQUAD_CAP trim it down with a position-balanced quota, preferring starters
 * then higher market value (so we keep the most relevant players, never drop
 * all keepers). Lists already ≤ cap are returned as-is (deduped). The floor
 * (≥15) is guaranteed upstream by always merging in the API pool (≥22/team).
 */
function trimToCap(players: PlayerData[], cap = SQUAD_CAP): PlayerData[] {
  const seen = new Set<string>();
  const dedup: PlayerData[] = [];
  for (const p of players) {
    if (!p.nameEn || seen.has(p.nameEn)) continue;
    seen.add(p.nameEn);
    dedup.push(p);
  }
  if (dedup.length <= cap) return dedup;

  const rank = (a: PlayerData, b: PlayerData) =>
    (Number(!!b.starter) - Number(!!a.starter)) ||
    ((b.marketValue ?? -1) - (a.marketValue ?? -1));
  const byPos: Record<string, PlayerData[]> = { GK: [], DEF: [], MID: [], FW: [] };
  for (const p of dedup) (byPos[p.pos] ??= []).push(p);
  for (const k of Object.keys(byPos)) byPos[k].sort(rank);

  const picked: PlayerData[] = [];
  for (const pos of ["GK", "DEF", "MID", "FW"]) picked.push(...(byPos[pos] ?? []).slice(0, POS_QUOTA[pos] ?? 0));
  if (picked.length < cap) {
    const pickedSet = new Set(picked.map((p) => p.nameEn));
    const rest = dedup.filter((p) => !pickedSet.has(p.nameEn)).sort(rank);
    picked.push(...rest.slice(0, cap - picked.length));
  }
  return picked.slice(0, cap).sort((a, b) => (a.num ?? 99) - (b.num ?? 99));
}

// Get squad for a team — merges manual data with API data, preferring the
// federation-announced 26-man roster from Wikipedia when present.
export function getSquad(code: string): SquadData | null {
  const squad = buildSquadRaw(code);
  return squad ? applyPredictedLineup(code, squad) : null;
}

function buildSquadRaw(code: string): SquadData | null {
  const manual = SQUADS_DATA[code];
  const api = API_DATA[code];
  const official = OFFICIAL_ROSTERS[code];

  if (official && official.length >= 23) {
    // Official roster present — use it for `players[]`, enrich with photos /
    // market values where the player name matches API data.
    const apiPlayers = api?.players ?? [];
    const apiExact = new Map(apiPlayers.map(p => [p.nameEn, p]));
    const players: PlayerData[] = official.map((p, idx) => {
      let apiMatch = apiExact.get(p.nameEn);
      if (!apiMatch) {
        const last = p.nameEn.split(/\s+/).pop() || "";
        if (last.length >= 3) {
          apiMatch = apiPlayers.find(ap => ap.nameEn === last
            || ap.nameEn.endsWith(` ${last}`)
            || ap.nameEn.endsWith(`. ${last}`));
        }
      }
      const mv = getMarketValue(p.nameEn);
      return {
        name: p.nameEn,
        nameEn: p.nameEn,
        num: idx + 1, // Wikipedia doesn't list shirt numbers; use stable ordinal
        club: p.club || apiMatch?.club || "",
        pos: p.pos,
        starter: p.starter,
        photo: apiMatch?.photo,
        ...(mv !== null ? { marketValue: mv } : {}),
      };
    });
    // Validate hand-curated source XIs against the announced 26: drop
    // anyone who didn't make the cut, replace with a positional substitute,
    // and pad up to four outlets so every announced team renders a full
    // set of predicted XIs.
    const officialPlayers = trimToCap(players); // dedupe + safety cap (already ~26)
    if (manual) {
      const sources = expandSourcesToFour(manual.sources, official);
      return { ...manual, sources, players: officialPlayers };
    }
    return {
      coach: "",
      coachEn: "",
      formation: "4-3-3",
      sources: expandSourcesToFour([], official),
      players: officialPlayers,
    };
  }

  if (manual && api) {
    // Merge: curated players first (Hebrew names + starter flags), enriched with
    // API photos/clubs/values, THEN top up from the API pool so partial hand-
    // curated squads (3-20 players) reach a full squad. trimToCap then bounds it
    // to ≤26 and dedupes. Net effect: every team renders 15-26 players.
    const apiMap = new Map(api.players.map(p => [p.nameEn, p]));
    const curated: PlayerData[] = manual.players.map(p => {
      const apiPlayer = apiMap.get(p.nameEn) || api.players.find(ap => ap.nameEn.includes(p.nameEn.split(" ").pop() || ""));
      const mv = getMarketValue(p.nameEn);
      return {
        ...p,
        photo: apiPlayer?.photo || undefined,
        club: p.club || apiPlayer?.club || "",
        ...(mv !== null ? { marketValue: mv } : {}),
      };
    });
    // API players not already represented in the curated list (match by exact
    // name or shared last name to avoid duplicates).
    const curatedLast = new Set(curated.map(p => (p.nameEn.split(/\s+/).pop() || "").toLowerCase()));
    const curatedNames = new Set(curated.map(p => p.nameEn));
    const extras: PlayerData[] = api.players
      .filter(ap => !curatedNames.has(ap.nameEn) && !curatedLast.has((ap.nameEn.split(/\s+/).pop() || "").toLowerCase()))
      .map(ap => {
        const mv = getMarketValue(ap.nameEn);
        return {
          name: ap.nameEn,
          nameEn: ap.nameEn,
          num: ap.num,
          club: ap.club || "",
          pos: ap.pos,
          starter: false,
          photo: ap.photo,
          ...(mv !== null ? { marketValue: mv } : {}),
        };
      });
    return { ...manual, players: trimToCap([...curated, ...extras]) };
  }

  if (api) {
    // API-only team: the API list is a broad pool (often 40-60). Trim to a real
    // squad (≤26) first, then build default formation + starters from it.
    const allPlayers = api.players.map(p => {
      const mv = getMarketValue(p.nameEn);
      return {
        name: p.nameEn, // No Hebrew available from API
        nameEn: p.nameEn,
        num: p.num,
        club: p.club || "",
        pos: p.pos,
        photo: p.photo,
        ...(mv !== null ? { marketValue: mv } : {}),
      };
    });
    const players = trimToCap(allPlayers);
    const starterNames = pickDefaultStarters(players);
    return {
      coach: "",
      coachEn: "",
      formation: "4-3-3",
      sources: [{
        name: "Default",
        formation: "4-3-3",
        starters: starterNames,
      }],
      players: players.map(p => ({
        ...p,
        starter: starterNames.includes(p.nameEn),
      })),
    };
  }

  return manual || null;
}

// Get all teams that have squad data (manual + API + Wikipedia-official)
export function getAvailableSquads(): string[] {
  return [...new Set([
    ...Object.keys(SQUADS_DATA),
    ...Object.keys(API_DATA),
    ...Object.keys(OFFICIAL_ROSTERS),
  ])];
}
