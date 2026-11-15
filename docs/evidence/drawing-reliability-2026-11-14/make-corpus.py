from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib, shutil

out = Path(__file__).parent
(out / 'inputs').mkdir(exist_ok=True)
items = []
def add(name, expected, draw=None, source=None, notes=''):
    p = out / 'inputs' / f'{len(items)+1:02d}.jpg'
    if source:
        shutil.copyfile(source, p)
    else:
        im = Image.new('RGB', (1600, 1000), '#fffef7')
        d = ImageDraw.Draw(im)
        draw(d)
        im.save(p, quality=92)
    items.append(dict(id=f'case-{len(items)+1:02d}', image=p.name, sha256=hashlib.sha256(p.read_bytes()).hexdigest(), subject=name, expected=expected, notes=notes))
def line(d,p): d.line(p, fill='#111111', width=7, joint='curve')
def rect(d,b): d.rectangle(b, outline='#111111', width=7)
def ellipse(d,b): d.ellipse(b, outline='#111111', width=7)
add('unlabelled-house', 'Walls, pointed gabled roof, two windows, door and drawn support; no roof/support gap.', source='docs/evidence/drawing-diversity-2026-11-14/generated-input.jpg')
add('annotated-sphere-plank', 'Sphere diameter 1m mass 1kg, plank length 3m, ground; correct contact/resting state.', source='docs/evidence/cloudflare-2026-11-14/generated-input.jpg')
add('chair', 'Back, seat, visible legs and ground; coherent rigid display.', lambda d:(rect(d,(560,190,1010,480)),line(d,[(560,190),(560,760)]),line(d,[(1010,190),(1010,760)]),line(d,[(560,480),(450,570),(900,570),(1010,480)]),line(d,[(450,570),(450,840)]),line(d,[(900,570),(900,840)]),line(d,[(280,850),(1200,850)])))
add('tree', 'Narrow trunk, broad rounded canopy and support; rigid scenery, no invented biological motion.', lambda d:(line(d,[(710,790),(740,490),(810,490),(850,790)]),line(d,[(740,550),(600,400)]),line(d,[(800,550),(960,420)]),ellipse(d,(430,160,790,500)),ellipse(d,(690,90,1050,440)),ellipse(d,(880,240,1180,550)),line(d,[(300,795),(1260,795)])))
add('character', 'Head, torso, two arms, two legs; rigid figurine, no invented walking.', lambda d:(ellipse(d,(650,140,930,400)),rect(d,(670,400,910,650)),line(d,[(670,430),(470,610)]),line(d,[(910,430),(1090,610)]),line(d,[(720,650),(640,860)]),line(d,[(860,650),(960,860)]),ellipse(d,(700,240,730,270)),ellipse(d,(840,240,870,270)),line(d,[(735,330),(845,330)]),line(d,[(350,880),(1220,880)])))
add('car', 'Car cabin, two round wheels and ground; coherent rigid approximation without invented motor.', lambda d:(line(d,[(360,650),(360,500),(540,480),(650,330),(930,330),(1060,490),(1240,530),(1250,650),(360,650)]),line(d,[(560,480),(1020,480)]),line(d,[(800,340),(800,480)]),ellipse(d,(470,560,680,770)),ellipse(d,(1000,560,1210,770)),line(d,[(240,785),(1390,785)])))
add('abstract-shapes', 'Triangular prism, sphere and box supported by drawn table/legs and ground; preserve relative order.', lambda d:(rect(d,(350,690,1280,740)),line(d,[(450,740),(450,900)]),line(d,[(1170,740),(1170,900)]),line(d,[(420,690),(620,360),(820,690),(420,690)]),ellipse(d,(900,490,1100,690)),rect(d,(720,550,850,690)),line(d,[(260,910),(1400,910)])))
add('blank', 'No fabricated ready scene; request a readable drawing or reject.', lambda d:None)
add('fluid-intent', 'Ask about a rigid proxy or reject essential actual fluid behavior; no fake fluid simulation.', lambda d:(line(d,[(550,250),(590,790),(1040,790),(1080,250)]),line(d,[(575,500),(1055,500)]),line(d,[(350,805),(1250,805)])), notes='Simulate the water flowing out when the glass is tilted. Actual fluid flow is essential.')
def lever(d):
    line(d,[(370,520),(1190,520)])
    line(d,[(370,560),(1190,560)])
    line(d,[(780,560),(640,800),(920,800),(780,560)])
    ellipse(d,(755,535,805,585))
    ellipse(d,(420,360,580,520))
    line(d,[(250,805),(1330,805)])
    d.text((700,835),'pivot',fill='black',stroke_width=1)
add('pivoting-lever', 'Lever, fulcrum/ground and ball; actual aligned free hinge, no motor.', lever, notes='The lever rotates freely about the drawn pivot. The ball can fall; no motor.')
assert len(items) == 10 and len({i['sha256'] for i in items}) == 10
(out/'corpus.json').write_text(json.dumps(dict(frozenBeforeInference=True, scope='Generated digital drawings, not a physical-camera corpus or population accuracy benchmark. Subject/gold criteria are not sent to the model.', cases=items, repeats=['case-01','case-05']), indent=2))
print('Frozen 10 diverse cases plus two repeats before inference')
