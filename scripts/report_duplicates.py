import collections
import glob
import json
from pathlib import Path


def card_signature(card):
    return f"{card['question'].strip()}|{'|'.join(str(answer).strip() for answer in card['answers'])}"


def main():
    cards = []
    for path in sorted(glob.glob("src/lib/data/sets/test-set-*.json")):
        source_set = Path(path).stem.replace("test-set-", "Test Set ")
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        for index, card in enumerate(data, 1):
            cards.append(
                {
                    **card,
                    "sourceSet": card.get("sourceSet", source_set),
                    "sourceQuestion": card.get("sourceQuestion", index),
                }
            )

    groups = collections.defaultdict(list)
    for card in cards:
        groups[card_signature(card)].append(card)

    duplicates = [group for group in groups.values() if len(group) > 1]
    duplicates.sort(key=lambda group: (-len(group), group[0]["question"]))

    lines = [
        "# Duplicate Questions Report",
        "",
        f"- Parsed rows: {len(cards)}",
        f"- Unique questions by exact question+answers signature: {len(groups)}",
        f"- Duplicate groups: {len(duplicates)}",
        f"- Extra duplicate rows removed by dedupe: {sum(len(group) - 1 for group in duplicates)}",
        "",
    ]

    for number, group in enumerate(duplicates, 1):
        first = group[0]
        locations = ", ".join(f"{card['sourceSet']} Q{card['sourceQuestion']}" for card in group)
        lines.extend(
            [
                f"## {number}. {first['question']}",
                f"- Occurs {len(group)} times: {locations}",
                "- Answers:",
            ]
        )
        for answer_index, answer in enumerate(first["answers"]):
            marker = " (correct)" if answer_index == first["correctIndex"] else ""
            lines.append(f"  {answer_index + 1}. {answer}{marker}")
        lines.append("")

    output = Path("duplicate-questions.md")
    output.write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines[:120]))
    print(f"\nReport written to {output.resolve()}")


if __name__ == "__main__":
    main()
