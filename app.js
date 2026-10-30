import { collection, maps } from './data/collection.js';

const $ = (id) => document.getElementById(id);
const C = window.Cesium;
const DAY = 86400000, YEAR = 365.2425 * DAY;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = { mode:'fly',time:Date.UTC(1910,0,1,12),span:600*YEAR,selected:null,sequence:-1,map:null,ground:'dark',playing:false,spatial:false };
const encounters = collection.encounters.map(e => ({...e,time:Date.parse(e.date),end:yearTime(e.endYear+1)}));
const MIN_TIME=yearTime(-9999), MAX_TIME=yearTime(12000), MIN_SPAN=1000, MAX_SPAN=20000*YEAR;
let viewer, historicalLayer, buildingSource, mapRevision=0, toastTimer, audioContext, spatialSource, spatialGain, spatialPanner, spatialAudio;
let mapCatalog=[], assetManifest={}, timelineFrame=0, cameraMoving=false, groundFeatures=[], roadFeatures=[];
const keys=new Set();
const entities=new Map();

function yearTime(year){const d=new Date(0);d.setUTCFullYear(year,0,1);d.setUTCHours(0,0,0,0);return +d;}
function yearLabel(year){return year<=0?`${1-year} BCE`:String(year);}
function timeYear(t){const d=new Date(t),y=d.getUTCFullYear();return y+(t-yearTime(y))/(yearTime(y+1)-yearTime(y));}
function clockLabel(d){return [d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds()].map(n=>String(n).padStart(2,'0')).join(':');}
function dateLabel(t,detail=false){const d=new Date(t),y=d.getUTCFullYear();return detail?`${d.getUTCDate()} ${d.toLocaleString('en',{month:'short',timeZone:'UTC'}).toUpperCase()} ${yearLabel(y)} · ${clockLabel(d)} UTC`:yearLabel(y);}
function showToast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
function requestTimeline(){if(timelineFrame)return;timelineFrame=requestAnimationFrame(()=>{timelineFrame=0;renderTimewell();});}
function setTime(time,{follow=true}={}){
  state.time=Math.max(MIN_TIME,Math.min(MAX_TIME,time));
  const year=new Date(state.time).getUTCFullYear();
  $('focus-year').textContent=yearLabel(year);
  $('date-era').textContent=state.span<2*DAY?'FOCAL INSTANT / UTC':'FOCAL YEAR';
  const d=new Date(state.time);
  $('focus-detail').textContent=state.span<2*DAY?`${d.getUTCDate()} ${d.toLocaleString('en',{month:'short',timeZone:'UTC'}).toUpperCase()} · ${clockLabel(d)}`:state.span<3*YEAR?`${d.getUTCDate()} ${d.toLocaleString('en',{month:'long',timeZone:'UTC'}).toUpperCase()}`:'HOLD PLACE · MOVE TIME';
  $('time-axis').setAttribute('aria-valuenow',timeYear(state.time).toFixed(6));
  $('time-axis').setAttribute('aria-valuetext',dateLabel(state.time,true));
  for(const e of encounters){
    const eligible=state.time>=e.time && state.time<e.end;
    const entity=entities.get(e.id);
    if(entity){
      entity.point && (entity.point.color=C.Color.fromCssColorString(eligible?'#ef716a':'#a9a399').withAlpha(eligible?1:.6));
      entity.label && (entity.label.fillColor=C.Color.fromCssColorString(eligible?'#efe9dc':'#a9a399').withAlpha(eligible?1:.65));
    }
  }
  const model=viewer?.entities.getById('palast-model');if(model)model.show=state.time>=encounters[4].time&&state.time<encounters[4].end;
  if(buildingSource)for(const building of buildingSource.entities.values){if(building.properties?.nearPalast?.getValue())building.show=!model?.show;}
  if(follow && $('auto-map').checked){const map=[...maps].reverse().find(m=>year>=m.year);setMap(map?.id??null);}
  requestTimeline();
}
function setSpan(span){state.span=Math.max(MIN_SPAN,Math.min(MAX_SPAN,span));$('time-scale').value=1000*Math.log(state.span/MIN_SPAN)/Math.log(MAX_SPAN/MIN_SPAN);$('span-label').textContent=spanLabel(state.span);setTime(state.time,{follow:false});}
function spanLabel(span){if(span>=1000*YEAR)return `${Math.round(span/YEAR).toLocaleString()} YEARS`;if(span>=2*YEAR)return `${Math.round(span/YEAR)} YEARS`;if(span>=2*DAY)return `${Math.round(span/DAY)} DAYS`;if(span>=7200000)return `${Math.round(span/3600000)} HOURS`;if(span>=120000)return `${Math.round(span/60000)} MINUTES`;const n=Math.max(1,Math.round(span/1000));return `${n} SECOND${n===1?'':'S'}`;}

function buildCollection(){
  $('encounter-list').innerHTML=encounters.map((e,i)=>`<li><button class="encounter-row" data-encounter="${e.id}" aria-current="false"><span class="type-symbol">${e.symbol}</span><span><span class="row-title">${e.short}</span><span class="row-sub">${String(i+1).padStart(2,'0')} / ${e.type.toUpperCase()}</span></span><span class="row-year">${e.year}</span></button></li>`).join('');
  $('encounter-list').addEventListener('click',ev=>{const b=ev.target.closest('[data-encounter]');if(b)selectEncounter(b.dataset.encounter);});
  $('map-list').innerHTML=maps.map(m=>`<button class="map-button" data-map="${m.id}" aria-pressed="false"><span class="map-year">${m.year}</span><span>${m.title}<small>${m.collection}</small></span><span class="map-dot">●</span></button>`).join('');
  $('layer-count').textContent=String(maps.length).padStart(2,'0');
  $('map-list').addEventListener('click',ev=>{const b=ev.target.closest('[data-map]');if(b){$('auto-map').checked=false;setMap(b.dataset.map);}});
  $('source-list').innerHTML=`<a href="https://hypercities.com/?enter=map" target="_blank" rel="noopener">HyperCities / historical map library ↗</a><a href="https://gdi.berlin.de/services/wms/staedtebauliche_entwicklung?SERVICE=WMS&REQUEST=GetCapabilities" target="_blank" rel="noopener">Geoportal Berlin / urban development maps ↗</a><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors / footprints, ODbL ↗</a>`+encounters.filter(e=>!e.source.includes('hypercities.com')).map(e=>`<a href="${e.source}" target="_blank" rel="noopener">${e.sourceName} ↗</a>`).join('');
}

function selectEncounter(id){
  const e=encounters.find(e=>e.id===id);if(!e)return;
  stopMedia();state.selected=e.id;
  $('layers').hidden=true;$('layers-toggle').setAttribute('aria-expanded','false');
  $('encounter').hidden=false;
  $('encounter-kind').textContent=`${e.symbol} ${e.type.toUpperCase()} / ${String(encounters.indexOf(e)+1).padStart(2,'0')}`;
  $('encounter-year').textContent=e.endYear>e.year?`${e.year}–${e.endYear}`:String(e.year);
  $('encounter-title').textContent=e.title;$('encounter-place').textContent=e.place.toUpperCase();$('encounter-body').textContent=e.body;
  $('encounter-meta').innerHTML=`<dt>Position</dt><dd>${e.lat.toFixed(4)}° N, ${e.lon.toFixed(4)}° E</dd><dt>Altitude</dt><dd>${e.elevation} m above simplified ground</dd><dt>View</dt><dd>${e.camera.height} m · heading ${e.camera.heading}° · pitch ${e.camera.pitch}°</dd><dt>Map</dt><dd>${maps.find(m=>m.id===e.map)?.title} / ${maps.find(m=>m.id===e.map)?.year}</dd>`;
  const media=$('encounter-media');media.replaceChildren();
  if(e.type==='video'){
    const video=document.createElement('video');video.controls=true;video.preload='metadata';video.playsInline=true;video.src=e.media;video.poster=e.poster;video.setAttribute('aria-label','Animated study of the 1905 Berlin map');media.append(video);
    video.addEventListener('play',()=>{const surface=viewer?.entities.getById('video-surface');if(surface)surface.plane.material=new C.ImageMaterialProperty({image:video});});
    video.addEventListener('error',()=>showToast('The local map-study video is unavailable. Its source map remains available in Maps.'));
  }
  if(e.type==='sound'){
    const audio=document.createElement('audio');audio.controls=true;audio.preload='metadata';audio.src=e.media;audio.setAttribute('aria-label','Synthetic threshold sound study');media.append(audio);
    const spatial=document.createElement('button');spatial.className='spatial-toggle';spatial.textContent='ENABLE SPATIAL LISTENING ↗';spatial.setAttribute('aria-pressed','false');
    spatial.addEventListener('click',()=>toggleSpatial(spatial));media.append(spatial);
    audio.addEventListener('play',()=>stopSpatial());audio.addEventListener('error',()=>showToast('The local sound file is unavailable.'));
  }
  if(e.mediaLabel){const p=document.createElement('p');p.className='eyebrow';p.textContent=e.mediaLabel;media.append(p);}
  const note=document.createElement('p');note.className='media-note';note.textContent=e.note;media.append(note);
  $('encounter-source').href=e.source;$('encounter-source').textContent=`${e.sourceName.toUpperCase()} ↗`;
  document.querySelectorAll('[data-encounter]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.encounter===e.id)));
  requestTimeline();
}
function stopSpatial(){if(spatialAudio){spatialAudio.pause();spatialAudio.currentTime=0;}state.spatial=false;document.querySelectorAll('.spatial-toggle').forEach(b=>{b.textContent='ENABLE SPATIAL LISTENING ↗';b.setAttribute('aria-pressed','false');});}
function stopMedia(){document.querySelectorAll('#encounter-media video,#encounter-media audio').forEach(m=>m.pause());const surface=viewer?.entities.getById('video-surface');if(surface)surface.plane.material=new C.ImageMaterialProperty({image:encounters[2].poster});stopSpatial();}
async function toggleSpatial(button){
  if(state.spatial){stopSpatial();return;}
  try{
    document.querySelector('#encounter-media audio')?.pause();
    if(!audioContext){
      audioContext=new AudioContext();spatialAudio=new Audio('./assets/threshold-study.wav');spatialAudio.loop=true;
      spatialSource=audioContext.createMediaElementSource(spatialAudio);spatialGain=audioContext.createGain();spatialPanner=audioContext.createStereoPanner();spatialSource.connect(spatialGain).connect(spatialPanner).connect(audioContext.destination);
    }
    await audioContext.resume();await spatialAudio.play();state.spatial=true;updateSpatial();button.textContent='SPATIAL LISTENING ON · STOP ×';button.setAttribute('aria-pressed','true');showToast('Listening radius: 140 m around Pariser Platz. Travel to the encounter to hear it nearby.');
  }catch(error){showToast('Spatial audio could not start. Use the ordinary audio player.');console.warn(error);}
}
function updateSpatial(){if(!state.spatial||!viewer)return;const e=encounters[5],source=C.Cartesian3.fromDegrees(e.lon,e.lat,e.elevation),camera=viewer.camera;
  const relative=C.Cartesian3.subtract(source,camera.positionWC,new C.Cartesian3()),distance=C.Cartesian3.magnitude(relative);
  const pan=distance>0?C.Math.clamp(C.Cartesian3.dot(C.Cartesian3.normalize(relative,relative),camera.rightWC),-1,1):0;
  spatialGain.gain.setTargetAtTime(Math.max(0,1-distance/e.scale)*.8,audioContext.currentTime,.1);spatialPanner.pan.setTargetAtTime(pan,audioContext.currentTime,.1);
}

function travelTo(id){
  const e=encounters.find(e=>e.id===id);if(!e||!viewer)return;
  state.sequence=encounters.indexOf(e);selectEncounter(e.id);setTime(e.time,{follow:false});setMap(e.map);setGround(e.ground||'dark');
  if(e.type==='sound')setMode('walk',{settle:false});
  const cam=e.camera,height=state.mode==='walk'?1.75:cam.height;
  const destination=state.mode==='walk'?nearestStreet(C.Cartographic.fromDegrees(cam.lon,cam.lat)):C.Cartographic.fromDegrees(cam.lon,cam.lat);
  cameraMoving=true;viewer.camera.flyTo({destination:C.Cartesian3.fromRadians(destination.longitude,destination.latitude,height),orientation:{heading:C.Math.toRadians(cam.heading),pitch:C.Math.toRadians(state.mode==='walk'?1:cam.pitch),roll:0},duration:reducedMotion?0:2,complete:()=>cameraMoving=false,cancel:()=>cameraMoving=false});
  $('sequence-position').textContent=`${String(state.sequence+1).padStart(2,'0')} / 06`;$('next').textContent=state.sequence===5?'BEGIN AGAIN ↗':'CONTINUE →';$('encounter').scrollTop=0;
}

async function setGround(id){
  if(!viewer)return;
  const previous=viewer.imageryLayers.get(0);
  let provider;
  if(id==='satellite')provider=new C.UrlTemplateImageryProvider({url:'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',maximumLevel:19,credit:'Imagery © Esri, Maxar, Earthstar Geographics and the GIS User Community'});
  else provider=new C.UrlTemplateImageryProvider({url:id==='street'?'https://tile.openstreetmap.org/{z}/{x}/{y}.png':'https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',maximumLevel:19,credit:id==='street'?'© OpenStreetMap contributors':'© OpenStreetMap contributors © CARTO'});
  let failed=false;provider.errorEvent.addEventListener(()=>{if(!failed){failed=true;showToast('The online ground map is unavailable. Cached historical maps and local 3D objects remain usable.');}});
  viewer.imageryLayers.addImageryProvider(provider,0);if(previous)viewer.imageryLayers.remove(previous,true);
  state.ground=id;document.querySelectorAll('[data-ground]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ground===id)));
}
async function setMap(id){
  if(!viewer||state.map===id)return;
  state.map=id;const revision=++mapRevision;
  if(historicalLayer){viewer.imageryLayers.remove(historicalLayer,true);historicalLayer=null;}
  document.querySelectorAll('[data-map]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.map===id)));
  const map=maps.find(m=>m.id===id);$('active-map').textContent=map?`MAP / ${map.year}`:'GROUND ONLY';$('active-map').title=map?`${map.title} · ${map.collection}. Map date is separate from focal time.`:'Contemporary ground, without historical overlays';requestTimeline();
  if(!map){$('map-status').textContent='Contemporary ground only. No historical map selected.';return;}
  $('map-status').textContent=`Loading ${map.year} / ${map.title}…`;
  try{
    let provider;
    const cached=assetManifest[map.asset];
    if(cached){
      // Atlas samples were reprojected from Web Mercator to geographic coordinates when prepared.
      provider=await C.SingleTileImageryProvider.fromUrl(`./assets/${cached.file}`,{rectangle:C.Rectangle.fromDegrees(...cached.bbox),credit:map.collection});
    }else if(map.catalogId){
      const entry=mapCatalog.find(n=>n.id===map.catalogId);if(!entry)throw new Error('Catalog entry missing');
      provider=new C.UrlTemplateImageryProvider({url:entry.rendering.tileUrl.replace(/^http:/,'https:').replace(/\/?$/,'/')+'{z}/{x}/{y}.png',rectangle:C.Rectangle.fromDegrees(...entry.geometry.bbox),minimumLevel:entry.rendering.minZoom||10,maximumLevel:entry.rendering.maxZoom||18,credit:map.collection});
    }else provider=new C.WebMapServiceImageryProvider({url:'https://gdi.berlin.de/services/wms/staedtebauliche_entwicklung',layers:map.wms,parameters:{transparent:true,format:'image/png'},rectangle:C.Rectangle.fromDegrees(13.2,52.4,13.55,52.6),credit:'Geoportal Berlin / Städtebauliche Entwicklung'});
    if(revision!==mapRevision){provider.destroy?.();return;}
    historicalLayer=viewer.imageryLayers.addImageryProvider(provider);historicalLayer.alpha=Number($('opacity').value)/100;historicalLayer.brightness=.82;historicalLayer.saturation=.72;
    provider.errorEvent.addEventListener(()=>{if(revision===mapRevision)$('map-status').textContent=`${map.year} layer could not load. Select another map or show ground only.`;});
    $('map-status').textContent=`${map.year} / ${map.collection}${cached?' · cached local raster':' · live service'}. Map date is separate from focal time.`;
  }catch(error){if(revision===mapRevision){$('map-status').textContent=`${map.year} map unavailable. Select another layer.`;showToast('Historical map unavailable; the geographic scene remains navigable.');}console.warn(error);}
}

async function initScene(){
  try{
    if(!C)throw new Error('Cesium could not load');
    C.Ion.defaultAccessToken='';
    viewer=new C.Viewer('globe',{baseLayer:false,terrainProvider:new C.EllipsoidTerrainProvider(),geocoder:false,baseLayerPicker:false,animation:false,timeline:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,fullscreenButton:false,infoBox:false,selectionIndicator:false,shouldAnimate:false,scene3DOnly:true,contextOptions:{webgl:{alpha:false}},skyBox:false,skyAtmosphere:false});
    viewer.scene.backgroundColor=C.Color.fromCssColorString('#080909');viewer.scene.globe.baseColor=C.Color.fromCssColorString('#151615');viewer.scene.globe.enableLighting=false;viewer.scene.fog.enabled=false;viewer.scene.globe.depthTestAgainstTerrain=true;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance=.8;viewer.scene.screenSpaceCameraController.maximumZoomDistance=6000000;viewer.scene.screenSpaceCameraController.enableCollisionDetection=true;
    viewer.scene.postProcessStages.fxaa.enabled=true;
    await setGround('dark');
    viewer.camera.setView({destination:C.Cartesian3.fromDegrees(13.375,52.497,1650),orientation:{heading:C.Math.toRadians(24),pitch:C.Math.toRadians(-36),roll:0}});
    addEncounters();await loadBuildings();
    const model=viewer.entities.add({id:'palast-model',name:'Palast der Republik · approximate massing study',position:C.Cartesian3.fromDegrees(13.40265,52.51755,0),orientation:C.Transforms.headingPitchRollQuaternion(C.Cartesian3.fromDegrees(13.40265,52.51755,0),new C.HeadingPitchRoll(C.Math.toRadians(13),0,0)),model:{uri:'./assets/palast-study.gltf',scale:1,color:C.Color.WHITE,silhouetteColor:C.Color.fromCssColorString('#ef716a'),silhouetteSize:1,minimumPixelSize:0},show:false});
    const handler=new C.ScreenSpaceEventHandler(viewer.scene.canvas);handler.setInputAction(click=>{const pick=viewer.scene.pick(click.position);const entity=pick?.id;if(entity?.properties?.encounterId){selectEncounter(entity.properties.encounterId.getValue());}else if(entity?.id==='palast-model')selectEncounter('palast');},C.ScreenSpaceEventType.LEFT_CLICK);
    viewer.camera.changed.addEventListener(updateHUD);viewer.camera.percentageChanged=.01;
    viewer.scene.canvas.addEventListener('pointerdown',()=>{keys.clear();if(state.mode==='walk')viewer.camera.cancelFlight();});
    setupPointerLook();let previous=performance.now();viewer.clock.onTick.addEventListener(()=>{const now=performance.now(),dt=Math.min((now-previous)/1000,.08);previous=now;moveCamera(dt);updateSpatial();if(state.playing)setTime(state.time+dt*state.span/28);});
    setTime(state.time);updateHUD();$('loading').hidden=true;
  }catch(error){$('loading').querySelector('p').textContent='THE 3D FIELD COULD NOT START';$('loading').querySelector('small').textContent='WebGL 2 is required. Reload in a browser with hardware acceleration. The collection and Timewell remain available.';console.error(error);}
}
function addEncounters(){
  for(const e of encounters){
    const entity=viewer.entities.add({id:`encounter-${e.id}`,name:e.title,position:C.Cartesian3.fromDegrees(e.lon,e.lat,e.type==='model'?39:e.elevation),properties:{encounterId:e.id},point:{pixelSize:8,color:C.Color.fromCssColorString('#ef716a'),outlineWidth:1,outlineColor:C.Color.fromCssColorString('#080909'),disableDepthTestDistance:Number.POSITIVE_INFINITY},label:{text:`${e.symbol}  ${e.short.toUpperCase()}`,font:'10px sans-serif',fillColor:C.Color.fromCssColorString('#efe9dc'),showBackground:true,backgroundColor:C.Color.fromCssColorString('#080909').withAlpha(.86),backgroundPadding:new C.Cartesian2(7,5),pixelOffset:new C.Cartesian2(13,-7),horizontalOrigin:C.HorizontalOrigin.LEFT,style:C.LabelStyle.FILL,distanceDisplayCondition:new C.DistanceDisplayCondition(0,15000),disableDepthTestDistance:Number.POSITIVE_INFINITY,scaleByDistance:new C.NearFarScalar(100,1,12000,.7)}});
    entities.set(e.id,entity);
    // Objects retain their identity outside their active period, becoming quiet discovery cues.
    if(e.type==='video')viewer.entities.add({id:'video-surface',position:C.Cartesian3.fromDegrees(e.lon,e.lat,e.elevation),properties:{encounterId:e.id},plane:{plane:new C.Plane(C.Cartesian3.UNIT_Y,0),dimensions:new C.Cartesian2(28,16),material:new C.ImageMaterialProperty({image:e.poster,transparent:false}),outline:true,outlineColor:C.Color.fromCssColorString('#ef716a')}});
    if(e.type==='sound')viewer.entities.add({id:'sound-radius',position:C.Cartesian3.fromDegrees(e.lon,e.lat,.3),ellipse:{semiMajorAxis:e.scale,semiMinorAxis:e.scale,height:.3,material:C.Color.fromCssColorString('#da3833').withAlpha(.035),outline:true,outlineColor:C.Color.fromCssColorString('#da3833').withAlpha(.2)}});
  }
}
async function loadBuildings(){
  try{
    const response=await fetch('./data/buildings.geojson');if(!response.ok)throw new Error('Building geometry unavailable');
    const geojson=await response.json();groundFeatures=geojson.features;
    try{roadFeatures=(await (await fetch('./data/streets.geojson')).json()).features;}catch{}
    buildingSource=await C.GeoJsonDataSource.load(geojson,{clampToGround:false,stroke:C.Color.fromCssColorString('#4f5050'),strokeWidth:.5,fill:C.Color.fromCssColorString('#353a39')});
    for(const entity of buildingSource.entities.values){if(!entity.polygon)continue;const props=entity.properties;entity.polygon.arcType=C.ArcType.GEODESIC;entity.polygon.height=0;entity.polygon.extrudedHeight=props?.height?.getValue()||15;entity.polygon.material=C.Color.fromCssColorString('#3b403e').withAlpha(.9);entity.polygon.outline=false;entity.polygon.closeBottom=false;}
    await viewer.dataSources.add(buildingSource);buildingSource.show=$('buildings').checked;
    $('context-note').textContent=`${geojson.features.length} contemporary OSM footprints · recorded / estimated heights · simplified ground`;
  }catch(error){$('context-note').textContent='Building geometry unavailable · historical maps and encounters remain navigable';$('buildings').checked=false;$('buildings').disabled=true;showToast('Local building geometry is unavailable.');console.warn(error);}
}
function setMode(mode,{settle=true}={}){
  state.mode=mode;keys.clear();if(!viewer)return;
  const controller=viewer.scene.screenSpaceCameraController;
  $('fly').setAttribute('aria-pressed',String(mode==='fly'));$('walk').setAttribute('aria-pressed',String(mode==='walk'));
  $('look').hidden=mode!=='walk';$('rise').hidden=mode==='walk';$('lower').hidden=mode==='walk';$('crosshair').hidden=mode!=='walk';
  controller.enableRotate=mode==='fly';controller.enableTranslate=mode==='fly';controller.enableZoom=mode==='fly';controller.enableTilt=mode==='fly';controller.enableLook=mode==='fly';
  if(mode==='walk'){
    $('buildings').checked=true;if(buildingSource)buildingSource.show=true;
    if(settle){let p=viewer.camera.positionCartographic;
      // From an overview, descend into the place being looked at rather than the remote camera origin.
      if(p.height>150){const canvas=viewer.scene.canvas,ray=viewer.camera.getPickRay(new C.Cartesian2(canvas.clientWidth/2,canvas.clientHeight/2)),hit=ray&&viewer.scene.globe.pick(ray,viewer.scene);if(hit)p=C.Cartographic.fromCartesian(hit);}
      p=nearestStreet(p);cameraMoving=true;viewer.camera.flyTo({destination:C.Cartesian3.fromRadians(p.longitude,p.latitude,1.75),orientation:{heading:p.walkHeading??viewer.camera.heading,pitch:C.Math.toRadians(1),roll:0},duration:reducedMotion?0:1.5,complete:()=>cameraMoving=false,cancel:()=>cameraMoving=false});}
    $('navigation-hint').textContent='W A S D to walk · Drag to look · Arrows to turn · Esc releases pointer';showToast('Walk: W A S D to move. Drag to look; Shift to move faster. Buildings show the contemporary city.');
  }else{
    if(document.pointerLockElement)document.exitPointerLock();
    if(settle&&viewer.camera.positionCartographic.height<15)viewer.camera.moveUp(28);
    $('navigation-hint').textContent='Drag to explore · Right-drag to look · W A S D to fly · Q / E altitude';
  }
  updateHUD();
}
function rotateView(dx,dy){
  if(!viewer)return;const camera=viewer.camera;
  camera.setView({orientation:{heading:camera.heading-dx*.003,pitch:C.Math.clamp(camera.pitch+dy*.003,C.Math.toRadians(-85),C.Math.toRadians(85)),roll:0}});
}
function pointInRing(x,y,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function nearestStreet(p){
  if(!roadFeatures.length)return p;
  const lon=C.Math.toDegrees(p.longitude),lat=C.Math.toDegrees(p.latitude),sx=Math.cos(p.latitude),candidates=[];
  for(const road of roadFeatures){const points=road.geometry.coordinates;for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=(b[0]-a[0])*sx,dy=b[1]-a[1],length=dx*dx+dy*dy;if(!length)continue;
    const t=Math.max(0,Math.min(1,((lon-a[0])*sx*dx+(lat-a[1])*dy)/length));const x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,d=Math.hypot((x-lon)*sx,y-lat);
    if(d<.004)candidates.push({x,y,d,heading:Math.atan2(dx,dy)});
  }}
  candidates.sort((a,b)=>a.d-b.d);
  for(const c of candidates.slice(0,100)){if(!groundFeatures.some(f=>pointInRing(c.x,c.y,f.geometry.coordinates[0]))){const result=C.Cartographic.fromDegrees(c.x,c.y),heading=viewer.camera.heading;const difference=h=>Math.abs(C.Math.negativePiToPi(h-heading));result.walkHeading=difference(c.heading)<difference(c.heading+Math.PI)?c.heading:c.heading+Math.PI;return result;}}
  return p;
}
function setupPointerLook(){
  const canvas=viewer.scene.canvas;let dragging=false,lastX=0,lastY=0;
  canvas.addEventListener('pointerdown',e=>{if(state.mode!=='walk'||e.button!==0)return;dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(state.mode!=='walk'||!dragging||document.pointerLockElement===canvas)return;rotateView(e.clientX-lastX,e.clientY-lastY);lastX=e.clientX;lastY=e.clientY;});
  canvas.addEventListener('pointerup',()=>dragging=false);canvas.addEventListener('pointercancel',()=>dragging=false);
  document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas&&state.mode==='walk')rotateView(e.movementX,e.movementY);});
  $('look').addEventListener('click',async()=>{try{await canvas.requestPointerLock();}catch{showToast('Pointer capture is unavailable here. Drag the scene or use arrow keys to look.');}});
  document.addEventListener('pointerlockchange',()=>{$('look').textContent=document.pointerLockElement===canvas?'ESC TO RELEASE':'LOOK AROUND';});
}
function moveCamera(dt){
  if(!viewer||cameraMoving||$('help').open||!keys.size)return;const camera=viewer.camera;
  const speed=(state.mode==='walk'?3.2:Math.max(20,Math.min(1800,camera.positionCartographic.height*.5)))*(keys.has('Shift')?4:1)*dt;
  if(keys.has('ArrowLeft'))rotateView(65*dt,0);if(keys.has('ArrowRight'))rotateView(-65*dt,0);if(keys.has('ArrowUp'))rotateView(0,65*dt);if(keys.has('ArrowDown'))rotateView(0,-65*dt);
  if(state.mode==='walk'){
    const p=camera.positionCartographic,h=camera.heading;let east=0,north=0;
    if(keys.has('w')){east+=Math.sin(h);north+=Math.cos(h);}if(keys.has('s')){east-=Math.sin(h);north-=Math.cos(h);}if(keys.has('d')){east+=Math.cos(h);north-=Math.sin(h);}if(keys.has('a')){east-=Math.cos(h);north+=Math.sin(h);}
    const magnitude=Math.hypot(east,north);if(magnitude){east/=magnitude;north/=magnitude;camera.setView({destination:C.Cartesian3.fromRadians(p.longitude+east*speed/(6378137*Math.cos(p.latitude)),p.latitude+north*speed/6378137,1.75),orientation:{heading:camera.heading,pitch:camera.pitch,roll:0}});}
  }else{
    if(keys.has('w'))camera.moveForward(speed);if(keys.has('s'))camera.moveBackward(speed);if(keys.has('a'))camera.moveLeft(speed);if(keys.has('d'))camera.moveRight(speed);if(keys.has('q'))camera.moveDown(speed);if(keys.has('e'))camera.moveUp(speed);
    if(camera.positionCartographic.height<1.75){const p=camera.positionCartographic;camera.setView({destination:C.Cartesian3.fromRadians(p.longitude,p.latitude,1.75)});}
  }
  updateHUD();
}
let lastHUD=0;
function updateHUD(){if(!viewer||performance.now()-lastHUD<100)return;lastHUD=performance.now();const p=viewer.camera.positionCartographic;
  $('coordinates').textContent=`${C.Math.toDegrees(p.latitude).toFixed(state.mode==='walk'?5:4)}° N · ${C.Math.toDegrees(p.longitude).toFixed(state.mode==='walk'?5:4)}° E`;
  $('height').textContent=`${p.height>=1000?(p.height/1000).toFixed(2)+' KM':Math.round(p.height*10)/10+' M'} ↑`;
  $('navigation-state').textContent=state.mode==='walk'?'ON FOOT / BERLIN':'FREE FLIGHT';
}

function svgNode(tag,attrs,text){const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;}
function renderTimewell(){
  const axis=$('time-axis'),svg=$('time-drawing'),width=axis.clientWidth,height=axis.clientHeight;if(!width||!height)return;
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.replaceChildren();$('time-objects').replaceChildren();
  const start=state.time-state.span/2,end=state.time+state.span/2,x=t=>(t-start)/state.span*width;
  const ticks=makeTicks(start,end,width);
  for(const tick of ticks){const tx=x(tick.time);svg.append(svgNode('line',{x1:tx,y1:27,x2:tx,y2:height-10,stroke:'#efe9dc','stroke-opacity':'.07'}));svg.append(svgNode('text',{x:tx+4,y:17,fill:'#a9a399','font-size':9,'font-family':'system-ui'},tick.label));}
  const laneHeight=Math.max(22,(height-76)/3),lanes=[[],[],[]];
  const visible=encounters.filter(e=>e.time<=end&&e.end>=start);
  $('visible-count').textContent=`${visible.length} encounter${visible.length===1?'':'s'} in view`;
  // At wide spans, nearby objects share a selectable cluster instead of overwriting one another.
  const anchor=e=>Math.max(start+state.span*.025,e.time);
  const groups=[];for(const e of visible){const group=groups.find(g=>Math.abs(x(anchor(g[0]))-x(anchor(e)))<22);if(group)group.push(e);else groups.push([e]);}
  for(const group of groups){
    const e=group[0],tx=x(anchor(e)),lane=lanes.reduce((best,l,i)=>l.length<lanes[best].length?i:best,0);lanes[lane].push(tx);
    const btn=document.createElement('button');btn.className='time-object';btn.style.left=`${tx}px`;btn.style.top=`${38+lane*laneHeight}px`;if(tx<80)btn.style.transform='translateX(0)';else if(tx>width-80)btn.style.transform='translateX(-100%)';btn.setAttribute('aria-pressed',String(group.some(e=>state.selected===e.id)));
    btn.title=group.length>1?`${group.length} encounters: ${group.map(e=>e.title).join(', ')}. Click to expand this period.`:`${e.year} / ${e.type}: ${e.title}`;
    btn.setAttribute('aria-label',btn.title);
    btn.innerHTML=group.length>1?`<span class="object-icon">◇</span><span class="cluster-count">${group.length}</span><span class="object-title">ENCOUNTERS</span>`:`<span class="object-icon">${e.symbol}</span><span class="object-title">${e.short}</span>`;
    btn.addEventListener('pointerdown',ev=>ev.stopPropagation());btn.addEventListener('click',ev=>{ev.stopPropagation();if(group.length>1){setTime(group.reduce((s,e)=>s+e.time,0)/group.length,{follow:false});setSpan(Math.max(20*YEAR,(group.at(-1).time-group[0].time)*2));}else selectEncounter(e.id);});$('time-objects').append(btn);
    if(e.endYear>e.year){svg.append(svgNode('line',{x1:Math.max(0,tx),x2:Math.min(width,x(e.end)),y1:38+lane*laneHeight+26,y2:38+lane*laneHeight+26,stroke:'#b65e53','stroke-width':2}));}
  }
  maps.forEach((m,i)=>{const tx=x(yearTime(m.year));if(tx<0||tx>width)return;const b=document.createElement('button');b.className='time-map';b.style.left=`${tx}px`;b.style.bottom=`${i%2?8:24}px`;b.textContent=state.span<1600*YEAR?String(m.year):' ';b.title=`${m.year} / ${m.title} · inspect map`;b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed',String(state.map===m.id));b.addEventListener('pointerdown',ev=>ev.stopPropagation());b.addEventListener('click',ev=>{ev.stopPropagation();$('layers').hidden=false;$('layers-toggle').setAttribute('aria-expanded','true');$('encounter').hidden=true;$('auto-map').checked=false;setMap(m.id);});$('time-objects').append(b);});
  document.querySelectorAll('.encounter-row').forEach(b=>{const e=encounters.find(e=>e.id===b.dataset.encounter);b.classList.toggle('is-outside',e.time>end||e.end<start);});
}
function makeTicks(start,end,width){
  const span=end-start,target=span/Math.max(2,Math.floor(width/105));
  const steps=[1000,5000,15000,30000,60000,300000,900000,1800000,3600000,10800000,21600000,43200000,DAY,7*DAY,30*DAY,90*DAY,180*DAY,YEAR,2*YEAR,5*YEAR,10*YEAR,25*YEAR,50*YEAR,100*YEAR,250*YEAR,500*YEAR,1000*YEAR,2500*YEAR,5000*YEAR];
  const step=steps.find(s=>s>=target)||5000*YEAR,ticks=[];
  if(step>=YEAR){const sy=new Date(start).getUTCFullYear(),years=Math.round(step/YEAR);for(let y=Math.ceil(sy/years)*years;y<=new Date(end).getUTCFullYear()+years;y+=years){const t=yearTime(y);if(t>=start&&t<=end)ticks.push({time:t,label:yearLabel(y)});}}
  else {for(let t=Math.ceil(start/step)*step;t<=end;t+=step){const d=new Date(t);const label=step>=DAY?`${d.getUTCDate()} ${d.toLocaleString('en',{month:'short',timeZone:'UTC'})}`:clockLabel(d).slice(0,step<60000?8:5);ticks.push({time:t,label});if(ticks.length>100)break;}}
  return ticks;
}
function setupTimewell(){
  const axis=$('time-axis');let drag=null,moved=false;
  axis.addEventListener('pointerdown',ev=>{if(ev.button!==0||ev.target.closest('button'))return;keys.clear();drag={x:ev.clientX,time:state.time};moved=false;axis.setPointerCapture(ev.pointerId);});
  axis.addEventListener('pointermove',ev=>{if(!drag)return;if(Math.abs(ev.clientX-drag.x)>3)moved=true;setTime(drag.time-(ev.clientX-drag.x)/axis.clientWidth*state.span);});
  axis.addEventListener('pointerup',ev=>{if(!drag)return;if(!moved){const rect=axis.getBoundingClientRect();setTime(state.time+((ev.clientX-rect.left)/rect.width-.5)*state.span);}drag=null;});axis.addEventListener('pointercancel',()=>drag=null);
  axis.addEventListener('wheel',ev=>{ev.preventDefault();setSpan(state.span*Math.exp(ev.deltaY*.0025));},{passive:false});
  axis.addEventListener('keydown',ev=>{if(['ArrowLeft','ArrowRight','+','=','-','_'].includes(ev.key)){ev.preventDefault();ev.stopPropagation();if(ev.key==='ArrowLeft')setTime(state.time-state.span/40);else if(ev.key==='ArrowRight')setTime(state.time+state.span/40);else setSpan(state.span*(ev.key==='-'||ev.key==='_'?1.5:1/1.5));}});
  $('time-scale').addEventListener('input',()=>setSpan(MIN_SPAN*Math.pow(MAX_SPAN/MIN_SPAN,Number($('time-scale').value)/1000)));
  $('zoom-in').onclick=()=>setSpan(state.span/1.8);$('zoom-out').onclick=()=>setSpan(state.span*1.8);
  $('time-reset').onclick=()=>{setTime(Date.UTC(1830,0,1),{follow:false});setSpan(480*YEAR);};
  $('time-play').onclick=()=>{state.playing=!state.playing;$('time-play').textContent=state.playing?'Ⅱ':'▶';$('time-play').setAttribute('aria-label',state.playing?'Pause historical time':'Play historical time');$('time-play').setAttribute('aria-pressed',String(state.playing));};
  $('time-expand').onclick=()=>{const expanded=document.body.classList.toggle('well-expanded');$('time-expand').textContent=expanded?'CONTRACT ↙':'EXPAND ↗';$('time-expand').setAttribute('aria-expanded',String(expanded));requestAnimationFrame(()=>{viewer?.resize();requestTimeline();});};
  $('date-toggle').onclick=()=>{$('date-form').hidden=!$('date-form').hidden;if(!$('date-form').hidden){$('exact-date').value=toInputDate(state.time);$('exact-date').focus();}};
  $('date-form').addEventListener('submit',ev=>{ev.preventDefault();const parsed=parseDate($('exact-date').value);if(parsed===null){$('date-error').textContent='Use YYYY-MM-DDTHH:MM:SS or a year such as 500 BCE.';return;}$('date-error').textContent='';setTime(parsed);$('date-form').hidden=true;});
  new ResizeObserver(requestTimeline).observe(axis);setSpan(state.span);
}
function toInputDate(t){const d=new Date(t);return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}T${clockLabel(d)}`;}
function parseDate(value){
  const bce=value.trim().match(/^(\d+)\s*(BCE|BC)$/i);if(bce){const y=1-Number(bce[1]);return Number(bce[1])>=1&&y>=-9999?yearTime(y):null;}
  const match=value.trim().match(/^(-?\d{1,5})(?:-(\d{2})-(\d{2}))?(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?Z?)?$/);if(!match)return null;
  const [,ys,mos='01',ds='01',hs='00',mis='00',ss='00']=match;const [y,mo,day,h,mi,s]=[ys,mos,ds,hs,mis,ss].map(Number);
  if(y < -9999||y>12000||mo<1||mo>12||day<1||day>31||h>23||mi>59||s>59)return null;
  const d=new Date(yearTime(y));d.setUTCMonth(mo-1,day);d.setUTCHours(h,mi,s,0);return d.getUTCFullYear()===y&&d.getUTCMonth()===mo-1&&d.getUTCDate()===day?+d:null;
}

function bindControls(){
  $('fly').onclick=()=>setMode('fly');$('walk').onclick=()=>setMode('walk');
  $('collection-toggle').onclick=()=>{$('collection').hidden=!$('collection').hidden;$('collection-toggle').setAttribute('aria-expanded',String(!$('collection').hidden));};
  $('layers-toggle').onclick=()=>{$('layers').hidden=!$('layers').hidden;$('layers-toggle').setAttribute('aria-expanded',String(!$('layers').hidden));if(!$('layers').hidden){$('encounter').hidden=true;stopMedia();}};
  $('layers-close').onclick=()=>{$('layers').hidden=true;$('layers-toggle').setAttribute('aria-expanded','false');};
  $('encounter-close').onclick=()=>{$('encounter').hidden=true;stopMedia();};
  $('travel').onclick=()=>travelTo(state.selected);
  $('next').onclick=()=>travelTo(encounters[(state.sequence+1)%encounters.length].id);
  $('previous').onclick=()=>travelTo(encounters[(Math.max(0,state.sequence)-1+encounters.length)%encounters.length].id);
  $('overview').onclick=()=>{if(!viewer)return;setMode('fly',{settle:false});viewer.camera.flyTo({destination:C.Cartesian3.fromDegrees(13.375,52.497,1650),orientation:{heading:C.Math.toRadians(24),pitch:C.Math.toRadians(-36),roll:0},duration:reducedMotion?0:2});$('encounter').hidden=true;stopMedia();};
  $('buildings').onchange=()=>{if(buildingSource)buildingSource.show=$('buildings').checked;};
  document.querySelectorAll('[data-ground]').forEach(b=>b.onclick=()=>setGround(b.dataset.ground));
  $('auto-map').onchange=()=>setTime(state.time);$('clear-map').onclick=()=>{$('auto-map').checked=false;setMap(null);};
  $('opacity').oninput=()=>{$('opacity-value').textContent=`${$('opacity').value}%`;if(historicalLayer)historicalLayer.alpha=Number($('opacity').value)/100;};
  $('north').onclick=()=>{if(viewer)viewer.camera.setView({orientation:{heading:0,pitch:viewer.camera.pitch,roll:0}});};
  $('rise').onclick=()=>{if(viewer)viewer.camera.moveUp(Math.max(10,viewer.camera.positionCartographic.height*.2));updateHUD();};
  $('lower').onclick=()=>{if(viewer)viewer.camera.moveDown(Math.max(1,Math.min(viewer.camera.positionCartographic.height-1.75,viewer.camera.positionCartographic.height*.2)));updateHUD();};
  const openHelp=()=>{stopMedia();keys.clear();if(document.pointerLockElement)document.exitPointerLock();$('help').showModal();};
  $('help-toggle').onclick=openHelp;$('sources-open').onclick=openHelp;$('help-close').onclick=()=>$('help').close();
  $('help').addEventListener('click',ev=>{if(ev.target===$('help')){const r=$('help').getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)$('help').close();}});
  document.addEventListener('keydown',ev=>{
    if(ev.key==='Escape'){$('date-form').hidden=true;keys.clear();return;}
    if(ev.target.closest('input,textarea,select,[role=slider]')||$('help').open)return;
    const key=ev.key.length===1?ev.key.toLowerCase():ev.key;
    if(['w','a','s','d','q','e','Shift','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key)){ev.preventDefault();keys.add(key);if(!ev.repeat)moveCamera(.04);}
  });
  document.addEventListener('keyup',ev=>keys.delete(ev.key.length===1?ev.key.toLowerCase():ev.key));window.addEventListener('blur',()=>keys.clear());
  document.addEventListener('visibilitychange',()=>{keys.clear();if(document.hidden){stopMedia();state.playing=false;$('time-play').textContent='▶';$('time-play').setAttribute('aria-pressed','false');}});
}

buildCollection();bindControls();setupTimewell();
try{const responses=await Promise.all([fetch('./data/hypercities-berlin.json'),fetch('./assets/manifest.json')]);mapCatalog=await responses[0].json();assetManifest=await responses[1].json();}catch(error){console.warn('Some cached map metadata is missing; live providers will be used.',error);}
await initScene();
