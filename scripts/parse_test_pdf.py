import argparse
import base64
import json
import re
from pathlib import Path

import fitz


CHECK = "\uf00c"
CROSS = "\uf00d"


def collapse_doubled(text):
    out = []
    i = 0
    while i < len(text):
        if i + 1 < len(text) and text[i] == text[i + 1]:
            out.append(text[i])
            i += 2
        else:
            out.append(text[i])
            i += 1
    return "".join(out)


def doubled_ratio(text):
    compact = "".join(ch for ch in text if not ch.isspace() and ch not in (CHECK, CROSS))
    if len(compact) < 4:
        return 0
    pairs = 0
    i = 0
    while i + 1 < len(compact):
        if compact[i] == compact[i + 1]:
            pairs += 1
            i += 2
        else:
            i += 1
    return pairs * 2 / len(compact)


def clean_text(text):
    text = text.replace(CHECK, "").replace(CROSS, "")
    if doubled_ratio(text) > 0.45:
        text = collapse_doubled(text)
    text = text.replace("\x01", "fi").replace("\x02", "fl").replace("\x03", "fi")
    text = text.replace("\x04", "fl").replace("\x05", "ff")
    text = apply_known_pdf_fixes(text)
    text = text.replace("â€œ", '"').replace("â€", '"').replace("â€™", "'")
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    text = re.sub(r"\s+", " ", text)
    text = text.strip(" :")
    if re.fullmatch(r"(.)\1", text):
        text = text[0]
    return text


def apply_known_pdf_fixes(text):
    replacements = {
        "W What": "What",
        "W While": "While",
        "W Which": "Which",
        "M MPA": "MPA",
        "M Master": "Master",
        "num mber": "number",
        "m more": "more",
        "m metres": "metres",
        "m meter": "meter",
        "m mile": "mile",
        "m meaning": "meaning",
        "m many": "many",
        "m makes": "makes",
        "m must": "must",
        "m maneuver": "maneuver",
        "m manoevure": "manoeuvre",
        "m mechanical": "mechanical",
        "m middle": "middle",
        "m mark": "mark",
        "Com mpass": "Compass",
        "equipm ment": "equipment",
        "im mportant": "important",
        "em mergency": "emergency",
        "determ mine": "determine",
        "statem ments": "statements",
        "perm mission": "permission",
        "trafi fic": "traffic",
        "trafic": "traffic",
        "fiare": "flare",
        "flre": "fire",
        "Imediately": "Immediately",
        "aproaching": "approaching",
        "colision": "collision",
        "vesel": "vessel",
        "comand": "command",
        "god lokout": "good lookout",
        "lokout al": "lookout all",
        "pasage": "passage",
        "narow chanel": "narrow channel",
        "crosing": "crossing",
        "necesary": "necessary",
        "botom": "bottom",
        "thre": "three",
    }
    for src, target in replacements.items():
        text = text.replace(src, target)
    return text


def collect_elements(pdf_path):
    doc = fitz.open(pdf_path)
    elements = []
    for page_index, page in enumerate(doc):
        page_offset = page_index * 1000
        for block in page.get_text("dict")["blocks"]:
            bbox = block["bbox"]
            y = bbox[1]
            if block.get("type") == 1:
                elements.append(
                    {
                        "kind": "image",
                        "page": page_index + 1,
                        "x": bbox[0],
                        "y": page_offset + y,
                        "data": f"data:image/{block.get('ext', 'png')};base64,"
                        + base64.b64encode(block["image"]).decode("ascii"),
                    }
                )
                continue

            if block.get("type") != 0:
                continue
            for line in block["lines"]:
                raw = "".join(span["text"] for span in line["spans"]).strip()
                if not raw:
                    continue
                y_line = page_offset + line["bbox"][1]
                x_line = line["bbox"][0]
                if line["bbox"][1] > 775:
                    continue
                elements.append(
                    {
                        "kind": "text",
                        "page": page_index + 1,
                        "x": x_line,
                        "y": y_line,
                        "raw": raw,
                        "text": clean_text(raw),
                        "has_check": CHECK in raw,
                        "has_cross": CROSS in raw,
                        "is_bold": doubled_ratio(raw) > 0.45,
                    }
                )

    elements.sort(key=lambda item: (item["y"], item["x"]))
    return merge_same_line(elements)


def merge_same_line(elements):
    merged = []
    for item in elements:
        if item["kind"] != "text" or not merged or merged[-1]["kind"] != "text":
            merged.append(item)
            continue
        prev = merged[-1]
        if item["page"] == prev["page"] and abs(item["y"] - prev["y"]) < 1.2:
            prev["raw"] = f"{prev['raw']} {item['raw']}"
            prev["text"] = clean_text(prev["raw"])
            prev["has_check"] = prev["has_check"] or item["has_check"]
            prev["has_cross"] = prev["has_cross"] or item["has_cross"]
            prev["is_bold"] = prev["is_bold"] or item["is_bold"]
            prev["x"] = min(prev["x"], item["x"])
        else:
            merged.append(item)
    return merged


def is_noise(item):
    text = item.get("text", "")
    if not text:
        return True
    if "Boat Shop Asia" in text or "talentlms.com" in text:
        return True
    if text in {"SS", "S", ""}:
        return True
    if "You completed this test" in text or "Your score is" in text or "Out of" in text:
        return True
    if "retry this test" in text or "Not passed" in text:
        return True
    return False


def parse_cards(pdf_path):
    elements = collect_elements(pdf_path)
    cards = []
    current = None

    def finish():
        nonlocal current
        if not current:
            return
        question = " ".join(current["question"]).strip()
        answers = [answer["text"].strip() for answer in current["answers"] if answer["text"].strip()]
        if question and len(answers) >= 2:
            correct = next((i for i, answer in enumerate(current["answers"]) if answer["correct"]), None)
            if correct is None:
                correct = next((i for i, answer in enumerate(current["answers"]) if answer["bold"] and not answer["cross"]), 0)
            card = {
                "question": question,
                "answers": answers,
                "correctIndex": correct,
            }
            if current["images"]:
                card["imageBase64"] = current["images"][0]
            cards.append(card)
        current = None

    for item in elements:
        if item["kind"] == "image":
            if current and not current["answers"]:
                current["images"].append(item["data"])
            continue

        if is_noise(item):
            continue

        text = item["text"]
        if text in {"CORRECT", "INCORRECT"}:
            finish()
            current = {"question": [], "answers": [], "images": []}
            continue

        if not current:
            continue

        starts_option = current["question"] and (item["x"] >= 45 or item["has_check"] or item["has_cross"] or current["answers"])
        if starts_option:
            current["answers"].append(
                {
                    "text": text,
                    "correct": item["has_check"] or (item["is_bold"] and not item["has_cross"]),
                    "bold": item["is_bold"],
                    "cross": item["has_cross"],
                }
            )
        else:
            current["question"].append(text)

    finish()
    return cards


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf")
    parser.add_argument("output")
    args = parser.parse_args()
    cards = parse_cards(args.pdf)
    Path(args.output).write_text(json.dumps(cards, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(cards)} cards to {args.output}")


if __name__ == "__main__":
    main()
