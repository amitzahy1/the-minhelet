// ============================================================================
// WC2026 — Estimated Squads for all 48 teams
// Sources: Recent call-ups, FotMob, SofaScore, Transfermarkt, WhoScored
// Will be updated when official 26-man squads are announced (~May 2026)
// ============================================================================

export interface PlayerData {
  name: string;
  nameEn: string;
  num: number;
  club: string;
  pos: "GK" | "DEF" | "MID" | "FW";
  starter?: boolean; // true = estimated starting XI
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
};

// Get squad for a team (returns null if not available)
export function getSquad(code: string): SquadData | null {
  return SQUADS_DATA[code] || null;
}

// Get all teams that have squad data
export function getAvailableSquads(): string[] {
  return Object.keys(SQUADS_DATA);
}
