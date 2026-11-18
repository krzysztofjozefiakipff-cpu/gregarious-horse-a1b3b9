import sys
import xml.etree.ElementTree as ET
from zipfile import ZipFile

namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
with ZipFile(sys.argv[1]) as archive:
    entry = archive.getinfo("word/document.xml")
    if entry.file_size > 2_000_000:
        raise ValueError("Document is too large")
    root = ET.fromstring(archive.read(entry))
paragraphs = (
    "".join(node.text or "" for node in paragraph.iter(namespace + "t"))
    for paragraph in root.iter(namespace + "p")
)
print("\n\n".join(text for text in paragraphs if text.strip()))
