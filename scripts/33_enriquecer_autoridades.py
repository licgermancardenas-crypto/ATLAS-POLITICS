"""Enriquece data/web/autoridades.json con datos manuales curados.

Cobertura prioritaria:
- 24 partidos del Conurbano PBA
- 15 comunas CABA
- 24 capitales provinciales

Fecha referencia: mayo 2026
Fuente: sitios oficiales municipales + comunicación pública (verificar manualmente).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT = Path(r"C:/Users/corra/Desktop/ATLAS politics")
WEB = PROJECT / "data" / "web"

# Hardcoded conurbano PBA (24 partidos) — intendente + partido + fecha mandato
# Códigos INDEC PBA depto
INTENDENTES = {
    # CONURBANO ZONA NORTE
    "06028": ("Avellaneda",        "Jorge Ferraresi",     "Unión por la Patria"),
    "06035": ("Berazategui",       "Juan Patricio Mussi", "Unión por la Patria"),
    "06091": ("Brown (Almirante)", "Mariano Cascallares", "Unión por la Patria"),
    "06119": ("Echeverría (Esteban)","Fernando Gray",     "Unión por la Patria"),
    "06245": ("Florencio Varela",  "Andrés Watson",       "Unión por la Patria"),
    "06270": ("General San Martín","Fernando Moreira",    "Unión por la Patria"),
    "06274": ("Hurlingham",        "Damián Selci",        "Unión por la Patria"),
    "06371": ("La Matanza",        "Fernando Espinoza",   "Unión por la Patria"),
    "06408": ("Lanús",             "Julián Álvarez",      "Unión por la Patria"),
    "06410": ("Lomas de Zamora",   "Federico Otermín",    "Unión por la Patria"),
    "06412": ("José C. Paz",       "Mario Ishii",         "Unión por la Patria"),
    "06441": ("Malvinas Argentinas","Leonardo Nardini",   "Unión por la Patria"),
    "06515": ("Merlo",             "Gustavo Menéndez",    "Unión por la Patria"),
    "06525": ("Moreno",            "Mariel Fernández",    "Unión por la Patria"),
    "06539": ("Morón",             "Lucas Ghi",           "Unión por la Patria"),
    "06560": ("Quilmes",           "Mayra Mendoza",       "Unión por la Patria"),
    "06568": ("San Fernando",      "Juan Andreotti",      "Unión por la Patria"),
    "06756": ("San Isidro",        "Ramón Lanús",         "Juntos por el Cambio"),
    "06760": ("San Miguel",        "Jaime Méndez",        "Juntos por el Cambio"),
    "06778": ("San Vicente",       "Nicolás Mantegazza",  "Unión por la Patria"),
    "06805": ("Tigre",             "Julio Zamora",        "Unión por la Patria"),
    "06840": ("Tres de Febrero",   "Diego Valenzuela",    "PRO"),
    "06861": ("Vicente López",     "Jorge Macri (reemplazó)", "PRO"),
    "06756": ("San Isidro",        "Ramón Lanús",         "PRO"),
    "06490": ("Marcos Paz",        "Ricardo Curutchet",   "Unión por la Patria"),
    # GRAN BUENOS AIRES extendido
    "06560": ("Quilmes",           "Mayra Mendoza",       "Unión por la Patria"),
    "06490": ("Marcos Paz",        "Ricardo Curutchet",   "Unión por la Patria"),

    # CAPITALES PROVINCIALES
    "10035": ("San Fernando del Valle de Catamarca", "Gustavo Saadi", "Frente de Todos"),
    "14014": ("Capital (Córdoba)", "Daniel Passerini", "Hacemos Unidos por Córdoba"),
    "18021": ("Capital (Corrientes)", "Eduardo Tassano", "ECO+Vamos Corrientes"),
    "22014": ("San Fernando (Resistencia)", "Roy Nikisch", "Juntos por el Cambio"),
    "26056": ("Rawson",            "Damián Biss",         "Juntos por el Cambio"),
    "30084": ("Paraná",            "Rosario Romero",      "Unión por la Patria"),
    "34014": ("Formosa",           "Jorge Jofré",         "Frente de la Victoria"),
    "38007": ("San Salvador de Jujuy", "Raúl Jorge",      "Cambia Jujuy"),
    "42007": ("Santa Rosa",        "Luciano Di Nápoli",   "Frente de Todos"),
    "46028": ("La Rioja",          "Gustavo Robles",      "Frente de Todos"),
    "50028": ("Capital (Mendoza)", "Ulpiano Suárez",      "Cambia Mendoza"),
    "54042": ("Posadas",           "Leonardo Stelatto",   "Frente Renovador (Misiones)"),
    "58028": ("Confluencia (Neuquén)", "Mariano Gaido",   "MPN"),
    "62098": ("Capital (Viedma)",  "Pedro Pesatti",       "Juntos Somos Río Negro"),
    "66028": ("Capital (Salta)",   "Emiliano Durand",     "Mejor Juntos"),
    "70028": ("Capital (San Juan)","Susana Laciar",       "Juntos por el Cambio"),
    "74014": ("San Luis (Capital)","Gastón Hissa",        "Frente de Todos"),
    "78014": ("Río Gallegos",      "Pablo Grasso",        "Frente de Todos"),
    "82084": ("Capital (Santa Fe)","Juan Pablo Poletti",  "Unidos para Cambiar Santa Fe"),
    "86014": ("Capital (Santiago)","Norma Fuentes",       "Frente Cívico por Santiago"),
    "94007": ("Río Grande",        "Martín Pérez",        "Forja"),
    "94015": ("Ushuaia",           "Walter Vuoto",        "Frente de Todos"),
    "90007": ("Capital (Tucumán)", "Rossana Chahla",      "Frente Tucumán Primero"),
}

# CABA: las 15 comunas (códigos depto INDEC)
COMUNAS_CABA = {
    "02007": ("Comuna 1",  "Vivian Bourg",        "Vamos por Más"),
    "02014": ("Comuna 2",  "Verónica Sangiao",    "Vamos por Más"),
    "02021": ("Comuna 3",  "Mariano Bartolomé",   "Vamos por Más"),
    "02028": ("Comuna 4",  "Liliana Chernajovsky","Unión por la Patria"),
    "02035": ("Comuna 5",  "Maite Diez",          "Vamos por Más"),
    "02042": ("Comuna 6",  "Lucrecia Solivelles", "Vamos por Más"),
    "02049": ("Comuna 7",  "Ezequiel Pazos",      "Vamos por Más"),
    "02056": ("Comuna 8",  "María Magdalena Tinto","Unión por la Patria"),
    "02063": ("Comuna 9",  "Roberto Salcedo",     "Vamos por Más"),
    "02070": ("Comuna 10", "Gimena Villafruela",  "Vamos por Más"),
    "02077": ("Comuna 11", "Juan Loutaif",        "Vamos por Más"),
    "02084": ("Comuna 12", "Federico Otero",      "Vamos por Más"),
    "02091": ("Comuna 13", "Mercedes Méndez",     "Vamos por Más"),
    "02098": ("Comuna 14", "Federico Cingolani",  "Vamos por Más"),
    "02105": ("Comuna 15", "Daniel Lipovetzky",   "Vamos por Más"),
}

GOBERNADORES = {
    "02": ("CABA",                              "Jorge Macri",      "PRO"),
    "06": ("Buenos Aires",                      "Axel Kicillof",    "Unión por la Patria"),
    "10": ("Catamarca",                         "Raúl Jalil",       "Frente de Todos"),
    "14": ("Córdoba",                           "Martín Llaryora",  "Hacemos Unidos"),
    "18": ("Corrientes",                        "Gustavo Valdés",   "ECO+Vamos"),
    "22": ("Chaco",                             "Leandro Zdero",    "Juntos por el Cambio"),
    "26": ("Chubut",                            "Ignacio Torres",   "Juntos por el Cambio"),
    "30": ("Entre Ríos",                        "Rogelio Frigerio", "Juntos por el Cambio"),
    "34": ("Formosa",                           "Gildo Insfrán",    "PJ"),
    "38": ("Jujuy",                             "Carlos Sadir",     "Cambia Jujuy"),
    "42": ("La Pampa",                          "Sergio Ziliotto",  "PJ"),
    "46": ("La Rioja",                          "Ricardo Quintela", "PJ"),
    "50": ("Mendoza",                           "Alfredo Cornejo",  "Cambia Mendoza"),
    "54": ("Misiones",                          "Hugo Passalacqua", "Frente Renovador (Mis)"),
    "58": ("Neuquén",                           "Rolando Figueroa", "Comunidad/MPN"),
    "62": ("Río Negro",                         "Alberto Weretilneck","Juntos Somos RN"),
    "66": ("Salta",                             "Gustavo Sáenz",    "Gana Salta"),
    "70": ("San Juan",                          "Marcelo Orrego",   "Cambia San Juan"),
    "74": ("San Luis",                          "Claudio Poggi",    "Avanzar"),
    "78": ("Santa Cruz",                        "Claudio Vidal",    "SER Santa Cruz"),
    "82": ("Santa Fe",                          "Maximiliano Pullaro","UCR/Unidos"),
    "86": ("Santiago del Estero",               "Gerardo Zamora",   "Frente Cívico"),
    "90": ("Tucumán",                           "Osvaldo Jaldo",    "PJ Tucumán"),
    "94": ("Tierra del Fuego",                  "Gustavo Melella",  "Forja/PJ"),
    "46": ("La Rioja",                          "Ricardo Quintela", "PJ"),
}


def main() -> None:
    p = WEB / "autoridades.json"
    data = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    intend = data.get("intendentes_por_depto", {})
    gobs = data.get("gobernadores_por_provincia", {})

    # Mergear hardcoded (Wikidata pierde vs hardcoded)
    for code, (nombre, head, partido) in INTENDENTES.items():
        intend[code] = {
            "intendente": head,
            "partido_intendente": partido,
            "_municipio": nombre,
            "_source": "manual_2026",
        }
    for code, (nombre, head, partido) in COMUNAS_CABA.items():
        intend[code] = {
            "intendente": head,
            "partido_intendente": partido,
            "_municipio": nombre,
            "_source": "manual_2026",
            "_tipo": "Junta Comunal",
        }
    for code, (nombre, gob, partido) in GOBERNADORES.items():
        gobs[code] = {
            "gobernador": gob,
            "partido_gob": partido,
            "_provincia": nombre,
            "_source": "manual_2026",
        }

    data["intendentes_por_depto"] = intend
    data["gobernadores_por_provincia"] = gobs
    data["actualizado"] = "2026-05-20"
    data["fuente"] = "Wikidata + hardcoded manual (verificar contra sitios oficiales)"
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"-> {p.name} · {len(intend)} intendentes · {len(gobs)} gobernadores")


if __name__ == "__main__":
    main()
