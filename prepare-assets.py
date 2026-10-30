"""Prepare reproducible, attributed local map and media fixtures. Run with Pillow."""
import base64, concurrent.futures, io, json, math, os, struct, subprocess, urllib.request, wave
from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parent
ASSETS=ROOT/'assets'
ASSETS.mkdir(exist_ok=True)
Z=14; X0,X1,Y0,Y1=8799,8804,5372,5375
def lon(x):return x/2**Z*360-180
def lat(y):return math.degrees(math.atan(math.sinh(math.pi*(1-2*y/2**Z))))
BBOX=[lon(X0),lat(Y1),lon(X1),lat(Y0)]
def fetch(url):
    if 'gdi.berlin.de' in url:
        return subprocess.check_output(['curl','-fL','--max-time','40','-sS',url])
    req=urllib.request.Request(url,headers={'User-Agent':'HyperCities-Berlin-Prototype/0.1 (local research preview)'})
    with urllib.request.urlopen(req,timeout=22) as r:return r.read()
def tile(args):
    name,x,y=args
    try:
        data=fetch(f'https://tiles.ats.ucla.edu/tiles/{name}/{Z}/{x}/{y}.png')
        im=Image.open(io.BytesIO(data));im.load()
        return x,y,im.convert('RGBA')
    except Exception as e:
        print(f'Tile unavailable: {name}/{x}/{y}: {type(e).__name__}',flush=True)
        return x,y,None
def geographic(atlas):
    # Resample Mercator tile rows onto equally spaced geographic latitude rows.
    w,h=atlas.size;mesh=[];north,south=BBOX[3],BBOX[1]
    def source_y(out_y):
        latitude=north+(south-north)*out_y/h
        return ((1-math.asinh(math.tan(math.radians(latitude)))/math.pi)/2*2**Z-Y0)*256
    for y in range(0,h,8):
        y2=min(y+8,h);sy1,sy2=source_y(y),source_y(y2)
        mesh.append(((0,y,w,y2),(0,sy1,0,sy2,w,sy2,w,sy1)))
    return atlas.transform((w,h),Image.Transform.MESH,mesh,Image.Resampling.BICUBIC)

manifest=json.loads((ASSETS/'manifest.json').read_text()) if (ASSETS/'manifest.json').exists() else {}
for key,name in [('hc-1650','Berlin_1650'),('hc-1805','Berlin_1805'),('hc-1905','Berlin_1905'),('hc-1947','Berlin_1947'),('hc-1986','Berlin_1986')]:
    if key in manifest and (ASSETS/manifest[key]['file']).exists():continue
    atlas=Image.new('RGBA',((X1-X0)*256,(Y1-Y0)*256),(0,0,0,0));success=0
    jobs=[(name,x,y) for y in range(Y0,Y1) for x in range(X0,X1)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for x,y,im in pool.map(tile,jobs):
            if im is not None:atlas.paste(im,((x-X0)*256,(y-Y0)*256));success+=1
    if success:
        atlas=geographic(atlas);atlas.save(ASSETS/f'{key}.png',optimize=True)
        if key=='hc-1905':atlas.convert('RGB').save(ASSETS/'hc-1905.jpg',quality=90)
        manifest[key]={'file':f'{key}.png','bbox':BBOX,'tiles':success,'expectedTiles':len(jobs),'source':f'https://tiles.ats.ucla.edu/tiles/{name}/','projection':'EPSG:4326, resampled from EPSG:3857'}
    print(key,success,'/',len(jobs),flush=True)

def wms_job(args):
    key,layer=args
    # Projected coordinates avoid the WMS 1.3 latitude/longitude axis-order ambiguity.
    def merc(lon,lat):return (math.radians(lon)*6378137,math.log(math.tan(math.pi/4+math.radians(lat)/2))*6378137)
    west,south=merc(BBOX[0],BBOX[1]);east,north=merc(BBOX[2],BBOX[3])
    url=f'https://gdi.berlin.de/services/wms/staedtebauliche_entwicklung?service=WMS&version=1.1.1&request=GetMap&layers={layer}&styles=&srs=EPSG:3857&bbox={west},{south},{east},{north}&width=1280&height=768&format=image/png&transparent=true'
    try:
        im=Image.open(io.BytesIO(fetch(url)));im.load();im=geographic(im.convert('RGBA'));im.save(ASSETS/f'{key}.png',optimize=True)
        return key,{'file':f'{key}.png','bbox':BBOX,'source':url,'projection':'EPSG:4326, resampled from EPSG:3857'}
    except Exception as e:print('WMS unavailable:',key,str(e)[:100],flush=True);return key,None
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    for key,result in pool.map(wms_job,[('berlin-1910','berlin_1910'),('berlin-1945','berlin_1945_gebaeudeschaeden'),('berlin-1986','berlin_1986')]):
        if result:manifest[key]=result
(ASSETS/'manifest.json').write_text(json.dumps(manifest,indent=2))

# glTF architectural massing study: dimensions in meters, local y is up.
positions=[];colors=[];indices=[]
def box(cx,cy,cz,w,h,d,color):
    first=len(positions)
    for x,y,z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]:
        positions.append((cx+x*w/2,cy+y*h/2,cz+z*d/2));colors.append(color)
    for face in [(0,2,1),(0,3,2),(4,5,6),(4,6,7),(0,1,5),(0,5,4),(3,7,6),(3,6,2),(0,4,7),(0,7,3),(1,2,6),(1,6,5)]:indices.extend(first+i for i in face)
box(0,15.5,0,180,31,85,(.40,.27,.18,1))
box(0,32,0,182,2,87,(.66,.59,.47,1))
for z in [-42.6,42.6]:
    for x in range(-84,85,12):box(x,17,z,9,20,.6,(.24,.33,.34,1))
for x in [-90.4,90.4]:
    for z in range(-36,37,12):box(x,17,z,.6,20,9,(.24,.33,.34,1))
raw=b''.join(struct.pack('<3f',*p) for p in positions);p_len=len(raw)
raw+=b''.join(struct.pack('<4f',*c) for c in colors);c_len=len(raw)-p_len
raw+=struct.pack('<'+'H'*len(indices),*indices);i_len=len(raw)-p_len-c_len
gltf={'asset':{'version':'2.0','generator':'HyperCities · approximate Palast massing study, not an archival reconstruction'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0}],
'buffers':[{'uri':'data:application/octet-stream;base64,'+base64.b64encode(raw).decode(),'byteLength':len(raw)}],
'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':p_len,'target':34962},{'buffer':0,'byteOffset':p_len,'byteLength':c_len,'target':34962},{'buffer':0,'byteOffset':p_len+c_len,'byteLength':i_len,'target':34963}],
'accessors':[{'bufferView':0,'componentType':5126,'count':len(positions),'type':'VEC3','min':[min(p[i] for p in positions) for i in range(3)],'max':[max(p[i] for p in positions) for i in range(3)]},{'bufferView':1,'componentType':5126,'count':len(colors),'type':'VEC4'},{'bufferView':2,'componentType':5123,'count':len(indices),'type':'SCALAR'}],
'materials':[{'pbrMetallicRoughness':{'metallicFactor':0,'roughnessFactor':1},'doubleSided':True,'extensions':{'KHR_materials_unlit':{}}}], 'extensionsUsed':['KHR_materials_unlit'],
'meshes':[{'primitives':[{'attributes':{'POSITION':0,'COLOR_0':1},'indices':2,'material':0}]}]}
(ASSETS/'palast-study.gltf').write_text(json.dumps(gltf,separators=(',',':')))

# Original synthetic sound, not archival audio. Quiet pulses and bell-like tones.
rate=22050;duration=16;samples=[]
for i in range(rate*duration):
    t=i/rate;fade=min(1,t/1.5,(duration-t)/2);v=.06*math.sin(2*math.pi*82.4*t)*(0.4+.6*math.sin(math.pi*t/.9)**2)
    for onset,freq in [(1,392),(3.7,440),(6.2,523.25),(8.4,349.23),(11,392),(13.3,587.33)]:
        dt=t-onset
        if 0<=dt<3:v+=.16*math.exp(-dt*2.3)*math.sin(2*math.pi*freq*dt)*(1-math.exp(-dt*40))
    samples.append(struct.pack('<h',int(max(-1,min(1,v*fade))*32767)))
with wave.open(str(ASSETS/'threshold-study.wav'),'wb') as out:out.setnchannels(1);out.setsampwidth(2);out.setframerate(rate);out.writeframes(b''.join(samples))
print('Prepared map manifest, model, and sound.',flush=True)
