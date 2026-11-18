import posixpath
import sys
import xml.etree.ElementTree as ET
from zipfile import ZipFile

SHEET = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
SLIDES = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
DRAW = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
REL_ID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def ordered_parts(archive, manifest, entries):
    folder, name = posixpath.split(manifest)
    relationships = archive.read_xml(posixpath.join(folder, "_rels", name + ".rels"))
    targets = {
        item.attrib["Id"]: item.attrib["Target"]
        for item in relationships if item.get("TargetMode") != "External"
    }
    for entry in archive.read_xml(manifest).iter(entries):
        target = targets.get(entry.get(REL_ID))
        if target:
            yield posixpath.normpath(posixpath.join(folder, target)).lstrip("/")


class Document:
    def __init__(self, archive):
        self.archive = archive
        self.remaining = 8_000_000

    def read_xml(self, name):
        info = self.archive.getinfo(name)
        if info.file_size > min(2_000_000, self.remaining):
            raise ValueError("Document is too large")
        self.remaining -= info.file_size
        return ET.fromstring(self.archive.read(info))


def spreadsheet(document):
    try:
        strings = [
            "".join(part.text or "" for part in item.iter(SHEET + "t"))
            for item in document.read_xml("xl/sharedStrings.xml").iter(SHEET + "si")
        ]
    except KeyError:
        strings = []
    for path in ordered_parts(document, "xl/workbook.xml", SHEET + "sheet"):
        for row in document.read_xml(path).iter(SHEET + "row"):
            values = []
            for cell in row.findall(SHEET + "c"):
                value = cell.findtext(SHEET + "v") or ""
                if cell.get("t") == "s":
                    value = strings[int(value)]
                elif cell.get("t") == "inlineStr":
                    value = "".join(part.text or "" for part in cell.iter(SHEET + "t"))
                if value.strip():
                    values.append(value.strip())
            if values:
                yield " — ".join(values)


def presentation(document):
    for path in ordered_parts(document, "ppt/presentation.xml", SLIDES + "sldId"):
        lines = [
            "".join(node.text or "" for node in paragraph.iter(DRAW + "t")).strip()
            for paragraph in document.read_xml(path).iter(DRAW + "p")
        ]
        if any(lines):
            yield "\n".join(filter(None, lines))


with ZipFile(sys.argv[1]) as archive:
    extractor = {"xlsx": spreadsheet, "pptx": presentation}[sys.argv[2]]
    length = 0
    for block in extractor(Document(archive)):
        length += len(block)
        if length > 120_000:
            break
        print(block + "\n")
