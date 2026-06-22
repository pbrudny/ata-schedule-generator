"""LLM-based schedule conflict analysis."""

import os
from openai import OpenAI

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return _client


def suggest_adjustments(conflicts: list[str], context: dict) -> str:
    prompt = f"""Jesteś asystentem dziekanatu uczelni wyższej. Generator planu zajęć nie mógł wygenerować pełnego planu.

DANE WEJŚCIOWE:
- Wykładowcy: {context['lecturers']}
- Sale: {context['rooms']}
- Grupy: {context['groups']}
- Przypisania do zaplanowania: {context['assignments']}
- Dostępnych slotów: {context['available_slots']} (5 dni × 5 bloków × {context['rooms']} sal)

KONFLIKTY / PROBLEMY:
{chr(10).join(f"- {c}" for c in conflicts)}

Zaproponuj konkretne, praktyczne zmiany które pozwolą wygenerować plan. Odpowiedz krótko i po polsku — maksymalnie 5 punktów. Każdy punkt niech zaczyna się od czasownika (np. "Zmniejsz...", "Dodaj...", "Rozdziel..."). Skup się na najbardziej prawdopodobnych przyczynach konfliktu."""

    response = _get_client().chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=400,
        temperature=0.4,
    )
    return response.choices[0].message.content.strip()
