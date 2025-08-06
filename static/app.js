// Front‑end logic for the web‑based text adventure game.

document.addEventListener("DOMContentLoaded", () => {
    const startSection = document.getElementById("start-section");
    const gameSection = document.getElementById("game-section");
    const playerNameInput = document.getElementById("player-name");
    const regionSelect = document.getElementById("region-select");
    const difficultySelect = document.getElementById("difficulty-select");
    const startBtn = document.getElementById("start-btn");
    const historyEl = document.getElementById("history");
    const commandInput = document.getElementById("command-input");
    const sendBtn = document.getElementById("send-btn");

    let sessionId = null;

    /**
     * Append a line of text to the history display and scroll to bottom.
     * @param {string} text
     */
    function appendMessage(text) {
        const p = document.createElement("p");
        p.textContent = text;
        historyEl.appendChild(p);
        // Auto‑scroll to latest message
        historyEl.scrollTop = historyEl.scrollHeight;
    }

    /**
     * Start a new game session by calling the /init endpoint.
     */
    async function startGame() {
        const name = playerNameInput.value.trim();
        if (!name) {
            alert("Per favore inserisci il tuo nome.");
            return;
        }
        const region = regionSelect.value;
        const difficulty = difficultySelect.value;
        try {
            const response = await fetch("/init", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    playerName: name,
                    region: region,
                    difficulty: difficulty
                })
            });
            const data = await response.json();
            if (!response.ok) {
                alert(data.error || "Si è verificato un errore inizializzando la partita.");
                return;
            }
            sessionId = data.sessionId;
            // Hide start and show game
            startSection.style.display = "none";
            gameSection.style.display = "block";
            // Add introductory message
            appendMessage(data.message);
            // Focus the command input for immediate typing
            commandInput.focus();
        } catch (err) {
            console.error("Error starting game", err);
            alert("Errore durante l'inizio della partita. Riprova.");
        }
    }

    /**
     * Send a command to the server and append the response.
     */
    async function sendCommand() {
        const cmd = commandInput.value.trim();
        if (!cmd || !sessionId) return;
        appendMessage("> " + cmd);
        commandInput.value = "";
        try {
            const response = await fetch("/command", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ sessionId: sessionId, command: cmd })
            });
            const data = await response.json();
            if (!response.ok) {
                appendMessage("[Errore] " + (data.error || "Si è verificato un errore."));
                return;
            }
            appendMessage(data.message);
        } catch (err) {
            console.error("Error sending command", err);
            appendMessage("[Errore] Problema di rete o server.");
        }
    }

    // Event listeners
    startBtn.addEventListener("click", startGame);
    // Pressing Enter in player name starts game
    playerNameInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            startGame();
        }
    });
    sendBtn.addEventListener("click", sendCommand);
    // Pressing Enter in command sends command
    commandInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            sendCommand();
        }
    });
});