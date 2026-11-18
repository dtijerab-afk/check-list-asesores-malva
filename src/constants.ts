export const ASESORES: Record<string, string[]> = {
  "CAMILO ARGEL": [
    "A -FUN SOCKS TOK KT", "ABRIL FLORES MIL TOK", "ABRIL FLORES MIL TOK KT", "AGUEL",
    "ALEJANDRO DE LA ROSA", "ALEXANDRABUENO TOK", "ARGEMIRO SIERRA", "BIMBIDREAMS TOK",
    "BLUE BANANA KT", "BLUE BANANA TOK KT", "DOS COSTAS", "DOS OJOS TOK", "EL GANSO KT",
    "FABULA", "FRANCESCA MIRANDA HOMBRE", "GLEE", "GUILLERMO CASTRO", "JOLIE TOK",
    "JOY HUNTERS TOK KT", "JUAN SILVESTRE", "JULIAN EN HILOS", "LA POMPONETTE TOK",
    "LACOSTE KT", "LAPU KIDS TOK", "LAPU TOK KT", "LOBSTER MINI TOK", "LOBSTER MINI TOK KT",
    "LPG TOK", "LUGO", "MARINI STAR", "NO DRAMA KT", "PARDO", "PEPITA & ME",
    "QUAKQUAK TOK", "RAYITO DE SOL TOK", "RELICARIO KIDS TOK", "REMANENCE",
    "ROMEO KIDS TOK KT", "SAN BABY TOK KT", "TRUE", "UNO A UNO",
    "VISTETE DE COLOMBIA", "VOIE KT"
  ],
  "HELEN CEPEDA": [
    "ADRIANA CONTRERAS", "AMARANTE", "ANCA RAVELO", "ARIAL 12", "BROWNIE",
    "CASA AZUCENA", "CASA AZUCENA KT", "CESE", "EMUNA", "HEROICA",
    "JOHANNA ISAAC FADUL", "LA HEROICA", "LOBO ROSA", "MATILDA", "MAYORGA",
    "MOCHILA MARKET", "MUSEE THE BRAND", "OLIVIA MAREQUE KT", "ROSA CAROPESSE",
    "VEMOC", "VERDI KT", "WAIMARI KT", "ZIMMERMANN KT"
  ],
  "LEANYS CARDONA": [
    "AGUA COCO", "BAOBAB", "BAOBAB KT", "BENEDETTA", "BLESS", "ENCANTADORE",
    "ENCANTADORE KT", "KIBYS", "LA VIE", "MALAI", "MAR DE LUA", "MILONGA",
    "MIO CORAL", "ONDA DE MAR KT", "ONDADEMAR", "SEA SALT", "SEA SALT KT",
    "WE ARE PROJECT"
  ],
  "LISETH ROMERO": [
    "AC SHOES MAN", "ADIDAS", "ADIDAS TOK KT", "ALMA AZUL", "ALMA EN PENA KT",
    "ALOHAS KT", "ALTA SHOES", "AUTRY KT", "AXEL ARIGATO KT", "COOLWAY KT",
    "CROCS TOK", "CULT GAIA KT", "FLABELUS KT", "GARCES BOTTIER", "GOLDEN GOOSE KT",
    "GRACIA SHOES", "HOFF KT", "IGOR", "IGOR TOK KT", "ISABEL MARANT KT",
    "LEJAN TOK KT", "MARC JACOBS KT"
  ],
  "MARIA ALEJANDRA DE LA CRUZ": [
    "BROWNIE CALZADO", "MATERGEA", "MIRKO", "MULATT", "MULATT KT", "NEW BALANCE KT",
    "ON RUNNING", "ON RUNNING KT", "ON RUNNING TOK KT", "OQ SHOES", "OQUI TOK",
    "P448", "PAPATTUS", "PATRICIA MEJIA KT", "PREMIATA KT", "SCALPERS",
    "SCHUTZ KT", "STELLA MCCARTNEY KT", "THE FOUNDRY KT", "VALARUZO",
    "VEJA KT", "VEJA TOK KT", "ZADIG ET VOLTAIRE CALZADO"
  ],
  "ALEXANDRA TORTELLO": [
    "ALITZA GARCIA", "ANANA", "BISUTERIA", "CASABELA", "DIVINA CASTIDAD",
    "ESPECIA", "GAFAS", "JULIAMAR", "JULIANA SANCHEZ", "LA VI BY MAJO",
    "LAURA APARICIO", "LUCKY NAWA", "MALVA ACCESORIES KT",
    "MARIA ELENA VILLAMIL KT", "PADOVA", "PAMELA STEVENSON",
    "PAMELA STEVENSON KT", "PAULA MENDOZA KT", "PUESTO DE PAGO",
    "RELOJERIA", "STERLING"
  ],
  "JUAN": [
    "08MIL", "ALGODON Y COCO", "AMI PARIS KT", "COMMON AREA KT", "FLOW",
    "FLOW KT", "FRANCQUES", "GANNI", "JONATHAN SIMKHAI KT", "JORGE DUQUE KT",
    "LA OBRA DE ARTE SOY YO", "LUNIA", "NOT A UNIFORM", "NOT A UNIFORM KT",
    "PAJARO LIMON", "PINKO", "ZADIG ET VOLTAIRE ROPA Y CARTERAS", "ZIERRA LEONA KT"
  ]
};

export const B1 = [
  "Presentación Personal",
  "Limpieza",
  "Higiene Personal",
  "Calzado",
  "Rostro",
  "Planchado"
];

export const B2 = [
  "Surtido",
  "Limpieza",
  "Planchado",
  "Etiquetado",
  "Pinado",
  "Senalizacion",
  "Tallas"
];

export const B2_LABELS = [
  "Surtido",
  "Limpieza",
  "Planchado",
  "Etiquetado",
  "Piñado",
  "Señalización",
  "Tallas"
];

export type RatingVal = "0" | "1" | "2" | "NA";

export interface BrandEvalData {
  items: Record<string, RatingVal>;
  obs: string;
}

export interface EvalSession {
  id: number;
  asesor: string;
  fecha: string;
  evaluador: string;
  b1Score: number | null;
  b2Score: number | null;
  finalScore: number | null;
  b1Data: Record<string, RatingVal>;
  b2Data: Record<string, BrandEvalData>;
  selBrands: string[];
  week: number;
  month: string;
  sigAsesor: string;
  sigEvaluador: string;
  fireId?: string;
}
