"""Prepare PRIVATE screenshot fixtures; requires Pillow, never uploads images."""
from pathlib import Path
from PIL import Image, ImageOps
import gzip, io, json, sys
source=Path(sys.argv[1]).resolve()
out=Path(sys.argv[2]).resolve()
out.mkdir(parents=True,exist_ok=True)
records=[]
for row in json.loads(source.read_text(encoding='utf-8-sig'))['images']:
    image=ImageOps.exif_transpose(Image.open((source.parent/row['path']).resolve())).convert('RGBA')
    def variant(name,im,turn=0,bounded=True):
        target=out/(row['name']+'-'+name+'.rgba.gz')
        target.write_bytes(gzip.compress(im.tobytes(),compresslevel=5))
        records.append({'name':row['name']+'/'+name,'pixels':target.name,'width':im.width,'height':im.height,'turn':turn,'expected':{'cards':row['cards'],'columns':row.get('columns',7),'bounded':bounded}})
    variant('original',image)
    for name,scale in [('small',.65),('large',1.5)]:
        variant(name,image.resize((round(image.width*scale),round(image.height*scale)),Image.Resampling.LANCZOS))
    canvas=Image.new('RGBA',(max(image.width*2,image.height),image.height),(255,255,255,255));canvas.paste(image,((canvas.width-image.width)//2,0));variant('landscape-margins',canvas)
    buffer=io.BytesIO();image.convert('RGB').save(buffer,'JPEG',quality=45);buffer.seek(0);variant('compressed',Image.open(buffer).convert('RGBA'))
    variant('sideways',image.transpose(Image.Transpose.ROTATE_270),270)
    variant('upside-down',image.transpose(Image.Transpose.ROTATE_180),180)
    if row.get('headerless_top') is not None:
        variant('missing-heading',image.crop((0,row['headerless_top'],image.width,image.height)),bounded=False)
(out/'manifest.json').write_text(json.dumps({'cases':records},indent=2),encoding='utf-8')
print(str(out/'manifest.json'))
