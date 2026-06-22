# PRD.md

# System automatycznego tworzenia planów zajęć dla dziekanatu

## 1. Cel projektu

Celem aplikacji jest stworzenie systemu wspierającego dziekanat w
tworzeniu planów zajęć.

System ma: - przechowywać dane o zajęciach, wykładowcach, salach i
grupach, - umożliwiać definiowanie ograniczeń, - automatycznie generować
optymalny plan zajęć, - wykrywać i raportować konflikty, - pozwalać na
ręczne korekty planu.

Głównym użytkownikiem jest pracownik dziekanatu.

## 2. Zakres MVP

### Funkcje obowiązkowe

-   zarządzanie wykładowcami,
-   zarządzanie salami,
-   zarządzanie grupami studentów,
-   zarządzanie przedmiotami,
-   tworzenie zajęć,
-   generowanie planu,
-   wykrywanie konfliktów,
-   widok kalendarza.

## 3. Generator planu

Technologia: - Python - Google OR-Tools

Uwzględniane ograniczenia:

### Twarde

-   wykładowca nie może prowadzić dwóch zajęć jednocześnie,
-   sala nie może mieć dwóch zajęć jednocześnie,
-   grupa nie może mieć dwóch zajęć jednocześnie,
-   zajęcia tylko w dostępności wykładowcy,
-   sala musi spełniać wymagania.

### Miękkie

-   preferencje wykładowców,
-   unikanie okienek,
-   priorytety zajęć.

## 4. Backend

Technologie:

-   FastAPI
-   SQLAlchemy
-   PostgreSQL

Struktura:

backend/

app/ - main.py - models/ - schemas/ - routers/ - services/ -
scheduler.py - database.py

## 5. Modele danych

### Lecturer

-   id
-   name
-   email
-   availability

### Room

-   id
-   name
-   capacity
-   features

### StudentGroup

-   id
-   name
-   size

### Course

-   id
-   name
-   hours
-   type
-   priority
-   requirements

### ScheduleEntry

-   id
-   course_id
-   lecturer_id
-   room_id
-   group_id
-   day
-   start_time
-   end_time

## 6. API

Przykładowe endpointy:

GET /lecturers

POST /lecturers

GET /rooms

POST /rooms

GET /schedule

POST /schedule/generate

## 7. Widok kalendarza

Frontend: - React - FullCalendar

Widoki: - plan grupy, - plan wykładowcy, - plan sali.

## 8. Kolejność implementacji

Etap 1: - FastAPI - PostgreSQL - modele - CRUD

Etap 2: - kalendarz - API planów

Etap 3: - OR-Tools scheduler

Etap 4: - Google Calendar

## 9. Kryteria sukcesu MVP

System umożliwia:

-   dodanie wykładowcy,
-   dodanie sali,
-   dodanie grupy,
-   dodanie przedmiotu,
-   wygenerowanie planu,
-   wykrycie konfliktów,
-   wyświetlenie planu,
-   ręczną zmianę zajęć.

