"""Script di avvio per l'avventura testuale DnD/TWD.

Esegue il motore di gioco, caricando o creando una nuova partita e
gestendo il ciclo di input dell'utente.
"""

import logging

from text_rpg.ai_helper import AIHelper
from text_rpg.game_engine import GameEngine


def main() -> None:
    # Configura il logger di base
    logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
    # Istanzia l'helper dell'IA con il modello predefinito (distilgpt2)
    ai = AIHelper(model_name="distilgpt2", temperature=0.8)
    engine = GameEngine(ai)
    engine.load_or_create_game()
    engine.start_loop()


if __name__ == "__main__":
    main()
