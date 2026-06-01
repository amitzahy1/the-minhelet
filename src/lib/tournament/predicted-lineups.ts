// ============================================================================
// WC2026 — RotoWire predicted starting XIs (auto-generated).
// Source: twitter/a (RotoWire "Predicted & Confirmed Starting XI for Every Match").
// Regenerate: npx tsx scripts/import-rotowire-lineups.ts
// LAST_SYNC: 2026-06-01T09:51:30.561Z
// ============================================================================

export type PredictedPos = "GK" | "DEF" | "MID" | "FW";
export interface PredictedStarter { name: string; pos: PredictedPos; doubtful?: boolean }
export interface PredictedLineup { formation: string; starters: PredictedStarter[] }

export const PREDICTED_LINEUPS: Record<string, PredictedLineup> = {
  "MEX": {
    "formation": "4-5-1",
    "starters": [
      {
        "name": "Jose Rangel",
        "pos": "GK"
      },
      {
        "name": "J. Gallardo",
        "pos": "DEF"
      },
      {
        "name": "Cesar Montes",
        "pos": "DEF",
        "doubtful": true
      },
      {
        "name": "J. Vasquez",
        "pos": "DEF"
      },
      {
        "name": "J. Sanchez",
        "pos": "DEF"
      },
      {
        "name": "Erik Lira",
        "pos": "MID"
      },
      {
        "name": "Julian Quinones",
        "pos": "MID"
      },
      {
        "name": "A. Fidalgo",
        "pos": "MID"
      },
      {
        "name": "Gilberto Mora",
        "pos": "MID"
      },
      {
        "name": "R. Alvarado",
        "pos": "MID"
      },
      {
        "name": "Raul Jimenez",
        "pos": "FW"
      }
    ]
  },
  "RSA": {
    "formation": "4-5-1",
    "starters": [
      {
        "name": "R. Williams",
        "pos": "GK"
      },
      {
        "name": "A. Modiba",
        "pos": "DEF"
      },
      {
        "name": "M. Mbokazi",
        "pos": "DEF"
      },
      {
        "name": "Ime Okon",
        "pos": "DEF"
      },
      {
        "name": "K. Mudau",
        "pos": "DEF"
      },
      {
        "name": "T. Mbatha",
        "pos": "MID"
      },
      {
        "name": "T. Mokoena",
        "pos": "MID"
      },
      {
        "name": "T. Moremi",
        "pos": "MID"
      },
      {
        "name": "R. Mofokeng",
        "pos": "MID"
      },
      {
        "name": "O. Appollis",
        "pos": "MID"
      },
      {
        "name": "Lyle Foster",
        "pos": "FW"
      }
    ]
  },
  "KOR": {
    "formation": "3-6-1",
    "starters": [
      {
        "name": "K. Seung-gyu",
        "pos": "GK"
      },
      {
        "name": "Kim Min-Jae",
        "pos": "DEF",
        "doubtful": true
      },
      {
        "name": "Lee Han-Beom",
        "pos": "DEF"
      },
      {
        "name": "T. Kim",
        "pos": "DEF"
      },
      {
        "name": "Tae-Seok Lee",
        "pos": "MID"
      },
      {
        "name": "Kim Jin-Gyu",
        "pos": "MID"
      },
      {
        "name": "H. In-beom",
        "pos": "MID",
        "doubtful": true
      },
      {
        "name": "Seol Young-Woo",
        "pos": "MID"
      },
      {
        "name": "Lee Kang-in",
        "pos": "MID"
      },
      {
        "name": "Son Heung-Min",
        "pos": "MID"
      },
      {
        "name": "Hwang Hee-Chan",
        "pos": "FW"
      }
    ]
  },
  "CZE": {
    "formation": "3-6-1",
    "starters": [
      {
        "name": "Matej Kovar",
        "pos": "GK"
      },
      {
        "name": "L. Krejci",
        "pos": "DEF"
      },
      {
        "name": "Robin Hranac",
        "pos": "DEF"
      },
      {
        "name": "S. Chaloupek",
        "pos": "DEF"
      },
      {
        "name": "D. Jurasek",
        "pos": "MID"
      },
      {
        "name": "Tomas Soucek",
        "pos": "MID"
      },
      {
        "name": "V. Darida",
        "pos": "MID"
      },
      {
        "name": "V. Coufal",
        "pos": "MID"
      },
      {
        "name": "Lukas Provod",
        "pos": "MID"
      },
      {
        "name": "Pavel Sulc",
        "pos": "MID"
      },
      {
        "name": "P. Schick",
        "pos": "FW"
      }
    ]
  },
  "CAN": {
    "formation": "4-4-2",
    "starters": [
      {
        "name": "D. St. Clair",
        "pos": "GK"
      },
      {
        "name": "R. Laryea",
        "pos": "DEF",
        "doubtful": true
      },
      {
        "name": "M. Bombito",
        "pos": "DEF",
        "doubtful": true
      },
      {
        "name": "D. Cornelius",
        "pos": "DEF"
      },
      {
        "name": "A. Johnston",
        "pos": "DEF"
      },
      {
        "name": "Ali Ahmed",
        "pos": "MID",
        "doubtful": true
      },
      {
        "name": "Ismael Kone",
        "pos": "MID"
      },
      {
        "name": "S. Eustaquio",
        "pos": "MID"
      },
      {
        "name": "T. Buchanan",
        "pos": "MID"
      },
      {
        "name": "J. David",
        "pos": "FW"
      },
      {
        "name": "Cyle Larin",
        "pos": "FW"
      }
    ]
  },
  "BIH": {
    "formation": "4-4-2",
    "starters": [
      {
        "name": "N. Vasilj",
        "pos": "GK"
      },
      {
        "name": "S. Kolasinac",
        "pos": "DEF"
      },
      {
        "name": "Nikola Katic",
        "pos": "DEF"
      },
      {
        "name": "T. Muharemovic",
        "pos": "DEF"
      },
      {
        "name": "Amar Dedic",
        "pos": "DEF"
      },
      {
        "name": "Amar Memic",
        "pos": "MID"
      },
      {
        "name": "B. Tahirovic",
        "pos": "MID"
      },
      {
        "name": "Ivan Sunjic",
        "pos": "MID",
        "doubtful": true
      },
      {
        "name": "E. Bajraktarevic",
        "pos": "MID"
      },
      {
        "name": "E. Demirovic",
        "pos": "FW"
      },
      {
        "name": "Edin Dzeko",
        "pos": "FW"
      }
    ]
  },
  "USA": {
    "formation": "3-6-1",
    "starters": [
      {
        "name": "Matt Freese",
        "pos": "GK"
      },
      {
        "name": "M. McKenzie",
        "pos": "DEF"
      },
      {
        "name": "C. Richards",
        "pos": "DEF",
        "doubtful": true
      },
      {
        "name": "A. Trusty",
        "pos": "DEF"
      },
      {
        "name": "A. Robinson",
        "pos": "MID"
      },
      {
        "name": "W. McKennie",
        "pos": "MID"
      },
      {
        "name": "Tyler Adams",
        "pos": "MID"
      },
      {
        "name": "Timothy Weah",
        "pos": "MID"
      },
      {
        "name": "M. Tillman",
        "pos": "MID"
      },
      {
        "name": "C. Pulisic",
        "pos": "MID"
      },
      {
        "name": "F. Balogun",
        "pos": "FW"
      }
    ]
  },
  "PAR": {
    "formation": "4-5-1",
    "starters": [
      {
        "name": "Gatito Fernández",
        "pos": "GK"
      },
      {
        "name": "J. Alonso",
        "pos": "DEF"
      },
      {
        "name": "Gustavo Gómez",
        "pos": "DEF"
      },
      {
        "name": "Omar Alderete",
        "pos": "DEF"
      },
      {
        "name": "J. Caceres",
        "pos": "DEF"
      },
      {
        "name": "D. Bobadilla",
        "pos": "MID"
      },
      {
        "name": "Andres Cubas",
        "pos": "MID"
      },
      {
        "name": "M. Almiron",
        "pos": "MID"
      },
      {
        "name": "Diego Gomez",
        "pos": "MID"
      },
      {
        "name": "Julio Enciso",
        "pos": "MID"
      },
      {
        "name": "A. Sanabria",
        "pos": "FW",
        "doubtful": true
      }
    ]
  },
  "QAT": {
    "formation": "4-3-3",
    "starters": [
      {
        "name": "Meshaal Barsham",
        "pos": "GK"
      },
      {
        "name": "S. Al-Brake",
        "pos": "DEF"
      },
      {
        "name": "Boualem Khoukhi",
        "pos": "DEF"
      },
      {
        "name": "L. Mendes",
        "pos": "DEF"
      },
      {
        "name": "Pedro Miguel",
        "pos": "DEF"
      },
      {
        "name": "Assim Madibo",
        "pos": "MID"
      },
      {
        "name": "Karim Boudiaf",
        "pos": "MID"
      },
      {
        "name": "M. Al Mannai",
        "pos": "MID"
      },
      {
        "name": "Akram Afif",
        "pos": "FW"
      },
      {
        "name": "Edmilson Junior",
        "pos": "FW"
      },
      {
        "name": "Almoez Ali",
        "pos": "FW"
      }
    ]
  },
  "SUI": {
    "formation": "4-5-1",
    "starters": [
      {
        "name": "Gregor Kobel",
        "pos": "GK"
      },
      {
        "name": "R. Rodriguez",
        "pos": "DEF"
      },
      {
        "name": "Nico Elvedi",
        "pos": "DEF"
      },
      {
        "name": "M. Akanji",
        "pos": "DEF"
      },
      {
        "name": "S. Widmer",
        "pos": "DEF"
      },
      {
        "name": "Remo Freuler",
        "pos": "MID"
      },
      {
        "name": "Granit Xhaka",
        "pos": "MID"
      },
      {
        "name": "Dan Ndoye",
        "pos": "MID"
      },
      {
        "name": "F. Rieder",
        "pos": "MID"
      },
      {
        "name": "Ruben Vargas",
        "pos": "MID"
      },
      {
        "name": "Breel Embolo",
        "pos": "FW"
      }
    ]
  },
  "BRA": {
    "formation": "4-4-2",
    "starters": [
      {
        "name": "Alisson",
        "pos": "GK"
      },
      {
        "name": "Alex Sandro",
        "pos": "DEF"
      },
      {
        "name": "Gabriel",
        "pos": "DEF"
      },
      {
        "name": "Marquinhos",
        "pos": "DEF"
      },
      {
        "name": "Wesley",
        "pos": "DEF"
      },
      {
        "name": "G. Martinelli",
        "pos": "MID"
      },
      {
        "name": "Bruno Guimaraes",
        "pos": "MID"
      },
      {
        "name": "Casemiro",
        "pos": "MID"
      },
      {
        "name": "Raphinha",
        "pos": "MID"
      },
      {
        "name": "Vinicius Junior",
        "pos": "FW"
      },
      {
        "name": "Matheus Cunha",
        "pos": "FW"
      }
    ]
  },
  "MAR": {
    "formation": "4-3-3",
    "starters": [
      {
        "name": "Bono",
        "pos": "GK"
      },
      {
        "name": "N. Mazraoui",
        "pos": "DEF"
      },
      {
        "name": "Nayef Aguerd",
        "pos": "DEF",
        "doubtful": true
      },
      {
        "name": "Issa Diop",
        "pos": "DEF"
      },
      {
        "name": "A. Hakimi",
        "pos": "DEF"
      },
      {
        "name": "I. Saibari",
        "pos": "MID"
      },
      {
        "name": "N. El Aynaoui",
        "pos": "MID"
      },
      {
        "name": "B. El Khannouss",
        "pos": "MID"
      },
      {
        "name": "Ez Abde",
        "pos": "FW"
      },
      {
        "name": "Brahim Diaz",
        "pos": "FW"
      },
      {
        "name": "A. El Kaabi",
        "pos": "FW"
      }
    ]
  },
  "HAI": {
    "formation": "4-5-1",
    "starters": [
      {
        "name": "J. Placide",
        "pos": "GK",
        "doubtful": true
      },
      {
        "name": "Duke Lacroix",
        "pos": "DEF"
      },
      {
        "name": "H. Delcroix",
        "pos": "DEF"
      },
      {
        "name": "Ricardo Ade",
        "pos": "DEF"
      },
      {
        "name": "C. Arcus",
        "pos": "DEF"
      },
      {
        "name": "J. Bellegarde",
        "pos": "MID"
      },
      {
        "name": "L. Pierre",
        "pos": "MID"
      },
      {
        "name": "R. Providence",
        "pos": "MID"
      },
      {
        "name": "J. Casimir",
        "pos": "MID"
      },
      {
        "name": "L. Deedson",
        "pos": "MID"
      },
      {
        "name": "W. Isidor",
        "pos": "FW"
      }
    ]
  },
  "SCO": {
    "formation": "4-5-1",
    "starters": [
      {
        "name": "Angus Gunn",
        "pos": "GK"
      },
      {
        "name": "A. Robertson",
        "pos": "DEF"
      },
      {
        "name": "S. McKenna",
        "pos": "DEF"
      },
      {
        "name": "John Souttar",
        "pos": "DEF"
      },
      {
        "name": "Aaron Hickey",
        "pos": "DEF"
      },
      {
        "name": "Kenny McLean",
        "pos": "MID"
      },
      {
        "name": "R. Christie",
        "pos": "MID"
      },
      {
        "name": "John McGinn",
        "pos": "MID"
      },
      {
        "name": "S. McTominay",
        "pos": "MID"
      },
      {
        "name": "B. Gannon Doak",
        "pos": "MID"
      },
      {
        "name": "Che Adams",
        "pos": "FW"
      }
    ]
  },
  "AUS": {
    "formation": "3-6-1",
    "starters": [
      {
        "name": "Mathew Ryan",
        "pos": "GK"
      },
      {
        "name": "H. Souttar",
        "pos": "DEF"
      },
      {
        "name": "C. Burgess",
        "pos": "DEF"
      },
      {
        "name": "A. Circati",
        "pos": "DEF"
      },
      {
        "name": "Jordan Bos",
        "pos": "MID"
      },
      {
        "name": "J. Irvine",
        "pos": "MID"
      },
      {
        "name": "C. Metcalfe",
        "pos": "MID"
      },
      {
        "name": "J. Italiano",
        "pos": "MID"
      },
      {
        "name": "Martin Boyle",
        "pos": "MID"
      },
      {
        "name": "N. Irankunda",
        "pos": "MID"
      },
      {
        "name": "M. Toure",
        "pos": "FW"
      }
    ]
  },
  "TUR": {
    "formation": "4-5-1",
    "starters": [
      {
        "name": "U. Cakir",
        "pos": "GK"
      },
      {
        "name": "F. Kadioglu",
        "pos": "DEF"
      },
      {
        "name": "M. Demiral",
        "pos": "DEF"
      },
      {
        "name": "A. Bardakci",
        "pos": "DEF"
      },
      {
        "name": "Zeki Celik",
        "pos": "DEF"
      },
      {
        "name": "H. Calhanoglu",
        "pos": "MID",
        "doubtful": true
      },
      {
        "name": "I. Yuksek",
        "pos": "MID"
      },
      {
        "name": "Kenan Yildiz",
        "pos": "MID",
        "doubtful": true
      },
      {
        "name": "Arda Guler",
        "pos": "MID"
      },
      {
        "name": "Baris Yilmaz",
        "pos": "MID"
      },
      {
        "name": "Kerem Akturkoglu",
        "pos": "FW",
        "doubtful": true
      }
    ]
  },
  "GER": {
    "formation": "4-5-1",
    "starters": [
      {
        "name": "Manuel Neuer",
        "pos": "GK",
        "doubtful": true
      },
      {
        "name": "David Raum",
        "pos": "DEF",
        "doubtful": true
      },
      {
        "name": "N. Schlotterbeck",
        "pos": "DEF"
      },
      {
        "name": "Jonathan Tah",
        "pos": "DEF"
      },
      {
        "name": "J. Kimmich",
        "pos": "DEF"
      },
      {
        "name": "L. Goretzka",
        "pos": "MID"
      },
      {
        "name": "A. Pavlovic",
        "pos": "MID"
      },
      {
        "name": "F. Wirtz",
        "pos": "MID"
      },
      {
        "name": "J. Musiala",
        "pos": "MID"
      },
      {
        "name": "Leroy Sane",
        "pos": "MID"
      },
      {
        "name": "Kai Havertz",
        "pos": "FW"
      }
    ]
  },
  "CUR": {
    "formation": "4-3-3",
    "starters": [
      {
        "name": "Eloy Room",
        "pos": "GK"
      },
      {
        "name": "S. Floranus",
        "pos": "DEF"
      },
      {
        "name": "A. Obispo",
        "pos": "DEF"
      },
      {
        "name": "Jurien Gaari",
        "pos": "DEF"
      },
      {
        "name": "S. Sambo",
        "pos": "DEF"
      },
      {
        "name": "J. Bacuna",
        "pos": "MID"
      },
      {
        "name": "L. Comenencia",
        "pos": "MID"
      },
      {
        "name": "L. Bacuna",
        "pos": "MID"
      },
      {
        "name": "Kenji Gorre",
        "pos": "FW",
        "doubtful": true
      },
      {
        "name": "J. Antonisse",
        "pos": "FW"
      },
      {
        "name": "G. Kastaneer",
        "pos": "FW"
      }
    ]
  },
  "NED": {
    "formation": "4-5-1",
    "starters": [
      {
        "name": "B. Verbruggen",
        "pos": "GK"
      },
      {
        "name": "M. van de Ven",
        "pos": "DEF"
      },
      {
        "name": "V. van Dijk",
        "pos": "DEF"
      },
      {
        "name": "Nathan Ake",
        "pos": "DEF"
      },
      {
        "name": "D. Dumfries",
        "pos": "DEF"
      },
      {
        "name": "F. de Jong",
        "pos": "MID"
      },
      {
        "name": "R. Gravenberch",
        "pos": "MID"
      },
      {
        "name": "Cody Gakpo",
        "pos": "MID"
      },
      {
        "name": "T. Reijnders",
        "pos": "MID"
      },
      {
        "name": "D. Malen",
        "pos": "MID"
      },
      {
        "name": "M. Depay",
        "pos": "FW"
      }
    ]
  },
  "JPN": {
    "formation": "3-6-1",
    "starters": [
      {
        "name": "Zion Suzuki",
        "pos": "GK"
      },
      {
        "name": "Hiroki Ito",
        "pos": "DEF"
      },
      {
        "name": "Ko Itakura",
        "pos": "DEF"
      },
      {
        "name": "S. Taniguchi",
        "pos": "DEF"
      },
      {
        "name": "K. Nakamura",
        "pos": "MID"
      },
      {
        "name": "Kaishu Sano",
        "pos": "MID"
      },
      {
        "name": "D. Kamada",
        "pos": "MID"
      },
      {
        "name": "Ritsu Doan",
        "pos": "MID"
      },
      {
        "name": "Junya Ito",
        "pos": "MID"
      },
      {
        "name": "T. Kubo",
        "pos": "MID"
      },
      {
        "name": "Ayase Ueda",
        "pos": "FW"
      }
    ]
  },
  "CIV": {
    "formation": "4-3-3",
    "starters": [
      {
        "name": "Yahia Fofana",
        "pos": "GK"
      },
      {
        "name": "G. Konan",
        "pos": "DEF"
      },
      {
        "name": "E. Agbadou",
        "pos": "DEF"
      },
      {
        "name": "O. Kossounou",
        "pos": "DEF",
        "doubtful": true
      },
      {
        "name": "Guela Doue",
        "pos": "DEF"
      },
      {
        "name": "Seko Fofana",
        "pos": "MID"
      },
      {
        "name": "F. Kessie",
        "pos": "MID"
      },
      {
        "name": "I. Sangare",
        "pos": "MID"
      },
      {
        "name": "Yan Diomande",
        "pos": "FW"
      },
      {
        "name": "Amad Diallo",
        "pos": "FW"
      },
      {
        "name": "E. Guessand",
        "pos": "FW"
      }
    ]
  },
  "ECU": {
    "formation": "4-4-2",
    "starters": [
      {
        "name": "H. Galindez",
        "pos": "GK"
      },
      {
        "name": "P. Estupinan",
        "pos": "DEF"
      },
      {
        "name": "Willian Pacho",
        "pos": "DEF"
      },
      {
        "name": "P. Hincapie",
        "pos": "DEF"
      },
      {
        "name": "Joel Ordonez",
        "pos": "DEF"
      },
      {
        "name": "Nilson Angulo",
        "pos": "MID"
      },
      {
        "name": "M. Caicedo",
        "pos": "MID"
      },
      {
        "name": "Pedro Vite",
        "pos": "MID"
      },
      {
        "name": "Alan Franco",
        "pos": "MID"
      },
      {
        "name": "G. Plata",
        "pos": "FW"
      },
      {
        "name": "E. Valencia",
        "pos": "FW"
      }
    ]
  },
  "SWE": {
    "formation": "3-4-3",
    "starters": [
      {
        "name": "K. Nordfeldt",
        "pos": "GK"
      },
      {
        "name": "V. Lindelof",
        "pos": "DEF"
      },
      {
        "name": "Isak Hien",
        "pos": "DEF"
      },
      {
        "name": "G. Lagerbielke",
        "pos": "DEF"
      },
      {
        "name": "G. Gudmundsson",
        "pos": "MID",
        "doubtful": true
      },
      {
        "name": "Yasin Ayari",
        "pos": "MID"
      },
      {
        "name": "J. Karlstrom",
        "pos": "MID"
      },
      {
        "name": "D. Svensson",
        "pos": "MID"
      },
      {
        "name": "A. Isak",
        "pos": "FW"
      },
      {
        "name": "A. Elanga",
        "pos": "FW"
      },
      {
        "name": "V. Gyokeres",
        "pos": "FW"
      }
    ]
  },
  "TUN": {
    "formation": "4-5-1",
    "starters": [
      {
        "name": "Aymen Dahmen",
        "pos": "GK"
      },
      {
        "name": "Ali El Abdi",
        "pos": "DEF"
      },
      {
        "name": "M. Talbi",
        "pos": "DEF"
      },
      {
        "name": "Dylan Bronn",
        "pos": "DEF",
        "doubtful": true
      },
      {
        "name": "Yan Valery",
        "pos": "DEF"
      },
      {
        "name": "E. Skhiri",
        "pos": "MID"
      },
      {
        "name": "Rani Khedira",
        "pos": "MID"
      },
      {
        "name": "A. Ben Slimane",
        "pos": "MID"
      },
      {
        "name": "Hannibal",
        "pos": "MID"
      },
      {
        "name": "E. Achouri",
        "pos": "MID"
      },
      {
        "name": "Elias Saad",
        "pos": "FW"
      }
    ]
  },
  "ESP": {
    "formation": "4-3-3",
    "starters": [
      {
        "name": "Unai Simon",
        "pos": "GK"
      },
      {
        "name": "M. Cucurella",
        "pos": "DEF"
      },
      {
        "name": "Pau Cubarsi",
        "pos": "DEF"
      },
      {
        "name": "A. Laporte",
        "pos": "DEF"
      },
      {
        "name": "Pedro Porro",
        "pos": "DEF"
      },
      {
        "name": "Rodri",
        "pos": "MID"
      },
      {
        "name": "Pedri",
        "pos": "MID"
      },
      {
        "name": "Fabian Ruiz",
        "pos": "MID"
      },
      {
        "name": "Dani Olmo",
        "pos": "FW"
      },
      {
        "name": "F. Torres",
        "pos": "FW"
      },
      {
        "name": "M. Oyarzabal",
        "pos": "FW"
      }
    ]
  },
  "CPV": {
    "formation": "4-5-1",
    "starters": [
      {
        "name": "Vozinha",
        "pos": "GK"
      },
      {
        "name": "Joao Paulo",
        "pos": "DEF"
      },
      {
        "name": "Logan Costa",
        "pos": "DEF"
      },
      {
        "name": "Pico",
        "pos": "DEF"
      },
      {
        "name": "S. Moreira",
        "pos": "DEF"
      },
      {
        "name": "Y. Semedo",
        "pos": "MID"
      },
      {
        "name": "Kevin Pina",
        "pos": "MID"
      },
      {
        "name": "Willy Semedo",
        "pos": "MID"
      },
      {
        "name": "J. Monteiro",
        "pos": "MID"
      },
      {
        "name": "Ryan Mendes",
        "pos": "MID"
      },
      {
        "name": "Dailon Livramento",
        "pos": "FW"
      }
    ]
  },
  "BEL": {
    "formation": "4-5-1",
    "starters": [
      {
        "name": "T. Courtois",
        "pos": "GK"
      },
      {
        "name": "M. De Cuyper",
        "pos": "DEF"
      },
      {
        "name": "K. De Winter",
        "pos": "DEF"
      },
      {
        "name": "A. Theate",
        "pos": "DEF"
      },
      {
        "name": "T. Meunier",
        "pos": "DEF"
      },
      {
        "name": "Y. Tielemans",
        "pos": "MID"
      },
      {
        "name": "Amadou Onana",
        "pos": "MID"
      },
      {
        "name": "Jeremy Doku",
        "pos": "MID"
      },
      {
        "name": "K. De Bruyne",
        "pos": "MID"
      },
      {
        "name": "L. Trossard",
        "pos": "MID"
      },
      {
        "name": "C. De Ketelaere",
        "pos": "FW"
      }
    ]
  },
  "EGY": {
    "formation": "4-5-1",
    "starters": [
      {
        "name": "M. Mohamed Shobeir",
        "pos": "GK"
      },
      {
        "name": "Ahmed El Fotouh",
        "pos": "DEF"
      },
      {
        "name": "Y. El Hanafi",
        "pos": "DEF"
      },
      {
        "name": "M. Abdelmonem",
        "pos": "DEF"
      },
      {
        "name": "M. Eldemerdash",
        "pos": "DEF"
      },
      {
        "name": "H. Abdel Fattah",
        "pos": "MID"
      },
      {
        "name": "M. Ghallab",
        "pos": "MID"
      },
      {
        "name": "Trezeguet",
        "pos": "MID"
      },
      {
        "name": "Emam Ashour",
        "pos": "MID"
      },
      {
        "name": "M. Salah",
        "pos": "MID"
      },
      {
        "name": "O. Marmoush",
        "pos": "FW"
      }
    ]
  },
  "KSA": {
    "formation": "4-3-3",
    "starters": [
      {
        "name": "N. Al Aqidi",
        "pos": "GK"
      },
      {
        "name": "N. Boushal",
        "pos": "DEF"
      },
      {
        "name": "Ali Lajami",
        "pos": "DEF"
      },
      {
        "name": "H. Tambakti",
        "pos": "DEF"
      },
      {
        "name": "S. Abdulhamid",
        "pos": "DEF"
      },
      {
        "name": "Musab Al-Juwayr",
        "pos": "MID"
      },
      {
        "name": "M. Kanno",
        "pos": "MID"
      },
      {
        "name": "A. Al-Khaibari",
        "pos": "MID"
      },
      {
        "name": "S. Al-Dawsari",
        "pos": "FW"
      },
      {
        "name": "Nasser Al Dawsari",
        "pos": "FW"
      },
      {
        "name": "F. Al Buraikan",
        "pos": "FW"
      }
    ]
  },
  "URU": {
    "formation": "4-5-1",
    "starters": [
      {
        "name": "F. Muslera",
        "pos": "GK"
      },
      {
        "name": "M. Olivera",
        "pos": "DEF"
      },
      {
        "name": "R. Araujo",
        "pos": "DEF"
      },
      {
        "name": "J. Gimenez",
        "pos": "DEF",
        "doubtful": true
      },
      {
        "name": "G. Varela",
        "pos": "DEF"
      },
      {
        "name": "Maxi Araujo",
        "pos": "MID"
      },
      {
        "name": "R. Bentancur",
        "pos": "MID"
      },
      {
        "name": "M. Ugarte",
        "pos": "MID"
      },
      {
        "name": "F. Valverde",
        "pos": "MID"
      },
      {
        "name": "G. De Arrascaeta",
        "pos": "MID",
        "doubtful": true
      },
      {
        "name": "Darwin Nunez",
        "pos": "FW"
      }
    ]
  },
  "IRN": {
    "formation": "4-3-3",
    "starters": [
      {
        "name": "A. Beiranvand",
        "pos": "GK"
      },
      {
        "name": "M. Mohammadi",
        "pos": "DEF"
      },
      {
        "name": "S. Khalilzadeh",
        "pos": "DEF"
      },
      {
        "name": "Ali Nemati",
        "pos": "DEF"
      },
      {
        "name": "Arya Yousefi",
        "pos": "DEF"
      },
      {
        "name": "M. Mohebi",
        "pos": "MID"
      },
      {
        "name": "S. Ghoddos",
        "pos": "MID"
      },
      {
        "name": "S. Ezatolahi",
        "pos": "MID"
      },
      {
        "name": "A. Hosseinzadeh",
        "pos": "FW"
      },
      {
        "name": "M. Ghayedi",
        "pos": "FW"
      },
      {
        "name": "Mehdi Taremi",
        "pos": "FW"
      }
    ]
  },
  "NZL": {
    "formation": "4-5-1",
    "starters": [
      {
        "name": "M. Crocombe",
        "pos": "GK"
      },
      {
        "name": "Benjamin Old",
        "pos": "DEF",
        "doubtful": true
      },
      {
        "name": "Tyler Bindon",
        "pos": "DEF"
      },
      {
        "name": "M. Boxall",
        "pos": "DEF"
      },
      {
        "name": "L. Cacace",
        "pos": "DEF"
      },
      {
        "name": "Marko Stamenic",
        "pos": "MID"
      },
      {
        "name": "Joe Bell",
        "pos": "MID"
      },
      {
        "name": "S. Singh",
        "pos": "MID"
      },
      {
        "name": "M. Garbett",
        "pos": "MID"
      },
      {
        "name": "Elijah Just",
        "pos": "MID"
      },
      {
        "name": "Chris Wood",
        "pos": "FW"
      }
    ]
  },
  "FRA": {
    "formation": "4-5-1",
    "starters": [
      {
        "name": "Mike Maignan",
        "pos": "GK"
      },
      {
        "name": "T. Hernandez",
        "pos": "DEF"
      },
      {
        "name": "D. Upamecano",
        "pos": "DEF"
      },
      {
        "name": "W. Saliba",
        "pos": "DEF"
      },
      {
        "name": "Jules Kounde",
        "pos": "DEF"
      },
      {
        "name": "A. Tchouameni",
        "pos": "MID"
      },
      {
        "name": "A. Rabiot",
        "pos": "MID"
      },
      {
        "name": "Desire Doue",
        "pos": "MID"
      },
      {
        "name": "O. Dembele",
        "pos": "MID"
      },
      {
        "name": "M. Olise",
        "pos": "MID"
      },
      {
        "name": "K. Mbappe",
        "pos": "FW"
      }
    ]
  },
  "SEN": {
    "formation": "4-3-3",
    "starters": [
      {
        "name": "E. Mendy",
        "pos": "GK"
      },
      {
        "name": "E. Diouf",
        "pos": "DEF"
      },
      {
        "name": "M. Niakhate",
        "pos": "DEF"
      },
      {
        "name": "K. Koulibaly",
        "pos": "DEF",
        "doubtful": true
      },
      {
        "name": "K. Diatta",
        "pos": "DEF"
      },
      {
        "name": "Pape Gueye",
        "pos": "MID"
      },
      {
        "name": "Habib Diarra",
        "pos": "MID"
      },
      {
        "name": "I. Gueye",
        "pos": "MID",
        "doubtful": true
      },
      {
        "name": "Sadio Mane",
        "pos": "FW"
      },
      {
        "name": "I. Ndiaye",
        "pos": "FW"
      },
      {
        "name": "N. Jackson",
        "pos": "FW"
      }
    ]
  },
  "IRQ": {
    "formation": "4-4-2",
    "starters": [
      {
        "name": "Ahmed Basil",
        "pos": "GK"
      },
      {
        "name": "Merchas Doski",
        "pos": "DEF"
      },
      {
        "name": "Zaid Tahseen",
        "pos": "DEF"
      },
      {
        "name": "Akam Hashem",
        "pos": "DEF"
      },
      {
        "name": "Hussein Ali",
        "pos": "DEF"
      },
      {
        "name": "Ibrahim Bayesh",
        "pos": "MID"
      },
      {
        "name": "Amir Al-Ammari",
        "pos": "MID"
      },
      {
        "name": "Z. Iqbal",
        "pos": "MID"
      },
      {
        "name": "Youssef Amyn",
        "pos": "MID",
        "doubtful": true
      },
      {
        "name": "Ali Al Hamadi",
        "pos": "FW"
      },
      {
        "name": "Aymen Hussein",
        "pos": "FW"
      }
    ]
  },
  "NOR": {
    "formation": "4-3-3",
    "starters": [
      {
        "name": "Orjan Nyland",
        "pos": "GK"
      },
      {
        "name": "D. Moller Wolfe",
        "pos": "DEF"
      },
      {
        "name": "Leo Ostigard",
        "pos": "DEF",
        "doubtful": true
      },
      {
        "name": "K. Ajer",
        "pos": "DEF"
      },
      {
        "name": "J. Ryerson",
        "pos": "DEF"
      },
      {
        "name": "M. Odegaard",
        "pos": "MID"
      },
      {
        "name": "Sander Berge",
        "pos": "MID"
      },
      {
        "name": "Patrick Berg",
        "pos": "MID"
      },
      {
        "name": "Antonio Nusa",
        "pos": "FW"
      },
      {
        "name": "A. Sorloth",
        "pos": "FW"
      },
      {
        "name": "E. Haaland",
        "pos": "FW"
      }
    ]
  },
  "ARG": {
    "formation": "4-3-3",
    "starters": [
      {
        "name": "E. Martinez",
        "pos": "GK",
        "doubtful": true
      },
      {
        "name": "N. Tagliafico",
        "pos": "DEF"
      },
      {
        "name": "N. Otamendi",
        "pos": "DEF"
      },
      {
        "name": "L. Martinez",
        "pos": "DEF"
      },
      {
        "name": "N. Molina",
        "pos": "DEF",
        "doubtful": true
      },
      {
        "name": "E. Fernandez",
        "pos": "MID"
      },
      {
        "name": "A. Mac Allister",
        "pos": "MID"
      },
      {
        "name": "R. De Paul",
        "pos": "MID"
      },
      {
        "name": "N. Gonzalez",
        "pos": "FW",
        "doubtful": true
      },
      {
        "name": "Lionel Messi",
        "pos": "FW",
        "doubtful": true
      },
      {
        "name": "J. Alvarez",
        "pos": "FW",
        "doubtful": true
      }
    ]
  },
  "ALG": {
    "formation": "4-5-1",
    "starters": [
      {
        "name": "Luca Zidane",
        "pos": "GK",
        "doubtful": true
      },
      {
        "name": "R. Ait-Nouri",
        "pos": "DEF"
      },
      {
        "name": "R. Bensebaini",
        "pos": "DEF",
        "doubtful": true
      },
      {
        "name": "Aissa Mandi",
        "pos": "DEF"
      },
      {
        "name": "R. Belghali",
        "pos": "DEF"
      },
      {
        "name": "Fares Chaibi",
        "pos": "MID"
      },
      {
        "name": "H. Boudaoui",
        "pos": "MID",
        "doubtful": true
      },
      {
        "name": "M. Amoura",
        "pos": "MID"
      },
      {
        "name": "H. Aouar",
        "pos": "MID"
      },
      {
        "name": "Riyad Mahrez",
        "pos": "MID"
      },
      {
        "name": "Amine Gouiri",
        "pos": "FW"
      }
    ]
  },
  "AUT": {
    "formation": "4-5-1",
    "starters": [
      {
        "name": "A. Schlager",
        "pos": "GK"
      },
      {
        "name": "P. Mwene",
        "pos": "DEF"
      },
      {
        "name": "Marco Friedl",
        "pos": "DEF"
      },
      {
        "name": "Kevin Danso",
        "pos": "DEF"
      },
      {
        "name": "K. Laimer",
        "pos": "DEF"
      },
      {
        "name": "X. Schlager",
        "pos": "MID"
      },
      {
        "name": "N. Seiwald",
        "pos": "MID"
      },
      {
        "name": "C. Baumgartner",
        "pos": "MID"
      },
      {
        "name": "M. Sabitzer",
        "pos": "MID"
      },
      {
        "name": "R. Schmid",
        "pos": "MID"
      },
      {
        "name": "M. Arnautovic",
        "pos": "FW"
      }
    ]
  },
  "JOR": {
    "formation": "3-4-3",
    "starters": [
      {
        "name": "Y. Abulaila",
        "pos": "GK"
      },
      {
        "name": "H. Abu Dahab",
        "pos": "DEF"
      },
      {
        "name": "A. Nasib",
        "pos": "DEF"
      },
      {
        "name": "Yazan Al-Arab",
        "pos": "DEF"
      },
      {
        "name": "Mohannad Abu Taha",
        "pos": "MID"
      },
      {
        "name": "N. Al Rashdan",
        "pos": "MID"
      },
      {
        "name": "A. Jamous",
        "pos": "MID"
      },
      {
        "name": "Ahmad Assaf",
        "pos": "MID"
      },
      {
        "name": "Mousa Tamari",
        "pos": "FW"
      },
      {
        "name": "Ali Olwan",
        "pos": "FW",
        "doubtful": true
      },
      {
        "name": "I. Sabra",
        "pos": "FW"
      }
    ]
  },
  "POR": {
    "formation": "4-5-1",
    "starters": [
      {
        "name": "Diogo Costa",
        "pos": "GK"
      },
      {
        "name": "Nuno Mendes",
        "pos": "DEF"
      },
      {
        "name": "Goncalo Inacio",
        "pos": "DEF"
      },
      {
        "name": "Ruben Dias",
        "pos": "DEF"
      },
      {
        "name": "Joao Cancelo",
        "pos": "DEF"
      },
      {
        "name": "Joao Neves",
        "pos": "MID"
      },
      {
        "name": "Vitinha",
        "pos": "MID"
      },
      {
        "name": "Rafael Leao",
        "pos": "MID"
      },
      {
        "name": "Bruno Fernandes",
        "pos": "MID"
      },
      {
        "name": "B. Silva",
        "pos": "MID"
      },
      {
        "name": "C. Ronaldo",
        "pos": "FW"
      }
    ]
  },
  "COD": {
    "formation": "4-4-2",
    "starters": [
      {
        "name": "Lionel Mpasi",
        "pos": "GK"
      },
      {
        "name": "A. Masuaku",
        "pos": "DEF"
      },
      {
        "name": "C. Mbemba",
        "pos": "DEF"
      },
      {
        "name": "A. Tuanzebe",
        "pos": "DEF"
      },
      {
        "name": "A. Wan-Bissaka",
        "pos": "DEF"
      },
      {
        "name": "M. Elia",
        "pos": "MID"
      },
      {
        "name": "S. Moutoussamy",
        "pos": "MID"
      },
      {
        "name": "Noah Sadiki",
        "pos": "MID"
      },
      {
        "name": "N. Mbuku",
        "pos": "MID"
      },
      {
        "name": "Yoane Wissa",
        "pos": "FW"
      },
      {
        "name": "C. Bakambu",
        "pos": "FW"
      }
    ]
  },
  "ENG": {
    "formation": "4-5-1",
    "starters": [
      {
        "name": "J. Pickford",
        "pos": "GK"
      },
      {
        "name": "N. O'Reilly",
        "pos": "DEF"
      },
      {
        "name": "Ezri Konsa",
        "pos": "DEF"
      },
      {
        "name": "Marc Guehi",
        "pos": "DEF"
      },
      {
        "name": "Reece James",
        "pos": "DEF"
      },
      {
        "name": "Declan Rice",
        "pos": "MID"
      },
      {
        "name": "E. Anderson",
        "pos": "MID"
      },
      {
        "name": "M. Rashford",
        "pos": "MID"
      },
      {
        "name": "J. Bellingham",
        "pos": "MID"
      },
      {
        "name": "Bukayo Saka",
        "pos": "MID"
      },
      {
        "name": "Harry Kane",
        "pos": "FW"
      }
    ]
  },
  "CRO": {
    "formation": "4-5-1",
    "starters": [
      {
        "name": "D. Livakovic",
        "pos": "GK"
      },
      {
        "name": "J. Gvardiol",
        "pos": "DEF"
      },
      {
        "name": "D. Caleta-Car",
        "pos": "DEF"
      },
      {
        "name": "L. Vuskovic",
        "pos": "DEF"
      },
      {
        "name": "J. Stanisic",
        "pos": "DEF"
      },
      {
        "name": "Luka Modric",
        "pos": "MID"
      },
      {
        "name": "M. Kovacic",
        "pos": "MID"
      },
      {
        "name": "Ivan Perisic",
        "pos": "MID"
      },
      {
        "name": "A. Kramaric",
        "pos": "MID"
      },
      {
        "name": "M. Pasalic",
        "pos": "MID"
      },
      {
        "name": "Ante Budimir",
        "pos": "FW"
      }
    ]
  },
  "GHA": {
    "formation": "3-6-1",
    "starters": [
      {
        "name": "B. Asare",
        "pos": "GK"
      },
      {
        "name": "J. Adjetey",
        "pos": "DEF"
      },
      {
        "name": "A. Djiku",
        "pos": "DEF"
      },
      {
        "name": "Jerome Opoku",
        "pos": "DEF"
      },
      {
        "name": "G. Mensah",
        "pos": "MID"
      },
      {
        "name": "T. Partey",
        "pos": "MID"
      },
      {
        "name": "Kwasi Sibo",
        "pos": "MID"
      },
      {
        "name": "C. Yirenkyi",
        "pos": "MID"
      },
      {
        "name": "A. Semenyo",
        "pos": "MID"
      },
      {
        "name": "Jordan Ayew",
        "pos": "MID"
      },
      {
        "name": "I. Williams",
        "pos": "FW"
      }
    ]
  },
  "PAN": {
    "formation": "3-6-1",
    "starters": [
      {
        "name": "O. Mosquera",
        "pos": "GK"
      },
      {
        "name": "A. Andrade Cedeno",
        "pos": "DEF"
      },
      {
        "name": "Carlos Harvey",
        "pos": "DEF"
      },
      {
        "name": "Jose Cordoba",
        "pos": "DEF"
      },
      {
        "name": "Eric Davis",
        "pos": "MID"
      },
      {
        "name": "Anibal Godoy",
        "pos": "MID",
        "doubtful": true
      },
      {
        "name": "C. Martinez",
        "pos": "MID"
      },
      {
        "name": "Amir Murillo",
        "pos": "MID"
      },
      {
        "name": "J. Rodriguez",
        "pos": "MID"
      },
      {
        "name": "Ismael Diaz",
        "pos": "MID"
      },
      {
        "name": "C. Waterman",
        "pos": "FW"
      }
    ]
  },
  "UZB": {
    "formation": "3-6-1",
    "starters": [
      {
        "name": "U. Yusupov",
        "pos": "GK"
      },
      {
        "name": "A. Abdullaev",
        "pos": "DEF"
      },
      {
        "name": "A. Khusanov",
        "pos": "DEF"
      },
      {
        "name": "R. Ashurmatov",
        "pos": "DEF"
      },
      {
        "name": "S. Nasrullayev",
        "pos": "MID"
      },
      {
        "name": "O. Shukurov",
        "pos": "MID"
      },
      {
        "name": "O. Khamrobekov",
        "pos": "MID"
      },
      {
        "name": "K. Alijonov",
        "pos": "MID"
      },
      {
        "name": "A. Fayzullaev",
        "pos": "MID"
      },
      {
        "name": "Oston Urunov",
        "pos": "MID"
      },
      {
        "name": "E. Shomurodov",
        "pos": "FW"
      }
    ]
  },
  "COL": {
    "formation": "4-5-1",
    "starters": [
      {
        "name": "C. Vargas",
        "pos": "GK"
      },
      {
        "name": "Johan Mojica",
        "pos": "DEF"
      },
      {
        "name": "Jhon Lucumi",
        "pos": "DEF"
      },
      {
        "name": "D. Sanchez",
        "pos": "DEF"
      },
      {
        "name": "Daniel Munoz",
        "pos": "DEF"
      },
      {
        "name": "R. Rios Montoya",
        "pos": "MID"
      },
      {
        "name": "J. Lerma",
        "pos": "MID"
      },
      {
        "name": "Luis Diaz",
        "pos": "MID"
      },
      {
        "name": "J. Rodriguez",
        "pos": "MID"
      },
      {
        "name": "Jhon Arias",
        "pos": "MID"
      },
      {
        "name": "Luis Suarez",
        "pos": "FW"
      }
    ]
  }
};
