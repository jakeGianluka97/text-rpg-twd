"""Web application for the DnD/TWD text adventure game.

This Flask app exposes a simple API to initialize a new game session
and to process player commands. It serves a minimal front‑end so
that the player can interact with the game from their browser.

The game engine itself lives in the ``text_rpg`` package. We import
``WebEngine`` and ``AIHelper`` to handle the core gameplay. Each
session is associated with a unique identifier and stored in a
dictionary in memory. For production use you might persist
session IDs and game state in a database or cache, but for this
example an in‑memory store suffices.

To run the application locally, install the dependencies::

    pip install flask transformers torch

Then start the server:

    python app.py

Open http://localhost:5000 in your browser and enter a character
name to begin the adventure.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from typing import Dict

from flask import Flask, jsonify, render_template, request

from text_rpg.ai_helper import AIHelper
from text_rpg.web_engine import WebEngine


app = Flask(__name__, template_folder="templates", static_folder="static")

# In‑memory store mapping session IDs to WebEngine instances. In a
# real deployment this could be stored in a database or cache. For
# single‑user play during development it suffices.
sessions: Dict[str, WebEngine] = {}


@app.route("/")
def index() -> str:
    """Serve the main page with the game interface."""
    return render_template("index.html")


@app.route("/init", methods=["POST"])
def init_game() -> any:
    """Initialize a new game session.

    Expects JSON body with a ``playerName`` field and optionally
    ``region`` and ``difficulty``. Returns JSON containing a
    ``sessionId`` used for subsequent requests and ``message`` with
    the introductory description.
    """
    data = request.get_json(silent=True) or {}
    player_name = (data.get("playerName") or "").strip()
    if not player_name:
        return jsonify({"error": "playerName is required"}), 400
    region = (data.get("region") or "Italia").strip() or "Italia"
    difficulty = (data.get("difficulty") or "normale").strip() or "normale"
    # Generate a session ID and create a WebEngine.
    session_id = str(uuid.uuid4())
    ai = AIHelper(model_name="distilgpt2", temperature=0.8)
    engine = WebEngine(ai)
    intro = engine.load_or_create(player_name, region=region, difficulty=difficulty)
    sessions[session_id] = engine
    return jsonify({"sessionId": session_id, "message": intro})


@app.route("/command", methods=["POST"])
def process_command() -> any:
    """Handle a player command for a given session.

    Expects JSON body with ``sessionId`` and ``command``. Looks up the
    corresponding WebEngine instance and returns the response.
    """
    data = request.get_json(silent=True) or {}
    session_id = data.get("sessionId")
    command = (data.get("command") or "").strip()
    if not session_id or session_id not in sessions:
        return jsonify({"error": "Invalid or missing sessionId"}), 400
    if not command:
        return jsonify({"error": "command is required"}), 400
    engine = sessions[session_id]
    try:
        response = engine.handle_command(command)
    except Exception as exc:
        # Catch unexpected errors and log them on the server; return a
        # generic error to the client.
        app.logger.exception("Error while processing command: %s", exc)
        return jsonify({"error": "Si è verificato un errore interno."}), 500
    return jsonify({"message": response})


if __name__ == "__main__":
    # For development only: enable debug mode for hot reload and
    # detailed error pages. In production set debug=False and use
    # a production WSGI server such as Gunicorn.
    app.run(debug=True)