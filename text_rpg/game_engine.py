"""Motore di gioco per un'avventura testuale basata su DnD.

Il motore gestisce il personaggio del giocatore, le azioni, i tiri di dado e
interagisce con il modulo ``AIHelper`` per generare descrizioni dinamiche.
Lo stato viene serializzato/deserializzato tramite il modulo ``database``.
"""

from __future__ import annotations

import json
import logging
import os
import random
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any

from .ai_helper import AIHelper
from . import database


def roll_dice(sides: int = 20) -> int:
    """Tira un dado a ``sides`` facce e restituisce il risultato."""
    return random.randint(1, sides)


@dataclass
class Character:
    """Rappresenta il personaggio del giocatore con abilità e inventario."""

    name: str
    strength: int = 10
    dexterity: int = 10
    constitution: int = 10
    intelligence: int = 10
    wisdom: int = 10
    charisma: int = 10
    inventory: List[str] = field(default_factory=list)
    hp: int = 10
    infected: bool = False

    def ability_modifier(self, score: int) -> int:
        """Calcola il modificatore per una statistica DnD."""
        return (score - 10) // 2

    @property
    def modifiers(self) -> Dict[str, int]:
        return {
            "STR": self.ability_modifier(self.strength),
            "DEX": self.ability_modifier(self.dexterity),
            "CON": self.ability_modifier(self.constitution),
            "INT": self.ability_modifier(self.intelligence),
            "WIS": self.ability_modifier(self.wisdom),
            "CHA": self.ability_modifier(self.charisma),
        }


@dataclass
class GameState:
    """Contiene lo stato persistente della partita.

    Oltre ai campi base (personaggio, posizione, turno, storia), questa
    struttura tiene traccia di relazioni con altri personaggi, eventi
    significativi, regione e lingua corrente, lingue note e livello di
    difficoltà. Questi campi aggiuntivi permettono di gestire un
    sistema di relazioni complesso, di memorizzare eventi che
    influenzeranno le interazioni future e di simulare differenze
    linguistiche quando il giocatore si sposta tra aree geografiche.
    """

    character: Character
    location: str = "foresta"
    turn: int = 0
    narrative_history: List[str] = field(default_factory=list)
    # Mappa nome personaggio -> informazioni sulla relazione (es. fiducia, ostilità)
    relationships: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    # Lista di eventi significativi, ogni evento è un dizionario con tipo e descrizione
    events: List[Dict[str, Any]] = field(default_factory=list)
    # Regione e lingua attuali; utili per gestione dialetti
    region: str = "Italia"
    language: str = "italiano"
    # Elenco delle lingue conosciute dal personaggio
    known_languages: List[str] = field(default_factory=lambda: ["italiano"])
    # Livello di difficoltà (es. facile, normale, difficile)
    difficulty: str = "normale"

    def to_dict(self) -> Dict:
        return {
            "character": {
                "name": self.character.name,
                "strength": self.character.strength,
                "dexterity": self.character.dexterity,
                "constitution": self.character.constitution,
                "intelligence": self.character.intelligence,
                "wisdom": self.character.wisdom,
                "charisma": self.character.charisma,
                "inventory": self.character.inventory,
                "hp": self.character.hp,
                "infected": self.character.infected,
            },
            "location": self.location,
            "turn": self.turn,
            "narrative_history": self.narrative_history,
            "relationships": self.relationships,
            "events": self.events,
            "region": self.region,
            "language": self.language,
            "known_languages": self.known_languages,
            "difficulty": self.difficulty,
        }

    @staticmethod
    def from_dict(data: Dict) -> "GameState":
        char_data = data["character"]
        character = Character(
            name=char_data.get("name", "Sopravvissuto"),
            strength=char_data.get("strength", 10),
            dexterity=char_data.get("dexterity", 10),
            constitution=char_data.get("constitution", 10),
            intelligence=char_data.get("intelligence", 10),
            wisdom=char_data.get("wisdom", 10),
            charisma=char_data.get("charisma", 10),
            inventory=char_data.get("inventory", []),
            hp=char_data.get("hp", 10),
            infected=char_data.get("infected", False),
        )
        return GameState(
            character=character,
            location=data.get("location", "foresta"),
            turn=data.get("turn", 0),
            narrative_history=data.get("narrative_history", []),
            relationships=data.get("relationships", {}),
            events=data.get("events", []),
            region=data.get("region", "Italia"),
            language=data.get("language", "italiano"),
            known_languages=data.get("known_languages", ["italiano"]),
            difficulty=data.get("difficulty", "normale"),
        )


class GameEngine:
    """Classe principale che gestisce l'avventura testuale."""

    def __init__(self, ai_helper: AIHelper, db_path: str = database.DEFAULT_DB_PATH) -> None:
        self.ai_helper = ai_helper
        self.db_path = db_path
        self.state: Optional[GameState] = None

    def load_or_create_game(self) -> None:
        """Carica uno stato di gioco esistente oppure avvia una nuova partita."""
        data = database.load_state(self.db_path)
        if data:
            self.state = GameState.from_dict(data)
            logging.info("Partita caricata dal database.")
        else:
            # Se non c'è uno stato salvato, chiedi il nome del personaggio e crea uno stato nuovo
            name = input("Inserisci il nome del tuo personaggio: ") or "Sopravvissuto"
            # Distribuisci statistiche di base in modo casuale per semplicità
            scores = self._generate_ability_scores()
            character = Character(name=name, **scores)
            self.state = GameState(character=character)
            logging.info("Nuova partita creata per %s.", name)
            # Genera una descrizione iniziale
            intro = self.ai_helper.generate(
                f"Ti chiami {name} e ti risvegli in una foresta invasa dai morti viventi. "
                "Non ricordi come sei arrivato qui, ma senti un odore acre nell'aria e il grottone dei vaganti."
            )
            print(intro)
            self.state.narrative_history.append(intro)
            database.save_state(self.state.to_dict(), self.db_path)

    def _generate_ability_scores(self) -> Dict[str, int]:
        """Genera punteggi abilità casuali nel range 8–15."""
        return {
            "strength": random.randint(8, 15),
            "dexterity": random.randint(8, 15),
            "constitution": random.randint(8, 15),
            "intelligence": random.randint(8, 15),
            "wisdom": random.randint(8, 15),
            "charisma": random.randint(8, 15),
        }

    def save_game(self) -> None:
        """Salva lo stato attuale sul disco."""
        if self.state:
            database.save_state(self.state.to_dict(), self.db_path)

    def start_loop(self) -> None:
        """Avvia il ciclo principale di gioco, accettando comandi dal giocatore."""
        if not self.state:
            raise RuntimeError("Il gioco non è stato inizializzato. Chiama load_or_create_game() prima.")

        print("\nDigita 'aiuto' per visualizzare i comandi disponibili.\n")
        while True:
            cmd = input(
                f"[{self.state.location.title()} | Turno {self.state.turn}] Cosa vuoi fare? "
            ).strip().lower()
            if not cmd:
                continue
            if cmd in ("exit", "esci", "quit"):
                print("Hai terminato la sessione. Alla prossima!")
                self.save_game()
                break
            elif cmd in ("aiuto", "help"):
                self._print_help()
                continue
            else:
                self._handle_command(cmd)
                self.state.turn += 1
                self.save_game()

    def _print_help(self) -> None:
        """Mostra l'elenco dei comandi."""
        print(
            "Comandi disponibili:\n"
            "  guarda — osserva l'ambiente\n"
            "  inventario — mostra gli oggetti che possiedi\n"
            "  prendi <oggetto> — raccogli un oggetto\n"
            "  usa <oggetto> — usa un oggetto\n"
            "  muovi <direzione> — prova a muoverti (nord, sud, est, ovest)\n"
            "  esci — salva e chiudi il gioco"
        )

    def _handle_command(self, cmd: str) -> None:
        """Gestisce un comando dell'utente."""
        if not self.state:
            return
        parts = cmd.split()
        verb = parts[0]
        args = parts[1:]
        if verb == "guarda":
            self._command_look()
        elif verb == "inventario":
            self._command_inventory()
        elif verb == "prendi" and args:
            self._command_take(" ".join(args))
        elif verb == "usa" and args:
            self._command_use(" ".join(args))
        elif verb == "muovi" and args:
            self._command_move(args[0])
        else:
            print("Comando non riconosciuto. Digita 'aiuto' per l'elenco completo.")

    def _command_look(self) -> None:
        """Descrive l'ambiente attuale utilizzando l'IA."""
        if not self.state:
            return
        # Genera una descrizione basata sulla location
        prompt = (
            f"Sei in {self.state.location}. "
            "Descrivi l'ambiente circostante con toni cupi e minacciosi, facendo riferimento ai vaganti presenti."
        )
        description = self.ai_helper.generate(prompt)
        print(description)
        self.state.narrative_history.append(description)

    def _command_inventory(self) -> None:
        """Mostra l'inventario del personaggio."""
        inv = self.state.character.inventory
        if inv:
            print("Nel tuo inventario hai: " + ", ".join(inv))
        else:
            print("Il tuo inventario è vuoto.")

    def _command_take(self, item: str) -> None:
        """Prova a raccogliere un oggetto."""
        # In questo semplice prototipo, generiamo casualmente un oggetto con una prova di percezione
        # Tiro di abilità: Saggezza (Percezione) con CD 10
        char = self.state.character
        mod = char.modifiers.get("WIS", 0)
        roll = roll_dice()
        total = roll + mod
        if total >= 10:
            print(f"Hai trovato e raccolto {item} (tiro {roll}+{mod}={total} ≥ 10).")
            char.inventory.append(item)
        else:
            print(f"Non riesci a trovare {item} (tiro {roll}+{mod}={total} < 10).")

    def _command_use(self, item: str) -> None:
        """Usa un oggetto dall'inventario."""
        char = self.state.character
        if item not in char.inventory:
            print(f"Non hai {item} nell'inventario.")
            return
        # Logica semplificata: usare un medikit cura punti ferita, un'arma uccide un vagante ecc.
        if item.lower() in ("medikit", "kit medico"):
            if char.hp < 10:
                char.hp = min(10, char.hp + 5)
                print("Usi il medikit e recuperi energia. Punti ferita attuali:", char.hp)
                char.inventory.remove(item)
            else:
                print("Sei già al massimo della salute, non è necessario usarlo adesso.")
        else:
            print(f"Usi {item}, ma nulla di particolare accade in questo momento.")

    def _command_move(self, direction: str) -> None:
        """Muove il personaggio verso una direzione."""
        valid = {"nord", "sud", "est", "ovest"}
        if direction not in valid:
            print("Direzione non valida. Scegli tra nord, sud, est, ovest.")
            return
        # Per semplicità, cambiamo location sulla base della direzione
        prev_location = self.state.location
        self.state.location = f"{direction} del {prev_location}"
        description = self.ai_helper.generate(
            f"Il personaggio si muove verso {direction}. Descrivi cosa vede nella nuova area in modo inquietante."
        )
        print(description)
        self.state.narrative_history.append(description)
