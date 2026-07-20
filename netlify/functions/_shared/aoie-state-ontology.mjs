export const ENGINE_VERSION = 'aoie-state-local-mvp-1';
export const ONTOLOGY_VERSION = 'state-local-general-v1';
export const SCORING_VERSION = 'state-local-hybrid-v1';
export const PROFILE_VERSION = 'state-local-capability-profile-v1';

export const STOPWORDS = new Set([
  'and','the','for','with','from','into','services','service','solutions','solution','business','company',
  'government','public','agency','contract','contracts','support','management','general','professional'
]);

export const CAPABILITY_ONTOLOGY = {
  information_technology:{terms:['information technology','it services','software','saas','application development','systems integration','cloud','database','data analytics','help desk','managed services'],commodityPrefixes:['208','209'],unspscPrefixes:['43','8111'],naicsPrefixes:['541511','541512','541513','541519','518210']},
  cybersecurity_network:{terms:['cybersecurity','cyber security','network security','zero trust','penetration testing','security operations center','soc','firewall','network infrastructure','telecommunications','broadband','fiber optic'],commodityPrefixes:['209','970'],unspscPrefixes:['4322','4615','8111'],naicsPrefixes:['541512','541519','517']},
  construction_general:{terms:['general construction','building construction','renovation','remodeling','tenant improvement','site work','civil construction','infrastructure construction','design build'],commodityPrefixes:['910','918'],unspscPrefixes:['72'],naicsPrefixes:['236','237','238']},
  electrical_controls:{terms:['electrical','electrician','wiring','low voltage','lighting','streetlight','street light','led fixture','led retrofit','lighting upgrade','traffic signal','power distribution','industrial control','automation control','programmable logic controller','plc','control panel','fire alarm'],commodityPrefixes:['914','960'],unspscPrefixes:['26','32','39','4619','7215'],naicsPrefixes:['238210','3345','3353','423610','423690']},
  mechanical_hvac_plumbing:{terms:['hvac','heating ventilation air conditioning','air conditioning','mechanical systems','plumbing','pipefitting','boiler','chiller','refrigeration'],commodityPrefixes:['915'],unspscPrefixes:['40','7215'],naicsPrefixes:['238220','3334','423720','423730','423740']},
  facilities_janitorial:{terms:['janitorial','custodial','cleaning','facility maintenance','building maintenance','preventive maintenance','grounds maintenance','sanitation'],commodityPrefixes:['580'],unspscPrefixes:['47','76','7210'],naicsPrefixes:['561210','561720','561790','8113']},
  landscaping_grounds:{terms:['landscaping','landscape maintenance','groundskeeping','grounds maintenance','lawn care','irrigation','tree service','arborist','mowing'],commodityPrefixes:['920'],unspscPrefixes:['1017','7011','7210'],naicsPrefixes:['561730']},
  transportation_logistics:{terms:['transportation','logistics','delivery','freight','trucking','fleet management','courier','warehousing','distribution','shuttle','paratransit'],commodityPrefixes:['950'],unspscPrefixes:['78','7810','7811','7812','7813','7814'],naicsPrefixes:['484','485','488','492','493']},
  consulting_project_management:{terms:['management consulting','business consulting','project management','program management','strategic planning','business analysis','process improvement','organizational development','grant management'],commodityPrefixes:['800'],unspscPrefixes:['80','8010','8011','8016'],naicsPrefixes:['541611','541612','541613','541614','541618','541690']},
  engineering_architecture:{terms:['engineering','civil engineering','structural engineering','mechanical engineering','electrical engineering','architecture','architectural services','land surveying','gis','mapping','design services'],commodityPrefixes:['925','926'],unspscPrefixes:['8110','811015','811016'],naicsPrefixes:['541310','541320','541330','541340','541370']},
  staffing_workforce:{terms:['staffing','temporary staffing','recruiting','human resources','workforce services','payroll services','employment services','personnel services'],commodityPrefixes:['937'],unspscPrefixes:['8011','8016','9314'],naicsPrefixes:['5613','541612']},
  training_education:{terms:['training','professional development','workforce development','instruction','curriculum','e-learning','coaching','technical training','education services'],commodityPrefixes:['945'],unspscPrefixes:['86','8610','8613','8614'],naicsPrefixes:['6114','6115','6116','6117']},
  security_surveillance:{terms:['security services','security guard','guard services','surveillance','access control','alarm monitoring','video surveillance','physical security','patrol services'],commodityPrefixes:['960'],unspscPrefixes:['46','4615','9212'],naicsPrefixes:['561612','561621']},
  healthcare_medical:{terms:['healthcare','medical services','clinical services','nursing','behavioral health','mental health','pharmacy','medical supplies','patient care','dental'],commodityPrefixes:['720'],unspscPrefixes:['41','42','51','85'],naicsPrefixes:['621','622','623','624']},
  industrial_office_supplies:{terms:['industrial supplies','electrical supplies','electronic components','office supplies','equipment supply','material supply','wholesale distribution','parts supply','maintenance repair operations','mro'],commodityPrefixes:['208','423','580'],unspscPrefixes:['24','25','26','27','31','32','39','44'],naicsPrefixes:['423','424']},
  marketing_outreach:{terms:['marketing','advertising','public relations','communications','community outreach','branding','media services','social media','graphic design'],commodityPrefixes:['940','980'],unspscPrefixes:['8210','8212','8213','8214'],naicsPrefixes:['541810','541820','541830','541850','541860','541890']},
  environmental_waste:{terms:['environmental consulting','environmental services','waste management','hazardous waste','recycling','remediation','stormwater','air quality','sustainability'],commodityPrefixes:['927'],unspscPrefixes:['77','7710','7612'],naicsPrefixes:['541620','562']},
  food_catering:{terms:['food service','catering','meal service','cafeteria','dining services','beverage service','vending'],commodityPrefixes:['670'],unspscPrefixes:['50','90'],naicsPrefixes:['722','311','312']}
};

export const DEFAULT_WEIGHTS = {exactUnspsc:25,exactCommodity:20,relatedCodeFamily:10,keywordEvidence:30,conceptAlignment:30,geography:10,certification:5,license:5,capacity:5};
