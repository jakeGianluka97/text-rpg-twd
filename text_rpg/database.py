"""Modulo per la persistenza dello stato di gioco.

In assenza di requisiti complessi, questo modulo utilizza SQLite tramite il
modulo standard ``sqlite3`` per salvare e caricare lo stato del gioco. Se
preferisci una soluzione ancora più leggera, puoi sostituire l'uso
dell'SQL con salvataggi su file JSON: le funzioni di salvataggio e
caricamento sono state progettate in modo da poter essere facilmente
estese o sostituite.
"""

from __future__ import annotations

import json
import os
import sqlite3
from typing import Any, Dict, Optional


DEFAULT_DB_PATH = os.path.join(os.path.dirname(__file__), "game.db")


def _ensure_table(conn: sqlite3.Connection) -> None:
    """Crea la tabella ``game_state`` se non esiste."""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS game_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            state_json TEXT NOT NULL
        )
        """
    )
    conn.commit()


def save_state(state: Dict[str, Any], db_path: str = DEFAULT_DB_PATH) -> None:
    """Salva lo stato del gioco nel database.

    Args:
        state: dizionario rappresentante lo stato.
        db_path: percorso del file di database.
    """
    conn = sqlite3.connect(db_path)
    _ensure_table(conn)
    state_json = json.dumps(state)
    # Usa id=1 per avere un'unica riga che viene sovrascritta
    conn.execute(
        "INSERT OR REPLACE INTO game_state (id, state_json) VALUES (1, ?)",
        (state_json,),
    )
    conn.commit()
    conn.close()


def load_state(db_path: str = DEFAULT_DB_PATH) -> Optional[Dict[str, Any]]:
    """Carica lo stato del gioco dal database.

    Args:
        db_path: percorso del file di database.

    Returns:
        Dizionario con lo stato del gioco se presente, altrimenti ``None``.
    """
    if not os.path.exists(db_path):
        return None
    conn = sqlite3.connect(db_path)
    _ensure_table(conn)
    cur = conn.execute("SELECT state_json FROM game_state WHERE id = 1")
    row = cur.fetchone()
    conn.close()
    if row:
        return json.loads(row[0])
    return None
