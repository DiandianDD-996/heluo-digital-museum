from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
import re

base = Path(__file__).parent
for source in base.glob('*.md'):
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Inches(8.5), Inches(11)
    sec.top_margin = sec.bottom_margin = Inches(.65)
    sec.left_margin = sec.right_margin = Inches(.65)
    for name in ['Normal', 'Title', 'Heading 1', 'Heading 2', 'Heading 3']:
        st = doc.styles[name]
        st.font.name = 'Microsoft YaHei'
        st.element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'), 'Microsoft YaHei')
        st.font.color.rgb = RGBColor(0,0,0)
        st.font.size = Pt(10.5 if name == 'Normal' else 18 if name == 'Title' else 13)
        st.paragraph_format.space_after = Pt(6)
    def clean(t):
        return re.sub(r'[`*]', '', t)
    lines=source.read_text(encoding='utf-8').splitlines()
    i=0
    while i<len(lines):
        line=lines[i]
        if line.startswith('|'):
            rows=[]
            while i<len(lines) and lines[i].startswith('|'):
                if not re.match(r'^\|[\s:|\-]+$',lines[i]):
                    rows.append([clean(c.strip()) for c in lines[i].strip('|').split('|')])
                i+=1
            table=doc.add_table(rows=0, cols=len(rows[0]))
            table.autofit=False
            for ridx,row in enumerate(rows):
                cells=table.add_row().cells
                for c,text in zip(cells,row):
                    c.text=text
                    for p in c.paragraphs:
                        p.paragraph_format.space_after=Pt(4)
                        p.paragraph_format.space_before=Pt(4)
                        for r in p.runs: r.font.size=Pt(9)
                    pr=c._tc.get_or_add_tcPr()
                    borders=OxmlElement('w:tcBorders')
                    for edge in ['top','left','bottom','right']:
                        e=OxmlElement('w:'+edge); e.set(qn('w:val'),'single');e.set(qn('w:sz'),'4');e.set(qn('w:color'),'D9D9D9');borders.append(e)
                    pr.append(borders)
                    if ridx==0:
                        sh=OxmlElement('w:shd');sh.set(qn('w:fill'),'DFEAF2');pr.append(sh)
                if ridx==0:
                    repeat=OxmlElement('w:tblHeader');table.rows[-1]._tr.get_or_add_trPr().append(repeat)
            doc.add_paragraph()
            continue
        if line=='<!-- pagebreak -->': doc.add_page_break()
        elif line.startswith('# '): doc.add_paragraph(clean(line[2:]),'Title')
        elif line.startswith('### '): doc.add_heading(clean(line[4:]),2)
        elif line.startswith('## '): doc.add_heading(clean(line[3:]),1)
        elif line.strip(): doc.add_paragraph(clean(line))
        i+=1
    doc.save(source.with_suffix('.docx'))
    print(source.with_suffix('.docx'))
