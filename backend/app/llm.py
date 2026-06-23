"""LLM-based schedule analysis and suggestions."""

import os
from typing import Generator
from openai import OpenAI

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return _client


def stream_validation(issues: list[dict], context: dict) -> Generator[str, None, None]:
    """Stream LLM interpretation of validation issues before generation."""
    errors   = [i for i in issues if i["severity"] == "error"]
    warnings = [i for i in issues if i["severity"] == "warning"]

    def fmt(issue: dict) -> str:
        line = f"• [{issue['severity'].upper()}] {issue['category']}: {issue['message']}"
        if issue.get("items"):
            sample = issue["items"][:4]
            line += "\n  - " + "\n  - ".join(sample)
            if len(issue["items"]) > 4:
                line += f"\n  - … i {len(issue['items']) - 4} więcej"
        return line

    issues_text = "\n".join(fmt(i) for i in issues) if issues else "Brak problemów."

    prompt = f"""Jesteś agentem walidującym dane dziekanatu przed generowaniem planu zajęć uczelni.

WYNIK WALIDACJI — {len(errors)} błędów, {len(warnings)} ostrzeżeń:
{issues_text}

KONTEKST:
- Wykładowców: {context['lecturers_count']}, w tym bez dostępności: {context['no_avail_count']}
- Sale: {context['rooms_count']}
- Grup: {context['groups_count']}
- Przypisań: {context['assignments_count']}

Oceń sytuację po polsku, pisząc jak doświadczony administrator systemu. Zacznij od ogólnej oceny gotowości danych. Następnie omów najważniejsze problemy blokujące i ich wpływ na generowanie. Zakończ priorytetową listą działań do podjęcia. Bądź precyzyjny i zwięzły."""

    stream = _get_client().chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=600,
        temperature=0.3,
        stream=True,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


def stream_pre_analysis(context: dict) -> Generator[str, None, None]:
    """Stream LLM chain-of-thought analysis before OR-Tools runs."""
    assignments_text = "\n".join(
        f"- {a['course']} ({a['type']}) | {a['lecturer']} | "
        f"grupy: {', '.join(a['groups']) or '—'} | {a['sessions_per_week']}×/tydz."
        for a in context.get("assignment_details", [])
    )

    prompt = f"""Jesteś asystentem dziekanatu analizującym dane przed uruchomieniem algorytmu układania planu zajęć.

ZASOBY:
- Sale: {context['rooms_count']} (łącznie {context['rooms_count'] * 25} slotów tygodniowo)
- Slotów do zaplanowania łącznie: {context['total_slots_needed']}
- Wykładowców z ograniczoną dostępnością: {context['restricted_lecturers_count']} z {context['lecturers_count']}

PRZYPISANIA ({context['assignments_count']} pozycji):
{assignments_text}

Analizuj dane myśląc głośno po polsku. Wskaż potencjalne wąskie gardła, kolizje i ryzyka — np. wykładowca z wieloma przypisaniami, grupy z dużą liczbą zajęć, brak sal o wymaganej pojemności, ograniczona dostępność. Pisz płynnie jak strumień myśli, bez nagłówków i list punktowanych. Bądź konkretny."""

    stream = _get_client().chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=700,
        temperature=0.4,
        stream=True,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


def suggest_adjustments(conflicts: list[str], context: dict) -> str:
    online_hint = ""
    if context.get("online_capable_courses"):
        names = ", ".join(context["online_capable_courses"])
        online_hint = f"\nPrzedmioty oznaczone jako możliwe do realizacji online (algorytm już próbował je online, ale nadal nie udało się wygenerować planu): {names}"

    prompt = f"""Jesteś asystentem dziekanatu uczelni wyższej. Generator planu zajęć nie mógł wygenerować pełnego planu.

DANE WEJŚCIOWE:
- Wykładowcy: {context['lecturers']}
- Sale: {context['rooms']}
- Grupy: {context['groups']}
- Przypisania do zaplanowania: {context['assignments']}
- Dostępnych slotów: {context['available_slots']} (5 dni × 5 bloków × {context['rooms']} sal){online_hint}

KONFLIKTY / PROBLEMY:
{chr(10).join(f"- {c}" for c in conflicts)}

Zaproponuj konkretne, praktyczne zmiany które pozwolą wygenerować plan. Odpowiedz krótko i po polsku — maksymalnie 5 punktów. Każdy punkt niech zaczyna się od czasownika (np. "Zmniejsz...", "Dodaj...", "Rozdziel...", "Przenieś..."). Jeśli problem dotyczy przepełnienia sal, wskaż konkretne kursy do przeniesienia online (jeśli są takie możliwości). Skup się na najbardziej prawdopodobnych przyczynach konfliktu."""

    response = _get_client().chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=400,
        temperature=0.4,
    )
    return response.choices[0].message.content.strip()
