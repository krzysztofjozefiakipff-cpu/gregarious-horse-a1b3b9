"""Render authorized management report data as a paginated PDF."""
from datetime import date, datetime
from html import escape
import json
import sys
from zoneinfo import ZoneInfo

from reportlab.graphics.shapes import Drawing, Line, Rect, String
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether, LongTable, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

FONT_DIR = '/usr/share/fonts/truetype/dejavu'
pdfmetrics.registerFont(TTFont('DejaVu', FONT_DIR + '/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuBold', FONT_DIR + '/DejaVuSans-Bold.ttf'))

INK = colors.HexColor('#2d2031')
MUTED = colors.HexColor('#635563')
PLUM = colors.HexColor('#52294f')
ORANGE = colors.HexColor('#ffc184')
RULE = colors.HexColor('#e3d7e0')
LIGHT = colors.HexColor('#f6edf4')
GREEN = colors.HexColor('#14745b')
RED = colors.HexColor('#9a3025')
WIDTH = A4[0] - 76

TITLES = {'monthly': 'Podsumowanie miesiąca', 'daily': 'Raport dzienny', 'marketing': 'Raport dla marketingu',
          'briefing': 'Raport odprawy dziennej'}
METRICS = ['Leady', 'Próby kontaktu', 'Spotkania', 'Jazdy próbne', 'Oferty', 'Follow-up', 'Zamówienia',
           'Wystawione faktury', 'Rejestracje', 'Opinie Google']
SOURCES = ['Walk-in', 'Facebook', 'Strona WWW', 'Kontakt z salonem', 'OTOMOTO', 'Polecenia',
           'Baza retencyjna', 'Importerskie', 'Broker', 'Serwis', 'Galerie', 'Targi', 'Odzyskane przez BDC']
SALES = [6, 7, 8, 9]

STYLES = {
    'title': ParagraphStyle('title', fontName='DejaVuBold', fontSize=23, leading=28, textColor=INK, spaceAfter=8),
    'salon': ParagraphStyle('salon', fontName='DejaVuBold', fontSize=17, leading=22, textColor=INK,
                            spaceBefore=14, spaceAfter=8, keepWithNext=True),
    'section': ParagraphStyle('section', fontName='DejaVuBold', fontSize=12, leading=16, textColor=INK,
                              spaceBefore=12, spaceAfter=6, keepWithNext=True),
    'body': ParagraphStyle('body', fontName='DejaVu', fontSize=9, leading=14, textColor=INK, spaceAfter=7),
    'hint': ParagraphStyle('hint', fontName='DejaVu', fontSize=8, leading=12, textColor=MUTED, spaceAfter=8),
    'cell': ParagraphStyle('cell', fontName='DejaVu', fontSize=8, leading=11, textColor=INK, splitLongWords=True),
    'total': ParagraphStyle('total', fontName='DejaVuBold', fontSize=8, leading=11, textColor=INK),
    'header': ParagraphStyle('header', fontName='DejaVuBold', fontSize=8, leading=11, textColor=colors.white),
    'action': ParagraphStyle('action', fontName='DejaVuBold', fontSize=9, leading=13, textColor=PLUM, spaceAfter=2),
    'priority': ParagraphStyle('priority', fontName='DejaVuBold', fontSize=11, leading=15, textColor=PLUM, spaceAfter=3),
    'instruction': ParagraphStyle('instruction', fontName='DejaVu', fontSize=10, leading=14, textColor=INK, spaceAfter=4),
    'evidence': ParagraphStyle('evidence', fontName='DejaVu', fontSize=8, leading=11, textColor=MUTED),
    'briefing_value': ParagraphStyle('briefing_value', fontName='DejaVuBold', fontSize=19, leading=24, textColor=ORANGE),
    'briefing_label': ParagraphStyle('briefing_label', fontName='DejaVu', fontSize=9, leading=13, textColor=colors.white),
    'task_number': ParagraphStyle('task_number', fontName='DejaVuBold', fontSize=12, leading=15,
                                  textColor=colors.white, alignment=1),
}


def p(text, style='body'):
    return Paragraph(escape(str(text)), STYLES[style])


def number(value):
    if value is None:
        return '–'
    return f'{value:,.1f}'.rstrip('0').rstrip('.').replace(',', ' ').replace('.', ',')


def percent(numerator, denominator):
    return number(100 * numerator / denominator) + '%' if denominator and denominator > 0 else '–'


def date_text(value):
    return date.fromisoformat(value).strftime('%d.%m.%Y')


def table(headers, rows, fractions=None, *, header_color=INK):
    widths = [WIDTH * fraction for fraction in fractions] if fractions else [WIDTH / len(headers)] * len(headers)
    cells = [[p(label, 'header') for label in headers]] + [
        [value if isinstance(value, Paragraph) else p(value, 'cell') for value in row] for row in rows
    ]
    grid = LongTable(cells, colWidths=widths, repeatRows=1, hAlign='LEFT')
    grid.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), header_color),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LINEBELOW', (0, -1), (-1, -1), 0.5, RULE),
    ]))
    return grid


def bars(rows, scale, paint=PLUM, goal_marker=False):
    """Draw aligned horizontal bars with the exact value beside each bar."""
    height = len(rows) * 22 + 16
    chart = Drawing(WIDTH, height)
    chart.add(Rect(0, 0, WIDTH, height, rx=8, fillColor=LIGHT, strokeColor=None))
    label_width, bar_width = 142, WIDTH - 142 - 84
    for index, (label, value, annotation) in enumerate(rows):
        y = height - 20 - 22 * index
        chart.add(String(10, y + 2, label, fontName='DejaVu', fontSize=8, fillColor=INK))
        chart.add(Rect(label_width, y + 1, bar_width, 8, rx=3, fillColor=RULE, strokeColor=None))
        if value > 0:
            chart.add(Rect(label_width, y + 1, bar_width * value / scale, 8,
                           rx=3, fillColor=paint, strokeColor=None))
        if goal_marker:
            goal_x = label_width + bar_width / scale
            chart.add(Line(goal_x, y, goal_x, y + 10, strokeColor=MUTED, strokeWidth=0.8))
        chart.add(String(WIDTH - 10, y + 2, annotation, textAnchor='end',
                         fontName='DejaVuBold', fontSize=8, fillColor=INK))
    return chart


def activities(actuals, targets, expected=None, indexes=range(len(METRICS))):
    headers = ['Aktywność', 'Wynik', 'Plan', 'Realizacja']
    if expected is not None:
        headers.append('Plan do daty')
    rows = [[METRICS[i], number(actuals[i]), number(targets[i]), percent(actuals[i], targets[i])]
            for i in indexes]
    if expected is not None:
        for i, row in zip(indexes, rows):
            row.append(number(expected[i]))
    widths = [.38, .15, .15, .16, .16] if expected is not None else [.46, .18, .18, .18]
    return table(headers, rows, widths)


def daily_details(person):
    check = person['check']
    rows = [
        ('Rozliczenie dni pracy', f"{check['approved'] + check['zero']} z {check['required']} dni"
         if check['started'] else 'Ewidencja jeszcze nierozpoczęta'),
        ('Zatwierdzone / bez aktywności', f"{check['approved']} / {check['zero']}"),
    ]
    for label, key in [('Zapisy robocze', 'drafts'), ('Zgłoszenia oczekujące', 'pending'), ('Brak wpisu', 'missing')]:
        rows.append((label, ', '.join(map(date_text, check[key])) or '–'))
    return table(['Sprawdzenie', 'Wynik'], rows, [.41, .59])


def sales_progress(salon):
    actuals, targets = salon['totals'], salon['targets']
    progress = [(METRICS[i], actuals[i] / targets[i] if targets[i] else 0,
                 f'{number(actuals[i])} / {number(targets[i])}') for i in SALES]
    return KeepTogether([p('Wynik i plan salonu', 'section'),
                         bars(progress, max(1, *(row[1] for row in progress)), goal_marker=True)])


def daily_sales_cell(actual, target, expected):
    value = f'{number(actual)} / {number(target)}'
    status = None
    if target and actual >= target:
        status = ('Wykonany', GREEN)
    elif target and expected and actual + 1e-9 < expected:
        status = ('Poniżej tempa', RED)
    elif target and expected:
        status = ('W tempie', GREEN)
    if status:
        label, tone = status
        value += f'<br/><font color="{tone.hexval()}" size="7">{label}</font>'
    return Paragraph(value, STYLES['cell'])


def daily_goals(salon, day):
    if not day:
        return [p('Cele dzienne', 'section'), p('Cele na ten dzień nie zostały zapisane w archiwum.', 'hint')]
    story = [p(f'Cele handlowców na {date_text(day)}', 'section')]
    goals = salon['dailyGoals']
    if not goals:
        return story + [p('Brak aktywnych handlowców w salonie.', 'hint')]
    story.append(p('„–” oznacza brak ustalonego celu. Dzień wolny uwzględnia kalendarz handlowca.', 'hint'))
    for title, indexes, widths in [
        ('Cele sprzedażowe', SALES, [.30, .17, .17, .17, .19]),
        ('Aktywności w lejku', range(6), [.25, .10, .14, .13, .13, .11, .14]),
    ]:
        headers = ['Handlowiec'] + [METRICS[i] for i in indexes]
        rows = []
        for person in goals:
            name = person['name'] + ('' if person['workday'] else ' · dzień wolny')
            rows.append([name] + [number(person['targets'][i]) for i in indexes])
        story.extend([p(title, 'action'), table(headers, rows, widths), Spacer(1, 8)])
    return story


def action_card(index, action):
    card = Table([[p(index, 'task_number'), [
        p(action['title'], 'priority'), p(action['instruction'], 'instruction'), p(action['evidence'], 'evidence')
    ]]], colWidths=[30, WIDTH - 30], hAlign='LEFT')
    card.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), PLUM),
        ('BACKGROUND', (1, 0), (1, 0), LIGHT),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (1, 0), (1, 0), 10),
        ('RIGHTPADDING', (1, 0), (1, 0), 10),
    ]))
    return KeepTogether([card, Spacer(1, 6)])


def daily_report(salon, closed, goals_day):
    title = 'Co poprawić w kolejnym miesiącu' if closed else 'Co zrobić, żeby dowieźć plan'
    actions = salon['actions']
    front_limit = 2
    story = [
        sales_progress(salon),
        KeepTogether([p('Aktywności i rozliczenie dni pracy', 'section'),
                      activities(salon['totals'], salon['targets'], salon['expected'], range(6))]),
        p(title, 'section'),
    ]
    if actions:
        story.extend(action_card(i, action) for i, action in enumerate(actions[:front_limit], 1))
        if len(actions) > front_limit:
            story.append(p('Kolejne zadania kierownika znajdziesz od strony 2.', 'hint'))
    else:
        story.append(p('Zapisane wyniki są zgodne z tempem dla ustawionych celów. Utrzymaj obecny rytm pracy.'
                       if any((goal or 0) > 0 for goal in salon['expected'])
                       else 'Ustaw cele salonu i zespołu, aby wyznaczyć tempo i wskazać luki.'))
    story.append(PageBreak())
    if len(actions) > front_limit:
        story.append(p(title + ' · dalsze zadania', 'section'))
        story.extend(action_card(i, action) for i, action in enumerate(actions[front_limit:], front_limit + 1))
    people = [('Razem salon', salon['totals'], salon['targets'], salon['expected'])] + [
        (person['name'] + (' · archiwum' if person['archived'] else ''),
         person['actuals'], person['targets'], person['expected']) for person in salon['people']
    ]
    summary = table(['Wynik / plan', 'Zamówienia', 'Faktury', 'Rejestracje', 'Opinie Google'], [
        [p(name, 'total' if row == 0 else 'cell')] + [daily_sales_cell(actual[i], target[i], expected[i]) for i in SALES]
        for row, (name, actual, target, expected) in enumerate(people)
    ], [.28, .18, .18, .18, .18])
    summary.setStyle(TableStyle([('BACKGROUND', (0, 1), (-1, 1), LIGHT)]))
    story.extend([p('Realizacja planów handlowców', 'section'), summary, *daily_goals(salon, goals_day)])
    for person in salon['people']:
        caption = person['name'] + (' · archiwum' if person['archived'] else '')
        story.extend([p(caption, 'section'),
                      activities(person['actuals'], person['targets'], person['expected'], range(6))])
        if person.get('check'):
            story.extend([Spacer(1, 6), daily_details(person)])
    return story


def operational_report(salon):
    actuals, targets = salon['totals'], salon['targets']
    story = [
        sales_progress(salon),
        Spacer(1, 10), activities(actuals, targets),
    ]
    for person in salon['people']:
        caption = person['name'] + (' · archiwum' if person['archived'] else '')
        story.extend([p(caption, 'section'), activities(person['actuals'], person['targets'])])
    return story


def marketing_report(salon):
    rows = [(SOURCES[i], s['leads'], s['orders']) for i, s in enumerate(salon['sources'])]
    ranked = sorted((row for row in rows if row[1] > 0), key=lambda row: row[2] / row[1], reverse=True)[:7]
    story = []
    if ranked:
        chart = [(name, orders / leads, percent(orders, leads)) for name, leads, orders in ranked]
        story.append(KeepTogether([p('Najwyższa konwersja według źródła', 'section'),
                                  bars(chart, max(0.01, *(row[1] for row in chart)))]))
    story.append(p('Konwersja źródeł', 'section'))
    story.append(table(['Źródło leadów', 'Leady', 'Zamówienia', 'Konwersja'],
                       [[name, leads, orders, percent(orders, leads)] for name, leads, orders in rows],
                       [.46, .16, .19, .19]))
    story.append(p('Rekomendowane dodatkowe leady', 'section'))
    if salon['recommendations']:
        story.append(table(['Handlowiec', 'Źródło', 'Więcej leadów', 'Konwersja', 'Podstawa'], [
            [row['seller'], SOURCES[row['source']], row['extra'], percent(row['orders'], row['leads']),
             'Kolejny miesiąc' if row['basis'] == 'next' else 'Raportowany miesiąc']
            for row in salon['recommendations']
        ], [.24, .23, .16, .15, .22]))
    else:
        story.append(p('Brak źródeł spełniających warunki rekomendacji.'))
    return story


BRIEFING_HEADERS = ['Wskaźnik', 'Wykonano', 'Plan miesiąca', 'Jeszcze w miesiącu', 'Prognoza na koniec']
BRIEFING_WIDTHS = [.30, .14, .16, .19, .21]


def briefing_forecast_table(actual, plan, forecast, partial, manual=None):
    rows = []
    for slot, metric in enumerate(SALES):
        remaining = forecast[slot]
        annotation = ''
        if remaining is not None and partial[slot]:
            annotation = ' *'
        elif manual is not None and manual[slot] is not None:
            annotation = ' · korekta'
        rows.append([METRICS[metric], number(actual[slot]), number(plan[slot]),
                     number(remaining) + annotation,
                     number(actual[slot] + remaining if remaining is not None and not partial[slot] else None)])
    return table(BRIEFING_HEADERS, rows, BRIEFING_WIDTHS, header_color=PLUM)


def briefing_status(person):
    if not person['editable']:
        return 'Poza odprawą'
    if person['signoff']['completed']:
        return 'Zatwierdzona'
    if person['signoff']['accepted']:
        return 'Do zatwierdzenia'
    if person['signoff']['previousReady']:
        return 'Zgłoszenie w toku' if person['pendingToday'] else 'Plan na dziś'
    return 'Weryfikacja dnia pracy'


def briefing_counts(salons):
    people = [person for salon in salons for person in salon['people'] if person['editable']]
    done = sum(person['signoff']['completed'] for person in people)
    return done, len(people) - done


def briefing_progress(salons):
    done, left = briefing_counts(salons)
    values = [(str(len(salons)), 'Salony w raporcie'),
              (f'{done} / {done + left}', 'Zatwierdzone odprawy'),
              (str(left), 'Pozostałe odprawy')]
    tiles = Table([[p(value, 'briefing_value') for value, _ in values],
                   [p(label, 'briefing_label') for _, label in values]],
                  colWidths=[WIDTH / 3] * 3, hAlign='LEFT')
    tiles.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), PLUM),
        ('LINEAFTER', (0, 0), (1, -1), .5, colors.HexColor('#886482')),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, 0), 9),
        ('TOPPADDING', (0, 1), (-1, 1), 1),
        ('BOTTOMPADDING', (0, 1), (-1, 1), 9),
    ]))
    return tiles


def briefing_overview(salons):
    actual = [sum(salon['actual'][i] for salon in salons) for i in range(4)]
    plan = [sum(salon['plan'][i] for salon in salons)
            if all(salon['plan'][i] is not None for salon in salons) else None for i in range(4)]
    forecast = []
    partial = []
    for i in range(4):
        values = [salon['forecast'][i] for salon in salons if salon['forecast'][i] is not None]
        forecast.append(sum(values) if values else None)
        partial.append(len(values) < len(salons) or any(salon['missing'][i] for salon in salons))
    rows = []
    for salon in salons:
        done, left = briefing_counts([salon])
        rows.append([salon['salon'], f'{done} / {done + left}', number(salon['actual'][0]),
                     number(salon['plan'][0])])
    return [
        p('Podsumowanie wybranych salonów', 'section'),
        briefing_forecast_table(actual, plan, forecast, partial),
        Spacer(1, 5),
        p('Plan łączny jest dostępny, gdy ustalono go we wszystkich ujętych salonach.', 'hint'),
        p('Postęp według salonów', 'section'),
        table(['Salon', 'Odprawy zatwierdzone', 'Zamówienia', 'Plan zamówień'], rows,
              [.44, .22, .16, .18], header_color=PLUM),
    ]


def briefing_person_details(person):
    name = person['name'] + (' · archiwum' if person['archived'] else '')
    signoff = person['signoff']
    status = briefing_status(person)
    if not person['editable']:
        return [KeepTogether([p(f'{name} · {status}', 'section'),
                              briefing_forecast_table(person['actual'], person['plan'], person['forecast'],
                                                      [False] * 4, person['manual'])])]
    review = person['review']
    previous_status = ('Zweryfikowano' if signoff['previousReady'] else
                       {'recorded': 'Do weryfikacji', 'draft': 'Szkic', 'pending': 'Zgłoszenie w toku',
                        'missing': 'Brak wpisu', 'off': 'Dzień wolny'}[review['status']])
    today_status = ('Plan zaakceptowany' if signoff['accepted'] else 'Plan do akceptacji') if person['workday'] else 'Dzień wolny'
    actual = review['actual'] or [None] * len(METRICS)
    today_goals = person['todayGoals'] if person['workday'] else [None] * len(METRICS)
    activity = table(['Aktywność', 'Plan poprzedniego dnia', 'Wykonanie poprzedniego dnia', 'Cel na dziś'],
                     [[label, number(review['goals'][i]), number(actual[i]), number(today_goals[i])]
                      for i, label in enumerate(METRICS)], [.38, .20, .22, .20], header_color=PLUM)
    return [KeepTogether([
                p(name, 'section'),
                p(f'Odprawa · {status}   |   {date_text(review["day"])} · {previous_status}   |   Dziś · {today_status}', 'hint'),
                activity]),
            KeepTogether([Spacer(1, 6), p(f'Wyniki miesięczne i prognoza · {name}', 'action'),
                          briefing_forecast_table(person['actual'], person['plan'], person['forecast'],
                                                  [False] * 4, person['manual']), Spacer(1, 6)])]


def briefing_report(salon):
    story = [p('Wyniki i prognoza salonu', 'section'),
             briefing_forecast_table(salon['actual'], salon['plan'], salon['forecast'], salon['missing'])]
    if not salon['people']:
        return story + [p('Brak handlowców w raporcie.', 'hint')]
    rows = [[person['name'] + (' · archiwum' if person['archived'] else ''), briefing_status(person),
             date_text(person['review']['day']) if person['editable'] else '–',
             number(person['actual'][0]), number(person['plan'][0])]
            for person in salon['people']]
    story.extend([p('Odprawy i wyniki handlowców', 'section'),
                  table(['Handlowiec', 'Stan odprawy', 'Sprawdzany dzień', 'Zamówienia', 'Plan zamówień'],
                        rows, [.30, .24, .16, .15, .15], header_color=PLUM)])
    for person in salon['people']:
        story.extend(briefing_person_details(person))
    return story


def header_footer(canvas, doc):
    width, height = A4
    canvas.setFillColor(PLUM)
    canvas.rect(0, height - 46, width, 46, stroke=0, fill=1)
    canvas.saveState()
    canvas.translate(38, height - 31)
    canvas.scale(.18, .16)
    canvas.setFillColor(ORANGE)
    for points in (
        [(15, 40), (48, 20), (64, 2), (94, 2), (100, 12), (90, 31), (66, 31), (11, 63)],
        [(4, 74), (51, 51), (64, 39), (94, 39), (100, 50), (89, 70), (66, 70), (0, 98)],
    ):
        path = canvas.beginPath()
        x, y = points[0]
        path.moveTo(x, 100 - y)
        for x, y in points[1:]:
            path.lineTo(x, 100 - y)
        path.close()
        canvas.drawPath(path, stroke=0, fill=1)
    canvas.restoreState()
    canvas.setFillColor(colors.white)
    canvas.setFont('DejaVuBold', 11)
    canvas.drawString(61, height - 28, 'biegwyzej.pl')
    canvas.setFont('DejaVu', 9)
    canvas.drawRightString(width - 38, height - 28, 'Raporty zarządcze')
    canvas.setStrokeColor(RULE)
    canvas.line(38, 39, width - 38, 39)
    canvas.setFillColor(MUTED)
    canvas.setFont('DejaVu', 8)
    canvas.drawString(38, 26, 'biegwyzej.pl')
    canvas.drawRightString(width - 38, 26, f'Strona {doc.page}')


def render(report, output):
    kind = report['type']
    doc = SimpleDocTemplate(output, pagesize=A4, leftMargin=32, rightMargin=32,
                            topMargin=67, bottomMargin=54, title=TITLES[kind], author='Bieg Wyżej')
    year, month = report['month'].split('-')
    through = report['today'] if kind == 'briefing' else report['through']
    date_line = f'Okres {month}.{year}   ·   Wyniki do {date_text(through)}'
    if report.get('generatedAt'):
        generated = datetime.fromisoformat(report['generatedAt']).astimezone(ZoneInfo('Europe/Warsaw'))
        date_line += f'   ·   Wygenerowano {generated:%d.%m.%Y o %H:%M}'
    story = [p(TITLES[kind], 'title'), p(date_line, 'hint')]
    if kind == 'marketing':
        story.append(p('Konwersja to zamówienia podzielone przez leady zapisane w tym samym miesiącu. '
                       'Rekomendacja uwzględnia plan źródłowy, co najmniej 20 leadów i konwersję na poziomie założenia dla źródła.', 'hint'))
    elif kind == 'daily':
        story.append(p('Wyniki obejmują zatwierdzone aktywności do końca poprzedniego dnia. '
                       'Cele dzienne uwzględniają pozostały plan i dni pracy handlowca.', 'hint'))
    elif kind == 'briefing':
        story.extend([briefing_progress(report['salons']), Spacer(1, 8),
                      p('Wyniki miesięczne obejmują zatwierdzone wpisy. Gwiazdka (*) oznacza prognozę częściową, '
                        'kreska oznacza brak danych, a „korekta” wskazuje prognozę wpisaną przez kierownika.', 'hint')])
        if len(report['salons']) > 1:
            story.extend(briefing_overview(report['salons']))
            story.append(PageBreak())
    for index, salon in enumerate(report['salons']):
        if index:
            story.append(PageBreak())
        story.append(p(salon['salon'], 'salon'))
        if kind == 'daily':
            story.extend(daily_report(salon, report['reportDay'][:7] > report['month'], report.get('dailyGoalsDate')))
        elif kind == 'marketing':
            story.extend(marketing_report(salon))
        elif kind == 'briefing':
            story.extend(briefing_report(salon))
        else:
            story.extend(operational_report(salon))
    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)


if __name__ == '__main__':
    render(json.load(sys.stdin), sys.stdout.buffer)
