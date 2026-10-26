# Vorrat

Vorratshaltung für den Haushalt – als installierbare Web-App für Handy und Desktop.

## Ansichten
- **Übersicht** – Reichweite in Tagen für den Haushalt (Energie, dazu Eiweiss, Fett und Wasser separat), Gesamtkalorien, Warnungen für ablaufende Chargen, Energie nach Kategorie, Tagesbedarf pro Person.
- **Bestand** – alle Produkte nach Kategorie. `+` legt eine Charge an (Anzahl + MHD, wahlweise „Ende Monat“), `−` entnimmt eine Packung aus der Charge, die zuerst abläuft. Antippen zeigt Nährwerte und alle Chargen.
- **Produkte** – Katalog mit Nährwerten. Neue Produkte erfassen oder bearbeiten; Produkte mit `geschätzt` haben Nährwerte, die nicht vom Etikett stammen.
- **Einstellungen** – Haushalt (Personen, Alter, Aktivität), Warnschwellen, Wasserbedarf, GitHub-Sync, CSV-Export und JSON-Backup.

## Berechnung
- Energie pro Packung = kcal/100 × essbare Menge (Abtropfgewicht, falls angegeben) ÷ 100.
- Bedarf: Richtwerte für die Energiezufuhr nach D-A-CH/DGE (Alter, Geschlecht, PAL 1,4 / 1,6 / 1,8); Eiweiss nach DGE-Referenzwerten; Fett als 30 % der Energie. Pro Person per kcal-Wert überschreibbar.
- **Reichweite** = Gesamtkalorien ÷ Tagesbedarf des Haushalts. Eiweiss, Fett und Wasser werden als eigene Reichweiten angezeigt.
- Wasser: Produkte der Kategorie „Getränke & Wasser“ mit Literangabe; Standardbedarf 3 l pro Person und Tag.
- Warnungen: gelb ≤ 60 Tage, rot ≤ 14 Tage, abgelaufen (einstellbar). Abgelaufene Chargen zählen standardmässig zur Reichweite (MHD ≠ Verbrauchsdatum), abschaltbar.

## Daten & Datenschutz
Dieses Repo enthält **nur den Code**. Die Daten liegen als `vorrat.json` in einem **privaten** Repo – standardmässig
`habits-data`, damit der bestehende Token der HabitsApp weiterverwendet werden kann. Die App liest und schreibt
über die GitHub-API; der Token bleibt nur auf dem jeweiligen Gerät. Beim ersten Verbinden wird die Datei mit dem
Startkatalog angelegt.

Änderungen werden lokal sofort gespeichert und nach ~1,5 s synchronisiert (offline-fähig).

## Entwicklung
```bash
npm install
npm run dev
npm run build
```
Deployment auf GitHub Pages läuft automatisch bei jedem Push auf `main` (`.github/workflows/deploy.yml`).
In den Repo-Settings unter *Pages* als Source „GitHub Actions“ wählen.
