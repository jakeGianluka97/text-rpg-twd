"""WebEngine for the text adventure game.

Questo modulo fornisce una versione del motore di gioco adatta
all'integrazione web. Tutte le funzioni restituiscono stringhe invece
di stampare direttamente a video, così possono essere inviate come
risposte JSON a un front‑end.
"""

from __future__ import annotations

import logging
import random
from typing import Dict, Optional

from .ai_helper import AIHelper
from .game_engine import GameState, Character, roll_dice

from dataclasses import dataclass, field
from typing import Any
from . import database


class WebEngine:
    """Motore di gioco adattato per l'uso via HTTP/JSON.

    Questo motore estende la versione CLI aggiungendo supporto per regioni,
    lingue e livelli di difficoltà. Le interazioni restituiscono sempre
    stringhe per essere facilmente serializzate come JSON.
    """

    def __init__(self, ai_helper: AIHelper, db_path: str = database.DEFAULT_DB_PATH) -> None:
        self.ai_helper = ai_helper
        self.db_path = db_path
        self.state: Optional[GameState] = None

    def load_or_create(
        self, player_name: str, region: str = "Italia", difficulty: str = "normale"
    ) -> str:
        """Carica lo stato se esiste; altrimenti crea una nuova partita.

        Args:
            player_name: nome scelto dall'utente.
            region: area geografica iniziale (es. Italia, Inghilterra). Influisce
                sulla lingua iniziale e sui dialetti potenzialmente presenti.
            difficulty: livello di difficoltà (facile, normale, difficile).

        Restituisce una descrizione iniziale da presentare al giocatore.
        """
        data = database.load_state(self.db_path)
        if data:
            self.state = GameState.from_dict(data)
            logging.info(
                "Partita caricata dal database per %s.", self.state.character.name
            )
            return "Bentornato, " + self.state.character.name + "."
        # Crea una nuova partita
        scores = self._generate_ability_scores()
        character = Character(name=player_name, **scores)
        # Determina la lingua principale in base alla regione
        region_lower = region.lower()
        language = self._language_for_region(region_lower)
        # Inizializza lo stato con campi aggiuntivi
        self.state = GameState(
            character=character,
            region=region,
            language=language,
            known_languages=[language],
            difficulty=difficulty,
        )
        # Genera una descrizione iniziale considerando la regione
        intro_prompt = (
            f"Ti chiami {player_name} e ti risvegli in una zona di {region}. "
            "Descrivi l'ambiente circostante invaso da vaganti, usando toni cupi."
        )
        intro = self.ai_helper.generate(intro_prompt)
        self.state.narrative_history.append(intro)
        database.save_state(self.state.to_dict(), self.db_path)
        return intro

    def _language_for_region(self, region: str) -> str:
        """Restituisce la lingua principale associata a una regione.

        In questa implementazione semplificata, alcune regioni comuni sono
        mappate a lingue specifiche. Se la regione non è riconosciuta,
        ritorna "italiano" come default.
        """
        mapping = {
            "italia": "italiano",
            "inghilterra": "inglese",
            "francia": "francese",
            "spagna": "spagnolo",
            "germania": "tedesco",
            "usa": "inglese",
            "stati uniti": "inglese",
        }
        return mapping.get(region.lower(), "italiano")

    def _generate_ability_scores(self) -> Dict[str, int]:
        return {
            "strength": random.randint(8, 15),
            "dexterity": random.randint(8, 15),
            "constitution": random.randint(8, 15),
            "intelligence": random.randint(8, 15),
            "wisdom": random.randint(8, 15),
            "charisma": random.randint(8, 15),
        }

    def handle_command(self, cmd: str) -> str:
        """Elabora un comando e restituisce una risposta."""
        if not self.state:
            return "Errore: nessuna partita avviata."
        cmd = cmd.strip().lower()
        if not cmd:
            return "Non hai digitato alcun comando."
        # comandi speciali
        if cmd in ("aiuto", "help"):
            return self._help_text()
        if cmd in ("inventario",):
            return self._inventory_text()
        # parsing verbo
        parts = cmd.split()
        verb = parts[0]
        args = parts[1:]
        if verb == "guarda":
            return self._look()
        if verb == "prendi" and args:
            return self._take(" ".join(args))
        if verb == "usa" and args:
            return self._use(" ".join(args))
        if verb == "muovi" and args:
            return self._move(args[0])
        if verb == "parla" and args:
            return self._talk(args[0])
        if verb in ("relazioni",):
            return self._list_relationships()
        if verb in ("eventi",):
            return self._list_events()
        # Interpretazione libera: quando l'input non corrisponde a nessun comando
        # specifico, lo trattiamo come parte della narrazione e lasciamo che
        # l'AI continui la storia in base al contesto.
        return self._free_response(cmd)

    def _free_response(self, user_input: str) -> str:
        """Gestisce input libero (non comando) fornito dal giocatore.

        Invia all'AI un prompt che descrive l'ambiente attuale e incorpora
        l'input dell'utente, in modo da ottenere una continuazione
        narrativa coerente. Aggiorna la storia e salva lo stato.
        """
        if not self.state:
            return "Errore di stato."
        # Prepara un prompt che include l'input del giocatore
        prompt = (
            f"Sei in {self.state.location}. L'utente dice: '{user_input}'. "
            "Continua la narrazione in modo realistico e cupo, reagendo a ciò che ha detto l'utente e descrivendo cosa accade nei dintorni, inclusi eventuali vaganti o personaggi."  # noqa: E501
        )
        response = self.ai_helper.generate(prompt)
        # Registra la risposta nella cronologia
        self.state.narrative_history.append(response)
        database.save_state(self.state.to_dict(), self.db_path)
        return response

    def _help_text(self) -> str:
        return (
            "Comandi disponibili:\n"
            "  guarda — osserva l'ambiente\n"
            "  inventario — mostra gli oggetti che possiedi\n"
            "  prendi <oggetto> — raccogli un oggetto\n"
            "  usa <oggetto> — usa un oggetto\n"
            "  muovi <direzione> — prova a muoverti (nord, sud, est, ovest)\n"
            "  parla <nome> — parla con un personaggio che hai incontrato\n"
            "  relazioni — riepiloga i rapporti con i personaggi\n"
            "  eventi — elenca gli eventi importanti"
        )

    def _inventory_text(self) -> str:
        inv = self.state.character.inventory
        if inv:
            return "Nel tuo inventario hai: " + ", ".join(inv)
        return "Il tuo inventario è vuoto."

    def _look(self) -> str:
        # Descrizione base dell'ambiente
        prompt = (
            f"Sei in {self.state.location}. "
            "Descrivi l'ambiente circostante con toni cupi e minacciosi, facendo riferimento ai vaganti presenti."
        )
        description = self.ai_helper.generate(prompt)
        # Possibilità di incontrare un nuovo personaggio o villain
        encounter_text = ""
        if random.random() < 0.3:
            villain = self._generate_villain()
            # Aggiungi alla mappa delle relazioni con valori iniziali
            self.state.relationships[villain.name] = {
                "trust": 0,
                "hostility": villain.hostility,
                "role": "villain",
                "personality": villain.personality,
            }
            # Registra l'evento di incontro
            event_desc = f"Hai incontrato {villain.name}, un {villain.personality}."
            self.state.events.append({"type": "incontro", "description": event_desc})
            encounter_text = f"\n{event_desc}"
        full_desc = description + encounter_text
        self.state.narrative_history.append(full_desc)
        database.save_state(self.state.to_dict(), self.db_path)
        return full_desc

    def _take(self, item: str) -> str:
        char = self.state.character
        mod = char.modifiers.get("WIS", 0)
        roll = roll_dice()
        total = roll + mod
        if total >= 10:
            char.inventory.append(item)
            database.save_state(self.state.to_dict(), self.db_path)
            return f"Hai trovato e raccolto {item} (tiro {roll}+{mod}={total} ≥ 10)."
        return f"Non riesci a trovare {item} (tiro {roll}+{mod}={total} < 10)."

    def _use(self, item: str) -> str:
        char = self.state.character
        if item not in char.inventory:
            return f"Non hai {item} nell'inventario."
        if item.lower() in ("medikit", "kit medico"):
            if char.hp < 10:
                char.hp = min(10, char.hp + 5)
                char.inventory.remove(item)
                database.save_state(self.state.to_dict(), self.db_path)
                return "Usi il medikit e recuperi energia. Punti ferita attuali: " + str(char.hp)
            return "Sei già al massimo della salute, non è necessario usarlo adesso."
        return f"Usi {item}, ma nulla di particolare accade in questo momento."

    def _move(self, direction: str) -> str:
        valid = {"nord", "sud", "est", "ovest"}
        if direction not in valid:
            return "Direzione non valida. Scegli tra nord, sud, est, ovest."
        prev_location = self.state.location
        self.state.location = f"{direction} del {prev_location}"
        description = self.ai_helper.generate(
            f"Il personaggio si muove verso {direction}. Descrivi cosa vede nella nuova area in modo inquietante."
        )
        self.state.narrative_history.append(description)
        database.save_state(self.state.to_dict(), self.db_path)
        return description

    # ------------------------- Relazioni e dialoghi -------------------------

    @dataclass
    class Villain:
        name: str
        personality: str
        hostility: int  # valore da 1 a 10

    def _generate_villain(self) -> "WebEngine.Villain":
        """Genera un nuovo villain con nome e personalità casuali."""
        names = ["Daryl", "Morgan", "Alpha", "Beta", "Marauder", "Raider"]
        personalities = ["spietato leader", "carismatico manipolatore", "spregiudicato opportunista"]
        name = random.choice(names) + " " + random.choice(["Smith", "Jones", "Brown"])
        personality = random.choice(personalities)
        hostility = random.randint(5, 10)
        return WebEngine.Villain(name, personality, hostility)

    def _talk(self, target_name: str) -> str:
        """Interagisci con un personaggio presente nelle relazioni."""
        if not self.state:
            return "Errore di stato."
        rel = self.state.relationships.get(target_name)
        if not rel:
            return f"Non c'è nessuno chiamato {target_name} con cui parlare."
        # Estrai parametri relazionali
        trust = rel.get("trust", 0)
        hostility = rel.get("hostility", 0)
        role = rel.get("role", "npc")
        personality = rel.get("personality", "personaggio")
        # Genera una conversazione considerando la lingua e la fiducia
        language = self.state.language
        # Se il personaggio non conosce la lingua corrente, aggiungi incomprensioni
        if language not in self.state.known_languages:
            prompt = (
                f"Stai tentando di parlare con {target_name}, ma parli {self.state.language} e lui/lei no. "
                "Descrivi la scena con evidenti incomprensioni linguistiche."
            )
        else:
            # Prompt basato su ruolo e personalità
            if role == "villain" and hostility > trust:
                prompt = (
                    f"Dialogo teso con {target_name}, un {personality}. "
                    "Il personaggio è diffidente e ostile, potresti subire minacce."
                )
            else:
                prompt = (
                    f"Conversazione con {target_name}, {personality}. "
                    "Mostra come cambia il suo atteggiamento in base alla fiducia attuale."
                )
        description = self.ai_helper.generate(prompt)
        # Aggiorna fiducia/ostilità in modo semplice
        change = random.choice([-1, 0, 1])
        rel["trust"] = max(0, min(10, trust + change))
        rel["hostility"] = max(0, min(10, hostility - change))
        # Registra l'evento
        self.state.events.append({
            "type": "dialogo",
            "description": f"Hai parlato con {target_name}. Fiducia: {rel['trust']} Hostilità: {rel['hostility']}"
        })
        database.save_state(self.state.to_dict(), self.db_path)
        return description

    def _list_relationships(self) -> str:
        """Restituisce un sommario delle relazioni attuali."""
        if not self.state.relationships:
            return "Non hai ancora incontrato nessuno."
        lines = ["Relazioni attuali:"]
        for name, rel in self.state.relationships.items():
            trust = rel.get("trust", 0)
            hostility = rel.get("hostility", 0)
            role = rel.get("role", "npc")
            lines.append(f"- {name} (ruolo: {role}, fiducia: {trust}, ostilità: {hostility})")
        return "\n".join(lines)

    def _list_events(self) -> str:
        """Elenca gli eventi significativi registrati."""
        if not self.state.events:
            return "Nessun evento registrato."
        lines = ["Eventi trascorsi:"]
        for ev in self.state.events:
            lines.append(f"- {ev.get('description', '')}")
        return "\n".join(lines)
