export const collection = {
  title: 'A city, under revision.',
  extent: [13.369,52.507,13.413,52.525],
  encounters: [
    { id:'spree',type:'marker',symbol:'◇',title:'Two banks of the Spree',short:'The river city',place:'Schlossbrücke / Spree',year:1650,endYear:1650,precision:'year',date:'1650-01-01T12:00:00Z',lon:13.4005,lat:52.5187,elevation:3,scale:1,map:'hc-1650',camera:{lon:13.3968,lat:52.5154,height:320,heading:40,pitch:-35},
      body:'Begin at the river. The historical map describes a smaller city around Berlin and Cölln. Hold this position and move through time to compare the mapped city with the streets around you.',
      note:'A reading of the 1650 map; the encounter is dated to the map year.',source:'https://hypercities.com/?enter=map',sourceName:'HyperCities · Berlin 1650' },
    { id:'gate',ground:'street',type:'marker',symbol:'◇',title:'A gate to the city',short:'A new threshold',place:'Brandenburger Tor',year:1791,endYear:1791,precision:'year',date:'1791-01-01T12:00:00Z',lon:13.377704,lat:52.516275,elevation:5,scale:1,map:'hc-1805',camera:{lon:13.3802,lat:52.5162,height:42,heading:274,pitch:-7},
      body:'Built between 1788 and 1791, the Brandenburg Gate marked an entrance to the city. Approach it from Unter den Linden, then compare the surrounding street pattern with a map from 1805.',
      note:'1791 is a year-level date. The accompanying map is from 1805.',source:'https://www.berlin.de/en/attractions-and-sights/3560266-3104052-brandenburg-gate.en.html',sourceName:'Berlin.de · Brandenburg Gate' },
    { id:'avenue',type:'video',symbol:'▷',title:'Reading the growing city',short:'The city on paper',place:'Unter den Linden / Bebelplatz',year:1910,endYear:1910,precision:'year',date:'1910-01-01T12:00:00Z',lon:13.3935,lat:52.5175,elevation:18,scale:12,map:'hc-1905',camera:{lon:13.3897,lat:52.5151,height:210,heading:44,pitch:-25},
      body:'A map is a way of looking at a city. Follow the avenue east, toward the palace precinct. This moving study brings the 1905 Pharus map into view as a surface to read and explore.',
      media:'./assets/map-study.mp4',poster:'./assets/hc-1905.jpg',mediaLabel:'LOCAL CARTOGRAPHIC STUDY · NOT HISTORICAL FILM',note:'The video is a newly made animation of the 1905 map. The narrative setting is circa 1910.',source:'https://hypercities.com/?enter=map',sourceName:'HyperCities · Pharus-Plan Berlin, 1905' },
    { id:'damage',ground:'satellite',type:'marker',symbol:'◇',title:'A city after destruction',short:'Reading the gaps',place:'Potsdamer Platz',year:1945,endYear:1945,precision:'year',date:'1945-01-01T12:00:00Z',lon:13.3762,lat:52.5096,elevation:5,scale:1,map:'berlin-1945',camera:{lon:13.3707,lat:52.5057,height:450,heading:40,pitch:-38},
      body:'The 1945 building-damage map records another city within the same geography. Compare its marks with the present-day building footprints. Their differences are evidence to investigate, rather than a reconstruction of what stood here.',
      note:'Historical damage layer over present-day context. No date within 1945 is asserted.',source:'https://gdi.berlin.de/services/wms/staedtebauliche_entwicklung?SERVICE=WMS&REQUEST=GetCapabilities',sourceName:'Geoportal Berlin · Gebäudeschäden 1945' },
    { id:'palast',type:'model',symbol:'⬡',title:'A palace in place of a palace',short:'An occupied absence',place:'Palast der Republik / Schlossplatz',year:1976,endYear:1990,precision:'year',date:'1976-01-01T12:00:00Z',lon:13.40265,lat:52.51755,elevation:0,scale:1,map:'hc-1986',camera:{lon:13.4057,lat:52.5153,height:105,heading:319,pitch:-18},
      body:'The Palast der Republik opened in 1976 on part of the former palace site. This simplified volume lets you test how an absent building can occupy the contemporary city. It is a massing study, not a historical reconstruction.',
      note:'Approximate 180 × 85 × 32 m volume; indicative placement and orientation. Interval shown: opening to closure, 1976–1990.',source:'https://www.bundesarchiv.de/themen-entdecken/online-entdecken/themenbeitraege/palast-unter-stasi-schutz/',sourceName:'Bundesarchiv · Palast unter Stasi-Schutz' },
    { id:'voices',ground:'street',type:'sound',symbol:'◖',title:'A threshold opens',short:'Listening at the gate',place:'Pariser Platz / Brandenburger Tor',year:1989,endYear:1989,precision:'year',date:'1989-11-09T00:00:00Z',lon:13.3787,lat:52.5163,elevation:1.7,scale:140,map:'hc-1986',camera:{lon:13.3795,lat:52.51628,height:1.75,heading:271,pitch:1},
      body:'In November 1989, the fall of the Wall changed the meaning of the gate. Stand on Pariser Platz and listen. This deliberately abstract sound study tests an encounter that can be heard from a place, without claiming to reproduce its historical sound.',
      media:'./assets/threshold-study.wav',mediaLabel:'SYNTHETIC SOUND STUDY · NOT AN ARCHIVAL RECORDING',note:'Sound description: low pulses and soft, irregular bell-like tones. The 140 m listening radius is an interface choice. Date known to day; no event time asserted.',source:'https://www.bpb.de/themen/deutschlandarchiv/340165/the-wall-1961-2021-part-two/',sourceName:'bpb · The Wall: 1961–2021' }
  ]
};

export const maps = [
  {id:'hc-1650',year:1650,title:'Berlin / Memhard',collection:'HyperCities · UCLA',asset:'hc-1650',catalogId:'map:18'},
  {id:'hc-1805',year:1805,title:'Royal residence city',collection:'HyperCities · UCLA',asset:'hc-1805',catalogId:'map:26'},
  {id:'hc-1905',year:1905,title:'Pharus-Plan Berlin',collection:'HyperCities · UCLA',asset:'hc-1905',catalogId:'map:1'},
  {id:'berlin-1910',year:1910,title:'Berlin circa 1910',collection:'Geoportal Berlin',asset:'berlin-1910',wms:'berlin_1910'},
  {id:'berlin-1945',year:1945,title:'Building damage',collection:'Geoportal Berlin',asset:'berlin-1945',wms:'berlin_1945_gebaeudeschaeden'},
  {id:'hc-1947',year:1947,title:'Berlin after the war',collection:'HyperCities · UCLA',asset:'hc-1947',catalogId:'map:8'},
  {id:'hc-1986',year:1986,title:'Capital of the GDR',collection:'HyperCities · UCLA',asset:'hc-1986',catalogId:'map:38'},
  {id:'berlin-1986',year:1986,title:'Berlin circa 1986',collection:'Geoportal Berlin',asset:'berlin-1986',wms:'berlin_1986'}
];
