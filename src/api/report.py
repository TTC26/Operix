"""Bizvora — professional DPR PDF renderer (Vercel Python function).

POST /api/report with the JSON payload built by js/reportpro.js.
Checks that the signed-in user has unlocked the project (or has full access),
then renders a bank-ready PDF with cover, contents, charts, diagrams and annexures.
"""
import base64
import io
import json
import os
import re
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler
from xml.sax.saxutils import escape

from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.doughnut import Doughnut
from reportlab.graphics.shapes import Drawing, Line, Polygon, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader, simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, CondPageBreak, Flowable, Frame, Image, KeepTogether,
                                ListFlowable, ListItem, NextPageTemplate, PageBreak, PageTemplate,
                                Paragraph, Spacer, Table, TableStyle)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfgen import canvas as rl_canvas

# ---------- fonts & palette ----------
HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIRS = [os.path.join(HERE, '..', 'fonts'), os.path.join(os.getcwd(), 'fonts')]


def _font(name):
    for d in FONT_DIRS:
        p = os.path.join(d, name)
        if os.path.exists(p):
            return p
    raise FileNotFoundError(name)


_FONTS_DONE = False


def register_fonts():
    global _FONTS_DONE
    if _FONTS_DONE:
        return
    pdfmetrics.registerFont(TTFont('Body', _font('Carlito-Regular.ttf')))
    pdfmetrics.registerFont(TTFont('Body-B', _font('Carlito-Bold.ttf')))
    pdfmetrics.registerFont(TTFont('Body-I', _font('Carlito-Italic.ttf')))
    pdfmetrics.registerFont(TTFont('Head', _font('Poppins-Bold.ttf')))
    pdfmetrics.registerFont(TTFont('HeadM', _font('Poppins-Medium.ttf')))
    from reportlab.lib.fonts import addMapping
    addMapping('Body', 0, 0, 'Body'); addMapping('Body', 1, 0, 'Body-B'); addMapping('Body', 0, 1, 'Body-I'); addMapping('Body', 1, 1, 'Body-B')
    _FONTS_DONE = True


INK = colors.HexColor('#1C2A20')
MUTED = colors.HexColor('#5D6E61')
GREEN = colors.HexColor('#2F7D4F')
GREEN_D = colors.HexColor('#24603D')
LIME = colors.HexColor('#C3DC52')
LIME_S = colors.HexColor('#F1F7D6')
MINT_S = colors.HexColor('#EAF6EF')
PINK = colors.HexColor('#E9A8BA')
PINK_S = colors.HexColor('#FCEEF2')
LINE = colors.HexColor('#DCE7D3')
ZEBRA = colors.HexColor('#F8FBF4')
RED = colors.HexColor('#C23B55')
SERIES = [GREEN, LIME, PINK, colors.HexColor('#7FB89A'), colors.HexColor('#A9C23A'), colors.HexColor('#D0668A'), colors.HexColor('#5D6E61'), colors.HexColor('#B7D8C6')]

PW, PH = A4
MARGIN = 18 * mm


def styles():
    s = {}
    s['body'] = ParagraphStyle('body', fontName='Body', fontSize=10.5, leading=15, textColor=INK, alignment=TA_JUSTIFY, spaceAfter=6)
    s['h1'] = ParagraphStyle('h1', fontName='Head', fontSize=15, leading=19, textColor=INK)
    s['h3'] = ParagraphStyle('h3', fontName='HeadM', fontSize=11, leading=15, textColor=GREEN, spaceBefore=8, spaceAfter=4)
    s['cell'] = ParagraphStyle('cell', fontName='Body', fontSize=9.2, leading=11.5, textColor=INK)
    s['cellS'] = ParagraphStyle('cellS', fontName='Body', fontSize=7.8, leading=9.5, textColor=INK)
    s['head'] = ParagraphStyle('head', fontName='Body-B', fontSize=9, leading=11, textColor=colors.white)
    s['headS'] = ParagraphStyle('headS', fontName='Body-B', fontSize=7.8, leading=9.5, textColor=colors.white)
    s['bullet'] = ParagraphStyle('bullet', parent=s['body'], alignment=TA_LEFT, spaceAfter=2)
    s['caption'] = ParagraphStyle('caption', fontName='Body-I', fontSize=8.5, leading=11, textColor=MUTED)
    s['kpiL'] = ParagraphStyle('kpiL', fontName='Body-B', fontSize=8, leading=10, textColor=MUTED)
    s['kpiV'] = ParagraphStyle('kpiV', fontName='Head', fontSize=13, leading=16, textColor=INK)
    s['kpiN'] = ParagraphStyle('kpiN', fontName='Body', fontSize=8, leading=10, textColor=MUTED)
    s['toc0'] = ParagraphStyle('toc0', fontName='Body', fontSize=11, leading=17, textColor=INK, leftIndent=0)
    s['toc1'] = ParagraphStyle('toc1', fontName='Body', fontSize=10, leading=15, textColor=MUTED, leftIndent=14)
    s['small'] = ParagraphStyle('small', fontName='Body-I', fontSize=8.5, leading=12, textColor=MUTED, alignment=TA_JUSTIFY)
    s['swotH'] = ParagraphStyle('swotH', fontName='HeadM', fontSize=10.5, leading=13, textColor=INK)
    return s


# ---------- page decoration ----------
class NumberedCanvas(rl_canvas.Canvas):
    """Adds 'Page x of y' after the whole document is laid out."""

    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self._saved = []

    def showPage(self):
        self._saved.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        n = len(self._saved)
        for st in self._saved:
            self.__dict__.update(st)
            if self._pageNumber > 1:
                w, h = self._pagesize
                self.setFont('Body', 8)
                self.setFillColor(MUTED)
                self.drawRightString(w - MARGIN, 10 * mm, 'Page %d of %d' % (self._pageNumber, n))
            super().showPage()
        super().save()


def draw_cover(c, doc):
    m = doc.meta
    c.saveState()
    c.setFillColor(LIME_S); c.rect(0, PH * 0.42, PW, PH * 0.58, stroke=0, fill=1)
    p = c.beginPath(); p.moveTo(PW * 0.55, PH * 0.42); p.lineTo(PW, PH * 0.42); p.lineTo(PW, PH * 0.72); p.close()
    c.setFillColor(PINK_S); c.drawPath(p, stroke=0, fill=1)
    c.setFillColor(GREEN); c.rect(0, PH - 9 * mm, PW, 9 * mm, stroke=0, fill=1)
    x = MARGIN + 4 * mm; y = PH - 52 * mm
    # Title: "DETAILED PROJECT REPORT" is the main heading; the company name is not shown on the cover.
    c.setFillColor(INK)
    for ln in ['DETAILED', 'PROJECT REPORT']:
        c.setFont('Head', 38); c.drawString(x, y, ln); y -= 44
    c.setStrokeColor(LIME); c.setLineWidth(4); c.line(x, y + 26, x + 46 * mm, y + 26)
    y -= 10
    comp = (m.get('company') or '').strip().lower()
    proj = (m.get('project') or '').strip()
    if proj and proj.lower() != comp:
        c.setFont('HeadM', 16); c.setFillColor(GREEN_D)
        for ln in simpleSplit(proj, 'HeadM', 16, PW - 2 * MARGIN - 10 * mm)[:2]:
            c.drawString(x, y, ln); y -= 21
    act = (m.get('activity') or '').strip()
    if act:
        y -= 2; c.setFont('Body', 12); c.setFillColor(MUTED)
        for ln in simpleSplit(act, 'Body', 12, PW - 2 * MARGIN - 30 * mm)[:3]:
            c.drawString(x, y, ln); y -= 16
    # cover image or motif
    box_y, box_h = PH * 0.42 - 70 * mm, 92 * mm
    img = data_image(m.get('cover'))
    if img:
        iw, ih = img.getSize(); bw, bh = PW - 2 * MARGIN, box_h
        sc = min(bw / iw, bh / ih); dw, dh = iw * sc, ih * sc
        dx = MARGIN + (bw - dw) / 2; dy = box_y + (bh - dh) / 2
        c.setFillColor(colors.white); c.setStrokeColor(LINE); c.roundRect(dx - 4, dy - 4, dw + 8, dh + 8, 6, stroke=1, fill=1)
        c.drawImage(img, dx, dy, dw, dh, mask='auto')
    else:
        bars = [0.35, 0.5, 0.62, 0.74, 0.82, 0.9, 0.95]
        bw = (PW - 2 * MARGIN - 6 * 6 * mm) / 7
        for i, v in enumerate(bars):
            c.setFillColor(GREEN if i % 2 == 0 else LIME)
            c.roundRect(MARGIN + i * (bw + 6 * mm), box_y + 6 * mm, bw, (box_h - 14 * mm) * v, 3, stroke=0, fill=1)
        c.setStrokeColor(LINE); c.setLineWidth(1); c.line(MARGIN, box_y + 6 * mm, PW - MARGIN, box_y + 6 * mm)
    # info strip
    items = [('Project cost', m.get('cost', '')), ('Report type', m.get('modeName', '')), ('Location', m.get('location', '')), ('Submitted to', m.get('bank') or '—')]
    sy = 34 * mm; cw = (PW - 2 * MARGIN) / 4
    c.setStrokeColor(LINE); c.setLineWidth(0.8); c.line(MARGIN, sy + 17 * mm, PW - MARGIN, sy + 17 * mm)
    for i, (k, v) in enumerate(items):
        cx = MARGIN + i * cw
        c.setFont('Body-B', 8); c.setFillColor(MUTED); c.drawString(cx, sy + 10 * mm, k.upper())
        c.setFont('Body-B', 10.5); c.setFillColor(INK)
        for j, ln in enumerate(simpleSplit(str(v), 'Body-B', 10.5, cw - 4 * mm)[:2]):
            c.drawString(cx, sy + 4 * mm - j * 12, ln)
    c.setFont('Body', 9); c.setFillColor(MUTED); c.drawString(MARGIN, 16 * mm, 'Prepared on ' + (m.get('prepared') or ''))
    c.drawRightString(PW - MARGIN, 16 * mm, 'Prepared using Bizvora')
    c.restoreState()


def draw_body(c, doc):
    w, h = c._pagesize
    c.saveState()
    c.setFont('Body', 8); c.setFillColor(MUTED)
    c.drawString(MARGIN, h - 11 * mm, doc.meta.get('company', ''))
    c.drawRightString(w - MARGIN, h - 11 * mm, 'Detailed Project Report')
    c.setStrokeColor(LIME); c.setLineWidth(1.2); c.line(MARGIN, h - 13 * mm, w - MARGIN, h - 13 * mm)
    c.setStrokeColor(LINE); c.setLineWidth(0.6); c.line(MARGIN, 14 * mm, w - MARGIN, 14 * mm)
    c.drawString(MARGIN, 10 * mm, (doc.meta.get('project') or '')[:90])
    c.restoreState()


class DPRDoc(BaseDocTemplate):
    def __init__(self, buf, meta):
        super().__init__(buf, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=20 * mm, bottomMargin=20 * mm,
                         title='Detailed Project Report — ' + (meta.get('company') or ''), author=meta.get('company') or '', creator='Bizvora')
        self.meta = meta
        fw, fh = PW - 2 * MARGIN, PH - 40 * mm
        lw, lh = landscape(A4)
        self.addPageTemplates([
            PageTemplate('cover', [Frame(MARGIN, MARGIN, fw, PH - 2 * MARGIN, id='c')], onPage=draw_cover),
            PageTemplate('body', [Frame(MARGIN, 20 * mm, fw, fh, id='b')], onPage=draw_body),
            PageTemplate('land', [Frame(MARGIN, 20 * mm, lw - 2 * MARGIN, lh - 40 * mm, id='l')], onPage=draw_body, pagesize=landscape(A4)),
        ])
        self._n = 0

    def afterFlowable(self, f):
        toc = getattr(f, '_toc', None)
        if toc:
            level, text, key = toc
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(text, key, level=level, closed=False)
            self.notify('TOCEntry', (level, text, self.page, key))


# ---------- helpers ----------
def data_image(src):
    if not src or not isinstance(src, str) or not src.startswith('data:image'):
        return None
    try:
        raw = base64.b64decode(src.split(',', 1)[1])
        if len(raw) > 3_000_000:
            return None
        return ImageReader(io.BytesIO(raw))
    except Exception:
        return None


def esc(t):
    return escape(str(t if t is not None else ''))


def markup(t):
    """Allow <b>, <i> from our own payload; everything else escaped."""
    s = esc(t)
    return re.sub(r'&lt;(/?)(b|i)&gt;', r'<\1\2>', s)


def heading(num, text, st, level=0):
    key = 'sec%s' % re.sub(r'\W', '', str(num) + text)[:40]
    badge = Paragraph('<font name="Head" color="white">%s</font>' % esc(num), ParagraphStyle('b', fontName='Head', fontSize=11, leading=14, alignment=1, textColor=colors.white))
    t = Table([[badge, Paragraph(esc(text), st['h1'])]], colWidths=[10 * mm, None], rowHeights=[10 * mm])
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (0, 0), GREEN), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                           ('LEFTPADDING', (1, 0), (1, 0), 8), ('LINEBELOW', (1, 0), (1, 0), 1.6, LIME), ('LEFTPADDING', (0, 0), (0, 0), 0), ('RIGHTPADDING', (0, 0), (0, 0), 0)]))
    t._toc = (level, '%s. %s' % (num, text) if level == 0 else text, key)
    return t


def is_num(s):
    return bool(re.match(r'^[\s₹$€£(+\-–]*[\d,.]+\s*(%|x|×|L|Cr|K|M|B)?\)?$', str(s).strip())) or str(s).strip() in ('–', '-', '')


def build_table(b, st, width):
    head, rows = b.get('head') or [], b.get('rows') or []
    if not head:
        return None
    ncol = len(head)
    small = b.get('small') or ncol > 7
    cs, hs = (st['cellS'], st['headS']) if small else (st['cell'], st['head'])
    align = (b.get('align') or [])[:ncol] + ['r'] * (ncol - len(b.get('align') or []))
    if b.get('widths') and len(b['widths']) == ncol:
        cw = [width * f for f in b['widths']]
    elif ncol <= 3:
        cw = [width * 0.5] + [width * 0.5 / (ncol - 1)] * (ncol - 1) if ncol > 1 else [width]
    else:
        first = 0.30 if ncol > 8 else 0.34
        cw = [width * first] + [width * (1 - first) / (ncol - 1)] * (ncol - 1)

    def cell(v, i, header=False):
        stl = ParagraphStyle('x', parent=hs if header else cs, alignment=TA_RIGHT if align[i] == 'r' else TA_LEFT)
        return Paragraph(esc(v), stl)
    data = [[cell(h, i, True) for i, h in enumerate(head)]]
    for r in rows:
        r = (list(r) + [''] * ncol)[:ncol]
        data.append([cell(v, i) for i, v in enumerate(r)])
    t = Table(data, colWidths=cw, repeatRows=1, hAlign='LEFT')
    sty = [('BACKGROUND', (0, 0), (-1, 0), GREEN), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
           ('LINEBELOW', (0, 0), (-1, -1), 0.4, LINE), ('BOX', (0, 0), (-1, -1), 0.6, LINE),
           ('TOPPADDING', (0, 0), (-1, -1), 3 if small else 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 3 if small else 4),
           ('LEFTPADDING', (0, 0), (-1, -1), 4), ('RIGHTPADDING', (0, 0), (-1, -1), 4)]
    for ri in range(1, len(data)):
        if ri % 2 == 0:
            sty.append(('BACKGROUND', (0, ri), (-1, ri), ZEBRA))
    for hi in b.get('hl') or []:
        ri = hi + 1
        if ri < len(data):
            sty.append(('BACKGROUND', (0, ri), (-1, ri), LIME_S))
            for ci in range(ncol):
                p = data[ri][ci]; p.style = ParagraphStyle('hb', parent=p.style, fontName='Body-B')
    for si in b.get('secRows') or []:
        ri = si + 1
        if ri < len(data):
            sty.append(('BACKGROUND', (0, ri), (-1, ri), colors.white)); sty.append(('SPAN', (0, ri), (-1, ri)))
            p = data[ri][0]; p.style = ParagraphStyle('sec', parent=p.style, fontName='Body-B', textColor=GREEN)
    t.setStyle(TableStyle(sty))
    return t


def nice(lo, hi):
    import math
    if hi == lo:
        hi = lo + 1
    raw = (hi - lo) / 5
    p = 10 ** math.floor(math.log10(abs(raw))) if raw else 1
    step = min([1, 2, 2.5, 5, 10], key=lambda f: abs(f * p - raw)) * p
    if step * 5 < (hi - lo):
        step *= 2
    return math.floor(lo / step) * step, math.ceil(hi / step) * step, step


def bar_chart(b, width):
    labels = b.get('labels') or []
    series = b.get('series') or []
    vals = [[(v if isinstance(v, (int, float)) else 0) for v in s.get('values', [])] for s in series]
    if not vals or not labels:
        return None
    h = 64 * mm
    d = Drawing(width, h)
    ch = VerticalBarChart()
    ch.x, ch.y, ch.width, ch.height = 34, 30, width - 44, h - 52
    ch.data = vals
    lo = min(0, min(min(v) for v in vals)); hi = max(0, max(max(v) for v in vals))
    if b.get('bench') is not None:
        hi = max(hi, b['bench'] * 1.1)
    lo, hi, step = nice(lo, hi * 1.05 if hi > 0 else hi)
    ch.valueAxis.valueMin, ch.valueAxis.valueMax, ch.valueAxis.valueStep = lo, hi, step
    fmt = (lambda v: '%g%%' % v) if b.get('pct') else (lambda v: '%gx' % round(v, 2)) if b.get('ratio') else (lambda v: '{:,.0f}'.format(v))
    ch.valueAxis.labelTextFormat = fmt
    ch.valueAxis.labels.fontName = 'Body'; ch.valueAxis.labels.fontSize = 7; ch.valueAxis.labels.fillColor = MUTED
    ch.valueAxis.strokeColor = LINE; ch.valueAxis.gridStrokeColor = LINE; ch.valueAxis.visibleGrid = 1; ch.valueAxis.gridStrokeWidth = 0.4
    ch.categoryAxis.categoryNames = [str(l) for l in labels]
    ch.categoryAxis.labels.fontName = 'Body'; ch.categoryAxis.labels.fontSize = 7; ch.categoryAxis.labels.fillColor = MUTED
    ch.categoryAxis.strokeColor = MUTED; ch.categoryAxis.labels.dy = -4
    ch.barSpacing = 1; ch.groupSpacing = 6 if len(series) > 1 else 10
    for i in range(len(series)):
        ch.bars[i].fillColor = SERIES[i % len(SERIES)]; ch.bars[i].strokeColor = None
    d.add(ch)
    if b.get('bench') is not None and hi > lo:
        y = ch.y + (b['bench'] - lo) / (hi - lo) * ch.height
        d.add(Line(ch.x, y, ch.x + ch.width, y, strokeColor=RED, strokeWidth=1, strokeDashArray=[4, 3]))
        d.add(String(ch.x + ch.width, y + 3, 'Benchmark %s' % fmt(b['bench']), fontName='Body', fontSize=7, fillColor=RED, textAnchor='end'))
    lx = ch.x
    for i, s in enumerate(series):
        d.add(Rect(lx, h - 12, 8, 8, fillColor=SERIES[i % len(SERIES)], strokeColor=None))
        d.add(String(lx + 11, h - 11, str(s.get('name', '')), fontName='Body', fontSize=8, fillColor=INK))
        lx += 16 + pdfmetrics.stringWidth(str(s.get('name', '')), 'Body', 8) + 10
    return d


def donut_chart(b, width):
    labels = b.get('labels') or []
    vals = [(v if isinstance(v, (int, float)) and v > 0 else 0) for v in (b.get('series') or [{}])[0].get('values', [])]
    if not vals or sum(vals) <= 0:
        return None
    h = 58 * mm
    d = Drawing(width, h)
    dn = Doughnut()
    size = min(h - 10, width * 0.5)
    dn.x, dn.y, dn.width, dn.height = 4, (h - size) / 2, size, size
    dn.data = vals; dn.labels = None; dn.innerRadiusFraction = 0.58
    dn.slices.strokeColor = colors.white; dn.slices.strokeWidth = 1.5
    for i in range(len(vals)):
        dn.slices[i].fillColor = SERIES[i % len(SERIES)]
    d.add(dn)
    tot = sum(vals); lx = size + 14; ly = h / 2 + len(vals) * 6
    for i, (l, v) in enumerate(zip(labels, vals)):
        d.add(Rect(lx, ly - i * 13, 7, 7, fillColor=SERIES[i % len(SERIES)], strokeColor=None))
        txt = '%s  %d%%' % (str(l)[:26], round(v / tot * 100))
        d.add(String(lx + 10, ly - i * 13, txt, fontName='Body', fontSize=7.6, fillColor=INK))
    return d


class FlowDiagram(Flowable):
    def __init__(self, steps, width):
        super().__init__()
        self.steps = [str(s) for s in steps][:16]
        self.w = width
        self.per = 4 if len(self.steps) > 4 else max(1, len(self.steps))
        self.rows = (len(self.steps) + self.per - 1) // self.per
        self.bh, self.gap, self.vgap = 17 * mm, 8 * mm, 9 * mm
        self.height = self.rows * self.bh + (self.rows - 1) * self.vgap + 4

    def wrap(self, aw, ah):
        return self.w, self.height

    def draw(self):
        c = self.canv
        bw = (self.w - (self.per - 1) * self.gap) / self.per
        pos = []
        for i, s in enumerate(self.steps):
            r, k = divmod(i, self.per)
            if r % 2 == 1:
                k = self.per - 1 - k
            x = k * (bw + self.gap); y = self.height - (r + 1) * self.bh - r * self.vgap
            pos.append((x, y))
            c.setFillColor(MINT_S if i % 2 else LIME_S); c.setStrokeColor(GREEN); c.setLineWidth(0.8)
            c.roundRect(x, y, bw, self.bh, 5, stroke=1, fill=1)
            c.setFillColor(GREEN); c.circle(x + 7, y + self.bh - 7, 5.2, stroke=0, fill=1)
            c.setFillColor(colors.white); c.setFont('Body-B', 7); c.drawCentredString(x + 7, y + self.bh - 9.4, str(i + 1))
            c.setFillColor(INK); c.setFont('Body-B', 8.4)
            lines = simpleSplit(s, 'Body-B', 8.4, bw - 10)[:3]
            ty = y + self.bh / 2 + (len(lines) - 1) * 5 - 6
            for j, ln in enumerate(lines):
                c.drawCentredString(x + bw / 2 + 3, ty - j * 10, ln)
        c.setStrokeColor(GREEN); c.setFillColor(GREEN); c.setLineWidth(1.1)
        for i in range(len(pos) - 1):
            (x1, y1), (x2, y2) = pos[i], pos[i + 1]
            if abs(y1 - y2) < 1:
                if x2 > x1:
                    sx, ex, yy = x1 + bw, x2, y1 + self.bh / 2; c.line(sx + 1, yy, ex - 4, yy); tri = [(ex - 1, yy), (ex - 6, yy + 3), (ex - 6, yy - 3)]
                else:
                    sx, ex, yy = x1, x2 + bw, y1 + self.bh / 2; c.line(sx - 1, yy, ex + 4, yy); tri = [(ex + 1, yy), (ex + 6, yy + 3), (ex + 6, yy - 3)]
            else:
                xx = x1 + bw / 2; c.line(xx, y1 - 1, xx, y2 + self.bh + 4); tri = [(xx, y2 + self.bh + 1), (xx - 3, y2 + self.bh + 6), (xx + 3, y2 + self.bh + 6)]
            p = c.beginPath(); p.moveTo(*tri[0]); p.lineTo(*tri[1]); p.lineTo(*tri[2]); p.close(); c.drawPath(p, stroke=0, fill=1)


class Gantt(Flowable):
    def __init__(self, rows, width):
        super().__init__()
        self.rows = rows[:14]; self.w = width
        self.end = max([r['start'] + r['months'] for r in self.rows] + [1])
        self.rh = 8 * mm; self.height = (len(self.rows) + 1) * self.rh + 2

    def wrap(self, aw, ah):
        return self.w, self.height

    def draw(self):
        c = self.canv; lab = 62 * mm; tw = self.w - lab
        top = self.height - self.rh
        c.setFont('Body-B', 7.5); c.setFillColor(MUTED)
        step = 1 if self.end <= 12 else 2 if self.end <= 24 else 3
        for mth in range(0, int(self.end) + 1, step):
            x = lab + tw * mth / self.end
            c.setStrokeColor(LINE); c.setLineWidth(0.4); c.line(x, 0, x, top + 2)
            c.drawCentredString(x, top + 6, 'M%d' % mth)
        for i, r in enumerate(self.rows):
            y = top - (i + 1) * self.rh
            if i % 2 == 0:
                c.setFillColor(ZEBRA); c.rect(0, y, self.w, self.rh, stroke=0, fill=1)
            c.setFillColor(INK); c.setFont('Body', 8.6)
            c.drawString(2, y + self.rh / 2 - 3, simpleSplit(str(r['task']), 'Body', 8.6, lab - 6)[0] if r['task'] else '')
            x = lab + tw * r['start'] / self.end; w = max(3, tw * r['months'] / self.end)
            c.setFillColor(GREEN if i % 2 == 0 else LIME); c.roundRect(x, y + 2.2 * mm, w, self.rh - 4.4 * mm, 2.5, stroke=0, fill=1)


def kpi_row(items, st, width):
    cells = []
    for it in items[:4]:
        cells.append([Paragraph(esc(it.get('label', '')), st['kpiL']), Paragraph(esc(it.get('value', '')), st['kpiV']), Paragraph(esc(it.get('note', '')), st['kpiN'])])
    n = len(cells)
    if not n:
        return None
    inner = [Table([[x] for x in cl], colWidths=[width / n - 8]) for cl in cells]
    for t in inner:
        t.setStyle(TableStyle([('LEFTPADDING', (0, 0), (-1, -1), 0), ('TOPPADDING', (0, 0), (-1, -1), 1), ('BOTTOMPADDING', (0, 0), (-1, -1), 1)]))
    t = Table([inner], colWidths=[width / n] * n)
    sty = [('VALIGN', (0, 0), (-1, -1), 'TOP'), ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7), ('LEFTPADDING', (0, 0), (-1, -1), 8)]
    for i in range(n):
        sty += [('BACKGROUND', (i, 0), (i, 0), LIME_S if i == 0 else colors.white), ('BOX', (i, 0), (i, 0), 0.8, LIME if i == 0 else LINE)]
    t.setStyle(TableStyle(sty))
    return t


def images_grid(items, st, width):
    per = 2 if len(items) <= 4 else 3
    cw = width / per; box_h = 58 * mm if per == 2 else 44 * mm
    cells, row = [], []
    for it in items[:9]:
        img = data_image(it.get('src'))
        if not img:
            continue
        iw, ih = img.getSize(); sc = min((cw - 12) / iw, box_h / ih)
        im = Image(io.BytesIO(base64.b64decode(it['src'].split(',', 1)[1])), width=iw * sc, height=ih * sc)
        row.append([im, Paragraph(esc(it.get('caption', '')), ParagraphStyle('cap', parent=st['caption'], alignment=1))])
        if len(row) == per:
            cells.append(row); row = []
    if row:
        cells.append(row + [''] * (per - len(row)))
    if not cells:
        return None
    data = [[Table([[c[0]], [c[1]]], colWidths=[cw - 8]) if c else '' for c in r] for r in cells]
    t = Table(data, colWidths=[cw] * per)
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('ALIGN', (0, 0), (-1, -1), 'CENTER'), ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
    return t


def swot(b, st, width):
    def box(title, items, bg):
        lst = ListFlowable([ListItem(Paragraph(esc(x), st['bullet']), leftIndent=10, value='•') for x in items], bulletType='bullet', start='•', leftIndent=10, bulletFontSize=8)
        return [Paragraph(title, st['swotH']), Spacer(1, 3), lst], bg
    q = [box('Strengths', b.get('s', []), LIME_S), box('Weaknesses', b.get('w', []), PINK_S), box('Opportunities', b.get('o', []), MINT_S), box('Threats', b.get('th', []), ZEBRA)]
    t = Table([[q[0][0], q[1][0]], [q[2][0], q[3][0]]], colWidths=[width / 2] * 2)
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BACKGROUND', (0, 0), (0, 0), q[0][1]), ('BACKGROUND', (1, 0), (1, 0), q[1][1]),
                           ('BACKGROUND', (0, 1), (0, 1), q[2][1]), ('BACKGROUND', (1, 1), (1, 1), q[3][1]), ('INNERGRID', (0, 0), (-1, -1), 3, colors.white),
                           ('TOPPADDING', (0, 0), (-1, -1), 9), ('BOTTOMPADDING', (0, 0), (-1, -1), 9), ('LEFTPADDING', (0, 0), (-1, -1), 10)]))
    return t


def render_blocks(blocks, st, width):
    out = []
    for b in blocks:
        k = b.get('t')
        if k == 'p':
            out.append(Paragraph(esc(b.get('text', '')), st['body']))
        elif k == 'h3':
            out.append(CondPageBreak(30 * mm)); out.append(Paragraph(esc(b.get('text', '')), st['h3']))
        elif k == 'bullets':
            items = [ListItem(Paragraph(markup(x), st['bullet']), leftIndent=12, value='•') for x in b.get('items', [])]
            if items:
                out.append(ListFlowable(items, bulletType='bullet', start='•', leftIndent=12, bulletColor=GREEN)); out.append(Spacer(1, 4))
        elif k == 'table':
            t = build_table(b, st, width)
            if t:
                out.append(t); out.append(Spacer(1, 8))
        elif k == 'kpis':
            t = kpi_row(b.get('items', []), st, width)
            if t:
                out.append(Spacer(1, 4)); out.append(t); out.append(Spacer(1, 8))
        elif k == 'chart':
            d = donut_chart(b, width) if b.get('kind') == 'donut' else bar_chart(b, width)
            if d:
                cap = Paragraph(esc(b.get('title', '')), st['caption'])
                out.append(KeepTogether([d, cap, Spacer(1, 8)]))
        elif k == 'row':
            items = b.get('items', [])[:2]
            lw, rw = width * 0.56, width * 0.44
            left = [f for f in (render_blocks([items[0]], st, lw - 10) if items else []) if not isinstance(f, Spacer)]
            right = [f for f in (render_blocks([items[1]], st, rw - 4) if len(items) > 1 else []) if not isinstance(f, Spacer)]
            if right and isinstance(right[0], KeepTogether):
                right = [x for x in right[0]._content if not isinstance(x, Spacer)]
            t = Table([[left, right]], colWidths=[lw, rw])
            t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (0, 0), 10)]))
            out.append(t); out.append(Spacer(1, 6))
        elif k == 'images':
            t = images_grid(b.get('items', []), st, width)
            if t:
                out.append(t); out.append(Spacer(1, 6))
        elif k == 'flow':
            out.append(FlowDiagram(b.get('steps', []), width)); out.append(Spacer(1, 10))
        elif k == 'gantt':
            out.append(Gantt(b.get('rows', []), width)); out.append(Spacer(1, 10))
        elif k == 'swot':
            out.append(swot(b, st, width)); out.append(Spacer(1, 8))
    return out


NEW_PAGE = {'Executive Summary', 'Cost of Project and Means of Finance', 'Profitability Projections', 'Financial Analysis and Debt Service Coverage'}


def build_pdf(payload):
    register_fonts()
    st = styles()
    meta = payload.get('meta') or {}
    buf = io.BytesIO()
    doc = DPRDoc(buf, meta)
    W = PW - 2 * MARGIN
    LW = landscape(A4)[0] - 2 * MARGIN
    story = [NextPageTemplate('body'), PageBreak()]
    # contents
    story.append(Paragraph('Contents', ParagraphStyle('ct', parent=st['h1'], fontSize=20, leading=26, spaceAfter=14)))
    toc = TableOfContents()
    toc.levelStyles = [st['toc0'], st['toc1']]
    toc.dotsMinLevel = 0
    story.append(toc)
    story.append(PageBreak())
    for i, sec in enumerate(payload.get('sections') or [], start=1):
        title = sec.get('title', '')
        if i > 1:
            story.append(PageBreak() if title in NEW_PAGE else CondPageBreak(70 * mm))
        story.append(heading(i, title, st)); story.append(Spacer(1, 10))
        story += render_blocks(sec.get('blocks') or [], st, W)
        story.append(Spacer(1, 6))
    if payload.get('disclaimer'):
        story.append(CondPageBreak(40 * mm)); story.append(Spacer(1, 10))
        dt = Table([[Paragraph('<b>Disclaimer.</b> ' + esc(payload['disclaimer']), st['small'])]], colWidths=[W])
        dt.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), ZEBRA), ('BOX', (0, 0), (-1, -1), 0.6, LINE), ('LEFTPADDING', (0, 0), (-1, -1), 10), ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
        story.append(dt)
    annex = payload.get('annex') or []
    if annex:
        story.append(NextPageTemplate('land'))
        for j, sec in enumerate(annex, start=1):
            story.append(PageBreak())
            h = heading('A%d' % j, re.sub(r'^Annexure \d+\s*[—-]\s*', '', sec.get('title', '')), st, level=0)
            h._toc = (0, sec.get('title', ''), 'annex%d' % j)
            story.append(h); story.append(Spacer(1, 10))
            story += render_blocks(sec.get('blocks') or [], st, LW)
    doc.multiBuild(story, canvasmaker=NumberedCanvas)
    return buf.getvalue()


# ---------- access check ----------
def firebase_cfg():
    raw = os.environ.get('FIREBASE_CONFIG') or ''
    k = re.search(r'apiKey["\']?\s*:\s*["\']([^"\']+)', raw)
    p = re.search(r'projectId["\']?\s*:\s*["\']([^"\']+)', raw)
    return (k.group(1), p.group(1)) if k and p else (None, None)


def http_json(url, data=None, headers=None, method=None):
    req = urllib.request.Request(url, data=json.dumps(data).encode() if data is not None else None, headers={'content-type': 'application/json', **(headers or {})}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or '{}')
        except Exception:
            return e.code, {}


def check_access(token, host, payload):
    api_key, project = firebase_cfg()
    if not api_key:
        return None  # local mode: no accounts configured
    if not token:
        return 'Sign in to download the report.'
    code, j = http_json('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + api_key, {'idToken': token})
    if code != 200 or not j.get('users'):
        return 'Your session has expired. Sign in again.'
    uid = j['users'][0]['localId']
    code, acc = http_json('https://%s/api/access' % host, headers={'authorization': 'Bearer ' + token})
    if code == 200 and acc.get('fullAccess'):
        return None
    meta = payload.get('meta') or {}
    pid = str(meta.get('projectId') or '')
    if not pid or pid == 'example' or '/' in pid:
        return 'Save the project and unlock it to download the report.'
    url = 'https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents/users/%s/unlocks/%s' % (project, uid, pid)
    code, doc = http_json(url, headers={'authorization': 'Bearer ' + token})
    if code != 200:
        return 'Unlock this report to download the PDF.'
    f = (doc.get('fields') or {}).get('mode') or {}
    paid = int(f.get('integerValue') or f.get('doubleValue') or 0)
    if paid < int(meta.get('mode') or 1):
        return 'Unlock this report (or upgrade to its mode) to download the PDF.'
    return None


class handler(BaseHTTPRequestHandler):
    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code); self.send_header('content-type', 'application/json'); self.send_header('content-length', str(len(body))); self.end_headers(); self.wfile.write(body)

    def do_POST(self):
        try:
            n = int(self.headers.get('content-length') or 0)
            if n <= 0 or n > 6_000_000:
                return self._json(413, {'error': 'Report data is too large. Use smaller product photos.'})
            payload = json.loads(self.rfile.read(n).decode('utf-8'))
            auth = self.headers.get('authorization') or ''
            token = auth[7:] if auth.startswith('Bearer ') else None
            err = check_access(token, self.headers.get('host') or '', payload)
            if err:
                return self._json(402 if 'nlock' in err else 401, {'error': err})
            pdf = build_pdf(payload)
            self.send_response(200)
            self.send_header('content-type', 'application/pdf')
            self.send_header('content-length', str(len(pdf)))
            self.send_header('cache-control', 'no-store')
            self.end_headers()
            self.wfile.write(pdf)
        except Exception as e:  # noqa: BLE001
            self._json(500, {'error': 'Could not build the PDF: %s' % type(e).__name__})

    def do_GET(self):
        self._json(405, {'error': 'Use POST'})
